# アップロード時のメタデータ抽出 — 実装計画

> # ⚠️ 起きたら最初に読んでください
>
> **単位3〜7を実装した結果、いまのコードは本番DBに7列が無いと動きません。**
> `bun run smoke` も、ローカルの `bun run dev` も、写真の取得で500になります。
> 実際に再現して原因を確認済み（`no such column: shot_at_source`）。
>
> 理由は、Drizzleの `db.select()` が「全列を名指しするSQL」を作るためです。
> 一覧だけでなく、トップのヒーロー写真や写真1枚の取得も同じように止まります。
>
> ## やること — 移行を先に当てるだけ
>
> ```bash
> bun run db:push
> ```
>
> **この移行は「列を7つ足すだけ」で、いま動いている本番サイトには影響しません。**
> 古いコードはこれらの列を読まず、書き込み時も既定値が入るためです。
> だから**コードをpushする前でも、いつ当てても安全**です。
>
> 実行前に「これから流すSQL」が表示されます。
> **`ADD COLUMN` 7本以外が出たら中止してください。**
> 特に `DROP`・`CREATE TABLE`・データ移動が出た場合は流さないこと。
> 照合用に `packages/web/drizzle/0005_mysterious_madame_masque.sql` を用意しています。
>
> 当てた後は `bun run smoke` が通るようになります。

**実装前の設計。この文書の時点で製品コードは1行も変えていない。**

今回やること: **元画像を捨てる前に、後から取れなくなる情報だけを抜き取って保存する。**

今回やらないこと: 元画像・RAWの保存、GPS、画像解析（色・明るさ・鮮鋭度）、
キーワード機能、抽出した値を画面に出すこと、push、deploy。

---

# 1. 最小追加項目の最終案

## 追加する列 — 7つ

| 列名（DB） | 型 | NULL | 既定値 |
|---|---|---|---|
| `shot_at_source` | text | 不可 | `'legacy'` |
| `shot_at_digitized` | text | 可 | NULL |
| `source_width` | integer | 可 | NULL |
| `source_height` | integer | 可 | NULL |
| `source_format` | text | 可 | NULL |
| `camera_make` | text | 可 | NULL |
| `camera_model` | text | 可 | NULL |

`shot_at_source` の取りうる値:

| 値 | 意味 |
|---|---|
| `exif_original` | EXIF の `DateTimeOriginal`（無ければ `Image.DateTime`）。デジタル |
| `exif_digitized` | EXIF の `DateTimeDigitized`。フィルム＝**スキャンした日時** |
| `file_modified` | 元ファイルの更新日時。フィルムでEXIFが無かった場合 |
| `manual` | 人が画面で入力・修正した |
| `none` | 撮影日時が無い。デジタルでEXIFが読めなかった場合 |
| `legacy` | この仕組みより前に登録された。出どころ不明 |

## 一覧に載せる／載せない

| 列 | `GET /photos` に載せるか | 理由 |
|---|---|---|
| `shot_at_source` | **載せる** | 束の計算と「日時が信用できない写真」の絞り込みで、一覧側が直接使う |
| 他の6列 | **載せない** | 一覧の検索・並べ替え・グループ化のどれにも使わない |

**今回は詳細取得APIも作らない。** 6列は保存するが、まだどこにも表示しない。
表示する画面ができたときに、その画面が必要とする形で取りに行く口を作る。
使う相手がいないAPIを先に作らない。

## 元ファイル容量 — **保存しない**

検索・並べ替えに使うかを確認した結果:

- 配信されるのは3200pxのJPEGなので、**元の容量はサイトの表示にも運用にも影響しない**。
  「重い写真を探す」という操作が成り立たない
- 詳細としても、`source_width` / `source_height` / `source_format` で
  「元が何だったか」はすでに分かる。容量が追加で答えるのは圧縮率だけで、
  整理のどの操作にもつながらない

## 元ファイル更新日時 — **保存しない**

