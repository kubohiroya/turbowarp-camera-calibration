// SPDX-License-Identifier: MPL-2.0
/**
 * Asks the detector whether it can find the board this extension draws.
 *
 * The two used to live in different repositories -- the SVG in the app, the
 * ChArUco detector here -- and nothing checked that they agreed. They did, but
 * nobody knew it, and a change to either side would have been discovered by an
 * operator standing in front of a camera being told to show a board they were
 * already holding. They are one repository now, which removes the drift but
 * not the question: a board can be drawn wrongly without anyone noticing,
 * because the mistake looks like a camera that cannot see.
 *
 * It reads the built library rather than the source, so what is checked is the
 * drawing a consumer receives -- the same file an app importing `./runtime`
 * ends up calling. `pnpm build` has to have run.
 *
 * It runs in a browser because that is the only place the question can be
 * asked. OpenCV registers its API through embind when the WebAssembly module
 * initializes, so reading either file proves nothing, and the module does not
 * finish initializing under Node.
 *
 * Two properties, not one:
 *
 * Every board is found in full by its own detector. That is the contract.
 *
 * No board is found at all by another board's detector. That one is not
 * obvious -- all three boards draw markers from the same dictionary, numbered
 * from zero, so a smaller board's markers are a subset of a larger one's and a
 * partial match is imaginable. Measured, it does not happen: a mismatched
 * board yields no corners rather than a few wrong ones. Worth pinning, because
 * a few wrong ones would be a calibration that solves and is wrong, with a
 * small reprojection error saying nothing is amiss.
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
// Types from the source, values from the build.
//
// What is being checked is the drawing a consumer receives, which is the
// emitted file -- so that is what is loaded. The specifier is built rather
// than written, because a literal one would be resolved by `tsc --noEmit`,
// which runs before anything is built.
import type * as BoardModule from '../src/board/pattern.ts';

const board = (await import(
  new URL('../lib/board/pattern.js', import.meta.url).href
)) as typeof BoardModule;
const {BOARDS, MARKER_RATIO, patternSvg, printedCellMillimetres} = board;

const openCv = await readFile(new URL('../vendor/opencv.js', import.meta.url));

const svgs = Object.fromEntries(
  BOARDS.map((board) => [`${board.columns}x${board.rows}`, patternSvg(board)]),
);

const page =
  '<!doctype html><meta charset="utf-8"><title>board</title><script src="/opencv.js"></script>';

const server = createServer((request, response) => {
  const url = request.url ?? '/';
  if (url === '/opencv.js') {
    response.writeHead(200, { 'content-type': 'text/javascript' });
    response.end(openCv);
    return;
  }
  const board = /^\/board-(.+)\.svg$/u.exec(url)?.[1];
  if (board && svgs[board]) {
    response.writeHead(200, { 'content-type': 'image/svg+xml' });
    response.end(svgs[board]);
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end(page);
});

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') {
  throw new Error('The local server did not report a port.');
}

/** Wide enough that a square lands on plenty of pixels; this is not a camera. */
const RASTER_WIDTH = 1600;

const specs = BOARDS.map((board) => ({
  name: `${board.columns}x${board.rows}`,
  columns: board.columns,
  rows: board.rows,
  squareMetres: printedCellMillimetres(board) / 1000,
  markerMetres: (printedCellMillimetres(board) * MARKER_RATIO) / 1000,
}));

