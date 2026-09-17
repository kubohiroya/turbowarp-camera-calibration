# アーキテクチャ

[English](architecture.md)

## packageの境界

この機能拡張はカメラ校正の**手順**を所有します。校正**プロファイルの契約**、
すなわちschema、検証、現在の撮影条件に対する適合性判定は、
[TurboWarp-Camera-Source](https://github.com/kubohiroya/turbowarp-camera-source)
が所有します。

```text
turbowarp-camera-source      カメラ取得、lease、preview、撮影条件、プロファイル契約
        ^                             ^
        | lease                       | プロファイル提供
        |                             |
turbowarp-camera-calibration  ChArUcoボードの描画と検出、サンプル収集、solve、hold-out検証、板の姿勢
```

この位置に境界を置いたのは実測に基づく判断です。ChArUcoボードの検出と
`calibrateCameraExtended`にはOpenCVが必要で、TurboWarp機能拡張は
単一のstandalone bundleとして配布されます。動的`import()`は別チャンクにならず
同じfileへインライン展開されるため、solverをCamera Source内に置くと、校正を
一度も行わない利用者を含めたすべてのカメラ利用者がその重量を負担します。
起動時のfeature flagでは回避できません。flagが制御するのは実行であって、
配信されるバイト数ではないからです。

ここに同梱するOpenCVは、この機能拡張のためにbuildしたものです（`tools/opencv/`）。
標準buildはWeb Worker内で初期化が終わりません。`ENVIRONMENT=web,worker`と、
`src/calibration/opencv-symbols.ts`に列挙した関数だけのwhitelistでbuildすると、
Worker内で起動し、10.9 MBではなく3.85 MBになります。`pnpm opencv:check`は、
実際のbuildが列挙した関数をすべて持つかをブラウザで確かめます。

## build成果物

同一のcommit済みsource定義から、実行時の振る舞いと互換性metadataを分けて
生成します。

```text
src/index.ts + src/extension.ts
  -> vite-plugin-turbowarp-extension
  -> dist/camera-calibration.js

src/config.ts + src/block-definitions.json
  -> extension-api-manifest Vite plugin
  -> dist/extension-manifest.json
```

manifest pluginはViteのpost-build phaseで動作します。これによりJavaScript plugin
の単一出力検証を保ったまま、TurboWarp bundleの完成後にmanifestだけを追加します。

## Extension API manifest v1

`schemas/extension-manifest.schema.json` が正規のJSON Schemaです。
`formatVersion`は`1`で、互換性のないmanifest形状を導入する際に変更します。

v1の契約に含むもの:

- TurboWarpのextension ID
- 各blockのopcodeとblock type
- 各argumentのID、type、任意のmenu参照
- 各menuのIDとreporter受入れ可否

block、argument、menuはserialize前に識別子で整列します。text、description、
既定値、静的menu項目は、保存済みprojectのAPI参照を identify しないため意図的に
除外します。

## moduleの構成

```text
src/board/aruco.ts                 OpenCVから取り出したDICT_4X4_50のマーカー
src/board/pattern.ts               板の定義とSVG描画。./runtimeから公開
src/calibration/contract.ts        状態、エラーコード、案内、傾ける向き、進捗の関門
src/calibration/types.ts           board、sample、solve結果、backendの継ぎ目
src/calibration/pose.ts            板をどれだけ斜めから見たか、集合の広がり
src/calibration/profile.ts         内部校正プロファイル、その検証、旧形式のadapter
src/calibration/camera-source.ts   Camera Source capabilityのclient
src/calibration/controller.ts      共有カメラ1台ごとのセッション（手動・自動）
src/calibration/worker-backend.ts  main thread側。Workerを持ち、frameを読み、pixelを転送
src/calibration/opencv-worker.ts   Workerの入口
src/calibration/opencv-backend.ts  検出、solve、hold-out検証、板の姿勢（OpenCV）
src/calibration/opencv-symbols.ts  backend名と、buildが持つ関数のwhitelist
src/runtime.ts                     ./runtime sub-entry。宣言、定数、板の描画
src/runtime-capability.ts          ほかの機能拡張が駆動するversion付きcapability
src/extension.ts                   blockの結線とruntimeのライフサイクル
```

OpenCVに触れるのは`opencv-backend.ts`だけで、Worker内で動きます。controllerは
`CalibrationBackendFactory`越しにのみ到達し、本番で渡されるのが
`worker-backend.ts`です。`cv.imread`はWorkerに無いdocumentを要求するため、
video要素を持つthreadでframeを読み、pixel bufferを転送します。testはmock backendで
手順全体を動かすため、solverは必要な場所だけで動きます。

板の描画を検出器の隣に置くのは、ページが印刷する板と検出器が探す板を同じ数字から
作るためです。`pnpm board:check`はブラウザで各板を描き、自分の検出器では全コーナーが
見つかり、ほかの検出器では1つも見つからないことを確かめます。

## 校正の流れ

1. 1つの`cameraId`についてCamera Sourceからleaseを取得し、大きさのあるframeを待って、その時点の解像度・device・左右反転・撮影条件（リサイズ、ズーム、フォーカス）にセッションを固定する。
2. コーナーが6点以上写ったChArUcoのサンプルを収集し、ぶれた視点、類似しすぎる視点、別の板を拒否する。手動では40枚まで保持する。自動撮影は250 msごとに見て、40枚に達したら最も他と似ている1枚を入れ替える。
3. 枚数が足りれば約5分の1を検証用に残して内部行列と歪み係数を求め、傾けていない組は拒否する。手動・自動を問わず、fit側の誤差と（検証用に2視点以上残していれば）hold-out誤差の両方をセッションの上限と比べる。自動撮影は両方が上限以下になるまで背景でsolveを繰り返す。hold-out誤差は各視点に当てはめた姿勢の自由度を差し引いて求め、プロファイルの`quality.sampleCount`はfitに使った視点の数とする。
4. 視点ごとに、またsolveを確定する前にも撮影条件を読み、変わっていれば残りを集める前にただちに`capture-condition-mismatch`で終える。板の姿勢を測るときにプロファイルがカメラに合うかは、規則を写さずCamera Sourceの判定（`evaluateProfileCompatibility`）に従う。
5. 得られた内部プロファイルを、撮影条件とともにCamera Sourceのプロファイル契約経由で提供する。
6. solve、cancel、cleanup、device喪失、project停止、project再読込、runtime破棄でleaseを解放する。

内部校正と外部姿勢は分離したままにします。この機能拡張はworld姿勢を提供せず、
提供されていない姿勢をidentityで代用することもありません。`calibrateCameraExtended`は
視点ごとの回転と並進も返しますが、それは収集中に動いていた板の位置であってカメラの
位置ではないため、姿勢として提供せず破棄します。

動かなくなった板の位置は別の操作で測ります。板の姿勢測定は自分のleaseを取り、
保持している校正と`solvePnP`で姿勢を解いて、leaseを返します。結果
（`twcc/board-pose`）はカメラ座標系での板の姿勢で、スケールが`measured`か`nominal`か
を記録し、観測したコーナーを添えて、配置を解くツールが共通座標へ解き直せるように
します。内部プロファイルには混ぜません。

## 共有カメラ1台ごとのセッション

`CameraCalibrationController`は`cameraId`ごとに`CameraCalibration`を保持します。
各instanceが自分のlease、サンプル、プロファイル、診断を所有します。あるカメラの
cancelやcleanupが別のカメラのleaseを解放することはなく、Camera Sourceは元の
カメラを他の利用者と共有し続けます。

非同期の各段階はセッションの操作世代を持ち回ります。cancelはこれを進めるため、
その後に解決したサンプルやsolveは、状態を書かずに、またcancelが引き取った
leaseを二重に解放せずに終了します。遅い応答が取り消し済みセッションを復活させたり、
共有leaseを壊したりしないのはこのためです。

## プロファイル契約

公開するプロファイルは
`schemas/camera-intrinsics-v1.schema.json`が記述します。この契約はCamera Sourceの
責務であり
（[kubohiroya/turbowarp-camera-source#14](https://github.com/kubohiroya/turbowarp-camera-source/issues/14)）、
それが出るまでは本repositoryから公開します。移行時に変わるのは`schema`と
schemaの`$id`だけです。

検証はschema libraryではなく`src/calibration/profile.ts`の手書き実装で行い、
公開schemaと検証実装のdriftは`tests/calibration-profile.test.ts`が検出します。
プロファイルは状態になる前に完全に検証します。不正なschema、非有限値、未知の
カメラモデルや歪みモデル、モデルと一致しない係数数、ペアリング資格情報、別カメラ
のプロファイル、別の撮影サイズのプロファイルは、固有のエラーコードで拒否し、
何も変更しません。

移設元の`twrmc/camera-calibration` v1のプロファイルも同じ入口で読みます。
`worldFromCameraMatrix`は捨て、記録されていなかった品質は捏造せず欠落のままに
します。

## 依存とversionのエラー

Camera Sourceのcapabilityは必要になった時点でruntimeから参照し、読み込み時に
キャッシュしません。

| 状況 | コード |
|---|---|
| Camera Sourceが未読込み | `dependency-missing` |
| Camera Sourceにプロファイル登録APIが無い | `api-version-mismatch` |
| Camera Sourceの契約versionが異なる | `api-version-mismatch` |
| solveもimportもしていない | `not-calibrated` |
| 登録側がプロファイルを拒否した | `publish-failed` |

いずれも成功として扱わず、いずれも校正状態を書き換えません。publishはセッション
操作ではありません。Camera Sourceが受け取れなかったsolve済みプロファイルは
solve済みのままであり、すでに失敗したセッションがpublish要求で回復することも
ありません。

## この機能拡張を読み込む費用

全ブロックとruntime capabilityは、機能拡張の登録時点で公開されます。
切り替えスイッチはありません。

登録自体は安価です。WorkerとOpenCVのruntimeは最初に使うときに初めて生成
されるので、状態やbackend名を読むだけのprojectでは初期化されません。カメラの
leaseも校正または測定を開始するまで要求しません。これらはflagが守っているのではなく、
コードがどこで生成しているかによって成り立っています。

ロールバックは「この機能拡張を読み込まない」ことです。自前の校正経路を残して
いる利用側は、projectから外すだけで旧経路へ戻せます。これは委譲するかどうかと
いう、すでに下している判断と同じものです。

## drift検出

`dist/`はrelease artifactとしてcommitします。`pnpm run check:dist`は両fileを
再buildし、`dist/`配下にGitが変更・削除・未追跡を報告した時点で失敗します。
これによりmanifestとbundleのdriftをローカル検査とCIの双方で検出します。
