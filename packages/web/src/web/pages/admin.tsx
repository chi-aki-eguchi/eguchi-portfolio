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
  normalizeRotationDeg,
  objectPositionFromFocal,
  orientedDimensions,
  rotateRotationDeg,
  srcFor,
} from "../lib/picture";
import { moveRelativeToViewNeighbor, moveToViewEdge } from "../lib/reorder";
import {
  shotAtForDateInputSave,
  shotAtForUploadedPhoto,
} from "../lib/upload-date";
import {
  imageFileTooLarge,
  isUploadableImageFile,
  shouldUploadImagesSerially,
  UPLOAD_IMAGE_ACCEPT,
  uploadFailureNotice,
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
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  Star,
  StarOff,
  Layers,
  Pencil,
  Receipt,
  FolderOpen,
  Search,
  LayoutList,
  AlertTriangle,
  Copy,
  ClipboardPaste,
  Crosshair,
  RotateCcw,
  RotateCw,
  Monitor,
  Smartphone,
} from "lucide-react";
import {
  ADMIN_TAB_GROUPS,
  groupForTab,
  isAdminTab,
  type Tab,
} from "./admin-shared";
import { PageHeader, PageHeaderButton } from "./admin-page-header";

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

const ADMIN_TABS: Record<Tab, { label: string; icon: React.ReactNode }> = {
  setup: { label: "はじめに", icon: <Check size={15} /> },
  gallery: { label: "Library", icon: <ImageLucide size={15} /> },
  hero: { label: "Hero", icon: <Grid size={15} /> },
  profile: { label: "Profile", icon: <User size={15} /> },
  categories: { label: "Categories", icon: <Tag size={15} /> },
  series: { label: "Series", icon: <Layers size={15} /> },
  pricing: { label: "Pricing", icon: <Receipt size={15} /> },
  service: { label: "Service", icon: <ExternalLink size={15} /> },
  settings: { label: "Settings", icon: <Settings size={15} /> },
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
    throw new Error("セッションが切れました。再ログインしてください。");
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

function useAdminGuard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-me"],
    queryFn: async () =>
      jsonOrThrow<{ authenticated: boolean }>(await adminApi.me.$get()),
    retry: false,
  });
  // Redirect in an effect, not during render (render-phase navigation triggers
  // React warnings and can fire repeatedly).
  useEffect(() => {
    if (!isLoading && !data?.authenticated) navigate("/admin/login");
  }, [isLoading, data?.authenticated, navigate]);
  return { isLoading, authenticated: data?.authenticated };
}

/* ══════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════ */
type Rgb = { r: number; g: number; b: number };

