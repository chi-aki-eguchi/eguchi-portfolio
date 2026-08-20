# エージェントが読む文書の棚卸し（2026-08-20 監査）

> **これは日付とcommitを添えた監査結果である。**本文中の行数・ファイル数は
> `HEAD = fc97fbd`（2026-08-18 05:55 JST）時点の実測値であり、以後は測り直すこと。
> `AGENTS.md` の「測り直せる数値を現在の事実として書かない」規則の例外条項に沿う。
>
> 実施 = Claude Code（読み取りのみ）。**ファイルの移動・改名・削除・本文変更は
> 一件も行っていない。**この文書の新規作成だけが差分である。
> 判断はすべて実際に読んだ本文・コード・`git log` に基づく。推測は「推測」と明記した。

---

## 実行記録 — 2026-08-20

この監査の §6-C と §8 は**同日に実行済み**。以下は実行後の追記であり、
本文（§0〜§10）は監査時点の記録として書き換えていない。**本文が指す
`docs/agents/…` / `docs/specs/…` のパスのうち、C判定13件は現在
`docs/archive/` にある。**

- C判定13件を `git mv` で `docs/archive/` へ移し、各ファイル冒頭に
  「ARCHIVED / 後継 / 移した理由」の3行を付けた。
  `docs/specs/admin-enhancement-spec.md` は移動先に同名の v1 があったため
  `docs/archive/admin-enhancement-spec-v3.md` とした（archive 既存の
  `-v2` と同じ付け方に合わせた）。
- 移動前に、現役側の参照を先に振り替えた（`design-spec.md` /
  `admin-renewal-goal.md` / `library-redesign-spec.md` / `checklists.md` /
  `wiki/index.md` / `wiki/pages/admin-settings.md` / `wiki/pages/open-issues.md`）。
- Codex試用（§4-2）は判定を後追いで作らず「運用終了」とし、
  `codex-workflow.md` の発動条件は恒久化と書き換えた。
- `AGENTS.md` に「読まない場所」節を追加した。
- §4 で挙げた食い違いはすべて解消した（§4-1 は §7-5 のとおり実測で確定）。
- **§7-1（hono / sharp ほかの更新）は実行していない。**影響調査のみ。

### §7-5. 写真メタデータ7列の本番確認結果（2026-08-20 実測）

`node scripts/ai/check-prod-photo-columns.mjs`（読み取り専用・
`PRAGMA table_info(photos)` の1本のみ）を本番 Turso に対して実行した。

- `photos` の列数: **36**（移行前の29列 + 7列）
- `shot_at_source` / `shot_at_digitized` / `source_width` / `source_height` /
  `source_format` / `camera_make` / `camera_model` — **7列すべて存在**
- `docs/archive/wake-up-checklist.md` の予行演習「列は29→36」と一致

**移行は適用済み。**§4-1 で「推論であり断定しない」としていた点は、これで確定した。
本番DBへの変更は行っていない。

---

## 0. 前提の訂正 — 「半年以上動いていない」ファイルは存在しない

依頼では「半年以上動いておらず、かつどこからも参照されていないもの」を別枠に、
とあった。**この基準に当てはまるファイルは0件である。理由は文書が古いからではなく、
リポジトリ自体が半年経っていないからだ。**

- 最初のcommit: `3dd80be` 2026-06-16
- 最新のcommit: `fc97fbd` 2026-08-18
- リポジトリの全期間: **65日**（commit 762本）

したがって「半年」を機械的に当てると全件が「新しい」となり、選別として意味を持たない。
そこで本監査は次の代替基準を使う。**基準を差し替えたこと自体を明示するのが目的で、
判定の断定を避けるという依頼の趣旨は維持する。**

> **休眠の代替基準**：
> (1) 2026-07-02 の一括移設commit以降、**一度も編集されていない**（commit数=1）、かつ
> (2) 現役の文書（`docs/archive/` 以外）から**参照が0件**。
>
> この2つを満たしたものだけを §5「使われていない可能性が高い」へ入れる。
> **満たしても「不変ルールだから更新されていないだけ」の可能性が残るため、
> 1件ずつ、そう判断した理由と反証をこの文書に併記した。**

---

## 1. 起動時に本当に読まれるもの（実測）

`.claude/settings.json` と `.claude/rules/*.md` のフロントマターを読んで確定した。

| 対象 | いつ読まれるか | 行数 |
|---|---|---:|
| `CLAUDE.md` | メインセッション開始時。**常時** | 64 |
| `AGENTS.md` | `CLAUDE.md:1` の `@AGENTS.md` で取り込まれる。**常時** | 142 |
| `.claude/rules/file-hygiene.md` | `paths:` が無いため**常時** | 18 |
| `task.md` 冒頭 Current State | `AGENTS.md` の手順1が「読め」と命じる。**実質常時** | 55 |
| `.claude/rules/` の他5件 | `paths:` に一致するファイルを触った時だけ | 16+11+16+10+13+22 |
| SessionStart hook 2本 | `credit-status.mjs` / `check-handoff-freshness.mjs`。**文書は読ませない** | — |

**現在のA相当（常時コンテキストに入る文書）の合計 = 279行。**

補足: `.claude/agents/*.md`（3件）は起動時に `CLAUDE.md` と `AGENTS.md` を受け取る。
`.claude/skills/*/SKILL.md` は呼び出し時のみ。この2点は `docs/agents/doc-cleanup-survey.md`
の 2026-08-03 実測と一致しており、今回も再現した。

---

## 2. 全ファイル一覧（行数 / 最終commit / 参照元の種別 / 仕分け）

参照元の種別は次の意味。**ROOT** = 常時読まれる4文書のどれかから参照。
**LIVE** = `docs/archive/` 以外の現役文書から参照。**CODE** = 製品コード・テスト・
スクリプトから参照。**ARCH** = `docs/archive/` 配下からのみ参照。

### 2-1. ルート直下