- 検索・並べ替えに使わない
- **情報としても失われない**。フィルムでEXIFの日時が無い場合、
  更新日時は**そのまま `shot_at` になる**（`packages/web/src/web/lib/upload-date.ts:24-30`）。
  その場合 `shot_at_source = 'file_modified'` が残るので、
  「この日時はファイル更新日時である」と後から分かる
- EXIFの日時がある場合の更新日時は「PCにコピーした日」でしかなく、整理に使えない

---

# 2. 各項目を何に使うか

| 列 | 使いみち | いつ使う |
|---|---|---|
| **`shot_at_source`** | ① 自動の束（B-1）で、日時が信用できる写真だけを対象にする<br>② 「日時がスキャン時刻の写真」を絞り込む<br>③ 詳細で「この日時はスキャン日時です」と伝える | ①②は近い将来 |
| **`shot_at_digitized`** | フィルムを「スキャンした回」でまとめる。実測でフィルム279枚中121枚が同一時刻＝1回のスキャン | 後 |
| **`source_width` / `source_height`** | 元がどれだけ大きかったか＝どの機材由来かの手がかり。詳細で見る | 後 |
| **`source_format`** | HEIC由来かJPEG由来か。詳細で見る | 後 |
| **`camera_make` / `camera_model`** | メーカー単位・機種単位でのグループ化。いまの `camera` は連結済み文字列で分解できない | 後 |

**7つのうち、近い将来に使うのは `shot_at_source` だけ。**
残り6つは「いま抜かないと二度と取れない」から保存する。

---

# 3. schema と API の変更範囲

## 変更するファイル

| ファイル | 変更 |
|---|---|
| `packages/web/src/api/database/schema.ts` | 7列を追加 |
| `packages/web/src/api/database/schema.postgres.ts` | **同じ7列を同期**（`AGENTS.md` の不変条件） |
| `packages/web/drizzle/00XX_*.sql` | `db:generate` が生成。**流さない** |
| `packages/web/src/api/index.ts` | 一覧の列指定 / 抽出 / 保存 / 更新時の出どころ |
| `packages/web/src/web/lib/upload-date.ts` | 日時と一緒に「出どころ」を返す |
| `packages/web/src/web/pages/admin.tsx` | アップロード応答の受け渡し |

## API の変更

### `POST /admin/upload`（応答に追加）

いま既に手元にあるのに捨てている値を返すようにする。

```
sourceWidth, sourceHeight, sourceFormat   ← sharp(inputBuf).metadata() から
                                             （いまは { exif } だけ取り出している）
exifDateDigitized                          ← すでに返している（保存していないだけ）
exifMake, exifModel                        ← いまは連結して camera にしている
```

**追加のEXIF読み取りは要らない。** `sharp(inputBuf).metadata()` は既に呼んでおり、
`exifReader(exif)` も既に走っている。取り出していないだけ。

### `POST /admin/photos`（受け取りに追加）

7列ぶんを受け取って保存する。値が無ければ既定値。

### `PATCH /admin/photos/:id` と一括操作（出どころの更新）

`shot_at` を書き換える経路が3つある。どれも `shot_at_source` を合わせて更新する。

| 場所 | 現在 | 追加 |
|---|---|---|
| `index.ts:1746` PATCH | `shotAt` を更新 | 値が変わったら `shot_at_source = 'manual'` |
| `index.ts:2011` `shotAt_missing_only` | 日時が空の写真へ一括設定 | 同じ行へ `'manual'` |
| `index.ts:2030` `shotAt_clear` | 日時を消す | `'none'` |

**これを入れないと、手で直した日時が `exif_digitized` のままになり、
「スキャン時刻だから信用しない」と誤って扱われる。** 抽出と同じくらい重要。

### `GET /photos` ほか（列を明示する）

いまは `db.select()` で全列を返しているため、**列を足した瞬間に一覧へ載る**。
写真を多数返すのは次の3か所:

