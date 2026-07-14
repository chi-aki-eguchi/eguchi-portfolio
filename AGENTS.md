# eguchi-portfolio-app

写真家ポートフォリオサイト。Hono (API) + React 19 (SPA) + Drizzle/Turso (SQLite) + Bun + Tailwind CSS 4。Railway にデプロイ（GitHub auto-deploy。通常は git push で反映）。

## AI共同作業メモ

- 2026-06-11: Codex が保守メンバーとして参加。以後、Claude Code / Codex が同じ仕様書と `task.md` を見て作業する前提。
- Claude Code / Codex は実装着手前に `task.md` の最新 Handoff を確認し、未完了・検証済み・触ったファイルを追記する。
- settings は4箇所同期。新規 settings キー追加時は `packages/web/src/web/lib/settings-preview.ts` の台帳、API `/settings` の default、`provider.tsx` の DB 適用 `useEffect`、`provider.tsx` の `handlePreviewMessage` を揃える。
- 2026-06-16: Runable → Railway 移行完了。デプロイ正本は `git push`。ZIP 作成・Runable publish は legacy 手順であり、通常作業では使わない。
- Runable 関連ファイル（`docs/archive/RUNABLE_AI.md`, `docs/archive/deploy.sh`, `packages/web/website.config.json`）は過去運用の参照用。復旧・検証で必要になった場合のみ、現行 Railway 方針との整合を確認してから `bun run deploy:runable:legacy` として使う。
- Codex は作業前に、存在すればローカル専用メモ `.codex/USER_CONTEXT.md` も読む。ここには秋さんの作業スタイル・好み・AI運用上の文脈を置く（`.codex/` は gitignore 済み、秘密情報は書かない）。
- MacBook / Mac mini の2台運用では、GitHub をコード正本にする。リポジトリを iCloud / Dropbox 等で丸ごと同期しない。`.env` は各Macに置き、秘密情報は 1Password 等の安全な保管場所から転記する。人間向け手順は `docs/two-mac-workflow.md` を参照。
- Fable5 など高性能モデルを使える時は、単発実装より先に `docs/specs/ai-collaboration-reform-fable5.md` を読み、全AIに残る作業ルール・検査表・Handoff品質の改善を優先する。

### §0 invariants

> 高リスク領域（settings / DB / 画像 / admin / デプロイ）に触るときは、
> 実行手順版の検査表 `docs/checklists.md` を着手前・完了前になぞる。

- DB クエリは必ず `withRetry(() => db....)` のリトライラッパーを使う。
- settings は 4-place settings sync パターンを維持する。`settings-preview.ts` の台帳、API `/settings` の default、`provider.tsx` の DB 適用 `useEffect`、`provider.tsx` の `handlePreviewMessage` を揃える。
- API / client のレスポンスは `assertOk()` で検証してから本文を読む。
- `Content-Encoding` は手動設定しない。Railway / upstream proxy が自動処理する。
- HTML レスポンスは `Cache-Control: no-store` にする。
- スタックは Hono + React 19 + Drizzle/Turso + Bun + Tailwind CSS 4 を前提にする。
- デプロイ構成は Railway（GitHub auto-deploy）、Cloudflare R2 + sharp、Turso。

### リポジトリ境界（絶対禁止）

- `eguchi-portfolio-app` と `ivys-house` リポジトリのコードを混ぜない。ファイルコピー、import、コード参照をすべて禁止する。

### 役割分担（2026-07-08 固定・2026-07-13 モデル非固定化）

役割（Driver/Reviewer）は固定するが、**各AIが内部で使うモデル（Sonnet/Fable/Opus や特定の Codex モデル等）は固定しない**。作業内容・利用可能性・残りクレジットに応じてその都度選ぶ。定型調査は小さいモデル・低い思考量へ渡してよいが、重要判断と統合は主担当（Driver）が行う。

