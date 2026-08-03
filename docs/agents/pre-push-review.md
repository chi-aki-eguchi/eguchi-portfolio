# push 直前レビューの記録（Phase E）

> 2026-08-03。実施 = Codex Sol / high、読み取り専用。
> 対象 = `a3946fc` からの文書整理・クレジット判定の変更。
> 判定は **BLOCK**。P0 は解消済み（commit `4abedb4` ほか）。**P1 以降は未着手。**
>
> **「3. 未解決の反論」は原文のまま。要約に置き換えない。**
> 絶対パスは `` を除いたリポジトリ相対で読むこと。

---

結論は **BLOCK（現状のままの push は非推奨）** です。製品コードの破損は確認していませんが、今回変更したAI運用文書とhookに、push前に直すべきP0が残っています。

用語:

- hook = Claude Codeの節目で自動実行される小さな監視プログラム。
- `assertOk` / `jsonOrThrow` = API通信が成功したか確認し、失敗なら処理を止める共通関数。
- `onError` = 失敗を利用者の画面へ知らせる処理。
- `withRetry` = 一時的なDB通信失敗だけを自動で再試行する仕組み。

## 1. 確認済み事実

### リンク・導線

- 88件の現役Markdownについて、通常のMarkdownリンク `[]()` を機械検査した結果、存在しないリンクは0件でした。
- ただし、コード表記されたパスには切れがあります。
  - [task.md:22](task.md:22) の `credit-status-review.md` はルートからは存在しません。正しくは `docs/agents/credit-status-review.md` です。
  - [night-20260707.md:45](docs/reports/night-20260707.md:45) は、移動前の `docs/agents/autonomy-rules.md` を現在も指しています。
- [owner-guide.md:9](docs/owner-guide.md:9) と [owner-guide.md:66](docs/owner-guide.md:66) は `task-queue.md` を現役の開始点・残タスク一覧として案内します。一方、[task-queue.md:3](docs/agents/task-queue.md:3) は自身を `ARCHIVED / SUPERSEDED` と宣言しています。

### 規則の矛盾

- pushの正本は明確です。[AGENTS.md:44](AGENTS.md:44) は「明示依頼があってもエージェントはpushしない」、[deploy/SKILL.md:33](.claude/skills/deploy/SKILL.md:33) も同じです。
- しかし、現役ディレクトリに矛盾が残っています。
  - [ai-collaboration-reform-fable5.md:48](docs/specs/ai-collaboration-reform-fable5.md:48) は、オーナー承認後ならAIがpushできるとしています。
  - [delayed-execution-sop.md:36](docs/delayed-execution-sop.md:36) と [同:77](docs/delayed-execution-sop.md:77) は自動pushを選択肢にしています。
- 本番DB操作も矛盾しています。
  - [AGENTS.md:45](AGENTS.md:45) は直接依頼が必要です。
  - [checklists.md:45](docs/checklists.md:45) は `db:push` を通常の完了手順として載せ、停止条件がありません。
  - [refine-and-loop-spec.md:12](docs/specs/refine-and-loop-spec.md:12) も同様です。
  - [photo-metadata-extraction-plan.md:12](docs/specs/photo-metadata-extraction-plan.md:12) は実行を促し、[同:18](docs/specs/photo-metadata-extraction-plan.md:18) では安全と断定しています。
- `withRetry` について、現行の主要規則間に直接の反対指示は見つかりませんでした。[AGENTS.md:55](AGENTS.md:55)、[api-validation.md:5](.claude/rules/api-validation.md:5)、[checklists.md:43](docs/checklists.md:43) は同じ方向です。

### `assertOk` の実態

- [AGENTS.md:60](AGENTS.md:60) は「admin配下は `admin-shared.ts` の関数を使う」と確定しています。
- 実装は3重定義です。
  - 公開側: [lib/api.ts:8](packages/web/src/web/lib/api.ts:8)
  - admin共通: [admin-shared.ts:202](packages/web/src/web/pages/admin-shared.ts:202)
  - admin本体内の重複: [admin.tsx:210](packages/web/src/web/pages/admin.tsx:210)
