# 高リスク領域チェックリスト

> 2026-07-06 作成（Fable5 改革 / docs/specs/ai-collaboration-reform-fable5.md の成果物）。
> 失敗時の影響が大きい5領域について、作業前・作業後に機械的になぞれる検査表。
> ルールの正本は CLAUDE.md / AGENTS.md §0。ここは「実行手順に落とした版」であり、矛盾したら正本が勝つ。

## 使い方

- 該当領域に触る前に、その節の「着手前」を確認する。
- 完了報告の前に「完了前」を上から順に実行する。チェックできない項目が残るなら、Handoff の「検証していないこと」に書く。

---

## 1. Settings（サイト設定キー）

**着手前**

- [ ] 追加・変更するキーが既存キーと重複していないか `lib/settings-preview.ts` で確認した
- [ ] ライブプレビュー（admin の iframe）と DB 適用の両経路に効く変更だと理解している

**完了前（4箇所同期 — §0）**

- [ ] `packages/web/src/web/lib/settings-preview.ts` の `SETTINGS_PREVIEW_KEYS` 台帳に追加した
- [ ] API `GET /settings`（`packages/web/src/api/index.ts`）の default 値に追加した
- [ ] `provider.tsx` の DB 適用 `useEffect` に追加した
- [ ] `provider.tsx` の `handlePreviewMessage` に追加した
- [ ] 空値（""）のとき DB 適用とプレビューが同じ見た目に戻ることを確認した（プレビュー独自 default を作らない）
- [ ] `bun run check` 成功、admin に触れたので `bun run smoke` も成功

## 2. DB スキーマ

**着手前**

- [ ] 変更は追加のみか？ 既存カラムの削除・rename・型変更は Turso リモートに対して行わない（§0 / db-migrations ルール）
- [ ] 既存マイグレーション `.sql` を編集・削除しない（append-only）

**完了前（2ファイル同期 — §0）**

- [ ] `schema.ts`（Turso/libSQL・本番）を更新した
- [ ] `schema.postgres.ts`（PostgreSQL・配布版）を**同じカラム名**で更新した（型は方言ごと: `integer({mode:"boolean"})`↔`boolean()`、`integer({mode:"timestamp"})`↔`timestamp()`）
- [ ] `drizzle-kit generate` を両 config で再生成した（`cd packages/web` してから。DISTRIBUTION.md 参照）
- [ ] クエリは `./database` 経由の `schema` import を使っている（`schema.ts` 直接 import 禁止）
- [ ] 新しいクエリは `withRetry(() => db....)` でラップした
- [ ] `withRetry` 本体（libsql.ts）の再試行条件を弱めたり広げたりしていない（変更するなら Codex レビュー必須 — 2026-07 監査 P1-1 参照）
- [ ] `db:push` / `db:migrate` はオーナーの直接依頼がある場合だけ実行する。直接依頼がない場合は実行せず、必要性・対象DB・想定される影響だけを報告する
- [ ] 直接依頼を受けた場合の適用は `cd packages/web && bun run db:push`（本番と同じ DB に効くことを理解した上で）

## 3. 画像パイプライン（R2 / sharp / 配信）

**着手前**

- [ ] 保存形式の正: master は 3200px / mozjpeg q92 / 4:4:4 JPEG。配信用 WebP 派生は thumb 640px / medium 1920px（`thumbKey` / `mediumKey`）
- [ ] キャッシュの正はコード: `api/index.ts` の `RESIZE_CACHE_BYTES`（現在 128MB）/ `ORIG_CACHE_BYTES`（現在 48MB, 60s TTL）。ドキュメントの数値を鵜呑みにしない

**完了前**

- [ ] アップロードの保存キーに `file.name` を直接使っていない（必ず `sanitizeUploadBaseName()` 経由。`#` `?` `%` 入りファイル名で画像が永遠に404になる — 2026-07 監査 P0-1）
- [ ] `Content-Encoding` を手動設定していない（§0。Railway プロキシが処理、違反すると二重圧縮）
- [ ] R2 のキー・秘密情報をコードにハードコードしていない（`process.env.S3_*`）
- [ ] 複製写真は R2 オブジェクト共有 — purge の挙動（他参照なしのときのみ削除）を壊していない
- [ ] リサイズ経路を変えた場合、キャッシュキーに新パラメータを含めた
- [ ] 既存写真（実データ）でサムネイル・Lightbox・OGP の表示を確認した

## 4. Admin UI（管理画面）

**着手前**

- [ ] `git status --short` と `docs/archive/task-handoffs.md` の最新 Handoff を確認し、未コミットの admin 作業を踏まないと確認した
- [ ] スタイルを足す場合、セレクタが `.admin-screen` / `.admin-atelier` 等の admin スコープ内にあり、公開サイトへ漏れない

**完了前**

- [ ] 書き込み API 呼び出しは本文を読む前に検証している。合格条件の正本は
      `AGENTS.md`「製品コードの不変条件」（admin 配下の新規・変更箇所は 401
      リダイレクトを含む `admin-shared.ts` 側、settings 保存は `postAdminSettings()` 経由）
- [ ] 新しい書き込み処理には、応答検証に加えて `onError` または try/catch による
      利用者へ見えるエラー表示がある（正本: `AGENTS.md`「製品コードの不変条件」）
- [ ] データ更新後は `qc.invalidateQueries({ queryKey: [...] })` している（§0）
- [ ] `fetch` 直接呼びを追加していない（`lib/api.ts` の型付きクライアント経由）
- [ ] `bun run check` 成功
- [ ] `bun run smoke` 成功（admin 必須ゲート。**本番と同じ DB に接続** — 新しいテストで Save/Delete/Add 確定など書き込み操作をクリックしない。0 fail でも skip 件数を確認）
- [ ] 新しいバグを直した場合、`scripts/smoke/` に回帰テストを1件追加した（`helpers.ts` の `loginAsAdmin`/`gotoAdminTab` を再利用）
- [ ] 既存テストの期待値を変えた場合、それが仕様変更への正当な追随であることを決定ログに書いた（実測合わせの緑化は禁止。現役の正本は `AGENTS.md`「製品コードの不変条件」）
- [ ] グローバルなキーボードショートカットを追加した場合、`dialog[open]` ガード（admin.tsx のグリッド keydown 参照）を通している

## 5. Railway デプロイ + 本番確認

**着手前**

- [ ] push = 本番デプロイだと理解している（GitHub auto-deploy）。**push は常にオーナーの手で行う — エージェントは実施しない**
- [ ] 環境変数の追加・変更は Railway ダッシュボードで行う（`.env` は gitignored、エージェントは読まない・編集しない）

**push 前（オーナーへの依頼前）**

- [ ] `bun run check` 成功（admin に触れたなら `bun run smoke` も）
- [ ] `git status --short` がクリーン（未コミット・未追跡ファイルが残っていない、または Handoff に明記した）
- [ ] `git log origin/main..main --oneline` で push される commit 一覧を確認し、Handoff・報告に含めた

**push 後（本番確認 — 「push した」と「本番で確認した」は別物）**

- [ ] 数分待って `curl -sI https://akieguchi.com/ | grep -i x-build` の commit hash が push したものと一致する
- [ ] トップ / ギャラリー / 管理ログイン画面を実際に開いて表示を確認した
- [ ] 報告では「local 確認」「push」「Railway 反映」「本番確認」を分けて書いた