- **Driver = Claude Code**: 実装・コミット・検証（`bun run check` / `bun run smoke`）を行う唯一の役割。
- **Reviewer = Codex**: **read-only**。push 前レビュー・高リスク差分（DB / 画像 / settings / deploy）の確認・三振（同じ失敗3回）時の相談相手。
- **Codex に実装させない**（ファイル編集・コミットをさせない）。レビューで修正が必要なら、指摘を受けて Driver が直す。
- 迷ったときの参照順: 各タスクの指示書（docs/agents/task-queue.md）→ docs/agents/autonomy-rules.md → 本ファイル §0。

#### 期間限定の役割反転（2026-07-14 オーナー直接指示「実行はしばらくcodexを使おうね」・撤回まで有効）

上記の恒久ルールに対する、オーナーがチャットで直接出した期間限定の上書き。

- **実装 = Codex**: claude-driver が `codex exec`（workspace-write sandbox）で起動し、
  指示書を渡して実装させる。
- **Claude Code = レビュー・統合・進行管理**: 依頼文の作成、差分の read-only レビュー、
  `bun run check` / `bun run smoke` の実行（Codex の sandbox はネットワーク不可のため
  smoke は Claude 側でしか回せない）、commit 整理、task.md Handoff・決定ログ、
  オーナーへの報告。
- §0 invariants・完了の定義・**push はオーナーのみ**は従来どおり両AIに適用。
- Codex の利用枠節約のため、実装依頼は原則 medium 推論で出し、難所のみ引き上げる。
- この反転はオーナーが撤回した時点で終了し、恒久ルール（Driver = Claude Code）へ戻る。
  autonomy-rules.md の「Codex に実装をさせること」ハードストップは、この期間中は適用しない。

#### クレジット切れ時の復旧手順（短縮版）

前担当がクレジット切れ等で途中終了した場合、次の担当は次の順で動く。

1. `git status --short` と `git diff` で未コミット差分を確認し、**破棄しない**（他人の途中成果として保護する）。
2. 差分と `task.md` 最新 Handoff を読み、ファイルごとに「続行（このまま仕上げる）」「保留（触らずオーナー判断待ち）」「戻す（要相談で理由付きの差し戻し）」に分類する。
3. 分類結果を `task.md` の Handoff に短く追記してからオーナーへ報告する。commit は内容確定後のみ、push は行わない。

### Claude Code / Codex agmsg 運用

- agmsg team は `eguchi-portfolio`。Claude Code は `claude-driver`、Codex は `codex-reviewer`。
- 窓口は上記「役割分担」に従う（Driver=Claude Code 固定。Codex は Reviewer としてのみ呼ぶ）。
- **識別名は `claude-driver` の1つに固定する。** 即席の別名（`claude-library-driver` 等）を新規に作らない — 名前が増えると agmsg の宛先ズレ・同時多重編集事故の温床になる（2026-07-12 に実際に発生: 複数セッションが同一 working tree を同時編集し、停止指示とプロセス強制終了合戦になった）。
- 作業開始時に `~/.agents/skills/agmsg/scripts/whoami.sh "$(pwd)" claude-code` で、自分が `claude-driver` として登録されているか、project がこのリポジトリのパスになっているかを確認する。ズレていたら編集作業をせず、状況を報告して停止する。
- 実装セッションは常に1つだけ開く。同一 working tree を複数セッションで同時編集しない（1 task = 1 Driver。詳細は本ファイル下部「Agent Ownership」参照）。
- Codex への相談は非ブロッキングとして扱う。返信を無期限に待たない。同一セッション内に返信が無ければ `docs/checklists.md` のセルフチェックで代替し、Handoff に「Codex未応答・検査表で代替」と明記してよい。
- 権限プロンプトで進めなくなったタスクは、autonomy-rules.md の原則どおり「要相談」に回して次のタスクへ進む。セッション全体を承認待ちで止めない。
- 主担当AIは次の場合だけ agmsg で相手に相談する:
  - 設計判断が2択以上で迷う
  - 同じバグ修正を2回試して解決しない
  - DB / auth / deploy / settings / 画像処理など失敗時の影響が大きい箇所を触る
  - commit / push 前に高リスク差分のレビューが必要
