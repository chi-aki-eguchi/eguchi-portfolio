@AGENTS.md

# Claude Code 固有ルール

このファイルは共通ルールを重複させず、Claude Code が設計・検証・引き継ぎで担う事項だけを記す。

## 現在のゴール

管理画面 `/admin` の刷新。オーナーが確定した6軸は、
**デザイン / 使用感 / 完成度 / 高級感 / AI感の削減 / 可愛さ**。
定義と現在地の正本は `docs/specs/admin-renewal-goal.md`。
`docs/specs/growth-monetization-plan.md` は事業計画であり、現在の製品ゴールではない。

## Claude の責任

- オーナーの言葉から目的・完成条件・優先順位を整理する。
- 実装前に、変更してよい範囲、禁止操作、必要な検証、迷った時の停止条件を確定する。
- 実装方法やモデル名を必要以上に固定せず、設計判断だけを明確にする。
- Codex実装後は、報告だけでなく重要な差分とリスクを独立して確認する。
- 製品コード変更では `bun run check`、admin変更では `bun run smoke` の最終確認を担う。
- 作業の節目と終了前に `task.md` 冒頭 Current State を更新する。
- push は行わない。local / commit / push / Railway / production を分けて報告する。

## Codex へ渡す最小情報

1. 目的と背景
2. 完成条件
3. 変更してよいファイルまたは範囲
4. 禁止操作と製品不変条件
5. 実行する検証
6. 迷ったら止まる条件
7. Current State の更新責任とcommit要否

直接起動とresumeの現行手順は `docs/agents/codex-workflow.md` を使う。
過去memoryのコマンドや役割がこのファイル・`AGENTS.md` と違う場合は、過去memoryを採用しない。

## クレジット低下・終了時

- `saving`: 必須範囲へ絞り、小さく完了させる。
- `closing`: 新しい工程を始めず、現在の差分・検証・Current Stateを閉じる。
- `critical`: 未完了を隠さず、Git状態、変更ファイル、検証結果、次の一手、禁止範囲、
  Codex session/logだけをCurrent Stateへ残して停止する。
- hookは警告だけに使い、`task.md`を自動編集させない。

クレジット状態の意味と故障時の扱いは `docs/agents/credit-status.md` が正本。

## 独立検証の深さ

- 文言・文書・小さな見た目: 対象差分と関連検証だけ。
- settings、認証、DB、画像、admin、デプロイ: `docs/checklists.md` と関連テストを使う。
- 本番や実機でしか確認できないことは、ローカル成功と分けて「未確認」と書く。
- 同じゲートを理由なく重複実行しない。

## Compaction

圧縮時に残すもの:

- 現在の目的・完成条件・次の一手
- 変更ファイルとdirty差分
- 検証結果と正確な失敗内容
- 安全境界、Current owner、Codex session/log

古い探索、重複ログ、commit済みファイル全文は残さない。
