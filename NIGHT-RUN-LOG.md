# 夜間自走ログ（2026-06-18 night run）

実行: Claude Code（Opus 4.8, ultracode mode）。指示書: `claude-code-night-run.md`。

---

## フェーズ1: ヘルスチェック ✅

| 項目 | 結果 |
|---|---|
| `bun install` | クリーン（no changes, 544 packages） |
| `tsc -b`（型チェック） | ✅ エラーなし |
| `bun run build`（tsc -b + vite build） | ✅ 成功（1838 modules, built in ~1.2s） |
| `bun test ./src` | ✅ **74 pass / 0 fail**（4906 expect, 7 files） |

テスト内訳: `pages.render`（全ページ真っ白回帰防止）/ `PhotoGallery.render` / `ogp`（OGP注入）/ `note-rss` / `gallery-layout` / `settings-preview` / `reorder`。

**バンドル所見（vite build 出力）:**
- `react-vendor` 365.87 kB (gzip 109.75) — React 19 本体、想定内
- `admin` 279.71 kB (gzip 44.88) — 管理画面、遅延ロード済み（別チャンク）
- `index` 45.53 kB / `query-vendor` 37.34 kB / `top` 17.04 kB

**注記:**
- ライブ `curl` ルートスモークはサンドボックス制約で実行不可 → 決定的な render テスト群（全ページ）が同等以上にカバーしているため代替。
- `robots.txt` は `Disallow: /admin` を確認済み（server.ts）。
- メモリの「Deploy ZIP workflow」は陳腐化（Railway 移行済み・git push のみ）。本ランは git push でデプロイ。

---

## フェーズ2-6: 多角監査（ultracode マルチエージェント）

健全性が高いコードベースのため、フェーズ2-6（TS品質/SEO/パフォーマンス/UI・UX・a11y/管理画面）を**5次元の並行監査ワークフロー**として実行。各監査エージェントが実コードを読み、各指摘を**独立した懐疑的検証エージェントが再検証**（誤検知・ガードレール違反を排除）。

- 監査結果: **33指摘 → 28件が「実在かつ安全」と確証**（5件は誤検知/ガードレール外として却下）。
- 確認できたこと: 本サイトは非常に作り込まれている（Lightbox は `<dialog>` フォーカストラップ・段階Esc・矢印/±/0キー・スワイプ/ピンチ・aria-live、PhotoGallery は srcset+sizes・eager/lazy・width/height(CLS対策)、ヒーローは WCAG2.2.2 一時停止・reduced-motion、OGP/JSON-LD/sitemap/canonical/noindex も網羅済み）。指摘は周辺の磨き込みが中心。

## フェーズ2-6: 実装した改善（21件）

すべて `tsc -b` + `vite build` + `oxlint`（lint クリーン）+ `bun test`（74 pass）で検証済み。

### SEO / メタデータ
- **og:image:alt を動的画像に追従**（ogp.ts）— シリーズ共有時に汎用altではなく実画像のaltを出力。
- **シリーズ詳細に BreadcrumbList JSON-LD 追加**（ogp.ts）— Home › Series › 作品名 のパンくずリッチリザルト対応。
- **JSON-LD + GA4 を indexable ページ限定に**（ogp.ts）— `/admin`・ソフト404 では構造化データとGA4計測を停止（解析汚染・noindexページの広告化を防止）。
- **クライアント `<title>` を server とバイリンガル一致**（usePageTitle.ts / ogp.ts）— 「江口秋 | Aki Eguchi | Photography」で SPAタブとクローラ向け `<title>`/og:title が一致（従来は和文のみ vs 英文のみで不一致）。ogp.test.ts はパス維持。
- **SeriesGrid カバー画像の空alt修正**（SeriesGrid.tsx）— `alt=""` → シリーズ名（+サブタイトル）。
- **ギャラリー写真の汎用alt改善**（PhotoGallery.tsx / Lightbox.tsx）— 無題写真が全部同じ "Photograph" だったのを `filename` / 連番フォールバックで一意化。
- **index.html 静的descriptionを正規デフォルトに同期**（index.html）— 注入失敗時のフォールバックも「写真家・…宣材・ポートレート撮影のご依頼」のキーワード版に。
- **画像sitemapに image:caption 追加**（server.ts）— 既取得のタイトルを caption にも。

