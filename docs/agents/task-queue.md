# Claude Code 向けタスクキュー

作成: 2026-07-08 (Fable5 最終セッション) / 管理者: 秋さん
使い方: **1セッション=1枚**。下の指示書を丸ごとコピーして Claude Code に貼る（使用モデルは固定しない。作業内容・利用可能性・残りクレジットに応じてその都度選ぶ）。
完了したら見出しに `✅ 済 (日付)` を付け、順序の入れ替え・追加は自由。

タグの意味:

- **[夜間ラン可]** 判断ポイントが無く、自律実行して朝に報告を読めばよい
- **[昼推奨]** 実行自体は自律で可だが、失敗時に早く気づける昼间が望ましい
- **[要オーナー判断]** 途中で「案を提示して停止」する。承認の返事が必要
- **[Codexレビュー必須]** commit 後、push 依頼の前に Codex の read-only レビューを挟む

共通の前提（全指示書に適用。個別記載は省略している）:

> あなたはこのタスクの唯一の Driver です。冒頭で Driver 宣言をすること。
> docs/agents/autonomy-rules.md・CLAUDE.md §0 Invariants・docs/checklists.md に従う。
> git push しない / 本番 DB・R2・Railway への書き込み禁止 / .env を読まない /
> 未pushコミットの rebase 禁止 / 同じ失敗3回でそのタスクを中断し「要相談」へ。
> コード変更時は `bun run check`、admin に触れたら `bun run smoke` を通してから完了報告。
> 決定ログは docs/agent-logs/YYYY-MM-DD.md、Handoff は task.md 末尾に追記。

---

## Q-1. withRetry の再試行条件を締める [昼推奨] [Codexレビュー必須] ✅ 済 (2026-07-13)

背景: docs/specs/audit-2026-07.md P1-1。drizzle-orm 0.45 が全クエリ失敗を
「Failed query: …」で包むため、`packages/web/src/api/database/libsql.ts` の
`withRetry` が全 DB エラーを一時的エラー扱いで3回再試行している。

やること:

1. `withRetry` の判定を「`err.cause`（drizzle が包む前の元エラー）を再帰的に見て、
   ECONNRESET / "socket connection was closed" のときだけ再試行」に変更する。
   `message.includes("Failed query")` の条件は削除する。
2. `withRetry.test.ts` に「DrizzleQueryError 形式（message=Failed query…, cause=ECONNRESET）
   は再試行される」「cause が制約違反なら再試行されない」のテストを追加。
3. 挙動変更はこの関数のみ。呼び出し側 145 箇所には触れない。

検証: `bun run check`。成果物: 上記2ファイルの変更 + 決定ログ + Handoff。
完了条件: テストで再試行/非再試行の両方が緑。commit して push はしない。
Codex への依頼文: 「libsql.ts withRetry の判定変更を read-only でレビュー。
再試行すべき通信断が漏れる方向の誤りが無いかを重点確認」。

## Q-2. 既存写真に壊れキーが無いかの点検（読み取りのみ） [夜間ラン可] ✅ 済 (2026-07-13)

背景: audit-2026-07.md P1-2。P0-1 修正（2026-07-08）以前にアップロードされた
写真のキーに `#` `?` `%` が含まれていると、その写真は表示されないまま。

やること:

1. `scripts/smoke/helpers.ts` の `loginAsAdmin` を再利用する Playwright スクリプトを
   `scratch/audit-keycheck/` に書き、`GET /api/photos?all=1` の JSON を取得する
   （読み取りのみ。書き込み API は一切呼ばない）。
2. 各行の `url` / `thumbKey` / `mediumKey` に `#` `?` `%` `&` を含むものを列挙する。
3. 該当ゼロなら「問題なし」と報告して終了。該当があれば **修復はせず**、
   件数・id・ファイル名を決定ログに書き、「複製→旧行をゴミ箱→purge で作り直す」
   手順案を添えて停止（修復は要オーナー承認。purge は復元不可のため）。

検証: コード変更なしのため check 不要。成果物: 決定ログに点検結果。

## Q-3. 設定保存を1トランザクションにする [昼推奨] [Codexレビュー必須] ✅ 済 (2026-07-13)

背景: audit-2026-07.md P2-1。`POST /admin/settings`（packages/web/src/api/index.ts）が
キーごとに逐次 upsert しており、途中失敗で部分反映になり得る。

やること:

1. 逐次ループを libsql の batch（または drizzle の transaction）で一括化する。
   事前バリデーション（サイズ上限）は現状のまま先に全件行う。
2. 既存の挙動（成功時 `{ok:true}` / 413 エラー文言）は変えない。
3. `DATABASE_PROVIDER=postgres`（配布版）でも同じコードが動くことを確認する
   （`./database` 経由の db を使い、libsql 固有 API に直接依存しない書き方を選ぶ。
   両立できない場合は実装せず「要相談」で停止）。

検証: `bun run check` + `bun run smoke`（settings 保存は admin 経路）。
Codex への依頼文: 「settings 一括化の差分を read-only でレビュー。
postgres 側でも壊れないか、部分反映が本当に無くなるかを重点確認」。

## Q-4. ヒーロー/プロフィール画像差し替え時の旧ファイル掃除 [昼推奨] [要オーナー判断] [Codexレビュー必須] 🔎 調査完了・案A/B提示 (2026-07-13)、実装はオーナー判断待ち

