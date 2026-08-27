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

2026-08-03のPhase C反対レビューを反映し、**全体を一つの深刻度へまとめない**。状態ファイル
`status.json`（次回確認用の小さな記録）は、次の3軸をClaudeとCodexで別々に保存・表示する。

| 軸 | 値 | 判定方法 |
|---|---|---|
| 取得状態 `acquisition` | `current` / `recent` / `old` / `unknown` | 現在値 / 5分以内の過去値 / 5〜30分の過去値 / 取得不能または期限外 |
| 週枠 `weekly` | `sufficient` / `low` / `unknown` | 新しい実測値で、信用できるリセット時刻と `willLastToWeeklyReset` がそろう場合だけ「十分」または「少ない」 |
| 作業継続性 `workContinuity.claude` | `holds` / `at_risk` / `unknown` | Claudeの5時間枠について、同じ信用条件と `willLastToSessionReset` を使う |

CodexBarがCodexの5時間枠を返さないため、作業継続性はClaudeの5時間枠だけを表す。
ClaudeとCodexの取得・週枠は常に別々で、一方の解析に失敗しても、もう一方の現在値は捨てない。
旧形式の状態ファイルも、安全な残量・時刻項目だけを読み直して扱う。旧形式の`status`は判断に
使わない。

残量パーセントは表示・保存するが、それだけで週枠を「少ない」とはしない。たとえば残量20%でも
`willLastToWeeklyReset=true`なら、週枠は「十分」と表示する。`dataConfidence`が`exact`以外の
Codex週枠も「不明」とする。

### 行動文

表示する行動の提案は次の2つだけで、命令形にしない。

1. 週枠が**新しい実測値で**`low`のときだけ、「今回の作業範囲を小さくすると安全です」と表示する。
2. Claudeの5時間枠が`at_risk`または`unknown`、あるいはClaude/Codexの取得が`old`/`unknown`の
   ときだけ、「再開可能な区切りを作ると安全です」と表示する。commitに触れる場合も、依頼で許可され、
   変更が一貫している場合に限るという条件を必ず併記する。

「週枠が不明」は通常運転へ丸めず、そのまま不明として表示する。ただし、不明であることだけを
理由に作業範囲を縮めない。取得ができない、または5時間枠が判断不能な場合は、上の2番目だけを
提案する。

### リセット時刻の信用条件

リセット時刻を`willLastToReset`の判断材料として使うのは、次を**すべて**満たす場合だけである。

1. ISO形式でタイムゾーン（`Z`またはUTC差）が付いており、解析できる。
2. 端末時刻から見て未来である。
3. 取得値が現在値または5分以内の過去値である。
4. cacheがそのリセット時刻をまたいでいない。
5. 端末時刻との差が、その枠として異常でない（5時間枠は6時間以内、週枠は8日以内）。

一つでも欠ければ、そのリセット時刻と予測に基づく軸は`unknown`にする。これはPCの時計ずれを
完全に推定するものではないが、過去・遠すぎる未来・cacheの時刻逆転を判断材料から外す安全網である。

## cache と取得失敗

- 直前の**両方の**正常値が5分以内: CLIを呼ばず`recent`として再利用する。
- 再取得時、ClaudeとCodexは別々に解析する。片方だけ失敗した場合、成功側は`current`のまま、
  失敗側だけそのprovider自身のcacheを使う。
- 5〜30分のcacheは`old`であり、残量数値は参考として残すが、週枠と作業継続性は`unknown`にする。
- 30分超、時刻なし、または未来の保存時刻（端末時計が戻った場合を含む）は再利用しない。
- CLI取得は1回だけ再試行する。取得・保存の失敗時もhookは終了コード0を返し、通常作業を止めない。

上位の`cache`は互換表示用の`live`/`fresh`/`stale`/`none`/`mixed`であり、行動の判断には使わない。
providerごとの`acquisition`が正本である。保存するのは利用率、残量、リセット時刻、枯渇予測、
取得時刻、上記の軸、cache種別、安全なエラーコードと警告だけ。トークン、Cookie、APIキー、
メールアドレス、CodexBar認証情報、CLIの出力全文は保存・表示しない。

## 検証

```sh
node --test .claude/hooks/credit-status.test.mjs
```

テストは一時HOMEと偽CLIを使い、hookを別プロセスで直接起動する。正常取得、片側だけの
取得失敗、CLI未発見、1回再試行、fresh/stale cache、リセット時刻の信用条件、時計が戻って
保存時刻が未来になった場合、旧形式cacheの読み直しを確認する。実アカウントの認証情報は使わない。

## 元へ戻す

1. `.claude/settings.json`の`UserPromptSubmit`、対象`SessionStart`、`Stop`から
   `credit-status.mjs`項目だけを外す。
2. Gitでこのhook、test、この文書を変更前へ戻す。
3. 状態表示も不要な場合だけ、オーナー確認後に`~/.claude/credit-status/`を削除する。

以前の設定バックアップには古い固定パスが残る可能性があるため、現行設定として復元せず
履歴参照に限定する。
