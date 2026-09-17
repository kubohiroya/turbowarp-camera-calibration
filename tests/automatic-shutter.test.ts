import {describe, expect, it, vi} from 'vitest';
import {
  CameraCalibrationController,
  type CalibrationScheduler
} from '../src/calibration/controller.js';
import type {
  CalibrationBackendPort,
  CalibrationSample,
  CalibrationSolveResult
} from '../src/calibration/types.js';
import type {CameraFrameSource, CameraLease} from '../src/calibration/camera-source.js';

const CAMERA = 'camera-1';

const startOptions = {
  cameraId: CAMERA,
  calibrationId: 'calibration-1',
  board: {columns: 9, rows: 6, squareSizeMeters: 0.025, markerSizeMeters: 0.018},
  maximumReprojectionErrorPx: 1.5
};

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

/** A 9x6 board as a camera tilted by `offset` would see it. */
function sample(offset: number, tilted = true): CalibrationSample {
  const [gx, gy] = tilted ? (TILTS[offset % TILTS.length] ?? [0.35, 0]) : [0.35, 0];
  return {
    corners: Array.from({length: 54}, (_, index) => {
      const u = (index % 9) / 8 - 0.5;
      const v = Math.floor(index / 9) / 5 - 0.5;
      const depth = 1 + gx * u + gy * v;
      const shiftX = ((offset % 5) - 2) * 60;
      const shiftY = (Math.floor(offset / 5) - 2) * 45;
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

/**
 * The scheduler the shutter runs on, driven by hand.
 *
 * A real timer would make every one of these tests a wait, and the thing under
 * test is what each look at the camera decides -- not how long the gap between
 * them is.
 */
function manualScheduler() {
  let pending: Array<() => void> = [];
  const schedule: CalibrationScheduler = (callback) => {
    pending.push(callback);
    return () => {
      pending = pending.filter((entry) => entry !== callback);
    };
  };
  return {
    schedule,
    waiting: () => pending.length,
    /** Runs `times` looks at the camera, settling each before the next. */
    async run(times: number): Promise<void> {
      for (let index = 0; index < times; index += 1) {
        const next = pending.shift();
        if (!next) return;
        next();
        for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
      }
    }
  };
}

interface Options {
  /** What the detector finds, by frame number. Undefined means nothing found. */
  readonly detect?: (index: number) => CalibrationSample | undefined;
  /** Markers reported when no board came out of the frame. */
  readonly markersSeen?: number;
  readonly holdoutError?: number;
  readonly reprojectionErrorPx?: number;
}

function setup(options: Options = {}) {
  const frame = {
    kind: 'video',
    element: {} as HTMLVideoElement,
    width: 800,
    height: 600,
    previewFlip: 'none',
    deviceId: 'device-1'
  } as CameraFrameSource;
  const release = vi.fn(async () => undefined);
  const lease: CameraLease = {getFrameSource: vi.fn(() => frame), release};
  let frameIndex = 0;
  const detect = options.detect ?? ((index: number) => sample(index));
  const captureSample = vi.fn(async () => {
    const sample = detect(frameIndex++);
    // Markers only when a board came out of it, unless a test says otherwise:
    // these fixtures stand for an empty frame, not for another board.
    return {sample, markersSeen: sample ? 35 : (options.markersSeen ?? 0)};
  });
  const solve = vi.fn(
    async (): Promise<CalibrationSolveResult> => ({
      intrinsicMatrix: [700, 0, 400, 0, 700, 300, 0, 0, 1],
      distortionModel: 'opencv-plumb-bob',
      distortionCoefficients: [0.01, -0.02, 0, 0, 0],
      reprojectionErrorPx: options.reprojectionErrorPx ?? 0.75
    })
  );
  const validate = vi.fn(async (held: readonly CalibrationSample[]) =>
    held.length === 0 ? 0 : (options.holdoutError ?? 0.6)
  );
  const backend: CalibrationBackendPort = {
    name: 'mock-calibration-backend',
    captureSample,
    solve,
    validate,
    measurePose: vi.fn(async () => undefined)
  };
  const capability = {
    version: 1,
    requireVersion: vi.fn(() => capability),
    registerProfile: vi.fn((document: unknown) => ({ok: true as const, profile: document}))
  };
  const runtime: TurboWarpRuntime = {
    ext_kubohiroyacamerasource: {acquireCamera: vi.fn(async () => lease)},
    kubohiroyaCameraSourceCapability: capability
  };
  const clock = manualScheduler();
  const controller = new CameraCalibrationController({
    runtime,
    backend: {name: 'mock-calibration-backend', create: async () => backend},
    nowMilliseconds: () => Date.parse('2026-09-16T12:00:00Z'),
    schedule: clock.schedule
  });
  return {controller, clock, release, solve, validate, captureSample};
}

async function started(options: Options = {}) {
  const context = setup(options);
  await context.controller.start(startOptions);
  context.controller.setAutomatic(CAMERA, true);
  return context;
}

describe('the automatic shutter', () => {
  it('is not watching until a session gives it something to watch', () => {
    const {controller, clock} = setup();
    controller.setAutomatic(CAMERA, true);
    expect(controller.automatic(CAMERA)).toBe(false);
    expect(clock.waiting()).toBe(0);
  });

  it('collects without being asked, once per look', async () => {
    const {controller, clock} = await started();
    expect(controller.automatic(CAMERA)).toBe(true);
    await clock.run(3);
    expect(controller.sampleCount(CAMERA)).toBe(3);
  });

  it('does not record an error for a frame it declines', async () => {
    // The whole reason the automatic path exists separately. Most frames are
    // declined -- the board is between two useful positions -- and recording
    // those as errors would leave an error showing for nearly the whole
    // session, which reads the same as showing none.
    const {controller, clock} = await started({detect: () => undefined});
    await clock.run(4);
    expect(controller.errorCode(CAMERA)).toBe('');
    expect(controller.sampleCount(CAMERA)).toBe(0);
    expect(controller.guidance(CAMERA)).toBe('show-the-board');
    expect(controller.state(CAMERA)).toBe('ready');
  });

  it('keeps the session out of the sampling state while it watches', async () => {
    // A project shows `sampling` as work in progress. The shutter looks four
    // times a second: a session that flickered between the two would be
    // reporting the mechanism rather than the session.
    const {controller, clock} = await started();
    await clock.run(2);
    expect(controller.state(CAMERA)).toBe('ready');
  });

  it('says the board is the wrong one, rather than asking for a board', async () => {
    // All three boards draw markers from one dictionary numbered from zero, so
    // holding the wrong sheet puts plenty of valid markers in frame and
    // produces no corners at all -- the same nothing as an empty frame. Told
    // to show the board while holding one, an operator has no reason to think
    // anything but that the camera is broken.
    const {controller, clock} = await started({detect: () => undefined, markersSeen: 24});
    await clock.run(2);
    expect(controller.guidance(CAMERA)).toBe('wrong-board');
    expect(controller.errorCode(CAMERA)).toBe('');
    expect(controller.sampleCount(CAMERA)).toBe(0);
  });

  it('still asks for a board when the frame holds nothing at all', async () => {
    const {controller, clock} = await started({detect: () => undefined, markersSeen: 0});
    await clock.run(2);
    expect(controller.guidance(CAMERA)).toBe('show-the-board');
  });

  it('tells the operator to hold still when the view is found but poor', async () => {
    const {controller, clock} = await started({
      detect: (index) => ({...sample(index), quality: 0.01})
    });
    await clock.run(2);
    expect(controller.guidance(CAMERA)).toBe('hold-steadier');
    expect(controller.errorCode(CAMERA)).toBe('');
  });

  it('asks for movement when the board has not moved', async () => {
    const {controller, clock} = await started({detect: () => sample(0)});
    await clock.run(3);
    expect(controller.sampleCount(CAMERA)).toBe(1);
    expect(controller.guidance(CAMERA)).toBe('move-or-tilt');
  });

  it('asks for a tilt, which moving sideways does not answer', async () => {
    // Distinct from move-or-tilt: these views are all novel, and the set is
    // still one a calibration cannot come out of, because focal length and
    // distance stay inseparable until the board is turned.
    const {controller, clock} = await started({detect: (index) => sample(index, false)});
    await clock.run(14);
    expect(controller.sampleCount(CAMERA)).toBeGreaterThanOrEqual(12);
    expect(controller.guidance(CAMERA)).toBe('tilt-more');
    expect(controller.state(CAMERA)).toBe('ready');
  });

  it('solves in the background and ends the session once the answer holds up', async () => {
    const {controller, clock, release, solve, validate} = await started();
    await clock.run(14);
    expect(solve).toHaveBeenCalled();
    expect(validate).toHaveBeenCalled();
    expect(controller.state(CAMERA)).toBe('solved');
    expect(controller.guidance(CAMERA)).toBe('complete');
    expect(controller.automatic(CAMERA)).toBe(false);
    expect(release).toHaveBeenCalled();
    expect(controller.profileJson(CAMERA)).toContain('camerasource/camera-intrinsics');
    // Nothing left scheduled: a session that ended must stop costing frames.
    expect(clock.waiting()).toBe(0);
  });

  it('will not finish on the fit error alone, and says which number failed', async () => {
    // An overfitted answer reproduces the views it was made from. Held-out
    // views are what say whether it predicts anything else, and a session that
    // ended on the fit error would end exactly when the set was too small.
    //
    // The guidance separates the two failures because they ask for different
    // things: a fit that cannot reproduce its own views wants more views, and
    // one that reproduces its own and nothing else wants different ones. The
    // second is the case here, and telling the operator to carry on would be
    // telling them to do the thing that is not working.
    const {controller, clock, solve} = await started({holdoutError: 9});
    await clock.run(16);
    expect(solve).toHaveBeenCalled();
    expect(controller.state(CAMERA)).toBe('ready');
    expect(controller.automatic(CAMERA)).toBe(true);
    expect(controller.guidance(CAMERA)).toBe('vary-more');
    expect(controller.latestHoldoutError(CAMERA)).toBe(9);
  });

  it('keeps watching at the sample limit, making room instead of stopping', async () => {
    // A shutter that stops because it has looked forty times gives up on an
    // operator who is still holding the board -- and the set it leaves behind
    // is the one it already could not solve from. The next tilted view is
    // worth more than the dullest of the forty.
    const {controller, clock} = await started({holdoutError: 9});
    await clock.run(120);
    expect(controller.sampleCount(CAMERA)).toBe(40);
    expect(controller.automatic(CAMERA)).toBe(true);
    expect(controller.errorCode(CAMERA)).toBe('');
    // Nothing anywhere says the shutter gave up, because it did not.
    expect(controller.guidance(CAMERA)).not.toBe('limit-reached');
  });

  it('holds the answer against views it was not fitted to', async () => {
    const {controller, clock} = await started();
    await clock.run(14);
    expect(controller.holdoutSampleCount(CAMERA)).toBeGreaterThan(0);
  });

  it('stops watching when the operator takes the shutter back', async () => {
    const {controller, clock} = await started();
    await clock.run(2);
    controller.setAutomatic(CAMERA, false);
    expect(controller.automatic(CAMERA)).toBe(false);
    expect(controller.guidance(CAMERA)).toBe('');
    expect(clock.waiting()).toBe(0);
    const collected = controller.sampleCount(CAMERA);
    // The session survives: what was collected is still there to solve by hand.
    expect(controller.ready(CAMERA)).toBe(true);
    await controller.addSample(CAMERA);
    expect(controller.sampleCount(CAMERA)).toBe(collected + 1);
  });

  it('stops watching when the session is cancelled', async () => {
    const {controller, clock} = await started();
    await clock.run(2);
    await controller.cancel(CAMERA);
    expect(controller.automatic(CAMERA)).toBe(false);
    expect(clock.waiting()).toBe(0);
  });

  it('refuses a bad view out loud when a person asked for it', async () => {
    // The automatic path's quietness must not leak into the manual one: a
    // person who pressed a button is owed an answer to that press.
    const {controller} = setup({detect: () => undefined});
    await controller.start(startOptions);
    await expect(controller.addSample(CAMERA)).rejects.toThrowError(/board-not-found/u);
    expect(controller.errorCode(CAMERA)).toBe('board-not-found');
  });

  it('names the wrong board in the refusal a person asked for', async () => {
    const {controller} = setup({detect: () => undefined, markersSeen: 24});
    await controller.start(startOptions);
    await expect(controller.addSample(CAMERA)).rejects.toThrowError(/wrong-board/u);
    expect(controller.errorCode(CAMERA)).toBe('wrong-board');
    // The board it was looking for, so the operator knows which sheet to find.
    expect(controller.errorMessage(CAMERA)).toContain('9x6');
    expect(controller.errorMessage(CAMERA)).toContain('24 markers');
  });
});
