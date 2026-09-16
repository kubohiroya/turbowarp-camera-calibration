import {distortionModelForCoefficientCount} from './profile.js';
import {OPENCV_BACKEND_NAME} from './opencv-symbols.js';

export {OPENCV_BACKEND_NAME};
import type {
  BoardPoseSolution,
  CalibrationBoard,
  CalibrationCorner,
  CalibrationPixels,
  CalibrationSample,
  CalibrationSolveResult
} from './types.js';


/**
 * The fewest corners a view has to show to be worth keeping.
 *
 * A ChArUco view need not show the whole board -- that is the point of the
 * markers -- but a handful of corners constrains almost nothing and drags the
 * solve out for no gain. Six is two markers' worth.
 */
const MINIMUM_CORNERS = 6;

interface CvMat {
  readonly rows: number;
  readonly cols: number;
  readonly data32F: Float32Array;
  readonly data32S: Int32Array;
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

interface CvPoint3fVector {
  size(): number;
  get(index: number): {x: number; y: number; z: number};
  delete(): void;
}

interface CvCharucoBoard {
  getChessboardCorners(): CvPoint3fVector;
  delete(): void;
}

interface CvCharucoDetector {
  detectBoard(image: CvMat, corners: CvMat, ids: CvMat): void;
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
  matFromImageData(image: {width: number; height: number; data: Uint8ClampedArray}): CvMat;
  cvtColor(source: CvMat, destination: CvMat, code: number): void;
  DICT_4X4_50: number;
  getPredefinedDictionary(name: number): unknown;
  aruco_CharucoBoard: new (
    size: unknown,
    squareLength: number,
    markerLength: number,
    dictionary: unknown,
    ids: CvMat
  ) => CvCharucoBoard;
  aruco_CharucoParameters: new () => unknown;
  aruco_DetectorParameters: new () => unknown;
  aruco_RefineParameters: new (
    minRepDistance: number,
    errorCorrectionRate: number,
    checkAllOrders: boolean
  ) => unknown;
  aruco_CharucoDetector: new (
    board: CvCharucoBoard,
    charucoParameters: unknown,
    detectorParameters: unknown,
    refineParameters: unknown
  ) => CvCharucoDetector;
  Laplacian(source: CvMat, destination: CvMat, depth: number): void;
  meanStdDev(source: CvMat, mean: CvMat, standardDeviation: CvMat): void;
  matFromArray(
    rows: number,
    columns: number,
    type: number,
    values: readonly number[]
  ): CvMat;
  solvePnP(
    objectPoints: CvMat,
    imagePoints: CvMat,
    cameraMatrix: CvMat,
    distortionCoefficients: CvMat,
    rotationVector: CvMat,
    translationVector: CvMat
  ): boolean;
  projectPoints(
    objectPoints: CvMat,
    rotationVector: CvMat,
    translationVector: CvMat,
    cameraMatrix: CvMat,
    distortionCoefficients: CvMat,
    imagePoints: CvMat
  ): void;
  calibrateCameraExtended(
    objectPoints: CvMatVector,
    imagePoints: CvMatVector,
    imageSize: unknown,
    cameraMatrix: CvMat,
    distortionCoefficients: CvMat,
    rotationVectors: CvMatVector,
    translationVectors: CvMatVector,
    standardDeviationsIntrinsics: CvMat,
    standardDeviationsExtrinsics: CvMat,
    perViewErrors: CvMat
  ): number;
  getBuildInformation(): string;
}

/**
 * Detects the chessboard and solves the camera intrinsics with OpenCV.
 *
 * The per-view rotation and translation OpenCV also produces are deliberately
 * discarded. They describe where the board happened to sit during calibration,
 * not where the camera stands, and this extension publishes intrinsics only.
 */
export class OpenCvChessboardCalibration {
  public readonly name = OPENCV_BACKEND_NAME;

  /**
   * The runtime, handed in rather than reached for.
   *
   * It has to be started while the worker's own modules are being evaluated.
   * Asking for it later -- from inside the message handler that the first
   * sample arrives on -- wedges the worker: measured past two minutes with the
   * worker's own timers no longer firing, so it is a blocked thread and not a
   * promise nobody resolved. Taking it as an argument is what makes reaching
   * for it late impossible to write.
   */
  public constructor(private readonly ready: Promise<CvApi>) {}

