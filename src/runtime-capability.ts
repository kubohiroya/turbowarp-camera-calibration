/**
 * What other extensions may drive without going through blocks.
 *
 * Blocks are a palette for a project, not an API between extensions: an opcode
 * is reached by name through the VM, takes Scratch-cast arguments, and cannot
 * be type-checked by a caller. An extension that wants to run a calibration --
 * because it used to own one and now delegates it -- needs a named surface
 * instead, so this is published under a versioned key.
 *
 * Versioned rather than handed over as the extension object, so a consumer
 * states the contract it was written against and is refused clearly instead of
 * finding a method missing partway through a calibration the operator is
 * already standing in front of.
 */
import type {
  BoardPoseOptions,
  CalibrationErrorCode,
  CalibrationGuidance,
  CalibrationStartOptions,
  CalibrationState
} from './calibration/contract.js';

export const runtimeCapabilityKey = 'kubohiroyaCameraCalibrationCapability';
export const runtimeCapabilityVersion = 3 as const;

export interface CameraCalibrationCapabilityV1 {
  readonly version: typeof runtimeCapabilityVersion;
  requireVersion(version: number): CameraCalibrationCapabilityV1;

  /**
   * Begins a session, replacing whatever the camera was doing.
   *
   * Rejects with the refusal recorded in `errorCode`. A board that does not
   * describe a usable target is refused before the running session is
   * disturbed, so a mistyped square size costs nothing already collected.
   */
  start(options: CalibrationStartOptions): Promise<void>;
  /** Captures one board view. Rejects when the view is unusable, keeping the session. */
  addSample(cameraId: string): Promise<void>;
  /**
   * Hands the shutter to this extension, or takes it back. Since version 2.
   *
   * With it on, views are collected as the board reaches positions worth
   * collecting, the solver is re-run in the background as the set grows, and
   * the session ends by itself once the answer validates against views it was
   * not fitted to. `guidance` is what to tell the operator meanwhile.
   *
   * Turn it on after `start`: there is nothing to watch before a session has a
   * camera, and the request is not remembered.
   */
  setAutomatic(cameraId: string, enabled: boolean): void;
  /** Whether the shutter is watching on its own. Since version 2. */
  automatic(cameraId: string): boolean;
  /**
   * What the operator should do next. Since version 2.
   *
   * Not an error: a frame the shutter declines is the ordinary case, and
   * recording those as errors would leave one showing for most of a session.
   */
  guidance(cameraId: string): CalibrationGuidance;
  /**
   * How much the view the shutter is looking at would add, 0 to 1. Since v3.
   *
   * Measured in tilt rather than in where the corners landed: sliding the
   * board moves every corner and adds nothing a solve can use, so a signal
   * driven by corner distance would be loudest for the one motion that does
   * not work. One is a view turned as far from everything held as the whole
   * set is required to spread. Zero when nothing usable is in frame.
   *
   * Meant for something continuous -- a tone, a bar, a click rate -- because
   * the operator is holding the board and not reading the screen.
   */
  novelty(cameraId: string): number;
  /** Solves from the accepted samples and releases the camera. */
  solve(cameraId: string): Promise<void>;
  /** Hands the solved profile to Camera Source, which owns the profile contract. */
  publish(cameraId: string): Promise<void>;
  /** Ends the session and releases the camera lease. Keeps the solved profile. */
  cancel(cameraId: string): Promise<void>;
  /** Ends the session and forgets the solved profile as well. */
  cleanup(cameraId: string): Promise<void>;
  /** Adopts a profile from JSON, in either this contract or the legacy one. */
  importProfile(cameraId: string, json: string): Promise<void>;
  /** Answers whether the JSON would be adopted, without adopting it. */
  validateProfile(cameraId: string, json: string): boolean;

