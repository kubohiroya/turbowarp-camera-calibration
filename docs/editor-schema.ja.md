# 段階1: Calibration import契約

> 現在のGit依存固定・実解決・検証結果は[editor-schema-publication.ja.md](editor-schema-publication.ja.md)と同名JSONを参照。以下は依存更新前の採取履歴として保持する。

> 2026-10-18レビュー修正追補: 現在の実装はHEADに対するローカル未コミット差分。下記の従来検証履歴を保持し、新しいsource/emit hashと12件の関連検証をeditor-schema-verification.jsonへ反映した。

追跡: https://github.com/kubohiroya/turbowarp-camera-calibration/issues/38 。共通親はextension-data-editor #18。

`./editor-schema`はcalibrationSchemaBundles（camerasource/twcs/legacy/ros）、decodeCalibrationSource、validateCalibrationInputを公開する。Camera Sourceのraw ROS/profile入口を再利用し、既存parseCalibrationProfileと同じconsumer条件を加える。正規化値は検証に使う別値で、source/raw dataを置換しない。controllerやprofile登録は呼ばない。

camerasourceの正本は既存camera-intrinsics-v1.schema.json。twcs/ROSはproducerの固定bundleを再利用する。legacyではこのconsumerが追加キーや12/14係数を受理するため、producerの厳しいlegacy gateを流用せず、所有Schema/editor-legacy-input.jsonと既存parserを合成する。Camera Sourceが受理するfisheyeでもこのconsumerが拒否する条件やzero-skewは維持する。

profileのpure型がDOMを参照しないよう、既存distortion定数・型をdistortion.tsへ分け、従来types.tsから同じ名前を再exportした。既存runtimeは同じ定数とparserを使い、API名と例外文面を維持する。

依存producerはCamera Source commit 9a9a5c905271e603af9a08142527e8a4aace8dec、共通はa1ab4f4f5b384eef08ef26e544186ee9d8ad4543へ固定。Git archiveのprepare/prepack経由で既存runtime/profileと新pure生成物を取得できることを確認。lock解決時だけ明示した2 Git artifactを許可し、取得先照合後に標準frozen installを確認した。永続依存ポリシーは変更していない。

確認: 型検査、既存profileと新adapterの9テスト、既存Vite/runtimeと独立emit、srcなしDOM/Reactなしisolated import/skipLibCheck:false型検査が成功。検証記録はeditor-schema-verification.json。

段階2のフォーム登録/owner encode/bindingは後段。既定OFFのGUIフラグを維持し、新入口の利用停止/本Issueのcommit revertでrollbackする。保存済みデータを移行しない。

## S1-5の最終確認

対象は合計10ケース（増分検証を含む）。srcを除いた実packageでReact不在・DOM/VM/通信globalアクセス0、skipLibCheck:falseの型検査を確認し、独立生成8ファイルを再emitと全SHA-256照合した。16契約の横断fixtureと依存artifact照合の記録は共通repoのschema-stage1-*.jsonを参照。既存生成基準は保持する。

validateCalibrationSourceを追加し、形式不正・未知variantでも元sourceを保持した安全な診断を返す。raw parser例外を診断へ混ぜない。

既存readerと同じtrim/BOM処理をparse前だけに適用し、返すsourceは原文のままとする。ROSの長さ条件はtrim後に判定される従来挙動を維持し、64 KiBを超える前後空白で受理を狭めない。回帰fixtureを追加確認した。

従来依存0.11.0とのprofile/profile-text/yaml実装3ファイルとROS mapping以降のhelper群はbyte hash一致。新raw ROS関数への委譲以外の既存readerロジックを変えていない。比較はeditor-schema-profile-compat.jsonに記録した。

## レビューR1/R3の修正

JSONのschema識別子をROS風の追加キーより優先する。既存legacyにimage_widthやcamera_matrix等があってもROSへ分岐せず、従来の追加キー・原文・未正規化データを保持する。既存parserと照合する回帰テストを追加した。

twcs/ROSのresource・provenanceは固定producer artifactのまま再利用し、identityだけをcalibration-profileのowner/contract/revisionへ包み直す。全4 variantについてcompile・structure・semantic診断のidentityとconsumerIdを検査し、producer自体のidentityを変更しない。

今回はprofile/editorの関連12テスト、型検査、変更ファイルのlint、既存Vite/runtime build、8 emitの再生成hash一致、srcなしpackage境界を確認した。common/Camera Sourceのmanifest・lock・固定依存pinは変更せず、実artifactとの一致を再確認した。
