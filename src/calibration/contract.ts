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
  | 'wrong-board'
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
 * What the operator should do next, while the shutter watches by itself.
 *
 * Deliberately not a `CalibrationErrorCode`. A frame the shutter declines to
 * take is not a failure -- most frames are declined, because most of the time
 * the board is between two useful positions. Recording those as errors would
 * leave an error showing for nearly the whole session, which is the same as
 * showing none.
 *
 * These are instructions rather than diagnoses: the operator is holding a
 * board in front of a camera and cannot read a reason and work out a remedy.
 */
export type CalibrationGuidance =
  | ''
  /** Nothing recognisable in the frame. */
  | 'show-the-board'
  /**
   * Markers are in frame, and they do not make the board being calibrated.
   *
   * Almost always one of the other boards. It can also be the right board at
   * an angle nothing can be read from, which is why this says what was seen
   * rather than accusing the operator of holding the wrong thing.
   */
  | 'wrong-board'
  /** Found, but blurred or too small to trust the corners of. */
  | 'hold-steadier'
  /** A view too close to one already collected to add anything. */
  | 'move-or-tilt'
  /**
   * Enough views, all from nearly the same angle.
   *
   * Distinct from `move-or-tilt`: sliding the board sideways answers that one
   * and not this one. Focal length and distance stay inseparable until the
   * board is turned, because a small board held close and a large one held far
   * away make the same image.
   */
  | 'tilt-more'
  /** Collecting; nothing is wrong. */
  | 'keep-going'
  /**
   * The answer so far does not hold up on views it was not fitted to.
   *
   * Distinct from `keep-going`, which is only ever "not enough yet". This one
   * says the views collected are too alike to support an answer: the remedy is
   * a wider range of distances and angles, not more of the same.
   */
  | 'vary-more'
  /** A solve is running on the views collected so far. */
  | 'solving'
  /** Solved and validated. Nothing further is needed. */
  | 'complete';

/**
 * How far a session has come, counted in sixteen steps.
 *
 * Four gates of four steps, in the order they have to be passed. A gate is
 * what actually stops the session finishing, so this is not a guess at how
 * long is left: it is how much of what is required has been done.
 *
 * | steps | gate | done when |
 * |---|---|---|
 * | 0-3 | enough views to solve from at all | the minimum sample count |
 * | 4-7 | enough tilt to solve from | the minimum pose spread |
 * | 8-11 | enough views to hold some back | the automatic completion count |
 * | 12-15 | the answer holding up on the views it was not fitted to | the hold-out error under the limit |
 * | 16 | solved | -- |
 *
 * Counted in order and stopped at the first unfinished gate, so the step
 * number says which gate is being worked on as well as how far into it. And
 * never decreasing: the spread of a set can fall when a view is replaced, and
 * an operator hearing the count go backwards would reasonably think they had
 * broken something.
 */
export const CALIBRATION_GATES = 4;
export const CALIBRATION_STEPS_PER_GATE = 4;
export const CALIBRATION_PROGRESS_STEPS = CALIBRATION_GATES * CALIBRATION_STEPS_PER_GATE;

/**
 * Which way the board still has to be turned.
 *
 * Two axes, one sign at a time. `top-near` and `top-far` turn it about the
 * horizontal axis; `left-near` and `right-near` about the vertical one. That
 * is as much as can be said without knowing where the operator is standing,
 * and as much as they need, since they are looking at the same board.
 *
 * Here rather than beside the arithmetic that works it out, because the
 * published entry carries declarations and nothing else: a consumer asking
 * what the names mean must not pull in the measuring.
 */
export type TiltDirection = '' | 'top-near' | 'top-far' | 'left-near' | 'right-near';

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
