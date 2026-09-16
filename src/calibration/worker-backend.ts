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
  CalibrationFrame,
  CalibrationSample,
  CalibrationSolveResult
} from './types.js';

export class WorkerCalibrationBackend implements CalibrationBackendPort {
  public readonly name = OPENCV_BACKEND_NAME;

  private worker: Worker | undefined;
  private remote: Remote<OpenCvChessboardCalibration> | undefined;
  private canvas: HTMLCanvasElement | undefined;

  public async captureSample(
    frame: CalibrationFrame,
    board: CalibrationBoard
  ): Promise<CalibrationSample | undefined> {
    const pixels = this.readFrame(frame);
    // The buffer is handed over rather than copied. Nothing here reads it
    // again, and a frame is megabytes: copying one per sample is a cost paid
    // on the thread the operator is watching.
    return this.solver().captureSample(
      transfer(pixels, [pixels.data.buffer]),
      board
    );
  }

  public async measurePose(
    frame: CalibrationFrame,
    board: CalibrationBoard,
    solution: CalibrationSolveResult
  ): Promise<BoardPoseSolution | undefined> {
    const pixels = this.readFrame(frame);
    return this.solver().measurePose(
      transfer(pixels, [pixels.data.buffer]),
      board,
      solution
    );
  }

  public async solve(
    samples: readonly CalibrationSample[],
    board: CalibrationBoard,
    imageWidth: number,
    imageHeight: number
  ): Promise<CalibrationSolveResult> {
    return this.solver().solve(samples, board, imageWidth, imageHeight);
  }

  public async validate(
    samples: readonly CalibrationSample[],
    board: CalibrationBoard,
    solution: CalibrationSolveResult
  ): Promise<number> {
    return this.solver().validate(samples, board, solution);
  }

  /** Ends the worker. The next call starts a new one. */
  public dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.remote = undefined;
    this.canvas = undefined;
  }

  private solver(): Remote<OpenCvChessboardCalibration> {
    if (!this.remote) {
      const worker = new OpenCvWorker();
      this.worker = worker;
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
