# TurboWarp-Camera-Calibration

[English](README.md) | [日本語](README.ja.md)

[TurboWarp-Camera-Source](https://github.com/kubohiroya/turbowarp-camera-source)
で共有しているカメラを校正し、得られた内部校正プロファイルを提供するための
TurboWarp機能拡張です。

**利用ガイド:** [English](https://kubohiroya.github.io/turbowarp-camera-calibration/)

> [!NOTE]
> 校正機能は起動時固定のfeature flagの背後にあり、既定はOFFです。
> [校正機能を有効にする](#校正機能を有効にする)を参照してください。

## できること

- Camera Sourceからleaseしたカメラに対して、実際の撮影解像度でチェスボード校正セッションを実行します。
- カメラの内部行列と歪み係数を求め、RMS再投影誤差を報告します。
- AR、photogrammetry、motion captureの各機能拡張が共有できる内部校正プロファイルを提供します。

内部校正と外部姿勢は分離しています。プロファイルは1台のカメラの光学特性だけを
記述します。world poseを含めることはなく、測っていない姿勢をidentityで補完する
こともありません。

## 校正を独立した機能拡張にしている理由

チェスボード検出と`calibrateCamera`に必要なOpenCVのbuildは約10 MBあります。
TurboWarp機能拡張は単一のstandalone bundleとして配布するため、動的`import()`を
使っても別チャンクには分離されず、同じfileへインライン展開されます。solverを
こちら側に置くことで、Camera Sourceはすべてのカメラ利用者が負担できる小さな
依存ゼロのcapabilityのままでいられます。起動時flagではこれを代替できません。
flagが止めるのは実行であってバイト数ではないためです。

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
- 印刷したチェスボードの校正板が必要です。平らで、光沢のないものを使います。ブロックの引数は**内部コーナー数**であり、印刷したマス目の数ではありません。10×7マスの板なら`9`×`6`です。
- サンドボックスなしで実行する必要があります。

> [!IMPORTANT]
> この機能拡張はTurboWarp runtime経由でCamera Sourceのcapabilityを参照するため、
> サンドボックスなしで実行する必要があります。信頼できる配布元の機能拡張だけを
> 読み込んでください。

カメラ画像はチェスボード検出のためだけに読み取ります。どこにも送信しません。
ペアリング資格情報を含むプロファイルは保存せず拒否します。

### 実用的な結果を得るための撮影条件

| 条件 | 理由 |
|---|---|
| 採用サンプルを8枚以上、40枚以下にする | 枚数が少ないと歪み係数が決まりません |
| 板の角度をサンプルごとに約20°〜45°変える | 正対した画像ばかりでは焦点距離と距離を分離できません |
| 距離を変え、画面の隅を含む別々の位置に板を写す | 歪みは画像中心から離れるほど大きく現れます |
| 板全体を画面内に収め、ピントを合わせる | 板全体が写っていない、またはぶれた画像は`board-not-found`や`sample-low-quality`として拒否します |
| セッション中に解像度・カメラdevice・左右反転・focus・zoomを変えない | セッションは開始時の解像度に固定され、条件変化を拒否します |

校正の確認は、solveに使っていない別の画像で行ってください。採用サンプルに対する
再投影誤差が小さいことは、その結果が一般に通用することの証明にはなりません。

## solverが読み込まれるタイミング

機能拡張を登録した時点で全ブロックがパレットに出ており、runtime capabilityも
runtimeに載っています。別途有効化する操作はありません。

OpenCVのruntimeは機能拡張と一緒には読み込まれません。最初のサンプル取得か
solveで初めて生成されるので、`camera calibration state`や
`camera calibration backend`を読むだけのprojectには一切の負荷がかかりません。
カメラのleaseも、校正を開始するまで取得しません。

## インストール

### 完成済みJavaScript

1. [`dist/camera-calibration.js`](dist/camera-calibration.js?raw=1)をダウンロードします。
2. TurboWarpで**機能拡張**を開きます。
3. **カスタム機能拡張**からfileを読み込みます。
4. **サンドボックスなしで実行する**を許可します。

完成済みの検証対象JavaScriptをrepositoryへcommitしているため、利用者が
Node.jsやbuild環境を用意する必要はありません。OpenCV.jsをインライン展開するため、
bundleは約11 MBあります。

### npm package

検証済みのversionをexact pinします。

```bash
pnpm add --save-exact @kubohiroya/turbowarp-camera-calibration@0.6.0
```

standalone bundle:

```text
node_modules/@kubohiroya/turbowarp-camera-calibration/dist/camera-calibration.js
```

version固定CDN URL:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-camera-calibration@0.6.0/dist/camera-calibration.js
```

## クイックスタート

1. Camera Sourceを読み込み、校正したい共有カメラを開始します。
2. 校正flagを有効にした状態でこの機能拡張を読み込みます。
3. セッションを開始し、角度と距離を変えながら板を撮り、solveします。

```text
start shared camera [default]
start camera [default] calibration [calibration-1] board [9] by [6] square [0.025] m max error [1.5] px
repeat until <camera [default] calibration sample count = 12>
  add calibration sample for camera [default]
solve calibration for camera [default]
publish calibration profile for camera [default]
```

`add calibration sample`は却下の理由を返します。projectは
`camera [default] calibration error code`を表示して、板の動かし方を利用者に
促すことができます。

## 校正プロファイル

solve結果は内部校正だけを含みます。

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

- `intrinsicMatrix`はrow-majorの`[fx, 0, cx, 0, fy, cy, 0, 0, 1]`で、単位は`imageWidth`×`imageHeight`のピクセルです。
- `imageState`が`raw`のときは未補正画像であり、係数をこれから適用します。`undistorted`は補正済みであり、係数を再適用してはいけないことを示します。
- `distortionCoefficients`はOpenCVの順序で、要素数は`distortionModel`と一致する必要があります。
- `quality`は、提供元が測っていない場合には含めません。
- previewの左右反転は表示側の都合です。プロファイルの座標は常に反転していない撮影座標です。

公開schemaは
[`schemas/camera-intrinsics-v1.schema.json`](schemas/camera-intrinsics-v1.schema.json)
です。この契約はCamera Sourceの責務であり
（[kubohiroya/turbowarp-camera-source#14](https://github.com/kubohiroya/turbowarp-camera-source/issues/14)）、
それが出るまでは本repositoryから公開します。移行時に変わるのは`schema`と
schemaの`$id`だけです。

`@kubohiroya/turbowarp-realtime-motion-capture`が書いた
`twrmc/camera-calibration` v1のプロファイルはimportで受け付けます。
`worldFromCameraMatrix`は解釈し直さずに捨てます。world poseは内部校正プロファイル
の一部ではないためです。

## ブロックリファレンス

block referenceは
[`src/block-definitions.json`](src/block-definitions.json)から生成します。
英語版の生成結果は[README.md](README.md#block-reference)にあります。

| ブロック | 種別 | 説明 |
|---|---|---|
| `start camera [CAMERA_ID] calibration [CALIBRATION_ID] board [COLUMNS] by [ROWS] square [SQUARE_METERS] m max error [MAX_ERROR_PX] px` | Command | 共有カメラを1台leaseし、実際の撮影解像度を固定して校正セッションを開始します |
| `add calibration sample for camera [CAMERA_ID]` | Command | 現在の共有frameから板全体を検出し、品質と既存サンプルに対する新規性を満たす場合に採用します |
| `solve calibration for camera [CAMERA_ID]` | Command | 8枚以上の採用サンプルから内部行列と歪み係数を求め、leaseを解放します。外部姿勢は求めません |
| `cancel calibration for camera [CAMERA_ID]` | Command | leaseと一時サンプルを解放し、検証済みプロファイルは残します |
| `cleanup calibration for camera [CAMERA_ID]` | Command | セッションを解放し、そのカメラのメモリ上のプロファイルも消します |
| `publish calibration profile for camera [CAMERA_ID]` | Command | 契約を所有するCamera Sourceへプロファイルを登録します |
| `import calibration profile [JSON] for camera [CAMERA_ID]` | Command | schema・資格情報・適合性を検査してからプロファイルを取り込みます |
| `calibration profile [JSON] valid for camera [CAMERA_ID]?` | Boolean | 保存中のプロファイルを置き換えずに検証し、失敗理由を記録します |
| `camera [CAMERA_ID] calibration ready?` | Boolean | 解像度固定のセッションがサンプル追加やsolveを受け付けられるかを返します |
| `camera calibration state [CAMERA_ID]` | Reporter | `idle` / `acquiring-camera` / `sampling` / `ready` / `solving` / `solved` / `cancelling` / `error` |
| `camera calibration backend` | Reporter | 固定したsolverの識別子を返します。読み取ってもsolverは読み込みません |
| `camera [CAMERA_ID] calibration sample count` | Reporter | 現在または直近のセッションの採用サンプル数 |
| `camera [CAMERA_ID] calibration sample quality` | Reporter | 直近の採用サンプルの被覆率と鮮鋭度による0〜1の評価 |
| `camera [CAMERA_ID] calibration reprojection error px` | Reporter | 直近のsolveまたは取り込んだプロファイルのRMS再投影誤差（px） |
| `camera [CAMERA_ID] calibration error code` | Reporter | 依存・board・カメラ・サンプル・solve・再投影・プロファイル・登録の各エラーの安定コード |
| `camera [CAMERA_ID] calibration error` | Reporter | 詳細な診断メッセージ |
| `camera [CAMERA_ID] calibration profile JSON` | Reporter | 保存中の内部校正プロファイル。無い場合は空文字列 |

## 重要な動作

| 状況 | 動作 |
|---|---|
| 校正flagがOFF | 状態reporterだけを提供して`idle`を返します。commandは明示的なエラーで拒否します |
| Camera Sourceが未読込み | `dependency-missing`。自分でカメラを開くことはありません |
| Camera Sourceにプロファイル登録APIが無い、または契約versionが異なる | publish時に`api-version-mismatch`。暗黙の成功扱いをせず、solve済みプロファイルは保持します |
| 校正を実行していない | 状態reporterは`idle`、プロファイルreporterは空文字列を返します |
| 板が見つからない、ぶれている、既存サンプルと似すぎている | 固有のエラーコードで却下し、セッションはready のままです |
| セッション中に解像度・device・左右反転が変わった | `resolution-mismatch` または `capture-condition-mismatch` |
| 再投影誤差が上限を超えた | `reprojection-too-high`。プロファイルは保存せず、サンプルを追加できます |
| 別のカメラ、または別の撮影サイズのプロファイル | 状態を変更する前に`calibration-not-applicable`で拒否します |
| solve成功 | ただちにカメラのleaseを解放します |
| project停止・project再読込・runtime破棄 | すべてのセッションを取り消し、すべてのleaseを解放します |
| 無効な入力 | セッション状態を変更する前に拒否します。boardを打ち間違えた再開始も、実行中のセッションを壊しません |

共有カメラごとにセッション、プロファイル、診断を分けて保持します。あるカメラの
cancelが、別のカメラのleaseを解放したり、同じ共有カメラの他の利用者を止めたり
することはありません。

## ほかの機能拡張から校正を実行する

ブロックはプロジェクトのためのパレットであって、機能拡張間のAPIではありません。
校正を実行したい機能拡張 — かつて自前で持っていて、いまは委譲する側 — は、VM
runtime上のversion付きcapabilityを使います。

```ts
import {
  readCameraCalibrationCapability
} from '@kubohiroya/turbowarp-camera-calibration/runtime';

const calibration = readCameraCalibrationCapability(Scratch.vm.runtime);
if (!calibration) {
  // 未ロード、または校正機能がOFF。いずれにせよ実行できる手順は無いので、
  // 待たずにその旨を返します。
  return;
}

await calibration.requireVersion(1).start({
  cameraId: 'stage-left',
  calibrationId: 'session-1',
  board: {columns: 9, rows: 6, squareSizeMeters: 0.025},
  maximumReprojectionErrorPx: 1.5
});
```

このsub-entryが持つのは宣言と定数2つだけで、機能拡張本体は一切含みません。利用側
のbundleに増えるものは実質ありません（とくにOpenCVは入りません）。

`requireVersion` は、このビルドが実装していないversionを明示的に拒否します。これは
capabilityが無い場合とは別の答えです。機能拡張はロードされていて、要求されたことが
できない、という状態であり、操作者への説明も変わります。

capabilityが駆動するのはブロックと同じカメラ単位のセッションで、カメラの指定方法も
同じです。空文字や空白の `cameraId` は、ブロックが `default` と呼ぶカメラを指します。
委譲された校正とパレットから始めた校正はひとつのセッションであり、同じカメラについて
食い違う2つの見え方にはなりません。

プロファイルは別の話です。プロファイル契約を所有しているのはCamera Sourceなので、
プロファイルの読み書き・保管・適合判定だけが目的の利用側は
`@kubohiroya/turbowarp-camera-source` と話せばよく、この機能拡張は不要です。

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
| 保存プロファイルschema | `camerasource/camera-intrinsics` v1 | この機能拡張が読み書きします |
| 公開プロファイルschema | `twcs/camera-intrinsics` v1 | Camera Sourceが所有します |
| runtime capability | `kubohiroyaCameraCalibrationCapability` v1 | VM runtimeから読みます |
| solve backend | `opencv-js-wasm-4.12.0` | 固定。ブロックで報告します |

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

同梱するthird-party componentは
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)に記載しています。bundleは
Apache License 2.0のOpenCV.js `4.12.0-release.1`をインライン展開しています。