| 場所 | 何を返すか |
|---|---|
| `index.ts:1331` `GET /photos` | 管理画面は496枚・全列。公開は最大60枚 |
| `index.ts:1911` `GET /admin/photos/trash` | 削除済み |
| `index.ts:2306` `GET /series/:slug` | 公開・シリーズ内の写真 |

共通の「一覧が返す列」を1か所に定義し、この3か所で使う。
**最初に入れる時点では、出力は今と1バイトも変えない。**

1枚だけ返す場所（`:417`、`:1790`、`:2510` の hero）は行数が少ないので触らない。

---

# 4. 既存496枚の既定値

| 列 | 既定値 |
|---|---|
| `shot_at_source` | **`'legacy'`** |
| 他の6列 | NULL |

`shot_at_source` は「NOT NULL・既定値 `'legacy'`」にする。
`ALTER TABLE ... ADD COLUMN ... DEFAULT 'legacy' NOT NULL` がそのまま既存行を埋めるので、
**別途の書き込み作業は要らない。**

## `legacy` と `unknown` を分ける理由

- **`legacy`** = この仕組みより前に登録された。**そもそも記録していなかった**
- **`none`** = 仕組みが動いた上で、撮影日時が無かった

両方を「不明」で潰すと、「昔の写真だから分からない」のか
「新しい写真なのに読めなかった」のかが区別できなくなる。
後者は不具合の可能性があり、前者は仕様。混ぜない。

---

# 5. 新旧写真を同じ画面で安全に扱う方法

**既存496枚すべてが `legacy` になる。** これを前提に決めておくこと。

| 決め事 | 理由 |
|---|---|
| **`legacy` に警告を出さない** | 496枚すべてに警告が並ぶ。「不明」を大書すると画面が壊れる |
| 詳細で出どころを表示するなら、**`legacy` は空欄** | 「不明です」と書くより何も書かないほうが正しい |
| 「日時が信用できない」の絞り込みは **`exif_digitized` と `file_modified` だけ**を対象にする | `legacy` を含めると既存全部が引っかかり、絞り込みの意味が無い |
| 束の計算（`photo-band.ts`）は `shot_at_source` を**必須にしない** | 渡されなければ今と同じ挙動。B-1 の戻り値の形は変えない |
| 束が出どころを使うようになっても、`legacy` は**除外しない** | 496枚が束から消える。`legacy` は「信用できない」ではなく「不明」 |
| `camera` 列はそのまま残す | 既存496枚には連結済み文字列しかない。新旧で表示が割れないよう、表示は `camera` を使い続ける |

**言い換えると、`legacy` は「今までどおり扱う」という意味にする。**
新しい列は、値が入っている写真に対してだけ追加の判断材料になる。

---

# 6. `GET /photos` の転送量への影響

496枚・25列＋派生2つの応答を、実データの傾向（フィルム56%、カメラ数種、
タイトルと説明の多くが空）を再現した人工データで見積もった。**本番データは使っていない。**

| | 生 | gzip後 | gzip後の増分 |
|---|---|---|---|
| 現状 | 392KB | 51KB | — |
| **`shot_at_source` だけ追加** | 407KB | 51KB | **+448B（+0.9%）** |
| （参考）7列すべて追加した場合 | 476KB | 55KB | +4.3KB（+8.5%） |

`shot_at_source` は値の種類が6つしかないので、gzipがほぼ潰す。
**一覧へ載せるのはこれ1つだけにすれば、増分は1%未満。**

7列すべてを載せると8.5%増える。だから載せない。

> 応答の圧縮はRailway側が行う。アプリで `Content-Encoding` を触ってはいけない
> （`AGENTS.md` の不変条件）。

---

# 7. migration と元へ戻す方法

## 進めかた

1. `schema.ts` と `schema.postgres.ts` を同期して編集 — **完了**
2. `bun run db:generate` で migration SQL を生成 — **完了**
   （`drizzle/0005_mysterious_madame_masque.sql`）
