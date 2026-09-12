import { createContext } from "react";

/** The editor outline lives in the application sidebar; standalone editors keep their own outline. */
export const AdminSettingsNavigationContext = createContext<HTMLElement | null>(null);

export const SETTINGS_NAVIGATION = [
  { group: "pages", ja: "ページと写真", en: "Pages & photographs", items: [
    { id: "hero", ja: "トップの見せ方", en: "Home hero", keywords: "ヒーロー 高さ タイトル 位置 切り抜き スライド fullscreen crop title" },
    { id: "gallery-layout", ja: "写真一覧のレイアウト", en: "Gallery layout", keywords: "列数 サイズ 写真 間隔 余白 グリッド gallery grid columns gap" },
    { id: "series", ja: "写真の掲載順", en: "Publication order", keywords: "撮影日 日時 並び順 ソート 新しい 古い manual sort date" },
    { id: "page-layout", ja: "各ページの構成", en: "Page structure", keywords: "プロフィール 問い合わせ フッター About Contact footer" },
    { id: "navigation", ja: "メニューとヘッダー", en: "Menu & header", keywords: "ナビ 位置 リンク 背景 menu header" },
  ] },
  { group: "design", ja: "色と文字", en: "Color & typography", items: [
    { id: "mood", ja: "デザインの出発点", en: "Design presets", keywords: "雰囲気 作風 まとめて プリセット mood style" },
    { id: "theme", ja: "背景と配色", en: "Background & colors", keywords: "ダーク 明るい 暗い 黒 白 色 light dark theme colour" },
    { id: "fonts", ja: "書体", en: "Typefaces", keywords: "フォント 日本語 英語 セリフ font typography" },
    { id: "font-size", ja: "文字の大きさ", en: "Text size", keywords: "名前 ロゴ 見出し 本文 サイズ font size logo heading" },
    { id: "font-spacing", ja: "字間と行間", en: "Letter & line spacing", keywords: "文字 間隔 tracking leading line height" },
    { id: "font-color", ja: "文字の色", en: "Text colors", keywords: "名前 タイトル 本文 文字色 text color" },
    { id: "spacing", ja: "ページの余白", en: "Page spacing", keywords: "上下 間隔 セクション margin padding spacing" },
  ] },
  { group: "content", ja: "文章と連絡先", en: "Content & contact", items: [
    { id: "site-basics", ja: "名前・連絡先・検索", en: "Identity, contact & SEO", keywords: "サイト名 問い合わせ メール 説明 URL Google 検索 email name contact SEO" },
    { id: "site-copy", ja: "表示する言葉", en: "Labels & messages", keywords: "ボタン 文言 メッセージ 翻訳 words labels copy" },
    { id: "cta", ja: "撮影依頼への案内", en: "Photography enquiries", keywords: "仕事 撮影 依頼 相談 お問い合わせ CTA" },
  ] },
  { group: "extras", ja: "動きと連携", en: "Motion & connections", items: [
    { id: "reveal", ja: "写真の表示アニメーション", en: "Photo animation", keywords: "動き フェード fade reveal animation" },
    { id: "texture", ja: "背景の質感", en: "Background texture", keywords: "紙 粒子 テクスチャ texture grain" },
    { id: "note", ja: "noteの連携", en: "note integration", keywords: "記事 ブログ note blog" },
    { id: "print", ja: "プリント販売", en: "Print sales", keywords: "販売 ショップ print shop" },
    { id: "portfolio-kit", ja: "制作サービスの表示", en: "Portfolio Kit visibility", keywords: "Portfolio Kit サービス 制作" },
    { id: "presets", ja: "カメラ・レンズの候補", en: "Camera & lens presets", keywords: "機材 カメラ レンズ プリセット camera lens" },
  ] },
] as const;

export const settingsNavigationItems = SETTINGS_NAVIGATION.flatMap(group => group.items.map(item => ({
  ...item, group: group.group, groupJa: group.ja, groupEn: group.en,
})));

export function previewPageForSection(id: string): string | null {
  if (["hero", "mood"].includes(id)) return "/";
  if (["gallery-layout", "series"].includes(id)) return "/gallery";
  if (id === "cta") return "/contact";
  if (id === "page-layout") return "/about";
  return null;
}
