import type {TiltDirection} from './contract.js';
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
 * A tilt with the axes that could not be read left undefined.
 *
 * Each axis compares one half of the board with the other, so a view that
 * shows only one half along an axis has no reading on it. That is not the
 * same as a board seen square on, and a set is not judged as if it were: a
 * run of views along the edge of the frame, all read as zero, would pull the
 * spread down however the board was actually turned.
 */
export interface MeasuredTilt {
  readonly x: number | undefined;
  readonly y: number | undefined;
}

/**
 * Which way the board still has to be turned.
 *
 * `x` is the upper half's grid steps against the lower half's, so a positive
 * `x` is a board whose top is nearer the camera. `y` is the left half against
 * the right, so a positive `y` is a board whose left edge is nearer. The names
 * are in the contract; the signs they correspond to are here.
 */
/**
 * The direction least represented in what has been collected.
 *
 * Each direction is scored by the furthest any held view reaches along it, and
 * the weakest wins. Asking for the weakest rather than simply "more tilt"
 * turns an instruction the operator has to interpret into one they can carry
 * out, and it spreads the set on purpose rather than by luck.
 *
 * Nothing collected asks for the first direction rather than nothing at all:
 * an operator holding a board square-on has to be told to start somewhere.
 */
export function weakestTiltDirection(
  samples: readonly CalibrationSample[],
  board: CalibrationBoard
): TiltDirection {
  const tilts = samples.map((sample) => measuredTilt(sample, board));
  const reach: ReadonlyArray<readonly [TiltDirection, (tilt: MeasuredTilt) => number]> = [
    ['top-near', (tilt) => tilt.x ?? 0],
    ['top-far', (tilt) => -(tilt.x ?? 0)],
    ['left-near', (tilt) => tilt.y ?? 0],
    ['right-near', (tilt) => -(tilt.y ?? 0)]
  ];
  let weakest: TiltDirection = 'top-near';
  let smallest = Number.POSITIVE_INFINITY;
  for (const [direction, along] of reach) {
    const furthest = tilts.reduce((best, tilt) => Math.max(best, along(tilt)), 0);
    if (furthest < smallest) {
      smallest = furthest;
      weakest = direction;
    }
  }
  return weakest;
}

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
 *
 * Over the axes both views have a reading on. Undefined when they share none,
 * because then nothing says how differently they were turned.
 */
export function tiltDistance(left: MeasuredTilt, right: MeasuredTilt): number | undefined {
  const dx = left.x === undefined || right.x === undefined ? undefined : left.x - right.x;
  const dy = left.y === undefined || right.y === undefined ? undefined : left.y - right.y;
  if (dx === undefined && dy === undefined) return undefined;
  return Math.hypot(dx ?? 0, dy ?? 0);
}

/** The tilt, reading an axis with no measurement as square on. */
export function tiltOf(sample: CalibrationSample, board: CalibrationBoard): Tilt {
  const {x, y} = measuredTilt(sample, board);
  return {x: x ?? 0, y: y ?? 0};
}

export function measuredTilt(sample: CalibrationSample, board: CalibrationBoard): MeasuredTilt {
  const {columns, rows} = board;
  const at = new Map<number, CalibrationCorner>();
  sample.ids.forEach((id, index) => {
    const corner = sample.corners[index];
    if (corner) at.set(id, corner);
  });
  if (at.size < 4) return {x: undefined, y: undefined};

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
 *
 * Each axis is taken over the views that have a reading on it, so a view that
 * shows too little of the board to say how it was turned neither adds to the
 * spread nor dilutes it.
 */
export function poseSpread(
  samples: readonly CalibrationSample[],
  board: CalibrationBoard
): number {
  if (samples.length < 2) return 0;
  const tilts = samples.map((sample) => measuredTilt(sample, board));
  return Math.sqrt(
    variance(tilts.map((tilt) => tilt.x)) + variance(tilts.map((tilt) => tilt.y))
  );
}

/** Population variance of the defined values; zero with fewer than two. */
function variance(values: ReadonlyArray<number | undefined>): number {
  const defined = values.filter((value): value is number => value !== undefined);
  if (defined.length < 2) return 0;
  const average = mean(defined);
  return defined.reduce((total, value) => total + (value - average) ** 2, 0) / defined.length;
}

/**
 * Whether the corners a view shows fix a plane: not all on one line of the board.
 *
 * Judged on the board's own grid, where a corner's place is exact, rather than
 * in the image, where lens distortion bends a straight row of corners into a
 * curve that would pass for a plane. A board running off the edge of the frame
 * can leave a single strip of corners, and from those neither a calibration
 * nor a pose can start: there is no homography to take from one line.
 */
export function cornersSpanBoard(ids: readonly number[], board: CalibrationBoard): boolean {
  const {columns} = board;
  const points = ids.map((id) => [id % columns, Math.floor(id / columns)] as const);
  const [origin] = points;
  if (!origin) return false;
  const direction = points.find(([x, y]) => x !== origin[0] || y !== origin[1]);
  if (!direction) return false;
  const dx = direction[0] - origin[0];
  const dy = direction[1] - origin[1];
  return points.some(([x, y]) => dx * (y - origin[1]) - dy * (x - origin[0]) !== 0);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function logRatio(first: number, second: number): number | undefined {
  // No reading when either half contributed nothing: a measure taken from one
  // side of the board says nothing about how it was turned.
  if (!(first > 0) || !(second > 0)) return undefined;
  return Math.log(first / second);
}

function distance(from: CalibrationCorner, to: CalibrationCorner): number {
  return Math.hypot(from.x - to.x, from.y - to.y);
}
