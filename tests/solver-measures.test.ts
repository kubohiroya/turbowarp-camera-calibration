import {describe, expect, it} from 'vitest';
import {
  cornerRegion,
  describeOpenCvFailure,
  heldOutRms,
  regionVariance
} from '../src/calibration/measures.js';

describe('the hold-out error', () => {
  it('allows for the pose each held-out view was fitted with', () => {
    // Two views of six corners: twelve corners, two poses worth three each.
    // Divided by the corners alone the error would read sqrt(2) too small.
    expect(heldOutRms(12, 12, 2)).toBeCloseTo(Math.sqrt(2), 12);
    expect(heldOutRms(54, 54, 1)).toBeCloseTo(Math.sqrt(54 / 51), 12);
  });

  it('reads zero when nothing was scored', () => {
    expect(heldOutRms(0, 0, 0)).toBe(0);
  });
});

describe('the focus measure', () => {
  it('is taken over the board, not the frame', () => {
    // A 4x4 image: a busy left half, a flat right half.
    const values = [
      0, 100, 0, 0,
      100, 0, 0, 0,
      0, 100, 0, 0,
      100, 0, 0, 0
    ];
    const flat = regionVariance(values, 4, {left: 2, top: 0, right: 4, bottom: 4});
    const busy = regionVariance(values, 4, {left: 0, top: 0, right: 2, bottom: 4});
    expect(flat).toBe(0);
    expect(busy).toBe(2500);
  });

  it('bounds the region by the corners and the image', () => {
    expect(
      cornerRegion(
        [
          {x: -3.2, y: 10.5},
          {x: 20.4, y: 700.9}
        ],
        640,
        480
      )
    ).toEqual({left: 0, top: 10, right: 22, bottom: 480});
  });
});

describe('an OpenCV failure', () => {
  it('says what was being done, where the build gives only an address', () => {
    const described = describeOpenCvFailure('solving the calibration', 5251440);
    expect(described).toBeInstanceOf(Error);
    expect((described as Error).message).toBe(
      'OpenCV failed while solving the calibration (C++ exception at 0x502170; this build carries no message for it).'
    );
  });

  it('passes an error that already says something through', () => {
    const error = new Error('explicit');
    expect(describeOpenCvFailure('solving the calibration', error)).toBe(error);
  });
});
