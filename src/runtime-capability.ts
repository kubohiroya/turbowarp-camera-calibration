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
  CalibrationErrorCode,
  CalibrationStartOptions,
  CalibrationState
} from './calibration/contract.js';

export const runtimeCapabilityKey = 'kubohiroyaCameraCalibrationCapability';
export const runtimeCapabilityVersion = 1 as const;

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
  errorCode(cameraId: string): CalibrationErrorCode;
  /** The refusal in full, including the detail behind the code. */
  errorMessage(cameraId: string): string;
  /** The solved or imported profile, or an empty string when there is none. */
  profileJson(cameraId: string): string;
}

export function createRuntimeCapability(
  host: Omit<CameraCalibrationCapabilityV1, 'version' | 'requireVersion'>
): CameraCalibrationCapabilityV1 {
  const capability: CameraCalibrationCapabilityV1 = {
    version: runtimeCapabilityVersion,
    requireVersion(version) {
      if (version !== runtimeCapabilityVersion) {
        throw new Error(
          `Unsupported Camera Calibration runtime capability version: ${version}; this build provides ${runtimeCapabilityVersion}.`
        );
      }
      return capability;
    },
    start: (options) => host.start(options),
    addSample: (cameraId) => host.addSample(cameraId),
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
    errorCode: (cameraId) => host.errorCode(cameraId),
    errorMessage: (cameraId) => host.errorMessage(cameraId),
    profileJson: (cameraId) => host.profileJson(cameraId)
  };
  return Object.freeze(capability);
}
