# Claude Code / Codex 実行ワークフロー

> Current. 2026-07-27更新。旧「期間限定の役割反転」「Sonnet/Fable時代」
> 「許可後はAIがpush可能」という記述は廃止した。

## 目的

設計と実装を分けつつ、同じworktreeの同時編集、古いHandoff、過剰な往復を防ぐ。
共通の安全境界は`AGENTS.md`、現在地は`task.md`冒頭Current Stateが正本。

## 基本フロー

1. Claudeがオーナーと目的・完成条件・変更範囲・禁止操作・検証・停止条件を確定する。
2. ClaudeがCurrent Stateを更新し、編集者をCodexへ引き継ぐ。
3. Codexが合意済み範囲だけを実装し、関連するローカル検証と自己確認を行う。
4. CodexがCurrent Stateへ変更、検証、未検証、次の一手、commit/push/production状態を残す。
5. Claudeが前の編集者の停止を確認後、read-onlyで重要差分と高リスク項目を独立検証する。
6. commitが依頼範囲ならCodexが1タスク1commitにまとめる。pushはオーナーだけが行う。

モデル名、関数名、全判断手順は固定しない。安全境界と完了の判定を固定する。

## Codexへの依頼

最低限、次を渡す。

- 目的と背景
- 完成条件
- 変更してよいファイルまたは範囲
- 禁止操作と`AGENTS.md`の該当不変条件
- 実行する検証
- 不明時・範囲超過時の停止条件
- Current State更新とcommit要否

ファイル本文や巨大diffを貼らず、Codex自身に必要部分を読ませる。
低リスク作業で不要な往復や同じゲートの二重実行を増やさない。

## 実行とresume

正確な現行コマンドは`docs/agents/handoff-workflow.md`が正本。

- 新規実行: `codex exec -s workspace-write ...`
- resume: 先にrepoへ`cd`し、`codex exec resume <session-id> ...`
- 現行CLIの`resume`には`-C`と`-s`が無い。旧
  `codex exec resume --last -C <project>`は使わない。
- `scratch/codex-out-*.log`先頭のsession IDを使う。ログ本文をHandoffへ転載しない。
- 接続切れと実装失敗を区別し、Gitに途中成果があれば新規sessionで重複実装しない。

## 検証の分担

- Codex: 実装に直接必要なローカル検証、失敗時の範囲内修正
- Claude: 実装後の独立レビュー、製品変更の最終`bun run check`、
  admin変更の`bun run smoke`
- AI運用だけの変更: 対象test、JSON/Markdown/script構文、差分範囲を確認

ネットワークや実機が必要で実行できない検証は、成功扱いにせず「未検証」と記録する。

## クレジット低下時

クレジット状態は`docs/agents/credit-status.md`に従う。closing以下では新しい工程を始めず、
Git状態、変更ファイル、検証、未完了、次の一手、禁止範囲、session/logを
Current Stateへ残す。hookは`task.md`を自動編集しない。

## 短い報告

1. 変更ファイル
2. 変更内容
3. 実行した検証と結果
4. 未解決・未検証
5. リスクまたはオーナー判断
6. commit hash
7. local / push / Railway / productionの各状態

全ログ、ファイル全文、巨大diff、認証情報は返さない。
