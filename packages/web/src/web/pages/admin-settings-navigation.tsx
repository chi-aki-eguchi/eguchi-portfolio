import { createContext } from "react";
import { BOOK_DESIGN_ENABLED } from "../lib/site-design-flag";
import { developDoorCopy, isDevelopDesignValue, type DevelopDoorCopy } from "../../shared/develop-structure";

/** The editor outline lives in the application sidebar; standalone editors keep their own outline. */
export const AdminSettingsNavigationContext = createContext<HTMLElement | null>(null);

/**
 * サイトの骨格。管理画面の形はどちらでも同じで、公開サイトの組み方だけが変わる
 * （2026-09-29 オーナー「骨格を変えたら admin も全部変わってわからない」）。
 */
export type SiteSkeleton = "book" | "classic";

export function siteSkeletonFrom(value: string | null | undefined): SiteSkeleton {
  // 写真中心は 2026-09-30 に止めた（`lib/site-design-flag.ts`）。管理画面も いつもの構成 だけ。
  return BOOK_DESIGN_ENABLED && value === "book" ? "book" : "classic";
}

/**
 * 公開サイトの構成（2026-11-12）。本番は 2026-10-12 から新しい構成（develop）で、
 * トップ（見開き）／Portrait／Works／Info／展示／東京プラン。ところが「サイト」の並びは
 * 今までの構成（トップ／Gallery／Series／About／Contact）のままで、オーナーが
 * 「何がどこにあるかわからない」と困った（spec admin-redesign-20261112 §2.1）。
 * 骨格（写真中心かどうか）とは別の軸。写真中心は止めてあり、骨格はいつも classic。
 */
export type SiteStructure = "develop" | "classic";