| ファイル | 行 | 最終commit | 参照元 | 仕分け |
|---|---:|---|---|---|
| `AGENTS.md` | 142 | 2026-08-04 | ROOT(CLAUDE.md) + LIVE 6 | **A** |
| `CLAUDE.md` | 64 | 2026-08-03 | 起動時に自動 | **A** |
| `task.md` | 65 | 2026-08-18 | ROOT 2 + CODE 3 | **A**（Current Stateのみ） |
| `README.md` | 191 | 2026-07-06 | LIVE 6（wiki中心） | **B** |
| `DISTRIBUTION.md` | 396 | 2026-07-18 | ROOT(AGENTS.md) + LIVE 4 | **B** |

### 2-2. `docs/agents/`

| ファイル | 行 | 最終commit | 参照元 | 仕分け |
|---|---:|---|---|---|
| `codex-workflow.md` | 175 | 2026-08-03 | ROOT 2 + LIVE 4 | **B**（現役の正本） |
| `credit-status.md` | 115 | 2026-08-03 | ROOT 2 + LIVE 3 | **B**（現役の正本） |
| `measuring.md` | 195 | 2026-08-11 | ROOT(AGENTS.md) + LIVE 3 | **B**（現役の正本） |
| `backlog.md` | 273 | 2026-08-18 | ROOT(AGENTS.md) + LIVE 5 | **B**（現役の正本） |
| `handoff-workflow.md` | 98 | 2026-08-03 | LIVE 3（ROOTからは無い） | **B** |
| `codex-flow-trial.md` | 58 | 2026-07-29 | LIVE 1 | **C**（§4-2 参照） |
| `backlog-verification.md` | 40 | 2026-08-04 | **0件** | **C**（archiveへ） |
| `codex-debug-2026-08-05.md` | 129 | 2026-08-06 | **0件** | **C**（archiveへ） |
| `credit-status-review.md` | 187 | 2026-08-03 | LIVE 1 | **C**（archiveへ） |
| `doc-cleanup-survey.md` | 169 | 2026-08-03 | LIVE 1 | **C**（archiveへ） |
| `pre-push-review.md` | 343 | 2026-08-04 | **0件** | **C**（archiveへ） |
| `tooling-fix-review.md` | 186 | 2026-08-04 | **0件** | **C**（archiveへ） |
| `pending-owner-decisions.md` | 116 | 2026-08-04 | LIVE 2 + ARCH 3 | **C**（本文が自称ARCHIVED） |
| `codex-agents/*.toml` | 2件 | — | `codex-workflow.md` | **B**（レーン定義の正本） |

### 2-3. `docs/specs/`

| ファイル | 行 | 最終commit | 参照元 | 仕分け |
|---|---:|---|---|---|
| `admin-renewal-goal.md` | 412 | 2026-08-18 | ROOT 3 + LIVE 7 + CODE 2 | **B（最上位）** |
| `site-and-data-direction.md` | 247 | 2026-08-17 | ROOT(task.md) | **B** |
| `design-freedom-plan.md` | 256 | 2026-08-07 | LIVE 1 | **B** |
| `design-spec.md` | 172 | 2026-08-07 | LIVE 6 | **B** |
| `admin-mobile-usability-plan.md` | 684 | 2026-08-06 | ARCH 1 のみ | **B**（新しいので保持） |
| `library-redesign-spec.md` | 173 | 2026-08-04 | LIVE 3 + CODE 1 | **B** |
| `admin-layout-implementation.md` | 619 | 2026-07-31 | LIVE 3 | **B** |
| `admin-phase1-settings-preview.md` | 548 | 2026-07-31 | LIVE 1 + CODE 2 | **B** |
| `admin-redesign-plan.md` | 1193 | 2026-07-31 | LIVE 3 | **B** |
| `library-reorder-safety.md` | 259 | 2026-07-29 | LIVE 1 | **B** |
| `library-finder-investigation.md` | 542 | 2026-07-28 | LIVE 2 | **B** |
| `photo-metadata-extraction.md` | 327 | 2026-07-28 | LIVE 2 | **B** |
| `admin-library-states.md` | 186 | 2026-07-27 | LIVE 2 | **B** |
| `library-band-decisions.md` | 229 | 2026-07-27 | LIVE 4 | **B** |
| `growth-monetization-plan.md` | 244 | 2026-07-25 | ROOT(CLAUDE.md) + LIVE 3 | **B**（「ゴールではない」の明示先） |
| `spec-layout-expansion.md` | 229 | 2026-07-09 | LIVE 1 | **B** |
| `audit-2026-07.md` | 122 | 2026-07-08 | LIVE 2 + CODE 3 | **B**（日付付き監査） |
| `i18n-en-spec.md` | 108 | 2026-07-16 | LIVE 1 | **B** |
| `photo-metadata-extraction-plan.md` | 559 | 2026-08-03 | LIVE 2 | **B**（ただし §4-1 の要修正） |
| `README.md` | 4 | 2026-07-02 | LIVE 6 | **B**（ディレクトリ説明） |
| `refine-and-loop-spec.md` | 156 | 2026-08-03 | LIVE 5 | **C**（§4-3 参照） |
| `ai-collaboration-reform-fable5.md` | 188 | 2026-08-03 | LIVE 4 | **C**（本文が自称ARCHIVED） |
| `admin-enhancement-spec.md` | 498 | 2026-07-02 | LIVE 8 | **C**（§4-4 参照） |

### 2-4. `docs/archive/`（33件）

すべて **C** = もう読ませない。ただし2件だけ性質が違うので分けて記す。

- `task-handoffs.md`（10020行・最終 2026-08-11）— **ROOT 2（AGENTS.md / task.md）から
  名指しで参照されている**。両方とも「通常は読まない。特定の経緯を追うときだけ検索」
  と書いており、参照の仕方としては正しい。**ただし §7-2 の秘密情報が入っている。**
- `deploy.sh`（153行）— `package.json` の `deploy:runable:legacy` から実行される。
  **文書ではなく生きたスクリプトなので、archiveにあるが消してはいけない。**

残る31件は現役文書からの参照が0〜数件で、いずれも履歴参照。`agent-logs/` 12件
（2026-07-07〜07-21、計3113行）は `task-handoffs.md` からのみ辿れる。

### 2-5. `knowledge/wiki/`（14件・計 1586行）

