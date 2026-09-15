# TurboWarp-<Extension-Name>

[English](README.md) | [日本語](README.ja.md)

A TurboWarp extension that <one-sentence purpose>.

**User guide:** [English](<PAGES_URL>/)

## What it does

- <User-visible capability 1>
- <User-visible capability 2>
- <User-visible capability 3>

Keep this section about outcomes, not implementation files.

## Documentation and block icon

This extension publishes its English user documentation with GitHub Pages.

- `docsURI` points to the English GitHub Pages documentation: `<PAGES_URL>/`.
- `blockIconURI` is a self-contained SVG encoded as `data:image/svg+xml;base64,...`.
- The block icon should be a simple, recognizable symbol that represents this extension and improves block readability. Do not use a generic placeholder icon in a released extension.

## Requirements and safety

- <TurboWarp Desktop / Web / Packager support>
- <Browser API or companion extension requirements>
- <Sandbox requirement>

> [!IMPORTANT]
> This extension must run without the sandbox because <reason>. Load unsandboxed
> extension code only from a source you trust.

Delete the notice above when the extension is sandbox-compatible.

## Installation

### Ready-to-use JavaScript

1. Download [`dist/<file>.js`](dist/<file>.js?raw=1).
2. Open **Extensions** in TurboWarp.
3. Choose **Custom Extension** and load the file.
4. Enable **Run extension without sandbox** when required.

The reviewed JavaScript build is committed to this repository, so users do not
need Node.js to install the extension.

### npm package

Install an exact version that you have reviewed:

```bash
pnpm add --save-exact @kubohiroya/<package>@<version>
```

Load the standalone bundle from:

```text
node_modules/@kubohiroya/<package>/dist/<file>.js
```

A version-pinned CDN URL is:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/<package>@<version>/dist/<file>.js
```

Do not maintain `<version>` manually unless CI checks it against `package.json`.

## Quick start

1. <Step 1>
2. <Step 2>
3. <Step 3>

```text
<Minimal TurboWarp block flow>
```

## Block reference

The block reference is generated from
[`src/block-definitions.json`](src/block-definitions.json). Do not edit the
generated section manually.

<!-- BEGIN GENERATED BLOCKS -->

<Generated block documentation>

<!-- END GENERATED BLOCKS -->

## Important behavior

| Situation | Behavior |
|---|---|
| <Case> | <Exact behavior> |
| Project stop | <Cleanup behavior> |
| Project reload | <Cleanup or restoration behavior> |
| Invalid input | <Error or fallback behavior> |

## Composition API

Delete this section when the package has no Composition API.

Importing the Composition API does not register the standalone TurboWarp
extension.

```ts
import {create<Feature>Composition} from '@kubohiroya/<package>/composition';

const feature = create<Feature>Composition({
  // Explicit dependencies
});

// Use the capability.

feature.releaseAll();
```

Explain:

- ownership;
- cancellation and `AbortSignal`;
- target/project lifecycle;
- side effects;
- browser, network, storage, and renderer boundaries;
- `release()` / `releaseAll()` behavior.

Move the complete method reference to [`docs/composition-api.md`](docs/composition-api.md).

## Integration

| Consumer | Relationship |
|---|---|
| `<consumer package>` | <required / optional / capability injection> |

Dependencies must point from the consumer to the provider. Do not document
private-field access as an integration API.

## Compatibility

| Identifier | Value | Stability |
|---|---|---|
| Product name | `TurboWarp-<Extension-Name>` | Human-facing |
| Repository | `kubohiroya/<repository>` | Current source location |
| npm package | `@kubohiroya/<package>` | Public package contract |
| Extension ID | `<extensionid>` | Stored in SB3; migration required to change |

Use hyphens between every component of a multi-word TurboWarp extension name,
for example `TurboWarp-Asset-Manager`, `TurboWarp-Runtime-Expression`, and
`TurboWarp-Diagnostic-Overlay`.

Document schema-aware migrations when an extension ID or opcode changes. Never
instruct users to replace JavaScript alone when stored identifiers have changed.

## Development

Use Node.js `<minimum version>` and the pnpm version declared by
`packageManager`.

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
3. Run `pnpm check` and the repository release checks.
4. Merge the release PR.
5. Create tag `v<version>` on the verified commit.
6. Publish the same version to npm when applicable.
7. Verify GitHub Release, npm tarball, GitHub Pages, `docsURI`, block icon, and CDN artifacts.

The release consistency check should verify every exact-version README and CDN
example, and should ensure that `docsURI` still resolves to the English Pages
site and `blockIconURI` remains a `data:image/svg+xml;base64,...` URI.

## License

[Mozilla Public License 2.0](LICENSE) (SPDX: `MPL-2.0`).

Third-party components, when present, are listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