  /**
   * One detector per board, built on first use.
   *
   * Building it means constructing the dictionary, the board and three
   * parameter objects, none of which depend on the frame. Rebuilding that for
   * every sample would put it on the path the operator is waiting on.
   */
  private readonly detectors = new Map<string, {board: CvCharucoBoard; detector: CvCharucoDetector}>();

  private detectorFor(cv: CvApi, board: CalibrationBoard): CvCharucoDetector {
    return this.entryFor(cv, board).detector;
  }

  private entryFor(
    cv: CvApi,
    board: CalibrationBoard
  ): {board: CvCharucoBoard; detector: CvCharucoDetector} {
    const key = `${board.columns}x${board.rows}:${board.squareSizeMeters}:${board.markerSizeMeters}`;
    const existing = this.detectors.get(key);
    if (existing) return existing;
    const dictionary = cv.getPredefinedDictionary(cv.DICT_4X4_50);
    const ids = new cv.Mat();
    // The board is one square larger than its inner corner grid in each
    // direction, which is the same relationship a plain chessboard has.
    const charuco = new cv.aruco_CharucoBoard(
      new cv.Size(board.columns + 1, board.rows + 1),
      board.squareSizeMeters,
      board.markerSizeMeters,
      dictionary,
      ids
    );
    const detector = new cv.aruco_CharucoDetector(
      charuco,
      new cv.aruco_CharucoParameters(),
      new cv.aruco_DetectorParameters(),
      new cv.aruco_RefineParameters(10, 3, true)
    );
    const entry = {board: charuco, detector};
    this.detectors.set(key, entry);
    return entry;
  }

  /** Where each inner corner sits on the board, in metres. */
  private worldPointsFor(cv: CvApi, board: CalibrationBoard): number[][] {
    const corners = this.entryFor(cv, board).board.getChessboardCorners();
    const points: number[][] = [];
    for (let index = 0; index < corners.size(); index += 1) {
      const point = corners.get(index);
      points.push([point.x, point.y, point.z ?? 0]);
    }
    return points;
  }

  public async captureSample(
    frame: CalibrationPixels,
    board: CalibrationBoard
  ): Promise<CalibrationSample | undefined> {
    const cv = await this.ready;
    // Pixels, not an element. cv.imread reaches for document and
    // HTMLImageElement, neither of which exists where this now runs; the frame
    // is read on the thread that owns the video and the bytes are sent here.
    const source = cv.matFromImageData(frame);
    const gray = new cv.Mat();
    const corners = new cv.Mat();
    const ids = new cv.Mat();
    const laplacian = new cv.Mat();
    const mean = new cv.Mat();
    const standardDeviation = new cv.Mat();
    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
      const detector = this.detectorFor(cv, board);
      detector.detectBoard(gray, corners, ids);
      // No corners at all is a board that is not in frame. A few is a board
      // mostly out of frame, and those are kept: the corners near the edge of
      // the image are the ones that pin down the principal point.
      if (ids.rows < MINIMUM_CORNERS) return undefined;
      const points = readPointPairs(corners.data32F);
      const identifiers: number[] = Array.from(ids.data32S);
      cv.Laplacian(gray, laplacian, cv.CV_64F);
      cv.meanStdDev(laplacian, mean, standardDeviation);
      const sharpness = standardDeviation.doubleAt(0, 0) ** 2;
      const coverage = boardCoverage(points, frame.width, frame.height);
      const completeness = identifiers.length / (board.columns * board.rows);
      const quality = clamp01(
        0.5 * Math.min(1, coverage / 0.25) +
          0.3 * Math.min(1, sharpness / 100) +
          0.2 * completeness
      );
      return {corners: points, ids: identifiers, quality, coverage, sharpness};
    } finally {
      standardDeviation.delete();
      mean.delete();
      laplacian.delete();
      ids.delete();
      corners.delete();
      gray.delete();
      source.delete();
    }
  }

