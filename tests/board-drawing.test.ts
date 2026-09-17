import {describe, expect, it} from 'vitest';
import {
  BOARDS,
  MARKER_RATIO,
  boardName,
  layout,
  patternSvg
} from '../src/board/pattern.js';
import {DICT_4X4_50, MARKER_CELLS, markerCells} from '../src/board/aruco.js';

/** The viewBox every board is drawn into. */
const WIDTH = 1000;
const HEIGHT = 750;

describe('the ChArUco board', () => {
  it('counts squares, not inner corners', () => {
    // The calibration block is given inner corners. A 9x6 board shows 10x7
    // squares, and quoting the wrong number produces a board whose shape does
    // not match the one the finder is looking for.
    for (const board of BOARDS) {
      const squares = (board.columns + 1) * (board.rows + 1);
      const dark = Math.ceil(squares / 2);
      const light = squares - dark;
      const svg = patternSvg(board);
      const rects = (svg.match(/<rect x=/gu) ?? []).length;
      // One rectangle per dark square, plus the black cells of one marker in
      // each light square.
      const perMarker = Array.from(
        { length: light },
        (_, id) =>
          markerCells(id)
            .flat()
            .filter((white) => !white).length,
      ).reduce((total, count) => total + count, 0);
      expect(rects).toBe(dark + perMarker);
    }
  });

  it('has a marker for every light square, from a dictionary that has enough', () => {
    for (const board of BOARDS) {
      const squares = (board.columns + 1) * (board.rows + 1);
      const light = squares - Math.ceil(squares / 2);
      expect(light).toBeLessThanOrEqual(DICT_4X4_50.length);
    }
  });

  it('leaves white around every marker', () => {
    // The marker's black border is what the detector finds first. Running it to
    // the edge of its square would join it to the dark squares beside it, and
    // there would be no border left to find.
    expect(MARKER_RATIO).toBeGreaterThan(0);
    expect(MARKER_RATIO).toBeLessThan(1);
  });

  it('draws each marker as a bordered grid', () => {
    // The ring is part of the marker, not decoration: every outer cell is dark.
    for (const id of [0, 1, 25, 49]) {
      const cells = markerCells(id);
      expect(cells).toHaveLength(MARKER_CELLS);
      for (let index = 0; index < MARKER_CELLS; index += 1) {
        expect(cells[0]?.[index]).toBe(false);
        expect(cells[MARKER_CELLS - 1]?.[index]).toBe(false);
        expect(cells[index]?.[0]).toBe(false);
        expect(cells[index]?.[MARKER_CELLS - 1]).toBe(false);
      }
    }
  });

  it('carries fifty distinct markers', () => {
    // A dictionary is an arbitrary table; a duplicate would make two squares
    // claim the same corners.
    expect(DICT_4X4_50).toHaveLength(50);
    expect(new Set(DICT_4X4_50).size).toBe(50);
  });

  it('leaves at least one square of blank margin on every side', () => {
    // OpenCV traces the outer squares against the background. A board run to
    // the edge loses its outermost corners and is refused as incomplete rather
    // than found with fewer points.
    for (const board of BOARDS) {
      const fitted = layout(board, WIDTH, HEIGHT);
      expect(fitted.quietX).toBeGreaterThanOrEqual(fitted.cell);
      expect(fitted.quietY).toBeGreaterThanOrEqual(fitted.cell);
    }
  });

  it('keeps every square square', () => {
    // A board stretched to fill its box would calibrate a lens that is not
    // there: the solve reads the distortion of the drawing as the camera's.
    for (const board of BOARDS) {
      const fitted = layout(board, WIDTH, HEIGHT);
      expect(fitted.boardWidth / (board.columns + 1)).toBe(fitted.cell);
      expect(fitted.boardHeight / (board.rows + 1)).toBe(fitted.cell);
    }
  });

  it('scales uniformly and letterboxes the rest', () => {
    // This attribute is the whole defence against a viewer stretching one
    // axis, which turns the squares into rectangles. The resulting bias does
    // not raise the reprojection error, so nothing downstream would catch it.
    const svg = patternSvg(BOARDS[0] ?? { columns: 9, rows: 6 });
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain(`viewBox="0 0 ${WIDTH} ${HEIGHT}"`);
  });

  it('names a board by its inner corners', () => {
    expect(boardName({ columns: 9, rows: 6 })).toBe('board-9x6');
  });
});
