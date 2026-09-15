# TurboWarp-Camera-Calibration

[English](README.md) | [日本語](README.ja.md)

[TurboWarp-Camera-Source](https://github.com/kubohiroya/turbowarp-camera-source)
で共有しているカメラを校正し、得られた内部校正プロファイルを提供するための
TurboWarp機能拡張です。

**利用ガイド:** [English](https://kubohiroya.github.io/turbowarp-camera-calibration/)

> [!NOTE]
> 現在このrepositoryにはプロジェクトの雛形だけがあります。校正手順は移設Issueで
> 管理しており、まだ実装していません。

## できること

- Camera Sourceからleaseしたカメラに対して、チェスボード校正セッションを実行します。
- カメラの内部行列と歪み係数を求め、再投影誤差を報告します。
- AR、photogrammetry、motion captureの各機能拡張が共有できる内部校正プロファイルを提供します。

## 校正を独立した機能拡張にしている理由

チェスボード検出と`calibrateCamera`に必要なOpenCVのbuildは約10 MBあります。
TurboWarp機能拡張は単一のstandalone bundleとして配布するため、動的`import()`を
使っても別チャンクには分離されず、同じfileへインライン展開されます。solverを
こちら側に置くことで、Camera Sourceはすべてのカメラ利用者が負担できる小さな
依存ゼロのcapabilityのままでいられます。

責務は次のように分かれます。

| package | 責務 |
|---|---|
| `@kubohiroya/turbowarp-camera-source` | カメラ取得、lease共有、preview、および校正プロファイルの契約（schema、検証、適合性判定） |
| `@kubohiroya/turbowarp-camera-calibration` | 校正手順そのもの。チェスボードのサンプル収集、solve、プロファイルの提供 |

## ドキュメントとブロックアイコン

この機能拡張は、英語版の利用者向けドキュメントをGitHub Pagesで公開します。

- `docsURI` は `https://kubohiroya.github.io/turbowarp-camera-calibration/` を指します。
- `blockIconURI` は `data:image/svg+xml;base64,...` 形式の自己完結したチェスボードSVGです。

## 動作条件と安全上の注意

- TurboWarp Desktop、Web、Packagerに対応します。
- `@kubohiroya/turbowarp-camera-source` を先に読み込む必要があります。この機能拡張は自分でカメラを開きません。
- 印刷したチェスボードの校正板が必要です。
- サンドボックスなしで実行する必要があります。

> [!IMPORTANT]
> この機能拡張はTurboWarp runtime経由でCamera Sourceのcapabilityを参照するため、
> サンドボックスなしで実行する必要があります。信頼できる配布元の機能拡張だけを
> 読み込んでください。

## インストール

### 完成済みJavaScript

1. [`dist/camera-calibration.js`](dist/camera-calibration.js?raw=1)をダウンロードします。
2. TurboWarpで**機能拡張**を開きます。
3. **カスタム機能拡張**からfileを読み込みます。
4. **サンドボックスなしで実行する**を許可します。

完成済みの検証対象JavaScriptをrepositoryへcommitしているため、利用者が
Node.jsやbuild環境を用意する必要はありません。

### npm package

検証済みのversionをexact pinします。

```bash
pnpm add --save-exact @kubohiroya/turbowarp-camera-calibration@0.1.0
```

standalone bundle:

```text
node_modules/@kubohiroya/turbowarp-camera-calibration/dist/camera-calibration.js
```

version固定CDN URL:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-camera-calibration@0.1.0/dist/camera-calibration.js
```

## クイックスタート

1. Camera Sourceを読み込み、校正したい共有カメラを開始します。
2. この機能拡張を読み込みます。
3. そのカメラの校正状態を読み取ります。

```text
start shared camera [default]
camera calibration state [default]
```

## ブロックリファレンス

block referenceは
[`src/block-definitions.json`](src/block-definitions.json)から生成します。
生成範囲を直接編集しないでください。

### `camera calibration state [CAMERA_ID]`

共有しているCamera Sourceのカメラ1台について、校正セッションの状態を返します。
校正手順は未実装のため、現時点では常に`idle`を返します。

| 項目 | 値 |
|---|---|
| 種別 | Reporter |
| opcode | `cameraCalibrationState` |
| `CAMERA_ID` | String、既定値: `default` |

## 重要な動作

| 状況 | 動作 |
|---|---|
| Camera Sourceが未読込み | 明示的に報告します。自分でカメラを開くことはありません |
| 校正を実行していない | 状態reporterは`idle`を返します |
| project停止 | 校正セッションを取り消し、カメラのleaseを解放します |
| project再読込 | 校正セッションを取り消し、カメラのleaseを解放します |
| 無効な入力 | セッション状態を変更する前に拒否します |

## 連携

| 利用側 | 関係 |
|---|---|
| `@kubohiroya/turbowarp-camera-source` | 必須のprovider。カメラのleaseを供給し、プロファイル契約を所有します |
| `@kubohiroya/turbowarp-realtime-motion-capture` | 公開された校正プロファイルの任意の利用側 |
| `@kubohiroya/turbowarp-ar` | 公開された校正プロファイルの任意の利用側 |
| `@kubohiroya/turbowarp-photogrammetry` | 公開された校正プロファイルの任意の利用側 |

依存方向はconsumerからproviderとし、private fieldを公開連携方法として書きません。

## 互換性

| 識別子 | 値 | 安定性 |
|---|---|---|
| 製品名 | `TurboWarp-Camera-Calibration` | 利用者向け表示 |
| repository | `kubohiroya/turbowarp-camera-calibration` | current source |
| npm package | `@kubohiroya/turbowarp-camera-calibration` | public package contract |
| extension ID | `kubohiroyacameracalibration` | SB3に保存。変更にはmigrationが必要 |

extension IDまたはopcode変更時はschema-aware migrationを説明し、保存済み識別子が
変わった場合にJavaScriptだけの差替えを案内しません。

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
3. `pnpm check`を実行する。
4. release PRをmergeする。
5. 検証済みcommitへ`v<version>`tagを付ける。
6. 同じversionをnpmへpublishする。
7. GitHub Release、npm tarball、GitHub Pages、`docsURI`、block icon、CDNを確認する。

## ライセンス

[Mozilla Public License 2.0](LICENSE)（SPDX: `MPL-2.0`）で提供します。

third-party componentを含む場合は
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)に記載します。校正solverが必要と
するOpenCVのbuildは、配布前に必ずここへ記録します。
