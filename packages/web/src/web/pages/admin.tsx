/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Library uses the approved ARIA listbox/option pattern with custom photo tiles. */
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  lazy,
  useLayoutEffect,
  useMemo,
  Suspense,
  type CSSProperties,
} from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, adminApi } from "../lib/api";
import {
  StorageAlertBanner,
  StorageHealthLine,
} from "../components/AdminStorageNotice";
import {
  normalizeRotationDeg,
  objectPositionFromFocal,
  orientedDimensions,
  rotateFocalPoint,
  rotateRotationDeg,
  srcFor,
} from "../lib/picture";
import {
  moveBeforeViewTarget,
  moveRelativeToViewNeighbor,
  moveToViewEdge,
  moveToViewPosition,
  reconstructManualPhotoOrder,
} from "../lib/reorder";
import { splitRecentlyAddedPhotos } from "../lib/recently-added-photos";
import { shouldLandOnSetup } from "../lib/setup-flow";
import {
  shotAtForDateInputSave,
  shotAtWithSourceForUploadedPhoto,
} from "../lib/upload-date";
import {
  imageFileTooLarge,
  isUploadableImageFile,
  shouldUploadImagesSerially,
  storageMissingFromErrorBody,
  UPLOAD_IMAGE_ACCEPT,
  uploadFailureNotice,
  uploadSizeLimitLabel,
  uploadTooLargeNotice,
} from "../lib/upload-file";
import {
  LogOut,
  Upload,
  Trash2,
  Check,
  X,
  Plus,
  Settings,
  User,
  Tag,
  Image as ImageLucide,
  ExternalLink,
  Loader2,
  Grid,
  Columns,
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  Star,
  StarOff,
  Layers,
  Pencil,
  Receipt,
  FolderOpen,
  Search,
  SlidersHorizontal,
  LayoutList,
  AlertTriangle,
  Copy,
  ClipboardPaste,
  Crosshair,
  RotateCcw,
  RotateCw,
  Monitor,
  Smartphone,
  GripVertical,
} from "lucide-react";
import {
  adminTabGroupsForService,
  buildPublicSiteHref,
  isAdminTab,
  postAdminSettings,
  reorderLockReason,
  type Tab,
} from "./admin-shared";
import { resolveServiceVisibility } from "../../shared/service-visibility";
import { hasUsableContactChannel } from "../../shared/contact-settings";
import {
  AdminDesktopLanguageBar,
  PageHeader,
  PageHeaderButton,
} from "./admin-page-header";
import { PageShell } from "./admin-page-shell";
import { AdminMobileTopBar, AdminMobileTabBar } from "./admin-mobile-nav";
import { AdminReorderBar } from "./admin-reorder-bar";
import { AdminCompactSidebar } from "./admin-compact-sidebar";
import {
  Button as AxButton,
  ListLoading,
  ListLoadFailed,
} from "./admin-ui";
import { shuffleWithSeed, visitShuffleSeed } from "../lib/shuffle";
import {
  AdminLanguageProvider,
  AdminLanguageToggle,
  getStoredAdminMessages,
  useAdminI18n,
} from "./admin-i18n";

const LazyHeroTab = lazy(() =>
  import("./admin-tabs").then((mod) => ({ default: mod.HeroTab })),
);
const LazyProfileTab = lazy(() =>
  import("./admin-tabs").then((mod) => ({ default: mod.ProfileTab })),
);
const LazyCategoriesTab = lazy(() =>
  import("./admin-tabs").then((mod) => ({ default: mod.CategoriesTab })),
);
const LazySeriesTab = lazy(() =>
  import("./admin-tabs").then((mod) => ({ default: mod.SeriesTab })),
);
const LazyPricingTab = lazy(() =>
  import("./admin-tabs").then((mod) => ({ default: mod.PricingTab })),
);
const LazyServiceTab = lazy(() =>
  import("./admin-tabs").then((mod) => ({ default: mod.ServiceTab })),
);
const LazySettingsTab = lazy(() =>
  import("./admin-tabs").then((mod) => ({ default: mod.SettingsTab })),
);

const ADMIN_TAB_ICONS: Record<Tab, React.ReactNode> = {
  setup: <Check size={15} />,
  gallery: <ImageLucide size={15} />,
  hero: <Grid size={15} />,
  profile: <User size={15} />,
  categories: <Tag size={15} />,
  series: <Layers size={15} />,
  pricing: <Receipt size={15} />,
  service: <ExternalLink size={15} />,
  settings: <Settings size={15} />,
};

type PaletteDestination = {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  action: () => void;
};

// V (ux-refinements): admin UI state that must survive tab switches and page
// moves. Tabs unmount on switch, so plain useState loses unsaved drafts and
// view preferences — sessionStorage keeps them for the browser session without
// leaking drafts across devices the way the settings DB would.
type PersistentStorageKind = "session" | "local";

function getStorage(kind: PersistentStorageKind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readStoredState<T>(
  key: string,
  storage: Storage | null,
): T | undefined {
  try {
    const raw = storage?.getItem(key);
    if (raw !== null && raw !== undefined) return JSON.parse(raw) as T;
  } catch {
    /* corrupt/unavailable storage falls back to the default */
  }
  return undefined;
}

export function usePersistentState<T>(
  key: string,
  initial: T,
  storageKind: PersistentStorageKind = "session",
) {
  const [val, setVal] = useState<T>(() => {
    const primary = readStoredState<T>(key, getStorage(storageKind));
    if (primary !== undefined) return primary;
    if (storageKind === "local") {
      const legacy = readStoredState<T>(key, getStorage("session"));
      if (legacy !== undefined) return legacy;
    }
    return initial;
  });
  useEffect(() => {
    try {
      getStorage(storageKind)?.setItem(key, JSON.stringify(val));
    } catch {
      /* quota/private mode: state stays in-memory */
    }
  }, [key, storageKind, val]);
  return [val, setVal] as const;
}

// Centralised response check for admin actions. A 401 means the session expired —
// bounce to login immediately rather than showing a generic "failed" message
// (and rather than letting an action silently no-op). Other non-2xx → throw so the
// caller's onError can surface it.
let redirectingToLogin = false;
export function assertOk(res: Response): void {
  if (res.status === 401) {
    if (!redirectingToLogin) {
      redirectingToLogin = true;
      window.location.assign("/admin/login");
    }
    throw new Error(getStoredAdminMessages().common.sessionExpired);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function jsonOrThrow<T>(
  res: Response & { json(): Promise<T> },
): Promise<T> {
  assertOk(res);
  return res.json();
}

async function responseErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.clone().json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim())
      return data.error.trim();
  } catch {
    // Fall back below when the server returns a non-JSON error.
  }
  return `HTTP ${res.status}`;
}

function useAdminGuard(demoMode = false) {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-me"],
    queryFn: async () =>
      jsonOrThrow<{ authenticated: boolean }>(await adminApi.me.$get()),
    retry: false,
    enabled: !demoMode,
  });
  // Redirect in an effect, not during render (render-phase navigation triggers
  // React warnings and can fire repeatedly).
  useEffect(() => {
    if (!demoMode && !isLoading && !data?.authenticated) navigate("/admin/login");
  }, [demoMode, isLoading, data?.authenticated, navigate]);
  return demoMode
    ? { isLoading: false, authenticated: true }
    : { isLoading, authenticated: data?.authenticated };
}

/* ══════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════ */
type Rgb = { r: number; g: number; b: number };

