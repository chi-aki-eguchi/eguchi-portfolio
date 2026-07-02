# 改良3 仕様書 — akieguchi.com

作成日: 2026-06-18  
対象ブランチ: main  
優先順位: A（バグ修正）→ B（管理画面改善）→ C（新機能）

---

## 優先順位まとめ

| # | 機能 | 種別 | 優先度 | DB変更 |
|---|------|------|--------|--------|
| 1 | Lightboxチラつきバグ修正 | バグ修正 | 🔴 最優先 | なし |
| 2 | ライブラリ：矢印で詳細が更新されないバグ | バグ修正 | 🔴 最優先 | なし |
| 3 | ライブラリ：プレビューサイズ改善 | UI改善 | 🟠 高 | なし |
| 4 | メタデータ表形式編集 + 自動保存 | 管理画面改善 | 🟠 高 | なし |
| 5 | EXIFからカメラ・レンズ自動取得 + プリセット | 新機能 | 🟡 中 | あり |
| 6 | シリーズサムネイル選択のプレビュー | UI改善 | 🟡 中 | なし |
| 7 | フィルム/デジタルのカテゴリー + ギャラリーフィルター | 新機能 | 🟡 中 | あり |
| 8 | ギャラリーとシリーズの並び順を独立設定 | 新機能 | 🟢 低 | あり |
| 9 | レイアウト・テーマの柔軟化 | 新機能 | 🟢 低 | あり |

---

## 機能1：Lightboxチラつきバグ修正 🔴

### 現状
写真をクリックしても拡大表示（Lightbox）が開かず、チラつくだけになっている。

### 要件
- クリックで正しくLightboxが開くこと
- チラつきが起きないこと

### 調査ポイント（この順で確認）
1. onClickハンドラが正しくLightboxのopen stateを更新しているか
2. イベントバブリングによってすぐcloseが呼ばれていないか（e.stopPropagation()漏れ）
3. useEffectの依存配列が原因でrender→close→renderのループが発生していないか
4. Lightboxコンポーネントの条件付きレンダリング（`{isOpen && <Lightbox />}`）と
   アニメーション（framer-motion等）の組み合わせで即unmountが起きていないか
5. 同じphoto idで複数のクリックイベントが発火していないか

### 修正方針
- 原因を特定してから最小限の修正にとどめる
- Lightboxのstateをコンポーネント外（親）で管理しているならそこを確認

---

## 機能2：ライブラリ矢印移動で詳細が更新されないバグ 🔴

### 現状
ライブラリ画面で矢印ボタンで前後の写真に移動しても、右の詳細パネルが更新されない。

### 要件
- 矢印で移動した時、右の詳細パネルに選択中の写真情報が即時反映される
- プレビュー画像・タイトル・カメラ・レンズ・シリーズ等すべて更新される

### 実装
```
矢印クリック → selectedPhotoId（またはselectedPhoto）のstate更新 → 詳細パネルが再レンダリング
```
- 現状は矢印ハンドラがprewview表示のみ更新してselectedPhotoを更新していない可能性が高い
- 矢印ハンドラ内で `setSelectedPhoto(photos[newIndex])` を確実に呼ぶ

---

## 機能3：ライブラリのプレビューサイズ改善 🟠

### 現状
ライブラリで1枚選択した時のプレビューが小さい。

### 要件
- プレビュー画像を現状より大きく表示する
- 具体的な目標サイズ：右パネルの横幅いっぱいに表示（アスペクト比維持）
- 写真の縦横比に関わらず崩れないこと

### UI変更
```
Before: 右パネル上部に小さい正方形サムネイル
After:  右パネル上部にアスペクト比を維持した最大サイズのプレビュー
        （例：max-h-64 → object-contain → w-full）
```

---

## 機能4：メタデータ表形式編集 + 自動保存 🟠

### 現状
写真ごとに個別フォームを開いてSaveボタンを押す必要がある。写真が増えると非常に手間。

### 要件

**表形式編集**
- ライブラリに「一括編集モード」を切り替えるボタンを追加
- 一括編集モードでは写真一覧がスプレッドシート的なテーブルで表示される
- 各行がインラインで編集可能（タイトル・カメラ・レンズ・シリーズ・medium）
- セルをクリック→編集→別セルをクリックで確定

