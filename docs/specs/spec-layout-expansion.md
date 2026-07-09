# レイアウト拡張仕様書 - Claude Design案の実装

作成日: 2026-06-18
最終更新: 2026-06-19
参照デザイン: `/Users/chiaki/Downloads/ポートフォリオサイトの改善/Portfolio Redesign.dc.html`（Claude Designが生成したHTMLモックアップ）

> 2026-06-19 Codex 更新: Phase 1 のギャラリー3レイアウトは実装・検証・push済み。
> Home 3案とナビ/フィルター改善は未実装。次フェーズで進める。

---

## 概要

Claude Designが提案した6つのレイアウト案（ホーム3 × ギャラリー3）を段階的に実装し、管理画面から切り替えられるようにする。

**重要**: 参照HTMLを最初に読み、各レイアウトのHTML/CSSを忠実に再現すること。色付き矩形は写真プレースホルダーであり、実際の写真データに置き換えること。

現状:
- Phase 1: ギャラリー3レイアウト実装済み（commit `941b4ff`）
- Phase 1 デバッグ: Codex + Claude で P0/P1 なしを確認済み（commit `a4fd544`）
- Phase 2: ホーム3レイアウト未実装
- Phase 3: ナビゲーション・フィルター改善未実装

---

## 新レイアウト一覧

### ホームページ（3案）

#### Home A - 静謐なグリッド（quiet-grid）
HTMLモックアップ内「A — 静謐なグリッド」セクションを参照。
- 左サイドバー維持（現在のサイト構成と同じ）
- サイドバーに現在地インジケーター（横線）を追加
- ファーストビューに大きなヒーロー写真（フルワイド、高さ280px相当）
- ヒーロー上に名前「江口 秋」+ 「Photography」をオーバーレイ
- その下にクリーンな3カラム均一グリッド（gap: 5px、aspect-ratio: 1）
- SNSリンクをサイドバー下部に統合
- 装飾一切なし

#### Home B - エディトリアル（editorial）
HTMLモックアップ内「B — エディトリアル」セクションを参照。
- サイドバーではなく**横ナビゲーション**に変更（上部水平バー）
- ロゴ左、ナビリンク右の配置
- スプリットヒーロー：左55%に写真、右45%に名前・ステートメント
- ヒーロー下に大小リズムのグリッド
  - 1行目: 1.6fr + 1fr + 1fr（左大、右2つ小）
  - 2行目: 1fr + 1fr + 1.6fr（左2つ小、右大）
- 全体的に雑誌的な非対称レイアウト

#### Home C - 没入型（immersive）
HTMLモックアップ内「C — 没入型」セクションを参照。
- フルスクリーン写真（viewport 100%）
- 極細サイドバー（幅50px程度）— ロゴと最小限のナビのみ
- 写真の上にセンター配置で名前
- スクロールで写真がフェードし、コンテンツが現れる
- 下部に2カラム大判のWorks表示

### ギャラリーページ（3案）

#### Gallery A - クリーングリッド（clean-grid）

実装済み: `packages/web/src/web/components/PhotoGallery.tsx`

HTMLモックアップ内「A — クリーングリッド」セクションを参照。
- ポラロイド風の回転・白枠を完全排除
- 隙間なし（gap: 2px）の4カラムグリッド
- aspect-ratio: 1（正方形）
- フィルタータブ（All / Film / Digital）に明確なアクティブ状態（下線 1.5px solid）
- 装飾ゼロ、写真そのものが主役

#### Gallery B - マソンリー（masonry）

実装済み: `packages/web/src/web/components/PhotoGallery.tsx`

HTMLモックアップ内「B — マソンリー」セクションを参照。
- 3カラムのマソンリーレイアウト
- 各写真の縦横比をそのまま維持（aspect-ratioを写真の実データから取得）
- gap: 8px
- Pinterest的だがミニマルなトーン
- ホバー時にタイトル表示（オーバーレイ）

#### Gallery C - 大判フォーマット（large-format）

実装済み: `packages/web/src/web/components/PhotoGallery.tsx`

HTMLモックアップ内「C — 大判フォーマット」セクションを参照。
- 2カラム大判（gap: 20px）
- 各写真の下にキャプション表示
  - 1行目: タイトル（10px、#1a1a1a）
  - 2行目: 媒体（Film/Digital）— 年（9px、#bbb）
- ギャラリーというより「展示」の体験
- 写真家らしい丁寧な見せ方

---

## 管理画面の設定UI

### ホームレイアウト選択
Settings タブ → ホームセクションに追加:
```
ホームレイアウト: [ドロップダウン]
  - フルスクリーン（現在のデフォルト）
  - カルーセル（既存）
  - 静謐なグリッド（quiet-grid）    ← 新規
  - エディトリアル（editorial）      ← 新規
  - 没入型（immersive）              ← 新規
```

### ギャラリーレイアウト選択
Settings タブ → ギャラリーセクションの既存レイアウトドロップダウンに追加:
```
ギャラリーレイアウト: [ドロップダウン]
  - mosaic（既存）
  - grid（既存）
  - scroll（既存）
  - stagger（既存）
  - editorial（既存）
  - collage（既存）
  - clean-grid（4列均一）            ← 新規
  - masonry（3列マソンリー）         ← 新規
  - large-format（2列大判+キャプション） ← 新規
```

---

## 共通デザイン仕様（HTMLモックアップから抽出）