3. 生成SQLが `ALTER TABLE photos ADD COLUMN` 7本だけであることを確認 — **完了**
4. ローカルのメモリDBへ実際に適用し、7列が付き、古い形のINSERTでも
   `shot_at_source='legacy'` が入ることを確認 — **完了**
5. **本番へ流すのはオーナーだけ**

## ⚠️ 適用前に必ず確認すること（調査で判明）

**このリポジトリの migration の履歴は最初から欠けている。**

- `drizzle/meta/_journal.json` は `0001_flawless_the_stranger` を含むが、
  **そのSQLファイルは存在しない**。最初のcommitの時点で既に無い
- そのため migration ファイルだけを順に流しても、`photos` は25列にしかならない。
  実際の schema には36列ある（`camera` / `lens` / `film_type` / `shot_at` /
  `display_size` / `is_published` / `series_id` / `width` / `height` /
  `file_hash` / `deleted_at` の11列が migration に無い）
- つまり、この機能は過去に `db:push` で本番へ適用されてきた

### 何を実行すべきか

**`bun run db:migrate` は使わないほうがよい。** 本番DBの `__drizzle_migrations`
に 0000〜0004 が記録されていなければ、`0000`（CREATE TABLE）から流そうとして失敗する。
記録されているかは本番を見ないと分からない。

**推奨は `bun run db:push`。** 本番の実際のschemaと `schema.ts` を比べ、
差分だけを流す。今回は列の追加7本だけなので、生成された `0005` と同じ
`ALTER TABLE ... ADD COLUMN` になるはず。

> **オーナーへ**: `db:push` は実行前に「これから流すSQL」を表示する。
> **7本の `ADD COLUMN` 以外が出たら中止してください。**
> 特に `DROP`・`CREATE TABLE`・データ移動が出た場合は流さないこと。

`0005` のSQLファイルは、実際に流す内容の**照合用**として使う。

> **重要**: `drizzle.config.ts` は `DATABASE_URL` を見ており、これは本番のTursoを指す。
> `db:push` と `db:migrate` は**本番DBに直接当たる**。
> Claude / Codex は実行しない。生成までで止める。

## 期待するSQLの形

```sql
ALTER TABLE `photos` ADD `shot_at_source` text DEFAULT 'legacy' NOT NULL;
ALTER TABLE `photos` ADD `shot_at_digitized` text;
ALTER TABLE `photos` ADD `source_width` integer;
ALTER TABLE `photos` ADD `source_height` integer;
ALTER TABLE `photos` ADD `source_format` text;
ALTER TABLE `photos` ADD `camera_make` text;
ALTER TABLE `photos` ADD `camera_model` text;
```

既存の `drizzle/0004_flowery_bloodstorm.sql` と同じ形。
**テーブルの作り直しが入っていたら止める**（データ移動が起きるため）。

## 元へ戻す方法

**コードだけ戻せば動く。** 列を消す必要はない。

- `shot_at_source` は既定値つきなので、古いコードの INSERT でも値が入る
- 他の6列は NULL 可なので、古いコードの INSERT でも通る
- つまり **列が残ったまま古いコードに戻しても壊れない**

列まで消したい場合は、SQLite 3.35以降の `ALTER TABLE photos DROP COLUMN` が使える
（Tursoは対応）。ただし**入れた値は消える**ので、戻す理由が「不具合」なら
まずコードだけ戻して様子を見る。

commit を分けておけば、`git revert` で各段階を個別に戻せる。

---

# 8. Codex へ渡す実装単位

依存順。**各単位で1コミット。push しない。**

