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