| ファイル | 行 | last_verified | status | 仕分け |
|---|---:|---|---|---|
| `index.md` | 70 | 2026-07-05 | current | **B**（要再検証） |
| `log.md` | 155 | 2026-08-03 | — | **B** |
| `pages/open-issues.md` | 302 | 2026-07-06 | current | **B**（要再検証） |
| `pages/image-pipeline.md` | 166 | 2026-07-03 | current | **C相当**（§4-5。誤りが実在） |
| `pages/database.md` | 151 | 2026-07-02 | current | **B** |
| `pages/distribution.md` | 140 | 2026-07-02 | needs-review | **B** |
| `pages/deployment.md` | 118 | 2026-07-02 | current | **B** |
| `pages/project-overview.md` | 112 | 2026-07-02 | current | **B** |
| `pages/admin-settings.md` | 110 | 2026-07-02 | current | **B** |
| `pages/service-page.md` | 103 | 2026-07-02 | current | **B** |
| `pages/invariants.md` | 101 | 2026-07-02 | current | **B** |
| `pages/ai-collaboration.md` | 66 | 2026-07-05 | current | **C**（§4-6） |
| `pages/repo-layout.md` | 55 | 2026-08-03 | current | **B** |
| `pages/night-run.md` | 37 | 2026-07-02 | stale | **C**（自称 retired） |

**wiki全体の共通問題**: `last_verified` が全件 2026-07-02〜08-03。つまり wiki は
**2026-07-25 のゴール確定、2026-07-31 の admin 刷新（`de1feab`）、2026-08 のスマホ改善を
一度も反映していない。**「status: current」の表示が実態と合っていないページがある。

---

## 3. 参照されていない現役文書（実測）

現役の文書・コードのどこからも名前を出されていないもの。

| ファイル | 参照0の理由（読んだうえでの判定） |
|---|---|
| `docs/agents/pre-push-review.md` (343) | 2026-08-03の1回限りのレビュー記録。P0は解消済みと本文が言い、P1以降は未着手。**内容は生きているが、誰も辿れない場所にある** |
| `docs/agents/tooling-fix-review.md` (186) | 同上。採否表は結論済み |
| `docs/agents/backlog-verification.md` (40) | `backlog.md` へ反映済みと本文が明言。役目を終えている |
| `docs/agents/codex-debug-2026-08-05.md` (129) | 指摘の実装は2026-08-06に完了（`thumbnail-upload-integrity-wiring.test.ts` の強化を実測で確認）。記録だけ残った |
| `docs/archive/` の16件 | 2026-07-02 の移設commit以降、一度も編集されていない（§5） |

**「参照0＝不要」ではない。**上の4件はいずれも中身が正しく、`AGENTS.md` が
「反論を要約に置き換えない」と定めた成果物である。**消すのではなく、
辿れる場所へ移すのが正しい扱い**だと判断した（§8 の提案）。

---

## 4. 現状と食い違っている記述（すべて実測で確認）

### 4-1. `photo-metadata-extraction-plan.md` の冒頭警告は、もう成り立っていない ⚠️最重要

冒頭に見出しレベルの警告がある。

> ⚠️ 起きたら最初に読んでください
> **単位3〜7を実装した結果、いまのコードは本番DBに7列が無いと動きません。**
> `bun run smoke` も、ローカルの `bun run dev` も、写真の取得で500になります。

**実測した反証:**

- `task.md` の Current State（2026-08-18）に `bun run smoke` を6回実施、
  すべて **330〜331 passed / 0 failed** と記録がある。
- smoke は admin Library を含む写真取得を通る。7列が本番DBに無ければ、
  この警告どおり500になり0 failedにはならない。
- `schema.ts:60` / `schema.postgres.ts:50` に `shot_at_source` があり、双方同期済み。

**結論**: 2026-07-28 の移行（`ADD COLUMN` 7本）は**適用済みとみるのが自然**。
ただし**適用を記録したcommitは存在しない**ため、断定はしない。
オーナーに「7列の `db:push` は当てたか」を1回確認すれば確定する。

さらに、この文書は**自分自身と矛盾している**。警告の直後（36行目）に
「**実装前の設計。この文書の時点で製品コードは1行も変えていない。**」とある。
警告は「実装した結果」と言っており、同じファイルの中で食い違う。

### 4-2. Codex運用の試用期間が、判定されないまま終了している

