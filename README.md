# TurboWarp-Camera-Calibration

[English](README.md) | [日本語](README.ja.md)

A TurboWarp extension that calibrates a camera shared through
[TurboWarp-Camera-Source](https://github.com/kubohiroya/turbowarp-camera-source)
against a ChArUco board and publishes the resulting intrinsic calibration profile.

**User guide:** [English](https://kubohiroya.github.io/turbowarp-camera-calibration/)

## What it does

- Runs a ChArUco calibration session against a camera leased from Camera Source, at the camera's real capture resolution.
- Takes the samples itself if asked: an automatic shutter watches the frame, tells the operator what to do next, re-solves in the background, and finishes once the answer holds on views it was not fitted to.
- Solves the camera intrinsic matrix and distortion coefficients on a Web Worker, and reports both the fit and the hold-out RMS reprojection error.
- Records the capture conditions the camera reported, so Camera Source can later decide whether the profile fits the camera in front of it.
- Publishes an intrinsic calibration profile that AR, photogrammetry, and motion capture extensions can share.
- Draws the boards it looks for, so a page or an app that shows or prints one shows exactly that board.
- Measures where a board that has stopped moving is, in the camera's own frame, for placement tools to re-solve into a shared frame.

Intrinsic calibration and external pose stay separate. A profile describes one
camera's optics; it never carries a world pose, and a pose that was not measured
is never filled in with identity.

## Why calibration lives in its own extension

Detecting a ChArUco board and solving `calibrateCameraExtended` needs OpenCV.
TurboWarp extensions ship as a single standalone bundle, so a dynamic `import()`
does not split that weight out: it is inlined into the same file. Keeping the
solver here lets Camera Source stay a small, dependency-free capability that
every camera consumer can afford to load.

The OpenCV inside is not the stock build. The stock build never finishes
initializing in a Web Worker, which is where the solver has to run to keep the
camera preview moving. It is rebuilt from OpenCV `4.12.0` with
`ENVIRONMENT=web,worker` and a whitelist of the symbols this extension calls:
3.85 MB instead of 10.9 MB. See [`tools/opencv/`](tools/opencv/) and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

The responsibilities split as follows.

| Package | Owns |
|---|---|
| `@kubohiroya/turbowarp-camera-source` | Camera acquisition, lease sharing, preview, capture conditions, and the calibration profile contract (schema, validation, applicability) |
| `@kubohiroya/turbowarp-camera-calibration` | The calibration procedure: board definitions and drawing, manual and automatic sampling, solving and hold-out validation, board pose measurement, and profile publication |

## Documentation and block icon

This extension publishes its English user documentation with GitHub Pages.

- `docsURI` points to `https://kubohiroya.github.io/turbowarp-camera-calibration/`.
- `blockIconURI` is a self-contained chessboard SVG encoded as `data:image/svg+xml;base64,...`.

## Requirements and safety

- TurboWarp Desktop, Web, and Packager.
- `@kubohiroya/turbowarp-camera-source` must be loaded first; this extension never opens a camera itself.
- A ChArUco board, flat and unglossy: a chessboard with a marker from OpenCV's `DICT_4X4_50`, numbered from 0, inside each light square. The board arguments count **inner corners**, not printed squares: a 10×7 square board is `9` by `6`. Draw it with the [`./runtime`](#drawing-the-board) helpers rather than another generator, so the markers match.
- Must run without the sandbox.

> [!IMPORTANT]
> This extension must run without the sandbox because it reaches the Camera
> Source capability through the TurboWarp runtime. Load unsandboxed extension
> code only from a source you trust.

Camera frames are read only to detect the board. Nothing is uploaded, and a
profile that carries a pairing credential is rejected rather than stored.

### Capture conditions for a usable result

| Condition | Why |
|---|---|
| At least 8 accepted samples to solve by hand; the automatic path collects 12 or more and holds about a fifth back | Fewer views leave the distortion terms under-determined, and a solve with nothing held back cannot be validated |
| Tilt the board roughly 20°–45° in different directions across samples | Views that are all fronto-parallel cannot separate focal length from distance. Sliding the board sideways does not help, and a set that was never tilted is refused as `sample-poses-degenerate` |
| Vary the distance, and fill different parts of the frame, including the corners | Distortion is strongest away from the image center. The markers name the corners, so a board that runs off the frame still contributes the corners it shows |
| Keep the board in focus and hold it still for a moment | A blurred view is refused as `sample-low-quality`, or the automatic path asks to `hold-steadier` |
| Do not change resolution, camera device, mirroring, resize mode, focus, or zoom during a session | The session is fixed to the conditions it started with; a change ends it with `capture-condition-mismatch` rather than a profile that does not fit the camera |
| Prefer a printed board or a 1:1 display; avoid projectors | Keystone correction, oblique projection, and the projector's own lens distort the board in ways the reprojection error does not show |

Verify a finished calibration against images that were not part of the solve.
A low reprojection error on the calibration samples alone does not prove the
result generalizes; that is what the hold-out error is for.

## Automatic capture

The operator is holding a board at arm's length and cannot also press a button
at the right moment. `start automatic calibration capture` hands the shutter to
the extension:

- Every 250 ms it looks at the shared frame and retains the view only when it would be accepted.
- Once there are enough views it solves in the background, without releasing the camera or changing the state.
- It finishes the session when the hold-out error is within the session limit. The fit error alone never finishes it.
- At 40 views it does not stop: the view most like the others is dropped for the new one.

A frame that cannot be used is not an error on this path. It leaves guidance for
the operator instead:

| Guidance | Meaning |
|---|---|
| `show-the-board` | Nothing is visible |
| `wrong-board` | Markers are visible but fewer than six corners of the selected board: another board, or the right one at an unreadable angle |
| `hold-steadier` | The view is blurred |
| `move-or-tilt` | The view is too much like one already kept |
| `tilt-more` | The kept views are not tilted enough to solve from |
| `keep-going` | The background solve cannot reproduce even its own samples yet |
| `vary-more` | It reproduces its own samples but not the held-back ones: the views are too alike |
| `solving` / `complete` | Working, or done |

Three reporters let a project give continuous cues to someone who is not looking
at the screen:

- **tilt direction**: `top-near`, `top-far`, `left-near`, or `right-near`, whichever direction the kept views reach least.
- **novelty**: 0 to 1, how much the view in front of the camera would add. It is measured on tilt, so sliding the board does not raise it.
- **progress**: 0 to 16, four gates of four steps — enough views to solve, enough tilt among them, enough to hold some back, and an answer that holds on the held-back views. It counts up to the first gate not yet passed, and never goes down.

## When the solver loads

Every block is in the palette as soon as the extension is registered, and the
runtime capability is on the runtime. Nothing is switched on separately.

The Worker and its OpenCV runtime are created on first use, never at load time,
so a project that only reads `camera calibration state` or
`camera calibration backend` pays nothing for them. No camera lease is taken
until a calibration or a measurement starts. Frames cross to the Worker as
transferred pixel buffers, not copies.

## Installation

### Ready-to-use JavaScript

1. Download [`dist/camera-calibration.js`](dist/camera-calibration.js?raw=1).
2. Open **Extensions** in TurboWarp.
3. Choose **Custom Extension** and load the file.
4. Enable **Run extension without sandbox**.

The reviewed JavaScript build is committed to this repository, so users do not
need Node.js to install the extension. The build inlines the custom OpenCV.js
and is about 3.9 MB (about 1.5 MB gzip).

### npm package

Install an exact version that you have reviewed:

```bash
pnpm add --save-exact @kubohiroya/turbowarp-camera-calibration@0.14.0
```

Load the standalone bundle from:

```text
node_modules/@kubohiroya/turbowarp-camera-calibration/dist/camera-calibration.js
```

A version-pinned CDN URL is:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-camera-calibration@0.14.0/dist/camera-calibration.js
```

## Quick start

1. Load Camera Source and start the shared camera you want to calibrate.
2. Load this extension.
3. Start a session with the board you are holding, and let the shutter run.

```text
start shared camera [default]
start camera [default] calibration [calibration-1] board [9] by [6] square [0.025] m marker [0.018] m max error [1.5] px
start automatic calibration capture for camera [default]
repeat until <not <automatic capture running for camera [default]?>>
  say (camera calibration guidance [default])
if <(camera calibration state [default]) = [solved]> then
  publish calibration profile for camera [default]
```

To take the samples by hand instead:

```text
start camera [default] calibration [calibration-1] board [9] by [6] square [0.025] m marker [0.018] m max error [1.5] px
repeat until <(camera [default] calibration sample count) = 12>
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
  "quality": {"sampleCount": 12, "reprojectionErrorPx": 0.75},
  "capture": {"resizeMode": "none", "zoom": 1, "focusMode": "manual", "focusDistance": 0.4},
  "device": {"label": "USB Camera"},
  "calibratedAt": "2026-09-13T12:00:00.000Z"
}
```

- `intrinsicMatrix` is row-major `[fx, 0, cx, 0, fy, cy, 0, 0, 1]`, in pixels of `imageWidth` × `imageHeight`.
- `imageState` is `raw`: the coefficients still have to be applied. `undistorted` states that the image is already corrected and they must not be applied again.
- `distortionCoefficients` are in OpenCV order and their count must match `distortionModel`.
- `quality` is absent when the producer did not measure it.
- `capture` holds the settings that change how the lens projects (`resizeMode`, `zoom`, `focusMode`, `focusDistance`, `frameRate`, `facingMode`), as Camera Source reported them when the session started. A value the camera did not report is left out, never guessed. Without it, Camera Source can only answer `undetermined` when asked whether the profile fits.
- `device` is what the camera called itself: a hint for matching, never proof.
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

**A calibration leaves the PC as a ROS `camera_info` YAML file, not as this JSON.**
The JSON above is how this extension holds a profile. To hand one to another
machine or tool, publish it and read Camera Source's
`camera profile YAML for [CAMERA_ID]`: the standard part is what ROS and
OpenCV-based tools load, and the members compatibility is decided on travel
under `turbowarp_camera_source`. `import calibration profile` reads that file --
and Camera Source's `twcs/camera-intrinsics` JSON -- through Camera Source's own
reader (`@kubohiroya/turbowarp-camera-source/profile`), so a file is accepted or
refused here for the same reasons it is there. A fisheye (`equidistant`)
calibration has no model in this extension and is refused rather than
relabelled.

## Board pose

A calibration needs the board to move, and a board that stays put is exactly the
arrangement that cannot be calibrated. So measuring where a board is happens
separately, after calibration, once the board is where it will stay.
`measure camera [ID] board pose` takes a lease, solves the pose with the
calibration already held for that camera, and gives the lease straight back.

```json
{
  "schema": "twcc/board-pose",
  "version": 1,
  "cameraId": "camera-1",
  "intrinsicProfileId": "calibration-1",
  "imageWidth": 800,
  "imageHeight": 600,
  "board": {"columns": 9, "rows": 6, "squareSizeMeters": 0.025, "markerSizeMeters": 0.018},
  "scaleSource": "measured",
  "cameraFromBoard": {"rotation": [1, 0, 0, 0, 1, 0, 0, 0, 1], "translationMeters": [0, 0, 0.8]},
  "cornerCount": 54,
  "reprojectionErrorPx": 0.4,
  "observedPoints": [{"id": 0, "u": 312.5, "v": 208.1}],
  "measuredAt": "2026-09-16T12:00:00.000Z"
}
```

- It is the board in the camera's frame, and says so in its name. It is not a world pose.
- Its scale comes entirely from the declared square size. `scaleSource` says whether someone put a ruler to it (`measured`) or not (`nominal`). A nominal pose is right in direction and off in scale by however much the print was, which the reprojection error does not show.
- `observedPoints` travel with it, so `turbowarp-time-space-sync` can re-solve the same measurement into a shared frame.
- Without a calibration for that camera the request is refused as `not-calibrated`; with too little of the board in view, as `board-pose-unavailable`.

## Drawing the board

The board this extension looks for and the board a page prints come from the
same numbers. `./runtime` exports the definitions and an SVG renderer: pure
arithmetic with no document, camera, or OpenCV behind them.

```ts
import {
  BOARDS,
  MARKER_RATIO,
  PRINT_WIDTH_MM,
  PRINT_HEIGHT_MM,
  boardName,
  layout,
  patternSvg,
  printedCellMillimetres
} from '@kubohiroya/turbowarp-camera-calibration/runtime';
```

`BOARDS` holds the three supported boards (9×6, 7×5, and 5×4 inner corners), all
numbering their markers from 0. A board shown to another board's detector yields
no corners at all, which the extension reports as `wrong-board`.
`pnpm board:check` renders each board in a browser and confirms that its own
detector finds every corner and the other detectors find none.

## Block reference

The block reference is generated from
[`src/block-definitions.json`](src/block-definitions.json). Do not edit the
generated section manually.

<!-- BEGIN GENERATED BLOCKS -->

### `start camera [CAMERA_ID] calibration [CALIBRATION_ID] board [COLUMNS] by [ROWS] square [SQUARE_METERS] m marker [MARKER_METERS] m max error [MAX_ERROR_PX] px`

Leases one shared Camera Source camera and fixes its real capture resolution and capture conditions for a ChArUco calibration session. The board is a chessboard with an ArUco marker inside each light square, so a view that runs off the frame still contributes the corners it shows. The board is measured in inner corners, not printed squares.

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

Detects the board in the current shared frame and retains it when its quality and its novelty against the retained samples both pass. The whole board need not be visible: a view that shows at least six of its corners counts, which is what lets the board reach the edges of the frame.

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

Reports whether the shutter is watching that camera on its own. It stops by itself when the session finishes, when the capture conditions change, and when the camera goes away. It does not stop at the sample limit: the retained view most like the others makes room for the new one.

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

Imports a calibration profile after schema, credential, and applicability checks. Accepts a calibration file as Camera Source writes it -- ROS camera_info YAML, or twcs/camera-intrinsics JSON -- read through Camera Source's own reader, as well as this extension's profile JSON. Pre-migration profiles are accepted and their world pose is dropped rather than reinterpreted.

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

Returns the stored intrinsic profile in this extension's own JSON shape, or an empty string when none exists. To write a calibration to a file or a QR code, publish it and use Camera Source's camera profile YAML, which other tools read.

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
| Camera Source is not loaded | `dependency-missing`; the extension never opens its own camera |
| Camera Source has no profile registry, or another contract version | `api-version-mismatch` on publish; never a silent success, and the solved profile is kept |
| Camera calibration has not run | The state reporter returns `idle` and the profile reporter returns an empty string |
| The camera has not delivered a sized frame yet | The session waits for one (every 30 ms, up to 4 s) instead of failing on a camera that is still starting |
| Board not found, another board shown, blurred, or too similar to a kept view (by hand) | The sample is refused with `board-not-found`, `wrong-board`, `sample-low-quality`, or `sample-too-similar`, and the session stays ready |
| The same, during automatic capture | No error; the guidance reporter says what to do instead |
| 40 samples kept | By hand: `sample-limit`. Automatic: the view most like the others is replaced |
| A view whose corners lie on one line of the board | Refused as `sample-low-quality` by hand; the automatic path asks to `show-the-board`. A board pose from such a view is `board-pose-unavailable` |
| The solver fails on a frame or a set | `sample-failed` or `solve-failed`; the session stays ready with its views and its camera, so the step can be tried again |
| The solver's worker stops answering | The call fails after 120 s, or at once when the worker reports an error, and the next call starts a new worker |
| Sample or solve by hand while automatic capture is solving | A sample is refused until that solve ends. A solve waits for it and, unless it finished the session, solves as asked and reports its own result |
| Solve from a set that was never tilted | `sample-poses-degenerate`; the session stays open for more samples |
| Resolution, device, or mirroring changes mid-session | `resolution-mismatch` or `capture-condition-mismatch` |
| Resize mode, zoom, focus, or the camera changes before the solve | `capture-condition-mismatch`; the session ends in `error` rather than `solved`, because Camera Source would judge the profile not to fit this camera |
| Reprojection error exceeds the session limit | `reprojection-too-high`; no profile is stored and more samples can be added. A solve by hand checks the hold-out error as well as the fit error, as automatic capture does |
| Profile belongs to another camera or another capture size | `calibration-not-applicable`, rejected before any state changes |
| Board pose measured on a frame of another size than the profile | `calibration-not-applicable`; nothing is measured and the camera is released |
| Board pose requested without a calibration, or with the board out of view | `not-calibrated` or `board-pose-unavailable` |
| Solve succeeds | The camera lease is released immediately |
| Project stop, project reload, runtime disposal | Every session is cancelled and every camera lease is released |
| Invalid input | Rejected before any session state changes, including a restart with a mistyped board |
| A board needing more than the 50 markers of `DICT_4X4_50` (for example 10 by 9, which needs 55) | `invalid-board`, at the start rather than at the first frame |

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

const found = readCameraCalibrationCapability(Scratch.vm.runtime);
if (!found) {
  // Not loaded. There is no procedure to drive, and the caller has to say so
  // rather than wait.
  return;
}

const calibration = found.requireVersion(4);
await calibration.start({
  cameraId: 'stage-left',
  calibrationId: 'session-1',
  board: {columns: 9, rows: 6, squareSizeMeters: 0.025, markerSizeMeters: 0.018},
  maximumReprojectionErrorPx: 1.5
});
calibration.setAutomatic('stage-left', true);
```

The capability is at version 4. Every version so far has only added members, so
`requireVersion` accepts any version from 1 up to the one this build provides:

| Version | Added |
|---|---|
| 1 | Sessions, samples, solve, publish, import, validation, the state and quality reporters, hold-out results, and board pose measurement |
| 2 | Automatic capture: `setAutomatic`, `automatic`, and `guidance` |
| 3 | `novelty` and `tiltDirection` |
| 4 | `progress`, with `CALIBRATION_GATES`, `CALIBRATION_STEPS_PER_GATE`, and `CALIBRATION_PROGRESS_STEPS` exported so consumers do not copy the number 16 |

The sub-entry holds declarations, constants, and the board drawing helpers. It
pulls in none of the extension, so importing it costs a consumer nothing at run
time -- in particular, not the OpenCV build.

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
| `@kubohiroya/turbowarp-camera-source` | Required provider: supplies the camera lease and capture conditions, and owns the profile contract |
| `@kubohiroya/turbowarp-camera-calibration-app` | Application that shows the boards, runs automatic calibration, and exports the profile as a list file and a QR code |
| `@kubohiroya/turbowarp-time-space-sync` | Intended consumer of board pose measurements, to re-solve them into a shared frame |
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
| Board pose schema | `twcc/board-pose` v1 | Written by this extension |
| Runtime capability | `kubohiroyaCameraCalibrationCapability` v4 (accepts 1–4) | Read from the VM runtime |
| Solve backend | `opencv-js-wasm-4.12.0-charuco` | Pinned; reported by a block |

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
| `pnpm opencv:check` | Ask the real OpenCV build, in a browser, whether it provides every symbol the extension calls |
| `pnpm board:check` | Show each drawn board to the detectors, in a browser |
| `pnpm pack:check` | Inspect the npm package |
| `pnpm release:check` | Dry-run the release |

`opencv:check` and `board:check` start a browser and are not part of
`pnpm check`; CI runs them as separate steps. Rebuilding OpenCV itself is
described in [`tools/opencv/README.md`](tools/opencv/README.md).

## Release

1. Update `CHANGELOG.md` when present.
2. Update the version in `package.json`.
3. Run `pnpm check`.
4. Merge the release PR.
5. Create tag `v<version>` on the verified commit; the release workflow publishes that version to npm.
6. Verify GitHub Release, npm tarball, GitHub Pages, `docsURI`, block icon, and CDN artifacts.

## License

[Mozilla Public License 2.0](LICENSE) (SPDX: `MPL-2.0`).

Third-party components are listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). The bundle inlines a build of
OpenCV.js `4.12.0` made for this extension, distributed under the Apache License 2.0.