**自動保存**
- セルの変更から500msのdebounce後に自動でAPIを叩いて保存
- 保存中は行の左端に小さいスピナーを表示
- 保存完了で✓マーク（2秒後に消える）
- 保存失敗で⚠マーク + ツールチップでエラー内容

**編集可能フィールド**
| フィールド | 入力UI |
|-----------|--------|
| タイトル | テキスト入力 |
| カメラ | プリセットドロップダウン or テキスト入力 |
| レンズ | プリセットドロップダウン or テキスト入力 |
| medium | フィルム/デジタル のトグル |
| シリーズ | シリーズドロップダウン |

**実装メモ**
- 既存の `PATCH /api/photos/:id` を使い回す
- テーブルはTanStack Tableでなくシンプルなカスタム実装でOK（依存追加を避ける）
- 仮想スクロール（100枚超えた時のパフォーマンス対策）は後回しでOK

---

## 機能5：EXIFからカメラ・レンズ自動取得 + プリセット 🟡

### 要件

**アップロード時の挙動**
1. アップロード時に「フィルム」か「デジタル」かをグループ単位で選択するUIを追加
   - 複数枚まとめてアップロードする場合はグループで一括指定
   - デフォルトはデジタル
2. **デジタルの場合**：EXIFから以下を自動取得して写真レコードに保存
   - `Make` + `Model` → camera フィールド
   - `LensModel` → lens フィールド
   - 取得できない場合は空欄（エラーにしない）
3. **フィルムの場合**：EXIFから自動入力しない（フィルムカメラはEXIFがない）

**プリセット保存**
- EXIFから取得した（camera, lens）の組み合わせを自動的にプリセットとして保存
- 手動でも追加・編集・削除できる
- プリセットは使用回数が多い順に表示
- メタデータ入力時のカメラ・レンズフィールドでドロップダウン選択できる

### DBスキーマ変更

```sql
-- 新テーブル追加
CREATE TABLE camera_presets (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  camera    TEXT NOT NULL,
  lens      TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- photosテーブルに medium 列追加（機能7と共通）
ALTER TABLE photos ADD COLUMN medium TEXT CHECK(medium IN ('film', 'digital')) DEFAULT NULL;
```

### 実装メモ
- EXIFパースはすでにsharpを使っているので `metadata.exif` から取得できるはず
- `exif-reader` や `exifr` を追加するか、sharpのexifBufferをパースする
- カメラ名の正規化（例：`SONY ILCE-1` → `Sony α1`）は初期実装では不要、そのまま保存でOK

---

## 機能6：シリーズサムネイル選択のプレビュー 🟡

### 現状
シリーズの表紙写真を選ぶ時、ファイル名のドロップダウンのみ。どの写真か判断できない。

### 要件
- ドロップダウンを廃止し、グリッド形式の写真選択UIに変更
- 各写真のサムネイルと（あれば）タイトルを表示
- 現在選択中の写真をハイライト表示
- 選択するとすぐプレビューに反映

### UI変更
```
Before:
  表紙: [ファイル名のセレクト ▼]

After:
  表紙:
  ┌──────────────────────────────┐
  │ [img][img][img][img][img]... │  ← スクロール可能なグリッド
  │ 選択中の写真はボーダー強調    │
  └──────────────────────────────┘
```

- グリッドのセルサイズ：80×80px程度
- シリーズに属する写真のみ表示（全写真から選ぶ場合は全表示）
- モバイルでも使いやすいサイズ感

---

## 機能7：フィルム/デジタルのカテゴリー + ギャラリーフィルター 🟡

### 要件

**データ側**
- 写真レコードに `medium` フィールド（'film' | 'digital' | null）を追加
  - 機能5のDBスキーマ変更と共通
- アップロード時にグループ単位で選択（機能5と共通のUI）
- 一括編集テーブルでも変更可能（機能4と連携）

**ギャラリー表示側**
- ギャラリーページにフィルタータブを追加
  ```
  [すべて] [フィルム] [デジタル]
  ```
- タブ切り替えでURLクエリパラメータが変わる（例：`/gallery?medium=film`）
- mediumがnullの写真は「すべて」にのみ表示
- シリーズ一覧ページでも同様のフィルターを追加するか検討（後回し可）

**実装メモ**
- フィルタータブはURLパラメータで状態管理（ブラウザバック対応）
- APIは `GET /api/photos?medium=film` のクエリパラメータで対応

---

