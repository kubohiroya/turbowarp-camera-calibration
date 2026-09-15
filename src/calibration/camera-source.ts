import type {CameraIntrinsicsV1} from './profile.js';

/** The runtime key Camera Source publishes itself under. */
export const CAMERA_SOURCE_RUNTIME_KEY = 'ext_kubohiroyacamerasource';

/** The lease owner recorded with Camera Source, for diagnostics on its side. */
export const CALIBRATION_LEASE_OWNER = 'turbowarp-camera-calibration';

/**
 * The profile contract version this extension speaks. Camera Source owns the
 * contract (kubohiroya/turbowarp-camera-source#14); until it ships a matching
 * `calibrationApiVersion`, publishing reports `api-version-mismatch` rather
 * than pretending a profile was registered.
 */
export const SUPPORTED_CALIBRATION_API_VERSION = 1;

export interface CameraFrameSourcePort {
  readonly kind: 'video';
  readonly element: HTMLVideoElement;
  readonly width: number;
  readonly height: number;
  readonly mirrored: boolean;
  readonly deviceId: string;
}

export interface CameraLeasePort {
  getFrameSource(): CameraFrameSourcePort;
  release(): Promise<void>;
}

export interface CameraSourcePort {
  acquireCamera(options: {owner: string; cameraId: string}): Promise<CameraLeasePort>;
}

/**
 * The producer side of the profile contract. Camera Source accepts profiles
 * from any calibrator, so this is the only name this extension needs from it
 * beyond the lease.
 */
export interface CalibrationProfileRegistryPort {
  readonly calibrationApiVersion: number;
  registerCalibrationProfile(profile: CameraIntrinsicsV1): Promise<void> | void;
}

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

/** Returns the Camera Source capability, or reports that it is not loaded. */
export function requireCameraSource(runtime: TurboWarpRuntime): CameraSourcePort {
  const candidate = runtime[CAMERA_SOURCE_RUNTIME_KEY];
  if (!hasFunction(candidate, 'acquireCamera')) {
    throw new CameraSourceError(
      'dependency-missing',
      'TurboWarp Camera Source is not loaded. Load it before calibrating; this extension never opens its own camera.'
    );
  }
  return candidate as unknown as CameraSourcePort;
}

/**
 * Returns the profile registry when Camera Source publishes a version this
 * extension speaks. A missing registry is an explicit mismatch, never a
 * silently skipped publication.
 */
export function requireProfileRegistry(
  runtime: TurboWarpRuntime
): CalibrationProfileRegistryPort {
  const candidate = runtime[CAMERA_SOURCE_RUNTIME_KEY];
  if (!hasFunction(candidate, 'acquireCamera')) {
    throw new CameraSourceError(
      'dependency-missing',
      'TurboWarp Camera Source is not loaded, so no calibration profile registry exists.'
    );
  }
  const registry = candidate as Record<string, unknown>;
  if (!hasFunction(registry, 'registerCalibrationProfile')) {
    throw new CameraSourceError(
      'api-version-mismatch',
      `The loaded Camera Source has no calibration profile registry. Version ${SUPPORTED_CALIBRATION_API_VERSION} of the profile contract is required.`
    );
  }
  const version = registry.calibrationApiVersion;
  if (version !== SUPPORTED_CALIBRATION_API_VERSION) {
    throw new CameraSourceError(
      'api-version-mismatch',
      `Camera Source publishes calibration profile contract ${String(version)}; this extension speaks ${SUPPORTED_CALIBRATION_API_VERSION}.`
    );
  }
  return registry as unknown as CalibrationProfileRegistryPort;
}

function hasFunction(value: unknown, name: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)[name] === 'function'
  );
}
