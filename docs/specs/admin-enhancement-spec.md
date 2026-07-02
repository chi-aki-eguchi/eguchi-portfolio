# 管理画面 強化仕様書 v3 Draft（写真の向き・調整幅・使いやすさ）

> Claude Code / Codex 向けレビュー用ドラフト。
> 秋さん要望: 「管理画面で写真の向きを変えれるようにして欲しい。加えて、管理画面で調整できることを増やしたり、既存項目をもっと使いやすくする。」
> まだ確定版ではない。実装前に Claude Code が P0/P1 リスクと実装順をレビューする。

---

## 0. 前提（必ず守る）

- `AGENTS.md` の §0 invariants を継承する。
- DB クエリは必ず `withRetry(() => db....)` でラップする。
- API / client のレスポンス本文は `assertOk()` / `jsonOrThrow()` で成功確認してから読む。
- データ更新後は関連 query を `qc.invalidateQueries` で再取得する。
- スキーマ変更時は `schema.ts`（Turso/libSQL）と `schema.postgres.ts`（配布版 PostgreSQL）の両方を同期する。
- 新規 settings キーを追加する場合は `settings-preview.ts` 台帳、API `/settings` default、`provider.tsx` DB適用 / preview適用、管理画面UIをセットで更新する。
- 写真そのものの R2 オブジェクトは原則上書きしない。向き変更は非破壊で、DB値と画像配信・表示側で反映する。

---

## 1. 目的

### 1-1. 写真ごとの「向き」を管理画面から直せる

アップロード時の EXIF 自動回転では直りきらない写真、または公開時だけ意図的に縦横を変えたい写真を、管理画面から 90度単位で回転できるようにする。

重要なのは「管理画面だけ回る」ではなく、以下すべてで同じ向きになること。

- Library グリッド
- 写真インスペクタ
- Top Works
- Gallery
- Series detail
- Series cover
- Hero
- Lightbox
- OGP / SEO で使う画像表示に影響する箇所（可能な範囲）

### 1-2. 調整できることを増やす

写真家本人が「この写真は少し大きく」「この写真は右側を見せたい」「この写真はヒーローでは中央を見せたい」を管理画面で決められるようにする。

ただし、完全自由配置ツールにはしない。`docs/specs/design-spec.md` の方針どおり、写真集・雑誌的なリズムは、既存の S/M/L・並び順・レイアウト設定・余白調整で作る。

### 1-3. 既存項目を使いやすくする

すでに機能はあるが「どこに効くか分かりづらい」「写真が増えると辿り着きにくい」項目を、作業導線ごとに整理する。

---

## 2. 現状メモ

- `photos` には `width` / `height` / `displaySize` / `sortOrder` / `camera` / `lens` / `filmType` / `seriesId` / `isPublished` / `fileHash` / `deletedAt` がある。
- `photos` にはユーザー指定の向き情報がまだ無い。
- アップロード処理と画像プロキシでは `sharp().rotate()` を使って EXIF orientation を正規化している。今回の「向き変更」は、EXIF補正後にユーザーが追加で指定する公開上の回転。
- 公開側 `PhotoGallery` は `width` / `height` から `aspect-ratio` を組み、CLS を抑えている。90/270度回転時は表示上の縦横比を入れ替える必要がある。
- 既存レイアウトは9種あり、`collage` 系には装飾的な傾きコメントがあるが、今回の「向き」は作品画像そのものの正しい回転であり、装飾の傾きとは別物。
- `photoWithThumbs()` が返す `thumbUrl` / `mediumUrl` は事前生成済み R2 オブジェクトを直接指す。`rotationDeg != 0` の写真ではプロキシを通らず、サムネイルや Lightbox medium だけ元向きになるリスクがある。
- 既存の `srcSetFor(url, preset)` は文字列URLだけを受け取る。`rotationDeg` を渡し忘れると無音で元向き画像が混ざるため、写真オブジェクトを受け取る helper へ寄せる必要がある。
- OGP / server-side hero preload はサーバ側で画像URLを組み立てている。hero写真に回転が付いた場合、ここにも `rot` を渡す必要がある。

---

## 3. 追加データモデル

### 3-1. photos 追加カラム（推奨）

```ts
rotationDeg: integer("rotation_deg").notNull().default(0), // 0 | 90 | 180 | 270
focalX: integer("focal_x").notNull().default(50),           // 0-100
focalY: integer("focal_y").notNull().default(50),           // 0-100
```

#### 各カラムの意味