- 相談は1セッション最大3回を目安にする。自動会議や雑談で両方のクレジットを消費しない。
- 相談文には必ず `目的` / `制約` / `触ったファイル` / `検証` / `返答形式` を含める。相手には「実装なし、P0/P1中心、短く」と依頼する。
- 相手AIからの返信は主担当AIが要約してユーザーへ伝える。ユーザーに agmsg の中継作業を戻さない。
- delivery mode は Claude Code `monitor`、Codex `turn` を基本にする。消費を抑えたい時は一時的に `off` へ落とす。

### 小さいモデルへの委譲基準（クレジット節約）

- 調査・照合・定型チェック（grepでの影響範囲探索、ドキュメントとコードの食い違い確認、写真データ整合性など「判断ではなく確認」の作業）は `.claude/agents/` のサブエージェント（読み取り専用・軽量モデル）に投げてよい。実装・commit は投げない — 編集権限は Driver 本体のみ。サブエージェントの報告は証拠収集であり、最終判断は Driver または Codex レビューが行う。
- 既存のサブエージェント: `exif-checker`（写真データ整合性、`model: haiku`）、`perf-auditor`（性能監査、`model: haiku`）、`security-reviewer`（セキュリティ監査、高リスク判断のため `model: inherit` でセッションの主モデルへ追従）。呼び出しの目安: 画像・キャッシュ周りを触った直後は `perf-auditor`、認証・admin周りを触った直後は `security-reviewer`、写真データを触った直後は `exif-checker`。月次の定期健診用途にも使ってよい。
- サブエージェントには「ファイルを丸ごと読む」のではなく「grepで当たりをつけてから該当範囲だけ読む」よう指示し、返答は「パス:行番号＋1行要約（最大30件程度）」に絞ってもらう。長文レポートは Driver 本体のコンテキストを消費するため避ける。
- Codex レビュー依頼も同じ考え方で: ①目的1行 ②触ったファイル一覧 ③§0該当の有無 ④見てほしい点1〜3個、に絞ったテンプレを使う。ファイル本文を貼らず、Codex 側で読ませる。
- Codex 側の軽量調査役 `repo-scout`（`.codex/agents/repo-scout.toml`、read-only・低reasoning・小型モデル）は「検索・仕様差分の洗い出し・長いテスト結果の要約」の3用途だけに使う。push前レビューや§0該当の高リスク差分レビューには使わない（そちらは Codex 本体のレビューに任せる）。

### 高性能モデル利用時の優先順位

- まず `git status --short` と `task.md` 最新 Handoff を確認し、既存の未コミット作業を踏まない。
- Fable5 などの高性能モデルは、広範囲の現状診断、設計判断、検査表作成、引き継ぎ改善、P0/P1レビューに使う。
- 実装者は原則1人に固定し、もう片方のAIは read-only reviewer として動かす。
- 自動化や hooks を増やす前に、AGENTS.md / CLAUDE.md / task.md / wiki の役割を整理する。
- push 済み、Railway 反映済み、本番確認済みは別物として報告する。

## スタック

| レイヤー       | 技術                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| ランタイム     | Bun                                                                              |
| API            | Hono 4 (`.basePath('api')`)                                                      |
| フロントエンド | React 19 + Wouter + TanStack Query + Tailwind CSS 4                              |
| DB             | Drizzle ORM + Turso (libsql)                                                     |
| ストレージ     | Cloudflare R2 (S3 互換)                                                          |
| 画像処理       | sharp (アップロード時に 3200px/mozjpeg q92 最適化、配信時にオンザフライリサイズ) |
| モノレポ       | Bun workspaces + Turborepo                                                       |
| デプロイ       | Railway (GitHub auto-deploy / git push → 自動ビルド + `bun src/server.ts`)       |

## プロジェクト構造

