# Scratch Workspace

Uncommitted workspace for prompts, drafts, and scratch scripts.
Contents are gitignored except this README.

## smoke の失敗記録

`bun run smoke` が失敗すると `scratch/smoke-evidence/<実行時刻>/` が残る。

- `summary.md` — 失敗したテスト名・ファイル・行・エラー・所要時間・飛ばしたテスト一覧
- `summary.json` — 同じ内容の機械可読版
- `artifacts/<テスト名>/` — 失敗時のスクリーンショット・動画・トレース

全部成功した実行のフォルダは自動で消える。トレースは次で開く。

```sh
bunx playwright show-trace scratch/smoke-evidence/<実行時刻>/artifacts/<テスト名>/trace.zip
```
