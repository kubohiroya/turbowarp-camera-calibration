# Third-party notices

`dist/camera-calibration.js` is a standalone bundle. Everything it needs at run time is inlined,
including the components listed below.

## OpenCV.js

The chessboard detector and the `calibrateCamera` solver come from OpenCV.js, bundled through
[`@techstark/opencv-js`](https://github.com/TechStark/opencv-js) at the exact version
`4.12.0-release.1`. The version is pinned in `package.json` and is part of the backend identifier
that the `camera calibration backend` block reports, so a project can record which build produced a
profile.

OpenCV is distributed under the Apache License 2.0:

- <https://github.com/opencv/opencv>
- <https://github.com/TechStark/opencv-js>
- <https://www.apache.org/licenses/LICENSE-2.0>

The build is about 10.4 MB, which is why the calibration procedure lives in this extension rather
than in `@kubohiroya/turbowarp-camera-source`. A TurboWarp extension ships as one standalone file,
so a dynamic `import()` is inlined into the same file instead of being split into a separate chunk.
The import is still lazy at run time: the WebAssembly runtime is initialized on the first sample or
solve, and never when the extension loads or when the backend reporter is read.

## Camera Source declarations

The camera-sharing contract this extension talks to is imported from
[`@kubohiroya/turbowarp-camera-source`](https://github.com/kubohiroya/turbowarp-camera-source) at the
exact version `0.7.0`, through its `./runtime` sub-entry. That entry holds declarations and three
string constants and no code, so nothing of Camera Source is carried into
`dist/camera-calibration.js` beyond those constants. It is imported rather than copied because a
copy is checked against nothing: this repository's own hand-written copy named a registry method
Camera Source does not have, and every attempt to publish a profile failed for a reason that had
nothing to do with what the message said.

Camera Source is distributed under the Mozilla Public License 2.0.

## This extension

`@kubohiroya/turbowarp-camera-calibration` itself is distributed under the Mozilla Public License
2.0. See [`LICENSE`](LICENSE).
