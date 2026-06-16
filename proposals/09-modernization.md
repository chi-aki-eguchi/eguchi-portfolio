# 企画書 #09 — モダン化（2026トレンド最適化）

状態: 一部**実装済**／残りは提案 ／ 起案 2026-06-14（第2周監査 opus から）

## ✅ 今回実装済み（deployゲート通過・ZIP更新済み）
- **画像 AVIF/WebP コンテンツ交渉**（最大の勝ち筋）。`api/index.ts` の画像プロキシに Accept 交渉を追加。
  - 実測: 同一写真 w=1200 で **JPEG 191KB → WebP 103KB(-46%) → AVIF 44KB(-77%)**。写真サイトに極大の効果。
  - **env フラグ `IMAGE_FORMAT_NEGOTIATION=1` でゲート（既定OFF）**。task.md の gzip 教訓に従い、serving層の
    変更は Runable 本番で検証してから有効化する方針。OFF時は従来どおり JPEG・Vary無しで byte互換。
  - format対応キャッシュキー＋`Vary: Accept` 付き。ローカルで avif/webp/jpeg 出し分け・キャッシュHIT・OFF時互換を確認済み。
  - **秋さんの作業**: Runable の環境変数に `IMAGE_FORMAT_NEGOTIATION=1` を設定 → 本番で画像が正しく表示されるか
    （特にプレビュー iframe）確認 → 問題なければ常用。万一崩れたらフラグを外すだけで即復旧。
- **focus-visible アウトライン強化**（a11y）。`styles.css` の alpha 0.12（ほぼ不可視）→ `2px / 0.55`、
  テーマ前景色参照でダーク設定にも追従。WCAG 2.4.11/2.4.13 の可視性を満たす。

## 安全・小（承認あれば実装。挙動ほぼ不変）
- **og:image の寸法/型メタ**: `og:image:width(1200)`/`height(630)`/`type`/`og:image:alt` を付与。
  共有時のカード描画が安定（現状 `twitter:card=summary_large_image` は実装済）。`ogp.ts`/`index.html`。
- **WebSite JSON-LD ノード追加**: 現状 Person + ImageGallery のみ。`@id` 連結＋WebSite で構造化データを充実。`ogp.ts`。
- **PWA manifest（.webmanifest）**: theme-color/apple-touch-icon は有り。manifest を足すとインストール体験/アイコン解決が完全に。
- **theme-color のダーク版**: `prefers-color-scheme: dark` 用の `<meta theme-color>` 追加（小）。

## 提案・要相談（visible-change or リスク）
- **View Transitions API**: 現状の手書きJSフェード(PageTransition)を置換 or 併用。SPA遷移が滑らかに。
  visible-change、ブラウザ差あり。PoC を出してから。
- **scroll-driven animations(CSS)**: reveal を IO+JS から CSS に。負荷減るが見え方が変わる。要PoC。
- **CSP 本格導入**: 現状 frame-ancestors のみ。script/style/img/connect を絞ると堅牢化するが、
  **誤ると正常リソースを止める**ので慎重に（GA4/note/R2 を許可リスト化）。段階導入＋本番検証必須。
- **container queries / color-mix 化**: タイル/SeriesGrid をコンテナ基準に、色を中央トークン化。
  リファクタ寄りで緊急度低。佇まいは不変にできる。

## 第2周監査の扱い（重要）
第2周も Verify が**セッション上限で大半脱落**（"no verdict"）。確定はバグ1件のみ（実装済）。
上記モダン化候補の多くは**未検証**だが、私が現状コードと照合し「既実装でない/価値あり」を確認したものを
安全度順に並べた。**実装は承認後に1つずつ**（git管理外のため一括改変は避ける）。

## 秋さんへの確認
1. AVIF/WebP を Runable で `IMAGE_FORMAT_NEGOTIATION=1` にして検証してよいか（最大の効果）。
2. 「安全・小」の4点はまとめて実装してよいか（og寸法/WebSite JSON-LD/manifest/dark theme-color）。
3. View Transitions / CSP は PoC を見てから判断するか。
