// SPDX-License-Identifier: MPL-2.0
/**
 * The arithmetic the solver reports with, kept free of OpenCV so it can be
 * checked without loading eleven megabytes of it.
 */
import type {CalibrationCorner} from './types.js';

/**
 * RMS reprojection error over held-out views, corrected for the pose each one
 * was given.
 *
 * Every held-out view has its pose fitted before its corners are predicted --
 * six parameters from the corners being scored. Those parameters absorb part of
 * whatever the intrinsics got wrong, and they absorb more the fewer corners a
 * view has: a view of six corners gives twelve measurements to a six-parameter
 * fit, which leaves half the error behind. Divided by the corners alone, the
 * result reads better than the calibration is, most of all for the partial
 * views a ChArUco board is meant to allow.
 *
 * Each corner is two measurements and each pose six, so a pose costs three
 * corners' worth. Dividing by what is left is the usual unbiased estimate.
 */
export function heldOutRms(squared: number, corners: number, views: number): number {
  if (corners <= 0) return 0;
  const remaining = corners - 3 * views;
  return Math.sqrt(squared / (remaining > 0 ? remaining : corners));
}

/** The smallest axis-aligned box around the corners, in whole pixels, inside the image. */
export interface PixelRegion {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export function cornerRegion(
  corners: readonly CalibrationCorner[],
  width: number,
  height: number
): PixelRegion {
  const xs = corners.map(({x}) => x);
  const ys = corners.map(({y}) => y);
  return {
    left: Math.max(0, Math.floor(Math.min(...xs))),
    top: Math.max(0, Math.floor(Math.min(...ys))),
    right: Math.min(width, Math.ceil(Math.max(...xs)) + 1),
    bottom: Math.min(height, Math.ceil(Math.max(...ys)) + 1)
  };
}

/**
 * Variance of a single-channel image over a region, row-major with `columns` per row.
 *
 * Used on the Laplacian, where it is the usual focus measure. Over the whole
 * frame it measures the scene: a sharp background passes a blurred board. The
 * corners are what the solve uses, so the region they span is what is measured.
 */
export function regionVariance(
  values: ArrayLike<number>,
  columns: number,
  region: PixelRegion
): number {
  let count = 0;
  let sum = 0;
  let squares = 0;
  for (let row = region.top; row < region.bottom; row += 1) {
    const offset = row * columns;
    for (let column = region.left; column < region.right; column += 1) {
      const value = values[offset + column] ?? 0;
      sum += value;
      squares += value * value;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const average = sum / count;
  return Math.max(0, squares / count - average * average);
}

/**
 * Makes an OpenCV failure say what failed.
 *
 * The WebAssembly build throws a C++ exception as a bare number -- the address
 * of the exception object -- and carries nothing to read its message with. As
 * it stood, an operator was shown `solve-failed: 5251440`. The address still
 * says nothing, but the operation it happened in does.
 */
export function describeOpenCvFailure(operation: string, error: unknown): unknown {
  if (typeof error !== 'number') return error;
  return new Error(
    `OpenCV failed while ${operation} (C++ exception at 0x${error.toString(16)}; this build carries no message for it).`
  );
}