| カラム | 目的 | 初期値 | 備考 |
|---|---|---:|---|
| `rotationDeg` | 写真の公開上の回転 | `0` | 90度単位のみ。任意角度はやらない |
| `focalX` | object-fit: cover 時に見せたい中心X | `50` | 左0 / 中央50 / 右100 |
| `focalY` | object-fit: cover 時に見せたい中心Y | `50` | 上0 / 中央50 / 下100 |

#### 今回入れない候補

| 候補 | 判断 |
|---|---|
| `flipX` / `flipY` | 反転は誤操作時の破壊力が高い。初期実装では入れず、Claudeレビューで必要なら v3.1 に回す |
| 任意角度 `-5〜5deg` | 作品の正しい向きと装飾的な傾きが混ざるため入れない |
| 写真ごとの完全自由配置 | 今回の目的を越える。既存の S/M/L・sortOrder・layout・gap で運用する |

### 3-2. 型・APIレスポンスへの追加

`GET /photos`、`GET /series/:slug`、`GET /hero-photos`、`GET /admin/*` で写真を返す経路は、すべて `rotationDeg` / `focalX` / `focalY` を返す。

写真を複製する `POST /admin/photos/:id/duplicate` は、`rotationDeg` / `focalX` / `focalY` も引き継ぐ。

---

## 4. 画像配信・表示方式

### 4-1. 推奨: 画像プロキシで回転済み画像を返す

CSS `transform: rotate(...)` だけで回すと、90/270度時に画像の外接矩形・クロップ・Lightbox のフィット計算が複雑になる。推奨は `/api/images/:key` に回転パラメータを追加し、`sharp` で回転後の画像を返す方式。

```txt
/api/images/:key?w=1200&q=82&rot=90
```

#### API仕様

| query | 値 | 備考 |
|---|---|---|
| `rot` | `0` / `90` / `180` / `270` | 不正値は `0` 扱い、または 400。Claudeレビューで決定 |

#### 画像キャッシュ

画像プロキシの cache key には `rot` を含める。

```txt
key + width + quality + format + rot
```

現状の `api/index.ts` は `decodedKey__w${width}__q${quality}__${fmt}` 形式なので、ここへ `rot` を必ず足す。抜けると同じ cache key に回転違いの画像が混在する。

これにより、同じ写真でも `rot=0` と `rot=90` は別キャッシュになる。

### 4-2. URL生成ヘルパーを作る

各コンポーネントが文字列連結で `?w=...` を作ると漏れが出る。共通 helper を追加する。

```ts
type PhotoImageOptions = {
  w?: number;
  q?: number;
  rotationDeg?: number | null;
};

photoImageUrl(photo.url, { w: 800, q: 82, rotationDeg: photo.rotationDeg });
photoSrcSet(photo, "galleryTile");
orientedAspectRatio(photo.width, photo.height, photo.rotationDeg);
objectPosition(photo.focalX, photo.focalY);
```

想定ファイル:

- `packages/web/src/web/lib/photo-image.ts`
- `packages/web/src/web/lib/picture.ts`（既存 srcset helper への統合でも可）

既存の `srcSetFor(url, preset)` 呼び出し箇所は、V3-1でできるだけ写真オブジェクト渡しへ切り替える。対象は少なくとも `PhotoGallery` / `Lightbox` / `Picture` / `top.tsx` / OGP 画像生成周辺。

### 4-3. 縦横比

`rotationDeg` が `90` または `270` のときは、表示上の縦横比を入れ替える。

```ts
function orientedDimensions(width, height, rotationDeg) {
  return rotationDeg === 90 || rotationDeg === 270
    ? { width: height, height: width }
    : { width, height };
}
```

これを `PhotoGallery`、`Lightbox`、Hero、Series cover などで共通利用する。

### 4-4. `thumbUrl` / `mediumUrl` の扱い（P0）

`thumbUrl` / `mediumUrl` が R2 の事前生成ファイルを直接指すままだと、`rot` を通らない。これが最も起きやすい反映漏れ。

#### 推奨

API の `photoWithThumbs()` で `rotationDeg` を見て、以下のどちらかにする。

| 案 | 内容 | 判断 |
|---|---|---|
| A | `rotationDeg != 0` のとき `thumbUrl=null` / `mediumUrl=null` にして既存 proxy fallback を使わせる | 実装は簡単だが pregen の恩恵を捨てる |
| B | `thumbUrl` / `mediumUrl` を `/api/images/${key}?w=...&q=...&rot=${rotationDeg}` 形式で返す | 推奨。LRU cache に乗り、向きも統一できる |

V3-1では B を第一候補にする。難しければ A でP0を先に潰す。

### 4-5. OGP / server-side hero preload（P1）

`api/ogp.ts` で OGP画像URLと hero preload srcset を組み立てる経路にも `rotationDeg` が必要。