`codex-flow-trial.md` は試用期間を
「**中・高リスクの5タスク、または 2026-08-11 のどちらか早い方まで**（開始 2026-07-28）」
と定めている。表には**7タスク**が記録済みで、5タスク条件は満たされている。
期日 2026-08-11 も**9日過ぎている**。しかし本文の「判定」節（恒久化するか見直すか）は
**空のまま**であり、`codex-workflow.md:「この発動条件は 2026-07-28 から試用中」** の
一行も更新されていない。

現役の正本（`codex-workflow.md`）が「試用中」と書いたまま試用が終わっている状態。

### 4-3. `refine-and-loop-spec.md` は、廃止された運用を「正本」と名乗り続けている

T0節にこうある。

> 秋さん確定方針（**この節が正本**。CLAUDE.md「自走改善ループ運用方針」/
> memory `autonomous-improvement-loop` と同期）

**実測**: 現在の `CLAUDE.md`（64行）と `AGENTS.md`（142行）に、
**「自走」「ループ」という語は1件も存在しない。**同期先が消えている。

加えて内容が現在の運用と正面から衝突する。

- 「1時間ごとのループを開始（可能なら /schedule、無理なら /loop 60m）」
- 「**枠が切れてもループを止めず、枠が復活し次第また実行を再開してほしい**」
- 受け入れ基準に「1時間ごとのループが動き…」

夜間自走ランは 2026-07-02 に廃止済み（`knowledge/wiki/pages/night-run.md`）。
`night-run.md` 自身が「`refine-and-loop-spec.md` に広めの自走ループ記述が残っている。
今回の廃止対象より広いので手を付けなかった」と**書き残している**。
つまり**1か月半前に判明していて、着手されていない残件**である。

### 4-4. `admin-enhancement-spec.md` が3世代同居している

| 場所 | 行 | タイトル |
|---|---:|---|
| `docs/specs/admin-enhancement-spec.md` | 498 | 「管理画面 強化仕様書 **v3 Draft**」 |
| `docs/archive/admin-enhancement-spec-v2.md` | 295 | v2 |
| `docs/archive/admin-enhancement-spec.md` | 275 | v1 |

現役側は 2026-07-02 のcommit1本きりで、本文にこうある。

> **まだ確定版ではない。**実装前に Claude Code が P0/P1 リスクと実装順をレビューする。

そのレビューが行われた記録は無い。にもかかわらず、この「未確定ドラフト」は
`design-spec.md`・`admin-renewal-goal.md`・`library-redesign-spec.md`・
`refine-and-loop-spec.md` など**現役8文書から参照されている**。

また `.claude/rules/file-hygiene.md` は「`-v2`, `-v3` を含む仕様書ファイル名は禁止」と
定めているが、**ファイル名ではなく本文の見出しに `v3 Draft` が入っている**ため
規則をすり抜けている。archive側の `-v2` は移設前に作られたもの。

### 4-5. wiki が「実在しない不具合」を現在形で書いている ⚠️

`knowledge/wiki/pages/image-pipeline.md:109-112`（status: current）:

> **Orphan risk on purge**: purge/trash-retention は写真の `url`（元画像）しか
> 削除せず、**`thumbKey`/`mediumKey` の WebP は最終削除でも決して消さない**。

**実測した反証**（`packages/web/src/api/photo-integrity.ts:19-28`）:

```
export function unsharedPhotoStorageKeys(photo, hasSharer): string[] {
  if (hasSharer) return [];
  return [photo.url.replace("/api/images/", ""), photo.thumbKey, photo.mediumKey]
    .filter(...);
}
```

`index.ts:521` がこれを呼び、`purgeDbThenStorage` → `deleteStorageKeys` が
3キーすべてに `DeleteObjectCommand` を発行する。**thumb/medium は消えている。**
修正は `d0d2412`（2026-07-21）。wiki の `last_verified` は **2026-07-03** で、
**修正より前**。以後一度も再検証されていない。

同ページの Open Questions は「`thumbKey`/`mediumKey` に `DeleteObjectCommand` を
呼ぶコードは見つからなかった」と書いており、これも現在は誤り。
さらに同ページは `task.md:2677` を引用しているが、`task.md` は現在65行しかなく、
**引用先が存在しない**。

これは `docs/agents/measuring.md` が「存在しない不具合」として3件記録した事故と
**同じ型**である。着手すれば、直っているものを直す作業になる。

### 4-6. 「Fable5」時代の呼称が現役文書に残っている

- `knowledge/wiki/index.md` は AI協業ページを
  「**AI Collaboration & Fable5 Reform** — … where to start Fable5 reform work」と案内。
- `docs/specs/ai-collaboration-reform-fable5.md` は冒頭で
  「**ARCHIVED / SUPERSEDED — 2026-07-27**」と自称しながら `docs/specs/`（現役）に居る。
- 一方 `docs/agents/codex-workflow.md` の冒頭は
  「旧『Sonnet/Fable時代』という記述は**廃止した**」と宣言している。

現役の正本が「廃止した」と言っているものを、wiki の入口が案内している状態。

### 4-7. `codex exec` の書き方が2文書で食い違う（無言ハングの原因）

| 文書 | 記述 |
|---|---|
| `handoff-workflow.md:56` | `codex exec -s workspace-write -c approval_policy='"never"' "..." **< /dev/null**` |
| `codex-workflow.md:「レーンの選び方」` | `codex exec -s workspace-write -m gpt-5.6-luna -c ... "..."`（**`< /dev/null` なし**） |

`codex-workflow.md` 自身が「正確な現行コマンドは `handoff-workflow.md` が正本」と
書いているので優先順位は決まっているが、**読む側は先に目に入った方を貼る。**
`< /dev/null` を落とすと `codex exec` は stdin 待ちで無言ハングする（既知）。
**正本でない方に、動かないコマンド例が載っているのが問題。**

### 4-8. 測り直せる数値が現役文書に残っている（規則違反）

`AGENTS.md` と `file-hygiene.md` が禁じている「現在の事実としての可変数値」。

- `docs/agents/handoff-workflow.md:「元へ戻す」` — 「`git reset` や**既存39 commits**の
  履歴変更は使わない」。実測では origin との差は **37 commits**。
- `task.md:「過去記録」` — 「過去 Handoff（**133本**）」。
  実測すると `docs/archive/task-handoffs.md` の `## Handoff` 見出しはちょうど133件で
  **これは正しい**。ただし追記するたびに古くなる形なので、同じ罠の予備軍。

### 4-9. 解決済みなのに backlog に残っている項目

`AGENTS.md` は「不具合を直したら、その場で `docs/agents/backlog.md` から項目を消す」と
定めている。**B-4 の1項目目が守られていない。**

> ### B-4. 孤児 R2 オブジェクトほか P2×4 🟡 確認済み
> - **thumb/medium の片方だけ失敗したときの孤児 R2 オブジェクト** ← 実測では対処済み

`packages/web/src/api/thumbnail-upload-integrity.ts` の `uploadAllOrCleanup` が
両派生をまとめて扱い、失敗時に `deleteStorageKeys` で後始末する。
配線テスト（`thumbnail-upload-integrity-wiring.test.ts`）は 2026-08-06 に
「no-op を渡すと落ちる」形へ強化済み。**B-4 の残りは「purge時のR2削除エラー無視」
以下4項目**であり、1項目目は消してよい。

### 4-10. wiki の Open Issue #16 が古い

`knowledge/wiki/pages/open-issues.md:92` は
「`.claude/settings.local.json` に、存在しないパス `pages/admin.tsx` を対象にした
grep許可が残っており、永久に一致しない」と書く。
**実測**: 現在の `.claude/settings.local.json` は `additionalDirectories` 3件と
agmsg の SessionStart/SessionEnd hook だけで、**該当エントリは無い。**

### 4-11. 重複しているが、いま問題にならないもの（記録のみ）

- `codex-workflow.md` と `handoff-workflow.md` は「Codexの呼び方 / resume」で重なるが、
  前者が後者を正本と明示しているので、§4-7 のコマンド例を直せば解消する。
