# TurboWarp-<Extension-Name>

[English](README.md) | [日本語](README.ja.md)

<何をするかを一文で説明>ためのTurboWarp機能拡張です。

**利用ガイド:** [English](<PAGES_URL>/)

## できること

- <利用者ができること1>
- <利用者ができること2>
- <利用者ができること3>

実装ファイルの説明ではなく、利用者から見た結果を書きます。

## ドキュメントとブロックアイコン

この機能拡張は、英語版の利用者向けドキュメントをGitHub Pagesで公開します。

- `docsURI` はGitHub Pages上の英語版ドキュメント `<PAGES_URL>/` を指します。
- `blockIconURI` は `data:image/svg+xml;base64,...` 形式の自己完結したSVGとします。
- ブロックアイコンは機能拡張の内容を直感的に表す、単純で識別しやすい図柄にします。公開版では汎用の仮アイコンをそのまま使用しません。

## 動作条件と安全上の注意

- <TurboWarp Desktop／Web／Packagerの対応>
- <Browser APIまたはcompanion extension>
- <sandbox条件>

> [!IMPORTANT]
> この機能拡張は<理由>のため、サンドボックスなしで実行する必要があります。
> 信頼できる配布元の機能拡張だけを読み込んでください。

sandbox互換の場合は上の注意書きを削除します。

## インストール

### 完成済みJavaScript

1. [`dist/<file>.js`](dist/<file>.js?raw=1)をダウンロードします。
2. TurboWarpで**機能拡張**を開きます。
3. **カスタム機能拡張**からfileを読み込みます。
4. 必要な場合は**サンドボックスなしで実行する**を許可します。

完成済みの検証対象JavaScriptをrepositoryへcommitしているため、利用者が
Node.jsやbuild環境を用意する必要はありません。

### npm package

検証済みのversionをexact pinします。

```bash
pnpm add --save-exact @kubohiroya/<package>@<version>
```

standalone bundle:

```text
node_modules/@kubohiroya/<package>/dist/<file>.js
```

version固定CDN URL:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/<package>@<version>/dist/<file>.js
```

`<version>`を手作業で保守する場合は、`package.json`との一致をCIで検査します。

## クイックスタート

1. <手順1>
2. <手順2>
3. <手順3>

```text
<最小のTurboWarp block flow>
```

## ブロックリファレンス

block referenceは
[`src/block-definitions.json`](src/block-definitions.json)から生成します。
生成範囲を直接編集しないでください。

<!-- BEGIN GENERATED BLOCKS -->

<自動生成block文書>

<!-- END GENERATED BLOCKS -->

## 重要な動作

| 状況 | 動作 |
|---|---|
| <case> | <正確な動作> |
| project停止 | <cleanup> |
| project再読込 | <cleanupまたは復元> |
| 無効な入力 | <errorまたはfallback> |

## Composition API

Composition APIがないpackageでは、このsectionを削除します。

Composition APIをimportしても、standalone TurboWarp機能拡張は自動登録されません。

```ts
import {create<Feature>Composition} from '@kubohiroya/<package>/composition';

const feature = create<Feature>Composition({
  // 明示的な依存
});

// capabilityを利用する。

feature.releaseAll();
```

所有、取消し、`AbortSignal`、project lifecycle、副作用、browser／network／storage／
renderer境界、`release()`／`releaseAll()`を説明します。

完全なmethod referenceは
[`docs/composition-api.md`](docs/composition-api.md)へ分けます。

## 連携

| 利用側 | 関係 |
|---|---|
| `<consumer package>` | <required／optional／capability injection> |

依存方向はconsumerからproviderとし、private fieldを公開連携方法として書きません。

## 互換性

| 識別子 | 値 | 安定性 |
|---|---|---|
| 製品名 | `TurboWarp-<Extension-Name>` | 利用者向け表示 |
| repository | `kubohiroya/<repository>` | current source |
| npm package | `@kubohiroya/<package>` | public package contract |
| extension ID | `<extensionid>` | SB3に保存。変更にはmigrationが必要 |

複数語からなるTurboWarp機能拡張の正式表示名では、すべての構成語をハイフンで連結します。例: `TurboWarp-Asset-Manager`、`TurboWarp-Runtime-Expression`、`TurboWarp-Diagnostic-Overlay`。

extension IDまたはopcode変更時はschema-aware migrationを説明し、保存済み識別子が変わった場合にJavaScriptだけの差替えを案内しません。

## 開発

`engines`のNode.jsと、`packageManager`に宣言したpnpmを使用します。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

| command | 用途 |
|---|---|
| `pnpm dev` | source変更中の継続build |
| `pnpm test` | test |
| `pnpm docs` | block文書生成 |
| `pnpm check:dist` | commit済みbuild artifactの検証 |
| `pnpm pack:check` | npm package内容の確認 |
| `pnpm release:check` | release dry run |

## リリース

1. `CHANGELOG.md`がある場合は更新する。
2. `package.json`のversionを更新する。
3. `pnpm check`とrepository固有のrelease checkを実行する。
4. release PRをmergeする。
5. 検証済みcommitへ`v<version>`tagを付ける。
6. 必要に応じて同じversionをnpmへpublishする。
7. GitHub Release、npm tarball、GitHub Pages、`docsURI`、block icon、CDNを確認する。

release consistency checkでは、exact-version README／CDN例に加え、`docsURI`が英語版Pagesを指すこと、`blockIconURI`が`data:image/svg+xml;base64,...`形式であることを検証します。

## ライセンス

[Mozilla Public License 2.0](LICENSE)（SPDX: `MPL-2.0`）で提供します。

third-party componentを含む場合は
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)に記載します。
