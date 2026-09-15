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

## Planned calibration flow

Not implemented yet. The migration issue owns this design.

1. Acquire a lease for one `cameraId` from Camera Source and fix the capture resolution.
2. Collect chessboard samples, rejecting low-quality and near-duplicate views.
3. Solve for the intrinsic matrix and distortion coefficients, and check the reprojection error.
4. Publish the resulting intrinsic profile through the Camera Source profile contract.
5. Release the lease on solve, cancel, project stop, and project reload.

Intrinsic calibration and external pose stay separate. This extension never
supplies a world pose, and never substitutes identity for one that is missing.

## Drift detection

`dist/` is committed as a release artifact. `pnpm run check:dist` rebuilds both
files and fails when Git reports any modified, deleted, or untracked file below
`dist/`. This catches manifest and bundle drift in local checks and CI.