- `credit-status.md`（規則）と `credit-status-review.md`（そのレビュー記録）は
  別物なので重複ではない。
- `AGENTS.md` の不変条件24行と `.claude/rules/*.md`（パス限定6件）は**意図的な二重化**。
  ルールはファイルを触った時しか出ないため、常時側にも要点が要る。**これは残す。**

---

## 5. 使われていない可能性が高いもの（別枠）

§0 の代替基準（**2026-07-02以降 編集0回** かつ **現役文書からの参照0件**）を
両方満たしたのは次の**9件・計1553行**（表の最終行だけ2ファイルをまとめてある）。

| ファイル | 行 | そう判断した理由 | 反証（＝断定しない理由） |
|---|---:|---|---|
| `docs/archive/spec-improvement-3.md` | 330 | 移設以来編集0。参照0 | 名前に世代番号があり、後継の所在が本文から辿れない。**後継を確認するまで削除不可** |
| `docs/archive/design-expansion-spec.md` | 130 | 同上 | `design-spec.md` が後継に見えるが、明示の継承宣言が無い |
| `docs/archive/ux-refinements-spec.md` | 166 | 同上 | 同上 |
| `docs/archive/layout-patterns.svg` | 53 | 同上。画像なので参照が無ければ表示されない | `spec-layout-expansion.md` の図版だった可能性。**推測なので断定しない** |
| `docs/archive/library-finder-prototype.md` | 261 | 2026-08-03にarchive済。参照0 | `library-finder-investigation.md`（現役542行）が後継。役目は終えている |
| `docs/archive/recently-added-pinned-section.md` | 277 | 同上 | `scripts/smoke/admin-recently-added-pinned.spec.ts` が**機能としては生きている**。仕様の説明が要る日が来るかもしれない |
| `docs/archive/wake-up-checklist.md` | 129 | 同上 | **§4-1 の7列移行の唯一の詳細記録**（本番29列→36列の事前照合結果）。**内容は今も価値がある。移す先が archive で正しかったか要検討** |
| `docs/archive/agent-logs/2026-07-16.md` / `2026-07-17.md` | 117+90 | 参照0（他の10本は `task-handoffs.md` から辿れる） | 日付ログなので参照されないのが自然。**「不変だから更新されない」型の典型で、休眠とは言い切れない** |

**「不変ルールだから更新されないだけ」に該当し、休眠と判定しなかったもの:**

- `docs/specs/README.md`（4行）・`docs/archive/README.md`（4行）— ディレクトリの説明。
  内容が変わる理由が無い。**参照はあるが、そもそも短く、常時読ませる必要も無い。**
- `knowledge/wiki/pages/invariants.md`（101行）・`pages/service-page.md`（103行）—
  移設以来編集0だが、wiki内部から参照されている。§0の条件(2)を満たさない。
- `.claude/rules/*.md`（パス限定6件）— 不変条件そのもの。更新が無いのが正常。

---

## 6. 仕分け案

### A. 常時読む（起動時に必須の不変ルールだけ）

| ファイル | 現在 | 提案 | 差 |
|---|---:|---:|---:|
| `CLAUDE.md` | 64 | **53** | −11 |
| `AGENTS.md` | 142 | **109** | −33 |
| `.claude/rules/file-hygiene.md` | 18 | **18** | 0 |
| `task.md` Current State | 55 | **55**（規則の上限60は維持） | 0 |
| **合計** | **279** | **235** | **−44** |

内訳（`AGENTS.md`）: 最小Handoff −12 / 報告 −7 / 参照先 9→2 で −7 /
現在の役割 14→3 で −11 / §8-1 の「読まない場所」を +4 = **142 → 109**。
内訳（`CLAUDE.md`）: 「Codex へ渡す最小情報」14→3 で −11 = **64 → 53**。

**Aから外す候補（＝Bへ移す）と、その理由:**

| 移す内容 | 現在地 | 行 | 移す先 | 理由 |
|---|---|---:|---|---|
| 「最小Handoff」の項目列挙 | `AGENTS.md` L107-118 | 12 | `docs/agents/handoff-workflow.md` | 引き継ぎを**書く時だけ**要る。読む時は要らない |
| 「報告」の書式 | `AGENTS.md` L127-133 | 7 | `docs/agents/handoff-workflow.md` | 同上。しかも `codex-workflow.md`「短い報告」と重複 |
| 「参照先」リンク集 | `AGENTS.md` L134-142 | 9 | `docs/specs/README.md` へ移し、AGENTS には1行だけ残す | 目次は必要になってから引けばよい |
| 「現在の役割」の詳細 | `AGENTS.md` L32-45 | 14 | `docs/agents/codex-workflow.md`（既に同内容あり） | **完全な重複。**AGENTS には「設計=Claude / 実装=Codex、詳細は codex-workflow」の2行で足りる |
| 「Codex へ渡す最小情報」 | `CLAUDE.md` L24-37 | 14 | `docs/agents/codex-workflow.md`（既に正本と明記） | CLAUDE.md 自身が「ここには転記しない」と書きながら、7行転記している |
| 「Compaction」 | `CLAUDE.md` L55-64 | 10 | そのまま残す | 圧縮時に読める保証が無いので、常時側に要る |

**Aに必ず残すもの（削らない）:**

- `AGENTS.md`「作業開始時の正本」26行 — これが無いと入口が分からない
- `AGENTS.md`「絶対に越えない境界」9行 — push禁止・本番DB・秘密情報
- `AGENTS.md`「製品コードの不変条件」24行 — `withRetry` / settings4箇所 / `assertOk` /
  `Content-Encoding` / schema2系統。**壊れ方が静かなので、常時側に要る**
- `AGENTS.md`「必須検証」9行・「止まって報告する条件」8行
- `AGENTS.md`「1タスクにつき編集者1人」9行 — dirty tree保護
- `CLAUDE.md`「現在のゴール」7行 — 過去にゴールを取り違えた実例がある
- `CLAUDE.md`「クレジット低下・終了時」10行・「独立検証の深さ」7行

### B. 必要な時だけ取りに行く

