// SPDX-License-Identifier: MPL-2.0
/**
 * The camera side of the solver, which stays on the main thread.
 *
 * It owns the worker, reads frames from the video element the worker cannot
 * touch, and hands the bytes across. Everything that needs OpenCV is on the
 * other side of this file.
 */
import {transfer, wrap, type Remote} from 'comlink';
import OpenCvWorker from './opencv-worker.js?worker&inline';
import type {OpenCvChessboardCalibration} from './opencv-backend.js';
// The name only: importing a value from that module would pull OpenCV back
// onto this thread, which is the whole thing this file exists to prevent.
import {OPENCV_BACKEND_NAME} from './opencv-symbols.js';
import type {
  BoardPoseSolution,
  CalibrationBackendFactory,
  CalibrationBackendPort,
  CalibrationBoard,
  CalibrationDetection,
  CalibrationFrame,
  CalibrationSample,
  CalibrationSolveResult
} from './types.js';

/**
 * How long one call may go unanswered before the worker is presumed gone.
 *
 * Generous, because the first call also evaluates and starts OpenCV, and a
 * solve over forty views on a slow machine takes seconds. The limit is not
 * there to hurry a slow worker; it is there because a worker that died -- out
 * of memory in WebAssembly, or never loaded -- answers nothing at all, and
 * every caller waiting on it would wait for ever. That includes a cancel, and
 * the project stop that runs one.
 */
export const WORKER_CALL_TIMEOUT_MS = 120_000;

/** The worker stopped answering, as opposed to answering with an error. */
export class WorkerUnavailableError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkerUnavailableError';
  }
}

export interface WorkerCalibrationBackendOptions {
  /** Starts the worker. Injected so tests can stand in a worker that never answers. */
  createWorker?: () => Worker;
  timeoutMs?: number;
}

export class WorkerCalibrationBackend implements CalibrationBackendPort {
  public readonly name = OPENCV_BACKEND_NAME;

  private worker: Worker | undefined;
  private remote: Remote<OpenCvChessboardCalibration> | undefined;
  /** Rejects when the worker reports it can no longer run. Never resolves. */
  private lost: Promise<never> | undefined;
  private loseWorker: ((reason: WorkerUnavailableError) => void) | undefined;
  private canvas: HTMLCanvasElement | undefined;
  private readonly createWorker: () => Worker;
  private readonly timeoutMs: number;

  public constructor(options: WorkerCalibrationBackendOptions = {}) {
    this.createWorker = options.createWorker ?? (() => new OpenCvWorker());
    this.timeoutMs = options.timeoutMs ?? WORKER_CALL_TIMEOUT_MS;
  }

  public async captureSample(
    frame: CalibrationFrame,
    board: CalibrationBoard
  ): Promise<CalibrationDetection> {
    const pixels = this.readFrame(frame);
    // The buffer is handed over rather than copied. Nothing here reads it
    // again, and a frame is megabytes: copying one per sample is a cost paid
    // on the thread the operator is watching.
    return this.call((solver) =>
      solver.captureSample(transfer(pixels, [pixels.data.buffer]), board)
    );
  }

  public async measurePose(
    frame: CalibrationFrame,
    board: CalibrationBoard,
    solution: CalibrationSolveResult
  ): Promise<BoardPoseSolution | undefined> {
    const pixels = this.readFrame(frame);
    return this.call((solver) =>
      solver.measurePose(transfer(pixels, [pixels.data.buffer]), board, solution)
    );
  }

  public async solve(
    samples: readonly CalibrationSample[],
    board: CalibrationBoard,
    imageWidth: number,
    imageHeight: number
  ): Promise<CalibrationSolveResult> {
    return this.call((solver) => solver.solve(samples, board, imageWidth, imageHeight));
  }

  public async validate(
    samples: readonly CalibrationSample[],
    board: CalibrationBoard,
    solution: CalibrationSolveResult
  ): Promise<number> {
    return this.call((solver) => solver.validate(samples, board, solution));
  }

  /**
   * Ends the worker. The next call starts a new one.
   *
   * Calls still waiting on it fail now: a terminated worker answers nothing,
   * and they would otherwise wait out the deadline.
   */
  public dispose(): void {
    this.loseWorker?.(new WorkerUnavailableError('The OpenCV worker was stopped.'));
    this.loseWorker = undefined;
    this.worker?.terminate();
    this.worker = undefined;
    this.remote = undefined;
    this.lost = undefined;
    this.canvas = undefined;
  }

  /**
   * Makes one call, and gives up on a worker that cannot answer it.
   *
   * Comlink settles a call only when the worker replies. A worker that failed
   * to load or died replies to nothing, so the call is raced against the
   * worker's own error events and a deadline. Losing either race ends that
   * worker, so the next call starts a working one instead of queueing behind
   * a dead one. An error the solver itself throws is an answer, and leaves the
   * worker running.
   */
  private async call<T>(run: (solver: Remote<OpenCvChessboardCalibration>) => Promise<T>): Promise<T> {
    const solver = this.solver();
    const worker = this.worker;
    const lost = this.lost as Promise<never>;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new WorkerUnavailableError(
            `The OpenCV worker did not answer within ${this.timeoutMs} ms.`
          )
        );
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([run(solver), lost, deadline]);
    } catch (error) {
      if (error instanceof WorkerUnavailableError && this.worker === worker) this.dispose();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private solver(): Remote<OpenCvChessboardCalibration> {
    if (!this.remote) {
      const worker = this.createWorker();
      this.worker = worker;
      this.lost = new Promise<never>((_, reject) => {
        this.loseWorker = reject;
        const fail = (event: Event) => {
          const message = (event as Partial<ErrorEvent>).message;
          const detail = typeof message === 'string' && message ? `: ${message}` : '';
          reject(new WorkerUnavailableError(`The OpenCV worker stopped (${event.type})${detail}.`));
          // Ended now, not when a call next notices. A worker that failed with
          // nothing waiting on it would otherwise fail that next call too.
          // Calls already waiting have been answered by the rejection above.
          if (this.worker === worker) this.dispose();
        };
        worker.addEventListener('error', fail, {once: true});
        worker.addEventListener('messageerror', fail, {once: true});
      });
      // Observed by every call; nothing is lost when no call is waiting.
      this.lost.catch(() => undefined);
      this.remote = wrap<OpenCvChessboardCalibration>(worker);
    }
    return this.remote;
  }

  /**
   * Copies the current video frame out of the element.
   *
   * One canvas is kept and resized rather than made per sample: allocating a
   * megapixel canvas for every capture is work on the thread that is drawing
   * the preview, which is the thread this class exists to keep free.
   */
  private readFrame(frame: CalibrationFrame): {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  } {
    this.canvas ??= document.createElement('canvas');
    this.canvas.width = frame.width;
    this.canvas.height = frame.height;
    const context = this.canvas.getContext('2d', {willReadFrequently: true});
    if (!context) throw new Error('A 2D canvas context is unavailable.');
    context.drawImage(frame.element, 0, 0, frame.width, frame.height);
    const image = context.getImageData(0, 0, frame.width, frame.height);
    return {width: image.width, height: image.height, data: image.data};
  }
}

/** Creates the solver on first use, and never at load time. */
export const openCvBackendFactory: CalibrationBackendFactory = {
  name: OPENCV_BACKEND_NAME,
  async create(): Promise<CalibrationBackendPort> {
    return new WorkerCalibrationBackend();
  }
};
