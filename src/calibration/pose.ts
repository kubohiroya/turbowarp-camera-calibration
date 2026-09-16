import type {CalibrationBoard, CalibrationCorner, CalibrationSample} from './types.js';

/**
 * How obliquely a board was seen, without knowing the camera.
 *
 * Intrinsic calibration needs views from different directions. Every view gives
 * two constraints on the intrinsics, but views that share an orientation give
 * the same two: with only fronto-parallel samples, focal length and distance
 * cannot be separated, because a small board seen close and a large board seen
 * far away produce the same image. Tilt is what breaks that.
 *
 * The board's own novelty check cannot see this. It measures how far the
 * corners moved, which a pure sideways slide changes as much as a tilt does --
 * so a set collected without ever tilting the board passes it, solves, and
 * reports a small reprojection error for a calibration that is wrong.
 *
 * Measured from the outer quad alone, as the log ratio of opposite edge
 * lengths. Under perspective the nearer edge is longer; seen square on, both
 * pairs are equal and this is zero. Logs because the measure has to be the same
 * whichever edge is named first, and ratios because it has to be the same at
 * any distance or image scale.
 */
export interface Tilt {
  /** Top edge against bottom edge: tilt about the horizontal axis. */
  readonly x: number;
  /** Left edge against right edge: tilt about the vertical axis. */
  readonly y: number;
}

export const NO_TILT: Tilt = Object.freeze({x: 0, y: 0});

/**
 * The minimum spread of tilts a solve is allowed to proceed from.
 *
 * A board half as wide as its distance, tilted thirty degrees, gives an edge
 * ratio near 1.35 and so a component near 0.30. This floor is a quarter of
 * that: enough to refuse a set collected without tilting, or tilted the same
 * way every time, without refusing a cautious operator who varied it a little.
 */
export const MINIMUM_POSE_SPREAD = 0.08;

export function tiltOf(sample: CalibrationSample, board: CalibrationBoard): Tilt {
  const {columns, rows} = board;
  if (sample.corners.length !== columns * rows) return NO_TILT;
  const at = (column: number, row: number) => sample.corners[row * columns + column];
  const topLeft = at(0, 0);
  const topRight = at(columns - 1, 0);
  const bottomLeft = at(0, rows - 1);
  const bottomRight = at(columns - 1, rows - 1);
  if (!topLeft || !topRight || !bottomLeft || !bottomRight) return NO_TILT;
  return {
    x: logRatio(distance(topLeft, topRight), distance(bottomLeft, bottomRight)),
    y: logRatio(distance(topLeft, bottomLeft), distance(topRight, bottomRight))
  };
}

/**
 * How varied the collected tilts are: the RMS distance from their mean.
 *
 * One number covers both ways a set goes wrong. Every sample square on puts
 * every tilt near the origin; every sample tilted the same way puts them all in
 * one place. Either way they sit together, and this is near zero.
 */
export function poseSpread(
  samples: readonly CalibrationSample[],
  board: CalibrationBoard
): number {
  if (samples.length < 2) return 0;
  const tilts = samples.map((sample) => tiltOf(sample, board));
  const mean = {
    x: tilts.reduce((total, tilt) => total + tilt.x, 0) / tilts.length,
    y: tilts.reduce((total, tilt) => total + tilt.y, 0) / tilts.length
  };
  const squared =
    tilts.reduce(
      (total, tilt) => total + (tilt.x - mean.x) ** 2 + (tilt.y - mean.y) ** 2,
      0
    ) / tilts.length;
  return Math.sqrt(squared);
}

function logRatio(first: number, second: number): number {
  if (!(first > 0) || !(second > 0)) return 0;
  return Math.log(first / second);
}

function distance(from: CalibrationCorner, to: CalibrationCorner): number {
  return Math.hypot(from.x - to.x, from.y - to.y);
}
