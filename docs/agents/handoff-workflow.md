# Claude Code / Codex / ChatGPT 引き継ぎ

## 役割

- 共通の現在地: `task.md` 冒頭のCurrent State
- 共通の安全規則: `AGENTS.md`
- Claude固有の設計・検証責任: `CLAUDE.md`
- 長い過去ログ: `docs/archive/task-handoffs.md`。必要な時だけ参照
- ChatGPT共有: 読み取り専用Packet

hookはCurrent Stateを自動更新しない。編集者がGitの実物を確認して更新する。

## Current State の鮮度確認

次のコマンドはファイルを変更せず、古い場合も警告だけで終了する。

```sh
cd /Users/chiaki/eguchi-portfolio-app
node scripts/ai/check-handoff-freshness.mjs
```

`HEAD: SELF`は、Current Stateを最後に更新したcommitを意味する。
実際のHEADと`task.md`の最終更新commitが違えば、Current State更新漏れとして警告する。

## ChatGPT Packet の生成

次のコマンドをそのまま実行し、STARTからENDまでをChatGPTへ貼る。

```sh
cd /Users/chiaki/eguchi-portfolio-app
node scripts/ai/chatgpt-handoff.mjs
```

scriptが読むもの:

- Git branch / HEAD / status / upstreamとの差
- `task.md`冒頭のCurrent State
- `~/.claude/credit-status/status.json`の安全な項目（存在する場合だけ）

scriptが読まないもの:

- `.env`、Cookie、APIキー、パスワード、認証情報
- `scratch/codex-out-*.log`の本文
- Claude/Codexの会話全文

scriptはファイル更新、commit、push、network通信を行わない。

## ローカル認証の扱い

`~/.claude/settings.local.json`の許可コマンドへ管理パスワードを埋め込まない。
ローカルの認証確認が必要な時は、`ADMIN_PASSWORD`など実行時の環境変数を安全な保管元から
与え、値をコマンド履歴・ログ・Handoffへ表示しない。過去の値は別ファイルへコピーしない。

## Claude から Codex を呼ぶ

新規実装は、リポジトリを作業場所にしてstdinを閉じる。

```sh
cd /Users/chiaki/eguchi-portfolio-app
codex exec -s workspace-write -c approval_policy='"never"' "<目的・完成条件・範囲・禁止操作・検証・停止条件>" < /dev/null
```

長い実行は出力を既存どおり`scratch/codex-out-*.log`へ保存できる。ログはgitignoredで、
削除・外部転載せず、先頭付近のsession IDだけをCurrent Stateへ記録する。

## Codex session をresumeする

まず失敗理由、Git差分、ログに記録された正確なsession IDを確認する。
現在のCLIでは`resume`に`-C`と`-s`は無いので、先に`cd`し、元sessionのsandboxを引き継ぐ。

```sh
cd /Users/chiaki/eguchi-portfolio-app
codex exec resume <session-id> -c approval_policy='"never"' "<現在のGit状態を確認し、元の目的の残りだけを続行。迷ったら停止して報告>" < /dev/null
```

`--last`は別ディレクトリのsessionを選ぶ危険があるため、保存済みIDがある場合はIDを使う。
CLI構文が変わった可能性があれば、実行前に`codex exec resume --help`で確認する。

## Current State に残す項目（最小Handoff）

`AGENTS.md` から 2026-08-20 に移設。Current State には次を残す。

- Status / Current owner / Handoff readiness
- 目的と完了条件
- branch / HEAD / clean-or-dirty / originとの差 / 変更中ファイル
- 完了済み / 未完了 / 検証済み / 未検証
- 次の一手 / オーナー判断待ち / 触ってはいけない範囲
- Codex session ID または明示されたlog path
- local commit / push / Railway反映 / 本番確認を別々に記載

30〜60行以内に収める。長くなったら、経緯は
`docs/archive/task-handoffs.md` の末尾へ追記して Current State からは外す。

## オーナーへの報告

`AGENTS.md` から 2026-08-20 に移設。

- オーナー向けには結果から、非エンジニアにも分かる日本語で書く。
- 「ローカルで確認済み」「commit済み」「push済み」「Railway反映済み」
  「本番確認済み」を混同しない。**どれをやっていないかを必ず明示する。**
- 外部共有には `node scripts/ai/chatgpt-handoff.mjs` の安全なPacketを使う。

Codex から Claude への機械的な報告項目は `docs/agents/codex-workflow.md`
「短い報告」が正本。こちらはオーナー向けの書き方を定める。

## 停止・復帰

Claude/Codex停止前:

1. Gitのclean/dirtyと変更ファイルを確認
2. 実施済み/未実施の検証を分ける
3. Current Stateへowner、残り、次の一手、禁止範囲、session/logを記録
4. 条件を満たさないなら push・deploy せず停止（条件は `AGENTS.md`）

復帰したAI:

1. Current StateとGitを照合
2. 鮮度警告または意図不明なdirty差分があれば編集せず報告
3. 前の編集者が停止済みと確認できた場合だけownerを引き継ぐ

## 元へ戻す

- Git管理ファイルは、このAI運用改善commitだけを`git revert <commit>`すれば戻せる。
- `git reset`や、push済み・未push を問わない既存commitの履歴書き換えは使わない。
  （commit数は `git status --short --branch` で測り直す。ここには書かない）
- ホーム設定の秘密値は復元しない。必要な認証は環境変数など安全な外部入力を使う。