```
eguchi-portfolio-app/
├── packages/
│   └── web/                     # メインパッケージ（API + フロントエンド統合）
│       ├── src/
│       │   ├── api/
│       │   │   ├── index.ts     # Hono ルート全体（AppType エクスポート）
│       │   │   └── database/
│       │   │       ├── index.ts # Turso クライアント + withRetry
│       │   │       └── schema.ts# Drizzle スキーマ
│       │   ├── server.ts        # Bun.serve エントリ（OGP インジェクション含む）
│       │   └── web/
│       │       ├── app.tsx      # Wouter ルーティング
│       │       ├── pages/       # top, gallery, profile, contact, admin, admin-login
│       │       ├── components/  # Layout, PageTransition, provider, ui/
│       │       ├── hooks/
│       │       └── lib/
│       │           └── api.ts   # hono/client による型付き API クライアント
│       ├── drizzle/             # マイグレーションファイル
│       ├── vite.config.ts
│       └── website.config.json  # Runable legacy 設定（通常デプロイでは不使用）
├── ecosystem.config.cjs         # PM2 設定（現行 Railway 起動では通常不使用）
├── task.md                      # 直近のタスクログ
├── docs/
│   ├── specs/                   # 現行仕様（1 spec = 1 file、更新は同名で上書き）
│   │   ├── admin-enhancement-spec.md
│   │   ├── design-spec.md
│   │   ├── refine-and-loop-spec.md
│   │   └── spec-layout-expansion.md
│   └── archive/                 # 完了・退役・歴史資料
└── scratch/                     # gitignored scratch workspace（READMEのみ追跡）
```

## DB スキーマ

- `photos` — 写真（filename, url, title, meta, description, category, displaySize S/M/L, sortOrder）
- `categories` — カテゴリ（slug, label, sortOrder）
- `hero_photos` — トップページヒーロー写真（photoId, sortOrder）
- `site_settings` — サイト全体設定（key-value）

## 環境変数

`.env` をプロジェクトルートに置く（gitignored）。

```
DATABASE_URL=         # Turso libsql URL（コードは process.env.DATABASE_URL を参照）
DATABASE_AUTH_TOKEN=  # Turso 認証トークン
S3_ENDPOINT=          # Cloudflare R2 エンドポイント
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
ADMIN_PASSWORD=       # 未設定だと管理ログイン無効（セッショントークンもこの値から導出）
PORT=4200
```

> 変数名は `.env.template` が正。DB は `DATABASE_URL` / `DATABASE_AUTH_TOKEN`（旧称 TURSO_* ではない）。

- API コード内では `process.env.VAR`
- ブラウザ公開が必要な場合のみ `VITE_` プレフィックスを付けて `import.meta.env.VITE_VAR`
- Drizzle CLI スクリプトは `bun --env-file=../../.env drizzle-kit ...`

## 開発

```sh
# フロントエンド + Vite dev server（API は hono-dev-plugin でプロキシ）
bun run dev

# DB 操作（packages/web から実行 or プロジェクトルートの turbo スクリプト）
bun run db:push        # スキーマ同期
bun run db:generate    # マイグレーション生成
bun run db:migrate     # マイグレーション実行
bun run db:studio      # Drizzle Studio
```

## 本番デプロイ（Railway / GitHub auto-deploy）

```sh
cd packages/web && tsc -b && bun run build
git status --short                      # 変更ファイルを確認
git add <このタスクで変更したファイルを1つずつ列挙>   # git add -A は使わない
git commit -m "..."
git push              # ← オーナー操作。エージェントは実行しない（Railway が自動ビルド → bun src/server.ts で起動）
```

- Railway は `PORT` 環境変数（自動設定）を `process.env.PORT` 経由で受け取る（`server.ts` は `PORT ?? 3000`）
- `src/server.ts` が `Bun.serve` で静的ファイル配信 + API プロキシ + OGP インジェクションを担う
- 環境変数は Railway ダッシュボードで管理（`.env` は gitignored のままでよい）

### 完了の定義（必須ルール）

