import {
  readCameraProfileDocument,
  serializeCameraInfoYaml,
  serializeCameraIntrinsicProfile
} from '@kubohiroya/turbowarp-camera-source/profile';
import {describe, expect, it} from 'vitest';
import {toCameraSourceProfile} from '../src/calibration/camera-source.js';
import {
  CalibrationProfileError,
  parseCalibrationProfile,
  type CameraIntrinsicsV1
} from '../src/calibration/profile.js';

/**
 * A calibration as it leaves the PC: the ROS camera_info YAML Camera Source
 * writes. This extension produces the profile and Camera Source writes the
 * file, so the only honest round trip goes through both, with the reader and
 * writer taken from the installed Camera Source rather than copied.
 */
const solved: CameraIntrinsicsV1 = {
  schema: 'camerasource/camera-intrinsics',
  version: 1,
  calibrationId: 'calibration-1',
  cameraId: 'default',
  cameraModel: 'pinhole',
  imageWidth: 1280,
  imageHeight: 720,
  imageState: 'raw',
  intrinsicMatrix: [912.4, 0, 641.2, 0, 910.8, 359.6, 0, 0, 1],
  distortionModel: 'opencv-plumb-bob',
  distortionCoefficients: [0.081, -0.192, 0.0004, -0.0011, 0.097],
  quality: {sampleCount: 18, reprojectionErrorPx: 0.41},
  capture: {resizeMode: 'none', zoom: 1, focusMode: 'manual', focusDistance: 0.35, frameRate: 30},
  device: {label: 'USB Camera'},
  calibratedAt: '2026-09-17T06:00:00.000Z'
};

function written(profile: CameraIntrinsicsV1): string {
  const document = readCameraProfileDocument(toCameraSourceProfile(profile));
  if (!document.ok) throw new Error(document.error.message);
  return serializeCameraInfoYaml(document.profile);
}

function codeOf(text: string): string {
  try {
    parseCalibrationProfile(text);
  } catch (error) {
    return error instanceof CalibrationProfileError ? error.code : 'unexpected-error';
  }
  return 'accepted';
}

describe('a calibration file', () => {
  it('reads back the profile that was written, through Camera Source', () => {
    const text = written(solved);
    expect(text).toMatch(/^image_width: 1280\n/);
    expect(parseCalibrationProfile(text)).toEqual(solved);
  });

  it('reads the rational model and a lens-free image back as they were', () => {
    const rational: CameraIntrinsicsV1 = {
      ...solved,
      distortionModel: 'opencv-rational',
      distortionCoefficients: [0.1, -0.2, 0.001, -0.002, 0.05, 0.01, -0.02, 0.003]
    };
    expect(parseCalibrationProfile(written(rational))).toEqual(rational);
    const undistorted: CameraIntrinsicsV1 = {
      ...solved,
      imageState: 'undistorted',
      distortionModel: 'none',
      distortionCoefficients: []
    };
    expect(parseCalibrationProfile(written(undistorted))).toEqual(undistorted);
  });

  it('reads the JSON Camera Source renders as well', () => {
    const document = readCameraProfileDocument(toCameraSourceProfile(solved));
    if (!document.ok) throw new Error(document.error.message);
    expect(parseCalibrationProfile(serializeCameraIntrinsicProfile(document.profile))).toEqual(solved);
  });

  it('refuses a file for the reason Camera Source gives, naming the member', () => {
    const text = written(solved).replace('rows: 3\n  cols: 3\n  data: [912.4', 'rows: 3\n  cols: 3\n  data: [0');
    expect(() => parseCalibrationProfile(text)).toThrow(/camera_matrix|intrinsics\.fx/);
    expect(codeOf(text)).toBe('invalid-calibration');
  });

  it('refuses a fisheye calibration this extension has no model for, rather than relabelling it', () => {
    const text = written(solved)
      .replace('distortion_model: plumb_bob', 'distortion_model: equidistant')
      .replace('cols: 5\n  data: [0.081, -0.192, 0.0004, -0.0011, 0.097]', 'cols: 4\n  data: [0.01, -0.02, 0.003, -0.001]');
    expect(() => parseCalibrationProfile(text)).toThrow(/no distortion model matching kannala-brandt/);
  });

  it('refuses a plain ROS file that does not say when it was calibrated', () => {
    const plain = written(solved).split('turbowarp_camera_source:')[0]!;
    expect(() => parseCalibrationProfile(plain)).toThrow(/turbowarp_camera_source/);
  });
});
