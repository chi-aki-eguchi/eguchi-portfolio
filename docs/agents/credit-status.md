# Claude / Codex クレジット状態

CodexBar CLIの利用率から残量を計算し、Claude Codeへ短い判断材料を渡す。
`credits.remaining`は追加クレジット用の別枠なので、Codex週間残量には使わない。

このhookは警告と状態保存だけを行う。`task.md`、Git、製品コード、認証情報は変更しない。

## CodexBar CLI の探索

毎回、次の順で実行可能なCLIを探し、最初に見つかったものを使う。

1. 環境変数 `CODEXBAR_CLI` で明示された実行ファイル
2. `PATH` 上の `codexbar` または `CodexBarCLI`
3. Homebrew標準位置 `/opt/homebrew/bin/codexbar`、`/usr/local/bin/codexbar`
4. `~/Applications/CodexBar.app/Contents/Helpers/CodexBarCLI`
5. `/Applications/CodexBar.app/Contents/Helpers/CodexBarCLI`

固定パスが変わっても、`PATH`または`CODEXBAR_CLI`で安全に指定できる。
CLIが無い場合は `errorCode: codexbar_cli_not_found`、取得実行が失敗した場合は
`errorCode: codexbar_lookup_failed` として区別する。

## 自動確認

- `SessionStart`: Claude Codeセッション開始時
- `UserPromptSubmit`: 次の依頼を受けた時
- `Stop`: タスクが一区切りついた時

正常取得から5分以内はfresh cacheを使う。明示確認:

```sh
./.claude/hooks/credit-status.mjs --force
```

状態ファイルは `~/.claude/credit-status/status.json`、短い表示は
`~/.claude/credit-status/status.txt`。権限は所有者だけが読める`600`。

## 状態と行動

- `normal`（残り50%以上）: 通常運転。重複テストや不要な全読込を避ける
- `saving`（20〜49%）: 必須要件へ絞り、小さく完了する
- `closing`（10〜19%）: 新規工程を始めず、検証・commit・Current Stateまで閉じる
- `critical`（10%未満）: 安全化、最低限検証、commit、Current State、短い報告だけ

`willLastToReset=false`なら一段階厳しくする。Codexの`dataConfidence`が`exact`以外なら
最低でも`closing`にする。ClaudeとCodexのうち厳しい方を全体状態に採用する。

## cache と取得失敗

- 正常取得から5分以内: `cache: fresh`
- 正常取得から30分以内に再取得失敗: `cache: stale`、警告付き、最低`closing`
- 30分より古いcache、または正常cacheなし: provider値を捨て、`cache: none`、
  残量不明の`closing`

`stale`は過去値であり、現在値として扱わない。`checkedAt`と`lastAttemptAt`を見分ける。
CLI取得は1回だけ再試行する。hookは警告時も終了コード0にして、通常作業を止めない。

保存するのは利用率、残量、リセット時刻、枯渇予測、取得時刻、状態、cache種別、
安全なエラーコードと警告だけ。トークン、Cookie、APIキー、メールアドレス、
CodexBar認証情報、CLIの出力全文は保存・表示しない。

## 検証

```sh
node --test .claude/hooks/credit-status.test.mjs
```

テストは一時HOMEと偽CLIを使い、PATH探索、CodexBar.app探索、CLI未発見、
1回再試行、fresh/stale/期限切れcacheを確認する。実アカウントの認証情報は使わない。

## 元へ戻す

1. `.claude/settings.json`の`UserPromptSubmit`、対象`SessionStart`、`Stop`から
   `credit-status.mjs`項目だけを外す。
2. Gitでこのhook、test、この文書を変更前へ戻す。
3. 状態表示も不要な場合だけ、オーナー確認後に`~/.claude/credit-status/`を削除する。

以前の設定バックアップには古い固定パスが残る可能性があるため、現行設定として復元せず
履歴参照に限定する。