  state(cameraId: string): CalibrationState;
  /** Whether a session is live and can take another sample or a solve. */
  ready(cameraId: string): boolean;
  /** Names the solver, without creating it. Reading this never loads OpenCV. */
  backend(): string;
  sampleCount(cameraId: string): number;
  /** Quality of the most recent accepted sample. Zero when none was accepted. */
  sampleQuality(cameraId: string): number;
  /**
   * Reprojection RMS of the most recent solve, in pixels.
   *
   * Zero means no solve has produced one -- not a perfect solve. `state` and
   * `errorCode` are what tell the two apart, and a consumer that reads this
   * alone will report an uncalibrated camera as a flawless one.
   */
  reprojectionErrorPx(cameraId: string): number;
  /**
   * How varied the angles of the collected samples are.
   *
   * Zero means every sample was taken from the same direction, and a set like
   * that cannot be solved from: focal length and distance stay inseparable,
   * because a small board seen close and a large one seen far away make the
   * same image. `solve` refuses below the required spread rather than
   * returning a calibration whose reprojection error looks fine.
   */
  poseSpread(cameraId: string): number;
  /**
   * RMS reprojection over the views the solve was not fitted to.
   *
   * `reprojectionErrorPx` measures how well the answer reproduces the samples
   * that produced it, which is a statement about fit. This one is the same
   * measure over views held back, so the two disagreeing is the signal: the set
   * was too small, or too alike, to support the answer. Meaningless when
   * `holdoutSampleCount` is zero.
   */
  holdoutErrorPx(cameraId: string): number;
  /** How many views were held back. Zero means nothing was validated. */
  holdoutSampleCount(cameraId: string): number;
  errorCode(cameraId: string): CalibrationErrorCode;
  /** The refusal in full, including the detail behind the code. */
  errorMessage(cameraId: string): string;
  /** The solved or imported profile, or an empty string when there is none. */
  profileJson(cameraId: string): string;

  /**
   * Measures where the board is, in the camera's own frame.
   *
   * Takes its own camera lease and gives it straight back, because this is not
   * part of a calibration session -- a calibration needs the board to move, and
   * while one is being collected there is no single position to report. Call it
   * once the board is where it will stay.
   *
   * Not a world pose. Where a camera stands in a frame several cameras share is
   * a different question, answered by whoever solves placement.
   */
  measureBoardPose(options: BoardPoseOptions): Promise<void>;
  /** The last measured pose as JSON, or an empty string when none was taken. */
  boardPoseJson(cameraId: string): string;
}

export function createRuntimeCapability(
  host: Omit<CameraCalibrationCapabilityV1, 'version' | 'requireVersion'>
): CameraCalibrationCapabilityV1 {
  const capability: CameraCalibrationCapabilityV1 = {
    version: runtimeCapabilityVersion,
    requireVersion(version) {
      // Older is fine; newer is not. Every change to this surface so far has
      // added members, so a consumer written against version 1 finds
      // everything it was written against in a version 2 object. A consumer
      // asking for a version this build has never heard of is asking for
      // something that may not be here, and is told so now rather than partway
      // through a calibration the operator is already standing in front of.
      if (!Number.isInteger(version) || version < 1 || version > runtimeCapabilityVersion) {
        throw new Error(
          `Unsupported Camera Calibration runtime capability version: ${version}; this build provides ${runtimeCapabilityVersion}.`
        );
      }
      return capability;
    },
    start: (options) => host.start(options),
    addSample: (cameraId) => host.addSample(cameraId),
    setAutomatic: (cameraId, enabled) => host.setAutomatic(cameraId, enabled),
    automatic: (cameraId) => host.automatic(cameraId),
    guidance: (cameraId) => host.guidance(cameraId),
    novelty: (cameraId) => host.novelty(cameraId),
    solve: (cameraId) => host.solve(cameraId),
    publish: (cameraId) => host.publish(cameraId),
    cancel: (cameraId) => host.cancel(cameraId),
    cleanup: (cameraId) => host.cleanup(cameraId),
    importProfile: (cameraId, json) => host.importProfile(cameraId, json),
    validateProfile: (cameraId, json) => host.validateProfile(cameraId, json),
    state: (cameraId) => host.state(cameraId),
    ready: (cameraId) => host.ready(cameraId),
    backend: () => host.backend(),
    sampleCount: (cameraId) => host.sampleCount(cameraId),
    sampleQuality: (cameraId) => host.sampleQuality(cameraId),
    reprojectionErrorPx: (cameraId) => host.reprojectionErrorPx(cameraId),
    poseSpread: (cameraId) => host.poseSpread(cameraId),
    holdoutErrorPx: (cameraId) => host.holdoutErrorPx(cameraId),
    holdoutSampleCount: (cameraId) => host.holdoutSampleCount(cameraId),
    errorCode: (cameraId) => host.errorCode(cameraId),
    errorMessage: (cameraId) => host.errorMessage(cameraId),
    profileJson: (cameraId) => host.profileJson(cameraId),
    measureBoardPose: (options) => host.measureBoardPose(options),
    boardPoseJson: (cameraId) => host.boardPoseJson(cameraId)
  };
  return Object.freeze(capability);
}
