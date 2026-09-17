import {describe, expect, it} from 'vitest';
import {
  measuredTilt,
  MINIMUM_POSE_SPREAD,
  poseSpread,
  tiltDistance,
  tiltOf,
  weakestTiltDirection
} from '../src/calibration/pose.js';
import type {CalibrationBoard, CalibrationSample} from '../src/calibration/types.js';

const BOARD: CalibrationBoard = {columns: 9, rows: 6, squareSizeMeters: 0.025, markerSizeMeters: 0.018};

/** A 9x6 board seen through a pinhole, tilted by (gx, gy) and shifted. */
function view(gx: number, gy: number, shiftX = 0, shiftY = 0): CalibrationSample {
  return {
    corners: Array.from({length: 54}, (_, index) => {
      const u = (index % 9) / 8 - 0.5;
      const v = Math.floor(index / 9) / 5 - 0.5;
      const depth = 1 + gx * u + gy * v;
      return {x: 400 + shiftX + (320 * u) / depth, y: 300 + shiftY + (240 * v) / depth};
    }),
    ids: Array.from({length: 54}, (_, index) => index),
    quality: 0.8,
    coverage: 0.25,
    sharpness: 120
  };
}

describe('how obliquely a board was seen', () => {
  it('reads zero when the board is square on', () => {
    const {x, y} = tiltOf(view(0, 0), BOARD);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
  });

  it('does not change when the board is only moved', () => {
    // This is the whole point. The board's novelty check measures how far the
    // corners moved, so a set collected by sliding a square-on board around
    // passes it -- and cannot be calibrated from.
    const still = tiltOf(view(0.3, 0), BOARD);
    const moved = tiltOf(view(0.3, 0, 120, -80), BOARD);
    expect(moved.x).toBeCloseTo(still.x, 6);
    expect(moved.y).toBeCloseTo(still.y, 6);
  });

  it('changes sign with the direction of the tilt', () => {
    expect(tiltOf(view(0, 0.3), BOARD).x).toBeCloseTo(
      -tiltOf(view(0, -0.3), BOARD).x,
      6
    );
  });

  it('does not change with distance or image scale', () => {
    // Log ratios of opposite edges: a board twice as far away halves every
    // edge and leaves their ratio alone.
    const near = tiltOf(view(0.3, 0.2), BOARD);
    const far = {
      corners: view(0.3, 0.2).corners.map(({x, y}) => ({
        x: 400 + (x - 400) / 2,
        y: 300 + (y - 300) / 2
      })),
      ids: Array.from({length: 54}, (_, index) => index),
      quality: 0.8,
      coverage: 0.25,
      sharpness: 120
    };
    expect(tiltOf(far, BOARD).x).toBeCloseTo(near.x, 6);
    expect(tiltOf(far, BOARD).y).toBeCloseTo(near.y, 6);
  });
});

describe('how varied a set of samples is', () => {
  it('reads zero for a set that was never tilted', () => {
    const slid = [0, 1, 2, 3, 4, 5, 6, 7].map((index) =>
      view(0, 0, index * 40, index * 20)
    );
    expect(poseSpread(slid, BOARD)).toBeLessThan(MINIMUM_POSE_SPREAD);
  });

  it('reads zero for a set tilted the same way every time', () => {
    // Tilting once and then only moving is the other way to collect a set
    // that looks varied and constrains nothing new.
    const same = [0, 1, 2, 3, 4, 5, 6, 7].map((index) =>
      view(0.35, 0, index * 40, index * 20)
    );
    expect(poseSpread(same, BOARD)).toBeLessThan(MINIMUM_POSE_SPREAD);
  });

  it('rises once the tilts differ', () => {
    const varied = [
      view(0.35, 0),
      view(-0.35, 0),
      view(0, 0.35),
      view(0, -0.35),
      view(0.25, 0.25),
      view(-0.25, 0.25),
      view(0.25, -0.25),
      view(-0.25, -0.25)
    ];
    expect(poseSpread(varied, BOARD)).toBeGreaterThan(MINIMUM_POSE_SPREAD);
  });

  it('reads zero before there is anything to compare', () => {
    expect(poseSpread([], BOARD)).toBe(0);
    expect(poseSpread([view(0.3, 0)], BOARD)).toBe(0);
  });
});

