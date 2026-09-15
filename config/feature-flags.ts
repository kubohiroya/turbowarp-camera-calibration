/**
 * Startup-fixed feature flags.
 *
 * The calibration path is new and defaults to OFF so that loading this
 * extension keeps the previous behavior: the state reporter answers `idle` and
 * no camera lease, OpenCV runtime, or profile registration is ever requested.
 * Set the override before the extension is registered; the flags are frozen at
 * module evaluation and never re-read.
 */
export interface CameraCalibrationFeatureFlags {
  readonly cameraCalibrationV1: boolean;
}

interface FeatureFlagGlobal {
  readonly __TWCC_FEATURE_FLAGS__?: Partial<CameraCalibrationFeatureFlags>;
}

const overrides = (globalThis as FeatureFlagGlobal).__TWCC_FEATURE_FLAGS__;

export const featureFlags: CameraCalibrationFeatureFlags = Object.freeze({
  cameraCalibrationV1: overrides?.cameraCalibrationV1 === true
});
