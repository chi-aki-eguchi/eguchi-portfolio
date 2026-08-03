# eguchi-portfolio-app — Shared AI Rules

Claude Code と Codex が共通で読む、現在の最小ルール。履歴や詳細手順は参照先へ置き、
このファイルには安全境界と引き継ぎ方法だけを残す。

## 作業開始時の正本

1. `task.md` 冒頭の `CURRENT_STATE_START` から `CURRENT_STATE_END` だけを読む。
2. `git status --short --branch` で Current State と実物を照合する。
3. タスクに必要な仕様書だけを読む。管理画面刷新の目的は
   `docs/specs/admin-renewal-goal.md` が正本。
4. Current State の鮮度は `node scripts/ai/check-handoff-freshness.mjs` で確認できる。

`task.md` は Current State だけを置くファイル。過去 Handoff と過去 Current State は
`docs/archive/task-handoffs.md` にあり、**通常は読まない**。特定の経緯を追うときだけ
検索する。`knowledge/wiki/` 全体も毎回読み直さない。
矛盾時は、コードと Git の実物 → Current State → 現行仕様書 → 履歴の順で優先する。

**現役文書へ、測り直せる行数・ファイル数を「現在の事実」として書かない。**すぐ古くなり、
読む側が誤った前提で判断する（2026-08-03 に2回発生）。必要なら測り直す。
例外は、日付や commit を添えた監査結果、履歴文書、規則として決めた上限値
（Current State の30〜60行など）。

**記録された不具合に着手する前に、実物を測り直す。** 記録の行番号・数値・症状を
そのまま信じない。**もう直っていたら、直さずに記録のほうを消す。**
過去に「存在しない不具合」を記録した実例が3件あり、いずれも着手すれば実在しない
問題を直す作業になっていた。測り方の落とし穴と実例は `docs/agents/measuring.md`。

**不具合を直したら、その場で `docs/agents/backlog.md` から項目を消す。**
記録を残したまま直すと、次に読む者が「まだある問題」として扱う。

## 現在の役割

- **設計 = Claude Code**: オーナーとの要件整理、目的・完成条件・安全境界の確定、
  Codex へ渡す実装依頼、実装後の独立検証、Current State 更新。
- **実装 = Codex**: 合意済みの範囲を実装し、必要なローカル検証、Current State 更新、
  指示された場合の commit まで行う。
- **Codex は実装だけでなく、読み取り専用の独立調査と反対レビューも担う。**
  いつ使うかは `docs/agents/codex-workflow.md` の発動条件に従う。
- モデル名や細かな実装方法は固定しない。目的・完成条件・変更可能範囲・禁止操作・
  検証責任・停止条件を明確にする。
- 実装依頼には、**今回の変更が触れうる承認済み挙動**を必ず含める（項目の一覧は
  `docs/agents/codex-workflow.md`「Codexへの依頼」）。
- オーナーがこのチャットで直接指定した役割・範囲が、そのタスクだけ優先される。

## 1タスクにつき編集者1人

- 同じ worktree を Claude と Codex が同時編集しない。もう一方は read-only reviewer とする。
- 編集を引き継ぐ前に、Current State の `Current owner` を更新し、前の編集者が停止したことを確認する。
- dirty tree（未コミット変更）があれば他者の途中成果として保護し、reset・rebase・checkout・
  上書き・破棄をしない。意図が不明なら編集を止めてオーナーへ報告する。
- `scratch/codex-out-*.log` は resume 用のセッションIDを含み得る。削除せず、本文を
  Handoff や外部資料へ転載しない。

## 絶対に越えない境界

- **push はオーナーだけ**。エージェントは明示依頼があっても `git push` しない。
- 本番DB、Turso、R2、Railway、デプロイ、環境変数、外部公開設定は、
  オーナーがその操作を直接依頼した場合だけ対象にする。
- `.env`、APIキー、パスワード、Cookie、トークン、認証値を表示・記録・commitしない。
- `eguchi-portfolio-app` と `ivys-house` のコードをコピー・import・混在させない。
- 履歴文書は勝手に削除しない。未追跡ファイルも内容を確認せず一括追加しない。

## 製品コードの不変条件

高リスク領域の詳しい確認手順は `docs/checklists.md` を使う。特に次を守る。