| # | 単位 | 触るもの | 依存 |
|---|---|---|---|
| **1** | 日時の決定を「値＋出どころ」を返す形にする（純関数） | `lib/upload-date.ts` とそのテスト | なし |
| **2** | **一覧が返す列を明示する。出力は今と完全に同じ** | `api/index.ts` の3か所 | なし |
| **3** | schema に7列追加＋migration生成 | `schema.ts` / `schema.postgres.ts` / `drizzle/` | **2の後**（先だと列が一覧へ漏れる） |
| **4** | アップロードAPIが寸法・形式・Make/Model・DateTimeDigitized を返す | `api/index.ts` の upload | 3 |
| **5** | 画面が受け渡し、`POST /admin/photos` が保存する | `admin.tsx` / `api/index.ts` | 1, 4 |
| **6** | 日時を人が変える3経路で出どころを更新する | `api/index.ts` の PATCH と一括操作 | 3 |
| **7** | `shot_at_source` だけを一覧の列に加える | 2で作った列定義 | 5, 6 |

**2 を 3 より先に入れるのが要点。** 逆にすると、列を足した瞬間に
7項目すべてが一覧へ載って転送量が8.5%増える。

1 と 2 は互いに独立なので、どちらから始めてもよい。

## 各単位に必ず伝える禁止事項

- `bun run db:push` / `db:migrate` を実行しない（本番DBに当たる）
- 実写真をアップロードしない
- GPS・画像解析・キーワードに手を出さない
- 抽出した値を画面に表示しない（今回は保存だけ）
- `camera` 列の既存の使われ方を変えない
- push / deploy しない

---

# 9. 完了条件とテスト方法

| # | 完了条件 | テスト |
|---|---|---|
| 1 | 日時と出どころが対で返る | 純関数のテスト。デジタル（EXIFあり/なし）、フィルム（DateTimeDigitizedあり/なし）、`none` になる場合。既存 `upload-date.test.ts` を拡張 |
| 2 | **応答のキー集合が今と完全に同じ** | 一覧が返す1行のキー一覧を固定するテスト。以後、列を足しても勝手に載らない |
| 3 | `bun run check` 緑 / 生成SQLが `ADD COLUMN` のみ | SQLは目視。`schema.ts` と `schema.postgres.ts` の列が一致することをテストで確認 |
| 4 | 応答に5項目が増える | 応答の組み立てを純関数へ出してテスト。**実画像は使わない** |
| 5 | 受け取った値が保存される | 受け取り→保存の対応づけのテスト（既存 `photo-integrity-wiring.test.ts` の流儀） |
| 6 | 3経路すべてで出どころが変わる | 経路ごとにテスト。`shotAt_clear` は `'none'` |
| 7 | 一覧に `shot_at_source` が1つだけ増える | 2のキー集合テストを1項目ぶん更新 |

**共通の完了条件**

- `bun run check` が緑（現在 525 pass / 0 fail）
- `bun run smoke` が緑（現在 51 passed / 0 failed / 40 skipped。**件数は実行ごとに変わる**）
- 実アップロードなし。本番DBへの書き込みなし。migrationを流さない
- `git status --short` を確認してから、その単位のファイルだけを commit

**確認できないこと（正直に分けて報告する）**

- 実際のEXIFを持つ写真での抽出結果 — オーナーが1枚アップロードして確かめる必要がある
- 本番DBへのmigration適用 — オーナーだけ

---

# 10. 新管理ビュー試作との衝突

**ほぼ無い。触る場所が違う。**

| | この抽出作業 | Finder型ビューの試作 |
|---|---|---|
| 触る場所 | アップロード経路 / DB schema / 一覧の**列指定** | 表示（グループ化と表示形式） |
| `admin.tsx` | アップロード応答の受け渡しだけ | 新しいタブ（既存Libraryに触れない） |
| `photo-band.ts` | 触らない | 触らない（グループ化の1種類として呼ぶだけ） |
| `virtual-sections.ts` | 触らない | 使う |

**唯一重なるのが単位2（一覧の列指定）。**
試作が新しい列を欲しがったら、そこへ足すことになる。
つまり **単位2は先に入れておくほうが、試作もやりやすい。**

