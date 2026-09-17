// SPDX-License-Identifier: MPL-2.0
/**
 * The marker patterns of OpenCV's `DICT_4X4_50`.
 *
 * Fifty markers of sixteen bits: a hundred bytes, which is why the board can be
 * drawn in the page at all. The alternative was shipping OpenCV to the display
 * side to ask it, and OpenCV is eleven megabytes.
 *
 * Extracted from `cv.getPredefinedDictionary(cv.DICT_4X4_50)` rather than
 * transcribed, and checked against a board OpenCV drew itself: the first ten
 * markers of a 10x7 board read back bit for bit. A dictionary is an arbitrary
 * table, so a copy made any other way would be a copy nothing could check.
 *
 * Each entry is the 4x4 data grid, row-major, most significant bit at the top
 * left, a set bit meaning white.
 */
export const DICT_4X4_50: readonly number[] = [
  0xb532, 0x0f9a, 0x332d, 0x9946, 0x549e, 0x79cd, 0x9e2e, 0xc4f2, 0xfeda,
  0xcf56, 0xf991, 0x11a7, 0x0eb7, 0x2a0f, 0x24b1, 0x263e, 0x4665, 0x6600,
  0x6c5e, 0x76af, 0x868b, 0xb02b, 0xccd5, 0xdd82, 0xfe47, 0x9471, 0xace4,
  0xa554, 0x2123, 0x346f, 0x4415, 0x57b2, 0x9ecf, 0xf0cb, 0x08ae, 0x0929,
  0x1875, 0x04ff, 0x0df6, 0x1c5a, 0x1718, 0x2a28, 0x328c, 0x38b2, 0x24e8,
  0x2eeb, 0x2d3f, 0x4b64, 0x502e, 0x5013,
];

/** Data cells across a marker, before its border. */
export const MARKER_BITS = 4;

/** Cells across a whole marker: the data grid inside a one-cell black border. */
export const MARKER_CELLS = MARKER_BITS + 2;

/**
 * Which cells of a marker are white, as a `MARKER_CELLS` square.
 *
 * The border ring is always black -- that is what the detector finds first, and
 * it is why a marker has to sit inside a light square with white left around
 * it.
 */
export function markerCells(id: number): boolean[][] {
  const bits = DICT_4X4_50[id];
  if (bits === undefined) throw new Error(`DICT_4X4_50 has no marker ${id}.`);
  const cells: boolean[][] = [];
  for (let row = 0; row < MARKER_CELLS; row += 1) {
    const line: boolean[] = [];
    for (let column = 0; column < MARKER_CELLS; column += 1) {
      const border =
        row === 0 ||
        column === 0 ||
        row === MARKER_CELLS - 1 ||
        column === MARKER_CELLS - 1;
      if (border) {
        line.push(false);
        continue;
      }
      const index = (row - 1) * MARKER_BITS + (column - 1);
      line.push(((bits >> (MARKER_BITS * MARKER_BITS - 1 - index)) & 1) === 1);
    }
    cells.push(line);
  }
  return cells;
}
