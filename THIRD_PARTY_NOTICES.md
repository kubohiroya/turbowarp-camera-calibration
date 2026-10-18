# Third-party notices

`dist/camera-calibration.js` is a standalone bundle. Everything it needs at run time is inlined,
including the runtime components listed below. The explicit `./editor-schema` entry also
depends on the first-party artifacts documented here; that entry is not inlined into the
extension bundle.

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
immutable Git artifact
`git+https://github.com/kubohiroya/turbowarp-camera-source.git#e11cc43ec35ff333bbefd50e8dcb461ee939c102`
(package version `0.17.0`), through its `./runtime` sub-entry: the camera lease, the runtime capability,
and the intrinsic profile document. That runtime entry contains declarations and a few string
constants; its built form imports nothing, so using this entry adds no camera controller or
device code to the bundle. The separate pure profile entry is described below. It is imported rather than copied because a
copy is checked against nothing: this repository's own hand-written copy named a registry method
Camera Source does not have, and every attempt to publish a profile failed for a reason that had
nothing to do with what the message said.

Camera Source is distributed under the Mozilla Public License 2.0.

Its pure `./profile` entry supplies calibration parsing and validation used by the runtime
bundle. Its `./editor-schema` entry supplies the shared profile Schemas used only by this
package's explicit editor entry and optional Source/Form registration.

## Extension Data Editor

The pure Schema engine and diagnostic helpers used by the explicit `./editor-schema` entry
and optional Source/Form registration
come from `@kubohiroya/turbowarp-extension-data-editor/schema`, at the immutable Git artifact
`git+https://github.com/kubohiroya/turbowarp-extension-data-editor.git#76fa1d50a3c188082ceef723ea018a9d8769ea6e`.
They do not introduce the RJSF UI into the runtime bundle. Extension Data Editor is distributed
under the Mozilla Public License 2.0.

## This extension

`@kubohiroya/turbowarp-camera-calibration` itself is distributed under the Mozilla Public License
2.0. See [`LICENSE`](LICENSE).