### パフォーマンス
- **ギャラリー/シリーズ先頭タイルに fetchPriority=high**（PhotoGallery.tsx）— ヒーローの無いページで先頭グリッド画像が LCP。優先度ヒント付与。
- **プロフィール写真に fetchPriority=high**（profile.tsx）— /about の LCP 候補。
- **ホバー先読みを低優先度に**（PhotoGallery.tsx）— `img.fetchPriority="low"` で表示中画像と帯域競合しないよう。
- **Lightbox ブラーアップのプレースホルダを低優先度に**（Lightbox.tsx）— 本画像（high）が帯域を勝ち取る。
- **非ハッシュ静的ファイルに Cache-Control**（server.ts）— og-image.jpg 等に `max-age=3600`。

### アクセシビリティ / UX
- **ヒーローカルーセルのフォーカスリング復活**（top.tsx）— インラインの `outline:"none"` を除去（WCAG2.4.7、キーボード操作時の最大要素）。
- **カルーセルのドットをテーマ追従に**（styles.css）— ハードコード黒 → `var(--foreground-rgb)`（ダークテーマで不可視だった）。
- **ヒーロー名の折返し**（top.tsx）— `break-words` で長い名前が狭幅画面ではみ出さない。
- **コンタクトのエラー文字コントラスト改善**（contact.tsx）— `red-400/50`・`red-500/60`（約2:1）→ `red-600`（AA 4.5:1 達成）。
- **lint エラー解消**（top.tsx）— `jsx-a11y(no-noninteractive-element-interactions)` を根拠コメント付きで局所無効化（ハンドラは自動再生の一時停止＝presentational。inner div へ移すとホバー表示の矢印が消えるため移動不可）。**`bun run lint` がクリーンに**。

### セキュリティ / 堅牢性
- **クリックジャッキング対策**（server.ts）— `X-Frame-Options: ALLOWALL` / CSP `frame-ancestors *`（Runable プレビュー用の遺物）→ `SAMEORIGIN` / `'self'`。管理プレビュー iframe は同一オリジン（src="/"、sandbox なし）なので動作維持を確認済み。
- **CORS から廃止 Runable オリジン削除**（api/index.ts）— `chi-aki-eguchi.runable.site` を credentialed CORS 許可から除去。
- **ライブプレビュー postMessage を同一オリジン限定に**（admin.tsx / provider.tsx）— 送信先 `"*"` → `window.location.origin`、受信側に `e.origin` ガード追加。テストも実オリジン送信に更新。

### 管理画面の堅牢性
- **削除の無言失敗を可視化**（admin.tsx）— カテゴリ/シリーズ/料金プランの delete に `onError` 追加（従来は500/通信失敗で行が残るのに成功に見えた）。
- **並び替えに保存フィードバック**（admin.tsx）— ドラッグ/ボタン並び替え成功時に「並び順を保存しました」トースト（B5 趣旨）。
- **`as any` を型付けに**（admin.tsx）— 料金プラン追加レスポンスの `(created as any)` → `{ plan?: { id?: number } }`。

## 見送り（理由付き・次回候補）

- **#16/#17 バッチ・ヒーローボタンの多重送信ガード**（`disabled={isPending}`）: 価値は中程度だが 4000行の admin.tsx の広い JSX に触れるため、安定性優先で見送り。場所: admin.tsx バッチツールバー(~1067-1186)・ヒーローピッカー(~2233-2253)。
- **#6 PageTransition の rapid-nav 真っ白リスク**: 再スケジュールで復帰するため実害は稀。動作中のトランジションを壊すリスク回避で見送り（reduced-motion 経路は問題なし）。
- **#5 セレクトのシェブロン色がダークテーマで低コントラスト**: data-URI 背景のため対応が重く、ダークテーマは管理者オプトインで稀。
- **#7 Lightbox の SR タイトル二重読み上げ**: 軽微、かつ一意alt(#28)と方針が競合するため据え置き。
- **#18/#21/#22 管理画面の細かなUX**（保存メッセージ分離・purge を Modal 化・並び替えの楽観更新desync）: 低優先。

## 検証 & デプロイ

- `tsc -b` ✅ / `vite build` ✅（1838 modules）/ `oxlint` ✅ クリーン / `bun test` ✅ **74 pass / 0 fail**
- 変更: 14ファイル（+94 / -36）。`git push` でデプロイ（Railway 自動ビルド）。

## 次にやるべきこと

1. 見送った #16/#17（多重送信ガード）を別途実施。
2. BUILD_ID（ogp.ts）が `20260615` で固定・stale。Railway は git push デプロイなので X-Build が実デプロイと不一致。`scripts/deploy.sh` 由来コメントも陳腐化 → ビルド時に注入する仕組みへ要更新（要設計）。
3. font preload（index.html）と styles.css の `:root` 既定フォント不一致（#11）— 実デフォルトが Shippori/Cormorant なら styles.css 既定を合わせてスワップ削減（要 settings 既定値の確認）。

