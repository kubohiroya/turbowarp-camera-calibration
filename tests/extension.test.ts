import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CameraCalibrationExtension, IDLE_CALIBRATION_STATE} from '../src/extension.js';

beforeEach(() => {
  vi.stubGlobal('Scratch', {
    BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean'},
    ArgumentType: {STRING: 'string'},
    Cast: {
      toString: (value: unknown) => String(value)
    },
    translate: (message: string | {default: string}) =>
      typeof message === 'string' ? message : message.default
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CameraCalibrationExtension', () => {
  it('reports idle for every camera until the procedure is implemented', () => {
    const extension = new CameraCalibrationExtension();
    expect(extension.cameraCalibrationState()).toBe(IDLE_CALIBRATION_STATE);
    expect(extension.cameraCalibrationState({CAMERA_ID: 'left'})).toBe(IDLE_CALIBRATION_STATE);
    expect(extension.cameraCalibrationState({CAMERA_ID: '  '})).toBe(IDLE_CALIBRATION_STATE);
  });

  it('uses localizable extension and block text', () => {
    const info = new CameraCalibrationExtension().getInfo() as {
      id: string;
      name: string;
      blocks: Array<{text: string}>;
    };
    expect(info.id).toBe('kubohiroyacameracalibration');
    expect(info.name).toBe('TurboWarp-Camera-Calibration');
    expect(info.blocks[0]?.text).toBe('camera calibration state [CAMERA_ID]');
  });

  it('publishes documentation and a self-contained SVG block icon', () => {
    const info = new CameraCalibrationExtension().getInfo() as {
      docsURI: string;
      blockIconURI: string;
    };
    expect(info.docsURI).toBe('https://kubohiroya.github.io/turbowarp-camera-calibration/');
    expect(info.blockIconURI).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