const ATELIER_FALLBACK = {
  paper: "#f7f7f7",
  ink: "#1a1a1a",
  muted: "#666666",
  accent: "#5b7fa0",
  accentFill: "#3f607e",
  danger: "#a33b2e",
  warning: "#8a5d18",
  success: "#3f7454",
  info: "#4f6f86",
};

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(value?: string): Rgb | null {
  const raw = value?.trim();
  if (!raw) return null;
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((v) => clampChannel(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbString({ r, g, b }: Rgb): string {
  return `${clampChannel(r)}, ${clampChannel(g)}, ${clampChannel(b)}`;
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const n = clampChannel(v) / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
}

function ensureContrast(foreground: Rgb, background: Rgb, min: number): Rgb {
  if (contrastRatio(foreground, background) >= min) return foreground;
  const target =
    relativeLuminance(background) > 0.5
      ? { r: 18, g: 17, b: 15 }
      : { r: 250, g: 248, b: 242 };
  let adjusted = foreground;
  for (let i = 1; i <= 24; i += 1) {
    adjusted = mix(foreground, target, i / 24);
    if (contrastRatio(adjusted, background) >= min) return adjusted;
  }
  return target;
}

export function adminThemeFromSettings(
  settings?: Record<string, string>,
): CSSProperties {
  const base =
    parseHexColor(settings?.themeBg) ?? parseHexColor(ATELIER_FALLBACK.paper)!;
  const ink = ensureContrast(
    parseHexColor(settings?.themeText) ?? parseHexColor(ATELIER_FALLBACK.ink)!,
    base,
    7,
  );
  const soft = mix(base, ink, 0.025);
  const deep = mix(base, ink, 0.055);
  const line = mix(base, ink, 0.11);
  const lineStrong = mix(base, ink, 0.18);
  // Checked against `deep` (the darkest paper tone actually used behind text,
  // e.g. the sidebar) rather than `base` — passing against the darkest paper
  // variant guarantees the same minimum against the lighter ones too.
  const muted = ensureContrast(mix(ink, base, 0.38), deep, 4.5);
  // Adminの差し色は公開サイトのaccentColorから独立させる。この刷新では
  // API/DB schemaを変えないため、承認済みの初期色を管理画面内だけで使う。
  const accent = parseHexColor(ATELIER_FALLBACK.accent)!;
  const accentFill = parseHexColor(ATELIER_FALLBACK.accentFill)!;
  const danger = ensureContrast(
    parseHexColor(ATELIER_FALLBACK.danger)!,
    base,
    4.5,
  );
  const warning = ensureContrast(
    parseHexColor(ATELIER_FALLBACK.warning)!,
    base,
    4.5,
  );
  const success = ensureContrast(
    parseHexColor(ATELIER_FALLBACK.success)!,
    base,
    4.5,
  );
  const info = ensureContrast(
    parseHexColor(ATELIER_FALLBACK.info)!,
    base,
    4.5,
  );

  return {
    "--admin-paper": toHex(base),
    "--admin-paper-rgb": rgbString(base),
    "--admin-paper-soft": toHex(soft),
    "--admin-paper-deep": toHex(deep),
    "--admin-ink": toHex(ink),
    "--admin-ink-rgb": rgbString(ink),
    "--admin-muted": toHex(muted),
    "--admin-muted-rgb": rgbString(muted),
    "--admin-line": toHex(line),
    "--admin-line-strong": toHex(lineStrong),
    "--admin-accent": toHex(accent),
    "--admin-accent-rgb": rgbString(accent),
    "--admin-accent-line": "2.5px",
    "--admin-accent-fill": toHex(accentFill),
    "--admin-danger": toHex(danger),
    "--admin-danger-rgb": rgbString(danger),
    "--admin-warning": toHex(warning),
    "--admin-warning-rgb": rgbString(warning),
    "--admin-success": toHex(success),
    "--admin-success-rgb": rgbString(success),
    "--admin-info": toHex(info),
    "--admin-info-rgb": rgbString(info),
  } as CSSProperties;
}

export default function AdminPage({
  demoMode = false,
  demoSeed,
}: {
  demoMode?: boolean;
  demoSeed?: string;
}) {
  return (
    <AdminLanguageProvider>
      <AdminPageContent demoMode={demoMode} demoSeed={demoSeed} />
    </AdminLanguageProvider>
  );
}

function AdminPageContent({
  demoMode = false,
  demoSeed,
}: {
  demoMode?: boolean;
  demoSeed?: string;
}) {
  const { isLoading, authenticated } = useAdminGuard(demoMode);
  const { language, t } = useAdminI18n();
  // 左ナビ「サイトを見る」と Settings プレビューの「別窓」で同じURLを使う。
  const publicSiteHref = buildPublicSiteHref(demoSeed);
  const adminRootRef = useRef<HTMLDivElement>(null);
  const demoBannerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { data: shellSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () =>
      jsonOrThrow<Record<string, string>>(await api.settings.$get()),
  });
  // デモは本番の管理画面と別のキーに保存する。同じキーだと、購入検討者が
  // デモで開いたタブがオーナーの本番管理画面の開始タブを書き換えてしまう
  // (同一オリジンなので localStorage を共有する)。
  const [tab, setTab] = usePersistentState<Tab>(
    demoMode ? "admin:tab:demo" : "admin:tab",
    "gallery",
    "local",
  );
  // setupCompleted !== "true" の間は、/admin を開くたびに初期タブを「はじめに」
  // にする(セッション中の自由なタブ移動は妨げないよう、マウントごとに一度だけ)。
  // 完了確定は SetupTab の「セットアップ完了」ボタンの明示操作のみ — 表示した
  // だけでは何も書き込まない(旧・自動バックフィルは削除。setup-flow.ts 参照)。
  const initialSetupRedirectDone = useRef(false);
  useEffect(() => {
    if (initialSetupRedirectDone.current) return;
    if (authenticated !== true || shellSettings === undefined) return;
    initialSetupRedirectDone.current = true;
    // 体験版はセットアップ導線ではなく3操作ガイド+Libraryが入口。
    // サンプル一式が入力済みのため「はじめに」に飛ばすと完了表示だけが残る。
    if (demoMode) return;
    if (shouldLandOnSetup(authenticated, shellSettings)) setTab("setup");
  }, [authenticated, shellSettings, setTab, demoMode]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryReordering, setGalleryReordering] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState(
    "admin:sidebarCollapsed",
    false,
    "local",
  );
  // 「今回追加」は選択とは別の一時状態。GalleryTab より上で持つことで、
  // カテゴリ等の別タブへ移動して戻ってもページ再読込までは目印を残す。
  const [recentlyAddedPhotoIds, setRecentlyAddedPhotoIds] = useState<
    Set<number>
  >(new Set());
  // Generic unsaved-draft flag reported by any tab with a draft form.
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [unsavedConfirm, setUnsavedConfirm] = useState<Tab | "logout" | null>(
    null,
  );
  // 工程5: ⌘K quick palette (navigation only) + a signal GalleryTab watches
  // to auto-open Trash, since that's a toggle inside the tab, not a Tab.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openTrashRequest, setOpenTrashRequest] = useState(0);
  const serviceVisibilityResolved = shellSettings !== undefined;
  // Vite dev also powers the local admin and smoke suite. Keep Service
  // reachable there even when legacy auto-detection sees an empty siteUrl on
  // localhost; production admin still follows the configured/host gate.
  const showService =
    import.meta.env.DEV ||
    resolveServiceVisibility(
      shellSettings?.servicePageMode,
      shellSettings?.siteUrl,
      typeof window === "undefined" ? "" : window.location.hostname,
    );
  const adminTabs = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(ADMIN_TAB_ICONS) as Tab[]).map((key) => [
          key,
          { label: t.navigation.tabs[key], icon: ADMIN_TAB_ICONS[key] },
        ]),
      ) as Record<Tab, { label: string; icon: React.ReactNode }>,
    [t],
  );
  const adminTabGroups = useMemo(
    () =>
      adminTabGroupsForService(showService).map((group) => ({
        ...group,
        label:
          group.key === "photos"
            ? t.navigation.groups.photos
            : group.key === "presentation"
              ? t.navigation.groups.presentation
              : group.key === "site"
                ? t.navigation.groups.site
                : group.label,
      })),
    [showService, t],
  );

  useEffect(() => {
    if (!isAdminTab(tab)) setTab("gallery");
  }, [tab, setTab]);

  useEffect(() => {
    if (serviceVisibilityResolved && !showService && tab === "service") {
      setTab("settings");
    }
  }, [serviceVisibilityResolved, setTab, showService, tab]);

  const logout = useMutation({
    mutationFn: async () => jsonOrThrow(await adminApi.logout.$post()),
    // Either way, send the user to the login screen — staying on a half-logged-out
    // admin is worse than an over-eager redirect.
    onSuccess: () => navigate("/admin/login"),
    onError: () => navigate("/admin/login"),
  });
  const adminThemeVars = useMemo(
    () => adminThemeFromSettings(shellSettings),
    [shellSettings],
  );

  useLayoutEffect(() => {
    if (!demoMode) return;
    const root = adminRootRef.current;
    const banner = demoBannerRef.current;
    if (!root || !banner) return;
    const updateOffset = () => {
      root.style.setProperty(
        "--admin-demo-banner-height",
        `${Math.ceil(banner.getBoundingClientRect().height)}px`,
      );
    };
    updateOffset();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateOffset);
    observer.observe(banner);
    return () => observer.disconnect();
  }, [demoMode, language]);

  // 工程3: sidebar active indicator slides between tabs (transform only) —
  // one shared bar instead of each tab fading its own in/out independently.
  const tabButtonRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({});
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = tabButtonRefs.current[tab];
    if (el) setIndicatorTop(el.offsetTop);
  }, [tab]);
  // The sidebar is `hidden md:flex` — its buttons have no layout box (and
  // offsetTop 0) below the lg breakpoint. Resizing back past it doesn't
  // change `tab`, so the effect above never re-fires and the indicator stays
  // wherever it last measured (usually the top). Re-measure on resize too.
  useEffect(() => {
    const onResize = () => {
      const el = tabButtonRefs.current[tab];
      if (el) setIndicatorTop(el.offsetTop);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [tab]);

  // 工程4: screen transition — the content area crossfades (old screen out,
  // then new screen in+up) instead of an instant swap. `tab` itself still
  // switches the sidebar highlight immediately; `contentTab` is what the
  // content area actually renders, lagging by the exit duration.
  // Mirrors the invalid-tab correction below so a bad persisted value
  // doesn't make the very first render take the animated exit/enter path
  // (there's nothing valid on screen yet to fade out).
  const [contentTab, setContentTab] = useState<Tab>(() =>
    isAdminTab(tab) ? tab : "gallery",
  );
  const [screenPhase, setScreenPhase] = useState<"enter" | "show" | "exit">(
    "show",
  );
  useEffect(() => {
    if (tab === contentTab) {
      // Recover from an interrupted transition: if the user switched away and
      // back before the exit timer below fired, that timer's cleanup cancels
      // it, but screenPhase is left stuck at "exit" (opacity:0) forever since
      // nothing else would ever set it back to "show".
      setScreenPhase((prev) => (prev === "exit" ? "show" : prev));
      return;
    }
    if (prefersReducedMotion()) {
      setContentTab(tab);
      setScreenPhase("show");
      return;
    }
    setScreenPhase("exit");
    const t = setTimeout(() => {
      setContentTab(tab);
      setScreenPhase("enter");
    }, 160);
    return () => clearTimeout(t);
  }, [tab, contentTab]);
  useEffect(() => {
    if (screenPhase === "enter") {
      const id = requestAnimationFrame(() => setScreenPhase("show"));
      return () => cancelAnimationFrame(id);
    }
  }, [screenPhase]);

  // 工程5: ⌘K / Ctrl+K toggles the quick palette from anywhere in admin.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (isLoading)
    return (
      <div className="min-h-screen bg-[var(--admin-paper)] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[var(--admin-muted)]" />
      </div>
    );
  if (!authenticated) return null;

  const sidebarSiteName =
    shellSettings?.siteNameEn?.trim() ||
    shellSettings?.siteName?.trim() ||
    "Photography";
  // Returns whether the switch actually happened (false when blocked by the
  // unsaved-changes guard) — callers that queue a follow-up action (like
  // opening Trash) must only do so once the switch has actually gone through.
  const requestTab = (nextTab: Tab): boolean => {
    if (nextTab === "service" && !showService) return false;
    if (galleryReordering && nextTab !== "gallery") return false;
    if (hasUnsaved && nextTab !== tab) {
      setUnsavedConfirm(nextTab);
      return false;
    }
    setTab(nextTab);
    return true;
  };
  const requestLogout = () => {
    if (hasUnsaved) {
      setUnsavedConfirm("logout");
      return;
    }
    logout.mutate();
  };

  // 工程5: ⌘K destinations — navigation only, no photo search / actions.
  const paletteDestinations: PaletteDestination[] = [
    ...adminTabGroups.flatMap((group) =>
      group.tabs.map((key) => ({
        id: key,
        label: adminTabs[key].label,
        group: group.label,
        icon: adminTabs[key].icon,
        action: () => requestTab(key),
      })),
    ),
    {
      id: "trash",
      label: t.navigation.trash,
      group: t.navigation.groups.photos,
      icon: <Trash2 size={15} />,
      action: () => {
        if (requestTab("gallery")) setOpenTrashRequest((n) => n + 1);
      },
    },
    {
      id: "open-site",
      label: t.navigation.openSite,
      group: t.navigation.groups.site,
      icon: <ExternalLink size={15} />,
      action: () => window.open("/", "_blank", "noopener"),
    },
  ];

  return (
    <div
      ref={adminRootRef}
      className="admin-atelier relative flex select-none overflow-hidden"
      style={{
        ...adminThemeVars,
        ...(demoMode
          ? { paddingTop: "var(--admin-demo-banner-height, 84px)" }
          : {}),
      }}
    >
      {demoMode && (
        <div
          ref={demoBannerRef}
          className="fixed inset-x-0 top-0 z-[100] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-[#f1e8cf] px-4 py-2 text-[length:var(--admin-text-body)] font-medium tracking-[0.04em] text-[#594b2c] shadow-sm"
          data-admin-demo-banner
        >
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-center">
            <span>{t.demo.banner}</span>
            <a
              href={
                language === "en"
                  ? "/portfolio-kit/en#pricing"
                  : "/portfolio-kit#pricing"
              }
              className="underline underline-offset-4"
            >
              {t.demo.purchase}
            </a>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="underline underline-offset-4"
            >
              {t.demo.reset}
            </button>
          </div>
          <AdminLanguageToggle className="text-[#594b2c]" />
        </div>
      )}
      <aside
        className="admin-sidebar admin-glass hidden md:flex"
        data-navigation-locked={galleryReordering || undefined}
        data-collapsed={sidebarCollapsed || undefined}
      >
        <div className="admin-sidebar__brand admin-sidebar__full">
          <div>
            <span className="admin-sidebar__eyebrow">{t.login.eyebrow}</span>
            <span className="admin-sidebar__title">{sidebarSiteName}</span>
          </div>
          <button
            type="button"
            data-sidebar-collapse
            onClick={() => setSidebarCollapsed(true)}
            aria-label={t.navigation.collapseSidebar}
            className="admin-sidebar__collapse"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        <nav
          className="admin-sidebar__nav admin-sidebar__full"
          aria-label={t.navigation.label}
        >
          {indicatorTop != null && (
            <div
              aria-hidden="true"
              className="admin-sidebar__indicator"
              style={{ transform: `translateY(${indicatorTop}px)` }}
            />
          )}
          {adminTabGroups.map((group) => (
            <section key={group.key} className="admin-sidebar__group">
              <h2 className="admin-sidebar__group-title">{group.label}</h2>
              <div className="admin-sidebar__tabs">
                {group.tabs.map((key) => {
                  const item = adminTabs[key];
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      ref={(el) => {
                        if (el) tabButtonRefs.current[key] = el;
                      }}
                      type="button"
                      disabled={
                        (galleryUploading && key !== "gallery") ||
                        (galleryReordering && key !== "gallery")
                      }
                      onClick={() => requestTab(key)}
                      aria-current={active ? "page" : undefined}
                      className="admin-sidebar__tab"
                      data-active={active || undefined}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="admin-sidebar__footer admin-sidebar__full">
          <a
            href={publicSiteHref}
            target="_blank"
            rel="noopener"
            className="admin-sidebar__link"
          >
            <ExternalLink size={13} /> {t.navigation.siteButton}
          </a>
          <button onClick={requestLogout} className="admin-sidebar__link">
            <LogOut size={13} /> {t.navigation.logoutButton}
          </button>
        </div>
        <AdminCompactSidebar
          groups={adminTabGroups}
          tabMeta={adminTabs}
          activeTab={tab}
          navigationLocked={galleryReordering}
          onRequestTab={requestTab}
          onExpand={() => setSidebarCollapsed(false)}
          onLogout={requestLogout}
          siteHref={publicSiteHref}
          labels={{
            navigation: t.navigation.label,
            expand: t.navigation.expandSidebar,
            openSite: t.navigation.openSite,
            logout: t.navigation.logout,
          }}
        />
      </aside>

      <div className="admin-main">
        {!galleryReordering && (
          <AdminMobileTopBar
            tab={tab}
            tabMeta={adminTabs}
            onLogout={requestLogout}
            showLanguageToggle={!demoMode}
          />
        )}
        {!demoMode && <AdminDesktopLanguageBar />}

        {/* Content */}
        <div className="admin-content">
          <div
            className="admin-screen"
            data-phase={screenPhase}
            data-stagger={contentTab === "gallery" ? undefined : "true"}
          >
            {contentTab === "setup" && (
              <SetupTab onOpenTab={requestTab} demoMode={demoMode} />
            )}
            {contentTab === "gallery" && (
              <GalleryTab
                demoSeed={demoSeed}
                onUploadingChange={setGalleryUploading}
                onUnsavedChange={setHasUnsaved}
                openTrashSignal={openTrashRequest}
                onTrashSignalConsumed={() => setOpenTrashRequest(0)}
                recentlyAddedPhotoIds={recentlyAddedPhotoIds}
                onRecentlyAddedPhotoIdsChange={setRecentlyAddedPhotoIds}
                onReorderWorkspaceChange={setGalleryReordering}
              />
            )}
            {contentTab !== "setup" && contentTab !== "gallery" && (
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center">
                    <Loader2
                      size={18}
                      className="animate-spin text-[var(--admin-muted)]"
                    />
                  </div>
                }
              >
                {contentTab === "hero" && <LazyHeroTab />}
                {contentTab === "profile" && (
                  <LazyProfileTab onUnsavedChange={setHasUnsaved} />
                )}
                {contentTab === "categories" && <LazyCategoriesTab />}
                {contentTab === "series" && <LazySeriesTab />}
                {contentTab === "pricing" && <LazyPricingTab />}
                {contentTab === "service" && showService && (
                  <LazyServiceTab onUnsavedChange={setHasUnsaved} />
                )}
                {contentTab === "settings" && (
                  <LazySettingsTab
                    onUnsavedChange={setHasUnsaved}
                    demoSeed={demoSeed}
                  />
                )}
              </Suspense>
            )}
          </div>
        </div>

        {!galleryReordering && (
          <AdminMobileTabBar
            tab={tab}
            tabMeta={adminTabs}
            tabGroups={adminTabGroups}
            galleryUploading={galleryUploading}
            onSelectTab={requestTab}
          />
        )}
      </div>

      {/* Unsaved settings confirmation */}
      {unsavedConfirm && (
        <Modal onClose={() => setUnsavedConfirm(null)} widthClass="w-80">
          <p className="text-[length:var(--admin-text-body)] text-[var(--admin-ink)] mb-1">
            {t.shell.unsavedTitle}
          </p>
          <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mb-5">
            {t.shell.unsavedBody}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setUnsavedConfirm(null)}
              className="px-4 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => {
                setHasUnsaved(false);
                if (unsavedConfirm === "logout") logout.mutate();
                else setTab(unsavedConfirm);
                setUnsavedConfirm(null);
              }}
              className="px-4 py-1.5 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm transition-colors"
            >
              {t.shell.leaveWithoutSaving}
            </button>
          </div>
        </Modal>
      )}

      {/* ⌘K quick palette (工程5) — navigation only */}
      <QuickPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        destinations={paletteDestinations}
      />
    </div>
  );
}

function isFilled(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

// A はじめに row either jumps to an admin tab (tab) or opens an external page
// (href, e.g. the live site for the final "公開を確認する" step).
type ChecklistItem = {
  title: string;
  body: string;
  done: boolean;
  tab?: Tab;
  href?: string;
  onOpen?: () => boolean;
  confirmation?: {
    label: string;
    onConfirm: () => void;
  };
  notice?: string;
};

// exportはrenderテスト用(表示だけでPOSTしない/完了ボタンでのみ保存する検証)
export function SetupTab({
  onOpenTab,
  demoMode = false,
}: {
  onOpenTab: (tab: Tab) => void;
  demoMode?: boolean;
}) {
  const qc = useQueryClient();
  const { t } = useAdminI18n();
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const photosQuery = useQuery({
    queryKey: ["photos", "all"],
    queryFn: async () =>
      jsonOrThrow(await api.photos.$get({ query: { all: "1" } })),
  });
  const { data: catsData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => jsonOrThrow(await api.categories.$get()),
  });
  const heroQuery = useQuery({
    queryKey: ["admin-hero-photos"],
    queryFn: async (): Promise<{ heroPhotos: HeroPhotoRow[] }> =>
      jsonOrThrow(await adminApi["hero-photos"].$get()),
  });
  // 写真の保存先(S3互換ストレージ)が接続済みか。環境変数の有無だけを見る
  // 読み取り専用APIで、写真を選ぶ前に未接続へ気づけるようにする。
  const { data: setupHealth } = useQuery({
    queryKey: ["admin-setup-health"],
    queryFn: async (): Promise<{
      storageConfigured: boolean;
      missingStorageVariables: string[];
    }> => jsonOrThrow(await adminApi["setup-health"].$get()),
  });

  const settings = (settingsQuery.data ?? {}) as Record<string, string>;
  const photos = (photosQuery.data?.photos ?? []) as Photo[];
  const activePhotos = photos.filter((p) => !p.deletedAt);
  const publishedPhotos = activePhotos.filter((p) => p.isPublished !== false);
  const categories = catsData?.categories ?? [];
  const heroPhotos = heroQuery.data?.heroPhotos ?? [];
  const publishedPhotoIds = new Set(publishedPhotos.map((photo) => photo.id));
  const hasPublishedHero = heroPhotos.some((hero) =>
    publishedPhotoIds.has(hero.photoId),
  );

  // The はじめに checklist is built for a fresh distribution install (empty DB):
  // it guides the owner top-to-bottom to a published site. On a fully configured
  // established site every item is already done, so it
  // collapses to a one-line bar; it can also be dismissed with 閉じる.
  const [dismissed, setDismissed] = usePersistentState<boolean>(
    "admin:setup-dismissed",
    false,
    "local",
  );
  const [forceOpen, setForceOpen] = useState(false);
  const [homePageConfirmed, setHomePageConfirmed] =
    usePersistentState<boolean>(
      "admin:setup-home-page-confirmed",
      false,
      "local",
    );
  const [homePageOpened, setHomePageOpened] = useState(false);
  const [homePageOpenFailed, setHomePageOpenFailed] = useState(false);
  const setupRestored = settings.setupCompleted === "true";
  const openHomePage = () => {
    const opened = window.open("/", "_blank");
    if (opened === null) {
      setHomePageOpened(false);
      setHomePageOpenFailed(true);
      return false;
    }
    opened.opener = null;
    setHomePageOpenFailed(false);
    setHomePageOpened(true);
    return true;
  };
  const confirmHomePage = () => {
    setHomePageConfirmed(true);
    setHomePageOpened(false);
  };

  // setupCompleted は settings に保存する(=デバイス・ブラウザをまたいで有効)。
  // これが true になるまで、初回ログイン時は毎回「はじめに」へ誘導される
  // (AdminPage 側のリダイレクト判定)。dismissed(ローカルのみ)とは別物 —
  // 閉じるだけでは完了扱いにしない。
  // postAdminSettings throws on any failure (including ignoredKeys). Without an
  // onError the throw is swallowed by the query client and the button simply
  // stops spinning — the buyer presses 完了 on their very first session and
  // nothing at all happens. Surface it (§0: 応答検証だけでは画面に出ない).
  const [finishError, setFinishError] = useState("");
  const finishSetup = useMutation({
    mutationFn: async () => {
      await postAdminSettings({ setupCompleted: "true" });
    },
    onError: () => setFinishError(t.setup.finishFailed),
    onSuccess: () => {
      setFinishError("");
      qc.setQueryData(
        ["settings"],
        (old: Record<string, string> | undefined) => ({
          ...old,
          setupCompleted: "true",
        }),
      );
      qc.invalidateQueries({ queryKey: ["settings"] });
      setDismissed(true);
      setForceOpen(false);
      onOpenTab("gallery");
    },
  });

  // A first-time buyer only needs one successful experience here: add a photo,
  // place it on the home page, then see it there. Identity and presentation
  // fields are useful, but must not stand between the buyer and that first win.
  const checklist: ChecklistItem[] = [
    {
      ...t.setup.checklist.firstPhoto,
      done: activePhotos.length > 0,
      tab: "gallery",
    },
    {
      ...t.setup.checklist.hero,
      done: hasPublishedHero,
      tab: "hero",
    },
    {
      ...t.setup.checklist.liveSite,
      done:
        hasPublishedHero && (demoMode || homePageConfirmed || setupRestored),
      href: "/",
      onOpen: openHomePage,
      confirmation:
        !demoMode &&
        hasPublishedHero &&
        homePageOpened &&
        !homePageConfirmed &&
        !setupRestored
          ? {
              label: t.setup.homePageConfirmAction,
              onConfirm: confirmHomePage,
            }
          : undefined,
      notice: homePageOpenFailed ? t.setup.homePageOpenFailed : undefined,
    },
  ];

  const recommended: ChecklistItem[] = [
    {
      ...t.setup.recommended.siteName,
      done: isFilled(settings.siteName) && isFilled(settings.siteDescription),
      tab: "settings",
    },
    {
      ...t.setup.recommended.profile,
      done: isFilled(settings.profileName) && isFilled(settings.profileBio),
      tab: "profile",
    },
    {
      ...t.setup.recommended.contact,
      done: hasUsableContactChannel(settings.contactEmail, settings.formspreeUrl),
      tab: "settings",
    },
    {
      ...t.setup.recommended.publicUrl,
      done: isFilled(settings.siteUrl),
      tab: "settings",
    },
    {
      ...t.setup.recommended.categories,
      done: categories.length > 0,
      tab: "categories",
    },
    {
      ...t.setup.recommended.appearance,
      done: isFilled(settings.galleryLayout),
      tab: "settings",
    },
  ];

  const doneCount = checklist.filter((item) => item.done).length;
  const requiredDone = doneCount === checklist.length;
  const nextItem = checklist.find((item) => !item.done);
  const loading =
    settingsQuery.isLoading || photosQuery.isLoading || heroQuery.isLoading;
  const loadFailed =
    settingsQuery.isError || photosQuery.isError || heroQuery.isError;
  const retrySetup = () => {
    void Promise.all([
      settingsQuery.refetch(),
      photosQuery.refetch(),
      heroQuery.refetch(),
    ]);
  };
  // Once everything is done (or the owner pressed 閉じる), shrink to a one-line bar
  // so a finished site's admin stays uncluttered. "もう一度見る" re-expands it.
  // 体験版はサンプル一式が入力済みで常に「完了」になるため、折りたたまず
  // 「購入後はこう進む」の見本として全文を見せる(SetupTab demoMode)。
  const collapsed =
    !demoMode &&
    !loading &&
    requiredDone &&
    (settings.setupCompleted === "true" || dismissed) &&
    !forceOpen;

  // 読込中は「未完了」マークだらけのチェックリストを一瞬見せない
  if (loading) {
    return (
      <PageShell>
        <PageHeader title={t.setup.title} />
        {/* 「…」だけを置くと、何かの本文が抜けたように見える。
            他タブと同じ静かな読み込み表示にそろえる。 */}
        <div className="flex items-center h-24">
          <Loader2
            size={18}
            className="animate-spin text-[var(--admin-muted)]"
          />
        </div>
      </PageShell>
    );
  }

  if (loadFailed) {
    return (
      <PageShell>
        <PageHeader title={t.setup.title} />
        <div className="admin-status-warning rounded-sm p-5 space-y-3">
          <h2 className="text-[length:var(--admin-text-body)]">
            {t.setup.loadError.title}
          </h2>
          <p className="text-[length:var(--admin-text-body)] leading-6">
            {t.setup.loadError.body}
          </p>
          <button
            type="button"
            onClick={retrySetup}
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

  if (collapsed) {
    return (
      <PageShell>
        <PageHeader title={t.setup.title} />
        <div className="space-y-3">
          <StorageHealthLine
            health={setupHealth}
            copy={t.setup.storageHealth}
          />
          <div className="admin-status-success flex items-center justify-between gap-3 rounded-sm px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="admin-icon-success w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                <Check size={13} />
              </div>
              <p className="text-[length:var(--admin-text-body)] truncate">
                {settings.setupCompleted === "true"
                  ? t.setup.collapsedCompleted
                  : requiredDone
                    ? t.setup.collapsedReady
                    : t.setup.collapsedDismissed}
              </p>
            </div>
            <button
              onClick={() => {
                setForceOpen(true);
                setDismissed(false);
              }}
              className="admin-text-success text-[length:var(--admin-text-note)] underline underline-offset-2 flex-shrink-0"
            >
              {t.setup.reopen}
            </button>
          </div>
          {!requiredDone && nextItem && (
            <p className="text-[length:var(--admin-text-body)] leading-6 text-[color:var(--admin-muted)] px-1">
              {t.setup.resumeSummary(doneCount, checklist.length, nextItem.title)}
            </p>
          )}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-8">
        {!demoMode && (
          <StorageHealthLine
            health={setupHealth}
            copy={t.setup.storageHealth}
          />
        )}
        {demoMode && (
          <div className="border border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] rounded-sm px-4 py-3 text-[length:var(--admin-text-body)] leading-6 text-[color:var(--admin-muted)]">
            {t.setup.demoIntro}
          </div>
        )}
        <PageHeader
          title={t.setup.title}
          description={t.setup.description}
          actions={
            <>
              <div
                className={`w-fit rounded-sm border px-3 py-2 text-[length:var(--admin-text-body)] ${requiredDone ? "admin-status-success" : "border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] text-[color:var(--admin-muted)]"}`}
              >
                {loading
                  ? t.setup.checking
                  : t.setup.progress(doneCount, checklist.length)}
              </div>
              {!demoMode && (
                <>
                  <button
                    onClick={() => {
                      if (!requiredDone) {
                        if (nextItem?.confirmation) {
                          nextItem.confirmation.onConfirm();
                        } else if (nextItem?.tab) onOpenTab(nextItem.tab);
                        else if (nextItem?.href) {
                          // 見出しの「次へ」からもトップページを開けるようにする。
                          // 開いた後は nextItem.confirmation の分岐で、同じ窓を
                          // 繰り返し開かず、表示確認へ進む。
                          nextItem.onOpen?.();
                        }
                        return;
                      }
                      setFinishError("");
                      finishSetup.mutate();
                    }}
                    disabled={finishSetup.isPending}
                    className="px-3 py-1.5 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {finishSetup.isPending
                      ? t.common.saving
                      : requiredDone
                        ? t.setup.finish
                        : nextItem?.confirmation?.label ??
                          t.setup.nextAction(nextItem?.title ?? "")}
                  </button>
                  <button
                    onClick={() => {
                      setDismissed(true);
                      setForceOpen(false);
                    }}
                    className="text-[length:var(--admin-text-note)] text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] transition-colors flex-shrink-0"
                  >
                    {t.setup.later}
                  </button>
                </>
              )}
            </>
          }
        />

        {finishError && (
          <p
            role="alert"
            className="text-[length:var(--admin-text-note)] text-[color:var(--admin-danger)]"
          >
            {finishError}
          </p>
        )}

        {!requiredDone && nextItem && (
          <div className="border border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] rounded-sm px-4 py-3">
            <p className="text-[length:var(--admin-text-body)] leading-6 text-[color:var(--admin-ink)]">
              {t.setup.resumeSummary(doneCount, checklist.length, nextItem.title)}
            </p>
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-2">
          {checklist.map((item) => (
            <SetupChecklistRow
              key={item.title}
              item={item}
              onOpenTab={onOpenTab}
            />
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-[length:var(--admin-text-body)] uppercase tracking-[0.14em] text-[var(--admin-muted)]">
            {t.setup.recommendedTitle}
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {recommended.map((item) => (
              <SetupChecklistRow
                key={item.title}
                item={item}
                onOpenTab={onOpenTab}
                compact
              />
            ))}
          </div>
        </section>

      </div>
    </PageShell>
  );
}

function SetupChecklistRow({
  item,
  onOpenTab,
  compact = false,
}: {
  item: ChecklistItem;
  onOpenTab: (tab: Tab) => void;
  compact?: boolean;
}) {
  const { t } = useAdminI18n();
  return (
    <div className="border border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] rounded-sm p-4 flex gap-3">
      <div
        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? "admin-icon-success" : "bg-[color:var(--admin-paper-deep)] text-[color:var(--admin-muted)]"}`}
      >
        {item.done ? <Check size={13} /> : <AlertTriangle size={12} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[length:var(--admin-text-body)] text-[color:var(--admin-ink)]">
            {item.title}
          </h3>
          {item.href ? (
            <button
              type="button"
              onClick={item.onOpen}
              className="text-[length:var(--admin-text-note)] text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] transition-colors flex-shrink-0"
            >
              {t.common.open}
            </button>
          ) : (
            <button
              onClick={() => item.tab && onOpenTab(item.tab)}
              className="text-[length:var(--admin-text-note)] text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] transition-colors flex-shrink-0"
            >
              {t.common.open}
            </button>
          )}
        </div>
        <p
          className={`${compact ? "text-[length:var(--admin-text-note)] leading-5" : "text-[length:var(--admin-text-body)] leading-6"} text-[color:var(--admin-muted)] mt-1`}
        >
          {item.body}
        </p>
        {item.notice && (
          <p
            role="alert"
            className="mt-3 text-[length:var(--admin-text-note)] leading-5 text-[color:var(--admin-danger)]"
          >
            {item.notice}
          </p>
        )}
        {item.confirmation && (
          <AxButton
            onClick={item.confirmation.onConfirm}
            tone="quiet"
            size="small"
            className="mt-3 max-w-full"
          >
            {item.confirmation.label}
          </AxButton>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   GALLERY TAB — Lightroom / Bridge style
══════════════════════════════════════════════════ */
// Built-in camera/lens suggestions, always offered. User-saved values are merged
// on top of these (and only the genuinely new ones get persisted).
export const DEFAULT_CAMERA_PRESETS = [
  "PENTAX 67",
  "Leica M6",
  "Bronica S2",
  "Sony α1",
  "PENTAX 67II",
];
export const DEFAULT_LENS_PRESETS = [
  "SMC Takumar 105mm f/2.4",
  "SMC Takumar 55mm f/1.8",
  "Nokton 50mm f/1.5",
  "FE 35mm f/1.8",
];

// Parse a settings JSON-array string into a clean string[].
export function parsePresetList(raw?: string): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
// Effective preset list: once the admin has saved any presets, that list is
// authoritative (so deleting a built-in default sticks); empty falls back to the
// built-in defaults.
export function effectivePresets(
  saved: string[],
  defaults: string[],
): string[] {
  return saved.length > 0 ? saved : defaults;
}

type CaptureInfoDraft = { camera: string; lens: string };
type CaptureClipboardStatus = "idle" | "copied" | "pasted" | "error";

function formatCaptureInfo({ camera, lens }: CaptureInfoDraft): string {
  const rows = [];
  if (camera.trim()) rows.push(`Camera: ${camera.trim()}`);
  if (lens.trim()) rows.push(`Lens: ${lens.trim()}`);
  return rows.join("\n");
}

function parseCaptureInfo(raw: string): CaptureInfoDraft | null {
  const text = raw.trim();
  if (!text) return null;

  const labeled: CaptureInfoDraft = { camera: "", lens: "" };
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(camera|カメラ|body|lens|レンズ)\s*[:：]\s*(.+)\s*$/i,
    );
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (key === "camera" || key === "カメラ" || key === "body")
      labeled.camera = match[2].trim();
    if (key === "lens" || key === "レンズ") labeled.lens = match[2].trim();
  }
  if (labeled.camera || labeled.lens) return labeled;

  const tabParts = text
    .split("\t")
    .map((v) => v.trim())
    .filter(Boolean);
  if (tabParts.length >= 2) return { camera: tabParts[0], lens: tabParts[1] };

  const lines = text
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (lines.length >= 2) return { camera: lines[0], lens: lines[1] };

  return { camera: text, lens: "" };
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("copy failed");
  } finally {
    textarea.remove();
  }
}

async function readClipboardText() {
  if (!navigator.clipboard?.readText)
    throw new Error("clipboard read unsupported");
  return navigator.clipboard.readText();
}

export type Photo = {
  id: number;
  url: string;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  title: string;
  meta: string;
  camera?: string | null;
  lens?: string | null;
  filmType?: string | null;
  shotAt?: string | null;
  description: string;
  category: string;
  filename: string;
  displaySize?: string;
  isPublished?: boolean;
  seriesId?: number | null;
  width?: number | null;
  height?: number | null;
  rotationDeg?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  fileHash?: string | null;
  deletedAt?: number | null;
  createdAt?: string | number | null;
};

type BatchPhotoOperation =
  | "publish"
  | "unpublish"
  | "series"
  | "size"
  | "shotAt_missing_only"
  | "shotAt_clear"
  | "feature"
  | "unfeature"
  | "rotate_left"
  | "rotate_right"
  | "reset_rotation"
  | "reset_focal_point";

type PhotoEditForm = {
  title: string;
  camera: string;
  lens: string;
  filmType: string;
  shotAt: string;
  description: string;
  category: string;
  displaySize: string;
  seriesId: string;
  isPublished: boolean;
  rotationDeg: number;
  focalX: number;
  focalY: number;
};

const EMPTY_PHOTO_EDIT_FORM: PhotoEditForm = {
  title: "",
  camera: "",
  lens: "",
  filmType: "",
  shotAt: "",
  description: "",
  category: "",
  displaySize: "M",
  seriesId: "",
  isPublished: true,
  rotationDeg: 0,
  focalX: 50,
  focalY: 50,
};

function photoToEditForm(photo: Photo): PhotoEditForm {
  return {
    title: photo.title,
    camera: photo.camera || "",
    lens: photo.lens || "",
    filmType: photo.filmType || "",
    shotAt: (photo.shotAt || "").slice(0, 10),
    description: photo.description || "",
    category: photo.category,
    displaySize: photo.displaySize || "M",
    seriesId: photo.seriesId ? String(photo.seriesId) : "",
    isPublished: photo.isPublished !== false,
    rotationDeg: normalizeRotationDeg(photo.rotationDeg),
    focalX: photo.focalX ?? 50,
    focalY: photo.focalY ?? 50,
  };
}

function photoEditFormChanged(form: PhotoEditForm, photo: Photo): boolean {
  const saved = photoToEditForm(photo);
  return (Object.keys(saved) as (keyof PhotoEditForm)[]).some(
    (key) => form[key] !== saved[key],
  );
}

const ROTATION_OPTIONS = [0, 90, 180, 270] as const;
const FOCAL_PRESETS = [
  { x: 0, y: 0, key: "topLeft" },
  { x: 50, y: 0, key: "top" },
  { x: 100, y: 0, key: "topRight" },
  { x: 0, y: 50, key: "left" },
  { x: 50, y: 50, key: "center" },
  { x: 100, y: 50, key: "right" },
  { x: 0, y: 100, key: "bottomLeft" },
  { x: 50, y: 100, key: "bottom" },
  { x: 100, y: 100, key: "bottomRight" },
] as const;

function rotatedBy(
  current: number | null | undefined,
  delta: -90 | 90,
): (typeof ROTATION_OPTIONS)[number] {
  return rotateRotationDeg(current, delta);
}

export function adminPhotoSrc(
  photo: {
    url: string;
    thumbUrl?: string | null;
    mediumUrl?: string | null;
    rotationDeg?: number | null;
  },
  w: number,
  q: number,
): string {
  if (w <= 640 && photo.thumbUrl) return photo.thumbUrl;
  if (w <= 1920 && photo.mediumUrl) return photo.mediumUrl;
  return srcFor(photo.url, w, q, undefined, photo.rotationDeg);
}

export function adminPhotoObjectPosition(photo: {
  focalX?: number | null;
  focalY?: number | null;
}): string {
  return objectPositionFromFocal(photo.focalX, photo.focalY);
}

// adminApi is loosely typed (see lib/api.ts) — these annotate its query results.
export type AdminSeries = {
  id: number;
  slug: string;
  title: string;
  subtitle?: string;
  statement?: string;
  coverPhotoId?: number | null;
  sortOrder?: number;
  isPublished?: boolean;
};
export type HeroPhotoRow = { id: number; photoId: number; sortOrder: number };

// O6: smart album — a named, saved set of photo conditions (a virtual folder).
// Every field is optional; only the set ones constrain the match (AND).
type AlbumCond = {
  camera?: string;
  filmType?: string;
  medium?: string;
  missingShotAt?: boolean;
  missingCapture?: boolean;
  category?: string;
  series?: string;
  size?: string;
  featured?: boolean;
  published?: string;
  recent?: string;
};
type SmartAlbum = { id: string; name: string; cond: AlbumCond };
const EMPTY_ALBUM_DRAFT = {
  name: "",
  camera: "",
  filmType: "",
  medium: "all",
  missingShotAt: false,
  missingCapture: false,
  category: "all",
  series: "all",
  size: "all",
  featured: false,
  published: "all",
  recent: "all",
};
const LIBRARY_GRID_GAP = 8;
// Keep more than one extra screen of rows mounted so fast trackpad scrolling
// does not repeatedly tear down the next thumbnail rows at the viewport edge.
const LIBRARY_GRID_OVERSCAN_ROWS = 8;
// Fetch one more overscan-sized band without mounting extra tiles. The browser
// cache can then supply thumbnails when a fast trackpad gesture jumps beyond
// the currently mounted rows, without giving up DOM virtualization.
const LIBRARY_GRID_PRELOAD_ROWS = LIBRARY_GRID_OVERSCAN_ROWS;
// Large purges get an extra wrinkle (ack checkbox + countdown) — a fat-finger
// "Purge All" on a big trash shouldn't be one accidental click away.
const PURGE_EXTRA_STEP_THRESHOLD = 10;
const PURGE_EXTRA_STEP_SECONDS = 3;

type VirtualGridWindow = {
  startIndex: number;
  endIndex: number;
  columns: number;
  rowHeight: number;
  topPadding: number;
  bottomPadding: number;
  renderedCount: number;
  isVirtualized: boolean;
};

export function computeVirtualGridWindow({
  itemCount,
  scrollTop,
  viewportHeight,
  gridWidth,
  minItemSize,
  gap = LIBRARY_GRID_GAP,
  overscanRows = LIBRARY_GRID_OVERSCAN_ROWS,
}: {
  itemCount: number;
  scrollTop: number;
  viewportHeight: number;
  gridWidth: number;
  minItemSize: number;
  gap?: number;
  overscanRows?: number;
}): VirtualGridWindow {
  if (itemCount <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      columns: 1,
      rowHeight: minItemSize + gap,
      topPadding: 0,
      bottomPadding: 0,
      renderedCount: 0,
      isVirtualized: false,
    };
  }
  if (viewportHeight <= 0 || gridWidth <= 0) {
    return {
      startIndex: 0,
      endIndex: itemCount,
      columns: 1,
      rowHeight: minItemSize + gap,
      topPadding: 0,
      bottomPadding: 0,
      renderedCount: itemCount,
      isVirtualized: false,
    };
  }

  const columns = Math.max(
    1,
    Math.floor((gridWidth + gap) / (minItemSize + gap)),
  );
  const itemSize = (gridWidth - gap * (columns - 1)) / columns;
  const rowHeight = Math.max(1, itemSize + gap);
  const totalRows = Math.ceil(itemCount / columns);
  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / rowHeight));
  const lastVisibleRow = Math.min(
    totalRows,
    Math.ceil((scrollTop + viewportHeight) / rowHeight),
  );
  const startRow = Math.max(0, firstVisibleRow - overscanRows);
  const endRow = Math.min(totalRows, lastVisibleRow + overscanRows);
  const startIndex = Math.min(itemCount, startRow * columns);
  const endIndex = Math.min(itemCount, endRow * columns);

  return {
    startIndex,
    endIndex,
    columns,
    rowHeight,
    topPadding: startRow * rowHeight,
    bottomPadding: Math.max(0, (totalRows - endRow) * rowHeight),
    renderedCount: Math.max(0, endIndex - startIndex),
    isVirtualized: endIndex - startIndex < itemCount,
  };
}

// 2列未満に落ちる実効幅では、移動ボタン最大4個(≈108px)+バッジが
// タイルからはみ出すため、これ未満へは縮めず従来の1列表示を維持する。
export const LIBRARY_MIN_EFFECTIVE_THUMB = 120;
export const LIBRARY_MIN_DENSE_THUMB = 96;

// スマホの Library は thumbSize(初期220・sliderは hidden md:flex で変更不能)
// のまま minmax に入ると 375/390px 幅で1列になり、写真が1枚ずつしか見えない。
// 実測 grid 幅で2列を割る時だけ「2列に収まる幅」へ縮める。通常の thumbSize
// (PCの slider / 保存値)には触れないので、PC 表示は不変。
// grid / 仮想化 / キーボード列数 / スクロール計算は全てこの戻り値を参照する
// こと — どれかが生の thumbSize を見ると列数の解釈がずれて矢印移動や
// 仮想ウィンドウが壊れる。
export function effectiveLibraryThumbSize({
  thumbSize,
  gridWidth,
  preferredColumns,
  gap = LIBRARY_GRID_GAP,
}: {
  thumbSize: number;
  gridWidth: number;
  preferredColumns?: 2 | 3;
  gap?: number;
}): number {
  // 未計測(マウント直後・jsdom)は従来どおり
  if (gridWidth <= 0) return thumbSize;
  if (preferredColumns) {
    const preferredSize = Math.floor(
      (gridWidth - gap * (preferredColumns - 1)) / preferredColumns,
    );
    if (preferredSize >= LIBRARY_MIN_DENSE_THUMB) return preferredSize;
  }
  const columns = Math.floor((gridWidth + gap) / (thumbSize + gap));
  if (columns >= 2) return thumbSize;
  const twoColumnSize = Math.floor((gridWidth - gap) / 2);
  if (twoColumnSize < LIBRARY_MIN_EFFECTIVE_THUMB) return thumbSize;
  // columns < 2 ⇔ gridWidth < 2*thumbSize + gap なので必ず縮む方向
  // (ユーザーが PC で小さくした値を巨大化させることはない)
  return twoColumnSize;
}

function measuredContentWidth(el: HTMLElement | null): number {
  if (!el) return 0;
  const width = el.clientWidth;
  if (typeof window === "undefined") return width;
  const style = window.getComputedStyle(el);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  return Math.max(0, width - paddingLeft - paddingRight);
}

// render テスト(admin-reorder-lock.render.test.tsx)から直接マウントするため
// SetupTab と同様に export する。アプリ内の利用は AdminPage 経由のみ。
type LibraryMode = "normal" | "select" | "arrange";
type PhotoReorderOperation = {
  ids: number[];
  expectedIds: number[];
  beforeIds: number[];
  afterIds: number[];
  operation: "save" | "undo";
  move?: { id: number; from: number; to: number };
  afterConfirmed?: () => void;
};
const EMPTY_RECENTLY_ADDED_PHOTO_IDS: ReadonlySet<number> = new Set();
const ignoreRecentlyAddedPhotoIdsChange = () => {};

export function GalleryTab({
  demoSeed,
  onUploadingChange,
  onUnsavedChange,
  openTrashSignal,
  onTrashSignalConsumed,
  recentlyAddedPhotoIds = EMPTY_RECENTLY_ADDED_PHOTO_IDS,
  onRecentlyAddedPhotoIdsChange = ignoreRecentlyAddedPhotoIdsChange,
  onReorderWorkspaceChange,
}: {
  demoSeed?: string;
  onUploadingChange?: (v: boolean) => void;
  onUnsavedChange?: (v: boolean) => void;
  // 工程5: bumped by the ⌘K palette's "Trash" destination — Trash is a
  // toggle inside this tab, not a Tab of its own, so it needs a signal
  // rather than a route.
  openTrashSignal?: number;
  // Parent resets openTrashSignal back to 0 once consumed — otherwise a
  // leftover nonzero value would re-open Trash on every later, unrelated
  // mount of this tab (GalleryTab fully unmounts on tab switch, so its own
  // local state can't remember "already handled this one").
  onTrashSignalConsumed?: () => void;
  recentlyAddedPhotoIds?: ReadonlySet<number>;
  onRecentlyAddedPhotoIdsChange?: (ids: Set<number>) => void;
  onReorderWorkspaceChange?: (active: boolean) => void;
}) {
  const qc = useQueryClient();
  const { language, t } = useAdminI18n();
  const copy = t.phase2b.library;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);
  const onUploadingChangeRef = useRef(onUploadingChange);
  onUploadingChangeRef.current = onUploadingChange;
  const uploadGenerationRef = useRef(0);
  const activeUploadProgressRef = useRef(
    new Map<number, { done: number; total: number }>(),
  );
  const syncUploadProgress = () => {
    const activeUploads = Array.from(
      activeUploadProgressRef.current.values(),
    );
    const active = activeUploads.length > 0;
    if (uploadingRef.current !== active) {
      uploadingRef.current = active;
      setUploading(active);
      onUploadingChangeRef.current?.(active);
    }
    setUploadProgress(
      active
        ? {
            done: activeUploads.reduce((sum, item) => sum + item.done, 0),
            total: activeUploads.reduce((sum, item) => sum + item.total, 0),
          }
        : null,
    );
  };
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("normal");
  const [lastClicked, setLastClicked] = useState<number | null>(null);
  const [reorderTargetId, setReorderTargetId] = useState<number | null>(null);
  const [reorderPositionValue, setReorderPositionValue] = useState("");
  const [lastMove, setLastMove] = useState<{
    id: number;
    from: number;
    to: number;
  } | null>(null);
  const [reorderFailedTargetId, setReorderFailedTargetId] = useState<
    number | null
  >(null);
  const [pendingLibraryMode, setPendingLibraryMode] =
    useState<LibraryMode | null>(null);
  const [reorderExitTimedOut, setReorderExitTimedOut] = useState(false);
  const [reorderNeedsReload, setReorderNeedsReload] = useState(false);
  const onReorderWorkspaceChangeRef = useRef(onReorderWorkspaceChange);
  onReorderWorkspaceChangeRef.current = onReorderWorkspaceChange;
  useEffect(() => {
    onReorderWorkspaceChangeRef.current?.(libraryMode === "arrange");
  }, [libraryMode]);
  useEffect(
    () => () => {
      onReorderWorkspaceChangeRef.current?.(false);
    },
    [],
  );
  const [thumbSize, setThumbSize] = usePersistentState("admin:thumbSize", 220); // px
  const [mobileLibraryColumns, setMobileLibraryColumns] = usePersistentState<
    2 | 3
  >("admin:mobileLibraryColumns", 2);
  const [filterCat, setFilterCat] = usePersistentState(
    "admin:filterCat",
    "all",
  );
  const [searchQuery, setSearchQuery] = usePersistentState(
    "admin:searchQuery",
    "",
  ); // B2: free-text search (title/filename/camera/lens/film/description)
  // U1: 表示用ソート。"manual" 以外はライブラリの見た目だけ並び替える（sortOrder
  // は不変）。「この並びを保存」で sortOrder へ書き込める。タブ切替で保持(V)。
  const [librarySort, setLibrarySort] = usePersistentState(
    "admin:librarySort",
    "manual",
  );
  const [filterSeries, setFilterSeries] = usePersistentState(
    "admin:filterSeries",
    "all",
  ); // "all" | "__none__" | series id
  const [filterSize, setFilterSize] = usePersistentState(
    "admin:filterSize",
    "all",
  ); // "all" | S | M | L
  const [filterMedium, setFilterMedium] = usePersistentState(
    "admin:filterMedium",
    "all",
  );
  const [filterOrientation, setFilterOrientation] = usePersistentState(
    "admin:filterOrientation",
    "all",
  );
  const [filterFeatured, setFilterFeatured] = usePersistentState(
    "admin:filterFeatured",
    false,
  ); // M3: only hero-featured
  const [filterPublished, setFilterPublished] = usePersistentState(
    "admin:filterPublished",
    "all",
  );
  const [filterRecent, setFilterRecent] = usePersistentState(
    "admin:filterRecent",
    "all",
  ); // O4: "all" | "7" | "30" days
  const [filterMissingShotAt, setFilterMissingShotAt] = usePersistentState(
    "admin:filterMissingShotAt",
    false,
  );
  const [filterMissingCapture, setFilterMissingCapture] = usePersistentState(
    "admin:filterMissingCapture",
    false,
  );
  const [activeAlbumId, setActiveAlbumId] = usePersistentState<string | null>(
    "admin:activeAlbumId",
    null,
  ); // O6: applied smart album
  const [albumModalOpen, setAlbumModalOpen] = useState(false); // O6: create-album modal
  const [albumDraft, setAlbumDraft] = useState({ ...EMPTY_ALBUM_DRAFT });
  const [dragOver, setDragOver] = useState(false);
  const [inspectPhoto, setInspectPhoto] = useState<Photo | null>(null);
  const [editForm, setEditForm] = useState<PhotoEditForm>(
    EMPTY_PHOTO_EDIT_FORM,
  );
  // 非同期の取り込み完了時にも、その瞬間に開いている詳細欄と下書きを見る。
  // handleFiles が開始時の render を保持していても、この ref は常に最新になる。
  const inspectPhotoRef = useRef(inspectPhoto);
  const editFormRef = useRef(editForm);
  inspectPhotoRef.current = inspectPhoto;
  editFormRef.current = editForm;
  const [dragSrcId, setDragSrcId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [optimisticOrderIds, setOptimisticOrderIds] = useState<
    number[] | null
  >(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const reorderBusyRef = useRef(false);
  const [reorderFeedback, setReorderFeedback] = useState<{
    state: "saving" | "saved" | "error";
    operation: "save" | "undo";
    message: string;
  } | null>(null);
  const [reorderFailedOperation, setReorderFailedOperation] =
    useState<PhotoReorderOperation | null>(null);
  const [reorderUndo, setReorderUndo] = useState<{
    beforeIds: number[];
    afterIds: number[];
  } | null>(null);
  const [batchCatOpen, setBatchCatOpen] = useState(false);
  const [batchSeriesOpen, setBatchSeriesOpen] = useState(false);
  const [batchToast, setBatchToast] = useState<string | null>(null);
  const [batchEditOpen, setBatchEditOpen] = useState(false); // O2: bulk metadata panel
  const [batchShotAtDate, setBatchShotAtDate] = useState("");
  const [batchEdit, setBatchEdit] = useState({
    camera: "",
    lens: "",
    filmType: "",
  });
  // Non-destructive confirmations (replaces window.confirm) — Enter activates
  // the primary button via data-autofocus; Esc cancels (native dialog).
  // 確認ダイアログには世代番号を持たせる。閉じる側は「自分が閉じようとしている
  // ダイアログが、今表示中のものと同一か」を確かめてから state を消す。
  // 無条件に null を書くと、古い経路の後始末が新しいダイアログを閉じてしまう。
  const [confirmDialog, setConfirmDialog] = useState<{
    id: number;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const confirmDialogSeq = useRef(0);
  const openConfirmDialog = (next: {
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }) => {
    confirmDialogSeq.current += 1;
    setConfirmDialog({ ...next, id: confirmDialogSeq.current });
  };
  // id が一致するときだけ閉じる。一致しなければ「既に別のダイアログへ
  // 入れ替わっている」ので何もしない。
  const closeConfirmDialog = (id: number) => {
    setConfirmDialog((current) => (current && current.id === id ? null : current));
  };
  const [showTrash, setShowTrash] = useState(false);
  // Ref so a fresh onTrashSignalConsumed identity on every AdminPage render
  // doesn't need to be (and shouldn't be) a dependency below.
  const onTrashSignalConsumedRef = useRef(onTrashSignalConsumed);
  useEffect(() => {
    onTrashSignalConsumedRef.current = onTrashSignalConsumed;
  }, [onTrashSignalConsumed]);
  useEffect(() => {
    if (openTrashSignal) {
      setShowTrash(true);
      setLibraryMode("normal");
      setSelected(new Set());
      setInspectPhoto(null);
      onTrashSignalConsumedRef.current?.();
    }
  }, [openTrashSignal]);
  const [undoToast, setUndoToast] = useState<{
    ids: number[];
    count: number;
  } | null>(null);
  // Bulk trash/restore/purge run one item at a time; these expose the loop's
  // live position (progress toast), its outcome (summary + per-photo retry),
  // and a cancel flag the loop checks between items. One op at a time.
  type BulkOp = "trash" | "restore" | "purge";
  const [bulkRun, setBulkRun] = useState<{
    op: BulkOp;
    total: number;
    done: number;
  } | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    op: BulkOp;
    ok: number;
    skipped: number;
    failed: { id: number; name: string }[];
  } | null>(null);
  const bulkCancelRef = useRef(false);
  // Leaving the tab (unmount) orphans the loop's UI — treat it as cancel so
  // requests don't keep firing invisibly in the background.
  useEffect(
    () => () => {
      bulkCancelRef.current = true;
    },
    [],
  );
  useEffect(() => {
    if (!bulkRun) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [bulkRun]);
  const [purgeConfirm, setPurgeConfirm] = useState<{
    ids: number[];
    label: string;
  } | null>(null);
  // Extra wrinkle for large purges (>= PURGE_EXTRA_STEP_THRESHOLD): ack
  // checkbox must be checked, then a short countdown before 完全削除 enables.
  const [purgeAckChecked, setPurgeAckChecked] = useState(false);
  const [purgeCountdown, setPurgeCountdown] = useState(0);
  const purgeNeedsExtraStep =
    (purgeConfirm?.ids.length ?? 0) >= PURGE_EXTRA_STEP_THRESHOLD;
  useEffect(() => {
    // New confirm dialog (or closed) — always start from the unacknowledged state.
    setPurgeAckChecked(false);
    setPurgeCountdown(0);
  }, [purgeConfirm]);
  useEffect(() => {
    if (!purgeAckChecked || !purgeNeedsExtraStep || purgeCountdown <= 0) {
      return;
    }
    const id = setTimeout(() => {
      setPurgeCountdown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [purgeAckChecked, purgeNeedsExtraStep, purgeCountdown]);
  const handlePurgeAckChange = (checked: boolean) => {
    setPurgeAckChecked(checked);
    setPurgeCountdown(checked ? PURGE_EXTRA_STEP_SECONDS : 0);
  };
  const purgeConfirmReady =
    !purgeNeedsExtraStep || (purgeAckChecked && purgeCountdown <= 0);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  // 保存先未接続(STORAGE_NOT_CONFIGURED)は通常の失敗トーストと分けて、
  // 不足している変数名(値は含まない)つきの説明バナーを出す。
  const [storageAlert, setStorageAlert] = useState<string[] | null>(null);
  const [showLibraryFilters, setShowLibraryFilters] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);
  const [metaError, setMetaError] = useState(false);
  const [inspectorMobileSection, setInspectorMobileSection] = useState<
    "basic" | "classification" | "details"
  >("basic");
  const [captureClipStatus, setCaptureClipStatus] =
    useState<CaptureClipboardStatus>("idle");
  const captureClipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [actionError, setActionError] = useState(""); // surfaces otherwise-silent mutation failures
  // C3: keyboard navigation — quick preview (Space) + shortcuts help (?)
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const libraryContentStartRef = useRef<HTMLDivElement>(null);
  const [libraryGridMetrics, setLibraryGridMetrics] = useState({
    scrollTop: 0,
    viewportHeight: 0,
    gridWidth: 0,
    gridOffsetTop: 0,
  });
  const libraryScrollRestoredRef = useRef(false);
  const libraryScrollSaveRafRef = useRef<number | null>(null);
  const libraryGridMeasureRafRef = useRef<number | null>(null);
  const libraryScrollPendingTopRef = useRef(0);
  const libraryScrollIdleTimerRef = useRef<number | null>(null);
  const libraryThumbnailRequestsRef = useRef(new Set<string>());
  // Virtualized tiles are recreated as the Library scrolls. Keep successful
  // image URLs outside React state so a cached remount can render opaque from
  // its first style calculation without triggering another grid render.
  const loadedLibraryThumbnailUrlsRef = useRef(new Set<string>());
  const libraryThumbnailPreloadsRef = useRef(
    new Map<string, HTMLImageElement>(),
  );
  const pendingRecentlyAddedScrollRef = useRef<{
    generation: number;
    ids: Set<number>;
  } | null>(null);
  const [bulkEditMode, setBulkEditMode] = usePersistentState(
    "admin:bulkEditMode",
    false,
  );
  // 機能5: アップロード時のフィルム/デジタル選択（グループ単位。デフォルト=digital）
  const [uploadMedium, setUploadMedium] = usePersistentState<
    "digital" | "film"
  >("admin:uploadMedium", "digital");

  const showCaptureClipboardStatus = useCallback(
    (status: CaptureClipboardStatus) => {
      setCaptureClipStatus(status);
      if (captureClipTimerRef.current)
        clearTimeout(captureClipTimerRef.current);
      if (status !== "idle") {
        captureClipTimerRef.current = setTimeout(
          () => setCaptureClipStatus("idle"),
          1500,
        );
      }
    },
    [],
  );

  useEffect(
    () => () => {
      if (captureClipTimerRef.current)
        clearTimeout(captureClipTimerRef.current);
    },
    [],
  );

  const inspectDraftChanged = useMemo(
    () => (inspectPhoto ? photoEditFormChanged(editForm, inspectPhoto) : false),
    [editForm, inspectPhoto],
  );

  useEffect(() => {
    onUnsavedChange?.(inspectDraftChanged);
  }, [inspectDraftChanged, onUnsavedChange]);
  useEffect(() => () => onUnsavedChange?.(false), [onUnsavedChange]);

  useEffect(() => {
    if (!inspectDraftChanged) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [inspectDraftChanged]);

  const copyInspectCaptureInfo = useCallback(async () => {
    const text = formatCaptureInfo({
      camera: editForm.camera,
      lens: editForm.lens,
    });
    if (!text) return;
    try {
      await writeClipboardText(text);
      showCaptureClipboardStatus("copied");
    } catch {
      showCaptureClipboardStatus("error");
    }
  }, [editForm.camera, editForm.lens, showCaptureClipboardStatus]);

  const pasteInspectCaptureInfo = useCallback(async () => {
    try {
      const parsed = parseCaptureInfo(await readClipboardText());
      if (!parsed) throw new Error("empty clipboard");
      setEditForm((f) => ({ ...f, camera: parsed.camera, lens: parsed.lens }));
      showCaptureClipboardStatus("pasted");
    } catch {
      showCaptureClipboardStatus("error");
    }
  }, [showCaptureClipboardStatus]);

  const {
    data: photosData,
    isLoading,
    isError: photosLoadError,
    refetch: refetchPhotos,
    dataUpdatedAt: photosUpdatedAt,
  } = useQuery({
    queryKey: ["photos", "all"],
    queryFn: async () =>
      jsonOrThrow(await api.photos.$get({ query: { all: "1" } })),
  });

  // サイトプレビュー: 並べ替え・S/M/L・回転の結果を、並べる場所(Library)の
  // まま公開サイトの誌面で確かめる (design-spec §10 の確認フロー)。
  // Library の編集は即DB保存されるため、iframe のリロードだけで反映される。
  const [showSitePreview, setShowSitePreview] = usePersistentState(
    "admin:librarySitePreview",
    false,
  );
  const [sitePreviewPage, setSitePreviewPage] = usePersistentState<
    "top" | "gallery"
  >("admin:librarySitePreviewPage", "gallery");
  const [sitePreviewDevice, setSitePreviewDevice] = usePersistentState<
    "desktop" | "mobile"
  >("admin:librarySitePreviewDevice", "desktop");
  const sitePreviewRef = useRef<HTMLIFrameElement>(null);
  // 写真データが更新されたら開いているプレビューを自動リロード
  const lastPreviewDataAt = useRef(0);
  useEffect(() => {
    if (!showSitePreview) {
      lastPreviewDataAt.current = photosUpdatedAt;
      return;
    }
    if (photosUpdatedAt && photosUpdatedAt !== lastPreviewDataAt.current) {
      lastPreviewDataAt.current = photosUpdatedAt;
      sitePreviewRef.current?.contentWindow?.location.reload();
    }
  }, [photosUpdatedAt, showSitePreview]);
  // PC幅プレビュー: パネル幅に収まるよう 1280px の紙面を縮小表示する
  const previewStageRef = useRef<HTMLDivElement>(null);
  const [previewStage, setPreviewStage] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!showSitePreview) return;
    const el = previewStageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () =>
      setPreviewStage({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [showSitePreview]);
  const { data: catsData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => jsonOrThrow(await api.categories.$get()),
  });
  // I1: series list for the inspector's "Series" assignment dropdown
  const { data: seriesData } = useQuery({
    queryKey: ["admin-series"],
    queryFn: async (): Promise<{ series: AdminSeries[] }> =>
      jsonOrThrow(await adminApi.series.$get()),
  });
  const seriesList = useMemo(() => seriesData?.series ?? [], [seriesData]);
  // M3: hero membership, to mark/filter "featured" photos.
  const { data: heroData } = useQuery({
    queryKey: ["admin-hero-photos"],
    queryFn: async (): Promise<{ heroPhotos: HeroPhotoRow[] }> =>
      jsonOrThrow(await adminApi["hero-photos"].$get()),
  });
  const featuredIds = useMemo(
    () => new Set((heroData?.heroPhotos ?? []).map((h) => h.photoId)),
    [heroData],
  );
  // D3: settings hold the camera/lens value presets (datalist suggestions)
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const settingsData = settingsQuery.data;
  // Effective presets: saved list (authoritative once set, managed in Settings) or
  // the built-in defaults when nothing has been saved yet.
  const cameraPresets = useMemo(
    () =>
      effectivePresets(
        parsePresetList(settingsData?.metaPresetsCamera),
        DEFAULT_CAMERA_PRESETS,
      ),
    [settingsData?.metaPresetsCamera],
  );
  const lensPresets = useMemo(
    () =>
      effectivePresets(
        parsePresetList(settingsData?.metaPresetsLens),
        DEFAULT_LENS_PRESETS,
      ),
    [settingsData?.metaPresetsLens],
  );

  // O6: smart albums, parsed from the (JSON-string) setting. Malformed → empty.
  const smartAlbums = useMemo<SmartAlbum[]>(() => {
    try {
      const parsed = JSON.parse(settingsData?.smartAlbums ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [settingsData?.smartAlbums]);
  const activeAlbum = useMemo(
    () => smartAlbums.find((a) => a.id === activeAlbumId) ?? null,
    [smartAlbums, activeAlbumId],
  );
  useEffect(() => {
    if (
      settingsData &&
      activeAlbumId &&
      !smartAlbums.some((a) => a.id === activeAlbumId)
    ) {
      setActiveAlbumId(null);
    }
  }, [settingsData, activeAlbumId, smartAlbums, setActiveAlbumId]);

  const {
    data: trashData,
    isLoading: trashLoading,
    isError: trashFailed,
    refetch: refetchTrash,
  } = useQuery({
    queryKey: ["photos-trash"],
    queryFn: async () => {
      const res = await adminApi.photos.trash.$get();
      return jsonOrThrow(res) as Promise<{
        photos: Photo[];
        retentionDays?: number;
      }>;
    },
    enabled: showTrash,
  });

  // Memoize so the reference is stable while react-query data is unchanged —
  // otherwise dependent useMemo/effects re-run every render.
  const receivedPhotos = useMemo(
    () => (photosData?.photos ?? []) as Photo[],
    [photosData],
  );
  const manualOrder = useMemo(
    () => reconstructManualPhotoOrder(receivedPhotos),
    [receivedPhotos],
  );
  // The API array can follow the public gallery setting. Library's base array
  // instead follows the saved manual ranks so "manual" display and every
  // reorder input refer to the same order.
  const allPhotos = useMemo(() => {
    const base = manualOrder.ok ? manualOrder.photos : receivedPhotos;
    if (!optimisticOrderIds) return base;
    const byId = new Map(base.map((photo) => [photo.id, photo]));
    if (
      optimisticOrderIds.length !== base.length ||
      optimisticOrderIds.some((id) => !byId.has(id))
    ) {
      return base;
    }
    return optimisticOrderIds.map((id) => byId.get(id)!);
  }, [manualOrder, optimisticOrderIds, receivedPhotos]);
  const categories = useMemo(() => catsData?.categories ?? [], [catsData]);

  // "uncategorized" = empty category OR a category whose slug no longer exists
  // (e.g. its category was deleted). Both should be findable in the grid.
  const isUncategorized = useCallback(
    (p: Photo) => !p.category || !categories.some((c) => c.slug === p.category),
    [categories],
  );
  const photoOrientation = useCallback((p: Photo) => {
    const dims = orientedDimensions(p.width, p.height, p.rotationDeg);
    if (!dims.width || !dims.height) return "unknown";
    if (dims.width === dims.height) return "square";
    return dims.width > dims.height ? "landscape" : "portrait";
  }, []);
  const photoMedium = useCallback((p: Photo) => {
    if (!p.filmType) return "missing";
    return p.filmType === "デジタル" ? "digital" : "film";
  }, []);
  const categoryLabelFor = useCallback(
    (slug: string | null | undefined) => {
      if (!slug) return "";
      return categories.find((c) => c.slug === slug)?.label ?? slug;
    },
    [categories],
  );
  const seriesTitleFor = useCallback(
    (id: number | string | null | undefined) => {
      if (id == null || id === "") return "";
      const value = String(id);
      return seriesList.find((s) => String(s.id) === value)?.title ?? value;
    },
    [seriesList],
  );
  const describeAlbumConditions = useCallback(
    (cond: AlbumCond | null | undefined) => {
      const labels: string[] = [];
      if (!cond) return labels;
      if (cond.camera) labels.push(`Camera: ${cond.camera}`);
      if (cond.filmType)
        labels.push(
          cond.filmType === "デジタル"
            ? copy.filters.mediumDigital
            : cond.filmType === "フィルム"
              ? copy.filters.mediumFilm
              : cond.filmType,
        );
      if (cond.medium) {
        labels.push(
          cond.medium === "digital"
            ? copy.filters.mediumDigital
            : cond.medium === "film"
              ? copy.filters.mediumFilm
              : copy.filters.mediumMissing,
        );
      }
      if (cond.missingShotAt) labels.push(copy.filters.missingDate);
      if (cond.missingCapture) labels.push(copy.filters.missingCapture);
      if (cond.category) {
        labels.push(
          cond.category === "__uncat__"
            ? copy.inspector.noCategory
            : categoryLabelFor(cond.category),
        );
      }
      if (cond.series) {
        labels.push(
          cond.series === "__none__"
            ? copy.inspector.noSeries
            : seriesTitleFor(cond.series),
        );
      }
      if (cond.size) labels.push(`Size ${cond.size}`);
      if (cond.featured) labels.push(copy.filters.featured);
      if (cond.published === "published")
        labels.push(copy.inspector.published);
      if (cond.published === "unpublished")
        labels.push(copy.inspector.unpublished);
      if (cond.recent) labels.push(copy.filters.recentDays(cond.recent));
      return labels;
    },
    [categoryLabelFor, copy, seriesTitleFor],
  );
  useEffect(() => {
    const hasUncategorized = allPhotos.some(isUncategorized);
    if (
      catsData &&
      photosData &&
      filterCat !== "all" &&
      !(filterCat === "__uncat__" && hasUncategorized) &&
      !categories.some((c) => c.slug === filterCat)
    ) {
      setFilterCat("all");
    }
    if (
      filterSeries !== "all" &&
      filterSeries !== "__none__" &&
      seriesData &&
      !seriesList.some((s) => String(s.id) === filterSeries)
    ) {
      setFilterSeries("all");
    }
    if (!["all", "S", "M", "L"].includes(filterSize)) setFilterSize("all");
    if (!["all", "digital", "film", "missing"].includes(filterMedium))
      setFilterMedium("all");
    if (!["all", "portrait", "landscape", "square"].includes(filterOrientation))
      setFilterOrientation("all");
    if (!["all", "published", "unpublished"].includes(filterPublished))
      setFilterPublished("all");
    if (!["all", "7", "30"].includes(filterRecent)) setFilterRecent("all");
    const numericThumbSize = Number(thumbSize);
    const normalizedThumbSize = Number.isFinite(numericThumbSize)
      ? Math.min(300, Math.max(80, Math.round(numericThumbSize)))
      : 180;
    if (thumbSize !== normalizedThumbSize) setThumbSize(normalizedThumbSize);
    if (mobileLibraryColumns !== 2 && mobileLibraryColumns !== 3)
      setMobileLibraryColumns(2);
    if (uploadMedium !== "digital" && uploadMedium !== "film")
      setUploadMedium("digital");
    if (
      ![
        "manual",
        "createdAt-desc",
        "createdAt-asc",
        "shotAt-desc",
        "shotAt-asc",
        "series",
        "size",
        "filmType",
        "camera",
        "category",
        "title",
        "published",
        "random",
      ].includes(librarySort)
    ) {
      setLibrarySort("manual");
    }
  }, [
    allPhotos,
    categories,
    catsData,
    filterCat,
    filterMedium,
    filterOrientation,
    filterPublished,
    filterRecent,
    filterSeries,
    filterSize,
    isUncategorized,
    librarySort,
    mobileLibraryColumns,
    photosData,
    seriesData,
    seriesList,
    setFilterCat,
    setFilterMedium,
    setFilterOrientation,
    setFilterPublished,
    setFilterRecent,
    setFilterSeries,
    setFilterSize,
    setLibrarySort,
    setMobileLibraryColumns,
    setThumbSize,
    setUploadMedium,
    thumbSize,
    uploadMedium,
  ]);

  // M3/O4: category / series / size / featured / recency combine as AND filters.
  const filtered = useMemo(() => {
    const recentCutoff =
      filterRecent === "all"
        ? 0
        : Date.now() - Number(filterRecent) * 86_400_000;
    const q = searchQuery.trim().toLowerCase();
    return allPhotos.filter((p) => {
      // B2: free-text search across the fields an editor remembers a photo by.
      if (
        q &&
        ![
          p.title,
          p.filename,
          p.camera,
          p.lens,
          p.filmType,
          categoryLabelFor(p.category),
          seriesTitleFor(p.seriesId),
          p.description,
          p.meta,
        ].some((v) => (v ?? "").toLowerCase().includes(q))
      )
        return false;
      if (
        filterCat === "__uncat__"
          ? !isUncategorized(p)
          : filterCat !== "all" && p.category !== filterCat
      )
        return false;
      if (
        filterSeries === "__none__"
          ? p.seriesId != null
          : filterSeries !== "all" && String(p.seriesId ?? "") !== filterSeries
      )
        return false;
      if (filterSize !== "all" && (p.displaySize || "M") !== filterSize)
        return false;
      if (filterMedium !== "all" && photoMedium(p) !== filterMedium)
        return false;
      if (
        filterOrientation !== "all" &&
        photoOrientation(p) !== filterOrientation
      )
        return false;
      if (filterFeatured && !featuredIds.has(p.id)) return false;
      if (filterPublished === "published" && p.isPublished === false)
        return false;
      if (filterPublished === "unpublished" && p.isPublished !== false)
        return false;
      if (filterMissingShotAt && p.shotAt) return false;
      if (filterMissingCapture && (p.camera || p.lens)) return false;
      if (recentCutoff) {
        const t = p.createdAt ? new Date(p.createdAt).getTime() : 0;
        if (!t || t < recentCutoff) return false;
      }
      // O6: an active smart album adds its own conditions (AND with the chips).
      if (activeAlbum) {
        const c = activeAlbum.cond;
        if (
          c.camera &&
          !(p.camera ?? "").toLowerCase().includes(c.camera.toLowerCase())
        )
          return false;
        if (c.filmType && (p.filmType ?? "") !== c.filmType) return false;
        if (c.medium && photoMedium(p) !== c.medium) return false;
        if (c.missingShotAt && p.shotAt) return false;
        if (c.missingCapture && (p.camera || p.lens)) return false;
        if (
          c.category &&
          (c.category === "__uncat__"
            ? !isUncategorized(p)
            : p.category !== c.category)
        )
          return false;
        if (
          c.series &&
          (c.series === "__none__"
            ? p.seriesId != null
            : String(p.seriesId ?? "") !== c.series)
        )
          return false;
        if (c.size && (p.displaySize || "M") !== c.size) return false;
        if (c.featured && !featuredIds.has(p.id)) return false;
        if (c.published === "published" && p.isPublished === false)
          return false;
        if (c.published === "unpublished" && p.isPublished !== false)
          return false;
        if (c.recent) {
          const cutoff = Date.now() - Number(c.recent) * 86_400_000;
          const t = p.createdAt ? new Date(p.createdAt).getTime() : 0;
          if (!t || t < cutoff) return false;
        }
      }
      return true;
    });
  }, [
    allPhotos,
    filterCat,
    searchQuery,
    filterSeries,
    filterSize,
    filterMedium,
    filterOrientation,
    filterFeatured,
    filterPublished,
    filterMissingShotAt,
    filterMissingCapture,
    filterRecent,
    isUncategorized,
    featuredIds,
    activeAlbum,
    photoMedium,
    photoOrientation,
    categoryLabelFor,
    seriesTitleFor,
  ]);
  const anyFilterActive =
    filterCat !== "all" ||
    searchQuery.trim() !== "" ||
    filterSeries !== "all" ||
    filterSize !== "all" ||
    filterMedium !== "all" ||
    filterOrientation !== "all" ||
    filterFeatured ||
    filterPublished !== "all" ||
    filterMissingShotAt ||
    filterMissingCapture ||
    filterRecent !== "all" ||
    activeAlbumId !== null;
  const activeFilterLabels = useMemo(() => {
    const labels: { key: string; text: string }[] = [];
    const query = searchQuery.trim();
    if (query)
      labels.push({ key: "search", text: copy.filters.searchCondition(query) });
    if (activeAlbum)
      labels.push({ key: "album", text: activeAlbum.name });
    if (filterCat !== "all")
      labels.push({
        key: "category",
        text:
          filterCat === "__uncat__"
            ? copy.filters.categoryCondition(copy.filters.uncategorized)
            : copy.filters.categoryCondition(categoryLabelFor(filterCat)),
      });
    if (filterSeries !== "all")
      labels.push({
        key: "series",
        text:
          filterSeries === "__none__"
            ? copy.filters.seriesCondition(copy.filters.unassigned)
            : copy.filters.seriesCondition(seriesTitleFor(filterSeries)),
      });
    if (filterSize !== "all")
      labels.push({
        key: "size",
        text: copy.filters.sizeCondition(filterSize),
      });
    if (filterMedium !== "all")
      labels.push({
        key: "medium",
        text: copy.filters.mediumCondition(
          filterMedium === "digital"
            ? copy.filters.mediumDigital
            : filterMedium === "film"
              ? copy.filters.mediumFilm
              : filterMedium === "missing"
                ? copy.filters.mediumMissing
                : filterMedium,
        ),
      });
    if (filterOrientation !== "all")
      labels.push({
        key: "orientation",
        text:
          filterOrientation === "portrait"
            ? copy.filters.portrait
            : filterOrientation === "landscape"
              ? copy.filters.landscape
              : filterOrientation === "square"
                ? copy.filters.square
                : filterOrientation,
      });
    if (filterFeatured)
      labels.push({ key: "featured", text: copy.filters.featured });
    if (filterPublished !== "all")
      labels.push({
        key: "published",
        text:
          filterPublished === "published"
            ? copy.filters.publishedOnly
            : filterPublished === "unpublished"
              ? copy.filters.unpublishedOnly
              : filterPublished,
      });
    if (filterMissingShotAt)
      labels.push({ key: "missingShotAt", text: copy.filters.missingDate });
    if (filterMissingCapture)
      labels.push({ key: "missingCapture", text: copy.filters.missingCapture });
    if (filterRecent !== "all")
      labels.push({
        key: "recent",
        text: copy.filters.recentDays(filterRecent),
      });
    return labels;
  }, [
    activeAlbum,
    categoryLabelFor,
    copy,
    filterCat,
    filterFeatured,
    filterMedium,
    filterMissingCapture,
    filterMissingShotAt,
    filterOrientation,
    filterPublished,
    filterRecent,
    filterSeries,
    filterSize,
    searchQuery,
    seriesTitleFor,
  ]);
  const clearLibraryFilters = useCallback(() => {
    setSearchQuery("");
    setFilterCat("all");
    setFilterSeries("all");
    setFilterSize("all");
    setFilterMedium("all");
    setFilterOrientation("all");
    setFilterFeatured(false);
    setFilterPublished("all");
    setFilterMissingShotAt(false);
    setFilterMissingCapture(false);
    setFilterRecent("all");
    setActiveAlbumId(null);
  }, [
    setActiveAlbumId,
    setFilterCat,
    setFilterFeatured,
    setFilterMedium,
    setFilterMissingCapture,
    setFilterMissingShotAt,
    setFilterOrientation,
    setFilterPublished,
    setFilterRecent,
    setFilterSeries,
    setFilterSize,
    setSearchQuery,
  ]);
  const clearLibraryFilter = useCallback(
    (key: string) => {
      switch (key) {
        case "search":
          setSearchQuery("");
          break;
        case "album":
          setActiveAlbumId(null);
          break;
        case "category":
          setFilterCat("all");
          break;
        case "series":
          setFilterSeries("all");
          break;
        case "size":
          setFilterSize("all");
          break;
        case "medium":
          setFilterMedium("all");
          break;
        case "orientation":
          setFilterOrientation("all");
          break;
        case "featured":
          setFilterFeatured(false);
          break;
        case "published":
          setFilterPublished("all");
          break;
        case "missingShotAt":
          setFilterMissingShotAt(false);
          break;
        case "missingCapture":
          setFilterMissingCapture(false);
          break;
        case "recent":
          setFilterRecent("all");
          break;
      }
    },
    [
      setActiveAlbumId,
      setFilterCat,
      setFilterFeatured,
      setFilterMedium,
      setFilterMissingCapture,
      setFilterMissingShotAt,
      setFilterOrientation,
      setFilterPublished,
      setFilterRecent,
      setFilterSeries,
      setFilterSize,
      setSearchQuery,
    ],
  );
  const filterBadgeCount = activeFilterLabels.filter(
    (condition) => condition.key !== "search",
  ).length;

  // reorderLocked からの1クリック復帰。表示条件とソートのローカル状態を
  // 初期値に戻すだけで、写真データ・sortOrder には一切触れない。
  const unlockReorder = useCallback(() => {
    clearLibraryFilters();
    setLibrarySort("manual");
  }, [clearLibraryFilters, setLibrarySort]);

  // U1: display sort. Array.sort is stable, so ties keep the manual order.
  // shotAt-less photos always sink to the end regardless of direction.
  const sortPhotosForView = useCallback(
    (list: Photo[]): Photo[] => {
      if (librarySort === "manual") return list;
      // ランダムはこのタブで共有する種を使う。描き直すたびに引き直すと、
      // 選択やスクロールの最中に写真が動いて作業にならない。
      if (librarySort === "random")
        return shuffleWithSeed(list, visitShuffleSeed());
      const arr = [...list];
      const time = (v: string | number | null | undefined) =>
        v ? new Date(v).getTime() : 0;
      const photoDate = (p: Photo) => time(p.shotAt) || time(p.createdAt);
      const seriesTitle = (id: number | null | undefined) =>
        id == null ? "￿" : seriesTitleFor(id);
      const bySlot = (a: string, b: string) => a.localeCompare(b, "ja");
      switch (librarySort) {
        case "createdAt-desc":
          arr.sort((a, b) => time(b.createdAt) - time(a.createdAt));
          break;
        case "createdAt-asc":
          arr.sort((a, b) => time(a.createdAt) - time(b.createdAt));
          break;
        case "shotAt-desc":
          arr.sort((a, b) => {
            const A = photoDate(a);
            const B = photoDate(b);
            if (!A || !B) return Number(!A) - Number(!B);
            return B - A;
          });
          break;
        case "shotAt-asc":
          arr.sort((a, b) => {
            const A = photoDate(a);
            const B = photoDate(b);
            if (!A || !B) return Number(!A) - Number(!B);
            return A - B;
          });
          break;
        case "series":
          arr.sort((a, b) =>
            bySlot(seriesTitle(a.seriesId), seriesTitle(b.seriesId)),
          );
          break;
        case "size": {
          const rank: Record<string, number> = { S: 0, M: 1, L: 2 };
          arr.sort(
            (a, b) =>
              (rank[a.displaySize || "M"] ?? 1) -
              (rank[b.displaySize || "M"] ?? 1),
          );
          break;
        }
        case "filmType":
          arr.sort((a, b) => bySlot(a.filmType || "￿", b.filmType || "￿"));
          break;
        case "camera":
          arr.sort((a, b) => bySlot(a.camera || "￿", b.camera || "￿"));
          break;
        case "category":
          arr.sort((a, b) => bySlot(a.category || "￿", b.category || "￿"));
          break;
        case "title":
          arr.sort((a, b) =>
            bySlot(a.title || a.filename, b.title || b.filename),
          );
          break;
        case "published":
          arr.sort(
            (a, b) =>
              Number(b.isPublished !== false) - Number(a.isPublished !== false),
          );
          break;
      }
      return arr;
    },
    [librarySort, seriesTitleFor],
  );
  const displayedBase = useMemo(
    () => sortPhotosForView(filtered),
    [filtered, sortPhotosForView],
  );
  const allPhotosInViewOrder = useMemo(
    () => sortPhotosForView(allPhotos),
    [allPhotos, sortPhotosForView],
  );
  const recentlyAddedSectionEnabled =
    !showTrash && libraryMode !== "arrange";
  const { recentlyAddedPhotos, regularPhotos } = useMemo(
    () =>
      splitRecentlyAddedPhotos({
        allPhotos: allPhotosInViewOrder,
        displayedPhotos: displayedBase,
        recentlyAddedPhotoIds,
        enabled: recentlyAddedSectionEnabled,
      }),
    [
      allPhotosInViewOrder,
      displayedBase,
      recentlyAddedPhotoIds,
      recentlyAddedSectionEnabled,
    ],
  );
  const displayed = useMemo(
    () =>
      recentlyAddedPhotos.length === 0
        ? regularPhotos
        : [...recentlyAddedPhotos, ...regularPhotos],
    [recentlyAddedPhotos, regularPhotos],
  );
  useEffect(() => {
    if (reorderTargetId === null) return;
    const index = displayed.findIndex((photo) => photo.id === reorderTargetId);
    if (index < 0) {
      setReorderTargetId(null);
      setReorderPositionValue("");
      setLastMove(null);
      return;
    }
    setReorderPositionValue(String(index + 1));
  }, [displayed, reorderTargetId]);
  const recentlyAddedOutsideFilters = useMemo(() => {
    if (recentlyAddedPhotos.length === 0) return false;
    const filteredIds = new Set(displayedBase.map((photo) => photo.id));
    return recentlyAddedPhotos.some((photo) => !filteredIds.has(photo.id));
  }, [displayedBase, recentlyAddedPhotos]);
  const selectedOutsideFilters = useMemo(() => {
    const displayedIds = new Set(displayedBase.map((photo) => photo.id));
    let count = 0;
    selected.forEach((id) => {
      if (!displayedIds.has(id)) count += 1;
    });
    return count;
  }, [displayedBase, selected]);
  const recentlyAddedSelectedCount = useMemo(() => {
    let count = 0;
    selected.forEach((id) => {
      if (recentlyAddedPhotoIds.has(id)) count += 1;
    });
    return count;
  }, [recentlyAddedPhotoIds, selected]);
  const currentLibraryGridOffsetTop = useCallback(() => {
    const gridEl = gridRef.current;
    const contentStartEl = libraryContentStartRef.current;
    if (!gridEl || !contentStartEl) return 0;
    return Math.max(0, gridEl.offsetTop - contentStartEl.offsetTop);
  }, []);
  const measureLibraryGrid = useCallback(() => {
    const scrollEl = scrollRef.current;
    const gridEl = gridRef.current;
    const next = {
      scrollTop: scrollEl?.scrollTop ?? 0,
      viewportHeight: scrollEl?.clientHeight ?? 0,
      gridWidth: measuredContentWidth(gridEl),
      gridOffsetTop: currentLibraryGridOffsetTop(),
    };
    setLibraryGridMetrics((prev) =>
      prev.scrollTop === next.scrollTop &&
      prev.viewportHeight === next.viewportHeight &&
      prev.gridWidth === next.gridWidth &&
      prev.gridOffsetTop === next.gridOffsetTop
        ? prev
        : next,
    );
  }, [currentLibraryGridOffsetTop]);
  const scheduleLibraryGridMeasure = useCallback(() => {
    if (libraryGridMeasureRafRef.current !== null) return;
    libraryGridMeasureRafRef.current = requestAnimationFrame(() => {
      libraryGridMeasureRafRef.current = null;
      measureLibraryGrid();
    });
  }, [measureLibraryGrid]);
  useLayoutEffect(() => {
    measureLibraryGrid();
    const onResize = () => scheduleLibraryGridMeasure();
    window.addEventListener("resize", onResize);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => scheduleLibraryGridMeasure());
    if (gridRef.current) resizeObserver?.observe(gridRef.current);
    if (scrollRef.current) resizeObserver?.observe(scrollRef.current);
    return () => {
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
    };
  }, [measureLibraryGrid, scheduleLibraryGridMeasure]);
  useEffect(
    () => () => {
      if (libraryGridMeasureRafRef.current !== null)
        cancelAnimationFrame(libraryGridMeasureRafRef.current);
    },
    [],
  );
  useEffect(() => {
    measureLibraryGrid();
  }, [
    anyFilterActive,
    bulkEditMode,
    displayed.length,
    filterSeries,
    libraryMode,
    librarySort,
    measureLibraryGrid,
    recentlyAddedOutsideFilters,
    recentlyAddedPhotos.length,
    showTrash,
    thumbSize,
  ]);
  // ポインタ種別は実行中に変わらない前提で初回のみ判定(タッチ端末の
  // タップ領域40px化に合わせてジャンプボタンの出し分けに使う)
  const coarsePointer = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches,
    [],
  );
  // スマホは2列/3列をオーナーが選べる。Library の grid CSS・仮想化・
  // キーボード列数はこの実効幅で統一する(Trash/Table・PC sliderは従来どおり)。
  const effectiveThumbSize = useMemo(
    () =>
      effectiveLibraryThumbSize({
        thumbSize,
        gridWidth: libraryGridMetrics.gridWidth,
        preferredColumns: coarsePointer
          ? libraryMode === "arrange"
            ? 2
            : mobileLibraryColumns
          : undefined,
      }),
    [
      coarsePointer,
      libraryGridMetrics.gridWidth,
      libraryMode,
      mobileLibraryColumns,
      thumbSize,
    ],
  );
  const virtualGrid = useMemo(
    () =>
      computeVirtualGridWindow({
        itemCount: regularPhotos.length,
        scrollTop: Math.max(
          0,
          libraryGridMetrics.scrollTop - libraryGridMetrics.gridOffsetTop,
        ),
        viewportHeight: libraryGridMetrics.viewportHeight,
        gridWidth: libraryGridMetrics.gridWidth,
        minItemSize: effectiveThumbSize,
      }),
    [
      effectiveThumbSize,
      libraryGridMetrics.gridOffsetTop,
      libraryGridMetrics.gridWidth,
      libraryGridMetrics.scrollTop,
      libraryGridMetrics.viewportHeight,
      regularPhotos.length,
    ],
  );
  const virtualGridRef = useRef(virtualGrid);
  useLayoutEffect(() => {
    virtualGridRef.current = virtualGrid;
  }, [virtualGrid]);
  const visibleRegularPhotos = useMemo(
    () => regularPhotos.slice(virtualGrid.startIndex, virtualGrid.endIndex),
    [regularPhotos, virtualGrid.endIndex, virtualGrid.startIndex],
  );
  useEffect(() => {
    if (!virtualGrid.isVirtualized || typeof Image === "undefined") return;
    const preloadItems = virtualGrid.columns * LIBRARY_GRID_PRELOAD_ROWS;
    const start = Math.max(0, virtualGrid.startIndex - preloadItems);
    const end = Math.min(
      regularPhotos.length,
      virtualGrid.endIndex + preloadItems,
    );
    for (const photo of regularPhotos.slice(start, end)) {
      const url = adminPhotoSrc(photo, 400, 70);
      if (libraryThumbnailRequestsRef.current.has(url)) continue;
      libraryThumbnailRequestsRef.current.add(url);
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "auto";
      image.onload = () => {
        libraryThumbnailPreloadsRef.current.delete(url);
      };
      image.onerror = () => {
        libraryThumbnailPreloadsRef.current.delete(url);
        libraryThumbnailRequestsRef.current.delete(url);
      };
      libraryThumbnailPreloadsRef.current.set(url, image);
      image.src = url;
    }
  }, [regularPhotos, virtualGrid]);
  const markLibraryScrolling = useCallback((element: HTMLDivElement) => {
    element.dataset.scrolling = "true";
    if (libraryScrollIdleTimerRef.current !== null) {
      window.clearTimeout(libraryScrollIdleTimerRef.current);
    }
    libraryScrollIdleTimerRef.current = window.setTimeout(() => {
      element.dataset.scrolling = "false";
      libraryScrollIdleTimerRef.current = null;
    }, 140);
  }, []);
  useEffect(
    () => () => {
      if (libraryScrollIdleTimerRef.current !== null) {
        window.clearTimeout(libraryScrollIdleTimerRef.current);
      }
      libraryThumbnailPreloadsRef.current.clear();
    },
    [],
  );
  const scrollLibraryIndexIntoView = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      const latestVirtualGrid = virtualGridRef.current;
      if (!el || index < 0 || latestVirtualGrid.rowHeight <= 0) return;
      if (index < recentlyAddedPhotos.length) {
        const photo = displayed[index];
        const tile = photo
          ? document.getElementById(`admin-photo-${photo.id}`)
          : null;
        if (!tile) return;
        const scrollRect = el.getBoundingClientRect();
        const tileRect = tile.getBoundingClientRect();
        const tileTop = el.scrollTop + tileRect.top - scrollRect.top;
        const tileBottom = tileTop + tileRect.height;
        if (tileTop < el.scrollTop) {
          el.scrollTop = Math.max(0, tileTop);
        } else if (tileBottom > el.scrollTop + el.clientHeight) {
          el.scrollTop = Math.max(0, tileBottom - el.clientHeight);
        }
        measureLibraryGrid();
        return;
      }
      const regularIndex = index - recentlyAddedPhotos.length;
      const row = Math.floor(
        regularIndex / Math.max(1, latestVirtualGrid.columns),
      );
      const rowTop =
        currentLibraryGridOffsetTop() + row * latestVirtualGrid.rowHeight;
      const rowBottom = rowTop + latestVirtualGrid.rowHeight;
      if (rowTop < el.scrollTop) {
        el.scrollTop = rowTop;
      } else if (rowBottom > el.scrollTop + el.clientHeight) {
        el.scrollTop = Math.max(0, rowBottom - el.clientHeight);
      }
      measureLibraryGrid();
    },
    [
      currentLibraryGridOffsetTop,
      displayed,
      measureLibraryGrid,
      recentlyAddedPhotos.length,
    ],
  );
  const dismissRecentlyAdded = useCallback(() => {
    pendingRecentlyAddedScrollRef.current = null;
    onRecentlyAddedPhotoIdsChange(new Set());
  }, [onRecentlyAddedPhotoIdsChange]);
  useLayoutEffect(() => {
    const pending = pendingRecentlyAddedScrollRef.current;
    if (
      !pending ||
      pending.generation !== uploadGenerationRef.current ||
      !recentlyAddedSectionEnabled ||
      !recentlyAddedPhotos.some((photo) => pending.ids.has(photo.id))
    ) {
      return;
    }
    const libraryScroll = scrollRef.current;
    if (!libraryScroll) return;
    const scrollTarget =
      (bulkEditMode
        ? libraryScroll.querySelector<HTMLElement>(
            "[data-bulk-edit-table-scroll]",
          )
        : null) ?? libraryScroll;
    pendingRecentlyAddedScrollRef.current = null;
    if (typeof scrollTarget.scrollTo === "function") {
      scrollTarget.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    } else {
      scrollTarget.scrollTop = 0;
    }
    scheduleLibraryGridMeasure();
  }, [
    bulkEditMode,
    recentlyAddedPhotos,
    recentlyAddedSectionEnabled,
    scheduleLibraryGridMeasure,
  ]);
  const missingShotAtCount = useMemo(
    () => allPhotos.filter((p) => !p.shotAt).length,
    [allPhotos],
  );
  const selectedMissingShotAtCount = useMemo(
    () => allPhotos.filter((p) => selected.has(p.id) && !p.shotAt).length,
    [allPhotos, selected],
  );
  // Film shotAt can't be re-read from EXIF after upload (R2 stores an
  // EXIF-stripped master) — this counts selected film photos with a
  // (possibly wrong) date, i.e. candidates for the "clear" rescue op below.
  const selectedFilmShotAtSetCount = useMemo(
    () =>
      allPhotos.filter(
        (p) => selected.has(p.id) && p.filmType === "フィルム" && p.shotAt,
      ).length,
    [allPhotos, selected],
  );
  const missingCaptureCount = useMemo(
    () => allPhotos.filter((p) => !p.camera && !p.lens).length,
    [allPhotos],
  );
  const unpublishedCount = useMemo(
    () => allPhotos.filter((p) => p.isPublished === false).length,
    [allPhotos],
  );
  const mediumCounts = useMemo(
    () => ({
      digital: allPhotos.filter((p) => photoMedium(p) === "digital").length,
      film: allPhotos.filter((p) => photoMedium(p) === "film").length,
      missing: allPhotos.filter((p) => photoMedium(p) === "missing").length,
    }),
    [allPhotos, photoMedium],
  );
  const orientationCounts = useMemo(
    () => ({
      landscape: allPhotos.filter((p) => photoOrientation(p) === "landscape")
        .length,
      portrait: allPhotos.filter((p) => photoOrientation(p) === "portrait")
        .length,
      square: allPhotos.filter((p) => photoOrientation(p) === "square").length,
    }),
    [allPhotos, photoOrientation],
  );
  // Reorder normally needs the full library in manual order. Exception: a single
  // concrete series filter with nothing else active — the public series page
  // follows the global sortOrder, so dragging inside that view is the only
  // practical way to order photos within a series. The drop still splices the
  // GLOBAL ids (src lands adjacent to the target), so the full library stays
  // consistent.
  const onlySeriesFilter =
    filterSeries !== "all" &&
    filterSeries !== "__none__" &&
    filterCat === "all" &&
    searchQuery.trim() === "" &&
    filterSize === "all" &&
    filterMedium === "all" &&
    filterOrientation === "all" &&
    !filterFeatured &&
    filterPublished === "all" &&
    !filterMissingShotAt &&
    !filterMissingCapture &&
    filterRecent === "all" &&
    activeAlbumId === null;
  const reorderLockCause = reorderLockReason(
    librarySort,
    anyFilterActive,
    onlySeriesFilter,
  );
  const publicReorderLockCause:
    | "loading"
    | "error"
    | "not-manual"
    | null = !settingsQuery.isSuccess
    ? settingsQuery.isError
      ? "error"
      : "loading"
    : (settingsData?.gallerySortOrder ?? "manual") !== "manual"
      ? "not-manual"
      : null;
  const reorderLocked =
    publicReorderLockCause !== null || reorderLockCause !== null;

  // Close batch dropdowns on outside click
  useEffect(() => {
    if (!batchCatOpen && !batchSeriesOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-batch-cat]")) setBatchCatOpen(false);
      if (!target.closest("[data-batch-series]")) setBatchSeriesOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [batchCatOpen, batchSeriesOpen]);

  const onActionError = (msg: string) => () => setActionError(msg);

  // Bulk loop shared by trash/restore/purge: per-item try/catch so one failure
  // doesn't abort the rest, progress reported between items, cancel honoured at
  // item boundaries (each item is atomic server-side, so stopping is safe).
  // Partial failure resolves (never throws) — invalidation must always run,
  // otherwise the grid keeps showing photos the server already processed.
  const photoNameById = (id: number) => {
    const p =
      allPhotos.find((x) => x.id === id) ??
      trashData?.photos.find((x) => x.id === id);
    return p?.title || p?.filename || `ID ${id}`;
  };
  const runBulk = async (
    op: BulkOp,
    ids: number[],
    call: (id: number) => Promise<Response>,
  ) => {
    bulkCancelRef.current = false;
    setBulkResult(null);
    setBulkRun({ op, total: ids.length, done: 0 });
    const succeeded: number[] = [];
    const failed: { id: number; name: string }[] = [];
    let done = 0;
    for (const id of ids) {
      if (bulkCancelRef.current) break;
      try {
        assertOk(await call(id));
        succeeded.push(id);
      } catch {
        failed.push({ id, name: photoNameById(id) });
      }
      done += 1;
      setBulkRun({ op, total: ids.length, done });
    }
    setBulkRun(null);
    return { op, succeeded, failed, skipped: ids.length - done };
  };
  const invalidatePhotoViews = () => {
    qc.invalidateQueries({ queryKey: ["photos"] });
    qc.invalidateQueries({ queryKey: ["photos-trash"] });
    qc.invalidateQueries({ queryKey: ["hero-photos"] });
    qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
    qc.invalidateQueries({ queryKey: ["series"] });
  };

  // Soft-delete (to trash)
  const deletePhotos = useMutation({
    mutationFn: (ids: number[]) =>
      runBulk("trash", ids, (id) =>
        adminApi.photos[":id"].$delete({ param: { id: String(id) } }),
      ),
    onSuccess: (r) => {
      setActionError("");
      invalidatePhotoViews();
      setSelected(new Set());
      setInspectPhoto(null);
      if (r.succeeded.length > 0)
        setUndoToast({ ids: r.succeeded, count: r.succeeded.length });
      if (r.failed.length > 0 || r.skipped > 0)
        setBulkResult({
          op: r.op,
          ok: r.succeeded.length,
          skipped: r.skipped,
          failed: r.failed,
        });
    },
    onError: onActionError(copy.feedback.deleteFailed),
  });

  // Restore from trash
  const restorePhotos = useMutation({
    mutationFn: (ids: number[]) =>
      runBulk("restore", ids, (id) =>
        adminApi.photos[":id"].restore.$post({ param: { id: String(id) } }),
      ),
    onSuccess: (r) => {
      setActionError("");
      invalidatePhotoViews();
      setUndoToast(null);
      if (r.failed.length > 0 || r.skipped > 0)
        setBulkResult({
          op: r.op,
          ok: r.succeeded.length,
          skipped: r.skipped,
          failed: r.failed,
        });
    },
    onError: onActionError(copy.feedback.restoreFailed),
  });

  // Permanently purge from trash — irreversible, so the summary always shows.
  const purgePhotos = useMutation({
    mutationFn: (ids: number[]) =>
      runBulk("purge", ids, (id) =>
        adminApi.photos[":id"].purge.$delete({ param: { id: String(id) } }),
      ),
    onSuccess: (r) => {
      setActionError("");
      invalidatePhotoViews();
      setBulkResult({
        op: r.op,
        ok: r.succeeded.length,
        skipped: r.skipped,
        failed: r.failed,
      });
    },
    onError: onActionError(copy.feedback.purgeFailed),
  });

  // One bulk op at a time; also read from the keyboard-delete handler via ref.
  const bulkBusy =
    deletePhotos.isPending || restorePhotos.isPending || purgePhotos.isPending;
  const bulkBusyRef = useRef(bulkBusy);
  bulkBusyRef.current = bulkBusy;
  const retryFailedBulk = () => {
    if (!bulkResult || bulkResult.failed.length === 0 || bulkBusy) return;
    const ids = bulkResult.failed.map((f) => f.id);
    const op = bulkResult.op;
    setBulkResult(null);
    if (op === "trash") deletePhotos.mutate(ids);
    else if (op === "restore") restorePhotos.mutate(ids);
    else purgePhotos.mutate(ids);
  };

  // Update
  const updatePhoto = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: number;
      title: string;
      camera: string;
      lens: string;
      filmType: string;
      shotAt?: string;
      description: string;
      category: string;
      displaySize?: string;
      seriesId?: string;
      isPublished?: boolean;
      rotationDeg?: number;
      focalX?: number;
      focalY?: number;
    }) => {
      const res = await adminApi.photos[":id"].$patch({
        param: { id: String(id) },
        json: data,
      });
      assertOk(res);
    },
    // L1: a photo's seriesId can change here, so the series views (public list +
    // detail, both keyed ["series", …]) must refetch — otherwise a newly-assigned
    // photo never appears on /series/:slug until the cache happens to expire.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      qc.invalidateQueries({ queryKey: ["hero-photos"] });
      qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
    },
  });

  const quickRotatePhoto = useMutation({
    mutationFn: async ({
      id,
      rotationDeg,
      delta,
    }: {
      id: number;
      rotationDeg: number;
      delta: -90 | 90;
    }) => {
      const res = await adminApi.photos[":id"].$patch({
        param: { id: String(id) },
        json: { rotationDeg },
      });
      assertOk(res);
      return { id, rotationDeg, delta };
    },
    onSuccess: ({ id, rotationDeg, delta }) => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      qc.invalidateQueries({ queryKey: ["hero-photos"] });
      qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
      // APIが焦点も一緒に回すので、再取得までのあいだ表示がずれないよう
      // 手元の状態にも同じ変換をかける。
      setInspectPhoto((p) =>
        p?.id === id
          ? { ...p, rotationDeg, ...rotateFocalPoint(p.focalX, p.focalY, delta) }
          : p,
      );
      setEditForm((f) =>
        inspectPhoto?.id === id
          ? { ...f, rotationDeg, ...rotateFocalPoint(f.focalX, f.focalY, delta) }
          : f,
      );
      setBatchToast(copy.feedback.rotationChanged(rotationDeg));
      setTimeout(() => setBatchToast(null), 1500);
    },
    onError: onActionError(copy.feedback.rotationFailed),
  });

  // O1: duplicate a photo (same image, inherited metadata) and open the copy.
  const duplicatePhoto = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminApi.photos[":id"].duplicate.$post({
        param: { id: String(id) },
      });
      assertOk(res);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["photos"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      const dup = (data as { photo?: Photo })?.photo;
      // 未保存の下書きがある間は複製の自動オープンで下書きを消さない
      // (複製自体は成功済み。トーストのみ表示し、現在の編集を続けられる)。
      if (
        dup &&
        !(inspectPhoto && photoEditFormChanged(editForm, inspectPhoto))
      ) {
        openInspector(dup);
      }
      setBatchToast(copy.feedback.duplicated);
      setTimeout(() => setBatchToast(null), 2000);
    },
    onError: onActionError(copy.feedback.duplicateFailed),
  });

  // D3: remember newly entered camera/lens values as presets for next time.
  // Append to the effective list and persist the whole thing (so the saved list
  // becomes authoritative, consistent with the Settings preset manager).
  const rememberPresets = async (camera: string, lens: string) => {
    const updates: Record<string, string> = {};
    if (camera && !cameraPresets.includes(camera))
      updates.metaPresetsCamera = JSON.stringify([...cameraPresets, camera]);
    if (lens && !lensPresets.includes(lens))
      updates.metaPresetsLens = JSON.stringify([...lensPresets, lens]);
    if (Object.keys(updates).length === 0) return;
    // §0: check the write. This runs fire-and-forget from updatePhoto's onSuccess,
    // and remembering presets is a best-effort convenience (the photo itself already
    // saved), so a failure is logged rather than thrown — throwing here would be an
    // unhandled rejection at the call site.
    try {
      await postAdminSettings(updates);
      qc.invalidateQueries({ queryKey: ["settings"] });
    } catch (e) {
      console.error("rememberPresets failed:", e);
    }
  };

  // Batch category uses one SQL UPDATE, so a failed request cannot leave only
  // part of the selected photos in the new category.
  const batchCategory = useMutation({
    mutationFn: async ({
      ids,
      category,
    }: {
      ids: number[];
      category: string;
    }) => {
      const res = await adminApi.photos.batch.$post({
        json: { ids, operation: "category", value: category },
      });
      assertOk(res);
    },
    onSuccess: () => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      setSelected(new Set());
    },
    onError: onActionError(copy.feedback.batchCategoryFailed),
  });

  // M2: batch operations via the single /admin/photos/batch endpoint. Selection is
  // kept after the op (spec) and the result is surfaced as a toast.
  const batchOp = useMutation({
    mutationFn: async ({
      operation,
      value,
    }: {
      operation: BatchPhotoOperation;
      value?: string;
    }) => {
      const res = await adminApi.photos.batch.$post({
        json: { ids: Array.from(selected), operation, value },
      });
      assertOk(res);
      return res.json();
    },
    onSuccess: (data, vars) => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      qc.invalidateQueries({ queryKey: ["hero-photos"] });
      qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
      if (inspectPhoto && selected.has(inspectPhoto.id)) {
        if (
          vars.operation === "rotate_left" ||
          vars.operation === "rotate_right"
        ) {
          const delta = vars.operation === "rotate_left" ? -90 : 90;
          const rotationDeg = rotatedBy(inspectPhoto.rotationDeg, delta);
          setInspectPhoto((p) =>
            p
              ? {
                  ...p,
                  rotationDeg,
                  ...rotateFocalPoint(p.focalX, p.focalY, delta),
                }
              : p,
          );
          setEditForm((f) => ({
            ...f,
            rotationDeg,
            ...rotateFocalPoint(f.focalX, f.focalY, delta),
          }));
        }
        if (vars.operation === "reset_rotation") {
          setInspectPhoto((p) => (p ? { ...p, rotationDeg: 0 } : p));
          setEditForm((f) => ({ ...f, rotationDeg: 0 }));
        }
        if (vars.operation === "reset_focal_point") {
          setInspectPhoto((p) => (p ? { ...p, focalX: 50, focalY: 50 } : p));
          setEditForm((f) => ({ ...f, focalX: 50, focalY: 50 }));
        }
        if (vars.operation === "shotAt_missing_only" && vars.value) {
          setInspectPhoto((p) =>
            p && !p.shotAt ? { ...p, shotAt: vars.value ?? null } : p,
          );
          setEditForm((f) =>
            f.shotAt ? f : { ...f, shotAt: vars.value ?? "" },
          );
        }
      }
      const count = (data as { count?: number })?.count ?? selected.size;
      setBatchToast(copy.feedback.updated(count));
      setTimeout(() => setBatchToast(null), 2000);
      if (vars.operation === "shotAt_missing_only") setBatchShotAtDate("");
    },
    onError: onActionError(copy.feedback.batchFailed),
  });

  // O2: bulk metadata edit. Only fields the user filled are sent (empty = leave as-is).
  const batchMetaEdit = useMutation({
    mutationFn: async (
      fields: Record<"camera" | "lens" | "filmType", string>,
    ) => {
      const ids = Array.from(selected);
      if (!Object.values(fields).some((value) => value !== "")) return 0;
      const res = await adminApi.photos.batch.$post({
        json: { ids, operation: "metadata", value: fields },
      });
      assertOk(res);
      return 1;
    },
    onSuccess: (changed) => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      setBatchEditOpen(false);
      setBatchEdit({ camera: "", lens: "", filmType: "" });
      if (changed > 0) {
        setBatchToast(copy.feedback.updated(selected.size));
        setTimeout(() => setBatchToast(null), 2000);
      }
    },
    onError: onActionError(copy.feedback.bulkMetadataFailed),
  });

  // O6: persist the smart-album list (stored as a JSON string in site_settings).
  const saveAlbums = useMutation({
    mutationFn: async (next: SmartAlbum[]) => {
      await postAdminSettings({ smartAlbums: JSON.stringify(next) });
    },
    onSuccess: () => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: onActionError(copy.feedback.albumSaveFailed),
  });

  const setReorderBusyState = (busy: boolean) => {
    reorderBusyRef.current = busy;
    setReorderBusy(busy);
  };

  const refetchAndConfirmPhotoOrder = async (expectedIds: number[]) => {
    await qc.refetchQueries(
      { queryKey: ["photos", "all"], type: "active" },
      { throwOnError: true },
    );
    const latest = qc.getQueryData<{ photos?: Photo[] }>(["photos", "all"]);
    const latestManual = reconstructManualPhotoOrder(latest?.photos ?? []);
    return !(
      !latestManual.ok ||
      latestManual.ids.length !== expectedIds.length ||
      latestManual.ids.some((id, index) => id !== expectedIds[index])
    );
  };

  const completeConfirmedPhotoOrder = (variables: PhotoReorderOperation) => {
    setReorderNeedsReload(false);
    setOptimisticOrderIds(null);
    setActionError("");
    setReorderFailedOperation(null);
    if (variables.operation === "save") {
      setReorderUndo({
        beforeIds: variables.beforeIds,
        afterIds: variables.afterIds,
      });
      setReorderFailedTargetId(null);
    } else {
      setReorderUndo(null);
      setLastMove(null);
    }
    setReorderFeedback({
      state: "saved",
      operation: variables.operation,
      message:
        variables.operation === "undo"
          ? copy.reorder.undoSaved
          : copy.reorder.saved,
    });
    variables.afterConfirmed?.();
    setReorderBusyState(false);
  };

  // Reorder: the operation remains busy until the refreshed list confirms the
  // saved order. The local order is changed first (optimistic update).
  const reorder = useMutation({
    mutationFn: async ({ ids, expectedIds }: PhotoReorderOperation) => {
      let lastNetworkError: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        let res: Response;
        try {
          res = await adminApi.photos.reorder.$post({
            json: { ids, expectedIds },
          });
        } catch (error) {
          lastNetworkError = error;
          if (attempt < 3) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, attempt * 80),
            );
            continue;
          }
          throw error;
        }
        if (!res.ok) {
          if (res.status === 401) assertOk(res);
          const error = new Error(await responseErrorMessage(res)) as Error & {
            status?: number;
          };
          error.status = res.status;
          throw error;
        }
        return;
      }
      throw lastNetworkError;
    },
    onMutate: (variables) => {
      setReorderNeedsReload(false);
      setReorderFailedTargetId(null);
      setReorderFailedOperation(null);
      setOptimisticOrderIds(variables.ids);
      if (variables.operation === "save") {
        setReorderUndo(null);
        setLastMove(variables.move ?? null);
      }
      setActionError("");
      setReorderFeedback({
        state: "saving",
        operation: variables.operation,
        message:
          variables.operation === "undo"
            ? copy.reorder.undoSaving
            : copy.reorder.saving,
      });
    },
    onSuccess: async (_data, variables) => {
      try {
        const confirmed = await refetchAndConfirmPhotoOrder(
          variables.afterIds,
        );
        setOptimisticOrderIds(null);
        setActionError("");
        if (!confirmed) {
          setReorderUndo(null);
          setReorderFeedback({
            state: "error",
            operation: variables.operation,
            message: copy.reorder.conflict,
          });
          setActionError(copy.reorder.conflict);
          setReorderBusyState(false);
          return;
        }
        completeConfirmedPhotoOrder(variables);
      } catch {
        // The API save succeeded, so rolling the screen back would falsely show
        // an unsaved order. Keep the optimistic order and the lock until reload.
        const message = copy.feedback.reorderRefreshFailed;
        setReorderNeedsReload(true);
        setActionError(message);
        setReorderFeedback({
          state: "error",
          operation: variables.operation,
          message,
        });
      }
    },
    onError: async (error, variables) => {
      setReorderNeedsReload(false);
      const conflict =
        error instanceof Error &&
        "status" in error &&
        (error as Error & { status?: number }).status === 409;
      if (conflict) {
        try {
          await qc.refetchQueries(
            { queryKey: ["photos", "all"], type: "active" },
            { throwOnError: true },
          );
          const latest = qc.getQueryData<{ photos?: Photo[] }>([
            "photos",
            "all",
          ]);
          const latestManual = reconstructManualPhotoOrder(
            latest?.photos ?? [],
          );
          if (
            latestManual.ok &&
            latestManual.ids.length === variables.afterIds.length &&
            latestManual.ids.every(
              (id, index) => id === variables.afterIds[index],
            )
          ) {
            completeConfirmedPhotoOrder(variables);
            return;
          }
          setOptimisticOrderIds(null);
        } catch {
          // The last confirmed local order is safer than leaving the rejected
          // optimistic order visible when the latest list cannot be fetched.
          setOptimisticOrderIds(variables.beforeIds);
        }
        setReorderUndo(null);
      } else {
        setOptimisticOrderIds(variables.beforeIds);
        setReorderFailedOperation(variables);
      }
      if (variables.operation === "save") setLastMove(null);
      if (variables.operation === "save" && variables.move) {
        setReorderFailedTargetId(variables.move.id);
      }
      const message = conflict
        ? copy.reorder.conflict
        : variables.operation === "undo"
          ? copy.reorder.undoFailed
          : error instanceof Error && error.message
            ? error.message
            : copy.feedback.reorderFailed;
      setActionError(message);
      setReorderFeedback({
        state: "error",
        operation: variables.operation,
        message,
      });
      setReorderBusyState(false);
    },
  });

  const savePhotoOrder = (
    ids: number[],
    options?: {
      operation?: "save" | "undo";
      expectedIds?: number[];
      beforeIds?: number[];
      afterConfirmed?: () => void;
      move?: { id: number; from: number; to: number };
    },
  ) => {
    if (reorderBusyRef.current || reorder.isPending) return;
    if (publicReorderLockCause !== null) {
      setActionError(
        publicReorderLockCause === "not-manual"
          ? copy.reorder.publicOrderLocked
          : publicReorderLockCause === "error"
            ? copy.reorder.settingsError
            : copy.reorder.settingsLoading,
      );
      return;
    }
    if (!manualOrder.ok) {
      setActionError(copy.feedback.invalidManualOrder);
      return;
    }
    const beforeIds = options?.beforeIds ?? allPhotos.map((photo) => photo.id);
    const operation = options?.operation ?? "save";
    setReorderBusyState(true);
    reorder.mutate({
      ids,
      expectedIds: options?.expectedIds ?? beforeIds,
      beforeIds,
      afterIds: ids,
      operation,
      move: options?.move,
      afterConfirmed: options?.afterConfirmed,
    });
  };

  const undoPhotoOrder = () => {
    if (!reorderUndo || reorderBusyRef.current) return;
    savePhotoOrder(reorderUndo.beforeIds, {
      operation: "undo",
      expectedIds: reorderUndo.afterIds,
      beforeIds: reorderUndo.afterIds,
    });
  };

  const retryFailedPhotoOrder = () => {
    if (!reorderFailedOperation || reorderBusyRef.current) return;
    savePhotoOrder(reorderFailedOperation.afterIds, {
      operation: reorderFailedOperation.operation,
      expectedIds: reorderFailedOperation.expectedIds,
      beforeIds: reorderFailedOperation.beforeIds,
      move: reorderFailedOperation.move,
      afterConfirmed: reorderFailedOperation.afterConfirmed,
    });
  };

  // 一括編集テーブルからの単行セーブ（部分更新）
  const bulkEditSave = async (id: number, data: BulkEditSaveData) => {
    const res = await adminApi.photos[":id"].$patch({
      param: { id: String(id) },
      json: data,
    });
    assertOk(res);
    qc.invalidateQueries({ queryKey: ["photos"] });
    qc.invalidateQueries({ queryKey: ["series"] });
  };

  const localizedUploadFailureNotice = (
    failures: { file: Pick<File, "name">; reason?: string }[],
  ) => {
    if (language === "ja") return uploadFailureNotice(failures);
    if (failures.length === 0) return null;
    const names = failures
      .slice(0, 3)
      .map(({ file, reason }) => `${file.name}${reason ? ` (${reason})` : ""}`)
      .join(", ");
    return copy.import.failureSummary(
      failures.length,
      names,
      failures.length > 3,
    );
  };

  // Upload — server-side resize (no more presigned URLs)
  const handleFiles = async (files: File[]) => {
    // 次の取り込みを始めた時点で、前回分の目印だけを解除する。
    // 選択状態とは別なので、ここでは selected を変更しない。
    pendingRecentlyAddedScrollRef.current = null;
    onRecentlyAddedPhotoIdsChange(new Set());
    const imageFiles = files.filter(isUploadableImageFile);
    const skipped = files.length - imageFiles.length;
    const tooLargeNotice =
      language === "ja"
        ? uploadTooLargeNotice(imageFiles)
        : localizedUploadFailureNotice(
            imageFiles.filter(imageFileTooLarge).map((file) => ({
              file,
              reason: copy.import.tooLargeReason(uploadSizeLimitLabel()),
            })),
          );
    const uploadableFiles = imageFiles.filter(
      (file) => !imageFileTooLarge(file),
    );
    if (!uploadableFiles.length) {
      const parts: string[] = [];
      if (tooLargeNotice) parts.push(tooLargeNotice);
      if (skipped > 0) parts.push(copy.import.skippedNonImages(skipped));
      setUploadNotice(
        parts.length
          ? parts.join(" / ")
          : skipped > 0
            ? copy.import.skippedOnlyNonImages(skipped)
            : null,
      );
      return;
    }
    setUploadNotice(null);
    setRetryFiles([]);
    setStorageAlert(null);
    const uploadGeneration = ++uploadGenerationRef.current;
    activeUploadProgressRef.current.set(uploadGeneration, {
      done: 0,
      total: uploadableFiles.length,
    });
    syncUploadProgress();
    const failed: { file: File; reason?: string }[] = [];
    const duplicates: string[] = [];
    const addedPhotoIds: number[] = [];
    let storageMissing: string[] | null = null;
    let done = 0;

    const uploadOne = async (file: File) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          try {
            const body = (await res.clone().json()) as unknown;
            const missing = storageMissingFromErrorBody(body);
            if (missing) storageMissing = missing;
          } catch {
            // 非JSONエラーは従来どおり下の汎用メッセージに任せる
          }
          const message =
            language === "en"
              ? `${copy.import.failedReason} (HTTP ${res.status})`
              : await responseErrorMessage(res);
          try {
            assertOk(res);
          } catch (err) {
            if (res.status === 401) throw err;
          }
          throw new Error(message);
        }
        assertOk(res);
        const data = await res.json();
        // C1: server detected an identical image already registered — skip it.
        if (data.duplicate) {
          duplicates.push(file.name);
          return;
        }
        const {
          url,
          width,
          height,
          fileHash,
          thumbKey,
          mediumKey,
          shotAt,
          exifDateDigitized,
          sourceWidth,
          sourceHeight,
          sourceFormat,
          exifCamera,
          exifMake,
          exifModel,
          exifLens,
          exifFocalLength,
          exifFNumber,
          exifExposureTime,
          exifIso,
        } = data as Record<string, unknown>;
        if (!url) throw new Error("no url returned");
        const isDigital = uploadMedium === "digital";
        const filmTypeVal = isDigital ? "デジタル" : "フィルム";
        const cameraVal = isDigital ? ((exifCamera as string) ?? "") : "";
        const lensVal = isDigital ? ((exifLens as string) ?? "") : "";
        const {
          shotAt: shotAtVal,
          shotAtSource: shotAtSourceVal,
        } = shotAtWithSourceForUploadedPhoto(
          shotAt,
          exifDateDigitized,
          file,
          uploadMedium,
        );
        const created = await adminApi.photos.$post({
          json: {
            filename: file.name,
            url: url as string,
            width: width as number,
            height: height as number,
            fileHash: fileHash as string,
            thumbKey: (thumbKey as string) ?? "",
            mediumKey: (mediumKey as string) ?? "",
            shotAt: shotAtVal,
            shotAtSource: shotAtSourceVal,
            shotAtDigitized: (exifDateDigitized as string) ?? "",
            sourceWidth: (sourceWidth as number) ?? null,
            sourceHeight: (sourceHeight as number) ?? null,
            sourceFormat: (sourceFormat as string) ?? null,
            title: "",
            meta: "",
            category: "",
            filmType: filmTypeVal,
            camera: cameraVal,
            cameraMake: isDigital ? ((exifMake as string) ?? "") : "",
            cameraModel: isDigital ? ((exifModel as string) ?? "") : "",
            lens: lensVal,
            focalLength: isDigital ? ((exifFocalLength as string) ?? "") : "",
            fNumber: isDigital ? ((exifFNumber as string) ?? "") : "",
            exposureTime: isDigital ? ((exifExposureTime as string) ?? "") : "",
            iso: isDigital ? ((exifIso as string) ?? "") : "",
          },
        });
        assertOk(created);
        const createdBody = (await created.json()) as {
          duplicate?: boolean;
          photo?: { id?: unknown };
        };
        if (createdBody.duplicate) {
          duplicates.push(file.name);
          return;
        }
        const createdId = createdBody.photo?.id;
        if (
          created.status !== 201 ||
          typeof createdId !== "number" ||
          !Number.isInteger(createdId)
        ) {
          throw new Error("no photo id returned");
        }
        addedPhotoIds.push(createdId);
      } catch (err) {
        failed.push({
          file,
          reason: err instanceof Error ? err.message : undefined,
        });
      } finally {
        done += 1;
        activeUploadProgressRef.current.set(uploadGeneration, {
          done,
          total: uploadableFiles.length,
        });
        syncUploadProgress();
      }
    };

    try {
      // Limited concurrency — faster than serial without overwhelming the server
      const queue = [...uploadableFiles];
      const CONCURRENCY = shouldUploadImagesSerially(uploadableFiles)
        ? 1
        : Math.min(3, queue.length);
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          let next: File | undefined;
          while ((next = queue.shift())) await uploadOne(next);
        }),
      );
      let photosRefreshed = false;
      try {
        await qc.invalidateQueries(
          { queryKey: ["photos"] },
          { cancelRefetch: false, throwOnError: true },
        );
        photosRefreshed = true;
      } catch {
        // 追加写真がまだ一覧に無い状態では選択へ着地させない。
        // 「絞り込みの外」という誤情報を残さず、既存の汎用エラーで知らせる。
        if (uploadGeneration === uploadGenerationRef.current) {
          setActionError(copy.feedback.refreshFailed);
        }
      }
      if (
        photosRefreshed &&
        uploadGeneration === uploadGenerationRef.current &&
        addedPhotoIds.length > 0
      ) {
        const addedIds = new Set(addedPhotoIds);
        pendingRecentlyAddedScrollRef.current = {
          generation: uploadGeneration,
          ids: addedIds,
        };
        onRecentlyAddedPhotoIdsChange(addedIds);
        // applyLibraryMode が選択を消すため、モード変更後のコールバックで
        // 成功分だけを選択する。未保存詳細の確認も従来どおり通る。
        requestLibraryMode("select", () => setSelected(new Set(addedIds)));
      }
    } finally {
      activeUploadProgressRef.current.delete(uploadGeneration);
      syncUploadProgress();
      setRetryFiles(failed.map(({ file }) => file));
      setStorageAlert(storageMissing);
      const parts: string[] = [];
      // 保存先未接続のときは件数トーストではなく専用バナーで説明する
      // (再アップロード連打では直らないため)
      const failedNotice = storageMissing
        ? null
        : localizedUploadFailureNotice(failed);
      if (addedPhotoIds.length > 0 && failed.length > 0) {
        parts.push(
          copy.import.resultSummary(addedPhotoIds.length, failed.length),
        );
      }
      if (failedNotice) parts.push(failedNotice);
      if (tooLargeNotice) parts.push(tooLargeNotice);
      if (duplicates.length)
        parts.push(
          copy.import.duplicateSummary(
            duplicates.length,
            duplicates.slice(0, 3).join(", "),
            duplicates.length > 3,
          ),
        );
      if (skipped > 0) parts.push(copy.import.skippedNonImages(skipped));
      setUploadNotice(parts.length ? parts.join(" / ") : null);
    }
  };

  // Auto-dismiss informational notices, but keep failures visible so the
  // retry action stays available until dismissed or retried.
  useEffect(() => {
    if (!uploadNotice || retryFiles.length > 0) return;
    const t = setTimeout(() => setUploadNotice(null), 6000);
    return () => clearTimeout(t);
  }, [uploadNotice, retryFiles]);

  // Reset meta-save feedback when switching photos
  useEffect(() => {
    setMetaSaved(false);
    setMetaError(false);
    setInspectorMobileSection("basic");
  }, [inspectPhoto?.id]);

  const applyLibraryMode = (
    nextMode: LibraryMode,
    afterChange?: () => void,
  ) => {
    const keepSelection =
      nextMode === "arrange" ||
      (libraryMode === "arrange" && nextMode === "select");
    setLibraryMode(nextMode);
    setPendingLibraryMode(null);
    setReorderExitTimedOut(false);
    setBatchCatOpen(false);
    setBatchSeriesOpen(false);
    setDragSrcId(null);
    setDragOverId(null);
    setPreviewPhoto(null);
    if (!keepSelection) setSelected(new Set());
    if (nextMode !== "arrange") {
      setReorderTargetId(null);
      setReorderPositionValue("");
      setLastMove(null);
      setReorderFailedTargetId(null);
      setReorderUndo(null);
    }
    if (nextMode !== "normal") setInspectPhoto(null);
    afterChange?.();
  };

  const discardFailedReorderAndExit = () => {
    if (!pendingLibraryMode || !reorderFailedOperation) return;
    const nextMode = pendingLibraryMode;
    setOptimisticOrderIds(reorderFailedOperation.beforeIds);
    setReorderFailedOperation(null);
    setReorderFeedback(null);
    setActionError("");
    applyLibraryMode(nextMode);
  };

  // モード切替でも詳細欄の未保存保護を通す。写真切替と同じ確認部品を使い、
  // 確認前には選択・詳細・ドラッグ状態を一切変えない。
  const requestLibraryMode = (
    nextMode: LibraryMode,
    afterChange?: () => void,
  ) => {
    if (
      libraryMode === "arrange" &&
      nextMode !== "arrange" &&
      reorderBusyRef.current
    ) {
      setPendingLibraryMode(nextMode);
      setReorderExitTimedOut(false);
      return;
    }
    if (
      libraryMode === "arrange" &&
      nextMode !== "arrange" &&
      reorderFeedback?.state === "error" &&
      reorderFailedOperation
    ) {
      setPendingLibraryMode(nextMode);
      setReorderExitTimedOut(false);
      return;
    }
    if (nextMode === "arrange") {
      if (!manualOrder.ok) {
        setActionError(copy.feedback.invalidManualOrder);
        return;
      }
      if (publicReorderLockCause !== null) {
        setActionError(
          publicReorderLockCause === "not-manual"
            ? copy.reorder.publicOrderLocked
            : publicReorderLockCause === "error"
              ? copy.reorder.settingsError
              : copy.reorder.settingsLoading,
        );
        return;
      }
      if (reorderBusyRef.current) return;
    }
    const proceed = () => applyLibraryMode(nextMode, afterChange);
    const currentInspectPhoto = inspectPhotoRef.current;
    if (
      nextMode !== "normal" &&
      currentInspectPhoto &&
      photoEditFormChanged(editFormRef.current, currentInspectPhoto)
    ) {
      openConfirmDialog({
        message: copy.feedback.closeInspectorConfirm,
        confirmLabel: copy.feedback.closeInspectorAction,
        onConfirm: proceed,
      });
      return;
    }
    proceed();
  };

  const unlockAndArrange = () => {
    const proceed = () => {
      clearLibraryFilters();
      setLibrarySort("manual");
      applyLibraryMode("arrange");
    };
    const currentInspectPhoto = inspectPhotoRef.current;
    if (
      currentInspectPhoto &&
      photoEditFormChanged(editFormRef.current, currentInspectPhoto)
    ) {
      openConfirmDialog({
        message: copy.feedback.closeInspectorConfirm,
        confirmLabel: copy.feedback.closeInspectorAction,
        onConfirm: proceed,
      });
      return;
    }
    proceed();
  };

  useEffect(() => {
    if (!pendingLibraryMode || reorderBusy) return;
    if (reorderFeedback?.state === "error") {
      if (!reorderFailedOperation) {
        setPendingLibraryMode(null);
        setReorderExitTimedOut(false);
      }
      return;
    }
    applyLibraryMode(pendingLibraryMode);
    // applyLibraryMode intentionally reads the current mode/selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingLibraryMode,
    reorderBusy,
    reorderFailedOperation,
    reorderFeedback?.state,
  ]);

  useEffect(() => {
    if (!pendingLibraryMode || !reorderBusy || reorderNeedsReload) return;
    const timer = window.setTimeout(() => setReorderExitTimedOut(true), 2000);
    return () => window.clearTimeout(timer);
  }, [pendingLibraryMode, reorderBusy, reorderNeedsReload]);

  const selectRangeThrough = (photo: Photo, idx: number) => {
    const lastIdx =
      lastClicked === null
        ? -1
        : displayed.findIndex((p) => p.id === lastClicked);
    if (lastIdx < 0) {
      setSelected(new Set([photo.id]));
      return;
    }
    const start = Math.min(lastIdx, idx);
    const end = Math.max(lastIdx, idx);
    const range = displayed.slice(start, end + 1).map((p) => p.id);
    setSelected((prev) => {
      const next = new Set(prev);
      range.forEach((id) => next.add(id));
      return next;
    });
  };

  // 閲覧=詳細、選択=選択/解除、並べ替え=対象を1枚だけ指定する。
  // Cmd/Ctrl・Shiftクリックは従来どおり選択モードへの近道として残す。
  const handlePhotoClick = (photo: Photo, idx: number, e: React.MouseEvent) => {
    if (libraryMode === "arrange") {
      if (reorderLocked || reorderBusyRef.current) return;
      setReorderTargetId(photo.id);
      setReorderPositionValue(String(idx + 1));
      setLastClicked(photo.id);
      setLastMove(null);
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            `#admin-photo-${photo.id} [data-library-photo-action]`,
          )
          ?.focus();
      });
      return;
    }

    if (libraryMode === "normal" && !(e.metaKey || e.ctrlKey || e.shiftKey)) {
      guardInspectorSwitch(photo, () => {
        setSelected(new Set());
        openInspectorFor(photo);
        setLastClicked(photo.id);
      });
      return;
    }

    if (libraryMode === "normal") {
      requestLibraryMode("select", () => {
        if (e.shiftKey) selectRangeThrough(photo, idx);
        else setSelected(new Set([photo.id]));
        setLastClicked(photo.id);
      });
      return;
    }

    if (e.shiftKey) {
      selectRangeThrough(photo, idx);
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(photo.id)) next.delete(photo.id);
        else next.add(photo.id);
        return next;
      });
    }
    setLastClicked(photo.id);
  };

  // Move a photo by ±1 / to the start/end of the VISIBLE list (series scope
  // aware — see lib/reorder.ts for the subset-vs-global splice semantics).
  const movePhoto = (id: number, delta: number) => {
    if (
      libraryMode !== "arrange" ||
      reorderLocked ||
      reorderBusyRef.current
    )
      return;
    const ids = moveRelativeToViewNeighbor(
      allPhotos.map((p) => p.id),
      displayed.map((p) => p.id),
      id,
      delta,
    );
    if (ids) {
      const from = displayed.findIndex((photo) => photo.id === id) + 1;
      const to = from + delta;
      savePhotoOrder(ids, {
        move: { id, from, to },
        afterConfirmed: () => {
          scrollLibraryIndexIntoView(to - 1);
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>(
                `#admin-photo-${id} [data-library-photo-action]`,
              )
              ?.focus(),
          );
        },
      });
    }
  };

  const movePhotoTo = (id: number, pos: "start" | "end") => {
    if (
      libraryMode !== "arrange" ||
      reorderLocked ||
      reorderBusyRef.current
    )
      return;
    const ids = moveToViewEdge(
      allPhotos.map((p) => p.id),
      displayed.map((p) => p.id),
      id,
      pos,
    );
    if (ids) {
      const from = displayed.findIndex((photo) => photo.id === id) + 1;
      const to = pos === "start" ? 1 : displayed.length;
      savePhotoOrder(ids, {
        move: { id, from, to },
        afterConfirmed: () => {
          scrollLibraryIndexIntoView(to - 1);
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>(
                `#admin-photo-${id} [data-library-photo-action]`,
              )
              ?.focus(),
          );
        },
      });
    }
  };

  const movePhotoToNumber = (id: number, oneBasedPosition: number) => {
    if (
      libraryMode !== "arrange" ||
      reorderLocked ||
      reorderBusyRef.current
    )
      return;
    const ids = moveToViewPosition(
      allPhotos.map((photo) => photo.id),
      displayed.map((photo) => photo.id),
      id,
      oneBasedPosition,
    );
    if (ids) {
      const from = displayed.findIndex((photo) => photo.id === id) + 1;
      savePhotoOrder(ids, {
        move: { id, from, to: oneBasedPosition },
        afterConfirmed: () => {
          scrollLibraryIndexIntoView(oneBasedPosition - 1);
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>(
                `#admin-photo-${id} [data-library-photo-action]`,
              )
              ?.focus(),
          );
        },
      });
    }
  };

  const rotateLibraryPhoto = (photo: Photo, delta: -90 | 90) => {
    quickRotatePhoto.mutate({
      id: photo.id,
      rotationDeg: rotatedBy(photo.rotationDeg, delta),
      delta,
    });
  };

  const rotateActivePhotos = (
    operation: Extract<BatchPhotoOperation, "rotate_left" | "rotate_right">,
  ) => {
    if (libraryMode === "arrange") return;
    if (batchOp.isPending || quickRotatePhoto.isPending) return;
    if (libraryMode === "select" && selected.size > 0) {
      batchOp.mutate({ operation });
      return;
    }
    if (libraryMode === "select") return;
    if (lastClicked === null) return;
    const photo =
      displayed.find((p) => p.id === lastClicked) ??
      allPhotos.find((p) => p.id === lastClicked);
    if (!photo) return;
    rotateLibraryPhoto(photo, operation === "rotate_left" ? -90 : 90);
  };

  useEffect(() => {
    if (libraryScrollRestoredRef.current || displayed.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const stored = readStoredState<number>(
      "admin:libraryScrollTop",
      getStorage("local"),
    );
    libraryScrollRestoredRef.current = true;
    if (!stored || stored <= 0) return;
    requestAnimationFrame(() => {
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTop = Math.min(stored, maxScroll);
    });
  }, [displayed.length]);

  const rememberLibraryScroll = (el: HTMLDivElement) => {
    libraryScrollPendingTopRef.current = el.scrollTop;
    if (libraryScrollSaveRafRef.current !== null) return;
    libraryScrollSaveRafRef.current = requestAnimationFrame(() => {
      libraryScrollSaveRafRef.current = null;
      try {
        getStorage("local")?.setItem(
          "admin:libraryScrollTop",
          JSON.stringify(libraryScrollPendingTopRef.current),
        );
      } catch {
        /* storage unavailable: the scroll position just stays in-memory */
      }
    });
  };
  useEffect(
    () => () => {
      if (libraryScrollSaveRafRef.current !== null)
        cancelAnimationFrame(libraryScrollSaveRafRef.current);
    },
    [],
  );

  // Auto-scroll the photo grid while dragging near the container's top/bottom edge,
  // so a photo can be dragged across a library taller than the viewport without
  // dropping mid-way to scroll. Velocity scales with edge proximity; a rAF loop
  // keeps scrolling even while the pointer (and thus dragover events) holds still.
  const dragScrollVel = useRef(0);
  const dragScrollRaf = useRef<number | null>(null);
  const stopDragScroll = () => {
    dragScrollVel.current = 0;
    if (dragScrollRaf.current !== null) {
      cancelAnimationFrame(dragScrollRaf.current);
      dragScrollRaf.current = null;
    }
  };
  const updateDragScroll = (clientY: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const zone = 72;
    let v = 0;
    if (clientY < r.top + zone) v = -Math.ceil((r.top + zone - clientY) / 5);
    else if (clientY > r.bottom - zone)
      v = Math.ceil((clientY - (r.bottom - zone)) / 5);
    dragScrollVel.current = v;
    if (v !== 0 && dragScrollRaf.current === null) {
      const step = () => {
        const sc = scrollRef.current;
        if (dragScrollVel.current === 0 || !sc) {
          dragScrollRaf.current = null;
          return;
        }
        sc.scrollTop += dragScrollVel.current;
        scheduleLibraryGridMeasure();
        dragScrollRaf.current = requestAnimationFrame(step);
      };
      dragScrollRaf.current = requestAnimationFrame(step);
    }
  };
  useEffect(() => stopDragScroll, []); // never leave the rAF loop running after unmount

  // Drag reorder (no-op while locked so the drop indicator never appears)
  const handleDragStart = (id: number) => {
    if (
      libraryMode === "arrange" &&
      !reorderLocked &&
      !reorderBusyRef.current
    ) {
      setDragSrcId(id);
      setReorderTargetId(id);
      setLastClicked(id);
      const index = displayed.findIndex((photo) => photo.id === id);
      if (index >= 0) setReorderPositionValue(String(index + 1));
    }
  };
  const handleDragOver = (e: React.DragEvent, id: number) => {
    if (
      libraryMode !== "arrange" ||
      reorderLocked ||
      reorderBusyRef.current
    )
      return;
    e.preventDefault();
    setDragOverId(id);
    updateDragScroll(e.clientY);
  };
  const handleDrop = (targetId: number) => {
    stopDragScroll();
    if (dragSrcId === null || dragSrcId === targetId) {
      setDragSrcId(null);
      setDragOverId(null);
      return;
    }
    // ロック中（複合フィルター・並び替え表示）はドロップを無視。シリーズ単独
    // 絞り込みは許可 — グローバル index への splice なので順序は壊れない。
    if (
      libraryMode !== "arrange" ||
      reorderLocked ||
      reorderBusyRef.current
    ) {
      setDragSrcId(null);
      setDragOverId(null);
      return;
    }
    const ids = moveBeforeViewTarget(
      allPhotos.map((photo) => photo.id),
      displayed.map((photo) => photo.id),
      dragSrcId,
      targetId,
    );
    if (ids) {
      const movedId = dragSrcId;
      const from = displayed.findIndex((photo) => photo.id === movedId) + 1;
      const viewIds = new Set(displayed.map((photo) => photo.id));
      const to =
        ids.filter((id) => viewIds.has(id)).findIndex((id) => id === movedId) +
        1;
      savePhotoOrder(ids, {
        move: { id: movedId, from, to },
        afterConfirmed: () => {
          scrollLibraryIndexIntoView(to - 1);
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>(
                `#admin-photo-${movedId} [data-library-photo-action]`,
              )
              ?.focus(),
          );
        },
      });
    }
    setDragSrcId(null);
    setDragOverId(null);
  };

  // Open the inspector for a photo (shared by click + Enter)
  const openInspector = (photo: Photo) => {
    setInspectPhoto(photo);
    setEditForm(photoToEditForm(photo));
  };

  // 既に同じ写真を開いている時は再オープンしない — openInspector は
  // editForm を保存値でリセットするため、下書きの無言消失につながる。
  const openInspectorFor = (photo: Photo) => {
    if (inspectPhoto?.id === photo.id) return;
    openInspector(photo);
  };

  // ×/Escape 保護(requestCloseInspector)を写真切替にも拡張(Codex経由
  // 2026-07-11)。未保存の下書きがある間、別写真への切替(クリック/矢印/
  // Enter)は明示確認を通す。キャンセル時は現在の写真・入力内容・選択状態を
  // すべて維持するため、切替の副作用は proceed に閉じ込めて丸ごと保留する。
  const guardInspectorSwitch = (target: Photo, proceed: () => void): void => {
    if (
      inspectPhoto &&
      inspectPhoto.id !== target.id &&
      photoEditFormChanged(editForm, inspectPhoto)
    ) {
      openConfirmDialog({
        message: copy.feedback.switchPhotoConfirm,
        confirmLabel: copy.feedback.switchPhotoAction,
        onConfirm: proceed,
      });
      return;
    }
    proceed();
  };

  // ×/Escape での閉じは未保存の編集を無言で失わない(背景タップ保護と一貫、
  // Codexレビュー 2026-07-11)。編集がなければ即閉じ、あれば既存の
  // confirmDialog(キャンセル=編集を続ける)で明示確認してから破棄する。
  const requestCloseInspector = () => {
    if (inspectPhoto && photoEditFormChanged(editForm, inspectPhoto)) {
      openConfirmDialog({
        message: copy.feedback.closeInspectorConfirm,
        confirmLabel: copy.feedback.closeInspectorAction,
        onConfirm: () => setInspectPhoto(null),
      });
      return;
    }
    setInspectPhoto(null);
  };

  const saveInspectorChanges = () => {
    if (!inspectPhoto) return;
    setMetaSaved(false);
    setMetaError(false);
    const shotAtToSave = shotAtForDateInputSave(
      inspectPhoto.shotAt,
      editForm.shotAt,
    );
    updatePhoto.mutate(
      {
        id: inspectPhoto.id,
        ...editForm,
        shotAt: shotAtToSave,
      },
      {
        onSuccess: () => {
          setInspectPhoto({
            ...inspectPhoto,
            ...editForm,
            shotAt: shotAtToSave ?? null,
            seriesId:
              editForm.seriesId === "" ? null : Number(editForm.seriesId),
          });
          rememberPresets(editForm.camera, editForm.lens);
          setMetaSaved(true);
          setTimeout(() => setMetaSaved(false), 1500);
        },
        onError: () => setMetaError(true),
      },
    );
  };

  const discardInspectorChanges = () => {
    if (!inspectPhoto) return;
    setMetaError(false);
    setEditForm(photoToEditForm(inspectPhoto));
  };

  // C3: move the keyboard cursor (lastClicked) by an offset within `displayed`.
  // 選択モードだけ単独選択へ寄せ、通常モードでは詳細表示用カーソルとして扱う。
  const navByOffset = (offset: number) => {
    if (displayed.length === 0) return;
    const curIdx =
      lastClicked !== null
        ? displayed.findIndex((p) => p.id === lastClicked)
        : -1;
    const nextIdx =
      curIdx < 0
        ? 0
        : Math.min(displayed.length - 1, Math.max(0, curIdx + offset));
    const photo = displayed[nextIdx];
    // 未保存の下書きがある間はガードを通す。キャンセル時はカーソル・選択・
    // プレビュー・スクロールのどれも動かさない。
    guardInspectorSwitch(photo, () => {
      setSelected(
        libraryMode === "select" ? new Set([photo.id]) : new Set(),
      );
      setLastClicked(photo.id);
      setPreviewPhoto((prev) => (prev ? photo : prev)); // keep quick-preview in sync if open
      if (libraryMode === "normal" && inspectPhoto) openInspectorFor(photo);
      scrollLibraryIndexIntoView(nextIdx);
      requestAnimationFrame(() =>
        document
          .getElementById(`admin-photo-${photo.id}`)
          ?.scrollIntoView?.({ block: "nearest" }),
      );
    });
  };

  // Number of grid columns, derived from the rendered grid width / thumb size.
  // auto-fill minmax と同じ式(gap 込み)で数え、実効幅を使う — ここが CSS と
  // ずれると ↑↓ の移動先が実際の列数と食い違う。
  const gridCols = () => {
    const w = gridRef.current?.clientWidth ?? 0;
    return Math.max(
      1,
      Math.floor(
        (w + LIBRARY_GRID_GAP) / (effectiveThumbSize + LIBRARY_GRID_GAP),
      ),
    );
  };

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;

      // An open modal dialog owns the keyboard: without this, Esc would ALSO
      // clear the selection underneath, and Delete would trash the selection
      // from under a confirm dialog. <dialog> closes itself via `cancel`.
      if (document.querySelector("dialog[open]")) return;

      if (typing) return;

      // ? — shortcuts help (Shift+/ on most layouts)
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      // Escape closes overlays in priority order, then exits the current mode.
      if (e.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (previewPhoto) {
          setPreviewPhoto(null);
          return;
        }
        if (libraryMode === "arrange" && reorderTargetId !== null) {
          e.preventDefault();
          setReorderTargetId(null);
          setReorderPositionValue("");
          setLastMove(null);
          return;
        }
        if (libraryMode !== "normal") {
          requestLibraryMode("normal");
          return;
        }
        if (inspectPhoto) {
          // 未保存編集の無言破棄を防ぐ(×と同じ確認導線)
          requestCloseInspector();
          return;
        }
        if (recentlyAddedPhotoIds.size > 0) {
          dismissRecentlyAdded();
          return;
        }
      }

      if (showTrash) return; // grid nav only applies to the library view

      if (e.key === "Delete" || e.key === "Backspace") {
        if (
          libraryMode === "select" &&
          selected.size > 0 &&
          !bulkBusyRef.current
        ) {
          e.preventDefault();
          // Trash is reversible (undo toast + 30-day retention) — no confirm.
          deletePhotos.mutate(Array.from(selected));
        }
        return;
      }
      if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        requestLibraryMode("select", () =>
          setSelected(new Set(displayed.map((p) => p.id))),
        );
        return;
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "[") {
        e.preventDefault();
        rotateActivePhotos("rotate_left");
        return;
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "]") {
        e.preventDefault();
        rotateActivePhotos("rotate_right");
        return;
      }
      if (libraryMode === "arrange") {
        if (
          (e.key === "Enter" || e.key === " ") &&
          lastClicked !== null &&
          !reorderLocked &&
          !reorderBusyRef.current
        ) {
          const index = displayed.findIndex(
            (photo) => photo.id === lastClicked,
          );
          if (index >= 0) {
            e.preventDefault();
            setReorderTargetId(lastClicked);
            setReorderPositionValue(String(index + 1));
            setLastMove(null);
          }
          return;
        }
        if (reorderTargetId === null) return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          movePhoto(reorderTargetId, -1);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          movePhoto(reorderTargetId, 1);
          return;
        }
        if (e.key === "Home") {
          e.preventDefault();
          movePhotoTo(reorderTargetId, "start");
          return;
        }
        if (e.key === "End") {
          e.preventDefault();
          movePhotoTo(reorderTargetId, "end");
          return;
        }
        return;
      }
      // Arrow navigation
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navByOffset(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navByOffset(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        navByOffset(-gridCols());
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        navByOffset(gridCols());
        return;
      }
      // Enter — open inspector for the cursor photo
      if (
        libraryMode === "normal" &&
        e.key === "Enter" &&
        lastClicked !== null
      ) {
        const photo = displayed.find((p) => p.id === lastClicked);
        if (photo) {
          e.preventDefault();
          guardInspectorSwitch(photo, () => openInspectorFor(photo));
        }
        return;
      }
      // Space — quick preview (toggle) for the cursor photo
      if (
        libraryMode === "normal" &&
        e.key === " " &&
        lastClicked !== null
      ) {
        const photo = displayed.find((p) => p.id === lastClicked);
        if (photo) {
          e.preventDefault();
          setPreviewPhoto((prev) => (prev ? null : photo));
        }
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selected,
    displayed,
    lastClicked,
    showTrash,
    previewPhoto,
    showShortcuts,
    effectiveThumbSize,
    inspectPhoto,
    libraryMode,
    reorderTargetId,
    reorderLocked,
    reorderBusy,
    recentlyAddedPhotoIds,
    dismissRecentlyAdded,
    // requestCloseInspector が最新の下書きを見て未保存判定できるように
    editForm,
  ]);

  // Undo toast auto-dismiss after 5s
  useEffect(() => {
    if (!undoToast) return;
    const t = setTimeout(() => setUndoToast(null), 5000);
    return () => clearTimeout(t);
  }, [undoToast]);

  // Color label per category.
  // 彩度の高い原色(旧: #4a90d9 / #d9534f / #5cb85c …)は、写真の上に載ると
  // 写真より先に目に入り、汎用の管理ツールの顔になっていた。
  // design-spec §3「写真以外で色を主張しない」に合わせ、明度をそろえた
  // 低彩度の色に置き換える。区別はつくが、写真の邪魔をしない。
  const catColors: Record<string, string> = {};
  const palette = [
    "#6f8391",
    "#9a7b6b",
    "#78876c",
    "#a08a5b",
    "#8a7f96",
    "#a1746b",
    "#6f8a86",
    "#8a7d70",
  ];
  categories.forEach((c, i) => {
    catColors[c.slug] = palette[i % palette.length];
  });
  const reorderTarget =
    reorderTargetId === null
      ? null
      : displayed.find((photo) => photo.id === reorderTargetId) ?? null;
  const reorderTargetPosition =
    reorderTargetId === null
      ? 0
      : displayed.findIndex((photo) => photo.id === reorderTargetId) + 1;
  const parsedReorderPosition = Number(reorderPositionValue);
  const reorderPositionInvalid =
    !Number.isInteger(parsedReorderPosition) ||
    parsedReorderPosition < 1 ||
    parsedReorderPosition > displayed.length;

  return (
    <div
      className="admin-workspace flex h-full"
      data-admin-workspace="library"
      data-library-mode={libraryMode}
    >
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {libraryMode === "arrange" && (
          <header
            data-library-mobile-reorder-header
            className="admin-library-mobile-reorder-header md:hidden"
          >
            <div className="min-w-0">
              <strong>{copy.reorder.mobileTitle}</strong>
            </div>
            <div className="flex items-center gap-1">
              {reorderUndo && !reorderBusy && (
                <button
                  type="button"
                  onClick={undoPhotoOrder}
                  className="admin-tap px-2 text-[length:var(--admin-text-note)]"
                >
                  {copy.reorder.undo}
                </button>
              )}
              <button
                type="button"
                data-library-mode-action="finish-arrange"
                onClick={() => requestLibraryMode("normal")}
                className="admin-tap px-2 text-[length:var(--admin-text-note)]"
              >
                {copy.mode.finishArrange}
              </button>
            </div>
          </header>
        )}
        {libraryMode === "arrange" &&
          pendingLibraryMode &&
          (reorderBusy || reorderFailedOperation) && (
            <section
              data-library-reorder-exit-guard
              data-library-reorder-exit-state={
                reorderNeedsReload
                  ? "reload-required"
                  : reorderBusy
                  ? reorderExitTimedOut
                    ? "waiting-choice"
                    : "saving"
                  : "failed"
              }
              role={reorderBusy && !reorderNeedsReload ? "status" : "alert"}
              aria-live="polite"
              className={`admin-library-reorder-exit-guard ${
                reorderBusy && !reorderNeedsReload ? "" : "is-error"
              }`}
            >
              <span>
                {reorderNeedsReload
                  ? copy.feedback.reorderRefreshFailed
                  : reorderBusy
                  ? copy.reorder.exitSaving
                  : copy.reorder.failedExit(1)}
              </span>
              {reorderNeedsReload && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingLibraryMode(null);
                      setReorderExitTimedOut(false);
                    }}
                  >
                    {copy.reorder.stayAfterRefreshFailure}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                  >
                    {copy.reorder.reloadAfterRefreshFailure}
                  </button>
                </div>
              )}
              {!reorderNeedsReload && reorderBusy && reorderExitTimedOut && (
                <div>
                  <button
                    type="button"
                    onClick={() => setReorderExitTimedOut(false)}
                  >
                    {copy.reorder.continueWaiting}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingLibraryMode(null);
                      setReorderExitTimedOut(false);
                    }}
                  >
                    {copy.reorder.cancelExitWait}
                  </button>
                </div>
              )}
              {!reorderNeedsReload &&
                !reorderBusy &&
                reorderFailedOperation && (
                <div>
                  <button type="button" onClick={retryFailedPhotoOrder}>
                    {copy.reorder.retryFailedSave}
                  </button>
                  <button
                    type="button"
                    onClick={discardFailedReorderAndExit}
                  >
                    {copy.reorder.discardFailedAndExit}
                  </button>
                </div>
              )}
            </section>
          )}
        <div
          className={`admin-workspace__header flex-shrink-0 ${
            libraryMode === "arrange" ? "hidden md:block" : ""
          }`}
        >
          <PageHeader
            title="Library"
            description={
              // 読込中に "0 / 0 photos" と断定表示しない — 写真家には消失に見える
              isLoading ? (
                <span aria-label={t.headers.libraryLoading}>
                  … {t.headers.libraryPhotos}
                </span>
              ) : (
                <>
                  <CountSwap value={displayed.length} /> /{" "}
                  <CountSwap value={allPhotos.length} /> {t.headers.libraryPhotos}
                </>
              )
            }
            actions={
              <PageHeaderButton
                active={showSitePreview}
                onClick={() => setShowSitePreview(!showSitePreview)}
                ariaLabel={
                  showSitePreview ? t.headers.closeViewSite : t.headers.viewSite
                }
              >
                {showSitePreview ? <EyeOff size={13} /> : <Eye size={13} />}
                {t.headers.viewSite}
              </PageHeaderButton>
            }
          />
        </div>
        {/* Workspace bar: one mode switcher on the left, find/view tools on the right. */}
        <div className="admin-library-workbar">
          <div className="admin-library-workbar__row">
            {libraryMode === "normal" && (
              <button
                type="button"
                data-library-mobile-select
                onClick={() => requestLibraryMode("select")}
                disabled={uploading || showTrash || bulkEditMode || displayed.length === 0}
                className="admin-library-mobile-select md:hidden"
              >
                {copy.mode.select}
              </button>
            )}
            <fieldset
              aria-label={copy.mode.group}
              data-library-mode-switcher
              className={`admin-library-mode-switcher ${
                libraryMode === "arrange" ? "max-md:hidden" : ""
              }`}
            >
              {(
                [
                  ["normal", copy.mode.normal],
                  ["select", copy.mode.select],
                  ["arrange", copy.mode.arrange],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  data-library-mode-action={mode}
                  aria-pressed={libraryMode === mode}
                  onClick={() => requestLibraryMode(mode)}
                  disabled={
                    mode === "select"
                      ? uploading ||
                        showTrash ||
                        bulkEditMode ||
                        displayed.length === 0
                      : mode === "arrange"
                        ? uploading ||
                          showTrash ||
                          bulkEditMode ||
                          allPhotos.length === 0 ||
                          !manualOrder.ok ||
                          reorderBusy ||
                          publicReorderLockCause !== null ||
                          reorderLockCause !== null
                        : false
                  }
                  title={
                    mode !== "arrange"
                      ? undefined
                      : !manualOrder.ok
                        ? copy.feedback.invalidManualOrder
                        : publicReorderLockCause === "not-manual"
                          ? copy.reorder.publicOrderLocked
                          : publicReorderLockCause === "error"
                            ? copy.reorder.settingsError
                            : publicReorderLockCause === "loading"
                              ? copy.reorder.settingsLoading
                              : reorderLockCause === "sort"
                                ? copy.reorder.lockedBySort
                                : reorderLockCause === "filters"
                                  ? copy.reorder.lockedByFilter
                              : undefined
                  }
                >
                  {label}
                </button>
              ))}
            </fieldset>
            {libraryMode !== "arrange" && (
              <div className="admin-library-find-tools">
                <div className="admin-library-search">
                  <Search size={12} aria-hidden="true" />
                  <input
                    type="search"
                    data-library-search-input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={copy.filters.searchPlaceholder}
                    aria-label={copy.filters.searchAria}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label={copy.filters.clearSearch}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  data-library-filters-toggle
                  onClick={() => setShowLibraryFilters((value) => !value)}
                  aria-expanded={showLibraryFilters}
                  className={
                    showLibraryFilters || anyFilterActive
                      ? "is-active"
                      : undefined
                  }
                >
                  <SlidersHorizontal size={12} /> {copy.toolbar.filters}
                  {filterBadgeCount > 0 && (
                    <span data-library-filter-count>{filterBadgeCount}</span>
                  )}
                </button>
              </div>
            )}
            {libraryMode === "normal" && (
              <>
            {!manualOrder.ok && (
              <span
                role="alert"
                className="admin-text-warning text-[length:var(--admin-text-note)]"
              >
                {copy.feedback.invalidManualOrder}
              </span>
            )}
            {manualOrder.ok && publicReorderLockCause !== null && (
              <span
                role={publicReorderLockCause === "loading" ? "status" : "alert"}
                data-library-public-order-lock={publicReorderLockCause}
                className="admin-text-warning text-[length:var(--admin-text-note)]"
              >
                {publicReorderLockCause === "not-manual"
                  ? copy.reorder.publicOrderLocked
                  : publicReorderLockCause === "error"
                    ? copy.reorder.settingsError
                    : copy.reorder.settingsLoading}
              </span>
            )}
            {manualOrder.ok &&
              publicReorderLockCause === null &&
              reorderLockCause !== null && (
                <span
                  data-library-reorder-entry-lock={reorderLockCause}
                  className="admin-library-reorder-entry-lock text-[length:var(--admin-text-note)]"
                >
                  <span>
                    {reorderLockCause === "sort"
                      ? copy.reorder.lockedBySort
                      : copy.reorder.lockedByFilter}
                  </span>
                  <button type="button" onClick={unlockAndArrange}>
                    {copy.reorder.unlockAndArrange}
                  </button>
                </span>
              )}
            <details className="admin-library-view-menu">
              <summary>
                <Grid size={12} />
                {copy.toolbar.view}
                <ChevronDown size={11} />
              </summary>
              <div className="admin-library-view-menu__panel">
            {/* U1: view sort — display-only until explicitly written to sortOrder */}
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] tracking-wider">
                {copy.sort.label}
              </span>
              <select
                data-library-sort
                value={librarySort}
                onChange={(e) => setLibrarySort(e.target.value)}
                aria-label={copy.sort.ariaLabel}
                className="admin-tap-sm bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border border-[var(--admin-line)] outline-none"
              >
                <option value="manual">{copy.sort.options.manual}</option>
                <option value="createdAt-desc">
                  {copy.sort.options.uploadedNewest}
                </option>
                <option value="createdAt-asc">
                  {copy.sort.options.uploadedOldest}
                </option>
                <option value="shotAt-desc">
                  {copy.sort.options.dateNewest}
                </option>
                <option value="shotAt-asc">
                  {copy.sort.options.dateOldest}
                </option>
                <option value="series">{copy.sort.options.series}</option>
                <option value="size">{copy.sort.options.displaySize}</option>
                <option value="filmType">{copy.sort.options.medium}</option>
                <option value="camera">{copy.sort.options.camera}</option>
                <option value="category">{copy.sort.options.category}</option>
                <option value="title">{copy.sort.options.title}</option>
                <option value="published">
                  {copy.sort.options.publication}
                </option>
                <option value="random">{copy.sort.options.random}</option>
              </select>
              {librarySort !== "manual" && (
                <button
                  disabled={
                    anyFilterActive ||
                    reorderBusy ||
                    publicReorderLockCause !== null
                  }
                  title={
                    anyFilterActive
                      ? copy.sort.clearFiltersFirst
                      : publicReorderLockCause === "not-manual"
                        ? copy.reorder.publicOrderLocked
                        : publicReorderLockCause === "error"
                          ? copy.reorder.settingsError
                          : publicReorderLockCause === "loading"
                            ? copy.reorder.settingsLoading
                            : copy.sort.saveHint
                  }
                  onClick={() =>
                    openConfirmDialog({
                      message: copy.sort.saveConfirm,
                      confirmLabel: copy.sort.saveAction,
                      onConfirm: () =>
                        savePhotoOrder(
                          sortPhotosForView(allPhotos).map((p) => p.id),
                          {
                            afterConfirmed: () => setLibrarySort("manual"),
                          },
                        ),
                    })
                  }
                  className="text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm admin-btn-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {copy.sort.saveAction}
                </button>
              )}
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Grid size={12} className="text-[var(--admin-muted)]" />
              <input
                aria-label={copy.toolbar.thumbnailSize}
                type="range"
                min={80}
                max={300}
                value={thumbSize}
                onChange={(e) => setThumbSize(Number(e.target.value))}
                className="w-24 accent-[var(--admin-muted)] h-1"
              />
              <Columns size={12} className="text-[var(--admin-muted)]" />
            </div>

            <div
              className="flex md:hidden items-center gap-1"
              aria-label={copy.toolbar.photoColumns}
            >
              {([2, 3] as const).map((columns) => (
                <button
                  key={columns}
                  type="button"
                  aria-label={copy.toolbar.columns(columns)}
                  aria-pressed={mobileLibraryColumns === columns}
                  onClick={() => setMobileLibraryColumns(columns)}
                  className={`min-w-9 admin-tap-sm px-2 py-1 rounded-sm border text-[length:var(--admin-text-note)] transition-colors ${
                    mobileLibraryColumns === columns
                      ? "bg-[var(--admin-ink)] text-[var(--admin-paper)] border-[var(--admin-ink)]"
                      : "text-[var(--admin-muted)] border-[var(--admin-line)]"
                  }`}
                >
                  {copy.toolbar.columnsText(columns)}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setBulkEditMode((v) => !v);
                setInspectPhoto(null);
                setSelected(new Set());
              }}
              aria-pressed={bulkEditMode}
              title={copy.toolbar.tableMode}
              className={`flex items-center gap-1 text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border transition-colors ${
                bulkEditMode
                  ? ""
                  : "text-[var(--admin-muted)] border-[var(--admin-line)]"
              }`}
            >
              <LayoutList size={11} /> {copy.toolbar.table}
            </button>

            <button
              onClick={() => {
                setShowTrash((v) => !v);
                setSelected(new Set());
                setInspectPhoto(null);
              }}
              aria-pressed={showTrash}
              className="flex items-center gap-1 text-[length:var(--admin-text-note)] px-2.5 py-1 rounded-sm border border-[var(--admin-line)] text-[var(--admin-muted)] transition-colors"
            >
              <Trash2 size={11} />
              {copy.toolbar.trash}
              {(trashData?.photos?.length ?? 0) > 0 &&
                ` (${trashData!.photos.length})`}
            </button>

            <button
              onClick={() => setShowShortcuts(true)}
              title={copy.toolbar.shortcutsTitle}
              aria-label={copy.toolbar.shortcutsAria}
              className="admin-tap-sm flex items-center justify-center w-6 h-6 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] rounded-sm border border-[var(--admin-line)] transition-colors"
            >
              ?
            </button>
            <button
              type="button"
              data-library-mobile-arrange
              onClick={() => requestLibraryMode("arrange")}
              disabled={
                uploading || showTrash || bulkEditMode || allPhotos.length === 0 ||
                !manualOrder.ok || reorderBusy || publicReorderLockCause !== null ||
                reorderLockCause !== null
              }
              className="md:hidden flex items-center gap-1 text-[length:var(--admin-text-note)] px-2.5 py-1 rounded-sm border border-[var(--admin-line)] text-[var(--admin-muted)] disabled:opacity-40"
            >
              <GripVertical size={11} /> {copy.mode.arrange}
            </button>
              </div>
            </details>

              </>
            )}
            {/* 取り込みは「一番強い操作」なので、探す/見る操作とは細い罫で分けて
                作業バーの右端に置く。以前はページ見出しの中にあり、見出しの行が
                操作で埋まって「写真より UI が目立つ」原因になっていた。
                **閲覧中だけでなく選択中も出す。** 移設時に「通常モードのみ」の
                かたまりへ入れてしまい、選択モードで取り込めなくなっていた
                (Codex独立監査 2026-07-31 指摘)。並べ替え中だけは出さない。 */}
            {libraryMode !== "arrange" && (
            <div
              className="admin-library-import-group"
              data-library-exit-actions
            >
              <fieldset
                aria-label={copy.import.mediumAria}
                title={copy.import.mediumHint}
                className="admin-library-import-medium"
              >
                <span>{copy.import.mediumLabel}</span>
                {[
                  ["digital", copy.import.digital] as const,
                  ["film", copy.import.film] as const,
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setUploadMedium(value)}
                    aria-pressed={uploadMedium === value}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="admin-library-import-button admin-btn-primary"
              >
                <Upload size={13} /> {copy.import.action}
              </button>
              <input
                aria-label={copy.import.chooseImages}
                ref={fileInputRef}
                type="file"
                accept={UPLOAD_IMAGE_ACCEPT}
                multiple
                className="hidden"
                onChange={(event) =>
                  handleFiles(Array.from(event.target.files ?? []))
                }
              />
            </div>
            )}
          </div>

          {libraryMode !== "arrange" &&
            !showTrash &&
            showLibraryFilters && (
            <div data-library-filter-sheet className="admin-library-filter-sheet border-t border-[var(--admin-line)] pt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                  className="bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border border-[var(--admin-line)] outline-none"
                >
                  <option value="all">
                    {copy.filters.categoryAll(allPhotos.length)}
                  </option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label} (
                      {allPhotos.filter((p) => p.category === c.slug).length})
                    </option>
                  ))}
                  {allPhotos.some(isUncategorized) && (
                    <option value="__uncat__">
                      {copy.filters.uncategorized} ({allPhotos.filter(isUncategorized).length})
                    </option>
                  )}
                </select>

                <select
                  value={filterSeries}
                  onChange={(e) => setFilterSeries(e.target.value)}
                  aria-label={copy.filters.seriesAria}
                  className="bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border border-[var(--admin-line)] outline-none"
                >
                  <option value="all">{copy.filters.seriesAll}</option>
                  {seriesList.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.title} (
                      {allPhotos.filter((p) => p.seriesId === s.id).length})
                    </option>
                  ))}
                  <option value="__none__">
                    {copy.filters.unassigned} (
                    {allPhotos.filter((p) => p.seriesId == null).length})
                  </option>
                </select>

                <select
                  value={filterSize}
                  onChange={(e) => setFilterSize(e.target.value)}
                  aria-label={copy.filters.displaySizeAria}
                  className="bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border border-[var(--admin-line)] outline-none"
                >
                  <option value="all">{copy.filters.sizeAll}</option>
                  {(["S", "M", "L"] as const).map((sz) => (
                    <option key={sz} value={sz}>
                      {sz} (
                      {
                        allPhotos.filter((p) => (p.displaySize || "M") === sz)
                          .length
                      }
                      )
                    </option>
                  ))}
                </select>

                <select
                  value={filterMedium}
                  onChange={(e) => setFilterMedium(e.target.value)}
                  aria-label={copy.filters.mediumAria}
                  className="bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border border-[var(--admin-line)] outline-none"
                >
                  <option value="all">{copy.filters.mediumAll}</option>
                  <option value="digital">
                    {copy.filters.mediumDigital} ({mediumCounts.digital})
                  </option>
                  <option value="film">
                    {copy.filters.mediumFilm} ({mediumCounts.film})
                  </option>
                  <option value="missing">
                    {copy.filters.mediumMissing} ({mediumCounts.missing})
                  </option>
                </select>

                <select
                  value={filterOrientation}
                  onChange={(e) => setFilterOrientation(e.target.value)}
                  aria-label={copy.filters.orientationAria}
                  className="bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border border-[var(--admin-line)] outline-none"
                >
                  <option value="all">{copy.filters.orientationAll}</option>
                  <option value="portrait">
                    {copy.filters.portrait} ({orientationCounts.portrait})
                  </option>
                  <option value="landscape">
                    {copy.filters.landscape} ({orientationCounts.landscape})
                  </option>
                  <option value="square">
                    {copy.filters.square} ({orientationCounts.square})
                  </option>
                </select>

                <button
                  onClick={() => setFilterFeatured((v) => !v)}
                  aria-pressed={filterFeatured}
                  className={`flex items-center gap-1 text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border transition-colors ${
                    filterFeatured
                      ? "admin-btn-accent"
                      : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border-[var(--admin-line)]"
                  }`}
                >
                  <Star size={11} /> {copy.filters.featured} ({featuredIds.size})
                </button>

                <select
                  value={filterPublished}
                  onChange={(e) => setFilterPublished(e.target.value)}
                  aria-label={copy.filters.publicationAria}
                  className="bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border border-[var(--admin-line)] outline-none"
                >
                  <option value="all">{copy.filters.publicationAll}</option>
                  <option value="published">
                    {copy.filters.publishedOnly} ({allPhotos.length - unpublishedCount})
                  </option>
                  <option value="unpublished">
                    {copy.filters.unpublishedOnly} ({unpublishedCount})
                  </option>
                </select>

                <button
                  onClick={() => setFilterMissingShotAt((v) => !v)}
                  aria-pressed={filterMissingShotAt}
                  className={`flex items-center gap-1 text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border transition-colors ${
                    filterMissingShotAt
                      ? ""
                      : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border-[var(--admin-line)]"
                  }`}
                >
                  {copy.filters.missingDate} ({missingShotAtCount})
                </button>

                <button
                  onClick={() => setFilterMissingCapture((v) => !v)}
                  aria-pressed={filterMissingCapture}
                  className={`flex items-center gap-1 text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border transition-colors ${
                    filterMissingCapture
                      ? ""
                      : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border-[var(--admin-line)]"
                  }`}
                >
                  {copy.filters.missingCapture} ({missingCaptureCount})
                </button>

                <select
                  value={filterRecent}
                  onChange={(e) => setFilterRecent(e.target.value)}
                  aria-label={copy.filters.uploadedAria}
                  className="bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border border-[var(--admin-line)] outline-none"
                >
                  <option value="all">{copy.filters.timeAll}</option>
                  <option value="7">{copy.filters.recentDays(7)}</option>
                  <option value="30">{copy.filters.recentDays(30)}</option>
                </select>

              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <FolderOpen size={12} className="text-[var(--admin-muted)]" />
                {smartAlbums.map((a) => {
                  const conditionLabels = describeAlbumConditions(a.cond);
                  const shownLabels = conditionLabels.slice(0, 3);
                  const hiddenLabelCount =
                    conditionLabels.length - shownLabels.length;
                  return (
                    <span
                      key={a.id}
                      className={`group/al inline-flex items-center gap-1 text-[length:var(--admin-text-note)] pl-2 pr-1 py-1 rounded-sm border transition-colors ${
                        activeAlbumId === a.id
                          ? "bg-[var(--admin-ink)] text-[var(--admin-paper)] border-[var(--admin-ink)]"
                          : "bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] border-[var(--admin-line)] hover:bg-[var(--admin-paper-deep)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActiveAlbumId((id) => (id === a.id ? null : a.id))
                        }
                        className="flex items-center gap-1.5"
                      >
                        <span>{a.name}</span>
                        {shownLabels.map((label) => (
                          <span
                            key={label}
                            className="max-w-28 truncate rounded-sm bg-black/20 px-1.5 py-0.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)]"
                            title={label}
                          >
                            {label}
                          </span>
                        ))}
                        {hiddenLabelCount > 0 && (
                          <span className="rounded-sm bg-black/20 px-1.5 py-0.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                            +{hiddenLabelCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = smartAlbums.filter((x) => x.id !== a.id);
                          if (activeAlbumId === a.id) setActiveAlbumId(null);
                          saveAlbums.mutate(next);
                        }}
                        aria-label={copy.albums.deleteAria(a.name)}
                        className="admin-danger-on-hover opacity-50 group-hover/al:opacity-100 text-[var(--admin-muted)] transition-[opacity,color] duration-[var(--dur-fast)] ease-[var(--ease-out)]"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
                <button
                  onClick={() => {
                    setAlbumDraft({ ...EMPTY_ALBUM_DRAFT });
                    setAlbumModalOpen(true);
                  }}
                  className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] px-2 py-1 rounded-sm border border-dashed border-[var(--admin-line)] transition-colors"
                >
                  <Plus size={11} /> {copy.albums.add}
                </button>
              </div>
              <footer className="admin-library-filter-sheet__footer">
                <button type="button" onClick={clearLibraryFilters} disabled={!anyFilterActive}>
                  {copy.filters.clearAll}
                </button>
                <span>{displayed.length} {t.headers.libraryPhotos}</span>
              </footer>
            </div>
          )}

          {/* Batch actions */}
          {libraryMode === "select" && !showTrash && (
            <div
              data-library-selection-toolbar
              data-library-selected-count={selected.size}
              className="admin-library-selection-toolbar flex items-center gap-2 flex-wrap"
            >
              <div className="flex items-center gap-2 border-r border-[var(--admin-line)] pr-2 sm:pr-3">
                <span
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-ink)]"
                  aria-live="polite"
                >
                  {selectedOutsideFilters > 0
                    ? copy.selection.selectedWithHidden(
                        selected.size,
                        selectedOutsideFilters,
                      )
                    : copy.selection.selected(selected.size)}
                </span>
                <button
                  type="button"
                  className="admin-selection-cancel"
                  onClick={() => requestLibraryMode("normal")}
                >
                  {copy.mode.endSelection}
                </button>
                {recentlyAddedSelectedCount > 0 && (
                  <span
                    data-library-recently-added-selection
                    className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]"
                  >
                    {copy.selection.recentlyAddedSelected(
                      recentlyAddedSelectedCount,
                    )}
                  </span>
                )}
                <span className="hidden lg:inline text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                  {copy.mode.selectionHint}
                </span>
              </div>
              {selected.size > 0 && (
                <div data-library-batch-actions className="admin-selection-actions">
              {/* M2: Publish / Unpublish */}
              <div className="flex items-center gap-1 bg-[var(--admin-paper-soft)] rounded-sm px-1.5 py-0.5">
                <button
                  onClick={() => batchOp.mutate({ operation: "publish" })}
                  disabled={batchOp.isPending}
                  className="admin-text-success flex items-center gap-1 text-[length:var(--admin-text-note)] px-1.5 py-0.5 rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Eye size={11} /> {copy.selection.publish}
                </button>
                <button
                  onClick={() => batchOp.mutate({ operation: "unpublish" })}
                  disabled={batchOp.isPending}
                  className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] px-1.5 py-0.5 rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <EyeOff size={11} /> {copy.selection.unpublish}
                </button>
              </div>

              <div className="relative" data-batch-cat>
                <button
                  onClick={() => setBatchCatOpen((v) => !v)}
                  className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-ink)] bg-[var(--admin-paper-soft)] px-2.5 py-1 rounded-sm transition-colors"
                >
                  <Tag size={11} /> {copy.selection.setCategory}{" "}
                  <ChevronDown size={10} />
                </button>
                {batchCatOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] rounded-sm shadow-xl z-20 min-w-[140px]">
                    {categories.map((c) => (
                      <button
                        key={c.slug}
                        onClick={() => {
                          batchCategory.mutate({
                            ids: Array.from(selected),
                            category: c.slug,
                          });
                          setBatchCatOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-ink)] transition-colors flex items-center gap-2"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: catColors[c.slug] }}
                        />
                        {c.label}
                      </button>
                    ))}
                    {/* Allow clearing the category back to uncategorized */}
                    <button
                      onClick={() => {
                        batchCategory.mutate({
                          ids: Array.from(selected),
                          category: "",
                        });
                        setBatchCatOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors flex items-center gap-2 border-t border-[var(--admin-line)]"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0 border border-[var(--admin-muted)]" />
                      {copy.selection.uncategorized}
                    </button>
                  </div>
                )}
              </div>

              {/* M2: Set Series */}
              <div className="relative" data-batch-series>
                <button
                  onClick={() => setBatchSeriesOpen((v) => !v)}
                  className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-ink)] bg-[var(--admin-paper-soft)] px-2.5 py-1 rounded-sm transition-colors"
                >
                  <Layers size={11} /> {copy.selection.setSeries}{" "}
                  <ChevronDown size={10} />
                </button>
                {batchSeriesOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] rounded-sm shadow-xl z-20 min-w-[160px] max-h-64 overflow-y-auto">
                    {seriesList.length === 0 && (
                      <div className="px-3 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                        {copy.selection.noSeries}
                      </div>
                    )}
                    {seriesList.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          batchOp.mutate({
                            operation: "series",
                            value: String(s.id),
                          });
                          setBatchSeriesOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-ink)] transition-colors truncate"
                      >
                        {s.title}
                        {s.isPublished ? "" : copy.selection.draftSuffix}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        batchOp.mutate({ operation: "series", value: "" });
                        setBatchSeriesOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors border-t border-[var(--admin-line)]"
                    >
                      {copy.selection.unassign}
                    </button>
                  </div>
                )}
              </div>

              <details className="admin-selection-more">
                <summary>{copy.selection.more}</summary>
                <div className="admin-selection-more__panel">
              {/* M2: Set display size */}
              <div className="flex items-center gap-1 bg-[var(--admin-paper-soft)] rounded-sm px-1.5 py-1">
                <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                  {copy.selection.size}
                </span>
                {(["S", "M", "L"] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() =>
                      batchOp.mutate({ operation: "size", value: sz })
                    }
                    disabled={batchOp.isPending}
                    className="admin-tap-sm text-[length:var(--admin-text-note)] text-[var(--admin-ink)] w-5 h-5 rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {sz}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-[var(--admin-paper-soft)] rounded-sm px-1.5 py-1">
                <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                  {copy.selection.rotate}
                </span>
                <button
                  type="button"
                  onClick={() => batchOp.mutate({ operation: "rotate_left" })}
                  disabled={batchOp.isPending}
                  title={copy.rotation.leftTitle}
                  aria-label={copy.rotation.selectedLeftAria}
                  className="admin-tap-sm w-5 h-5 inline-flex items-center justify-center text-[var(--admin-ink)] rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => batchOp.mutate({ operation: "rotate_right" })}
                  disabled={batchOp.isPending}
                  title={copy.rotation.rightTitle}
                  aria-label={copy.rotation.selectedRightAria}
                  className="admin-tap-sm w-5 h-5 inline-flex items-center justify-center text-[var(--admin-ink)] rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <RotateCw size={12} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    batchOp.mutate({ operation: "reset_rotation" })
                  }
                  disabled={batchOp.isPending}
                  title={copy.rotation.resetTitle}
                  aria-label={copy.rotation.resetAria}
                  className="admin-tap-sm w-6 h-5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  0°
                </button>
                <button
                  type="button"
                  onClick={() =>
                    batchOp.mutate({ operation: "reset_focal_point" })
                  }
                  disabled={batchOp.isPending}
                  title={copy.rotation.resetFocalTitle}
                  aria-label={copy.rotation.resetFocalAria}
                  className="admin-tap-sm w-5 h-5 inline-flex items-center justify-center text-[var(--admin-muted)] rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Crosshair size={12} />
                </button>
              </div>

              <div className="flex items-center gap-1 bg-[var(--admin-paper-soft)] rounded-sm px-1.5 py-1">
                <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                  {copy.selection.date}
                </span>
                <input
                  type="date"
                  value={batchShotAtDate}
                  onChange={(e) => setBatchShotAtDate(e.target.value)}
                  aria-label={copy.selection.dateAria}
                  className="bg-[var(--admin-paper)] text-[var(--admin-ink)] text-[length:var(--admin-text-note)] px-1.5 py-0.5 rounded-sm border border-[var(--admin-line)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!batchShotAtDate || selectedMissingShotAtCount === 0)
                      return;
                    openConfirmDialog({
                      message: copy.selection.dateConfirm(
                        selectedMissingShotAtCount,
                        batchShotAtDate,
                      ),
                      confirmLabel: copy.selection.apply,
                      onConfirm: () =>
                        batchOp.mutate({
                          operation: "shotAt_missing_only",
                          value: batchShotAtDate,
                        }),
                    });
                  }}
                  disabled={
                    batchOp.isPending ||
                    !batchShotAtDate ||
                    selectedMissingShotAtCount === 0
                  }
                  title={copy.selection.applyMissingDateHint}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-ink)] px-1.5 py-0.5 rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  {copy.selection.applyCount(selectedMissingShotAtCount)}
                </button>
                {/* フィルムはR2保存時にEXIFが失われ「EXIFから再読込」ができない
                    ため、代わりに誤った撮影日をクリア→上のDate適用で
                    未設定として拾い直す救済フロー。 */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedFilmShotAtSetCount === 0) return;
                    openConfirmDialog({
                      message: copy.selection.clearFilmDateConfirm(
                        selectedFilmShotAtSetCount,
                      ),
                      confirmLabel: copy.selection.clear,
                      onConfirm: () =>
                        batchOp.mutate({ operation: "shotAt_clear" }),
                    });
                  }}
                  disabled={
                    batchOp.isPending || selectedFilmShotAtSetCount === 0
                  }
                  title={copy.selection.clearFilmDateHint}
                  className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] px-1.5 py-0.5 rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  {copy.selection.clearFilmDate(selectedFilmShotAtSetCount)}
                </button>
              </div>

              {/* M2: feature / unfeature control hero membership. */}
              <button
                onClick={() => batchOp.mutate({ operation: "feature" })}
                disabled={batchOp.isPending}
                className="admin-btn-accent flex items-center gap-1 text-[length:var(--admin-text-note)] px-2.5 py-1 rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Star size={11} /> {copy.selection.addHero}
              </button>
              <button
                onClick={() => batchOp.mutate({ operation: "unfeature" })}
                disabled={batchOp.isPending}
                className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] bg-[var(--admin-paper-soft)] px-2.5 py-1 rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <StarOff size={11} /> {copy.selection.removeHero}
              </button>

              {/* O2: bulk metadata edit */}
              <button
                onClick={() => {
                  setBatchEdit({ camera: "", lens: "", filmType: "" });
                  setBatchEditOpen(true);
                }}
                className="flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-ink)] bg-[var(--admin-paper-soft)] px-2.5 py-1 rounded-sm transition-colors"
              >
                <Pencil size={11} /> {copy.selection.bulkEdit}
              </button>

              <button
                onClick={() => deletePhotos.mutate(Array.from(selected))}
                disabled={bulkBusy}
                className="admin-text-danger flex items-center gap-1 text-[length:var(--admin-text-note)] bg-[var(--admin-paper-soft)] px-2.5 py-1 rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Trash2 size={11} /> {copy.selection.moveToTrash}
              </button>
                </div>
              </details>
                </div>
              )}
            </div>
          )}

          {libraryMode === "arrange" && !showTrash && (
            <div
              data-library-arrange-toolbar
              data-reorder-locked={reorderLocked ? "true" : "false"}
              data-reorder-lock-cause={
                publicReorderLockCause ?? reorderLockCause ?? "none"
              }
              className="flex items-center gap-2 flex-wrap"
            >
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-ink)]">
                {copy.reorder.activeLabel}
              </span>
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                {reorderLocked
                  ? publicReorderLockCause === "not-manual"
                    ? copy.reorder.publicOrderLocked
                    : publicReorderLockCause === "error"
                      ? copy.reorder.settingsError
                      : publicReorderLockCause === "loading"
                        ? copy.reorder.settingsLoading
                        : reorderLockCause === "sort"
                          ? copy.reorder.lockedBySort
                          : copy.reorder.lockedByFilter
                  : reorderTargetPosition > 0
                    ? copy.reorder.targetLabel(reorderTargetPosition)
                    : copy.reorder.targetPrompt}
              </span>
              {reorderLocked && publicReorderLockCause === null && (
                <button
                  type="button"
                  onClick={unlockReorder}
                  className="text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border border-[var(--admin-line-strong)] text-[var(--admin-ink)] bg-[var(--admin-paper-soft)] transition-colors"
                >
                  {copy.reorder.unlock}
                </button>
              )}
              {onlySeriesFilter && (
                <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                  {copy.reorder.seriesPositionHint}
                </span>
              )}
            </div>
          )}
          {libraryMode !== "arrange" &&
            !showTrash &&
            (reorderFeedback || reorderUndo) && (
              <div
                data-library-reorder-status={
                  reorderFeedback?.state ?? "undo-available"
                }
                role={reorderFeedback?.state === "error" ? "alert" : "status"}
                className="flex items-center gap-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)]"
              >
                {reorderFeedback?.state === "saving" && (
                  <Loader2 size={11} className="animate-spin" />
                )}
                <span>{reorderFeedback?.message}</span>
                {reorderUndo && !reorderBusy && (
                  <button
                    type="button"
                    data-library-reorder-undo
                    onClick={undoPhotoOrder}
                    className="px-2 py-1 rounded-sm border border-[var(--admin-line)] text-[var(--admin-ink)]"
                  >
                    {copy.reorder.undo}
                  </button>
                )}
              </div>
            )}
        </div>

        {activeFilterLabels.length > 0 && (
          <div data-library-active-conditions className="admin-library-active-conditions">
            <div>
              {activeFilterLabels.map((condition) => (
                <span key={condition.key} data-library-active-condition={condition.key}>
                  {condition.text}
                  <button
                    type="button"
                    onClick={() => clearLibraryFilter(condition.key)}
                    aria-label={`${condition.text} ${copy.filters.clear}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <button type="button" onClick={clearLibraryFilters}>
              {copy.filters.clearAll}
            </button>
          </div>
        )}

        {/* Upload progress bar */}
        {uploading && uploadProgress && (
          <div className="bg-[var(--admin-paper)] px-4 py-2 border-b border-[var(--admin-line)] flex items-center gap-3">
            <Loader2
              size={12}
              className="animate-spin text-[var(--admin-muted)]"
            />
            <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
              Importing {uploadProgress.done} / {uploadProgress.total}
            </span>
            <div className="flex-1 h-1 bg-[var(--admin-paper-soft)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--admin-muted)] transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out)] rounded-full"
                style={{
                  width: `${(uploadProgress.done / uploadProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Drop zone overlay */}
        <div
          ref={scrollRef}
          data-library-scroll
          data-scrolling="false"
          tabIndex={-1}
          className={`flex-1 overflow-y-auto p-3 relative ${dragOver ? "ring-2 ring-inset ring-[rgba(var(--admin-ink-rgb),0.2)]" : ""}`}
          onWheel={(e) => markLibraryScrolling(e.currentTarget)}
          onScroll={(e) => {
            markLibraryScrolling(e.currentTarget);
            rememberLibraryScroll(e.currentTarget);
            scheduleLibraryGridMeasure();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes("Files")) setDragOver(true);
            // Reorder drags passing over grid gaps / padding still auto-scroll.
            else if (dragSrcId !== null) updateDragScroll(e.clientY);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length)
              handleFiles(Array.from(e.dataTransfer.files));
          }}
        >
          {dragOver && (
            <div className="absolute inset-2 z-10 flex items-center justify-center pointer-events-none rounded-md border-2 border-dashed border-[rgba(var(--admin-ink-rgb),0.3)] bg-[rgba(var(--admin-ink-rgb),0.05)]">
              <div className="flex flex-col items-center gap-2 text-[var(--admin-ink)]">
                <Upload size={28} strokeWidth={1.5} />
                <span className="text-sm">{copy.import.dropHere}</span>
              </div>
            </div>
          )}
          <div
            ref={libraryContentStartRef}
            aria-hidden="true"
            className="h-0"
          />

          {showTrash ? (
            /* ── Trash view ── */
            /* 3状態を分ける。以前はここが「0件かどうか」だけを見ていたので、
               読み込み中も通信が失敗したときも「ゴミ箱は空です」と断言して
               いた。正常なときでも開くたびに一瞬そう出る唯一の画面だった。 */
            trashLoading ? (
              <div className="flex items-center justify-center h-full">
                <ListLoading label={t.common.loading} />
              </div>
            ) : trashFailed ? (
              <div className="p-3">
                <ListLoadFailed
                  message={t.common.loadFailed}
                  retryLabel={t.common.retry}
                  onRetry={() => void refetchTrash()}
                />
              </div>
            ) : (trashData?.photos ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--admin-muted)]">
                <EmptyTrashIllustration />
                <p className="text-sm">{copy.trash.empty}</p>
              </div>
            ) : (
              <div className="p-3">
                <div className="admin-status-warning text-[length:var(--admin-text-note)] rounded-sm px-3 py-1.5 mb-3 flex items-center justify-between">
                  <span>
                    {copy.trash.retention(trashData?.retentionDays ?? 30)}
                  </span>
                  {/* まとめる入口を「戻す」側にも置く。以前はここが
                      「すべて完全削除」だけで、復元は1枚ずつ、しかもPC幅では
                      マウスを乗せないとボタンが見えなかった。復元は
                      取り返しがつくので確認は挟まない（壊す側だけが確認を持つ）。 */}
                  <span className="flex items-center gap-4 shrink-0">
                    <button
                      onClick={() =>
                        restorePhotos.mutate(
                          trashData!.photos.map((p) => p.id),
                        )
                      }
                      disabled={bulkBusy}
                      className="transition-opacity text-[length:var(--admin-text-note)] disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {copy.trash.restoreAll}
                    </button>
                    <button
                      onClick={() =>
                        setPurgeConfirm({
                          ids: trashData!.photos.map((p) => p.id),
                          label: copy.trash.purgeAllConfirm(
                            trashData!.photos.length,
                          ),
                        })
                      }
                      disabled={bulkBusy}
                      className="admin-text-danger transition-opacity text-[length:var(--admin-text-note)] disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {copy.trash.purgeAll}
                    </button>
                  </span>
                </div>
                <div
                  className="grid"
                  style={{
                    gap: LIBRARY_GRID_GAP,
                    gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`,
                  }}
                >
                  {(trashData?.photos ?? []).map((photo) => {
                    // Days until lazy auto-purge — helps the owner triage what to rescue first.
                    const delT = photo.deletedAt
                      ? new Date(photo.deletedAt).getTime()
                      : 0;
                    const daysLeft = delT
                      ? Math.max(
                          0,
                          Math.ceil(
                            (delT +
                              (trashData?.retentionDays ?? 30) * 86_400_000 -
                              Date.now()) /
                              86_400_000,
                          ),
                        )
                      : null;
                    return (
                      <div key={photo.id} className="relative group">
                        <img
                          src={adminPhotoSrc(photo, 400, 70)}
                          alt={photo.title}
                          className="w-full aspect-square object-cover bg-[var(--admin-paper)] opacity-50"
                          style={{
                            objectPosition: adminPhotoObjectPosition(photo),
                          }}
                          loading="lazy"
                          draggable={false}
                        />
                        {daysLeft !== null && (
                          <span
                            className={`absolute top-1 left-1 z-[2] text-[9px] px-1.5 py-0.5 rounded-sm bg-black/65 ${daysLeft <= 5 ? "admin-text-danger" : "admin-text-warning"}`}
                          >
                            {copy.trash.daysLeft(daysLeft)}
                          </span>
                        )}
                        {/* Buttons always visible on touch (no hover there); hover-reveal on desktop */}
                        <div className="absolute inset-0 bg-black/0 sm:group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            onClick={() => restorePhotos.mutate([photo.id])}
                            disabled={bulkBusy}
                            className="text-[10px] admin-btn-primary text-white px-2 py-1 rounded-sm transition-colors flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
                          >
                            <Check size={10} /> {copy.trash.restore}
                          </button>
                          <button
                            onClick={() =>
                              setPurgeConfirm({
                                ids: [photo.id],
                                label: copy.trash.purgeOneConfirm,
                              })
                            }
                            disabled={bulkBusy}
                            className="admin-btn-danger text-[10px] px-2 py-1 rounded-sm transition-colors flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
                          >
                            <Trash2 size={10} /> {copy.trash.purge}
                          </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                          <p className="text-[10px] text-white/60 truncate">
                            {photo.title || photo.filename}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : photosLoadError ? (
            <div data-library-load-error role="alert" className="flex items-center justify-center h-full gap-2 text-[var(--admin-muted)] text-sm">
              <span>{copy.empty.loadFailed}</span>
              <button type="button" onClick={() => void refetchPhotos()} className="underline underline-offset-4">
                {copy.empty.retry}
              </button>
            </div>
          ) : isLoading ? (
            <div data-library-loading role="status" className="flex items-center justify-center h-full gap-2 text-[var(--admin-muted)] text-sm">
              <Loader2 size={14} className="animate-spin" /> {copy.empty.loading}
            </div>
          ) : bulkEditMode ? (
            <BulkEditTable
              photos={displayed}
              recentlyAddedCount={recentlyAddedPhotos.length}
              seriesList={seriesList}
              cameraPresets={cameraPresets}
              lensPresets={lensPresets}
              onSave={bulkEditSave}
            />
          ) : displayed.length === 0 ? (
            <div
              data-library-empty={
                anyFilterActive && allPhotos.length > 0 ? "search" : "photos"
              }
              className="flex flex-col items-center justify-center h-full gap-3 text-[var(--admin-muted)]"
            >
              {anyFilterActive && allPhotos.length > 0 ? (
                null
              ) : (
                <EmptyContactSheetIllustration />
              )}
              {anyFilterActive && allPhotos.length > 0 ? (
                <div className="admin-library-search-empty">
                  <p className="text-sm">{copy.empty.noMatches}</p>
                  <button
                    type="button"
                    onClick={clearLibraryFilters}
                    className="text-[length:var(--admin-text-note)] px-2.5 py-1 rounded-sm border border-[var(--admin-line)] text-[var(--admin-muted)] bg-[var(--admin-paper-soft)] transition-colors"
                  >
                    {copy.empty.clearFilters}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm">{copy.empty.noPhotos}</p>
                  <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                    {copy.empty.importHint}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Grid */}
              {(() => {
                const renderLibraryPhotoTile = (
                  photo: Photo,
                  idx: number,
                  insideRecentlyAddedSection: boolean,
                ) => {
                    const isSelected =
                      libraryMode === "select" && selected.has(photo.id);
                    const isRecentlyAdded = recentlyAddedPhotoIds.has(photo.id);
                    const isInspect =
                      libraryMode === "normal" &&
                      inspectPhoto?.id === photo.id;
                    const isReorderTarget =
                      libraryMode === "arrange" &&
                      reorderTargetId === photo.id;
                    const isFailedReorderTarget =
                      libraryMode === "arrange" &&
                      reorderFailedTargetId === photo.id;
                    const catColor =
                      catColors[photo.category] ?? "var(--admin-muted)";
                    const isUnpublished = photo.isPublished === false;
                    const thumbnailSrc = adminPhotoSrc(photo, 400, 70);
                    const thumbnailWasLoaded =
                      loadedLibraryThumbnailUrlsRef.current.has(thumbnailSrc);
                    const heroIndex = (heroData?.heroPhotos ?? []).findIndex(
                      (h) => h.photoId === photo.id,
                    );
                    const displaySize = photo.displaySize || "M";
                    const usageBadgeLabels = [
                      heroIndex >= 0 ? `Hero ${heroIndex + 1}` : null,
                      photo.seriesId != null ? "Series" : null,
                      displaySize !== "M" ? `Size ${displaySize}` : null,
                    ].filter((label): label is string => Boolean(label));
                    // 未入力バッジは、その整備をしている時（対応する絞り込みが
                    // 有効な時）だけ写真に載せる。大半の写真に付く警告は情報では
                    // なくノイズになり、コンタクトシートの佇まいを壊すため。
                    const albumCond = activeAlbum?.cond;
                    const metadataBadges = [
                      (filterMissingShotAt || albumCond?.missingShotAt) &&
                      !photo.shotAt
                        ? copy.badges.noDate
                        : null,
                      (filterMissingCapture || albumCond?.missingCapture) &&
                      !(photo.camera || photo.lens)
                        ? copy.badges.noCapture
                        : null,
                      (filterMedium === "missing" ||
                        albumCond?.medium === "missing") &&
                      photoMedium(photo) === "missing"
                        ? copy.badges.noMedium
                        : null,
                    ].filter((label): label is string => Boolean(label));
                    return (
                      <div
                        key={photo.id}
                        id={`admin-photo-${photo.id}`}
                        data-library-recently-added={
                          isRecentlyAdded ? "true" : undefined
                        }
                        data-library-reorder-target={
                          isReorderTarget ? "true" : undefined
                        }
                        data-library-reorder-failed-target={
                          isFailedReorderTarget ? "true" : undefined
                        }
                        data-library-reorder-origin={
                          dragSrcId === photo.id ? "true" : undefined
                        }
                        role="option"
                        tabIndex={-1}
                        aria-selected={
                          libraryMode === "select"
                            ? isSelected
                            : libraryMode === "arrange"
                              ? isReorderTarget
                              : undefined
                        }
                        onDragOver={(e) => handleDragOver(e, photo.id)}
                        onDrop={() => handleDrop(photo.id)}
                        onDragEnd={() => {
                          stopDragScroll();
                          setDragSrcId(null);
                          setDragOverId(null);
                        }}
                        className={`admin-photo-tile relative group ${
                          dragSrcId === photo.id
                            ? "admin-photo-tile--drag-origin"
                            : ""
                        } ${
                          isSelected
                            ? "ring-[length:var(--admin-accent-line)] ring-[color:var(--admin-accent)] ring-offset-1 ring-offset-[var(--admin-paper)]"
                            : isReorderTarget
                              ? "admin-photo-tile--reorder-target"
                              : isInspect
                                ? "ring-1 ring-[var(--admin-muted)]"
                                : ""
                        } ${
                          isFailedReorderTarget
                            ? "admin-photo-tile--reorder-failed"
                            : ""
                        }`}
                      >
                        {isRecentlyAdded && (
                          <span
                            data-library-recently-added-marker
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0 z-[3] w-[2px] bg-[rgba(var(--admin-ink-rgb),0.2)] pointer-events-none"
                          />
                        )}
                        {/* One rule in every direction: drop immediately before
                        the target. A wide paper gap with dark edges is easier to
                        read than the old 3px line in a multi-column grid. */}
                        {dragOverId === photo.id &&
                          dragSrcId !== null &&
                          dragSrcId !== photo.id && (
                            <div
                              aria-hidden="true"
                              data-library-drop-position="before"
                              className="absolute -left-1.5 top-0 bottom-0 z-[4] w-3 bg-[var(--admin-paper)] border-x-[length:var(--admin-accent-line)] border-[color:var(--admin-accent)] pointer-events-none"
                            />
                          )}
                        {/* Full-card click target — a real <button> so select/open is keyboard
                        accessible; the reorder buttons sit above it (higher z). */}
                        <button
                          type="button"
                          data-library-photo-action
                          aria-label={
                            `${
                              photo.title ||
                              photo.filename ||
                              copy.inspector.photoFallback
                            }${
                              isRecentlyAdded &&
                              !insideRecentlyAddedSection
                                ? `, ${copy.selection.recentlyAdded}`
                                : ""
                            }`
                          }
                          onClick={(e) => handlePhotoClick(photo, idx, e)}
                          onFocus={() => setLastClicked(photo.id)}
                          className={`absolute inset-0 z-[1] ${
                            libraryMode === "arrange"
                              ? reorderLocked
                                ? "cursor-not-allowed"
                                : "cursor-default"
                              : "cursor-pointer"
                          }`}
                        />
                        {libraryMode === "arrange" &&
                          !reorderLocked &&
                          !showTrash && (
                            <button
                              type="button"
                              draggable={!reorderBusy}
                              data-library-drag-handle
                              onDragStart={(event) => {
                                event.stopPropagation();
                                handleDragStart(photo.id);
                              }}
                              onDragEnd={() => {
                                stopDragScroll();
                                setDragSrcId(null);
                                setDragOverId(null);
                              }}
                              disabled={reorderBusy}
                              aria-label={copy.reorder.dragHandle}
                              title={copy.reorder.dragHandle}
                              className={`admin-library-drag-handle absolute left-1.5 top-1.5 z-[3] flex cursor-grab items-center justify-center active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 ${
                                isReorderTarget ? "is-target" : ""
                              }`}
                            >
                              <GripVertical size={16} />
                            </button>
                          )}
                        {isReorderTarget && (
                          <>
                            <span
                              data-library-reorder-target-pill
                              className="admin-library-reorder-target-pill"
                            >
                              {copy.reorder.targetPill}
                            </span>
                            <span
                              data-library-reorder-rank
                              className="admin-library-reorder-rank"
                            >
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                          </>
                        )}
                        {/* eager固定: マウント範囲は仮想化が既に絞っている(可視+overscan)。
                        lazyだと高速スワイプ中のremountでキャッシュ済み画像すら白抜けし
                        (Chromeはスクロール中lazy読込を後回しにする)、静止後まで持続する
                        強いチラつきになる。背景はpaper-deepで「読込中の台紙」に見せる */}
                        <img
                          ref={(image) => {
                            if (image?.complete && image.naturalWidth > 0)
                              image.dataset.loaded = "true";
                          }}
                          src={thumbnailSrc}
                          alt={photo.title}
                          className={`admin-library-thumbnail w-full aspect-square object-cover bg-[var(--admin-paper-deep)] ${isUnpublished ? "grayscale" : ""}`}
                          data-loaded={thumbnailWasLoaded ? "true" : undefined}
                          data-no-fade={
                            thumbnailWasLoaded ? "true" : undefined
                          }
                          data-unpublished={isUnpublished ? "true" : "false"}
                          style={{
                            objectPosition: adminPhotoObjectPosition(photo),
                          }}
                          onLoad={(e) => {
                            loadedLibraryThumbnailUrlsRef.current.add(
                              thumbnailSrc,
                            );
                            e.currentTarget.dataset.loaded = "true";
                          }}
                          onError={(e) => {
                            // A broken R2 key must not look like an image that
                            // is still loading forever. Reveal the native
                            // broken-image/alt fallback on the paper backdrop.
                            e.currentTarget.dataset.loaded = "true";
                            e.currentTarget.dataset.broken = "true";
                          }}
                          loading="eager"
                          decoding="async"
                          draggable={false}
                        />
                        {/* M2: non-public badge (offset right so it clears the category dot) */}
                        {isUnpublished && (
                          <div className="absolute top-1 left-4 z-[2] flex items-center gap-0.5 bg-black/70 text-white/75 text-[9px] px-1 py-0.5 rounded-sm">
                            <EyeOff size={9} /> {copy.badges.unpublished}
                          </div>
                        )}
                        {/* Category color label — top-left dot.
                            分類が無い写真にも点が出ていたため、写真496枚のうち
                            意味のない点が常に画面を埋めていた。分類がある写真だけに出す。 */}
                        {photo.category && !isUncategorized(photo) && (
                          <div
                            className="admin-photo-cat-dot"
                            style={{ background: catColor }}
                            title={photo.category}
                          />
                        )}
                        {effectiveThumbSize >= 120 &&
                          metadataBadges.length > 0 && (
                            <div
                              aria-label={copy.badges.missingAria(
                                metadataBadges.join(", "),
                              )}
                              className="absolute top-4 left-1 z-[2] flex max-w-[calc(100%-0.5rem)] flex-wrap gap-1"
                            >
                              {metadataBadges.map((label) => (
                                <span
                                  key={label}
                                  className="rounded-sm bg-black/60 px-1.5 py-0.5 text-[9px] leading-none text-white/70"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        {/* 右下に置く: 左下の移動ボタン（モバイルでは常時表示）と重ならない */}
                        {effectiveThumbSize >= 120 &&
                          usageBadgeLabels.length > 0 && (
                            <div
                              aria-label={copy.badges.usageAria(
                                usageBadgeLabels.join(", "),
                              )}
                              className="absolute bottom-1 right-1 z-[2] flex max-w-[calc(100%-0.5rem)] flex-wrap justify-end gap-1"
                            >
                              {heroIndex >= 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded-sm bg-[color:var(--admin-accent-fill)] px-1.5 py-0.5 text-[9px] leading-none text-white">
                                  <Star size={8} /> Hero {heroIndex + 1}
                                </span>
                              )}
                              {photo.seriesId != null && (
                                <span className="inline-flex items-center gap-0.5 rounded-sm bg-black/65 px-1.5 py-0.5 text-[9px] leading-none text-white/75">
                                  <Layers size={8} /> Series
                                </span>
                              )}
                              {displaySize !== "M" && (
                                <span className="rounded-sm bg-black/65 px-1.5 py-0.5 text-[9px] leading-none text-white/75">
                                  {displaySize}
                                </span>
                              )}
                            </div>
                          )}
                        {/* Selection mark — hand-drawn grease-pencil circle.
                        Always mounted (for tiles the virtualizer renders) so
                        opacity can transition on deselect too; only the most
                        recently (de)selected tile pays for the stroke-draw
                        animation — bulk selections just fade in already-drawn. */}
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 32 32"
                          className="admin-select-mark"
                          data-state={
                            !isSelected
                              ? "hidden"
                              : photo.id === lastClicked
                                ? "draw"
                                : "fade"
                          }
                        >
                          <path
                            className="admin-select-mark__circle"
                            d="M15.8 3.6c6.9-.2 11.9 5 12 12.2.1 7-4.9 12.5-12 12.6C8.8 28.5 3.6 23.2 3.8 16 4 8.7 8.9 3.8 15.8 3.6Z"
                            fill="none"
                            stroke="var(--admin-accent)"
                            strokeWidth={2}
                            strokeLinecap="round"
                            pathLength={1}
                          />
                          <path
                            d="M9.4 16.7c2 2.2 3.5 3.6 5.1 5.4 2.5-4.6 5.1-8 9.3-12.2"
                            fill="none"
                            stroke="var(--admin-accent)"
                            strokeWidth={2.7}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {/* Title strip on hover */}
                        <div className="admin-photo-hover-only absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white/80 truncate">
                            {photo.title || photo.filename}
                          </p>
                        </div>
                      </div>
                    );
                  };
                return (
                  <>
                    {recentlyAddedPhotos.length > 0 && (
                      <section
                        aria-labelledby="library-recently-added-heading"
                        data-library-recently-added-section
                        data-library-recently-added-count={
                          recentlyAddedPhotos.length
                        }
                        className="mb-2"
                        style={{ padding: 10 }}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <h2
                            id="library-recently-added-heading"
                            data-library-recently-added-heading
                            className="text-[length:var(--admin-text-body)] text-[var(--admin-ink)]"
                          >
                            {copy.selection.recentlyAddedHeading(
                              recentlyAddedPhotos.length,
                            )}
                          </h2>
                          <button
                            type="button"
                            data-library-recently-added-dismiss
                            onClick={dismissRecentlyAdded}
                            className="text-[length:var(--admin-text-note)] px-2 py-1 rounded-sm border border-[var(--admin-line)] text-[var(--admin-muted)] bg-[var(--admin-paper-soft)] transition-colors"
                          >
                            {copy.selection.endRecentlyAddedDisplay}
                          </button>
                        </div>
                        {recentlyAddedOutsideFilters && (
                          <p
                            data-library-recently-added-filter-note
                            className="mb-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)]"
                          >
                            {copy.selection.recentlyAddedOutsideFilters}
                          </p>
                        )}
                        <div
                          data-library-recently-added-grid
                          className="grid"
                          style={{
                            gap: LIBRARY_GRID_GAP,
                            gridTemplateColumns: `repeat(auto-fill, minmax(${effectiveThumbSize}px, 1fr))`,
                          }}
                        >
                          {recentlyAddedPhotos.map((photo, idx) =>
                            renderLibraryPhotoTile(photo, idx, true),
                          )}
                        </div>
                      </section>
                    )}
                    <div
                      ref={gridRef}
                      data-library-grid-mode={libraryMode}
                      role="listbox"
                      aria-label={`Library ${t.headers.libraryPhotos}`}
                      data-virtualized={
                        virtualGrid.isVirtualized ? "true" : "false"
                      }
                      data-rendered-count={
                        recentlyAddedPhotos.length + virtualGrid.renderedCount
                      }
                      data-library-grid-offset-top={
                        libraryGridMetrics.gridOffsetTop
                      }
                    >
                      {virtualGrid.topPadding > 0 && (
                        <div style={{ height: virtualGrid.topPadding }} />
                      )}
                      <div
                        className="grid"
                        style={{
                          gap: LIBRARY_GRID_GAP,
                          gridTemplateColumns: `repeat(auto-fill, minmax(${effectiveThumbSize}px, 1fr))`,
                        }}
                      >
                        {visibleRegularPhotos.map((photo, localIdx) =>
                          renderLibraryPhotoTile(
                            photo,
                            recentlyAddedPhotos.length +
                              virtualGrid.startIndex +
                              localIdx,
                            false,
                          ),
                        )}
                      </div>
                      {virtualGrid.bottomPadding > 0 && (
                        <div style={{ height: virtualGrid.bottomPadding }} />
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
        {libraryMode === "arrange" && reorderTarget && (
          <AdminReorderBar
            target={{
              id: reorderTarget.id,
              thumbnailSrc: adminPhotoSrc(reorderTarget, 240, 70),
              title:
                reorderTarget.title ||
                reorderTarget.filename ||
                copy.inspector.photoFallback,
              position: reorderTargetPosition,
              total: displayed.length,
            }}
            busy={reorderBusy}
            feedback={
              reorderFeedback
                ? {
                    state: reorderFeedback.state,
                    message: reorderFeedback.message,
                  }
                : null
            }
            moveSummary={
              lastMove && lastMove.id === reorderTarget.id
                ? copy.reorder.moveSummary(lastMove.from, lastMove.to)
                : null
            }
            undoAvailable={reorderUndo !== null}
            positionValue={reorderPositionValue}
            positionInvalid={reorderPositionInvalid}
            labels={{
              region: copy.reorder.region,
              position: copy.reorder.positionLabel(
                reorderTargetPosition,
                displayed.length,
              ),
              moveFirst: copy.reorder.moveFirst,
              movePrevious: copy.reorder.movePrevious,
              moveNext: copy.reorder.moveNext,
              moveLast: copy.reorder.moveLast,
              positionInput: copy.reorder.positionInput,
              moveAction: copy.reorder.moveAction,
              undo: copy.reorder.undo,
              chooseAgain: copy.reorder.chooseAgain,
              invalidPosition: copy.reorder.invalidPosition(displayed.length),
            }}
            onMoveFirst={() => movePhotoTo(reorderTarget.id, "start")}
            onMovePrevious={() => movePhoto(reorderTarget.id, -1)}
            onMoveNext={() => movePhoto(reorderTarget.id, 1)}
            onMoveLast={() => movePhotoTo(reorderTarget.id, "end")}
            onPositionChange={setReorderPositionValue}
            onMoveToPosition={() =>
              movePhotoToNumber(reorderTarget.id, parsedReorderPosition)
            }
            onUndo={undoPhotoOrder}
            onChooseAgain={() => {
              setReorderTargetId(null);
              setReorderPositionValue("");
              setLastMove(null);
              setReorderUndo(null);
              requestAnimationFrame(() =>
                scrollRef.current?.focus({ preventScroll: true }),
              );
            }}
          />
        )}
      </div>

      {/* M2: batch-operation result toast */}
      <Toast
        show={!!batchToast}
        className="admin-status-success fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[color:var(--admin-paper)] text-[length:var(--admin-text-body)] px-4 py-2.5 rounded-sm"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width={13}
          height={13}
          className="admin-toast__check flex-shrink-0"
        >
          <path
            d="M4 12.5l5 5L20 6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
          />
        </svg>
        <span>{batchToast}</span>
      </Toast>

      {/* O2: bulk metadata edit panel */}
      {batchEditOpen && (
        <Modal onClose={() => setBatchEditOpen(false)} widthClass="w-80">
          <p className="text-[length:var(--admin-text-body)] text-[var(--admin-ink)] mb-1">
            {copy.bulkMetadata.title}
          </p>
          <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mb-4">
            {copy.bulkMetadata.description(selected.size)}
          </p>
          <div className="flex flex-col gap-3">
            <AdminField label={copy.inspector.camera}>
              <input
                aria-label={copy.inspector.cameraAria}
                value={batchEdit.camera}
                onChange={(e) =>
                  setBatchEdit((b) => ({ ...b, camera: e.target.value }))
                }
                placeholder={copy.bulkMetadata.unchanged}
                className="ax-input"
              />
            </AdminField>
            <AdminField label={copy.inspector.lens}>
              <input
                aria-label={copy.inspector.lensAria}
                value={batchEdit.lens}
                onChange={(e) =>
                  setBatchEdit((b) => ({ ...b, lens: e.target.value }))
                }
                placeholder={copy.bulkMetadata.unchanged}
                className="ax-input"
              />
            </AdminField>
            <AdminField label={copy.inspector.filmDigital}>
              <div className="flex gap-1">
                {(
                  [
                    ["", copy.bulkMetadata.noChange],
                    ["フィルム", copy.import.film],
                    ["デジタル", copy.import.digital],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={lbl}
                    onClick={() =>
                      setBatchEdit((b) => ({ ...b, filmType: val }))
                    }
                    className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${batchEdit.filmType === val ? "admin-btn-primary font-medium" : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </AdminField>
          </div>
          <div className="flex gap-2 justify-end mt-5">
            <button
              onClick={() => setBatchEditOpen(false)}
              className="px-4 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => batchMetaEdit.mutate(batchEdit)}
              disabled={
                batchMetaEdit.isPending ||
                (!batchEdit.camera && !batchEdit.lens && !batchEdit.filmType)
              }
              className="flex items-center gap-1.5 px-4 py-1.5 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm transition-colors disabled:opacity-40"
            >
              {batchMetaEdit.isPending ? (
                <>
                  <Loader2 size={11} className="animate-spin" />{" "}
                  {copy.bulkMetadata.applying}
                </>
              ) : (
                <>
                  <Check size={11} /> {copy.bulkMetadata.apply}
                </>
              )}
            </button>
          </div>
        </Modal>
      )}

      {/* O6: create smart album — name + optional conditions (saved as a virtual folder) */}
      {albumModalOpen && (
        <Modal onClose={() => setAlbumModalOpen(false)} widthClass="w-80">
          <p className="text-[length:var(--admin-text-body)] text-[var(--admin-ink)] mb-1">
            {copy.albums.title}
          </p>
          <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mb-4">
            {copy.albums.description}
          </p>
          <div className="flex flex-col gap-3">
            <AdminField label={copy.albums.name}>
              <input
                aria-label={copy.albums.nameAria}
                value={albumDraft.name}
                onChange={(e) =>
                  setAlbumDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder={copy.albums.namePlaceholder}
                className="ax-input"
              />
            </AdminField>
            <AdminField label={copy.albums.cameraContains}>
              <input
                aria-label={copy.albums.cameraAria}
                list="album-camera-presets"
                value={albumDraft.camera}
                onChange={(e) =>
                  setAlbumDraft((d) => ({ ...d, camera: e.target.value }))
                }
                placeholder={copy.albums.unspecifiedPlaceholder}
                className="ax-input"
              />
              <datalist id="album-camera-presets">
                {cameraPresets.map((p) => (
                  <option key={p} value={p} aria-label={p} />
                ))}
              </datalist>
            </AdminField>
            <AdminField label={copy.albums.filmDigital}>
              <div className="flex gap-1">
                {(
                  [
                    ["", copy.albums.unspecified],
                    ["フィルム", copy.import.film],
                    ["デジタル", copy.import.digital],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={lbl}
                    onClick={() =>
                      setAlbumDraft((d) => ({ ...d, filmType: val }))
                    }
                    className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${albumDraft.filmType === val ? "admin-btn-primary font-medium" : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </AdminField>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1 min-w-0">
                <AdminField label={copy.albums.medium}>
                  <select
                    aria-label={copy.albums.mediumAria}
                    value={albumDraft.medium}
                    onChange={(e) =>
                      setAlbumDraft((d) => ({ ...d, medium: e.target.value }))
                    }
                    className="w-full bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] text-[var(--admin-ink)] px-2 py-2 text-[length:var(--admin-text-body)] outline-none transition-colors rounded-sm"
                  >
                    <option value="all">{copy.albums.unspecified}</option>
                    <option value="digital">{copy.filters.mediumDigital}</option>
                    <option value="film">{copy.filters.mediumFilm}</option>
                    <option value="missing">{copy.filters.mediumMissing}</option>
                  </select>
                </AdminField>
              </div>
              <div className="flex-1 min-w-0">
                <AdminField label={copy.albums.missing}>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setAlbumDraft((d) => ({
                          ...d,
                          missingShotAt: !d.missingShotAt,
                        }))
                      }
                      aria-pressed={albumDraft.missingShotAt}
                      className={`flex-1 text-[length:var(--admin-text-note)] py-2 rounded-sm border transition-colors ${albumDraft.missingShotAt ? "admin-btn-primary" : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border-[var(--admin-line)]"}`}
                    >
                      {copy.albums.date}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAlbumDraft((d) => ({
                          ...d,
                          missingCapture: !d.missingCapture,
                        }))
                      }
                      aria-pressed={albumDraft.missingCapture}
                      className={`flex-1 text-[length:var(--admin-text-note)] py-2 rounded-sm border transition-colors ${albumDraft.missingCapture ? "admin-btn-primary" : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border-[var(--admin-line)]"}`}
                    >
                      {copy.albums.capture}
                    </button>
                  </div>
                </AdminField>
              </div>
            </div>
            <AdminField label={copy.albums.category}>
              <select
                aria-label={copy.albums.categoryAria}
                value={albumDraft.category}
                onChange={(e) =>
                  setAlbumDraft((d) => ({ ...d, category: e.target.value }))
                }
                className="w-full bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] text-[var(--admin-ink)] px-2 py-2 text-[length:var(--admin-text-body)] outline-none transition-colors rounded-sm"
              >
                <option value="all">{copy.albums.unspecified}</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
                <option value="__uncat__">{copy.filters.uncategorized}</option>
              </select>
            </AdminField>
            <AdminField label={copy.albums.series}>
              <select
                aria-label={copy.albums.seriesAria}
                value={albumDraft.series}
                onChange={(e) =>
                  setAlbumDraft((d) => ({ ...d, series: e.target.value }))
                }
                className="w-full bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] text-[var(--admin-ink)] px-2 py-2 text-[length:var(--admin-text-body)] outline-none transition-colors rounded-sm"
              >
                <option value="all">{copy.albums.unspecified}</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.title}
                  </option>
                ))}
                <option value="__none__">{copy.filters.unassigned}</option>
              </select>
            </AdminField>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1 min-w-0">
                <AdminField label={copy.albums.size}>
                  <select
                    aria-label={copy.albums.sizeAria}
                    value={albumDraft.size}
                    onChange={(e) =>
                      setAlbumDraft((d) => ({ ...d, size: e.target.value }))
                    }
                    className="w-full bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] text-[var(--admin-ink)] px-2 py-2 text-[length:var(--admin-text-body)] outline-none transition-colors rounded-sm"
                  >
                    <option value="all">{copy.albums.unspecified}</option>
                    {(["S", "M", "L"] as const).map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </AdminField>
              </div>
              <div className="flex-1 min-w-0">
                <AdminField label={copy.albums.publication}>
                  <select
                    aria-label={copy.albums.publicationAria}
                    value={albumDraft.published}
                    onChange={(e) =>
                      setAlbumDraft((d) => ({ ...d, published: e.target.value }))
                    }
                    className="w-full bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] text-[var(--admin-ink)] px-2 py-2 text-[length:var(--admin-text-body)] outline-none transition-colors rounded-sm"
                  >
                    <option value="all">{copy.albums.unspecified}</option>
                    <option value="published">
                      {copy.filters.publishedOnly}
                    </option>
                    <option value="unpublished">
                      {copy.filters.unpublishedOnly}
                    </option>
                  </select>
                </AdminField>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1 min-w-0">
                <AdminField label={copy.albums.uploaded}>
                  <select
                    aria-label={copy.albums.uploadedAria}
                    value={albumDraft.recent}
                    onChange={(e) =>
                      setAlbumDraft((d) => ({ ...d, recent: e.target.value }))
                    }
                    className="w-full bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] text-[var(--admin-ink)] px-2 py-2 text-[length:var(--admin-text-body)] outline-none transition-colors rounded-sm"
                  >
                    <option value="all">{copy.albums.unspecified}</option>
                    <option value="7">{copy.filters.recentDays(7)}</option>
                    <option value="30">{copy.filters.recentDays(30)}</option>
                  </select>
                </AdminField>
              </div>
              <div className="flex-1 min-w-0">
                <AdminField label={copy.albums.featured}>
                  <button
                    onClick={() =>
                      setAlbumDraft((d) => ({ ...d, featured: !d.featured }))
                    }
                    aria-pressed={albumDraft.featured}
                    className={`w-full flex items-center justify-center gap-1 text-[length:var(--admin-text-note)] py-2 rounded-sm border transition-colors ${albumDraft.featured ? "admin-btn-accent" : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border-[var(--admin-line)]"}`}
                  >
                    <Star size={11} />{" "}
                    {albumDraft.featured
                      ? copy.albums.only
                      : copy.albums.noCondition}
                  </button>
                </AdminField>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-5">
            <button
              onClick={() => setAlbumModalOpen(false)}
              className="px-4 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => {
                const cond: AlbumCond = {};
                if (albumDraft.camera.trim())
                  cond.camera = albumDraft.camera.trim();
                if (albumDraft.filmType) cond.filmType = albumDraft.filmType;
                if (albumDraft.medium !== "all")
                  cond.medium = albumDraft.medium;
                if (albumDraft.missingShotAt) cond.missingShotAt = true;
                if (albumDraft.missingCapture) cond.missingCapture = true;
                if (albumDraft.category !== "all")
                  cond.category = albumDraft.category;
                if (albumDraft.series !== "all")
                  cond.series = albumDraft.series;
                if (albumDraft.size !== "all") cond.size = albumDraft.size;
                if (albumDraft.featured) cond.featured = true;
                if (albumDraft.published !== "all")
                  cond.published = albumDraft.published;
                if (albumDraft.recent !== "all")
                  cond.recent = albumDraft.recent;
                const album: SmartAlbum = {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  name: albumDraft.name.trim(),
                  cond,
                };
                saveAlbums.mutate([...smartAlbums, album], {
                  onSuccess: () => {
                    setAlbumModalOpen(false);
                    setActiveAlbumId(album.id);
                  },
                });
              }}
              disabled={saveAlbums.isPending || !albumDraft.name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm transition-colors disabled:opacity-40"
            >
              {saveAlbums.isPending ? (
                <>
                  <Loader2 size={11} className="animate-spin" />{" "}
                  {copy.albums.saving}
                </>
              ) : (
                <>
                  <Check size={11} /> {copy.albums.create}
                </>
              )}
            </button>
          </div>
        </Modal>
      )}

      {/* Action error toast — surfaces failures that would otherwise be silent */}
      <Toast
        show={!!actionError}
        role="alert"
        className="admin-status-danger fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 max-w-[90vw] bg-[color:var(--admin-paper)] text-[length:var(--admin-text-body)] px-4 py-2.5 rounded-sm"
      >
        <span className="truncate">{actionError}</span>
        <button
          onClick={() => setActionError("")}
          aria-label={t.common.close}
          className="admin-text-danger opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <X size={12} />
        </button>
      </Toast>

      {/* Undo toast (B3) */}
      <Toast
        show={!!undoToast}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] text-[var(--admin-ink)] text-[length:var(--admin-text-body)] px-4 py-2.5 rounded-sm shadow-xl"
      >
        <span>{copy.trash.moved(undoToast?.count ?? 0)}</span>
        <button
          onClick={() => undoToast && restorePhotos.mutate(undoToast.ids)}
          disabled={bulkBusy}
          className="text-[var(--admin-ink)] hover:text-white underline underline-offset-2 transition-colors disabled:opacity-40"
        >
          ↩ {copy.trash.undo}
        </button>
        <button
          onClick={() => setUndoToast(null)}
          className="text-[var(--admin-muted)] transition-colors ml-1"
        >
          <X size={12} />
        </button>
      </Toast>

      {/* 保存先未接続バナー — 通常のアップロード失敗と分けた説明表示。
          自動では消えない(設定を直すまで何度試しても失敗するため)。 */}
      {storageAlert && (
        <StorageAlertBanner
          missing={storageAlert}
          canRetry={retryFiles.length > 0}
          copy={copy.storageAlert}
          onRetry={() => {
            const files = retryFiles;
            setRetryFiles([]);
            setUploadNotice(null);
            setStorageAlert(null);
            handleFiles(files);
          }}
          onClose={() => setStorageAlert(null)}
        />
      )}

      {/* Upload result notice (failures / skipped files) */}
      <Toast
        show={!!uploadNotice}
        role="alert"
        className="admin-status-warning fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 max-w-[90vw] bg-[color:var(--admin-paper)] text-[length:var(--admin-text-body)] px-4 py-2.5 rounded-sm"
      >
        <span className="truncate">{uploadNotice}</span>
        {retryFiles.length > 0 && (
          <button
            onClick={() => {
              const files = retryFiles;
              setRetryFiles([]);
              setUploadNotice(null);
              handleFiles(files);
            }}
            className="admin-text-warning flex-shrink-0 flex items-center gap-1 underline underline-offset-2"
          >
            <Upload size={11} /> {copy.import.retryFailed}
          </button>
        )}
        <button
          onClick={() => {
            setUploadNotice(null);
            setRetryFiles([]);
          }}
          aria-label={t.common.close}
          className="admin-text-warning opacity-60 hover:opacity-100 transition-opacity ml-1 flex-shrink-0"
        >
          <X size={12} />
        </button>
      </Toast>

      {/* Non-destructive confirm dialog (sort-order save / batch shot date).
          Enter = primary (data-autofocus), Esc = cancel. Destructive flows do
          NOT use this — trash is undoable (no confirm), purge has its own. */}
      {confirmDialog && (
        // key に世代番号を渡し、ダイアログが入れ替わったら Modal を作り直す。
        // 閉じる経路は2つある（キャンセル/実行＝即時、背景クリック/Escape＝
        // 160msの退場後）。**一本化したのは state を消す操作だけ**で、
        // すべて closeConfirmDialog(id) を通し、自分の世代のときだけ消す。
        <Modal
          key={confirmDialog.id}
          onClose={() => closeConfirmDialog(confirmDialog.id)}
        >
          <p className="text-[length:var(--admin-text-body)] text-[var(--admin-ink)] mb-4">
            {confirmDialog.message}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => closeConfirmDialog(confirmDialog.id)}
              className="px-4 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              data-autofocus
              onClick={() => {
                const act = confirmDialog.onConfirm;
                closeConfirmDialog(confirmDialog.id);
                act();
              }}
              className="px-4 py-1.5 text-[length:var(--admin-text-note)] admin-btn-primary rounded-sm transition-colors"
            >
              {confirmDialog.confirmLabel}
            </button>
          </div>
        </Modal>
      )}

      {/* Purge confirm modal — the ONLY delete flow that still confirms:
          purge is irreversible, so it shows the targets (count + thumbnails)
          in destructive styling. Focus starts on キャンセル (data-autofocus)
          so a stray Enter can never confirm the purge. */}
      {purgeConfirm && (
        <Modal onClose={() => setPurgeConfirm(null)}>
          <p className="admin-text-danger flex items-center gap-2 text-[length:var(--admin-text-body)] mb-2">
            <Trash2 size={14} className="flex-shrink-0" />
            {purgeConfirm.label}
          </p>
          {(() => {
            const targets = (trashData?.photos ?? []).filter((p) =>
              purgeConfirm.ids.includes(p.id),
            );
            if (targets.length === 0) return null;
            const shown = targets.slice(0, 6);
            return (
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                {shown.map((p) => (
                  <img
                    key={p.id}
                    src={adminPhotoSrc(p, 200, 60)}
                    alt={p.title || p.filename}
                    className="w-10 h-10 object-cover rounded-sm border border-[rgba(var(--admin-danger-rgb),0.4)]"
                    style={{ objectPosition: adminPhotoObjectPosition(p) }}
                    loading="lazy"
                    draggable={false}
                  />
                ))}
                {targets.length > shown.length && (
                  <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
                    {copy.trash.more(targets.length - shown.length)}
                  </span>
                )}
              </div>
            );
          })()}
          {/* Extra wrinkle for large purges: an explicit ack + a short
              countdown before the confirm button enables — a fat-finger
              click on "Purge All" for a big trash shouldn't be one click. */}
          {purgeNeedsExtraStep && (
            <label className="flex items-start gap-2 mb-4 text-[length:var(--admin-text-body)] text-[var(--admin-ink)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={purgeAckChecked}
                onChange={(e) => handlePurgeAckChange(e.target.checked)}
                className="mt-0.5"
              />
              {copy.trash.acknowledge(purgeConfirm.ids.length)}
            </label>
          )}
          <div className="flex gap-2 justify-end">
            <button
              data-autofocus
              onClick={() => setPurgeConfirm(null)}
              className="px-4 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={() => {
                if (bulkBusy || !purgeConfirmReady) return;
                purgePhotos.mutate(purgeConfirm.ids);
                setPurgeConfirm(null);
              }}
              disabled={bulkBusy || !purgeConfirmReady}
              className="admin-btn-danger px-4 py-1.5 text-[length:var(--admin-text-note)] rounded-sm transition-colors disabled:opacity-40"
            >
              {purgeNeedsExtraStep && purgeAckChecked && purgeCountdown > 0
                ? copy.trash.purgeCountdown(purgeCountdown)
                : copy.trash.purge}
            </button>
          </div>
        </Modal>
      )}

      {/* Bulk progress toast — live count + cancel (checked between items) */}
      <Toast
        show={!!bulkRun}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] text-[var(--admin-ink)] text-[length:var(--admin-text-body)] px-4 py-2.5 rounded-sm shadow-xl"
      >
        {/* The count text is the accessible progress signal; the bar is decorative */}
        <span aria-live="polite" className="whitespace-nowrap">
          {bulkRun &&
            copy.purgeResult.progress(
              copy.bulkOperation[bulkRun.op],
              bulkRun.done,
              bulkRun.total,
            )}
        </span>
        <div
          aria-hidden="true"
          className="w-28 h-1 bg-[var(--admin-line)] rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-[var(--admin-ink)] transition-[width] duration-200"
            style={{
              width: bulkRun
                ? `${Math.round((bulkRun.done / Math.max(1, bulkRun.total)) * 100)}%`
                : "0%",
            }}
          />
        </div>
        <button
          onClick={() => {
            bulkCancelRef.current = true;
          }}
          className="text-[var(--admin-muted)] hover:text-[var(--admin-ink)] underline underline-offset-2 transition-colors"
        >
          {t.common.cancel}
        </button>
      </Toast>

      {/* Bulk result summary — per-photo failure list with retry */}
      <Toast
        show={!!bulkResult}
        role="alert"
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] text-[var(--admin-ink)] text-[length:var(--admin-text-body)] px-4 py-2.5 rounded-sm shadow-xl"
      >
        {bulkResult && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <span>
                {bulkResult.skipped > 0
                  ? copy.purgeResult.stopped(
                      copy.bulkOperation[bulkResult.op],
                    )
                  : copy.purgeResult.completed(
                      copy.bulkOperation[bulkResult.op],
                    )}{" "}
                — {copy.purgeResult.success(bulkResult.ok)}
                {bulkResult.failed.length > 0 &&
                  ` / ${copy.purgeResult.failed(bulkResult.failed.length)}`}
                {bulkResult.skipped > 0 &&
                  ` / ${copy.purgeResult.unprocessed(bulkResult.skipped)}`}
              </span>
              {bulkResult.failed.length > 0 && (
                <button
                  onClick={retryFailedBulk}
                  disabled={bulkBusy}
                  className="flex-shrink-0 underline underline-offset-2 hover:text-white transition-colors disabled:opacity-40"
                >
                  {copy.purgeResult.retryFailed}
                </button>
              )}
              <button
                onClick={() => setBulkResult(null)}
                aria-label={t.common.close}
                className="text-[var(--admin-muted)] transition-colors ml-auto flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>
            {bulkResult.failed.length > 0 && (
              <ul className="max-h-24 overflow-y-auto text-[length:var(--admin-text-note)] text-[var(--admin-muted)] list-disc pl-4">
                {bulkResult.failed.map((f) => (
                  <li key={f.id} className="truncate">
                    {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Toast>

      {/* C3: Quick preview (Space) — full-screen image overlay */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[9998] bg-black/90 flex items-center justify-center p-6">
          {/* Backdrop close target — a real <button> behind the image; the image
              is click-through (pointer-events-none) so clicking anywhere closes,
              as before. Arrow/Space/Esc are handled by the grid's global keydown. */}
          <button
            type="button"
            aria-label={copy.preview.closeAria}
            onClick={() => setPreviewPhoto(null)}
            className="absolute inset-0 cursor-default"
          />
          <img
            src={adminPhotoSrc(previewPhoto, 1600, 85)}
            alt={previewPhoto.title || previewPhoto.filename}
            className="relative pointer-events-none max-w-full max-h-full object-contain shadow-2xl"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/60 bg-black/40 px-3 py-1 rounded-sm">
            {copy.preview.instructions(
              previewPhoto.title || previewPhoto.filename,
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreviewPhoto(null);
            }}
            aria-label={copy.preview.closeAria}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* C3: Keyboard shortcuts help (?) */}
      {showShortcuts && (
        <Modal
          onClose={() => setShowShortcuts(false)}
          widthClass="w-[360px] max-w-full"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[length:var(--admin-text-body)] tracking-widest uppercase text-[var(--admin-muted)]">
              {copy.preview.shortcutsTitle}
            </h3>
            <button
              onClick={() => setShowShortcuts(false)}
              aria-label={t.common.close}
              className="text-[var(--admin-muted)]"
            >
              <X size={15} />
            </button>
          </div>
          <dl className="flex flex-col gap-2 text-[length:var(--admin-text-body)]">
            {(
              [
                [copy.preview.shortcutClick, copy.preview.shortcutOpen],
                [
                  `⌘/Ctrl + ${copy.preview.shortcutClick}`,
                  copy.preview.shortcutMulti,
                ],
                [
                  `Shift + ${copy.preview.shortcutClick}`,
                  copy.preview.shortcutRange,
                ],
                ["⌘/Ctrl + A", copy.preview.shortcutAll],
                ["← → ↑ ↓", copy.preview.shortcutMove],
                ["[ / ]", copy.preview.shortcutRotate],
                ["Enter", copy.preview.shortcutInspector],
                ["Space", copy.preview.shortcutPreview],
                ["Delete / Backspace", copy.preview.shortcutDelete],
                ["Esc", copy.preview.shortcutClose],
                ["?", copy.preview.shortcutHelp],
              ] as const
            ).map(([k, desc]) => (
              <div key={k} className="flex items-center justify-between gap-4">
                <dt className="text-[var(--admin-ink)] font-mono text-[length:var(--admin-text-note)] whitespace-nowrap">
                  {k}
                </dt>
                <dd className="text-[var(--admin-muted)] text-right">{desc}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}

      {/* Right panel — Inspector (like Lr metadata panel).
          Mobile: bottom sheet. Tablet: right drawer overlay. Desktop: static side panel. */}
      {inspectPhoto && (
        <>
          {/* 1280px未満（スマホ・タブレット）: ドロワー外タップで閉じる。背景を薄く暗くして
              「一覧の上に詳細が乗っている」ことを分かりやすく。
              未保存の編集がある間は誤タップで内容を失わないよう閉じない
              (X/保存/破棄の明示操作のみ — Codexレビュー 2026-07-11)。 */}
          <div
            aria-hidden="true"
            data-library-inspector-scrim
            // 1200px以上で詳細欄は静的な列になる（styles.css）。暗幕の境界を
            // Tailwindのxl=1280pxに任せると、1200〜1279pxで並んでいる
            // グリッドまで暗くなるため、CSS側と同じ1200pxで揃える。
            className="fixed top-56 inset-x-0 bottom-0 z-30 bg-black/30 min-[1200px]:hidden"
            onClick={() => {
              if (!photoEditFormChanged(editForm, inspectPhoto)) {
                setInspectPhoto(null);
              }
            }}
          />
          <div
            data-library-inspector
            data-inspector-mobile-section={inspectorMobileSection}
        className="admin-library-inspector relative fixed inset-x-0 bottom-0 z-40 w-full max-h-[60vh] shadow-2xl rounded-t-lg border-t border-[var(--admin-line)] sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-w-xs sm:max-h-none sm:rounded-none sm:border-t-0 sm:border-l xl:static xl:z-auto xl:w-64 xl:max-w-none xl:shadow-none bg-[var(--admin-paper)] flex flex-col flex-shrink-0 overflow-y-auto"
          >
            {/* Header with close. 幅に関係なく必ず出す — PC(1200px以上)では
                詳細欄が静的な列になるため、閉じる手段がないと一覧へ戻れない
                (オーナー確認 2026-07-30)。Escも同じ requestCloseInspector を通る。 */}
            <div className="flex items-center justify-between px-3 pt-2">
              <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider">
                {copy.inspector.editPhoto}
              </span>
              <button
                onClick={requestCloseInspector}
                data-library-inspector-close
                aria-label={copy.inspector.close}
                title={copy.inspector.close}
                className="admin-tap text-[var(--admin-muted)] transition-colors -mr-1 flex h-11 w-11 items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <nav
              aria-label={copy.inspector.editPhoto}
              className="admin-inspector-mobile-sections md:hidden"
            >
              {(
                ["basic", "classification", "details"] as const
              ).map((section) => (
                <button
                  key={section}
                  type="button"
                  aria-pressed={inspectorMobileSection === section}
                  onClick={() => setInspectorMobileSection(section)}
                >
                  {copy.inspector.sections[section]}
                </button>
              ))}
            </nav>
            {/* Preview */}
            <div className="admin-inspector-preview p-3">
              <img
                src={srcFor(
                  inspectPhoto.url,
                  800,
                  80,
                  undefined,
                  editForm.rotationDeg,
                )}
                alt={inspectPhoto.title}
                className="w-full h-auto object-contain bg-[var(--admin-paper)]"
                style={{ maxHeight: "320px" }}
              />
            </div>

            {(() => {
              const heroIdx = (heroData?.heroPhotos ?? []).findIndex(
                (h) => h.photoId === inspectPhoto.id,
              );
              const quickSeriesName = editForm.seriesId
                ? seriesList.find((s) => s.id === Number(editForm.seriesId))
                    ?.title
                : "";
              const quickCategory = categories.find(
                (c) => c.slug === editForm.category,
              );
              const quickDraftChanged = photoEditFormChanged(
                editForm,
                inspectPhoto,
              );

              return (
                <div className="admin-inspector-quick mx-3 mb-3 rounded-sm border border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider">
                      {copy.inspector.quick}
                    </span>
                    {quickDraftChanged && (
                      <span className="rounded-sm border border-[rgba(var(--admin-accent-rgb),0.35)] bg-[rgba(var(--admin-accent-rgb),0.08)] px-1.5 py-0.5 text-[length:var(--admin-text-note)] text-[color:var(--admin-accent-fill)]">
                        {copy.inspector.unsaved}
                      </span>
                    )}
                  </div>

                  <div
                    aria-label={copy.inspector.usageAria}
                    className="admin-inspector-quick-status mb-2 flex flex-wrap gap-1"
                  >
                    {heroIdx >= 0 && (
                      <span className="inline-flex items-center gap-1 rounded-sm border border-[rgba(var(--admin-accent-rgb),0.35)] bg-[rgba(var(--admin-accent-rgb),0.08)] px-1.5 py-0.5 text-[length:var(--admin-text-note)] text-[color:var(--admin-accent-fill)]">
                        <Star size={9} /> Hero {heroIdx + 1}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[length:var(--admin-text-note)] ${
                        editForm.isPublished
                          ? "border-[rgba(var(--admin-success-rgb),0.4)] bg-[rgba(var(--admin-success-rgb),0.08)] text-[color:var(--admin-success)]"
                          : "border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] text-[color:var(--admin-muted)]"
                      }`}
                    >
                      {editForm.isPublished ? (
                        <Eye size={9} />
                      ) : (
                        <EyeOff size={9} />
                      )}
                      {editForm.isPublished
                        ? copy.inspector.published
                        : copy.inspector.unpublished}
                    </span>
                    <span className="rounded-sm border border-[var(--admin-line)] bg-[var(--admin-paper-soft)] px-1.5 py-0.5 text-[length:var(--admin-text-note)] text-[var(--admin-ink)]">
                      {copy.inspector.displaySize} {editForm.displaySize}
                    </span>
                    <span className="inline-flex max-w-full items-center gap-1 rounded-sm border border-[var(--admin-line)] bg-[var(--admin-paper-soft)] px-1.5 py-0.5 text-[length:var(--admin-text-note)] text-[var(--admin-ink)]">
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{
                          background: quickCategory
                            ? (catColors[quickCategory.slug] ??
                              "var(--admin-muted)")
                            : "transparent",
                          border: quickCategory
                            ? "none"
                            : "1px solid var(--admin-muted)",
                        }}
                      />
                      <span className="truncate">
                        {quickCategory?.label ?? copy.inspector.uncategorized}
                      </span>
                    </span>
                    {quickSeriesName && (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-sm border border-[var(--admin-line)] bg-[var(--admin-paper-soft)] px-1.5 py-0.5 text-[length:var(--admin-text-note)] text-[var(--admin-ink)]">
                        <Layers size={9} className="flex-shrink-0" />
                        <span className="truncate">{quickSeriesName}</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="admin-inspector-basic-control">
                    <SegmentedControl
                      value={editForm.isPublished ? "true" : "false"}
                      onChange={(v) =>
                        setEditForm((f) => ({
                          ...f,
                          isPublished: v === "true",
                        }))
                      }
                      options={[
                        { value: "true", label: copy.inspector.published },
                        { value: "false", label: copy.inspector.unpublished },
                      ]}
                    />
                    </div>

                    <div className="admin-inspector-basic-control">
                    <SegmentedControl
                      value={editForm.displaySize}
                      onChange={(v) =>
                        setEditForm((f) => ({ ...f, displaySize: v }))
                      }
                      options={[
                        { value: "S", label: "S" },
                        { value: "M", label: "M" },
                        { value: "L", label: "L" },
                      ]}
                    />
                    </div>

                    <label className="admin-inspector-mobile-title col-span-2 md:hidden">
                      <span>{copy.inspector.title}</span>
                      <input
                        aria-label={`${copy.inspector.titleAria} (${copy.inspector.sections.basic})`}
                        value={editForm.title}
                        onChange={(event) =>
                          setEditForm((form) => ({
                            ...form,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="admin-inspector-detail-control col-span-2 grid grid-cols-[auto_1fr_auto] gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((f) => ({
                            ...f,
                            rotationDeg: rotatedBy(f.rotationDeg, -90),
                            ...rotateFocalPoint(f.focalX, f.focalY, -90),
                          }))
                        }
                        aria-label={copy.rotation.leftAria}
                        title={copy.rotation.leftTitle}
                        className="admin-tap-sm flex h-7 w-8 items-center justify-center rounded-sm border border-[var(--admin-line)] bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] transition-colors"
                      >
                        <RotateCcw size={13} />
                      </button>
                      <div className="grid grid-cols-4 gap-1">
                        {ROTATION_OPTIONS.map((deg) => (
                          <button
                            key={deg}
                            type="button"
                            onClick={() =>
                              setEditForm((f) => ({ ...f, rotationDeg: deg }))
                            }
                            aria-pressed={editForm.rotationDeg === deg}
                            className={`admin-tap-sm h-7 rounded-sm text-[length:var(--admin-text-note)] transition-colors ${
                              editForm.rotationDeg === deg
                                ? "admin-btn-primary font-medium"
                                : "border border-[var(--admin-line)] bg-[var(--admin-paper-soft)] text-[var(--admin-muted)]"
                            }`}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((f) => ({
                            ...f,
                            rotationDeg: rotatedBy(f.rotationDeg, 90),
                            ...rotateFocalPoint(f.focalX, f.focalY, 90),
                          }))
                        }
                        aria-label={copy.rotation.rightAria}
                        title={copy.rotation.rightTitle}
                        className="admin-tap-sm flex h-7 w-8 items-center justify-center rounded-sm border border-[var(--admin-line)] bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] transition-colors"
                      >
                        <RotateCw size={13} />
                      </button>
                    </div>

                    <select
                      data-inspector-classification-control
                      value={
                        categories.some((c) => c.slug === editForm.category)
                          ? editForm.category
                          : ""
                      }
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, category: e.target.value }))
                      }
                      aria-label={copy.inspector.quickCategory}
                      className="min-w-0 rounded-sm border border-[var(--admin-line)] bg-[var(--admin-paper-soft)] px-2 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-ink)] outline-none transition-colors"
                    >
                      <option value="">{copy.inspector.noCategory}</option>
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.label}
                        </option>
                      ))}
                    </select>

                    <select
                      data-inspector-classification-control
                      value={
                        seriesList.some(
                          (s) => s.id === Number(editForm.seriesId),
                        )
                          ? editForm.seriesId
                          : ""
                      }
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, seriesId: e.target.value }))
                      }
                      aria-label={copy.inspector.quickSeries}
                      className="min-w-0 rounded-sm border border-[var(--admin-line)] bg-[var(--admin-paper-soft)] px-2 py-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-ink)] outline-none transition-colors"
                    >
                      <option value="">{copy.inspector.noSeries}</option>
                      {seriesList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                          {s.isPublished ? "" : copy.selection.draftSuffix}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })()}

            {/* Metadata form */}
            <div className="admin-inspector-metadata px-3 pb-24 md:pb-4 flex flex-col gap-3 flex-1">
              <div className="border-b border-[var(--admin-line)] pb-2 mb-1">
                  <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider">
                  {copy.inspector.metadata}
                </span>
              </div>

              <InspectField
                label={copy.inspector.focalPoint}
                hint={copy.inspector.focalPointHint}
              >
                <div className="grid grid-cols-[72px_1fr] gap-2">
                  <div className="relative aspect-square overflow-hidden bg-[var(--admin-paper)] border border-[var(--admin-line)] rounded-sm">
                    <img
                      src={srcFor(
                        inspectPhoto.url,
                        400,
                        78,
                        undefined,
                        editForm.rotationDeg,
                      )}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{
                        objectPosition: objectPositionFromFocal(
                          editForm.focalX,
                          editForm.focalY,
                        ),
                      }}
                      draggable={false}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute w-2 h-2 rounded-full border border-white/80 bg-black/30 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                      style={{
                        left: `${editForm.focalX}%`,
                        top: `${editForm.focalY}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {FOCAL_PRESETS.map((point) => {
                      const label = copy.focalPoints[point.key];
                      const active =
                        editForm.focalX === point.x &&
                        editForm.focalY === point.y;
                      return (
                        <button
                          key={`${point.x}-${point.y}`}
                          type="button"
                          onClick={() =>
                            setEditForm((f) => ({
                              ...f,
                              focalX: point.x,
                              focalY: point.y,
                            }))
                          }
                          aria-label={copy.inspector.focalPointAria(label)}
                          aria-pressed={active}
                          title={label}
                          className={`admin-tap-sm h-5 rounded-sm border flex items-center justify-center transition-colors ${
                            active
                              ? "admin-btn-primary border-[var(--admin-line)]"
                              : "bg-[var(--admin-paper-soft)] border-[var(--admin-line)]"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              active
                                ? "bg-[var(--admin-paper)]"
                                : "bg-[var(--admin-muted)]"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </InspectField>

              <InspectField
                label={copy.inspector.title}
                hint={copy.inspector.titleHint}
              >
                <input
                  aria-label={copy.inspector.titleAria}
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder={copy.inspector.titlePlaceholder}
                  className="w-full bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-body)] px-2 py-1.5 rounded-sm border border-[var(--admin-line)] outline-none transition-colors"
                />
              </InspectField>

              <InspectField
                label={copy.inspector.camera}
                hint={copy.inspector.captureHint}
              >
                <input
                  aria-label={copy.inspector.cameraAria}
                  value={editForm.camera}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, camera: e.target.value }))
                  }
                  placeholder="PENTAX 67"
                  list="meta-presets-camera"
                  className="w-full bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-body)] px-2 py-1.5 rounded-sm border border-[var(--admin-line)] outline-none transition-colors"
                />
                <datalist id="meta-presets-camera">
                  {cameraPresets.map((p) => (
                    <option key={p} value={p} aria-label={p} />
                  ))}
                </datalist>
              </InspectField>

              <InspectField
                label={copy.inspector.lens}
                hint={copy.inspector.captureHint}
              >
                <input
                  aria-label={copy.inspector.lensAria}
                  value={editForm.lens}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, lens: e.target.value }))
                  }
                  placeholder="SMC Takumar 105mm f/2.4"
                  list="meta-presets-lens"
                  className="w-full bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-body)] px-2 py-1.5 rounded-sm border border-[var(--admin-line)] outline-none transition-colors"
                />
                <datalist id="meta-presets-lens">
                  {lensPresets.map((p) => (
                    <option key={p} value={p} aria-label={p} />
                  ))}
                </datalist>
              </InspectField>

              <div className="flex items-center gap-1.5 -mt-1">
                <button
                  type="button"
                  onClick={copyInspectCaptureInfo}
                  disabled={!editForm.camera.trim() && !editForm.lens.trim()}
                  title={copy.inspector.copyCapture}
                  aria-label={copy.inspector.copyCapture}
                  className="inline-flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] rounded-sm px-2 py-1 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Copy size={10} /> {copy.inspector.copy}
                </button>
                <button
                  type="button"
                  onClick={pasteInspectCaptureInfo}
                  title={copy.inspector.pasteCapture}
                  aria-label={copy.inspector.pasteCapture}
                  className="inline-flex items-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] rounded-sm px-2 py-1 transition-colors"
                >
                  <ClipboardPaste size={10} /> {copy.inspector.paste}
                </button>
                {captureClipStatus !== "idle" && (
                  <span
                    className={`text-[length:var(--admin-text-note)] ${captureClipStatus === "error" ? "admin-text-warning" : "admin-text-success"}`}
                  >
                    {copy.captureStatus[captureClipStatus]}
                  </span>
                )}
              </div>

              <InspectField
                label={copy.inspector.filmDigital}
                hint={copy.inspector.captureHint}
              >
                <div className="flex gap-1">
                  {(
                    [
                      ["フィルム", copy.import.film],
                      ["デジタル", copy.import.digital],
                      ["", "—"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={lbl}
                      onClick={() =>
                        setEditForm((f) => ({ ...f, filmType: val }))
                      }
                      className={`flex-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors ${
                        editForm.filmType === val
                          ? "admin-btn-primary font-medium"
                          : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)] border border-[var(--admin-line)]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </InspectField>

              <InspectField
                label={copy.inspector.shotDate}
                hint={copy.inspector.shotDateHint}
              >
                <div className="flex gap-1.5 items-center">
                  <input
                    aria-label={copy.inspector.shotDateAria}
                    type="date"
                    lang={language === "ja" ? "ja-JP" : "en"}
                    value={editForm.shotAt}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, shotAt: e.target.value }))
                    }
                    className="flex-1 bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-body)] px-2 py-1.5 rounded-sm border border-[var(--admin-line)] outline-none transition-colors [color-scheme:dark]"
                  />
                  {editForm.shotAt && (
                    <button
                      onClick={() => setEditForm((f) => ({ ...f, shotAt: "" }))}
                      aria-label={copy.inspector.clearShotDate}
                      className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors px-1.5"
                    >
                      {copy.inspector.clear}
                    </button>
                  )}
                </div>
              </InspectField>

              <InspectField
                label={copy.inspector.description}
                hint={copy.inspector.descriptionHint}
              >
                <textarea
                  aria-label={copy.inspector.descriptionAria}
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder={copy.inspector.descriptionPlaceholder}
                  className="w-full bg-[var(--admin-paper-soft)] text-[var(--admin-ink)] text-[length:var(--admin-text-body)] px-2 py-1.5 rounded-sm border border-[var(--admin-line)] outline-none transition-colors resize-y"
                />
              </InspectField>

              <div className="admin-inspector-desktop-actions flex gap-2 mt-1">
                <button
                  disabled={updatePhoto.isPending}
                  onClick={saveInspectorChanges}
                  className={`flex-1 flex items-center justify-center gap-1 text-[length:var(--admin-text-note)] py-1.5 rounded-sm transition-colors disabled:opacity-60 ${
                    metaSaved
                      ? "admin-btn-success"
                      : "admin-btn-primary"
                  }`}
                >
                  {updatePhoto.isPending ? (
                    <>
                      <Loader2 size={11} className="animate-spin" />{" "}
                      {copy.inspector.saving}
                    </>
                  ) : metaSaved ? (
                    <>
                      <Check size={11} /> {copy.inspector.saved}
                    </>
                  ) : (
                    <>
                      <Check size={11} /> {copy.inspector.save}
                    </>
                  )}
                </button>
                <button
                  onClick={discardInspectorChanges}
                  className="flex-1 flex items-center justify-center gap-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] bg-[var(--admin-paper-soft)] py-1.5 rounded-sm transition-colors"
                >
                  <X size={11} /> {copy.inspector.reset}
                </button>
              </div>
              {/* O1: duplicate this photo (same image, copied metadata) */}
              <button
                onClick={() => duplicatePhoto.mutate(inspectPhoto.id)}
                disabled={duplicatePhoto.isPending}
                className="flex items-center justify-center gap-1.5 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] bg-[var(--admin-paper-soft)] border border-[var(--admin-line)] py-1.5 rounded-sm transition-colors disabled:opacity-50"
              >
                {duplicatePhoto.isPending ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <ImageLucide size={11} />
                )}{" "}
                {copy.inspector.duplicate}
              </button>
              {metaError && (
                <p role="alert" className="admin-text-danger text-[length:var(--admin-text-note)] -mt-1">
                  {copy.inspector.saveFailed}
                </p>
              )}

              {/* O5: usage — where this photo appears */}
              {(() => {
                const heroIdx = (heroData?.heroPhotos ?? []).findIndex(
                  (h) => h.photoId === inspectPhoto.id,
                );
                const seriesName = inspectPhoto.seriesId
                  ? seriesList.find((s) => s.id === inspectPhoto.seriesId)
                      ?.title
                  : null;
                const catLabel = categories.find(
                  (c) => c.slug === inspectPhoto.category,
                )?.label;
                const pos = allPhotos.findIndex(
                  (p) => p.id === inspectPhoto.id,
                );
                const rows: [string, string][] = [
                  [
                    copy.inspector.hero,
                    heroIdx >= 0
                      ? copy.inspector.heroSet(heroIdx + 1)
                      : copy.inspector.notSet,
                  ],
                  [
                    copy.inspector.series,
                    seriesName ?? copy.inspector.unassigned,
                  ],
                  [
                    copy.inspector.category,
                    catLabel ?? copy.inspector.uncategorized,
                  ],
                  [
                    copy.inspector.sortOrder,
                    pos >= 0
                      ? copy.inspector.orderPosition(pos + 1, allPhotos.length)
                      : "—",
                  ],
                ];
                return (
                  <div className="border-t border-[var(--admin-line)] pt-3 mt-1 flex flex-col gap-1">
                    <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider mb-0.5">
                      {copy.inspector.usage}
                    </span>
                    {rows.map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between gap-2 text-[length:var(--admin-text-note)]"
                      >
                        <span className="text-[var(--admin-muted)] flex-shrink-0">
                          {k}
                        </span>
                        <span className="text-[var(--admin-ink)] text-right truncate">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="border-t border-[var(--admin-line)] pt-3 mt-2">
                <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider">
                  {copy.inspector.fileInfo}
                </span>
                <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)] mt-2 break-all">
                  {inspectPhoto.filename}
                </p>
              </div>

              <div className="mt-auto pt-4 pb-16">
                <button
                  onClick={() => deletePhotos.mutate([inspectPhoto.id])}
                  disabled={bulkBusy}
                  className="admin-text-danger w-full flex items-center justify-center gap-1.5 text-[length:var(--admin-text-note)] bg-[var(--admin-paper-soft)] py-2 rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Trash2 size={11} /> {copy.inspector.moveToTrash}
                </button>
              </div>
            </div>
            <div
              data-inspector-save-bar
              data-inspector-save-state={
                updatePhoto.isPending
                  ? "saving"
                  : metaError
                    ? "error"
                    : metaSaved
                      ? "saved"
                      : photoEditFormChanged(editForm, inspectPhoto)
                        ? "dirty"
                        : "clean"
              }
              className="admin-inspector-mobile-save md:hidden"
            >
              <span role={metaError ? "alert" : "status"} aria-live="polite">
                {updatePhoto.isPending
                  ? copy.inspector.saving
                  : metaError
                    ? copy.inspector.saveFailed
                    : metaSaved
                      ? copy.inspector.saved
                      : photoEditFormChanged(editForm, inspectPhoto)
                        ? copy.inspector.unsaved
                        : copy.inspector.saved}
              </span>
              <div>
                <button type="button" onClick={discardInspectorChanges}>
                  {copy.inspector.reset}
                </button>
                <button
                  type="button"
                  onClick={saveInspectorChanges}
                  disabled={
                    updatePhoto.isPending ||
                    (!metaError && !photoEditFormChanged(editForm, inspectPhoto))
                  }
                  className="admin-btn-primary"
                >
                  {metaError ? copy.inspector.retry : copy.inspector.save}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* サイトプレビュー — 並べ替え・S/M/L・回転の結果を公開サイトの誌面で
          その場で確認する。モバイル: 全画面オーバーレイ / デスクトップ: 右パネル */}
      {showSitePreview && !showTrash && (
        <div
          data-admin-preview-shell
          className="fixed inset-0 z-50 flex flex-col bg-[color:var(--admin-paper)] sm:static sm:z-auto sm:w-[440px] sm:flex-shrink-0 sm:border-l sm:border-[color:var(--admin-line)] min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 px-3 h-10 border-b border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] flex-shrink-0">
            <div className="flex items-center gap-1">
              {(
                [
                  ["top", copy.sitePreview.top],
                  ["gallery", copy.sitePreview.gallery],
                ] as const
              ).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setSitePreviewPage(val)}
                  aria-pressed={sitePreviewPage === val}
                  className={`px-2 py-1 rounded-sm text-[length:var(--admin-text-note)] transition-colors ${
                    sitePreviewPage === val
                      ? "bg-[var(--admin-paper-soft)] text-[var(--admin-ink)]"
                      : "text-[var(--admin-muted)]"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSitePreviewDevice("desktop")}
                aria-pressed={sitePreviewDevice === "desktop"}
                title={copy.sitePreview.desktopTitle}
                aria-label={copy.sitePreview.desktopTitle}
                className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[length:var(--admin-text-note)] transition-colors ${
                  sitePreviewDevice === "desktop"
                    ? "bg-[var(--admin-paper-soft)] text-[var(--admin-ink)]"
                    : "text-[var(--admin-muted)]"
                }`}
              >
                <Monitor size={13} /> {copy.sitePreview.desktop}
              </button>
              <button
                onClick={() => setSitePreviewDevice("mobile")}
                aria-pressed={sitePreviewDevice === "mobile"}
                title={copy.sitePreview.mobileTitle}
                aria-label={copy.sitePreview.mobileTitle}
                className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[length:var(--admin-text-note)] transition-colors ${
                  sitePreviewDevice === "mobile"
                    ? "bg-[var(--admin-paper-soft)] text-[var(--admin-ink)]"
                    : "text-[var(--admin-muted)]"
                }`}
              >
                <Smartphone size={13} /> {copy.sitePreview.mobile}
              </button>
              <button
                onClick={() =>
                  sitePreviewRef.current?.contentWindow?.location.reload()
                }
                className="ml-1 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] transition-colors"
              >
                Reload
              </button>
              <button
                onClick={() => setShowSitePreview(false)}
                className="ml-1 p-1.5 rounded-sm text-[var(--admin-muted)] transition-colors"
                title={copy.sitePreview.close}
                aria-label={copy.sitePreview.close}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div
            ref={previewStageRef}
            data-admin-preview-stage
            className="flex-1 overflow-hidden bg-[color:var(--admin-paper)]"
          >
            {sitePreviewDevice === "mobile" ? (
              <div className="h-full flex items-start justify-center overflow-auto p-3">
                <div
                  className="bg-white overflow-hidden shadow-lg w-[375px] max-w-full h-full max-h-[720px]"
                  style={{
                    border: "8px solid var(--admin-line-strong)",
                    borderRadius: "20px",
                  }}
                >
                  <iframe
                    ref={sitePreviewRef}
                    src={`${sitePreviewPage === "top" ? "/" : "/gallery"}${demoSeed ? `?admin-demo-preview=${encodeURIComponent(demoSeed)}` : ""}`}
                    className="w-full h-full border-0"
                    title={copy.sitePreview.title}
                  />
                </div>
              </div>
            ) : (
              // PC幅: 1280px の紙面をパネル幅に合わせて縮小して見せる
              <div className="w-full h-full overflow-hidden">
                {(() => {
                  const scale =
                    previewStage.w > 0
                      ? Math.min(1, previewStage.w / 1280)
                      : 0.33;
                  return (
                    <div
                      style={{
                        width: 1280,
                        height:
                          previewStage.h > 0 ? previewStage.h / scale : 2000,
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                      }}
                      className="bg-white"
                    >
                      <iframe
                        ref={sitePreviewRef}
                        src={`${sitePreviewPage === "top" ? "/" : "/gallery"}${demoSeed ? `?admin-demo-preview=${encodeURIComponent(demoSeed)}` : ""}`}
                        className="w-full h-full border-0"
                        title={copy.sitePreview.title}
                      />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   BULK EDIT TABLE — スプレッドシート形式の一括編集
══════════════════════════════════════════════════ */
type BulkEditSaveData = {
  title: string;
  camera: string;
  lens: string;
  filmType: string;
  seriesId: string;
  displaySize: string;
};
type RowSaveStatus = "idle" | "saving" | "saved" | "error";

function BulkEditTable({
  photos,
  recentlyAddedCount,
  seriesList,
  cameraPresets,
  lensPresets,
  onSave,
}: {
  photos: readonly Photo[];
  recentlyAddedCount: number;
  seriesList: AdminSeries[];
  cameraPresets: string[];
  lensPresets: string[];
  onSave: (id: number, data: BulkEditSaveData) => Promise<void>;
}) {
  const { t } = useAdminI18n();
  const copy = t.phase2b.library;
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--admin-muted)]">
        <EmptyContactSheetIllustration />
        <p className="text-sm">{copy.empty.noPhotos}</p>
        <p className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
          {copy.empty.tableHint}
        </p>
      </div>
    );
  }

  return (
    <div data-bulk-edit-table-scroll className="overflow-x-auto h-full">
      <table className="w-full min-w-[860px] border-collapse text-[length:var(--admin-text-body)]">
        <thead className="sticky top-0 z-10 bg-[var(--admin-paper)] border-b border-[var(--admin-line)]">
          <tr>
            <th className="w-7" aria-label={copy.inspector.selectColumn} />
            <th className="w-12" aria-label={copy.inspector.thumbnailColumn} />
            <th className="text-left px-2 py-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider font-normal">
              {copy.inspector.title}
            </th>
            <th className="text-left px-2 py-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider font-normal w-44">
              {copy.inspector.camera}
            </th>
            <th className="text-left px-2 py-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider font-normal w-48">
              {copy.inspector.lens}
            </th>
            <th className="text-left px-2 py-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider font-normal w-36">
              {copy.inspector.series}
            </th>
            <th className="text-left px-2 py-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider font-normal w-20">
              {copy.inspector.displaySize}
            </th>
            <th className="text-left px-2 py-2 text-[length:var(--admin-text-note)] text-[var(--admin-muted)] uppercase tracking-wider font-normal w-28">
              {copy.albums.medium}
            </th>
          </tr>
        </thead>
        <tbody>
          {recentlyAddedCount > 0 && (
            <tr data-library-recently-added-table-heading>
              <th
                colSpan={8}
                scope="rowgroup"
                className="border-b border-[var(--admin-line)] bg-[var(--admin-paper-soft)] px-3 py-2 text-left text-[length:var(--admin-text-body)] font-normal text-[var(--admin-ink)]"
              >
                {copy.selection.recentlyAddedHeading(recentlyAddedCount)}
              </th>
            </tr>
          )}
          {photos.map((photo) => (
            <BulkEditRow
              key={photo.id}
              photo={photo}
              seriesList={seriesList}
              cameraPresets={cameraPresets}
              lensPresets={lensPresets}
              onSave={onSave}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulkEditRow({
  photo,
  seriesList,
  cameraPresets,
  lensPresets,
  onSave,
}: {
  photo: Photo;
  seriesList: AdminSeries[];
  cameraPresets: string[];
  lensPresets: string[];
  onSave: (id: number, data: BulkEditSaveData) => Promise<void>;
}) {
  const { t } = useAdminI18n();
  const copy = t.phase2b.library;
  const initDraft: BulkEditSaveData = {
    title: photo.title ?? "",
    camera: photo.camera ?? "",
    lens: photo.lens ?? "",
    filmType: photo.filmType ?? "",
    seriesId: photo.seriesId ? String(photo.seriesId) : "",
    displaySize: photo.displaySize ?? "M",
  };
  const [draft, setDraft] = useState<BulkEditSaveData>(initDraft);
  const [status, setStatus] = useState<RowSaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [clipStatus, setClipStatus] = useState<CaptureClipboardStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<BulkEditSaveData>(initDraft);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const photoIdRef = useRef(photo.id);
  photoIdRef.current = photo.id;

  // Sync draft from DB when photo prop changes externally (no pending edit/save).
  // Prevents stale overwrites when inspector edits and BulkEditTable are used in the same session.
  useEffect(() => {
    if (dirtyRef.current || timerRef.current || savingRef.current) return;
    const fresh: BulkEditSaveData = {
      title: photo.title ?? "",
      camera: photo.camera ?? "",
      lens: photo.lens ?? "",
      filmType: photo.filmType ?? "",
      seriesId: photo.seriesId ? String(photo.seriesId) : "",
      displaySize: photo.displaySize ?? "M",
    };
    setDraft(fresh);
    latestRef.current = fresh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    photo.id,
    photo.title,
    photo.camera,
    photo.lens,
    photo.filmType,
    photo.seriesId,
    photo.displaySize,
  ]);

  // Flush pending save on unmount instead of discarding it
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
      if (dirtyRef.current) {
        onSaveRef
          .current(photoIdRef.current, latestRef.current)
          .catch(() => {});
      }
    },
    [],
  );

  const showClipStatus = (nextStatus: CaptureClipboardStatus) => {
    setClipStatus(nextStatus);
    if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    if (nextStatus !== "idle") {
      clipTimerRef.current = setTimeout(() => setClipStatus("idle"), 1500);
    }
  };

  const patchDraft = (patch: Partial<BulkEditSaveData>) => {
    const next = { ...latestRef.current, ...patch };
    latestRef.current = next;
    dirtyRef.current = true;
    setDraft(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      dirtyRef.current = false;
      savingRef.current = true;
      setStatus("saving");
      try {
        await onSave(photo.id, latestRef.current);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } catch (e) {
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : copy.bulkTable.saveFailed);
      } finally {
        savingRef.current = false;
      }
    }, 500);
  };

  const handleChange = (field: keyof BulkEditSaveData, value: string) => {
    patchDraft({ [field]: value } as Partial<BulkEditSaveData>);
  };

  const copyRowCaptureInfo = async () => {
    const text = formatCaptureInfo({ camera: draft.camera, lens: draft.lens });
    if (!text) return;
    try {
      await writeClipboardText(text);
      showClipStatus("copied");
    } catch {
      showClipStatus("error");
    }
  };

  const pasteRowCaptureInfo = async () => {
    try {
      const parsed = parseCaptureInfo(await readClipboardText());
      if (!parsed) throw new Error("empty clipboard");
      patchDraft({ camera: parsed.camera, lens: parsed.lens });
      showClipStatus("pasted");
    } catch {
      showClipStatus("error");
    }
  };

  const rowBg =
    status === "saved"
      ? "bg-[rgba(var(--admin-success-rgb),0.08)]"
      : status === "error"
        ? "bg-[rgba(var(--admin-danger-rgb),0.08)]"
        : "";
  const inputCls =
    "w-full bg-transparent text-[var(--admin-ink)] outline-none border-b border-transparent transition-colors py-0.5 text-[length:var(--admin-text-body)]";
  const cellCls = "px-2 py-1 align-middle";

  return (
    <tr
      data-bulk-edit-photo-id={photo.id}
      className={`border-b border-[var(--admin-line)] transition-colors ${rowBg} group`}
    >
      {/* Save status indicator */}
      <td className="w-7 px-1 text-center align-middle">
        {status === "saving" && (
          <Loader2
            size={11}
            className="animate-spin text-[var(--admin-muted)] mx-auto"
          />
        )}
        {status === "saved" && (
          <Check size={11} className="admin-text-success mx-auto" />
        )}
        {status === "error" && (
          <span title={errorMsg} className="cursor-help block">
            <AlertTriangle size={11} className="admin-text-warning mx-auto" />
          </span>
        )}
      </td>

      {/* Thumbnail */}
      <td className="w-12 py-1 pl-1 align-middle">
        <img
          src={adminPhotoSrc(photo, 100, 60)}
          alt={photo.title || photo.filename}
          className="w-11 h-11 object-cover bg-[var(--admin-paper)] rounded-sm"
          style={{ objectPosition: adminPhotoObjectPosition(photo) }}
          loading="lazy"
        />
      </td>

      {/* Title */}
      <td className={cellCls}>
        <input
          aria-label={copy.bulkTable.titleAria}
          value={draft.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder={photo.filename}
          className={inputCls}
        />
      </td>

      {/* Camera */}
      <td className={`${cellCls} w-44`}>
        <div className="flex items-center gap-1">
          <input
            aria-label={copy.bulkTable.cameraAria}
            list={`bulk-cam-${photo.id}`}
            value={draft.camera}
            onChange={(e) => handleChange("camera", e.target.value)}
            placeholder="—"
            className={`${inputCls} min-w-0`}
          />
          <button
            type="button"
            onClick={copyRowCaptureInfo}
            disabled={!draft.camera.trim() && !draft.lens.trim()}
            title={copy.inspector.copyCapture}
            aria-label={copy.inspector.copyCapture}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--admin-muted)] disabled:opacity-20 transition-opacity"
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            onClick={pasteRowCaptureInfo}
            title={copy.inspector.pasteCapture}
            aria-label={copy.inspector.pasteCapture}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--admin-muted)] transition-opacity"
          >
            <ClipboardPaste size={11} />
          </button>
        </div>
        {clipStatus !== "idle" && (
          <span
            className={`text-[length:var(--admin-text-note)] ${clipStatus === "error" ? "admin-text-warning" : "admin-text-success"}`}
          >
            {copy.captureStatus[clipStatus]}
          </span>
        )}
        <datalist id={`bulk-cam-${photo.id}`}>
          {cameraPresets.map((p) => (
            <option key={p} value={p} aria-label={p} />
          ))}
        </datalist>
      </td>

      {/* Lens */}
      <td className={`${cellCls} w-48`}>
        <input
          aria-label={copy.bulkTable.lensAria}
          list={`bulk-lens-${photo.id}`}
          value={draft.lens}
          onChange={(e) => handleChange("lens", e.target.value)}
          placeholder="—"
          className={inputCls}
        />
        <datalist id={`bulk-lens-${photo.id}`}>
          {lensPresets.map((p) => (
            <option key={p} value={p} aria-label={p} />
          ))}
        </datalist>
      </td>

      {/* Series */}
      <td className={`${cellCls} w-36`}>
        <select
          aria-label={copy.bulkTable.seriesAria}
          value={draft.seriesId}
          onChange={(e) => handleChange("seriesId", e.target.value)}
          className="w-full bg-[var(--admin-paper)] text-[var(--admin-ink)] outline-none border border-transparent transition-colors py-0.5 rounded-sm text-[length:var(--admin-text-note)]"
        >
          <option value="">—</option>
          {seriesList.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.title}
            </option>
          ))}
        </select>
      </td>

      {/* Display Size */}
      <td className={`${cellCls} w-20`}>
        <div className="flex gap-0.5">
          {(["S", "M", "L"] as const).map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => handleChange("displaySize", sz)}
              className={`flex-1 text-[length:var(--admin-text-note)] py-0.5 rounded-sm transition-colors ${
                draft.displaySize === sz
                  ? "admin-btn-primary font-medium"
                  : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)]"
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
      </td>

      {/* Medium (Film / Digital / —) */}
      <td className={`${cellCls} w-28`}>
        <div className="flex gap-0.5">
          {(
            [
              ["フィルム", copy.bulkTable.filmShort],
              ["デジタル", copy.bulkTable.digitalShort],
              ["", "—"],
            ] as const
          ).map(([val, lbl]) => (
            <button
              key={lbl}
              type="button"
              onClick={() => handleChange("filmType", val)}
              className={`flex-1 text-[length:var(--admin-text-note)] py-0.5 rounded-sm transition-colors ${
                draft.filmType === val
                  ? "admin-btn-primary font-medium"
                  : "bg-[var(--admin-paper-soft)] text-[var(--admin-muted)]"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}

function InspectField({
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

/* ══════════════════════════════════════════════════
   HERO TAB
══════════════════════════════════════════════════ */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// 工程3: shared enter/exit shell for toasts — same delayed-unmount idiom as
// Modal/FloatingSaveBar so translateY+opacity can animate out instead of the
// toast just vanishing at its setTimeout.
function Toast({
  show,
  className = "",
  role,
  children,
}: {
  show: boolean;
  className?: string;
  role?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(show);
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");
  const prevShowRef = useRef(show);

  useEffect(() => {
    if (show && !mounted) {
      setMounted(true);
      setPhase("enter");
    }
  }, [show, mounted]);

  useEffect(() => {
    if (mounted && phase === "enter") {
      const id = requestAnimationFrame(() => setPhase("show"));
      return () => cancelAnimationFrame(id);
    }
  }, [mounted, phase]);

  useEffect(() => {
    if (prevShowRef.current && !show) {
      setPhase("exit");
      const t = setTimeout(
        () => setMounted(false),
        prefersReducedMotion() ? 0 : 160,
      );
      prevShowRef.current = show;
      return () => clearTimeout(t);
    }
    prevShowRef.current = show;
  }, [show]);

  if (!mounted) return null;
  return (
    <div data-phase={phase} role={role} className={`admin-toast ${className}`}>
      {children}
    </div>
  );
}

// Simple subsequence fuzzy match (order-preserving, no ranking) — enough for
// an 11-item destination list; a scoring/ranking matcher would be overkill.
function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  let ti = 0;
  for (const ch of query.toLowerCase()) {
    const idx = t.indexOf(ch, ti);
    if (idx === -1) return false;
    ti = idx + 1;
  }
  return true;
}

// 工程5: ⌘K quick palette — navigation only (jump to a tab / Trash / the
// public site). Built on the same <dialog> + phase animation as Modal, just
// top-anchored instead of centered and with its own search+list body.
function QuickPalette({
  open,
  onClose,
  destinations,
}: {
  open: boolean;
  onClose: () => void;
  destinations: PaletteDestination[];
}) {
  const { t } = useAdminI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const closingRef = useRef(false);

  useEffect(() => {
    if (open && !mounted) {
      setMounted(true);
      setPhase("enter");
      setQuery("");
      setActiveIndex(0);
      closingRef.current = false;
    }
  }, [open, mounted]);

  useEffect(() => {
    if (mounted && phase === "enter") {
      const id = requestAnimationFrame(() => setPhase("show"));
      return () => cancelAnimationFrame(id);
    }
  }, [mounted, phase]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    onCloseRef.current();
    if (prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    setPhase("exit");
    setTimeout(() => setMounted(false), 160);
  }, []);

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      requestClose();
    }
    prevOpenRef.current = open;
  }, [open, requestClose]);

  useEffect(() => {
    const d = ref.current;
    if (!d || !mounted) return;
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
  }, [mounted, requestClose]);

  useEffect(() => {
    if (mounted) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [mounted]);

  useEffect(() => setActiveIndex(0), [query]);

  if (!mounted) return null;

  const filtered = destinations.filter(
    (d) =>
      !query.trim() || fuzzyMatch(d.label, query) || fuzzyMatch(d.group, query),
  );

  const activate = (d: PaletteDestination) => {
    d.action();
    requestClose();
  };

  return (
    <dialog ref={ref} data-phase={phase} className="admin-glass admin-palette">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.navigation.palettePlaceholder}
        aria-label={t.navigation.paletteLabel}
        className="admin-palette__input"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const d = filtered[activeIndex];
            if (d) activate(d);
          }
        }}
      />
      <ul
        className="admin-palette__list"
        aria-label={t.navigation.paletteDestinationsLabel}
      >
        {filtered.map((d, i) => (
          <li key={d.id}>
            <button
              type="button"
              data-active={i === activeIndex || undefined}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => activate(d)}
              className="admin-palette__option"
            >
              {d.icon}
              <span>{d.label}</span>
              <span className="admin-palette__group">{d.group}</span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="admin-palette__empty">
            {t.navigation.paletteEmpty}
          </li>
        )}
      </ul>
    </dialog>
  );
}

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
  // 退場アニメーション後に onClose を呼ぶタイマー。**unmount で必ず取り消す。**
  // 取り消さないと、閉じ終わったダイアログのタイマーが後から発火し、
  // その時点で開いている「別の（新しい）ダイアログ」を閉じてしまう
  // (2026-07-30: ×を押すと確認が約40msで消える不具合の原因)。
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase("show"));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    },
    [],
  );
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (prefersReducedMotion()) {
      onCloseRef.current();
      return;
    }
    setPhase("exit");
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      onCloseRef.current();
    }, 160);
  }, []);
  // Wire Escape (native `cancel`) and backdrop click via the DOM rather than JSX
  // props: <dialog> is a non-interactive element, so JSX mouse/key handlers on it
  // trip jsx-a11y — addEventListener keeps the behaviour without the lint.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // Native showModal gives us the focus trap; the browser only restores
    // focus on close(), not on unmount, so capture/restore the opener here.
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!d.open) d.showModal();
    // React's autoFocus is a no-op inside a not-yet-shown <dialog>, so the
    // preferred initial control opts in via data-autofocus instead.
    d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
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
      // While the dialog sits in the top layer, focus() on outside elements
      // is blocked — leave the top layer first, then hand focus back.
      d.close();
      opener?.focus();
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

// 工程5: empty-state illustrations — quiet line art, single ink color, no
// external assets. Contact sheet (no photos at all), a loupe over an empty
// frame (no search/filter results), a developing tray (empty trash).
// 工程5: Library count "slot" swap — old number slides up + fades, new one
// slides in from below (dur-base). Keyed children force React to remount
// the swapped-in node so its CSS animation restarts on every value change.
function CountSwap({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    const from = prevRef.current;
    prevRef.current = value;
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    setPrevValue(from);
    setDisplay(value);
    const t = setTimeout(() => setPrevValue(null), 220);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span className="admin-count-swap tabular-nums">
      <span className="admin-count-swap__slot">
        <span
          key={`cur-${display}`}
          className="admin-count-swap__num admin-count-swap__num--current"
        >
          {display}
        </span>
        {prevValue !== null && (
          <span
            key={`old-${prevValue}`}
            aria-hidden="true"
            className="admin-count-swap__num admin-count-swap__num--old"
          >
            {prevValue}
          </span>
        )}
      </span>
    </span>
  );
}

function EmptyContactSheetIllustration() {
  return (
    <svg
      viewBox="0 0 64 64"
      width={56}
      height={56}
      fill="none"
      aria-hidden="true"
      className="text-[var(--admin-muted)]"
    >
      <rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={14 + col * 14}
            y={14 + row * 14}
            width="8"
            height="8"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.2"
            opacity={0.55}
          />
        )),
      )}
    </svg>
  );
}

function EmptyTrashIllustration() {
  return (
    <svg
      viewBox="0 0 64 64"
      width={56}
      height={56}
      fill="none"
      aria-hidden="true"
      className="text-[var(--admin-muted)]"
    >
      <path
        d="M14 24 L20 50 Q20 52 22 52 L42 52 Q44 52 44 50 L50 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 24 H54"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M25 33 Q32 30 39 33"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity={0.5}
        strokeLinecap="round"
      />
      <path
        d="M25 40 Q32 37 39 40"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity={0.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

// 工程3: segmented control with one shared sliding pill (transform-driven)
// instead of each option toggling its own background independently.
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const btnRefs = useRef<Partial<Record<string, HTMLButtonElement>>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const el = btnRefs.current[value];
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options]);

  return (
    <div className="relative flex rounded-[var(--radius-s)] bg-[color:var(--admin-paper-deep)] p-0.5">
      {pill && (
        <div
          aria-hidden="true"
          className="admin-segmented__indicator absolute top-0.5 bottom-0.5 rounded-[var(--radius-s)] transition-[transform,width] duration-[var(--dur-base)] ease-[var(--ease-inout)]"
          style={{
            transform: `translateX(${pill.left}px)`,
            width: pill.width,
            boxShadow: "var(--shadow-1)",
          }}
        />
      )}
      {options.map((opt) => (
        <button
          key={opt.value}
          ref={(el) => {
            if (el) btnRefs.current[opt.value] = el;
          }}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`admin-tap-sm admin-segmented__option relative z-[1] flex-1 rounded-[var(--radius-s)] px-1.5 py-1 text-[length:var(--admin-text-note)] transition-colors duration-[var(--dur-fast)] ${
            value === opt.value ? "font-medium" : "text-[var(--admin-muted)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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
