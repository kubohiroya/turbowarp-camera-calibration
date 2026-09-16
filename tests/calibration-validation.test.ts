import {describe, expect, it} from 'vitest';
import {MINIMUM_POSE_SPREAD, poseSpread, tiltOf} from '../src/calibration/pose.js';
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