- `admin-tabs.tsx` は共通版をimportしていますが、`admin.tsx` は共通版をimportせず、ローカル定義を使っています。[admin.tsx:87](packages/web/src/web/pages/admin.tsx:87)
- したがって、AGENTS.mdの説明は「今後そう統一する方針」としては妫当でも、現在の実装を正確には説明していません。

### `autonomy-rules.md` で消えた条件

- アーカイブされた [autonomy-rules.md:49](docs/archive/autonomy-rules.md:49) は、新しい書き込み処理に次の両方を要求していました。
  1. `assertOk` による通信失敗の検出
  2. `onError` または `try/catch` による利用者へのエラー表示
- これは矛盾ではなく、別の安全条件です。`assertOk`だけでは例外を投げるだけで、画面に失敗が見えるとは限りません。
- [audit-2026-07.md:106](docs/specs/audit-2026-07.md:106) も両方を独立に検査しています。
- 現行 [checklists.md:80](docs/checklists.md:80) は古い `autonomy-rules §3` を参照しますが、その条件自体は現役の正本へ移されていません。

### file-hygiene

- 許可されるルートMarkdownは5件です。[file-hygiene.md:3](.claude/rules/file-hygiene.md:3)
- 現状は6件あり、余分なのは [claude-code-night-run.md:1](claude-code-night-run.md:1) です。内容も2026-07-09に「実行不要」とした7行だけの古い指示です。
- 過去ログでも未追跡ファイルとして既に問題化されています。[2026-07-08.md:580](docs/archive/agent-logs/2026-07-08.md:580)
- `*-v2` 禁止に対し、[admin-enhancement-spec-v2.md](docs/archive/admin-enhancement-spec-v2.md:1) が残っています。規則にはarchive例外がありません。[file-hygiene.md:7](.claude/rules/file-hygiene.md:7)
- `*.handoff.md` は0件でした。
- git操作禁止のため、現在の未追跡状態は確認していません。したがって「未追跡はscratchだけ」という [task.md:10](task.md:10) は今回未検証です。

### hook

- hookが書くのはホーム配下の `status.json` と `status.txt` だけです。[credit-status.mjs:21](.claude/hooks/credit-status.mjs:21)、[同:434](.claude/hooks/credit-status.mjs:434)
- `task.md` を読む・書く処理はありません。
- 取得・保存・内部処理の失敗はcatchされ、通常の失敗経路で非0終了を設定していません。[同:442](.claude/hooks/credit-status.mjs:442)、[同:513](.claude/hooks/credit-status.mjs:513)
- CLI出力は保存せず、安全な項目だけを新しいオブジェクトへ詰め直しています。[同:106](.claude/hooks/credit-status.mjs:106)、[同:385](.claude/hooks/credit-status.mjs:385)
- テストは19件あります。CLI未発見・取得失敗の終了コード0、未来cache、旧形式、認証らしいダミー値の非保存を検査しています。[credit-status.test.mjs:241](.claude/hooks/credit-status.test.mjs:241)、[同:310](.claude/hooks/credit-status.test.mjs:310)
- ただしテスト不足があります。
  - 状態ファイルを書けない場合の終了コード0を検査していません。
  - `task.md` 非変更を直接検査していません。
  - Claudeの5時間枠だけ欠落した場合を検査していません。
- 実装も完全な3軸分離ではありません。Claudeの5時間枠か週枠のどちらか一方が欠けると、[credit-status.mjs:111](.claude/hooks/credit-status.mjs:111) でClaude全体を失敗扱いにし、正常なもう一方まで捨てます。
- 今回はテストが一時ファイルを作るため、明示された読み取り専用条件に従い再実行していません。`node --check` によるhookとテストの構文確認だけは成功しました。

### Current State と残作業

