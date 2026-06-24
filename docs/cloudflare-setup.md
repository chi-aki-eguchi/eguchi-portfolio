# Cloudflare + R2 CDN セットアップ手順

画像配信を Cloudflare CDN 経由に最適化するための設定手順。

## 概要

現状: すべての画像が Railway サーバ経由（`/api/images/...`）で配信されている。
目標: サムネイル（thumbs/）と Lightbox 用画像（medium/）を R2 パブリックアクセスから直接配信し、サーバ負荷を軽減する。

```
Before:  ブラウザ → Railway → R2 → sharp リサイズ → ブラウザ
After:   ブラウザ → Cloudflare CDN → R2（thumbs/medium は直接配信）
         ブラウザ → Railway → R2（元画像の on-the-fly リサイズは従来通り）
```

---

## Step 1: R2 パブリックアクセスの有効化

### 1-1. R2 ダッシュボードを開く

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) にログイン
2. 左メニュー → **R2 Object Storage** → 対象バケットをクリック
3. **Settings** タブを開く

### 1-2. パブリックアクセスを有効化

**方法 A: r2.dev サブドメイン（簡単・すぐ使える）**

1. **R2.dev subdomain** セクションで **Allow Access** をクリック
2. 確認ダイアログで `allow` と入力して確定
3. 表示される URL をメモ（例: `https://pub-abc123def456.r2.dev`）

**方法 B: カスタムドメイン（推奨・Cloudflare CDN が自動適用）**

1. **Custom Domains** セクションで **Connect Domain** をクリック
2. ドメインを入力（例: `images.akieguchi.com`）
3. **Continue** → DNS レコードが自動作成される
4. SSL 証明書が自動発行されるまで数分待つ

> カスタムドメインを使う場合、そのドメインの DNS が Cloudflare で管理されている必要がある（Step 2 参照）。

### 1-3. Railway に環境変数を追加

Railway ダッシュボード → Variables:

```
R2_PUBLIC_URL=https://pub-abc123def456.r2.dev
```

または（カスタムドメインの場合）:

```
R2_PUBLIC_URL=https://images.akieguchi.com
```

> 末尾のスラッシュは不要。設定後、次のデプロイで thumbUrl / mediumUrl が R2 直接 URL に切り替わる。

### 1-4. 動作確認

デプロイ後、ブラウザの DevTools → Network タブで確認:

- サムネイル（`thumbs/...webp`）→ R2 パブリック URL から配信されている
- Lightbox 画像（`medium/...webp`）→ 同上
- 元画像（`photos/...`）→ 従来通り `/api/images/photos/...` 経由

---

## Step 2: Cloudflare DNS 移行（akieguchi.com）

カスタムドメインで R2 を配信する場合、または akieguchi.com 全体を Cloudflare 経由にする場合の手順。

### 2-1. Cloudflare にサイトを追加

1. Cloudflare ダッシュボード → **Add a Site**
2. `akieguchi.com` を入力
3. **Free** プランを選択（画像 CDN には十分）
4. Cloudflare が既存の DNS レコードをスキャン → 確認して **Continue**

### 2-2. ネームサーバの変更

Cloudflare が 2 つのネームサーバを表示する（例: `xxx.ns.cloudflare.com`）。

1. 現在のドメインレジストラ（お名前.com / Google Domains / etc.）にログイン
2. ネームサーバ設定を Cloudflare のものに変更
3. 反映には最大 24〜48 時間かかる（通常は数時間）

### 2-3. DNS レコードの設定

Cloudflare DNS に以下のレコードが必要:

| Type  | Name            | Content                                       | Proxy           |
| ----- | --------------- | --------------------------------------------- | --------------- |
| CNAME | `akieguchi.com` | Railway のドメイン（`*.up.railway.app`）      | ON (オレンジ雲) |
| CNAME | `www`           | `akieguchi.com`                               | ON              |
| CNAME | `images`        | R2 カスタムドメイン用（Step 1-2B で自動作成） | ON              |

> Railway の CNAME 値は Railway ダッシュボード → Settings → Networking → Public Networking で確認。

### 2-4. SSL/TLS 設定

1. Cloudflare ダッシュボード → **SSL/TLS**
2. 暗号化モード: **Full (strict)**
3. **Edge Certificates** → Always Use HTTPS: **ON**
4. **Minimum TLS Version**: TLS 1.2

### 2-5. Railway 側の設定

1. Railway ダッシュボード → Settings → Networking
2. Custom Domain に `akieguchi.com` を追加（既に設定済みならそのまま）
3. Cloudflare DNS が反映されたら、SSL 証明書が自動更新される

