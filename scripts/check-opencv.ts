/**
 * Asks the real OpenCV build whether it provides what the backend calls.
 *
 * Every other check in this repository runs in Node against a mock backend,
 * which is what lets the controller be tested without eleven megabytes of
 * WebAssembly. The cost of that seam is that the two halves are never brought
 * together, and the cost was real: findChessboardCorners, cornerSubPix and
 * calibrateCamera were absent from the pinned build for five releases while
 * every test passed. The bundle contained their names -- at the call site.
 *
 * embind registers OpenCV's functions when the module initializes, so they are
 * in neither file's text and no amount of reading proves anything. The module
 * also does not finish initializing under Node. A browser is the only place
 * this question can be asked, so this is the only check that starts one.
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {REQUIRED_OPENCV_SYMBOLS} from '../src/calibration/opencv-symbols.ts';

const require = createRequire(import.meta.url);
const openCvPath = require.resolve('@techstark/opencv-js');
const openCv = await readFile(openCvPath);

const page = `<!doctype html><meta charset="utf-8"><title>opencv</title><script src="/opencv.js"></script>`;

const server = createServer((request, response) => {
  if (request.url === '/opencv.js') {
    response.writeHead(200, {'content-type': 'text/javascript'});
    response.end(openCv);
    return;
  }
  response.writeHead(200, {'content-type': 'text/html'});
  response.end(page);
});

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') {
  throw new Error('The local server did not report a port.');
}

const browser = await chromium.launch();
try {
  const tab = await browser.newPage();
  await tab.goto(`http://127.0.0.1:${address.port}/`);
  const report = await tab.evaluate(
    async ([functions, constructors, constants]) => {
      const global = globalThis as Record<string, unknown>;
      // The module is a thenable until it is ready, and resolving it a second
      // time never settles, so readiness is polled rather than awaited.
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const module = global.cv as Record<string, unknown> | undefined;
        if (module && typeof module.Mat === 'function') break;
        await new Promise((wake) => setTimeout(wake, 500));
      }
      const cv = global.cv as Record<string, unknown> | undefined;
      if (!cv) return {ready: false, missing: [], build: ''};
      const missing: string[] = [];
      for (const name of [...functions, ...constructors]) {
        if (typeof cv[name] !== 'function') missing.push(name);
      }
      for (const name of constants) {
        if (typeof cv[name] !== 'number') missing.push(name);
      }
      const build =
        typeof cv.getBuildInformation === 'function'
          ? String((cv.getBuildInformation as () => string)()).match(
              /Version control:\s*(\S+)/u
            )?.[1] ?? 'unknown'
          : 'unknown';
      return {ready: true, missing, build};
    },
    [
      [...REQUIRED_OPENCV_SYMBOLS.functions],
      [...REQUIRED_OPENCV_SYMBOLS.constructors],
      [...REQUIRED_OPENCV_SYMBOLS.constants]
    ] as [string[], string[], string[]]
  );

  if (!report.ready) {
    throw new Error('The pinned OpenCV.js build did not initialize in a browser.');
  }
  if (report.missing.length > 0) {
    throw new Error(
      `The pinned OpenCV.js build (${report.build}) does not provide: ${report.missing.join(', ')}.\n` +
        'The backend calls these. Pin a build that has them, or change what the backend calls.'
    );
  }
  const total =
    REQUIRED_OPENCV_SYMBOLS.functions.length +
    REQUIRED_OPENCV_SYMBOLS.constructors.length +
    REQUIRED_OPENCV_SYMBOLS.constants.length;
  process.stdout.write(
    `The pinned OpenCV.js build (${report.build}) provides all ${total} symbols the backend calls.\n`
  );
} finally {
  await browser.close();
  server.close();
}
