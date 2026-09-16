# Building the OpenCV.js this extension embeds

The stock `@techstark/opencv-js` build has two problems this extension cannot
work around.

**It does not finish initializing in a Web Worker.** Detection costs about 20 ms
at 720p and a solve of twenty views over a second; on the thread that draws the
stage, the first stutters the camera preview and the second freezes it. The
solver has to run on a worker. The stock build never gets there: its own timers
stop firing and it does not recover. The cause is in its source --

```js
ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
...
setImmediate = function Browser_emulated_setImmediate(func) {
  setImmediates.push(func);
  if (ENVIRONMENT_IS_WORKER) { ...; postMessage({target: emscriptenMainLoopMessageId}); }
```

-- Emscripten's worker branch expects the page to post its deferred work back to
it, which is its own worker harness protocol and not something a plain Web
Worker implements. Building with `ENVIRONMENT=web,worker` is what settles which
branch it takes.

**It is 10.9 MB of general-purpose OpenCV**, of which this extension calls
twenty-three symbols. `opencv_js.config.py` here lists exactly those.

## Running it

```bash
./tools/opencv/build.sh
```

Needs Docker. Nothing is installed on the host: the build runs in the pinned
`emscripten/emsdk` image against a pinned OpenCV tag, so the result depends on
those two and not on what this machine happens to have.

## Afterwards

`pnpm opencv:check` asks the built module, in a browser, whether it provides
every symbol the backend calls. That check exists because the stock build was
missing `findChessboardCorners`, `cornerSubPix` and `calibrateCamera` for five
releases while every test passed -- a whitelist is only correct relative to a
set of call sites, and the two drift.
