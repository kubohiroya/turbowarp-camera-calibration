# Source/Form編集の接続（段階2）

`src/source-editors.ts` は `Scratch.gui?.blockEditors.registerSourceEditor` が存在する場合だけ登録する。旧GUIでは登録を省略し、既存ブロックの実行APIを維持する。GUI側の起動時フラグ `blockEditorSourceForms` は既定OFFで、既存 `blockEditorDialogs` と同時に有効な場合だけ新APIを公開する。

正本: calibrationSchemaBundles の camerasource/legacy/twcs/ros とconsumer固有の既存pure制約。Camera Source producerのSchema/パーサーを再利用し、fisheye/非zero-skew等の既存制約も維持。

ブロック・引数の完全な対応は `tests/source-editors.test.ts` のtargetsと `createSourceEditorOptions` で検証する。raw sourceを正本とし、JSON/YAMLのformat・variantを自動変換しない。保存候補文字列は共通エディターで1回だけ作り、fresh contextとともにownerの `validateSource` に渡し、成功したその文字列をそのまま1 transactionで保存する。文字列の代わりにruntimeのcontrollerや正規化値を書き戻すことはない。登録はruntime破棄時に解除する。

受け入れ基準は対象入力の網羅、既存API/データ互換、owner validationの副作用がないこと、no-op/cancelの原文保持、複数入力の原子保存、生成物とソースの一致、および最終artifactのpin/lock/実解決一致。候補enumの取得や新規項目作成UIは段階4以降に分離する。

ロールバックはGUIの起動時フラグ `blockEditorSourceForms` をOFFにして再起動する。旧登録API・実行API・保存済みデータはそのまま使用できる。依存artifactの切替が必要な場合はproducerより先にconsumerを既存pinへ戻す。

公開依存・安定版検証・公開手順は [段階2の公開記録](stage-2-publication.ja.md) を参照してください。歴史基準と既存採取ログは保持します。
