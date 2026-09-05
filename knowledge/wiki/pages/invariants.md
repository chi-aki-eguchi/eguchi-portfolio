---
title: Project invariants and instruction sources
status: current
last_verified: 2026-09-05
sources:
  - AGENTS.md
  - .claude/settings.json
  - .claude/rules/api-client.md
  - .claude/rules/api-validation.md
  - .claude/rules/db-migrations.md
  - .claude/rules/no-manual-encoding.md
  - .claude/rules/r2-upload.md
  - .claude/rules/react-components.md
  - docs/checklists.md
---

> ⚠️ This wiki is an index/summary layer, NOT the source of truth. If this
> page conflicts with the source documents listed under Sources, the sources
> win. See ../WIKI_SCHEMA.md.

# 製品を保つための指示の索引

このページは要約。[AGENTS.md](../../../AGENTS.md) が作業方針の正本であり、
ここには別の禁止・承認・検証条件を定義しない。

## Facts

2026-09-05に現行の指示ファイルと照合。実装上の要点は正本の「製品コードの不変条件」に集約されている。

| 変更する場所 | 読む箇所 |
|---|---|
| DBクエリ・スキーマ | AGENTS.mdのDB・migration、[checklists.md](../../../docs/checklists.md)のDB節 |
| settings・保存処理 | AGENTS.mdの4箇所同期・書き込み応答・再取得、checklists.mdのSettings・Admin節 |
| 画像・圧縮・削除 | AGENTS.mdの配信・原本保持、checklists.mdの画像・配信節 |
| Claudeの対象別補足 | `.claude/rules/` の該当ファイル |
| Claudeの実際の権限・フック | `.claude/settings.json`。運用文書と機械的な制御は区別する |

### 2026-09-05の整理

- 旧「13の不変条件」表は、削除済みフックや古い禁止を有効と記載していたため、この索引に置き換えた。旧版はGit履歴に残る。
- 圧縮は `api/http-compression.ts` で本文とヘッダーを管理する。旧 `protect-invariants.sh` は現在の設定に接続されていない。
- 一般的なコメント作法と重複したファイル配置規則の専用ファイルを除いた。プロジェクト固有の不変条件は保持している。
- `fetch` の一律禁止や、AIの固定役割・人間だけのpushを現行ルールとして扱わない。

## Assumptions

なし。

## Open Questions

この確認は指示と参照先の照合。製品の不変条件がすべて実行時に満たされることを検証した記録ではない。
過去の不具合候補は [open-issues.md](open-issues.md) から実物と照合する。

## Sources

- [AGENTS.md](../../../AGENTS.md)「進め方」「検証とpush」「製品コードの不変条件」
- [.claude/settings.json](../../../.claude/settings.json)、[.claude/rules/](../../../.claude/rules/)
- [docs/checklists.md](../../../docs/checklists.md)