**B-1 / B-2 への影響**

- B-1 の `photo-band.ts` は `shot_at_source` を**必須にしない**ので、戻り値の形も
  テストも変わらない。将来「日時が信用できる写真だけ」を渡したくなったら、
  呼び出し側で絞ってから渡せばよい
- B-2 の `virtual-sections.ts` は写真の中身を見ないので無関係

**同時に進めてよい。** ただし同じworktreeを2人で編集しないこと。

---

# 11. 積み残しとして残すもの

今回入れないと決めたが、忘れないよう記録する。

| 項目 | 扱い |
|---|---|
| `OffsetTimeOriginal`（タイムゾーン） | 後回し。**取らない分は永久に欠ける** |
| `SubSecTimeOriginal`（連写の順序） | 同上 |
| `FocalLengthIn35mmFilm` | 同上 |
| カメラ内の評価（`Image.Rating`） | 同上 |
| IPTC / XMP のキーワード | 同上 |
| GPS | **今回は読み取りも保存もしない。** 将来やるなら、明示的な有効化・公開APIからの除外・削除方法を設計してから |
| 色・明るさ・鮮鋭度 | 保存済み画像から後で計算できるので、急がない |
| 詳細取得API | 6列を表示する画面ができたときに、その画面に合わせて作る |
| 元ファイル容量・更新日時 | **保存しないと決定**（1章参照） |

---

## 関連

- `docs/specs/photo-metadata-extraction.md` — 何が抜けているかの調査
- `docs/specs/library-finder-investigation.md` — Finder型ビューの3案
- `docs/specs/library-band-decisions.md` — 束機能の判断

---

# 12. 確定仕様（2026-07-28 オーナー承認）

**実装はこの節に従う。この節と上の記述が食い違う場合は、この節を正とする。**

## S1. `shotAtSource`

### 値の決め方（新規アップロード）

| 媒体 | EXIFの状態 | `shotAt` | `shotAtSource` |
|---|---|---|---|
| デジタル | `DateTimeOriginal` あり | その値 | `exif_original` |
| デジタル | `Image.DateTime` のみあり | その値 | `exif_original` |
| デジタル | どちらも無い / EXIFが読めない | 空 | **`none`** |
| フィルム | `DateTimeDigitized` あり | その値 | `exif_digitized` |
| フィルム | `DateTimeDigitized` 無し | ファイル更新日時 | `file_modified` |

### 人が操作した場合

| 操作 | `shotAt` | `shotAtSource` |
|---|---|---|
| 詳細欄で日時を設定・変更した | 入力値 | `manual` |
| 一括で「日時が空の写真」へ設定した | 指定日 | `manual` |
| 日時をクリアした | **null** | **`none`** |

### 最重要の不変条件

> **`'legacy'` はコードのどこからも書き込まない。**
> DBの列の既定値としてのみ存在し、「この仕組みより前に登録された行」だけが持つ。

新規アップロードの処理が失敗しても `legacy` へ逃がさない。
EXIFが読めない・壊れている場合は `none`（デジタル）または `file_modified`（フィルム）。
**この1点をテストで固定する。**

### 残る不正確さ（実装者が勝手に決めない）

フィルムで `DateTimeDigitized` が無く、かつファイル更新日時も使えない場合、
現在のコードは**アップロード時刻**を入れる（`upload-date.ts:25-30`）。
今回はこの挙動を変えず、`file_modified` として分類する。

ブラウザは `File.lastModified` をほぼ必ず返すため、この枝は実際には通らない。
コメントでその旨を残す。**挙動を変える判断はオーナーが行う。**

## S2. `shotAtDigitized`

**`DateTimeDigitized` が存在すれば、`shotAt` に採用されなかった場合も保存する。**

デジタル写真では次の併存があり得る。これを正常な状態として扱う。

