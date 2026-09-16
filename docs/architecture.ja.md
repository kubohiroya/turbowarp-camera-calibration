# アーキテクチャ

[English](architecture.md)

## packageの境界

この機能拡張はカメラ校正の**手順**を所有します。校正**プロファイルの契約**、
すなわちschema、検証、現在の撮影条件に対する適合性判定は、
[TurboWarp-Camera-Source](https://github.com/kubohiroya/turbowarp-camera-source)
が所有します。

```text
turbowarp-camera-source      カメラ取得、lease、preview、プロファイル契約
        ^                             ^
        | lease                       | プロファイル提供
        |                             |
turbowarp-camera-calibration  チェスボードのサンプル収集、solve、再投影誤差
```

この位置に境界を置いたのは実測に基づく判断です。`findChessboardCorners`と
`calibrateCamera`に必要なOpenCVのbuildは約10 MBあり、TurboWarp機能拡張は
単一のstandalone bundleとして配布されます。動的`import()`は別チャンクにならず
同じfileへインライン展開されるため、solverをCamera Source内に置くと、校正を
一度も行わない利用者を含めたすべてのカメラ利用者がその重量を負担します。
起動時のfeature flagでは回避できません。flagが制御するのは実行であって、
配信されるバイト数ではないからです。

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
src/calibration/types.ts         board、sample、solve結果、backendの継ぎ目
src/calibration/profile.ts       内部校正プロファイル、その検証、旧形式のadapter
src/calibration/camera-source.ts Camera Source capabilityのclient
src/calibration/controller.ts    共有カメラ1台ごとのセッション
src/calibration/opencv-backend.ts 固定versionのOpenCV solver。初回利用時に生成
src/extension.ts                 blockの結線とruntimeのライフサイクル
```

OpenCVに触れるのは`opencv-backend.ts`だけで、controllerは
`CalibrationBackendFactory`越しにのみ到達します。testはmock backendで手順全体を
動かすため、solverは必要な場所だけで動きます。

## 校正の流れ

1. 1つの`cameraId`についてCamera Sourceからleaseを取得し、その時点の解像度・device・左右反転にセッションを固定する。
2. チェスボードのサンプルを収集し、品質の低い視点と類似しすぎる視点を拒否する。保持するのは8枚以上40枚以下。
3. 内部行列と歪み係数を求め、RMS再投影誤差をセッションの上限と比較する。
4. 得られた内部プロファイルをCamera Sourceのプロファイル契約経由で提供する。
5. solve、cancel、cleanup、device喪失、project停止、project再読込、runtime破棄でleaseを解放する。

内部校正と外部姿勢は分離したままにします。この機能拡張はworld姿勢を提供せず、
提供されていない姿勢をidentityで代用することもありません。`calibrateCamera`は
視点ごとの回転と並進も返しますが、それはboardの位置であってカメラの位置では
ないため、姿勢として提供せず破棄します。

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

登録自体は安価です。OpenCVのruntimeは最初のサンプル取得かsolveで初めて生成
されるので、状態やbackend名を読むだけのprojectでは初期化されません。カメラの
leaseも校正を開始するまで要求しません。これらはflagが守っているのではなく、
コードがどこで生成しているかによって成り立っています。

ロールバックは「この機能拡張を読み込まない」ことです。自前の校正経路を残して
いる利用側は、projectから外すだけで旧経路へ戻せます。これは委譲するかどうかと
いう、すでに下している判断と同じものです。

## drift検出

`dist/`はrelease artifactとしてcommitします。`pnpm run check:dist`は両fileを
再buildし、`dist/`配下にGitが変更・削除・未追跡を報告した時点で失敗します。
これによりmanifestとbundleのdriftをローカル検査とCIの双方で検出します。
