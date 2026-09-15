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

## 予定している校正の流れ

未実装です。設計は移設Issueが所有します。

1. 1つの`cameraId`についてCamera Sourceからleaseを取得し、撮影解像度を固定する。
2. チェスボードのサンプルを収集し、品質の低い視点と類似しすぎる視点を拒否する。
3. 内部行列と歪み係数を求め、再投影誤差を検査する。
4. 得られた内部プロファイルをCamera Sourceのプロファイル契約経由で提供する。
5. solve、cancel、project停止、project再読込でleaseを解放する。

内部校正と外部姿勢は分離したままにします。この機能拡張はworld姿勢を提供せず、
提供されていない姿勢をidentityで代用することもありません。

## drift検出

`dist/`はrelease artifactとしてcommitします。`pnpm run check:dist`は両fileを
再buildし、`dist/`配下にGitが変更・削除・未追跡を報告した時点で失敗します。
これによりmanifestとbundleのdriftをローカル検査とCIの双方で検出します。
