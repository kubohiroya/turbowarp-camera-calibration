import {readFile} from 'node:fs/promises';
import {describe, expect, it} from 'vitest';
import schema from '../schemas/camera-intrinsics-v1.schema.json';
import {
  assertCameraIntrinsics,
  CalibrationProfileError,
  CAMERA_INTRINSICS_PROPERTIES,
  CAMERA_INTRINSICS_REQUIRED,
  CAMERA_INTRINSICS_SCHEMA_ID,
  distortionModelForCoefficientCount,
  DISTORTION_MODELS,
  parseCalibrationProfile
} from '../src/calibration/profile.js';

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`fixtures/calibration/${name}`, import.meta.url), 'utf8');
}

function codeOf(json: string): string {
  try {
    parseCalibrationProfile(json);
  } catch (error) {
    return error instanceof CalibrationProfileError ? error.code : 'unexpected-error';
  }
  return 'accepted';
}

describe('camera intrinsic profile', () => {
  it('accepts the exact v1 profile', async () => {
    const profile = parseCalibrationProfile(await fixture('valid-camera-intrinsics-v1.json'));
    expect(profile).toEqual({
      schema: CAMERA_INTRINSICS_SCHEMA_ID,
      version: 1,
      calibrationId: 'calibration-1',
      cameraId: 'camera-1',
      cameraModel: 'pinhole',
      imageWidth: 800,
      imageHeight: 600,
      imageState: 'raw',
      intrinsicMatrix: [700, 0, 400, 0, 700, 300, 0, 0, 1],
      distortionModel: 'opencv-plumb-bob',
      distortionCoefficients: [0.01, -0.02, 0, 0, 0],
      quality: {sampleCount: 8, reprojectionErrorPx: 0.75},
      calibratedAt: '2026-09-13T12:00:00.000Z'
    });
  });

  it('rejects an invalid camera model, coefficient count, and non-finite value', async () => {
    expect(codeOf(await fixture('invalid-camera-intrinsics-camera-model.json'))).toBe(
      'invalid-calibration'
    );
    expect(codeOf(await fixture('invalid-camera-intrinsics-coefficient-count.json'))).toBe(
      'invalid-calibration'
    );
    expect(codeOf(await fixture('invalid-camera-intrinsics-non-finite.json'))).toBe(
      'invalid-calibration'
    );
    expect(codeOf('not json')).toBe('invalid-calibration');
  });

  it('rejects a pairing credential before any other structural check', async () => {
    expect(codeOf(await fixture('invalid-camera-calibration-with-credential.json'))).toBe(
      'credential-forbidden'
    );
    expect(codeOf('{"schema":"nonsense","offer":{"sdp":"v=0"}}')).toBe('credential-forbidden');
  });

  it('rejects a mixed-up pinhole matrix and an out-of-image principal point', () => {
    const base = {
      schema: CAMERA_INTRINSICS_SCHEMA_ID,
      version: 1,
      calibrationId: 'calibration-1',
      cameraId: 'camera-1',
      cameraModel: 'pinhole',
      imageWidth: 800,
      imageHeight: 600,
      imageState: 'raw',
      distortionModel: 'none',
      distortionCoefficients: [],
      calibratedAt: '2026-09-13T12:00:00.000Z'
    };
    expect(() =>
      assertCameraIntrinsics({...base, intrinsicMatrix: [700, 3, 400, 0, 700, 300, 0, 0, 1]})
    ).toThrow(/zero-skew/u);
    expect(() =>
      assertCameraIntrinsics({...base, intrinsicMatrix: [-700, 0, 400, 0, 700, 300, 0, 0, 1]})
    ).toThrow(/positive focal lengths/u);
    expect(() =>
      assertCameraIntrinsics({...base, intrinsicMatrix: [700, 0, 900, 0, 700, 300, 0, 0, 1]})
    ).toThrow(/principal point/u);
  });

  it('reads a pre-migration profile as intrinsics and drops its world pose', async () => {
    const legacy = parseCalibrationProfile(await fixture('legacy-camera-calibration-v1.json'));
    const current = parseCalibrationProfile(await fixture('valid-camera-intrinsics-v1.json'));
    expect(legacy.intrinsicMatrix).toEqual(current.intrinsicMatrix);
    expect(legacy.distortionModel).toBe(current.distortionModel);
    expect(legacy.distortionCoefficients).toEqual(current.distortionCoefficients);
    expect(legacy.imageState).toBe('raw');
    // The legacy profile measured no quality and the extrinsic pose is not part
    // of the intrinsic contract. Neither is invented.
    expect(legacy.quality).toBeUndefined();
    expect(Object.keys(legacy)).not.toContain('worldFromCameraMatrix');
    expect(codeOf(await fixture('invalid-legacy-camera-calibration-v2.json'))).toBe(
      'invalid-calibration'
    );
  });

  it('maps OpenCV coefficient counts to the distortion model it fitted', () => {
    expect(distortionModelForCoefficientCount(0)).toBe('none');
    expect(distortionModelForCoefficientCount(4)).toBe('opencv-plumb-bob');
    expect(distortionModelForCoefficientCount(5)).toBe('opencv-plumb-bob');
    expect(distortionModelForCoefficientCount(8)).toBe('opencv-rational');
    expect(distortionModelForCoefficientCount(14)).toBe('opencv-tilted');
    expect(() => distortionModelForCoefficientCount(7)).toThrow(/7 coefficients/u);
  });

  it('keeps the published JSON Schema aligned with the validator', () => {
    expect(Object.keys(schema.properties)).toEqual([...CAMERA_INTRINSICS_PROPERTIES]);
    expect(schema.required).toEqual([...CAMERA_INTRINSICS_REQUIRED]);
    expect(schema.properties.distortionModel.enum).toEqual([...DISTORTION_MODELS]);
    expect(schema.properties.schema.const).toBe(CAMERA_INTRINSICS_SCHEMA_ID);
    expect(schema.additionalProperties).toBe(false);
  });
});
