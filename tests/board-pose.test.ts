import {describe, expect, it, vi} from 'vitest';
import {CameraCalibrationController} from '../src/calibration/controller.js';
import type {
  BoardPoseSolution,
  CalibrationBackendPort,
  CalibrationSample,
  CalibrationSolveResult
} from '../src/calibration/types.js';

const BOARD = {columns: 9, rows: 6, squareSizeMeters: 0.025, markerSizeMeters: 0.018};

// Absence is null, not undefined: passing undefined to a defaulted parameter
// takes the default, so `setup(undefined)` would quietly mean "found it".
function setup(pose: BoardPoseSolution | null = samplePose()) {
  const release = vi.fn(async () => undefined);
  const frame = {
    kind: 'video',
    element: {} as HTMLVideoElement,
    width: 1280,
    height: 720,
    previewFlip: 'none',
    deviceId: 'device-1'
  };
  const lease = {getFrameSource: () => frame, release};
  const acquireCamera = vi.fn(async () => lease);
  const measurePose = vi.fn(async () => pose ?? undefined);
  const backend: CalibrationBackendPort = {
    name: 'mock-calibration-backend',
    captureSample: vi.fn(async (): Promise<CalibrationSample | undefined> => undefined),
    solve: vi.fn(async (): Promise<CalibrationSolveResult> => {
      throw new Error('not used');
    }),
    validate: vi.fn(async () => 0),
    measurePose
  };
  const runtime: TurboWarpRuntime = {
    ext_kubohiroyacamerasource: {acquireCamera},
    kubohiroyaCameraSourceCapability: {
      version: 1,
      requireVersion: () => undefined,
      registerProfile: () => ({ok: true as const})
    }
  };
  const controller = new CameraCalibrationController({
    runtime,
    backend: {name: 'mock-calibration-backend', create: async () => backend},
    nowMilliseconds: () => Date.parse('2026-09-16T12:00:00Z')
  });
  return {controller, measurePose, release, acquireCamera};
}

function samplePose(): BoardPoseSolution {
  return {
    rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    translationMeters: [0.01, -0.02, 0.4],
    cornerCount: 54,
    reprojectionErrorPx: 0.21,
    observedPoints: [
      {id: 0, u: 100, v: 120},
      {id: 1, u: 140, v: 121}
    ]
  };
}

const PROFILE = JSON.stringify({
  schema: 'camerasource/camera-intrinsics',
  version: 1,
  calibrationId: 'calibration-1',
  cameraId: 'camera-1',
  cameraModel: 'pinhole',
  imageWidth: 1280,
  imageHeight: 720,
  imageState: 'raw',
  intrinsicMatrix: [700, 0, 640, 0, 700, 360, 0, 0, 1],
  distortionModel: 'opencv-plumb-bob',
  distortionCoefficients: [0.01, -0.02, 0, 0, 0],
  calibratedAt: '2026-09-13T12:00:00.000Z'
});

describe('measuring where the board is', () => {
  it('refuses before there is a calibration to measure with', async () => {
    // A pose is the board seen through known optics. Without them there is
    // nothing to see it through, and a guess would be a number that looks like
    // a measurement.
    const {controller, acquireCamera} = setup();
    await expect(
      controller.measureBoardPose({cameraId: 'camera-1', board: BOARD, scaleSource: 'nominal'})
    ).rejects.toThrow(/not-calibrated/u);
    expect(acquireCamera).not.toHaveBeenCalled();
  });

  it('takes a camera and gives it straight back', async () => {
    // Not a session. A calibration needs the board to move, so this cannot be
    // part of one -- and holding a shared camera open afterwards would strand
    // it for every other consumer.
    const {controller, release} = setup();
    await controller.importProfile('camera-1', PROFILE);
    await controller.measureBoardPose({cameraId: 'camera-1', board: BOARD, scaleSource: 'measured'});
    expect(release).toHaveBeenCalledTimes(1);
    expect(controller.state('camera-1')).toBe('solved');
  });

  it('records the pose against the profile it was measured with', async () => {
    const {controller} = setup();
    await controller.importProfile('camera-1', PROFILE);
    await controller.measureBoardPose({cameraId: 'camera-1', board: BOARD, scaleSource: 'measured'});
    const pose = JSON.parse(controller.boardPoseJson('camera-1')) as Record<string, unknown>;
    expect(pose.schema).toBe('twcc/board-pose');
    expect(pose.cameraId).toBe('camera-1');
    // Which optics the pixels were read through. Without it the pose is a
    // number with no way to check what produced it.
    expect(pose.intrinsicProfileId).toBe('calibration-1');
    expect(pose.cameraFromBoard).toEqual({
      rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      translationMeters: [0.01, -0.02, 0.4]
    });
  });

  it('carries where the scale came from', async () => {
    // The one field a reader cannot reconstruct. Scale comes entirely from the
    // declared square size, and a pose measured against a square nobody put a
    // ruler to is right in direction and wrong in scale -- which the
    // reprojection error does not show.
    for (const source of ['measured', 'nominal'] as const) {
      const {controller} = setup();
      await controller.importProfile('camera-1', PROFILE);
      await controller.measureBoardPose({cameraId: 'camera-1', board: BOARD, scaleSource: source});
      const pose = JSON.parse(controller.boardPoseJson('camera-1')) as {scaleSource: string};
      expect(pose.scaleSource).toBe(source);
    }
  });

  it('carries the corners it saw, so the measurement can be re-solved elsewhere', async () => {
    const {controller} = setup();
    await controller.importProfile('camera-1', PROFILE);
    await controller.measureBoardPose({cameraId: 'camera-1', board: BOARD, scaleSource: 'nominal'});
    const pose = JSON.parse(controller.boardPoseJson('camera-1')) as {
      observedPoints: Array<{id: number; u: number; v: number}>;
      imageWidth: number;
    };
    expect(pose.observedPoints[0]).toEqual({id: 0, u: 100, v: 120});
    expect(pose.imageWidth).toBe(1280);
  });

  it('reports a board that is not in frame as such, and frees the camera', async () => {
    const {controller, release} = setup(null);
    await controller.importProfile('camera-1', PROFILE);
    await expect(
      controller.measureBoardPose({cameraId: 'camera-1', board: BOARD, scaleSource: 'nominal'})
    ).rejects.toThrow(/board-pose-unavailable/u);
    expect(release).toHaveBeenCalledTimes(1);
    expect(controller.boardPoseJson('camera-1')).toBe('');
  });

  it('refuses a board description it cannot use', async () => {
    const {controller} = setup();
    await controller.importProfile('camera-1', PROFILE);
    await expect(
      controller.measureBoardPose({
        cameraId: 'camera-1',
        board: {...BOARD, markerSizeMeters: BOARD.squareSizeMeters},
        scaleSource: 'nominal'
      })
    ).rejects.toThrow(/marker size/u);
  });

  it('forgets the pose when the camera is cleaned up', async () => {
    const {controller} = setup();
    await controller.importProfile('camera-1', PROFILE);
    await controller.measureBoardPose({cameraId: 'camera-1', board: BOARD, scaleSource: 'nominal'});
    expect(controller.boardPoseJson('camera-1')).not.toBe('');
    await controller.cleanup('camera-1');
    expect(controller.boardPoseJson('camera-1')).toBe('');
  });
});