export function siteStructureFrom(siteDesign: string | null | undefined): SiteStructure {
  return isDevelopDesignValue(siteDesign) ? "develop" : "classic";
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
 * 設定の節と、その節が持つ設定のキー（2026-11-12 に admin-tabs.tsx から移した。探す欄が
 * 欄の名前を引くのに、重い設定画面を読み込まずに使えるように）。admin-tabs.tsx から
 * 同じ名前で読み直している。
 */
export const SETTINGS_SECTION_KEYS = {
  // 節は「公開サイトの部分」ごと（2026-09-30）。管理画面「サイト」で部分を開くと、
  // その部分の節だけが出る。以前は1つの節に別の部分の設定が混ざっていて、
  // 「メニュー」を開くと効かない設定が先に並び、「並び順」を開くとシリーズの列数が出た。
  // 検索とシェア（サイトの説明・公開URL）。
  "site-basics": ["siteDescription", "siteUrl", "googleSiteVerification"],
  // Contact の連絡先と案内の文章・フォームの送信先。
  contact: [
    "contactIntro",
    "contactIntroEn",
    "contactNote",
    "contactNoteEn",
    "contactFlow",
    "contactFlowEn",
    "contactAreas",
    "contactAreasEn",
    "contactEnglishNote",
    "contactMessagePlaceholder",
    "contactEmail",
    "formspreeUrl",
  ],
  // Contact のフォームの言葉。
  "contact-words": [
    "contactFormName",
    "contactFormEmail",
    "contactFormSubject",
    "contactSubjectOptions",
    "contactFormMessage",
    "contactSendButton",
    "contactSendingButton",
    "contactSentMessage",
    "contactSendAnother",
    "contactErrorMessage",
  ],
  "portfolio-kit": ["servicePageMode"],
  hero: [
    "heroMode",
    "heroRandom",
    "heroMotionSpeed",
    "heroRevealOrder",
    "heroHeight",
    "heroOverlay",
    "heroDisplayMode",
    "heroTitlePosition",
    "heroScrollEffect",
  ],
  // メニュー。文字と各ページの入口はどちらの骨格でも効く。位置・帯の背景はいつもの構成だけ。
  navigation: [
    "navLabelTop",
    "navLabelGallery",
    "navLabelAbout",
    "navLabelContact",
    "seriesNavEnabled",
    "workNavEnabled",
    "navLabelWork",
    "navSize",
    "navTracking",
    "navOpacity",
    "navPosition",
    "navHoverEffect",
    "headerBackground",
  ],
  spacing: [
    "spacingHeroBottom",
    "spacingSectionGap",
    "spacingPageTop",
    "spacingFooterTop",
  ],
  reveal: ["photoRevealEffect"],
  // Gallery の写真の並べ方（いつもの構成）。
  "gallery-layout": [
    "galleryLayout",
    "galleryColumns",
    "galleryColumnsMobile",
    "gallerySizeScale",
    "galleryGapScale",
    "galleryEmptyRate",
    "gallerySizeVariation",
    "gallerySeed",
    "galleryExcludeSeries",
  ],
  // トップの作品の並び（いつもの構成）。
  "top-works": [
    "topWorksLayout",
    "topWorksMode",
    "topWorksIds",
    "homeGalleryCount",
    "topWorksColumns",
    "topWorksColumnsMobile",
    "topWorksSizeScale",
    "topWorksGapScale",
  ],
  // Series の一覧の札（いつもの構成）。写真を切り抜くかどうかも札・帯・表紙に効く。
  "series-cards": [
    "seriesCardStyle",
    "seriesGridColumns",
    "seriesGridColumnsMobile",
    "photoCrop",
  ],
  // 作品（シリーズ）のページの写真の並べ方（いつもの構成）。
  "series-layout": ["seriesLayout"],
  // トップに流れるシリーズの帯（いつもの構成）。
  "series-strip": [
    "topSeriesStream",
    "topSeriesStreamLabel",
    "topSeriesStreamCaption",
    "topSeriesStreamSpeed",
    "topSeriesStreamHeight",
  ],
  // 並び順（どちらの骨格でも効く）。
  order: ["gallerySortOrder", "seriesSortOrder"],
  // 作風プリセットは自分のキーを持たない（他の節のキーをまとめて入れ替える
  // だけ）。台帳では空にしておく。所属キーの検査は
  // admin-settings-section-keys.test.ts が見ている。
  mood: [],
  // サイトの骨格（写真中心／いつもの構成）だけを選ぶ節。
  "page-layout": [
    "siteDesign",
    "developPortraitIds",
    "developLifeIds",
    "developDoors",
    "tokyoPhotoIds",
    "exhibitionOnTop",
    "exhibitionTitle",
    "exhibitionDates",
    "exhibitionText",
    "exhibitionThanks",
    "exhibitionPhotoIds",
    "exhibitionCaptions",
    "exhibitionArchive",
  ],
  // トップの形（写真中心）。
  home: ["bookCoverPhotoId", "photoTopLayout", "developTopStyle"],
  // 作家の言葉の文（トップと About に出る）。
  "statement-text": ["profileStatement", "profileStatementEn"],
  // トップのどこに作家の言葉を置くか。
  statement: ["homeStatement"],
  // 写真を大きく開いたとき。
  viewer: ["viewerStyle", "viewerMat"],
  // About の文章と写真（以前は別画面で、プレビューを見ながら直せなかった）。
  about: [
    "profilePhotoUrl",
    "profileName",
    "profileNameKata",
    "profileNameEn",
    "profileBio",
    "profileBioEn",
    "profileGear",
    "profileInstagram",
    "profileTwitter",
    "profileNote",
  ],
  // 名刺のQRから開くページ（/card.html）に足す行き先（2026-11-12、About の節から分けた）。
  // 新しい構成の「名刺のQR」のページで直す。名前と SNS は About（Info）の節の値を使う。
  card: ["cardExtraLabel", "cardExtraUrl"],
  "about-layout": ["profileLayout"],
  "contact-layout": ["contactLayout"],
  note: ["noteEnabled", "noteUsername", "noteShowCount"],
  print: [
    "printEnabled",
    "printStoreUrl",
    "printStoreLabel",
    "printDescription",
  ],
  cta: ["homeCtaEnabled", "homeCtaTitle", "homeCtaText", "homeCtaOtherText", "homeCtaButton"],
  // 色と背景（差し色・紙の質感も）。
  theme: [
    "themeBg",
    "themeText",
    "themeBgDark",
    "themeTextDark",
    "accentColor",
    "bgTexture",
    "bgTextureOpacity",
  ],
  fonts: [
    "fontJa",
    "customFontJaName",
    "customFontJaUrl",
    "customFontJaCategory",
    "fontEn",
    "customFontEnName",
    "customFontEnUrl",
    "customFontEnCategory",
  ],
  name: [
    "siteName",
    "siteNameEn",
    "heroSubtitle",
    "heroNameSize",
    "heroNameWeight",
    "heroNameTracking",
    "heroNameColor",
    "heroNameEnSize",
    "heroNameEnTracking",
    "heroNameEnColor",
    "heroSubSize",
    "heroSubColor",
  ],
  headings: [
    "pageTitleStyle",
    "headingSize",
    "sectionLabelSize",
    "sectionLabelTracking",
    "sectionLeading",
    "sectionLabelOpacity",
  ],
  body: [
    "globalFontScale",
    "bodySize",
    "bodyWeight",
    "bodyTracking",
    "bodyLeading",
    "linkHoverColor",
    "linkUnderline",
  ],
  // フッター（言葉・並べ方・文字・SNS の名前・制作のクレジット）。
  footer: [
    "footerText",
    "footerLayout",
    "footerSize",
    "footerOpacity",
    "snsOpacity",
    "snsLabelInstagram",
    "snsLabelTwitter",
    "snsLabelNote",
    "footerCtaLabel",
    "templateCreditLabel",
    "templateCreditUrl",
  ],
  // ページの見出しなどに出る言葉（いつもの構成の見出し・「すべて見る」など）。
  "site-copy": [
    "worksLabel",
    "viewAllLabel",
    "viewAllCtaLabel",
    "galleryLabel",
    "filterAllLabel",
    "profileLabel",
    "contactLabel",
  ],
  presets: ["metaPresetsCamera", "metaPresetsLens"],
} as const;

/**
 * 設定の欄の名前（探す欄のため、2026-11-12）。探す欄が画面の名前しか見ず、「Instagram」
 * 「ロゴ」で 0 件だった。[日本語の欄の名前, 英語の欄の名前, 言い換え]。
 * 節の台帳（上）のキーはどれも、ここに名前を持つ（`admin-site-outline.test.ts` が確かめる。
 * 欄を足して名前を書き忘れると、検査が落ちる）。画面の欄の文言を変えたら、ここも合わせる。
 */
export const SETTING_KEY_WORDS: Readonly<Record<string, readonly [ja: string, en: string, extra?: string]>> = {
  siteDescription: ["サイトの説明文", "Site description", "検索結果 SEO シェア 説明 meta"],
  siteUrl: ["公開サイトの基準URL", "Public site URL", "住所 ドメイン アドレス domain"],
  googleSiteVerification: ["Google サイト確認コード", "Google site verification", "サーチコンソール search console"],
  contactIntro: ["お問い合わせの案内文", "Contact intro", "案内 問い合わせ"],
  contactIntroEn: ["お問い合わせの案内文（英語）", "Contact intro (English)", "英語 English"],
  contactNote: ["Contact 添え書き", "Contact note", "添え書き 注意"],
  contactNoteEn: ["Contact 添え書き（英語）", "Contact note (English)", "英語 English"],
  contactFlow: ["依頼の流れ", "How booking works", "流れ 手順 flow"],
  contactFlowEn: ["依頼の流れ（英語）", "How booking works (English)", "英語 English"],
  contactAreas: ["撮影を受ける地域", "Shooting areas", "地域 エリア 場所 area"],
  contactAreasEn: ["撮影を受ける地域（英語）", "Shooting areas (English)", "英語 English"],
  contactEnglishNote: ["英語対応の一言", "English support note", "英語 English"],
  contactMessagePlaceholder: ["Message 入力例", "Message placeholder", "本文の例 例文"],
  contactEmail: ["連絡先メールアドレス", "Contact email address", "メール mail e-mail アドレス"],
  formspreeUrl: ["お問い合わせフォームの送信先", "Contact form endpoint", "フォーム 送り先 送信先 Formspree メール form"],
  contactFormName: ["名前の欄", "Name field", "フォーム 入力欄 form label"],
  contactFormEmail: ["メールの欄", "Email field", "メール フォーム 入力欄 mail form label"],
  contactFormSubject: ["件名の欄", "Subject field", "フォーム 入力欄 form label"],
  contactSubjectOptions: ["件名の選択肢", "Subject choices", "フォーム 選ぶ options"],
  contactFormMessage: ["本文の欄", "Message field", "フォーム 入力欄 form label"],
  contactSendButton: ["送信ボタン", "Send button", "送る ボタン button"],
  contactSendingButton: ["送っている間のボタン", "Sending button", "送信中 ボタン"],
  contactSentMessage: ["送ったあとのお礼", "Thank-you message", "送信完了 お礼 thanks"],
  contactSendAnother: ["「もう一通送る」のリンク", "Send another link", "もう一通"],
  contactErrorMessage: ["送れなかったときの言葉", "Error message", "エラー 失敗 error"],
  servicePageMode: ["Portfolio Kit の表示", "Portfolio Kit visibility", "制作案内 サービス service"],
  heroMode: ["表紙の出し方（1枚・スライド）", "Cover mode (single, slideshow)", "トップの写真 スライド hero"],
  heroRandom: ["トップの写真をランダムに", "Random home photos", "ランダム hero random"],
  heroMotionSpeed: ["登場する速さ", "Motion speed", "速さ 動き hero"],
  heroRevealOrder: ["出てくる順番", "Reveal order", "順番 hero"],
  heroHeight: ["トップの写真の高さ", "Home photo height", "高さ hero height"],
  heroOverlay: ["写真に重ねる暗さ", "Photo overlay", "暗さ 重ねる hero overlay"],
  heroDisplayMode: ["画面の使い方", "Display mode", "画面いっぱい fullscreen hero"],
  heroTitlePosition: ["名前の表示位置", "Name position", "名前 位置 hero title"],
  heroScrollEffect: ["スクロール演出", "Scroll effect", "スクロール hero scroll"],
  navLabelTop: ["トップへのリンク（TOP）", "Home link (logo)", "ロゴ サイト名 名前 TOP logo"],
  navLabelGallery: ["Gallery へのリンク", "Gallery link", "Gallery メニュー"],
  navLabelAbout: ["About へのリンク", "About link", "About メニュー"],
  navLabelContact: ["Contact へのリンク", "Contact link", "Contact メニュー"],
  seriesNavEnabled: ["Series の入口", "Series menu item", "メニュー Series"],
  workNavEnabled: ["Work の入口", "Work menu item", "メニュー Work"],
  navLabelWork: ["Work の名前（メニューと見出し）", "Work label", "Work メニュー"],
  navSize: ["メニューの文字の大きさ", "Menu text size", "メニュー 大きさ size"],
  navTracking: ["メニューの字間", "Menu letter spacing", "メニュー 字間 tracking"],
  navOpacity: ["メニューの濃さ", "Menu opacity", "メニュー 濃さ opacity"],
  navPosition: ["メニューの位置（上・左・下）", "Menu position", "メニュー 位置 縦 position"],
  navHoverEffect: ["メニューに乗ったときの動き", "Menu hover effect", "ホバー hover"],
  headerBackground: ["メニューの背景（帯・透明）", "Menu background", "帯 透明 ヘッダー header background"],
  spacingHeroBottom: ["トップの写真の下の余白", "Space below home photo", "余白 間隔 spacing"],
  spacingSectionGap: ["まとまりの間の余白", "Space between sections", "余白 間隔 spacing gap"],
  spacingPageTop: ["ページの上の余白", "Space above page content", "余白 間隔 spacing"],
  spacingFooterTop: ["フッターの上の余白", "Space above footer", "余白 間隔 フッター spacing"],
  photoRevealEffect: ["写真の現れ方", "How photographs appear", "フェード アニメーション 動き fade animation reveal"],
  galleryLayout: ["Gallery の写真の並べ方", "Gallery layout", "グリッド 並べ方 grid layout"],
  galleryColumns: ["最大列数（PC）", "Columns (desktop)", "列 列数 columns"],
  galleryColumnsMobile: ["列数（スマホ）", "Columns (phone)", "列 列数 スマホ columns"],
  gallerySizeScale: ["写真の大きさ", "Photo size", "大きさ size"],
  galleryGapScale: ["写真の間隔", "Gap between photographs", "余白 間隔 gap"],
  galleryEmptyRate: ["抜け頻度", "Empty-cell rate", "モザイク mosaic"],
  gallerySizeVariation: ["緩急の強さ", "Size variation", "大小 variation"],
  gallerySeed: ["並びの組み合わせ", "Layout seed", "モザイク seed"],
  galleryExcludeSeries: ["シリーズの写真を Gallery に出す", "Show series photographs in Gallery", "シリーズ Gallery"],
  topWorksLayout: ["トップの作品の並べ方", "Home work grid layout", "トップ 作品 並べ方"],
  topWorksMode: ["トップの作品の選び方", "How home works are chosen", "自動 ランダム 手動"],
  topWorksIds: ["トップに出す作品", "Works on the home page", "作品 選ぶ"],
  homeGalleryCount: ["初期表示枚数", "Initial count", "枚数"],
  topWorksColumns: ["トップの作品の列数", "Home works columns", "列数 columns"],
  topWorksColumnsMobile: ["トップの作品の列数（スマホ）", "Home works columns (phone)", "列数 スマホ"],
  topWorksSizeScale: ["トップの作品の大きさ", "Home works size", "大きさ"],
  topWorksGapScale: ["トップの作品の間隔", "Home works gap", "余白 間隔"],
  seriesCardStyle: ["シリーズの札の組み方", "Series card style", "表紙 題名 札 card"],
  seriesGridColumns: ["シリーズの列数（PC）", "Series columns (desktop)", "列数 columns"],
  seriesGridColumnsMobile: ["シリーズの列数（スマホ）", "Series columns (phone)", "列数 スマホ columns"],
  photoCrop: ["写真の切り抜き", "Photo crop", "切り抜く 全体 crop"],
  seriesLayout: ["シリーズのページの写真の並べ方", "Series page layout", "作品ページ 並べ方 layout"],
  topSeriesStream: ["シリーズの帯", "Series strip", "帯 流れる strip"],
  topSeriesStreamLabel: ["帯の見出し", "Strip heading", "帯 見出し"],
  topSeriesStreamCaption: ["帯に題を出す", "Strip captions", "帯 題"],
  topSeriesStreamSpeed: ["帯の速さ", "Strip speed", "帯 速さ"],
  topSeriesStreamHeight: ["帯の高さ", "Strip height", "帯 高さ"],
  gallerySortOrder: ["Gallery の並び順", "Gallery order", "並び順 撮影日 新しい順 古い順 ランダム sort"],
  seriesSortOrder: ["シリーズの中の並び順", "Order inside a series", "並び順 撮影日 sort"],
  siteDesign: ["サイトの構成", "Site structure", "構成 骨格 structure"],
  developPortraitIds: ["Portrait の写真", "Portrait photographs", "写真を選ぶ 並べる"],
  developLifeIds: ["Life の写真", "Life photographs", "写真を選ぶ 並べる 日常"],
  developDoors: ["扉の名前", "Door names", "メニュー 入口 名前 Portrait Life Info"],
  tokyoPhotoIds: ["東京プランの作例", "Tokyo plan photographs", "東京 tokyo 作例"],
  exhibitionOnTop: ["トップに展示を出す", "Exhibition on the home page", "展示 トップ"],
  exhibitionTitle: ["展示の題", "Exhibition title", "展示 題"],
  exhibitionDates: ["会期", "Exhibition dates", "展示 日付"],
  exhibitionText: ["展示の文", "Exhibition text", "展示 文章"],
  exhibitionThanks: ["名刺のQRから来た人へのお礼", "Thanks for card QR visitors", "QR 名刺 お礼"],
  exhibitionPhotoIds: ["展示の写真", "Exhibition photographs", "展示 写真"],
  exhibitionCaptions: ["展示の写真の題", "Exhibition captions", "展示 題 キャプション"],
  exhibitionArchive: ["ほかの展示", "Other exhibitions", "展示 前の 次の"],
  bookCoverPhotoId: ["写真集の表紙", "Book cover photograph", "表紙"],
  photoTopLayout: ["トップの形（写真中心）", "Home layout (photographs first)", "表紙"],
  developTopStyle: ["トップの形（見開き・表紙と扉）", "Home style (spread, cover and doors)", "見開き 扉 表紙 トップ spread doors"],
  profileStatement: ["作家の言葉", "Artist statement", "ステートメント statement"],
  profileStatementEn: ["作家の言葉（英語）", "Artist statement (English)", "ステートメント 英語 statement"],
  homeStatement: ["作家の言葉の位置", "Statement placement", "ステートメント トップ"],
  viewerStyle: ["写真を開いたときの壁の色", "Viewer wall", "壁 暗室 ビューア viewer lightbox"],
  viewerMat: ["写真の周りの余白", "Viewer margin", "額装 余白 ビューア mat"],
  profilePhotoUrl: ["顔写真", "Portrait photograph", "プロフィール写真 写真 profile photo"],
  profileName: ["名前（日本語）", "Name", "名前 プロフィール name"],
  profileNameKata: ["振り仮名（カタカナ）", "Name reading", "読みがな カタカナ"],
  profileNameEn: ["名前（英語）", "Name in English", "英語 name"],
  profileBio: ["自己紹介", "Biography", "略歴 プロフィール bio"],
  profileBioEn: ["自己紹介（英語）", "Biography (English)", "略歴 英語 bio"],
  profileGear: ["使用機材", "Equipment", "機材 カメラ gear"],
  profileInstagram: ["Instagram の住所", "Instagram URL", "インスタ SNS"],
  profileTwitter: ["X の住所", "X URL", "Twitter ツイッター SNS"],
  profileNote: ["note の住所", "note URL", "note SNS ブログ"],
  cardExtraLabel: ["名刺のQRに足す行き先の名前", "Extra link on the card QR page — name", "名刺 QR card"],
  cardExtraUrl: ["名刺のQRに足す行き先の住所", "Extra link on the card QR page — URL", "名刺 QR card"],
  profileLayout: ["自己紹介の組み方", "About layout", "写真を左 写真を上 About"],
  contactLayout: ["連絡先の組み方", "Contact layout", "中央 左寄せ Contact"],
  noteEnabled: ["note の記事を出す", "Show note posts", "記事 ブログ Journal"],
  noteUsername: ["note ユーザー名", "note username", "note 記事"],
  noteShowCount: ["note の記事の件数", "Number of note posts", "件数 記事"],
  printEnabled: ["プリント販売を出す", "Show print sales", "プリント ショップ print shop"],
  printStoreUrl: ["プリントのストアURL", "Print store URL", "プリント ショップ 販売"],
  printStoreLabel: ["プリントのリンク文言", "Print link label", "プリント"],
  printDescription: ["プリント説明文", "Print description", "プリント"],
  homeCtaEnabled: ["撮影のご依頼を出す", "Show photography enquiries", "依頼 相談 CTA"],
  homeCtaTitle: ["ご依頼の案内の見出し", "Enquiry heading", "依頼 見出し"],
  homeCtaText: ["ご依頼の案内の文（料金の一行）", "Enquiry text (price line)", "依頼 料金 値段 価格 price"],
  homeCtaOtherText: ["人のほかの撮影の相談の文", "Other shoots text", "物撮り 相談 依頼"],
  homeCtaButton: ["ご依頼の案内のボタン", "Enquiry button", "依頼 ボタン"],
  themeBg: ["背景色", "Background colour", "色 背景 color background"],
  themeText: ["文字色", "Text colour", "色 文字 color text"],
  themeBgDark: ["暗い表示のときの背景色", "Dark mode background", "色 ダーク dark color"],
  themeTextDark: ["暗い表示のときの文字色", "Dark mode text colour", "色 ダーク dark color"],
  accentColor: ["差し色", "Accent colour", "色 アクセント accent color"],
  bgTexture: ["紙の質感", "Paper texture", "質感 テクスチャ 紙 texture"],
  bgTextureOpacity: ["質感の濃さ", "Texture strength", "質感 濃さ"],
  fontJa: ["日本語の書体", "Japanese typeface", "フォント 明朝 ゴシック font"],
  customFontJaName: ["日本語の書体の名前（自分で入れる）", "Custom Japanese font name", "フォント font custom"],
  customFontJaUrl: ["日本語の書体の読み込み先", "Custom Japanese font URL", "フォント font custom"],
  customFontJaCategory: ["日本語の書体の種類", "Custom Japanese font category", "フォント font custom"],
  fontEn: ["英語の書体", "Latin typeface", "フォント セリフ font"],
  customFontEnName: ["英語の書体の名前（自分で入れる）", "Custom Latin font name", "フォント font custom"],
  customFontEnUrl: ["英語の書体の読み込み先", "Custom Latin font URL", "フォント font custom"],
  customFontEnCategory: ["英語の書体の種類", "Custom Latin font category", "フォント font custom"],
  siteName: ["サイト名（ロゴ・日本語）", "Site name (logo)", "ロゴ 名前 logo name"],
  siteNameEn: ["サイト名（英語表記）", "Site name in English", "名前 英語 name"],
  heroSubtitle: ["肩書き（名前の下の言葉）", "Tagline", "肩書き subtitle"],
  heroNameSize: ["名前の大きさ", "Name size", "名前 大きさ"],
  heroNameWeight: ["名前の太さ", "Name weight", "名前 太さ"],
  heroNameTracking: ["名前の字間", "Name letter spacing", "名前 字間"],
  heroNameColor: ["名前の色", "Name colour", "名前 色"],
  heroNameEnSize: ["英語の名前の大きさ", "English name size", "名前 英語 大きさ"],
  heroNameEnTracking: ["英語の名前の字間", "English name letter spacing", "名前 英語 字間"],
  heroNameEnColor: ["英語の名前の色", "English name colour", "名前 英語 色"],
  heroSubSize: ["肩書きの大きさ", "Tagline size", "肩書き 大きさ"],
  heroSubColor: ["肩書きの色", "Tagline colour", "肩書き 色"],
  pageTitleStyle: ["各ページの見出しの形", "Page heading style", "見出し heading"],
  headingSize: ["見出しの大きさ", "Heading size", "見出し 大きさ heading"],
  sectionLabelSize: ["小見出しの大きさ", "Label size", "小見出し 大きさ"],
  sectionLabelTracking: ["小見出しの字間", "Label letter spacing", "小見出し 字間"],
  sectionLeading: ["小見出しの行間", "Label line height", "小見出し 行間"],
  sectionLabelOpacity: ["小見出しの濃さ", "Label opacity", "小見出し 濃さ"],
  globalFontScale: ["文字全体の大きさ", "Overall text scale", "文字 スケール scale"],
  bodySize: ["本文の大きさ", "Body text size", "本文 文字 大きさ body"],
  bodyWeight: ["本文の太さ", "Body text weight", "本文 太さ body"],
  bodyTracking: ["本文の字間", "Body letter spacing", "本文 字間 body"],
  bodyLeading: ["本文の行間", "Body line height", "本文 行間 body"],
  linkHoverColor: ["リンクに乗ったときの色", "Link hover colour", "リンク 色 link"],
  linkUnderline: ["リンクの下線", "Link underline", "リンク 下線 link"],
  footerText: ["フッターの文", "Footer text", "著作 コピーライト copyright"],
  footerLayout: ["フッターの並べ方", "Footer layout", "フッター 並べ方"],
  footerSize: ["フッターの文字の大きさ", "Footer text size", "フッター 大きさ"],
  footerOpacity: ["フッターの濃さ", "Footer opacity", "フッター 濃さ"],
  snsOpacity: ["SNS の濃さ", "Social link opacity", "SNS 濃さ"],
  snsLabelInstagram: ["Instagram の表示名", "Instagram label", "SNS インスタ"],
  snsLabelTwitter: ["X の表示名", "X label", "SNS Twitter"],
  snsLabelNote: ["note の表示名", "note label", "SNS"],
  footerCtaLabel: ["フッターのご依頼の案内", "Footer enquiry link", "依頼 フッター"],
  templateCreditLabel: ["テンプレート購入クレジット", "Template credit", "クレジット credit"],
  templateCreditUrl: ["テンプレート購入クレジットの URL", "Template credit URL", "クレジット credit"],
  worksLabel: ["トップの作品の見出し（Works）", "Home works heading", "見出し Works"],
  viewAllLabel: ["「すべて見る」のリンク", "View all link", "すべて見る"],
  viewAllCtaLabel: ["「すべての作品を見る」ボタン", "View all works button", "すべて見る"],
  galleryLabel: ["Gallery の見出し", "Gallery heading", "見出し Gallery"],
  filterAllLabel: ["絞り込みの「すべて」", "Filter: all", "絞り込み"],
  profileLabel: ["自己紹介の見出し", "About heading", "見出し About"],
  contactLabel: ["連絡先の見出し", "Contact heading", "見出し Contact"],
  metaPresetsCamera: ["カメラの候補", "Camera suggestions", "機材 カメラ camera"],
  metaPresetsLens: ["レンズの候補", "Lens suggestions", "機材 レンズ lens"],
};

/** 欄の名前（画面の言葉に合わせて）。 */
export function settingKeyLabel(key: string, language: "ja" | "en"): string {
  const words = SETTING_KEY_WORDS[key];
  return words ? words[language === "ja" ? 0 : 1] : key;
}

/**
 * 新しい構成（見開きのトップ）で、公開サイトのどこにも効かない設定（2026-11-12 実測、
 * 189 のキーを1つずつ変えて全ページを比べた。作業用の `effects/EFFECTS.md` §4）。
 * 値は消さない。一覧には並べず、節の中では隠す（「今の構成で使わない設定」から開ける）。
 * 探すと「今の構成では使いません」と付いて出る。
 */
export const DEVELOP_UNUSED_KEYS: ReadonlySet<string> = new Set([
  // トップの写真の見せ方（見開きのトップは写真の見せ方を持たない）
  "heroMode", "heroRandom", "heroMotionSpeed", "heroRevealOrder", "heroHeight", "heroOverlay",
  "heroDisplayMode", "heroTitlePosition", "heroScrollEffect",
  // トップの作品の並び・シリーズの帯・作家の言葉の位置（今までのトップだけ）
  "topWorksLayout", "topWorksMode", "topWorksIds", "homeGalleryCount", "topWorksColumns",
  "topWorksColumnsMobile", "topWorksSizeScale", "topWorksGapScale",
  "topSeriesStream", "topSeriesStreamLabel", "topSeriesStreamCaption", "topSeriesStreamSpeed", "topSeriesStreamHeight",
  "homeStatement",
  // 名前の大きさ・色（今までのトップの名前の塊だけが読む）
  "heroNameSize", "heroNameWeight", "heroNameTracking", "heroNameColor", "heroNameEnSize",
  "heroNameEnTracking", "heroNameEnColor", "heroSubSize", "heroSubColor",
  // 写真中心の形（止めてある）
  "bookCoverPhotoId", "photoTopLayout",
  // メニューの Series／Work の入口（見開きのメニューは Portrait・Works・Info）
  "seriesNavEnabled", "workNavEnabled",
  "spacingHeroBottom",
  "profileNameKata",
  // 持ち主のサイトでは出さない
  "templateCreditLabel", "templateCreditUrl",
  // 今までのトップの見出しと「すべて見る」
  "worksLabel", "viewAllLabel", "viewAllCtaLabel",
]);

/**
 * 新しい構成で、節ごと使わない物。`mood` は自分のキーを持たないが、効く設定を12個まとめて
 * 書き換えるので、新しい構成では出さない（EFFECTS.md の `mood` の節）。
 */
export const DEVELOP_UNUSED_SECTIONS: readonly string[] = ["hero", "top-works", "series-strip", "statement", "mood"];

/**
 * 新しい構成で、設定の節ではなく「ページの写真」（/admin/pages）で直す節。サイトの構成の
 * 切り替え（siteDesign）もこの節にあるので、「サイト」からは開かない（1回押すだけで
 * 公開サイトが今までの構成に変わってしまう。切り替えは /admin/pages で確かめてから）。
 */
export const DEVELOP_SECTIONS_EDITED_ELSEWHERE: readonly string[] = ["page-layout"];

/** その構成で、この節を使わないか。 */
export function sectionUnusedIn(structure: SiteStructure, sectionId: string): boolean {
  return structure === "develop" && DEVELOP_UNUSED_SECTIONS.includes(sectionId);
}

/** その構成で、この設定が公開サイトに効かないか。 */
export function keyUnusedIn(structure: SiteStructure, key: string): boolean {
  return structure === "develop" && DEVELOP_UNUSED_KEYS.has(key);
}

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
    { id: "name", ja: "名前", en: "Name", keywords: "名前 サイト名 肩書き 大きさ 太さ 字間 色 英語 スマホ name title logo size" },
    { id: "navigation", ja: "メニュー", en: "Menu", keywords: "メニュー ナビ 入口 リンク 名前 位置 背景 透明 白帯 白い帯 重ねる ヘッダー Series Work menu header navigation transparent overlay" },
    { id: "home", ja: "トップの形", en: "Home layout", only: "book", keywords: "トップ 表紙 形 見開き 扉 home cover spread doors" },
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
    { id: "about", ja: "About の文章と写真", en: "About text & portrait", keywords: "プロフィール 略歴 自己紹介 顔写真 名前 読みがな カタカナ 機材 SNS インスタ profile about bio portrait" },
    { id: "card", ja: "名刺のQR", en: "Card QR page", keywords: "名刺 QR 行き先 card" },
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
  if (["about", "card", "about-layout", "note", "print"].includes(id)) return "/about";
  if (["contact", "contact-layout", "contact-words", "cta"].includes(id)) return "/contact";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 「サイト」の画面（2026-09-29 作り直し）。公開サイトを大きく見ながら、変えたい所を
// 押して直す。長い目次（32項目）をやめ、ページごとに「そこにあるもの」だけを並べる。
// 2026-11-12: 新しい構成のサイトでは、並びを公開サイトのページそのもの
// （トップ／Portrait／Works／Info／展示／東京プラン／名刺のQR）にした。
// ─────────────────────────────────────────────────────────────────────────────

/** 「ページの写真」（/admin/pages）のタブ。写真を選んで並べる画面へ行く行が使う。 */
export type SitePagesTab = "cover" | "portrait" | "life" | "exhibition" | "tokyo";

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
  /** 設定の下に出す、関係する編集画面・部分への入口 */
  links?: readonly { ja: string; en: string; tab?: SiteOutlineTab; part?: string }[];
  /** この骨格のときだけ公開サイトにある部分 */
  only?: SiteSkeleton;
  /** 制作案内（Portfolio Kit）を出していないサイトでは出さない */
  service?: true;
  keywords?: string;
  /** この構成のときだけ並べる部分（無ければ、どちらの構成の一覧にも入れられる） */
  structure?: SiteStructure;
  /** 新しい構成のときの名前・一言・節（今までの構成と違うときだけ書く） */
  develop?: { ja?: string; en?: string; noteJa?: string; noteEn?: string; sections?: readonly string[]; links?: SitePart["links"] };
  /** 写真を選んで並べる画面（/admin/pages の、このタブ）を開く行 */
  pagesTab?: SitePagesTab;
  /** /admin/pages で、開いたあと見せる所（扉の名前） */
  pagesFocus?: "doors";
  /** 管理画面のほかの入口（シリーズ）を開く行 */
  view?: "series";
  /** ほかの部分と同じ設定を指す行。同じ物を2か所で直させず、その部分のページへ連れて行く */
  ref?: string;
  /** 写真を選ぶ画面・ほかの入口が直す設定（探す欄のため） */
  keys?: readonly string[];
  /** 開いたときにプレビューで見せるページ（見ているページと違うときだけ） */
  preview?: string;
};

