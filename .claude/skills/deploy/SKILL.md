---
name: deploy
description: このリポジトリのRailway公開と公開後の確認を進める。
disable-model-invocation: true
---
# Railwayへの公開

1. ルート `AGENTS.md`「検証とpush」で変更内容に合う検証と承認範囲を確認する。ここに短縮版の別手順を作らない。
2. Gitの現状と送信対象を確認し、依頼に関係する変更をcommitする。`main` へのpushは本番反映につながる。
3. 承認範囲内ならpushし、Railwayの反映と `/api/health` のbuild、対象画面を確認する。
4. ローカル検証・commit・push・本番確認を分けて報告する。

DB変更は `docs/checklists.md` のDB節、ロールバックは `docs/rollback-guide.md` を参照する。
Runable ZIPは `deploy:runable:legacy` に残る旧方式。通常のRailway公開では使わない。
