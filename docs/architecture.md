# Architecture

[日本語](architecture.ja.md)

## Package boundary

This extension owns the camera calibration *procedure*. The calibration
*profile contract* — schema, validation, and applicability against the current
capture conditions — belongs to
[TurboWarp-Camera-Source](https://github.com/kubohiroya/turbowarp-camera-source).

```text
turbowarp-camera-source      camera acquisition, lease, preview, profile contract
        ^                             ^
        | lease                       | publish profile
        |                             |
turbowarp-camera-calibration  chessboard sampling, solve, reprojection error
```

The boundary is placed here for a measured reason. The OpenCV build required to
run `findChessboardCorners` and `calibrateCamera` is roughly 10 MB, and a
TurboWarp extension is distributed as a single standalone bundle: a dynamic
`import()` is inlined into that same file rather than split into a separate
chunk. Placing the solver inside Camera Source would therefore charge every
camera consumer for the solver, whether or not it ever calibrates. A startup
feature flag cannot avoid that, because a flag gates execution, not bytes.

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
config/feature-flags.ts          startup-fixed flags, calibration OFF by default
src/calibration/types.ts         board, sample, solve result, backend seam
src/calibration/profile.ts       the intrinsic profile, its validator, legacy adapter
src/calibration/camera-source.ts the Camera Source capability client
src/calibration/controller.ts    one session per shared camera
src/calibration/opencv-backend.ts the pinned OpenCV solver, created on first use
src/extension.ts                 block wiring and runtime lifecycle
```

Only `opencv-backend.ts` touches OpenCV, and the controller reaches it through
`CalibrationBackendFactory`. Tests drive the whole procedure against a mock
backend, so the solver is exercised where it matters and nowhere else.

## Calibration flow

1. Acquire a lease for one `cameraId` from Camera Source and fix the session to the resolution, device, and mirroring the camera reports at that moment.
2. Collect chessboard samples, rejecting low-quality and near-duplicate views. Between 8 and 40 samples are retained.
3. Solve for the intrinsic matrix and distortion coefficients, and check the RMS reprojection error against the session limit.
4. Publish the resulting intrinsic profile through the Camera Source profile contract.
5. Release the lease on solve, cancel, cleanup, device loss, project stop, project reload, and runtime disposal.

Intrinsic calibration and external pose stay separate. This extension never
supplies a world pose, and never substitutes identity for one that is missing.
OpenCV also returns a per-view rotation and translation from `calibrateCamera`;
those describe where the board sat, not where the camera stands, so they are
discarded rather than published as a pose.

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

## Feature flag

`config/feature-flags.ts` freezes `cameraCalibrationV1` at module evaluation,
default OFF. With the flag OFF the extension publishes only the state reporter,
which answers `idle`; every calibration command refuses explicitly; no lease is
requested and the OpenCV runtime is never initialized. This is the rollback
path: the previous behavior is one flag away, and the consumer side can fall
back to its own calibration without loading this extension at all.

## Drift detection

`dist/` is committed as a release artifact. `pnpm run check:dist` rebuilds both
files and fails when Git reports any modified, deleted, or untracked file below
`dist/`. This catches manifest and bundle drift in local checks and CI.