export const SITE_PARTS = {
  name: {
    id: "name", ja: "名前", en: "Name", noteJa: "表示する名前・大きさ・太さ・色", noteEn: "Text, size, weight, colour", sections: ["name"],
    develop: { noteJa: "見開きの背に出る名前と、ページの題に出る名前・肩書き", noteEn: "The name on the spine, and the name and tagline in page titles" },
  },
  menu: {
    id: "menu", ja: "メニュー", en: "Menu", noteJa: "言葉・入口・文字・背景（透明／帯）", noteEn: "Words, links, type, background (transparent/bar)", sections: ["navigation"], keywords: "ナビ 入口 Series Work",
    develop: {
      noteJa: "ロゴの言葉・位置・文字・背景", noteEn: "Logo words, position, type, background",
      links: [{ ja: "Portrait・Life・Info の名前は「扉の名前」で変える", en: "Rename Portrait, Life and Info under Door names", part: "doors" }],
    },
  },
  footer: {
    id: "footer", ja: "フッター", en: "Footer", noteJa: "ページの終わりの言葉・SNS・クレジット", noteEn: "Closing words, social links, credit", sections: ["footer"], keywords: "SNS クレジット 著作",
    develop: {
      noteJa: "ページの終わりの言葉・SNS の表示名", noteEn: "Closing words, social link labels",
      links: [{ ja: "SNS の住所は Info の「自己紹介と SNS」で変える", en: "Social link URLs are under Info › About & social links", part: "about" }],
    },
  },
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
  cta: {
    id: "cta", ja: "撮影のご依頼", en: "Photography enquiries", noteJa: "作品の後の Contact への案内", noteEn: "Invitation to Contact after the work", sections: ["cta"],
    develop: { noteJa: "見開きの左の頁の一行・奥付・Works の終わり・各ページの終わりの帯", noteEn: "Left-page line, colophon, end of Works and the band at the end of pages" },
  },
  "page-title": { id: "page-title", ja: "ページの見出しと言葉", en: "Page headings & words", noteJa: "各ページの見出しの形・大きさ・「すべて見る」などの言葉", noteEn: "Heading style and size, and link words such as View all", sections: ["headings", "site-copy"], keywords: "見出し 小見出し ページの言葉 すべて見る ラベル headings words labels",
    develop: { noteJa: "各ページの見出しの形・大きさ・小見出しの言葉", noteEn: "Heading style and size, and small headings" },
  },
  "gallery-photos": { id: "gallery-photos", ja: "写真の並べ方", en: "Photo layout", only: "classic", noteJa: "並べ方・列数・大きさ・余白", noteEn: "Layout, columns, sizes, gaps", sections: ["gallery-layout"] },
  order: { id: "order", ja: "並び順", en: "Order", noteJa: "並べた順か、撮影日の順か", noteEn: "Manual or by date", sections: ["order"] },
  viewer: { id: "viewer", ja: "写真を開いたとき", en: "Photo viewer", noteJa: "大きく見るときの壁の色・写真の大きさ", noteEn: "Wall colour and photo size", sections: ["viewer"] },
  "series-cards": {
    id: "series-cards", ja: "シリーズの札", en: "Series cards", only: "classic", noteJa: "表紙と題名の組み方・列数", noteEn: "Cover, title and columns", sections: ["series-cards"],
    develop: { ja: "シリーズの一覧", en: "Series list", noteJa: "Series の一覧の表紙と題名の組み方・列数・切り抜き", noteEn: "Covers, titles, columns and crop on the Series list" },
    preview: "/series",
  },
  "series-layout": {
    id: "series-layout", ja: "作品ページの並べ方", en: "Work page layout", only: "classic", noteJa: "シリーズを開いたときの写真の並べ方", noteEn: "How photographs sit on a series page", sections: ["series-layout"],
    develop: { ja: "シリーズを開いたとき", en: "Inside a series" },
    preview: "/series",
  },
  about: {
    id: "about", ja: "About の文章と写真", en: "About text & portrait", noteJa: "略歴・顔写真・作家の言葉・SNS", noteEn: "Biography, portrait, statement, social links", sections: ["about", "statement-text", "card"],
    develop: {
      ja: "自己紹介と SNS", en: "About & social links", sections: ["about"],
      noteJa: "顔写真・名前・略歴・機材・Instagram／X／note の住所", noteEn: "Portrait, name, biography, gear, Instagram / X / note URLs",
    },
  },
  "about-layout": {
    id: "about-layout", ja: "About の組み方", en: "About layout", noteJa: "写真と文章の並べ方", noteEn: "How portrait and text sit", sections: ["about-layout"],
    develop: { ja: "自己紹介の組み方", en: "About layout", noteJa: "顔写真と文章の並べ方", noteEn: "How portrait and text sit" },
  },
  "contact-info": {
    id: "contact-info", ja: "連絡先と案内", en: "Contact details", noteJa: "メール・フォームの送信先・案内の文章", noteEn: "Email, form endpoint, intro text", sections: ["contact"],
  },
  "contact-layout": {
    id: "contact-layout", ja: "Contact の組み方", en: "Contact layout", noteJa: "説明とフォームの並べ方", noteEn: "How text and form sit", sections: ["contact-layout"],
    develop: { ja: "連絡先の組み方", en: "Contact layout" },
  },
  "contact-words": { id: "contact-words", ja: "フォームの言葉", en: "Form wording", noteJa: "入力欄とボタンの言葉", noteEn: "Field and button labels", sections: ["contact-words"] },
  pricing: {
    id: "pricing", ja: "料金・プラン", en: "Pricing", noteJa: "Contact に出す料金の表", noteEn: "The price list on Contact", tab: "pricing", keywords: "料金 値段 価格 プラン price plan",
    develop: { noteJa: "Info に出す料金の表", noteEn: "The price list on Info" },
  },
  note: {
    id: "note", ja: "note の記事", en: "note posts", noteJa: "About に最新の記事を出す", noteEn: "Latest posts on About", sections: ["note"],
    develop: { noteJa: "Info の終わりに最新の記事を出す", noteEn: "Latest posts at the end of Info" },
  },
  print: {
    id: "print", ja: "プリント販売", en: "Print sales", noteJa: "About にプリントの案内を出す", noteEn: "Print sales link on About", sections: ["print"],
    develop: { noteJa: "Info の終わりにプリントの案内を出す", noteEn: "Print sales link at the end of Info" },
  },
  // 全体の見た目
  fonts: { id: "fonts", ja: "書体", en: "Typefaces", noteJa: "日本語と英語の書体", noteEn: "Japanese and English typefaces", sections: ["fonts"], keywords: "フォント font" },
  body: { id: "body", ja: "本文とリンク", en: "Body text & links", noteJa: "文字全体の大きさ・行間・リンク", noteEn: "Overall size, line height, links", sections: ["body"] },
  theme: { id: "theme", ja: "色と背景", en: "Colours & background", noteJa: "背景・文字・差し色・紙の質感", noteEn: "Background, text, accent, texture", sections: ["theme"] },
  // 骨格の切り替えは 2026-09-30 に止めた（`lib/site-design-flag.ts`）。写真中心の骨格のときだけ並べる。
  structure: { id: "structure", ja: "サイトの骨格", en: "Site structure", only: "book", noteJa: "写真中心／いつもの構成", noteEn: "Photographs-first or classic", sections: ["page-layout"] },
  mood: { id: "mood", ja: "デザインの出発点", en: "Design presets", only: "classic", noteJa: "トップ・一覧・メニューをまとめて入れ替える", noteEn: "Swaps home, gallery and menu together", sections: ["mood"] },
  spacing: {
    id: "spacing", ja: "ページの余白", en: "Page spacing", only: "classic", noteJa: "トップ・各ページの上下の間隔", noteEn: "Space above and between sections", sections: ["spacing"],
    develop: { noteJa: "各ページの上・まとまりの間・フッターの上の間隔", noteEn: "Space above pages, between sections and above the footer" },
  },
  reveal: {
    id: "reveal", ja: "写真の表示アニメーション", en: "Photo animation", only: "classic", noteJa: "写真が画面に入るときの動き", noteEn: "How photographs appear as you scroll", sections: ["reveal"],
    develop: { noteJa: "トップの写真の組・Works・シリーズ・展示で、写真が現れるときの動き", noteEn: "How photographs appear on the home pairs, Works, series and exhibitions" },
  },
  // そのほか
  "site-basics": { id: "site-basics", ja: "検索とシェア", en: "Search & sharing", noteJa: "検索結果・SNS で出る説明と公開 URL", noteEn: "Description for search and sharing, public URL", sections: ["site-basics"] },
  "hero-photos": { id: "hero-photos", ja: "トップの写真と順番", en: "Home photographs", noteJa: "「トップに出す」写真の順番・切り抜き", noteEn: "Order and crop of home photographs", tab: "hero" },
  categories: { id: "categories", ja: "分類", en: "Categories", noteJa: "写真の分類の名前と順番", noteEn: "Names and order of categories", tab: "categories",
    develop: { noteJa: "写真の分類の名前と順番（Portrait・Life で写真を選んでいないときは分類から出す）", noteEn: "Category names and order (Portrait and Life fall back to categories)" },
  },
  "series-details": { id: "series-details", ja: "シリーズの詳しい設定", en: "Series details", noteJa: "シリーズごとの配色・並び順の上書き", noteEn: "Per-series colour and order overrides", tab: "series" },
  service: { id: "service", ja: "制作案内のページ", en: "Portfolio Kit page", noteJa: "制作案内（Portfolio Kit）の文章と料金", noteEn: "Portfolio Kit page text and price", tab: "service", service: true },
  "portfolio-kit": { id: "portfolio-kit", ja: "制作案内への入口", en: "Portfolio Kit visibility", noteJa: "制作案内へのリンクを出すか", noteEn: "Whether to link to the Portfolio Kit page", sections: ["portfolio-kit"], service: true },
  presets: { id: "presets", ja: "カメラ・レンズの候補", en: "Camera & lens presets", noteJa: "写真の情報に入れる機材の候補", noteEn: "Equipment suggestions for photo details", sections: ["presets"] },
  setup: { id: "setup", ja: "はじめに（最初の設定の確認）", en: "Getting started", noteJa: "公開までにやることの確認", noteEn: "What to do before publishing", tab: "setup" },

  // ── 新しい構成だけの部分（2026-11-12）────────────────────────────────
  "top-style": {
    id: "top-style", ja: "トップの形", en: "Home style", structure: "develop", sections: ["home"],
    noteJa: "見開き（入口の写真2枚）か、表紙と扉か。メニューの入口も変わる", noteEn: "Spread (two entrance photographs) or cover and doors. Also changes the menu",
  },
  "cover-photos": {
    id: "cover-photos", ja: "入口の写真", en: "Entrance photographs", structure: "develop", pagesTab: "cover",
    noteJa: "1枚目が左の頁、2枚目が右の頁", noteEn: "The first is the left page, the second the right page",
    keywords: "表紙 トップの写真 トップの写真と順番 写真を選ぶ 見開き cover hero home photographs",
  },
  doors: {
    id: "doors", ja: "扉の名前", en: "Door names", structure: "develop", pagesTab: "portrait", pagesFocus: "doors", keys: ["developDoors"],
    noteJa: "Portrait・Life・Info の名前（メニューとページの題にも出る）", noteEn: "Names of Portrait, Life and Info (also in the menu and page titles)",
  },
  "portrait-photos": {
    id: "portrait-photos", ja: "写真を選ぶ", en: "Choose photographs", structure: "develop", pagesTab: "portrait", keys: ["developPortraitIds"],
    noteJa: "このページに並ぶ写真と順番", noteEn: "Photographs on this page and their order",
  },
  gallery: {
    id: "gallery", ja: "写真の間隔と Gallery", en: "Photo gaps & Gallery", structure: "develop", sections: ["gallery-layout", "order"], preview: "/gallery",
    noteJa: "写真の間隔（Life・Series にも効く）と、終わりの「Gallery →」から行く一覧の並べ方・並び順", noteEn: "Gap between photographs (also Life and Series), and the layout and order of the Gallery linked at the end",
    keywords: "Gallery すべての写真 並べ方 並び順 列数 間隔",
  },
  "cta-ref": {
    id: "cta-ref", ja: "撮影のご依頼の帯", en: "Enquiry band", structure: "develop", ref: "cta",
    noteJa: "トップの「撮影のご依頼」と同じ設定", noteEn: "Same setting as Home › Photography enquiries",
  },
  "works-series": {
    id: "works-series", ja: "シリーズ", en: "Series", structure: "develop", view: "series",
    noteJa: "シリーズと撮影ごとの実例。写真・言葉・表紙は「シリーズ」で", noteEn: "Series and works: photographs, words and covers in Series",
    keywords: "シリーズ 作品 Work 表紙 series works",
  },
  "life-photos": {
    id: "life-photos", ja: "Life の写真", en: "Life photographs", structure: "develop", pagesTab: "life", keys: ["developLifeIds"],
    noteJa: "Works の Life の棚と、その先のページに並ぶ写真", noteEn: "Photographs on the Life shelf and its page",
  },
  "works-other": {
    id: "works-other", ja: "人のほかの撮影の相談", en: "Other shoots", structure: "develop", ref: "cta",
    noteJa: "Works の終わりの一行。トップの「撮影のご依頼」と同じ設定", noteEn: "The line at the end of Works. Same setting as Home › Photography enquiries",
    keywords: "物撮り 相談 依頼",
  },
  "info-statement": {
    id: "info-statement", ja: "作家の言葉", en: "Statement", structure: "develop", sections: ["statement-text"],
    noteJa: "Info の自己紹介の中に出る文", noteEn: "The text inside the About part of Info",
  },
  "exhibition-photos": {
    id: "exhibition-photos", ja: "展示の写真と言葉", en: "Exhibition photographs & words", structure: "develop", pagesTab: "exhibition",
    keys: ["exhibitionOnTop", "exhibitionTitle", "exhibitionDates", "exhibitionText", "exhibitionThanks", "exhibitionPhotoIds", "exhibitionCaptions", "exhibitionArchive"],
    noteJa: "トップに出すか・写真・題と会期・文・ほかの展示", noteEn: "On the home page or not, photographs, title, dates, text, other exhibitions",
  },
  "tokyo-photos": {
    id: "tokyo-photos", ja: "作例の写真", en: "Sample photographs", structure: "develop", pagesTab: "tokyo", keys: ["tokyoPhotoIds"],
    noteJa: "東京プランのページの写真。1枚目が表紙", noteEn: "Photographs on the Tokyo plan page. The first is the cover",
  },
  card: {
    id: "card", ja: "足す行き先", en: "Extra link", structure: "develop", sections: ["card"],
    noteJa: "名刺のQRから開くページに足すリンク（空なら出さない）", noteEn: "A link added to the page the card QR opens (hidden when empty)",
    keywords: "名刺 QR card",
  },
  "card-profile": {
    id: "card-profile", ja: "名前と SNS", en: "Name & social links", structure: "develop", ref: "about",
    noteJa: "Info の「自己紹介と SNS」と同じ設定", noteEn: "Same setting as Info › About & social links",
    keywords: "名刺 QR Instagram X",
  },
} as const satisfies Record<string, SitePart>;