- `buildOgp()` / OGP注入処理に hero photo の `rotationDeg` を渡す。
- OGP画像URLに `&rot=${rotationDeg}` を付ける。
- hero preload の srcset も `rot` 付きURLにする。
- サーバ側の hero photo クエリが `rotationDeg` を取得しているか確認する。

---

## 5. 管理画面 UI

### 5-1. 写真インスペクタに「見え方」セクションを追加

既存の Title / Camera / Lens / Category / Series / Display Size 周辺に、以下をまとめる。

#### セクション名

`見え方`

#### 項目

| 項目 | UI | 反映先 |
|---|---|---|
| 向き | `RotateCcw` / `RotateCw` icon button + `0/90/180/270` segmented control | 全公開表示 |
| 見せる中心 | 3x3 グリッド or 小さなプレビュー上クリック | `object-position` が効く切り抜き表示 |
| 写真の大きさ | 既存 S/M/L segmented control | Gallery / Top Works / Series |
| 公開状態 | 既存公開トグル | 公開一覧 |
| 使用状況 | badge 表示 | Hero / Series / Top Works で使っているか |

#### UX

- 回転ボタンは保存成功前でも optimistic にプレビューへ反映してよい。ただし失敗時は元に戻し、トーストまたは行内エラーを出す。
- `Reset` ボタンで `rotationDeg=0`、`focalX=50`、`focalY=50` に戻す。
- 変更後は Library サムネイル、インスペクタプレビュー、公開プレビュー iframe のすべてが同じ見た目になる。

### 5-2. Library グリッドにクイック回転を追加

サムネイル hover / focus 時に小さな回転ボタンを出す。

- 左回転 `RotateCcw`
- 右回転 `RotateCw`
- キーボード操作: 選択中写真に `[` で左回転、`]` で右回転（候補。既存ショートカットと衝突がないか確認）

誤操作を避けるため、回転ボタンは小さくしすぎず、押下後は `Saved` 表示を出す。

### 5-3. 一括操作

複数選択時ツールバーに以下を追加する。

| 操作 | 挙動 |
|---|---|
| 左に90度回転 | 選択写真すべて `rotationDeg = (rotationDeg + 270) % 360` |
| 右に90度回転 | 選択写真すべて `rotationDeg = (rotationDeg + 90) % 360` |
| 向きをリセット | `rotationDeg=0` |
| 見せる中心をリセット | `focalX=50`, `focalY=50` |

既存 batch endpoint がある場合はそこへ統合する。無い場合は `POST /admin/photos/batch` を拡張する。

---

## 6. API 仕様

### 6-1. `PATCH /admin/photos/:id`

既存 update に以下を追加。

```ts
if (body.rotationDeg !== undefined) {
  // 0 / 90 / 180 / 270 のみ許可
}
if (body.focalX !== undefined) {
  // 0-100 に clamp
}
if (body.focalY !== undefined) {
  // 0-100 に clamp
}
```

#### バリデーション

| field | allowed |
|---|---|
| `rotationDeg` | `0`, `90`, `180`, `270` |
| `focalX` | integer `0..100` |
| `focalY` | integer `0..100` |

不正値は 400 を返す。UI側では値を制限するが、APIでも守る。

### 6-2. `POST /admin/photos/batch`

既存 batch 操作に以下を追加。

```ts
operation:
  | "rotate_left"
  | "rotate_right"
  | "reset_rotation"
  | "reset_focal_point"
```

レスポンス:

```ts
{ ok: true, updated: number }
```

### 6-3. `GET /photos` 系

写真レスポンスへ以下を含める。

```ts
rotationDeg: number;
focalX: number;
focalY: number;
```

---

## 7. 公開サイト反映箇所

### 7-1. 必須反映

| 箇所 | 対応 |
|---|---|
| `PhotoGallery` | 画像URL、srcset、aspect-ratio、object-position |
| `Lightbox` | 画像URL、フィット計算、metadata 表示 |
| Top Works | 画像URL、aspect-ratio |
| Gallery page | `PhotoGallery` 経由で反映 |
| Series detail | `PhotoGallery` 経由で反映 |
| Series cover / `SeriesGrid` | cover画像のURL・object-position |
| Hero | hero写真のURL・object-position。特に full-screen / carousel 両方 |
| Admin Library / Inspector | 公開側と同じ helper で表示 |

### 7-2. 見た目の原則

- 回転後も写真の縦横比が崩れない。
- cropped tile では `focalX/Y` を尊重する。
- contain 表示の Lightbox では `focalX/Y` は基本効かせない。写真全体を見せる。
- 90/270度回転でサムネイルが急に潰れないよう、`aspect-ratio` は oriented dimensions を使う。

