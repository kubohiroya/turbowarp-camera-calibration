import {
  cameraSourceCapabilityVersion,
  readCameraSourceCapability,
  readCameraSourceRuntime,
  type CameraFrameSource,
  type CameraIntrinsicProfileV1,
  type CameraLease,
  type CameraSourceCapabilityV1,
  type DistortionModel as CameraSourceDistortionModel
} from '@kubohiroya/turbowarp-camera-source/runtime';
import {DISTORTION_COEFFICIENT_COUNTS, type DistortionModel} from './types.js';
import type {CameraIntrinsicsV1} from './profile.js';

export type {CameraFrameSource, CameraLease};

/** The lease owner recorded with Camera Source, for diagnostics on its side. */
export const CALIBRATION_LEASE_OWNER = 'turbowarp-camera-calibration';

/** Recorded on every published profile, so a reader knows what solved it. */
export const CALIBRATION_PRODUCER = 'turbowarp-camera-calibration';

export type {CameraIntrinsicProfileV1};

/** The version of Camera Source's runtime capability this extension speaks. */
export const SUPPORTED_CAMERA_SOURCE_CAPABILITY_VERSION = cameraSourceCapabilityVersion;

export type CameraSourceErrorCode = 'dependency-missing' | 'api-version-mismatch';

export class CameraSourceError extends Error {
  public constructor(
    public readonly code: CameraSourceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CameraSourceError';
  }
}

/** Returns the Camera Source camera surface, or reports that it is not loaded. */
export function requireCameraSource(runtime: TurboWarpRuntime): {
  acquireCamera(options: {owner: string; cameraId: string}): Promise<CameraLease>;
} {
  const candidate = readCameraSourceRuntime(runtime);
  if (!candidate) {
    throw new CameraSourceError(
      'dependency-missing',
      'TurboWarp Camera Source is not loaded. Load it before calibrating; this extension never opens its own camera.'
    );
  }
  return candidate;
}

/**
 * Returns the profile registry when Camera Source publishes a version this
 * extension speaks.
 *
 * The capability key is separate from the extension key on purpose: Camera
 * Source withholds the capability when its own calibration feature is off, so
 * an extension that is loaded but not offering profiles is distinguishable from
 * one that is absent, and neither is reported as the other.
 */
export function requireProfileRegistry(
  runtime: TurboWarpRuntime
): CameraSourceCapabilityV1 {
  if (!readCameraSourceRuntime(runtime)) {
    throw new CameraSourceError(
      'dependency-missing',
      'TurboWarp Camera Source is not loaded, so no calibration profile registry exists.'
    );
  }
  const capability = readCameraSourceCapability(runtime);
  if (!capability) {
    throw new CameraSourceError(
      'api-version-mismatch',
      `The loaded Camera Source publishes no calibration profile registry. Version ${SUPPORTED_CAMERA_SOURCE_CAPABILITY_VERSION} of its runtime capability is required.`
    );
  }
  try {
    capability.requireVersion(SUPPORTED_CAMERA_SOURCE_CAPABILITY_VERSION);
  } catch (error) {
    throw new CameraSourceError(
      'api-version-mismatch',
      error instanceof Error ? error.message : String(error)
    );
  }
  return capability;
}

/**
 * Restates a solved profile as the document Camera Source validates.
 *
 * The two shapes are not the same and never were: this extension stores a flat
 * profile with a packed nine-number matrix, and Camera Source names the pinhole
 * parameters individually because an array cannot say whether it is row-major.
 * The conversion happens here, at the boundary, so that what a project has
 * saved and what `cameraCalibrationJson` reports keep their existing shape --
 * an SB3 holding either format still imports.
 *
 * Nothing is invented on the way across. The image is stated as raw or already
 * undistorted from `imageState` rather than assumed, and a distortion model
 * with no counterpart is refused instead of being relabelled as the nearest
 * one, which would leave a consumer applying the wrong coefficients to real
 * pixels and getting a plausible wrong answer.
 */
export function toCameraSourceProfile(profile: CameraIntrinsicsV1): CameraIntrinsicProfileV1 {
  const [fx, skew, cx, , fy, cy] = profile.intrinsicMatrix as [
    number,
    number,
    number,
    number,
    number,
    number
  ];
  const document = {
    schema: 'twcs/camera-intrinsics',
    profileId: profile.calibrationId,
    cameraId: profile.cameraId,
    calibratedAt: profile.calibratedAt,
    producer: CALIBRATION_PRODUCER,
    cameraModel: profile.cameraModel,
    image: {
      width: profile.imageWidth,
      height: profile.imageHeight,
      undistorted: profile.imageState === 'undistorted'
    },
    intrinsics: {fx, fy, cx, cy, skew},
    distortion: {
      model: cameraSourceDistortionModel(profile.distortionModel),
      coefficients: [...profile.distortionCoefficients]
    }
  } as const satisfies Omit<CameraIntrinsicProfileV1, 'version' | 'quality'>;
  return profile.quality
    ? {...document, version: 1, quality: {...profile.quality}}
    : {...document, version: 1};
}

/**
 * Names this extension's distortion model the way Camera Source names it.
 *
 * `opencv-plumb-bob` and `opencv-rational` are the radial-tangential family
 * Camera Source calls `brown-conrady`, in the same coefficient order. The thin
 * prism and tilted-sensor layouts have no counterpart in that contract, so a
 * profile using one cannot be published rather than being sent under a name
 * that would make a consumer read its coefficients as something else.
 */
export function cameraSourceDistortionModel(
  model: DistortionModel
): CameraSourceDistortionModel {
  switch (model) {
    case 'none':
      return 'none';
    case 'opencv-plumb-bob':
    case 'opencv-rational':
      return 'brown-conrady';
    default:
      throw new CameraSourceError(
        'api-version-mismatch',
        `Camera Source has no distortion model matching ${model} (${String(DISTORTION_COEFFICIENT_COUNTS[model])} coefficients), so this profile cannot be published.`
      );
  }
}