- 依頼背景は18 commitsですが、[task.md:9](task.md:9)、[同:44](task.md:44)、[同:56](task.md:56) は14 commitsのままです。
- [task-queue.md:3](docs/agents/task-queue.md:3) を履歴扱いにした一方、未完了事項が残っています。
  - セットアップ完了判定の追加問題: [同:228](docs/agents/task-queue.md:228)
  - 削除・R2・競合関連: [同:273](docs/agents/task-queue.md:273)
  - CSS構造問題: [同:485](docs/agents/task-queue.md:485)
  - `srcset`の前提問題: [同:505](docs/agents/task-queue.md:505)
  - `/admin/demo`: [同:520](docs/agents/task-queue.md:520)
- `docs/specs/README.md` は4行だけで、索引になっていません。[README.md:1](docs/specs/README.md:1)
- Handoff archiveは9,913行で、6月・7月の記録と過去Current Stateが1ファイルに混在しています。[task-handoffs.md:1](docs/archive/task-handoffs.md:1)
- 現役admin仕様書はファイル名からバージョンを外したのに、タイトルは `v3 Draft` のままです。[admin-enhancement-spec.md:1](docs/specs/admin-enhancement-spec.md:1)

## 2. 推測

- `claude-code-night-run.md` は、過去に削除された後で未追跡ファイルとして再出現した可能性が高いです。ただし現在のgit追跡状態は未確認です。
- 正式なMarkdownリンクが0件でも、安全ではありません。このリポジトリはバッククォート内のパス表記を多用しており、通常のリンク検査では拾えません。
- `ai-collaboration-reform-fable5.md` は冒頭で廃止済みと書かれていますが、`docs/specs/` にあるため、仕様探索時に現役文書として読まれる可能性があります。
- Claude側の片方の利用枠だけ欠落する入力がCodexBarで実際に起こる頻度は未確認です。ただし、コード上は正常な軸まで捨てることが確定しています。

## 3. 未解決の反論

1. **`autonomy-rules.md` をarchiveへ移した判断は不十分でした。**

   `assertOk + onError` を「assertOkの合格条件と食い違う」と捉えた点が誤りです。前者は通信失敗の検出、後者は利用者への通知であり、両方必要です。archive移動自体ではなく、この条件を現役規則へ移さず失ったことが問題です。

2. **AGENTS.mdの`assertOk`説明は実装の実態と一致していません。**

   `admin-shared.ts`へ統一済みのように読めますが、`admin.tsx`は独自定義を使っています。「新規・変更箇所は共通版を使う。既存のadmin.tsx重複は未解消」と書くか、製品コード側を統一する必要があります。

3. **3重定義を今回の製品コード対象外として直さなかったこと自体は妥当です。**

   文書だけの18 commitsへ製品コード変更を混ぜなかった判断は安全です。ただし、未解決の技術的負債として起票せず、AGENTS.mdを「統一済み」に見える形へ変えたのは誤りです。製品コード修正は別commit・`bun run check`・`bun run smoke`付きで行うべきです。

4. **`task-queue.md`へARCHIVED見出しを付けた時点が早すぎます。**

   未完了事項の抽出前に現役性だけを否定したため、owner-guideと実態が分裂しました。これは単なる整理不足ではなく、残作業を失う導線です。

5. **hookの「3軸分離完了」という報告は強すぎます。**

   Claude/Codexの分離はできていますが、Claude内部の週枠と5時間枠はまだ一括解析です。片軸欠落時の独立性まで完成したとは言えません。

## 4. 作業指示

### P0-1 安全規則の矛盾を解消する