背景: audit-2026-07.md P2-2。差し替えのたびに旧オブジェクトが R2 に残る。

やること:

1. まず調査だけ行う: `/admin/hero/upload` と `/admin/profile/upload` の呼び出し元、
   旧値（settings の heroPhotoUrl / profilePhotoUrl）の形式、photos 行と共有され得るか。
2. 削除の設計案を2つ（例: A=保存時に旧キーを削除、B=削除せず「未参照 hero/profile/
   オブジェクトの棚卸し」管理エンドポイントを追加）を、メリット・デメリット付きで
   決定ログに書き、**実装せずに停止**する。
3. オーナーが案を選んだら、次のセッションで実装する（別チケット扱い）。

理由: ストレージの削除は取り返しがつかないため、方式は必ずオーナーが選ぶ。
成果物: 調査メモ+2案（決定ログ）。コード変更なし。

## Q-5. /admin/settings のキー許可リスト [Codexレビュー必須] ✅ 済 (2026-07-13、Codex統合レビューは最後に1回)

背景: audit-2026-07.md P2-3。任意のキー名が保存できてしまう。

やること:

1. 保存を許可するキー集合を定義する。出発点は `SETTINGS_PREVIEW_KEYS`（143キー台帳、
   packages/web/src/web/lib/settings-preview.ts）。
2. **先に**リポジトリ全体を grep し、台帳に無いのに保存されるキーが無いか洗う
   （見つけたら台帳へ追加し、§0 の4箇所同期を守る）。
3. `POST /admin/settings` で許可リスト外のキーは無視（400 にはしない。既存クライアント
   との互換のため、無視したキー名をレスポンスに含めて可視化する）。
4. テスト: 許可キーは保存される / 未知キーは保存されない、の2本を追加。

検証: `bun run check` + `bun run smoke`。
Codex への依頼文: 「settings キー許可リストの差分をレビュー。正当キーの
取りこぼし（保存が黙って効かなくなる方向）が無いかを重点確認」。

## Q-6. 画像パイプラインの小修正2件 [夜間ラン可] ✅ 済 (2026-07-13)

背景: audit-2026-07.md P2-5 / P2-6。いずれも `packages/web/src/api/index.ts`。

やること:

1. `POST /admin/generate-thumbnails` 内の `s3.send(new GetObjectCommand(...))` に、
   `getOriginal` と同じ `AbortSignal.timeout(ORIGINAL_FETCH_TIMEOUT_MS)` を付ける。
   リトライは不要（この経路は failed カウントで再実行できるため）。
2. `/images/*` の 304 レスポンス（if-none-match 一致時）に、200 と同じ条件で
   `Vary: Accept` ヘッダを付ける（`fmt` クエリ指定なしの場合のみ）。

検証: `bun run check`。可能なら dev サーバで 304 のヘッダを curl 確認。
成果物: 差分 + 決定ログ + Handoff。

## Q-7. 公開ページの text-xs をトークンに統一（約30箇所） [夜間ラン可] ✅ 済 (2026-07-13、28箇所中2箇所を置換・26箇所は決定ログに理由付きで据え置き)

背景: 公開側ページに Tailwind の固定サイズ `text-xs` が残っており、管理画面の
タイポグラフィ設定（--section-label-size 等の CSS 変数）に追従しない。
対象ファイル: SeriesGrid.tsx / series-detail.tsx / gallery.tsx / profile.tsx /
contact.tsx / service.tsx / service-start.tsx（**admin-login.tsx は対象外** — 管理画面側）。

やること:

1. 全 `text-xs` を列挙し、各箇所の「役割」を判定する:
   セクション見出し → `var(--section-label-size, 0.75rem)` /
   フッター類 → `var(--footer-size, 0.75rem)` /
   写真メタ・キャプション等どのトークンにも属さない → `var(--body-size, 0.75rem)` は
   既定14px系のため**使わない**。`0.75rem` を直書きの `style` にするのではなく、
   その箇所は text-xs のまま残して決定ログに列挙する。
2. 置換は見た目が1pxも変わらないこと（既定値 0.75rem を明示 fallback に置く）。
3. 迷った箇所は変更せずリストに残す（夜間ランなので停止はしない）。

検証: `bun run check`（render テスト含む）。可能なら主要ページのスクショ before/after を
`scratch/` に保存。成果物: 差分 + 「置換した箇所/残した箇所」の一覧（決定ログ）。

## Q-8〜Q-10 — オーナー判断待ちアイデアノートへ移設 (2026-07-13)

Contact フォームラベルの日本語化 / footerCtaLabel・About→Gallery 導線 /
Lightbox キャプションの佇まい2案モック の3件は、いずれも「オーナーが案を選ぶまで
実装しない」性質のため、active queue から`docs/agents/pending-owner-decisions.md`
へ移設した（実装・調査は未着手。移設のみ）。オーナーが案を選んだら、その回だけ
このファイルに具体的な指示書として書き戻す。

---

## 運用メモ

- 新しいタスクを足すときも上の書式（背景/やること/検証/成果物+タグ）を踏襲する。
- P0 級（放置すると実害）を見つけたセッションは、このキューより優先して
  修正してよい（autonomy-rules の完了の定義に従う）。
- キューが空になったら docs/specs/refine-and-loop-spec.md の自走改善ループに戻る。