/** Only the rows of a view from `first` to `last`, as a board run off the frame leaves. */
function rows(sample: CalibrationSample, first: number, last: number): CalibrationSample {
  const kept = sample.ids
    .map((id, index) => ({id, corner: sample.corners[index]!}))
    .filter(({id}) => Math.floor(id / 9) >= first && Math.floor(id / 9) <= last);
  return {...sample, ids: kept.map(({id}) => id), corners: kept.map(({corner}) => corner)};
}

describe('a view that shows too little of the board to say how it was turned', () => {
  it('has no reading on the axis it shows only one half of', () => {
    // Rows 0 to 2 of six are all in the upper half, so nothing compares the
    // upper half with the lower. That is not a board seen square on.
    const top = measuredTilt(rows(view(0.3, 0.3), 0, 2), BOARD);
    expect(top.x).toBeUndefined();
    expect(top.y).toBeDefined();
  });

  it('neither adds to the spread nor dilutes it', () => {
    const varied = [view(0, 0.35), view(0, -0.35), view(0.35, 0), view(-0.35, 0)];
    const edges = [0, 1, 2, 3].map((index) => rows(view(0.3, 0.05 * index), 0, 2));
    const set = [...varied, ...edges];
    // Each axis over the views that have a reading on it.
    const spreadOf = (values: number[]) => {
      const average = values.reduce((total, value) => total + value, 0) / values.length;
      return values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
    };
    const expected = Math.sqrt(
      spreadOf(varied.map((sample) => measuredTilt(sample, BOARD).x!)) +
        spreadOf(set.map((sample) => measuredTilt(sample, BOARD).y!))
    );
    expect(poseSpread(set, BOARD)).toBeCloseTo(expected, 12);
    // Read as square on, the four edge views would have pulled it down.
    const naive = Math.sqrt(
      spreadOf(set.map((sample) => tiltOf(sample, BOARD).x)) +
        spreadOf(set.map((sample) => tiltOf(sample, BOARD).y))
    );
    expect(poseSpread(set, BOARD)).toBeGreaterThan(naive);
  });

  it('is not compared on an axis it has no reading on', () => {
    expect(tiltDistance({x: undefined, y: 0.1}, {x: 0.4, y: 0.1})).toBe(0);
    expect(tiltDistance({x: undefined, y: 0.1}, {x: 0.4, y: undefined})).toBeUndefined();
  });

  it('does not count towards a direction it cannot show', () => {
    const edges = [0, 1, 2].map(() => rows(view(0.3, 0), 0, 2));
    expect(weakestTiltDirection(edges, BOARD)).toBe('top-near');
  });
});

/** A board of any size seen through a pinhole, tilted by (gx, gy). */
function boardView(board: CalibrationBoard, gx: number, gy: number): CalibrationSample {
  const {columns, rows} = board;
  const count = columns * rows;
  return {
    corners: Array.from({length: count}, (_, index) => {
      const u = (index % columns) / (columns - 1) - 0.5;
      const v = Math.floor(index / columns) / (rows - 1) - 0.5;
      const depth = 1 + gx * u + gy * v;
      return {x: 400 + (320 * u) / depth, y: 300 + (240 * v) / depth};
    }),
    ids: Array.from({length: count}, (_, index) => index),
    quality: 0.8,
    coverage: 0.25,
    sharpness: 120
  };
}

describe('a tilt read from part of the board', () => {
  it('reads on the scale of the whole board', () => {
    // Rows 2 and 3 of six are the two either side of the middle. Their steps
    // differ far less than the halves' do, so unscaled the view read as
    // nearly square on and diluted the spread.
    const whole = measuredTilt(view(0, 0.2), BOARD).x!;
    const middle = measuredTilt(rows(view(0, 0.2), 2, 3), BOARD).x!;
    expect(Math.abs(whole)).toBeGreaterThan(0.1);
    expect(middle / whole).toBeGreaterThan(0.85);
    expect(middle / whole).toBeLessThan(1.15);
  });

  it('leaves the middle line of an odd count out of both halves', () => {
    // Counted in one half, it makes the halves unequal, so turning the board
    // one way reads differently from turning it the other. Left out, the two
    // halves mirror each other and so do the readings.
    const odd: CalibrationBoard = {...BOARD, columns: 7, rows: 5};
    const forward = measuredTilt(boardView(odd, 0.3, 0.3), odd);
    const back = measuredTilt(boardView(odd, -0.3, -0.3), odd);
    expect(forward.x).toBeCloseTo(-back.x!, 10);
    expect(forward.y).toBeCloseTo(-back.y!, 10);
  });
});