  public async solve(
    samples: readonly CalibrationSample[],
    board: CalibrationBoard,
    imageWidth: number,
    imageHeight: number
  ): Promise<CalibrationSolveResult> {
    const cv = await this.ready;
    const objectPoints = new cv.MatVector();
    const imagePoints = new cv.MatVector();
    const rotationVectors = new cv.MatVector();
    const translationVectors = new cv.MatVector();
    const cameraMatrix = cv.Mat.eye(3, 3, cv.CV_64F);
    const distortionCoefficients = cv.Mat.zeros(8, 1, cv.CV_64F);
    const standardDeviationsIntrinsics = new cv.Mat();
    const standardDeviationsExtrinsics = new cv.Mat();
    const perViewErrors = new cv.Mat();
    const retainedMats: CvMat[] = [];
    try {
      const worldPoints = this.worldPointsFor(cv, board);
      for (const sample of samples) {
        // A view contributes the corners it showed, named by their ids. Views
        // therefore differ in length, which the solver accepts and a plain
        // chessboard could never produce.
        const objectPoint = cv.matFromArray(
          sample.ids.length,
          1,
          cv.CV_32FC3,
          sample.ids.flatMap((id) => worldPoints[id] ?? [0, 0, 0])
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
      const reprojectionErrorPx = cv.calibrateCameraExtended(
        objectPoints,
        imagePoints,
        new cv.Size(imageWidth, imageHeight),
        cameraMatrix,
        distortionCoefficients,
        rotationVectors,
        translationVectors,
        standardDeviationsIntrinsics,
        standardDeviationsExtrinsics,
        perViewErrors
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
      perViewErrors.delete();
      standardDeviationsExtrinsics.delete();
      standardDeviationsIntrinsics.delete();
      distortionCoefficients.delete();
      cameraMatrix.delete();
      translationVectors.delete();
      rotationVectors.delete();
      imagePoints.delete();
      objectPoints.delete();
    }
  }

  /**
   * Finds the board in one frame and solves where it is.
   *
   * The same arithmetic the hold-out check already does, asked of one live
   * frame instead of a stored sample, and reported rather than reduced to a
   * residual. Nothing new is computed: this exists because the answer was being
   * thrown away.
   */
  public async measurePose(
    frame: CalibrationPixels,
    board: CalibrationBoard,
    solution: CalibrationSolveResult
  ): Promise<BoardPoseSolution | undefined> {
    const cv = await this.ready;
    const source = cv.matFromImageData(frame);
    const gray = new cv.Mat();
    const corners = new cv.Mat();
    const ids = new cv.Mat();
    const scratch: CvMat[] = [source, gray, corners, ids];
    try {
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
      this.detectorFor(cv, board).detectBoard(gray, corners, ids);
      if (ids.rows < MINIMUM_CORNERS) return undefined;
      const observed = readPointPairs(corners.data32F);
      const identifiers: number[] = Array.from(ids.data32S);
      const worldPoints = this.worldPointsFor(cv, board);

      const objectPoint = cv.matFromArray(
        identifiers.length,
        1,
        cv.CV_32FC3,
        identifiers.flatMap((id) => worldPoints[id] ?? [0, 0, 0])
      );
      const imagePoint = cv.matFromArray(
        observed.length,
        1,
        cv.CV_32FC2,
        observed.flatMap(({x, y}) => [x, y])
      );
      const cameraMatrix = cv.matFromArray(3, 3, cv.CV_64F, solution.intrinsicMatrix);
      const distortion = cv.matFromArray(
        Math.max(1, solution.distortionCoefficients.length),
        1,
        cv.CV_64F,
        solution.distortionCoefficients.length > 0
          ? solution.distortionCoefficients
          : [0]
      );
      const rotation = new cv.Mat();
      const translation = new cv.Mat();
      const projected = new cv.Mat();
      scratch.push(objectPoint, imagePoint, cameraMatrix, distortion, rotation, translation, projected);

      if (!cv.solvePnP(objectPoint, imagePoint, cameraMatrix, distortion, rotation, translation)) {
        return undefined;
      }
      cv.projectPoints(objectPoint, rotation, translation, cameraMatrix, distortion, projected);
      const predicted = readPointPairs(projected.data32F);
      let squared = 0;
      let counted = 0;
      for (let index = 0; index < observed.length; index += 1) {
        const seen = observed[index];
        const expected = predicted[index];
        if (!seen || !expected) continue;
        squared += (seen.x - expected.x) ** 2 + (seen.y - expected.y) ** 2;
        counted += 1;
      }

      return {
        rotation: rotationMatrixFrom(readMatrix(rotation, 3)),
        translationMeters: readMatrix(translation, 3),
        cornerCount: identifiers.length,
        reprojectionErrorPx: counted > 0 ? Math.sqrt(squared / counted) : 0,
        observedPoints: identifiers.map((id, index) => ({
          id,
          u: observed[index]?.x ?? 0,
          v: observed[index]?.y ?? 0
        }))
      };
    } finally {
      for (const matrix of scratch) matrix.delete();
    }
  }

  /**
   * Reprojects held-out views with the solved intrinsics.
   *
   * Each view's pose is solved first, from those intrinsics. That is not
   * circular: the pose describes where the board happened to be, which the
   * calibration never claimed to know, and every view of a planar target needs
   * one before its corners can be predicted at all. What the residual then
   * measures is whether the intrinsics account for corners they were not
   * fitted to.
   */
  public async validate(
    samples: readonly CalibrationSample[],
    board: CalibrationBoard,
    solution: CalibrationSolveResult
  ): Promise<number> {
    if (samples.length === 0) return 0;
    const cv = await this.ready;
    const worldPoints = this.worldPointsFor(cv, board);
    const cameraMatrix = cv.matFromArray(3, 3, cv.CV_64F, solution.intrinsicMatrix);
    const distortion = cv.matFromArray(
      Math.max(1, solution.distortionCoefficients.length),
      1,
      cv.CV_64F,
      solution.distortionCoefficients.length > 0
        ? solution.distortionCoefficients
        : [0]
    );
    let squared = 0;
    let counted = 0;
    const scratch: CvMat[] = [cameraMatrix, distortion];
    try {
      for (const sample of samples) {
        const objectPoint = cv.matFromArray(
          sample.ids.length,
          1,
          cv.CV_32FC3,
          sample.ids.flatMap((id) => worldPoints[id] ?? [0, 0, 0])
        );
        const imagePoint = cv.matFromArray(
          sample.corners.length,
          1,
          cv.CV_32FC2,
          sample.corners.flatMap(({x, y}) => [x, y])
        );
        const rotation = new cv.Mat();
        const translation = new cv.Mat();
        const projected = new cv.Mat();
        scratch.push(objectPoint, imagePoint, rotation, translation, projected);
        if (
          !cv.solvePnP(
            objectPoint,
            imagePoint,
            cameraMatrix,
            distortion,
            rotation,
            translation
          )
        ) {
          // A view whose pose cannot be solved says nothing about the
          // intrinsics, so it is left out rather than scored as a large error.
          continue;
        }
        cv.projectPoints(
          objectPoint,
          rotation,
          translation,
          cameraMatrix,
          distortion,
          projected
        );
        const predicted = readPointPairs(projected.data32F);
        for (let index = 0; index < sample.corners.length; index += 1) {
          const observed = sample.corners[index];
          const expected = predicted[index];
          if (!observed || !expected) continue;
          squared += (observed.x - expected.x) ** 2 + (observed.y - expected.y) ** 2;
          counted += 1;
        }
      }
    } finally {
      for (const matrix of scratch) matrix.delete();
    }
    return counted > 0 ? Math.sqrt(squared / counted) : 0;
  }
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

/**
 * Rodrigues: the rotation vector OpenCV returns, as a matrix.
 *
 * Done here rather than through cv.Rodrigues so the exported symbol list stays
 * as short as it is -- every name on it is a name the OpenCV build has to
 * carry. The formula is R = I cos(t) + sin(t)[k] + (1 - cos(t)) k k^T, where t
 * is the vector's length and k its direction.
 */
function rotationMatrixFrom(vector: readonly number[]): number[] {
  const [x = 0, y = 0, z = 0] = vector;
  const theta = Math.hypot(x, y, z);
  // A zero vector is no rotation at all, and normalizing it would divide by it.
  if (theta < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const [kx, ky, kz] = [x / theta, y / theta, z / theta];
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const t = 1 - c;
  return [
    c + kx * kx * t, kx * ky * t - kz * s, kx * kz * t + ky * s,
    ky * kx * t + kz * s, c + ky * ky * t, ky * kz * t - kx * s,
    kz * kx * t - ky * s, kz * ky * t + kx * s, c + kz * kz * t
  ];
}
