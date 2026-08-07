import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, adminApi } from "../lib/api";
import { makeSettingsPreviewPayload } from "../lib/settings-preview";
import { uploadErrorMessageFromResponse } from "../lib/upload-file";
import {
  GOOGLE_FONTS_JA,
  GOOGLE_FONTS_EN,
  FONT_PAIRINGS,
  type FontDef,
} from "../components/provider";
import {
  Upload,
  Trash2,
  Check,
  X,
  Plus,
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Eye,
  EyeOff,
  Star,
  Shuffle,
  Pencil,
  GripVertical,
} from "lucide-react";
import {
  adminPhotoObjectPosition,
  adminPhotoSrc,
  assertOk,
  DEFAULT_CAMERA_PRESETS,
  DEFAULT_LENS_PRESETS,
  effectivePresets,
  jsonOrThrow,
  parsePresetList,
  postAdminSettings,
  usePersistentState,
  buildPublicSiteHref,
  settingsPreviewRatioFromWidth,
  settingsPreviewWidthBounds,
  settingsPreviewWidthFromRatio,
  SETTINGS_PREVIEW_WIDTH_KEY,
  type HeroPhotoRow,
  type Photo,
} from "./admin-shared";
import { AdminSettingsPreviewPane } from "./admin-settings-preview-pane";
import { PageHeader, PageHeaderButton } from "./admin-page-header";
import { PageShell } from "./admin-page-shell";
import {
  AddBlock,
  Button as AxButton,
  EmptyNote,
  Field as AxField,
  Page,
  PageTitle,
  Row,
  RowList,
  StatusDot,
  TextInput,
} from "./admin-ui";
import { AdminWorkspace } from "./admin-workspace";
import {
  AdminReorderBar,
  type ReorderBarFeedback,
} from "./admin-reorder-bar";
import {
  AdminSettingsFormLayout,
  useAdminSettingsActiveSection,
  type AdminSettingsSectionItem,
} from "./admin-settings-form-layout";
import { useAdminI18n } from "./admin-i18n";
import type { GalleryLayoutType } from "../components/PhotoGallery";
import { SETTING_RANGES } from "../../shared/setting-ranges";
import {
  draftAfterSuccessfulSave,
  hasUnsavedSettingsDraft,
} from "../lib/saved-draft";

const DEFAULT_THEME_BG = "#f7f7f7";
// styles.css の [data-theme="dark"] 既定と同じ値。未設定時のスウォッチと
// placeholder に出す「そのままなら何色になるか」を、実際の既定と一致させる。
const DEFAULT_THEME_BG_DARK = "#121212";
const DEFAULT_THEME_TEXT_DARK = "#e8e8e8";

export const SETTINGS_SECTION_KEYS = {
  "site-basics": [
    "siteName",
    "siteNameEn",
    "heroSubtitle",
    "siteDescription",
    "footerText",
    "contactIntro",
    "contactIntroEn",
    "contactNote",
    "contactNoteEn",
    "contactFlow",
    "contactFlowEn",
    "contactEnglishNote",
    "contactMessagePlaceholder",
    "contactEmail",
    "formspreeUrl",
    "siteUrl",
    "googleSiteVerification",
    "footerCtaLabel",
    "templateCreditLabel",
    "templateCreditUrl",
  ],
  "portfolio-kit": ["servicePageMode"],
  hero: [
    "heroMode",
    "heroMotionSpeed",
    "heroRevealOrder",
    "heroHeight",
    "heroOverlay",
    "heroDisplayMode",
    "heroTitlePosition",
    "heroScrollEffect",
  ],
  navigation: ["navPosition", "navHoverEffect"],
  spacing: [
    "spacingHeroBottom",
    "spacingSectionGap",
    "spacingPageTop",
    "spacingFooterTop",
  ],
  texture: ["bgTexture", "bgTextureOpacity"],
  reveal: ["photoRevealEffect"],
  "gallery-layout": [
    "galleryLayout",
    "seriesLayout",
    "topWorksLayout",
    "topWorksMode",
    "topWorksIds",
    "homeGalleryCount",
    "galleryColumns",
    "gallerySizeScale",
    "galleryGapScale",
    "topWorksColumns",
    "topWorksSizeScale",
    "topWorksGapScale",
    "galleryEmptyRate",
    "gallerySizeVariation",
    "gallerySeed",
  ],
  series: [
    "seriesNavEnabled",
    "worksDefaultView",
    "seriesGridColumns",
    "seriesGridColumnsMobile",
    "gallerySortOrder",
    "seriesSortOrder",
  ],
  note: ["noteEnabled", "noteUsername", "noteShowCount"],
  print: [
    "printEnabled",
    "printStoreUrl",
    "printStoreLabel",
    "printDescription",
  ],
  cta: ["homeCtaEnabled", "homeCtaTitle", "homeCtaText", "homeCtaButton"],
  theme: ["themeBg", "themeText", "themeBgDark", "themeTextDark"],
  fonts: [
    "fontJa",
    "customFontJaName",
    "customFontJaUrl",
    "customFontJaCategory",
    "fontEn",
    "customFontEnName",
    "customFontEnUrl",
    "customFontEnCategory",
    "heroNameWeight",
    "bodyWeight",
  ],
  "font-size": [
    "globalFontScale",
    "heroNameSize",
    "heroNameEnSize",
    "heroSubSize",
    "navSize",
    "sectionLabelSize",
    "headingSize",
    "bodySize",
    "footerSize",
  ],
  "font-color": [
    "heroNameColor",
    "heroNameEnColor",
    "heroSubColor",
    "accentColor",
    "linkHoverColor",
    "linkUnderline",
    "navOpacity",
    "sectionLabelOpacity",
    "footerOpacity",
    "snsOpacity",
  ],
  "font-spacing": [
    "heroNameTracking",
    "heroNameEnTracking",
    "navTracking",
    "sectionLabelTracking",
    "sectionLeading",
    "bodyTracking",
    "bodyLeading",
  ],
  "site-copy": [
    "navLabelTop",
    "navLabelGallery",
    "navLabelAbout",
    "navLabelContact",
    "snsLabelInstagram",
    "snsLabelTwitter",
    "snsLabelNote",
    "worksLabel",
    "viewAllLabel",
    "viewAllCtaLabel",
    "galleryLabel",
    "filterAllLabel",
    "profileLabel",
    "contactLabel",
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
  presets: ["metaPresetsCamera", "metaPresetsLens"],
} as const;

type SettingsSectionId = keyof typeof SETTINGS_SECTION_KEYS;

// 本文へ出す節が属するグループの台帳。単節表示では、現在の節を含まない
// グループの見出しを描かないためにこれを使う。19節をちょうど1回ずつ含むことを
// `admin-settings-section-keys.test.ts` が固定する。
export const SETTINGS_SECTION_GROUPS = {
  general: [
    "site-basics",
    "portfolio-kit",
    "hero",
    "navigation",
    "spacing",
    "texture",
    "reveal",
    "gallery-layout",
    "series",
  ],
  integrations: ["note", "print", "cta"],
  design: [
    "theme",
    "fonts",
    "font-size",
    "font-color",
    "font-spacing",
    "site-copy",
    "presets",
  ],
} as const satisfies Record<string, readonly SettingsSectionId[]>;

function dirtySettingsKeys(
  draft: Readonly<Record<string, string>>,
  saved: Readonly<Record<string, string>> | undefined,
) {
  return Object.entries(draft)
    .filter(([key, value]) => value !== (saved?.[key] ?? ""))
    .map(([key]) => key);
}

function settingsSectionIdsForKeys(keys: readonly string[]) {
  const keySet = new Set(keys);
  return (Object.keys(SETTINGS_SECTION_KEYS) as SettingsSectionId[]).filter(
    (sectionId) =>
      SETTINGS_SECTION_KEYS[sectionId].some((key) => keySet.has(key)),
  );
}

// Settings are the authoritative source for these tabs.  Do not render an
// editable fallback when that source could not be read: Service in particular
// parses an absent value as its defaults, which must never look like saved data.
function SettingsLoadError({
  title,
  onRetry,
}: {
  title: string;
  onRetry: () => void;
}) {
  const { t } = useAdminI18n();
  return (
    <PageShell>
      <PageHeader title={title} />
      <div className="admin-status-warning rounded-sm p-5 space-y-3">
        <h2 className="text-[length:var(--admin-text-body)]">
          {t.setup.loadError.title}
        </h2>
        <p className="text-[length:var(--admin-text-body)] leading-6">
          {t.setup.loadError.body}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm"
        >
          {t.setup.loadError.retry}
        </button>
        <p className="text-[length:var(--admin-text-note)] leading-5">
          {t.setup.loadError.contact}
        </p>
      </div>
    </PageShell>
  );
}

// Single source of truth for the 9 gallery layout choices, shared by the
// Settings→ギャラリー配置 picker and the per-series layout override picker.
// Category grouping + one-line desc per docs/specs request (2026-07-09):
// clarify what each layout looks like without relying on a hover title.
type GalleryLayoutCategory = "aligned" | "editorial";

const GALLERY_LAYOUT_OPTIONS: {
  value: GalleryLayoutType;
  name: string;
  desc: string;
  category: GalleryLayoutCategory;
}[] = [
  {
    value: "grid",
    name: "写真比率グリッド",
    desc: "元の縦横比を保って整列",
    category: "aligned",
  },
  {
    value: "clean-grid",
    name: "正方形グリッド",
    desc: "Instagram風・すべて正方形",
    category: "aligned",
  },
  {
    value: "portrait-grid",
    name: "縦長グリッド",
    desc: "縦長4:5・人物写真向け",
    category: "aligned",
  },
  {
    value: "landscape-grid",
    name: "横長グリッド",
    desc: "横長3:2・風景写真向け",
    category: "aligned",
  },
  {
    value: "masonry",
    name: "マソンリー",
    desc: "3列・縦横比を保って敷き詰め",
    category: "aligned",
  },
  {
    value: "justified",
    name: "行組み",
    desc: "縦横比を保ち行ごとに敷き詰め・S/M/Lで大小",
    category: "aligned",
  },
  {
    value: "mosaic",
    name: "モザイク",
    desc: "S/M/L混在・抜け感のある並び",
    category: "editorial",
  },
  {
    value: "scroll",
    name: "縦スクロール1枚",
    desc: "1枚ずつ大きく＋情報を添えて表示",
    category: "editorial",
  },
  {
    value: "stagger",
    name: "ずらし大",
    desc: "1枚ずつ左右互い違いに配置",
    category: "editorial",
  },
  {
    value: "editorial",
    name: "雑誌見開き",
    desc: "2枚1組・左大右小の見開き風",
    category: "editorial",
  },
  {
    value: "collage",
    name: "コラージュ",
    desc: "重なりと角度でスナップ写真風",
    category: "editorial",
  },
  {
    value: "large-format",
    name: "大判",
    desc: "2列の大判表示＋キャプション",
    category: "editorial",
  },
];

type LayoutIconRect = {
  l: number;
  t: number;
  w: number;
  h: number;
  rotate?: number;
  opacity?: number;
};

// Rough per-layout diagrams (percentages of a 100x100 box) — a visual hint,
// not a pixel-accurate preview of the real layout.
const LAYOUT_ICON_RECTS: Record<GalleryLayoutType, LayoutIconRect[]> = {
  mosaic: [
    { l: 2, t: 6, w: 42, h: 60 },
    { l: 48, t: 6, w: 50, h: 26 },
    { l: 48, t: 40, w: 50, h: 26 },
  ],
  grid: [
    // Each cell keeps its own (varied) aspect ratio, with a visible gap —
    // distinguishes it from clean-grid's dense uniform squares below.
    { l: 2, t: 2, w: 44, h: 34 },
    { l: 54, t: 2, w: 44, h: 50 },
    { l: 2, t: 44, w: 44, h: 54 },
    { l: 54, t: 60, w: 44, h: 38 },
  ],
  scroll: [{ l: 30, t: 2, w: 40, h: 96 }],
  stagger: [
    { l: 4, t: 4, w: 58, h: 42 },
    { l: 40, t: 54, w: 58, h: 42 },
  ],
  editorial: [
    { l: 2, t: 4, w: 56, h: 92 },
    { l: 62, t: 30, w: 36, h: 62 },
  ],
  collage: [
    { l: 12, t: 14, w: 48, h: 48, rotate: -7 },
    { l: 38, t: 32, w: 48, h: 48, rotate: 6 },
  ],
  "clean-grid": [
    // Dense uniform squares, near-zero gap — mirrors the real 4-col/2-col
    // contact-sheet grid, contrasted with grid's gapped varied-ratio cells.
    { l: 0, t: 6, w: 31, h: 31 },
    { l: 33, t: 6, w: 31, h: 31 },
    { l: 66, t: 6, w: 31, h: 31 },
    { l: 0, t: 39, w: 31, h: 31 },
    { l: 33, t: 39, w: 31, h: 31 },
    { l: 66, t: 39, w: 31, h: 31 },
  ],
  "portrait-grid": [
    // 3 equal tall columns — every cell forced to the same 4:5 ratio.
    { l: 2, t: 4, w: 29, h: 92 },
    { l: 35, t: 4, w: 29, h: 92 },
    { l: 68, t: 4, w: 29, h: 92 },
  ],
  "landscape-grid": [
    // 2 equal wide columns — every cell forced to the same 3:2 ratio.
    { l: 2, t: 4, w: 46, h: 42 },
    { l: 52, t: 4, w: 46, h: 42 },
    { l: 2, t: 54, w: 46, h: 42 },
    { l: 52, t: 54, w: 46, h: 42 },
  ],
  masonry: [
    { l: 2, t: 2, w: 28, h: 40 },
    { l: 2, t: 46, w: 28, h: 52 },
    { l: 34, t: 2, w: 28, h: 60 },
    { l: 34, t: 66, w: 28, h: 32 },
    { l: 66, t: 2, w: 32, h: 30 },
    { l: 66, t: 36, w: 32, h: 62 },
  ],
  "large-format": [
    { l: 2, t: 4, w: 46, h: 78 },
    { l: 52, t: 4, w: 46, h: 78 },
  ],
  justified: [
    // Flush rows of varied widths; the last row deliberately stops short —
    // mirrors the real layout's non-stretched final row.
    { l: 2, t: 4, w: 40, h: 27 },
    { l: 45, t: 4, w: 23, h: 27 },
    { l: 71, t: 4, w: 27, h: 27 },
    { l: 2, t: 35, w: 29, h: 31 },
    { l: 34, t: 35, w: 64, h: 31 },
    { l: 2, t: 70, w: 44, h: 26 },
    { l: 49, t: 70, w: 25, h: 26 },
  ],
};

// Generic line-diagram renderer shared by every visual choice picker in
// Settings (gallery layout, Hero mode, nav position, ...). Kept separate from
// LayoutIcon's gallery-specific rect data so non-gallery pickers can supply
// their own rects without depending on GalleryLayoutType.
function MiniDiagram({ rects }: { rects: LayoutIconRect[] }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "relative", width: "100%", paddingTop: "62%" }}
    >
      {rects.map((r, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${r.l}%`,
            top: `${r.t}%`,
            width: `${r.w}%`,
            height: `${r.h}%`,
            border: "1.5px solid currentColor",
            borderRadius: 1,
            opacity: r.opacity ?? 0.7,
            transform: r.rotate ? `rotate(${r.rotate}deg)` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function LayoutIcon({ value }: { value: GalleryLayoutType }) {
  return <MiniDiagram rects={LAYOUT_ICON_RECTS[value] ?? []} />;
}

// Shared card for every "pick one, see what it looks like" control in
// Settings (Settings可視化 Phase 1, 2026-07-09): a diagram or preview node,
// a name, and an always-visible one-line description. Deliberately
// monochrome (currentColor + admin-ink/admin-paper-soft only) — no color
// badges, no icons beyond the diagram, per owner's "quiet, editorial" brief.
function VisualChoiceCard({
  active,
  name,
  desc,
  preview,
  onClick,
}: {
  active: boolean;
  name: string;
  desc: string;
  preview: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left px-2 py-2 rounded-sm border transition-colors ${
        active
          ? "admin-btn-primary font-medium"
          : "bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] border-[var(--admin-line)]"
      }`}
    >
      {preview}
      <span className="block text-[length:var(--admin-text-note)] leading-tight mt-1">{name}</span>
      <span className="block text-[length:var(--admin-text-note)] leading-tight opacity-70 font-normal mt-0.5">
        {desc}
      </span>
    </button>
  );
}

// Hero display mode (heroMode) — 5 options, values/defaults unchanged.
const HERO_MODE_OPTIONS: {
  value: string;
  name: string;
  desc: string;
  rects: LayoutIconRect[];
}[] = [
  {
    value: "carousel",
    name: "カルーセル",
    desc: "複数写真が順番に切り替わる",
    rects: [
      { l: 6, t: 4, w: 88, h: 74 },
      { l: 38, t: 86, w: 8, h: 8 },
      { l: 50, t: 86, w: 8, h: 8 },
      { l: 62, t: 86, w: 8, h: 8 },
    ],
  },
  {
    value: "single",
    name: "1枚絵",
    desc: "1枚を大きく固定表示",
    rects: [{ l: 6, t: 4, w: 88, h: 92 }],
  },
  {
    value: "quiet-grid",
    name: "静謐グリッド",
    desc: "複数枚を整然と見せる",
    rects: [
      { l: 2, t: 2, w: 46, h: 46 },
      { l: 52, t: 2, w: 46, h: 46 },
      { l: 2, t: 52, w: 46, h: 46 },
      { l: 52, t: 52, w: 46, h: 46 },
    ],
  },
  {
    value: "editorial",
    name: "エディトリアル",
    desc: "大小をつけた写真集風",
    rects: [
      { l: 2, t: 4, w: 56, h: 92 },
      { l: 62, t: 30, w: 36, h: 62 },
    ],
  },
  {
    value: "immersive",
    name: "没入型",
    desc: "画面いっぱいに写真を見せる",
    rects: [{ l: 0, t: 0, w: 100, h: 100 }],
  },
];

const HERO_MOTION_SPEED_OPTIONS = [
  { value: "slow", label: "ゆっくり" },
  { value: "standard", label: "標準" },
  { value: "quick", label: "すばやく" },
] as const;

const HERO_REVEAL_ORDER_OPTIONS = [
  { value: "text-first", label: "文字から" },
  { value: "photo-first", label: "写真から" },
  { value: "together", label: "同時に" },
] as const;

// Nav position (navPosition) — 3 options, values/defaults unchanged.
const NAV_POSITION_OPTIONS: {
  value: string;
  name: string;
  desc: string;
  rects: LayoutIconRect[];
}[] = [
  {
    value: "top",
    name: "上",
    desc: "画面上部に固定",
    rects: [
      { l: 4, t: 4, w: 92, h: 14 },
      { l: 4, t: 30, w: 92, h: 66 },
    ],
  },
  {
    value: "left",
    name: "左 縦置き",
    desc: "画面左に縦のメニュー",
    rects: [
      { l: 4, t: 4, w: 14, h: 92 },
      { l: 30, t: 4, w: 66, h: 92 },
    ],
  },
  {
    value: "bottom",
    name: "下 固定",
    desc: "画面下部に固定",
    rects: [
      { l: 4, t: 4, w: 92, h: 66 },
      { l: 4, t: 82, w: 92, h: 14 },
    ],
  },
];

// Background texture (bgTexture) — 6 options. Preview swatches reuse the
// exact feTurbulence SVGs from styles.css (body[data-texture=...]::before)
// so the admin preview matches the real texture, not an abstract stand-in.
// 2026-07-09: 全種見直し(高解像度化+コントラスト強化) + marble/mist を追加。
const TEXTURE_PREVIEW_BG: Record<string, string | null> = {
  none: null,
  "grain-fine":
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='2.4' intercept='-0.42'/><feFuncG type='linear' slope='2.4' intercept='-0.42'/><feFuncB type='linear' slope='2.4' intercept='-0.42'/></feComponentTransfer></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
  "grain-coarse":
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='480'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.28' numOctaves='5' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='2.2' intercept='-0.38'/><feFuncG type='linear' slope='2.2' intercept='-0.38'/><feFuncB type='linear' slope='2.2' intercept='-0.38'/></feComponentTransfer></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
  paper:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.018 0.11' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='2.0' intercept='-0.32'/><feFuncG type='linear' slope='2.0' intercept='-0.32'/><feFuncB type='linear' slope='2.0' intercept='-0.32'/></feComponentTransfer></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
  marble:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='500' height='500'><filter id='n'><feTurbulence type='turbulence' baseFrequency='0.012 0.06' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='1.5' intercept='-0.18'/><feFuncG type='linear' slope='1.5' intercept='-0.18'/><feFuncB type='linear' slope='1.5' intercept='-0.18'/></feComponentTransfer></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
  mist: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='560' height='560'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='2.0' intercept='-0.35'/><feFuncG type='linear' slope='2.0' intercept='-0.35'/><feFuncB type='linear' slope='2.0' intercept='-0.35'/></feComponentTransfer></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
};

const BG_TEXTURE_OPTIONS: { value: string; name: string; desc: string }[] = [
  { value: "none", name: "なし", desc: "質感を足さない" },
  { value: "grain-fine", name: "フィルム粒子", desc: "細かく均一な粒子感" },
  { value: "grain-coarse", name: "粗い紙", desc: "ざらついた紙の繊維感" },
  { value: "paper", name: "和紙・繊維", desc: "縦に流れる繊維状のムラ" },
  { value: "marble", name: "大理石調", desc: "波紋のような上品なムラ" },
  { value: "mist", name: "霞（かすみ）", desc: "柔らかい雲のようなムラ" },
];

// Fixed neutral swatch backdrop (not the admin theme color) so the texture's
// own character reads the same in light/dark admin mode.
function TexturePreview({ value }: { value: string }) {
  const bg = TEXTURE_PREVIEW_BG[value];
  return (
    <div
      aria-hidden="true"
      style={{
        width: "100%",
        paddingTop: "62%",
        position: "relative",
        border: "1px solid currentColor",
        borderRadius: 1,
        opacity: 0.85,
        background: "#e9e6e1",
        overflow: "hidden",
      }}
    >
      {bg && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: bg,
            backgroundSize: "cover",
            // Exaggerated vs. the real default (0.05) so the pattern
            // difference is visible at swatch size — see the note under the
            // picker. Not a preview of the actual on-site strength.
            opacity: 0.22,
          }}
        />
      )}
    </div>
  );
}

// Photo fade-in (photoRevealEffect) — 4 options. Static diagrams only (a
// ghost + final-position rect pair) rather than looping animation previews —
// owner explicitly asked to keep this calm rather than "noisy" (2026-07-09).
const FADE_OPTIONS: {
  value: string;
  name: string;
  desc: string;
  rects: LayoutIconRect[];
}[] = [
  {
    value: "fade",
    name: "フェード",
    desc: "透明から少しずつ現れる",
    rects: [{ l: 15, t: 15, w: 70, h: 70, opacity: 0.35 }],
  },
  {
    value: "none",
    name: "なし",
    desc: "即表示・動きなし",
    rects: [{ l: 15, t: 15, w: 70, h: 70, opacity: 1 }],
  },
  {
    value: "rise",
    name: "浮き上がり",
    desc: "少し下から上がってくる",
    rects: [
      { l: 20, t: 58, w: 60, h: 32, opacity: 0.3 },
      { l: 20, t: 10, w: 60, h: 55, opacity: 0.9 },
    ],
  },
  {
    value: "scale",
    name: "ズーム",
    desc: "小さくから拡大して現れる",
    rects: [
      { l: 32, t: 32, w: 36, h: 36, opacity: 0.3 },
      { l: 8, t: 8, w: 84, h: 84, opacity: 0.9 },
    ],
  },
];

