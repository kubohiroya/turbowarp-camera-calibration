import {
  readCameraProfileDocument,
  readProfileText,
  type CameraIntrinsicProfileV1 as CameraSourceProfile
} from '@kubohiroya/turbowarp-camera-source/profile';
import {DISTORTION_COEFFICIENT_COUNTS, type DistortionModel} from './types.js';

/**
 * The intrinsic calibration profile.
 *
 * Camera Source owns this contract; see
 * https://github.com/kubohiroya/turbowarp-camera-source/issues/14. Until that
 * contract ships, this module is the producer-side definition and the schema is
 * published from this repository. The identifiers below are the migration
 * surface: when Camera Source publishes the contract, only `schema` and the
 * JSON Schema `$id` move.
 *
 * Intrinsics and external pose stay separate. A profile describes one camera's
 * optics at one image size. It never carries a world pose, and importing a
 * legacy profile that mixes the two drops the pose rather than reinterpreting
 * it.
 */
export const CAMERA_INTRINSICS_SCHEMA_ID = 'camerasource/camera-intrinsics';
export const CAMERA_INTRINSICS_VERSION = 1;

/** The pre-migration profile, which mixed intrinsics with a world pose. */
export const LEGACY_CALIBRATION_SCHEMA_ID = 'twrmc/camera-calibration';

/** The contract Camera Source owns and renders; read through Camera Source's reader. */
export const CAMERA_SOURCE_PROFILE_SCHEMA_ID = 'twcs/camera-intrinsics';

export type CameraModel = 'pinhole';

/**
 * Whether the pixels the profile describes are the raw sensor image or an
 * already-undistorted image. The base contract is an uncorrected image plus
 * calibration values; `undistorted` states that a consumer must not apply the
 * coefficients again.
 */
export type ImageState = 'raw' | 'undistorted';

export interface CalibrationQuality {
  sampleCount: number;
  reprojectionErrorPx: number;
}

export interface CameraIntrinsicsV1 {
  schema: typeof CAMERA_INTRINSICS_SCHEMA_ID;
  version: typeof CAMERA_INTRINSICS_VERSION;
  calibrationId: string;
  cameraId: string;
  cameraModel: CameraModel;
  imageWidth: number;
  imageHeight: number;
  imageState: ImageState;
  intrinsicMatrix: number[];
  distortionModel: DistortionModel;
  distortionCoefficients: number[];
  /** Absent when the source of the profile did not measure it. */
  quality?: CalibrationQuality;
  /**
   * How the camera was configured when the views were taken.
   *
   * Absent in a profile written before this was recorded. A profile without it
   * can never be judged compatible with any camera -- including the one it was
   * solved on, a moment ago -- because nothing says whether the optics are set
   * as they were. That is the reason it is recorded: the verdict an operator
   * saw on their own fresh calibration was "cannot be determined".
   */
  capture?: CalibrationCapture;
  /** What the camera called itself. A hint for matching, never proof. */
  device?: CalibrationDevice;
  calibratedAt: string;
}

/**
 * The capture settings that change how a lens projects, as the camera reported
 * them. A member the camera did not report is left out rather than guessed:
 * absent on both sides compares as the same, absent on one side as unknown.
 */
export interface CalibrationCapture {
  resizeMode?: string;
  zoom?: number;
  focusMode?: string;
  focusDistance?: number;
  frameRate?: number;
  facingMode?: string;
}

export interface CalibrationDevice {
  label?: string;
  deviceId?: string;
}

export type CalibrationProfileErrorCode = 'invalid-calibration' | 'credential-forbidden';

export class CalibrationProfileError extends Error {
  public constructor(
    public readonly code: CalibrationProfileErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CalibrationProfileError';
  }
}

/** Property names of the v1 profile, in the order the JSON Schema lists them. */
export const CAMERA_INTRINSICS_PROPERTIES = [
  'schema',
  'version',
  'calibrationId',
  'cameraId',
  'cameraModel',
  'imageWidth',
  'imageHeight',
  'imageState',
  'intrinsicMatrix',
  'distortionModel',
  'distortionCoefficients',
  'quality',
  'capture',
  'device',
  'calibratedAt'
] as const;

/** Every property except the ones a producer may not have measured. */
export const CAMERA_INTRINSICS_REQUIRED = CAMERA_INTRINSICS_PROPERTIES.filter(
  (name) => name !== 'quality' && name !== 'capture' && name !== 'device'
);

export const CAMERA_MODELS: readonly CameraModel[] = ['pinhole'];
export const IMAGE_STATES: readonly ImageState[] = ['raw', 'undistorted'];
export const DISTORTION_MODELS = Object.keys(
  DISTORTION_COEFFICIENT_COUNTS
) as readonly DistortionModel[];

