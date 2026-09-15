/** A printed chessboard target, measured by its inner corner grid. */
export interface CalibrationBoard {
  columns: number;
  rows: number;
  squareSizeMeters: number;
}

/** One still image taken from the leased camera. */
export interface CalibrationFrame {
  element: HTMLVideoElement;
  width: number;
  height: number;
}

export interface CalibrationCorner {
  x: number;
  y: number;
}

/** One accepted board view, kept until the session solves or is cancelled. */
export interface CalibrationSample {
  corners: CalibrationCorner[];
  quality: number;
  coverage: number;
  sharpness: number;
}

/**
 * Distortion models this extension can produce and validate, named after the
 * OpenCV coefficient layouts. The coefficient count identifies the model.
 */
export type DistortionModel =
  | 'none'
  | 'opencv-plumb-bob'
  | 'opencv-rational'
  | 'opencv-thin-prism'
  | 'opencv-tilted';

/** Coefficient counts OpenCV emits for each supported distortion model. */
export const DISTORTION_COEFFICIENT_COUNTS: Readonly<Record<DistortionModel, readonly number[]>> =
  Object.freeze({
    'none': [0],
    'opencv-plumb-bob': [4, 5],
    'opencv-rational': [8],
    'opencv-thin-prism': [12],
    'opencv-tilted': [14]
  });

/**
 * The intrinsic solution. External pose is deliberately absent: this extension
 * calibrates one camera's optics and never reports where that camera stands.
 */
export interface CalibrationSolveResult {
  intrinsicMatrix: number[];
  distortionModel: DistortionModel;
  distortionCoefficients: number[];
  reprojectionErrorPx: number;
}

/**
 * The solver seam. Everything above this interface is arithmetic-free control
 * flow, so tests drive the whole procedure without loading OpenCV.
 */
export interface CalibrationBackendPort {
  readonly name: string;
  captureSample(
    frame: CalibrationFrame,
    board: CalibrationBoard
  ): Promise<CalibrationSample | undefined>;
  solve(
    samples: readonly CalibrationSample[],
    board: CalibrationBoard,
    imageWidth: number,
    imageHeight: number
  ): Promise<CalibrationSolveResult>;
}

/**
 * Creates the solver on first use. The name is available without creating it so
 * that the backend reporter never loads the OpenCV runtime.
 */
export interface CalibrationBackendFactory {
  readonly name: string;
  create(): Promise<CalibrationBackendPort>;
}