export function HeroTab() {
  const qc = useQueryClient();
  const { t } = useAdminI18n();
  const copy = t.phase2b.hero;
  const reorderCopy = t.phase2b.library.reorder;
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [heroError, setHeroError] = useState("");
  const [reorderTargetId, setReorderTargetId] = useState<number | null>(null);
  const [positionValue, setPositionValue] = useState("");
  const [reorderFeedback, setReorderFeedback] =
    useState<ReorderBarFeedback>(null);
  const [lastMove, setLastMove] = useState<{
    before: number[];
    after: number[];
    from: number;
    to: number;
  } | null>(null);

  // All gallery photos
  const { data: photosData, isLoading: photosLoading } = useQuery({
    queryKey: ["photos", "all"],
    queryFn: async () =>
      jsonOrThrow(await api.photos.$get({ query: { all: "1" } })),
  });
  const allPhotos = photosData?.photos ?? [];

  // Selected hero photos (photoId list)
  const { data: heroData, isLoading: heroLoading } = useQuery({
    queryKey: ["admin-hero-photos"],
    queryFn: async (): Promise<{ heroPhotos: HeroPhotoRow[] }> =>
      jsonOrThrow(await adminApi["hero-photos"].$get()),
  });
  const heroPhotoIds = new Set(
    (heroData?.heroPhotos ?? []).map((h) => h.photoId),
  );
  const heroPhotos = (heroData?.heroPhotos ?? [])
    .map((h) => {
      const photo = allPhotos.find((p) => p.id === h.photoId);
      return photo ? { ...photo, heroSort: h.sortOrder } : null;
    })
    .filter(Boolean) as ((typeof allPhotos)[number] & { heroSort: number })[];
  // Hero rows whose photo was trashed/purged. Surfacing them matters twice over:
  // the selection silently stops driving the public hero (fallback kicks in with
  // no explanation here), and restoring such a photo from the trash would make
  // it pop back into the hero unexpectedly.
  const danglingHeroIds = photosLoading
    ? []
    : (heroData?.heroPhotos ?? [])
        .filter((h) => !allPhotos.some((p) => p.id === h.photoId))
        .map((h) => h.photoId);

  const onHeroError = () => setHeroError(copy.error);

  const addHero = useMutation({
    mutationFn: async (photoId: number) => {
      const res = await adminApi["hero-photos"].$post({ json: { photoId } });
      assertOk(res);
    },
    onSuccess: () => {
      setHeroError("");
      qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
      qc.invalidateQueries({ queryKey: ["hero-photos"] });
    },
    onError: onHeroError,
  });

  const removeHero = useMutation({
    mutationFn: async (photoId: number) => {
      const res = await adminApi["hero-photos"][":id"].$delete({
        param: { id: String(photoId) },
      });
      assertOk(res);
    },
    onSuccess: () => {
      setHeroError("");
      qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
      qc.invalidateQueries({ queryKey: ["hero-photos"] });
    },
    onError: onHeroError,
  });

  const reorderHero = useMutation({
    mutationFn: async ({
      photoIds,
      expectedIds,
    }: {
      photoIds: number[];
      expectedIds: number[];
      move: {
        before: number[];
        after: number[];
        from: number;
        to: number;
      } | null;
      undo: boolean;
    }) => {
      const res = await adminApi["hero-photos"].reorder.$post({
        json: { photoIds, expectedIds },
      });
      assertOk(res);
    },
    onMutate: async ({ photoIds }) => {
      await qc.cancelQueries({ queryKey: ["admin-hero-photos"] });
      const previous = qc.getQueryData<{ heroPhotos: HeroPhotoRow[] }>([
        "admin-hero-photos",
      ]);
      qc.setQueryData<{ heroPhotos: HeroPhotoRow[] }>(
        ["admin-hero-photos"],
        (current) => {
          if (!current) return current;
          const byPhotoId = new Map(
            current.heroPhotos.map((row) => [row.photoId, row]),
          );
          return {
            heroPhotos: photoIds
              .map((photoId, index) => {
                const row = byPhotoId.get(photoId);
                return row ? { ...row, sortOrder: index } : null;
              })
              .filter((row): row is HeroPhotoRow => row !== null),
          };
        },
      );
      setReorderFeedback({
        state: "saving",
        message: reorderCopy.saving,
      });
      return { previous };
    },
    onSuccess: async (_data, variables) => {
      setHeroError("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-hero-photos"] }),
        qc.invalidateQueries({ queryKey: ["hero-photos"] }),
      ]);
      setLastMove(variables.undo ? null : variables.move);
      setReorderFeedback({
        state: "saved",
        message: variables.undo ? reorderCopy.undoSaved : reorderCopy.saved,
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        qc.setQueryData(["admin-hero-photos"], context.previous);
      }
      setHeroError(copy.error);
      setReorderFeedback({ state: "error", message: copy.error });
    },
  });

  const cleanupDangling = useMutation({
    mutationFn: async () => {
      if (danglingHeroIds.length === 0) return;
      const res = await adminApi["hero-photos"].cleanup.$post({
        json: { photoIds: danglingHeroIds },
      });
      assertOk(res);
    },
    onSuccess: () => {
      setHeroError("");
      qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
      qc.invalidateQueries({ queryKey: ["hero-photos"] });
    },
    onError: onHeroError,
  });

  const submitHeroOrder = (
    before: number[],
    after: number[],
    from: number,
    to: number,
  ) => {
    if (reorderHero.isPending || from === to) return;
    reorderHero.mutate({
      photoIds: after,
      expectedIds: before,
      move: { before, after, from: from + 1, to: to + 1 },
      undo: false,
    });
  };

  const moveHeroTo = (id: number, toIndex: number) => {
    const before = heroPhotos.map((photo) => photo.id);
    const from = before.indexOf(id);
    const boundedTo = Math.max(0, Math.min(before.length - 1, toIndex));
    if (from < 0 || from === boundedTo) return;
    const after = [...before];
    after.splice(from, 1);
    after.splice(boundedTo, 0, id);
    setReorderTargetId(id);
    setPositionValue(String(boundedTo + 1));
    submitHeroOrder(before, after, from, boundedTo);
  };

  const handleDrop = (targetId: number) => {
    if (
      dragId == null ||
      dragId === targetId ||
      reorderHero.isPending
    )
      return;
    const toIndex = heroPhotos.findIndex((photo) => photo.id === targetId);
    moveHeroTo(dragId, toIndex);
    setDragId(null);
    setDragOverId(null);
  };

  const moveHero = (id: number, delta: number) => {
    const index = heroPhotos.findIndex((photo) => photo.id === id);
    moveHeroTo(id, index + delta);
  };

  const reorderTarget = heroPhotos.find(
    (photo) => photo.id === reorderTargetId,
  );
  const reorderTargetIndex = reorderTarget
    ? heroPhotos.findIndex((photo) => photo.id === reorderTarget.id)
    : -1;
  const parsedPosition = Number(positionValue);
  const positionInvalid =
    !Number.isInteger(parsedPosition) ||
    parsedPosition < 1 ||
    parsedPosition > heroPhotos.length;

  useEffect(() => {
    if (reorderTargetId !== null && !reorderTarget) {
      setReorderTargetId(null);
      setPositionValue("");
      setLastMove(null);
    }
  }, [reorderTarget, reorderTargetId]);

  if (photosLoading || heroLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-[var(--admin-muted)] text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <AdminWorkspace
      name="hero"
      actionBar={
        reorderTarget ? (
          <AdminReorderBar
            scope="hero"
            target={{
              id: reorderTarget.id,
              thumbnailSrc: adminPhotoSrc(reorderTarget, 160, 70),
              title:
                reorderTarget.title ||
                reorderTarget.filename ||
                t.phase2b.library.inspector.photoFallback,
              position: reorderTargetIndex + 1,
              total: heroPhotos.length,
            }}
            busy={reorderHero.isPending}
            feedback={reorderFeedback}
            moveSummary={
              lastMove
                ? reorderCopy.moveSummary(lastMove.from, lastMove.to)
                : null
            }
            undoAvailable={lastMove !== null}
            positionValue={positionValue}
            positionInvalid={positionInvalid}
            labels={{
              region: reorderCopy.region,
              position: reorderCopy.positionLabel(
                reorderTargetIndex + 1,
                heroPhotos.length,
              ),
              moveFirst: reorderCopy.moveFirst,
              movePrevious: reorderCopy.movePrevious,
              moveNext: reorderCopy.moveNext,
              moveLast: reorderCopy.moveLast,
              positionInput: reorderCopy.positionInput,
              moveAction: reorderCopy.moveAction,
              undo: reorderCopy.undo,
              chooseAgain: reorderCopy.chooseAgain,
              invalidPosition: reorderCopy.invalidPosition(heroPhotos.length),
            }}
            onMoveFirst={() => moveHeroTo(reorderTarget.id, 0)}
            onMovePrevious={() => moveHero(reorderTarget.id, -1)}
            onMoveNext={() => moveHero(reorderTarget.id, 1)}
            onMoveLast={() =>
              moveHeroTo(reorderTarget.id, heroPhotos.length - 1)
            }
            onPositionChange={setPositionValue}
            onMoveToPosition={() =>
              moveHeroTo(reorderTarget.id, parsedPosition - 1)
            }
            onUndo={() => {
              if (!lastMove || reorderHero.isPending) return;
              const restoredIndex = lastMove.before.indexOf(reorderTarget.id);
              setPositionValue(String(restoredIndex + 1));
              reorderHero.mutate({
                photoIds: lastMove.before,
                expectedIds: lastMove.after,
                move: null,
                undo: true,
              });
            }}
            onChooseAgain={() => {
              setReorderTargetId(null);
              setPositionValue("");
              setLastMove(null);
              setReorderFeedback(null);
            }}
            destructiveAction={{
              label: copy.removeAria,
              disabled: removeHero.isPending,
              onAction: () =>
                removeHero.mutate(reorderTarget.id, {
                  onSuccess: () => {
                    setReorderTargetId(null);
                    setPositionValue("");
                    setLastMove(null);
                    setReorderFeedback(null);
                  },
                }),
            }}
          />
        ) : undefined
      }
    >
      <PageHeader
        title={t.navigation.tabs.hero}
      />
      {heroError && (
        <div
          role="alert"
          className="admin-status-danger mb-4 flex items-center justify-between gap-3 text-[length:var(--admin-text-note)] rounded-sm px-3 py-2"
        >
          <span>{heroError}</span>
          <button
            onClick={() => setHeroError("")}
            aria-label={t.common.close}
            className="admin-text-danger opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {/* Dangling selections — photos that were trashed/purged after being picked */}
      {danglingHeroIds.length > 0 && (
        <div className="admin-status-warning mb-4 flex items-center justify-between gap-3 text-[length:var(--admin-text-note)] rounded-sm px-3 py-2">
          <span>{copy.danglingWarning(danglingHeroIds.length)}</span>
          <button
            onClick={() => cleanupDangling.mutate()}
            disabled={cleanupDangling.isPending}
            className="flex-shrink-0 text-[length:var(--admin-text-note)] px-2.5 py-1 rounded-sm underline underline-offset-2 disabled:opacity-50"
          >
            {cleanupDangling.isPending
              ? copy.cleaningUp
              : copy.removeFromSelection}
          </button>
        </div>
      )}
      {/* Selected Hero Photos */}
      <div className="mb-8">
        <h2 className="text-[length:var(--admin-text-note)] tracking-widest text-[var(--admin-muted)] mb-1">
          {copy.slidesTitle}
        </h2>
        <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mb-4">
          {copy.slidesHint}
        </p>
        {heroPhotos.length === 0 ? (
          <div className="border border-dashed border-[var(--admin-line)] rounded-sm p-8 text-center">
            <Star
              size={18}
              className="mx-auto text-[var(--admin-muted)] mb-2"
            />
            <p className="text-[length:var(--admin-text-body)] text-[var(--admin-muted)]">
              {copy.noneSelected}
            </p>
            <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mt-1">
              {copy.selectFromGalleryHint}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {heroPhotos.map((photo, i) => (
              <article
                key={photo.id}
                data-hero-slide={photo.id}
                data-hero-reorder-target={
                  reorderTargetId === photo.id ? "true" : "false"
                }
                className="min-w-0"
              >
                <button
                  type="button"
                  draggable={!reorderHero.isPending}
                  onDragStart={() => setDragId(photo.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverId(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverId(photo.id);
                  }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={() => handleDrop(photo.id)}
                  onClick={() => {
                    setReorderTargetId(photo.id);
                    setPositionValue(String(i + 1));
                    setReorderFeedback(null);
                  }}
                  aria-pressed={reorderTargetId === photo.id}
                  aria-label={reorderCopy.targetLabel(i + 1)}
                  className={`group relative block w-full overflow-hidden rounded-sm border-[length:var(--admin-accent-line)] transition-colors ${
                    reorderTargetId === photo.id
                      ? "border-[color:var(--admin-accent)]"
                      : dragOverId === photo.id
                        ? "border-[color:var(--admin-accent)]"
                        : "border-transparent"
                  }`}
                >
                  <img
                    src={adminPhotoSrc(photo, 600, 78)}
                    alt={photo.title}
                    className="w-full aspect-[4/3] object-cover"
                    style={{ objectPosition: adminPhotoObjectPosition(photo) }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute bottom-2 left-2 inline-flex h-8 w-8 items-center justify-center rounded-sm bg-black/65 text-white"
                  >
                    <GripVertical size={15} />
                  </span>
                </button>
                <div className="mt-1 flex min-h-5 items-center justify-between gap-2 text-[length:var(--admin-text-note)]">
                  <span className="text-[var(--admin-muted)]">
                    {i + 1}
                  </span>
                  {reorderTargetId === photo.id && (
                    <span className="text-[color:var(--admin-accent-fill)]">
                      {reorderCopy.targetPill}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Gallery: Pick photos */}
      <div>
        <h2 className="text-[length:var(--admin-text-note)] tracking-widest text-[var(--admin-muted)] mb-1">
          {copy.galleryTitle}
        </h2>
        <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mb-4">
          {copy.galleryHint}
        </p>
        {allPhotos.length === 0 ? (
          <p className="text-[length:var(--admin-text-body)] text-[var(--admin-muted)] text-center py-8">
            {copy.noPhotosYet}
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
            {allPhotos.map((photo) => {
              const isHero = heroPhotoIds.has(photo.id);
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() =>
                    isHero
                      ? removeHero.mutate(photo.id)
                      : addHero.mutate(photo.id)
                  }
                  disabled={addHero.isPending || removeHero.isPending}
                  aria-pressed={isHero}
                  aria-label={copy.toggleAria(
                    photo.title ||
                      photo.filename ||
                      t.phase2b.library.inspector.photoFallback,
                    isHero,
                  )}
                  className={`relative rounded-sm overflow-hidden cursor-pointer group border-2 transition-colors disabled:opacity-50 disabled:pointer-events-none ${
                    isHero
                      ? "border-[color:var(--admin-accent)]"
                      : "border-transparent hover:border-white/20"
                  }`}
                >
                  <img
                    src={adminPhotoSrc(photo, 200, 60)}
                    alt={photo.title}
                    className={`w-full aspect-square object-cover transition-opacity ${isHero ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                    style={{ objectPosition: adminPhotoObjectPosition(photo) }}
                  />
                  {isHero && (
                    <div className="absolute top-1 right-1">
                      <Star
                        size={12}
                        className="text-[color:var(--admin-accent-fill)] fill-current"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AdminWorkspace>
  );
}

/* ══════════════════════════════════════════════════
   PROFILE TAB — with profile photo upload
══════════════════════════════════════════════════ */
export function ProfileTab({
  onUnsavedChange,
}: {
  onUnsavedChange?: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { t } = useAdminI18n();
  const copy = t.phase2b.profile;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const initialLoadFailed = isError && data === undefined;

  // V: the unsaved draft survives tab switches / page moves.
  const [form, setForm] = usePersistentState<Record<string, string>>(
    "admin:profileDraft",
    {},
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const current = { ...data, ...form } as Record<string, string>;

  // Report unsaved-draft state so tab switches can warn (data-loss guard)
  const hasUnsaved = hasUnsavedSettingsDraft(form, data);
  useEffect(() => {
    onUnsavedChange?.(initialLoadFailed ? false : hasUnsaved);
  }, [hasUnsaved, initialLoadFailed, onUnsavedChange]);
  useEffect(() => () => onUnsavedChange?.(false), [onUnsavedChange]);
  // Warn on browser close/reload with unsaved changes
  useEffect(() => {
    if (initialLoadFailed || !hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved, initialLoadFailed]);

  const save = useMutation({
    mutationFn: async () => {
      const submitted = { ...form };
      await postAdminSettings(submitted);
      return submitted;
    },
    onSuccess: (submitted) => {
      setSaveError(false);
      qc.setQueryData(
        ["settings"],
        (old: Record<string, string> | undefined) => ({ ...old, ...submitted }),
      );
      setForm((current) => draftAfterSuccessfulSave(submitted, current));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => setSaveError(true),
  });

  const saveSettings = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await postAdminSettings(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleProfilePhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setPhotoError(copy.selectImageFile);
      return;
    }
    setPhotoError("");
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/profile/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) assertOk(res); // 401はログイン画面へ
        // 保存先未設定(STORAGE_NOT_CONFIGURED)は初回セットアップの主要経路
        // なので、汎用の失敗文言に潰さず専用の案内(不足変数名+再デプロイ)を出す
        setPhotoError(
          await uploadErrorMessageFromResponse(res, copy.uploadFailed),
        );
        return;
      }
      const { url } = await res.json();
      if (!url) throw new Error("no url");
      await saveSettings.mutateAsync({ profilePhotoUrl: url });
    } catch {
      setPhotoError(copy.uploadFailed);
    } finally {
      setPhotoUploading(false);
    }
  };

  const set = (key: string, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full gap-2 text-[var(--admin-muted)] text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading...
      </div>
    );

  if (initialLoadFailed) {
    return (
      <SettingsLoadError
        title={t.navigation.tabs.profile}
        onRetry={() => void refetch()}
      />
    );
  }

  const fields = [
    {
      key: "profileName",
      label: copy.fields.nameLabel,
      placeholder: copy.fields.namePlaceholder,
    },
    {
      key: "profileNameKata",
      label: copy.fields.nameKataLabel,
      placeholder: copy.fields.nameKataPlaceholder,
    },
    {
      key: "profileNameEn",
      label: copy.fields.nameEnLabel,
      placeholder: copy.fields.nameEnPlaceholder,
    },
    {
      key: "profileBio",
      label: copy.fields.bioLabel,
      multiline: true,
      placeholder: copy.fields.bioPlaceholder,
    },
    {
      key: "profileBioEn",
      label: copy.fields.bioEnLabel,
      multiline: true,
      placeholder: copy.fields.bioEnPlaceholder,
    },
    {
      key: "profileStatement",
      label: copy.fields.statementLabel,
      multiline: true,
      placeholder: copy.fields.statementPlaceholder,
    },
    {
      key: "profileStatementEn",
      label: copy.fields.statementEnLabel,
      multiline: true,
      placeholder: copy.fields.statementEnPlaceholder,
    },
    {
      key: "profileGear",
      label: copy.fields.gearLabel,
      multiline: true,
      placeholder: copy.fields.gearPlaceholder,
    },
    {
      key: "profileInstagram",
      label: copy.fields.instagramLabel,
      placeholder: copy.fields.instagramPlaceholder,
    },
    {
      key: "profileTwitter",
      label: copy.fields.xUrlLabel,
      placeholder: copy.fields.xUrlPlaceholder,
    },
    {
      key: "profileNote",
      label: copy.fields.noteUrlLabel,
      placeholder: copy.fields.noteUrlPlaceholder,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title={t.navigation.tabs.profile}
        description={t.headers.profile}
      />

      {/* Profile Photo Upload */}
      <div className="mb-8">
        <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] tracking-wider mb-3">
          {copy.photoTitle}
        </p>
        <div className="flex items-start gap-4">
          {data?.profilePhotoUrl ? (
            <img
              src={`${data.profilePhotoUrl}?w=300&q=80`}
              alt="Profile"
              className="w-28 h-36 object-cover border border-[var(--admin-line)] rounded-sm"
            />
          ) : (
            <div className="w-28 h-36 bg-[var(--admin-paper)] border border-[var(--admin-line)] rounded-sm flex items-center justify-center">
              <User size={20} className="text-[var(--admin-muted)]" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className={`border border-dashed rounded-sm px-4 py-3 text-center transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] w-full ${
                photoUploading
                  ? "cursor-default"
                  : "border-[var(--admin-line)] cursor-pointer"
              }`}
            >
              {photoUploading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2
                    size={12}
                    className="animate-spin text-[var(--admin-muted)]"
                  />
                  <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                    {t.common.uploading}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Upload size={12} className="text-[var(--admin-muted)]" />
                  <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                    {copy.uploadPhoto}
                  </span>
                </div>
              )}
            </button>
            <input
              aria-label={copy.selectPhotoAria}
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleProfilePhoto(f);
              }}
            />
            <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
              {copy.portraitRecommendation}
            </p>
            {photoError && (
              <p className="admin-text-danger text-[length:var(--admin-text-note)]">{photoError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {fields.map((f) => (
          <AdminField key={f.key} label={f.label}>
            {f.multiline ? (
              <textarea
                rows={5}
                aria-label={f.label}
                value={current[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="ax-input ax-input--area"
              />
            ) : (
              <input
                type="text"
                aria-label={f.label}
                value={current[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="ax-input"
              />
            )}
          </AdminField>
        ))}
      </div>
      <FloatingSaveBar
        show={hasUnsaved}
        pending={save.isPending}
        saved={saved}
        error={saveError}
        onSave={() => save.mutate()}
        onDiscard={() => {
          setForm({});
          setSaveError(false);
        }}
      />
    </PageShell>
  );
}

/* ══════════════════════════════════════════════════
   CATEGORIES TAB
══════════════════════════════════════════════════ */
export function CategoriesTab() {
  const qc = useQueryClient();
  const { t } = useAdminI18n();
  const copy = t.phase2b.categories;
  const [newSlug, setNewSlug] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [catError, setCatError] = useState("");
  const [reorderError, setReorderError] = useState("");
  const [deleteCatConfirm, setDeleteCatConfirm] = useState<{
    id: number;
    label: string;
  } | null>(null);

  const { data, isLoading: catsLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => jsonOrThrow(await api.categories.$get()),
  });
  const categories = data?.categories ?? [];

  // "all" and "__uncat__" are sentinels used by the gallery/admin filters, so a
  // category can't claim them. A duplicate slug would also hit the DB unique
  // constraint and fail silently — catch it up front with clear feedback.
  const RESERVED_SLUGS = ["all", "__uncat__"];

  const addCat = useMutation({
    mutationFn: async () => {
      const res = await adminApi.categories.$post({
        json: { slug: newSlug, label: newLabel },
      });
      assertOk(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setNewSlug("");
      setNewLabel("");
      setCatError("");
    },
    onError: () =>
      setCatError(copy.errors.addFailed),
  });

  const handleAddCat = () => {
    const slug = newSlug.trim();
    if (RESERVED_SLUGS.includes(slug)) {
      setCatError(copy.errors.reservedSlug(slug));
      return;
    }
    if (categories.some((c) => c.slug === slug)) {
      setCatError(copy.errors.duplicateSlug(slug));
      return;
    }
    setCatError("");
    addCat.mutate();
  };

  const deleteCat = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminApi.categories[":id"].$delete({
        param: { id: String(id) },
      });
      assertOk(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      // Photos in the deleted category were reassigned to uncategorized server-side.
      qc.invalidateQueries({ queryKey: ["photos"] });
    },
    // assertOk throws on a non-2xx; without an onError the row stays and the admin
    // wrongly assumes the delete worked. Surface it in the existing error slot.
    onError: () => setCatError(copy.errors.deleteFailed),
  });

  // Reorder controls the gallery filter order. Optimistically reorder the cache so
  // the move feels instant, then persist.
  const reorderCats = useMutation({
    mutationFn: async ({
      ids,
      expectedIds,
    }: {
      ids: number[];
      expectedIds: number[];
    }) => {
      const res = await adminApi.categories.reorder.$post({
        json: { ids, expectedIds },
      });
      assertOk(res);
    },
    onSuccess: () => {
      setReorderError("");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    // Revert the optimistic reorder and surface the failure instead of leaving the
    // UI showing an order that wasn't saved.
    onError: () => {
      setReorderError(copy.errors.reorderFailed);
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const moveCat = (id: number, delta: number) => {
    const ids = categories.map((c) => c.id);
    const expectedIds = [...ids];
    const idx = ids.indexOf(id);
    const to = idx + delta;
    if (idx < 0 || to < 0 || to >= ids.length) return;
    ids.splice(idx, 1);
    ids.splice(to, 0, id);
    // Optimistic cache update for instant feedback
    qc.setQueryData(["categories"], (old: typeof data) => {
      if (!old?.categories) return old;
      const byId = new Map(old.categories.map((c) => [c.id, c]));
      return {
        ...old,
        categories: ids.map((i) => byId.get(i)!).filter(Boolean),
      };
    });
    reorderCats.mutate({ ids, expectedIds });
  };

  return (
    <Page width="list">
      {/* 説明は1つだけ。以前は見出し直下とその下に、ほぼ同じ内容が2つ並んでいた */}
      <PageTitle
        title={t.navigation.tabs.categories}
        description={copy.description}
      />

      {reorderError && (
        <p role="alert" className="admin-text-danger text-[length:var(--admin-text-note)] mb-3">
          {reorderError}
        </p>
      )}

      {catsLoading ? (
        <div className="flex items-center h-24">
          <Loader2
            size={18}
            className="animate-spin text-[var(--admin-muted)]"
          />
        </div>
      ) : (
        <RowList>
          {categories.length === 0 && <EmptyNote>{copy.empty}</EmptyNote>}
          {categories.map((cat, i) => (
            <Row
              key={cat.id}
              lead={
                <>
                  <button
                    onClick={() => moveCat(cat.id, -1)}
                    disabled={i === 0 || reorderCats.isPending}
                    aria-label={copy.moveUp}
                    className="admin-tap-sm admin-compact text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] disabled:opacity-25 transition-colors leading-none"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveCat(cat.id, 1)}
                    disabled={
                      i === categories.length - 1 || reorderCats.isPending
                    }
                    aria-label={copy.moveDown}
                    className="admin-tap-sm admin-compact text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] disabled:opacity-25 transition-colors leading-none"
                  >
                    <ChevronDown size={14} />
                  </button>
                </>
              }
              title={cat.label}
              meta={cat.slug}
              actions={
                <AxButton
                  tone="danger"
                  size="small"
                  data-ax-reveal=""
                  onClick={() =>
                    setDeleteCatConfirm({ id: cat.id, label: cat.label })
                  }
                  aria-label={copy.deleteAria(cat.label)}
                >
                  <Trash2 size={14} />
                </AxButton>
              }
            />
          ))}
        </RowList>
      )}

      <AddBlock title={copy.newCategory}>
        <AxField label={copy.label} htmlFor="ax-cat-label">
          <TextInput
            id="ax-cat-label"
            aria-label={copy.labelAria}
            value={newLabel}
            onChange={(e) => {
              setNewLabel(e.target.value);
              setCatError("");
            }}
            placeholder="Street"
          />
        </AxField>
        <AxField label={copy.slug} htmlFor="ax-cat-slug">
          <TextInput
            id="ax-cat-slug"
            mono
            aria-label={copy.slugAria}
            value={newSlug}
            onChange={(e) => {
              setNewSlug(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              );
              setCatError("");
            }}
            placeholder="street"
          />
        </AxField>
        {catError && (
          <p className="admin-text-danger text-[length:var(--admin-text-note)]">{catError}</p>
        )}
        <AxButton
          tone="primary"
          className="self-start"
          onClick={handleAddCat}
          disabled={!newSlug || !newLabel || addCat.isPending}
          icon={<Plus size={13} />}
        >
          {copy.add}
        </AxButton>
      </AddBlock>

      {/* Delete confirm modal */}
      {deleteCatConfirm && (
        <Modal onClose={() => setDeleteCatConfirm(null)}>
          <p className="text-[length:var(--admin-text-body)] text-[var(--admin-ink)] mb-4">
            {copy.deleteConfirm(deleteCatConfirm.label)}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDeleteCatConfirm(null)}
              className="px-4 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => {
                deleteCat.mutate(deleteCatConfirm.id);
                setDeleteCatConfirm(null);
              }}
              className="admin-btn-danger px-4 py-1.5 text-[length:var(--admin-text-note)] rounded-sm transition-colors"
            >
              {t.common.deleteAction}
            </button>
          </div>
        </Modal>
      )}
    </Page>
  );
}

/* ══════════════════════════════════════════════════
   SERIES TAB (I1)
══════════════════════════════════════════════════ */
type SeriesRow = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  statement: string;
  coverPhotoId: number | null;
  sortOrder: number;
  isPublished: boolean;
  themeConfig?: string | null;
};
type SeriesDraft = {
  slug: string;
  title: string;
  subtitle: string;
  statement: string;
  coverPhotoId: string;
  themeConfig: string;
};

export function SeriesTab() {
  const qc = useQueryClient();
  const { t } = useAdminI18n();
  const copy = t.phase2b.series;
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [addError, setAddError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<SeriesDraft>({
    slug: "",
    title: "",
    subtitle: "",
    statement: "",
    coverPhotoId: "",
    themeConfig: "",
  });
  const [rowError, setRowError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    title: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-series"],
    queryFn: async (): Promise<{ series: SeriesRow[] }> =>
      jsonOrThrow(await adminApi.series.$get()),
  });
  const series = (data?.series ?? []) as SeriesRow[];

  const { data: photosData, isLoading: photosLoading } = useQuery({
    queryKey: ["photos", "all"],
    queryFn: async () =>
      jsonOrThrow(await api.photos.$get({ query: { all: "1" } })),
  });
  const photos = photosData?.photos ?? [];
  const photoLabel = (id: number | null) => {
    if (!id) return "";
    const p = photos.find((x) => x.id === id);
    // 表紙が削除済み写真を指したままの場合、裸のIDではなく言葉で伝える
    return p ? p.title || p.filename : copy.deletedCover;
  };

  const addSeries = useMutation({
    mutationFn: async () => {
      const res = await adminApi.series.$post({
        json: { slug: newSlug, title: newTitle },
      });
      assertOk(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-series"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      setNewTitle("");
      setNewSlug("");
      setAddError("");
    },
    onError: () =>
      setAddError(copy.errors.addFailed),
  });
  const handleAdd = () => {
    const slug = newSlug.trim();
    if (!slug || !newTitle.trim()) return;
    if (series.some((s) => s.slug === slug)) {
      setAddError(copy.errors.duplicateSlug(slug));
      return;
    }
    setAddError("");
    addSeries.mutate();
  };

  const patchSeries = useMutation({
    mutationFn: async (payload: { id: number } & Record<string, unknown>) => {
      const { id, ...body } = payload;
      const res = await adminApi.series[":id"].$patch({
        param: { id: String(id) },
        json: body,
      });
      assertOk(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-series"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      setRowError("");
    },
    onError: () => setRowError(copy.errors.saveFailed),
  });

  const deleteSeries = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminApi.series[":id"].$delete({
        param: { id: String(id) },
      });
      assertOk(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-series"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      // Photos were detached server-side — refresh so the inspector reflects it.
      qc.invalidateQueries({ queryKey: ["photos"] });
    },
    onError: () => setRowError(copy.errors.deleteFailed),
  });

  const reorder = useMutation({
    mutationFn: async ({
      ids,
      expectedIds,
    }: {
      ids: number[];
      expectedIds: number[];
    }) => {
      const res = await adminApi.series.reorder.$post({
        json: { ids, expectedIds },
      });
      assertOk(res);
    },
    onSuccess: () => {
      setRowError("");
      qc.invalidateQueries({ queryKey: ["admin-series"] });
      qc.invalidateQueries({ queryKey: ["series"] });
    },
    onError: () => {
      setRowError(copy.errors.reorderFailed);
      qc.invalidateQueries({ queryKey: ["admin-series"] });
    },
  });
  const move = (id: number, delta: number) => {
    const ids = series.map((s) => s.id);
    const expectedIds = [...ids];
    const idx = ids.indexOf(id);
    const to = idx + delta;
    if (idx < 0 || to < 0 || to >= ids.length) return;
    ids.splice(idx, 1);
    ids.splice(to, 0, id);
    qc.setQueryData(["admin-series"], (old: typeof data) => {
      if (!old?.series) return old;
      const byId = new Map((old.series as SeriesRow[]).map((s) => [s.id, s]));
      return { ...old, series: ids.map((i) => byId.get(i)!).filter(Boolean) };
    });
    reorder.mutate({ ids, expectedIds });
  };

  const openEdit = (s: SeriesRow) => {
    setEditId(s.id);
    setRowError("");
    setDraft({
      slug: s.slug,
      title: s.title,
      subtitle: s.subtitle,
      statement: s.statement,
      coverPhotoId: s.coverPhotoId ? String(s.coverPhotoId) : "",
      themeConfig: s.themeConfig ?? "",
    });
  };

  // Parse themeConfig JSON for the inline editor (safe fallback on invalid JSON).
  const parsedTheme = (() => {
    try {
      return draft.themeConfig
        ? (JSON.parse(draft.themeConfig) as Record<string, string>)
        : {};
    } catch {
      return {};
    }
  })();
  const setThemeKey = (key: string, value: string) => {
    const next = { ...parsedTheme, [key]: value };
    setDraft((d) => ({ ...d, themeConfig: JSON.stringify(next) }));
  };

  const saveEdit = () => {
    if (editId === null) return;
    patchSeries.mutate(
      {
        id: editId,
        slug: draft.slug,
        title: draft.title,
        subtitle: draft.subtitle,
        statement: draft.statement,
        coverPhotoId:
          draft.coverPhotoId === "" ? null : Number(draft.coverPhotoId),
        themeConfig: draft.themeConfig === "" ? null : draft.themeConfig,
      },
      { onSuccess: () => setEditId(null) },
    );
  };

  return (
    <Page width="list">
      <PageTitle
        title={t.navigation.tabs.series}
        description={t.headers.series}
      />

      {rowError && (
        <p role="alert" className="admin-text-danger text-[length:var(--admin-text-note)] mb-3">
          {rowError}
        </p>
      )}

      {isLoading && (
        <div className="flex items-center h-24">
          <Loader2
            size={18}
            className="animate-spin text-[var(--admin-muted)]"
          />
        </div>
      )}
      {!isLoading && (
      <ul className="ax-rows">
        {series.length === 0 && <EmptyNote>{copy.empty}</EmptyNote>}
        {series.map((s, i) => {
          const count = photos.filter(
            (p) => (p as Photo).seriesId === s.id,
          ).length;
          // Thumbnail = cover photo, falling back to the series' first photo
          // (photos arrive sorted by sortOrder) — same rule as the public grid.
          const cover =
            (s.coverPhotoId
              ? photos.find((p) => p.id === s.coverPhotoId)
              : undefined) ??
            photos.find((p) => (p as Photo).seriesId === s.id);
          return (
            <li key={s.id} className="ax-row-group">
              <div className="ax-row ax-row--in-group">
                <div className="ax-row__lead">
                  <button
                    onClick={() => move(s.id, -1)}
                    disabled={i === 0 || reorder.isPending}
                    aria-label={copy.moveUp}
                    className="admin-tap-sm admin-compact text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] disabled:opacity-25 transition-colors leading-none"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => move(s.id, 1)}
                    disabled={i === series.length - 1 || reorder.isPending}
                    aria-label={copy.moveDown}
                    className="admin-tap-sm admin-compact text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] disabled:opacity-25 transition-colors leading-none"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                {/* 表紙が無いときは灰色の四角を置かない(意味のない箱を見せない)。
                    ただし場所は空けておく。詰めるとタイトルの左端が行ごとにずれる。 */}
                <div
                  className={`ax-row__media ax-row__media--series${
                    cover ? "" : " ax-row__media--empty"
                  }`}
                  aria-hidden={cover ? undefined : "true"}
                >
                  {cover && (
                    <img
                      src={adminPhotoSrc(cover, 600, 80)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{
                        objectPosition: adminPhotoObjectPosition(cover),
                      }}
                    />
                  )}
                </div>
                <div className="ax-row__body">
                  <div className="ax-row__line">
                    <span className="ax-row__title">{s.title}</span>
                    <span className="ax-row__meta">{s.slug}</span>
                  </div>
                  {/* 写真クエリ解決前に「0 枚」と断定表示しない */}
                  {!photosLoading && (
                    <p className="ax-row__note">
                      {copy.cardSummary(
                        count,
                        s.coverPhotoId ? photoLabel(s.coverPhotoId) : "",
                      )}
                    </p>
                  )}
                </div>
                <div className="ax-row__actions">
                  <button
                    onClick={() =>
                      patchSeries.mutate({
                        id: s.id,
                        isPublished: !s.isPublished,
                      })
                    }
                    aria-pressed={s.isPublished}
                    className="admin-state-chip ax-status-toggle"
                  >
                    <StatusDot on={s.isPublished}>
                      {s.isPublished ? copy.published : copy.draft}
                    </StatusDot>
                  </button>
                  <AxButton
                    tone="ghost"
                    size="small"
                    onClick={() =>
                      editId === s.id ? setEditId(null) : openEdit(s)
                    }
                    aria-label={copy.edit}
                    aria-expanded={editId === s.id}
                  >
                    {editId === s.id ? (
                      <ChevronUp size={15} />
                    ) : (
                      <Pencil size={14} />
                    )}
                  </AxButton>
                  <AxButton
                    tone="danger"
                    size="small"
                    data-ax-reveal=""
                    onClick={() =>
                      setDeleteTarget({ id: s.id, title: s.title })
                    }
                    aria-label={copy.deleteAria(s.title)}
                  >
                    <Trash2 size={14} />
                  </AxButton>
                </div>
              </div>

              {/* Inline editor */}
              {editId === s.id && (
                <div
                  className="admin-mixed-form-panel ax-editor"
                  data-admin-mixed-form="series-edit"
                >
                  <AdminField label={copy.title}>
                    <input
                      aria-label={copy.titleAria}
                      value={draft.title}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, title: e.target.value }))
                      }
                      placeholder="Still, life"
                      className="ax-input"
                    />
                  </AdminField>
                  <AdminField label={copy.slug} hint={copy.slugHint}>
                    <input
                      aria-label={copy.slugAria}
                      value={draft.slug}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          slug: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        }))
                      }
                      placeholder="still-life"
                      className="ax-input ax-input--mono"
                    />
                  </AdminField>
                  <AdminField label={copy.subtitle} hint={copy.subtitleHint}>
                    <input
                      aria-label={copy.subtitleAria}
                      value={draft.subtitle}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, subtitle: e.target.value }))
                      }
                      placeholder="2023–2024"
                      className="ax-input"
                    />
                  </AdminField>
                  <AdminField
                    label={copy.statement}
                    hint={copy.statementHint}
                  >
                    <textarea
                      aria-label={copy.statementAria}
                      rows={4}
                      value={draft.statement}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, statement: e.target.value }))
                      }
                      placeholder={copy.statementPlaceholder}
                      className="ax-input ax-input--area"
                    />
                  </AdminField>
                  <AdminField
                    label={copy.coverPhoto}
                    hint={copy.coverHint}
                  >
                    {(() => {
                      const members = photos.filter(
                        (p) => (p as Photo).seriesId === editId,
                      );
                      const others = photos.filter(
                        (p) => (p as Photo).seriesId !== editId,
                      );
                      const allForPicker = [...members, ...others];
                      return (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({ ...d, coverPhotoId: "" }))
                            }
                            aria-pressed={draft.coverPhotoId === ""}
                            className="ax-btn ax-btn--quiet ax-btn--small self-start"
                          >
                            {copy.automaticCover}
                          </button>
                          {allForPicker.length > 0 ? (
                            <div className="grid grid-cols-5 gap-1 max-h-44 overflow-y-auto rounded-sm border border-[var(--admin-line)] bg-[var(--admin-paper)] p-1">
                              {allForPicker.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() =>
                                    setDraft((d) => ({
                                      ...d,
                                      coverPhotoId: String(p.id),
                                    }))
                                  }
                                  title={p.title || p.filename}
                                  className={`relative aspect-square overflow-hidden rounded-sm transition-[opacity,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] ${
                                    String(p.id) === draft.coverPhotoId
                                      ? "ring-2 ring-white ring-offset-1 ring-offset-[#1e1e1e]"
                                      : "opacity-60 hover:opacity-100"
                                  }`}
                                >
                                  <img
                                    src={adminPhotoSrc(p, 120, 60)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    style={{
                                      objectPosition:
                                        adminPhotoObjectPosition(p),
                                    }}
                                    loading="lazy"
                                  />
                                  {(p as Photo).seriesId === editId && (
                                    <div className="admin-accent-marker absolute bottom-0 left-0 right-0 h-0.5" />
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                              {copy.noPhotos}
                            </p>
                          )}
                          {draft.coverPhotoId &&
                            (() => {
                              const sel = photos.find(
                                (p) => String(p.id) === draft.coverPhotoId,
                              );
                              return sel ? (
                                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] truncate">
                                  {copy.selectedCover(sel.title || sel.filename)}
                                </p>
                              ) : null;
                            })()}
                        </div>
                      );
                    })()}
                  </AdminField>
                  {/* 機能9: シリーズ固有のレイアウト・テーマ設定 */}
                  <div className="border-t border-[var(--admin-line)] pt-3 mt-1">
                    <p className="text-[length:var(--admin-text-note)] tracking-wider text-[var(--admin-muted)] mb-2">
                      {copy.layoutTheme}
                    </p>
                    <AdminField
                      label={copy.layout}
                      hint={copy.layoutHint}
                    >
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            { value: "", name: copy.global },
                            ...GALLERY_LAYOUT_OPTIONS.map((option) => ({
                              ...option,
                              name:
                                copy.layoutNames[
                                  option.value as keyof typeof copy.layoutNames
                                ],
                            })),
                          ] as const
                        ).map(({ value, name }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setThemeKey("layout", value)}
                            aria-pressed={(parsedTheme.layout ?? "") === value}
                            className="ax-btn ax-btn--quiet ax-btn--small"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </AdminField>
                    <AdminField
                      label={copy.photoOrder}
                      hint={copy.photoOrderHint}
                    >
                      <div className="grid grid-cols-2 gap-1">
                        {(
                          [
                            ["inherit", copy.global],
                            ["manual", copy.manualOrder],
                            ["date_desc", copy.dateNewest],
                            ["date_asc", copy.dateOldest],
                          ] as const
                        ).map(([val, lbl]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setThemeKey("photoOrder", val)}
                            aria-pressed={
                              (parsedTheme.photoOrder ?? "inherit") === val
                            }
                            className="ax-btn ax-btn--quiet ax-btn--small"
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </AdminField>
                    <AdminField
                      label={copy.background}
                      hint={copy.backgroundHint}
                    >
                      <input
                        type="text"
                        value={parsedTheme.bgColor ?? ""}
                        onChange={(e) =>
                          setThemeKey("bgColor", e.target.value.trim())
                        }
                        placeholder={copy.backgroundPlaceholder}
                        className="ax-input ax-input--mono"
                      />
                    </AdminField>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={
                        patchSeries.isPending || !draft.title || !draft.slug
                      }
                      className="flex items-center gap-1.5 px-4 py-2 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm transition-colors disabled:opacity-40"
                    >
                      {patchSeries.isPending ? (
                        <>
                          <Loader2 size={11} className="animate-spin" />{" "}
                          {copy.saving}
                        </>
                      ) : (
                        <>
                          <Check size={11} /> {copy.save}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="px-4 py-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                    >
                      {copy.close}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      )}

      <AddBlock title={copy.newSeries}>
        <AxField label={copy.title} htmlFor="ax-series-title">
          <TextInput
            id="ax-series-title"
            aria-label={copy.newTitleAria}
            value={newTitle}
            onChange={(e) => {
              setNewTitle(e.target.value);
              setAddError("");
            }}
            placeholder="Still, life"
          />
        </AxField>
        <AxField label={copy.slug} htmlFor="ax-series-slug">
          <TextInput
            id="ax-series-slug"
            mono
            aria-label={copy.newSlugAria}
            value={newSlug}
            onChange={(e) => {
              setNewSlug(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              );
              setAddError("");
            }}
            placeholder="still-life"
          />
        </AxField>
        {addError && (
          <p className="admin-text-danger text-[length:var(--admin-text-note)]">{addError}</p>
        )}
        <AxButton
          tone="primary"
          className="self-start"
          onClick={handleAdd}
          disabled={!newSlug || !newTitle || addSeries.isPending}
          icon={<Plus size={13} />}
        >
          {copy.add}
        </AxButton>
      </AddBlock>

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <p className="text-[length:var(--admin-text-body)] text-[var(--admin-ink)] mb-1">
            {copy.deleteConfirm(deleteTarget.title)}
          </p>
          <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mb-5">
            {copy.deleteKeepsPhotos}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => {
                deleteSeries.mutate(deleteTarget.id);
                if (editId === deleteTarget.id) setEditId(null);
                setDeleteTarget(null);
              }}
              className="admin-btn-danger px-4 py-1.5 text-[length:var(--admin-text-note)] rounded-sm transition-colors"
            >
              {t.common.deleteAction}
            </button>
          </div>
        </Modal>
      )}
    </Page>
  );
}

/* ══════════════════════════════════════════════════
   PRICING TAB (H1)
══════════════════════════════════════════════════ */
type PlanRow = {
  id: number;
  title: string;
  price: string;
  description: string;
  features: string;
  note: string;
  sortOrder: number;
  isPublished: boolean;
};
type PlanDraft = {
  title: string;
  price: string;
  description: string;
  features: string;
  note: string;
};

export function PricingTab() {
  const qc = useQueryClient();
  const { t } = useAdminI18n();
  const copy = t.phase2b.pricing;
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PlanDraft>({
    title: "",
    price: "",
    description: "",
    features: "",
    note: "",
  });
  const [rowError, setRowError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    title: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: async (): Promise<{ plans: PlanRow[] }> =>
      jsonOrThrow(await adminApi.pricing.$get()),
  });
  const plans = (data?.plans ?? []) as PlanRow[];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-pricing"] });
    qc.invalidateQueries({ queryKey: ["pricing"] });
  };

  const addPlan = useMutation({
    mutationFn: async () => {
      // Start as a draft — a freshly-added placeholder plan must not appear on the
      // live Contact page before the author has filled it in and explicitly published.
      const res = await adminApi.pricing.$post({
        json: { title: "新しいプラン", isPublished: false },
      });
      assertOk(res);
      return res.json();
    },
    onSuccess: (created) => {
      refresh();
      // Open the new plan for editing straight away.
      const id = (created as { plan?: { id?: number } })?.plan?.id;
      if (typeof id === "number") {
        setEditId(id);
        setDraft({
          title: "新しいプラン",
          price: "",
          description: "",
          features: "",
          note: "",
        });
      }
    },
    onError: () => setRowError(copy.errors.addFailed),
  });

  const patchPlan = useMutation({
    mutationFn: async (payload: { id: number } & Record<string, unknown>) => {
      const { id, ...body } = payload;
      const res = await adminApi.pricing[":id"].$patch({
        param: { id: String(id) },
        json: body,
      });
      assertOk(res);
    },
    onSuccess: () => {
      refresh();
      setRowError("");
    },
    onError: () => setRowError(copy.errors.saveFailed),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminApi.pricing[":id"].$delete({
        param: { id: String(id) },
      });
      assertOk(res);
    },
    onSuccess: refresh,
    onError: () => setRowError(copy.errors.deleteFailed),
  });

  const reorder = useMutation({
    mutationFn: async ({
      ids,
      expectedIds,
    }: {
      ids: number[];
      expectedIds: number[];
    }) => {
      const res = await adminApi.pricing.reorder.$post({
        json: { ids, expectedIds },
      });
      assertOk(res);
    },
    onSuccess: () => {
      setRowError("");
      refresh();
    },
    onError: () => {
      setRowError(copy.errors.reorderFailed);
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
    },
  });
  const move = (id: number, delta: number) => {
    const ids = plans.map((p) => p.id);
    const expectedIds = [...ids];
    const idx = ids.indexOf(id);
    const to = idx + delta;
    if (idx < 0 || to < 0 || to >= ids.length) return;
    ids.splice(idx, 1);
    ids.splice(to, 0, id);
    qc.setQueryData(["admin-pricing"], (old: typeof data) => {
      if (!old?.plans) return old;
      const byId = new Map((old.plans as PlanRow[]).map((p) => [p.id, p]));
      return { ...old, plans: ids.map((i) => byId.get(i)!).filter(Boolean) };
    });
    reorder.mutate({ ids, expectedIds });
  };

  const openEdit = (p: PlanRow) => {
    setEditId(p.id);
    setRowError("");
    setDraft({
      title: p.title,
      price: p.price,
      description: p.description,
      features: p.features,
      note: p.note,
    });
  };
  const saveEdit = () => {
    if (editId === null) return;
    patchPlan.mutate(
      { id: editId, ...draft },
      { onSuccess: () => setEditId(null) },
    );
  };

  return (
    <Page width="list">
      <PageTitle
        title={t.navigation.tabs.pricing}
        description={t.headers.pricing}
      />

      {rowError && (
        <p role="alert" className="admin-text-danger text-[length:var(--admin-text-note)] mb-3">
          {rowError}
        </p>
      )}

      {isLoading && (
        <div className="flex items-center h-24">
          <Loader2
            size={18}
            className="animate-spin text-[var(--admin-muted)]"
          />
        </div>
      )}
      {!isLoading && (
      <ul className="ax-rows">
        {plans.length === 0 && <EmptyNote>{copy.empty}</EmptyNote>}
        {plans.map((p, i) => (
          <li key={p.id} className="ax-row-group">
            <div className="ax-row ax-row--in-group">
              <div className="ax-row__lead">
                <button
                  onClick={() => move(p.id, -1)}
                  disabled={i === 0 || reorder.isPending}
                  aria-label={copy.moveUp}
                  className="admin-tap-sm admin-compact text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] disabled:opacity-25 transition-colors leading-none"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => move(p.id, 1)}
                  disabled={i === plans.length - 1 || reorder.isPending}
                  aria-label={copy.moveDown}
                  className="admin-tap-sm admin-compact text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] disabled:opacity-25 transition-colors leading-none"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className="ax-row__body">
                <div className="ax-row__line">
                  <span className="ax-row__title">{p.title}</span>
                  {p.price && (
                    <span className="ax-row__meta">{p.price}</span>
                  )}
                </div>
              </div>
              <div className="ax-row__actions">
                <button
                  onClick={() =>
                    patchPlan.mutate({ id: p.id, isPublished: !p.isPublished })
                  }
                  aria-pressed={p.isPublished}
                  className="admin-state-chip ax-status-toggle"
                >
                  <StatusDot on={p.isPublished}>
                    {p.isPublished ? copy.published : copy.draft}
                  </StatusDot>
                </button>
                <AxButton
                  tone="ghost"
                  size="small"
                  onClick={() =>
                    editId === p.id ? setEditId(null) : openEdit(p)
                  }
                  aria-label={copy.edit}
                  aria-expanded={editId === p.id}
                >
                  {editId === p.id ? (
                    <ChevronUp size={15} />
                  ) : (
                    <Pencil size={14} />
                  )}
                </AxButton>
                <AxButton
                  tone="danger"
                  size="small"
                  data-ax-reveal=""
                  onClick={() => setDeleteTarget({ id: p.id, title: p.title })}
                  aria-label={copy.deleteAria(p.title)}
                >
                  <Trash2 size={14} />
                </AxButton>
              </div>
            </div>

            {editId === p.id && (
              <div className="ax-editor">
                <AdminField label={copy.titleLabel}>
                  <input
                    aria-label={copy.titleAria}
                    value={draft.title}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, title: e.target.value }))
                    }
                    placeholder={copy.titlePlaceholder}
                    className="ax-input"
                  />
                </AdminField>
                <AdminField label={copy.priceLabel} hint={copy.priceHint}>
                  <input
                    aria-label={copy.priceAria}
                    value={draft.price}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, price: e.target.value }))
                    }
                    placeholder="¥15,000〜"
                    className="ax-input"
                  />
                </AdminField>
                <AdminField
                  label={copy.descriptionLabel}
                  hint={copy.descriptionHint}
                >
                  <textarea
                    aria-label={copy.descriptionAria}
                    rows={2}
                    value={draft.description}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, description: e.target.value }))
                    }
                    placeholder={copy.descriptionPlaceholder}
                    className="ax-input ax-input--area"
                  />
                </AdminField>
                <AdminField label={copy.featuresLabel} hint={copy.featuresHint}>
                  <textarea
                    aria-label={copy.featuresLabel}
                    rows={4}
                    value={draft.features}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, features: e.target.value }))
                    }
                    placeholder={copy.featuresPlaceholder}
                    className="ax-input ax-input--area"
                  />
                </AdminField>
                <AdminField label={copy.noteLabel} hint={copy.noteHint}>
                  <input
                    aria-label={copy.noteLabel}
                    value={draft.note}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, note: e.target.value }))
                    }
                    placeholder={copy.notePlaceholder}
                    className="ax-input"
                  />
                </AdminField>
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={patchPlan.isPending || !draft.title}
                    className="flex items-center gap-1.5 px-4 py-2 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm transition-colors disabled:opacity-40"
                  >
                    {patchPlan.isPending ? (
                      <>
                        <Loader2 size={11} className="animate-spin" />{" "}
                        {t.common.saving}
                      </>
                    ) : (
                      <>
                        <Check size={11} /> {t.common.save}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="px-4 py-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                  >
                    {t.common.close}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      )}

      <div className="mt-10">
      <button
        onClick={() => addPlan.mutate()}
        disabled={addPlan.isPending}
        className="flex items-center gap-1.5 px-4 py-2 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm transition-colors disabled:opacity-40"
      >
        <Plus size={12} /> {copy.add}
      </button>
      </div>

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <p className="text-[length:var(--admin-text-body)] text-[var(--admin-ink)] mb-4">
            {copy.deleteConfirm(deleteTarget.title)}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => {
                deletePlan.mutate(deleteTarget.id);
                if (editId === deleteTarget.id) setEditId(null);
                setDeleteTarget(null);
              }}
              className="admin-btn-danger px-4 py-1.5 text-[length:var(--admin-text-note)] rounded-sm transition-colors"
            >
              {t.common.deleteAction}
            </button>
          </div>
        </Modal>
      )}
    </Page>
  );
}

/* ══════════════════════════════════════════════════
   SETTINGS TAB
══════════════════════════════════════════════════ */
/** トップWorks手動選択: クリックで選択/解除。選んだ順がそのまま表示順になる。 */
function TopWorksPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useAdminI18n();
  const { data } = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });
  const photos = data?.photos ?? [];
  const picked = value
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter(Number.isFinite);
  const toggle = (id: number) => {
    const next = picked.includes(id)
      ? picked.filter((x) => x !== id)
      : [...picked, id];
    onChange(next.join(","));
  };
  if (photos.length === 0)
    return (
      <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
        {t.phase2b.service.topWorksEmpty}
      </p>
    );
  return (
    <div className="max-h-64 overflow-y-auto border border-[var(--admin-line)] rounded-sm p-1.5 grid grid-cols-5 gap-1">
      {photos.map((p) => {
        const pos = picked.indexOf(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            title={p.title || p.filename}
            aria-label={`${p.title || p.filename}${pos >= 0 ? t.phase2b.service.topWorksSelectedSuffix : ""}`}
            aria-pressed={pos >= 0}
            className={`relative aspect-square overflow-hidden rounded-[2px] transition-opacity ${pos >= 0 ? "ring-[length:var(--admin-accent-line)] ring-[color:var(--admin-accent)]" : "opacity-55 hover:opacity-100"}`}
          >
            <img
              src={adminPhotoSrc(p, 200, 60)}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="w-full h-full object-cover bg-[var(--admin-paper)]"
              style={{ objectPosition: adminPhotoObjectPosition(p) }}
            />
            {pos >= 0 && (
              <span className="admin-accent-marker absolute top-0.5 right-0.5 min-w-4 h-4 px-0.5 text-[9px] font-medium rounded-sm flex items-center justify-center">
                {pos + 1}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SERVICE TAB
══════════════════════════════════════════════════ */
import {
  parseServicePageConfig,
  type ServicePageConfig,
} from "../lib/service-config";

// Same always-mounted grid-rows technique as the Settings accordion (Section,
// admin-tabs.tsx) — content stays mounted so toggling never flickers.
function ServiceSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="border-b border-[var(--admin-line)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="admin-plain-section-trigger w-full flex items-center justify-between py-3 px-0 text-[length:var(--admin-text-note)] tracking-widest text-[var(--admin-muted)] transition-colors cursor-pointer"
      >
        <span>{title}</span>
        <ChevronRight
          size={12}
          className="flex-shrink-0 transition-transform duration-[var(--dur-base)] ease-[var(--ease-inout)]"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </button>
      <div
        className={`grid ${animated ? "transition-[grid-template-rows] duration-[var(--dur-base)] ease-[var(--ease-inout)]" : ""}`}
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-5 space-y-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SvcInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="ax-field__label">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="ax-input"
      />
    </label>
  );
}

function SvcTextarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="ax-field__label">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="ax-input ax-input--area"
      />
    </label>
  );
}

function SvcArrayControls({
  index,
  total,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useAdminI18n();
  return (
    <div className="flex items-center gap-1 ml-auto shrink-0">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        className="p-0.5 text-[var(--admin-muted)] disabled:opacity-30 disabled:cursor-not-allowed"
        title={t.phase2b.service.arrayControls.up}
      >
        <ChevronUp size={12} />
      </button>
      <button
        type="button"
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
        className="p-0.5 text-[var(--admin-muted)] disabled:opacity-30 disabled:cursor-not-allowed"
        title={t.phase2b.service.arrayControls.down}
      >
        <ChevronDown size={12} />
      </button>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="admin-danger-on-hover p-0.5 text-[var(--admin-muted)]"
        title={t.phase2b.service.arrayControls.remove}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function removeItem<T>(arr: T[], index: number): T[] {
  return arr.filter((_, i) => i !== index);
}

function updateItem<T>(arr: T[], index: number, patch: Partial<T>): T[] {
  return arr.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

export function ServiceTab({
  onUnsavedChange,
}: {
  onUnsavedChange?: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { t } = useAdminI18n();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const initialLoadFailed = isError && data === undefined;

  const saved = parseServicePageConfig(data?.servicePageConfig);
  const [draft, setDraft, restoredDraft] = usePersistentState<ServicePageConfig>(
    "admin:serviceDraft",
    saved,
  );
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Sync draft to server data on first load
  const loadedRef = useRef(false);
  useEffect(() => {
    if (data && !loadedRef.current) {
      loadedRef.current = true;
      const fromDb = parseServicePageConfig(data.servicePageConfig);
      // A session draft is the operator's newest unsaved work. Loading the
      // older DB value must not erase it merely because this tab mounted.
      if (!restoredDraft) setDraft(fromDb);
    }
  }, [data, restoredDraft, setDraft]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    onUnsavedChange?.(initialLoadFailed ? false : hasChanges);
  }, [hasChanges, initialLoadFailed, onUnsavedChange]);

  useEffect(() => {
    if (initialLoadFailed || !hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges, initialLoadFailed]);

  const save = useMutation({
    mutationFn: async () => {
      await postAdminSettings({ servicePageConfig: JSON.stringify(draft) });
    },
    onSuccess: () => {
      setSaveError(false);
      qc.invalidateQueries({ queryKey: ["settings"] });
      loadedRef.current = false;
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    },
    onError: () => setSaveError(true),
  });

  const reset = () => {
    setDraft(saved);
    setSaveError(false);
  };

  const set = <K extends keyof ServicePageConfig>(
    key: K,
    val: ServicePageConfig[K],
  ) => setDraft((d) => ({ ...d, [key]: val }));

  const setHero = (patch: Partial<ServicePageConfig["hero"]>) =>
    set("hero", { ...draft.hero, ...patch });
  const setExamples = (patch: Partial<ServicePageConfig["examples"]>) =>
    set("examples", { ...draft.examples, ...patch });
  const setPainSolutions = (
    patch: Partial<ServicePageConfig["painSolutions"]>,
  ) => set("painSolutions", { ...draft.painSolutions, ...patch });
  const setPricing = (patch: Partial<ServicePageConfig["pricing"]>) =>
    set("pricing", { ...draft.pricing, ...patch });
  const setPurchaseFlow = (patch: Partial<ServicePageConfig["purchaseFlow"]>) =>
    set("purchaseFlow", { ...draft.purchaseFlow, ...patch });
  const setFaq = (patch: Partial<ServicePageConfig["faq"]>) =>
    set("faq", { ...draft.faq, ...patch });
  const setFinalCta = (patch: Partial<ServicePageConfig["finalCta"]>) =>
    set("finalCta", { ...draft.finalCta, ...patch });
  const setStickyCta = (patch: Partial<ServicePageConfig["stickyCta"]>) =>
    set("stickyCta", { ...draft.stickyCta, ...patch });
  const setAdminShowcase = (
    patch: Partial<ServicePageConfig["adminShowcase"]>,
  ) => set("adminShowcase", { ...draft.adminShowcase, ...patch });

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={20} className="animate-spin text-[var(--admin-muted)]" />
      </div>
    );

  if (initialLoadFailed) {
    return (
      <SettingsLoadError
        title={t.navigation.tabs.service}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={t.navigation.tabs.service}
        description={t.headers.service}
      />

      {/* ── Hero ── */}
      <ServiceSection title="Hero" defaultOpen>
        <SvcInput
          label={t.phase2b.service.hero.label}
          value={draft.hero.label}
          onChange={(v) => setHero({ label: v })}
        />
        <SvcTextarea
          label={t.phase2b.service.hero.headingHint}
          value={draft.hero.title}
          onChange={(v) => setHero({ title: v })}
          rows={2}
        />
        <SvcTextarea
          label={t.phase2b.service.hero.description}
          value={draft.hero.body}
          onChange={(v) => setHero({ body: v })}
        />
        <p className="text-[length:var(--admin-text-note)] tracking-[0.04em] text-[var(--admin-muted)] pt-2">
          {t.phase2b.service.hero.factsHint}
        </p>
        {draft.hero.facts.map((fact, i) => (
          <div key={i} className="grid grid-cols-[0.8fr_1.2fr] gap-2">
            <SvcInput
              label={t.phase2b.service.hero.factLabel(i + 1)}
              value={fact.title}
              onChange={(v) =>
                setHero({
                  facts: updateItem(draft.hero.facts, i, { title: v }),
                })
              }
            />
            <SvcInput
              label={t.phase2b.service.hero.factBody(i + 1)}
              value={fact.body}
              onChange={(v) =>
                setHero({
                  facts: updateItem(draft.hero.facts, i, { body: v }),
                })
              }
            />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <SvcInput
            label={t.phase2b.service.hero.ctaPricing}
            value={draft.hero.ctaPricing}
            onChange={(v) => setHero({ ctaPricing: v })}
          />
          <SvcInput
            label={t.phase2b.service.hero.ctaExample}
            value={draft.hero.ctaExample}
            onChange={(v) => setHero({ ctaExample: v })}
          />
        </div>
      </ServiceSection>

      {/* ── Examples ── */}
      <ServiceSection title={t.phase2b.service.examples.sectionTitle}>
        <SvcInput
          label={t.phase2b.service.examples.label}
          value={draft.examples.label}
          onChange={(v) => setExamples({ label: v })}
        />
        <SvcTextarea
          label={t.phase2b.service.examples.heading}
          value={draft.examples.title}
          onChange={(v) => setExamples({ title: v })}
          rows={2}
        />
        <SvcTextarea
          label={t.phase2b.service.examples.description}
          value={draft.examples.body}
          onChange={(v) => setExamples({ body: v })}
        />
        <SvcInput
          label={t.phase2b.service.examples.ctaLabel}
          value={draft.examples.cta}
          onChange={(v) => setExamples({ cta: v })}
        />
        <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mt-2">{t.phase2b.service.examples.linksHint}</p>
        {draft.examples.links.map((link, i) => (
          <div
            key={i}
            className="border border-[var(--admin-line)] rounded p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                #{i + 1}
              </span>
              <SvcArrayControls
                index={i}
                total={draft.examples.links.length}
                onMove={(f, t) =>
                  setExamples({
                    links: moveItem(draft.examples.links, f, t),
                  })
                }
                onRemove={(idx) =>
                  setExamples({
                    links: removeItem(draft.examples.links, idx),
                  })
                }
              />
            </div>
            <SvcInput
              label={t.phase2b.service.examples.linkTitle}
              value={link.title}
              onChange={(v) =>
                setExamples({
                  links: updateItem(draft.examples.links, i, { title: v }),
                })
              }
            />
            <SvcInput
              label={t.phase2b.service.examples.linkBody}
              value={link.body}
              onChange={(v) =>
                setExamples({
                  links: updateItem(draft.examples.links, i, { body: v }),
                })
              }
            />
            <SvcInput
              label={t.phase2b.service.examples.linkHref}
              value={link.href}
              onChange={(v) =>
                setExamples({
                  links: updateItem(draft.examples.links, i, { href: v }),
                })
              }
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setExamples({
              links: [
                ...draft.examples.links,
                { title: "", body: "", href: "/" },
              ],
            })
          }
          className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
        >
          <Plus size={11} /> {t.phase2b.service.examples.add}
        </button>
      </ServiceSection>

      {/* ── Pain/Solutions ── */}
      <ServiceSection title={t.phase2b.service.painSolutions.sectionTitle}>
        <SvcInput
          label={t.phase2b.service.painSolutions.label}
          value={draft.painSolutions.label}
          onChange={(v) => setPainSolutions({ label: v })}
        />
        {draft.painSolutions.items.map((item, i) => (
          <div
            key={i}
            className="border border-[var(--admin-line)] rounded p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                #{i + 1}
              </span>
              <SvcArrayControls
                index={i}
                total={draft.painSolutions.items.length}
                onMove={(f, t) =>
                  setPainSolutions({
                    items: moveItem(draft.painSolutions.items, f, t),
                  })
                }
                onRemove={(idx) =>
                  setPainSolutions({
                    items: removeItem(draft.painSolutions.items, idx),
                  })
                }
              />
            </div>
            <SvcInput
              label={t.phase2b.service.painSolutions.concernTitle}
              value={item.concern}
              onChange={(v) =>
                setPainSolutions({
                  items: updateItem(draft.painSolutions.items, i, {
                    concern: v,
                  }),
                })
              }
            />
            <SvcTextarea
              label={t.phase2b.service.painSolutions.concernBody}
              value={item.concernBody}
              onChange={(v) =>
                setPainSolutions({
                  items: updateItem(draft.painSolutions.items, i, {
                    concernBody: v,
                  }),
                })
              }
              rows={2}
            />
            <SvcInput
              label={t.phase2b.service.painSolutions.solutionTitle}
              value={item.solution}
              onChange={(v) =>
                setPainSolutions({
                  items: updateItem(draft.painSolutions.items, i, {
                    solution: v,
                  }),
                })
              }
            />
            <SvcTextarea
              label={t.phase2b.service.painSolutions.solutionBody}
              value={item.solutionBody}
              onChange={(v) =>
                setPainSolutions({
                  items: updateItem(draft.painSolutions.items, i, {
                    solutionBody: v,
                  }),
                })
              }
              rows={2}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPainSolutions({
              items: [
                ...draft.painSolutions.items,
                {
                  concern: "",
                  concernBody: "",
                  solution: "",
                  solutionBody: "",
                },
              ],
            })
          }
          className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
        >
          <Plus size={11} /> {t.phase2b.service.painSolutions.add}
        </button>
      </ServiceSection>

      {/* ── Pricing ── */}
      <ServiceSection title={t.phase2b.service.pricing.sectionTitle}>
        <p className="text-[length:var(--admin-text-note)] leading-6 text-[var(--admin-muted)]">
          {t.phase2b.service.pricing.intro}
        </p>
        <SvcInput
          label={t.phase2b.service.pricing.label}
          value={draft.pricing.label}
          onChange={(v) => setPricing({ label: v })}
        />
        {draft.pricing.plans.map((plan, i) => (
          <div
            key={i}
            className="border border-[var(--admin-line)] rounded p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                {t.phase2b.service.pricing.plan(i + 1)}
              </span>
              {plan.primary && (
                <span className="text-[length:var(--admin-text-note)] bg-[rgba(var(--admin-ink-rgb),0.08)] text-[var(--admin-ink)] px-1.5 py-0.5 rounded">
                  {t.phase2b.service.pricing.recommended}
                </span>
              )}
              <SvcArrayControls
                index={i}
                total={draft.pricing.plans.length}
                onMove={(f, t) =>
                  setPricing({
                    plans: moveItem(draft.pricing.plans, f, t),
                  })
                }
                onRemove={(idx) =>
                  setPricing({
                    plans: removeItem(draft.pricing.plans, idx),
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SvcInput
                label={t.phase2b.service.pricing.planName}
                value={plan.name}
                onChange={(v) =>
                  setPricing({
                    plans: updateItem(draft.pricing.plans, i, { name: v }),
                  })
                }
              />
              <SvcInput
                label={t.phase2b.service.pricing.price}
                value={plan.price}
                onChange={(v) =>
                  setPricing({
                    plans: updateItem(draft.pricing.plans, i, { price: v }),
                  })
                }
              />
            </div>
            <SvcTextarea
              label={t.phase2b.service.pricing.description}
              value={plan.sub}
              onChange={(v) =>
                setPricing({
                  plans: updateItem(draft.pricing.plans, i, { sub: v }),
                })
              }
              rows={2}
            />
            <SvcTextarea
              label={t.phase2b.service.pricing.features}
              value={plan.points.join("\n")}
              onChange={(v) =>
                setPricing({
                  plans: updateItem(draft.pricing.plans, i, {
                    points: v.split("\n").filter((l) => l.trim()),
                  }),
                })
              }
              rows={4}
            />
            <SvcInput
              label={t.phase2b.service.pricing.stripePaymentLink}
              value={plan.stripeUrl}
              onChange={(v) =>
                setPricing({
                  plans: updateItem(draft.pricing.plans, i, {
                    stripeUrl: v,
                  }),
                })
              }
              placeholder="https://buy.stripe.com/..."
            />
            <SvcInput
              label={t.phase2b.service.pricing.ctaText}
              value={plan.cta}
              onChange={(v) =>
                setPricing({
                  plans: updateItem(draft.pricing.plans, i, { cta: v }),
                })
              }
            />
            <label className="flex items-center gap-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
              <input
                type="checkbox"
                checked={plan.primary}
                onChange={(e) =>
                  setPricing({
                    plans: updateItem(draft.pricing.plans, i, {
                      primary: e.target.checked,
                    }),
                  })
                }
                className="accent-[var(--admin-accent)]"
              />
              {t.phase2b.service.pricing.recommended}
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPricing({
              plans: [
                ...draft.pricing.plans,
                {
                  name: "",
                  price: "",
                  sub: "",
                  points: [],
                  stripeUrl: "",
                  cta: "このプランを申し込む",
                  primary: false,
                },
              ],
            })
          }
          className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
        >
          <Plus size={11} /> {t.phase2b.service.pricing.add}
        </button>
        <SvcTextarea
          label={t.phase2b.service.pricing.noteOnline}
          value={draft.pricing.noteOnline}
          onChange={(v) => setPricing({ noteOnline: v })}
          rows={2}
        />
        <SvcTextarea
          label={t.phase2b.service.pricing.noteOffline}
          value={draft.pricing.noteOffline}
          onChange={(v) => setPricing({ noteOffline: v })}
          rows={2}
        />
        <SvcTextarea
          label={t.phase2b.service.pricing.disclaimer}
          value={draft.pricing.disclaimer}
          onChange={(v) => setPricing({ disclaimer: v })}
          rows={2}
        />
      </ServiceSection>

      {/* ── Purchase Flow ── */}
      <ServiceSection title={t.phase2b.service.purchaseFlow.sectionTitle}>
        <SvcInput
          label={t.phase2b.service.purchaseFlow.label}
          value={draft.purchaseFlow.label}
          onChange={(v) => setPurchaseFlow({ label: v })}
        />
        <SvcInput
          label={t.phase2b.service.purchaseFlow.heading}
          value={draft.purchaseFlow.title}
          onChange={(v) => setPurchaseFlow({ title: v })}
        />
        <SvcTextarea
          label={t.phase2b.service.purchaseFlow.description}
          value={draft.purchaseFlow.body}
          onChange={(v) => setPurchaseFlow({ body: v })}
        />
        <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mt-2">{t.phase2b.service.purchaseFlow.stepsHint}</p>
        {draft.purchaseFlow.steps.map((step, i) => (
          <div
            key={i}
            className="border border-[var(--admin-line)] rounded p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <SvcArrayControls
                index={i}
                total={draft.purchaseFlow.steps.length}
                onMove={(f, t) =>
                  setPurchaseFlow({
                    steps: moveItem(draft.purchaseFlow.steps, f, t),
                  })
                }
                onRemove={(idx) =>
                  setPurchaseFlow({
                    steps: removeItem(draft.purchaseFlow.steps, idx),
                  })
                }
              />
            </div>
            <SvcInput
              label={t.phase2b.service.purchaseFlow.stepTitle}
              value={step.title}
              onChange={(v) =>
                setPurchaseFlow({
                  steps: updateItem(draft.purchaseFlow.steps, i, {
                    title: v,
                  }),
                })
              }
            />
            <SvcTextarea
              label={t.phase2b.service.purchaseFlow.stepBody}
              value={step.body}
              onChange={(v) =>
                setPurchaseFlow({
                  steps: updateItem(draft.purchaseFlow.steps, i, { body: v }),
                })
              }
              rows={2}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPurchaseFlow({
              steps: [...draft.purchaseFlow.steps, { title: "", body: "" }],
            })
          }
          className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
        >
          <Plus size={11} /> {t.phase2b.service.purchaseFlow.add}
        </button>
        <SvcTextarea
          label={t.phase2b.service.purchaseFlow.footnote}
          value={draft.purchaseFlow.footnote}
          onChange={(v) => setPurchaseFlow({ footnote: v })}
          rows={2}
        />
      </ServiceSection>

      {/* ── FAQ ── */}
      <ServiceSection title="FAQ">
        <SvcInput
          label={t.phase2b.service.faq.label}
          value={draft.faq.label}
          onChange={(v) => setFaq({ label: v })}
        />
        {draft.faq.items.map((item, i) => (
          <div
            key={i}
            className="border border-[var(--admin-line)] rounded p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                Q{i + 1}
              </span>
              <SvcArrayControls
                index={i}
                total={draft.faq.items.length}
                onMove={(f, t) =>
                  setFaq({ items: moveItem(draft.faq.items, f, t) })
                }
                onRemove={(idx) =>
                  setFaq({ items: removeItem(draft.faq.items, idx) })
                }
              />
            </div>
            <SvcTextarea
              label={t.phase2b.service.faq.question}
              value={item.q}
              onChange={(v) =>
                setFaq({
                  items: updateItem(draft.faq.items, i, { q: v }),
                })
              }
              rows={2}
            />
            <SvcTextarea
              label={t.phase2b.service.faq.answer}
              value={item.a}
              onChange={(v) =>
                setFaq({
                  items: updateItem(draft.faq.items, i, { a: v }),
                })
              }
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setFaq({
              items: [...draft.faq.items, { q: "", a: "" }],
            })
          }
          className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
        >
          <Plus size={11} /> {t.phase2b.service.faq.add}
        </button>
      </ServiceSection>

      {/* ── Final CTA ── */}
      <ServiceSection title={t.phase2b.service.finalCta.sectionTitle}>
        <SvcInput
          label={t.phase2b.service.finalCta.heading}
          value={draft.finalCta.title}
          onChange={(v) => setFinalCta({ title: v })}
        />
        <SvcTextarea
          label={t.phase2b.service.finalCta.description}
          value={draft.finalCta.body}
          onChange={(v) => setFinalCta({ body: v })}
          rows={2}
        />
        <div className="grid grid-cols-2 gap-2">
          <SvcInput
            label={t.phase2b.service.finalCta.ctaOnline}
            value={draft.finalCta.ctaOnline}
            onChange={(v) => setFinalCta({ ctaOnline: v })}
          />
          <SvcInput
            label={t.phase2b.service.finalCta.ctaOffline}
            value={draft.finalCta.ctaOffline}
            onChange={(v) => setFinalCta({ ctaOffline: v })}
          />
        </div>
        <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mt-2">{t.phase2b.service.finalCta.snsHint}</p>
        {draft.finalCta.snsLinks.map((link, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={link.label}
              onChange={(e) =>
                setFinalCta({
                  snsLinks: updateItem(draft.finalCta.snsLinks, i, {
                    label: e.target.value,
                  }),
                })
              }
              placeholder="Label"
              className="flex-1 min-w-0 bg-[var(--admin-paper)] border border-[var(--admin-line)] rounded px-2 py-1 text-[length:var(--admin-text-note)] text-[var(--admin-ink)] outline-none"
            />
            <input
              type="text"
              value={link.url}
              onChange={(e) =>
                setFinalCta({
                  snsLinks: updateItem(draft.finalCta.snsLinks, i, {
                    url: e.target.value,
                  }),
                })
              }
              placeholder="https://..."
              className="flex-[2] min-w-0 bg-[var(--admin-paper)] border border-[var(--admin-line)] rounded px-2 py-1 text-[length:var(--admin-text-note)] text-[var(--admin-ink)] outline-none"
            />
            <button
              type="button"
              onClick={() =>
                setFinalCta({
                  snsLinks: removeItem(draft.finalCta.snsLinks, i),
                })
              }
              className="admin-danger-on-hover p-0.5 text-[var(--admin-muted)]"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setFinalCta({
              snsLinks: [...draft.finalCta.snsLinks, { label: "", url: "" }],
            })
          }
          className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
        >
          <Plus size={11} /> {t.phase2b.service.finalCta.add}
        </button>
      </ServiceSection>

      {/* ── Sticky CTA ── */}
      <ServiceSection title="Sticky CTA">
        <SvcInput
          label={t.phase2b.service.stickyCta.leftText}
          value={draft.stickyCta.text}
          onChange={(v) => setStickyCta({ text: v })}
        />
        <SvcInput
          label={t.phase2b.service.stickyCta.pricingCta}
          value={draft.stickyCta.pricingCta}
          onChange={(v) => setStickyCta({ pricingCta: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <SvcInput
            label={t.phase2b.service.stickyCta.ctaOnline}
            value={draft.stickyCta.ctaOnline}
            onChange={(v) => setStickyCta({ ctaOnline: v })}
          />
          <SvcInput
            label={t.phase2b.service.stickyCta.ctaOffline}
            value={draft.stickyCta.ctaOffline}
            onChange={(v) => setStickyCta({ ctaOffline: v })}
          />
        </div>
      </ServiceSection>

      {/* ── Admin Showcase ── */}
      <ServiceSection title={t.phase2b.service.adminShowcase.sectionTitle}>
        <SvcInput
          label={t.phase2b.service.adminShowcase.label}
          value={draft.adminShowcase.label}
          onChange={(v) => setAdminShowcase({ label: v })}
        />
        <SvcInput
          label={t.phase2b.service.adminShowcase.heading}
          value={draft.adminShowcase.title}
          onChange={(v) => setAdminShowcase({ title: v })}
        />
        <SvcTextarea
          label={t.phase2b.service.adminShowcase.description}
          value={draft.adminShowcase.body}
          onChange={(v) => setAdminShowcase({ body: v })}
        />
        <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mt-2">{t.phase2b.service.adminShowcase.featuresHint}</p>
        {draft.adminShowcase.features.map((feat, i) => (
          <div
            key={i}
            className="border border-[var(--admin-line)] rounded p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                #{i + 1}
              </span>
              <SvcArrayControls
                index={i}
                total={draft.adminShowcase.features.length}
                onMove={(f, t) =>
                  setAdminShowcase({
                    features: moveItem(draft.adminShowcase.features, f, t),
                  })
                }
                onRemove={(idx) =>
                  setAdminShowcase({
                    features: removeItem(draft.adminShowcase.features, idx),
                  })
                }
              />
            </div>
            <SvcInput
              label={t.phase2b.service.adminShowcase.featureTitle}
              value={feat.title}
              onChange={(v) =>
                setAdminShowcase({
                  features: updateItem(draft.adminShowcase.features, i, {
                    title: v,
                  }),
                })
              }
            />
            <SvcTextarea
              label={t.phase2b.service.adminShowcase.featureBody}
              value={feat.body}
              onChange={(v) =>
                setAdminShowcase({
                  features: updateItem(draft.adminShowcase.features, i, {
                    body: v,
                  }),
                })
              }
              rows={2}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setAdminShowcase({
              features: [
                ...draft.adminShowcase.features,
                { title: "", body: "" },
              ],
            })
          }
          className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
        >
          <Plus size={11} /> {t.phase2b.service.adminShowcase.add}
        </button>
      </ServiceSection>

      <FloatingSaveBar
        show={hasChanges}
        pending={save.isPending}
        saved={justSaved}
        error={saveError}
        onSave={() => save.mutate()}
        onDiscard={reset}
      />
    </PageShell>
  );
}

export function SettingsTab({
  onUnsavedChange,
  demoSeed,
}: {
  onUnsavedChange?: (v: boolean) => void;
  demoSeed?: string;
}) {
  const qc = useQueryClient();
  const { t } = useAdminI18n();
  const copy = t.phase2b.settingsBasic;
  const copyIntegrations = t.phase2b.settingsIntegrations;
  const copyDesign = t.phase2b.settingsDesign;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const initialLoadFailed = isError && data === undefined;

  // V: the unsaved draft and preview prefs survive tab switches / page moves.
  const [form, setForm] = usePersistentState<Record<string, string>>(
    demoSeed ? `admin-demo:settingsDraft:${demoSeed}` : "admin:settingsDraft",
    {},
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [failedSectionIds, setFailedSectionIds] = useState<
    SettingsSectionId[]
  >([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showPreview, setShowPreview] = usePersistentState(
    "admin:showPreview",
    false,
  );
  const [previewDevice, setPreviewDevice] = usePersistentState<
    "desktop" | "mobile"
  >("admin:previewDevice", "desktop");
  const [liveSync, setLiveSync] = usePersistentState("admin:liveSync", true);
  // プレビュー列の幅。px ではなく Workspace に対する比率で保存する(§3-3)。
  const [previewRatio, setPreviewRatio] = usePersistentState<number | null>(
    SETTINGS_PREVIEW_WIDTH_KEY,
    null,
    "local",
  );
  // 展開は保存しない。開き直したら通常幅へ戻る(§5-1)。
  const [previewExpanded, setPreviewExpanded] = useState(false);
  // 幅が足りないときの編集/プレビュー切り替え。フォームはアンマウントしないので
  // 未保存の入力はどちらの表示でも残る(§7)。
  const [narrowView, setNarrowView] = useState<"edit" | "preview">("edit");
  const [previewDragging, setPreviewDragging] = useState(false);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  // 読み込み中は早期 return するため、ref ではなく state のコールバック ref で
  // 実際に DOM へ載った時点を捉える。
  const [workspaceEl, setWorkspaceEl] = useState<HTMLDivElement | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const [layoutTarget, setLayoutTarget] = usePersistentState<
    "galleryLayout" | "seriesLayout" | "topWorksLayout"
  >("admin:layoutTarget", "galleryLayout");
  const [newCamPreset, setNewCamPreset] = useState("");
  const [newLensPreset, setNewLensPreset] = useState("");
  const [presetError, setPresetError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const current = { ...data, ...form } as Record<string, string>;

  // ── Capture-info preset manager (camera / lens) ──
  // Effective list = saved (authoritative) or built-in defaults. Edits persist the
  // whole list immediately to siteSettings, so deleting a default sticks.
  const cameraPresets = effectivePresets(
    parsePresetList(data?.metaPresetsCamera),
    DEFAULT_CAMERA_PRESETS,
  );
  const lensPresets = effectivePresets(
    parsePresetList(data?.metaPresetsLens),
    DEFAULT_LENS_PRESETS,
  );
  const savePresets = useMutation({
    mutationFn: async (payload: {
      metaPresetsCamera?: string;
      metaPresetsLens?: string;
    }) => {
      await postAdminSettings(payload);
    },
    onSuccess: () => {
      setPresetError(false);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    // Without this the add/remove just silently no-ops on a failed request.
    onError: () => setPresetError(true),
  });
  const addCamPreset = () => {
    const v = newCamPreset.trim();
    if (!v || cameraPresets.includes(v)) {
      setNewCamPreset("");
      return;
    }
    savePresets.mutate({
      metaPresetsCamera: JSON.stringify([...cameraPresets, v]),
    });
    setNewCamPreset("");
  };
  const addLensPreset = () => {
    const v = newLensPreset.trim();
    if (!v || lensPresets.includes(v)) {
      setNewLensPreset("");
      return;
    }
    savePresets.mutate({
      metaPresetsLens: JSON.stringify([...lensPresets, v]),
    });
    setNewLensPreset("");
  };
  const removeCamPreset = (v: string) =>
    savePresets.mutate({
      metaPresetsCamera: JSON.stringify(cameraPresets.filter((x) => x !== v)),
    });
  const removeLensPreset = (v: string) =>
    savePresets.mutate({
      metaPresetsLens: JSON.stringify(lensPresets.filter((x) => x !== v)),
    });

  const save = useMutation({
    mutationFn: async () => {
      const submitted = { ...form };
      await postAdminSettings(submitted);
      return submitted;
    },
    onSuccess: (submitted) => {
      setSaveError(false);
      setFailedSectionIds([]);
      qc.setQueryData(
        ["settings"],
        (old: Record<string, string> | undefined) => ({ ...old, ...submitted }),
      );
      setForm((current) => draftAfterSuccessfulSave(submitted, current));
      setSaved(true);
      setLastSavedAt(
        new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => {
      setSaveError(true);
      setFailedSectionIds(
        settingsSectionIdsForKeys(dirtySettingsKeys(form, data)),
      );
    },
  });

  const set = (key: string, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  // Send preview settings to iframe whenever current changes.
  const previewPayload = useMemo(
    () => makeSettingsPreviewPayload({ ...data, ...form }),
    [data, form],
  );

  useEffect(() => {
    if (!showPreview || !liveSync || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "preview-settings", settings: previewPayload },
      window.location.origin,
    );
  }, [previewPayload, showPreview, liveSync]);

  // Also send on iframe load
  // 読み込みのたびに数える。プレビュー内の文書へ付けた待ち受け(Escape)は
  // 再読み込みで捨てられるため、この値を手がかりに付け直す。
  const [previewLoadSeq, setPreviewLoadSeq] = useState(0);
  const handleIframeLoad = useCallback(() => {
    setPreviewLoadSeq((seq) => seq + 1);
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "preview-settings", settings: previewPayload },
      window.location.origin,
    );
  }, [previewPayload]);

  // Handshake reply: the iframe's React app pings "preview-ready" once its
  // message listener is attached. Sends fired before that (mount/reload race)
  // are lost — replying here guarantees the latest payload always lands.
  const previewPayloadRef = useRef(previewPayload);
  useEffect(() => {
    previewPayloadRef.current = previewPayload;
  }, [previewPayload]);
  useEffect(() => {
    const onReady = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "preview-ready") return;
      iframeRef.current?.contentWindow?.postMessage(
        { type: "preview-settings", settings: previewPayloadRef.current },
        window.location.origin,
      );
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, []);

  // ── プレビュー列の幅 ──────────────────────────────────────────────
  // Workspace の実測幅から px を決める。左ナビの開閉で Workspace は変わるので
  // viewport 固定値は当てない(§13 A2)。
  useEffect(() => {
    if (!workspaceEl) return;
    setWorkspaceWidth(workspaceEl.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === "number") setWorkspaceWidth(width);
    });
    observer.observe(workspaceEl);
    return () => observer.disconnect();
  }, [workspaceEl]);

  const previewWidth = settingsPreviewWidthFromRatio(
    previewRatio,
    workspaceWidth,
  );
  const previewBounds = settingsPreviewWidthBounds(workspaceWidth);
  const applyPreviewWidth = useCallback(
    (nextWidth: number) => {
      if (!(workspaceWidth > 0)) return;
      setPreviewRatio(settingsPreviewRatioFromWidth(nextWidth, workspaceWidth));
    },
    [setPreviewRatio, workspaceWidth],
  );

  // ドラッグ中に画面を離れても window の待ち受けを残さない。
  const dragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanupRef.current?.(), []);

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !workspaceEl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPreviewDragging(true);
    // 右端は毎回測る。ドラッグ中に左ナビを開閉されても位置がずれない。
    const onMove = (moveEvent: PointerEvent) =>
      applyPreviewWidth(
        workspaceEl.getBoundingClientRect().right - moveEvent.clientX,
      );
    const onEnd = () => {
      setPreviewDragging(false);
      dragCleanupRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    dragCleanupRef.current = onEnd;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 64 : 16;
    // 帯を左へ動かす = プレビューが広がる。
    if (event.key === "ArrowLeft") applyPreviewWidth(previewWidth + step);
    else if (event.key === "ArrowRight") applyPreviewWidth(previewWidth - step);
    else if (event.key === "Home") applyPreviewWidth(previewBounds.min);
    else if (event.key === "End") applyPreviewWidth(previewBounds.max);
    else return;
    event.preventDefault();
  };

  const reloadPreview = useCallback(() => {
    iframeRef.current?.contentWindow?.location.reload();
  }, []);

  // 展開を解除したら「大きく表示」ボタンへフォーカスを返す(§5-1)。
  const wasExpandedRef = useRef(false);
  useEffect(() => {
    if (wasExpandedRef.current && !previewExpanded)
      expandButtonRef.current?.focus();
    wasExpandedRef.current = previewExpanded;
  }, [previewExpanded]);

  useEffect(() => {
    if (!previewExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPreviewExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    // iframe の中へフォーカスがあると、キーは親文書へ伝わらない。プレビューは
    // 同一オリジンなので、その文書にも同じ待ち受けを付けて Escape を通す。
    let innerDoc: Document | null = null;
    try {
      innerDoc = iframeRef.current?.contentDocument ?? null;
      innerDoc?.addEventListener("keydown", onKeyDown);
    } catch {
      innerDoc = null;
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      try {
        innerDoc?.removeEventListener("keydown", onKeyDown);
      } catch {
        /* 文書が破棄済み */
      }
    };
  }, [previewExpanded, previewLoadSeq]);

  // 展開中に保存が失敗したら展開を解除し、該当節を本文へ出す(§5-1)。
  useEffect(() => {
    if (saveError) setPreviewExpanded(false);
  }, [saveError]);

  useEffect(() => {
    if (showPreview) return;
    setPreviewExpanded(false);
    setNarrowView("edit");
  }, [showPreview]);

  // Warn on unsaved changes. These hooks must run before the isLoading early
  // return — a hook after a conditional return crashes React ("Rendered more
  // hooks than during the previous render") the moment isLoading flips.
  const hasUnsaved = hasUnsavedSettingsDraft(form, data);
  useEffect(() => {
    onUnsavedChange?.(initialLoadFailed ? false : hasUnsaved);
  }, [hasUnsaved, initialLoadFailed, onUnsavedChange]);
  useEffect(() => {
    if (initialLoadFailed || !hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved, initialLoadFailed]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full gap-2 text-[var(--admin-muted)] text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading...
      </div>
    );

  if (initialLoadFailed) {
    return (
      <SettingsLoadError
        title={t.navigation.tabs.settings}
        onRetry={() => void refetch()}
      />
    );
  }

  const fields = [
    { key: "siteName", ...copy.siteBasics.fields.siteName },
    { key: "siteNameEn", ...copy.siteBasics.fields.siteNameEn },
    { key: "heroSubtitle", ...copy.siteBasics.fields.heroSubtitle },
    { key: "siteDescription", ...copy.siteBasics.fields.siteDescription },
    { key: "footerText", ...copy.siteBasics.fields.footerText },
    { key: "contactIntro", ...copy.siteBasics.fields.contactIntro },
    { key: "contactIntroEn", ...copy.siteBasics.fields.contactIntroEn },
    { key: "contactNote", ...copy.siteBasics.fields.contactNote },
    { key: "contactNoteEn", ...copy.siteBasics.fields.contactNoteEn },
    { key: "contactFlow", ...copy.siteBasics.fields.contactFlow },
    { key: "contactFlowEn", ...copy.siteBasics.fields.contactFlowEn },
    {
      key: "contactEnglishNote",
      ...copy.siteBasics.fields.contactEnglishNote,
    },
    {
      key: "contactMessagePlaceholder",
      ...copy.siteBasics.fields.contactMessagePlaceholder,
    },
    { key: "contactEmail", ...copy.siteBasics.fields.contactEmail },
    { key: "formspreeUrl", ...copy.siteBasics.fields.formspreeUrl },
    { key: "siteUrl", ...copy.siteBasics.fields.siteUrl },
    {
      key: "googleSiteVerification",
      ...copy.siteBasics.fields.googleSiteVerification,
    },
    { key: "footerCtaLabel", ...copy.siteBasics.fields.footerCtaLabel },
    {
      key: "templateCreditLabel",
      ...copy.siteBasics.fields.templateCreditLabel,
    },
    { key: "templateCreditUrl", ...copy.siteBasics.fields.templateCreditUrl },
  ];

  const sectionTitles: Record<SettingsSectionId, string> = {
    "site-basics": copy.siteBasics.title,
    "portfolio-kit": copy.portfolioKit.title,
    hero: copy.hero.title,
    navigation: copy.nav.title,
    spacing: copy.spacing.title,
    texture: copy.bgTexture.title,
    reveal: copy.fade.title,
    "gallery-layout": copy.galleryLayout.title,
    series: copy.seriesSection.title,
    note: copyIntegrations.note.title,
    print: copyIntegrations.print.title,
    cta: copyIntegrations.cta.title,
    theme: copyDesign.themeColors.title,
    fonts: copyDesign.fonts.title,
    "font-size": copyDesign.fontSize.title,
    "font-color": copyDesign.fontColor.title,
    "font-spacing": copyDesign.fontTracking.title,
    "site-copy": copyDesign.siteCopy.title,
    presets: copyDesign.presets.title,
  };
  const dirtyKeys = dirtySettingsKeys(form, data);
  const changedSectionIds = settingsSectionIdsForKeys(dirtyKeys);
  const summarizeSection = (sectionId: SettingsSectionId) => {
    if (sectionId === "presets") {
      return t.formLayout.summaryItems(
        cameraPresets.length + lensPresets.length,
      );
    }
    const values = SETTINGS_SECTION_KEYS[sectionId]
      .map((key) => current[key]?.trim())
      .filter(
        (value): value is string =>
          Boolean(value) && !value!.startsWith("[") && !value!.startsWith("{"),
      );
    if (values.length === 0) return t.formLayout.summaryUnset;
    const firstValue =
      values[0].length > 34 ? `${values[0].slice(0, 34)}…` : values[0];
    return values.length === 1
      ? firstValue
      : `${firstValue} · ${t.formLayout.summaryItems(values.length)}`;
  };
  const settingsSections: AdminSettingsSectionItem[] = (
    Object.keys(SETTINGS_SECTION_KEYS) as SettingsSectionId[]
  ).map((id) => ({
    id,
    label: sectionTitles[id],
    summary: summarizeSection(id),
    changed: changedSectionIds.includes(id),
    failed: failedSectionIds.includes(id) || (id === "presets" && presetError),
    advanced: [
      "spacing", "texture", "reveal", "fonts", "font-size", "font-color",
      "font-spacing", "site-copy", "presets",
    ].includes(id),
  }));
  const sectionProps = (sectionId: SettingsSectionId) => ({
    sectionId,
    changed: changedSectionIds.includes(sectionId),
    failed:
      failedSectionIds.includes(sectionId) ||
      (sectionId === "presets" && presetError),
    focusOnError: failedSectionIds[0] === sectionId,
    summary: summarizeSection(sectionId),
  });

  const previewCopy = copyDesign.preview;
  const publicSiteHref = buildPublicSiteHref(demoSeed);
  const openPreview = (next: boolean) => {
    setShowPreview(next);
    if (next) setNarrowView("preview");
  };
  // 開閉ボタンは sticky な目次の下に置く。本文をどこまでスクロールしても
  // 戻れるようにするため(P6)。読み上げ名は既存のまま変えない。
  const previewToggleButton = (
    <PageHeaderButton
      active={showPreview}
      onClick={() => openPreview(!showPreview)}
      ariaLabel={
        showPreview ? previewCopy.closePreview : previewCopy.openPreview
      }
    >
      {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
      {showPreview ? previewCopy.closePreview : previewCopy.openPreview}
    </PageHeaderButton>
  );
  const mobilePreviewControl = showPreview ? (
    <span
      className="admin-settings-mobile-current__view-switch"
      title={previewCopy.viewSwitchLabel}
    >
      <button
        type="button"
        aria-pressed={narrowView === "edit"}
        onClick={() => setNarrowView("edit")}
      >
        {previewCopy.viewEdit}
      </button>
      <button
        type="button"
        aria-pressed={narrowView === "preview"}
        onClick={() => setNarrowView("preview")}
      >
        {previewCopy.viewPreview}
      </button>
    </span>
  ) : (
    <button
      type="button"
      className="admin-settings-mobile-current__preview-open"
      aria-label={previewCopy.openPreview}
      onClick={() => openPreview(true)}
    >
      <Eye size={13} />
    </button>
  );

  return (
    <div
      ref={setWorkspaceEl}
      className="admin-settings-workspace"
      data-settings-workspace
      data-preview={showPreview ? "true" : "false"}
      data-preview-expanded={showPreview && previewExpanded ? "true" : "false"}
      data-preview-view={showPreview ? narrowView : "edit"}
      style={
        showPreview
          ? ({
              "--settings-preview-w": `${previewWidth}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {/* Settings panel */}
      <div className="admin-settings-workspace__form">
        <AdminSettingsFormLayout
          sections={settingsSections}
          changedCount={dirtyKeys.length}
          pending={save.isPending}
          saveError={saveError}
          lastSavedAt={lastSavedAt}
          focusSectionId={failedSectionIds[0] ?? null}
          onSave={() => save.mutate()}
          onDiscard={() => {
            setForm({});
            setSaveError(false);
            setFailedSectionIds([]);
          }}
          copy={t.formLayout}
          previewToggle={previewToggleButton}
          mobilePreviewControl={mobilePreviewControl}
          header={
            <PageHeader
              title={t.navigation.tabs.settings}
              description={saveError ? t.headers.settingsSaveFailed : undefined}
            />
          }
        >
            <div className="flex flex-col">
              {/* General */}
              <SettingsGroup
                title={copy.groupTitle}
                sectionIds={SETTINGS_SECTION_GROUPS.general}
              >
              <Section
                {...sectionProps("site-basics")}
                title={copy.siteBasics.title}
                defaultOpen={false}
              >
                {fields.map((f) => (
                  <AdminField key={f.key} label={f.label} hint={f.hint}>
                    <input
                      type="text"
                      aria-label={f.label}
                      value={current[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="ax-input"
                    />
                  </AdminField>
                ))}
              </Section>

              <Section
                {...sectionProps("portfolio-kit")}
                title={copy.portfolioKit.title}
                defaultOpen={false}
                summary={
                  current["servicePageMode"] === "on"
                    ? copy.portfolioKit.modeLabels.on
                    : current["servicePageMode"] === "off"
                      ? copy.portfolioKit.modeLabels.off
                      : copy.portfolioKit.modeLabels.auto
                }
              >
                <AdminField
                  label={copy.portfolioKit.fieldLabel}
                  hint={copy.portfolioKit.fieldHint}
                >
                  <select
                    aria-label={copy.portfolioKit.fieldLabel}
                    value={current["servicePageMode"] ?? ""}
                    onChange={(e) => set("servicePageMode", e.target.value)}
                    className="ax-input ax-select"
                  >
                    <option value="">{copy.portfolioKit.modeLabels.auto}</option>
                    <option value="on">{copy.portfolioKit.modeLabels.on}</option>
                    <option value="off">{copy.portfolioKit.modeLabels.off}</option>
                  </select>
                </AdminField>
              </Section>

              {/* E1: Hero display mode */}
              <Section
                {...sectionProps("hero")}
                title={copy.hero.title}
                defaultOpen={false}
                summary={(() => {
                  const modeValue = current["heroMode"] || "carousel";
                  const modeName =
                    copy.hero.modeNames[
                      modeValue as keyof typeof copy.hero.modeNames
                    ] ?? copy.hero.modeNames.carousel;
                  const isFullscreen =
                    (current["heroDisplayMode"] || "normal") === "fullscreen";
                  // heroHeight has no effect in fullscreen mode — showing it
                  // there would imply a setting that isn't actually applied.
                  return isFullscreen
                    ? copy.hero.summaryFullscreen(modeName)
                    : copy.hero.summaryNormal(
                        modeName,
                        current["heroHeight"] || "70",
                      );
                })()}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed -mt-1">
                  {copy.hero.intro}
                </p>
                <AdminField label={copy.hero.modeLabel} hint={copy.hero.modeHint}>
                  <div className="grid grid-cols-2 gap-1.5">
                    {HERO_MODE_OPTIONS.map(({ value, rects }) => (
                      <VisualChoiceCard
                        key={value}
                        active={(current["heroMode"] || "carousel") === value}
                        name={
                          copy.hero.modeNames[
                            value as keyof typeof copy.hero.modeNames
                          ]
                        }
                        desc={
                          copy.hero.modeDescriptions[
                            value as keyof typeof copy.hero.modeDescriptions
                          ]
                        }
                        preview={<MiniDiagram rects={rects} />}
                        onClick={() => set("heroMode", value)}
                      />
                    ))}
                  </div>
                </AdminField>
                <AdminField
                  label={copy.hero.speedLabel}
                  hint={copy.hero.speedHint}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {HERO_MOTION_SPEED_OPTIONS.map(({ value, label }) => {
                      const text =
                        copy.hero.speedNames[
                          value as keyof typeof copy.hero.speedNames
                        ] ?? label;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-label={copy.hero.speedAriaLabel(text)}
                          aria-pressed={
                            (current["heroMotionSpeed"] || "standard") ===
                            value
                          }
                          onClick={() => set("heroMotionSpeed", value)}
                          className={`text-[length:var(--admin-text-note)] py-2 rounded-sm border transition-colors ${
                            (current["heroMotionSpeed"] || "standard") ===
                            value
                              ? "admin-btn-primary font-medium"
                              : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border-[var(--admin-line)]"
                          }`}
                        >
                          {text}
                        </button>
                      );
                    })}
                  </div>
                </AdminField>
                <AdminField
                  label={copy.hero.orderLabel}
                  hint={copy.hero.orderHint}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {HERO_REVEAL_ORDER_OPTIONS.map(({ value, label }) => {
                      const text =
                        copy.hero.orderNames[
                          value as keyof typeof copy.hero.orderNames
                        ] ?? label;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-label={copy.hero.orderAriaLabel(text)}
                          aria-pressed={
                            (current["heroRevealOrder"] || "photo-first") ===
                            value
                          }
                          onClick={() => set("heroRevealOrder", value)}
                          className={`text-[length:var(--admin-text-note)] py-2 rounded-sm border transition-colors ${
                            (current["heroRevealOrder"] || "photo-first") ===
                            value
                              ? "admin-btn-primary font-medium"
                              : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border-[var(--admin-line)]"
                          }`}
                        >
                          {text}
                        </button>
                      );
                    })}
                  </div>
                </AdminField>
                <AdminField
                  label={copy.hero.displayModeLabel}
                  hint={copy.hero.displayModeHint}
                >
                  <div className="flex gap-1">
                    {(
                      [
                        ["normal", copy.hero.displayModeOptions.normal],
                        [
                          "fullscreen",
                          copy.hero.displayModeOptions.fullscreen,
                        ],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("heroDisplayMode", val)}
                        className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${
                          (current["heroDisplayMode"] || "normal") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <AdminField
                  label={copy.hero.heightLabel}
                  hint={copy.hero.heightHint}
                >
                  <TypoControl
                    label={copy.hero.heightLabel}
                    valueKey="heroHeight"
                    current={current}
                    set={set}
                    min={35}
                    max={100}
                    step={1}
                    unit="vh"
                    defaultVal="70"
                  />
                </AdminField>
                <AdminField
                  label={copy.hero.titlePositionLabel}
                  hint={copy.hero.titlePositionHint}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ["center", copy.hero.titlePositionOptions.center],
                        [
                          "bottom-left",
                          copy.hero.titlePositionOptions["bottom-left"],
                        ],
                        [
                          "bottom-right",
                          copy.hero.titlePositionOptions["bottom-right"],
                        ],
                        [
                          "top-left",
                          copy.hero.titlePositionOptions["top-left"],
                        ],
                        [
                          "top-right",
                          copy.hero.titlePositionOptions["top-right"],
                        ],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("heroTitlePosition", val)}
                        className={`text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${
                          (current["heroTitlePosition"] || "center") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <AdminField
                  label={copy.hero.scrollEffectLabel}
                  hint={copy.hero.scrollEffectHint}
                >
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        ["none", copy.hero.scrollEffectOptions.none],
                        ["fade", copy.hero.scrollEffectOptions.fade],
                        ["sink", copy.hero.scrollEffectOptions.sink],
                        ["parallax", copy.hero.scrollEffectOptions.parallax],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("heroScrollEffect", val)}
                        className={`text-[length:var(--admin-text-note)] leading-tight py-1.5 rounded-sm transition-colors ${
                          (current["heroScrollEffect"] || "none") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <AdminField
                  label={copy.hero.overlayLabel}
                  hint={copy.hero.overlayHint}
                >
                  <div className="flex gap-1">
                    {(
                      [
                        ["on", copy.hero.overlayOptions.on],
                        ["off", copy.hero.overlayOptions.off],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("heroOverlay", val)}
                        className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${
                          (current["heroOverlay"] || "on") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <button
                  onClick={() => {
                    [
                      "heroMode",
                      "heroMotionSpeed",
                      "heroRevealOrder",
                      "heroHeight",
                      "heroOverlay",
                      "heroDisplayMode",
                      "heroTitlePosition",
                      "heroScrollEffect",
                    ].forEach((k) => set(k, ""));
                  }}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                >
                  {copy.resetToDefault}
                </button>
              </Section>

              {/* BB: nav position + hover effect */}
              <Section
                {...sectionProps("navigation")}
                title={copy.nav.title}
                defaultOpen={false}
                summary={copy.nav.summary(
                  copy.nav.positionNames[
                    (current["navPosition"] ||
                      "top") as keyof typeof copy.nav.positionNames
                  ] ?? copy.nav.positionNames.top,
                  copy.nav.hoverShortNames[
                    (current["navHoverEffect"] ||
                      "fade") as keyof typeof copy.nav.hoverShortNames
                  ],
                )}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed -mt-1">
                  {copy.nav.intro}
                </p>
                <AdminField label={copy.nav.positionLabel}>
                  <div className="grid grid-cols-3 gap-1.5">
                    {NAV_POSITION_OPTIONS.map(({ value, rects }) => (
                      <VisualChoiceCard
                        key={value}
                        active={(current["navPosition"] || "top") === value}
                        name={
                          copy.nav.positionNames[
                            value as keyof typeof copy.nav.positionNames
                          ]
                        }
                        desc={
                          copy.nav.positionDescriptions[
                            value as keyof typeof copy.nav.positionDescriptions
                          ]
                        }
                        preview={<MiniDiagram rects={rects} />}
                        onClick={() => set("navPosition", value)}
                      />
                    ))}
                  </div>
                </AdminField>
                <AdminField
                  label={copy.nav.hoverLabel}
                  hint={copy.nav.hoverHint}
                >
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        ["fade", copy.nav.hoverOptions.fade],
                        ["underline", copy.nav.hoverOptions.underline],
                        ["dot", copy.nav.hoverOptions.dot],
                        ["blur", copy.nav.hoverOptions.blur],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("navHoverEffect", val)}
                        className={`text-[length:var(--admin-text-note)] leading-tight py-1.5 rounded-sm transition-colors ${
                          (current["navHoverEffect"] || "fade") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <button
                  onClick={() => {
                    ["navPosition", "navHoverEffect"].forEach((k) =>
                      set(k, ""),
                    );
                  }}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                >
                  {copy.resetToDefault}
                </button>
              </Section>

              {/* CC: section spacing multipliers */}
              <Section
                {...sectionProps("spacing")}
                title={copy.spacing.title}
                defaultOpen={false}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed -mt-1">
                  {copy.spacing.intro}
                </p>
                <AdminField
                  label={copy.spacing.heroBottomLabel}
                  hint={copy.spacing.heroBottomHint}
                >
                  <TypoControl
                    label={copy.spacing.ratioControlLabel}
                    valueKey="spacingHeroBottom"
                    current={current}
                    set={set}
                    min={0.2}
                    max={4.0}
                    step={0.05}
                    unit="×"
                    defaultVal="1"
                  />
                </AdminField>
                <AdminField
                  label={copy.spacing.sectionGapLabel}
                  hint={copy.spacing.sectionGapHint}
                >
                  <TypoControl
                    label={copy.spacing.ratioControlLabel}
                    valueKey="spacingSectionGap"
                    current={current}
                    set={set}
                    min={0.2}
                    max={4.0}
                    step={0.05}
                    unit="×"
                    defaultVal="1"
                  />
                </AdminField>
                <AdminField
                  label={copy.spacing.pageTopLabel}
                  hint={copy.spacing.pageTopHint}
                >
                  <TypoControl
                    label={copy.spacing.ratioControlLabel}
                    valueKey="spacingPageTop"
                    current={current}
                    set={set}
                    min={0.2}
                    max={4.0}
                    step={0.05}
                    unit="×"
                    defaultVal="1"
                  />
                </AdminField>
                <AdminField
                  label={copy.spacing.footerTopLabel}
                  hint={copy.spacing.footerTopHint}
                >
                  <TypoControl
                    label={copy.spacing.ratioControlLabel}
                    valueKey="spacingFooterTop"
                    current={current}
                    set={set}
                    min={0.2}
                    max={4.0}
                    step={0.05}
                    unit="×"
                    defaultVal="1"
                  />
                </AdminField>
                <button
                  onClick={() => {
                    [
                      "spacingHeroBottom",
                      "spacingSectionGap",
                      "spacingPageTop",
                      "spacingFooterTop",
                    ].forEach((k) => set(k, ""));
                  }}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                >
                  {copy.resetToDefault}
                </button>
              </Section>

              {/* DD: paper/grain background texture */}
              <Section
                {...sectionProps("texture")}
                title={copy.bgTexture.title}
                defaultOpen={false}
                summary={
                  copy.bgTexture.names[
                    (current["bgTexture"] ||
                      "none") as keyof typeof copy.bgTexture.names
                  ] ?? copy.bgTexture.names.none
                }
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed -mt-1">
                  {copy.bgTexture.intro}
                </p>
                <AdminField
                  label={copy.bgTexture.textureLabel}
                  hint={copy.bgTexture.textureHint}
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    {BG_TEXTURE_OPTIONS.map(({ value }) => (
                      <VisualChoiceCard
                        key={value}
                        active={(current["bgTexture"] || "none") === value}
                        name={
                          copy.bgTexture.names[
                            value as keyof typeof copy.bgTexture.names
                          ]
                        }
                        desc={
                          copy.bgTexture.descriptions[
                            value as keyof typeof copy.bgTexture.descriptions
                          ]
                        }
                        preview={<TexturePreview value={value} />}
                        onClick={() => set("bgTexture", value)}
                      />
                    ))}
                  </div>
                  <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed mt-1.5">
                    {copy.bgTexture.previewNote}
                  </p>
                </AdminField>
                <AdminField
                  label={copy.bgTexture.opacityLabel}
                  hint={copy.bgTexture.opacityHint}
                >
                  <TypoControl
                    label={copy.bgTexture.opacityLabel}
                    valueKey="bgTextureOpacity"
                    current={current}
                    set={set}
                    min={0}
                    max={0.15}
                    step={0.01}
                    unit=""
                    defaultVal="0.06"
                  />
                </AdminField>
                <button
                  onClick={() => {
                    ["bgTexture", "bgTextureOpacity"].forEach((k) =>
                      set(k, ""),
                    );
                  }}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                >
                  {copy.resetToDefault}
                </button>
              </Section>

              {/* 写真のフェードイン方式（photoRevealEffect） */}
              <Section
                {...sectionProps("reveal")}
                title={copy.fade.title}
                defaultOpen={false}
                summary={
                  copy.fade.names[
                    (current["photoRevealEffect"] ||
                      "fade") as keyof typeof copy.fade.names
                  ] ?? copy.fade.names.fade
                }
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed -mt-1">
                  {copy.fade.intro}
                </p>
                <AdminField
                  label={copy.fade.appearanceLabel}
                  hint={copy.fade.appearanceHint}
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    {FADE_OPTIONS.map(({ value, rects }) => (
                      <VisualChoiceCard
                        key={value}
                        active={
                          (current["photoRevealEffect"] || "fade") === value
                        }
                        name={
                          copy.fade.names[
                            value as keyof typeof copy.fade.names
                          ]
                        }
                        desc={
                          copy.fade.descriptions[
                            value as keyof typeof copy.fade.descriptions
                          ]
                        }
                        preview={<MiniDiagram rects={rects} />}
                        onClick={() => set("photoRevealEffect", value)}
                      />
                    ))}
                  </div>
                </AdminField>
                <button
                  onClick={() => set("photoRevealEffect", "")}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                >
                  {copy.resetToDefault}
                </button>
              </Section>

              {/* G/N: Gallery layout type + controlled-random tuning */}
              <Section
                {...sectionProps("gallery-layout")}
                title={copy.galleryLayout.title}
                defaultOpen={false}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed -mt-1">
                  {copy.galleryLayout.introPrefix}{" "}
                  <span className="text-[color:var(--admin-ink)]">
                    {copy.galleryLayout.introTop}
                  </span>{" "}
                  /{" "}
                  <span className="text-[color:var(--admin-ink)]">Gallery</span>{" "}
                  /{" "}
                  <span className="text-[color:var(--admin-ink)]">Series</span>{" "}
                  {copy.galleryLayout.introSuffix}
                </p>
                {/* N1: layout-type picker. One list, applied to whichever
                    target (Gallery/Series/Top) is selected above it — the
                    9 choices used to repeat 3x (once per target), which made
                    the differences between layouts hard to compare. */}
                {(() => {
                  const targets = [
                    { key: "galleryLayout" as const, label: "Gallery" },
                    { key: "seriesLayout" as const, label: "Series" },
                    { key: "topWorksLayout" as const, label: "Top" },
                  ];
                  const fallbackFor = (key: (typeof targets)[number]["key"]) =>
                    key === "topWorksLayout" ? "stagger" : "mosaic";
                  const activeValue =
                    current[layoutTarget] || fallbackFor(layoutTarget);
                  return (
                    <>
                      <AdminField label={copy.galleryLayout.targetLabel}>
                        <div className="grid grid-cols-3 gap-1.5">
                          {targets.map(({ key, label }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setLayoutTarget(key)}
                              className={`text-[length:var(--admin-text-note)] py-1.5 rounded-sm border transition-colors ${
                                layoutTarget === key
                                  ? "admin-btn-primary font-medium"
                                  : "bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] border-[var(--admin-line)]"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </AdminField>
                      {(["aligned", "editorial"] as const).map((cat) => (
                        <AdminField
                          key={cat}
                          label={copy.galleryLayout.categoryLabels[cat]}
                        >
                          <div className="grid grid-cols-2 gap-1.5">
                            {GALLERY_LAYOUT_OPTIONS.filter(
                              (o) => o.category === cat,
                            ).map(({ value }) => (
                              <VisualChoiceCard
                                key={value}
                                active={activeValue === value}
                                name={
                                  t.phase2b.series.layoutNames[
                                    value as keyof typeof t.phase2b.series.layoutNames
                                  ]
                                }
                                desc={
                                  copy.galleryLayout.descriptions[
                                    value as keyof typeof copy.galleryLayout.descriptions
                                  ]
                                }
                                preview={<LayoutIcon value={value} />}
                                onClick={() => set(layoutTarget, value)}
                              />
                            ))}
                          </div>
                        </AdminField>
                      ))}
                    </>
                  );
                })()}
                {/* トップ Works の写真選択（ヒーロー最上部スライドとは別の設定） */}
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copy.galleryLayout.topWorksHeading}
                </p>
                <AdminField
                  label={copy.galleryLayout.topWorksModeLabel}
                  hint={copy.galleryLayout.topWorksModeHint}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        [
                          "auto",
                          copy.galleryLayout.topWorksModeOptions.auto.name,
                          copy.galleryLayout.topWorksModeOptions.auto.desc,
                        ],
                        [
                          "random",
                          copy.galleryLayout.topWorksModeOptions.random.name,
                          copy.galleryLayout.topWorksModeOptions.random.desc,
                        ],
                        [
                          "manual",
                          copy.galleryLayout.topWorksModeOptions.manual.name,
                          copy.galleryLayout.topWorksModeOptions.manual.desc,
                        ],
                      ] as const
                    ).map(([val, name, desc]) => (
                      <button
                        key={val}
                        onClick={() => set("topWorksMode", val)}
                        title={desc}
                        className={`text-[length:var(--admin-text-note)] leading-tight px-1.5 py-2 rounded-sm border transition-colors ${
                          (current["topWorksMode"] || "auto") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] border-[var(--admin-line)]"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </AdminField>
                {(current["topWorksMode"] || "auto") === "manual" && (
                  <AdminField
                    label={copy.galleryLayout.topWorksPickerLabel}
                    hint={copy.galleryLayout.topWorksPickerHint}
                  >
                    <TopWorksPicker
                      value={current["topWorksIds"] ?? ""}
                      onChange={(v) => set("topWorksIds", v)}
                    />
                  </AdminField>
                )}
                <AdminField
                  label={copy.galleryLayout.initialCountLabel}
                  hint={copy.galleryLayout.initialCountHint}
                >
                  <TypoControl
                    label={copy.galleryLayout.initialCountLabel}
                    valueKey="homeGalleryCount"
                    current={current}
                    set={set}
                    min={1}
                    max={200}
                    step={1}
                    unit={copy.units.photos}
                    defaultVal="12"
                  />
                </AdminField>
                {/* X: ギャラリーとトップ（Works）で列数・大きさ・余白を独立調整。
                W: 列数は「最大」を決め、実際の列数は画面幅で自動段階調整。 */}
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copy.galleryLayout.gridHeading}
                </p>
                <AdminField
                  label={copy.galleryLayout.maxColumnsLabel}
                  hint={copy.galleryLayout.maxColumnsHint}
                >
                  <TypoControl
                    label={copy.galleryLayout.maxColumnsLabel}
                    valueKey="galleryColumns"
                    current={current}
                    set={set}
                    min={SETTING_RANGES.galleryColumns.min}
                    max={SETTING_RANGES.galleryColumns.max}
                    step={SETTING_RANGES.galleryColumns.step}
                    unit={copy.units.columns}
                    defaultVal="3"
                  />
                </AdminField>
                <AdminField
                  label={copy.galleryLayout.photoSizeLabel}
                  hint={copy.galleryLayout.photoSizeHint}
                >
                  <TypoControl
                    label={copy.galleryLayout.photoSizeControlLabel}
                    valueKey="gallerySizeScale"
                    current={current}
                    set={set}
                    min={SETTING_RANGES.gallerySizeScale.min}
                    max={SETTING_RANGES.gallerySizeScale.max}
                    step={SETTING_RANGES.gallerySizeScale.step}
                    unit="×"
                    defaultVal="1"
                  />
                </AdminField>
                <AdminField
                  label={copy.galleryLayout.gapLabel}
                  hint={copy.galleryLayout.gapHint}
                >
                  <TypoControl
                    label={copy.galleryLayout.gapControlLabel}
                    valueKey="galleryGapScale"
                    current={current}
                    set={set}
                    min={SETTING_RANGES.galleryGapScale.min}
                    max={SETTING_RANGES.galleryGapScale.max}
                    step={SETTING_RANGES.galleryGapScale.step}
                    unit="×"
                    defaultVal="1"
                  />
                </AdminField>
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copy.galleryLayout.topGridHeading}
                </p>
                <AdminField
                  label={copy.galleryLayout.topMaxColumnsLabel}
                  hint={copy.galleryLayout.topMaxColumnsHint}
                >
                  <TypoControl
                    label={copy.galleryLayout.maxColumnsLabel}
                    valueKey="topWorksColumns"
                    current={current}
                    set={set}
                    min={SETTING_RANGES.topWorksColumns.min}
                    max={SETTING_RANGES.topWorksColumns.max}
                    step={SETTING_RANGES.topWorksColumns.step}
                    unit={copy.units.columns}
                    defaultVal={current["galleryColumns"] || "3"}
                  />
                </AdminField>
                <AdminField
                  label={copy.galleryLayout.topPhotoSizeLabel}
                  hint={copy.galleryLayout.topPhotoSizeHint}
                >
                  <TypoControl
                    label={copy.galleryLayout.photoSizeControlLabel}
                    valueKey="topWorksSizeScale"
                    current={current}
                    set={set}
                    min={SETTING_RANGES.topWorksSizeScale.min}
                    max={SETTING_RANGES.topWorksSizeScale.max}
                    step={SETTING_RANGES.topWorksSizeScale.step}
                    unit="×"
                    defaultVal={current["gallerySizeScale"] || "1"}
                  />
                </AdminField>
                <AdminField
                  label={copy.galleryLayout.topGapLabel}
                  hint={copy.galleryLayout.topGapHint}
                >
                  <TypoControl
                    label={copy.galleryLayout.gapControlLabel}
                    valueKey="topWorksGapScale"
                    current={current}
                    set={set}
                    min={SETTING_RANGES.topWorksGapScale.min}
                    max={SETTING_RANGES.topWorksGapScale.max}
                    step={SETTING_RANGES.topWorksGapScale.step}
                    unit="×"
                    defaultVal={current["galleryGapScale"] || "1"}
                  />
                </AdminField>
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copy.galleryLayout.mosaicHeading}
                </p>
                <AdminField
                  label={copy.galleryLayout.emptyRateLabel}
                  hint={copy.galleryLayout.emptyRateHint}
                >
                  <TypoControl
                    label={copy.galleryLayout.emptyRateControlLabel}
                    valueKey="galleryEmptyRate"
                    current={current}
                    set={set}
                    min={SETTING_RANGES.galleryEmptyRate.min}
                    max={SETTING_RANGES.galleryEmptyRate.max}
                    step={SETTING_RANGES.galleryEmptyRate.step}
                    unit=""
                    defaultVal="0.1"
                  />
                </AdminField>
                <AdminField
                  label={copy.galleryLayout.sizeVariationLabel}
                  hint={copy.galleryLayout.sizeVariationHint}
                >
                  <TypoControl
                    label={copy.galleryLayout.sizeVariationControlLabel}
                    valueKey="gallerySizeVariation"
                    current={current}
                    set={set}
                    min={SETTING_RANGES.gallerySizeVariation.min}
                    max={SETTING_RANGES.gallerySizeVariation.max}
                    step={SETTING_RANGES.gallerySizeVariation.step}
                    unit=""
                    defaultVal="0.5"
                  />
                </AdminField>
                <div className="pt-2 border-t border-[var(--admin-line)]">
                  <AdminField
                    label={copy.galleryLayout.shuffleLabel}
                    hint={copy.galleryLayout.shuffleHint}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          set(
                            "gallerySeed",
                            String(Math.floor(Math.random() * 1_000_000) + 1),
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-2 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm transition-colors"
                      >
                        <Shuffle size={12} /> {copy.galleryLayout.shuffleButton}
                      </button>
                      <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] tabular-nums">
                        seed: {current["gallerySeed"] || "1"}
                      </span>
                    </div>
                  </AdminField>
                </div>
                <button
                  onClick={() => {
                    [
                      "galleryGapScale",
                      "galleryEmptyRate",
                      "gallerySizeVariation",
                      "galleryColumns",
                      "gallerySizeScale",
                      "topWorksColumns",
                      "topWorksSizeScale",
                      "topWorksGapScale",
                      "gallerySeed",
                    ].forEach((k) => set(k, ""));
                  }}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                >
                  {copy.resetToDefault}
                </button>
              </Section>

              {/* I: Series navigation toggle */}
              <Section
                {...sectionProps("series")}
                title={copy.seriesSection.title}
                defaultOpen={false}
              >
                <AdminField
                  label={copy.seriesSection.navLabel}
                  hint={copy.seriesSection.navHint}
                >
                  <div className="flex gap-1">
                    {(
                      [
                        ["auto", copy.seriesSection.navOptions.auto],
                        ["on", copy.seriesSection.navOptions.on],
                        ["off", copy.seriesSection.navOptions.off],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("seriesNavEnabled", val)}
                        className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${
                          (current["seriesNavEnabled"] || "auto") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>

                {/* P: series grid (Works series view) */}
                <div className="pt-3 mt-1 border-t border-[var(--admin-line)] space-y-3">
                  <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed">
                    {copy.seriesSection.gridIntroPrefix}{" "}
                    <span className="text-[color:var(--admin-ink)]">
                      Series
                    </span>{" "}
                    {copy.seriesSection.gridIntroMid}{" "}
                    <span className="text-[color:var(--admin-ink)]">
                      Gallery
                    </span>{" "}
                    {copy.seriesSection.gridIntroSuffix}
                  </p>
                  <AdminField
                    label={copy.seriesSection.defaultViewLabel}
                    hint={copy.seriesSection.defaultViewHint}
                  >
                    <div className="flex gap-1">
                      {(
                        [
                          [
                            "photos",
                            copy.seriesSection.defaultViewOptions.photos,
                          ],
                          [
                            "series",
                            copy.seriesSection.defaultViewOptions.series,
                          ],
                        ] as const
                      ).map(([val, lbl]) => (
                        <button
                          key={val}
                          onClick={() => set("worksDefaultView", val)}
                          className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${
                            (current["worksDefaultView"] || "photos") === val
                              ? "admin-btn-primary font-medium"
                              : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </AdminField>
                  <AdminField
                    label={copy.seriesSection.columnsPcLabel}
                    hint={copy.seriesSection.columnsPcHint}
                  >
                    <TypoControl
                      label={copy.seriesSection.columnsPcControlLabel}
                      valueKey="seriesGridColumns"
                      current={current}
                      set={set}
                      min={SETTING_RANGES.seriesGridColumns.min}
                      max={SETTING_RANGES.seriesGridColumns.max}
                      step={SETTING_RANGES.seriesGridColumns.step}
                      unit={copy.units.columns}
                      defaultVal="3"
                    />
                  </AdminField>
                  <AdminField
                    label={copy.seriesSection.columnsMobileLabel}
                    hint={copy.seriesSection.columnsMobileHint}
                  >
                    <TypoControl
                      label={copy.seriesSection.columnsMobileControlLabel}
                      valueKey="seriesGridColumnsMobile"
                      current={current}
                      set={set}
                      min={SETTING_RANGES.seriesGridColumnsMobile.min}
                      max={SETTING_RANGES.seriesGridColumnsMobile.max}
                      step={SETTING_RANGES.seriesGridColumnsMobile.step}
                      unit={copy.units.columns}
                      defaultVal="2"
                    />
                  </AdminField>
                  <button
                    onClick={() => {
                      [
                        "worksDefaultView",
                        "seriesGridColumns",
                        "seriesGridColumnsMobile",
                      ].forEach((k) => set(k, ""));
                    }}
                    className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                  >
                    {copy.resetToDefault}
                  </button>
                </div>

                {/* 機能8: 並び順独立設定 */}
                <div className="pt-3 mt-1 border-t border-[var(--admin-line)] space-y-3">
                  <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed">
                    {copy.seriesSection.orderIntro}
                  </p>
                  <AdminField
                    label={copy.seriesSection.gallerySortLabel}
                    hint={copy.seriesSection.gallerySortHint}
                  >
                    <div className="grid grid-cols-2 gap-1">
                      {(
                        [
                          ["manual", copy.seriesSection.sortOptions.manual],
                          [
                            "date_desc",
                            copy.seriesSection.sortOptions.date_desc,
                          ],
                          [
                            "date_asc",
                            copy.seriesSection.sortOptions.date_asc,
                          ],
                          [
                            "upload_desc",
                            copy.seriesSection.sortOptions.upload_desc,
                          ],
                        ] as const
                      ).map(([val, lbl]) => (
                        <button
                          key={val}
                          onClick={() => set("gallerySortOrder", val)}
                          className={`text-[length:var(--admin-text-note)] py-1.5 rounded-sm border transition-colors ${(current["gallerySortOrder"] || "manual") === val ? "admin-btn-primary font-medium" : "bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] border-[var(--admin-line)]"}`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </AdminField>
                  <AdminField
                    label={copy.seriesSection.seriesSortLabel}
                    hint={copy.seriesSection.seriesSortHint}
                  >
                    <div className="grid grid-cols-2 gap-1">
                      {(
                        [
                          ["manual", copy.seriesSection.sortOptions.manual],
                          [
                            "date_desc",
                            copy.seriesSection.sortOptions.date_desc,
                          ],
                          [
                            "date_asc",
                            copy.seriesSection.sortOptions.date_asc,
                          ],
                          [
                            "upload_desc",
                            copy.seriesSection.sortOptions.upload_desc,
                          ],
                        ] as const
                      ).map(([val, lbl]) => (
                        <button
                          key={val}
                          onClick={() => set("seriesSortOrder", val)}
                          className={`text-[length:var(--admin-text-note)] py-1.5 rounded-sm border transition-colors ${(current["seriesSortOrder"] || "manual") === val ? "admin-btn-primary font-medium" : "bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] border-[var(--admin-line)]"}`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </AdminField>
                  <button
                    onClick={() => {
                      ["gallerySortOrder", "seriesSortOrder"].forEach((k) =>
                        set(k, ""),
                      );
                    }}
                    className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                  >
                    {copy.resetToDefault}
                  </button>
                </div>
              </Section>
            </SettingsGroup>

            <SettingsGroup
              title={copyIntegrations.groupTitle}
              sectionIds={SETTINGS_SECTION_GROUPS.integrations}
            >
              {/* J: note RSS integration */}
              <Section
                {...sectionProps("note")}
                title={copyIntegrations.note.title}
                defaultOpen={false}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed -mt-1">
                  {copyIntegrations.note.intro}
                </p>
                <AdminField
                  label={copyIntegrations.note.visibilityLabel}
                  hint={copyIntegrations.note.visibilityHint}
                >
                  <div className="flex gap-1">
                    {(
                      [
                        ["on", copyIntegrations.visibilityOn],
                        ["off", copyIntegrations.visibilityOff],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("noteEnabled", val)}
                        className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${
                          (current["noteEnabled"] || "off") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <AdminField
                  label={copyIntegrations.note.usernameLabel}
                  hint={copyIntegrations.note.usernameHint}
                >
                  <input
                    aria-label={copyIntegrations.note.usernameLabel}
                    type="text"
                    value={current["noteUsername"] ?? ""}
                    onChange={(e) => set("noteUsername", e.target.value.trim())}
                    placeholder={copyIntegrations.note.usernamePlaceholder}
                    className="ax-input ax-input--mono"
                  />
                </AdminField>
                <AdminField
                  label={copyIntegrations.note.displayCountLabel}
                  hint={copyIntegrations.note.displayCountHint}
                >
                  <TypoControl
                    label={copyIntegrations.note.countControlLabel}
                    valueKey="noteShowCount"
                    current={current}
                    set={set}
                    min={1}
                    max={8}
                    step={1}
                    unit={copyIntegrations.note.countUnit}
                    defaultVal="3"
                  />
                </AdminField>
              </Section>

              {/* K: print sales (external store) */}
              <Section
                {...sectionProps("print")}
                title={copyIntegrations.print.title}
                defaultOpen={false}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed -mt-1">
                  {copyIntegrations.print.intro}
                </p>
                <AdminField
                  label={copyIntegrations.print.visibilityLabel}
                  hint={copyIntegrations.print.visibilityHint}
                >
                  <div className="flex gap-1">
                    {(
                      [
                        ["on", copyIntegrations.visibilityOn],
                        ["off", copyIntegrations.visibilityOff],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("printEnabled", val)}
                        className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${
                          (current["printEnabled"] || "off") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <AdminField
                  label={copyIntegrations.print.storeUrlLabel}
                  hint={copyIntegrations.print.storeUrlHint}
                >
                  <input
                    aria-label={copyIntegrations.print.storeUrlLabel}
                    type="url"
                    value={current["printStoreUrl"] ?? ""}
                    onChange={(e) =>
                      set("printStoreUrl", e.target.value.trim())
                    }
                    placeholder={copyIntegrations.print.storeUrlPlaceholder}
                    className="ax-input"
                  />
                </AdminField>
                <AdminField
                  label={copyIntegrations.print.linkLabelLabel}
                  hint={copyIntegrations.print.linkLabelHint}
                >
                  <input
                    aria-label={copyIntegrations.print.linkLabelLabel}
                    type="text"
                    value={current["printStoreLabel"] ?? ""}
                    onChange={(e) => set("printStoreLabel", e.target.value)}
                    placeholder={copyIntegrations.print.linkLabelPlaceholder}
                    className="ax-input"
                  />
                </AdminField>
                <AdminField
                  label={copyIntegrations.print.descriptionLabel}
                  hint={copyIntegrations.print.descriptionHint}
                >
                  <textarea
                    aria-label={copyIntegrations.print.descriptionAria}
                    rows={2}
                    value={current["printDescription"] ?? ""}
                    onChange={(e) => set("printDescription", e.target.value)}
                    placeholder={copyIntegrations.print.descriptionPlaceholder}
                    className="ax-input ax-input--area"
                  />
                </AdminField>
              </Section>

              {/* 撮影依頼 CTA — closing "work with me" band */}
              <Section
                {...sectionProps("cta")}
                title={copyIntegrations.cta.title}
                defaultOpen={false}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] leading-relaxed -mt-1">
                  {copyIntegrations.cta.intro}
                </p>
                <AdminField
                  label={copyIntegrations.cta.visibilityLabel}
                  hint={copyIntegrations.cta.visibilityHint}
                >
                  <div className="flex gap-1">
                    {(
                      [
                        ["on", copyIntegrations.visibilityOn],
                        ["off", copyIntegrations.visibilityOff],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("homeCtaEnabled", val)}
                        className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${
                          (current["homeCtaEnabled"] || "off") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <AdminField
                  label={copyIntegrations.cta.headingLabel}
                  hint={copyIntegrations.cta.headingHint}
                >
                  <input
                    aria-label={copyIntegrations.cta.headingAria}
                    type="text"
                    value={current["homeCtaTitle"] ?? ""}
                    onChange={(e) => set("homeCtaTitle", e.target.value)}
                    placeholder={copyIntegrations.cta.headingPlaceholder}
                    className="ax-input"
                  />
                </AdminField>
                <AdminField
                  label={copyIntegrations.cta.bodyLabel}
                  hint={copyIntegrations.cta.bodyHint}
                >
                  <textarea
                    aria-label={copyIntegrations.cta.bodyAria}
                    rows={2}
                    value={current["homeCtaText"] ?? ""}
                    onChange={(e) => set("homeCtaText", e.target.value)}
                    placeholder={copyIntegrations.cta.bodyPlaceholder}
                    className="ax-input ax-input--area"
                  />
                </AdminField>
                <AdminField
                  label={copyIntegrations.cta.buttonLabel}
                  hint={copyIntegrations.cta.buttonHint}
                >
                  <input
                    aria-label={copyIntegrations.cta.buttonAria}
                    type="text"
                    value={current["homeCtaButton"] ?? ""}
                    onChange={(e) => set("homeCtaButton", e.target.value)}
                    placeholder={copyIntegrations.cta.buttonPlaceholder}
                    className="ax-input"
                  />
                </AdminField>
              </Section>
            </SettingsGroup>

            <SettingsGroup
              title={copyDesign.groupTitle}
              sectionIds={SETTINGS_SECTION_GROUPS.design}
            >
              {/* Theme Colors */}
              <Section
                {...sectionProps("theme")}
                title={copyDesign.themeColors.title}
                defaultOpen={false}
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex-1 min-w-0">
                    <AdminField label={copyDesign.themeColors.backgroundLabel}>
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          aria-label={copyDesign.themeColors.backgroundSwatchAria}
                          type="color"
                          value={current["themeBg"] || DEFAULT_THEME_BG}
                          onChange={(e) => set("themeBg", e.target.value)}
                          data-admin-setting="themeBg-color"
                          className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                        />
                        <input
                          aria-label={copyDesign.themeColors.backgroundHexAria}
                          type="text"
                          value={current["themeBg"] || ""}
                          onChange={(e) => set("themeBg", e.target.value)}
                          placeholder={DEFAULT_THEME_BG}
                          data-admin-setting="themeBg-text"
                          className="ax-input flex-1 min-w-0"
                        />
                      </div>
                    </AdminField>
                  </div>
                  <div className="flex-1 min-w-0">
                    <AdminField label={copyDesign.themeColors.textLabel}>
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          aria-label={copyDesign.themeColors.textSwatchAria}
                          type="color"
                          value={current["themeText"] || "#1a1a1a"}
                          onChange={(e) => set("themeText", e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                        />
                        <input
                          aria-label={copyDesign.themeColors.textHexAria}
                          type="text"
                          value={current["themeText"] || ""}
                          onChange={(e) => set("themeText", e.target.value)}
                          placeholder="#1a1a1a"
                          className="ax-input flex-1 min-w-0"
                        />
                      </div>
                    </AdminField>
                  </div>
                </div>
                {/* B-21: 暗い表示用の色。空のままなら既定の暗い配色に戻るので、
                    明るい色をそのまま暗い表示へ流用して読めなくなることはない。 */}
                <AdminField
                  label={copyDesign.themeColors.darkLabel}
                  hint={copyDesign.themeColors.darkHint}
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex-1 min-w-0">
                      <AdminField
                        label={copyDesign.themeColors.backgroundLabel}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            aria-label={
                              copyDesign.themeColors.darkBackgroundSwatchAria
                            }
                            type="color"
                            value={current["themeBgDark"] || DEFAULT_THEME_BG_DARK}
                            onChange={(e) => set("themeBgDark", e.target.value)}
                            data-admin-setting="themeBgDark-color"
                            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                          />
                          <input
                            aria-label={
                              copyDesign.themeColors.darkBackgroundHexAria
                            }
                            type="text"
                            value={current["themeBgDark"] || ""}
                            onChange={(e) => set("themeBgDark", e.target.value)}
                            placeholder={DEFAULT_THEME_BG_DARK}
                            data-admin-setting="themeBgDark-text"
                            className="ax-input flex-1 min-w-0"
                          />
                        </div>
                      </AdminField>
                    </div>
                    <div className="flex-1 min-w-0">
                      <AdminField label={copyDesign.themeColors.textLabel}>
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            aria-label={
                              copyDesign.themeColors.darkTextSwatchAria
                            }
                            type="color"
                            value={
                              current["themeTextDark"] || DEFAULT_THEME_TEXT_DARK
                            }
                            onChange={(e) =>
                              set("themeTextDark", e.target.value)
                            }
                            data-admin-setting="themeTextDark-color"
                            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                          />
                          <input
                            aria-label={copyDesign.themeColors.darkTextHexAria}
                            type="text"
                            value={current["themeTextDark"] || ""}
                            onChange={(e) =>
                              set("themeTextDark", e.target.value)
                            }
                            placeholder={DEFAULT_THEME_TEXT_DARK}
                            data-admin-setting="themeTextDark-text"
                            className="ax-input flex-1 min-w-0"
                          />
                        </div>
                      </AdminField>
                    </div>
                  </div>
                </AdminField>
                <button
                  onClick={() => {
                    set("themeBg", "");
                    set("themeText", "");
                    set("themeBgDark", "");
                    set("themeTextDark", "");
                  }}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                >
                  {copy.resetToDefault}
                </button>
              </Section>

              {/* Fonts */}
              <Section
                {...sectionProps("fonts")}
                title={copyDesign.fonts.title}
                defaultOpen={false}
              >
                {/* A6: one-click 和英 pairing presets — sets the existing fontJa/fontEn
                keys, so live preview and Save work exactly like manual picks. */}
                <AdminField
                  label={copyDesign.fonts.pairingLabel}
                  hint={copyDesign.fonts.pairingHint}
                >
                  <PairingPicker current={current} set={set} />
                </AdminField>
                <FontPicker
                  label={copyDesign.fonts.jaFontLabel}
                  presets={Object.keys(GOOGLE_FONTS_JA)}
                  valueKey="fontJa"
                  customNameKey="customFontJaName"
                  customUrlKey="customFontJaUrl"
                  customCategoryKey="customFontJaCategory"
                  current={current}
                  set={set}
                  fontMap={GOOGLE_FONTS_JA}
                />
                <FontPicker
                  label={copyDesign.fonts.enFontLabel}
                  presets={Object.keys(GOOGLE_FONTS_EN)}
                  valueKey="fontEn"
                  customNameKey="customFontEnName"
                  customUrlKey="customFontEnUrl"
                  customCategoryKey="customFontEnCategory"
                  current={current}
                  set={set}
                  fontMap={GOOGLE_FONTS_EN}
                />
                {/* A3: weights — options derive from the selected JA font's definition
                (loaded weights), falling back to a generic scale when unknown. */}
                {(() => {
                  const jaDef = GOOGLE_FONTS_JA[current["fontJa"] || ""];
                  const weights = jaDef?.weights ?? [300, 400, 500, 700];
                  const row = (key: string, defWeight: string) => (
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => set(key, "")}
                        className={`text-[length:var(--admin-text-note)] px-2.5 py-1.5 rounded-sm transition-colors ${
                          !(current[key] || "")
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {copyDesign.fonts.defaultWeight(defWeight)}
                      </button>
                      {weights.map((w) => (
                        <button
                          key={w}
                          onClick={() => set(key, String(w))}
                          className={`text-[length:var(--admin-text-note)] px-2.5 py-1.5 rounded-sm transition-colors ${
                            (current[key] || "") === String(w)
                              ? "admin-btn-primary font-medium"
                              : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                          }`}
                          style={{ fontWeight: w }}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  );
                  const hint = jaDef
                    ? copyDesign.fonts.heroWeightHintKnown
                    : copyDesign.fonts.heroWeightHintUnknown;
                  return (
                    <>
                      <AdminField label={copyDesign.fonts.heroWeightLabel} hint={hint}>
                        {row("heroNameWeight", "700")}
                      </AdminField>
                      <AdminField
                        label={copyDesign.fonts.bodyWeightLabel}
                        hint={copyDesign.fonts.bodyWeightHint}
                      >
                        {row("bodyWeight", "400")}
                      </AdminField>
                    </>
                  );
                })()}
              </Section>

              {/* Typography — 大きさ (D4: 軸別2階層。まず調整軸→対象) */}
              <Section
                {...sectionProps("font-size")}
                title={copyDesign.fontSize.title}
                defaultOpen={false}
              >
                <AdminField
                  label={copyDesign.fontSize.globalScaleLabel}
                  hint={copyDesign.fontSize.globalScaleHint}
                >
                  <TypoControl
                    label={copyDesign.fontSize.globalScaleControlLabel}
                    valueKey="globalFontScale"
                    current={current}
                    set={set}
                    min={0.5}
                    max={2.0}
                    step={0.01}
                    unit="×"
                    defaultVal="1"
                  />
                </AdminField>
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontSize.heroGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontSize.nameLabel}
                  valueKey="heroNameSize"
                  current={current}
                  set={set}
                  min={16}
                  max={160}
                  step={1}
                  unit="px"
                  defaultVal="60"
                />
                <TypoControl
                  label={copyDesign.fontSize.enNameLabel}
                  valueKey="heroNameEnSize"
                  current={current}
                  set={set}
                  min={8}
                  max={80}
                  step={1}
                  unit="px"
                  defaultVal="24"
                />
                <TypoControl
                  label={copyDesign.fontSize.subtitleLabel}
                  valueKey="heroSubSize"
                  current={current}
                  set={set}
                  min={6}
                  max={60}
                  step={1}
                  unit="px"
                  defaultVal="12"
                />
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontSize.navGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontSize.sizeLabel}
                  valueKey="navSize"
                  current={current}
                  set={set}
                  min={8}
                  max={48}
                  step={1}
                  unit="px"
                  defaultVal="14"
                />
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontSize.sectionGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontSize.sizeLabel}
                  valueKey="sectionLabelSize"
                  current={current}
                  set={set}
                  min={8}
                  max={40}
                  step={1}
                  unit="px"
                  defaultVal="16"
                />
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontSize.pageHeadingGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontSize.sizeLabel}
                  valueKey="headingSize"
                  current={current}
                  set={set}
                  min={12}
                  max={80}
                  step={1}
                  unit="px"
                  defaultVal="30"
                />
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontSize.bodyGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontSize.sizeLabel}
                  valueKey="bodySize"
                  current={current}
                  set={set}
                  min={10}
                  max={36}
                  step={1}
                  unit="px"
                  defaultVal="16"
                />
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontSize.footerGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontSize.sizeLabel}
                  valueKey="footerSize"
                  current={current}
                  set={set}
                  min={7}
                  max={32}
                  step={1}
                  unit="px"
                  defaultVal="12"
                />
                <button
                  onClick={() => {
                    [
                      "globalFontScale",
                      "heroNameSize",
                      "heroNameEnSize",
                      "heroSubSize",
                      "navSize",
                      "sectionLabelSize",
                      "headingSize",
                      "bodySize",
                      "footerSize",
                    ].forEach((k) => set(k, ""));
                  }}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                >
                  {copy.resetToDefault}
                </button>
              </Section>

              {/* Typography — 色 */}
              <Section
                {...sectionProps("font-color")}
                title={copyDesign.fontColor.title}
                defaultOpen={false}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2">
                  {copyDesign.fontColor.heroGroupLabel}
                </p>
                <ColorRow
                  label={copyDesign.fontColor.nameLabel}
                  valueKey="heroNameColor"
                  current={current}
                  set={set}
                  placeholder="#ffffff"
                />
                <ColorRow
                  label={copyDesign.fontColor.enNameLabel}
                  valueKey="heroNameEnColor"
                  current={current}
                  set={set}
                  placeholder="rgba(255,255,255,0.75)"
                />
                <ColorRow
                  label={copyDesign.fontColor.subtitleLabel}
                  valueKey="heroSubColor"
                  current={current}
                  set={set}
                  placeholder="rgba(255,255,255,0.75)"
                />
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontColor.accentGroupLabel}
                </p>
                <ColorRow
                  label={copyDesign.fontColor.accentLabel}
                  valueKey="accentColor"
                  current={current}
                  set={set}
                  placeholder={copyDesign.fontColor.accentPlaceholder}
                  hint={copyDesign.fontColor.accentHint}
                />
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontColor.linkGroupLabel}
                </p>
                <ColorRow
                  label={copyDesign.fontColor.linkHoverLabel}
                  valueKey="linkHoverColor"
                  current={current}
                  set={set}
                  placeholder="#1a1a1a"
                  hint={copyDesign.fontColor.linkHoverHint}
                />
                <AdminField
                  label={copyDesign.fontColor.underlineLabel}
                  hint={copyDesign.fontColor.underlineHint}
                >
                  <div className="flex gap-1">
                    {(
                      [
                        ["on", copyDesign.fontColor.underlineOn],
                        ["off", copyDesign.fontColor.underlineOff],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("linkUnderline", val)}
                        className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${
                          (current["linkUnderline"] || "off") === val
                            ? "admin-btn-primary font-medium"
                            : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontColor.opacityGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontColor.navOpacityLabel}
                  valueKey="navOpacity"
                  current={current}
                  set={set}
                  min={0.05}
                  max={1}
                  step={0.01}
                  isOpacity
                />
                <TypoControl
                  label={copyDesign.fontColor.sectionOpacityLabel}
                  valueKey="sectionLabelOpacity"
                  current={current}
                  set={set}
                  min={0.05}
                  max={1}
                  step={0.01}
                  isOpacity
                />
                <TypoControl
                  label={copyDesign.fontColor.footerOpacityLabel}
                  valueKey="footerOpacity"
                  current={current}
                  set={set}
                  min={0.05}
                  max={1}
                  step={0.01}
                  isOpacity
                />
                <TypoControl
                  label={copyDesign.fontColor.snsOpacityLabel}
                  valueKey="snsOpacity"
                  current={current}
                  set={set}
                  min={0.05}
                  max={1}
                  step={0.01}
                  isOpacity
                />
                <button
                  onClick={() => {
                    [
                      "heroNameColor",
                      "heroNameEnColor",
                      "heroSubColor",
                      "accentColor",
                      "linkHoverColor",
                      "linkUnderline",
                      "navOpacity",
                      "sectionLabelOpacity",
                      "footerOpacity",
                      "snsOpacity",
                    ].forEach((k) => set(k, ""));
                  }}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                >
                  {copy.resetToDefault}
                </button>
              </Section>

              {/* Typography — 間隔（字間・行間） */}
              <Section
                {...sectionProps("font-spacing")}
                title={copyDesign.fontTracking.title}
                defaultOpen={false}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2">
                  {copyDesign.fontTracking.heroGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontTracking.nameTrackingLabel}
                  valueKey="heroNameTracking"
                  current={current}
                  set={set}
                  min={-0.06}
                  max={0.8}
                  step={0.01}
                  unit="em"
                  defaultVal="0.04"
                />
                <TypoControl
                  label={copyDesign.fontTracking.enNameTrackingLabel}
                  valueKey="heroNameEnTracking"
                  current={current}
                  set={set}
                  min={-0.06}
                  max={0.6}
                  step={0.01}
                  unit="em"
                  defaultVal="0.08"
                />
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontTracking.navGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontTracking.trackingLabel}
                  valueKey="navTracking"
                  current={current}
                  set={set}
                  min={-0.06}
                  max={0.8}
                  step={0.01}
                  unit="em"
                  defaultVal="0.04"
                />
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontTracking.sectionGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontTracking.trackingLabel}
                  valueKey="sectionLabelTracking"
                  current={current}
                  set={set}
                  min={-0.06}
                  max={0.6}
                  step={0.01}
                  unit="em"
                  defaultVal="0.10"
                />
                <TypoControl
                  label={copyDesign.fontTracking.leadingLabel}
                  valueKey="sectionLeading"
                  current={current}
                  set={set}
                  min={0.9}
                  max={3.0}
                  step={0.05}
                  unit=""
                  defaultVal="1.2"
                />
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.fontTracking.bodyGroupLabel}
                </p>
                <TypoControl
                  label={copyDesign.fontTracking.trackingLabel}
                  valueKey="bodyTracking"
                  current={current}
                  set={set}
                  min={-0.04}
                  max={0.5}
                  step={0.01}
                  unit="em"
                  defaultVal="0.01"
                />
                <TypoControl
                  label={copyDesign.fontTracking.leadingLabel}
                  valueKey="bodyLeading"
                  current={current}
                  set={set}
                  min={1.2}
                  max={3.0}
                  step={0.05}
                  unit=""
                  defaultVal="1.8"
                />
                <button
                  onClick={() => {
                    [
                      "heroNameTracking",
                      "heroNameEnTracking",
                      "navTracking",
                      "sectionLabelTracking",
                      "sectionLeading",
                      "bodyTracking",
                      "bodyLeading",
                    ].forEach((k) => set(k, ""));
                  }}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
                >
                  {copy.resetToDefault}
                </button>
              </Section>

              {/* サイト文言 (D2) — サイトに一度だけ出る固定文言。各項目に表示場所を明記 */}
              <Section
                {...sectionProps("site-copy")}
                title={copyDesign.siteCopy.title}
                defaultOpen={false}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2">
                  {copyDesign.siteCopy.navGroupLabel}
                </p>
                {(
                  [
                    {
                      key: "navLabelTop",
                      ...copyDesign.siteCopy.fields.navLabelTop,
                    },
                    {
                      key: "navLabelGallery",
                      ...copyDesign.siteCopy.fields.navLabelGallery,
                    },
                    {
                      key: "navLabelAbout",
                      ...copyDesign.siteCopy.fields.navLabelAbout,
                    },
                    {
                      key: "navLabelContact",
                      ...copyDesign.siteCopy.fields.navLabelContact,
                    },
                  ] as {
                    key: string;
                    label: string;
                    placeholder: string;
                    hint: string;
                  }[]
                ).map((f) => (
                  <AdminField key={f.key} label={f.label} hint={f.hint}>
                    <input
                      type="text"
                      aria-label={f.label}
                      value={current[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="ax-input"
                    />
                  </AdminField>
                ))}
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.siteCopy.snsGroupLabel}
                </p>
                {(
                  [
                    {
                      key: "snsLabelInstagram",
                      ...copyDesign.siteCopy.fields.snsLabelInstagram,
                    },
                    {
                      key: "snsLabelTwitter",
                      ...copyDesign.siteCopy.fields.snsLabelTwitter,
                    },
                    {
                      key: "snsLabelNote",
                      ...copyDesign.siteCopy.fields.snsLabelNote,
                    },
                  ] as {
                    key: string;
                    label: string;
                    placeholder: string;
                    hint: string;
                  }[]
                ).map((f) => (
                  <AdminField key={f.key} label={f.label} hint={f.hint}>
                    <input
                      type="text"
                      aria-label={f.label}
                      value={current[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="ax-input"
                    />
                  </AdminField>
                ))}
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.siteCopy.sectionGroupLabel}
                </p>
                {(
                  [
                    {
                      key: "worksLabel",
                      ...copyDesign.siteCopy.fields.worksLabel,
                    },
                    {
                      key: "viewAllLabel",
                      ...copyDesign.siteCopy.fields.viewAllLabel,
                    },
                    {
                      key: "viewAllCtaLabel",
                      ...copyDesign.siteCopy.fields.viewAllCtaLabel,
                    },
                    {
                      key: "galleryLabel",
                      ...copyDesign.siteCopy.fields.galleryLabel,
                    },
                    {
                      key: "filterAllLabel",
                      ...copyDesign.siteCopy.fields.filterAllLabel,
                    },
                    {
                      key: "profileLabel",
                      ...copyDesign.siteCopy.fields.profileLabel,
                    },
                    {
                      key: "contactLabel",
                      ...copyDesign.siteCopy.fields.contactLabel,
                    },
                  ] as {
                    key: string;
                    label: string;
                    placeholder: string;
                    hint: string;
                  }[]
                ).map((f) => (
                  <AdminField key={f.key} label={f.label} hint={f.hint}>
                    <input
                      type="text"
                      aria-label={f.label}
                      value={current[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="ax-input"
                    />
                  </AdminField>
                ))}
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-2 pt-2 border-t border-[var(--admin-line)]">
                  {copyDesign.siteCopy.formGroupLabel}
                </p>
                {(
                  [
                    {
                      key: "contactFormName",
                      ...copyDesign.siteCopy.fields.contactFormName,
                    },
                    {
                      key: "contactFormEmail",
                      ...copyDesign.siteCopy.fields.contactFormEmail,
                    },
                    {
                      key: "contactFormSubject",
                      ...copyDesign.siteCopy.fields.contactFormSubject,
                    },
                    {
                      key: "contactSubjectOptions",
                      ...copyDesign.siteCopy.fields.contactSubjectOptions,
                    },
                    {
                      key: "contactFormMessage",
                      ...copyDesign.siteCopy.fields.contactFormMessage,
                    },
                    {
                      key: "contactSendButton",
                      ...copyDesign.siteCopy.fields.contactSendButton,
                    },
                    {
                      key: "contactSendingButton",
                      ...copyDesign.siteCopy.fields.contactSendingButton,
                    },
                    {
                      key: "contactSentMessage",
                      ...copyDesign.siteCopy.fields.contactSentMessage,
                    },
                    {
                      key: "contactSendAnother",
                      ...copyDesign.siteCopy.fields.contactSendAnother,
                    },
                    {
                      key: "contactErrorMessage",
                      ...copyDesign.siteCopy.fields.contactErrorMessage,
                    },
                  ] as { key: string; label: string; placeholder: string }[]
                ).map((f) => (
                  <AdminField key={f.key} label={f.label}>
                    <input
                      type="text"
                      aria-label={f.label}
                      value={current[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="ax-input"
                    />
                  </AdminField>
                ))}
              </Section>

              {/* 撮影情報プリセット — インスペクタの Camera / Lens 候補 */}
              <Section
                {...sectionProps("presets")}
                title={copyDesign.presets.title}
                defaultOpen={false}
              >
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] -mb-1">
                  {copyDesign.presets.intro}
                </p>

                <PresetEditor
                  label={copyDesign.presets.cameraLabel}
                  items={cameraPresets}
                  value={newCamPreset}
                  onChange={setNewCamPreset}
                  onAdd={addCamPreset}
                  onRemove={removeCamPreset}
                  placeholder={copyDesign.presets.cameraPlaceholder}
                  busy={savePresets.isPending}
                />
                <PresetEditor
                  label={copyDesign.presets.lensLabel}
                  items={lensPresets}
                  value={newLensPreset}
                  onChange={setNewLensPreset}
                  onAdd={addLensPreset}
                  onRemove={removeLensPreset}
                  placeholder={copyDesign.presets.lensPlaceholder}
                  busy={savePresets.isPending}
                />
                {presetError && (
                  <p role="alert" className="admin-text-danger text-[length:var(--admin-text-note)]">
                    {copyDesign.presets.saveFailed}
                  </p>
                )}
              </Section>
              </SettingsGroup>

              {/* Admin */}
              <div className="pt-1 pb-4 px-1">
                <p className="text-[length:var(--admin-text-note)] tracking-wider text-[color:var(--admin-muted)] mb-2">
                  {copy.adminPasswordTitle}
                </p>
                <p className="text-[length:var(--admin-text-note)] text-[color:var(--admin-muted)] leading-relaxed">
                  {copy.adminPasswordHint}{" "}
                  <code className="text-[color:var(--admin-ink)] bg-[color:var(--admin-paper-deep)] px-1 py-0.5 rounded-sm font-mono text-[length:var(--admin-text-note)]">
                    ADMIN_PASSWORD
                  </code>
                </p>
              </div>
            </div>
        </AdminSettingsFormLayout>
        <div className="admin-settings-mobile-save">
          <FloatingSaveBar
            show={hasUnsaved}
            pending={save.isPending}
            saved={saved}
            error={saveError}
            onSave={() => save.mutate()}
            onDiscard={() => {
              setForm({});
              setSaveError(false);
              setFailedSectionIds([]);
            }}
          />
        </div>
      </div>

      {/* プレビュー列。全画面 overlay を作らず、Settings の Workspace の中に
          留まる。左ナビ・言語切替・グローバルナビはそのまま残る(§5-1)。 */}
      {showPreview && (
        <>
          {/* ARIA の window splitter。フォーカスでき、値を持つ分割線なので
              hr へは置き換えられない(§3-2)。 */}
          {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div role="separator"
            aria-orientation="vertical"
            aria-label={previewCopy.resizeLabel}
            aria-valuenow={previewWidth}
            aria-valuemin={previewBounds.min}
            aria-valuemax={previewBounds.max}
            tabIndex={0}
            className="admin-settings-workspace__resizer"
            data-settings-preview-resizer
            title={previewCopy.resetWidthTitle}
            onPointerDown={handleResizePointerDown}
            onDoubleClick={() => setPreviewRatio(null)}
            onKeyDown={handleResizeKeyDown}
          />
          <AdminSettingsPreviewPane
            ref={iframeRef}
            device={previewDevice}
            onDeviceChange={setPreviewDevice}
            liveSync={liveSync}
            onLiveSyncChange={setLiveSync}
            src={publicSiteHref}
            publicHref={publicSiteHref}
            onIframeLoad={handleIframeLoad}
            onReload={reloadPreview}
            expanded={previewExpanded}
            onToggleExpanded={() => setPreviewExpanded((value) => !value)}
            expandButtonRef={expandButtonRef}
            canResetWidth={previewRatio !== null}
            onResetWidth={() => setPreviewRatio(null)}
            unsavedCount={dirtyKeys.length}
            dragging={previewDragging}
            copy={{
              title: copy.previewTitle,
              desktop: t.phase2b.library.sitePreview.desktop,
              desktopTitle: t.phase2b.library.sitePreview.desktopTitle,
              mobile: t.phase2b.library.sitePreview.mobile,
              mobileTitle: t.phase2b.library.sitePreview.mobileTitle,
              syncOn: previewCopy.syncOn,
              syncOff: previewCopy.syncOff,
              syncOnTitle: previewCopy.syncOnTitle,
              syncOffTitle: previewCopy.syncOffTitle,
              reload: previewCopy.reload,
              expand: previewCopy.expand,
              collapse: previewCopy.collapse,
              expandTitle: previewCopy.expandTitle,
              openInNewTab: previewCopy.openInNewTab,
              openInNewTabTitle: previewCopy.openInNewTabTitle,
              resetWidth: previewCopy.resetWidth,
              resetWidthTitle: previewCopy.resetWidthTitle,
              unsavedWhileExpanded: previewCopy.unsavedWhileExpanded,
            }}
          />
        </>
      )}
    </div>
  );
}

/* ── Collapsible Section ─────────────────────────── */
// Settings accordion row. Content stays mounted at all times (open state only
// changes a CSS grid-template-rows track) so toggling never unmounts/remounts
// children — that mount/remount was what caused the open-moment flicker.
// Transition is disabled for the first frame so a defaultOpen row never plays
// an unwanted "opening" animation on initial mount.
function Section({
  sectionId,
  title,
  summary,
  defaultOpen = false,
  changed = false,
  failed = false,
  focusOnError = false,
  children,
}: {
  sectionId?: string;
  title: string;
  // Short "current selection" hint shown next to the title even while
  // collapsed, so the owner doesn't have to open every section to see what's
  // already set (Settings可視化 Phase 1, 2026-07-09).
  // 単節表示（目次で1節ずつ出す画面）では折りたたみ自体がないため使わない。
  summary?: string;
  defaultOpen?: boolean;
  changed?: boolean;
  failed?: boolean;
  focusOnError?: boolean;
  children: React.ReactNode;
}) {
  const activeSectionId = useAdminSettingsActiveSection();
  // 目次で1節ずつ出す画面では、選ばれた節だけを実際の入力欄として描く。
  // 折りたたみ行を19本並べると、左の目次と同じ一覧が本文にも重なるため。
  const singleView = activeSectionId !== null && sectionId !== undefined;
  const [open, setOpen] = useState(defaultOpen);
  const [animated, setAnimated] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (failed) setOpen(true);
  }, [failed]);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !focusOnError) return;
    let errorField: HTMLElement | null = null;
    const id = window.setTimeout(() => {
      errorField = section.querySelector<HTMLElement>(
        "input:not([type='hidden']), select, textarea",
      );
      if (!errorField) return;
      errorField.setAttribute("aria-invalid", "true");
      errorField.setAttribute("data-settings-save-error-field", "");
      errorField.focus({ preventScroll: true });
      section.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 180);
    return () => {
      window.clearTimeout(id);
      errorField?.removeAttribute("aria-invalid");
      errorField?.removeAttribute("data-settings-save-error-field");
    };
  }, [focusOnError]);

  if (singleView && sectionId !== activeSectionId) return null;

  const markers = (
    <span className="admin-settings-section__markers" aria-hidden="true">
      {changed && (
        <span className="admin-form-toc__dot admin-form-toc__dot--changed" />
      )}
      {failed && (
        <span className="admin-form-toc__dot admin-form-toc__dot--failed" />
      )}
    </span>
  );

  return (
    <div
      ref={sectionRef}
      id={sectionId ? `settings-section-${sectionId}` : undefined}
      data-settings-section={sectionId}
      data-settings-section-changed={changed ? "true" : "false"}
      data-settings-section-error={failed ? "true" : "false"}
      className="admin-settings-section scroll-mt-24"
    >
      {singleView ? (
        // 単節表示では開閉する扉を置かない。目次が唯一の切替器になる。
        <h2
          data-settings-section-heading
          tabIndex={-1}
          className="admin-settings-section__heading flex items-center gap-3 min-h-[44px] text-[length:var(--admin-text-body)] text-[color:var(--admin-ink)]"
        >
          <span className="shrink-0 whitespace-nowrap">
            {title}
            {markers}
          </span>
        </h2>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="admin-plain-section-trigger flex items-center justify-between gap-3 w-full min-h-[56px] px-0 text-left text-[length:var(--admin-text-body)] text-[color:var(--admin-ink)] hover:text-[color:var(--admin-ink)] transition-colors duration-[var(--dur-fast)]"
        >
          <span className="shrink-0 whitespace-nowrap">
            {title}
            {markers}
          </span>
          <span className="ml-auto flex min-w-0 items-center gap-3">
            {!open && summary && (
              <span className="text-[length:var(--admin-text-note)] text-[color:var(--admin-muted)] font-normal truncate">
                {summary}
              </span>
            )}
            <ChevronRight
              size={12}
              className="text-[color:var(--admin-muted)] flex-shrink-0 transition-transform duration-[var(--dur-base)] ease-[var(--ease-inout)]"
              style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
            />
          </span>
        </button>
      )}
      <div
        className={`grid px-0 ${animated ? "transition-[grid-template-rows] duration-[var(--dur-base)] ease-[var(--ease-inout)]" : ""}`}
        style={{ gridTemplateRows: singleView || open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-10 pt-2 flex flex-col gap-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Settings group: whitespace and fine rules establish hierarchy without a
// filled panel surface. Rows keep a single 1px divider between them.
// 単節表示では、現在の節を含まないグループは見出しだけが残るため描かない。
function SettingsGroup({
  title,
  sectionIds,
  children,
}: {
  title: string;
  sectionIds?: readonly SettingsSectionId[];
  children: React.ReactNode;
}) {
  const activeSectionId = useAdminSettingsActiveSection();
  if (
    activeSectionId !== null &&
    sectionIds &&
    !sectionIds.includes(activeSectionId as SettingsSectionId)
  ) {
    return null;
  }
  return (
    <div className="mb-12 border-t border-[var(--admin-line)] pt-3">
      <p className="text-[length:var(--admin-text-note)] tracking-widest text-[color:var(--admin-muted)] mb-1">
        {title}
      </p>
      <div className="[&>*+*]:border-t [&>*+*]:border-[color:var(--admin-line)]">
        {children}
      </div>
    </div>
  );
}

/* ── Capture-info preset editor (camera / lens) ───── */
function PresetEditor({
  label,
  items,
  value,
  onChange,
  onAdd,
  onRemove,
  placeholder,
  busy,
}: {
  label: string;
  items: string[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
  placeholder: string;
  busy?: boolean;
}) {
  const { t } = useAdminI18n();
  const copy = t.phase2b.settingsDesign.presets;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
            {copy.empty}
          </span>
        )}
        {items.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] text-[var(--admin-ink)] text-[length:var(--admin-text-note)] pl-2 pr-1 py-1 rounded-sm"
          >
            {p}
            <button
              onClick={() => onRemove(p)}
              disabled={busy}
              aria-label={copy.removeAria(p)}
              className="admin-danger-on-hover text-[var(--admin-muted)] transition-colors disabled:opacity-40"
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          aria-label={placeholder}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          className="ax-input flex-1"
        />
        <button
          onClick={onAdd}
          disabled={busy || !value.trim()}
          className="flex items-center gap-1 px-3 py-2 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm transition-colors disabled:opacity-40"
        >
          <Plus size={12} /> {copy.add}
        </button>
      </div>
    </div>
  );
}

/* ── Shared UI ───────────────────────────────────── */
function fontFallbackStr(category: "serif" | "sans-serif"): string {
  return category === "serif"
    ? "'Hiragino Mincho ProN', serif"
    : "'Hiragino Sans', sans-serif";
}

function PairingPicker({
  current,
  set,
}: {
  current: Record<string, string>;
  set: (key: string, val: string) => void;
}) {
  useEffect(() => {
    const families = new Set<string>();
    for (const { ja, en } of FONT_PAIRINGS) {
      const jaDef = GOOGLE_FONTS_JA[ja];
      const enDef = GOOGLE_FONTS_EN[en];
      if (jaDef) families.add(jaDef.param);
      if (enDef) families.add(enDef.param);
    }
    const url = `https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${f}`).join("&")}&display=swap`;
    const id = "pairing-preview-fonts";
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.getAttribute("href") !== url)
        existing.setAttribute("href", url);
      return;
    }
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-1.5">
      {FONT_PAIRINGS.map(({ name, ja, en, desc }) => {
        const active =
          (current["fontJa"] || "") === ja && (current["fontEn"] || "") === en;
        const jaDef = GOOGLE_FONTS_JA[ja];
        const enDef = GOOGLE_FONTS_EN[en];
        const jaFamily = jaDef
          ? `'${ja}', ${fontFallbackStr(jaDef.category)}`
          : undefined;
        const enFamily = enDef
          ? `'${en}', ${fontFallbackStr(enDef.category)}`
          : undefined;
        return (
          <button
            key={name}
            onClick={() => {
              set("fontJa", ja);
              set("fontEn", en);
            }}
            title={desc}
            className={`text-left px-3 py-2.5 rounded-sm transition-colors ${active ? "admin-btn-primary" : "bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] border border-[var(--admin-line)]"}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-[length:var(--admin-text-note)] ${active ? "font-medium" : ""}`}>
                {name}
              </span>
              <span
                className="text-[length:var(--admin-text-note)] shrink-0"
              >
                {ja} × {en}
              </span>
            </div>
            <div className="mt-1.5 flex gap-3 items-baseline">
              {jaFamily && (
                <span
                  style={{
                    fontFamily: jaFamily,
                    fontSize: 14,
                    lineHeight: 1.3,
                  }}
                >
                  写真の記憶
                </span>
              )}
              {enFamily && (
                <span
                  style={{
                    fontFamily: enFamily,
                    fontSize: 14,
                    lineHeight: 1.3,
                    letterSpacing: "0.02em",
                  }}
                >
                  Photography
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function FontPicker({
  label,
  presets,
  valueKey,
  customNameKey,
  customUrlKey,
  customCategoryKey,
  current,
  set,
  fontMap,
}: {
  label: string;
  presets: string[];
  valueKey: string;
  customNameKey: string;
  customUrlKey: string;
  customCategoryKey: string;
  current: Record<string, string>;
  set: (key: string, val: string) => void;
  fontMap?: Record<string, FontDef>;
}) {
  const { t } = useAdminI18n();
  const copy = t.phase2b.settingsDesign.fontPicker;
  const value = current[valueKey] || "";
  const isCustom = value === "custom";
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(""); // A8: inline error, no alert()
  const def = value && value !== "custom" ? fontMap?.[value] : undefined;

  // Preload Google Font for preview when a preset is selected
  useEffect(() => {
    if (def) {
      const id = `preview-font-${valueKey}`;
      const url = `https://fonts.googleapis.com/css2?family=${def.param}&display=swap`;
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.getAttribute("href") !== url)
          existing.setAttribute("href", url);
        return;
      }
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = url;
      document.head.appendChild(link);
    }
  }, [def, valueKey]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after an error
    if (!file) return;
    // A8: validate before uploading — clearer than a server round-trip failure.
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["woff2", "woff", "ttf", "otf"].includes(ext)) {
      setUploadError(copy.formatError);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError(copy.sizeError);
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/fonts/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        // 保存先未設定は専用の案内文(不足変数名+再デプロイ)、それ以外は
        // サーバのerror文字列 → 汎用文言の順
        setUploadError(
          await uploadErrorMessageFromResponse(
            res,
            t.phase2b.library.import.failedReason,
          ),
        );
        return;
      }
      const data = await res.json();
      const name = file.name.replace(/\.[^.]+$/, "");
      set(customNameKey, name);
      set(customUrlKey, data.url);
    } catch {
      setUploadError(copy.networkError);
    } finally {
      setUploading(false);
    }
  };

  const selectCls =
    "ax-input ax-select";
  const inputCls =
    "ax-input";

  // Correct fallback for preview
  const previewFamily = def
    ? `'${value}', ${fontFallbackStr(def.category)}`
    : isCustom && current[customNameKey]
      ? `'${current[customNameKey]}', ${fontFallbackStr((current[customCategoryKey] || "sans-serif") as "serif" | "sans-serif")}`
      : undefined;

  return (
    <div>
      <label className="block text-[length:var(--admin-text-note)] text-[var(--admin-muted)] tracking-wider mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => {
          set(valueKey, e.target.value);
          if (e.target.value !== "custom") {
            set(customNameKey, "");
            set(customUrlKey, "");
          }
        }}
        className={selectCls}
      >
        <option value="">{copy.fontDefault}</option>
        {presets.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value="custom">{copy.fontCustom}</option>
      </select>

      {/* Preview */}
      {previewFamily && (
        <p
          className="mt-2 text-[length:var(--admin-text-body)] text-[var(--admin-ink)]"
          style={{ fontFamily: previewFamily }}
        >
          あいうえお ABCabc 123
        </p>
      )}

      {isCustom && (
        <div className="mt-2 flex flex-col gap-2">
          {uploadError && (
            <p role="alert" className="admin-text-danger text-[length:var(--admin-text-note)]">
              {uploadError}
            </p>
          )}
          <input
            aria-label={copy.nameAria}
            type="text"
            value={current[customNameKey] || ""}
            onChange={(e) => set(customNameKey, e.target.value)}
            placeholder="Font name"
            className={inputCls}
          />
          {/* A5: serif/sans-serif category selector for custom fonts */}
          <div className="flex gap-2">
            {(["sans-serif", "serif"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => set(customCategoryKey, cat)}
                className={`flex-1 text-[length:var(--admin-text-note)] py-1 rounded-sm transition-colors ${
                  (current[customCategoryKey] || "sans-serif") === cat
                    ? "admin-btn-primary"
                    : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {current[customUrlKey] ? (
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] truncate flex-1">
                {current[customUrlKey].split("/").pop()}
              </span>
              <label className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] hover:text-[var(--admin-ink)] cursor-pointer transition-colors">
                {copy.replace}
                <input
                  aria-label={copy.fileAria}
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <label
              className={`inline-flex items-center gap-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] hover:text-[var(--admin-ink)] cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Upload size={12} />
              {uploading ? copy.fontUploading : copy.fontUploadHint}
              <input
                aria-label={copy.fileAria}
                type="file"
                accept=".woff2,.woff,.ttf,.otf"
                onChange={handleUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function TypoControl({
  label,
  valueKey,
  current,
  set,
  min,
  max,
  step,
  isOpacity,
  unit,
  defaultVal,
}: {
  label: string;
  valueKey: string;
  current: Record<string, string>;
  set: (key: string, val: string) => void;
  min: number;
  max: number;
  step: number;
  isOpacity?: boolean;
  unit?: string;
  defaultVal?: string;
}) {
  const { t } = useAdminI18n();
  const raw = current[valueKey] ?? "";
  const parsed = parseFloat(raw);
  const value = isNaN(parsed)
    ? isOpacity
      ? 0.3
      : parseFloat(defaultVal ?? String(min))
    : parsed;
  // A9: direct numeric entry, two-way with the slider. While the field is
  // focused the user's keystrokes win (intermediate states like "0." parse as
  // NaN and just don't commit); blur returns to the canonical value.
  const [editing, setEditing] = useState<string | null>(null);
  const commit = (text: string) => {
    const n = parseFloat(text);
    if (!isNaN(n)) set(valueKey, String(Math.min(max, Math.max(min, n))));
  };

  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] w-32 min-w-0 truncate">
        {label}
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(valueKey, e.target.value)}
        className="flex-1 min-w-0 h-1 accent-[var(--admin-muted)] cursor-pointer"
      />
      <input
        aria-label={t.phase2b.settingsBasic.typoControl.numericInputAriaLabel(
          label,
        )}
        type="number"
        min={min}
        max={max}
        step={step}
        value={editing ?? String(value)}
        onFocus={() => setEditing(String(value))}
        onChange={(e) => {
          setEditing(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setEditing(null)}
        title={
          isOpacity
            ? t.phase2b.settingsBasic.typoControl.opacityTitle(
                Math.round(value * 100),
              )
            : unit
              ? t.phase2b.settingsBasic.typoControl.unitTitle(unit)
              : undefined
        }
        className="w-16 shrink-0 bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] rounded-sm text-[length:var(--admin-text-note)] text-[var(--admin-ink)] text-right px-1.5 py-0.5 tabular-nums outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {unit ? (
        <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] w-4 shrink-0">
          {unit}
        </span>
      ) : isOpacity ? (
        <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] w-4 shrink-0">
          α
        </span>
      ) : (
        <span className="w-4 shrink-0" />
      )}
    </div>
  );
}

// Shared modal built on the native <dialog>: gives focus-trap, Escape-to-close
// and an inert background for free, and clicking the backdrop (the dialog box
// itself, not its content) closes it — no overlay div with mouse handlers, so
// no a11y lint workarounds needed.
function Modal({
  onClose,
  children,
  widthClass = "w-72",
}: {
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // 工程2: scale+opacity entrance/exit — backdrop click and Escape animate out
  // (dur-fast/ease-in) before the parent actually unmounts us. Buttons inside
  // `children` that call onClose directly still close instantly; wiring every
  // such call site through this would mean touching every modal body, which
  // is out of scope for this pass.
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");
  const closingRef = useRef(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase("show"));
    return () => cancelAnimationFrame(id);
  }, []);
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (prefersReducedMotion()) {
      onCloseRef.current();
      return;
    }
    setPhase("exit");
    setTimeout(() => onCloseRef.current(), 160);
  }, []);
  // Wire Escape (native `cancel`) and backdrop click via the DOM rather than JSX
  // props: <dialog> is a non-interactive element, so JSX mouse/key handlers on it
  // trip jsx-a11y — addEventListener keeps the behaviour without the lint.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const onClick = (e: MouseEvent) => {
      if (e.target === d) requestClose();
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      requestClose();
    };
    d.addEventListener("click", onClick);
    d.addEventListener("cancel", onCancel);
    return () => {
      d.removeEventListener("click", onClick);
      d.removeEventListener("cancel", onCancel);
    };
  }, [requestClose]);
  return (
    <dialog
      ref={ref}
      data-phase={phase}
      className={`admin-glass p-6 ${widthClass} m-auto text-left`}
    >
      {children}
    </dialog>
  );
}

// 共通の入力項目。見た目は admin-ui.tsx の Field と同じ ax-field に寄せてある
// (画面ごとに違うラベル体裁が残らないよう、実体は1つの CSS に集約する)。
// `uppercase` は全大文字の英語ラベルを作る指定だったので受け取らない。
function AdminField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ax-field">
      <label className="ax-field__label">{label}</label>
      {hint && <p className="ax-field__hint">{hint}</p>}
      {children}
    </div>
  );
}