const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  await tab.goto(`http://127.0.0.1:${address.port}/`);
  const report = await tab.evaluate(
    async ([boards, width]) => {
      const global = globalThis as Record<string, unknown>;
      for (
        let attempt = 0;
        attempt < 120 && global.cv === undefined;
        attempt += 1
      ) {
        await new Promise((wake) => setTimeout(wake, 250));
      }
      // A thenable until the WebAssembly runtime is up, and calling it is what
      // starts it.
      const loaded = global.cv as
        | Record<string, never>
        | (() => Promise<Record<string, never>>)
        | undefined;
      const cv = (
        typeof loaded === 'function' ? await loaded() : await loaded
      ) as Record<string, never> & Record<string, (...args: never[]) => never>;
      if (!cv)
        return { ready: false, found: [] as Array<Record<string, unknown>> };

      const rasterise = async (name: string) => {
        const svg = await (await fetch(`/board-${name}.svg`)).text();
        const image = new Image();
        image.src = `data:image/svg+xml;base64,${btoa(
          String.fromCharCode(...new TextEncoder().encode(svg)),
        )}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = Math.round((width * 750) / 1000);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('no 2d context');
        // White behind it: the SVG's quiet zone is transparent, and a marker
        // border against transparency is a marker border against black.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return context.getImageData(0, 0, canvas.width, canvas.height);
      };

      const cornersOf = (
        pixels: ImageData,
        spec: {
          columns: number;
          rows: number;
          squareMetres: number;
          markerMetres: number;
        },
      ) => {
        // Typed loosely on purpose: this runs in the browser against a build
        // whose API is registered at run time by embind, so a declaration here
        // would be a second opinion about what OpenCV provides. What it
        // provides is checked by `opencv:check`, against the build itself.
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const api = cv as any;
        /* eslint-enable @typescript-eslint/no-explicit-any */
        const source = api.matFromImageData(pixels);
        const gray = new api.Mat();
        const corners = new api.Mat();
        const ids = new api.Mat();
        try {
          api.cvtColor(source, gray, api.COLOR_RGBA2GRAY);
          const board = new api.aruco_CharucoBoard(
            new api.Size(spec.columns + 1, spec.rows + 1),
            spec.squareMetres,
            spec.markerMetres,
            api.getPredefinedDictionary(api.DICT_4X4_50),
            new api.Mat(),
          );
          const detector = new api.aruco_CharucoDetector(
            board,
            new api.aruco_CharucoParameters(),
            new api.aruco_DetectorParameters(),
            new api.aruco_RefineParameters(2, 3, true),
          );
          (
            detector as unknown as { detectBoard(...args: unknown[]): void }
          ).detectBoard(gray, corners, ids);
          return (ids as unknown as { rows: number }).rows;
        } finally {
          for (const mat of [ids, corners, gray, source]) {
            (mat as unknown as { delete(): void }).delete();
          }
        }
      };

      const found: Array<Record<string, unknown>> = [];
      for (const held of boards) {
        const pixels = await rasterise(held.name);
        for (const configured of boards) {
          found.push({
            held: held.name,
            configured: configured.name,
            corners: cornersOf(pixels, configured),
            expected: configured.columns * configured.rows,
          });
        }
      }
      return { ready: true, found };
    },
    [specs, RASTER_WIDTH] as [typeof specs, number],
  );

  if (!report.ready) {
    throw new Error(
      'The pinned OpenCV.js build did not initialize in a browser.',
    );
  }

  const problems: string[] = [];
  for (const row of report.found as Array<{
    held: string;
    configured: string;
    corners: number;
    expected: number;
  }>) {
    const same = row.held === row.configured;
    if (same && row.corners !== row.expected) {
      problems.push(
        `${row.held}: the detector found ${row.corners} of ${row.expected} inner corners in the board this app prints.`,
      );
    }
    if (!same && row.corners !== 0) {
      problems.push(
        `${row.held} held against the ${row.configured} detector produced ${row.corners} corners; a mismatched board must produce none, or a wrong board can be calibrated from.`,
      );
    }
    console.log(
      `${row.held} board / ${row.configured} detector: ${row.corners} corners` +
        (same ? ` (expected ${row.expected})` : ' (expected 0)'),
    );
  }
  if (problems.length > 0) throw new Error(problems.join('\n'));
  console.log(
    `Every board this extension draws is found in full by its own detector, and by no other.`,
  );
} finally {
  await browser.close();
  server.close();
}
