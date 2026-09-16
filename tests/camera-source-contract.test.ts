import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {describe, expect, it} from 'vitest';
import {
  CALIBRATION_PRODUCER,
  CameraSourceError,
  cameraSourceDistortionModel,
  toCameraSourceProfile
} from '../src/calibration/camera-source.js';
import {parseCalibrationProfile} from '../src/calibration/profile.js';

/**
 * The document this extension hands Camera Source, checked against the schema
 * Camera Source ships.
 *
 * Not a copy of that schema: it is read out of the installed package, so the
 * day the contract changes this fails here rather than in a browser. The last
 * time these two disagreed, the producer emitted a schema id the registry does
 * not accept and the whole publish path was dead while every type-check passed.
 */
const require = createRequire(import.meta.url);
// Resolved through package.json because the schemas directory is shipped but
// not listed in `exports`. Still the installed file and not a copy, which is
// the point: a copy would agree with itself forever.
const schema = JSON.parse(
  readFileSync(
    new URL(
      'schemas/camera-intrinsics-v1.json',
      new URL('.', `file://${require.resolve('@kubohiroya/turbowarp-camera-source/package.json')}`)
    ),
    'utf8'
  )
) as object;

const validate = new Ajv2020({strict: false}).compile(schema);

function solved(overrides: Record<string, unknown> = {}) {
  return parseCalibrationProfile(
    JSON.stringify({
      schema: 'camerasource/camera-intrinsics',
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
      calibratedAt: '2026-09-13T12:00:00.000Z',
      ...overrides
    })
  );
}

describe('the profile handed to Camera Source', () => {
  it('validates against the schema Camera Source publishes', () => {
    const document = toCameraSourceProfile(solved());
    expect(validate(document), JSON.stringify(validate.errors)).toBe(true);
  });

  it('validates without the quality block, which a producer need not measure', () => {
    const document = toCameraSourceProfile(solved({quality: undefined}));
    expect('quality' in document).toBe(false);
    expect(validate(document), JSON.stringify(validate.errors)).toBe(true);
  });

  it('unpacks the matrix into named parameters', () => {
    // Nine numbers cannot say whether they are row-major, and a reader that
    // guesses wrong produces a projection that is plausible and wrong.
    const document = toCameraSourceProfile(solved());
    expect(document.intrinsics).toEqual({fx: 700, fy: 700, cx: 400, cy: 300, skew: 0});
    expect(document.image).toEqual({width: 800, height: 600, undistorted: false});
  });

  it('states an already-corrected image rather than assuming a raw one', () => {
    const document = toCameraSourceProfile(solved({imageState: 'undistorted', distortionModel: 'none', distortionCoefficients: []}));
    expect(document.image.undistorted).toBe(true);
    expect(validate(document), JSON.stringify(validate.errors)).toBe(true);
  });

  it('says what produced it', () => {
    expect(toCameraSourceProfile(solved()).producer).toBe(CALIBRATION_PRODUCER);
  });

  it('names the radial-tangential family the way Camera Source names it', () => {
    expect(cameraSourceDistortionModel('opencv-plumb-bob')).toBe('brown-conrady');
    expect(cameraSourceDistortionModel('opencv-rational')).toBe('brown-conrady');
    expect(cameraSourceDistortionModel('none')).toBe('none');
  });

  it('refuses a model with no counterpart instead of sending the nearest one', () => {
    // Relabelled, a consumer would apply the wrong coefficients to real pixels
    // and get an answer that does not look wrong.
    for (const model of ['opencv-thin-prism', 'opencv-tilted'] as const) {
      expect(() => cameraSourceDistortionModel(model)).toThrowError(CameraSourceError);
    }
  });
});
