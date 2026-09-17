# TurboWarp-Camera-Calibration

[English](README.md) | [日本語](README.ja.md)

[TurboWarp-Camera-Source](https://github.com/kubohiroya/turbowarp-camera-source)
で共有しているカメラをChArUcoボードで校正し、得られた内部校正プロファイルを
提供するためのTurboWarp機能拡張です。

**利用ガイド:** [English](https://kubohiroya.github.io/turbowarp-camera-calibration/)

## できること

- Camera Sourceからleaseしたカメラに対して、実際の撮影解像度でChArUcoボードの校正セッションを実行します。
- 求めればサンプルを自分で撮ります。自動シャッターがフレームを見張り、操作者に次にすることを案内し、背景でsolveを繰り返し、fitに使っていない視点でも答えが保てた時点で完了します。
- 内部行列と歪み係数をWeb Worker上で求め、fit側とhold-out側のRMS再投影誤差を報告します。
- カメラが報告した撮影条件を記録し、後でCamera Sourceが「このプロファイルが目の前のカメラに合うか」を判定できるようにします。
- AR、photogrammetry、motion captureの各機能拡張が共有できる内部校正プロファイルを提供します。
- 探す板を自分で描きます。板を表示・印刷するページやアプリは、まさにその板を出せます。
- 動かなくなった板がどこにあるかを、カメラ自身の座標系で測ります。配置を解くツールが共通座標へ解き直すための材料です。

内部校正と外部姿勢は分離しています。プロファイルは1台のカメラの光学特性だけを
記述します。world poseを含めることはなく、測っていない姿勢をidentityで補完する
こともありません。

## 校正を独立した機能拡張にしている理由

ChArUcoボードの検出と`calibrateCameraExtended`にはOpenCVが必要です。
TurboWarp機能拡張は単一のstandalone bundleとして配布するため、動的`import()`を
使っても別チャンクには分離されず、同じfileへインライン展開されます。solverを
こちら側に置くことで、Camera Sourceはすべてのカメラ利用者が負担できる小さな
依存ゼロのcapabilityのままでいられます。

同梱するOpenCVは標準のbuildではありません。標準buildはWeb Worker内で初期化が
終わらず、カメラのpreviewを止めないためにsolverはWorkerで動かす必要があります。
OpenCV `4.12.0`から`ENVIRONMENT=web,worker`と、この機能拡張が呼ぶ関数だけの
whitelistでbuildし直し、10.9 MBから3.85 MBにしています。詳しくは
[`tools/opencv/`](tools/opencv/)と[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)を
参照してください。

責務は次のように分かれます。

| package | 責務 |
|---|---|
| `@kubohiroya/turbowarp-camera-source` | カメラ取得、lease共有、preview、撮影条件、および校正プロファイルの契約（schema、検証、適合性判定） |
| `@kubohiroya/turbowarp-camera-calibration` | 校正手順そのもの。板の定義と描画、手動・自動のサンプル収集、solveとhold-out検証、板の姿勢測定、プロファイルの提供 |

## ドキュメントとブロックアイコン

この機能拡張は、英語版の利用者向けドキュメントをGitHub Pagesで公開します。

- `docsURI` は `https://kubohiroya.github.io/turbowarp-camera-calibration/` を指します。
- `blockIconURI` は `data:image/svg+xml;base64,...` 形式の自己完結したチェスボードSVGです。

## 動作条件と安全上の注意

- TurboWarp Desktop、Web、Packagerに対応します。
- `@kubohiroya/turbowarp-camera-source` を先に読み込む必要があります。この機能拡張は自分でカメラを開きません。
- 平らで光沢のないChArUcoボードが必要です。白いマスそれぞれにOpenCVの`DICT_4X4_50`のマーカーを0番から入れた市松模様です。ブロックの引数は**内部コーナー数**であり、印刷したマス目の数ではありません。10×7マスの板なら`9`×`6`です。マーカーを一致させるため、ほかの生成器ではなく[`./runtime`](#板を描く)の関数で描いてください。
- サンドボックスなしで実行する必要があります。

> [!IMPORTANT]
> この機能拡張はTurboWarp runtime経由でCamera Sourceのcapabilityを参照するため、
> サンドボックスなしで実行する必要があります。信頼できる配布元の機能拡張だけを
> 読み込んでください。

カメラ画像は板の検出のためだけに読み取ります。どこにも送信しません。
ペアリング資格情報を含むプロファイルは保存せず拒否します。

### 実用的な結果を得るための撮影条件

| 条件 | 理由 |
|---|---|
| 手動でsolveするには採用サンプル8枚以上。自動経路は12枚以上を集め、約5分の1を検証用に残す | 枚数が少ないと歪み係数が決まらず、何も残さないsolveは検証できません |
| 板をサンプルごとに約20°〜45°、異なる向きへ傾ける | 正対した画像ばかりでは焦点距離と距離を分離できません。横へずらすだけでは足りず、傾けていない組は`sample-poses-degenerate`で拒否します |
| 距離を変え、画面の隅を含む別々の位置に板を写す | 歪みは画像中心から離れるほど大きく現れます。マーカーがコーナーに名前を与えるので、画面からはみ出した板も写っている分のコーナーを使えます |
| ピントを合わせ、少し止めて持つ | ぶれた画像は`sample-low-quality`で拒否するか、自動経路では`hold-steadier`と案内します |
| セッション中に解像度・カメラdevice・左右反転・リサイズ・focus・zoomを変えない | セッションは開始時の条件に固定されます。変われば、カメラに合わないプロファイルを作る代わりに`capture-condition-mismatch`で終わります |
| 印刷板か1:1表示の画面を使い、プロジェクタは避ける | 台形補正、斜めからの投影、プロジェクタ自身のレンズ歪みが板を変形させ、しかも再投影誤差には現れません |

校正の確認は、solveに使っていない別の画像で行ってください。採用サンプルに対する
再投影誤差が小さいことは、その結果が一般に通用することの証明にはなりません。
hold-out誤差はそのためにあります。

## 自動撮影

操作者は腕を伸ばして板を持っており、適切な瞬間にボタンも押すことはできません。
`start automatic calibration capture`はシャッターを機能拡張に渡します。

- 250 msごとに共有frameを見て、受け付けられる視点のときだけ採用します。
- 枚数が足りると背景でsolveします。カメラは解放せず、stateも動かしません。
- hold-out誤差がセッションの上限以下になったところでセッションを終えます。fit側の誤差だけでは終えません。
- 40枚に達しても止まりません。最も他と似ている1枚を捨てて新しい1枚を入れます。

この経路では、使えないframeはエラーにしません。代わりに操作者への案内を出します。

| guidance | 意味 |
|---|---|
| `show-the-board` | 何も写っていない |
| `wrong-board` | マーカーは見えるが、選択中の板のコーナーが6点未満しか出ない。別の板か、正しい板を読めない角度で見せている |
| `hold-steadier` | ぶれている |
| `move-or-tilt` | すでに採用した視点と似すぎている |
| `tilt-more` | 採用した視点の傾きが足りず、solveできない |
| `keep-going` | 背景solveが自分の標本すら再現できない（枚数不足） |
| `vary-more` | 自分の標本は再現できるが、検証用は再現できない（視点が似すぎ） |
| `solving` / `complete` | 計算中、完了 |

画面を見ていない人へ連続的な合図を出せるよう、reporterを3つ用意しています。

- **tilt direction**：`top-near`／`top-far`／`left-near`／`right-near`。採用済みの視点が最も届いていない向きです。
- **novelty**：0〜1。いまカメラの前にある視点がどれだけ足しになるか。傾きで測るので、板を横へ滑らせても上がりません。
- **progress**：0〜16。4つの関門を4段ずつ数えます（solveに足りる枚数、その中の傾きの広がり、検証用を残せる枚数、検証用の視点でも保つ答え）。最初に通っていない関門まで数え、下がりません。

## solverが読み込まれるタイミング

機能拡張を登録した時点で全ブロックがパレットに出ており、runtime capabilityも
runtimeに載っています。別途有効化する操作はありません。

WorkerとOpenCVのruntimeは最初に使うときに生成し、読み込み時には生成しません。
`camera calibration state`や`camera calibration backend`を読むだけのprojectには
一切の負荷がかかりません。カメラのleaseも、校正または測定を開始するまで取得しません。
frameはコピーではなく、転送したpixel bufferとしてWorkerへ渡します。

## インストール

### 完成済みJavaScript

1. [`dist/camera-calibration.js`](dist/camera-calibration.js?raw=1)をダウンロードします。
2. TurboWarpで**機能拡張**を開きます。
3. **カスタム機能拡張**からfileを読み込みます。
4. **サンドボックスなしで実行する**を許可します。

完成済みの検証対象JavaScriptをrepositoryへcommitしているため、利用者が
Node.jsやbuild環境を用意する必要はありません。専用buildのOpenCV.jsをインライン
展開しており、bundleは約3.9 MB（gzip後約1.5 MB）です。

### npm package

検証済みのversionをexact pinします。

```bash
pnpm add --save-exact @kubohiroya/turbowarp-camera-calibration@0.13.0
```

standalone bundle:

```text
node_modules/@kubohiroya/turbowarp-camera-calibration/dist/camera-calibration.js
```

version固定CDN URL:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-camera-calibration@0.13.0/dist/camera-calibration.js
```

## クイックスタート

1. Camera Sourceを読み込み、校正したい共有カメラを開始します。
2. この機能拡張を読み込みます。
3. 手に持っている板でセッションを開始し、シャッターに任せます。

```text
start shared camera [default]
start camera [default] calibration [calibration-1] board [9] by [6] square [0.025] m marker [0.018] m max error [1.5] px
start automatic calibration capture for camera [default]
repeat until <not <automatic capture running for camera [default]?>>
  say (camera calibration guidance [default])
if <(camera calibration state [default]) = [solved]> then
  publish calibration profile for camera [default]
```

手動で撮る場合:

```text
start camera [default] calibration [calibration-1] board [9] by [6] square [0.025] m marker [0.018] m max error [1.5] px
repeat until <(camera [default] calibration sample count) = 12>
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
  "quality": {"sampleCount": 12, "reprojectionErrorPx": 0.75},
  "capture": {"resizeMode": "none", "zoom": 1, "focusMode": "manual", "focusDistance": 0.4},
  "device": {"label": "USB Camera"},
  "calibratedAt": "2026-09-13T12:00:00.000Z"
}
```

- `intrinsicMatrix`はrow-majorの`[fx, 0, cx, 0, fy, cy, 0, 0, 1]`で、単位は`imageWidth`×`imageHeight`のピクセルです。
- `imageState`が`raw`のときは未補正画像であり、係数をこれから適用します。`undistorted`は補正済みであり、係数を再適用してはいけないことを示します。
- `distortionCoefficients`はOpenCVの順序で、要素数は`distortionModel`と一致する必要があります。
- `quality`は、提供元が測っていない場合には含めません。
- `capture`は、レンズの投影を変える設定（`resizeMode`、`zoom`、`focusMode`、`focusDistance`、`frameRate`、`facingMode`）を、セッション開始時にCamera Sourceが報告したとおりに記録します。カメラが報告しない値は推測で埋めず、省きます。これが無いと、Camera Sourceは適合性を問われても`undetermined`としか答えられません。
- `device`はカメラが名乗った名前です。照合の手がかりであって、証明ではありません。
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

## 板の姿勢

校正には板を動かすことが必要で、板が動かない配置こそ校正できない配置です。
そのため、板がどこにあるかの測定は、校正のあと、板が置き場所に落ち着いてから
別の操作として行います。`measure camera [ID] board pose`はleaseを取り、そのカメラの
校正を使って姿勢を解き、すぐにleaseを返します。

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

- カメラ座標系での板の姿勢であり、名前もそう言っています。world poseではありません。
- スケールは宣言したマス寸法だけから来ます。`scaleSource`は、定規で測った値（`measured`）か公称値（`nominal`）かを示します。公称値の姿勢は、向きは正しくても、印刷のずれの分だけスケールがずれ、そのずれは再投影誤差に現れません。
- `observedPoints`を添えるので、`turbowarp-time-space-sync`が同じ測定を共通座標へ解き直せます。
- そのカメラの校正が無ければ`not-calibrated`、板が十分に写っていなければ`board-pose-unavailable`で拒否します。

## 板を描く

この機能拡張が探す板と、ページが印刷する板は、同じ数字から作られます。
`./runtime`は板の定義とSVG描画を公開します。document、カメラ、OpenCVには触れない
純粋な計算です。

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

`BOARDS`は対応する3種類（内部コーナー9×6、7×5、5×4）で、どれもマーカーを0番から
振ります。別の板の検出器に見せた板はコーナーを1つも返さず、この機能拡張はそれを
`wrong-board`として報告します。`pnpm board:check`はブラウザで各板を描き、自分の
検出器では全コーナーが見つかり、ほかの検出器では1つも見つからないことを確かめます。

## ブロックリファレンス

block referenceは
[`src/block-definitions.json`](src/block-definitions.json)から生成します。
英語版の生成結果は[README.md](README.md#block-reference)にあります。

| ブロック | 種別 | 説明 |
|---|---|---|
| `start camera [CAMERA_ID] calibration [CALIBRATION_ID] board [COLUMNS] by [ROWS] square [SQUARE_METERS] m marker [MARKER_METERS] m max error [MAX_ERROR_PX] px` | Command | 共有カメラを1台leaseし、実際の撮影解像度と撮影条件を固定してChArUcoボードの校正セッションを開始します |
| `add calibration sample for camera [CAMERA_ID]` | Command | 現在の共有frameから板を検出し、品質と既存サンプルに対する新規性を満たす場合に採用します |
| `start automatic calibration capture for camera [CAMERA_ID]` | Command | シャッターを機能拡張に渡します。採用できる視点を自動で撮り、背景でsolveし、hold-out誤差が上限以下になったらセッションを終えます |
| `stop automatic calibration capture for camera [CAMERA_ID]` | Command | シャッターを手動に戻します。集めたサンプルを保ったままセッションは続きます |
| `automatic capture running for camera [CAMERA_ID]?` | Boolean | 自動シャッターがそのカメラを見張っているかを返します |
| `camera calibration guidance [CAMERA_ID]` | Reporter | 自動撮影中に操作者が次にすべきこと（上の表の値） |
| `camera calibration novelty [CAMERA_ID]` | Reporter | いま見ている視点がどれだけ足しになるか（0〜1、傾きで測る） |
| `camera calibration tilt direction [CAMERA_ID]` | Reporter | 次に倒す向き。`top-near`／`top-far`／`left-near`／`right-near` |
| `camera calibration progress [CAMERA_ID]` | Reporter | セッションの進み具合（0〜16、4関門×4段） |
| `solve calibration for camera [CAMERA_ID]` | Command | 8枚以上の採用サンプルから内部行列と歪み係数を求め、leaseを解放します。外部姿勢は求めません |
| `cancel calibration for camera [CAMERA_ID]` | Command | leaseと一時サンプルを解放し、検証済みプロファイルは残します |
| `cleanup calibration for camera [CAMERA_ID]` | Command | セッションを解放し、そのカメラのメモリ上のプロファイルも消します |
| `publish calibration profile for camera [CAMERA_ID]` | Command | 契約を所有するCamera Sourceへプロファイルを登録します |
| `measure camera [CAMERA_ID] board pose board [COLUMNS] by [ROWS] square [SQUARE_METERS] m marker [MARKER_METERS] m scale [SCALE_SOURCE]` | Command | 置き場所に落ち着いた板の姿勢を、校正済みのカメラの座標系で測ります |
| `import calibration profile [JSON] for camera [CAMERA_ID]` | Command | schema・資格情報・適合性を検査してからプロファイルを取り込みます |
| `calibration profile [JSON] valid for camera [CAMERA_ID]?` | Boolean | 保存中のプロファイルを置き換えずに検証し、失敗理由を記録します |
| `camera [CAMERA_ID] calibration ready?` | Boolean | 解像度固定のセッションがサンプル追加やsolveを受け付けられるかを返します |
| `camera calibration state [CAMERA_ID]` | Reporter | `idle` / `acquiring-camera` / `sampling` / `ready` / `solving` / `solved` / `cancelling` / `error` |
| `camera calibration backend` | Reporter | 固定したsolverの識別子を返します。読み取ってもsolverは読み込みません |
| `camera [CAMERA_ID] calibration sample count` | Reporter | 現在または直近のセッションの採用サンプル数 |
| `camera [CAMERA_ID] calibration sample quality` | Reporter | 直近の採用サンプルの被覆率と鮮鋭度による0〜1の評価 |
| `camera [CAMERA_ID] calibration reprojection error px` | Reporter | 直近のsolveまたは取り込んだプロファイルのRMS再投影誤差（px） |
| `camera [CAMERA_ID] calibration pose spread` | Reporter | 採用サンプルの傾きの広がり。0はすべて同じ向きで、solveできません |
| `camera [CAMERA_ID] calibration holdout error px` | Reporter | solveのfitに使っていないサンプルでのRMS再投影誤差（px） |
| `camera [CAMERA_ID] calibration holdout sample count` | Reporter | 検証用に残したサンプル数。0なら何も検証していません |
| `camera [CAMERA_ID] calibration error code` | Reporter | 依存・board・カメラ・サンプル・solve・再投影・プロファイル・登録の各エラーの安定コード |
| `camera [CAMERA_ID] calibration error` | Reporter | 詳細な診断メッセージ |
| `camera [CAMERA_ID] calibration profile JSON` | Reporter | 保存中の内部校正プロファイル。無い場合は空文字列 |
| `camera [CAMERA_ID] board pose JSON` | Reporter | 直近に測った板の姿勢。無い場合は空文字列 |

## 重要な動作

| 状況 | 動作 |
|---|---|
| Camera Sourceが未読込み | `dependency-missing`。自分でカメラを開くことはありません |
| Camera Sourceにプロファイル登録APIが無い、または契約versionが異なる | publish時に`api-version-mismatch`。暗黙の成功扱いをせず、solve済みプロファイルは保持します |
| 校正を実行していない | 状態reporterは`idle`、プロファイルreporterは空文字列を返します |
| カメラがまだ大きさのあるframeを出していない | 起動途中のカメラで失敗せず、30 msごとに最大4秒待ちます |
| 手動で、板が見つからない・別の板・ぶれている・既存サンプルと似すぎている | `board-not-found`、`wrong-board`、`sample-low-quality`、`sample-too-similar`で却下し、セッションはreadyのままです |
| 同じことが自動撮影中に起きた | エラーにせず、guidance reporterで次にすることを示します |
| 採用サンプルが40枚 | 手動では`sample-limit`。自動では最も他と似ている1枚を入れ替えます |
| 傾けていない組でsolve | `sample-poses-degenerate`。セッションは開いたままでサンプルを追加できます |
| セッション中に解像度・device・左右反転が変わった | `resolution-mismatch` または `capture-condition-mismatch` |
| 解くまでの間にリサイズ・ズーム・フォーカス・カメラが変わった | `capture-condition-mismatch`。camera-source がこのカメラに合わないと判定するプロファイルになるため、`solved` ではなく `error` で終わる |
| 再投影誤差が上限を超えた | `reprojection-too-high`。プロファイルは保存せず、サンプルを追加できます |
| 別のカメラ、または別の撮影サイズのプロファイル | 状態を変更する前に`calibration-not-applicable`で拒否します |
| 校正の無いカメラ、または板が写っていない状態で姿勢を測る | `not-calibrated` または `board-pose-unavailable` |
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

const found = readCameraCalibrationCapability(Scratch.vm.runtime);
if (!found) {
  // 未ロード。実行できる手順は無いので、待たずにその旨を返します。
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

capabilityはversion 4です。これまでの変更はすべてメンバーの追加だけなので、
`requireVersion`は1からこのビルドが提供するversionまでを受け付けます。

| version | 追加されたもの |
|---|---|
| 1 | セッション、サンプル、solve、publish、import、検証、状態と品質のreporter、hold-outの結果、板の姿勢測定 |
| 2 | 自動撮影：`setAutomatic`、`automatic`、`guidance` |
| 3 | `novelty`と`tiltDirection` |
| 4 | `progress`。利用側が16という数字を書き写さないよう、`CALIBRATION_GATES`、`CALIBRATION_STEPS_PER_GATE`、`CALIBRATION_PROGRESS_STEPS`も公開します |

このsub-entryが持つのは宣言、定数、板の描画関数だけで、機能拡張本体は一切含みません。
利用側のbundleに増えるものは実質ありません（とくにOpenCVは入りません）。

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
| `@kubohiroya/turbowarp-camera-source` | 必須のprovider。カメラのleaseと撮影条件を供給し、プロファイル契約を所有します |
| `@kubohiroya/turbowarp-camera-calibration-app` | 板の表示、自動校正、リストファイルとQRコードでのプロファイル書き出しを行うアプリ |
| `@kubohiroya/turbowarp-time-space-sync` | 板の姿勢測定を共通座標へ解き直す、予定された利用側 |
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
| 板の姿勢schema | `twcc/board-pose` v1 | この機能拡張が書きます |
| runtime capability | `kubohiroyaCameraCalibrationCapability` v4（1〜4を受け付ける） | VM runtimeから読みます |
| solve backend | `opencv-js-wasm-4.12.0-charuco` | 固定。ブロックで報告します |

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
| `pnpm opencv:check` | 実際のOpenCV buildが、この機能拡張の呼ぶ関数をすべて持つかをブラウザで確かめる |
| `pnpm board:check` | 描いた板を検出器に見せてブラウザで確かめる |
| `pnpm pack:check` | npm package内容の確認 |
| `pnpm release:check` | release dry run |

`opencv:check`と`board:check`はブラウザを起動するため`pnpm check`には含めず、
CIの別ステップで実行します。OpenCV自体のbuildし直しは
[`tools/opencv/README.md`](tools/opencv/README.md)を参照してください。

## リリース

1. `CHANGELOG.md`がある場合は更新する。
2. `package.json`のversionを更新する。
3. `pnpm check`を実行する。
4. release PRをmergeする。
5. 検証済みcommitへ`v<version>`tagを付ける。release workflowがそのversionをnpmへpublishする。
6. GitHub Release、npm tarball、GitHub Pages、`docsURI`、block icon、CDNを確認する。

## ライセンス

[Mozilla Public License 2.0](LICENSE)（SPDX: `MPL-2.0`）で提供します。

同梱するthird-party componentは
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)に記載しています。bundleは
この機能拡張のためにbuildしたApache License 2.0のOpenCV.js `4.12.0`を
インライン展開しています。
