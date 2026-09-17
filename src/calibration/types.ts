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

/** One still image taken from the leased camera, as the element that holds it. */
export interface CalibrationFrame {
  element: HTMLVideoElement;
  width: number;
  height: number;
}

/**
 * The same image as bytes.
 *
 * The solver runs on a worker, where there is no document and no video element
 * to read. The thread that owns the camera reads the frame and sends these,
 * which also makes the hand-off explicit: a worker holding a stale buffer is
 * visible in a way a worker holding a stale element reference would not be.
 */
export interface CalibrationPixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
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
 * What one look at a frame found.
 *
 * `markersSeen` is reported whether or not a sample came out of it, because
 * the two absences are different things to an operator. No markers is an empty
 * frame: show the board. Markers without a usable board is a board the
 * detector was not built for -- another of the three, most likely -- or the
 * right one at an angle nothing can be read from. Telling both of those to
 * "show the board" tells someone holding one that the camera is broken.
 */
export interface CalibrationDetection {
  /**
   * The view, when the board was found well enough to keep.
   *
   * Written `| undefined` rather than left optional so a caller can build the
   * absent case by assigning it, which is what a detector reporting nothing
   * naturally does.
   */
  readonly sample?: CalibrationSample | undefined;
  /** ArUco markers found in the frame, whether or not they formed this board. */
  readonly markersSeen: number;
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
 * Where a board is, seen from a camera whose optics are already known.
 *
 * Not a product of calibration. Calibration requires the board to move --
 * without that, focal length and distance cannot be separated, and the solver
 * refuses the set -- so while a calibration is being collected there is no one
 * position to report. This is measured afterwards, once the board is where it
 * is going to stay.
 *
 * It is the pose of the board in the camera's frame, and nothing more. It is
 * not a world pose: where the camera stands in a frame several cameras share is
 * a different question, answered by whoever solves placement.
 */
export interface BoardPoseSolution {
  /** Rotation from board axes to camera axes, row-major 3x3. */
  rotation: number[];
  /** The board origin in camera coordinates, in metres. */
  translationMeters: number[];
  /** Corners the pose was solved from. */
  cornerCount: number;
  /** How well those corners reproject through the solved pose, in pixels. */
  reprojectionErrorPx: number;
  /** The corners as observed, so the measurement can be re-solved elsewhere. */
  observedPoints: Array<{id: number; u: number; v: number}>;
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
  /**
   * How many held-out views were scored: the ones a pose could be solved for.
   *
   * Not how many were handed in. A view whose pose cannot be solved is left
   * out of the error, so with none scored the error is a zero that measured
   * nothing, and only this count says so.
   */
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
  ): Promise<CalibrationDetection>;
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
  ): Promise<CalibrationValidationResult>;
  /**
   * Finds the board in one frame and solves where it is.
   *
   * Undefined when the board is not in the frame, which is an ordinary answer
   * and not a failure: the operator points the camera somewhere and asks.
   */
  measurePose(
    frame: CalibrationFrame,
    board: CalibrationBoard,
    solution: CalibrationSolveResult
  ): Promise<BoardPoseSolution | undefined>;
  /** Frees whatever the solver holds. The next call may start it again. */
  dispose?(): void;
}

/**
 * Creates the solver on first use. The name is available without creating it so
 * that the backend reporter never loads the OpenCV runtime.
 */
export interface CalibrationBackendFactory {
  readonly name: string;
  create(): Promise<CalibrationBackendPort>;
}