const ATELIER_FALLBACK = {
  paper: "#f7f4ec",
  ink: "#2e2c27",
  muted: "#6b6659",
  accent: "#a33b2e",
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

function adminThemeFromSettings(
  settings?: Record<string, string>,
): CSSProperties {
  const neutral = parseHexColor(ATELIER_FALLBACK.paper)!;
  const siteBg = parseHexColor(settings?.themeBg) ?? neutral;
  const base = mix(
    mix(siteBg, neutral, 0.86),
    { r: 255, g: 255, b: 255 },
    0.06,
  );
  const soft = mix(base, { r: 46, g: 44, b: 39 }, 0.035);
  const deep = mix(base, { r: 46, g: 44, b: 39 }, 0.075);
  const line = mix(base, { r: 46, g: 44, b: 39 }, 0.14);
  const lineStrong = mix(base, { r: 46, g: 44, b: 39 }, 0.22);
  const ink = ensureContrast(
    parseHexColor(settings?.themeText) ?? parseHexColor(ATELIER_FALLBACK.ink)!,
    base,
    7,
  );
  // Checked against `deep` (the darkest paper tone actually used behind text,
  // e.g. the sidebar) rather than `base` — passing against the darkest paper
  // variant guarantees the same minimum against the lighter ones too.
  const muted = ensureContrast(mix(ink, base, 0.38), deep, 4.5);
  const accent = ensureContrast(
    parseHexColor(settings?.accentColor) ??
      parseHexColor(settings?.linkHoverColor) ??
      parseHexColor(ATELIER_FALLBACK.accent)!,
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
    "--admin-danger": toHex(accent),
  } as CSSProperties;
}

export default function AdminPage() {
  const { isLoading, authenticated } = useAdminGuard();
  const [, navigate] = useLocation();
  const { data: shellSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () =>
      jsonOrThrow<Record<string, string>>(await api.settings.$get()),
  });
  const [tab, setTab] = usePersistentState<Tab>(
    "admin:tab",
    "gallery",
    "local",
  );
  const [galleryUploading, setGalleryUploading] = useState(false);
  // Generic unsaved-draft flag reported by any tab with a draft form.
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [unsavedConfirm, setUnsavedConfirm] = useState<Tab | "logout" | null>(
    null,
  );
  // 工程5: ⌘K quick palette (navigation only) + a signal GalleryTab watches
  // to auto-open Trash, since that's a toggle inside the tab, not a Tab.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openTrashRequest, setOpenTrashRequest] = useState(0);

  useEffect(() => {
    if (!isAdminTab(tab)) setTab("gallery");
  }, [tab, setTab]);

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

  // 工程3: sidebar active indicator slides between tabs (transform only) —
  // one shared bar instead of each tab fading its own in/out independently.
  const tabButtonRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({});
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = tabButtonRefs.current[tab];
    if (el) setIndicatorTop(el.offsetTop);
  }, [tab]);
  // The sidebar is `hidden lg:flex` — its buttons have no layout box (and
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
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[#555]" />
      </div>
    );
  if (!authenticated) return null;

  const activeGroup = groupForTab(tab);
  const visibleTabs = activeGroup.tabs.map((key) => ({
    key,
    ...ADMIN_TABS[key],
  }));
  const sidebarSiteName =
    shellSettings?.siteNameEn?.trim() ||
    shellSettings?.siteName?.trim() ||
    "Photography";
  // Returns whether the switch actually happened (false when blocked by the
  // unsaved-changes guard) — callers that queue a follow-up action (like
  // opening Trash) must only do so once the switch has actually gone through.
  const requestTab = (nextTab: Tab): boolean => {
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
    ...ADMIN_TAB_GROUPS.flatMap((group) =>
      group.tabs.map((key) => ({
        id: key,
        label: ADMIN_TABS[key].label,
        group: group.label,
        icon: ADMIN_TABS[key].icon,
        action: () => requestTab(key),
      })),
    ),
    {
      id: "trash",
      label: "Trash",
      group: "写真",
      icon: <Trash2 size={15} />,
      action: () => {
        if (requestTab("gallery")) setOpenTrashRequest((n) => n + 1);
      },
    },
    {
      id: "open-site",
      label: "公開サイトを開く",
      group: "サイト",
      icon: <ExternalLink size={15} />,
      action: () => window.open("/", "_blank", "noopener"),
    },
  ];

  return (
    <div
      className="admin-atelier h-screen flex select-none overflow-hidden"
      style={adminThemeVars}
    >
      <aside className="admin-sidebar admin-glass hidden lg:flex">
        <div className="admin-sidebar__brand">
          <span className="admin-sidebar__eyebrow">Portfolio Admin</span>
          <span className="admin-sidebar__title">{sidebarSiteName}</span>
        </div>
        <nav className="admin-sidebar__nav" aria-label="管理画面">
          {indicatorTop != null && (
            <div
              aria-hidden="true"
              className="admin-sidebar__indicator"
              style={{ transform: `translateY(${indicatorTop}px)` }}
            />
          )}
          {ADMIN_TAB_GROUPS.map((group) => (
            <section key={group.key} className="admin-sidebar__group">
              <h2 className="admin-sidebar__group-title">{group.label}</h2>
              <div className="admin-sidebar__tabs">
                {group.tabs.map((key) => {
                  const item = ADMIN_TABS[key];
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      ref={(el) => {
                        if (el) tabButtonRefs.current[key] = el;
                      }}
                      type="button"
                      disabled={galleryUploading && key !== "gallery"}
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
        <div className="admin-sidebar__footer">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="admin-sidebar__link"
          >
            <ExternalLink size={13} /> Site
          </a>
          <button onClick={requestLogout} className="admin-sidebar__link">
            <LogOut size={13} /> Logout
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-mobile-nav lg:hidden">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
              {ADMIN_TAB_GROUPS.map((group) => {
                const targetTab = group.tabs[0];
                const active = group.key === activeGroup.key;
                return (
                  <button
                    key={group.key}
                    disabled={galleryUploading && targetTab !== "gallery"}
                    onClick={() => requestTab(targetTab)}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] tracking-wide rounded-sm transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                      active
                        ? "bg-[#3a3a3a] text-[#e0e0e0]"
                        : "text-[#888] hover:text-[#bbb] hover:bg-[#2a2a2a]"
                    }`}
                  >
                    {group.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <a
                href="/"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
              >
                <ExternalLink size={11} />{" "}
                <span className="hidden sm:inline">Site</span>
              </a>
              <button
                onClick={requestLogout}
                className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
              >
                <LogOut size={11} />{" "}
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                disabled={galleryUploading && t.key !== "gallery"}
                onClick={() => requestTab(t.key)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] tracking-wide rounded-sm transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                  tab === t.key
                    ? "bg-[#3a3a3a] text-[#e0e0e0]"
                    : "text-[#888] hover:text-[#bbb] hover:bg-[#2a2a2a]"
                }`}
              >
                {t.icon} <span>{t.label}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <div className="admin-content">
          <div
            className="admin-screen"
            data-phase={screenPhase}
            data-stagger={contentTab === "gallery" ? undefined : "true"}
          >
            {contentTab === "setup" && <SetupTab onOpenTab={requestTab} />}
            {contentTab === "gallery" && (
              <GalleryTab
                onUploadingChange={setGalleryUploading}
                onUnsavedChange={setHasUnsaved}
                openTrashSignal={openTrashRequest}
                onTrashSignalConsumed={() => setOpenTrashRequest(0)}
              />
            )}
            {contentTab !== "setup" && contentTab !== "gallery" && (
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center">
                    <Loader2 size={18} className="animate-spin text-[#555]" />
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
                {contentTab === "service" && (
                  <LazyServiceTab onUnsavedChange={setHasUnsaved} />
                )}
                {contentTab === "settings" && (
                  <LazySettingsTab onUnsavedChange={setHasUnsaved} />
                )}
              </Suspense>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved settings confirmation */}
      {unsavedConfirm && (
        <Modal onClose={() => setUnsavedConfirm(null)} widthClass="w-80">
          <p className="text-[13px] text-[#ddd] mb-1">未保存の変更があります</p>
          <p className="text-[11px] text-[#777] mb-5">
            保存していない内容があります。このまま移動しますか？
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setUnsavedConfirm(null)}
              className="px-4 py-1.5 text-[11px] text-[#888] hover:text-[#ccc] transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={() => {
                setHasUnsaved(false);
                if (unsavedConfirm === "logout") logout.mutate();
                else setTab(unsavedConfirm);
                setUnsavedConfirm(null);
              }}
              className="px-4 py-1.5 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors"
            >
              保存せず移動
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
};

function SetupTab({ onOpenTab }: { onOpenTab: (tab: Tab) => void }) {
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const { data: photosData, isLoading: photosLoading } = useQuery({
    queryKey: ["photos", "all"],
    queryFn: async () =>
      jsonOrThrow(await api.photos.$get({ query: { all: "1" } })),
  });
  const { data: catsData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => jsonOrThrow(await api.categories.$get()),
  });
  const { data: heroData } = useQuery({
    queryKey: ["admin-hero-photos"],
    queryFn: async (): Promise<{ heroPhotos: HeroPhotoRow[] }> =>
      jsonOrThrow(await adminApi["hero-photos"].$get()),
  });

  const settings = (settingsData ?? {}) as Record<string, string>;
  const photos = (photosData?.photos ?? []) as Photo[];
  const activePhotos = photos.filter((p) => !p.deletedAt);
  const publishedPhotos = activePhotos.filter((p) => p.isPublished !== false);
  const categories = catsData?.categories ?? [];
  const heroCount = heroData?.heroPhotos?.length ?? 0;

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

  // Guided path for a brand-new site: name → profile → first photo → hero →
  // confirm it is actually live. 連絡先 and other niceties go to the "できれば
  // 確認" section below, so the main path stays a short 5 steps.
  const checklist: ChecklistItem[] = [
    {
      title: "サイトの名前を入れる",
      body: "表に出る名前と短い説明文。SNSで共有された時にも使われます。",
      done: isFilled(settings.siteName) && isFilled(settings.siteDescription),
      tab: "settings",
    },
    {
      title: "プロフィールを書く",
      body: "名前、自己紹介、プロフィール写真。まずここが入るとサイトらしくなります。",
      done: isFilled(settings.profileName) && isFilled(settings.profileBio),
      tab: "profile",
    },
    {
      title: "写真を1枚あげる",
      body: "最初の写真をアップロードします。写真の保管場所が正しくつながっている確認にもなります。",
      done: activePhotos.length > 0,
      tab: "gallery",
    },
    {
      title: "トップ写真を選ぶ",
      body: "最初に見せたい写真を選びます。サイトの第一印象になります。",
      done: heroCount > 0,
      tab: "hero",
    },
    {
      title: "公開を確認する",
      body: "「開く」で実際のサイトを見て、トップに写真が出ているか確認します。ここまで来れば公開できています。",
      done: publishedPhotos.length > 0 && heroCount > 0,
      href: "/",
    },
  ];

  const recommended: ChecklistItem[] = [
    {
      title: "連絡先",
      body: "メールか問い合わせフォーム。撮影依頼を受けたい場合は入れておきます。",
      done: isFilled(settings.contactEmail) || isFilled(settings.formspreeUrl),
      tab: "settings",
    },
    {
      title: "公開URL",
      body: "独自ドメインを使う時に入れます。検索結果やSNS共有のURLが安定します。",
      done: isFilled(settings.siteUrl),
      tab: "settings",
    },
    {
      title: "写真の分類",
      body: "Gallery の絞り込みに使います。写真が増えてきたら整えると見やすくなります。",
      done: categories.length > 0,
      tab: "categories",
    },
    {
      title: "見え方",
      body: "ギャラリーの並び方、余白、文字の大きさを確認します。最初は写真の順番と S/M/L が一番効きます。",
      done: isFilled(settings.galleryLayout),
      tab: "settings",
    },
  ];

  const doneCount = checklist.filter((item) => item.done).length;
  const requiredDone = doneCount === checklist.length;
  const loading = settingsLoading || photosLoading;
  // Once everything is done (or the owner pressed 閉じる), shrink to a one-line bar
  // so a finished site's admin stays uncluttered. "もう一度見る" re-expands it.
  const collapsed = !loading && (requiredDone || dismissed) && !forceOpen;

  // 読込中は「未完了」マークだらけのチェックリストを一瞬見せない
  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-8">
          <p className="text-[12px] text-[color:var(--admin-muted)]">…</p>
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-8">
          <div className="flex items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 rounded-sm px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                <Check size={13} />
              </div>
              <p className="text-[12px] text-emerald-800 truncate">
                {requiredDone
                  ? "公開に必要な項目はそろっています。"
                  : "「はじめに」を閉じています。"}
              </p>
            </div>
            <button
              onClick={() => {
                setForceOpen(true);
                setDismissed(false);
              }}
              className="text-[11px] text-emerald-700 hover:text-emerald-900 transition-colors flex-shrink-0"
            >
              もう一度見る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-8">
        <PageHeader
          title="公開までにやること"
          description="むずかしい設定は最初だけです。見る人に公開する前に、上から順に5つを確認します。写真家本人は、基本的にこの管理画面を埋めれば大丈夫です。"
          actions={
            <>
              <div
                className={`w-fit rounded-sm border px-3 py-2 text-[12px] ${requiredDone ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] text-[color:var(--admin-muted)]"}`}
              >
                {loading
                  ? "確認中..."
                  : `${doneCount} / ${checklist.length} 完了`}
              </div>
              <button
                onClick={() => {
                  setDismissed(true);
                  setForceOpen(false);
                }}
                className="text-[11px] text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] transition-colors flex-shrink-0"
              >
                閉じる
              </button>
            </>
          }
        />

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
          <h2 className="text-[13px] uppercase tracking-[0.14em] text-[#888]">
            公開前にできれば確認
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

        <section className="grid gap-3 md:grid-cols-2">
          <div className="border border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] rounded-sm p-5">
            <h2 className="text-[14px] mb-3">公開の裏側にあるもの</h2>
            <div className="space-y-3 text-[12px] leading-6 text-[color:var(--admin-muted)]">
              <p>
                <span className="text-[color:var(--admin-ink)]">
                  サイトのファイル一式
                </span>
                : 見た目や管理画面のもとになるもの。
              </p>
              <p>
                <span className="text-[color:var(--admin-ink)]">公開場所</span>:
                サイトをインターネットで動かす場所。
              </p>
              <p>
                <span className="text-[color:var(--admin-ink)]">
                  データの保存場所
                </span>
                : 名前、説明文、写真一覧などを保存する場所。
              </p>
              <p>
                <span className="text-[color:var(--admin-ink)]">
                  写真の保存場所
                </span>
                : アップロードした写真ファイルそのものを置く場所。
              </p>
            </div>
          </div>
          <div className="border border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] rounded-sm p-5">
            <h2 className="text-[14px] mb-3">言葉の置き換え</h2>
            <div className="space-y-3 text-[12px] leading-6 text-[color:var(--admin-muted)]">
              <p>
                <span className="text-[color:var(--admin-ink)]">repo</span>:
                サイトのファイル一式が入った箱。
              </p>
              <p>
                <span className="text-[color:var(--admin-ink)]">環境変数</span>:
                パスワードや接続先を書く、公開しない設定メモ。
              </p>
              <p>
                <span className="text-[color:var(--admin-ink)]">deploy</span>:
                変更したサイトをネット上に反映すること。
              </p>
              <p>
                <span className="text-[color:var(--admin-ink)]">OGP</span>:
                SNSでURLを貼った時に出るタイトル・説明・画像。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
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
  return (
    <div className="border border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] rounded-sm p-4 flex gap-3">
      <div
        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? "bg-emerald-600 text-white" : "bg-[color:var(--admin-paper-deep)] text-[color:var(--admin-muted)]"}`}
      >
        {item.done ? <Check size={13} /> : <AlertTriangle size={12} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[13px] text-[color:var(--admin-ink)]">
            {item.title}
          </h3>
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener"
              className="text-[11px] text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] transition-colors flex-shrink-0"
            >
              開く
            </a>
          ) : (
            <button
              onClick={() => item.tab && onOpenTab(item.tab)}
              className="text-[11px] text-[color:var(--admin-muted)] hover:text-[color:var(--admin-ink)] transition-colors flex-shrink-0"
            >
              開く
            </button>
          )}
        </div>
        <p
          className={`${compact ? "text-[11px] leading-5" : "text-[12px] leading-6"} text-[color:var(--admin-muted)] mt-1`}
        >
          {item.body}
        </p>
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

const captureStatusText: Record<
  Exclude<CaptureClipboardStatus, "idle">,
  string
> = {
  copied: "Copied",
  pasted: "Pasted",
  error: "失敗",
};

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
  { x: 0, y: 0, label: "左上" },
  { x: 50, y: 0, label: "上" },
  { x: 100, y: 0, label: "右上" },
  { x: 0, y: 50, label: "左" },
  { x: 50, y: 50, label: "中央" },
  { x: 100, y: 50, label: "右" },
  { x: 0, y: 100, label: "左下" },
  { x: 50, y: 100, label: "下" },
  { x: 100, y: 100, label: "右下" },
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
const LIBRARY_SORT_LABELS: Record<string, string> = {
  manual: "手動",
  "createdAt-desc": "アップロード日 新しい順",
  "createdAt-asc": "アップロード日 古い順",
  "shotAt-desc": "撮影日 新しい順",
  "shotAt-asc": "撮影日 古い順",
  series: "シリーズ",
  size: "表示サイズ",
  filmType: "媒体/フィルム",
  camera: "カメラ",
  category: "カテゴリ",
  title: "タイトル",
  published: "公開状態",
};
const MEDIUM_FILTER_LABELS: Record<string, string> = {
  digital: "Digital",
  film: "Film",
  missing: "媒体なし",
};
const ORIENTATION_FILTER_LABELS: Record<string, string> = {
  portrait: "縦写真",
  landscape: "横写真",
  square: "正方形",
};
const LIBRARY_GRID_GAP = 8;
// Keep more than one extra screen of rows mounted so fast trackpad scrolling
// does not repeatedly tear down the next thumbnail rows at the viewport edge.
const LIBRARY_GRID_OVERSCAN_ROWS = 8;

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

function measuredContentWidth(el: HTMLElement | null): number {
  if (!el) return 0;
  const width = el.clientWidth;
  if (typeof window === "undefined") return width;
  const style = window.getComputedStyle(el);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  return Math.max(0, width - paddingLeft - paddingRight);
}

function GalleryTab({
  onUploadingChange,
  onUnsavedChange,
  openTrashSignal,
  onTrashSignalConsumed,
}: {
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
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const setUploadingAndNotify = (v: boolean) => {
    setUploading(v);
    onUploadingChange?.(v);
  };
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastClicked, setLastClicked] = useState<number | null>(null);
  const [thumbSize, setThumbSize] = usePersistentState("admin:thumbSize", 180); // px
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
  const [dragSrcId, setDragSrcId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
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
  const [deleteConfirm, setDeleteConfirm] = useState<{
    ids: number[];
    label: string;
  } | null>(null);
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
      onTrashSignalConsumedRef.current?.();
    }
  }, [openTrashSignal]);
  const [undoToast, setUndoToast] = useState<{
    ids: number[];
    count: number;
  } | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  const [showLibraryFilters, setShowLibraryFilters] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);
  const [metaError, setMetaError] = useState(false);
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
  const [libraryGridMetrics, setLibraryGridMetrics] = useState({
    scrollTop: 0,
    viewportHeight: 0,
    gridWidth: 0,
  });
  const libraryScrollRestoredRef = useRef(false);
  const libraryScrollSaveRafRef = useRef<number | null>(null);
  const libraryGridMeasureRafRef = useRef<number | null>(null);
  const libraryScrollPendingTopRef = useRef(0);
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
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
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

  const { data: trashData } = useQuery({
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
  const allPhotos = useMemo(
    () => (photosData?.photos ?? []) as Photo[],
    [photosData],
  );
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
      if (cond.filmType) labels.push(cond.filmType);
      if (cond.medium) {
        labels.push(
          cond.medium === "digital"
            ? "Digital"
            : cond.medium === "film"
              ? "Film"
              : "媒体なし",
        );
      }
      if (cond.missingShotAt) labels.push("撮影日なし");
      if (cond.missingCapture) labels.push("機材なし");
      if (cond.category) {
        labels.push(
          cond.category === "__uncat__"
            ? "カテゴリなし"
            : categoryLabelFor(cond.category),
        );
      }
      if (cond.series) {
        labels.push(
          cond.series === "__none__"
            ? "シリーズなし"
            : seriesTitleFor(cond.series),
        );
      }
      if (cond.size) labels.push(`Size ${cond.size}`);
      if (cond.featured) labels.push("Hero設定中");
      if (cond.published === "published") labels.push("公開");
      if (cond.published === "unpublished") labels.push("非公開");
      if (cond.recent) labels.push(`直近${cond.recent}日`);
      return labels;
    },
    [categoryLabelFor, seriesTitleFor],
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
    if (query) labels.push({ key: "search", text: `検索: ${query}` });
    if (activeAlbum)
      labels.push({ key: "album", text: `Album: ${activeAlbum.name}` });
    if (filterCat !== "all")
      labels.push({
        key: "category",
        text:
          filterCat === "__uncat__"
            ? "カテゴリ: 未分類"
            : `カテゴリ: ${categoryLabelFor(filterCat)}`,
      });
    if (filterSeries !== "all")
      labels.push({
        key: "series",
        text:
          filterSeries === "__none__"
            ? "Series: 未割り当て"
            : `Series: ${seriesTitleFor(filterSeries)}`,
      });
    if (filterSize !== "all")
      labels.push({ key: "size", text: `Size: ${filterSize}` });
    if (filterMedium !== "all")
      labels.push({
        key: "medium",
        text: `媒体: ${MEDIUM_FILTER_LABELS[filterMedium] ?? filterMedium}`,
      });
    if (filterOrientation !== "all")
      labels.push({
        key: "orientation",
        text: ORIENTATION_FILTER_LABELS[filterOrientation] ?? filterOrientation,
      });
    if (filterFeatured) labels.push({ key: "featured", text: "Hero設定中" });
    if (filterPublished !== "all")
      labels.push({
        key: "published",
        text:
          filterPublished === "published"
            ? "公開のみ"
            : filterPublished === "unpublished"
              ? "非公開のみ"
              : filterPublished,
      });
    if (filterMissingShotAt)
      labels.push({ key: "missingShotAt", text: "撮影日なし" });
    if (filterMissingCapture)
      labels.push({ key: "missingCapture", text: "機材なし" });
    if (filterRecent !== "all")
      labels.push({ key: "recent", text: `直近${filterRecent}日` });
    return labels;
  }, [
    activeAlbum,
    categoryLabelFor,
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

  // U1: display sort. Array.sort is stable, so ties keep the manual order.
  // shotAt-less photos always sink to the end regardless of direction.
  const sortPhotosForView = useCallback(
    (list: Photo[]): Photo[] => {
      if (librarySort === "manual") return list;
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
  const displayed = useMemo(
    () => sortPhotosForView(filtered),
    [filtered, sortPhotosForView],
  );
  const measureLibraryGrid = useCallback(() => {
    const scrollEl = scrollRef.current;
    const gridEl = gridRef.current;
    const next = {
      scrollTop: scrollEl?.scrollTop ?? 0,
      viewportHeight: scrollEl?.clientHeight ?? 0,
      gridWidth: measuredContentWidth(gridEl),
    };
    setLibraryGridMetrics((prev) =>
      prev.scrollTop === next.scrollTop &&
      prev.viewportHeight === next.viewportHeight &&
      prev.gridWidth === next.gridWidth
        ? prev
        : next,
    );
  }, []);
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
    bulkEditMode,
    displayed.length,
    measureLibraryGrid,
    showTrash,
    thumbSize,
  ]);
  const virtualGrid = useMemo(
    () =>
      computeVirtualGridWindow({
        itemCount: displayed.length,
        scrollTop: libraryGridMetrics.scrollTop,
        viewportHeight: libraryGridMetrics.viewportHeight,
        gridWidth: libraryGridMetrics.gridWidth,
        minItemSize: thumbSize,
      }),
    [
      displayed.length,
      libraryGridMetrics.gridWidth,
      libraryGridMetrics.scrollTop,
      libraryGridMetrics.viewportHeight,
      thumbSize,
    ],
  );
  const virtualGridRef = useRef(virtualGrid);
  useLayoutEffect(() => {
    virtualGridRef.current = virtualGrid;
  }, [virtualGrid]);
  const visibleDisplayed = useMemo(
    () => displayed.slice(virtualGrid.startIndex, virtualGrid.endIndex),
    [displayed, virtualGrid.endIndex, virtualGrid.startIndex],
  );
  const scrollLibraryIndexIntoView = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      const latestVirtualGrid = virtualGridRef.current;
      if (!el || index < 0 || latestVirtualGrid.rowHeight <= 0) return;
      const row = Math.floor(index / Math.max(1, latestVirtualGrid.columns));
      const rowTop = row * latestVirtualGrid.rowHeight;
      const rowBottom = rowTop + latestVirtualGrid.rowHeight;
      if (rowTop < el.scrollTop) {
        el.scrollTop = rowTop;
      } else if (rowBottom > el.scrollTop + el.clientHeight) {
        el.scrollTop = Math.max(0, rowBottom - el.clientHeight);
      }
      measureLibraryGrid();
    },
    [measureLibraryGrid],
  );
  const missingShotAtCount = useMemo(
    () => allPhotos.filter((p) => !p.shotAt).length,
    [allPhotos],
  );
  const selectedMissingShotAtCount = useMemo(
    () => allPhotos.filter((p) => selected.has(p.id) && !p.shotAt).length,
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
  const reorderLocked =
    librarySort !== "manual" || (anyFilterActive && !onlySeriesFilter);

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

  // Soft-delete (to trash)
  const deletePhotos = useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) {
        const res = await adminApi.photos[":id"].$delete({
          param: { id: String(id) },
        });
        assertOk(res);
      }
      return ids;
    },
    onSuccess: (ids) => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      qc.invalidateQueries({ queryKey: ["photos-trash"] });
      qc.invalidateQueries({ queryKey: ["hero-photos"] });
      qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      setSelected(new Set());
      setInspectPhoto(null);
      setUndoToast({ ids, count: ids.length });
    },
    onError: onActionError(
      "削除に失敗しました。再ログインが必要かもしれません。",
    ),
  });

  // Restore from trash
  const restorePhotos = useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) {
        const res = await adminApi.photos[":id"].restore.$post({
          param: { id: String(id) },
        });
        assertOk(res);
      }
    },
    onSuccess: () => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      qc.invalidateQueries({ queryKey: ["photos-trash"] });
      qc.invalidateQueries({ queryKey: ["hero-photos"] });
      qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      setUndoToast(null);
    },
    onError: onActionError(
      "復元に失敗しました。再ログインが必要かもしれません。",
    ),
  });

  // Permanently purge from trash
  const purgePhotos = useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) {
        const res = await adminApi.photos[":id"].purge.$delete({
          param: { id: String(id) },
        });
        assertOk(res);
      }
    },
    onSuccess: () => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      qc.invalidateQueries({ queryKey: ["photos-trash"] });
      qc.invalidateQueries({ queryKey: ["hero-photos"] });
      qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
      qc.invalidateQueries({ queryKey: ["series"] });
    },
    onError: onActionError("完全削除に失敗しました。"),
  });

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
    }: {
      id: number;
      rotationDeg: number;
    }) => {
      const res = await adminApi.photos[":id"].$patch({
        param: { id: String(id) },
        json: { rotationDeg },
      });
      assertOk(res);
      return { id, rotationDeg };
    },
    onSuccess: ({ id, rotationDeg }) => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      qc.invalidateQueries({ queryKey: ["hero-photos"] });
      qc.invalidateQueries({ queryKey: ["admin-hero-photos"] });
      setInspectPhoto((p) => (p?.id === id ? { ...p, rotationDeg } : p));
      setEditForm((f) => (inspectPhoto?.id === id ? { ...f, rotationDeg } : f));
      setBatchToast(`向きを ${rotationDeg}° にしました`);
      setTimeout(() => setBatchToast(null), 1500);
    },
    onError: onActionError("向きの変更に失敗しました。"),
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
      if (dup) openInspector(dup);
      setBatchToast("複製しました");
      setTimeout(() => setBatchToast(null), 2000);
    },
    onError: onActionError("複製に失敗しました。"),
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
      const res = await adminApi.settings.$post({ json: updates });
      assertOk(res);
      qc.invalidateQueries({ queryKey: ["settings"] });
    } catch (e) {
      console.error("rememberPresets failed:", e);
    }
  };

  // Batch category — limited concurrency rather than serial
  const batchCategory = useMutation({
    mutationFn: async ({
      ids,
      category,
    }: {
      ids: number[];
      category: string;
    }) => {
      const queue = [...ids];
      const CONCURRENCY = Math.min(4, queue.length);
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          let id: number | undefined;
          while ((id = queue.shift()) !== undefined) {
            const res = await adminApi.photos[":id"].$patch({
              param: { id: String(id) },
              json: { category },
            });
            assertOk(res);
          }
        }),
      );
    },
    onSuccess: () => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      setSelected(new Set());
    },
    onError: onActionError("カテゴリの一括変更に失敗しました。"),
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
          const rotationDeg = rotatedBy(
            inspectPhoto.rotationDeg,
            vars.operation === "rotate_left" ? -90 : 90,
          );
          setInspectPhoto((p) => (p ? { ...p, rotationDeg } : p));
          setEditForm((f) => ({ ...f, rotationDeg }));
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
      setBatchToast(`${count}枚を更新しました`);
      setTimeout(() => setBatchToast(null), 2000);
      if (vars.operation === "shotAt_missing_only") setBatchShotAtDate("");
    },
    onError: onActionError("一括操作に失敗しました。"),
  });

  // O2: bulk metadata edit. Only fields the user filled are sent (empty = leave as-is).
  const batchMetaEdit = useMutation({
    mutationFn: async (
      fields: Record<"camera" | "lens" | "filmType", string>,
    ) => {
      const ids = Array.from(selected);
      const entries = (Object.entries(fields) as [string, string][]).filter(
        ([, v]) => v !== "",
      );
      for (const [operation, value] of entries) {
        const res = await adminApi.photos.batch.$post({
          json: { ids, operation, value },
        });
        assertOk(res);
      }
      return entries.length;
    },
    onSuccess: (changed) => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      setBatchEditOpen(false);
      setBatchEdit({ camera: "", lens: "", filmType: "" });
      if (changed > 0) {
        setBatchToast(`${selected.size}枚を更新しました`);
        setTimeout(() => setBatchToast(null), 2000);
      }
    },
    onError: onActionError("一括メタ編集に失敗しました。"),
  });

  // O6: persist the smart-album list (stored as a JSON string in site_settings).
  const saveAlbums = useMutation({
    mutationFn: async (next: SmartAlbum[]) => {
      const res = await adminApi.settings.$post({
        json: { smartAlbums: JSON.stringify(next) },
      });
      assertOk(res);
    },
    onSuccess: () => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: onActionError("スマートアルバムの保存に失敗しました。"),
  });

  // Reorder
  const reorder = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await adminApi.photos.reorder.$post({ json: { ids } });
      assertOk(res);
    },
    onSuccess: () => {
      setActionError("");
      qc.invalidateQueries({ queryKey: ["photos"] });
      setBatchToast("並び順を保存しました");
      setTimeout(() => setBatchToast(null), 1500);
    },
    onError: onActionError("並び替えの保存に失敗しました。"),
  });

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

  // Upload — server-side resize (no more presigned URLs)
  const handleFiles = async (files: File[]) => {
    const imageFiles = files.filter(isUploadableImageFile);
    const skipped = files.length - imageFiles.length;
    const tooLargeNotice = uploadTooLargeNotice(imageFiles);
    const uploadableFiles = imageFiles.filter(
      (file) => !imageFileTooLarge(file),
    );
    if (!uploadableFiles.length) {
      const parts: string[] = [];
      if (tooLargeNotice) parts.push(tooLargeNotice);
      if (skipped > 0) parts.push(`${skipped} 件は画像でないためスキップ`);
      setUploadNotice(
        parts.length
          ? parts.join(" / ")
          : skipped > 0
            ? `画像ファイルではないため ${skipped} 件をスキップしました`
            : null,
      );
      return;
    }
    setUploadNotice(null);
    setRetryFiles([]);
    setUploadingAndNotify(true);
    setUploadProgress({ done: 0, total: uploadableFiles.length });
    const failed: { file: File; reason?: string }[] = [];
    const duplicates: string[] = [];
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
          const message = await responseErrorMessage(res);
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
          exifCamera,
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
        const shotAtVal = shotAtForUploadedPhoto(shotAt, file, uploadMedium);
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
            title: "",
            meta: "",
            category: "",
            filmType: filmTypeVal,
            camera: cameraVal,
            lens: lensVal,
            focalLength: isDigital ? ((exifFocalLength as string) ?? "") : "",
            fNumber: isDigital ? ((exifFNumber as string) ?? "") : "",
            exposureTime: isDigital ? ((exifExposureTime as string) ?? "") : "",
            iso: isDigital ? ((exifIso as string) ?? "") : "",
          },
        });
        assertOk(created);
      } catch (err) {
        failed.push({
          file,
          reason: err instanceof Error ? err.message : undefined,
        });
      } finally {
        done += 1;
        setUploadProgress({ done, total: uploadableFiles.length });
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
      qc.invalidateQueries({ queryKey: ["photos"] });
    } finally {
      setUploadingAndNotify(false);
      setUploadProgress(null);
      setRetryFiles(failed.map(({ file }) => file));
      const parts: string[] = [];
      const failedNotice = uploadFailureNotice(failed);
      if (failedNotice) parts.push(failedNotice);
      if (tooLargeNotice) parts.push(tooLargeNotice);
      if (duplicates.length)
        parts.push(
          `重複スキップ: ${duplicates.length}枚 (${duplicates.slice(0, 3).join(", ")}${duplicates.length > 3 ? " ほか" : ""})`,
        );
      if (skipped > 0) parts.push(`${skipped} 件は画像でないためスキップ`);
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
  }, [inspectPhoto?.id]);

  // Click handler with multi-select
  const handlePhotoClick = (photo: Photo, idx: number, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Toggle selection
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(photo.id)) next.delete(photo.id);
        else next.add(photo.id);
        return next;
      });
    } else if (e.shiftKey && lastClicked !== null) {
      // Range select
      const lastIdx = displayed.findIndex((p) => p.id === lastClicked);
      if (lastIdx >= 0) {
        const start = Math.min(lastIdx, idx);
        const end = Math.max(lastIdx, idx);
        const range = displayed.slice(start, end + 1).map((p) => p.id);
        setSelected((prev) => {
          const next = new Set(prev);
          range.forEach((id) => next.add(id));
          return next;
        });
      }
    } else {
      setSelected(new Set([photo.id]));
      openInspector(photo);
    }
    setLastClicked(photo.id);
  };

  // Move a photo by ±1 / to the start/end of the VISIBLE list (series scope
  // aware — see lib/reorder.ts for the subset-vs-global splice semantics).
  const movePhoto = (id: number, delta: number) => {
    if (reorderLocked) return;
    const ids = moveRelativeToViewNeighbor(
      allPhotos.map((p) => p.id),
      displayed.map((p) => p.id),
      id,
      delta,
    );
    if (ids) reorder.mutate(ids);
  };

  const movePhotoTo = (id: number, pos: "start" | "end") => {
    if (reorderLocked) return;
    const ids = moveToViewEdge(
      allPhotos.map((p) => p.id),
      displayed.map((p) => p.id),
      id,
      pos,
    );
    if (ids) reorder.mutate(ids);
  };

  const rotateLibraryPhoto = (photo: Photo, delta: -90 | 90) => {
    quickRotatePhoto.mutate({
      id: photo.id,
      rotationDeg: rotatedBy(photo.rotationDeg, delta),
    });
  };

  const rotateActivePhotos = (
    operation: Extract<BatchPhotoOperation, "rotate_left" | "rotate_right">,
  ) => {
    if (batchOp.isPending || quickRotatePhoto.isPending) return;
    if (selected.size > 0) {
      batchOp.mutate({ operation });
      return;
    }
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
    if (!reorderLocked) setDragSrcId(id);
  };
  const handleDragOver = (e: React.DragEvent, id: number) => {
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
    if (reorderLocked) {
      setDragSrcId(null);
      setDragOverId(null);
      return;
    }
    const ids = allPhotos.map((p) => p.id);
    const fromIdx = ids.indexOf(dragSrcId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragSrcId);
    reorder.mutate(ids);
    setDragSrcId(null);
    setDragOverId(null);
  };

  // Open the inspector for a photo (shared by click + Enter)
  const openInspector = (photo: Photo) => {
    setInspectPhoto(photo);
    setEditForm(photoToEditForm(photo));
  };

  // C3: move the keyboard cursor (lastClicked) by an offset within `displayed`.
  // Arrow nav collapses to a single selection (Bridge/Finder behaviour).
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
    setSelected(new Set([photo.id]));
    setLastClicked(photo.id);
    setPreviewPhoto((prev) => (prev ? photo : prev)); // keep quick-preview in sync if open
    if (inspectPhoto) openInspector(photo); // keep inspector panel in sync if open
    scrollLibraryIndexIntoView(nextIdx);
    requestAnimationFrame(() =>
      document
        .getElementById(`admin-photo-${photo.id}`)
        ?.scrollIntoView?.({ block: "nearest" }),
    );
  };

  // Number of grid columns, derived from the rendered grid width / thumb size.
  const gridCols = () => {
    const w = gridRef.current?.clientWidth ?? 0;
    return Math.max(1, Math.floor(w / (thumbSize + 3))); // +3 ≈ grid gap
  };

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;
      if (typing) return;

      // ? — shortcuts help (Shift+/ on most layouts)
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      // Escape closes overlays in priority order, else clears selection
      if (e.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (previewPhoto) {
          setPreviewPhoto(null);
          return;
        }
        setSelected(new Set());
        setInspectPhoto(null);
        return;
      }

      if (showTrash) return; // grid nav only applies to the library view

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected.size > 0) {
          e.preventDefault();
          setDeleteConfirm({
            ids: Array.from(selected),
            label: `${selected.size}枚の写真をゴミ箱に移動しますか？`,
          });
        }
        return;
      }
      if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSelected(new Set(displayed.map((p) => p.id)));
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
      // O3: Ctrl/Cmd + ↑↓ moves the cursor photo one position (same as the ↑↓
      // buttons). Only in the unfiltered view, where reorder is meaningful.
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        if (lastClicked !== null && !reorderLocked) {
          e.preventDefault();
          movePhoto(lastClicked, e.key === "ArrowUp" ? -1 : 1);
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
      if (e.key === "Enter" && lastClicked !== null) {
        const photo = displayed.find((p) => p.id === lastClicked);
        if (photo) {
          e.preventDefault();
          openInspector(photo);
        }
        return;
      }
      // Space — quick preview (toggle) for the cursor photo
      if (e.key === " " && lastClicked !== null) {
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
    thumbSize,
    inspectPhoto,
  ]);

  // Undo toast auto-dismiss after 5s
  useEffect(() => {
    if (!undoToast) return;
    const t = setTimeout(() => setUndoToast(null), 5000);
    return () => clearTimeout(t);
  }, [undoToast]);

  // Color label per category
  const catColors: Record<string, string> = {};
  const palette = [
    "#4a90d9",
    "#d9534f",
    "#5cb85c",
    "#f0ad4e",
    "#9b59b6",
    "#e67e22",
    "#1abc9c",
    "#e74c3c",
  ];
  categories.forEach((c, i) => {
    catColors[c.slug] = palette[i % palette.length];
  });

  return (
    <div className="flex h-full">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-2 sm:px-4 pt-4 flex-shrink-0">
          <PageHeader
            title="Library"
            description={
              // 読込中に "0 / 0 photos" と断定表示しない — 写真家には消失に見える
              isLoading ? (
                <span aria-label="読み込み中">… photos</span>
              ) : (
                <>
                  <CountSwap value={displayed.length} /> /{" "}
                  <CountSwap value={allPhotos.length} /> photos
                  {selected.size > 0 && (
                    <>
                      {" "}
                      ・ <CountSwap value={selected.size} /> selected
                    </>
                  )}
                </>
              )
            }
            actions={
              <PageHeaderButton
                active={showSitePreview}
                onClick={() => setShowSitePreview(!showSitePreview)}
                ariaLabel={
                  showSitePreview ? "サイトで確認を閉じる" : "サイトで確認"
                }
              >
                {showSitePreview ? <EyeOff size={13} /> : <Eye size={13} />}
                サイトで確認
              </PageHeaderButton>
            }
          />
        </div>
        {/* Toolbar — quiet Library controls */}
        <div className="bg-[#2a2a2a] border-b border-[#333] px-2 sm:px-4 py-2 flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* U1: view sort — display-only until explicitly written to sortOrder */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#777] uppercase tracking-wider">
                Sort
              </span>
              <select
                value={librarySort}
                onChange={(e) => setLibrarySort(e.target.value)}
                aria-label="表示の並び替え"
                className="bg-[#333] text-[#ccc] text-[11px] px-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888]"
              >
                <option value="manual">手動（保存されている順）</option>
                <option value="createdAt-desc">
                  アップロード日（新しい順）
                </option>
                <option value="createdAt-asc">アップロード日（古い順）</option>
                <option value="shotAt-desc">撮影日（新しい順）</option>
                <option value="shotAt-asc">撮影日（古い順）</option>
                <option value="series">シリーズ</option>
                <option value="size">表示サイズ（S→L）</option>
                <option value="filmType">媒体/フィルム</option>
                <option value="camera">カメラ</option>
                <option value="category">カテゴリ</option>
                <option value="title">タイトル</option>
                <option value="published">公開状態</option>
              </select>
              {librarySort !== "manual" && (
                <button
                  disabled={anyFilterActive || reorder.isPending}
                  title={
                    anyFilterActive
                      ? "フィルターを解除してから保存できます"
                      : "現在の表示順を公開サイトの並び（sortOrder）に書き込みます"
                  }
                  onClick={() => {
                    if (
                      !confirm(
                        "現在の表示順を公開サイトの並び順として保存します。よろしいですか？",
                      )
                    )
                      return;
                    reorder.mutate(
                      sortPhotosForView(allPhotos).map((p) => p.id),
                      {
                        onSuccess: () => setLibrarySort("manual"),
                      },
                    );
                  }}
                  className="text-[10px] px-2 py-1 rounded-sm bg-[#555] text-[#1e1e1e] hover:bg-[#666] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  この並びを保存
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowLibraryFilters((v) => !v)}
              aria-expanded={showLibraryFilters}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm border transition-colors ${
                showLibraryFilters || anyFilterActive
                  ? "bg-[color:var(--admin-ink)] text-[color:var(--admin-paper)] border-[color:var(--admin-ink)]"
                  : "text-[color:var(--admin-muted)] border-[#444] hover:bg-[#333] hover:text-[color:var(--admin-ink)]"
              }`}
            >
              <Search size={11} /> 絞り込み
              {activeFilterLabels.length > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-sm bg-[#777] text-[#1e1e1e] text-[10px] leading-4 text-center">
                  {activeFilterLabels.length}
                </span>
              )}
            </button>

            <div className="hidden md:flex items-center gap-2">
              <Grid size={12} className="text-[#666]" />
              <input
                aria-label="サムネイルサイズ"
                type="range"
                min={80}
                max={300}
                value={thumbSize}
                onChange={(e) => setThumbSize(Number(e.target.value))}
                className="w-24 accent-[#888] h-1"
              />
              <Columns size={12} className="text-[#666]" />
            </div>

            <button
              onClick={() => {
                setBulkEditMode((v) => !v);
                setInspectPhoto(null);
                setSelected(new Set());
              }}
              aria-pressed={bulkEditMode}
              title="表形式の一括編集モード"
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border transition-colors ${
                bulkEditMode
                  ? "bg-[#4a4a4a] text-[#eee] border-[#666]"
                  : "text-[#666] border-[#444] hover:bg-[#333] hover:text-[#aaa]"
              }`}
            >
              <LayoutList size={11} /> Table
            </button>

            <button
              onClick={() => {
                setShowTrash((v) => !v);
                setSelected(new Set());
                setInspectPhoto(null);
              }}
              className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-sm transition-colors ${
                showTrash
                  ? "bg-amber-900/40 text-amber-400"
                  : "text-[#666] hover:text-[#aaa] hover:bg-[#2a2a2a]"
              }`}
            >
              <Trash2 size={11} />
              Trash
              {(trashData?.photos?.length ?? 0) > 0 &&
                ` (${trashData!.photos.length})`}
            </button>

            <button
              onClick={() => setShowShortcuts(true)}
              title="キーボードショートカット (?)"
              aria-label="キーボードショートカット"
              className="flex items-center justify-center w-6 h-6 text-[11px] text-[#666] hover:text-[#aaa] hover:bg-[#2a2a2a] rounded-sm transition-colors"
            >
              ?
            </button>

            {/* Importの設定であって絞り込みではない — 明札を付けてフィルタとの誤読を防ぐ */}
            <fieldset
              aria-label="取り込み媒体"
              title="Importする写真に付く媒体ラベルです（絞り込みではありません）"
              className="flex items-center gap-1 m-0 p-0 border-0 min-w-0"
            >
              <span className="text-[10px] text-[#666] uppercase tracking-wider whitespace-nowrap mr-0.5">
                取り込み
              </span>
              {[
                ["digital", "デジタル"] as const,
                ["film", "フィルム"] as const,
              ].map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setUploadMedium(val)}
                  aria-pressed={uploadMedium === val}
                  className={`text-[10px] px-2 py-1 rounded-sm border transition-colors ${
                    uploadMedium === val
                      ? "bg-[#555] text-[#eee] border-[#666]"
                      : "text-[#666] border-[#444] hover:bg-[#333] hover:text-[#aaa]"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </fieldset>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-[11px] text-[#1e1e1e] bg-[#888] px-3 py-1 rounded-sm hover:bg-[#999] transition-colors disabled:opacity-50"
            >
              <Upload size={11} /> Import
            </button>
            <input
              aria-label="画像ファイルを選択"
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_IMAGE_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
            />
          </div>

          {!showTrash && activeFilterLabels.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#aaa] min-w-0">
              <span className="text-[10px] text-[#777] uppercase tracking-wider">
                絞り込み中
              </span>
              <span className="truncate">
                {activeFilterLabels.map((item) => item.text).join(" / ")}
              </span>
              <button
                type="button"
                onClick={clearLibraryFilters}
                className="text-[11px] px-2 py-0.5 rounded-sm border border-[#444] text-[#999] bg-[#333] hover:bg-[#3a3a3a] hover:text-[#ddd] transition-colors flex-shrink-0"
              >
                解除
              </button>
            </div>
          )}

          {!showTrash && showLibraryFilters && (
            <div className="border-t border-[#333] pt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* B2: free-text search */}
                <div className="relative">
                  <Search
                    size={11}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="検索（タイトル・分類・機材・ファイル名）"
                    aria-label="写真を検索"
                    className="bg-[#333] text-[#ccc] text-[11px] pl-6 pr-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888] transition-colors w-52 placeholder:text-[#555]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      aria-label="検索をクリア"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#777] hover:text-[#ccc] transition-colors"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                  className="bg-[#333] text-[#ccc] text-[11px] px-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888]"
                >
                  <option value="all">All ({allPhotos.length})</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label} (
                      {allPhotos.filter((p) => p.category === c.slug).length})
                    </option>
                  ))}
                  {allPhotos.some(isUncategorized) && (
                    <option value="__uncat__">
                      未分類 ({allPhotos.filter(isUncategorized).length})
                    </option>
                  )}
                </select>

                <select
                  value={filterSeries}
                  onChange={(e) => setFilterSeries(e.target.value)}
                  aria-label="シリーズで絞り込み"
                  className="bg-[#333] text-[#ccc] text-[11px] px-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888]"
                >
                  <option value="all">All series</option>
                  {seriesList.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.title} (
                      {allPhotos.filter((p) => p.seriesId === s.id).length})
                    </option>
                  ))}
                  <option value="__none__">
                    未割り当て (
                    {allPhotos.filter((p) => p.seriesId == null).length})
                  </option>
                </select>

                <select
                  value={filterSize}
                  onChange={(e) => setFilterSize(e.target.value)}
                  aria-label="表示サイズで絞り込み"
                  className="bg-[#333] text-[#ccc] text-[11px] px-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888]"
                >
                  <option value="all">All sizes</option>
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
                  aria-label="媒体で絞り込み"
                  className="bg-[#333] text-[#ccc] text-[11px] px-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888]"
                >
                  <option value="all">媒体: All</option>
                  <option value="digital">
                    Digital ({mediumCounts.digital})
                  </option>
                  <option value="film">Film ({mediumCounts.film})</option>
                  <option value="missing">
                    媒体なし ({mediumCounts.missing})
                  </option>
                </select>

                <select
                  value={filterOrientation}
                  onChange={(e) => setFilterOrientation(e.target.value)}
                  aria-label="写真の向きで絞り込み"
                  className="bg-[#333] text-[#ccc] text-[11px] px-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888]"
                >
                  <option value="all">All orientations</option>
                  <option value="portrait">
                    縦写真 ({orientationCounts.portrait})
                  </option>
                  <option value="landscape">
                    横写真 ({orientationCounts.landscape})
                  </option>
                  <option value="square">
                    正方形 ({orientationCounts.square})
                  </option>
                </select>

                <button
                  onClick={() => setFilterFeatured((v) => !v)}
                  aria-pressed={filterFeatured}
                  className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border transition-colors ${
                    filterFeatured
                      ? "bg-amber-900/40 text-amber-300 border-amber-700/50"
                      : "bg-[#333] text-[#999] border-[#444] hover:bg-[#3a3a3a]"
                  }`}
                >
                  <Star size={11} /> Hero設定中 ({featuredIds.size})
                </button>

                <select
                  value={filterPublished}
                  onChange={(e) => setFilterPublished(e.target.value)}
                  aria-label="公開状態で絞り込み"
                  className="bg-[#333] text-[#ccc] text-[11px] px-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888]"
                >
                  <option value="all">公開状態: All</option>
                  <option value="published">
                    公開のみ ({allPhotos.length - unpublishedCount})
                  </option>
                  <option value="unpublished">
                    非公開のみ ({unpublishedCount})
                  </option>
                </select>

                <button
                  onClick={() => setFilterMissingShotAt((v) => !v)}
                  aria-pressed={filterMissingShotAt}
                  className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border transition-colors ${
                    filterMissingShotAt
                      ? "bg-[#4a4a4a] text-[#eee] border-[#666]"
                      : "bg-[#333] text-[#999] border-[#444] hover:bg-[#3a3a3a]"
                  }`}
                >
                  撮影日なし ({missingShotAtCount})
                </button>

                <button
                  onClick={() => setFilterMissingCapture((v) => !v)}
                  aria-pressed={filterMissingCapture}
                  className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border transition-colors ${
                    filterMissingCapture
                      ? "bg-[#4a4a4a] text-[#eee] border-[#666]"
                      : "bg-[#333] text-[#999] border-[#444] hover:bg-[#3a3a3a]"
                  }`}
                >
                  機材なし ({missingCaptureCount})
                </button>

                <select
                  value={filterRecent}
                  onChange={(e) => setFilterRecent(e.target.value)}
                  aria-label="アップロード時期で絞り込み"
                  className="bg-[#333] text-[#ccc] text-[11px] px-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888]"
                >
                  <option value="all">All time</option>
                  <option value="7">直近7日</option>
                  <option value="30">直近30日</option>
                </select>

                {anyFilterActive && (
                  <button
                    type="button"
                    onClick={clearLibraryFilters}
                    className="text-[11px] px-2 py-1 rounded-sm border border-[#444] text-[#999] bg-[#333] hover:bg-[#3a3a3a] hover:text-[#ddd] transition-colors"
                  >
                    すべて解除
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <FolderOpen size={12} className="text-[#666]" />
                {smartAlbums.map((a) => {
                  const conditionLabels = describeAlbumConditions(a.cond);
                  const shownLabels = conditionLabels.slice(0, 3);
                  const hiddenLabelCount =
                    conditionLabels.length - shownLabels.length;
                  return (
                    <span
                      key={a.id}
                      className={`group/al inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-1 rounded-sm border transition-colors ${
                        activeAlbumId === a.id
                          ? "bg-[#4a4a4a] text-[#eee] border-[#666]"
                          : "bg-[#333] text-[#aaa] border-[#444] hover:bg-[#3a3a3a]"
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
                            className="max-w-28 truncate rounded-sm bg-black/20 px-1.5 py-0.5 text-[10px] text-[#888]"
                            title={label}
                          >
                            {label}
                          </span>
                        ))}
                        {hiddenLabelCount > 0 && (
                          <span className="rounded-sm bg-black/20 px-1.5 py-0.5 text-[10px] text-[#888]">
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
                        aria-label={`${a.name}を削除`}
                        className="opacity-50 group-hover/al:opacity-100 text-[#888] hover:text-red-400 transition-[opacity,color] duration-[var(--dur-fast)] ease-[var(--ease-out)]"
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
                  className="flex items-center gap-1 text-[11px] text-[#888] px-2 py-1 rounded-sm border border-dashed border-[#444] hover:bg-[#333] transition-colors"
                >
                  <Plus size={11} /> アルバム
                </button>
              </div>
            </div>
          )}

          {/* Batch actions */}
          {selected.size > 0 && !showTrash && (
            <div className="border-t border-[#333] pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-[#777] uppercase tracking-wider">
                選択中 {selected.size}枚
              </span>
              {/* M2: Publish / Unpublish */}
              <div className="flex items-center gap-1 bg-[#333] rounded-sm px-1.5 py-0.5">
                <button
                  onClick={() => batchOp.mutate({ operation: "publish" })}
                  disabled={batchOp.isPending}
                  className="flex items-center gap-1 text-[11px] text-emerald-300/80 px-1.5 py-0.5 rounded-sm hover:bg-[#3a3a3a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Eye size={11} /> 公開
                </button>
                <button
                  onClick={() => batchOp.mutate({ operation: "unpublish" })}
                  disabled={batchOp.isPending}
                  className="flex items-center gap-1 text-[11px] text-[#999] px-1.5 py-0.5 rounded-sm hover:bg-[#3a3a3a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <EyeOff size={11} /> 非公開
                </button>
              </div>

              <div className="relative" data-batch-cat>
                <button
                  onClick={() => setBatchCatOpen((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-[#aaa] bg-[#333] px-2.5 py-1 rounded-sm hover:bg-[#3a3a3a] transition-colors"
                >
                  <Tag size={11} /> Set Category <ChevronDown size={10} />
                </button>
                {batchCatOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-[#333] border border-[#444] rounded-sm shadow-xl z-20 min-w-[140px]">
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
                        className="w-full text-left px-3 py-1.5 text-[11px] text-[#ccc] hover:bg-[#444] transition-colors flex items-center gap-2"
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
                      className="w-full text-left px-3 py-1.5 text-[11px] text-[#999] hover:bg-[#444] transition-colors flex items-center gap-2 border-t border-[#444]"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0 border border-[#666]" />
                      未分類 (uncategorized)
                    </button>
                  </div>
                )}
              </div>

              {/* M2: Set Series */}
              <div className="relative" data-batch-series>
                <button
                  onClick={() => setBatchSeriesOpen((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-[#aaa] bg-[#333] px-2.5 py-1 rounded-sm hover:bg-[#3a3a3a] transition-colors"
                >
                  <Layers size={11} /> Set Series <ChevronDown size={10} />
                </button>
                {batchSeriesOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-[#333] border border-[#444] rounded-sm shadow-xl z-20 min-w-[160px] max-h-64 overflow-y-auto">
                    {seriesList.length === 0 && (
                      <div className="px-3 py-1.5 text-[11px] text-[#666]">
                        シリーズなし
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
                        className="w-full text-left px-3 py-1.5 text-[11px] text-[#ccc] hover:bg-[#444] transition-colors truncate"
                      >
                        {s.title}
                        {s.isPublished ? "" : "（下書き）"}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        batchOp.mutate({ operation: "series", value: "" });
                        setBatchSeriesOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-[#999] hover:bg-[#444] transition-colors border-t border-[#444]"
                    >
                      割り当て解除
                    </button>
                  </div>
                )}
              </div>

              {/* M2: Set display size */}
              <div className="flex items-center gap-1 bg-[#333] rounded-sm px-1.5 py-1">
                <span className="text-[10px] text-[#777]">Size</span>
                {(["S", "M", "L"] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() =>
                      batchOp.mutate({ operation: "size", value: sz })
                    }
                    disabled={batchOp.isPending}
                    className="text-[11px] text-[#bbb] w-5 h-5 rounded-sm hover:bg-[#4a4a4a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {sz}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-[#333] rounded-sm px-1.5 py-1">
                <span className="text-[10px] text-[#777]">Rotate</span>
                <button
                  type="button"
                  onClick={() => batchOp.mutate({ operation: "rotate_left" })}
                  disabled={batchOp.isPending}
                  title="左へ90°回転"
                  aria-label="選択写真を左へ90度回転"
                  className="w-5 h-5 inline-flex items-center justify-center text-[#bbb] rounded-sm hover:bg-[#4a4a4a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => batchOp.mutate({ operation: "rotate_right" })}
                  disabled={batchOp.isPending}
                  title="右へ90°回転"
                  aria-label="選択写真を右へ90度回転"
                  className="w-5 h-5 inline-flex items-center justify-center text-[#bbb] rounded-sm hover:bg-[#4a4a4a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <RotateCw size={12} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    batchOp.mutate({ operation: "reset_rotation" })
                  }
                  disabled={batchOp.isPending}
                  title="向きを0°に戻す"
                  aria-label="選択写真の向きを0度に戻す"
                  className="w-6 h-5 text-[10px] text-[#999] rounded-sm hover:bg-[#4a4a4a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  0°
                </button>
                <button
                  type="button"
                  onClick={() =>
                    batchOp.mutate({ operation: "reset_focal_point" })
                  }
                  disabled={batchOp.isPending}
                  title="見せる中心を中央に戻す"
                  aria-label="選択写真の見せる中心を中央に戻す"
                  className="w-5 h-5 inline-flex items-center justify-center text-[#999] rounded-sm hover:bg-[#4a4a4a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Crosshair size={12} />
                </button>
              </div>

              <div className="flex items-center gap-1 bg-[#333] rounded-sm px-1.5 py-1">
                <span className="text-[10px] text-[#777]">Date</span>
                <input
                  type="date"
                  value={batchShotAtDate}
                  onChange={(e) => setBatchShotAtDate(e.target.value)}
                  aria-label="選択写真に設定する撮影日"
                  className="bg-[#2a2a2a] text-[#ccc] text-[11px] px-1.5 py-0.5 rounded-sm border border-[#444] outline-none focus:border-[#888]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!batchShotAtDate || selectedMissingShotAtCount === 0)
                      return;
                    if (
                      !confirm(
                        `${selectedMissingShotAtCount}枚に ${batchShotAtDate} を設定します`,
                      )
                    )
                      return;
                    batchOp.mutate({
                      operation: "shotAt_missing_only",
                      value: batchShotAtDate,
                    });
                  }}
                  disabled={
                    batchOp.isPending ||
                    !batchShotAtDate ||
                    selectedMissingShotAtCount === 0
                  }
                  title="撮影日が空の選択写真だけに設定します"
                  className="text-[11px] text-[#bbb] px-1.5 py-0.5 rounded-sm hover:bg-[#4a4a4a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  適用 ({selectedMissingShotAtCount})
                </button>
              </div>

              {/* M2: feature / unfeature control hero membership. */}
              <button
                onClick={() => batchOp.mutate({ operation: "feature" })}
                disabled={batchOp.isPending}
                className="flex items-center gap-1 text-[11px] text-amber-300/80 bg-[#333] px-2.5 py-1 rounded-sm hover:bg-[#3a3a3a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Star size={11} /> Heroに追加
              </button>
              <button
                onClick={() => batchOp.mutate({ operation: "unfeature" })}
                disabled={batchOp.isPending}
                className="flex items-center gap-1 text-[11px] text-[#999] bg-[#333] px-2.5 py-1 rounded-sm hover:bg-[#3a3a3a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <StarOff size={11} /> Heroから外す
              </button>

              {/* O2: bulk metadata edit */}
              <button
                onClick={() => {
                  setBatchEdit({ camera: "", lens: "", filmType: "" });
                  setBatchEditOpen(true);
                }}
                className="flex items-center gap-1 text-[11px] text-[#aaa] bg-[#333] px-2.5 py-1 rounded-sm hover:bg-[#3a3a3a] transition-colors"
              >
                <Pencil size={11} /> 一括編集
              </button>

              <button
                onClick={() =>
                  setDeleteConfirm({
                    ids: Array.from(selected),
                    label: `${selected.size}枚の写真をゴミ箱に移動しますか？`,
                  })
                }
                className="flex items-center gap-1 text-[11px] text-red-400/70 bg-[#333] px-2.5 py-1 rounded-sm hover:bg-red-900/30 transition-colors"
              >
                <Trash2 size={11} /> ゴミ箱へ
              </button>
            </div>
          )}
        </div>

        {!showTrash &&
          (activeFilterLabels.length > 0 || librarySort !== "manual") && (
            <div
              aria-label="Libraryの表示条件"
              className="bg-[#232323] border-b border-[#333] px-2 sm:px-4 py-2 flex items-center gap-1.5 flex-wrap flex-shrink-0"
            >
              <span className="text-[10px] text-[#777] uppercase tracking-wider mr-1">
                表示条件
              </span>
              <span className="text-[11px] text-[#aaa] bg-[#303030] border border-[#444] rounded-sm px-2 py-1">
                {displayed.length} / {allPhotos.length} photos
              </span>
              {librarySort !== "manual" && (
                <span className="text-[11px] text-[#aaa] bg-[#303030] border border-[#444] rounded-sm px-2 py-1">
                  並び: {LIBRARY_SORT_LABELS[librarySort] ?? librarySort}
                </span>
              )}
              {activeFilterLabels.map((item) => (
                <span
                  key={item.key}
                  className="max-w-[220px] truncate text-[11px] text-[#bbb] bg-[#303030] border border-[#444] rounded-sm px-2 py-1"
                  title={item.text}
                >
                  {item.text}
                </span>
              ))}
              {reorderLocked && (
                <span className="text-[11px] text-amber-300/80 bg-amber-900/20 border border-amber-900/30 rounded-sm px-2 py-1">
                  {librarySort !== "manual"
                    ? "手動順に戻すとドラッグ可"
                    : "条件解除でドラッグ可"}
                </span>
              )}
              {anyFilterActive && (
                <button
                  type="button"
                  onClick={clearLibraryFilters}
                  className="text-[11px] px-2 py-1 rounded-sm border border-[#444] text-[#aaa] bg-[#2f2f2f] hover:bg-[#3a3a3a] hover:text-[#ddd] transition-colors"
                >
                  条件を解除
                </button>
              )}
            </div>
          )}

        {/* Upload progress bar */}
        {uploading && uploadProgress && (
          <div className="bg-[#252525] px-4 py-2 border-b border-[#333] flex items-center gap-3">
            <Loader2 size={12} className="animate-spin text-[#888]" />
            <span className="text-[11px] text-[#888]">
              Importing {uploadProgress.done} / {uploadProgress.total}
            </span>
            <div className="flex-1 h-1 bg-[#333] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#888] transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out)] rounded-full"
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
          className={`flex-1 overflow-y-auto p-3 relative ${dragOver ? "ring-2 ring-inset ring-[#888]/40" : ""}`}
          onScroll={(e) => {
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
            <div className="absolute inset-2 z-10 flex items-center justify-center pointer-events-none rounded-md border-2 border-dashed border-[#888]/60 bg-[#888]/10">
              <div className="flex flex-col items-center gap-2 text-[#aaa]">
                <Upload size={28} strokeWidth={1.5} />
                <span className="text-sm">ここにドロップして読み込み</span>
              </div>
            </div>
          )}

          {showTrash ? (
            /* ── Trash view ── */
            (trashData?.photos ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-[#555]">
                <EmptyTrashIllustration />
                <p className="text-sm">
                  ゴミ箱は空です。移動した写真はここに表示されます。
                </p>
              </div>
            ) : (
              <div className="p-3">
                <div className="text-[10px] text-amber-500/70 bg-amber-900/20 border border-amber-900/30 rounded-sm px-3 py-1.5 mb-3 flex items-center justify-between">
                  <span>
                    削除済み写真 — 復元するか、完全削除してください（
                    {trashData?.retentionDays ?? 30}
                    日後に自動で完全削除されます）
                  </span>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `${trashData!.photos.length}枚をすべて完全削除しますか？この操作は取り消せません。`,
                        )
                      )
                        purgePhotos.mutate(trashData!.photos.map((p) => p.id));
                    }}
                    className="text-red-400/70 hover:text-red-400 transition-colors text-[10px]"
                  >
                    Purge All
                  </button>
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
                          className="w-full aspect-square object-cover bg-[#2a2a2a] opacity-50"
                          style={{
                            objectPosition: adminPhotoObjectPosition(photo),
                          }}
                          loading="lazy"
                          draggable={false}
                        />
                        {daysLeft !== null && (
                          <span
                            className={`absolute top-1 left-1 z-[2] text-[9px] px-1.5 py-0.5 rounded-sm bg-black/65 ${daysLeft <= 5 ? "text-red-300/90" : "text-amber-300/80"}`}
                          >
                            残り{daysLeft}日
                          </span>
                        )}
                        {/* Buttons always visible on touch (no hover there); hover-reveal on desktop */}
                        <div className="absolute inset-0 bg-black/0 sm:group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            onClick={() => restorePhotos.mutate([photo.id])}
                            className="text-[10px] bg-[#555] text-white px-2 py-1 rounded-sm hover:bg-[#777] transition-colors flex items-center gap-1"
                          >
                            <Check size={10} /> 復元
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  "完全削除しますか？この操作は取り消せません。",
                                )
                              )
                                purgePhotos.mutate([photo.id]);
                            }}
                            className="text-[10px] bg-red-900/60 text-red-300 px-2 py-1 rounded-sm hover:bg-red-900/80 transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={10} /> 完全削除
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
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full gap-2 text-[#555] text-sm">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </div>
          ) : bulkEditMode ? (
            <BulkEditTable
              photos={displayed}
              seriesList={seriesList}
              cameraPresets={cameraPresets}
              lensPresets={lensPresets}
              onSave={bulkEditSave}
            />
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#555]">
              {anyFilterActive && allPhotos.length > 0 ? (
                <EmptySearchIllustration />
              ) : (
                <EmptyContactSheetIllustration />
              )}
              {anyFilterActive && allPhotos.length > 0 ? (
                <>
                  <p className="text-sm">条件に合う写真が見つかりません。</p>
                  <p className="text-[11px] text-[#444]">
                    絞り込みや検索語を少しゆるめてみてください。
                  </p>
                  <button
                    type="button"
                    onClick={clearLibraryFilters}
                    className="text-[11px] px-2.5 py-1 rounded-sm border border-[#444] text-[#999] bg-[#333] hover:bg-[#3a3a3a] hover:text-[#ddd] transition-colors"
                  >
                    絞り込みを解除
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm">まだ写真がありません。</p>
                  <p className="text-[11px] text-[#444]">
                    Importから写真を追加できます。
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Reorder-lock warning (filters or a non-manual view sort) */}
              {reorderLocked && (
                <div className="text-[10px] text-[#888] bg-[#2a2a2a] border border-[#444] rounded-sm px-3 py-1.5 mb-2 flex items-center gap-1.5">
                  <span className="text-[#666]">⚠</span>{" "}
                  {anyFilterActive
                    ? "フィルター中はドラッグ並び替えできません（シリーズ単独の絞り込みなら可）"
                    : "並び替え表示中はドラッグ並び替えできません（「手動」に戻すと有効）"}
                </div>
              )}
              {/* Series-scoped reorder: the order set here IS the public series page order */}
              {!reorderLocked && onlySeriesFilter && (
                <div className="text-[10px] text-[#8a9] bg-[#26302a] border border-[#3a4a40] rounded-sm px-3 py-1.5 mb-2 flex items-center gap-1.5">
                  <span>↕</span> シリーズ内の並び替え —
                  ここでの並びが公開シリーズページの表示順になります
                </div>
              )}
              {/* Grid */}
              <div
                ref={gridRef}
                data-virtualized={virtualGrid.isVirtualized ? "true" : "false"}
                data-rendered-count={virtualGrid.renderedCount}
              >
                {virtualGrid.topPadding > 0 && (
                  <div style={{ height: virtualGrid.topPadding }} />
                )}
                <div
                  className="grid"
                  style={{
                    gap: LIBRARY_GRID_GAP,
                    gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`,
                  }}
                >
                  {visibleDisplayed.map((photo, localIdx) => {
                    const idx = virtualGrid.startIndex + localIdx;
                    const isSelected = selected.has(photo.id);
                    const isInspect = inspectPhoto?.id === photo.id;
                    const catColor = catColors[photo.category] ?? "#666";
                    const isUnpublished = photo.isPublished === false;
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
                        ? "日付なし"
                        : null,
                      (filterMissingCapture || albumCond?.missingCapture) &&
                      !(photo.camera || photo.lens)
                        ? "機材なし"
                        : null,
                      (filterMedium === "missing" ||
                        albumCond?.medium === "missing") &&
                      photoMedium(photo) === "missing"
                        ? "媒体なし"
                        : null,
                    ].filter((label): label is string => Boolean(label));
                    return (
                      <div
                        key={photo.id}
                        id={`admin-photo-${photo.id}`}
                        draggable
                        onDragStart={() => handleDragStart(photo.id)}
                        onDragOver={(e) => handleDragOver(e, photo.id)}
                        onDrop={() => handleDrop(photo.id)}
                        onDragEnd={() => {
                          stopDragScroll();
                          setDragSrcId(null);
                          setDragOverId(null);
                        }}
                        className={`admin-photo-tile relative group ${
                          dragSrcId === photo.id ? "opacity-35" : ""
                        } ${
                          isSelected
                            ? "ring-2 ring-[#aaa] ring-offset-1 ring-offset-[#1e1e1e]"
                            : isInspect
                              ? "ring-1 ring-[#666]"
                              : "hover:ring-1 hover:ring-[#444]"
                        }`}
                      >
                        {/* Drop-position indicator: a bar on the edge where the dragged
                        photo will land (drop takes the target's slot — before the
                        target when dragging up/left, after it when dragging down/right). */}
                        {dragOverId === photo.id &&
                          dragSrcId !== null &&
                          dragSrcId !== photo.id && (
                            <div
                              aria-hidden="true"
                              className={`absolute top-0 bottom-0 z-[3] w-[3px] bg-[#ddd] shadow-[0_0_6px_rgba(255,255,255,0.5)] pointer-events-none ${
                                displayed.findIndex((p) => p.id === dragSrcId) <
                                idx
                                  ? "-right-[3px]"
                                  : "-left-[3px]"
                              }`}
                            />
                          )}
                        {/* Full-card click target — a real <button> so select/open is keyboard
                        accessible; the reorder buttons sit above it (higher z). */}
                        <button
                          type="button"
                          aria-label={photo.title || photo.filename || "写真"}
                          onClick={(e) => handlePhotoClick(photo, idx, e)}
                          className="absolute inset-0 z-[1] cursor-pointer"
                        />
                        <img
                          src={adminPhotoSrc(photo, 400, 70)}
                          alt={photo.title}
                          className={`w-full aspect-square object-cover bg-[#2a2a2a] ${isUnpublished ? "opacity-40 grayscale" : ""}`}
                          style={{
                            objectPosition: adminPhotoObjectPosition(photo),
                          }}
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                        />
                        {/* M2: non-public badge (offset right so it clears the category dot) */}
                        {isUnpublished && (
                          <div className="absolute top-1 left-4 z-[2] flex items-center gap-0.5 bg-black/70 text-white/75 text-[9px] px-1 py-0.5 rounded-sm">
                            <EyeOff size={9} /> 非公開
                          </div>
                        )}
                        {/* Category color label — top-left dot */}
                        <div
                          className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full shadow-sm"
                          style={{ background: catColor }}
                          title={photo.category}
                        />
                        {thumbSize >= 120 && metadataBadges.length > 0 && (
                          <div
                            aria-label={`未入力: ${metadataBadges.join(", ")}`}
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
                        {thumbSize >= 120 && usageBadgeLabels.length > 0 && (
                          <div
                            aria-label={`使用状況: ${usageBadgeLabels.join(", ")}`}
                            className="absolute bottom-1 right-1 z-[2] flex max-w-[calc(100%-0.5rem)] flex-wrap justify-end gap-1"
                          >
                            {heroIndex >= 0 && (
                              <span className="inline-flex items-center gap-0.5 rounded-sm bg-amber-900/70 px-1.5 py-0.5 text-[9px] leading-none text-amber-200/90">
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
                        {thumbSize >= 120 && (
                          <div className="absolute top-6 right-1 z-[2] flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                rotateLibraryPhoto(photo, -90);
                              }}
                              disabled={quickRotatePhoto.isPending}
                              aria-label="左へ90度回転"
                              title="左へ90°回転"
                              className="w-6 h-6 flex items-center justify-center bg-black/55 text-white/85 rounded-sm hover:bg-black/75 disabled:opacity-35 disabled:cursor-wait"
                            >
                              <RotateCcw size={13} />
                            </button>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                rotateLibraryPhoto(photo, 90);
                              }}
                              disabled={quickRotatePhoto.isPending}
                              aria-label="右へ90度回転"
                              title="右へ90°回転"
                              className="w-6 h-6 flex items-center justify-center bg-black/55 text-white/85 rounded-sm hover:bg-black/75 disabled:opacity-35 disabled:cursor-wait"
                            >
                              <RotateCw size={13} />
                            </button>
                          </div>
                        )}
                        {/* Title strip on hover */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white/80 truncate">
                            {photo.title || photo.filename}
                          </p>
                        </div>
                        {/* Move controls — touch-friendly reorder (drag isn't available on touch).
                        Always visible on mobile; hover-reveal on desktop. */}
                        {!reorderLocked && !showTrash && (
                          <div className="absolute bottom-1 left-1 z-[2] flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {/* ⇤⇥ hide on small thumbnails — 4 buttons (~105px) overflow an 80px tile */}
                            {thumbSize >= 120 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  movePhotoTo(photo.id, "start");
                                }}
                                disabled={idx === 0}
                                aria-label="先頭へ移動"
                                title="先頭へ移動"
                                className="w-6 h-6 flex items-center justify-center bg-black/55 text-white/85 rounded-sm hover:bg-black/75 disabled:opacity-25 disabled:cursor-not-allowed"
                              >
                                <ChevronsLeft size={13} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                movePhoto(photo.id, -1);
                              }}
                              disabled={idx === 0}
                              aria-label="前へ移動"
                              title="前へ移動"
                              className="w-6 h-6 flex items-center justify-center bg-black/55 text-white/85 rounded-sm hover:bg-black/75 disabled:opacity-25 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                movePhoto(photo.id, 1);
                              }}
                              disabled={idx === displayed.length - 1}
                              aria-label="後へ移動"
                              title="後へ移動"
                              className="w-6 h-6 flex items-center justify-center bg-black/55 text-white/85 rounded-sm hover:bg-black/75 disabled:opacity-25 disabled:cursor-not-allowed"
                            >
                              <ChevronRight size={13} />
                            </button>
                            {thumbSize >= 120 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  movePhotoTo(photo.id, "end");
                                }}
                                disabled={idx === displayed.length - 1}
                                aria-label="末尾へ移動"
                                title="末尾へ移動"
                                className="w-6 h-6 flex items-center justify-center bg-black/55 text-white/85 rounded-sm hover:bg-black/75 disabled:opacity-25 disabled:cursor-not-allowed"
                              >
                                <ChevronsRight size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {virtualGrid.bottomPadding > 0 && (
                  <div style={{ height: virtualGrid.bottomPadding }} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* M2: batch-operation result toast */}
      <Toast
        show={!!batchToast}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-800/70 border border-emerald-700/60 text-emerald-50 text-[12px] px-4 py-2.5 rounded-sm shadow-xl"
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
          <p className="text-[13px] text-[#ddd] mb-1">一括メタ編集</p>
          <p className="text-[11px] text-[#777] mb-4">
            選択中 {selected.size} 枚に適用。空欄の項目は変更しません。
          </p>
          <div className="flex flex-col gap-3">
            <AdminField label="Camera">
              <input
                aria-label="Camera"
                value={batchEdit.camera}
                onChange={(e) =>
                  setBatchEdit((b) => ({ ...b, camera: e.target.value }))
                }
                placeholder="（変更しない）"
                className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
              />
            </AdminField>
            <AdminField label="Lens">
              <input
                aria-label="Lens"
                value={batchEdit.lens}
                onChange={(e) =>
                  setBatchEdit((b) => ({ ...b, lens: e.target.value }))
                }
                placeholder="（変更しない）"
                className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
              />
            </AdminField>
            <AdminField label="Film / Digital">
              <div className="flex gap-1">
                {(
                  [
                    ["", "変更しない"],
                    ["フィルム", "フィルム"],
                    ["デジタル", "デジタル"],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={lbl}
                    onClick={() =>
                      setBatchEdit((b) => ({ ...b, filmType: val }))
                    }
                    className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${batchEdit.filmType === val ? "bg-[#888] text-[#1e1e1e] font-medium" : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"}`}
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
              className="px-4 py-1.5 text-[11px] text-[#888] hover:text-[#ccc] transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={() => batchMetaEdit.mutate(batchEdit)}
              disabled={
                batchMetaEdit.isPending ||
                (!batchEdit.camera && !batchEdit.lens && !batchEdit.filmType)
              }
              className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors disabled:opacity-40"
            >
              {batchMetaEdit.isPending ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> 適用中
                </>
              ) : (
                <>
                  <Check size={11} /> 適用
                </>
              )}
            </button>
          </div>
        </Modal>
      )}

      {/* O6: create smart album — name + optional conditions (saved as a virtual folder) */}
      {albumModalOpen && (
        <Modal onClose={() => setAlbumModalOpen(false)} widthClass="w-80">
          <p className="text-[13px] text-[#ddd] mb-1">スマートアルバムを作成</p>
          <p className="text-[11px] text-[#777] mb-4">
            条件に合う写真を自動で集めます。空欄の項目は条件にしません。
          </p>
          <div className="flex flex-col gap-3">
            <AdminField label="名前">
              <input
                aria-label="アルバム名"
                value={albumDraft.name}
                onChange={(e) =>
                  setAlbumDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="例: PENTAX 67"
                className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
              />
            </AdminField>
            <AdminField label="カメラを含む">
              <input
                aria-label="カメラ"
                list="album-camera-presets"
                value={albumDraft.camera}
                onChange={(e) =>
                  setAlbumDraft((d) => ({ ...d, camera: e.target.value }))
                }
                placeholder="（指定なし）"
                className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
              />
              <datalist id="album-camera-presets">
                {cameraPresets.map((p) => (
                  <option key={p} value={p} aria-label={p} />
                ))}
              </datalist>
            </AdminField>
            <AdminField label="フィルム / デジタル">
              <div className="flex gap-1">
                {(
                  [
                    ["", "指定なし"],
                    ["フィルム", "フィルム"],
                    ["デジタル", "デジタル"],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={lbl}
                    onClick={() =>
                      setAlbumDraft((d) => ({ ...d, filmType: val }))
                    }
                    className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${albumDraft.filmType === val ? "bg-[#888] text-[#1e1e1e] font-medium" : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </AdminField>
            <div className="flex gap-2">
              <AdminField label="媒体">
                <select
                  aria-label="媒体条件"
                  value={albumDraft.medium}
                  onChange={(e) =>
                    setAlbumDraft((d) => ({ ...d, medium: e.target.value }))
                  }
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-2 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm"
                >
                  <option value="all">指定なし</option>
                  <option value="digital">Digital</option>
                  <option value="film">Film</option>
                  <option value="missing">媒体なし</option>
                </select>
              </AdminField>
              <AdminField label="未入力">
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
                    className={`flex-1 text-[11px] py-2 rounded-sm border transition-colors ${albumDraft.missingShotAt ? "bg-[#555] text-[#eee] border-[#666]" : "bg-[#333] text-[#888] border-[#444] hover:bg-[#3a3a3a]"}`}
                  >
                    日付
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
                    className={`flex-1 text-[11px] py-2 rounded-sm border transition-colors ${albumDraft.missingCapture ? "bg-[#555] text-[#eee] border-[#666]" : "bg-[#333] text-[#888] border-[#444] hover:bg-[#3a3a3a]"}`}
                  >
                    機材
                  </button>
                </div>
              </AdminField>
            </div>
            <AdminField label="カテゴリ">
              <select
                aria-label="カテゴリ条件"
                value={albumDraft.category}
                onChange={(e) =>
                  setAlbumDraft((d) => ({ ...d, category: e.target.value }))
                }
                className="w-full bg-[#333] border border-[#444] text-[#ddd] px-2 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm"
              >
                <option value="all">指定なし</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
                <option value="__uncat__">未分類</option>
              </select>
            </AdminField>
            <AdminField label="シリーズ">
              <select
                aria-label="シリーズ条件"
                value={albumDraft.series}
                onChange={(e) =>
                  setAlbumDraft((d) => ({ ...d, series: e.target.value }))
                }
                className="w-full bg-[#333] border border-[#444] text-[#ddd] px-2 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm"
              >
                <option value="all">指定なし</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.title}
                  </option>
                ))}
                <option value="__none__">未割り当て</option>
              </select>
            </AdminField>
            <div className="flex gap-2">
              <AdminField label="サイズ">
                <select
                  aria-label="サイズ条件"
                  value={albumDraft.size}
                  onChange={(e) =>
                    setAlbumDraft((d) => ({ ...d, size: e.target.value }))
                  }
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-2 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm"
                >
                  <option value="all">指定なし</option>
                  {(["S", "M", "L"] as const).map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="公開状態">
                <select
                  aria-label="公開状態条件"
                  value={albumDraft.published}
                  onChange={(e) =>
                    setAlbumDraft((d) => ({ ...d, published: e.target.value }))
                  }
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-2 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm"
                >
                  <option value="all">指定なし</option>
                  <option value="published">公開のみ</option>
                  <option value="unpublished">非公開のみ</option>
                </select>
              </AdminField>
            </div>
            <div className="flex gap-2">
              <AdminField label="アップロード時期">
                <select
                  aria-label="時期条件"
                  value={albumDraft.recent}
                  onChange={(e) =>
                    setAlbumDraft((d) => ({ ...d, recent: e.target.value }))
                  }
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-2 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm"
                >
                  <option value="all">指定なし</option>
                  <option value="7">直近7日</option>
                  <option value="30">直近30日</option>
                </select>
              </AdminField>
              <AdminField label="フィーチャー">
                <button
                  onClick={() =>
                    setAlbumDraft((d) => ({ ...d, featured: !d.featured }))
                  }
                  aria-pressed={albumDraft.featured}
                  className={`w-full flex items-center justify-center gap-1 text-[11px] py-2 rounded-sm border transition-colors ${albumDraft.featured ? "bg-amber-900/40 text-amber-300 border-amber-700/50" : "bg-[#333] text-[#888] border-[#444] hover:bg-[#3a3a3a]"}`}
                >
                  <Star size={11} /> {albumDraft.featured ? "のみ" : "条件なし"}
                </button>
              </AdminField>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-5">
            <button
              onClick={() => setAlbumModalOpen(false)}
              className="px-4 py-1.5 text-[11px] text-[#888] hover:text-[#ccc] transition-colors"
            >
              キャンセル
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
              className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors disabled:opacity-40"
            >
              {saveAlbums.isPending ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> 保存中
                </>
              ) : (
                <>
                  <Check size={11} /> 作成
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
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 max-w-[90vw] bg-red-900/30 border border-red-900/50 text-red-200 text-[12px] px-4 py-2.5 rounded-sm shadow-xl"
      >
        <span className="truncate">{actionError}</span>
        <button
          onClick={() => setActionError("")}
          aria-label="閉じる"
          className="text-red-200/60 hover:text-red-100 transition-colors flex-shrink-0"
        >
          <X size={12} />
        </button>
      </Toast>

      {/* Undo toast (B3) */}
      <Toast
        show={!!undoToast}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#333] border border-[#444] text-[#ddd] text-[12px] px-4 py-2.5 rounded-sm shadow-xl"
      >
        <span>{undoToast?.count}枚をゴミ箱に移動しました</span>
        <button
          onClick={() => undoToast && restorePhotos.mutate(undoToast.ids)}
          className="text-[#aaa] hover:text-white underline underline-offset-2 transition-colors"
        >
          ↩ 元に戻す
        </button>
        <button
          onClick={() => setUndoToast(null)}
          className="text-[#555] hover:text-[#888] transition-colors ml-1"
        >
          <X size={12} />
        </button>
      </Toast>

      {/* Upload result notice (failures / skipped files) */}
      <Toast
        show={!!uploadNotice}
        role="alert"
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 max-w-[90vw] bg-[#3a2a2a] border border-amber-700/50 text-amber-200 text-[12px] px-4 py-2.5 rounded-sm shadow-xl"
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
            className="flex-shrink-0 flex items-center gap-1 text-amber-100 underline underline-offset-2 hover:text-white transition-colors"
          >
            <Upload size={11} /> 失敗分を再アップロード
          </button>
        )}
        <button
          onClick={() => {
            setUploadNotice(null);
            setRetryFiles([]);
          }}
          aria-label="閉じる"
          className="text-amber-200/60 hover:text-amber-100 transition-colors ml-1 flex-shrink-0"
        >
          <X size={12} />
        </button>
      </Toast>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)}>
          <p className="text-[13px] text-[#ddd] mb-4">{deleteConfirm.label}</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-1.5 text-[11px] text-[#888] hover:text-[#ccc] transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={() => {
                deletePhotos.mutate(deleteConfirm.ids);
                setDeleteConfirm(null);
              }}
              className="px-4 py-1.5 text-[11px] bg-red-600/70 text-white rounded-sm hover:bg-red-600/90 transition-colors"
            >
              ゴミ箱へ移動
            </button>
          </div>
        </Modal>
      )}

      {/* C3: Quick preview (Space) — full-screen image overlay */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[9998] bg-black/90 flex items-center justify-center p-6">
          {/* Backdrop close target — a real <button> behind the image; the image
              is click-through (pointer-events-none) so clicking anywhere closes,
              as before. Arrow/Space/Esc are handled by the grid's global keydown. */}
          <button
            type="button"
            aria-label="プレビューを閉じる"
            onClick={() => setPreviewPhoto(null)}
            className="absolute inset-0 cursor-default"
          />
          <img
            src={adminPhotoSrc(previewPhoto, 1600, 85)}
            alt={previewPhoto.title || previewPhoto.filename}
            className="relative pointer-events-none max-w-full max-h-full object-contain shadow-2xl"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/60 bg-black/40 px-3 py-1 rounded-sm">
            {previewPhoto.title || previewPhoto.filename} · ← → で移動 · Space /
            Esc で閉じる
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreviewPhoto(null);
            }}
            aria-label="Close preview"
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
            <h3 className="text-[12px] tracking-widest uppercase text-[#888]">
              キーボードショートカット
            </h3>
            <button
              onClick={() => setShowShortcuts(false)}
              aria-label="Close"
              className="text-[#888] hover:text-[#ccc]"
            >
              <X size={15} />
            </button>
          </div>
          <dl className="flex flex-col gap-2 text-[12px]">
            {(
              [
                ["クリック", "選択 / インスペクタを開く"],
                ["⌘/Ctrl + クリック", "複数選択の切替"],
                ["Shift + クリック", "範囲選択"],
                ["⌘/Ctrl + A", "全選択"],
                ["← → ↑ ↓", "選択を移動"],
                ["⌘/Ctrl + ↑ ↓", "写真を並べ替え（前後へ）"],
                ["[ / ]", "選択写真を左 / 右へ90°回転"],
                ["Enter", "インスペクタを開く"],
                ["Space", "クイックプレビュー"],
                ["Delete / Backspace", "選択を削除（ゴミ箱へ）"],
                ["Esc", "閉じる / 選択解除"],
                ["?", "このヘルプ"],
              ] as const
            ).map(([k, desc]) => (
              <div key={k} className="flex items-center justify-between gap-4">
                <dt className="text-[#aaa] font-mono text-[11px] whitespace-nowrap">
                  {k}
                </dt>
                <dd className="text-[#777] text-right">{desc}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}

      {/* Right panel — Inspector (like Lr metadata panel).
          Mobile: full-width drawer overlay. Desktop: static side panel. */}
      {inspectPhoto && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xs shadow-2xl sm:static sm:z-auto sm:w-72 sm:max-w-none sm:shadow-none bg-[#252525] border-l border-[#333] flex flex-col flex-shrink-0 overflow-y-auto">
          {/* Header with close (close needed on mobile drawer) */}
          <div className="flex items-center justify-between px-3 pt-2 sm:hidden">
            <span className="text-[10px] text-[#666] uppercase tracking-wider">
              Edit Photo
            </span>
            <button
              onClick={() => setInspectPhoto(null)}
              aria-label="Close"
              className="text-[#888] hover:text-[#ccc] transition-colors p-1 -mr-1"
            >
              <X size={16} />
            </button>
          </div>
          {/* Preview */}
          <div className="p-3">
            <img
              src={srcFor(
                inspectPhoto.url,
                800,
                80,
                undefined,
                editForm.rotationDeg,
              )}
              alt={inspectPhoto.title}
              className="w-full h-auto object-contain bg-[#1e1e1e]"
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
              <div className="mx-3 mb-3 rounded-sm border border-[color:var(--admin-line)] bg-[color:var(--admin-paper-soft)] p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#777] uppercase tracking-wider">
                    よく使う
                  </span>
                  {quickDraftChanged && (
                    <span className="rounded-sm border border-amber-900/40 bg-amber-900/20 px-1.5 py-0.5 text-[10px] text-amber-300/80">
                      未保存
                    </span>
                  )}
                </div>

                <div
                  aria-label="写真の使用状況"
                  className="mb-2 flex flex-wrap gap-1"
                >
                  {heroIdx >= 0 && (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-amber-700/40 bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-300">
                      <Star size={9} /> Hero {heroIdx + 1}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] ${
                      editForm.isPublished
                        ? "border-emerald-700/40 bg-emerald-900/20 text-emerald-300/85"
                        : "border-[rgba(var(--admin-accent-rgb),0.35)] bg-[rgba(var(--admin-accent-rgb),0.1)] text-[color:var(--admin-danger)]"
                    }`}
                  >
                    {editForm.isPublished ? (
                      <Eye size={9} />
                    ) : (
                      <EyeOff size={9} />
                    )}
                    {editForm.isPublished ? "公開" : "非公開"}
                  </span>
                  <span className="rounded-sm border border-[#444] bg-[#303030] px-1.5 py-0.5 text-[10px] text-[#bbb]">
                    Size {editForm.displaySize}
                  </span>
                  <span className="inline-flex max-w-full items-center gap-1 rounded-sm border border-[#444] bg-[#303030] px-1.5 py-0.5 text-[10px] text-[#bbb]">
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{
                        background: quickCategory
                          ? (catColors[quickCategory.slug] ?? "#888")
                          : "transparent",
                        border: quickCategory ? "none" : "1px solid #666",
                      }}
                    />
                    <span className="truncate">
                      {quickCategory?.label ?? "未分類"}
                    </span>
                  </span>
                  {quickSeriesName && (
                    <span className="inline-flex max-w-full items-center gap-1 rounded-sm border border-[#444] bg-[#303030] px-1.5 py-0.5 text-[10px] text-[#bbb]">
                      <Layers size={9} className="flex-shrink-0" />
                      <span className="truncate">{quickSeriesName}</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <SegmentedControl
                    value={editForm.isPublished ? "true" : "false"}
                    onChange={(v) =>
                      setEditForm((f) => ({ ...f, isPublished: v === "true" }))
                    }
                    options={[
                      { value: "true", label: "公開" },
                      { value: "false", label: "非公開" },
                    ]}
                  />

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

                  <div className="col-span-2 grid grid-cols-[auto_1fr_auto] gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((f) => ({
                          ...f,
                          rotationDeg: rotatedBy(f.rotationDeg, -90),
                        }))
                      }
                      aria-label="左へ90度回転"
                      title="左へ90°回転"
                      className="flex h-7 w-8 items-center justify-center rounded-sm border border-[#444] bg-[#303030] text-[#aaa] transition-colors hover:bg-[#3a3a3a] hover:text-[#ddd]"
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
                          className={`h-7 rounded-sm text-[10px] transition-colors ${
                            editForm.rotationDeg === deg
                              ? "bg-[#888] text-[#1e1e1e] font-medium"
                              : "border border-[#444] bg-[#303030] text-[#888] hover:bg-[#3a3a3a]"
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
                        }))
                      }
                      aria-label="右へ90度回転"
                      title="右へ90°回転"
                      className="flex h-7 w-8 items-center justify-center rounded-sm border border-[#444] bg-[#303030] text-[#aaa] transition-colors hover:bg-[#3a3a3a] hover:text-[#ddd]"
                    >
                      <RotateCw size={13} />
                    </button>
                  </div>

                  <select
                    value={
                      categories.some((c) => c.slug === editForm.category)
                        ? editForm.category
                        : ""
                    }
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, category: e.target.value }))
                    }
                    aria-label="クイックカテゴリ"
                    className="min-w-0 rounded-sm border border-[#444] bg-[#303030] px-2 py-1.5 text-[11px] text-[#ddd] outline-none transition-colors focus:border-[#888]"
                  >
                    <option value="">カテゴリなし</option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={
                      seriesList.some((s) => s.id === Number(editForm.seriesId))
                        ? editForm.seriesId
                        : ""
                    }
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, seriesId: e.target.value }))
                    }
                    aria-label="クイックシリーズ"
                    className="min-w-0 rounded-sm border border-[#444] bg-[#303030] px-2 py-1.5 text-[11px] text-[#ddd] outline-none transition-colors focus:border-[#888]"
                  >
                    <option value="">シリーズなし</option>
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                        {s.isPublished ? "" : "（下書き）"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })()}

          {/* Metadata form */}
          <div className="px-3 pb-4 flex flex-col gap-3 flex-1">
            <div className="border-b border-[#333] pb-2 mb-1">
              <span className="text-[10px] text-[#666] uppercase tracking-wider">
                Metadata
              </span>
            </div>

            <InspectField
              label="見せる中心"
              hint="正方形・ヒーローなど、切り抜き表示の中心"
            >
              <div className="grid grid-cols-[72px_1fr] gap-2">
                <div className="relative aspect-square overflow-hidden bg-[#1e1e1e] border border-[#444] rounded-sm">
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
                        aria-label={`見せる中心: ${point.label}`}
                        aria-pressed={active}
                        title={point.label}
                        className={`h-5 rounded-sm border flex items-center justify-center transition-colors ${
                          active
                            ? "bg-[#888] border-[#999]"
                            : "bg-[#333] border-[#444] hover:bg-[#3a3a3a]"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            active ? "bg-[#1e1e1e]" : "bg-[#777]"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </InspectField>

            <InspectField label="Title" hint="Lightbox・SEO・alt に使用">
              <input
                aria-label="タイトル"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Untitled"
                className="w-full bg-[#333] text-[#ddd] text-[12px] px-2 py-1.5 rounded-sm border border-[#444] outline-none focus:border-[#888] transition-colors placeholder:text-[#555]"
              />
            </InspectField>

            <InspectField label="Camera" hint="Lightbox の撮影情報として表示">
              <input
                aria-label="カメラ"
                value={editForm.camera}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, camera: e.target.value }))
                }
                placeholder="PENTAX 67"
                list="meta-presets-camera"
                className="w-full bg-[#333] text-[#ddd] text-[12px] px-2 py-1.5 rounded-sm border border-[#444] outline-none focus:border-[#888] transition-colors placeholder:text-[#555]"
              />
              <datalist id="meta-presets-camera">
                {cameraPresets.map((p) => (
                  <option key={p} value={p} aria-label={p} />
                ))}
              </datalist>
            </InspectField>

            <InspectField label="Lens" hint="Lightbox の撮影情報として表示">
              <input
                aria-label="レンズ"
                value={editForm.lens}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, lens: e.target.value }))
                }
                placeholder="SMC Takumar 105mm f/2.4"
                list="meta-presets-lens"
                className="w-full bg-[#333] text-[#ddd] text-[12px] px-2 py-1.5 rounded-sm border border-[#444] outline-none focus:border-[#888] transition-colors placeholder:text-[#555]"
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
                title="カメラとレンズをコピー"
                aria-label="カメラとレンズをコピー"
                className="inline-flex items-center gap-1 text-[10px] text-[#999] bg-[#333] border border-[#444] rounded-sm px-2 py-1 hover:bg-[#3a3a3a] hover:text-[#ccc] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Copy size={10} /> Copy
              </button>
              <button
                type="button"
                onClick={pasteInspectCaptureInfo}
                title="クリップボードからカメラとレンズを貼り付け"
                aria-label="クリップボードからカメラとレンズを貼り付け"
                className="inline-flex items-center gap-1 text-[10px] text-[#999] bg-[#333] border border-[#444] rounded-sm px-2 py-1 hover:bg-[#3a3a3a] hover:text-[#ccc] transition-colors"
              >
                <ClipboardPaste size={10} /> Paste
              </button>
              {captureClipStatus !== "idle" && (
                <span
                  className={`text-[10px] ${captureClipStatus === "error" ? "text-amber-400/80" : "text-emerald-400/80"}`}
                >
                  {captureStatusText[captureClipStatus]}
                </span>
              )}
            </div>

            <InspectField
              label="Film / Digital"
              hint="Lightbox の撮影情報として表示"
            >
              <div className="flex gap-1">
                {(
                  [
                    ["フィルム", "フィルム"],
                    ["デジタル", "デジタル"],
                    ["", "—"],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={lbl}
                    onClick={() =>
                      setEditForm((f) => ({ ...f, filmType: val }))
                    }
                    className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                      editForm.filmType === val
                        ? "bg-[#888] text-[#1e1e1e] font-medium"
                        : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </InspectField>

            <InspectField
              label="撮影日"
              hint="アップロード時にEXIFから自動設定。EXIFが無い写真はここで手入力（任意・空欄可）"
            >
              <div className="flex gap-1.5 items-center">
                <input
                  aria-label="撮影日"
                  type="date"
                  value={editForm.shotAt}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, shotAt: e.target.value }))
                  }
                  className="flex-1 bg-[#333] text-[#ddd] text-[12px] px-2 py-1.5 rounded-sm border border-[#444] outline-none focus:border-[#888] transition-colors [color-scheme:dark]"
                />
                {editForm.shotAt && (
                  <button
                    onClick={() => setEditForm((f) => ({ ...f, shotAt: "" }))}
                    aria-label="撮影日をクリア"
                    className="text-[10px] text-[#666] hover:text-[#999] transition-colors px-1.5"
                  >
                    クリア
                  </button>
                )}
              </div>
            </InspectField>

            <InspectField
              label="Description"
              hint="Lightbox の写真説明（任意）"
            >
              <textarea
                aria-label="説明"
                rows={3}
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Photo description..."
                className="w-full bg-[#333] text-[#ddd] text-[12px] px-2 py-1.5 rounded-sm border border-[#444] outline-none focus:border-[#888] transition-colors resize-y placeholder:text-[#555]"
              />
            </InspectField>

            <div className="flex gap-2 mt-1">
              <button
                disabled={updatePhoto.isPending}
                onClick={() => {
                  setMetaSaved(false);
                  setMetaError(false);
                  // 撮影日は date 入力（日付まで）。未変更ならEXIF由来の時刻部分を保持する。
                  const shotAtToSave = shotAtForDateInputSave(
                    inspectPhoto.shotAt,
                    editForm.shotAt,
                  );
                  updatePhoto.mutate(
                    { id: inspectPhoto.id, ...editForm, shotAt: shotAtToSave },
                    {
                      // Update the local inspect view only once the server confirms
                      onSuccess: () => {
                        // editForm.seriesId is a string ("" = none); store it back as number|null
                        setInspectPhoto({
                          ...inspectPhoto,
                          ...editForm,
                          shotAt: shotAtToSave ?? null,
                          seriesId:
                            editForm.seriesId === ""
                              ? null
                              : Number(editForm.seriesId),
                        });
                        rememberPresets(editForm.camera, editForm.lens);
                        setMetaSaved(true);
                        setTimeout(() => setMetaSaved(false), 1500);
                      },
                      onError: () => setMetaError(true),
                    },
                  );
                }}
                className={`flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-sm transition-colors disabled:opacity-60 ${
                  metaSaved
                    ? "bg-emerald-700/70 text-white"
                    : "bg-[#555] text-[#1e1e1e] hover:bg-[#666]"
                }`}
              >
                {updatePhoto.isPending ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Saving...
                  </>
                ) : metaSaved ? (
                  <>
                    <Check size={11} /> Saved
                  </>
                ) : (
                  <>
                    <Check size={11} /> Save
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setMetaError(false);
                  setEditForm(photoToEditForm(inspectPhoto));
                }}
                className="flex-1 flex items-center justify-center gap-1 text-[11px] text-[#666] bg-[#333] py-1.5 rounded-sm hover:bg-[#3a3a3a] transition-colors"
              >
                <X size={11} /> Reset
              </button>
            </div>
            {/* O1: duplicate this photo (same image, copied metadata) */}
            <button
              onClick={() => duplicatePhoto.mutate(inspectPhoto.id)}
              disabled={duplicatePhoto.isPending}
              className="flex items-center justify-center gap-1.5 text-[11px] text-[#999] bg-[#2f2f2f] border border-[#444] py-1.5 rounded-sm hover:bg-[#383838] hover:text-[#ccc] transition-colors disabled:opacity-50"
            >
              {duplicatePhoto.isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <ImageLucide size={11} />
              )}{" "}
              この写真を複製
            </button>
            {metaError && (
              <p role="alert" className="text-[11px] text-red-400/80 -mt-1">
                保存に失敗しました。もう一度お試しください。
              </p>
            )}

            {/* O5: usage — where this photo appears */}
            {(() => {
              const heroIdx = (heroData?.heroPhotos ?? []).findIndex(
                (h) => h.photoId === inspectPhoto.id,
              );
              const seriesName = inspectPhoto.seriesId
                ? seriesList.find((s) => s.id === inspectPhoto.seriesId)?.title
                : null;
              const catLabel = categories.find(
                (c) => c.slug === inspectPhoto.category,
              )?.label;
              const pos = allPhotos.findIndex((p) => p.id === inspectPhoto.id);
              const rows: [string, string][] = [
                [
                  "ヒーロー",
                  heroIdx >= 0 ? `✓ 設定中（${heroIdx + 1}番目）` : "未設定",
                ],
                ["シリーズ", seriesName ?? "未割り当て"],
                ["カテゴリ", catLabel ?? "未分類"],
                [
                  "表示順",
                  pos >= 0 ? `${pos + 1} / ${allPhotos.length}番目` : "—",
                ],
              ];
              return (
                <div className="border-t border-[#333] pt-3 mt-1 flex flex-col gap-1">
                  <span className="text-[9px] text-[#555] uppercase tracking-wider mb-0.5">
                    使用状況
                  </span>
                  {rows.map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-2 text-[10px]"
                    >
                      <span className="text-[#666] flex-shrink-0">{k}</span>
                      <span className="text-[#bbb] text-right truncate">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="border-t border-[#333] pt-3 mt-2">
              <span className="text-[10px] text-[#666] uppercase tracking-wider">
                File Info
              </span>
              <p className="text-[11px] text-[#888] mt-2 break-all">
                {inspectPhoto.filename}
              </p>
            </div>

            <div className="mt-auto pt-4 pb-16">
              <button
                onClick={() =>
                  setDeleteConfirm({
                    ids: [inspectPhoto.id],
                    label: "この写真をゴミ箱に移動しますか？",
                  })
                }
                className="w-full flex items-center justify-center gap-1.5 text-[11px] text-red-400/60 bg-[#333] py-2 rounded-sm hover:bg-red-900/20 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} /> 写真をゴミ箱へ
              </button>
            </div>
          </div>
        </div>
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
                  ["top", "トップ"],
                  ["gallery", "ギャラリー"],
                ] as const
              ).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setSitePreviewPage(val)}
                  aria-pressed={sitePreviewPage === val}
                  className={`px-2 py-1 rounded-sm text-[10px] transition-colors ${
                    sitePreviewPage === val
                      ? "bg-[#333] text-[#ccc]"
                      : "text-[#555] hover:text-[#888]"
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
                title="PC幅で確認"
                aria-label="PC幅で確認"
                className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] transition-colors ${
                  sitePreviewDevice === "desktop"
                    ? "bg-[#333] text-[#ccc]"
                    : "text-[#555] hover:text-[#888]"
                }`}
              >
                <Monitor size={13} /> PC幅
              </button>
              <button
                onClick={() => setSitePreviewDevice("mobile")}
                aria-pressed={sitePreviewDevice === "mobile"}
                title="スマホ幅で確認"
                aria-label="スマホ幅で確認"
                className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] transition-colors ${
                  sitePreviewDevice === "mobile"
                    ? "bg-[#333] text-[#ccc]"
                    : "text-[#555] hover:text-[#888]"
                }`}
              >
                <Smartphone size={13} /> スマホ幅
              </button>
              <button
                onClick={() =>
                  sitePreviewRef.current?.contentWindow?.location.reload()
                }
                className="ml-1 text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reload
              </button>
              <button
                onClick={() => setShowSitePreview(false)}
                className="ml-1 p-1.5 rounded-sm text-[#888] hover:text-[#ccc] transition-colors"
                title="プレビューを閉じる"
                aria-label="プレビューを閉じる"
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
                    src={sitePreviewPage === "top" ? "/" : "/gallery"}
                    className="w-full h-full border-0"
                    title="サイトプレビュー"
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
                        src={sitePreviewPage === "top" ? "/" : "/gallery"}
                        className="w-full h-full border-0"
                        title="サイトプレビュー"
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
  seriesList,
  cameraPresets,
  lensPresets,
  onSave,
}: {
  photos: Photo[];
  seriesList: AdminSeries[];
  cameraPresets: string[];
  lensPresets: string[];
  onSave: (id: number, data: BulkEditSaveData) => Promise<void>;
}) {
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[#555]">
        <EmptyContactSheetIllustration />
        <p className="text-sm">まだ写真がありません。</p>
        <p className="text-[11px] text-[#444]">
          Gallery表示に戻ると、Importから追加できます。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto h-full">
      <table className="w-full min-w-[860px] border-collapse text-[12px]">
        <thead className="sticky top-0 z-10 bg-[#2a2a2a] border-b border-[#444]">
          <tr>
            <th className="w-7" aria-label="Select" />
            <th className="w-12" aria-label="Thumbnail" />
            <th className="text-left px-2 py-2 text-[10px] text-[#777] uppercase tracking-wider font-normal">
              Title
            </th>
            <th className="text-left px-2 py-2 text-[10px] text-[#777] uppercase tracking-wider font-normal w-44">
              Camera
            </th>
            <th className="text-left px-2 py-2 text-[10px] text-[#777] uppercase tracking-wider font-normal w-48">
              Lens
            </th>
            <th className="text-left px-2 py-2 text-[10px] text-[#777] uppercase tracking-wider font-normal w-36">
              Series
            </th>
            <th className="text-left px-2 py-2 text-[10px] text-[#777] uppercase tracking-wider font-normal w-20">
              Size
            </th>
            <th className="text-left px-2 py-2 text-[10px] text-[#777] uppercase tracking-wider font-normal w-28">
              Medium
            </th>
          </tr>
        </thead>
        <tbody>
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
        setErrorMsg(e instanceof Error ? e.message : "保存失敗");
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
      ? "bg-emerald-900/10"
      : status === "error"
        ? "bg-red-900/10"
        : "";
  const inputCls =
    "w-full bg-transparent text-[#ddd] outline-none border-b border-transparent focus:border-[#666] transition-colors py-0.5 placeholder:text-[#555] text-[12px]";
  const cellCls = "px-2 py-1 align-middle";

  return (
    <tr
      className={`border-b border-[#333] transition-colors hover:bg-[#252525] ${rowBg} group`}
    >
      {/* Save status indicator */}
      <td className="w-7 px-1 text-center align-middle">
        {status === "saving" && (
          <Loader2 size={11} className="animate-spin text-[#888] mx-auto" />
        )}
        {status === "saved" && (
          <Check size={11} className="text-emerald-400 mx-auto" />
        )}
        {status === "error" && (
          <span title={errorMsg} className="cursor-help block">
            <AlertTriangle size={11} className="text-amber-400 mx-auto" />
          </span>
        )}
      </td>

      {/* Thumbnail */}
      <td className="w-12 py-1 pl-1 align-middle">
        <img
          src={adminPhotoSrc(photo, 100, 60)}
          alt={photo.title || photo.filename}
          className="w-11 h-11 object-cover bg-[#2a2a2a] rounded-sm"
          style={{ objectPosition: adminPhotoObjectPosition(photo) }}
          loading="lazy"
        />
      </td>

      {/* Title */}
      <td className={cellCls}>
        <input
          aria-label="タイトル"
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
            aria-label="カメラ"
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
            title="カメラとレンズをコピー"
            aria-label="カメラとレンズをコピー"
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#777] hover:text-[#ccc] disabled:opacity-20 transition-opacity"
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            onClick={pasteRowCaptureInfo}
            title="クリップボードからカメラとレンズを貼り付け"
            aria-label="クリップボードからカメラとレンズを貼り付け"
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#777] hover:text-[#ccc] transition-opacity"
          >
            <ClipboardPaste size={11} />
          </button>
        </div>
        {clipStatus !== "idle" && (
          <span
            className={`text-[9px] ${clipStatus === "error" ? "text-amber-400/80" : "text-emerald-400/80"}`}
          >
            {captureStatusText[clipStatus]}
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
          aria-label="レンズ"
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
          aria-label="シリーズ"
          value={draft.seriesId}
          onChange={(e) => handleChange("seriesId", e.target.value)}
          className="w-full bg-[#2a2a2a] text-[#ddd] outline-none border border-transparent focus:border-[#666] transition-colors py-0.5 rounded-sm text-[11px]"
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
              className={`flex-1 text-[10px] py-0.5 rounded-sm transition-colors ${
                draft.displaySize === sz
                  ? "bg-[#888] text-[#1e1e1e] font-medium"
                  : "bg-[#333] text-[#888] hover:bg-[#3a3a3a]"
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
              ["フィルム", "フ"],
              ["デジタル", "デ"],
              ["", "—"],
            ] as const
          ).map(([val, lbl]) => (
            <button
              key={lbl}
              type="button"
              onClick={() => handleChange("filmType", val)}
              className={`flex-1 text-[10px] py-0.5 rounded-sm transition-colors ${
                draft.filmType === val
                  ? "bg-[#888] text-[#1e1e1e] font-medium"
                  : "bg-[#333] text-[#888] hover:bg-[#3a3a3a]"
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
    <div>
      <label className="block text-[10px] text-[color:var(--admin-muted)] uppercase tracking-wider mb-1">
        {label}
      </label>
      {hint && (
        <p className="text-[10px] text-[#555] mb-1.5 leading-relaxed">{hint}</p>
      )}
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
        placeholder="移動先を検索…（Library / Hero / Settings / Trash など）"
        aria-label="クイック移動"
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
      <ul className="admin-palette__list" aria-label="移動先">
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
          <li className="admin-palette__empty">見つかりません</li>
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
      className="text-[#444]"
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

function EmptySearchIllustration() {
  return (
    <svg
      viewBox="0 0 64 64"
      width={56}
      height={56}
      fill="none"
      aria-hidden="true"
      className="text-[#444]"
    >
      <rect
        x="8"
        y="10"
        width="30"
        height="30"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={0.5}
      />
      <circle cx="40" cy="40" r="12" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="48.5"
        y1="48.5"
        x2="57"
        y2="57"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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
      className="text-[#444]"
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
          className={`admin-segmented__option relative z-[1] flex-1 rounded-[var(--radius-s)] px-1.5 py-1 text-[10px] transition-colors duration-[var(--dur-fast)] ${
            value === opt.value
              ? "text-[#1e1e1e] font-medium"
              : "text-[#888] hover:text-[#bbb]"
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
    <div>
      <label className="block text-[10px] text-[color:var(--admin-muted)] uppercase tracking-wider mb-1">
        {label}
      </label>
      {hint && (
        <p className="text-[10px] text-[#555] mb-1.5 leading-relaxed">{hint}</p>
      )}
      {children}
    </div>
  );
}
