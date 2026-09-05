# 現役の仕様書 — 索引

原則は1仕様1ファイルで更新する。比較用の案や版が必要な場合は、違いが分かる名前で残してよい。

**この索引は「どれが何層目か」だけを書く。** 各文書の進捗は
`task.md` 冒頭 Current State と `docs/agents/backlog.md` が正本。

各仕様は製品の目的・挙動の判断材料。AIの役割・検証・pushの運用は [AGENTS.md](../../AGENTS.md) に従う。過去の依頼に限定した制約を、新しい依頼の恒久的な禁止にしない。

> **各文書の冒頭にある「状態: 未実装」「実装前の設計」等の断り書きは、
> 書かれた日の事実であって、今の事実ではない。** そのまま信じずに、
> 着手前にコードを測り直す（`docs/agents/measuring.md`）。

## 管理画面の刷新（階層。上から下へ具体になる）

| 層 | 文書 | 役割 |
|---|---|---|
| 1 目的 | `admin-renewal-goal.md` | **6軸の正本。**まずこれを読む |
| 2 全体計画 | `admin-redesign-plan.md` | 監査・情報設計・ワイヤー。案C採用（オーナー承認済み） |
| 3 レイアウト | `admin-layout-implementation.md` | 層2を実装可能な粒度へ落としたもの |
| 4 個別Phase | `admin-phase1-settings-preview.md` | Settings プレビューと視覚基盤 |
| 4 個別Phase | `admin-mobile-usability-plan.md` | スマホの実測と改善設計 |
| 現状の記録 | `admin-library-states.md` | Library の状態遷移。**提案ではなく記録** |

矛盾したら**番号の小さい層を優先**する。ただし並べ替えの保存経路だけは
`library-reorder-safety.md` が層1〜4より優先（層3の冒頭に明記されている）。

## Library と並べ替え

| 文書 | 役割 |
|---|---|
| `library-redesign-spec.md` | 再設計の決定内容（オーナー承認済み） |
| `library-reorder-safety.md` | **順序データ安全性の正本。**保存経路・競合拒否・ロールバック |
| `library-band-decisions.md` | 「束」機能。**オーナー判断が要る項目だけ**を並べたもの |
| `library-finder-investigation.md` | Finder化の調査と3案。実装前の資料 |

## 個別機能

| 文書 | 役割 |
|---|---|
| `photo-metadata-extraction.md` | 元画像を捨てる前に何を抜くか（何を） |
| `photo-metadata-extraction-plan.md` | 上の実装計画（どう） |
| `design-spec.md` | 公開サイトのデザイン仕様 |
| `design-freedom-plan.md` | デザイン自由度の拡大 |
| `spec-layout-expansion.md` | レイアウト拡張 |
| `i18n-en-spec.md` | 日英切り替え |
| `site-and-data-direction.md` | 公開サイトとデータモデルの方向（オーナー確定分） |
| `inbound-traffic-plan.md` | **検索・外部からの流入を増やす計画。**次に何をするかの正本 |

## 事業計画

- `growth-monetization-plan.md` — 収益化や販売導線を扱うときの資料。現在の依頼に関係する場合に読む。
- [portfolio-kit-sales-policy-draft.md](portfolio-kit-sales-policy-draft.md) — 販売者情報・総額価格・キャンセル・サポート・個人情報運用の相談案。

## 一時点の監査記録（普段は読まない）

必要になったときだけ引く。ここに書かれた数値は測り直す。

- [audit-2026-07.md](../archive/audits/audit-2026-07.md) — 敵対的総点検（2026-07-08）
- [reading-layer-audit-2026-08.md](../archive/audits/reading-layer-audit-2026-08.md) — 読む文書の棚卸し（2026-08-20）
- [rule-review-2026-08.md](../archive/audits/rule-review-2026-08.md) — 運用ルール再検討と Codex 連携案（2026-08-20）
- `seo-audit-2026-09.md` — 検索・外部流入の監査（2026-09-02）。流入強化フェーズ0の記録
