/**
 * What another extension needs to run a calibration through this one, without
 * importing it.
 *
 * The extension itself is loaded into TurboWarp from a URL and reaches OpenCV
 * on its first sample; nobody wants that in their bundle to ask a camera
 * whether it is calibrated. What a consumer needs is a key, a version, and the
 * declarations describing the procedure -- which is all this entry holds.
 *
 * It is published as a sub-entry so a consumer imports these instead of writing
 * its own copy. A copy is checked against nothing: this package could change
 * the shape, the consumer would still typecheck, and the mismatch would surface
 * in a browser. That is not hypothetical here -- this repository's own copy of
 * Camera Source's registry named a method Camera Source does not have, and
 * every attempt to publish a profile failed with a version mismatch that had
 * nothing to do with versions.
 */

export type {
  CalibrationErrorCode,
  CalibrationGuidance,
  CalibrationStartOptions,
  CalibrationState
} from './calibration/contract.js';

export type {CalibrationBoard} from './calibration/types.js';

export {
  createRuntimeCapability,
  runtimeCapabilityKey,
  runtimeCapabilityVersion,
  type CameraCalibrationCapabilityV1
} from './runtime-capability.js';

import {
  runtimeCapabilityKey,
  type CameraCalibrationCapabilityV1
} from './runtime-capability.js';

/** The extension ID, as it appears in opcodes and in a project's extension list. */
export const cameraCalibrationExtensionId = 'kubohiroyacameracalibration';

/**
 * Narrows a runtime value to this extension's capability.
 *
 * Returns undefined when the extension is absent or its feature is off. Those
 * two are deliberately not distinguished here: the capability is withheld while
 * the flag is off, because a calibration that cannot acquire a camera is not a
 * calibration a caller should be able to start. A version this build does not
 * implement is a different matter -- `requireVersion` refuses that out loud,
 * because the extension is present and cannot do what was asked.
 */
export function readCameraCalibrationCapability(
  runtime: unknown
): CameraCalibrationCapabilityV1 | undefined {
  if (typeof runtime !== 'object' || runtime === null) return undefined;
  const candidate = (runtime as Record<string, unknown>)[runtimeCapabilityKey];
  if (typeof candidate !== 'object' || candidate === null) return undefined;
  const {requireVersion} = candidate as {requireVersion?: unknown};
  return typeof requireVersion === 'function'
    ? (candidate as CameraCalibrationCapabilityV1)
    : undefined;
}