export type SitePartId = keyof typeof SITE_PARTS;

/** 今までの構成のページ（"top" は新しい構成のトップと同じ id）と、新しい構成のページ。 */
export type SitePageId =
  | "top" | "gallery" | "series" | "about" | "contact"
  | "portrait" | "works" | "info" | "exhibition" | "tokyo" | "card";

/** 公開サイトのページと、そこにある部分（上から見える順）。今までの構成。 */
export const SITE_PAGES: readonly { id: SitePageId; path: string; ja: string; en: string; parts: readonly SitePartId[] }[] = [
  // メニュー・フッター・見出しはどのページにも同じ物が出るので、各ページには並べず
  // 「全体の見た目」に1回だけ置く（2026-09-30。5ページに同じ3行が重なっていた）。
  { id: "top", path: "/", ja: "トップ", en: "Home", parts: ["name", "top-photos", "statement", "works", "series-strip", "cta"] },
  { id: "gallery", path: "/gallery", ja: "Gallery", en: "Gallery", parts: ["gallery-photos", "order", "viewer"] },
  { id: "series", path: "/series", ja: "Series", en: "Series", parts: ["series-cards", "series-layout", "order"] },
  { id: "about", path: "/about", ja: "About", en: "About", parts: ["about", "about-layout", "note", "print"] },
  { id: "contact", path: "/contact", ja: "Contact", en: "Contact", parts: ["contact-info", "contact-layout", "contact-words", "pricing"] },
];

