import { createContext } from "react";

/** The editor outline lives in the application sidebar; standalone editors keep their own outline. */
export const AdminSettingsNavigationContext = createContext<HTMLElement | null>(null);

/**
 * サイトの骨格。管理画面の形はどちらでも同じで、公開サイトの組み方だけが変わる
 * （2026-09-29 オーナー「骨格を変えたら admin も全部変わってわからない」）。
 */
export type SiteSkeleton = "book" | "classic";

export function siteSkeletonFrom(value: string | null | undefined): SiteSkeleton {
  return value === "book" ? "book" : "classic";
}

/** 設定の節ではなく、独立した編集画面として開く項目。 */
export type SiteOutlineTab =
  | "hero"
  | "profile"
  | "pricing"
  | "service"
  | "categories"
  | "series"
  | "setup";

type OutlineText = {
  ja: string;
  en: string;
  /** どこに効くかの一言（目次で名前の下に出す） */
  noteJa?: string;
  noteEn?: string;
  keywords?: string;
  /** この骨格を選んでいるときだけ公開サイトに効く。値は切り替えても残る。 */
  only?: SiteSkeleton;
  /** 制作案内（Portfolio Kit）を出していないサイトでは目次に出さない */
  service?: true;
};

export type SiteOutlineItem =
  | (OutlineText & { kind: "settings"; id: string })
  | (OutlineText & { kind: "tab"; id: SiteOutlineTab });

export type SiteOutlineGroup = {
  group: string;
  ja: string;
  en: string;
  items: readonly SiteOutlineItem[];
};

/**
 * 管理画面「サイト」の目次の正本（2026-09-29）。公開サイトのどのページが
 * 変わるかの順に並べる。骨格を切り替えても項目は動かさず、その骨格で使わない
 * 項目には札を付けるだけにする（出たり消えたりすると、どこに何があるか分からない）。
 * 設定の節（kind: "settings"）の id は `SETTINGS_SECTION_KEYS` と一致させる。
 */