function ColorRow({
  label,
  valueKey,
  current,
  set,
  placeholder,
  hint,
}: {
  label: string;
  valueKey: string;
  current: Record<string, string>;
  set: (key: string, val: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const { t } = useAdminI18n();
  return (
    <AdminField label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={t.phase2b.settingsDesign.colorPickerAria(label)}
          value={current[valueKey] || "#ffffff"}
          onChange={(e) => set(valueKey, e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          type="text"
          aria-label={label}
          value={current[valueKey] || ""}
          onChange={(e) => set(valueKey, e.target.value)}
          placeholder={placeholder}
          className="ax-input flex-1"
        />
      </div>
    </AdminField>
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function FloatingSaveBar({
  show,
  pending,
  saved,
  error,
  onSave,
  onDiscard,
}: {
  show: boolean;
  pending: boolean;
  saved: boolean;
  error: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { t } = useAdminI18n();
  const visible = show || pending || saved || error;
  // Physical entrance/exit (工程2): mount lags on the falling edge so
  // translateY/opacity can transition out before the bar leaves the DOM —
  // same delayed-unmount idiom as Lightbox's closing state.
  const [mounted, setMounted] = useState(visible);
  const [phase, setPhase] = useState<"enter" | "show" | "pulse" | "exit">(
    "enter",
  );
  const prevVisibleRef = useRef(visible);
  const prevSavedRef = useRef(saved);

  useEffect(() => {
    if (visible && !mounted) {
      setMounted(true);
      setPhase("enter");
    }
  }, [visible, mounted]);

  useEffect(() => {
    if (mounted && phase === "enter") {
      const id = requestAnimationFrame(() => setPhase("show"));
      return () => cancelAnimationFrame(id);
    }
  }, [mounted, phase]);

  useEffect(() => {
    if (prevVisibleRef.current && !visible) {
      setPhase("exit");
      const t = setTimeout(
        () => setMounted(false),
        prefersReducedMotion() ? 0 : 160,
      );
      prevVisibleRef.current = visible;
      return () => clearTimeout(t);
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  // Save success: a brief spring pulse before settling back to "shown" — the
  // "喜び" beat the spec calls for. The bar then lingers with the "保存しま
  // した" message (via the `saved` prop) until the caller clears it, which
  // doubles as the hand-off the spec describes as "トーストへ引き継ぐ".
  useEffect(() => {
    if (saved && !prevSavedRef.current && phase === "show" && !pending) {
      if (!prefersReducedMotion()) {
        setPhase("pulse");
        const t = setTimeout(() => setPhase("show"), 200);
        prevSavedRef.current = saved;
        return () => clearTimeout(t);
      }
    }
    prevSavedRef.current = saved;
  }, [saved, phase, pending]);

  if (!mounted) return null;
  const message = error
    ? t.floatingSave.failed
    : saved && !show
      ? t.floatingSave.saved
      : t.floatingSave.unsaved;

  return (
    <output
      data-phase={phase}
      className="admin-floating-save-bar admin-glass"
      aria-live="polite"
    >
      <span className={error ? "admin-floating-save-bar__error" : ""}>
        {message}
      </span>
      {show && (
        <div className="admin-floating-save-bar__actions">
          <button type="button" onClick={onDiscard} disabled={pending}>
            <X size={13} />
            {t.common.discard}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="admin-floating-save-bar__primary"
          >
            {pending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} />
            )}
            {t.common.save}
          </button>
        </div>
      )}
    </output>
  );
}
