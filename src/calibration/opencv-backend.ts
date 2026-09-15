import {distortionModelForCoefficientCount} from './profile.js';
import type {
  CalibrationBackendFactory,
  CalibrationBackendPort,
  CalibrationBoard,
  CalibrationCorner,
  CalibrationFrame,
  CalibrationSample,
  CalibrationSolveResult
} from './types.js';

/**
 * The single pinned production solver. The version is part of the identifier so
 * that a project can record which build produced a profile.
 */
export const OPENCV_BACKEND_NAME = 'opencv-js-wasm-4.12.0';

interface CvMat {
  readonly rows: number;
  readonly cols: number;
  readonly data32F: Float32Array;
  readonly data64F: Float64Array;
  doubleAt(row: number, column: number): number;
  delete(): void;
}

interface CvMatConstructor {
  new (): CvMat;
  eye(rows: number, columns: number, type: number): CvMat;
  zeros(rows: number, columns: number, type: number): CvMat;
}

interface CvMatVector {
  push_back(value: CvMat): void;
  get(index: number): CvMat;
  delete(): void;
}

interface CvApi {
  Mat: CvMatConstructor;
  MatVector: new () => CvMatVector;
  Size: new (width: number, height: number) => unknown;
  CV_32FC2: number;
  CV_32FC3: number;
  CV_64F: number;
  COLOR_RGBA2GRAY: number;
  CALIB_CB_ADAPTIVE_THRESH: number;
  CALIB_CB_NORMALIZE_IMAGE: number;
  TermCriteria_EPS: number;
  TermCriteria_MAX_ITER: number;
  TermCriteria: new (type: number, maxCount: number, epsilon: number) => unknown;
  imread(source: HTMLCanvasElement): CvMat;
  cvtColor(source: CvMat, destination: CvMat, code: number): void;
  findChessboardCorners(
    image: CvMat,
    patternSize: unknown,
    corners: CvMat,
    flags: number
  ): boolean;
  cornerSubPix(
    image: CvMat,
    corners: CvMat,
    window: unknown,
    zeroZone: unknown,
    criteria: unknown
  ): void;
  Laplacian(source: CvMat, destination: CvMat, depth: number): void;
  meanStdDev(source: CvMat, mean: CvMat, standardDeviation: CvMat): void;
  matFromArray(
    rows: number,
    columns: number,
    type: number,
    values: readonly number[]
  ): CvMat;
  calibrateCamera(
    objectPoints: CvMatVector,
    imagePoints: CvMatVector,
    imageSize: unknown,
    cameraMatrix: CvMat,
    distortionCoefficients: CvMat,
    rotationVectors: CvMatVector,
    translationVectors: CvMatVector
  ): number;
  getBuildInformation(): string;
}

let openCvPromise: Promise<CvApi> | undefined;

/**
 * Detects the chessboard and solves the camera intrinsics with OpenCV.
 *
 * The per-view rotation and translation OpenCV also produces are deliberately
 * discarded. They describe where the board happened to sit during calibration,
 * not where the camera stands, and this extension publishes intrinsics only.
 */
export class OpenCvChessboardCalibrationBackend implements CalibrationBackendPort {
  public readonly name = OPENCV_BACKEND_NAME;

