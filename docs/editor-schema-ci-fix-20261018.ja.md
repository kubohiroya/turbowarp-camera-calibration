# 段階1 CI修正（2026-10-18）

PR #39 の段階1差分に対する検証基盤の修正記録。段階2のUI接続、merge、npm公開は含まない。

## 変更と互換性

- 公開入口の期待値に明示的な `./editor-schema` の型・実装パスと `lib-editor/` 配布を追加した。入口の完全一致を維持し、bare root入口、既存runtimeの公開名、副作用指定は変更しない。
- runtime到達先の固定リストに `src/calibration/distortion.ts` を追加した。このファイルは既存抽出済みの係数定数・型のみで、controller/OpenCVへの到達を許可しない。ブラウザglobal・外部packageの非参照検査は維持した。
- pack出力をJSONとして読む呼出しには `--foreground-scripts=false` を明示した。既存 `--ignore-scripts` は維持し、JSONの切り出しや検査省略は行わない。npm 10のprepare出力がJSONに混ざる環境でもpack内容を通常どおり検査する。
- 依存policyは厳密なsemver pinに加え、既存の共通artifactとCamera Sourceという2依存名に限り、それぞれの正確なGitHub取得URLと40桁SHAを受理する。range、branch、tag、短いSHA、別owner/host/repository、無関係なGit依存は拒否する。全依存のnotice記載検査は維持し、今回のGit artifactと利用入口をnoticeへ記載した。
- 実行コード、データ形式、Schema、legacyデータの保存・移行処理には変更を加えない。

## 検証と受け入れ基準

`corepack pnpm@11.11.0 check` は全成功。typecheck、lint、16ファイル・202テスト、README生成差分なし、build/dist一致、repo policy、pack dry-runを確認した。うち追加2テストはGit許可範囲と誤ったpinの拒否を検証する。

通常のNode v26.7.0/npm 11.19.0に加え、CI互換のnpm 10をPATHの先頭に置いた `repo:check` も成功。正確なnpm実体と共通のCI再現手順は統合検証記録に保存する。

- `/tmp/schema-stage1-ci-fix-20261018/camera-calibration-check.log`: 修正前policy失敗の再現（新Git依存をsemver扱いし、noticeが不足する5エラー）。
- `/tmp/schema-stage1-ci-fix-20261018/camera-calibration-check-fixed.log`: 全check成功。
- `/tmp/schema-stage1-ci-fix-20261018/camera-calibration-repo-npm10.log`: npm 10でのpack JSON検査成功。

上記は依存pin更新前の実行記録。producer artifact更新後はmanifest・lock・実解決・noticeのSHAを揃え、依存境界と生成物を統合検証記録で再確認する。過去のpublication記録は当時の基準として保持する。

### producer pin更新後の追補

Camera Sourceを `53a2a400bbdee6a850379eff29f0d422d948174e` へ更新し、manifest・lock・実解決・noticeを整合した後、typecheck、lint、202テスト、README、buildを再実行して成功した。`check:dist` はGit差分を検査する既存仕様により、commit前のbundle更新を検出して停止した。検査は変更せず、commit後の成功確認を統合検証記録で行う。

bundleの旧HEADとの差はpnpmキャッシュパスを含む `//#region` コメント6行のみで、当該コメント行を除いた全bytesは一致した。旧SHA-256は `f803c303f221d4bf3c68e62909ee4cde835c6da4fe9b88bace58fc4129bb2986`、新SHA-256は `73f39c007d85d1e47a0b08d9652217cd50ad124d699e250452d877d38f14f276`。API・データの実行処理に変更はない。

- `/tmp/schema-stage1-ci-fix-20261018/camera-calibration-postpin-check.log`: pin更新後の型・lint・202テスト・build結果とcommit前dist検出。
- `/tmp/schema-stage1-ci-fix-20261018/camera-calibration-postpin-bundle.json`: bundle差分とハッシュの照合。
- `/tmp/schema-stage1-ci-fix-20261018/camera-calibration-postpin-repo-npm10.log`: pin更新後のnpm 10 repo/JSON pack検査。
- `/tmp/schema-stage1-ci-fix-20261018/camera-calibration-postpin-pack.log`: pin更新後のpack dry-run。

## ロールバック

CI修正commitをrevertし、依存artifactを戻す場合はmanifest・lock・実解決・noticeのSHAを一組で戻して再検証する。runtime APIとデータ形式は変更していないためデータ移行は不要。段階2以降の開始には、修正artifactへの依存整合と既存の開始条件を別途満たす必要がある。
