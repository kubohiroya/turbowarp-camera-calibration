import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import definitions from '../src/block-definitions.json';
import {
  CameraCalibrationExtension,
  IDLE_CALIBRATION_STATE,
  type CameraCalibrationExtensionOptions
} from '../src/extension.js';
import type {CalibrationBackendPort, CalibrationSample} from '../src/calibration/types.js';
import type {CameraFrameSourcePort, CameraLeasePort} from '../src/calibration/camera-source.js';

const opcodesRequiringTheFeature = definitions.blocks
  .filter((block) => block.feature === 'cameraCalibrationV1')
  .map((block) => block.opcode);

interface Listeners {
  [event: string]: Array<() => void>;
}

function setup(options: Partial<CameraCalibrationExtensionOptions> = {}) {
  const listeners: Listeners = {};
  const frame: CameraFrameSourcePort = {
    kind: 'video',
    element: {} as HTMLVideoElement,
    width: 800,
    height: 600,
    mirrored: false,
    deviceId: 'device-1'
  };
  const release = vi.fn(async () => undefined);
  const lease: CameraLeasePort = {getFrameSource: () => frame, release};
  const backend: CalibrationBackendPort = {
    name: 'mock-calibration-backend',
    captureSample: vi.fn(async (): Promise<CalibrationSample | undefined> => undefined),
    solve: vi.fn(async () => {
      throw new Error('not used');
    })
  };
  const runtime: TurboWarpRuntime = {
    ext_kubohiroyacamerasource: {acquireCamera: vi.fn(async () => lease)},
    on: (event: string, listener: () => void) => {
      (listeners[event] ??= []).push(listener);
    },
    off: vi.fn()
  };
  const extension = new CameraCalibrationExtension({
    runtime,
    backend: {name: 'mock-calibration-backend', create: async () => backend},
    ...options
  });
  const emit = async (event: string) => {
    for (const listener of listeners[event] ?? []) listener();
    await Promise.resolve();
  };
  return {extension, runtime, listeners, emit, release};
}