---

## 8. さらに増やす調整項目（v3 候補）

今回の要望は「向き」だけではなく、管理画面で調整できる幅と使いやすさの拡張も含む。以下は優先度順に検討する。

### A. 写真ごとの調整

| 優先 | 項目 | 内容 | 初期実装 |
|---|---|---|---|
| P0 | 向き | 0/90/180/270度 | 入れる |
| P1 | 見せる中心 | cropped tile の `object-position` | DBカラムはV3-1で追加、UI配線はV3-4推奨 |
| P1 | 表示サイズ S/M/L の導線改善 | 既存機能を「見え方」へ移動し、説明を足す | 入れる |
| P1 | 使用状況 | Hero / Series / Top Works / 非公開 / ゴミ箱 badge | 入れる |
| P2 | 写真ごとの caption 表示ON/OFF | title/撮影情報を出すか | 保留 |
| P2 | 写真ごとの余白強調 | 特定写真の前後余白を増やす | 保留 |
| P3 | 反転 | 左右反転 | 要レビュー |

### B. 管理画面の使いやすさ

| 優先 | 項目 | 内容 |
|---|---|---|
| P0 | よく使う操作を Inspector 上部に集約 | 公開/非公開、サイズ、向き、シリーズ、カテゴリ |
| P0 | 保存状態を統一 | 行・Inspector・batch の成功/失敗表示を同じ言葉にする |
| P1 | フィルター保存 | 「未分類」「未公開」「最近追加」「縦写真だけ」などをワンクリック |
| P1 | 右パネル固定 | 写真選択中に Inspector が閉じず、次々編集できる |
| P1 | 画像プレビュー拡大 | Inspector 内で大きめ確認。Lightboxとは別の軽い確認 |
| P2 | 操作履歴 / Undo 拡張 | 回転・一括変更も直前だけ戻せる |

### C. Settings の整理

| 優先 | 項目 | 内容 |
|---|---|---|
| P0 | 「よく使う」セクション | ギャラリーレイアウト、余白、列数、トップ写真、文字サイズを集約 |
| P1 | 「どこに効くか」補足 | 既存設定に表示場所を1行追加 |
| P1 | Preview ページ切替 | Top / Gallery / Series / About / Contact を admin 内で切替 |
| P1 | Preview 状態表示 | 保存前preview中 / 保存済み / 反映失敗を明示 |
| P2 | 設定プリセット | Editorial / Minimal / Book / Grid など |

---

## 9. 実装フェーズ案

### V3-0. Claudeレビュー

目的: 実装前に以下を確認する。

- 画像プロキシ `rot` 方式で問題ないか
- `rotationDeg` / `focalX` / `focalY` のカラム名でよいか
- `flipX` を初期実装に含めるべきか
- `focalX/Y` を向きと同時に入れるか、別フェーズに分けるか
- Hero / Series cover まで初回受け入れ基準に含めるか

2026-06-25 に Claude Code レビュー済み。P0/P1 指摘は「12. Claude Codeレビュー結果」に反映済み。

### V3-1. データと画像表示の土台

- 両 schema に `rotationDeg` / `focalX` / `focalY` 追加。
- API response と PATCH に追加。
- `/api/images/:key` に `rot` query を追加。
- 画像プロキシ cache key に `rot` を追加。
- `photoWithThumbs()` の `thumbUrl` / `mediumUrl` を `rot` 対応にする。
- `photo-image.ts` helper を追加。
- 既存 `srcSetFor(url, preset)` 呼び出しを写真オブジェクト渡し helper へ寄せる。
- OGP / server-side hero preload に `rotationDeg` を渡す。
- `orientedAspectRatio` / `objectPosition` の単体テスト追加。
- `bun run db:push` が必要。

### V3-2. 管理画面で向きを変える

- Inspector「見え方」セクション追加。
- Library サムネイルに quick rotate 追加。
- 一括回転 / リセット追加。
- 変更後の query invalidation を整理。

### V3-3. 公開サイト全反映

- `PhotoGallery` / `Lightbox` / Top / Hero / Series cover を共通 helper に寄せる。
- 90/270度の aspect-ratio 回帰テストを追加。
- browser で Gallery / Top / Series / Lightbox を確認する。

### V3-4. 使いやすさ改善

- Inspector 上部に使用状況 badge。
- Settings に「よく使う」セクション。
- Preview のページ切替。
- フィルター保存または固定フィルターを追加。

---

## 10. 受け入れ基準

### 写真の向き

