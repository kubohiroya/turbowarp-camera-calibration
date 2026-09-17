// SPDX-License-Identifier: MPL-2.0
/**
 * The ChArUco board this extension looks for, drawn.
 *
 * Here rather than in whatever app shows it, because the same numbers have to
 * produce the drawing and the detector. Kept apart, the two agree until one of
 * them changes, and the way that failure arrives is an operator holding a
 * board being told to show one.
 *
 * It was apart: an app drew the board and this extension looked for it, and a
 * browser check ran across the two repositories to confirm they still matched.
 * That check was worth writing, and it is worth not needing.
 *
 * Geometry lives here rather than in the markup so that the printed sheet, the
 * full-screen view and the saved file are the same board.
 *
 * A marker sits in every light square. That is what lets a view that runs off
 * the edge of the frame still be used: the markers name the corners around
 * them, where a plain chessboard has to be found whole because nothing in it
 * says which corner is which. The corners near the frame edge are the ones that
 * decide the principal point and the distortion, so being able to keep those
 * views matters more than it sounds.
 */

import { MARKER_CELLS, markerCells } from './aruco.js';

export interface BoardSpec {
  /** Inner corners across, which is one fewer than the squares across. */
  readonly columns: number;
  /** Inner corners down. */
  readonly rows: number;
}

export interface BoardLayout extends BoardSpec {
  /** Side of one square, in the units the board is drawn in. */
  readonly cell: number;
  readonly boardWidth: number;
  readonly boardHeight: number;
  /** Blank margin on each side. Never less than one square. */
  readonly quietX: number;
  readonly quietY: number;
}

/**
 * The boards offered for display, smallest grid last.
 *
 * More inner corners constrain the solve better; fewer survive a camera that is
 * far away or short of resolution, where a 40-unit square lands on too few
 * pixels to locate its corners.
 */
/**
 * How much of a light square the marker fills.
 *
 * White has to remain around it, or the detector cannot separate the marker's
 * black border from the dark squares the light square touches.
 */
export const MARKER_RATIO = 0.72;

export const BOARDS: readonly BoardSpec[] = [
  { columns: 9, rows: 6 },
  { columns: 7, rows: 5 },
  { columns: 5, rows: 4 },
];

/**
 * Fits a board into a box with a blank margin around it.
 *
 * The margin is at least one square on every side. OpenCV's chessboard finder
 * needs the outer squares to be bounded by background it can trace; a board run
 * to the edge of the frame loses its outermost corners, and the pattern is
 * refused as incomplete rather than found with fewer points.
 *
 * The box is the drawing's own coordinate space. Nothing here knows the size of
 * the screen it will end up on: the board is drawn once and scaled uniformly,
 * because scaling one axis alone would turn the squares into rectangles and the
 * calibration would solve for a lens that is not there.
 */
/**
 * The sheet `patternFile` writes: A4, landscape, in millimetres.
 *
 * Here rather than in the writer because the printed square size is derived
 * from it, and a page size that moved without the derivation moving with it
 * would hand the calibration a measurement of a sheet nobody printed.
 */
export const PRINT_WIDTH_MM = 297;
export const PRINT_HEIGHT_MM = 210;

/**
 * How large one square comes out on that sheet, printed at full size.
 *
 * The SVG scales uniformly and letterboxes the rest, so the scale is whichever
 * axis runs out first -- the same on both, which is what keeps the squares
 * square.
 *
 * Nominal, not measured. It is what the sheet should be if the printer was
 * told not to resize; a ruler laid on the paper is the only thing that knows
 * whether it was. Intrinsic calibration does not care either way -- the fit is
 * unchanged by scale -- but a board pose is metric, and its distance is wrong
 * by exactly however much this is wrong.
 */
export function printedCellMillimetres(board: BoardSpec): number {
  const drawn = layout(board);
  const scale = Math.min(PRINT_WIDTH_MM / 1000, PRINT_HEIGHT_MM / 750);
  return drawn.cell * scale;
}

export function layout(
  board: BoardSpec,
  width = 1000,
  height = 750,
): BoardLayout {
  const squaresX = board.columns + 1;
  const squaresY = board.rows + 1;
  // Two extra squares in each direction: one of margin on each side.
  const cell = Math.floor(
    Math.min(width / (squaresX + 2), height / (squaresY + 2)),
  );
  const boardWidth = cell * squaresX;
  const boardHeight = cell * squaresY;
  return {
    ...board,
    cell,
    boardWidth,
    boardHeight,
    quietX: (width - boardWidth) / 2,
    quietY: (height - boardHeight) / 2,
  };
}

/** The costume name a board is switched to by. */
export function boardName(board: BoardSpec): string {
  return `board-${board.columns}x${board.rows}`;
}

/**
 * Draws the board as an SVG.
 *
 * Only the dark squares are emitted, over a white ground. Painting both colours
 * would put a seam between every pair of rectangles, and a renderer that leaves
 * a half-unit of background showing along it gives the corner finder a line of
 * light where the board has an edge.
 */
export function patternSvg(
  board: BoardSpec,
  width = 1000,
  height = 750,
): string {
  const { cell, quietX, quietY } = layout(board, width, height);
  const squares: string[] = [];
  const markers: string[] = [];
  // Markers go in the light squares, scanned row by row, numbered from zero --
  // the order OpenCV assigns when it builds the same board, checked against a
  // board it drew itself rather than assumed.
  let markerId = 0;
  for (let row = 0; row <= board.rows; row += 1) {
    for (let column = 0; column <= board.columns; column += 1) {
      const x = quietX + column * cell;
      const y = quietY + row * cell;
      if ((row + column) % 2 === 0) {
        squares.push(
          `<rect x="${x}" y="${y}" width="${cell}" height="${cell}"/>`,
        );
        continue;
      }
      markers.push(markerSvg(markerId, x, y, cell));
      markerId += 1;
    }
  }
  // preserveAspectRatio keeps the scaling uniform and letterboxes the rest. A
  // viewer that stretched one axis would hand the solver a grid whose squares
  // are not square, and the bias that follows does not show up as reprojection
  // error -- it is simply a wrong calibration that looks like a good one.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"` +
    ` preserveAspectRatio="xMidYMid meet" width="100%" height="100%">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    `<g fill="#000000">${squares.join('')}${markers.join('')}</g>` +
    '</svg>'
  );
}

/**
 * One marker, centred in its light square.
 *
 * Only the black cells are drawn, over the white square already beneath. The
 * border ring is part of the marker and is what the detector finds first, so it
 * is drawn as a single rectangle with the white data cells punched out of it --
 * fewer shapes than one rectangle per cell, and no seams between them for a
 * renderer to leave a hairline in.
 */
function markerSvg(
  id: number,
  squareX: number,
  squareY: number,
  cell: number,
): string {
  const side = cell * MARKER_RATIO;
  const originX = squareX + (cell - side) / 2;
  const originY = squareY + (cell - side) / 2;
  const step = side / MARKER_CELLS;
  const cells = markerCells(id);
  const dark: string[] = [];
  for (let row = 0; row < MARKER_CELLS; row += 1) {
    for (let column = 0; column < MARKER_CELLS; column += 1) {
      if (cells[row]?.[column]) continue;
      dark.push(
        `<rect x="${round(originX + column * step)}" y="${round(originY + row * step)}" width="${round(step)}" height="${round(step)}"/>`,
      );
    }
  }
  return dark.join('');
}

function round(value: number): string {
  return (Math.round(value * 1000) / 1000).toString();
}
