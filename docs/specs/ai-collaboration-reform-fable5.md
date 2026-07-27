# AI Collaboration Reform / Fable5 Work Order

> **ARCHIVED / SUPERSEDED — 2026-07-27**
>
> この文書はAI連携改革の履歴資料であり、現在の指示ではない。ファイル名は過去参照を
> 壊さないため維持する。現行の正本は`AGENTS.md`、`CLAUDE.md`、`task.md`冒頭
> Current State、`docs/agents/codex-workflow.md`、`docs/agents/handoff-workflow.md`。

> **2026-07-25 追記**: 文中の「Fable5」は、現在の高性能モデルに読み替えてください。
> 2026-07 時点では **Claude Opus 5** がこれにあたります。ファイル名は `task.md` 等から
> 参照されているため変更していません。この仕様書の中身（高性能モデルは単発実装ではなく
> 仕組み・検査表・引き継ぎの改善に使う）は現在も有効です。

この仕様書は、Fable5 のような高性能モデルを一時的に使える時に、単発のコード修正で消費せず、Claude Code / Codex / future agents 全体の作業品質を上げるための作戦書です。

Fable5 に頼む仕事は「たくさん実装すること」ではなく、「今後の全員が迷わない地図、検査表、引き継ぎ型を作ること」を優先します。

## 用語

- Agent: Claude Code や Codex のように、ファイルを読んだり編集したりできる AI 作業者。
- Handoff: 次の作業者が続きから分かるように残す作業メモ。
- Source of truth: 判断に迷った時に正しいものとして扱う一次情報。
- Verification: 変更が壊れていないか確認する作業。例: 型チェック、ビルド、テスト、本番確認。
- Dirty tree: まだ commit されていない変更がある状態。
- Reviewer: 実装せず、見落としや危険だけを探す役。

## Fable5 に最初に渡すプロンプト

```text
/Users/chiaki/eguchi-portfolio-app を対象に、Claude Code / Codex / future agents 全体の作業品質を上げる改革をしてください。

あなたの役割:
- Systems architect: このリポジトリの運用全体を見て、迷い・重複・危険な手順を減らす。
- Adversarial reviewer: 失敗しそうな場所、思い込み、未検証の主張を厳しく探す。
- Teacher: プログラミングに詳しくないオーナーにも分かる言葉で説明する。

最重要ゴール:
1. Fable5 の使用期間が終わった後も、Claude Code と Codex に良い影響が残るようにする。
2. 今の未コミット作業や本番運用を壊さず、現在の作業品質を上げる。
3. 次のAIが迷わないように、AGENTS.md / CLAUDE.md / task.md / wiki / specs の役割を整理する。
4. settings、画像処理、DB、admin、本番デプロイなど、失敗時の影響が大きい領域の検査表を作る。

絶対に守る制約:
- まず git status --short と task.md 最新 Handoff を確認する。
- Dirty tree がある場合、既存の未コミット差分を勝手に書き換えない。
- .env、API key、admin password、token などの秘密情報を読まない・表示しない・保存しない。
- 削除、reset、force push、本番データ変更、本番DB変更は行わない。
- git push はオーナーが明示的に承認した時だけ行う。
- いきなり大規模リファクタをしない。まず現状診断と提案を出す。
- 説明は非エンジニア向けにする。専門用語を使う時は一文で意味を書く。

最初に読むファイル:
- AGENTS.md
- CLAUDE.md
- task.md の末尾
- docs/two-mac-workflow.md
- docs/specs/README.md
- docs/specs/admin-enhancement-spec.md
- docs/specs/design-spec.md
- docs/specs/refine-and-loop-spec.md
- knowledge/wiki/index.md
- knowledge/wiki/pages/repo-layout.md
- knowledge/wiki/pages/open-issues.md

Phase 1: 現状診断
- 今のAI運用ルールで重複していることを探す。
- Claude Code と Codex の役割が曖昧な場所を探す。
- Handoff が不足しそうな項目を探す。
- 現在の dirty tree が何を触っているか、ファイル名だけ把握する。
- 本番反映済み、push済み、localのみ、未検証を混同しそうな場所を探す。

Phase 2: 改革案
次の3案を比較して出す:
1. Minimal: 既存ドキュメントへ小さく追記する案。
2. Balanced: 共同作業ルール、検査表、Handoff型を整える案。
3. Deep: subagents / hooks / scheduled review まで含める案。

各案について、以下を必ず書く:
- 何が良くなるか
- 失敗した時のリスク
- 触るファイル
- オーナーが決める必要があること
- あなたのおすすめ

Phase 3: 実際の改善
オーナーが許可したら、まず Balanced 案を優先する。
改善対象は以下:
- AGENTS.md: 全AI向けの短い恒久ルール。
- CLAUDE.md: Claude Code が特に守る実務ルール。
- task.md: 今回の変更と検証を Handoff として追記。
- knowledge/wiki/pages/open-issues.md: 後回しにする課題や監視対象。

コード変更は原則しない。ただし、オーナーが「今の実装も直して」と明示した場合だけ、現在の dirty tree を理解してから最小範囲で行う。

Phase 4: 現在の未コミット作業の品質改善
Dirty tree がある場合は、実装者として触る前に reviewer として見る。
出すべきもの:
- P0: 今すぐ壊れる重大リスク。
- P1: 近いうちに直すべき問題。
- P2: 余裕があれば改善する問題。
- 足りない検証。
- 触ってはいけない既存差分。

Phase 5: 検証
ドキュメントだけなら:
- git diff --check

コードも触ったなら、影響範囲に応じて:
- cd packages/web && bun x tsc -b
- cd packages/web && bun run build
- cd packages/web && bun test ./src
- 必要なら Playwright または本番ヘッダー確認

最終報告形式:
1. 何を読んだか
2. 今の問題
3. 実施した改善
4. 触ったファイル
5. 検証結果
6. 残した課題
7. Claude Code と Codex が次からどう動けばいいか
```

