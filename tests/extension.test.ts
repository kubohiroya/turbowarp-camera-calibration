import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import definitions from '../src/block-definitions.json';
import {
  CameraCalibrationExtension,
  IDLE_CALIBRATION_STATE,
  type CameraCalibrationExtensionOptions
} from '../src/extension.js';
import type {CalibrationBackendPort, CalibrationSample} from '../src/calibration/types.js';
import type {CameraFrameSource, CameraLease} from '../src/calibration/camera-source.js';
import {
  readCameraCalibrationCapability,
  runtimeCapabilityKey,
  runtimeCapabilityVersion
} from '../src/runtime.js';

interface Listeners {
  [event: string]: Array<() => void>;
}

function setup(options: Partial<CameraCalibrationExtensionOptions> = {}) {
  const listeners: Listeners = {};
  const frame: CameraFrameSource = {
    kind: 'video',
    element: {} as HTMLVideoElement,
    width: 800,
    height: 600,
    previewFlip: 'none',
    deviceId: 'device-1'
  };
  const release = vi.fn(async () => undefined);
  const lease: CameraLease = {getFrameSource: () => frame, release};
  const backend: CalibrationBackendPort = {
    name: 'mock-calibration-backend',
    captureSample: vi.fn(async (): Promise<CalibrationSample | undefined> => undefined),
    solve: vi.fn(async () => {
      throw new Error('not used');
    }),
    validate: vi.fn(async () => 0),
    measurePose: vi.fn(async () => undefined)
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

describe('CameraCalibrationExtension', () => {
  it('publishes every block it defines, with nothing held back', () => {
    // These were once behind a startup flag whose default left the extension
    // with one reporter answering idle. Nothing gates them now, so a palette
    // missing one is a fault rather than a configuration.
    const {extension} = setup();
    const info = extension.getInfo() as {blocks: Array<{opcode: string}>};
    expect(info.blocks.map((block) => block.opcode)).toEqual(
      definitions.blocks.map((block) => block.opcode),
    );
  });

  it('reports a camera nobody has calibrated as idle, not as an error', () => {
    const {extension} = setup();
    expect(extension.cameraCalibrationState()).toBe(IDLE_CALIBRATION_STATE);
    expect(extension.cameraCalibrationState({CAMERA_ID: 'left'})).toBe(IDLE_CALIBRATION_STATE);
    expect(extension.cameraCalibrationJson({CAMERA_ID: 'default'})).toBe('');
    expect(extension.cameraCalibrationErrorCode({CAMERA_ID: 'default'})).toBe('');
    expect(extension.cameraCalibrationSampleCount({CAMERA_ID: 'default'})).toBe(0);
    expect(extension.cameraCalibrationReady({CAMERA_ID: 'default'})).toBe(false);
  });

  it('names the solver without loading it', () => {
    // Reading the backend must not pull in the OpenCV build. It is created on
    // the first sample or solve and never before.
    const {extension} = setup();
    expect(extension.cameraCalibrationBackend()).toBe('mock-calibration-backend');
  });
});

describe('CameraCalibrationExtension driving a calibration', () => {
  it('publishes every calibration block', () => {
    const {extension} = setup();
    const info = extension.getInfo() as {blocks: Array<{opcode: string}>};
    const opcodes = info.blocks.map((block) => block.opcode);
    expect(opcodes).toEqual(definitions.blocks.map((block) => block.opcode));
    for (const block of definitions.blocks) expect(opcodes).toContain(block.opcode);
  });

  it('uses localizable extension and block text', () => {
    const {extension} = setup();
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
    const {extension} = setup();
    const info = extension.getInfo() as {docsURI: string; blockIconURI: string};
    expect(info.docsURI).toBe('https://kubohiroya.github.io/turbowarp-camera-calibration/');
    expect(info.blockIconURI).toMatch(/^data:image\/svg\+xml;base64,/u);
  });

  it('names the solver without loading it', () => {
    const {extension} = setup();
    expect(extension.cameraCalibrationBackend()).toBe('mock-calibration-backend');
  });

  it('runs a session and releases the lease when the project stops', async () => {
    const {extension, emit, release} = setup();
    await extension.startCameraCalibration({
      CAMERA_ID: 'left',
      CALIBRATION_ID: 'calibration-1',
      COLUMNS: 9,
      ROWS: 6,
      SQUARE_METERS: 0.025,
      MARKER_METERS: 0.018,
      MAX_ERROR_PX: 1.5
    });
    expect(extension.cameraCalibrationState({CAMERA_ID: 'left'})).toBe('ready');
    expect(extension.cameraCalibrationReady({CAMERA_ID: 'left'})).toBe(true);
    await emit('PROJECT_STOP_ALL');
    expect(release).toHaveBeenCalledOnce();
    expect(extension.cameraCalibrationState({CAMERA_ID: 'left'})).toBe(IDLE_CALIBRATION_STATE);
  });

  it('releases the lease when the project is replaced', async () => {
    const {extension, emit, release} = setup();
    await extension.startCameraCalibration({
      CAMERA_ID: 'left',
      CALIBRATION_ID: 'calibration-1',
      COLUMNS: 9,
      ROWS: 6,
      SQUARE_METERS: 0.025,
      MARKER_METERS: 0.018,
      MAX_ERROR_PX: 1.5
    });
    await emit('PROJECT_LOADED');
    expect(release).toHaveBeenCalledOnce();
  });

  it('reports a missing Camera Source instead of opening its own camera', async () => {
    const {extension, runtime} = setup();
    delete runtime.ext_kubohiroyacamerasource;
    await expect(
      extension.startCameraCalibration({
        CAMERA_ID: 'default',
        CALIBRATION_ID: 'calibration-1',
        COLUMNS: 9,
        ROWS: 6,
        SQUARE_METERS: 0.025,
        MARKER_METERS: 0.018,
        MAX_ERROR_PX: 1.5
      })
    ).rejects.toThrow(/dependency-missing/u);
    expect(extension.cameraCalibrationErrorCode({CAMERA_ID: 'default'})).toBe(
      'dependency-missing'
    );
  });
});

describe('the runtime capability', () => {
  it('publishes itself under a versioned key when the feature is on', () => {
    const {runtime} = setup();
    const capability = readCameraCalibrationCapability(runtime);
    expect(capability?.version).toBe(runtimeCapabilityVersion);
    expect(capability?.requireVersion(runtimeCapabilityVersion)).toBe(capability);
  });

  it('refuses a version it does not implement, rather than answering anyway', () => {
    const {runtime} = setup();
    const capability = readCameraCalibrationCapability(runtime);
    expect(() => capability?.requireVersion(2)).toThrowError(/Unsupported/u);
  });

  it('is published as soon as the extension is registered', () => {
    // An absent key means the extension is not loaded, and nothing else. It
    // used to also mean "loaded, with the path switched off", which is a
    // configuration reported as an absence.
    const {runtime} = setup();
    expect(runtime[runtimeCapabilityKey]).toBeDefined();
  });

  it('drives the same session the blocks drive', async () => {
    const {extension, runtime} = setup();
    const capability = readCameraCalibrationCapability(runtime);
    await capability?.start({
      cameraId: 'default',
      calibrationId: 'calibration-1',
      board: {columns: 9, rows: 6, squareSizeMeters: 0.025, markerSizeMeters: 0.018},
      maximumReprojectionErrorPx: 1.5
    });
    // One camera, not two views of one camera that disagree.
    expect(capability?.state('default')).toBe('ready');
    expect(extension.cameraCalibrationState({CAMERA_ID: 'default'})).toBe('ready');
    expect(capability?.ready('default')).toBe(true);
  });

  it('addresses a camera the way the blocks address it', async () => {
    // The blocks fall back to `default` and trim; a delegated call that did not
    // would open a second session on a camera the operator thinks is one.
    const {extension, runtime} = setup();
    const capability = readCameraCalibrationCapability(runtime);
    await capability?.start({
      cameraId: '  ',
      calibrationId: 'calibration-1',
      board: {columns: 9, rows: 6, squareSizeMeters: 0.025, markerSizeMeters: 0.018},
      maximumReprojectionErrorPx: 1.5
    });
    expect(extension.cameraCalibrationState({CAMERA_ID: 'default'})).toBe('ready');
  });

  it('names the solver without creating it', () => {
    const {runtime} = setup();
    expect(readCameraCalibrationCapability(runtime)?.backend()).toBe('mock-calibration-backend');
  });

  it('records a refusal where both the blocks and the caller can read it', async () => {
    const {extension, runtime} = setup();
    const capability = readCameraCalibrationCapability(runtime);
    await expect(
      capability?.start({
        cameraId: 'default',
        calibrationId: 'calibration-1',
        board: {columns: 2, rows: 6, squareSizeMeters: 0.025, markerSizeMeters: 0.018},
        maximumReprojectionErrorPx: 1.5
      })
    ).rejects.toThrow(/invalid-board/u);
    expect(capability?.errorCode('default')).toBe('invalid-board');
    expect(extension.cameraCalibrationErrorCode({CAMERA_ID: 'default'})).toBe('invalid-board');
  });

  it('goes away with the runtime it belongs to', async () => {
    const {runtime, emit} = setup();
    expect(readCameraCalibrationCapability(runtime)).toBeDefined();
    await emit('RUNTIME_DISPOSED');
    // A consumer outliving the VM reads an absent extension rather than
    // driving a controller whose camera leases are already gone.
    expect(readCameraCalibrationCapability(runtime)).toBeUndefined();
  });

  it('reports an unsolved camera as unsolved rather than as a flawless one', () => {
    const {runtime} = setup();
    const capability = readCameraCalibrationCapability(runtime);
    expect(capability?.reprojectionErrorPx('default')).toBe(0);
    // Zero error and no calibration read the same in the number alone, which is
    // why the state is what a caller has to check.
    expect(capability?.state('default')).toBe('idle');
    expect(capability?.profileJson('default')).toBe('');
  });
});