- **目的:** push・本番DB・書き込み失敗の扱いを一意にし、古い文書が危険な操作を許可しない状態にする。
- **対象ファイル:** `AGENTS.md`、`docs/checklists.md`、`.claude/rules/api-client.md`、`docs/delayed-execution-sop.md`、`docs/specs/refine-and-loop-spec.md`、`docs/specs/photo-metadata-extraction-plan.md`
- **完成条件:**
  - エージェントは理由・承認の有無にかかわらずgit pushしない。
  - `db:push` / migrationはオーナーの直接依頼がない限り実行せず、必要性だけ報告する。
  - 新しい書き込み処理は「応答検証」と「利用者へエラー表示」の両方を必須にする。
  - `AGENTS.md`には、`admin.tsx`の既存重複が未解消であることを明記する。
- **禁止操作:** `packages/`、既存の`docs/archive/`本文、DB、push、deployを触らない。
- **検証方法:**

```sh
grep -RInE 'git push|db:push|db:migrate|assertOk|jsonOrThrow|onError' AGENTS.md CLAUDE.md .claude/rules docs/checklists.md docs/delayed-execution-sop.md docs/specs
git diff --check
```

- **停止条件:** 過去の本番DB適用記録を「現行手順」として残すか判断できない場合は、内容を書き換えず、archive移動案を提示して停止。
- **担当の目安:** Terra

### P0-2 廃止文書を現役導線から外し、切れたパスを直す

- **目的:** 廃止済み文書の古いpush規則と移動前パスを、現役の検索結果から除く。
- **対象ファイル:** `docs/specs/ai-collaboration-reform-fable5.md`、`docs/reports/night-20260707.md`、`docs/checklists.md`、`knowledge/wiki/pages/ai-collaboration.md`、`knowledge/wiki/log.md`、`task.md`
- **完成条件:**
  - 廃止文書2件は本文を変更せずarchiveへ移す。
  - 現役文書の参照だけ新パスへ更新する。
  - `task.md`のレビュー記録は完全パスになる。
  - archive内の過去引用は変更しない。
- **禁止操作:** 移動対象の本文、既存archive本文、製品コード、pushを変更しない。
- **検証方法:**

```sh
grep -RInE 'docs/agents/autonomy-rules\.md|docs/specs/ai-collaboration-reform-fable5\.md|`credit-status-review\.md`' --include='*.md' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=archive .
test -e docs/agents/credit-status-review.md
git diff --check
```

- **停止条件:** 外部配布資料が旧パスを使用していると判明したら、redirectを作れないMarkdown移動なのでオーナーへ確認。
- **担当の目安:** Luna

### P0-3 `task-queue.md` の未完了事項を救出する

- **目的:** ARCHIVED文書に埋もれた残作業を、現役の実行可能なbacklogへ戻す。
- **対象ファイル:** `docs/agents/task-queue.md`、`docs/agents/pending-owner-decisions.md`、`docs/owner-guide.md`、`docs/specs/admin-renewal-goal.md`、`docs/specs/library-redesign-spec.md`、`task.md`
- **完成条件:**
  - 旧queue原文を履歴として保存し、現役の`docs/agents/task-queue.md`には未完了事項だけを置く。
  - 少なくともT-9追加3件、T-10残件、CSS構造、`srcset`前提、`/admin/demo`を1件ずつ再判定する。
  - Q-12のように後段で完了確認できる項目は再登録しない。
  - 状態不明の項目は削除せず「要再確認」とする。
  - owner-guideは新しい現役queueだけを案内する。
- **禁止操作:** 未完了事項の実装、製品コード変更、既存archive本文の編集、pushは禁止。
- **検証方法:**

```sh
grep -nE '^## |^- \[[ x~]\]' docs/agents/task-queue.md
grep -RInF 'docs/agents/task-queue.md' --include='*.md' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=archive .
git diff --check
```

- **停止条件:** コード確認なしに完了・未完了を断定できない項目があれば「要再確認」のまま止める。削除系作業の優先順位はオーナーへ返す。
- **担当の目安:** Terra

### P0-4 hookを本当の3軸分離にする

