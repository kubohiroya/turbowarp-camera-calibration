# Third-party notices

`dist/camera-calibration.js` is a standalone bundle. Everything it needs at run time is inlined,
including the components listed below.

## OpenCV.js

`vendor/opencv.js` is built from [OpenCV](https://github.com/opencv/opencv) at tag `4.12.0`
by [`tools/opencv/build.sh`](tools/opencv/build.sh), in a pinned Emscripten container. It is not a
published npm package: the stock `@techstark/opencv-js` build never finishes initializing inside a
Web Worker, which is where the solver has to run, and it is 10.9 MB of general-purpose OpenCV for
the twenty-three symbols this extension calls. Ours is 3.85 MB and starts in a worker in 18 ms.

The build drops OpenCV's unconditional `-s DEMANGLE_SUPPORT=1`, a setting Emscripten has removed;
it only added demangled names to stack traces. Nothing else in OpenCV's sources is modified.

OpenCV is distributed under the Apache License 2.0:

- <https://github.com/opencv/opencv>
- <https://www.apache.org/licenses/LICENSE-2.0>

The WebAssembly is inlined into `dist/camera-calibration.js`, because a TurboWarp extension ships as
one standalone file and a separate `.wasm` would have nowhere to be fetched from. The runtime is
still initialized lazily: the worker is not created until a calibration starts, so loading the
extension or reading the backend reporter never touches it.

## Comlink

The worker is addressed through [Comlink](https://github.com/GoogleChromeLabs/comlink) at the exact
version `4.4.2`, distributed under the Apache License 2.0.

## Camera Source declarations

The contract this extension talks to is imported from
[`@kubohiroya/turbowarp-camera-source`](https://github.com/kubohiroya/turbowarp-camera-source) at the
exact version `0.8.0`, through its `./runtime` sub-entry: the camera lease, the runtime capability,
and the intrinsic profile document. That entry is declarations and a few string constants, and its
built form imports nothing at all, so nothing of Camera Source reaches
`dist/camera-calibration.js` beyond those constants. It is imported rather than copied because a
copy is checked against nothing: this repository's own hand-written copy named a registry method
Camera Source does not have, and every attempt to publish a profile failed for a reason that had
nothing to do with what the message said.

Camera Source is distributed under the Mozilla Public License 2.0.

## This extension

`@kubohiroya/turbowarp-camera-calibration` itself is distributed under the Mozilla Public License
2.0. See [`LICENSE`](LICENSE).
