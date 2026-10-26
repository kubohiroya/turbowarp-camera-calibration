# npmリリース完了

公開・検証を終えた版は`latest`と`next`を同じ番号へ揃えます。次版の試験公開は`next`だけを進め、`latest`は直前の完了版を保持します。ローカル開発だけではnpmタグは変わりません。

タグのRelease workflowは公開後にregistry反映を待ち、両タグを同期して一致を確認します。不一致や権限エラーは未完了として停止します。npm 11.21.0とTrusted Publisherの直接`npm publish`および`Allow npm dist-tag`権限が必要です。2FAは弱めません。

すでに公開された版のタグ処理だけを再試行するときは、mainでrelease.ymlを手動起動し、versionにmainのpackage.jsonと同じ番号を指定します。再公開は行いません。試験公開では`npm publish --tag next`を使い、完了処理を呼びません。

切戻しは、変更前の検証済みタグをIssueに記録して戻します。Gitタグ・公開済み版は作り直さず、製品修正は別番号で発行します。

[公式仕様](https://docs.npmjs.com/trusted-publishers/) / [Issue #16](https://github.com/kubohiroya/turbowarp-plus-packages/issues/16)
