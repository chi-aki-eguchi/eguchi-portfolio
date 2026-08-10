// 作風プリセット。既存の設定値をひとまとまりで入れ替えるだけで、
// 新しい表示機能は増やさない。
//
// **なぜ必要か。** 設定は数多くあるが、その大半は同じ骨格の色・大きさ・間隔を
// 変えるものだった。買った人が初期値から少しずつ触ると、全員が同じ
// 「静か・中央揃え・細い書体・広い余白」に留まりやすい。強い設定を一つずつ
// 探させるのではなく、まとまった作風を選べる入口を用意する。
//
// **数値は入れない。** 倍率や寸法の範囲は `setting-ranges.ts` が正本なので、
// ここへ数字を書き戻すと二重管理になる。ここで扱うのは選択肢だけにする。
//
// 値はすべて既存キーの既存の選択肢。新しい値を発明しない。
//   heroMode          carousel | single | quiet-grid | editorial | immersive
//   heroDisplayMode   normal | fullscreen
//   heroTitlePosition center | bottom-left | bottom-right | top-left | top-right
//   heroOverlay       on | off
//   navPosition       top | left | bottom
//   navHoverEffect    fade | underline | dot | blur
//   headerBackground  solid | fade | none
//   gallery/series/topWorksLayout  12種（PhotoGallery の対応表）
//   bgTexture         none | grain-fine | grain-coarse | paper | marble | mist
//   photoRevealEffect fade | none | rise | scale
//   profileLayout     side | stack | quiet
//   contactLayout     center | left | split
//   seriesCardStyle   caption | overlay | wide
//   footerLayout      center | left | split
//   pageTitleStyle    label | left | display | hidden

export const SITE_MOOD_IDS = [
  "quiet",
  "editorial",
  "gallery",
  "darkroom",
] as const;

export type SiteMoodId = (typeof SITE_MOOD_IDS)[number];

export const SITE_MOODS: Record<SiteMoodId, Readonly<Record<string, string>>> =
  {
    // 既定に近い、静かな標準。初期状態へ戻す受け皿も兼ねる。
    quiet: {
      heroMode: "carousel",
      heroDisplayMode: "normal",
      heroTitlePosition: "center",
      heroOverlay: "on",
      navPosition: "top",
      navHoverEffect: "fade",
      headerBackground: "solid",
      galleryLayout: "mosaic",
      topWorksLayout: "stagger",
      seriesLayout: "mosaic",
      bgTexture: "none",
      photoRevealEffect: "fade",
      profileLayout: "side",
      contactLayout: "center",
      seriesCardStyle: "caption",
      footerLayout: "center",
      pageTitleStyle: "label",
    },
    // 雑誌の誌面。左に寄せ、下線で拾い、紙の地を薄く敷く。
    editorial: {
      heroMode: "editorial",
      heroDisplayMode: "normal",
      heroTitlePosition: "bottom-left",
      heroOverlay: "on",
      navPosition: "top",
      navHoverEffect: "underline",
      headerBackground: "solid",
      galleryLayout: "editorial",
      topWorksLayout: "editorial",
      seriesLayout: "large-format",
      bgTexture: "paper",
      photoRevealEffect: "rise",
      profileLayout: "stack",
      contactLayout: "split",
      seriesCardStyle: "wide",
      footerLayout: "left",
      pageTitleStyle: "display",
    },
    // 白い展示壁。等間隔に並べ、覆いを外し、余計な地を敷かない。
    gallery: {
      heroMode: "single",
      heroDisplayMode: "normal",
      heroTitlePosition: "center",
      heroOverlay: "off",
      navPosition: "top",
      navHoverEffect: "fade",
      headerBackground: "solid",
      galleryLayout: "clean-grid",
      topWorksLayout: "clean-grid",
      seriesLayout: "grid",
      bgTexture: "none",
      photoRevealEffect: "fade",
      profileLayout: "quiet",
      contactLayout: "left",
      seriesCardStyle: "caption",
      footerLayout: "center",
      pageTitleStyle: "left",
    },
    // 暗室。写真を画面いっぱいに置き、帯を消し、粒子を乗せる。
    darkroom: {
      heroMode: "immersive",
      heroDisplayMode: "fullscreen",
      heroTitlePosition: "bottom-left",
      heroOverlay: "on",
      navPosition: "top",
      navHoverEffect: "blur",
      headerBackground: "none",
      galleryLayout: "large-format",
      topWorksLayout: "masonry",
      seriesLayout: "masonry",
      bgTexture: "grain-coarse",
      photoRevealEffect: "scale",
      profileLayout: "stack",
      contactLayout: "left",
      seriesCardStyle: "overlay",
      footerLayout: "split",
      pageTitleStyle: "hidden",
    },
  };

// 作風が触るキーの一覧（重複なし）。適用時に「何件変わるか」を数えるのと、
// テストで台帳との整合を見るのに使う。
export const SITE_MOOD_KEYS: readonly string[] = [
  ...new Set(Object.values(SITE_MOODS).flatMap((m) => Object.keys(m))),
];