beforeEach(() => {
  vi.stubGlobal('Scratch', {
    BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', HAT: 'hat'},
    ArgumentType: {STRING: 'string', NUMBER: 'number', BOOLEAN: 'Boolean'},
    Cast: {
      toString: (value: unknown) => String(value ?? ''),
      toNumber: (value: unknown) => Number(value) || 0,
      toBoolean: (value: unknown) => Boolean(value)
    },
    translate: (message: string | {default: string}) =>
      typeof message === 'string' ? message : message.default
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CameraCalibrationExtension with the feature disabled', () => {
  it('keeps the pre-migration behavior: one reporter that answers idle', () => {
    const {extension} = setup({enabled: false});
    const info = extension.getInfo() as {blocks: Array<{opcode: string}>};
    expect(info.blocks.map((block) => block.opcode)).toEqual(['cameraCalibrationState']);
    expect(extension.cameraCalibrationState()).toBe(IDLE_CALIBRATION_STATE);
    expect(extension.cameraCalibrationState({CAMERA_ID: 'left'})).toBe(IDLE_CALIBRATION_STATE);
    expect(extension.cameraCalibrationState({CAMERA_ID: '  '})).toBe(IDLE_CALIBRATION_STATE);
  });

  it('refuses every calibration command instead of reporting a silent success', async () => {
    const {extension} = setup({enabled: false});
    await expect(
      extension.startCameraCalibration({
        CAMERA_ID: 'default',
        CALIBRATION_ID: 'calibration-1',
        COLUMNS: 9,
        ROWS: 6,
        SQUARE_METERS: 0.025,
        MAX_ERROR_PX: 1.5
      })
    ).rejects.toThrow(/disabled/u);
    await expect(extension.addCameraCalibrationSample({CAMERA_ID: 'default'})).rejects.toThrow(
      /disabled/u
    );
    await expect(extension.solveCameraCalibration({CAMERA_ID: 'default'})).rejects.toThrow(
      /disabled/u
    );
    await expect(extension.publishCameraCalibration({CAMERA_ID: 'default'})).rejects.toThrow(
      /disabled/u
    );
    expect(extension.cameraCalibrationReady({CAMERA_ID: 'default'})).toBe(false);
    expect(extension.cameraCalibrationBackend()).toBe('');
    expect(extension.cameraCalibrationJson({CAMERA_ID: 'default'})).toBe('');
    expect(extension.cameraCalibrationErrorCode({CAMERA_ID: 'default'})).toBe('');
    expect(extension.cameraCalibrationSampleCount({CAMERA_ID: 'default'})).toBe(0);
  });

  it('never acquires a camera', async () => {
    const {extension, runtime} = setup({enabled: false});
    const source = runtime.ext_kubohiroyacamerasource as {acquireCamera: ReturnType<typeof vi.fn>};
    await expect(
      extension.startCameraCalibration({
        CAMERA_ID: 'default',
        CALIBRATION_ID: 'calibration-1',
        COLUMNS: 9,
        ROWS: 6,
        SQUARE_METERS: 0.025,
        MAX_ERROR_PX: 1.5
      })
    ).rejects.toThrow(/disabled/u);
    expect(source.acquireCamera).not.toHaveBeenCalled();
  });
});

describe('CameraCalibrationExtension with the feature enabled', () => {
  it('publishes every calibration block', () => {
    const {extension} = setup({enabled: true});
    const info = extension.getInfo() as {blocks: Array<{opcode: string}>};
    const opcodes = info.blocks.map((block) => block.opcode);
    expect(opcodes).toEqual(definitions.blocks.map((block) => block.opcode));
    for (const opcode of opcodesRequiringTheFeature) expect(opcodes).toContain(opcode);
  });

  it('uses localizable extension and block text', () => {
    const {extension} = setup({enabled: true});
    const info = extension.getInfo() as {
      id: string;
      name: string;
      blocks: Array<{opcode: string; text: string}>;
    };
    expect(info.id).toBe('kubohiroyacameracalibration');
    expect(info.name).toBe('TurboWarp-Camera-Calibration');
    expect(
      info.blocks.find((block) => block.opcode === 'cameraCalibrationState')?.text
    ).toBe('camera calibration state [CAMERA_ID]');
  });

  it('publishes documentation and a self-contained SVG block icon', () => {
    const {extension} = setup({enabled: true});
    const info = extension.getInfo() as {docsURI: string; blockIconURI: string};
    expect(info.docsURI).toBe('https://kubohiroya.github.io/turbowarp-camera-calibration/');
    expect(info.blockIconURI).toMatch(/^data:image\/svg\+xml;base64,/u);
  });

  it('names the solver without loading it', () => {
    const {extension} = setup({enabled: true});
    expect(extension.cameraCalibrationBackend()).toBe('mock-calibration-backend');
  });

  it('runs a session and releases the lease when the project stops', async () => {
    const {extension, emit, release} = setup({enabled: true});
    await extension.startCameraCalibration({
      CAMERA_ID: 'left',
      CALIBRATION_ID: 'calibration-1',
      COLUMNS: 9,
      ROWS: 6,
      SQUARE_METERS: 0.025,
      MAX_ERROR_PX: 1.5
    });
    expect(extension.cameraCalibrationState({CAMERA_ID: 'left'})).toBe('ready');
    expect(extension.cameraCalibrationReady({CAMERA_ID: 'left'})).toBe(true);
    await emit('PROJECT_STOP_ALL');
    expect(release).toHaveBeenCalledOnce();
    expect(extension.cameraCalibrationState({CAMERA_ID: 'left'})).toBe(IDLE_CALIBRATION_STATE);
  });

  it('releases the lease when the project is replaced', async () => {
    const {extension, emit, release} = setup({enabled: true});
    await extension.startCameraCalibration({
      CAMERA_ID: 'left',
      CALIBRATION_ID: 'calibration-1',
      COLUMNS: 9,
      ROWS: 6,
      SQUARE_METERS: 0.025,
      MAX_ERROR_PX: 1.5
    });
    await emit('PROJECT_LOADED');
    expect(release).toHaveBeenCalledOnce();
  });

  it('reports a missing Camera Source instead of opening its own camera', async () => {
    const {extension, runtime} = setup({enabled: true});
    delete runtime.ext_kubohiroyacamerasource;
    await expect(
      extension.startCameraCalibration({
        CAMERA_ID: 'default',
        CALIBRATION_ID: 'calibration-1',
        COLUMNS: 9,
        ROWS: 6,
        SQUARE_METERS: 0.025,
        MAX_ERROR_PX: 1.5
      })
    ).rejects.toThrow(/dependency-missing/u);
    expect(extension.cameraCalibrationErrorCode({CAMERA_ID: 'default'})).toBe(
      'dependency-missing'
    );
  });
});
