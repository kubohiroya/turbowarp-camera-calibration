# Architecture

[日本語](architecture.ja.md)

## Package boundary

This extension owns the camera calibration *procedure*. The calibration
*profile contract* — schema, validation, and applicability against the current
capture conditions — belongs to
[TurboWarp-Camera-Source](https://github.com/kubohiroya/turbowarp-camera-source).

```text
turbowarp-camera-source      camera acquisition, lease, preview, capture conditions, profile contract
        ^                             ^
        | lease                       | publish profile
        |                             |
turbowarp-camera-calibration  ChArUco board drawing and detection, sampling, solve, hold-out validation, board pose
```

The boundary is placed here for a measured reason. Detecting a ChArUco board
and running `calibrateCameraExtended` needs OpenCV, and a TurboWarp extension is
distributed as a single standalone bundle: a dynamic `import()` is inlined into
that same file rather than split into a separate chunk. Placing the solver
inside Camera Source would therefore charge every camera consumer for the
solver, whether or not it ever calibrates. A startup feature flag cannot avoid
that, because a flag gates execution, not bytes.

The OpenCV carried here is built for this extension (`tools/opencv/`). The stock
build never finishes initializing in a Web Worker; built with
`ENVIRONMENT=web,worker` and a whitelist of the symbols listed in
`src/calibration/opencv-symbols.ts`, it starts in a worker and is 3.85 MB rather
than 10.9 MB. `pnpm opencv:check` asks the real build, in a browser, whether it
provides every listed symbol.

## Build outputs

The project keeps runtime behavior and compatibility metadata separate while
generating both from the same checked-in source definitions.

```text
src/index.ts + src/extension.ts
  -> vite-plugin-turbowarp-extension
  -> dist/camera-calibration.js

src/config.ts + src/block-definitions.json
  -> extension-api-manifest Vite plugin
  -> dist/extension-manifest.json
```

The manifest plugin runs in Vite's post-build phase. This preserves the
JavaScript plugin's single-output validation and adds the manifest only after
the TurboWarp bundle is complete.

## Extension API manifest v1

`schemas/extension-manifest.schema.json` is the normative JSON Schema.
`formatVersion` is `1` and must change when an incompatible manifest shape is
introduced.

The v1 contract contains:

- the TurboWarp extension ID;
- each block opcode and block type;
- each argument ID, argument type, and optional menu reference;
- each menu ID and whether it accepts reporter blocks.

Blocks, arguments, and menus are sorted by their identifiers before
serialization. Text, descriptions, default values, and static menu items are
intentionally excluded because they do not identify saved-project API
references.

## Module layout

```text
src/board/aruco.ts                 the DICT_4X4_50 marker bits, extracted from OpenCV
src/board/pattern.ts               board definitions and the SVG drawing, published via ./runtime
src/calibration/contract.ts        states, error codes, guidance, tilt directions, progress gates
src/calibration/types.ts           board, sample, solve result, backend seam
src/calibration/pose.ts            how obliquely a board was seen, and the spread of a set
src/calibration/profile.ts         the intrinsic profile, its validator, legacy adapter
src/calibration/camera-source.ts   the Camera Source capability client
src/calibration/controller.ts      one session per shared camera, manual and automatic
src/calibration/worker-backend.ts  main-thread side: owns the worker, reads frames, transfers pixels
src/calibration/opencv-worker.ts   the worker entry
src/calibration/opencv-backend.ts  detection, solve, hold-out validation, and board pose, in OpenCV
src/calibration/opencv-symbols.ts  the backend name and the symbol whitelist the build carries
src/runtime.ts                     the ./runtime sub-entry: declarations, constants, board drawing
src/runtime-capability.ts          the versioned capability other extensions drive
src/extension.ts                   block wiring and runtime lifecycle
```

Only `opencv-backend.ts` touches OpenCV, and it runs in the worker. The
controller reaches it through `CalibrationBackendFactory`, and
`worker-backend.ts` is the factory it is given in production: it reads the
frame on the thread that owns the video element and transfers the pixel buffer
across, because `cv.imread` needs a document the worker does not have. Tests
drive the whole procedure against a mock backend, so the solver is exercised
where it matters and nowhere else.

The board drawing lives beside the detector so that the board a page prints and
the board the detector looks for come from the same numbers. `pnpm board:check`
renders each board in a browser and confirms that its own detector finds every
corner and the other detectors find none.

## Calibration flow

1. Acquire a lease for one `cameraId` from Camera Source, wait for a frame that has a size, and fix the session to the resolution, device, mirroring, and capture conditions (resize mode, zoom, focus) the camera reports at that moment.
2. Collect ChArUco samples, each with at least six corners, rejecting blurred, near-duplicate, and wrong-board views. By hand, at most 40 are retained; automatic capture looks every 250 ms and, at 40, replaces the view most like the others.
3. Solve for the intrinsic matrix and distortion coefficients, holding about a fifth of the views back when there are enough, and refuse a set that was never tilted. Check both the fit error and, when at least two views were held back, the hold-out error against the session limit, whether the solve was asked for or automatic; automatic capture re-solves in the background until both are within it. The hold-out error allows for the pose fitted to each held-out view, and the profile's `quality.sampleCount` counts the views fitted.
4. On every view, and again before the solve lands, read the capture conditions. If they changed, end in `capture-condition-mismatch` at once rather than after the rest of the collection. Whether a stored profile fits the camera when a board pose is measured is Camera Source's verdict (`evaluateProfileCompatibility`), not a copy of its rules.
5. Publish the resulting intrinsic profile, with the capture conditions it was taken under, through the Camera Source profile contract.
6. Release the lease on solve, cancel, cleanup, device loss, project stop, project reload, and runtime disposal.

Intrinsic calibration and external pose stay separate. This extension never
supplies a world pose, and never substitutes identity for one that is missing.
`calibrateCameraExtended` also returns a per-view rotation and translation;
those describe where a moving board sat during collection, not where the camera
stands, so they are discarded rather than published as a pose.

Where a board that has stopped moving sits is a separate operation: the board
pose measurement takes its own lease, solves the pose with `solvePnP` and the
calibration already held, and gives the lease back. The result (`twcc/board-pose`)
is the board in the camera's frame, records whether its scale was `measured` or
`nominal`, and keeps the observed corners so a placement tool can re-solve it
into a shared frame. It is never merged into the intrinsic profile.

## One session per shared camera

`CameraCalibrationController` holds a `CameraCalibration` per `cameraId`. Each
one owns its lease, its samples, its profile, and its diagnostics. Cancelling or
cleaning up one camera never releases another camera's lease, and Camera Source
keeps sharing the underlying camera with other consumers.

Every asynchronous step carries the session's operation counter. A cancel
increments it, so a sample or a solve that resolves afterwards returns without
writing state and without releasing a lease that cancel already took over. This
is what keeps a slow response from resurrecting a cancelled session or
double-releasing a shared lease.

## Profile contract

`schemas/camera-intrinsics-v1.schema.json` describes the published profile.
Camera Source owns this contract
([kubohiroya/turbowarp-camera-source#14](https://github.com/kubohiroya/turbowarp-camera-source/issues/14));
this repository publishes it until that lands, and `schema` plus the schema
`$id` are the only fields that move when it does.

Validation is hand-written in `src/calibration/profile.ts` rather than taken
from a schema library, and `tests/calibration-profile.test.ts` fails when the
published schema and the validator drift apart. A profile is fully validated
before it becomes state: an invalid schema, a non-finite value, an unknown
camera or distortion model, a coefficient count that does not match its model, a
pairing credential, a profile for another camera, or a profile for another
capture size is rejected with its own error code and changes nothing.

The pre-migration `twrmc/camera-calibration` v1 profile is read through the same
entry point. Its `worldFromCameraMatrix` is dropped, and the quality it never
recorded stays absent rather than being invented.

## Dependency and version errors

The Camera Source capability is looked up on the runtime at the moment it is
needed, never cached at load time.

| Situation | Code |
|---|---|
| Camera Source is not loaded | `dependency-missing` |
| Camera Source has no profile registry | `api-version-mismatch` |
| Camera Source publishes another contract version | `api-version-mismatch` |
| No profile has been solved or imported | `not-calibrated` |
| The registry rejected the profile | `publish-failed` |

None of these is treated as success, and none of them rewrites the calibration
state. Publishing is not a session operation: a solved profile that Camera
Source could not accept is still solved, and a session that already failed is
not repaired by asking to publish.

## What loading this extension costs

Every block and the runtime capability are published as soon as the extension
registers. There is no switch.

Registering is cheap. The worker and its OpenCV runtime are created on first
use and never before, so a project that only reads the state or the backend
name never initializes it, and no camera lease is requested until a calibration
or a measurement starts. Those hold because of where the code creates things, not because of a
flag guarding them.

Rolling back means not loading this extension. A consumer that still has its
own calibration path falls back by leaving this one out of the project, which
is the same decision it was already making about whether to delegate.

## Drift detection

`dist/` is committed as a release artifact. `pnpm run check:dist` rebuilds both
files and fails when Git reports any modified, deleted, or untracked file below
`dist/`. This catches manifest and bundle drift in local checks and CI.
