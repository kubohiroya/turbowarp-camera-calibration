// SPDX-License-Identifier: MPL-2.0
/**
 * The solver, on a thread of its own.
 *
 * Detection costs about twenty milliseconds at 720p and a solve of twenty views
 * over a second. On the thread that draws the stage the first stutters the
 * camera preview and the second stops it outright -- and the operator is
 * holding a board in front of the camera while it happens, which is the worst
 * moment for the picture to freeze.
 *
 * The OpenCV this loads is built by tools/opencv/build.sh with
 * ENVIRONMENT=web,worker. The stock build never finishes initializing here:
 * measured past two minutes, with the worker's own timers no longer firing.
 */
import {expose} from 'comlink';
import openCvSource from '../../vendor/opencv.js?raw';
import {OpenCvChessboardCalibration} from './opencv-backend.js';
import {missingOpenCvSymbols} from './opencv-symbols.js';

const ready = (async () => {
  // Evaluated from source rather than imported as a module. It is an
  // Emscripten UMD that decides what it is running in by looking at what
  // globals exist, and a bundler's module wrapper is not an environment it
  // recognizes. Built with ENVIRONMENT=web,worker, it recognizes this one.
  const evaluate = new Function(
    'self',
    `${openCvSource}\nreturn cv;`
  ) as (scope: unknown) => unknown;
  const module = evaluate(self);
  const resolved = await (module as Promise<unknown>);
  const missing = missingOpenCvSymbols(resolved);
  if (missing.length > 0) {
    throw new Error(
      `The pinned OpenCV.js build does not provide: ${missing.join(', ')}.`
    );
  }
  return resolved;
})();

expose(new OpenCvChessboardCalibration(ready as Promise<never>));
