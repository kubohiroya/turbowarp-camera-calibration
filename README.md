# TurboWarp-Camera-Calibration

[English](README.md) | [日本語](README.ja.md)

A TurboWarp extension that calibrates a camera shared through
[TurboWarp-Camera-Source](https://github.com/kubohiroya/turbowarp-camera-source)
and publishes the resulting intrinsic calibration profile.

**User guide:** [English](https://kubohiroya.github.io/turbowarp-camera-calibration/)

> [!NOTE]
> This repository currently contains the project scaffold only. The calibration
> procedure is tracked by the migration issue and is not implemented yet.

## What it does

- Runs a chessboard calibration session against a camera leased from Camera Source.
- Solves the camera intrinsic matrix and distortion coefficients, and reports the reprojection error.
- Publishes an intrinsic calibration profile that AR, photogrammetry, and motion capture extensions can share.

## Why calibration lives in its own extension

The OpenCV build required to detect a chessboard and solve `calibrateCamera` is
roughly 10 MB. TurboWarp extensions ship as a single standalone bundle, so a
dynamic `import()` does not split that weight out: it is inlined into the same
file. Keeping the solver here lets Camera Source stay a small, dependency-free
capability that every camera consumer can afford to load.

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
- A printed chessboard calibration target.
- Must run without the sandbox.

> [!IMPORTANT]
> This extension must run without the sandbox because it reaches the Camera
> Source capability through the TurboWarp runtime. Load unsandboxed extension
> code only from a source you trust.

## Installation

### Ready-to-use JavaScript

1. Download [`dist/camera-calibration.js`](dist/camera-calibration.js?raw=1).
2. Open **Extensions** in TurboWarp.
3. Choose **Custom Extension** and load the file.
4. Enable **Run extension without sandbox**.

The reviewed JavaScript build is committed to this repository, so users do not
need Node.js to install the extension.

### npm package

Install an exact version that you have reviewed:

```bash
pnpm add --save-exact @kubohiroya/turbowarp-camera-calibration@0.1.0
```

Load the standalone bundle from:

```text
node_modules/@kubohiroya/turbowarp-camera-calibration/dist/camera-calibration.js
```

A version-pinned CDN URL is:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-camera-calibration@0.1.0/dist/camera-calibration.js
```

## Quick start

1. Load Camera Source and start the shared camera you want to calibrate.
2. Load this extension.
3. Read the calibration state for that camera.

```text
start shared camera [default]
camera calibration state [default]
```

## Block reference

The block reference is generated from
[`src/block-definitions.json`](src/block-definitions.json). Do not edit the
generated section manually.

<!-- BEGIN GENERATED BLOCKS -->

### `camera calibration state [CAMERA_ID]`

Returns the calibration session state for one shared Camera Source camera. The calibration procedure is not implemented yet, so this reporter always returns idle.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `cameraCalibrationState` |
| `CAMERA_ID` | String, default: `default` |

<!-- END GENERATED BLOCKS -->

## Important behavior

| Situation | Behavior |
|---|---|
| Camera Source is not loaded | Reported explicitly; the extension never opens its own camera |
| Camera calibration has not run | The state reporter returns `idle` |
| Project stop | Any calibration session is cancelled and the camera lease is released |
| Project reload | Any calibration session is cancelled and the camera lease is released |
| Invalid input | Rejected before any session state changes |

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

Third-party components, when present, are listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). The OpenCV build required by
the calibration solver must be recorded there before it ships.