- **目的:** Claudeの片方の枠だけ取得できない場合も、正常なもう一方の軸を保持する。失敗安全性をテストで固定する。
- **対象ファイル:** `.claude/hooks/credit-status.mjs`、`.claude/hooks/credit-status.test.mjs`、`docs/agents/credit-status.md`
- **完成条件:**
  - 5時間枠欠落時もClaude週枠を保持する。
  - 週枠欠落時も5時間の作業継続性を保持する。
  - 状態ファイル書き込み失敗でも終了コード0。
  - `task.md`非変更と認証らしい入力の非保存をテストする。
  - 既存19件を削除・緩和せず追加テストを通す。
- **禁止操作:** `.claude/settings.json`の発火頻度、実際のホーム状態ファイル、製品コード、認証値を変更しない。
- **検証方法:**

```sh
node --check .claude/hooks/credit-status.mjs
node --check .claude/hooks/credit-status.test.mjs
node --test .claude/hooks/credit-status.test.mjs
```

- **停止条件:** CodexBar出力で片軸欠落を表現できない場合は、想像で形式を増やさず、実出力の安全な構造だけ報告して停止。
- **担当の目安:** Terra

### P0-5 ルートの古いnight-runファイルを解決する

- **目的:** ルートMarkdownを5件へ戻し、廃止済み夜間指示の誤読を防ぐ。
- **対象ファイル:** `claude-code-night-run.md`
- **完成条件:** ルートに許可5件だけが残る。
- **禁止操作:** オーナー判断前の削除・移動、他ファイルの整理、pushは禁止。
- **検証方法:**

```sh
find . -maxdepth 1 -type f -name '*.md' -print | sort
git status --short --branch
```

- **停止条件:** オーナーが次から選ぶまで停止。
  - archiveへ保存して移動 — 履歴を残せる。**推奨**
  - 削除 — 最もすっきりするが、現在未追跡なら復元しにくい
  - `scratch/`へ移動 — ローカル保留にはなるが恒久解決にならない
- **担当の目安:** オーナー

### P0-6 push前のCurrent Stateを現物へ合わせる

- **目的:** 14 commitsという古い情報と、実際にpushされる変更範囲のずれを解消する。
- **対象ファイル:** `task.md`
- **完成条件:** branch、HEAD、originとの差、clean/dirty、commit数、検証、P0完了状況が現物と一致する。
- **禁止操作:** archive、製品コード、push、deployを変更しない。
- **検証方法:**

```sh
git status --short --branch
git log origin/main..HEAD --oneline
node scripts/ai/check-handoff-freshness.mjs
git diff --check
```

- **停止条件:** dirty差分の所有者が不明、または18 commitsと実物が一致しない場合はCurrent Stateを推測で更新せず報告。
- **担当の目安:** Luna

### P1-1 `assertOk` の3重定義を2系統へ統一する

- **目的:** adminの401リダイレクト処理が複数コピーでずれる事故を防ぐ。
- **対象ファイル:** `packages/web/src/web/pages/admin.tsx`、`admin-shared.ts`、関連テスト
- **完成条件:**
  - `admin.tsx`のローカル`assertOk` / `jsonOrThrow`を削除し、`admin-shared.ts`からimportする。
  - 公開側`lib/api.ts`とadmin側`admin-shared.ts`の2系統だけになる。
  - 401、非2xx、正常JSON、settings `ignoredKeys`の挙動を維持する。
- **禁止操作:** API形、エラー文、ログイン遷移、既存テスト期待値の緩和は禁止。
- **検証方法:**

```sh
grep -RInE '^export function assertOk|^export async function jsonOrThrow' packages/web/src/web
bun run check
bun run smoke
```

- **停止条件:** 循環import、画面文言、401遷移の変更が必要になったら停止。
- **担当の目安:** Terra

### P1-2 毎プロンプトのクレジット文を変化時だけにする

