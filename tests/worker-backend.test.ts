import {describe, expect, it, vi} from 'vitest';
import {
  WorkerCalibrationBackend,
  WorkerUnavailableError
} from '../src/calibration/worker-backend.js';
import type {CalibrationSolveResult} from '../src/calibration/types.js';

const BOARD = {columns: 9, rows: 6, squareSizeMeters: 0.025, markerSizeMeters: 0.018};

const SOLUTION: CalibrationSolveResult = {
  intrinsicMatrix: [700, 0, 400, 0, 700, 300, 0, 0, 1],
  distortionModel: 'none',
  distortionCoefficients: [],
  reprojectionErrorPx: 0.5
};

/** A worker that takes every message and answers none, as a dead one does. */
class SilentWorker extends EventTarget {
  public readonly terminate = vi.fn();
  public postMessage(): void {}
  public start(): void {}
}

function setup(timeoutMs = 20) {
  const workers: SilentWorker[] = [];
  const backend = new WorkerCalibrationBackend({
    createWorker: () => {
      const worker = new SilentWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
    timeoutMs
  });
  return {backend, workers};
}

describe('the worker the solver runs on', () => {
  it('gives up on a worker that never answers, and starts a new one next time', async () => {
    // Comlink settles a call only when the worker replies. Without a deadline
    // a dead worker holds every caller for ever -- including the cancel a
    // project stop runs.
    const {backend, workers} = setup();
    await expect(backend.validate([], BOARD, SOLUTION)).rejects.toBeInstanceOf(
      WorkerUnavailableError
    );
    expect(workers).toHaveLength(1);
    expect(workers[0]?.terminate).toHaveBeenCalledOnce();

    await expect(backend.validate([], BOARD, SOLUTION)).rejects.toThrow(/did not answer/u);
    expect(workers).toHaveLength(2);
  });

  it('fails the call as soon as the worker reports it cannot run', async () => {
    const {backend, workers} = setup(60_000);
    const pending = backend.validate([], BOARD, SOLUTION);
    workers[0]?.dispatchEvent(new Event('error'));
    await expect(pending).rejects.toThrow(/stopped \(error\)/u);
    expect(workers[0]?.terminate).toHaveBeenCalledOnce();
  });

  it('ends the worker when disposed, failing the calls still waiting on it', async () => {
    const {backend, workers} = setup(60_000);
    const pending = backend.validate([], BOARD, SOLUTION);
    backend.dispose();
    await expect(pending).rejects.toThrow(/was stopped/u);
    expect(workers[0]?.terminate).toHaveBeenCalledOnce();
  });
});