## 機能8：ギャラリーとシリーズで並び順を独立設定 🟢

### 現状
並び順の設定がギャラリーとシリーズで共通になっている（可能性あり）。

### 要件
- **ギャラリーページ（シリーズ一覧）の並び順**：新しい順 / 古い順 / 手動（drag&drop）
- **シリーズ内の写真の並び順**：撮影日順 / アップロード順 / 手動（drag&drop）
- それぞれ管理画面の設定から独立して設定できる

### DBスキーマ変更

```sql
-- settingsテーブルに列追加（または新しいkeyを追加）
-- key-value形式の場合：
INSERT OR REPLACE INTO settings (key, value) VALUES ('gallery_sort_order', 'manual');
INSERT OR REPLACE INTO settings (key, value) VALUES ('series_sort_order', 'manual');
-- 値: 'manual' | 'date_desc' | 'date_asc' | 'upload_desc'
```

---

## 機能9：レイアウト・テーマの柔軟化 🟢

### 現状
レイアウト（mosaic/grid/scroll/stagger/editorial/collage）は全体設定。テーマカスタマイズは限定的。

### 要件
- **シリーズごとにレイアウトを個別設定できる**
  - 現在のグローバル設定に加えて、シリーズ単位でオーバーライド可能
  - 「グローバル設定に従う」がデフォルト
- **テーマ設定の拡張**
  - 背景色：プリセット（白/黒/グレー）+ カスタムカラー入力
  - テキストカラー：背景に合わせて自動（または手動）
  - フォント：現状のものを含む複数候補から選択（Google Fonts連携は不要、ローカルのみ）
  - ギャップサイズ：S/M/L/XLから選択

### 将来的な汎用化に向けた設計指針
- 写真家以外（イラストレーター、デザイナー等）も使えるよう、
  「写真」を前提とした命名・UIを避ける（例：「Works」「Portfolio」等に対応できる設計）
- 設定値はJSONでシリーズレコードに保存（スキーマ変更が最小限になる）

### DBスキーマ変更

```sql
-- seriesテーブルに theme_config 列追加（JSON文字列）
ALTER TABLE series ADD COLUMN theme_config TEXT DEFAULT NULL;
-- 例: {"layout": "grid", "bgColor": "#ffffff", "font": "default", "gap": "M"}
```

---

## DBマイグレーションまとめ

実装時はDrizzleのマイグレーション（`bun run db:generate` → `bun run db:migrate`）を使うこと。

```sql
-- 1. camera_presets テーブル（機能5）
CREATE TABLE camera_presets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  camera     TEXT NOT NULL,
  lens       TEXT,
  use_count  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. photos.medium 列（機能5・7共通）
ALTER TABLE photos ADD COLUMN medium TEXT CHECK(medium IN ('film', 'digital')) DEFAULT NULL;

-- 3. settings に並び順キー追加（機能8）
-- settingsの実装方式に合わせること（列追加 or key-value insert）

-- 4. series.theme_config 列（機能9）
ALTER TABLE series ADD COLUMN theme_config TEXT DEFAULT NULL;
```

---

## 実装順序（推奨）

```
Phase A（バグ修正・即効性高い）
  1. Lightboxチラつき修正
  2. ライブラリ矢印→詳細更新バグ修正
  3. ライブラリプレビューサイズ改善
  → git commit & push

Phase B（管理画面UX改善）
  4. メタデータ表形式編集 + 自動保存
  5. シリーズサムネイル選択グリッド化
  → git commit & push

Phase C（DBあり・新機能）
  6. DBマイグレーション実行（medium列・camera_presetsテーブル）
  7. EXIFカメラ・レンズ自動取得 + プリセット機能
  8. フィルム/デジタルのカテゴリー + ギャラリーフィルター
  → git commit & push

Phase D（設定系・後回しOK）
  9. ギャラリーとシリーズの並び順独立設定
  10. レイアウト・テーマ柔軟化
  → git commit & push
```

---

## 注意事項

- **各フェーズの前後に `bun run build` でビルド確認**
- **DBマイグレーションは必ず `bun run db:generate` → `bun run db:migrate` の手順で**
- **既存の写真データを壊さない（ALTER TABLEはDEFAULT NULL付きで）**
- **デプロイは各フェーズ完了後にまとめて `git push`**
- **CLAUDE.mdを最初に読んでプロジェクト構造を把握してから着手**