export const SITE_OUTLINE: readonly SiteOutlineGroup[] = [
  { group: "site", ja: "サイト全体", en: "Whole site", items: [
    { kind: "settings", id: "page-layout", ja: "サイトの骨格", en: "Site structure",
      noteJa: "写真中心／いつもの構成", noteEn: "Photographs-first or classic",
      keywords: "骨格 構成 写真中心 いつもの 写真集 design structure book classic" },
    { kind: "settings", id: "site-basics", ja: "名前・連絡先・検索", en: "Identity, contact & SEO",
      noteJa: "サイト名・問い合わせ先・検索に出る説明", noteEn: "Site name, contact address, search description",
      keywords: "サイト名 問い合わせ メール 説明 URL Google 検索 フォーム email name contact SEO form" },
  ] },
  { group: "home", ja: "トップ", en: "Home page", items: [
    { kind: "settings", id: "home", ja: "トップの形と作家の言葉", en: "Home layout & statement",
      noteJa: "表紙と写真の組み方・作家の言葉の位置", noteEn: "Cover and photographs, where the statement goes",
      keywords: "トップ 表紙 形 ステートメント 言葉 home cover statement" },
    { kind: "tab", id: "hero", ja: "トップの写真と順番", en: "Home photographs",
      noteJa: "「トップに出す」写真の順番・切り抜き", noteEn: "Order and crop of the home photographs",
      keywords: "トップ 写真 順番 表紙 スライド hero photographs order" },
    { kind: "settings", id: "hero", ja: "トップの見せ方", en: "Home hero", only: "classic",
      noteJa: "スライド・高さ・名前の位置", noteEn: "Slides, height, name position",
      keywords: "ヒーロー 高さ タイトル 位置 切り抜き スライド fullscreen crop title" },
  ] },
  { group: "photos", ja: "写真とシリーズ", en: "Photographs & series", items: [
    { kind: "settings", id: "series", ja: "写真の並び順とシリーズの入口", en: "Order & series links",
      noteJa: "並べた順か撮影日の順か・メニューの Series", noteEn: "Manual or by date, the Series menu link",
      keywords: "撮影日 日時 並び順 ソート 新しい 古い シリーズ メニュー manual sort date series" },
    { kind: "settings", id: "viewer", ja: "写真を開いたとき", en: "Photo viewer",
      noteJa: "大きく見るときの壁の色・写真の大きさ", noteEn: "Wall colour and photo size when opened",
      keywords: "ビューア 拡大 壁 余白 額装 viewer lightbox wall mat" },
    { kind: "tab", id: "categories", ja: "分類", en: "Categories",
      noteJa: "写真の分類の名前と順番", noteEn: "Names and order of categories",
      keywords: "分類 カテゴリ category" },
    { kind: "tab", id: "series", ja: "シリーズの詳しい設定", en: "Series details",
      noteJa: "シリーズごとの配色・並び順の上書き", noteEn: "Per-series colours and order overrides",
      keywords: "シリーズ 作品 配色 上書き 価格 series work theme override" },
    { kind: "settings", id: "gallery-layout", ja: "写真一覧のレイアウト", en: "Gallery layout", only: "classic",
      noteJa: "列数・大きさ・シリーズの札・切り抜き", noteEn: "Columns, sizes, series cards, cropping",
      keywords: "列数 サイズ 写真 間隔 余白 グリッド 札 切り抜き gallery grid columns gap card crop" },
  ] },
  { group: "about", ja: "About・Contact", en: "About & Contact", items: [
    { kind: "tab", id: "profile", ja: "About の文章と写真", en: "About text & portrait",
      noteJa: "略歴・顔写真・作家の言葉", noteEn: "Biography, portrait, statement",
      keywords: "プロフィール 略歴 顔写真 ステートメント profile about bio" },
    { kind: "settings", id: "page-parts", ja: "About・Contact の組み方", en: "About & Contact layout",
      noteJa: "写真と文章・説明とフォームの並べ方", noteEn: "How text, portrait and form are arranged",
      keywords: "プロフィール 問い合わせ 構成 並べ方 profile about contact layout" },
    { kind: "settings", id: "cta", ja: "撮影のご依頼の案内", en: "Photography enquiries",
      noteJa: "作品の後に出す Contact への案内", noteEn: "The invitation to Contact after the work",
      keywords: "仕事 撮影 依頼 相談 お問い合わせ CTA" },
  ] },
  { group: "look", ja: "見た目（全ページ）", en: "Look (all pages)", items: [
    { kind: "settings", id: "theme", ja: "背景と配色", en: "Background & colors",
      keywords: "ダーク 明るい 暗い 黒 白 色 light dark theme colour" },
    { kind: "settings", id: "fonts", ja: "書体", en: "Typefaces",
      keywords: "フォント 日本語 英語 セリフ 太さ font typography weight" },
    { kind: "settings", id: "font-size", ja: "文字の大きさ", en: "Text size",
      keywords: "名前 ロゴ 見出し 本文 サイズ font size logo heading" },
    { kind: "settings", id: "font-spacing", ja: "字間と行間", en: "Letter & line spacing",
      keywords: "文字 間隔 tracking leading line height" },
    { kind: "settings", id: "font-color", ja: "文字の色", en: "Text colors",
      keywords: "名前 タイトル 本文 文字色 text color" },
    { kind: "settings", id: "page-frame", ja: "見出しとフッター", en: "Page titles & footer",
      noteJa: "各ページの見出しの型・フッターの並べ方", noteEn: "Page title style, footer arrangement",
      keywords: "見出し タイトル フッター 著作 SNS title heading footer" },
    { kind: "settings", id: "texture", ja: "背景の質感", en: "Background texture",
      keywords: "紙 粒子 テクスチャ texture grain" },
    { kind: "settings", id: "navigation", ja: "メニューとヘッダー", en: "Menu & header", only: "classic",
      keywords: "ナビ 位置 リンク 背景 menu header" },
    { kind: "settings", id: "spacing", ja: "ページの余白", en: "Page spacing", only: "classic",
      keywords: "上下 間隔 セクション margin padding spacing" },
    { kind: "settings", id: "reveal", ja: "写真の表示アニメーション", en: "Photo animation", only: "classic",
      keywords: "動き フェード fade reveal animation" },
    { kind: "settings", id: "mood", ja: "デザインの出発点", en: "Design presets", only: "classic",
      noteJa: "トップ・一覧・メニューをまとめて入れ替える", noteEn: "Swaps home, gallery and menu together",
      keywords: "雰囲気 作風 まとめて プリセット mood style" },
  ] },
  { group: "more", ja: "そのほか", en: "More", items: [
    { kind: "settings", id: "site-copy", ja: "表示する言葉", en: "Labels & messages",
      noteJa: "メニュー・ボタン・フォームの言葉", noteEn: "Menu, button and form wording",
      keywords: "ボタン 文言 メッセージ 翻訳 words labels copy" },
    { kind: "tab", id: "pricing", ja: "料金・プラン", en: "Pricing",
      keywords: "料金 価格 プラン pricing plan" },
    { kind: "tab", id: "service", ja: "制作案内のページ", en: "Portfolio Kit page", service: true,
      keywords: "Portfolio Kit 制作 サービス 案内" },
    { kind: "settings", id: "portfolio-kit", ja: "制作案内への入口", en: "Portfolio Kit visibility", service: true,
      keywords: "Portfolio Kit サービス 制作" },
    { kind: "settings", id: "presets", ja: "カメラ・レンズの候補", en: "Camera & lens presets",
      keywords: "機材 カメラ レンズ プリセット camera lens" },
    { kind: "settings", id: "note", ja: "note の連携", en: "note integration",
      keywords: "記事 ブログ note blog" },
    { kind: "settings", id: "print", ja: "プリント販売", en: "Print sales",
      keywords: "販売 ショップ print shop" },
    { kind: "tab", id: "setup", ja: "はじめに（最初の設定の確認）", en: "Getting started",
      keywords: "はじめに 最初 確認 setup" },
  ] },
];

/** 設定の節だけの目次（設定画面の中の検索・見出し・順番に使う）。 */
export const SETTINGS_NAVIGATION = SITE_OUTLINE.map((group) => ({
  group: group.group,
  ja: group.ja,
  en: group.en,
  items: group.items.filter(
    (item): item is Extract<SiteOutlineItem, { kind: "settings" }> => item.kind === "settings",
  ),
}));

export const settingsNavigationItems = SETTINGS_NAVIGATION.flatMap(group => group.items.map(item => ({
  ...item, keywords: item.keywords ?? "", group: group.group, groupJa: group.ja, groupEn: group.en,
})));

/** 節がどちらの骨格だけで効くか（両方で効く節は undefined）。 */
export function skeletonOnlyForSection(id: string): SiteSkeleton | undefined {
  return settingsNavigationItems.find((item) => item.id === id)?.only;
}

export function previewPageForSection(id: string): string | null {
  if (["hero", "mood", "home", "page-layout"].includes(id)) return "/";
  if (["gallery-layout", "series", "viewer"].includes(id)) return "/gallery";
  if (id === "cta") return "/contact";
  if (id === "page-parts") return "/about";
  return null;
}