コード変更を伴うタスクは、リポジトリルートで **`bun run check`** と
**`bun run smoke`**（admin に触れた場合）の両方を通過してから完了報告する。
`push` は常にオーナーの手で行う — エージェントは実施しない。

- **Handoff 確認** — `task.md` の最新 Handoff と `git status --short` を確認。
- **`bun run check`** — `typecheck`(`tsc -b`。`tsc --noEmit` は0ファイル検査の罠) →
  `lint`(oxlint) → `test`(`bun test`) → `build`(`vite build`) を順に実行し、
  どれか失敗したら止まる。個別に確認したい場合は `bun run typecheck` /
  `bun run lint` / `bun run test` / `bun run build` を単独実行してもよい。
- **`bun run smoke`** — admin 画面(`/admin`)に触れる変更をした場合、
  `scripts/smoke/` の Playwright スモークスイートも実行する
  (詳細は「管理画面スモークテスト」節)。
- **git push** — オーナーが実施。Railway が自動デプロイし、数分後に本番が更新される。
- 報告では「local確認」「push」「Railway反映」「本番確認」を分けて書く。

```sh
bun run check
bun run smoke   # admin に触れた場合
```

## ルーティング

| パス                       | 説明                                                |
| -------------------------- | --------------------------------------------------- |
| `/`                        | トップ（ヒーロー写真 + 最新作品）                   |
| `/gallery`                 | ギャラリー（カテゴリフィルタ + マソンリーグリッド） |
| `/about` または `/profile` | プロフィール                                        |
| `/contact`                 | コンタクト                                          |
| `/admin/login`             | 管理ログイン                                        |
| `/admin`                   | 管理画面（写真管理・設定）                          |
| `/api/*`                   | Hono API                                            |
| `/api/images/:key?w=&q=`   | R2 画像プロキシ（オンザフライリサイズ）             |

## 管理画面

詳細仕様: `docs/specs/admin-enhancement-spec.md`

### 認証

- セッション Cookie (`admin_session`) で認証。`ADMIN_PASSWORD` 環境変数と照合。

### 既存タブ構成

| タブ          | 内容                                             |
| ------------- | ------------------------------------------------ |
| GalleryTab    | 写真一覧・アップロード・メタ編集・削除・並べ替え |
| HeroTab       | トップヒーロー写真の選択・並べ替え               |
| ProfileTab    | プロフィール写真・テキスト設定                   |
| CategoriesTab | カテゴリ管理・並べ替え                           |
| SettingsTab   | タイポグラフィ・色・フォント等のサイト設定       |

### 実装ルール（§0 必須）

- DB クエリは必ず `withRetry(() => db....)` でラップ
- データ更新後は `qc.invalidateQueries({ queryKey: [...] })` で再取得
- API / client のレスポンスは `assertOk()` で検証してから本文を読む
- HTML レスポンスは `Cache-Control: no-store`。`Content-Encoding` は手動設定せず Railway / upstream proxy に任せる
- **DB schema は2ファイル同期必須**（配布版の Railway/PostgreSQL 対応）。カラム追加・変更時は
  `schema.ts`（Turso/libSQL・本番）と `schema.postgres.ts`（PostgreSQL・配布版）の**両方**を
  同じカラム名で更新し（型は方言ごと: `integer({mode:"boolean"})`↔`boolean()`、
  `integer({mode:"timestamp"})`↔`timestamp()`）、`drizzle-kit generate` を両 config で再生成する。
  クエリは `./database`（`DATABASE_PROVIDER` 切替境界）から `schema` を import すること
  （`schema.ts` を直接 import しない）。PostgreSQL 側の更新漏れは配布版だけ壊し本番では気づけない。
  詳細は `DISTRIBUTION.md`「Schema is maintained in two files」。
- **新規 settingsキー追加時は以下4箇所を必ずセットで更新**:
  1. `packages/web/src/web/lib/settings-preview.ts` の `SETTINGS_PREVIEW_KEYS`
  2. API `GET /settings`（`packages/web/src/api/index.ts`）の default 値
  3. `provider.tsx` の DB適用 `useEffect`
  4. `provider.tsx` の `handlePreviewMessage`