/**
 * 新しい構成のページ（2026-11-12）。公開サイトのページ名・並びと同じ。各ページの部分は、
 * そのページを上から見て現れる順（EFFECTS.md §3 と各ページの部品で確かめた）。
 * 展示は展示があり得るサイトだけ、東京プランは持ち主のサイトだけ（`siteOutline`）。
 */
export const DEVELOP_PAGES: readonly {
  id: SitePageId; path: string; ja: string; en: string; door?: "portrait" | "info"; parts: readonly SitePartId[];
}[] = [
  { id: "top", path: "/", ja: "トップ", en: "Home", parts: ["top-style", "cover-photos", "name", "cta", "doors"] },
  { id: "portrait", path: "/portrait", ja: "Portrait", en: "Portrait", door: "portrait", parts: ["portrait-photos", "gallery", "cta-ref"] },
  { id: "works", path: "/works", ja: "Works", en: "Works", parts: ["works-series", "series-cards", "series-layout", "life-photos", "works-other"] },
  {
    id: "info", path: "/info", ja: "Info", en: "Info", door: "info",
    parts: ["about", "info-statement", "about-layout", "contact-info", "contact-layout", "pricing", "contact-words", "note", "print"],
  },
  { id: "exhibition", path: "/exhibition", ja: "展示", en: "Exhibition", parts: ["exhibition-photos"] },
  { id: "tokyo", path: "/tokyo/ja", ja: "東京プラン", en: "Tokyo plan", parts: ["tokyo-photos"] },
  { id: "card", path: "/card.html", ja: "名刺のQR", en: "Card QR", parts: ["card", "card-profile"] },
];

