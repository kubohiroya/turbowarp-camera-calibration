import {readFile} from 'node:fs/promises';
import {describe, expect, it, vi} from 'vitest';
import {CameraCalibrationController} from '../src/calibration/controller.js';
import type {
  CalibrationBackendPort,
  CalibrationDetection,
  CalibrationSample,
  CalibrationSolveResult
} from '../src/calibration/types.js';
import type {CameraFrameSource, CameraLease} from '../src/calibration/camera-source.js';

const startOptions = {
  cameraId: 'camera-1',
  calibrationId: 'calibration-1',
  board: {columns: 9, rows: 6, squareSizeMeters: 0.025, markerSizeMeters: 0.018},
  maximumReprojectionErrorPx: 1.5
};

function frameSource(overrides: Partial<CameraFrameSource> = {}) {
  return {
    kind: 'video',
    element: {} as HTMLVideoElement,
    width: 800,
    height: 600,
    previewFlip: 'none',
    deviceId: 'device-1',
    ...overrides
  } as CameraFrameSource & {width: number; height: number; deviceId: string};
}

function setup(schedule?: (callback: () => void, delayMs: number) => () => void) {
  const frame = frameSource();
  const release = vi.fn(async () => undefined);
  const lease: CameraLease = {getFrameSource: vi.fn(() => frame), release};
  let sampleIndex = 0;
  const captureSample = vi.fn(
    async (): Promise<CalibrationDetection> => ({
      sample: sample(sampleIndex++),
      markersSeen: 35
    })
  );
  // What the solve was actually given, so a test can see the split without
  // reaching into the mock's call records.
  const split = {fitted: 0, heldOut: 0};
  const solve = vi.fn(async (samples: readonly CalibrationSample[]): Promise<CalibrationSolveResult> => {
    split.fitted = samples.length;
    return {
      intrinsicMatrix: [700, 0, 400, 0, 700, 300, 0, 0, 1],
      distortionModel: 'opencv-plumb-bob',
      distortionCoefficients: [0.01, -0.02, 0, 0, 0],
      reprojectionErrorPx: 0.75
    };
  });
  // Returns a residual proportional to how many views were held back, so a
  // test can tell a validated solve from one that skipped validation.
  const validate = vi.fn(async (held: readonly CalibrationSample[]): Promise<number> => {
    split.heldOut = held.length;
    return held.length === 0 ? 0 : 0.5 + held.length / 100;
  });
  const backend: CalibrationBackendPort = {
    name: 'mock-calibration-backend',
    captureSample,
    solve,
    validate,
    measurePose: vi.fn(async () => undefined)
  };
  const create = vi.fn(async () => backend);
  const acquireCamera = vi.fn(async () => lease);
  const registerProfile = vi.fn((document: unknown) => ({ok: true as const, profile: document}));
  // Camera Source as it really is: the camera on the extension key, the profile
  // registry on its own versioned capability key.
  const capability = {
    version: 1,
    requireVersion: vi.fn((version: number) => {
      if (version !== capability.version) {
        throw new Error(
          `Unsupported Camera Source runtime capability version: ${version}; this build provides ${capability.version}.`
        );
      }
      return capability;
    }),
    registerProfile
  };
  const cameraSource = {acquireCamera};
  const runtime: TurboWarpRuntime = {
    ext_kubohiroyacamerasource: cameraSource,
    kubohiroyaCameraSourceCapability: capability
  };
  const controller = new CameraCalibrationController({
    runtime,
    backend: {name: 'mock-calibration-backend', create},
    nowMilliseconds: () => Date.parse('2026-09-13T12:00:00Z'),
    ...(schedule ? {schedule} : {})
  });
  return {
    controller,
    runtime,
    cameraSource,
    frame,
    lease,
    release,
    acquireCamera,
    validate,
    split,
    capability,
    registerProfile,
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
    missing.captureSample.mockResolvedValue({markersSeen: 0});
    await missing.controller.start(startOptions);
    await expect(missing.controller.addSample('camera-1')).rejects.toThrow(/board-not-found/u);

    const lowQuality = setup();
    lowQuality.captureSample.mockResolvedValue({
      sample: {...sample(0), quality: 0.1},
      markersSeen: 35
    });
    await lowQuality.controller.start(startOptions);
    await expect(lowQuality.controller.addSample('camera-1')).rejects.toThrow(
      /sample-low-quality/u
    );

    const duplicate = setup();
    duplicate.captureSample.mockResolvedValue({sample: sample(0), markersSeen: 35});
    await duplicate.controller.start(startOptions);
    await duplicate.controller.addSample('camera-1');
    await expect(duplicate.controller.addSample('camera-1')).rejects.toThrow(
      /sample-too-similar/u
    );
    expect(duplicate.controller.errorCode('camera-1')).toBe('sample-too-similar');
    expect(duplicate.controller.state('camera-1')).toBe('ready');
  });

  it('keeps the session open when the solver cannot read a frame', async () => {
    // The camera, its lease and the views held are all still good. Ending the
    // session would throw those away and keep the camera leased by a session
    // that refuses every further step.
    const {controller, captureSample, release} = setup();
    await controller.start(startOptions);
    await controller.addSample('camera-1');
    captureSample.mockRejectedValueOnce(new Error('the solver crashed'));
    await expect(controller.addSample('camera-1')).rejects.toThrow(/sample-failed/u);
    expect(controller.errorCode('camera-1')).toBe('sample-failed');
    expect(controller.state('camera-1')).toBe('ready');
    expect(release).not.toHaveBeenCalled();
    await controller.addSample('camera-1');
    expect(controller.sampleCount('camera-1')).toBe(2);
    expect(controller.errorCode('camera-1')).toBe('');
  });

  it('keeps the views and the camera when a solve fails, so it can be tried again', async () => {
    const {controller, solve, release} = setup();
    await controller.start(startOptions);
    await fillSamples(controller);
    solve.mockRejectedValueOnce(new Error('the solver crashed'));
    await expect(controller.solve('camera-1')).rejects.toThrow(/solve-failed/u);
    expect(controller.state('camera-1')).toBe('ready');
    expect(controller.sampleCount('camera-1')).toBe(8);
    expect(release).not.toHaveBeenCalled();
    await controller.solve('camera-1');
    expect(controller.state('camera-1')).toBe('solved');
    expect(release).toHaveBeenCalledOnce();
  });

  it('refuses a view whose corners lie on one line of the board', async () => {
    // A strip of corners along the edge of the frame fixes no plane: the
    // solver has no homography to start from and fails on the whole set.
    const whole = sample(0);
    const {controller, captureSample} = setup();
    captureSample.mockResolvedValueOnce({
      sample: {...whole, corners: whole.corners.slice(0, 9), ids: whole.ids.slice(0, 9)},
      markersSeen: 10
    });
    await controller.start(startOptions);
    await expect(controller.addSample('camera-1')).rejects.toThrow(
      /sample-low-quality: The corners found lie on one line/u
    );
    expect(controller.sampleCount('camera-1')).toBe(0);
    expect(controller.state('camera-1')).toBe('ready');
  });

  it('stops the solver when every camera is cleaned up', async () => {
    // Nothing else ends it. A disposed runtime would otherwise keep a worker
    // holding OpenCV.
    const context = setup();
    const dispose = vi.fn();
    const backend = await context.create();
    backend.dispose = dispose;
    await context.controller.start(startOptions);
    await context.controller.addSample('camera-1');
    await context.controller.cleanupAll();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('refuses a solve by hand that does not hold up on the views it was not fitted to', async () => {
    // The bar the automatic path already sets. The fit error alone is met by
    // an overfitted answer, exactly when the set was too small or too alike.
    const {controller, validate, release} = setup();
    validate.mockResolvedValue(4);
    await controller.start(startOptions);
    for (let index = 0; index < 12; index += 1) await controller.addSample('camera-1');
    await expect(controller.solve('camera-1')).rejects.toThrow(
      /reprojection-too-high: Hold-out reprojection RMS 4 px over 2 views/u
    );
    expect(controller.state('camera-1')).toBe('ready');
    expect(controller.profileJson('camera-1')).toBe('');
    expect(release).not.toHaveBeenCalled();
  });

  it('does not refuse a solve on a single held-out view', async () => {
    // One view, possibly six corners of one: too noisy to refuse a
    // calibration on. It is still reported.
    const {controller, validate} = setup();
    validate.mockResolvedValue(4);
    await controller.start(startOptions);
    for (let index = 0; index < 9; index += 1) await controller.addSample('camera-1');
    await controller.solve('camera-1');
    expect(controller.state('camera-1')).toBe('solved');
    expect(controller.holdoutSampleCount('camera-1')).toBe(1);
    expect(controller.latestHoldoutError('camera-1')).toBe(4);
  });

  it('counts the views the fit used, not the ones held back, in the profile quality', async () => {
    const {controller} = setup();
    await controller.start(startOptions);
    for (let index = 0; index < 12; index += 1) await controller.addSample('camera-1');
    await controller.solve('camera-1');
    const profile = JSON.parse(controller.profileJson('camera-1')) as {
      quality: {sampleCount: number};
    };
    expect(profile.quality.sampleCount).toBe(10);
    expect(controller.holdoutSampleCount('camera-1')).toBe(2);
  });

  it('recognises the same view when it shows a different set of corners', async () => {
    // A ChArUco view need not show every corner, and the detector rarely finds
    // exactly the same ones twice. Compared by position in the array, one
    // corner fewer shifts every corner after it, and a board that did not move
    // reads as a new view -- in either order.
    const whole = sample(0);
    const partial: CalibrationSample = {
      ...whole,
      corners: whole.corners.slice(1),
      ids: whole.ids.slice(1)
    };
    for (const [first, second] of [
      [whole, partial],
      [partial, whole]
    ] as const) {
      const context = setup();
      context.captureSample
        .mockResolvedValueOnce({sample: first, markersSeen: 35})
        .mockResolvedValueOnce({sample: second, markersSeen: 35});
      await context.controller.start(startOptions);
      await context.controller.addSample('camera-1');
      await expect(context.controller.addSample('camera-1')).rejects.toThrow(
        /sample-too-similar/u
      );
      expect(context.controller.sampleCount('camera-1')).toBe(1);
    }
  });

  it('still takes a view that shares no corner with any held', async () => {
    const whole = sample(0);
    const context = setup();
    context.captureSample
      .mockResolvedValueOnce({
        sample: {...whole, corners: whole.corners.slice(0, 27), ids: whole.ids.slice(0, 27)},
        markersSeen: 35
      })
      .mockResolvedValueOnce({
        sample: {...whole, corners: whole.corners.slice(27), ids: whole.ids.slice(27)},
        markersSeen: 35
      });
    await context.controller.start(startOptions);
    await context.controller.addSample('camera-1');
    await context.controller.addSample('camera-1');
    expect(context.controller.sampleCount('camera-1')).toBe(2);
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
    let finish: ((value: CalibrationDetection) => void) | undefined;
    captureSample.mockImplementation(
      () =>
        new Promise<CalibrationDetection>((resolve) => {
          finish = resolve;
        })
    );
    await controller.start(startOptions);
    const first = controller.addSample('camera-1');
    const second = controller.addSample('camera-1');
    expect(first).toBe(second);
    await flushMicrotasks();
    expect(captureSample).toHaveBeenCalledOnce();
    finish?.({sample: sample(0), markersSeen: 35});
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

    // Every light square needs its own marker, and DICT_4X4_50 has fifty: a
    // 10x9 board needs 55. Refused at the start, not at the first frame.
    const oversized = setup();
    await expect(
      oversized.controller.start({...startOptions, board: {...startOptions.board, columns: 10, rows: 9}})
    ).rejects.toThrow(/invalid-board: a 10x9 board needs 55 markers/u);
    expect(oversized.acquireCamera).not.toHaveBeenCalled();

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

  it('waits for a camera that has not produced its first frame yet', async () => {
    // Camera Source reports a camera as started once `play()` resolves, and
    // for a MediaStream that can land before the metadata carrying the frame
    // size. The very first look can therefore legitimately find a zero-sized
    // video. Failing there ends a session the operator just started, on a
    // camera that was about to work -- and the lease goes back, so the preview
    // goes black at the same moment.
    const context = setup();
    let looks = 0;
    context.lease.getFrameSource = vi.fn(() => {
      looks += 1;
      return looks < 3
        ? (frameSource({width: 0, height: 0}) as ReturnType<typeof frameSource>)
        : context.frame;
    });
    await context.controller.start(startOptions);
    expect(looks).toBeGreaterThanOrEqual(3);
    expect(context.controller.state('camera-1')).toBe('ready');
    expect(context.controller.errorCode('camera-1')).toBe('');
    // The size the session is fixed to must be the one the camera really has,
    // not the one it reported before it had any.
    await context.controller.addSample('camera-1');
    expect(context.controller.sampleCount('camera-1')).toBe(1);
    expect(context.release).not.toHaveBeenCalled();
  });

  it('gives up on a camera that never produces a frame, and hands it back', async () => {
    // The wait is bounded by looks as well as by the clock, so a harness whose
    // clock does not move still reaches the end of it. Runs here without real
    // delays for the same reason the shutter's tests do.
    const context = setup((callback) => {
      const handle = setTimeout(callback, 0);
      return () => {
        clearTimeout(handle);
      };
    });
    context.lease.getFrameSource = vi.fn(
      () => frameSource({width: 0, height: 0}) as ReturnType<typeof frameSource>
    );
    await expect(context.controller.start(startOptions)).rejects.toThrow(/camera-ended/u);
    expect(context.release).toHaveBeenCalledOnce();
  });

  it('records how the camera was configured, so its own profile can be judged to fit', async () => {
    // A profile without capture conditions can never be judged compatible --
    // not even with the camera it was solved on a moment ago. That was what an
    // operator saw: a fresh calibration, and "cannot be determined".
    const context = setup();
    Object.assign(context.capability, {
      conditionsFor: vi.fn(() => ({
        width: 800,
        height: 600,
        deviceId: 'device-1',
        previewFlip: 'none',
        label: 'FaceTime HD Camera',
        frameRate: 30,
        facingMode: 'user',
        resizeMode: 'none',
        focusMode: 'continuous'
      }))
    });
    await context.controller.start(startOptions);
    await fillSamples(context.controller);
    await context.controller.solve('camera-1');
    const profile = JSON.parse(context.controller.profileJson('camera-1')) as {
      capture?: Record<string, unknown>;
      device?: Record<string, unknown>;
    };
    expect(profile.capture).toEqual({
      resizeMode: 'none',
      focusMode: 'continuous',
      facingMode: 'user',
      frameRate: 30
    });
    // Members the camera did not report are left out, not guessed: absent on
    // both sides is what Camera Source counts as the same.
    expect(profile.capture).not.toHaveProperty('zoom');
    expect(profile.device).toEqual({label: 'FaceTime HD Camera', deviceId: 'device-1'});

    // And it survives being read back, which is how it reaches the next app.
    expect(context.controller.validateProfile('camera-1', JSON.stringify(profile))).toBe(true);
    await context.controller.publishProfile('camera-1');
    const published = context.registerProfile.mock.calls.at(-1)?.[0] as {
      capture?: unknown;
      device?: unknown;
    };
    expect(published.capture).toEqual(profile.capture);
    expect(published.device).toEqual(profile.device);
  });

  it('still calibrates when the camera cannot say how it is configured', async () => {
    // A footnote, not a precondition. Without it the profile is solved and
    // published as before; it simply cannot later be judged to fit.
    const context = setup();
    await context.controller.start(startOptions);
    await fillSamples(context.controller);
    await context.controller.solve('camera-1');
    const profile = JSON.parse(context.controller.profileJson('camera-1')) as object;
    expect(profile).not.toHaveProperty('capture');
    expect(context.controller.state('camera-1')).toBe('solved');
  });

  it('keeps a running session when the board arguments are invalid', async () => {
    const {controller, release} = setup();
    await controller.start(startOptions);
    await controller.addSample('camera-1');
    await expect(
      controller.start({...startOptions, board: {...startOptions.board, columns: 2}})
    ).rejects.toThrow(/invalid-board/u);
    // The session the caller already built must survive a mistyped restart.
    expect(controller.state('camera-1')).toBe('ready');
    expect(controller.sampleCount('camera-1')).toBe(1);
    expect(release).not.toHaveBeenCalled();
  });

  it('releases a lease acquired by a start that a cancel raced', async () => {
    const {controller, acquireCamera, lease, release} = setup();
    let finish: ((value: CameraLease) => void) | undefined;
    acquireCamera.mockImplementation(
      () =>
        new Promise<CameraLease>((resolve) => {
          finish = resolve;
        })
    );
    const starting = controller.start(startOptions);
    await flushMicrotasks();
    let cancelled = false;
    const cancelling = controller.cancelAll().then(() => {
      cancelled = true;
    });
    await flushMicrotasks();
    // Cancel is a barrier: it cannot report every lease released while an
    // acquisition it raced is still in flight.
    expect(cancelled).toBe(false);
    finish?.(lease);
    await cancelling;
    expect(release).toHaveBeenCalledOnce();
    await starting;
    expect(controller.state('camera-1')).toBe('idle');
  });

  it('does not repair a failed session by asking to publish', async () => {
    const {controller, lease} = setup();
    await controller.start(startOptions);
    lease.getFrameSource = vi.fn(() => {
      throw new Error('ended');
    });
    await expect(controller.addSample('camera-1')).rejects.toThrow(/camera-ended/u);
    expect(controller.state('camera-1')).toBe('error');
    await expect(controller.publishProfile('camera-1')).rejects.toThrow(/not-calibrated/u);
    expect(controller.state('camera-1')).toBe('error');
    expect(controller.ready('camera-1')).toBe(false);
  });

  it('keeps a solved profile when the publication is refused', async () => {
    const {controller, capability} = setup();
    await controller.start(startOptions);
    await fillSamples(controller);
    await controller.solve('camera-1');
    capability.version = 2;
    await expect(controller.publishProfile('camera-1')).rejects.toThrow(/api-version-mismatch/u);
    // Camera Source could not accept it, but the calibration is still solved.
    expect(controller.state('camera-1')).toBe('solved');
    expect(controller.profileJson('camera-1')).not.toBe('');
  });

  it('keeps a session diagnostic when some other profile validates', async () => {
    const {controller, solve} = setup();
    solve.mockResolvedValue({
        intrinsicMatrix: [700, 0, 400, 0, 700, 300, 0, 0, 1],
      distortionModel: 'none',
      distortionCoefficients: [],
      reprojectionErrorPx: 2
    });
    await controller.start(startOptions);
    await fillSamples(controller);
    await expect(controller.solve('camera-1')).rejects.toThrow(/reprojection-too-high/u);
    expect(controller.validateProfile('camera-1', await fixture('valid-camera-intrinsics-v1.json'))).toBe(
      true
    );
    expect(controller.errorCode('camera-1')).toBe('reprojection-too-high');
  });

  it('keys a camera by its trimmed identifier', async () => {
    const {controller} = setup();
    await controller.importProfile('  camera-1  ', await fixture('valid-camera-intrinsics-v1.json'));
    expect(controller.state('camera-1')).toBe('solved');
    expect(controller.profileJson('camera-1')).not.toBe('');
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

  it('refuses to solve a set that was never tilted', async () => {
    // Eight views of a square-on board, slid around. Every one passes the
    // novelty check, because that measures how far the corners moved. Solving
    // from them cannot separate focal length from distance, and the answer
    // would come back with a small reprojection error all the same.
    const {controller, captureSample} = setup();
    let slid = 0;
    captureSample.mockImplementation(async () => {
      const index = slid++;
      return {
        sample: {
          corners: Array.from({length: 54}, (_, corner) => ({
            x: 200 + (corner % 9) * 40 + index * 25,
            y: 150 + Math.floor(corner / 9) * 40 + index * 15
          })),
          ids: Array.from({length: 54}, (_, corner) => corner),
          quality: 0.8,
          coverage: 0.25,
          sharpness: 120
        },
        markersSeen: 35
      };
    });
    await controller.start(startOptions);
    await fillSamples(controller);
    expect(controller.sampleCount('camera-1')).toBe(8);
    // Thrown rather than rejected: solve checks what it was given before it
    // starts, the same way it refuses a set that is too small.
    expect(() => controller.solve('camera-1')).toThrowError(
      /sample-poses-degenerate/u
    );
    expect(controller.errorCode('camera-1')).toBe('sample-poses-degenerate');
    // Refused, not failed: the samples are still there and the operator can
    // tilt the board and keep going.
    expect(controller.state('camera-1')).toBe('ready');
    expect(controller.sampleCount('camera-1')).toBe(8);
  });

  it('keeps some views out of the fit and reports them separately', async () => {
    const {controller, split} = setup();
    await controller.start(startOptions);
    await fillSamples(controller);
    await controller.solve('camera-1');
    // Eight samples is the minimum to fit, so nothing can be held back
    // without weakening the fit below what the operator was promised.
    expect(split).toEqual({fitted: 8, heldOut: 0});
    expect(controller.holdoutSampleCount('camera-1')).toBe(0);
    expect(controller.latestHoldoutError('camera-1')).toBe(0);
  });

  it('holds views back once there are more than the fit needs', async () => {
    const {controller, split} = setup();
    await controller.start(startOptions);
    for (let index = 0; index < 12; index += 1) {
      await controller.addSample('camera-1');
    }
    await controller.solve('camera-1');
    // Nothing counted twice, and nothing lost.
    expect(split).toEqual({fitted: 10, heldOut: 2});
    expect(controller.holdoutSampleCount('camera-1')).toBe(2);
    expect(controller.latestHoldoutError('camera-1')).toBeCloseTo(0.52, 6);
  });

  it('forgets the holdout result when the session is cancelled', async () => {
    const {controller} = setup();
    await controller.start(startOptions);
    for (let index = 0; index < 12; index += 1) {
      await controller.addSample('camera-1');
    }
    await controller.solve('camera-1');
    expect(controller.holdoutSampleCount('camera-1')).toBe(2);
    await controller.cancel('camera-1');
    expect(controller.holdoutSampleCount('camera-1')).toBe(0);
    expect(controller.latestHoldoutError('camera-1')).toBe(0);
  });

  it('publishes a solved profile through the Camera Source contract', async () => {
    const {controller, registerProfile} = setup();
    await controller.start(startOptions);
    await fillSamples(controller);
    await controller.solve('camera-1');
    await controller.publishProfile('camera-1');
    // Not the stored profile: Camera Source owns the document contract and
    // names the pinhole parameters rather than packing them into an array.
    expect(registerProfile).toHaveBeenCalledWith({
      schema: 'twcs/camera-intrinsics',
      version: 1,
      profileId: 'calibration-1',
      cameraId: 'camera-1',
      calibratedAt: '2026-09-13T12:00:00.000Z',
      producer: 'turbowarp-camera-calibration',
      cameraModel: 'pinhole',
      image: {width: 800, height: 600, undistorted: false},
      intrinsics: {fx: 700, fy: 700, cx: 400, cy: 300, skew: 0},
      distortion: {model: 'brown-conrady', coefficients: [0.01, -0.02, 0, 0, 0]},
      quality: {sampleCount: 8, reprojectionErrorPx: 0.75}
    });
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
    mismatch.capability.version = 2;
    await expect(mismatch.controller.publishProfile('camera-1')).rejects.toThrow(
      /api-version-mismatch/u
    );
    expect(mismatch.controller.errorCode('camera-1')).toBe('api-version-mismatch');

    const legacyCameraSource = setup();
    await legacyCameraSource.controller.importProfile(
      'camera-1',
      await fixture('valid-camera-intrinsics-v1.json')
    );
    // Camera Source is loaded, but this build publishes no profile registry.
    delete legacyCameraSource.runtime.kubohiroyaCameraSourceCapability;
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

/** Eight directions to tilt the board in, so a set of samples varies. */
const TILTS = [
  [0.35, 0],
  [-0.35, 0],
  [0, 0.35],
  [0, -0.35],
  [0.25, 0.25],
  [-0.25, 0.25],
  [0.25, -0.25],
  [-0.25, -0.25]
] as const;

/**
 * A 9x6 board as a camera would see it, tilted.
 *
 * Perspective rather than a slide: the earlier version of this helper moved the
 * same square-on grid sideways, which is a set no camera can be calibrated
 * from. The controller refuses that now, and it refused this fixture -- which
 * is the point of the refusal.
 */
function sample(offset: number): CalibrationSample {
  const [gx, gy] = TILTS[offset % TILTS.length] ?? [0.35, 0];
  return {
    corners: Array.from({length: 54}, (_, index) => {
      const u = (index % 9) / 8 - 0.5;
      const v = Math.floor(index / 9) / 5 - 0.5;
      const depth = 1 + gx * u + gy * v;
      // Shifted as well as tilted, because a real operator does both and the
      // novelty check still has to see the board move.
      const shiftX = ((offset % 3) - 1) * 70;
      const shiftY = (Math.floor(offset / 3) - 1) * 50;
      return {
        x: 400 + shiftX + (320 * u) / depth,
        y: 300 + shiftY + (240 * v) / depth
      };
    }),
    ids: Array.from({length: 54}, (_, index) => index),
    quality: 0.8,
    coverage: 0.25,
    sharpness: 120
  };
}

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`fixtures/calibration/${name}`, import.meta.url), 'utf8');
}