  public async captureSample(
    frame: CalibrationFrame,
    board: CalibrationBoard
  ): Promise<CalibrationSample | undefined> {
    const cv = await getOpenCv();
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (!context) throw new Error('A 2D canvas context is unavailable.');
    context.drawImage(frame.element, 0, 0, frame.width, frame.height);

    const source = cv.imread(canvas);
    const gray = new cv.Mat();
    const corners = new cv.Mat();
    const laplacian = new cv.Mat();
    const mean = new cv.Mat();
    const standardDeviation = new cv.Mat();
    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
      const found = cv.findChessboardCorners(
        gray,
        new cv.Size(board.columns, board.rows),
        corners,
        cv.CALIB_CB_ADAPTIVE_THRESH | cv.CALIB_CB_NORMALIZE_IMAGE
      );
      if (!found) return undefined;
      cv.cornerSubPix(
        gray,
        corners,
        new cv.Size(11, 11),
        new cv.Size(-1, -1),
        new cv.TermCriteria(cv.TermCriteria_EPS | cv.TermCriteria_MAX_ITER, 30, 0.01)
      );
      const points = readPointPairs(corners.data32F);
      cv.Laplacian(gray, laplacian, cv.CV_64F);
      cv.meanStdDev(laplacian, mean, standardDeviation);
      const sharpness = standardDeviation.doubleAt(0, 0) ** 2;
      const coverage = boardCoverage(points, frame.width, frame.height);
      const quality = clamp01(
        0.7 * Math.min(1, coverage / 0.25) + 0.3 * Math.min(1, sharpness / 100)
      );
      return {corners: points, quality, coverage, sharpness};
    } finally {
      standardDeviation.delete();
      mean.delete();
      laplacian.delete();
      corners.delete();
      gray.delete();
      source.delete();
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  public async solve(
    samples: readonly CalibrationSample[],
    board: CalibrationBoard,
    imageWidth: number,
    imageHeight: number
  ): Promise<CalibrationSolveResult> {
    const cv = await getOpenCv();
    const objectPoints = new cv.MatVector();
    const imagePoints = new cv.MatVector();
    const rotationVectors = new cv.MatVector();
    const translationVectors = new cv.MatVector();
    const cameraMatrix = cv.Mat.eye(3, 3, cv.CV_64F);
    const distortionCoefficients = cv.Mat.zeros(8, 1, cv.CV_64F);
    const retainedMats: CvMat[] = [];
    try {
      const worldPoints = chessboardWorldPoints(board);
      for (const sample of samples) {
        const objectPoint = cv.matFromArray(
          sample.corners.length,
          1,
          cv.CV_32FC3,
          worldPoints
        );
        const imagePoint = cv.matFromArray(
          sample.corners.length,
          1,
          cv.CV_32FC2,
          sample.corners.flatMap(({x, y}) => [x, y])
        );
        retainedMats.push(objectPoint, imagePoint);
        objectPoints.push_back(objectPoint);
        imagePoints.push_back(imagePoint);
      }
      const reprojectionErrorPx = cv.calibrateCamera(
        objectPoints,
        imagePoints,
        new cv.Size(imageWidth, imageHeight),
        cameraMatrix,
        distortionCoefficients,
        rotationVectors,
        translationVectors
      );
      // OpenCV resizes the coefficient matrix to the model it actually fitted,
      // so the returned length identifies the distortion model.
      const coefficientCount = distortionCoefficients.rows * distortionCoefficients.cols;
      return {
        intrinsicMatrix: readMatrix(cameraMatrix, 9),
        distortionModel: distortionModelForCoefficientCount(coefficientCount),
        distortionCoefficients: readMatrix(distortionCoefficients, coefficientCount),
        reprojectionErrorPx
      };
    } finally {
      for (const matrix of retainedMats) matrix.delete();
      distortionCoefficients.delete();
      cameraMatrix.delete();
      translationVectors.delete();
      rotationVectors.delete();
      imagePoints.delete();
      objectPoints.delete();
    }
  }
}

/**
 * Names the solver without constructing it, so that reading the backend
 * reporter — or loading the extension at all — never initializes the OpenCV
 * WebAssembly runtime.
 */
export const openCvBackendFactory: CalibrationBackendFactory = {
  name: OPENCV_BACKEND_NAME,
  async create(): Promise<CalibrationBackendPort> {
    return new OpenCvChessboardCalibrationBackend();
  }
};

function getOpenCv(): Promise<CvApi> {
  openCvPromise ??= initializeOpenCv();
  return openCvPromise;
}

async function initializeOpenCv(): Promise<CvApi> {
  const importedOpenCv = await import('@techstark/opencv-js');
  const imported = importedOpenCv as unknown as {default?: unknown; then?: unknown};
  const candidate = imported.default ?? imported;
  const resolved = isThenable(candidate) ? await candidate : candidate;
  if (!isCvApi(resolved)) {
    throw new Error('The pinned OpenCV.js WASM module did not initialize.');
  }
  return resolved;
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

function isCvApi(value: unknown): value is CvApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getBuildInformation' in value &&
    typeof (value as {getBuildInformation: unknown}).getBuildInformation === 'function'
  );
}

function readPointPairs(values: Float32Array): CalibrationCorner[] {
  const result: CalibrationCorner[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    result.push({x: values[index] ?? 0, y: values[index + 1] ?? 0});
  }
  return result;
}

function boardCoverage(
  points: readonly CalibrationCorner[],
  width: number,
  height: number
): number {
  const xs = points.map(({x}) => x);
  const ys = points.map(({y}) => y);
  return (
    ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) /
    (width * height)
  );
}

function chessboardWorldPoints(board: CalibrationBoard): number[] {
  const points: number[] = [];
  for (let row = 0; row < board.rows; row += 1) {
    for (let column = 0; column < board.columns; column += 1) {
      points.push(column * board.squareSizeMeters, row * board.squareSizeMeters, 0);
    }
  }
  return points;
}

function readMatrix(matrix: CvMat, expected: number): number[] {
  const values = Array.from(matrix.data64F.slice(0, expected));
  if (values.length !== expected || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`OpenCV returned an invalid ${expected}-element matrix.`);
  }
  return values;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