- **目的:** 状態が同じなのに毎回同じ文が会話へ注入される無駄をなくす。
- **対象ファイル:** `.claude/hooks/credit-status.mjs`、テスト、`.claude/settings.json`、`docs/agents/credit-status.md`
- **完成条件:**
  - `UserPromptSubmit`では、3軸・actions・warning・errorCodeのいずれも前回表示から変わらなければ標準出力を空にする。
  - `SessionStart`、`Stop`、`--force`では従来どおり表示できる。
  - 判定そのものや状態保存を止めない。
- **禁止操作:** しきい値・安全判断・認証情報保存範囲を変えない。
- **検証方法:**

```sh
node --test .claude/hooks/credit-status.test.mjs
node --check .claude/hooks/credit-status.mjs
git diff --check
```

- **停止条件:** Claude hook側にイベント名を渡す正式な方法が無ければ、環境変数などを推測で追加せず、`UserPromptSubmit`自体を外す案と比較してオーナーへ返す。
- **担当の目安:** Terra

### P2-1 `docs/specs/README.md` を索引化する

- **目的:** 現役仕様書の目的と状態を、全文検索せず判断できるようにする。
- **対象ファイル:** `docs/specs/README.md`
- **完成条件:** 各現役仕様書を「パス・目的・状態・正本か補助か」で1行ずつ掲載し、archive済み文書を現役一覧へ含めない。
- **禁止操作:** 各仕様書本文、archive、製品コードは変更しない。
- **検証方法:**

```sh
find docs/specs -maxdepth 1 -type f -name '*.md' ! -name 'README.md' -print | sort
grep -n 'docs/specs/' docs/specs/README.md
git diff --check
```

- **停止条件:** `Draft`か確定版か判断できない仕様書は「状態不明」とし、勝手に確定扱いしない。
- **担当の目安:** Luna

### P2-2 Handoff archiveを月別分割する

- **目的:** 9,913行の検索ノイズを減らし、月単位で必要な履歴だけ読めるようにする。
- **対象ファイル:** `docs/archive/task-handoffs.md`
- **完成条件:** 月別ファイルと短い索引に分かれ、各Handoff本文が欠落・重複・書換えなしで1回だけ収録される。
- **禁止操作:** 履歴本文の要約・訂正・削除は禁止。
- **検証方法:** 分割前後のHandoff見出し件数、日付、本文hashを比較する。
- **停止条件:** この作業は既存archiveの構造変更なしには達成できません。今回の「archive書換え禁止」と衝突するため、まずオーナーの一回限りの構造変更許可を取り、許可前は分割計画だけ出して停止。
- **担当の目安:** オーナー承認後にTerra

### P2-3 admin仕様書を内容名へ改名する

- **目的:** v1/v2/v3ではなく、内容から仕様書を選べるようにする。
- **対象ファイル:** `docs/archive/admin-enhancement-spec.md`、`docs/archive/admin-enhancement-spec-v2.md`、`docs/specs/admin-enhancement-spec.md`、全参照元
- **完成条件:**
  - 推奨名:
    - `admin-typography-and-settings-spec.md`
    - `admin-photo-management-and-editor-spec.md`
    - `admin-photo-orientation-and-controls-spec.md`
  - 現役仕様書タイトルから`v3`を外す。
  - オーナー確定前なら`Draft`は残す。
  - 全参照先が実在する。
- **禁止操作:** archive本文のタイトル変更・訂正は禁止。archiveはファイル名変更だけとし、旧タイトルは歴史として保持する。
- **検証方法:**

```sh
find docs -type f -name '*-v2*.md' -o -name '*-v3*.md'
grep -RInE 'admin-enhancement-spec(-v2)?\.md' --include='*.md' --exclude-dir=.git --exclude-dir=node_modules .
git diff --check
```

- **停止条件:** 外部リンクの利用が判明した場合、またはarchive内部タイトルまで直す必要がある場合はオーナー判断を待つ。
- **担当の目安:** Luna。archive本文変更を求める場合はオーナー。

今回は読み取り専用のため、リポジトリ・git・Obsidianへの記録や変更は一切行っていません。