const IDENTIFIER = /^[A-Za-z0-9._-]{1,64}$/u;
const UTC_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;
const MAXIMUM_IMAGE_SIZE = 16_384;
const MAXIMUM_MAGNITUDE = 1_000_000;
const CREDENTIAL_KEY =
  /^(?:offer|answer|sdp|icecandidate|icecandidates|icepwd|iceufrag|dtlsfingerprint|credential|credentials)$/u;

/**
 * Parses a calibration profile. Accepts the v1 intrinsic contract and the
 * pre-migration profile, and never returns a partially validated object: the
 * caller may replace state only once this resolves.
 */
export function parseCalibrationProfile(json: string): CameraIntrinsicsV1 {
  const trimmed = json.trim();
  // A calibration file is Camera Source's to read: a ROS camera_info YAML
  // document, or the twcs/camera-intrinsics JSON Camera Source renders. Only
  // JSON in this extension's own shape, or the legacy one, is read here.
  if (!trimmed.startsWith('{')) return readCameraSourceProfileText(trimmed);
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch (error) {
    throw new CalibrationProfileError('invalid-calibration', String(error));
  }
  if (isRecord(value) && value.schema === CAMERA_SOURCE_PROFILE_SCHEMA_ID) {
    return readCameraSourceProfileText(trimmed);
  }
  const credentialPath = findPairingCredential(value);
  if (credentialPath) {
    throw new CalibrationProfileError(
      'credential-forbidden',
      `Pairing credential is forbidden at ${credentialPath}.`
    );
  }
  const record = requireRecord(value, '/');
  if (record.schema === LEGACY_CALIBRATION_SCHEMA_ID) {
    return parseLegacyProfile(record);
  }
  return parseIntrinsicsProfile(record);
}

/**
 * Reads a calibration in the form it leaves a PC in, through Camera Source's
 * own reader, and holds it in this extension's shape.
 *
 * The rules come from `@kubohiroya/turbowarp-camera-source/profile` rather
 * than a copy: a file Camera Source accepts is accepted here for the same
 * reasons, and refused for the same reasons. The result is then checked again
 * as this extension's profile, so a calibration Camera Source can describe and
 * this extension cannot -- a fisheye lens -- is refused rather than relabelled.
 */
function readCameraSourceProfileText(text: string): CameraIntrinsicsV1 {
  const read = readProfileText(text);
  const result = read.ok ? readCameraProfileDocument(read.document) : read;
  if (!result.ok) {
    const {code, path, message} = result.error;
    throw new CalibrationProfileError(
      code === 'forbidden-field' ? 'credential-forbidden' : 'invalid-calibration',
      path ? `${path}: ${message}` : message
    );
  }
  return assertCameraIntrinsics(fromCameraSourceProfile(result.profile));
}

