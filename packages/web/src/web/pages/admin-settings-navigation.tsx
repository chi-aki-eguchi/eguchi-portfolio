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

/**
 * 設定の節（`SETTINGS_SECTION_KEYS` の id）の名前と探すための言葉。
 * 設定画面の見出し・検索・変更の印に使う。節は「もの」ごと（名前・メニュー・見出し…）。
 */
export const SETTINGS_NAVIGATION = [
  { group: "site", ja: "サイト全体", en: "Whole site", items: [
    { id: "page-layout", ja: "サイトの骨格", en: "Site structure", keywords: "骨格 構成 写真中心 いつもの 写真集 design structure book classic" },
    { id: "site-basics", ja: "検索とシェア", en: "Search & sharing", keywords: "説明 URL Google 検索 シェア SNS SEO search share description" },
    { id: "portfolio-kit", ja: "制作案内への入口", en: "Portfolio Kit visibility", keywords: "Portfolio Kit サービス 制作" },
  ] },
  { group: "parts", ja: "ページの部分", en: "Page parts", items: [
    { id: "name", ja: "名前", en: "Name", keywords: "名前 サイト名 肩書き 大きさ 太さ 字間 色 name title logo" },
    { id: "navigation", ja: "メニュー", en: "Menu", keywords: "メニュー ナビ 入口 リンク 名前 位置 背景 Series Work menu header navigation" },
    { id: "home", ja: "トップの形", en: "Home layout", only: "book", keywords: "トップ 表紙 形 home cover" },
    { id: "hero", ja: "トップの写真の見せ方", en: "Home hero", only: "classic", keywords: "ヒーロー 高さ タイトル 位置 切り抜き スライド fullscreen crop title" },
    { id: "statement-text", ja: "作家の言葉の文", en: "Statement text", keywords: "作家の言葉 ステートメント 文章 statement" },
    { id: "statement", ja: "作家の言葉の位置", en: "Statement placement", keywords: "作家の言葉 ステートメント 位置 トップ statement" },
    { id: "top-works", ja: "トップの作品の並び", en: "Home work grid", only: "classic", keywords: "トップ 作品 列数 枚数 選ぶ 並べ方 top works grid" },
    { id: "series-strip", ja: "シリーズの帯", en: "Series strip", only: "classic", keywords: "シリーズ 帯 流れる 速さ 高さ strip marquee" },
    { id: "cta", ja: "撮影のご依頼", en: "Photography enquiries", keywords: "仕事 撮影 依頼 相談 お問い合わせ 案内 CTA" },
    { id: "gallery-layout", ja: "写真の並べ方", en: "Photo layout", only: "classic", keywords: "列数 サイズ 写真 間隔 余白 グリッド 並べ方 gallery grid columns gap" },
    { id: "order", ja: "並び順", en: "Order", keywords: "撮影日 日時 並び順 ソート 新しい 古い 順番 manual sort date order" },
    { id: "viewer", ja: "写真を開いたとき", en: "Photo viewer", keywords: "ビューア 拡大 壁 余白 額装 viewer lightbox wall mat" },
    { id: "series-cards", ja: "シリーズの札", en: "Series cards", only: "classic", keywords: "シリーズ 札 表紙 列数 切り抜き series cards cover crop" },
    { id: "series-layout", ja: "作品ページの並べ方", en: "Work page layout", only: "classic", keywords: "作品 シリーズ ページ 写真 並べ方 series page layout" },
    { id: "about", ja: "About の文章と写真", en: "About text & portrait", keywords: "プロフィール 略歴 自己紹介 顔写真 名前 機材 SNS インスタ profile about bio portrait" },
    { id: "about-layout", ja: "About の組み方", en: "About layout", keywords: "プロフィール 構成 並べ方 写真 profile about layout" },
    { id: "contact", ja: "連絡先と案内", en: "Contact details", keywords: "問い合わせ メール 送信先 フォーム 地域 流れ 案内 email contact form" },
    { id: "contact-layout", ja: "Contact の組み方", en: "Contact layout", keywords: "お問い合わせ 構成 並べ方 contact layout" },
    { id: "contact-words", ja: "フォームの言葉", en: "Form wording", keywords: "フォーム 入力欄 ボタン 送信 件名 完了 form labels button" },
    { id: "headings", ja: "見出し", en: "Headings", keywords: "見出し 小見出し タイトル 大きさ 字間 行間 heading title" },
    { id: "site-copy", ja: "ページの言葉", en: "Page words", keywords: "見出し すべて見る すべて 文言 ラベル words labels copy" },
    { id: "footer", ja: "フッター", en: "Footer", keywords: "フッター 著作 SNS クレジット footer copyright credit" },
  ] },
  { group: "look", ja: "全体の見た目", en: "Overall look", items: [
    { id: "fonts", ja: "書体", en: "Typefaces", keywords: "フォント 日本語 英語 セリフ font typography" },
    { id: "body", ja: "本文とリンク", en: "Body text & links", keywords: "本文 文字 大きさ 太さ 字間 行間 リンク body text link" },
    { id: "theme", ja: "色と背景", en: "Colours & background", keywords: "ダーク 明るい 暗い 黒 白 色 差し色 紙 質感 テクスチャ light dark theme colour texture" },
    { id: "mood", ja: "デザインの出発点", en: "Design presets", only: "classic", keywords: "雰囲気 作風 まとめて プリセット mood style" },
    { id: "spacing", ja: "ページの余白", en: "Page spacing", only: "classic", keywords: "上下 間隔 セクション margin padding spacing" },
    { id: "reveal", ja: "写真の表示アニメーション", en: "Photo animation", only: "classic", keywords: "動き フェード fade reveal animation" },
  ] },
  { group: "more", ja: "そのほか", en: "More", items: [
    { id: "presets", ja: "カメラ・レンズの候補", en: "Camera & lens presets", keywords: "機材 カメラ レンズ プリセット camera lens" },
    { id: "note", ja: "note の連携", en: "note integration", keywords: "記事 ブログ Journal note blog" },
    { id: "print", ja: "プリント販売", en: "Print sales", keywords: "販売 ショップ print shop" },
  ] },
] as const satisfies readonly {
  group: string;
  ja: string;
  en: string;
  items: readonly { id: string; ja: string; en: string; keywords: string; only?: SiteSkeleton }[];
}[];