## Fable5 に期待する成果物

Fable5 の出力は、次の4種類に分けます。

1. Current-state audit
   - 現在の dirty tree、最新 Handoff、未検証箇所、本番反映状況の混同リスクを整理する。

2. Agent operating model
   - Solo / Quick Peer / Split Work / Parallel Investigation の使い分けを明文化する。
   - 実装者は原則1人にし、もう片方は reviewer に回す。

3. Durable checklists
   - settings、DB schema、image pipeline、admin UI、Railway deploy、production verification の検査表を作る。

4. Owner-facing summary
   - 秋さんが判断できるように、専門用語を短く定義しながら、2から3択で意思決定を出す。

## 改革の優先順位

1. 本番・データ・秘密情報を守るルール。
2. Handoff の質を上げるルール。
3. Claude Code / Codex の役割分担。
4. 高リスク領域の検査表。
5. subagents / hooks / schedules などの自動化。

自動化は最後です。先に人間とAIが同じ地図を見られる状態にします。

## 役割分担の標準形

- Solo: 小さい修正、文言変更、単純なCSS、単純なテスト追加。
- Quick Peer: 方針が2択以上ある、または高リスク箇所に触る前の短い相談。
- Split Work: 一方が実装、もう一方が read-only review。ファイル所有者を明確にする。
- Parallel Investigation: 原因が分からない障害で、Claude Code と Codex が別々に調べ、最後は1人が編集する。

## Handoff に必ず残すこと

- 目的
- 触ったファイル
- 変更内容
- 検証したこと
- 検証していないこと
- push したか
- 本番で確認したか
- 次の担当者が触ってよい場所
- 次の担当者が触ってはいけない場所

## Stop rules

次の状態になったら、Fable5 は作業を止めてオーナーに確認します。

- Dirty tree に既存作業があり、同じファイルを触る必要がある。
- 本番DB、R2、Railway環境変数、secret に関係する。
- 削除、移動、rename、reset、force push が必要。
- 失敗原因が2回連続で分からない。
- テストが壊れていて、既存の失敗か今回の失敗か判断できない。

## Fable5 期間後に残すべきもの

- AGENTS.md: 全AIが守る短いルール。
- CLAUDE.md: Claude Code が読む実務ルール。
- task.md: 直近の作業ログ。
- knowledge/wiki/pages/open-issues.md: 今は直さないが覚えておく課題。
- docs/specs/: 大きめの方針や仕様。

Fable5 の価値は、最後に残るドキュメントと検査表で測ります。
