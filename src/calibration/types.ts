/**
 * A ChArUco target: a chessboard with an ArUco marker in every light square.
 *
 * Measured by its inner corner grid, the same way a plain chessboard is, so
 * `columns` and `rows` mean what they always meant. The board itself has one
 * more square than that in each direction.
 *
 * The markers are what make a partly visible board usable. A plain chessboard
 * has to be found whole, because nothing in it says which corner is which; here
 * each marker names the corners around it, so a view that runs off the edge of
 * the frame still contributes the corners it does show -- which are the ones
 * near the edges, and those are what pin down the principal point and the
 * distortion.
 */
export interface CalibrationBoard {
  columns: number;
  rows: number;
  squareSizeMeters: number;
  /**
   * The side of the marker printed inside a light square.
   *
   * Smaller than the square, so that white remains around it for the detector
   * to separate it from the dark squares it touches.
   */
  markerSizeMeters: number;
}

/** One still image taken from the leased camera. */
export interface CalibrationFrame {
  element: HTMLVideoElement;
  width: number;
  height: number;
}

export interface CalibrationCorner {
  x: number;
  y: number;
}

/**
 * One accepted board view, kept until the session solves or is cancelled.
 *
 * `corners` and `ids` are parallel: a view need not show the whole board, so
 * the identity of each corner is carried rather than implied by its position in
 * the array. An id is the corner's index in the board's own inner-corner grid,
 * counted along the rows.
 */
export interface CalibrationSample {
  corners: CalibrationCorner[];
  /** Which inner corner each entry of `corners` is. Same length as `corners`. */
  ids: number[];
  quality: number;
  coverage: number;
  sharpness: number;
}

/**
 * Distortion models this extension can produce and validate, named after the
 * OpenCV coefficient layouts. The coefficient count identifies the model.
 */
export type DistortionModel =
  | 'none'
  | 'opencv-plumb-bob'
  | 'opencv-rational'
  | 'opencv-thin-prism'
  | 'opencv-tilted';

/** Coefficient counts OpenCV emits for each supported distortion model. */
export const DISTORTION_COEFFICIENT_COUNTS: Readonly<Record<DistortionModel, readonly number[]>> =
  Object.freeze({
    'none': [0],
    'opencv-plumb-bob': [4, 5],
    'opencv-rational': [8],
    'opencv-thin-prism': [12],
    'opencv-tilted': [14]
  });

/**
 * The intrinsic solution. External pose is deliberately absent: this extension
 * calibrates one camera's optics and never reports where that camera stands.
 */
export interface CalibrationSolveResult {
  intrinsicMatrix: number[];
  distortionModel: DistortionModel;
  distortionCoefficients: number[];
  reprojectionErrorPx: number;
}

/**
 * How a solution fares on views it was not fitted to.
 *
 * `reprojectionErrorPx` from a solve measures how well the answer reproduces
 * the very samples that produced it, which is a statement about fit and not
 * about the camera. With few samples for the number of parameters, an
 * overfitted solution scores well on exactly that measure. These are the views
 * held back from the fit, so their error is the one that can disagree.
 */
export interface CalibrationValidationResult {
  /** RMS reprojection error over the held-out views, in pixels. */
  reprojectionErrorPx: number;
  /** How many views were held back. Zero means nothing was validated. */
  sampleCount: number;
}

/**
 * The solver seam. Everything above this interface is arithmetic-free control
 * flow, so tests drive the whole procedure without loading OpenCV.
 */
export interface CalibrationBackendPort {
  readonly name: string;
  captureSample(
    frame: CalibrationFrame,
    board: CalibrationBoard
  ): Promise<CalibrationSample | undefined>;
  solve(
    samples: readonly CalibrationSample[],
    board: CalibrationBoard,
    imageWidth: number,
    imageHeight: number
  ): Promise<CalibrationSolveResult>;
  /**
   * Reprojects views the solve did not use, with the solution it produced.
   *
   * Each view needs its own pose, solved from the given intrinsics -- the pose
   * is not what is being checked, so fitting it here is not circular. What is
   * checked is whether the intrinsics predict corners they never saw.
   */
  validate(
    samples: readonly CalibrationSample[],
    board: CalibrationBoard,
    solution: CalibrationSolveResult
  ): Promise<number>;
}

/**
 * Creates the solver on first use. The name is available without creating it so
 * that the backend reporter never loads the OpenCV runtime.
 */
export interface CalibrationBackendFactory {
  readonly name: string;
  create(): Promise<CalibrationBackendPort>;
}
