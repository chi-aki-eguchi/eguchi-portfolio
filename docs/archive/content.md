# CDN汚染による白画面バグ — 原因・診断・恒久対策仕様書

## 概要

特定回線（Wi-Fi）でのみサイトが真っ白になるバグ。Cloudflareエッジが壊れた`gzip`データをキャッシュし、配信し続けることが根本原因。正しい修正を3ファイルに加えることで恒久解決できる。

---

## 1. 何が起きていたか（根本原因）

```
[サーバー] → Content-Encoding: gzip（宣言）+ 壊れたバイト列（実体）
     ↓
[Cloudflare エッジ] → 壊れたまま max-age=31536000 (1年) でキャッシュ
     ↓
[ブラウザ] → gzip解凍しようとして失敗
     ↓
ERR_CONTENT_DECODING_FAILED（"Rawデータをデコードできません"）
     ↓
JS/CSSが実行されず → 真っ白
```

### なぜ環境によって差が出たか

Cloudflareは世界中に**数百のエッジノード**を持ち、ユーザーの回線・地域・プロバイダによって当たるノードが変わる。

| 環境 | 当たるエッジ | 結果 |
|------|------------|------|
| ユーザーの自宅Wi-Fi | 壊れたキャッシュを持つノード | 真っ白 |
| ユーザーの4G/5G | 別ノード（健全） | 正常表示 |
| 開発者サンドボックス | 別ノード（健全） | 正常表示 |

これが「自分の環境では再現しない」「シークレット・別ブラウザでも直らない」の正体。ローカルキャッシュは無関係。

### コンソールに出たエラー

```
[Error] Failed to load resource: Rawデータをデコードできません (index-*.js)
[Error] Failed to load resource: Rawデータをデコードできません (index-*.css)
```

`ERR_CONTENT_DECODING_FAILED` が JS と CSS の両方で出ていた。HTML自体は届いているがアセットが読めず、Reactが起動しない→白画面。

---

## 2. 診断コマンド（再発時の確認手順）

### ステップ1：エッジが汚染されているか確認

```bash
# gzipヘッダ宣言の確認
curl -sI -H "Accept-Encoding: gzip" https://akieguchi.com/assets/<entry>.js \
  | grep -i "content-encoding"
# → "content-encoding: gzip" が出たら次のステップへ

# 実際にgzipかチェック（1f 8b = gzipのmagic bytes）
curl -s -H "Accept-Encoding: gzip" https://akieguchi.com/assets/<entry>.js \
  --output /tmp/a.bin && od -An -tx1 -N2 /tmp/a.bin
# → "1f 8b" 以外なら壊れたgzip。これが白画面の直接原因
```

### ステップ2：どのビルドが本番に出ているか確認

```bash
curl -sI https://akieguchi.com/ | grep -i x-build
# → X-Build: xxx が返る。サンドボックスのローカルと一致するか確認
```

### ステップ3：アセットがエッジキャッシュされているか

```bash
curl -sI https://akieguchi.com/assets/<entry>.js | grep -i cf-cache-status
# → HIT = キャッシュ済み（汚染が持続する）
# → MISS/DYNAMIC = キャッシュなし（新リクエスト）
```

---

## 3. 恒久修正仕様（3ファイル）

### 修正A：`vite.config.ts` — アセット名を毎ビルドで必ず変える【最重要】

**問題**: Viteはデフォルトでファイル内容のハッシュのみでアセット名を決める。内容が変わらないファイル（例: vendor.js）はビルドしても同名 → エッジが汚染キャッシュを再利用し続ける。

**修正**: ビルドごとのタイムスタンプをファイル名に混ぜる。

```ts
// packages/web/vite.config.ts
build: {
  rollupOptions: {
    output: {
      // BUILD_TAG を環境変数で渡す。渡さなければ "b" がフォールバック
      entryFileNames: `assets/[name]-[hash]-${process.env.BUILD_TAG || "b"}.js`,
      chunkFileNames: `assets/[name]-[hash]-${process.env.BUILD_TAG || "b"}.js`,
      assetFileNames: `assets/[name]-[hash]-${process.env.BUILD_TAG || "b"}[extname]`,
      manualChunks(id) {
        // ... 既存のchunk設定はそのまま維持
      },
    },
  },
},
```

**ビルド時の実行コマンド**:

```bash
# 日時タグをつけてビルド（例: 06150930）
BUILD_TAG=$(date +%m%d%H%M) bun run build
```

**効果**: 新ビルドのアセットURLは `index-xxx-06150930.js` のように必ず変わる。エッジに汚染キャッシュがあっても、新URLには存在しないため必ずオリジンから取得される。

---

### 修正B：`server.ts` — HTMLにエッジキャッシュ禁止ヘッダを付ける

**問題**: HTMLがエッジにキャッシュされると、古いアセット名を参照するHTMLが配信され続ける。新しいアセット名が含まれたHTMLが届かない。

**修正**: HTMLレスポンスに専用のCDNヘッダを追加。