```
shotAt          = DateTimeOriginal  （撮影した時刻）
shotAtDigitized = DateTimeDigitized （デジタル化した時刻）
```

存在しなければ NULL。

## S3. `sourceWidth` / `sourceHeight`

**EXIFの向きを適用した後の「表示上の縦横」を保存する。**
sharp の `metadata().autoOrient.width / .height` を使う。
生の `metadata().width / .height` は**使わない**。

実測で確認した違い（横40×24に `orientation=6` を付けた画像）:

| | 値 |
|---|---|
| `metadata().width × height`（生） | 40 × 24 |
| `metadata().autoOrient`（向き適用後） | **24 × 40** |
| 既存の `width` / `height`（保存版） | **24 × 40** |

既存の `width`/`height` は `optimiseImage` が `.rotate()` を通すため
**すでに向き適用後**。`sourceWidth`/`sourceHeight` も向き適用後に揃えることで、
両者は「同じ向きで、大きさだけが違う」関係になる。

**既存の `width`/`height` との違い**:

| 列 | 何の寸法か |
|---|---|
| `width` / `height` | **保存した3200pxのJPEG**の寸法（向き適用後） |
| `sourceWidth` / `sourceHeight` | **アップロードされた元ファイル**の寸法（向き適用後） |

**この違いをコードコメントとテストの両方で固定する。**

## S4. `sourceFormat`

**ライブラリの戻り値をそのまま入れない。** 小文字の閉じた集合へ正規化する。

| 保存する値 | 条件 |
|---|---|
| `jpeg` | sharp の `format` が `jpeg` |
| `png` | 同 `png` |
| `webp` | 同 `webp` |
| `tiff` | 同 `tiff` |
| `avif` | `format` が `heif` かつ `compression` が `av1` |
| `heic` | `format` が `heif` かつ `compression` が `hevc` |
| `other` | 上のどれにも当てはまらない（未知の形式・未知の圧縮） |
| NULL | そもそも読み取れなかった |

**`other` と NULL を分ける。** 「読んだが知らない形式だった」と
「読めなかった」は別のこと。

アップロードで受け付けている形式は
jpeg / png / webp / heic / heif / tiff / avif（`src/api/security.ts:4-25`）。
上の集合はこれを覆う。

実測で確認済み: **AVIFは `format = "heif"`, `compression = "av1"` として報告される**。
`format` だけを見ると AVIF と HEIC を取り違える。

未知の値が来ても例外を投げず `other` に落とす。

## S5. `GET /photos`

1. **先に**、返す列を明示する形へ変える。**この時点で応答は今と同じ**
   （キーの集合も順序も変えない）
2. 7列のうち一覧へ載せてよいのは **`shotAtSource` だけ**
3. 残り6列は保存するが、**使う画面が決まるまで通常の一覧では返さない**

対象は写真を多数返す3か所:
`GET /photos`（`index.ts:1331`）/ `GET /admin/photos/trash`（`:1911`）/
`GET /series/:slug`（`:2306`）。

## S6. 既存写真

- 496枚すべて `shotAtSource = 'legacy'`
- **`legacy` は「日時が信用できる」という意味ではない。「記録していなかった」という意味**
- **将来の信頼性判定は `filmType` と `shotAtSource` の両方を見る**。
  `filmType = "フィルム"` かつ `shotAtSource = 'legacy'` の写真は、
  日時がスキャン時刻である可能性が高い（既存のフィルム279枚がこれに当たる）
- **B-1（`photo-band.ts`）の挙動は今回変更しない**

## S7. 単位1と2で変更しないもの

製品画面 / Finder型ビュー / B-2 / B-3 / 元画像の保存 / GPS / 画像解析 /
キーワード機能 / `camera` 列の既存の使われ方。

DB migration は**生成とローカル検証まで**。本番Tursoへ適用しない。
`db:push` / `db:migrate` / `git push` / deploy / 本番への書き込みは禁止。
