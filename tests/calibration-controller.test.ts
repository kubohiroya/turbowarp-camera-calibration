import {readFile} from 'node:fs/promises';
import {describe, expect, it, vi} from 'vitest';
import {CameraCalibrationController} from '../src/calibration/controller.js';
import type {
  CalibrationBackendPort,
  CalibrationSample,
  CalibrationSolveResult
} from '../src/calibration/types.js';
import type {CameraFrameSourcePort, CameraLeasePort} from '../src/calibration/camera-source.js';

const startOptions = {
  cameraId: 'camera-1',
  calibrationId: 'calibration-1',
  board: {columns: 9, rows: 6, squareSizeMeters: 0.025},
  maximumReprojectionErrorPx: 1.5
};

function frameSource(overrides: Partial<CameraFrameSourcePort> = {}) {
  return {
    kind: 'video',
    element: {} as HTMLVideoElement,
    width: 800,
    height: 600,
    mirrored: false,
    deviceId: 'device-1',
    ...overrides
  } as CameraFrameSourcePort & {width: number; height: number; deviceId: string};
}

function setup() {
  const frame = frameSource();
  const release = vi.fn(async () => undefined);
  const lease: CameraLeasePort = {getFrameSource: vi.fn(() => frame), release};
  let sampleIndex = 0;
  const captureSample = vi.fn(
    async (): Promise<CalibrationSample | undefined> => sample(sampleIndex++)
  );
  const solve = vi.fn(async (): Promise<CalibrationSolveResult> => ({
    intrinsicMatrix: [700, 0, 400, 0, 700, 300, 0, 0, 1],
    distortionModel: 'opencv-plumb-bob',
    distortionCoefficients: [0.01, -0.02, 0, 0, 0],
    reprojectionErrorPx: 0.75
  }));
  const backend: CalibrationBackendPort = {
    name: 'mock-calibration-backend',
    captureSample,
    solve
  };
  const create = vi.fn(async () => backend);
  const acquireCamera = vi.fn(async () => lease);
  const registerCalibrationProfile = vi.fn(async () => undefined);
  const cameraSource = {acquireCamera, calibrationApiVersion: 1, registerCalibrationProfile};
  const runtime: TurboWarpRuntime = {ext_kubohiroyacamerasource: cameraSource};
  const controller = new CameraCalibrationController({
    runtime,
    backend: {name: 'mock-calibration-backend', create},
    nowMilliseconds: () => Date.parse('2026-09-13T12:00:00Z')
  });
  return {
    controller,
    runtime,
    cameraSource,
    frame,
    lease,
    release,
    acquireCamera,
    registerCalibrationProfile,
    captureSample,
    solve,
    create
  };
}

/** Lets the lazily created solver resolve before asserting on it. */
async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

async function fillSamples(controller: CameraCalibrationController, cameraId = 'camera-1') {
  for (let index = 0; index < 8; index += 1) {
    await controller.addSample(cameraId);
  }
}