**運用の正本（4件・758行）**
`docs/agents/codex-workflow.md`（175）/ `credit-status.md`（115）/
`measuring.md`（195）/ `backlog.md`（273）
＋ `handoff-workflow.md`（98）＋ `codex-agents/*.toml`（2件）

**現在の仕事の仕様（admin刷新の系列・8件）**
`admin-renewal-goal.md`（最上位）/ `admin-redesign-plan.md` / `admin-layout-implementation.md` /
`admin-phase1-settings-preview.md` / `admin-mobile-usability-plan.md` /
`design-spec.md` / `design-freedom-plan.md` / `site-and-data-direction.md`

**Library・写真の系列（6件）**
`library-redesign-spec.md` / `library-band-decisions.md` / `library-reorder-safety.md` /
`library-finder-investigation.md` / `admin-library-states.md` / `photo-metadata-extraction.md`

**事業・配布・履歴のある判断（5件）**
`DISTRIBUTION.md` / `README.md` / `growth-monetization-plan.md` / `i18n-en-spec.md` /
`audit-2026-07.md`（日付付き監査なので数値も有効）

**過去の経緯（検索して使う。通読しない）**
`docs/archive/task-handoffs.md` / `docs/checklists.md` / `knowledge/wiki/`（要再検証）

### C. もう読ませない（`docs/archive/` へ移す）

| 対象 | 行 | 根拠 |
|---|---:|---|
| `docs/agents/pre-push-review.md` | 343 | 1回限りのレビュー記録。P0解消済み。参照0 |
| `docs/agents/credit-status-review.md` | 187 | 同上。規則は `credit-status.md` に反映済み |
| `docs/agents/tooling-fix-review.md` | 186 | 同上。採否は結論済み |
| `docs/agents/doc-cleanup-survey.md` | 169 | 2026-08-03の調査。**§1の実測表だけ本監査で再現・確認済み** |
| `docs/agents/codex-debug-2026-08-05.md` | 129 | 指摘は2026-08-06に実装済み（実測確認） |
| `docs/agents/pending-owner-decisions.md` | 116 | **本文が「ARCHIVED / SUPERSEDED — 2026-07-27」と自称** |
| `docs/agents/backlog-verification.md` | 40 | 本文が「`backlog.md` へ反映済み」と明言 |
| `docs/agents/codex-flow-trial.md` | 58 | 試用期間終了（§4-2）。**ただし判定を書いてから移す** |
| `docs/specs/ai-collaboration-reform-fable5.md` | 188 | **本文が「ARCHIVED / SUPERSEDED」と自称** |
| `docs/specs/refine-and-loop-spec.md` | 156 | 廃止済み運用（§4-3）。**参照5件を先に切る必要あり** |
| `docs/specs/admin-enhancement-spec.md` | 498 | 未確定v3ドラフト（§4-4）。**現役8件が参照。移す前に §7 の判断が要る** |
| `knowledge/wiki/pages/night-run.md` | 37 | 自称 retired |
| `knowledge/wiki/pages/ai-collaboration.md` | 66 | Fable5時代の記述（§4-6） |
| `docs/archive/` 既存33件 | — | すでにCの位置。移動不要 |
| **C合計（新規に移す13件）** | **2173** | |

**Cにしなかったが要注意:**
`knowledge/wiki/pages/image-pipeline.md`（166行）は**誤りが実在する**（§4-5）。
archive へ移すか、`status: stale` にして誤り箇所を訂正するか、**オーナー判断が要る。**
勝手に移すと、正しい記述（EXIF・dedup・配信経路）まで届かなくなる。

---

## 7. 秋の判断待ちで止まっていた4件の現況

### 7-1. `ws` と `js-yaml` の脆弱性 — **一部だけ解消。本体は残っている**

`bun audit`（2026-08-20 実行）の結果。

| 対象 | 状態 |
|---|---|
| 直接依存の `ws` | **8.21.0 に更新済み**（`299ec0b` 2026-07-07） |
| 直接依存の `js-yaml` | **5.2.1 に更新済み**（同上） |
| `@libsql/client` 経由の `ws` | **8.20.0 のまま。未解消** |
| `pm2 › @pm2/js-api` 経由の `ws` | **7.5.11。未解消** |
| `pm2` 経由の `js-yaml` | **4.1.1。未解消** |

**当初の指摘そのもの（「DB接続ライブラリ経由の `ws`」＝ Turso の `@libsql/client`）は
まだ残っている。**直接依存だけ上げても、依存の奥にピン留めされた版は動かない。

該当する脆弱性（`ws >=8.0.0 <8.20.1`）:
- **high**: 小さなフラグメントとデータ塊によるメモリ枯渇DoS（GHSA-96hv-2xvq-fx4p）
- moderate: 未初期化メモリの漏えい（GHSA-58qx-3vcg-4xpx）

`js-yaml <=4.1.1` は high 3件・moderate 1件（いずれも CPU 消費型DoS）。

**さらに、秋の記録に無かった脆弱性が6パッケージで増えている。**

| パッケージ | 経路 | 深刻度 |
|---|---|---|
| `sharp <0.35.0` | **直接依存** | high 1（libvips 由来 CVE 4件） |
| `nanoid <3.3.16` | vite 経由 | high 2 |
| `postcss <=8.5.22` | vite 経由 | high 1 / moderate 1 |
| `undici` | jsdom 経由 | high 1 / moderate 4 |
| `ip-address` | pm2 経由 | high 1 / moderate 2 |
| `hono <4.12.34` | **直接依存（本番の API 本体）** | moderate 6 / low 1 |
| `esbuild <=0.24.2` | vite / drizzle-kit 経由 | moderate 1 / low 1 |

**合計 28件（high 10 / moderate 16 / low 2）。**

実際の危険度の差を分けて書く。
- **本番の公開面に効くのは `hono` と `sharp` の2つだけ**（残りは開発時のみ、
  または信頼済みのTursoサーバが乗っ取られた場合に限る）。
- `hono` の6件のうち `hono/jsx` のリクエスト間データ漏えい2件は、SSR を使っていれば
  影響が出る型。**このリポジトリが `hono/jsx` の SSR を使っているかは未確認**なので、
  「危険」とも「無関係」とも書かない。
