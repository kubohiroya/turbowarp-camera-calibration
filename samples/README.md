# 最小デモ / Minimal sample

[TurboWarp Editor](https://turbowarp.org/editor?project_url=https%3A%2F%2Fkubohiroya.github.io%2Fturbowarp-camera-calibration%2Fsamples%2Fcapture-calibration-board.sb3) / [SB3](https://kubohiroya.github.io/turbowarp-camera-calibration/samples/capture-calibration-board.sb3)

## このデモ / This sample

Camera Source 0.21.0を同梱しています。Startはカメラを取得し、実際の校正開始ブロックと自動撮影ブロックを呼びます。`Calibration state`・`Accepted samples`・`Guidance`・`Calibration error`に実状態を表示します。完了後もプレビューを見られます。Stopで校正セッションとカメラを解放します。プロファイルの自動保存/公開は行いません。

### 印刷ボードと品質条件

- [印刷用ChArUco SVG](capture-calibration-board/charuco-board.svg) は、この拡張自身の`patternSvg`で生成したDICT_4X4_50ボードです。**A4横・100%・余白の自動調整なし**で平らな非光沢紙へ印刷します。実際の長さを定規で確認してください。
- 内部コーナー9×6、印刷マス10×7、公称1マス23.24 mm、マーカー16.7328 mmです。サンプルの開始引数と一致します。再生成は`node scripts/generate-sample-board.mjs`です。
- 手動solveの最低採用枚数は8枚、自動完了は12枚以上です。約1/5をhold-outへ残し、max error 1.5 pxで検証します。枚数だけで成功にはなりません。
- 20°〜45°傾けた異なる向き・距離・画面周辺を含む視点、ピント固定、ぶれなしが必要です。セッション中のcamera device/解像度/focus/zoom変更は避けます。投影した板は使わないでください。
- 1枚の撮影、連続した同じ姿勢、fit errorだけでは校正精度を確認できません。実撮影・OpenCVによる検出/solve・hold-out精度と出力profileは未検証です。

Camera Source 0.21.0 is embedded with provenance and license in `dependencies/`. Print the supplied A4 landscape SVG at 100%: 9×6 inner corners, 10×7 squares, nominal square 23.24 mm and marker 16.7328 mm. Start runs actual automatic calibration blocks. Manual solve needs ≥8 accepted views; automatic completion needs ≥12 with held-out views and 1.5 px limit. Vary tilt (20°–45°), distance and image position; fix focus and capture conditions. Physical detection, solving, hold-out accuracy and profile output remain unverified.

## 操作 / Operation

1. Editorで同梱拡張それぞれの **Run without sandbox** を選び **Allow** します。緑旗ではカメラも音声も起動しません。
2. **Start** をクリックするとカメラ許可を求めます。許可後は共有カメラのプレビューと実際の幅・高さを表示します。エラーならCamera errorを確認します。
3. **Stop** でプレビューとカメラleaseを解放します。Editorの停止ボタンでもCamera Sourceはカメラを解放します。拒否した場合はブラウザのサイト設定を確認し、再読み込みしてください。

Allow each embedded extension to run without sandbox. Green flag reads status only. **Start** deliberately requests a camera; **Stop** releases it. A rejected permission is shown in Camera error. The Editor stop button also releases Camera Source's camera. No audio blocks are included.

## 要件と未検証範囲 / Requirements and unverified scope

- HTTPS対応ブラウザ、物理カメラ、カメラ許可、TurboWarpのunsandboxed実行が必要です。
- 自動検証は無音で、実カメラを起動せず、公開ファイル・通常の許可画面・初期のfalse/0/空エラー・未起動での停止・停止後の再実行だけを確認します。
- **実機での取得、プレビューの向き・解像度、USB機器の相性、権限拒否後のOS/browserごとの復旧、認識・校正の成功は未検証です。** 観測していない値を成功値として表示しません。

A physical camera, permission, HTTPS and unsandboxed execution are required. Silent automated checks cover delivery, consent, idle reporters, stopping before acquisition and rerunning. Physical capture, preview orientation/resolution, device compatibility, OS permission recovery, recognition and calibration success are unverified.

## 再生成 / Maintenance

`manifest.json` に配信先、拡張ID、依存bundleのSHA256、期待値を記録します。`project.json` と自作SVGを編集し、`.nvmrc` のNode.jsで以下を実行してください。

```bash
node scripts/build-samples.mjs
node scripts/build-samples.mjs --check
node --test scripts/verify-samples.mjs
node scripts/prepare-pages.mjs
```

SB3は追加依存なしで決定的に生成しコミットします。unsandboxed bundleはSB3へ同梱します。Pagesは既存docs、dist、SB3、印刷素材を`_site`へまとめます。本体の既定フラグは変更しません。切戻しはPRをrevertしPagesを再配信します。