describe('CameraCalibrationController', () => {
  it('produces an intrinsic-only profile at the fixed real resolution', async () => {
    const {controller, acquireCamera, solve, release} = setup();
    await controller.start(startOptions);
    expect(acquireCamera).toHaveBeenCalledWith({
      owner: 'turbowarp-camera-calibration',
      cameraId: 'camera-1'
    });
    await fillSamples(controller);
    expect(controller.sampleCount('camera-1')).toBe(8);
    expect(controller.latestSampleQuality('camera-1')).toBe(0.8);
    await controller.solve('camera-1');
    expect(solve).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({quality: 0.8})]),
      startOptions.board,
      800,
      600
    );
    expect(controller.state('camera-1')).toBe('solved');
    expect(controller.latestReprojectionError('camera-1')).toBe(0.75);
    expect(release).toHaveBeenCalledOnce();
    expect(JSON.parse(controller.profileJson('camera-1'))).toEqual({
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
      calibratedAt: '2026-09-13T12:00:00.000Z'
    });
  });

  it('matches the pre-migration fixture on intrinsics, distortion, and error', async () => {
    const {controller} = setup();
    const legacy = JSON.parse(
      await fixture('legacy-camera-calibration-v1.json')
    ) as Record<string, unknown>;
    await controller.start(startOptions);
    await fillSamples(controller);
    await controller.solve('camera-1');
    const solved = JSON.parse(controller.profileJson('camera-1')) as Record<string, unknown>;
    expect(solved.intrinsicMatrix).toEqual(legacy.intrinsicMatrix);
    expect(solved.distortionCoefficients).toEqual(legacy.distortionCoefficients);
    expect(solved.imageWidth).toBe(legacy.imageWidth);
    expect(solved.imageHeight).toBe(legacy.imageHeight);
    expect(solved.worldFromCameraMatrix).toBeUndefined();
  });

  it('does not create the solver until a sample or a solve needs it', async () => {
    const {controller, create} = setup();
    expect(controller.backend()).toBe('mock-calibration-backend');
    await controller.start(startOptions);
    expect(create).not.toHaveBeenCalled();
    await controller.addSample('camera-1');
    expect(create).toHaveBeenCalledOnce();
    await controller.addSample('camera-1');
    expect(create).toHaveBeenCalledOnce();
  });

  it('rejects insufficient, low-quality, missing, and duplicate samples distinctly', async () => {
    const insufficient = setup();
    await insufficient.controller.start(startOptions);
    expect(() => insufficient.controller.solve('camera-1')).toThrow(/sample-insufficient/u);

    const missing = setup();
    missing.captureSample.mockResolvedValue(undefined);
    await missing.controller.start(startOptions);
    await expect(missing.controller.addSample('camera-1')).rejects.toThrow(/board-not-found/u);

    const lowQuality = setup();
    lowQuality.captureSample.mockResolvedValue({...sample(0), quality: 0.1});
    await lowQuality.controller.start(startOptions);
    await expect(lowQuality.controller.addSample('camera-1')).rejects.toThrow(
      /sample-low-quality/u
    );

    const duplicate = setup();
    duplicate.captureSample.mockResolvedValue(sample(0));
    await duplicate.controller.start(startOptions);
    await duplicate.controller.addSample('camera-1');
    await expect(duplicate.controller.addSample('camera-1')).rejects.toThrow(
      /sample-too-similar/u
    );
    expect(duplicate.controller.errorCode('camera-1')).toBe('sample-too-similar');
    expect(duplicate.controller.state('camera-1')).toBe('ready');
  });

  it('rejects changed capture conditions and excessive reprojection error', async () => {
    const resolution = setup();
    await resolution.controller.start(startOptions);
    resolution.frame.width = 1280;
    await expect(resolution.controller.addSample('camera-1')).rejects.toThrow(
      /resolution-mismatch/u
    );

    const device = setup();
    await device.controller.start(startOptions);
    device.frame.deviceId = 'device-2';
    await expect(device.controller.addSample('camera-1')).rejects.toThrow(
      /capture-condition-mismatch/u
    );

    const reprojection = setup();
    reprojection.solve.mockResolvedValue({
      intrinsicMatrix: [700, 0, 400, 0, 700, 300, 0, 0, 1],
      distortionModel: 'none',
      distortionCoefficients: [],
      reprojectionErrorPx: 2
    });
    await reprojection.controller.start(startOptions);
    await fillSamples(reprojection.controller);
    await expect(reprojection.controller.solve('camera-1')).rejects.toThrow(
      /reprojection-too-high/u
    );
    expect(reprojection.controller.state('camera-1')).toBe('ready');
    expect(reprojection.controller.profileJson('camera-1')).toBe('');
  });

  it('coalesces sampling and releases the lease while cancelling', async () => {
    const {controller, captureSample, release} = setup();
    let finish: ((value: CalibrationSample) => void) | undefined;
    captureSample.mockImplementation(
      () =>
        new Promise<CalibrationSample>((resolve) => {
          finish = resolve;
        })
    );
    await controller.start(startOptions);
    const first = controller.addSample('camera-1');
    const second = controller.addSample('camera-1');
    expect(first).toBe(second);
    await flushMicrotasks();
    expect(captureSample).toHaveBeenCalledOnce();
    finish?.(sample(0));
    await first;
    await controller.cancel('camera-1');
    expect(release).toHaveBeenCalledOnce();
    expect(controller.sampleCount('camera-1')).toBe(0);
    expect(controller.state('camera-1')).toBe('idle');
  });

  it('ignores a solve that finishes after the session was cancelled', async () => {
    const {controller, solve, release} = setup();
    let finish: ((value: Awaited<ReturnType<typeof solve>>) => void) | undefined;
    await controller.start(startOptions);
    await fillSamples(controller);
    solve.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve as typeof finish;
        })
    );
    const solving = controller.solve('camera-1');
    await flushMicrotasks();
    const cancelling = controller.cancel('camera-1');
    finish?.({
      intrinsicMatrix: [700, 0, 400, 0, 700, 300, 0, 0, 1],
      distortionModel: 'none',
      distortionCoefficients: [],
      reprojectionErrorPx: 0.5
    });
    await solving;
    await cancelling;
    expect(release).toHaveBeenCalledOnce();
    expect(controller.state('camera-1')).toBe('idle');
    expect(controller.profileJson('camera-1')).toBe('');
  });

  it('releases the lease when the device disappears mid-session', async () => {
    const {controller, lease, release} = setup();
    await controller.start(startOptions);
    lease.getFrameSource = vi.fn(() => {
      throw new Error('the camera track ended');
    });
    await expect(controller.addSample('camera-1')).rejects.toThrow(/camera-ended/u);
    expect(release).toHaveBeenCalledOnce();
    expect(controller.state('camera-1')).toBe('error');
    await controller.cancel('camera-1');
    expect(release).toHaveBeenCalledOnce();
  });

  it('calibrates two cameras without disturbing each other', async () => {
    const {controller, acquireCamera, release} = setup();
    await controller.start(startOptions);
    await controller.start({...startOptions, cameraId: 'camera-2'});
    expect(acquireCamera).toHaveBeenCalledTimes(2);
    await controller.addSample('camera-2');
    await controller.cancel('camera-2');
    expect(release).toHaveBeenCalledOnce();
    expect(controller.state('camera-2')).toBe('idle');
    expect(controller.state('camera-1')).toBe('ready');
    expect(controller.ready('camera-1')).toBe(true);
    await controller.cancelAll();
    expect(release).toHaveBeenCalledTimes(2);
  });

  it('distinguishes invalid board, missing dependency, and ended camera', async () => {
    const invalid = setup();
    await expect(
      invalid.controller.start({...startOptions, board: {...startOptions.board, columns: 2}})
    ).rejects.toThrow(/invalid-board/u);
    expect(invalid.controller.errorCode('camera-1')).toBe('invalid-board');

    const missing = setup();
    delete missing.runtime.ext_kubohiroyacamerasource;
    await expect(missing.controller.start(startOptions)).rejects.toThrow(/dependency-missing/u);
    expect(missing.controller.errorCode('camera-1')).toBe('dependency-missing');

    const refused = setup();
    refused.acquireCamera.mockRejectedValue(new Error('NotAllowedError'));
    await expect(refused.controller.start(startOptions)).rejects.toThrow(/camera-unavailable/u);

    const ended = setup();
    ended.lease.getFrameSource = vi.fn(() => {
      throw new Error('ended');
    });
    await expect(ended.controller.start(startOptions)).rejects.toThrow(/camera-ended/u);
    expect(ended.release).toHaveBeenCalledOnce();
  });

  it('imports, exports, validates, and cleans profiles', async () => {
    const {controller} = setup();
    const valid = await fixture('valid-camera-intrinsics-v1.json');
    const credential = await fixture('invalid-camera-calibration-with-credential.json');
    expect(controller.validateProfile('camera-1', valid)).toBe(true);
    await controller.importProfile('camera-1', valid);
    expect(JSON.parse(controller.profileJson('camera-1'))).toEqual(JSON.parse(valid));
    expect(controller.state('camera-1')).toBe('solved');
    expect(controller.latestReprojectionError('camera-1')).toBe(0.75);
    expect(controller.validateProfile('camera-1', credential)).toBe(false);
    expect(controller.errorCode('camera-1')).toBe('credential-forbidden');
    expect(controller.profileJson('camera-1')).not.toBe('');
    await controller.cancel('camera-1');
    expect(controller.profileJson('camera-1')).not.toBe('');
    await controller.cleanup('camera-1');
    expect(controller.profileJson('camera-1')).toBe('');
  });

  it('refuses a profile that does not apply to the camera or its capture size', async () => {
    const other = setup();
    await expect(
      other.controller.importProfile('camera-2', await fixture('valid-camera-intrinsics-v1.json'))
    ).rejects.toThrow(/calibration-not-applicable/u);
    expect(other.controller.errorCode('camera-2')).toBe('calibration-not-applicable');
    expect(other.controller.profileJson('camera-2')).toBe('');

    const resized = setup();
    resized.frame.width = 1280;
    resized.frame.height = 720;
    await resized.controller.start(startOptions);
    await expect(
      resized.controller.importProfile(
        'camera-1',
        await fixture('valid-camera-intrinsics-v1.json')
      )
    ).rejects.toThrow(/calibration-not-applicable/u);
    // The rejected import must leave the running session untouched.
    expect(resized.controller.state('camera-1')).toBe('ready');
  });

  it('publishes a solved profile through the Camera Source contract', async () => {
    const {controller, registerCalibrationProfile} = setup();
    await controller.start(startOptions);
    await fillSamples(controller);
    await controller.solve('camera-1');
    await controller.publishProfile('camera-1');
    expect(registerCalibrationProfile).toHaveBeenCalledWith(
      JSON.parse(controller.profileJson('camera-1'))
    );
    expect(controller.errorCode('camera-1')).toBe('');
  });

  it('reports an uncalibrated camera, a missing registry, and a contract mismatch', async () => {
    const uncalibrated = setup();
    await expect(uncalibrated.controller.publishProfile('camera-1')).rejects.toThrow(
      /not-calibrated/u
    );

    const mismatch = setup();
    await mismatch.controller.importProfile(
      'camera-1',
      await fixture('valid-camera-intrinsics-v1.json')
    );
    mismatch.cameraSource.calibrationApiVersion = 2;
    await expect(mismatch.controller.publishProfile('camera-1')).rejects.toThrow(
      /api-version-mismatch/u
    );
    expect(mismatch.controller.errorCode('camera-1')).toBe('api-version-mismatch');

    const legacyCameraSource = setup();
    await legacyCameraSource.controller.importProfile(
      'camera-1',
      await fixture('valid-camera-intrinsics-v1.json')
    );
    legacyCameraSource.runtime.ext_kubohiroyacamerasource = {
      acquireCamera: legacyCameraSource.acquireCamera
    };
    await expect(legacyCameraSource.controller.publishProfile('camera-1')).rejects.toThrow(
      /api-version-mismatch/u
    );

    const absent = setup();
    await absent.controller.importProfile(
      'camera-1',
      await fixture('valid-camera-intrinsics-v1.json')
    );
    delete absent.runtime.ext_kubohiroyacamerasource;
    await expect(absent.controller.publishProfile('camera-1')).rejects.toThrow(
      /dependency-missing/u
    );
  });
});

function sample(offset: number): CalibrationSample {
  return {
    corners: Array.from({length: 54}, (_, index) => ({
      x: 100 + (index % 9) * 40 + offset * 30,
      y: 100 + Math.floor(index / 9) * 40
    })),
    quality: 0.8,
    coverage: 0.25,
    sharpness: 120
  };
}

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`fixtures/calibration/${name}`, import.meta.url), 'utf8');
}