- `pm2` 由来の3パッケージは `bun run start` のプロセス管理用。**本番Railwayでの
  使用有無は未確認。**

**エージェントは `bun update` を実行していない**（依存更新はオーナー領域）。

### 7-2. 旧スクリプトの認証情報 — **スクリプトは消えたが、平文が1か所に残っている** ⚠️

元の指摘（`docs/archive/task-handoffs.md:1355`）は、リポジトリ直下と
`packages/web/` にあった未追跡の `test-*.mjs`（Playwright調査用）に、管理パスワードが
直書きされていた、というもの。

**実測:**

| 確認項目 | 結果 |
|---|---|
| `test-*.mjs` / `packages/web/test-*.mjs` の現存 | **0件。消えている** ✅ |
| それらが commit されたことがあるか | **無し** ✅ |
| 未追跡の `.mjs` | **0件** ✅ |
| `scripts/` 配下の資格情報リテラル | **0件** ✅ |
| `docs/archive/deploy.sh` の資格情報 | **0件** ✅ |
| `.claude/settings.local.json`（プロジェクト） | 資格情報なし ✅ |
| `~/.claude/settings.local.json`（ホーム） | 許可11件、資格情報なし ✅ |
| `.env` が `.gitignore` にあり未追跡か | **両方YES** ✅ |

**残っている問題が1つある。**

> **`docs/archive/task-handoffs.md:1355` に、管理パスワードの平文そのものが
> commit されたまま残っている。**

当時「こういう値が直書きされていて危ない」と説明するために、値をそのまま
引用してしまっている。**スクリプトは消えたが、値はGit履歴に永久に残った。**

この文書は `AGENTS.md` と `task.md` から名指しで参照されている（10020行）。
**値そのものはこの監査文書には書かない。**対処は次のどちらかで、いずれもオーナー判断。

1. その管理パスワードを**現在も使っているなら、変更する**（Railway の
   `ADMIN_PASSWORD` を新しい値に。履歴からの除去より確実で速い）
2. 使っていないなら、当該行を伏字へ書き換える（履歴には残るが、
   これ以上目に触れる機会は減る）

なお `.env`（直下）の `ADMIN_PASSWORD` は**5文字**である。ローカル専用とはいえ、
smoke が本番と同じDBの管理画面にログインする鍵なので、短い。

### 7-3. R2 サムネイルのストレージリーク — **主要な3経路はすべて解消済み**

| 経路 | 状態 | 根拠 |
|---|---|---|
| 完全削除（purge）で thumb/medium が残る | **解消** | `photo-integrity.ts:19-28` の `unsharedPhotoStorageKeys` が `url`/`thumbKey`/`mediumKey` の3キーを返し、`index.ts:521` → `purgeDbThenStorage` → `deleteStorageKeys` が削除。修正 `d0d2412`（2026-07-21） |
| 登録失敗時の補償削除が派生を取りこぼす | **解消** | `uploadedPhotoStorageKeys` が `photos/` に加え `thumbs/` `medium/` を導出。しかも許可集合方式で以前より**狭い**。修正 `1028ec7`（2026-08-05） |
| thumb/medium の片方だけ成功して孤児化 | **解消** | `uploadAllOrCleanup`（`thumbnail-upload-integrity.ts`）。配線テストが 2026-08-06 に「no-op を渡すと落ちる」形へ強化 |

**残っている実害（小）:**

`deleteStorageKeys` は R2 削除の失敗を握りつぶす（`console.error` のみ）。
コード内のコメントはこう書いている。

> DB deletion has already committed. A leftover object is safer than a DB
> photo whose image disappeared; **the orphan audit can remove it later.**

**しかし「orphan audit」はリポジトリに存在しない。**`orphan` で検索しても、
この行のコメント自身以外に監査の実装は無い。つまり**R2削除が失敗した分は、
誰も回収しない**。設計判断としては妥当（DB整合を優先）だが、
回収手段が無いまま放置されている点は残件である。

**記録側の不整合:** `docs/agents/backlog.md` の B-4 が1項目目に
「thumb/medium の片方だけ失敗したときの孤児」を**まだ未完了として載せている**（§4-9）。
`knowledge/wiki/pages/image-pipeline.md` は purge でも消えないと**誤って**書いている（§4-5）。

### 7-4. 本番DBとテストDBの分離 — **未解消。ただし事故の番人が入った**

**実測（値は伏せる）:**

| 確認項目 | 結果 |
|---|---|
| `.env` と `packages/web/.env` の `DATABASE_URL` | **完全に同一**（sha256 の先頭8桁が一致） |
| 向き先 | `libsql://…aws-us-east-2.turso.io`（Turso 本番） |
| ステージング/テスト用のDB | **存在しない** |
| `bun run dev` / `bun run smoke` の接続先 | **本番と同じDB** |

`scripts/smoke/helpers.ts` の冒頭が明言している。

> 【重要】この開発環境(bun run dev / bun run smoke)は本番と同じTursoデータベースに
> 直接つながっている(ステージングDB分離なし)。

**分離は今も行われていない。**ただし秋の記録以降に**緩和策が1つ入った**。

`helpers.ts` の「書き込み事故の番人」— `test.beforeEach` で全リクエストを傍受し、
**ログイン以外の非GETが1件でも出たら、その要求を中止したうえでテストを失敗させる**
（`afterEach` で必ず突き合わせるので握り潰せない）。`playwright.config.ts` は
`scratch/` の調査用スペックを full smoke から除外し、Service Worker も止めている。

つまり「分離されていないが、機械的に書き込めない」状態。
2026-08-06 のスマホ調査も、この番人を通したまま本番DBへ読み取り接続して実施している。

**あわせて見つかった未解消の関連項目（backlog B-15、実測で再現）:**

`.env`（直下）と `packages/web/.env` の `ADMIN_PASSWORD` が**別の値**である
（長さも sha256 も異なる）。`DATABASE_URL` は同一なのに、パスワードだけ食い違う。
どちらが効くかは cwd で決まるため、「パスワードが違います」の原因が分かりにくい。
`scripts/smoke/helpers.ts:34` は**直下の `.env`** を読む。

---

## 8. 使わなくなったものの畳み方（運用ルール1案）