export const settingsNavigationItems = SETTINGS_NAVIGATION.flatMap(group => group.items.map(item => ({
  ...item, only: ("only" in item ? item.only : undefined) as SiteSkeleton | undefined,
  group: group.group, groupJa: group.ja, groupEn: group.en,
})));

/** 節がどちらの骨格だけで効くか（両方で効く節は undefined）。 */
export function skeletonOnlyForSection(id: string): SiteSkeleton | undefined {
  return settingsNavigationItems.find((item) => item.id === id)?.only;
}

export function previewPageForSection(id: string): string | null {
  if (["hero", "mood", "home", "statement", "statement-text", "page-layout", "name", "top-works", "series-strip"].includes(id)) return "/";
  if (["gallery-layout", "order", "viewer"].includes(id)) return "/gallery";
  if (["series-cards", "series-layout"].includes(id)) return "/series";
  if (["about", "about-layout", "note", "print"].includes(id)) return "/about";
  if (["contact", "contact-layout", "contact-words", "cta"].includes(id)) return "/contact";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 「サイト」の画面（2026-09-29 作り直し）。公開サイトを大きく見ながら、変えたい所を
// 押して直す。長い目次（32項目）をやめ、ページごとに「そこにあるもの」だけを並べる。
// ─────────────────────────────────────────────────────────────────────────────

/** 見ながら直す「部分」。公開サイトの要素の `data-edit` と同じ id を使う。 */
export type SitePart = {
  id: string;
  ja: string;
  en: string;
  /** どこが変わるかの一言 */
  noteJa?: string;
  noteEn?: string;
  /** 一緒に出す設定の節（骨格で変わるときは bySkeleton） */
  sections?: readonly string[];
  bySkeleton?: Partial<Record<SiteSkeleton, readonly string[]>>;
  /** 独立した編集画面（About の文章・料金など）を開く */
  tab?: SiteOutlineTab;
  /** 設定の下に出す、関係する編集画面への入口 */
  links?: readonly { ja: string; en: string; tab: SiteOutlineTab }[];
  /** この骨格のときだけ公開サイトにある部分 */
  only?: SiteSkeleton;
  /** 制作案内（Portfolio Kit）を出していないサイトでは出さない */
  service?: true;
  keywords?: string;
};

export const SITE_PARTS = {
  name: { id: "name", ja: "名前", en: "Name", noteJa: "表示する名前・大きさ・太さ・色", noteEn: "Text, size, weight, colour", sections: ["name"] },
  menu: { id: "menu", ja: "メニュー", en: "Menu", noteJa: "メニューの言葉・入口・文字", noteEn: "Menu words, links and type", sections: ["navigation"], keywords: "ナビ 入口 Series Work" },
  footer: { id: "footer", ja: "フッター", en: "Footer", noteJa: "ページの終わりの言葉・SNS・クレジット", noteEn: "Closing words, social links, credit", sections: ["footer"], keywords: "SNS クレジット 著作" },
  "top-photos": {
    id: "top-photos", ja: "トップの写真", en: "Home photographs",
    noteJa: "表紙と写真の見せ方", noteEn: "Cover and how the photos appear",
    bySkeleton: { book: ["home"], classic: ["hero"] },
    links: [{ ja: "トップに出す写真と順番を変える", en: "Choose and order home photographs", tab: "hero" }],
  },
  statement: {
    id: "statement", ja: "作家の言葉", en: "Statement", noteJa: "文と、トップのどこに置くか", noteEn: "The text, and where it sits on the home page",
    sections: ["statement-text", "statement"],
  },
  works: { id: "works", ja: "作品の並び", en: "Work grid", only: "classic", noteJa: "トップに並べる作品と組み方", noteEn: "Which works appear on the home page, and how", sections: ["top-works"] },
  "series-strip": { id: "series-strip", ja: "シリーズの帯", en: "Series strip", only: "classic", noteJa: "トップに流れるシリーズの帯", noteEn: "The moving series strip", sections: ["series-strip"] },
  cta: { id: "cta", ja: "撮影のご依頼", en: "Photography enquiries", noteJa: "作品の後の Contact への案内", noteEn: "Invitation to Contact after the work", sections: ["cta"] },
  "page-title": { id: "page-title", ja: "ページの見出し", en: "Page heading", noteJa: "見出しの形・大きさ・言葉", noteEn: "Heading style, size and words", sections: ["headings", "site-copy"] },
  "gallery-photos": { id: "gallery-photos", ja: "写真の並べ方", en: "Photo layout", only: "classic", noteJa: "並べ方・列数・大きさ・余白", noteEn: "Layout, columns, sizes, gaps", sections: ["gallery-layout"] },
  order: { id: "order", ja: "並び順", en: "Order", noteJa: "並べた順か、撮影日の順か", noteEn: "Manual or by date", sections: ["order"] },
  viewer: { id: "viewer", ja: "写真を開いたとき", en: "Photo viewer", noteJa: "大きく見るときの壁の色・写真の大きさ", noteEn: "Wall colour and photo size", sections: ["viewer"] },
  "series-cards": { id: "series-cards", ja: "シリーズの札", en: "Series cards", only: "classic", noteJa: "表紙と題名の組み方・列数", noteEn: "Cover, title and columns", sections: ["series-cards"] },
  "series-layout": { id: "series-layout", ja: "作品ページの並べ方", en: "Work page layout", only: "classic", noteJa: "シリーズを開いたときの写真の並べ方", noteEn: "How photographs sit on a series page", sections: ["series-layout"] },
  about: { id: "about", ja: "About の文章と写真", en: "About text & portrait", noteJa: "略歴・顔写真・作家の言葉・SNS", noteEn: "Biography, portrait, statement, social links", sections: ["about", "statement-text"] },
  "about-layout": { id: "about-layout", ja: "About の組み方", en: "About layout", noteJa: "写真と文章の並べ方", noteEn: "How portrait and text sit", sections: ["about-layout"] },
  "contact-info": { id: "contact-info", ja: "連絡先と案内", en: "Contact details", noteJa: "メール・フォームの送信先・案内の文章", noteEn: "Email, form endpoint, intro text", sections: ["contact"] },
  "contact-layout": { id: "contact-layout", ja: "Contact の組み方", en: "Contact layout", noteJa: "説明とフォームの並べ方", noteEn: "How text and form sit", sections: ["contact-layout"] },
  "contact-words": { id: "contact-words", ja: "フォームの言葉", en: "Form wording", noteJa: "入力欄とボタンの言葉", noteEn: "Field and button labels", sections: ["contact-words"] },
  pricing: { id: "pricing", ja: "料金・プラン", en: "Pricing", noteJa: "Contact に出す料金の表", noteEn: "The price list on Contact", tab: "pricing" },
  note: { id: "note", ja: "note の記事", en: "note posts", noteJa: "About に最新の記事を出す", noteEn: "Latest posts on About", sections: ["note"] },
  print: { id: "print", ja: "プリント販売", en: "Print sales", noteJa: "About にプリントの案内を出す", noteEn: "Print sales link on About", sections: ["print"] },
  // 全体の見た目
  fonts: { id: "fonts", ja: "書体", en: "Typefaces", noteJa: "日本語と英語の書体", noteEn: "Japanese and English typefaces", sections: ["fonts"] },
  body: { id: "body", ja: "本文とリンク", en: "Body text & links", noteJa: "文字全体の大きさ・行間・リンク", noteEn: "Overall size, line height, links", sections: ["body"] },
  headings: { id: "headings", ja: "見出し", en: "Headings", noteJa: "各ページの見出しと小見出し", noteEn: "Page headings and small headings", sections: ["headings"] },
  theme: { id: "theme", ja: "色と背景", en: "Colours & background", noteJa: "背景・文字・差し色・紙の質感", noteEn: "Background, text, accent, texture", sections: ["theme"] },
  structure: { id: "structure", ja: "サイトの骨格", en: "Site structure", noteJa: "写真中心／いつもの構成", noteEn: "Photographs-first or classic", sections: ["page-layout"] },
  mood: { id: "mood", ja: "デザインの出発点", en: "Design presets", only: "classic", noteJa: "トップ・一覧・メニューをまとめて入れ替える", noteEn: "Swaps home, gallery and menu together", sections: ["mood"] },
  spacing: { id: "spacing", ja: "ページの余白", en: "Page spacing", only: "classic", noteJa: "トップ・各ページの上下の間隔", noteEn: "Space above and between sections", sections: ["spacing"] },
  reveal: { id: "reveal", ja: "写真の表示アニメーション", en: "Photo animation", only: "classic", noteJa: "写真が画面に入るときの動き", noteEn: "How photographs appear as you scroll", sections: ["reveal"] },
  // そのほか
  "site-basics": { id: "site-basics", ja: "検索とシェア", en: "Search & sharing", noteJa: "検索結果・SNS で出る説明と公開 URL", noteEn: "Description for search and sharing, public URL", sections: ["site-basics"] },
  "site-copy": { id: "site-copy", ja: "ページの言葉", en: "Page words", noteJa: "見出し・「すべて見る」などの言葉", noteEn: "Headings and link words", sections: ["site-copy"] },
  "hero-photos": { id: "hero-photos", ja: "トップの写真と順番", en: "Home photographs", noteJa: "「トップに出す」写真の順番・切り抜き", noteEn: "Order and crop of home photographs", tab: "hero" },
  categories: { id: "categories", ja: "分類", en: "Categories", noteJa: "写真の分類の名前と順番", noteEn: "Names and order of categories", tab: "categories" },
  "series-details": { id: "series-details", ja: "シリーズの詳しい設定", en: "Series details", noteJa: "シリーズごとの配色・並び順の上書き", noteEn: "Per-series colour and order overrides", tab: "series" },
  service: { id: "service", ja: "制作案内のページ", en: "Portfolio Kit page", noteJa: "制作案内（Portfolio Kit）の文章と料金", noteEn: "Portfolio Kit page text and price", tab: "service", service: true },
  "portfolio-kit": { id: "portfolio-kit", ja: "制作案内への入口", en: "Portfolio Kit visibility", noteJa: "制作案内へのリンクを出すか", noteEn: "Whether to link to the Portfolio Kit page", sections: ["portfolio-kit"], service: true },
  presets: { id: "presets", ja: "カメラ・レンズの候補", en: "Camera & lens presets", noteJa: "写真の情報に入れる機材の候補", noteEn: "Equipment suggestions for photo details", sections: ["presets"] },
  setup: { id: "setup", ja: "はじめに（最初の設定の確認）", en: "Getting started", noteJa: "公開までにやることの確認", noteEn: "What to do before publishing", tab: "setup" },
} as const satisfies Record<string, SitePart>;

export type SitePartId = keyof typeof SITE_PARTS;

export type SitePageId = "top" | "gallery" | "series" | "about" | "contact";

/** 公開サイトのページと、そこにある部分（上から見える順）。 */
export const SITE_PAGES: readonly { id: SitePageId; path: string; ja: string; en: string; parts: readonly SitePartId[] }[] = [
  { id: "top", path: "/", ja: "トップ", en: "Home", parts: ["name", "top-photos", "statement", "works", "series-strip", "cta", "menu", "footer"] },
  { id: "gallery", path: "/gallery", ja: "Gallery", en: "Gallery", parts: ["page-title", "gallery-photos", "order", "viewer", "menu", "footer"] },
  { id: "series", path: "/series", ja: "Series", en: "Series", parts: ["page-title", "series-cards", "series-layout", "order", "menu", "footer"] },
  { id: "about", path: "/about", ja: "About", en: "About", parts: ["about", "about-layout", "note", "print", "page-title", "menu", "footer"] },
  { id: "contact", path: "/contact", ja: "Contact", en: "Contact", parts: ["contact-info", "contact-layout", "contact-words", "pricing", "page-title", "menu", "footer"] },
];

/** 「全体の見た目」と「そのほか」に並べる部分。 */
export const SITE_LOOK_PARTS: readonly SitePartId[] = ["fonts", "body", "headings", "theme", "structure", "mood", "spacing", "reveal"];
export const SITE_MORE_PARTS: readonly SitePartId[] = ["site-basics", "site-copy", "hero-photos", "series-details", "categories", "service", "portfolio-kit", "presets", "setup"];

/** 部分が今の骨格で出す設定の節。 */
export function sectionsForPart(part: SitePart, skeleton: SiteSkeleton): readonly string[] {
  return part.bySkeleton?.[skeleton] ?? part.sections ?? [];
}

/** 今の骨格・制作案内の表示で、その部分を並べるか。 */
export function partIsListed(part: SitePart, skeleton: SiteSkeleton, showService: boolean): boolean {
  if (part.service && !showService) return false;
  return !part.only || part.only === skeleton;
}