---

## Step 3: Cloudflare キャッシュルールの設定

### 3-1. 自動キャッシュ（デフォルトで効く）

Cloudflare は以下のヘッダーを自動的に尊重する（コード側で設定済み）:

| コンテンツ                                | Cache-Control ヘッダー                               | 結果                    |
| ----------------------------------------- | ---------------------------------------------------- | ----------------------- |
| サムネイル/中間画像（R2 直接）            | R2 が返すデフォルト                                  | Cloudflare がキャッシュ |
| 画像プロキシ（`/api/images/...`）         | `public, max-age=31536000, immutable`                | Cloudflare がキャッシュ |
| Vite ハッシュ付き JS/CSS（`/assets/...`） | `public, max-age=31536000, immutable`                | Cloudflare がキャッシュ |
| HTML                                      | `no-cache, no-store` + `CDN-Cache-Control: no-store` | キャッシュされない      |
| API JSON（`/api/...`、画像以外）          | `no-store`                                           | キャッシュされない      |

### 3-2. R2 カスタムドメインのキャッシュルール（推奨）

カスタムドメイン（`images.akieguchi.com`）を使う場合、Cache Rules で最適化:

1. Cloudflare ダッシュボード → **Caching** → **Cache Rules**
2. **Create rule** をクリック

**ルール: サムネイル/中間画像を長期キャッシュ**

- Rule name: `R2 immutable images`
- When: `Hostname equals images.akieguchi.com`
- Then:
  - Cache eligibility: **Eligible for cache**
  - Edge TTL: **Override** → `1 year`
  - Browser TTL: **Override** → `1 year`

### 3-3. メインサイトのキャッシュルール

1. **Caching** → **Cache Rules** → **Create rule**

**ルール: HTML をキャッシュしない**

- Rule name: `No cache HTML`
- When: `Hostname equals akieguchi.com AND NOT URI Path starts with /api/ AND NOT URI Path starts with /assets/`
- Then:
  - Cache eligibility: **Bypass cache**

> `/assets/` は Vite がハッシュ付きファイル名を生成するため、長期キャッシュが安全。
> `/api/images/` は既にサーバ側で `immutable` ヘッダーを返しているため、追加ルール不要。

---

## Step 4: 動作確認チェックリスト

デプロイ後、以下を確認:

### ブラウザ DevTools (Network タブ)

- [ ] サムネイル画像: R2 パブリック URL から配信（`cf-cache-status: HIT` が出れば Cloudflare キャッシュ済み）
- [ ] Lightbox 画像: 同上
- [ ] 元画像プロキシ: `/api/images/photos/...` 経由、`ETag` ヘッダーあり
- [ ] HTML: `Cache-Control: no-cache, no-store`
- [ ] JS/CSS (`/assets/...`): `Cache-Control: public, max-age=31536000, immutable`

### 機能確認

- [ ] ギャラリーページ: 画像が正常に表示される
- [ ] Lightbox: 開く → 画像が読み込まれる → ナビゲーションが動く
- [ ] ヒーロー: カルーセルが表示される
- [ ] 管理画面: 画像アップロードが動作する
- [ ] OGP: SNS で URL を共有 → サムネイルが表示される

### パフォーマンス

- [ ] Lighthouse: Performance スコアが改善
- [ ] TTFB: 画像の初回読み込みが高速化
- [ ] 2 回目以降: ブラウザキャッシュで即表示

---

## トラブルシューティング

### 画像が表示されない

1. R2 パブリックアクセスが有効か確認（r2.dev URL にブラウザで直接アクセス）
2. `R2_PUBLIC_URL` の末尾にスラッシュがないか確認
3. CORS エラーの場合: R2 バケット → Settings → CORS で `https://akieguchi.com` を許可

### Cloudflare がキャッシュしない

1. `cf-cache-status` ヘッダーを確認（`MISS` → 初回、`HIT` → キャッシュ済み、`BYPASS` → ルール確認）
2. Cache Rules が正しく設定されているか確認
3. Development Mode がオフになっているか確認

### 画像が古いまま更新されない

写真の再アップロード時はファイル名にタイムスタンプが含まれるため、通常は問題ない。
手動でパージする場合: Cloudflare ダッシュボード → **Caching** → **Purge Cache** → URL を指定。

### R2 の CORS 設定

R2 バケット → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://akieguchi.com", "https://www.akieguchi.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

> 開発環境も使う場合は `http://localhost:4200` も追加。