- [ ] 管理画面で写真を右90度回転し、保存後にリロードしても向きが維持される。
- [ ] Library / Inspector / Gallery / Top Works / Series detail / Hero / Lightbox で同じ向きに見える。
- [ ] 90/270度回転の写真でも縦横比が潰れない。
- [ ] 画像の元R2オブジェクトは上書きされない。
- [ ] 回転済み画像の `srcset` が生成され、大きい画面でも荒くならない。
- [ ] `thumbUrl` / `mediumUrl` が回転を無視せず、Lightbox medium も同じ向きで表示される。
- [ ] 画像プロキシの cache key に `rot` が入り、回転違いの画像が混在しない。
- [ ] Hero写真に回転が付いても OGP / hero preload が同じ向きになる。
- [ ] 不正な `rotationDeg` は API で拒否される。

### 見せる中心

- [ ] cropped tile で `focalX/Y` が `object-position` に反映される。
- [ ] Lightbox の contain 表示では写真全体が見える。
- [ ] リセットで中央に戻る。

### 管理画面UX

- [ ] 主要操作（向き・サイズ・公開・シリーズ・カテゴリ）が Inspector の分かりやすい位置にある。
- [ ] 一括回転が複数選択に対して動く。
- [ ] 保存成功/失敗が無音にならない。
- [ ] ショートカット一覧に新規操作が載る。

### 検証

- [ ] `cd packages/web && bun x tsc -b`
- [ ] `cd packages/web && bun test ./src`
- [ ] `cd packages/web && bun run build`
- [ ] `git diff --check`
- [ ] 可能なら browser / Playwright で Top / Gallery / Series / Lightbox を目視確認

---

## 11. Claude Code へのレビュー依頼ポイント

Claude Code には、実装なしで P0/P1 中心に以下を見てもらう。

1. `rot` を画像プロキシに足す設計で、既存の画像キャッシュ・srcset・sharp処理に破綻がないか。
2. DBカラム名と型が、Turso / PostgreSQL 配布版の両方で扱いやすいか。
3. `focalX/Y` を P0 に含めるべきか、写真向きだけを先に出すべきか。
4. 公開側反映漏れが起きやすい箇所（Hero / Series cover / Lightbox / Top Works）に抜けがないか。
5. 既存 admin の状態管理・batch API・query invalidation と衝突しない実装順になっているか。

レビュー後、必要ならこのファイルを `Draft` から「確定版」に更新して実装する。

---

## 12. Claude Codeレビュー結果（2026-06-25）

Claude Code から P0/P1 中心で以下の指摘あり。実装前にこの節を必ず読む。

### P0. `thumbUrl` / `mediumUrl` が回転を通らない

`photoWithThumbs()` が返す `thumbUrl` / `mediumUrl` は事前生成済み R2 オブジェクトを直接指すため、`rotationDeg != 0` の写真では向きが反映されない。

対策:

- 推奨: `photoWithThumbs()` で `thumbUrl` / `mediumUrl` を proxy URL + `rot` 付きにする。
- 代替: `rotationDeg != 0` のとき `thumbUrl=null` / `mediumUrl=null` にし、既存 proxy fallback を強制する。

### P0. 画像プロキシ cache key に `rot` 必須

`api/index.ts` の cache key は現状 `decodedKey__w${width}__q${quality}__${fmt}`。ここに `rot` を含めないと、同じ写真の回転違いが同じキャッシュに入る。

### P1. OGP / server-side hero preload に `rotationDeg` を渡す

OGP画像URLと hero preload srcset はサーバ側で組み立てられる。hero写真が回転された場合、ここだけ元向きになる可能性がある。

対策:

- OGP生成に hero photo の `rotationDeg` を渡す。
- OGP画像URLと preload srcset に `rot` を付ける。

### P1. srcset helper は写真オブジェクト渡しへ寄せる

`srcSetFor(url, preset)` のままだと `rotationDeg` の渡し忘れが起きる。`photoSrcSet(photo, preset)` のように写真オブジェクトを渡す helper を作り、主要呼び出し箇所を切り替える。

### P1. `focalX/Y` はDBだけ先に追加、UI配線は後続推奨

`rotationDeg` / `focalX` / `focalY` は1回のマイグレーションで追加してよい。ただし初回実装では rot proxy + srcset + 公開面反映だけで変更量が大きい。`focalX/Y` の UI と `object-position` 配線は V3-4 以降に分けるのが安全。

### 確認

既存 batch endpoint は `operation` switch 形式で拡張しやすく、`rotate_left` / `rotate_right` / `reset_rotation` / `reset_focal_point` の追加は既存パターンに乗れる。衝突はなさそう。
