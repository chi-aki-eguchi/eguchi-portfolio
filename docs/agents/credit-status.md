# Claude / Codex クレジット残量の自動確認

CodexBar CLIの利用率から残量を計算し、Claude Codeへ短い判断材料を渡す。
`credits.remaining`は追加クレジット用の別枠なので、Codex週間残量には使わない。

## 自動確認

- `SessionStart`: Claude Codeセッション開始時
- `UserPromptSubmit`: 次の依頼を受けた時。大きな工程・Codex委任・大量テスト・大規模レビュー前の確認を兼ねる
- `Stop`: タスクが一区切りついた時

正常取得から5分以内はキャッシュを使う。30分以上経過後の大きな工程前は次のコマンドで
明示確認する。

```sh
./.claude/hooks/credit-status.mjs --force
```

状態ファイルは `~/.claude/credit-status/status.json`、短い表示は
`~/.claude/credit-status/status.txt`。権限は所有者だけが読める`600`。

## 状態と行動

- `normal`（残り50%以上）: 通常運転。重複テスト、不要な全読込、長いログ再読込を避ける
- `saving`（20〜49%）: 必須要件だけ、小さく区切り、重要テストだけ
- `closing`（10〜19%）: 新規工程を始めず、最低限テスト・commit・task.mdまで閉じる
- `critical`（10%未満）: 安全化、最低限テスト、commit、task.md、短い報告だけ

`willLastToReset=false`なら一段階厳しくする。Codexの`dataConfidence`が`exact`以外なら
最低でも`closing`にする。ClaudeとCodexのうち厳しい方を全体状態に採用する。

## 取得失敗

Claude・Codex一括取得を1回だけ再試行する。失敗時、30分以内の正常キャッシュがあれば警告付きで
使い、最低でも`closing`にする。無ければ残量不明の`closing`として新規の大規模作業を
止める。hook自体は正常終了するため、本来の開発操作を破壊しない。

保存するのは利用率、残量、リセット時刻、枯渇予測、取得時刻、状態、警告だけ。
トークン、Cookie、APIキー、メールアドレス、CodexBar認証情報は保存しない。

## 元へ戻す

1. `.claude/settings.json`から`UserPromptSubmit`、追加した全対象`SessionStart`、`Stop`の
   `credit-status.mjs`項目だけを削除する。既存hookは残す。
2. `.claude/hooks/credit-status.mjs`と`.claude/hooks/credit-status.test.mjs`、この文書を削除する。
3. 状態表示も不要なら`~/.claude/credit-status/`を削除する。

設定変更前バックアップ:
`~/.claude/backups/eguchi-portfolio-settings-before-credit-status-20260715-1415.json`
