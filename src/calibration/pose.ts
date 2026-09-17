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
 * Measured as the log ratio of how long the board's own grid steps come out in
 * one half of it against the other. Under perspective the nearer half is
 * magnified; seen square on, both halves match and this is zero. Logs because
 * the measure has to read the same whichever half is named first, and ratios
 * because it has to read the same at any distance or image scale.
 *
 * Every adjacent pair of corners is used rather than the outer quad, so a view
 * that shows only part of the board still gives an answer -- which it has to,
 * since a ChArUco board is meant to be usable when it runs off the frame.
 */
export interface Tilt {
  /** Upper half against lower half: how far the board is turned about the horizontal axis. */
  readonly x: number;
  /** Left half against right half: how far it is turned about the vertical axis. */
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

/**
 * How differently two views were turned.
 *
 * The distance the solve cares about. Two views taken from the same angle
 * constrain the same thing however far apart on the board they were taken, so
 * this ignores where the board was and reads only how it was turned.
 */
export function tiltDistance(left: Tilt, right: Tilt): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function tiltOf(sample: CalibrationSample, board: CalibrationBoard): Tilt {
  const {columns, rows} = board;
  const at = new Map<number, CalibrationCorner>();
  sample.ids.forEach((id, index) => {
    const corner = sample.corners[index];
    if (corner) at.set(id, corner);
  });
  if (at.size < 4) return NO_TILT;

  // Steps along a row, grouped by which half of the board they sit in.
  const acrossNear: number[] = [];
  const acrossFar: number[] = [];
  const downNear: number[] = [];
  const downFar: number[] = [];
  for (const [id, corner] of at) {
    const column = id % columns;
    const row = Math.floor(id / columns);
    const right = column + 1 < columns ? at.get(id + 1) : undefined;
    if (right) {
      (row * 2 < rows - 1 ? acrossNear : acrossFar).push(distance(corner, right));
    }
    const below = row + 1 < rows ? at.get(id + columns) : undefined;
    if (below) {
      (column * 2 < columns - 1 ? downNear : downFar).push(distance(corner, below));
    }
  }
  return {
    x: logRatio(mean(acrossNear), mean(acrossFar)),
    y: logRatio(mean(downNear), mean(downFar))
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

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function logRatio(first: number, second: number): number {
  // Zero when either half contributed nothing: a measure taken from one side
  // of the board says nothing about how it was turned.
  if (!(first > 0) || !(second > 0)) return 0;
  return Math.log(first / second);
}

function distance(from: CalibrationCorner, to: CalibrationCorner): number {
  return Math.hypot(from.x - to.x, from.y - to.y);
}