- ライブプレビュー: 管理画面の iframe(`src="/"`) に `postMessage({ type: "preview-settings", settings })` を送信。受信は `provider.tsx` の `handlePreviewMessage`

### 管理画面スモークテスト

`scripts/smoke/` に Playwright スモークスイートがある（2026-07 のadmin全体デバッグ
で新設）。admin(`/admin`)のCSS/レイアウト/状態機械に触れた変更をしたら、
コミット前に実行する。

```sh
bun run smoke                          # 全スペック(desktop/mobile両方)
bun run smoke -- admin-scroll          # ファイル名でフィルタして実行
```

- 専用ポート(4310)で Vite を自動起動・終了する。手動 `bun run dev` と衝突しない。
- ログインは `.env` の `ADMIN_PASSWORD` を自動で使う（未設定だとエラーで停止）。
- タブの内容量に依存するテストは、オーバーフローが無ければ自動でskipする
  (データ依存の誤検知を避けるため。0件失敗でもskip件数は確認すること)。
- 新しいバグを直したら、同じ流儀(`scripts/smoke/helpers.ts` の
  `loginAsAdmin`/`gotoAdminTab` 等を再利用)で回帰テストを1件追加する。
- **本番と同じTurso DBに直接つながっている(ステージングDB分離なし)。** 新しいテストで
  Save/Delete/Add確定など実際にデータを書き込む操作をクリックしないこと。現状の全スペックは
  ログイン以外に非GETリクエストを発生させない設計(2026-07-05実測検証済み、
  `scratch/debug-2026-07/findings.md`「検証用DB分離」参照)。

### 仕様書（参照先）