### フォント
- ロゴ・見出し: `'Cormorant Garamond', Georgia, serif`（既存と同じ）
- 本文・ナビ: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`

### 色
- 背景: `#fafaf9`（サイドバー）/ `#fff`（メインコンテンツ）
- テキスト: `#1a1a1a`（本文）/ `#aaa`（非アクティブナビ）/ `#bbb`（キャプション副情報）
- ボーダー: `#f0efed`（セクション区切り）
- アクティブインジケーター: `#1a1a1a`（下線 1.5px）

### サイドバーのナビゲーション改善（全レイアウト共通）
- 現在ページに横線インジケーター（width: 12px、height: 1px、background: #1a1a1a）を追加
- アクティブ項目は font-weight: 500、color: #1a1a1a
- 非アクティブ項目は color: #aaa、padding-left: 18px（インデント）

### フィルタータブの改善（全ギャラリーレイアウト共通）
- アクティブタブ: color: #1a1a1a、font-weight: 500、border-bottom: 1.5px solid #1a1a1a
- 非アクティブタブ: color: #bbb

---

## DBスキーマ変更

なし。既存の settings テーブルの layout 値の選択肢を拡張するだけ。

Phase 1 では新規 settings key は追加していない。既存の `galleryLayout` / `seriesLayout` / `topWorksLayout` の値として `clean-grid` / `masonry` / `large-format` を追加した。

---

## 実装手順

### Phase 1: ギャラリーの新レイアウト3種 - 完了

- [x] 参照HTMLを読む
- [x] `clean-grid` / `masonry` / `large-format` を実装
- [x] `galleryLayout` / `seriesLayout` / `topWorksLayout` の選択肢に追加
- [x] Series 個別 layout 選択肢に追加
- [x] `PhotoGallery.render.test.tsx` を 9 layout 対応に更新
- [x] `git push`

検証済み:
- `cd packages/web && bun x tsc -b`
- `cd packages/web && bun run build`
- `cd packages/web && bun test ./src`
- `cd packages/web && bun run lint`
- ローカル/本番 `/gallery` smoke

### Phase 2: ホームの新レイアウト3種 - 未実装

- [ ] `quiet-grid` / `editorial` / `immersive` の3コンポーネントを実装
- [ ] `homeLayout` の選択肢に追加
- [ ] 管理画面ドロップダウンに追加
- [ ] レスポンシブ確認
- [ ] `git push`

### Phase 3: ナビゲーション・フィルターの改善 - 未実装

- [ ] サイドバーの現在地インジケーターを追加
- [ ] フィルタータブのアクティブ状態を改善
- [ ] `git push`

---

## 注意事項

- **HTMLモックアップを忠実に再現すること** - 色・フォント・サイズ・gap・aspect-ratio等の値はモックアップから正確に読み取る
- 色付き矩形（background: #8c7b6e 等）はプレースホルダー。実際の写真データに置き換える
- Home B（エディトリアル）は横ナビになるため、他のレイアウトとナビ構造が異なる。レイアウトに応じてナビコンポーネントを切り替える設計にすること
- 既存レイアウトは一切変更しない（追加のみ）
- レスポンシブ対応: モバイルではカラム数を減らす（4列→2列、3列→2列、2列→1列）

---

## Phase 4: 2026-07-09 拡張（9種→11種）- 完了

オーナーから「クリーングリッドをInstagram風の正方形に直し、グリッド方式を
明確にして種類を増やしてほしい」という要望を受け、codex-reviewer 経由で
実装依頼→Claude Code(Sonnet)実装→オーナー承認確認、という流れで実施。

- [x] `clean-grid` の正方形化バグ修正（外枠 `.photo-card` が元写真の縦横比を
      持ったままだった。`tile()` に `cardAspectRatio` オプションを追加）
- [x] `grid` → 表示名「写真比率グリッド」、`clean-grid` → 表示名「正方形グリッド」
      に変更。常時見える一行説明を追加
- [x] admin Settings→ギャラリー配置UIを、Gallery/Series/Top 3反復の9択から
      「対象ページ切替＋カテゴリ分け(整列グリッド/写真集レイアウト)＋
      配置図付き1組の一覧」に再構成
- [x] 新規レイアウト `portrait-grid`（4:5・人物写真向け）と
      `landscape-grid`（3:2・風景写真向け）を追加、9種→11種に拡張
      （`.claude/rules/react-components.md` 等の9種固定ルールをオーナー承認の上で改定）
- [x] `GalleryLayoutType` / `KNOWN_LAYOUTS` / `GALLERY_LAYOUT_OPTIONS` /
      `LAYOUT_ICON_RECTS` / 全レイアウト render test を11種に更新
- [x] 正本ドキュメント同期: `AGENTS.md`, root `CLAUDE.md`, `packages/web/CLAUDE.md`,
      `.claude/rules/react-components.md`, `.claude/skills/gallery-feature/SKILL.md`,
      `packages/web/src/web/lib/service-config.ts`
- [ ] `git push`（オーナーの手で実施）

検証済み:
- `bun run check`（typecheck / lint / test / build）
- `bun run smoke`（admin に触れたため）
- `PhotoGallery.render.test.tsx` に clean-grid / portrait-grid / landscape-grid の
  外枠アスペクト比回帰テストを追加
- 実ブラウザで新admin UIをPC/スマホでスクリーンショット確認