- DBクエリは `withRetry(() => db....)` で包む。
- settings の新規キーは次の4箇所を同期する:
  `settings-preview.ts` の台帳、API `/settings` の default、
  `provider.tsx` のDB適用 `useEffect`、同ファイルの `handlePreviewMessage`。
- 書き込みAPIの応答は、**本文を読む前に必ず検証する**。使い分けは実装に合わせる。
  - admin 配下の新規・変更箇所: `admin-shared.ts` の `assertOk` / `jsonOrThrow`。
    401 をログイン画面へのリダイレクトとして扱うため、ここを素の `res.ok` に
    置き換えるとセッション切れが無言で失敗する。`admin.tsx` は共通版を import せず
    独自定義を使う既存重複が残る、未解消の技術的負債である。統一済みとして扱わない。
  - それ以外: `lib/api.ts` の `assertOk` / `jsonOrThrow`。
  - **settings の保存は必ず `postAdminSettings()` を経由する。**
    API は許可リスト外のキーを無視して `ignoredKeys` で返すため、`assertOk` だけ見ると
    「保存成功」の表示のまま一部が保存されない。
- 新しい書き込み処理には、応答検証（`assertOk` / `jsonOrThrow`）に**加えて**、失敗が
  利用者の画面に見える経路（`onError` または try/catch でのエラー表示）を必ず付ける。
  応答検証は例外を投げるだけで、画面に出る保証がない。
- `Content-Encoding` を手動設定しない。HTMLは `Cache-Control: no-store`。
- DB schema変更は `schema.ts` と `schema.postgres.ts` を同期する。
- データ更新後は該当queryを再取得して、画面を古い状態のままにしない。

## 必須検証

- 製品コード変更: リポジトリルートで `bun run check`。
- admin変更: 上記に加えて `bun run smoke`。本番と同じDBにつながるため、
  smokeで保存・削除・追加などの書き込み操作を増やさない。
- AI運用・文書だけの変更: 対象script/test、JSON/Markdown構文、`git diff --check`、
  製品コードが差分にないことを確認する。製品コードの全テストは不要。
- 失敗した検証を隠さず、未実施と成功を分けて報告する。

## Current State の更新責任

- 編集者は、所有者・目的・Git状態・完了/未完了・検証・次の一手・禁止範囲が変わった時、
  `task.md` 冒頭の Current State を30〜60行以内で更新する。
- hook は Current State を自動編集しない。事実を確認した編集者が更新する。
- `HEAD: SELF` は「Current State を最後に更新したcommit」を意味する。
  鮮度チェックは `task.md` の最終更新commitと実際のHEADを比較する。
- 過去 Handoff は削除・書換えしない。必要な節目は
  `docs/archive/task-handoffs.md` の末尾へ追記する（`task.md` へ戻さない）。

## 最小Handoff

Current State に次を残す。

- Status / Current owner / Handoff readiness
- 目的と完了条件
- branch / HEAD / clean-or-dirty / originとの差 / 変更中ファイル
- 完了済み / 未完了 / 検証済み / 未検証
- 次の一手 / オーナー判断待ち / 触ってはいけない範囲
- Codex session ID または明示されたlog path
- local commit / push / Railway反映 / 本番確認を別々に記載

## 止まって報告する条件

- 目的・完成条件・変更可能ファイルのどれかが曖昧。
- Current State と Git、仕様書、実装が矛盾する。
- 別のAIが同じworktreeを編集中、またはdirty差分の意図が確認できない。
- 認証情報、本番データ、公開、課金、削除、schema変更が必要だが直接許可がない。
- 指定範囲を越えないと完了できない、または必須検証が安全に実行できない。

## 報告

- オーナー向けには結果から、非エンジニアにも分かる日本語で書く。
- 「ローカルで確認済み」「commit済み」「push済み」「Railway反映済み」
  「本番確認済み」を混同しない。
- 外部共有には `node scripts/ai/chatgpt-handoff.mjs` の安全なPacketを使う。

## 参照先

- 現在地: `task.md` 冒頭 Current State
- Claude/Codex連携: `docs/agents/codex-workflow.md`
- クレジット監視: `docs/agents/credit-status.md`
- 未完了の作業: `docs/agents/backlog.md`（完了したらこの文書から消す）
- 測り方と、存在しない不具合を作らないための手順: `docs/agents/measuring.md`
- 高リスク検査: `docs/checklists.md`
- 配布版DB差分: `DISTRIBUTION.md`