/** すべてのページの id（URL の # から読むとき、まだ構成が分からないので両方を受ける）。 */
export const ALL_SITE_PAGE_IDS: readonly SitePageId[] = Array.from(
  new Set<SitePageId>([...SITE_PAGES.map((p) => p.id), ...DEVELOP_PAGES.map((p) => p.id)]),
);

/** 「全体の見た目」と「そのほか」に並べる部分。 */
export const SITE_LOOK_PARTS: readonly SitePartId[] = ["fonts", "theme", "body", "page-title", "menu", "footer", "spacing", "reveal", "mood", "structure"];
export const SITE_MORE_PARTS: readonly SitePartId[] = ["site-basics", "hero-photos", "categories", "service", "portfolio-kit", "series-details", "presets", "setup"];

/** 新しい構成の「共通」「見た目」「そのほか」。しまう物（詳しい設定）は作らず、全部見せる。 */
export const DEVELOP_SHARED_PARTS: readonly SitePartId[] = ["menu", "footer", "viewer", "page-title"];
export const DEVELOP_LOOK_PARTS: readonly SitePartId[] = ["fonts", "theme", "body", "spacing", "reveal"];
export const DEVELOP_MORE_PARTS: readonly SitePartId[] = [
  "site-basics", "categories", "series-details", "presets", "service", "portfolio-kit", "setup",
];

