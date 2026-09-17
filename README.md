# TurboWarp-Camera-Calibration

[English](README.md) | [日本語](README.ja.md)

A TurboWarp extension that calibrates a camera shared through
[TurboWarp-Camera-Source](https://github.com/kubohiroya/turbowarp-camera-source)
and publishes the resulting intrinsic calibration profile.

**User guide:** [English](https://kubohiroya.github.io/turbowarp-camera-calibration/)

> [!NOTE]
> The calibration path ships behind a startup feature flag that defaults to OFF.
> See [Enabling calibration](#enabling-calibration).

## What it does

- Runs a chessboard calibration session against a camera leased from Camera Source, at the camera's real capture resolution.
- Solves the camera intrinsic matrix and distortion coefficients, and reports the RMS reprojection error.
- Publishes an intrinsic calibration profile that AR, photogrammetry, and motion capture extensions can share.

Intrinsic calibration and external pose stay separate. A profile describes one
camera's optics; it never carries a world pose, and a pose that was not measured
is never filled in with identity.

## Why calibration lives in its own extension

The OpenCV build required to detect a chessboard and solve `calibrateCamera` is
roughly 10 MB. TurboWarp extensions ship as a single standalone bundle, so a
dynamic `import()` does not split that weight out: it is inlined into the same
file. Keeping the solver here lets Camera Source stay a small, dependency-free
capability that every camera consumer can afford to load. A startup flag cannot
substitute for this split, because a flag gates execution, not bytes.

The responsibilities split as follows.

| Package | Owns |
|---|---|
| `@kubohiroya/turbowarp-camera-source` | Camera acquisition, lease sharing, preview, and the calibration profile contract (schema, validation, applicability) |
| `@kubohiroya/turbowarp-camera-calibration` | The calibration procedure: chessboard sampling, solving, and profile publication |

## Documentation and block icon

This extension publishes its English user documentation with GitHub Pages.

- `docsURI` points to `https://kubohiroya.github.io/turbowarp-camera-calibration/`.
- `blockIconURI` is a self-contained chessboard SVG encoded as `data:image/svg+xml;base64,...`.

## Requirements and safety

- TurboWarp Desktop, Web, and Packager.
- `@kubohiroya/turbowarp-camera-source` must be loaded first; this extension never opens a camera itself.
- A printed chessboard calibration target, flat and unglossy. The board arguments count **inner corners**, not printed squares: a 10×7 square board is `9` by `6`.
- Must run without the sandbox.

> [!IMPORTANT]
> This extension must run without the sandbox because it reaches the Camera
> Source capability through the TurboWarp runtime. Load unsandboxed extension
> code only from a source you trust.

Camera frames are read only to detect the chessboard. Nothing is uploaded, and a
profile that carries a pairing credential is rejected rather than stored.

### Capture conditions for a usable result

| Condition | Why |
|---|---|
| At least 8 accepted samples, at most 40 | Fewer views leave the distortion terms under-determined |
| Vary the board angle by roughly 20°–45° across samples | Views that are all fronto-parallel cannot separate focal length from distance |
| Vary the distance, and fill different parts of the frame, including the corners | Distortion is strongest away from the image center |
| Keep the whole board inside the frame and in focus | A partially visible or blurred board is rejected as `board-not-found` or `sample-low-quality` |
| Do not change resolution, camera device, mirroring, focus, or zoom during a session | The session is fixed to the resolution it started with and rejects changed conditions |

Verify a finished calibration against images that were not part of the solve. A
low reprojection error on the calibration samples alone does not prove the
result generalizes.

## When the solver loads

Every block is in the palette as soon as the extension is registered, and the
runtime capability is on the runtime. Nothing is switched on separately.

The OpenCV runtime is not loaded with the extension. It is created on the first
sample or solve and never before, so a project that only reads
`camera calibration state` or `camera calibration backend` pays nothing for it.
No camera lease is taken until a calibration starts.

## Installation

### Ready-to-use JavaScript

1. Download [`dist/camera-calibration.js`](dist/camera-calibration.js?raw=1).
2. Open **Extensions** in TurboWarp.
3. Choose **Custom Extension** and load the file.
4. Enable **Run extension without sandbox**.

The reviewed JavaScript build is committed to this repository, so users do not
need Node.js to install the extension. The build inlines OpenCV.js and is
therefore about 11 MB.

### npm package

Install an exact version that you have reviewed:

```bash
pnpm add --save-exact @kubohiroya/turbowarp-camera-calibration@0.12.0
```

Load the standalone bundle from:

```text
node_modules/@kubohiroya/turbowarp-camera-calibration/dist/camera-calibration.js
```

A version-pinned CDN URL is:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-camera-calibration@0.12.0/dist/camera-calibration.js
```

## Quick start

1. Load Camera Source and start the shared camera you want to calibrate.
2. Load this extension with the calibration flag enabled.
3. Start a session, capture views of the board from different angles and distances, then solve.

```text
start shared camera [default]
start camera [default] calibration [calibration-1] board [9] by [6] square [0.025] m max error [1.5] px
repeat until <camera [default] calibration sample count = 12>
  add calibration sample for camera [default]
solve calibration for camera [default]
publish calibration profile for camera [default]
```

`add calibration sample` reports why a view was refused, so a project can show
`camera [default] calibration error code` and ask the user to move the board.

## Calibration profile

The solved profile is intrinsics only:

```json
{
  "schema": "camerasource/camera-intrinsics",
  "version": 1,
  "calibrationId": "calibration-1",
  "cameraId": "camera-1",
  "cameraModel": "pinhole",
  "imageWidth": 800,
  "imageHeight": 600,
  "imageState": "raw",
  "intrinsicMatrix": [700, 0, 400, 0, 700, 300, 0, 0, 1],
  "distortionModel": "opencv-plumb-bob",
  "distortionCoefficients": [0.01, -0.02, 0, 0, 0],
  "quality": {"sampleCount": 8, "reprojectionErrorPx": 0.75},
  "calibratedAt": "2026-09-13T12:00:00.000Z"
}
```

- `intrinsicMatrix` is row-major `[fx, 0, cx, 0, fy, cy, 0, 0, 1]`, in pixels of `imageWidth` × `imageHeight`.
- `imageState` is `raw`: the coefficients still have to be applied. `undistorted` states that the image is already corrected and they must not be applied again.
- `distortionCoefficients` are in OpenCV order and their count must match `distortionModel`.
- `quality` is absent when the producer did not measure it.
- Preview mirroring is a display concern. Profile coordinates are always the unmirrored capture coordinates.

[`schemas/camera-intrinsics-v1.schema.json`](schemas/camera-intrinsics-v1.schema.json)
is the published schema. Camera Source owns this contract
([kubohiroya/turbowarp-camera-source#14](https://github.com/kubohiroya/turbowarp-camera-source/issues/14));
until it ships, the schema is published from this repository, and `schema` and
the schema `$id` are the only fields that move when it does.

Profiles written by `@kubohiroya/turbowarp-realtime-motion-capture`
(`twrmc/camera-calibration` v1) are accepted on import. Their
`worldFromCameraMatrix` is dropped rather than reinterpreted, because a world
pose is not part of an intrinsic profile.

## Block reference

The block reference is generated from
[`src/block-definitions.json`](src/block-definitions.json). Do not edit the
generated section manually.

<!-- BEGIN GENERATED BLOCKS -->

### `start camera [CAMERA_ID] calibration [CALIBRATION_ID] board [COLUMNS] by [ROWS] square [SQUARE_METERS] m marker [MARKER_METERS] m max error [MAX_ERROR_PX] px`

Leases one shared Camera Source camera and fixes its real capture resolution for a chessboard calibration session. The board is a ChArUco target: a chessboard with an ArUco marker inside each light square, so a view that runs off the frame still contributes the corners it shows. The board is measured in inner corners, not printed squares.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `startCameraCalibration` |
| `CAMERA_ID` | String, default: `default` |
| `CALIBRATION_ID` | String, default: `calibration-1` |
| `COLUMNS` | Number, default: `9` |
| `ROWS` | Number, default: `6` |
| `SQUARE_METERS` | Number, default: `0.025` |
| `MARKER_METERS` | Number, default: `0.018` |
| `MAX_ERROR_PX` | Number, default: `1.5` |

### `add calibration sample for camera [CAMERA_ID]`

Detects the complete board in the current shared frame and retains it when its quality and its novelty against the retained samples both pass.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `addCameraCalibrationSample` |
| `CAMERA_ID` | String, default: `default` |

### `start automatic calibration capture for camera [CAMERA_ID]`

Watches the shared frame and retains views as the board reaches positions worth retaining, re-solving in the background as the set grows and finishing the session once the answer reproduces views it was not fitted to. Use after starting a session; a frame that cannot be used leaves guidance rather than an error.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `startAutomaticCameraCalibration` |
| `CAMERA_ID` | String, default: `default` |

### `stop automatic calibration capture for camera [CAMERA_ID]`

Hands the shutter back. The session stays open with everything collected so far, so sampling and solving can continue by hand.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `stopAutomaticCameraCalibration` |
| `CAMERA_ID` | String, default: `default` |

### `automatic capture running for camera [CAMERA_ID]?`

Reports whether the shutter is watching that camera on its own. It stops by itself when the session finishes, when the sample limit is reached, and when the camera goes away.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `automaticCameraCalibration` |
| `CAMERA_ID` | String, default: `default` |

### `camera calibration guidance [CAMERA_ID]`

Returns what the operator should do next while automatic capture runs: show-the-board, wrong-board, hold-steadier, move-or-tilt, tilt-more, keep-going, vary-more, solving, or complete. Empty when the shutter is not watching. This is not an error: most frames are declined, because most of the time the board is between two useful positions. wrong-board means markers are in frame that do not make the board being calibrated. vary-more means the answer reproduces the views it was fitted to and not the ones it was not, which more of the same views cannot fix.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationGuidance` |
| `CAMERA_ID` | String, default: `default` |

### `camera calibration novelty [CAMERA_ID]`

Returns how much the view automatic capture is looking at would add, from 0 to 1. One is a view turned as far from every retained view as the whole set is required to spread; zero means nothing usable is in frame. Measured in tilt, not in where the corners landed: sliding the board moves every corner and adds nothing a solve can use. Meant to drive something continuous -- a tone, a bar, a click rate -- because the operator is holding the board and not reading the screen.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationNovelty` |
| `CAMERA_ID` | String, default: `default` |

### `camera calibration tilt direction [CAMERA_ID]`

Returns which way the board still has to be turned: top-near, top-far, left-near, right-near, or empty outside a live session. The direction least represented in what has been collected, so that "tilt it more" -- an instruction the operator has to interpret -- becomes one they can carry out.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationTiltDirection` |
| `CAMERA_ID` | String, default: `default` |

### `camera calibration progress [CAMERA_ID]`

Returns how far the session has come, from 0 to 16. Four gates of four steps: enough views to solve from, enough tilt among them, enough views to hold some back, and the answer holding up on the views it was not fitted to. Counted in order and stopped at the first unfinished gate, so the number says which gate is being worked on as well as how far into it. Never falls. Sixteen because that is enough to sound like progress and few enough to hear as distinct.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationProgress` |
| `CAMERA_ID` | String, default: `default` |

### `solve calibration for camera [CAMERA_ID]`

Solves the intrinsic matrix and distortion coefficients from at least eight accepted samples, then releases the camera lease. No external pose is produced.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `solveCameraCalibration` |
| `CAMERA_ID` | String, default: `default` |

### `cancel calibration for camera [CAMERA_ID]`

Releases the camera lease and the retained samples while preserving the last validated profile.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `cancelCameraCalibration` |
| `CAMERA_ID` | String, default: `default` |

### `cleanup calibration for camera [CAMERA_ID]`

Releases the session and also clears the in-memory calibration profile for that camera.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `cleanupCameraCalibration` |
| `CAMERA_ID` | String, default: `default` |

### `publish calibration profile for camera [CAMERA_ID]`

Registers the solved profile with Camera Source, which owns the profile contract. Reports an explicit error when Camera Source is absent, speaks another contract version, or has no profile to publish.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `publishCameraCalibration` |
| `CAMERA_ID` | String, default: `default` |

### `measure camera [CAMERA_ID] board pose board [COLUMNS] by [ROWS] square [SQUARE_METERS] m marker [MARKER_METERS] m scale [SCALE_SOURCE]`

Measures where the board is, in the camera's own frame, using the calibration already solved for that camera. Take it after the board is where it will stay: a calibration needs the board to move, so while one is being collected there is no single position to report. This is not a world pose. Scale comes entirely from the square size, so say whether that was measured or nominal.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `measureCameraBoardPose` |
| `CAMERA_ID` | String, default: `default` |
| `COLUMNS` | Number, default: `9` |
| `ROWS` | Number, default: `6` |
| `SQUARE_METERS` | Number, default: `0.025` |
| `MARKER_METERS` | Number, default: `0.018` |
| `SCALE_SOURCE` | String, default: `nominal` |

### `import calibration profile [JSON] for camera [CAMERA_ID]`

Imports a calibration profile after schema, credential, and applicability checks. Pre-migration profiles are accepted and their world pose is dropped rather than reinterpreted.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `importCameraCalibration` |
| `JSON` | String, default: `{}` |
| `CAMERA_ID` | String, default: `default` |

### `calibration profile [JSON] valid for camera [CAMERA_ID]?`

Validates a profile and records why it failed, without replacing the stored profile.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `cameraCalibrationJsonValid` |
| `JSON` | String, default: `{}` |
| `CAMERA_ID` | String, default: `default` |

### `camera [CAMERA_ID] calibration ready?`

Reports whether a fixed-resolution session for that camera can accept a sample or solve.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `cameraCalibrationReady` |
| `CAMERA_ID` | String, default: `default` |

### `camera calibration state [CAMERA_ID]`

Returns the calibration session state for one shared Camera Source camera: idle, acquiring-camera, sampling, ready, solving, solved, cancelling, or error. A camera that has never been calibrated reports idle.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationState` |
| `CAMERA_ID` | String, default: `default` |

### `camera calibration backend`

Returns the pinned solver identifier. Reading it does not load the solver.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationBackend` |

### `camera [CAMERA_ID] calibration sample count`

Returns the accepted sample count for the current or last solved session.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationSampleCount` |
| `CAMERA_ID` | String, default: `default` |

### `camera [CAMERA_ID] calibration sample quality`

Returns the latest accepted sample's combined board coverage and sharpness score, from zero to one.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationSampleQuality` |
| `CAMERA_ID` | String, default: `default` |

### `camera [CAMERA_ID] calibration reprojection error px`

Returns the RMS reprojection error in pixels for the latest solve or imported profile.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationReprojectionError` |
| `CAMERA_ID` | String, default: `default` |

### `camera [CAMERA_ID] calibration pose spread`

Returns how varied the angles of the collected samples are. Zero means every sample was taken from the same direction, which cannot be solved from: focal length and distance stay inseparable. Solving is refused below the required spread.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationPoseSpread` |
| `CAMERA_ID` | String, default: `default` |

### `camera [CAMERA_ID] calibration holdout error px`

Returns the RMS reprojection error over the samples the solve was not fitted to. Compare it with the reprojection error: the two agreeing is the evidence that the calibration generalizes, and the two disagreeing says the set was too small or too alike.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationHoldoutErrorPx` |
| `CAMERA_ID` | String, default: `default` |

### `camera [CAMERA_ID] calibration holdout sample count`

Returns how many samples were held back from the solve. Zero means nothing was validated, so the holdout error says nothing.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationHoldoutSampleCount` |
| `CAMERA_ID` | String, default: `default` |

### `camera [CAMERA_ID] calibration error code`

Returns a stable code for dependency, board, camera, sample, solve, reprojection, profile, or publication errors, or an empty string.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationErrorCode` |
| `CAMERA_ID` | String, default: `default` |

### `camera [CAMERA_ID] calibration error`

Returns the detailed calibration diagnostic for that camera.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationError` |
| `CAMERA_ID` | String, default: `default` |

### `camera [CAMERA_ID] calibration profile JSON`

Exports the stored intrinsic profile for that camera, or an empty string when none exists.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationJson` |
| `CAMERA_ID` | String, default: `default` |

### `camera [CAMERA_ID] board pose JSON`

Returns the last measured board pose as JSON, or an empty string when none was measured. The pose is the board in the camera's frame, never a world pose, and it carries the observed corners and whether its scale was measured or nominal so it can be re-solved elsewhere.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraBoardPoseJson` |
| `CAMERA_ID` | String, default: `default` |

<!-- END GENERATED BLOCKS -->

## Important behavior

| Situation | Behavior |
|---|---|
| Calibration flag is OFF | Only the state reporter is published and it returns `idle`; commands refuse with an explicit error |
| Camera Source is not loaded | `dependency-missing`; the extension never opens its own camera |
| Camera Source has no profile registry, or another contract version | `api-version-mismatch` on publish; never a silent success, and the solved profile is kept |
| Camera calibration has not run | The state reporter returns `idle` and the profile reporter returns an empty string |
| Board not found, blurred, or too similar to a kept view | The sample is refused with its own error code and the session stays ready |
| Resolution, device, or mirroring changes mid-session | `resolution-mismatch` or `capture-condition-mismatch` |
| Reprojection error exceeds the session limit | `reprojection-too-high`; no profile is stored and more samples can be added |
| Profile belongs to another camera or another capture size | `calibration-not-applicable`, rejected before any state changes |
| Solve succeeds | The camera lease is released immediately |
| Project stop, project reload, runtime disposal | Every session is cancelled and every camera lease is released |
| Invalid input | Rejected before any session state changes, including a restart with a mistyped board |

Each shared camera has its own session, profile, and diagnostics. Cancelling one
camera never releases another camera's lease or stops another consumer of the
same shared camera.

## Running a calibration from another extension

Blocks are a palette for a project, not an API between extensions. An extension
that needs to run a calibration -- because it used to own one and now delegates
it -- reaches a versioned capability on the VM runtime instead.

```ts
import {
  readCameraCalibrationCapability
} from '@kubohiroya/turbowarp-camera-calibration/runtime';

const calibration = readCameraCalibrationCapability(Scratch.vm.runtime);
if (!calibration) {
  // Not loaded, or loaded with the calibration feature off. Either way there is
  // no procedure to drive, and the caller has to say so rather than wait.
  return;
}

await calibration.requireVersion(1).start({
  cameraId: 'stage-left',
  calibrationId: 'session-1',
  board: {columns: 9, rows: 6, squareSizeMeters: 0.025},
  maximumReprojectionErrorPx: 1.5
});
```

The sub-entry holds declarations and two constants. It pulls in none of the
extension, so importing it costs a consumer nothing at run time -- in
particular, not the OpenCV build.

`requireVersion` refuses a version this build does not implement, out loud. That
is a different answer from the capability being absent: the extension is loaded
and cannot do what was asked, which needs a different message to the operator.

The capability drives the same per-camera sessions the blocks drive, and
addresses cameras the same way: an empty or blank `cameraId` is the camera the
blocks call `default`. A delegated calibration and one started from the palette
are one session, not two views of one camera that disagree.

Profiles are a separate matter. Camera Source owns the profile contract, so a
consumer that only wants to read, store, or check a profile talks to
`@kubohiroya/turbowarp-camera-source` and does not need this extension at all.

## Integration

| Consumer | Relationship |
|---|---|
| `@kubohiroya/turbowarp-camera-source` | Required provider: supplies the camera lease and owns the profile contract |
| `@kubohiroya/turbowarp-realtime-motion-capture` | Optional consumer of the published calibration profile |
| `@kubohiroya/turbowarp-ar` | Optional consumer of the published calibration profile |
| `@kubohiroya/turbowarp-photogrammetry` | Optional consumer of the published calibration profile |

Dependencies point from the consumer to the provider. Do not document
private-field access as an integration API.

## Compatibility

| Identifier | Value | Stability |
|---|---|---|
| Product name | `TurboWarp-Camera-Calibration` | Human-facing |
| Repository | `kubohiroya/turbowarp-camera-calibration` | Current source location |
| npm package | `@kubohiroya/turbowarp-camera-calibration` | Public package contract |
| Extension ID | `kubohiroyacameracalibration` | Stored in SB3; migration required to change |
| Stored profile schema | `camerasource/camera-intrinsics` v1 | Read and written by this extension |
| Published profile schema | `twcs/camera-intrinsics` v1 | Owned by Camera Source |
| Runtime capability | `kubohiroyaCameraCalibrationCapability` v1 | Read from the VM runtime |
| Solve backend | `opencv-js-wasm-4.12.0` | Pinned; reported by a block |

Document schema-aware migrations when an extension ID or opcode changes. Never
instruct users to replace JavaScript alone when stored identifiers have changed.

## Development

Use Node.js `>=22.18.0` and the pnpm version declared by `packageManager`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

Useful commands:

| Command | Purpose |
|---|---|
| `pnpm dev` | Rebuild while source files change |
| `pnpm test` | Run tests |
| `pnpm docs` | Regenerate block documentation |
| `pnpm check:dist` | Verify committed build artifacts |
| `pnpm pack:check` | Inspect the npm package |
| `pnpm release:check` | Dry-run the release |

## Release

1. Update `CHANGELOG.md` when present.
2. Update the version in `package.json`.
3. Run `pnpm check`.
4. Merge the release PR.
5. Create tag `v<version>` on the verified commit.
6. Publish the same version to npm.
7. Verify GitHub Release, npm tarball, GitHub Pages, `docsURI`, block icon, and CDN artifacts.

## License

[Mozilla Public License 2.0](LICENSE) (SPDX: `MPL-2.0`).

Third-party components are listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). The bundle inlines OpenCV.js
`4.12.0-release.1`, distributed under the Apache License 2.0.