/** The inverse of the conversion made on publishing to Camera Source. */
function fromCameraSourceProfile(profile: CameraSourceProfile): CameraIntrinsicsV1 {
  const {fx, fy, cx, cy, skew} = profile.intrinsics;
  const {model, coefficients} = profile.distortion;
  let distortionModel: DistortionModel;
  if (model === 'none') distortionModel = 'none';
  else if (model === 'brown-conrady') {
    distortionModel = coefficients.length === 8 ? 'opencv-rational' : 'opencv-plumb-bob';
  } else {
    throw new CalibrationProfileError(
      'invalid-calibration',
      `This extension has no distortion model matching ${model}, so the profile cannot be imported.`
    );
  }
  return {
    schema: CAMERA_INTRINSICS_SCHEMA_ID,
    version: CAMERA_INTRINSICS_VERSION,
    calibrationId: profile.profileId,
    cameraId: profile.cameraId,
    cameraModel: profile.cameraModel,
    imageWidth: profile.image.width,
    imageHeight: profile.image.height,
    imageState: profile.image.undistorted ? 'undistorted' : 'raw',
    intrinsicMatrix: [fx, skew, cx, 0, fy, cy, 0, 0, 1],
    distortionModel,
    distortionCoefficients: [...coefficients],
    ...(profile.quality ? {quality: {...profile.quality}} : {}),
    ...(profile.capture ? {capture: {...profile.capture}} : {}),
    ...(profile.device ? {device: {...profile.device}} : {}),
    calibratedAt: profile.calibratedAt
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates a value this extension just produced, before it becomes state. */
export function assertCameraIntrinsics(value: unknown): CameraIntrinsicsV1 {
  return parseIntrinsicsProfile(requireRecord(value, '/'));
}

/** Reports the distortion model OpenCV implied by returning `count` values. */
export function distortionModelForCoefficientCount(count: number): DistortionModel {
  for (const [model, counts] of Object.entries(DISTORTION_COEFFICIENT_COUNTS)) {
    if (counts.includes(count)) return model as DistortionModel;
  }
  throw new Error(`No distortion model uses ${count} coefficients.`);
}

function parseIntrinsicsProfile(record: Record<string, unknown>): CameraIntrinsicsV1 {
  for (const key of Object.keys(record)) {
    if (!(CAMERA_INTRINSICS_PROPERTIES as readonly string[]).includes(key)) {
      throw invalid(`/${key}`, 'is not part of the v1 intrinsic profile');
    }
  }
  literal(record.schema, CAMERA_INTRINSICS_SCHEMA_ID, '/schema');
  literal(record.version, CAMERA_INTRINSICS_VERSION, '/version');
  const calibrationId = identifier(record.calibrationId, '/calibrationId');
  const cameraId = identifier(record.cameraId, '/cameraId');
  const cameraModel = member(record.cameraModel, CAMERA_MODELS, '/cameraModel');
  const imageWidth = imageSize(record.imageWidth, '/imageWidth');
  const imageHeight = imageSize(record.imageHeight, '/imageHeight');
  const imageState = member(record.imageState, IMAGE_STATES, '/imageState');
  const intrinsicMatrix = parseIntrinsicMatrix(record.intrinsicMatrix, imageWidth, imageHeight);
  const distortionModel = member(record.distortionModel, DISTORTION_MODELS, '/distortionModel');
  const distortionCoefficients = parseDistortionCoefficients(
    record.distortionCoefficients,
    distortionModel
  );
  const calibratedAt = utcDateTime(record.calibratedAt, '/calibratedAt');
  const quality = record.quality === undefined ? undefined : parseQuality(record.quality);
  const capture = record.capture === undefined ? undefined : parseCapture(record.capture);
  const device = record.device === undefined ? undefined : parseDevice(record.device);
  const profile: CameraIntrinsicsV1 = {
    schema: CAMERA_INTRINSICS_SCHEMA_ID,
    version: CAMERA_INTRINSICS_VERSION,
    calibrationId,
    cameraId,
    cameraModel,
    imageWidth,
    imageHeight,
    imageState,
    intrinsicMatrix,
    distortionModel,
    distortionCoefficients,
    calibratedAt
  };
  return {
    ...profile,
    ...(quality === undefined ? {} : {quality}),
    ...(capture === undefined ? {} : {capture}),
    ...(device === undefined ? {} : {device})
  };
}

function parseCapture(value: unknown): CalibrationCapture {
  const record = requireRecord(value, '/capture');
  const text = ['resizeMode', 'focusMode', 'facingMode'] as const;
  const numbers = ['zoom', 'focusDistance', 'frameRate'] as const;
  const capture: CalibrationCapture = {};
  for (const key of Object.keys(record)) {
    if (!(text as readonly string[]).includes(key) && !(numbers as readonly string[]).includes(key)) {
      throw invalid(`/capture/${key}`, 'is not part of the v1 capture record');
    }
  }
  for (const key of text) {
    const entry = record[key];
    if (entry === undefined) continue;
    if (typeof entry !== 'string' || entry.length > 64) {
      throw invalid(`/capture/${key}`, 'must be a string of at most 64 characters');
    }
    capture[key] = entry;
  }
  for (const key of numbers) {
    const entry = record[key];
    if (entry === undefined) continue;
    capture[key] = boundedNumber(entry, `/capture/${key}`);
  }
  return capture;
}

function parseDevice(value: unknown): CalibrationDevice {
  const record = requireRecord(value, '/device');
  const device: CalibrationDevice = {};
  for (const key of Object.keys(record)) {
    if (key !== 'label' && key !== 'deviceId') {
      throw invalid(`/device/${key}`, 'is not part of the v1 device record');
    }
    const entry = record[key];
    if (typeof entry !== 'string' || entry.length > 256) {
      throw invalid(`/device/${key}`, 'must be a string of at most 256 characters');
    }
    device[key] = entry;
  }
  return device;
}

/**
 * Reads the pre-migration profile. `worldFromCameraMatrix` is validated as part
 * of that profile but is not carried over: this extension publishes intrinsics
 * only, and a missing pose is never filled in with identity.
 */
function parseLegacyProfile(record: Record<string, unknown>): CameraIntrinsicsV1 {
  literal(record.version, 1, '/version');
  const calibrationId = identifier(record.calibrationId, '/calibrationId');
  const cameraId = identifier(record.cameraId, '/cameraId');
  const imageWidth = imageSize(record.imageWidth, '/imageWidth');
  const imageHeight = imageSize(record.imageHeight, '/imageHeight');
  const intrinsicMatrix = parseIntrinsicMatrix(record.intrinsicMatrix, imageWidth, imageHeight);
  const coefficients = numberArray(record.distortionCoefficients, '/distortionCoefficients');
  let distortionModel: DistortionModel;
  try {
    distortionModel = distortionModelForCoefficientCount(coefficients.length);
  } catch {
    throw invalid('/distortionCoefficients', 'has no matching OpenCV distortion model');
  }
  literal(record.worldUnit, 'meter', '/worldUnit');
  const calibratedAt = utcDateTime(record.calibratedAt, '/calibratedAt');
  // The legacy profile stated no capture state and no solve quality. Both stay
  // unstated rather than guessed: `raw` is the contract's base case.
  return {
    schema: CAMERA_INTRINSICS_SCHEMA_ID,
    version: CAMERA_INTRINSICS_VERSION,
    calibrationId,
    cameraId,
    cameraModel: 'pinhole',
    imageWidth,
    imageHeight,
    imageState: 'raw',
    intrinsicMatrix,
    distortionModel,
    distortionCoefficients: coefficients,
    calibratedAt
  };
}

function parseIntrinsicMatrix(value: unknown, width: number, height: number): number[] {
  const matrix = numberArray(value, '/intrinsicMatrix');
  if (matrix.length !== 9) {
    throw invalid('/intrinsicMatrix', 'must hold nine row-major values');
  }
  const [fx, skew, cx, zeroX, fy, cy, zeroZ, zeroY, one] = matrix as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
  ];
  if (skew !== 0 || zeroX !== 0 || zeroZ !== 0 || zeroY !== 0 || one !== 1) {
    throw invalid('/intrinsicMatrix', 'must be a zero-skew pinhole matrix');
  }
  if (fx <= 0 || fy <= 0) {
    throw invalid('/intrinsicMatrix', 'must hold positive focal lengths');
  }
  if (cx < 0 || cx > width || cy < 0 || cy > height) {
    throw invalid('/intrinsicMatrix', 'principal point must fall inside the calibrated image');
  }
  return matrix;
}

function parseDistortionCoefficients(value: unknown, model: DistortionModel): number[] {
  const coefficients = numberArray(value, '/distortionCoefficients');
  const allowed = DISTORTION_COEFFICIENT_COUNTS[model];
  if (!allowed.includes(coefficients.length)) {
    throw invalid(
      '/distortionCoefficients',
      `must hold ${allowed.join(' or ')} values for ${model}`
    );
  }
  return coefficients;
}

function parseQuality(value: unknown): CalibrationQuality {
  const record = requireRecord(value, '/quality');
  for (const key of Object.keys(record)) {
    if (key !== 'sampleCount' && key !== 'reprojectionErrorPx') {
      throw invalid(`/quality/${key}`, 'is not part of the v1 quality record');
    }
  }
  const sampleCount = record.sampleCount;
  if (!Number.isInteger(sampleCount) || (sampleCount as number) < 0) {
    throw invalid('/quality/sampleCount', 'must be a non-negative integer');
  }
  const reprojectionErrorPx = boundedNumber(
    record.reprojectionErrorPx,
    '/quality/reprojectionErrorPx'
  );
  if (reprojectionErrorPx < 0) {
    throw invalid('/quality/reprojectionErrorPx', 'must not be negative');
  }
  return {sampleCount: sampleCount as number, reprojectionErrorPx};
}

function findPairingCredential(value: unknown, path = ''): string | undefined {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findPairingCredential(item, `${path}/${index}`);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    if (CREDENTIAL_KEY.test(key.toLowerCase().replaceAll(/[^a-z]/gu, ''))) return itemPath;
    const found = findPairingCredential(item, itemPath);
    if (found) return found;
  }
  return undefined;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function literal(value: unknown, expected: string | number, path: string): void {
  if (value !== expected) throw invalid(path, `must be ${JSON.stringify(expected)}`);
}

function member<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw invalid(path, `must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function identifier(value: unknown, path: string): string {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) {
    throw invalid(path, 'must be 1 to 64 characters of A-Z a-z 0-9 . _ -');
  }
  return value;
}

function imageSize(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAXIMUM_IMAGE_SIZE) {
    throw invalid(path, `must be an integer from 1 to ${MAXIMUM_IMAGE_SIZE}`);
  }
  return value as number;
}

function boundedNumber(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Math.abs(value) > MAXIMUM_MAGNITUDE
  ) {
    throw invalid(path, `must be a finite number within ${MAXIMUM_MAGNITUDE}`);
  }
  return value;
}

function numberArray(value: unknown, path: string): number[] {
  if (!Array.isArray(value)) throw invalid(path, 'must be an array of numbers');
  return value.map((item, index) => boundedNumber(item, `${path}/${index}`));
}

function invalid(path: string, reason: string): CalibrationProfileError {
  return new CalibrationProfileError('invalid-calibration', `${path}: ${reason}.`);
}

function utcDateTime(value: unknown, path: string): string {
  if (typeof value !== 'string' || !UTC_DATE_TIME.test(value)) {
    throw invalid(path, 'must be a UTC ISO 8601 timestamp');
  }
  return value;
}