/**
 * どのページにも出る部分（2026-09-30）。ページの一覧には並べず「全体の見た目」に1回だけ
 * 置くが、プレビューの中では今までどおり押して開ける（どのページを見ていても）。
 */
export const SITE_SHARED_PARTS: readonly SitePartId[] = ["page-title", "menu", "footer"];

/**
 * めったに触らない部分（2026-09-30）。一覧では「詳しい設定」の中にしまい、
 * ふだんは名前・写真・文章・書体・色など、それだけ触れば足りる物だけを見せる。
 * 探せば、しまってある物も開ける。今までの構成だけ（新しい構成は全部見せる）。
 */
export const SITE_ADVANCED_PARTS: readonly SitePartId[] = ["spacing", "reveal", "mood", "series-details", "presets", "setup"];

/**
 * 新しい構成で、今までの部分の代わりに開く部分。「はじめに」や ⌘K から今までの部分を
 * 開いても、新しい構成の同じ物の場所へ行く（表紙の写真の場所を1つにする）。
 */
export const DEVELOP_PART_ALIASES: Readonly<Partial<Record<string, SitePartId>>> = {
  "hero-photos": "cover-photos",
  "top-photos": "cover-photos",
  "gallery-photos": "gallery",
  // 並び順は Gallery の並び（Portrait・Life はいつも選んだ順）。
  order: "gallery",
  statement: "info-statement",
};

/** 部分が今の骨格・構成で出す設定の節。 */
export function sectionsForPart(part: SitePart, skeleton: SiteSkeleton, structure: SiteStructure = "classic"): readonly string[] {
  if (structure === "develop" && part.develop?.sections) return part.develop.sections;
  return part.bySkeleton?.[skeleton] ?? part.sections ?? [];
}

/** 今の骨格・制作案内の表示・構成で、その部分を並べるか。 */
export function partIsListed(part: SitePart, skeleton: SiteSkeleton, showService: boolean, structure: SiteStructure = "classic"): boolean {
  if (part.service && !showService) return false;
  if (part.structure && part.structure !== structure) return false;
  return !part.only || part.only === skeleton;
}

/** 部分の名前と一言（構成で変わる物は新しい構成の言葉）。扉の名前を変えたら、それに合わせる。 */
export function partText(
  part: SitePart,
  structure: SiteStructure,
  language: "ja" | "en",
  doors?: DevelopDoorCopy,
): { label: string; note?: string } {
  const ja = language === "ja";
  const override = structure === "develop" ? part.develop : undefined;
  let label = (ja ? override?.ja : override?.en) ?? (ja ? part.ja : part.en);
  const note = (ja ? override?.noteJa : override?.noteEn) ?? (ja ? part.noteJa : part.noteEn);
  // Life の写真は、扉の名前を変えていればその名前で（タブの名前と揃える）。
  if (structure === "develop" && part.id === "life-photos" && doors) {
    label = ja ? `${doors.life.label} の写真` : `${doors.life.label} photographs`;
  }
  return { label, note };
}

/** 部分の下の入口（構成で変わる物は新しい構成の入口）。 */
export function partLinks(part: SitePart, structure: SiteStructure): NonNullable<SitePart["links"]> {
  return (structure === "develop" ? part.develop?.links : undefined) ?? part.links ?? [];
}

// ── 並び（ページと、ページに依らないまとまり）──────────────────────────────