| ファイル                               | 内容                                                                                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/admin-enhancement-spec.md` | 管理画面の現行仕様。写真の向き（90度回転）・見せる中心・写真ごとの調整幅・管理画面UX改善。旧P1〜P4/v2仕様は `docs/archive/` に保存                                                                                                 |
| `docs/specs/design-spec.md`            | デザイン（見た目・佇まい）の設計図。雑誌/写真集的な編集された佇まい・写真主役・余白主導。秋が S/M/L サイズ指定＋並べ替えでレイアウトを演出する仕組み（完全自由配置はしない、レスポンシブ自動対応）。色/タイポ/余白/動き/画質の原則 |
| `docs/specs/refine-and-loop-spec.md`   | 自走改善ループ運用方針。歴史的な運用文脈を含むため、実行前に現行方針と照合する                                                                                                                                                     |
| `docs/specs/spec-layout-expansion.md`  | レイアウト拡張仕様                                                                                                                                                                                                                 |

### 強化計画（旧 `docs/archive/admin-enhancement-spec.md`）

#### グループA: タイポグラフィ編集強化

| ID  | 内容                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | 字間（letter-spacing）コントロール — 5つの CSS 変数（`--hero-name-tracking` 等）を追加、`styles.css` のハードコード `tracking-[...]` を変数参照に置換。**まずヒーロー/ナビ/セクション見出し3箇所のみ** |
| A2  | 行間（line-height）コントロール — `--body-leading` / `--section-leading` 追加                                                                                                                          |
| A3  | フォントウェイト選択 — `--hero-name-weight` / `--body-weight`。選択肢はフォント定義から動的導出（固定リスト禁止）                                                                                      |
| A4  | モバイル縮小率 — `--mobile-scale`（0.6〜1.0、既定 0.78）を `@media (max-width: 768px)` で各サイズ変数に `calc` 適用。**優先度高（ヒーロー名はみ出し解消）**                                            |
| A5  | フォントフォールバック修正（既知バグ） — `GOOGLE_FONTS_JA/EN` を `{ param, category: "serif"\|"sans-serif", weights: number[] }` 型に変更し、category に応じてフォールバックを切替                     |
| A6  | フォントペアリングプリセット — ワンクリックで和英フォントを一括設定（Classic Mincho / Modern Serif / Quiet Sans / Editorial）                                                                          |
| A7  | プレビュー体験改善 — 任意プレビュー文字入力・読込中スピナー・ウェイト別プレビュー                                                                                                                      |
| A8  | カスタムフォントアップロードのバリデーション — 受理拡張子 `.woff2/.woff/.ttf/.otf`、2MB 上限、`alert()` 廃止→インラインエラー                                                                          |
| A9  | TypoControl 数値直接入力 — スライダーと双方向同期                                                                                                                                                      |
| A10 | Typography セクション再編 — Font Pairing / Hero / Navigation / Section Labels / Body / Footer / Mobile のグループ折りたたみ                                                                            |

#### グループB: 管理快適化

| ID  | 内容                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | 写真メタ保存フィードバック — `updatePhoto` 成功時に 1.5秒 "Saved" 表示                                                                                                                                      |
| B2  | 写真検索 — タイトル/meta/ファイル名でクライアント側フィルタ                                                                                                                                                 |
| B3  | **論理削除 + Undo（最重要）** — `photos.deletedAt` カラム追加（マイグレーション必要）。`DELETE` を論理削除に変更、`POST /restore`・`DELETE /purge` を新規追加。管理画面にゴミ箱ビューと Undo トーストを追加 |
| B4  | アップロード時 EXIF 自動補完 — `sharp().metadata()` から撮影日時を `meta` 初期値に設定（取得失敗時は空のまま）                                                                                              |
| B5  | 並び替え保存フィードバック — reorder 成功時にハイライトまたはトースト                                                                                                                                       |
| B6  | キーボードショートカット一覧 — `?` キーでモーダル表示                                                                                                                                                       |

### 実装フェーズ

| フェーズ | 項目                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| **P1**   | A5（フォールバック修正）/ A1（字間）/ A2（行間）/ B3（論理削除）               |
| **P2**   | A4（モバイル縮小）/ A7（プレビュー）/ B1（保存FB）/ B2（検索）                 |
| **P3**   | A6（ペアリング）/ A3（ウェイト）/ A10（セクション再編）/ B4（EXIF）            |
| **P4**   | A8（アップロード検証）/ A9（数値入力）/ B5（並び替えFB）/ B6（ショートカット） |

### B3 実装時の注意

```sh
cd packages/web && bun run db:push  # deletedAt カラム追加
```

既存写真の `deletedAt` は null のまま（表示維持）。公開 `GET /photos` と管理一覧の通常取得に `isNull(photos.deletedAt)` を追加する。

## CSS カスタムプロパティ（サイト設定 → ページ反映）

`site_settings` テーブルに保存した値は `provider.tsx` が CSS 変数としてルート要素に注入する。

主なキー: `--nav-opacity`, `--footer-opacity`, `--sns-opacity`, `--hero-name-size`, `--hero-name-color`, `--hero-name-en-size`, `--hero-name-en-color`, `--hero-sub-size`, `--hero-sub-color`, `--section-label-size`, `--section-label-opacity`, `--heading-size`

## コーディング規約

- コメントは WHY が非自明な場合のみ。WHAT は書かない
- 型付き API クライアント（`lib/api.ts`）を使う。`fetch` を直接呼ばない
- フロントエンドの DB 直接アクセス禁止。必ず `/api/*` 経由
- lint: `oxlint`（`bun run lint`）
- 型チェック: `bun run typecheck`

## 注意事項

- `ADMIN_PASSWORD` 未設定時はサーバ起動は続行するが管理ログインが無効になる（警告ログのみ）
- R2 への画像は `3200px / mozjpeg q92 / 4:4:4` に最適化してから保存。元のサイズは保存しない
- in-memory LRU キャッシュ（リサイズ済み 128MB + 元画像 48MB/60s TTL。正はコード `api/index.ts` の `RESIZE_CACHE_BYTES` / `ORIG_CACHE_BYTES`）でサムネイルをキャッシュ
- 写真の複製（O1）は同じ R2 オブジェクトを共有する。purge は他に参照が無い場合のみ R2 から削除
- OGP メタタグはサーバサイドで `index.html` に注入（60 秒 TTL キャッシュ）
- テンプレート由来の `packages/mobile/`・`packages/desktop/` は 2026-06 に削除済み（パッケージは `web` のみ）
- ギャラリーレイアウトは 12 種（mosaic / grid / scroll / stagger / editorial / collage / clean-grid / portrait-grid / landscape-grid / masonry / large-format / justified）。freeform / polaroid / timeline / fullbleed / compare は 2026-06 に削除。portrait-grid / landscape-grid は 2026-07-09、justified は 2026-07-12〜13 にオーナー承認の上で追加。未知の値は mosaic にフォールバック

## Shared Knowledge Wiki

`knowledge/wiki/` is an AI-maintained index/compression layer over this
repo's existing docs and code — it is **NOT the source of truth**. Canonical
sources (code, CLAUDE.md/AGENTS.md, task.md, other docs/specs) always win on
conflict; see `knowledge/WIKI_SCHEMA.md` for the full rules.

- At the start of a session, read `knowledge/wiki/index.md` plus whichever
  page(s) are relevant to the task at hand — not the whole wiki.
- After a task produces durable knowledge (an architecture decision, a
  discovered gotcha, a resolved contradiction), update the wiki in a
  **docs-only** commit prefixed `docs(wiki):`.
- Never mix wiki edits with implementation changes in the same commit or the
  same task.
- If a wiki page conflicts with a canonical source, fix the wiki (or log it
  in `knowledge/wiki/pages/open-issues.md`) — never "fix" the canonical
  source to match the wiki.

## Agent Ownership: 1 task = 1 Driver

Exactly one agent is the **Driver** for a given task — the Driver may edit
files, run commands, and commit. As of 2026-07-08 the roles are **fixed**:
Claude Code is the Driver, Codex is the read-only Reviewer (see 「役割分担」
above). Neither AI's underlying model is pinned — the model in use may change
session to session. **Push is always done by the owner's hand — agents never
push** (see 完了の定義). The Reviewer reads and comments, never edits.

- Two agents must never edit the same files concurrently.
- A Driver handoff requires an explicit handoff entry in `task.md`: current
  state, what's done, what remains, and any gotchas the next Driver needs.
- Scattered `*.handoff.md` files (e.g. sitting untracked at the repo root or
  next to a component) are **deprecated** going forward — use the `task.md`
  handoff entry instead.

## File Hygiene

- Root-level Markdown whitelist: `README.md`, `AGENTS.md`, `CLAUDE.md`, `DISTRIBUTION.md`, `task.md`.
- Any other new root-level `.md` file is a rule violation.
- Put active specs under `docs/specs/`, general docs under `docs/`, and temporary drafts under `scratch/`.
- Specs live in `docs/specs/`, one file per spec, updated in place.
- Version history lives in git; never encode it in filenames.
- Spec filenames with `-v2`, `-v3`, `-final`, or `-draft` are banned.
- Finished or retired docs move to `docs/archive/` via `git mv`.
- Do not plainly delete historical docs unless the owner explicitly approves deletion.
- Handoffs are `task.md` entries.
- Standalone `*.handoff.md` files are banned.
- Temporary prompts, drafts, and scratch scripts go in `scratch/`.
- `scratch/` contents are gitignored except `scratch/README.md`.
- Untracked files must be resolved within a few working sessions.
- Resolve untracked files by committing, gitignoring, archiving, moving to `scratch/`, or deleting with approval.
- Each task's Driver checks `git status` before finishing and reports any remaining unrelated dirty files.

## オーナー向け報告・質問のルール

- オーナー（秋）はプログラマーではない。最終報告やオーナー宛の質問はすべて平易な言葉で書き、専門用語が出てきたら一行で意味を説明する。
- オーナーに何かを質問するときは、必ず2〜3個の選択肢とそれぞれの長所・短所、そしておすすめの選択肢を添える。