```ts
// packages/web/src/server.ts
// index.html を返す箇所（HTMLレスポンスのみ）

return new Response(injected, {
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    // ↓ これが重要。Cloudflareは標準のCache-Controlを無視する設定が
    //   ダッシュボードで有効になっていることがあるため、専用ヘッダで明示する
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
  },
});
```

**注意点**:
- このヘッダは**HTMLにのみ付ける**。アセット（JS/CSS）に付けると1年キャッシュの恩恵が失われパフォーマンスが落ちる
- アセットは `Cache-Control: public, max-age=31536000, immutable` のままでOK。ファイル名が毎ビルドで変わるので古いキャッシュは自動的に無効化される

---

### 修正C：`ogp.ts` — BUILD_IDでデプロイを識別する

**目的**: デバッグ時に本番・ローカル・どのビルドが動いているかを瞬時に判別する。

```ts
// packages/web/src/api/ogp.ts
export const BUILD_ID = "20260615a"; // デプロイごとに更新
```

**確認方法**:

```bash
curl -sI https://akieguchi.com/ | grep -i x-build
# → X-Build: 20260615a が返れば最新ビルドが本番に反映されている
```

---

## 4. デプロイ手順（正式フロー）

```bash
# 1. ビルド（タイムスタンプ付き）
cd packages/web
BUILD_TAG=$(date +%m%d%H%M) bun run build

# 2. ogp.ts の BUILD_ID を更新（手動）
# export const BUILD_ID = "YYYYMMDD-x"; に書き換え

# 3. pm2再起動
cd /home/user/eguchi-portfolio-app
PATH=$PATH:./node_modules/.bin pm2 restart web-app

# 4. ローカル動作確認
curl -sI http://localhost:4200/ | grep -i x-build  # BUILD_ID一致確認
for a in $(curl -s http://localhost:4200/ | grep -oE '/assets/[^"]*\.(js|css)'); do
  curl -s -o /dev/null -w "%{http_code} $a\n" "http://localhost:4200$a"
done
# → 全部 200 なら正常

# 5. Runableプラットフォームから公開（Publish）
```

---

## 5. 再発防止チェックリスト

### デプロイ前

- [ ] `BUILD_TAG=$(date +%m%d%H%M) bun run build` でタグ付きビルドしたか
- [ ] `ogp.ts` の `BUILD_ID` を今日の日付に更新したか
- [ ] `dist/assets/` のファイル名にタグが含まれているか（例: `index-xxx-06150930.js`）

### デプロイ後（本番確認）

```bash
# 1. ビルドIDが新しいか
curl -sI https://akieguchi.com/ | grep -i x-build

# 2. HTMLがエッジキャッシュされていないか
curl -sI https://akieguchi.com/ | grep -i cf-cache-status
# → DYNAMIC が理想（HITなら要注意）

# 3. アセットが正常に返るか
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://akieguchi.com/assets/index-<新ハッシュ>-<タグ>.js"
# → 200 ならOK

# 4. gzip汚染がないか（念のため）
curl -s -H "Accept-Encoding: gzip" \
  "https://akieguchi.com/assets/index-<新ハッシュ>-<タグ>.js" \
  --output /tmp/check.bin
od -An -tx1 -N2 /tmp/check.bin
# → "1f 8b" ならgzip正常。それ以外なら汚染
```

---

## 6. 今後 Claude（AI）に修正を依頼する際のプロンプト例

```
以下のバグを修正してください。

【症状】
特定のWi-Fi環境でのみサイトが真っ白になる。
コンソールに "Failed to load resource: Rawデータをデコードできません (index-*.js)" が出る。
シークレット・別ブラウザでも再現。4G/別回線では正常。

【原因】
CloudflareのCDNエッジが壊れたgzipをキャッシュして配信している。

【必要な修正】

1. vite.config.ts
   - rollupOptions.output に以下を追加:
     entryFileNames: `assets/[name]-[hash]-${process.env.BUILD_TAG || "b"}.js`
     chunkFileNames: `assets/[name]-[hash]-${process.env.BUILD_TAG || "b"}.js`
     assetFileNames: `assets/[name]-[hash]-${process.env.BUILD_TAG || "b"}[extname]`
   - ビルド時に BUILD_TAG=$(date +%m%d%H%M) を渡すこと

2. server.ts（HTMLレスポンスのみ）
   - Cache-Control: no-cache, no-store, must-revalidate
   - CDN-Cache-Control: no-store
   - Cloudflare-CDN-Cache-Control: no-store
   を追加。アセットレスポンスには付けないこと。

3. .env は絶対に変更・上書きしないこと。
```

---

## まとめ

| 対策 | ファイル | 効果 |
|------|---------|------|
| ビルドタグでアセット名を毎回変える | `vite.config.ts` | 壊れたキャッシュを物理的に回避（最重要） |
| HTMLのエッジキャッシュを禁止 | `server.ts` | HTMLが常に最新アセット名を参照する |
| BUILD_IDでデプロイを識別 | `ogp.ts` | 本番への反映を瞬時に確認できる |

これらを全て適用した状態でデプロイすれば、同じバグは再発しない。