export type SiteOutlineGroupId = "shared" | "look" | "more";

export type SiteOutlinePage = { id: SitePageId; path: string; ja: string; en: string; parts: readonly SitePartId[] };
export type SiteOutlineGroup = {
  id: SiteOutlineGroupId;
  ja: string;
  en: string;
  /** スマホの帯で使う短い名前 */
  shortJa: string;
  shortEn: string;
  parts: readonly SitePartId[];
  /** 「詳しい設定」にしまう部分（今までの構成だけ） */
  advanced: readonly SitePartId[];
};
export type SiteOutline = { structure: SiteStructure; pages: readonly SiteOutlinePage[]; groups: readonly SiteOutlineGroup[] };

export type SiteOutlineContext = {
  structure: SiteStructure;
  showService: boolean;
  /** 展示のページがあり得るサイトか（`exhibitionEntries` が1件以上） */
  exhibition?: boolean;
  /** 東京プランのページがあるサイトか（持ち主のサイト） */
  tokyo?: boolean;
  doors?: DevelopDoorCopy;
};

/** 今の構成の「サイト」の並び。今までの構成は 2026-09-30 の形のまま変えない。 */
export function siteOutline(ctx: SiteOutlineContext): SiteOutline {
  const skeleton: SiteSkeleton = "classic";
  const listed = (id: SitePartId) => partIsListed(SITE_PARTS[id], skeleton, ctx.showService, ctx.structure);
  if (ctx.structure === "classic") {
    const split = (ids: readonly SitePartId[]) => ({
      parts: ids.filter(listed).filter((id) => !SITE_ADVANCED_PARTS.includes(id)),
      advanced: ids.filter(listed).filter((id) => SITE_ADVANCED_PARTS.includes(id)),
    });
    return {
      structure: "classic",
      pages: SITE_PAGES.map((p) => ({ ...p, parts: p.parts.filter(listed) })),
      groups: [
        { id: "look", ja: "全体の見た目", en: "Overall look", shortJa: "見た目", shortEn: "Look", ...split(SITE_LOOK_PARTS) },
        { id: "more", ja: "そのほか", en: "More", shortJa: "そのほか", shortEn: "More", ...split(SITE_MORE_PARTS) },
      ],
    };
  }
  const doors = ctx.doors ?? developDoorCopy(null);
  const pages = DEVELOP_PAGES.filter((p) => (p.id === "exhibition" ? ctx.exhibition : p.id === "tokyo" ? ctx.tokyo : true)).map((p) => ({
    id: p.id,
    path: p.path,
    ja: p.door ? doors[p.door].label : p.ja,
    en: p.door ? doors[p.door].label : p.en,
    parts: p.parts.filter(listed),
  }));
  const group = (id: SiteOutlineGroupId, ja: string, en: string, ids: readonly SitePartId[]): SiteOutlineGroup => ({
    id, ja, en, shortJa: ja, shortEn: en, parts: ids.filter(listed), advanced: [],
  });
  return {
    structure: "develop",
    pages,
    groups: [
      group("shared", "共通", "Shared", DEVELOP_SHARED_PARTS),
      group("look", "見た目", "Look", DEVELOP_LOOK_PARTS),
      group("more", "そのほか", "More", DEVELOP_MORE_PARTS),
    ],
  };
}

/** 部分が並ぶ場所（ページか、まとまり）。並んでいなければ null。 */
export function partHome(
  outline: SiteOutline,
  partId: string,
): { page: SitePageId } | { group: SiteOutlineGroupId } | null {
  for (const page of outline.pages) if ((page.parts as readonly string[]).includes(partId)) return { page: page.id };
  for (const group of outline.groups) {
    if ([...group.parts, ...group.advanced].includes(partId as SitePartId)) return { group: group.id };
  }
  return null;
}

/** 今の構成で開く部分（新しい構成では、今までの部分の代わりの部分へ）。 */
export function resolvePartId(structure: SiteStructure, partId: string): string {
  return structure === "develop" ? (DEVELOP_PART_ALIASES[partId] ?? partId) : partId;
}

/** 写真を選んで並べる画面（/admin/pages）への道。戻る先は来た場所（`/admin#site/…`）。 */
export function pagesHref(part: SitePart, from: string): string {
  const params = new URLSearchParams();
  if (part.pagesTab) params.set("tab", part.pagesTab);
  if (part.pagesFocus) params.set("focus", part.pagesFocus);
  params.set("from", from);
  return `/admin/pages?${params.toString()}`;
}

// ── 探す（2026-11-12）──────────────────────────────────────────────────────
// 画面の名前だけでなく、欄の名前（SETTING_KEY_WORDS）でも当てる。当たった欄のある
// 画面を開く。今の構成で使わない節は、印を付けて出す（値はそこにある）。

export type SiteSearchRow = {
  target: string;
  /** 当たった欄（あれば）。行の一言の代わりに出し、開いたらその欄へ送る */
  field?: string;
  /** 今の構成では使わない */
  unused?: boolean;
};

function wordsFor(key: string): string {
  const words = SETTING_KEY_WORDS[key];
  return words ? words.join(" ") : key;
}

export function searchSite(
  query: string,
  outline: SiteOutline,
  ctx: SiteOutlineContext,
  language: "ja" | "en",
): SiteSearchRow[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = (text: string) => {
    const haystack = text.toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  };
  const skeleton: SiteSkeleton = "classic";
  const structure = outline.structure;
  const rows: SiteSearchRow[] = [];
  const fieldRows: SiteSearchRow[] = [];
  const seenSections = new Set<string>();
  const sectionKeys = SETTINGS_SECTION_KEYS as Record<string, readonly string[]>;
  // 欄の名前で当たったときは、その欄を添える（今の構成で使う欄を先に）。
  const fieldFor = (keys: readonly string[]): string | undefined => {
    const hit =
      keys.find((key) => !keyUnusedIn(structure, key) && matches(wordsFor(key))) ??
      keys.find((key) => matches(wordsFor(key)));
    return hit ? settingKeyLabel(hit, language) : undefined;
  };
  const sectionText = (sid: string) => {
    const item = settingsNavigationItems.find((i) => i.id === sid);
    return item ? `${item.ja} ${item.en} ${item.keywords} ${sid}` : sid;
  };
  const allIds: SitePartId[] = Array.from(
    new Set<SitePartId>([
      ...outline.pages.flatMap((p) => p.parts),
      ...outline.groups.flatMap((g) => [...g.parts, ...g.advanced]),
    ]),
  );
  for (const id of allIds) {
    const part: SitePart = SITE_PARTS[id];
    const sections = part.ref ? [] : sectionsForPart(part, skeleton, structure);
    const keys = [...sections.flatMap((sid) => sectionKeys[sid] ?? []), ...(part.keys ?? [])];
    const text = partText(part, structure, "ja", ctx.doors);
    const textEn = partText(part, structure, "en", ctx.doors);
    const own = `${text.label} ${text.note ?? ""} ${textEn.label} ${textEn.note ?? ""} ${part.keywords ?? ""} ${sections.map(sectionText).join(" ")}`;
    // 欄に当たれば、名前で当たったときも欄を添える（開いたらその欄へ送る）。
    const field = fieldFor(keys);
    const named = matches(own);
    if (!named && !field) continue;
    if (sections.length && sections.every((sid) => seenSections.has(sid))) continue;
    sections.forEach((sid) => seenSections.add(sid));
    (named ? rows : fieldRows).push({ target: id, field });
  }
  // 名前・一言で当たった画面を先に、欄の名前だけで当たった画面を後に（Enter で開くのは先頭）。
  rows.push(...fieldRows.splice(0));
  // 今の並びに無い節も、探せば開ける（値は残っている）。止めた骨格（写真中心）だけの節と、
  // 構成の切り替えの節は出さない（新しい構成では、構成の写真は /admin/pages で直す）。
  for (const group of SETTINGS_NAVIGATION) {
    for (const item of group.items) {
      if (seenSections.has(item.id)) continue;
      if (!BOOK_DESIGN_ENABLED && (item.id === "page-layout" || ("only" in item && item.only === "book"))) continue;
      if (structure === "develop" && DEVELOP_SECTIONS_EDITED_ELSEWHERE.includes(item.id)) continue;
      const field = fieldFor(sectionKeys[item.id] ?? []);
      if (!matches(sectionText(item.id)) && !field) continue;
      seenSections.add(item.id);
      rows.push({ target: `section:${item.id}`, field, unused: sectionUnusedIn(structure, item.id) || undefined });
    }
  }
  return rows;
}
