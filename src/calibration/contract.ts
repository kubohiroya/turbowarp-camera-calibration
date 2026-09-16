/**
 * The names a caller uses to talk about a calibration, without the machinery
 * that runs one.
 *
 * Kept in a leaf of its own so the published `./runtime` sub-entry can describe
 * the procedure without reaching the controller, which reaches Camera Source
 * and, on its first sample, eleven megabytes of OpenCV. A consumer importing
 * these declarations pays for none of that.
 */
import type {CalibrationBoard} from './types.js';

export type CalibrationState =
  | 'idle'
  | 'acquiring-camera'
  | 'sampling'
  | 'ready'
  | 'solving'
  | 'solved'
  | 'cancelling'
  | 'error';

export type CalibrationErrorCode =
  | ''
  | 'dependency-missing'
  | 'api-version-mismatch'
  | 'invalid-board'
  | 'camera-unavailable'
  | 'camera-ended'
  | 'resolution-mismatch'
  | 'capture-condition-mismatch'
  | 'board-not-found'
  | 'sample-low-quality'
  | 'sample-too-similar'
  | 'sample-limit'
  | 'sample-insufficient'
  | 'sample-poses-degenerate'
  | 'sample-failed'
  | 'solve-failed'
  | 'reprojection-too-high'
  | 'invalid-calibration'
  | 'credential-forbidden'
  | 'calibration-not-applicable'
  | 'not-calibrated'
  | 'board-pose-unavailable'
  | 'publish-failed';

/**
 * Where the scale of a measured pose came from.
 *
 * Intrinsic calibration needs no real-world dimensions, and the operator is
 * told so. A pose is metric, and its scale comes entirely from the declared
 * square size -- so a pose measured against a square nobody put a ruler to is
 * correct in direction and wrong in scale, by however much the print or the
 * display was off. That does not show up in the reprojection error. It has to
 * be carried with the number instead.
 */
export type BoardScaleSource = 'measured' | 'nominal';

export interface BoardPoseOptions {
  cameraId: string;
  board: CalibrationBoard;
  scaleSource: BoardScaleSource;
}

export interface CalibrationStartOptions {
  cameraId: string;
  calibrationId: string;
  board: CalibrationBoard;
  /** The session is refused rather than solved when the RMS exceeds this. */
  maximumReprojectionErrorPx: number;
}