依頼の想定どおり、**削除ではなく `docs/archive/` へ移し、`AGENTS.md` に一行**という
方向で組んだ。ただし今回の実測から、それだけでは足りない点が2つあったので足してある。

### 8-1. `AGENTS.md` に足す一節（A層の増分＝4行）

「参照先」節の直前に置く。

```
## 読まない場所

`docs/archive/` は履歴専用。**通常は読まない。**特定の経緯を追うときだけ検索する。
`docs/agents/` と `docs/specs/` にあるものは、現に有効な指示として読んでよい。
```

**これが効く理由**: 現在 `AGENTS.md` は `task.md` と `task-handoffs.md` の関係についてだけ
「通常は読まない」と書いており、**ディレクトリ単位の規則になっていない**。
そのため `pending-owner-decisions.md` や `ai-collaboration-reform-fable5.md` のように
「本文で ARCHIVED を自称しながら現役ディレクトリに居る」ものが残った。
**場所で決まるようにすれば、本文の自己申告に頼らずに済む。**

### 8-2. 畳む手順（3ステップ・エージェントが実行してよい範囲）

1. **参照を先に切る。** `rg -F '<basename>'` で参照元を洗い、現役文書から
   その文書を指している行を「後継の文書」へ振り替える。**参照が残ったまま移さない。**
   （今回 `refine-and-loop-spec.md` に現役5件、`admin-enhancement-spec.md` に
   現役8件の参照があり、先に移すと8か所がリンク切れになる）
2. **`git mv` で移す。**内容は書き換えない。ファイル名も変えない（過去の参照を壊さない）。
3. **移した先の冒頭に3行だけ足す。**

```
> **ARCHIVED — YYYY-MM-DD。** もう読まない。
> 後継: `docs/…`（無ければ「後継なし」と書く）
> 移した理由: （1行）
```

### 8-3. 今回の実測から追加で必要だと分かったこと

**(a) 「終わったら判定を書く」を、期限付き文書の要件にする。**
`codex-flow-trial.md` は期限も判定基準も自分で書いていたのに、期限が過ぎても
判定が空のまま、正本（`codex-workflow.md`）は「試用中」と書き続けている（§4-2）。
**期限を持つ文書は、期限が来た日に「恒久化 / 取りやめ / 延長」のどれかを1行書いてから
archive へ移す。**判定を書かずに移すと、次の人には「なぜ終わったか」が残らない。

**(b) 1回限りのレビュー記録は、最初から `docs/agents/reviews/` に置く。**
今回Cにした6件（`pre-push-review` ほか計1054行）は、いずれも
「日付 + Phase + 実施者」が題名に入った**一度きりの成果物**である。
現役の運用規則（`codex-workflow.md` など)と同じ階層に置いたために、
「これは今も守るルールか、過去の記録か」が場所から判別できなくなった。

> **置き場所の規則（案）**
> - `docs/agents/` — **今も守る規則だけ。** 5件程度に保つ
> - `docs/agents/reviews/` — 日付入りの1回限りの記録。**移動不要のまま溜めてよい**
> - `docs/archive/` — 役目を終えたもの

`AGENTS.md` が「A/C の反論を要約に置き換えない」と定めている以上、
レビュー記録は消せない。**消さずに、規則と混ざらない場所へ最初から置く**のが解。

**(c) wiki には `last_verified` の期限を入れる。**
wiki 14件は全ページに `last_verified` があるのに、**期限切れを検出する仕組みが無い**。
結果として、2026-07-03 の記述が `status: current` のまま「もう直っている不具合」を
現在形で説明している（§4-5）。

> `scripts/ai/check-handoff-freshness.mjs` と同じ形で、
> **`last_verified` が45日以上前のページを警告するチェックを足す**（読むだけ・
> ファイルは変更しない）。`bun run test:tools` に載せれば、
> `bun run check` を通すたびに目に入る。

**(d) 「archive へ移す」で解決しないものが1件ある。**
`docs/archive/task-handoffs.md` は archive にありながら、`AGENTS.md` と `task.md` から
名指しで参照される**現役の索引**であり、かつ**平文の管理パスワードを含む**（§7-2）。
場所の規則では守れないので、**別途オーナー判断が要る**。

---

## 9. オーナーに確認したいこと（優先順）

1. **`docs/archive/task-handoffs.md:1355` の管理パスワード**を、いま使っているか。
   使っているなら Railway の `ADMIN_PASSWORD` を変えるのが最短（§7-2）。
2. **7列の `db:push` は当てたか**（§4-1）。当てた前提で警告文を消したい。
3. `hono` と `sharp` の更新をやるか（§7-1）。**本番の公開面に効くのはこの2つだけ。**
   残り6パッケージは開発時のみで、まとめて後回しにできる。
4. `.env` 2ファイルの `ADMIN_PASSWORD` 食い違い（backlog B-15）をどちらに寄せるか。
5. `docs/specs/admin-enhancement-spec.md`（未確定v3ドラフト・現役8件が参照）を
   確定版にするか、archive へ落として参照を `admin-renewal-goal.md` に寄せるか（§4-4）。
6. `knowledge/wiki/` 全体を再検証するか、`status: stale` を付けて凍結するか（§2-5）。

---

## 10. この監査で確認しなかったこと（未確認と明記する）

- **本番Railwayの状態**（`hono`/`sharp`/`pm2` の実際の稼働構成）— ローカルのみで確認。
- **本番Tursoの列構成** — 読み取りであっても本番DBへは接続していない。
  §4-1 の結論は `task.md` の smoke 記録からの推論である。
- **`hono/jsx` の SSR 使用有無** — §7-1 の危険度評価が変わるが、未調査。
- **夜間自走ラン関連**（`claude-code-night-run.md`、3:15am タイマー、
  朝に読むセッションレポート）— 依頼により廃止扱いとし、確認していない。
- `docs/` 直下の `docs/reports/`・`docs/checklists.md` ほか — 今回の対象範囲外。
  ただし `docs/reports/night-20260707.md` が §7-1 と §7-3 の当初記録であり、
  §7-3 は**もう解消済み**なので、この報告書も現状と食い違っている。
