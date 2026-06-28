import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
import { makeSettingsPreviewPayload } from "../lib/settings-preview";
import { moveRelativeToViewNeighbor, moveToViewEdge } from "../lib/reorder";
import {
  GOOGLE_FONTS_JA,
  GOOGLE_FONTS_EN,
  FONT_PAIRINGS,
  type FontDef,
} from "../components/provider";
import { shotAtForUploadedPhoto } from "../lib/upload-date";
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
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  Monitor,
  Smartphone,
  Star,
  StarOff,
  Shuffle,
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
} from "lucide-react";

type Tab =
  | "setup"
  | "gallery"
  | "hero"
  | "profile"
  | "categories"
  | "series"
  | "pricing"
  | "service"
  | "settings";

const ADMIN_TAB_KEYS = new Set<Tab>([
  "setup",
  "gallery",
  "hero",
  "profile",
  "categories",
  "series",
  "pricing",
  "service",
  "settings",
]);

function isAdminTab(value: unknown): value is Tab {
  return typeof value === "string" && ADMIN_TAB_KEYS.has(value as Tab);
}

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

function usePersistentState<T>(
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
function assertOk(res: Response): void {
  if (res.status === 401) {
    if (!redirectingToLogin) {
      redirectingToLogin = true;
      window.location.assign("/admin/login");
    }
    throw new Error("セッションが切れました。再ログインしてください。");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function jsonOrThrow<T>(
  res: Response & { json(): Promise<T> },
): Promise<T> {
  assertOk(res);
  return res.json();
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
export default function AdminPage() {
  const { isLoading, authenticated } = useAdminGuard();
  const [, navigate] = useLocation();
  const [tab, setTab] = usePersistentState<Tab>(
    "admin:tab",
    "gallery",
    "local",
  );
  const [galleryUploading, setGalleryUploading] = useState(false);
  // Generic unsaved-draft flag reported by any tab with a draft form (Settings, Profile)
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [unsavedConfirm, setUnsavedConfirm] = useState<Tab | null>(null);

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

  if (isLoading)
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[#555]" />
      </div>
    );
  if (!authenticated) return null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "setup", label: "はじめに", icon: <Check size={15} /> },
    { key: "gallery", label: "Library", icon: <ImageLucide size={15} /> },
    { key: "hero", label: "Hero", icon: <Grid size={15} /> },
    { key: "profile", label: "Profile", icon: <User size={15} /> },
    { key: "categories", label: "Categories", icon: <Tag size={15} /> },
    { key: "series", label: "Series", icon: <Layers size={15} /> },
    { key: "pricing", label: "Pricing", icon: <Receipt size={15} /> },
    { key: "service", label: "Service", icon: <ExternalLink size={15} /> },
    { key: "settings", label: "Settings", icon: <Settings size={15} /> },
  ];

  return (
    <div className="h-screen bg-[#1e1e1e] text-[#d4d4d4] flex flex-col select-none overflow-hidden">
      {/* Top bar — Lightroom style dark */}
      <header className="bg-[#252525] border-b border-[#333] px-2 sm:px-4 h-11 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {tabs.map((t) => (
            <button
              key={t.key}
              disabled={galleryUploading && t.key !== "gallery"}
              onClick={() => {
                if (hasUnsaved && t.key !== tab) {
                  setUnsavedConfirm(t.key);
                  return;
                }
                setTab(t.key);
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] tracking-wide rounded-sm transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                tab === t.key
                  ? "bg-[#3a3a3a] text-[#e0e0e0]"
                  : "text-[#888] hover:text-[#bbb] hover:bg-[#2a2a2a]"
              }`}
            >
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
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
            onClick={() => logout.mutate()}
            className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
          >
            <LogOut size={11} />{" "}
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "setup" && <SetupTab onOpenTab={setTab} />}
        {tab === "gallery" && (
          <GalleryTab onUploadingChange={setGalleryUploading} />
        )}
        {tab === "hero" && <HeroTab />}
        {tab === "profile" && <ProfileTab onUnsavedChange={setHasUnsaved} />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "series" && <SeriesTab />}
        {tab === "pricing" && <PricingTab />}
        {tab === "service" && <ServiceTab onUnsavedChange={setHasUnsaved} />}
        {tab === "settings" && <SettingsTab onUnsavedChange={setHasUnsaved} />}
      </div>

      {/* Unsaved settings confirmation */}
      {unsavedConfirm && (
        <Modal onClose={() => setUnsavedConfirm(null)} widthClass="w-80">
          <p className="text-[13px] text-[#ddd] mb-1">未保存の変更があります</p>
          <p className="text-[11px] text-[#777] mb-5">
            保存せずにタブを移動しますか？
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
                setTab(unsavedConfirm);
                setUnsavedConfirm(null);
              }}
              className="px-4 py-1.5 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors"
            >
              移動する
            </button>
          </div>
        </Modal>
      )}
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
  // site (e.g. production akieguchi.com) every item is already done, so it
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

  if (collapsed) {
    return (
      <div className="h-full overflow-y-auto bg-[#1e1e1e]">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-8">
          <div className="flex items-center justify-between gap-3 border border-[#33402f] bg-[#222a20] rounded-sm px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full bg-[#5f7f68] text-[#151515] flex items-center justify-center flex-shrink-0">
                <Check size={13} />
              </div>
              <p className="text-[12px] text-[#b8d5bf] truncate">
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
              className="text-[11px] text-[#9a9a9a] hover:text-[#ddd] transition-colors flex-shrink-0"
            >
              もう一度見る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#1e1e1e]">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-8">
        <section className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#777] mb-2">
                Start
              </p>
              <h1 className="text-[22px] md:text-[26px] text-[#e5e5e5] font-normal tracking-normal">
                公開までにやること
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`w-fit rounded-sm border px-3 py-2 text-[12px] ${requiredDone ? "border-[#5f7f68] bg-[#263126] text-[#b8d5bf]" : "border-[#444] bg-[#262626] text-[#aaa]"}`}
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
                className="text-[11px] text-[#777] hover:text-[#bbb] transition-colors flex-shrink-0"
              >
                閉じる
              </button>
            </div>
          </div>
          <p className="max-w-2xl text-[13px] leading-7 text-[#9a9a9a]">
            むずかしい設定は最初だけです。見る人に公開する前に、上から順に5つを確認します。
            写真家本人は、基本的にこの管理画面を埋めれば大丈夫です。
          </p>
        </section>

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
          <div className="border border-[#333] bg-[#242424] rounded-sm p-5">
            <h2 className="text-[14px] text-[#ddd] mb-3">
              公開の裏側にあるもの
            </h2>
            <div className="space-y-3 text-[12px] leading-6 text-[#999]">
              <p>
                <span className="text-[#d0d0d0]">サイトのファイル一式</span>:
                見た目や管理画面のもとになるもの。
              </p>
              <p>
                <span className="text-[#d0d0d0]">公開場所</span>:
                サイトをインターネットで動かす場所。
              </p>
              <p>
                <span className="text-[#d0d0d0]">データの保存場所</span>:
                名前、説明文、写真一覧などを保存する場所。
              </p>
              <p>
                <span className="text-[#d0d0d0]">写真の保存場所</span>:
                アップロードした写真ファイルそのものを置く場所。
              </p>
            </div>
          </div>
          <div className="border border-[#333] bg-[#242424] rounded-sm p-5">
            <h2 className="text-[14px] text-[#ddd] mb-3">言葉の置き換え</h2>
            <div className="space-y-3 text-[12px] leading-6 text-[#999]">
              <p>
                <span className="text-[#d0d0d0]">repo</span>:
                サイトのファイル一式が入った箱。
              </p>
              <p>
                <span className="text-[#d0d0d0]">環境変数</span>:
                パスワードや接続先を書く、公開しない設定メモ。
              </p>
              <p>
                <span className="text-[#d0d0d0]">deploy</span>:
                変更したサイトをネット上に反映すること。
              </p>
              <p>
                <span className="text-[#d0d0d0]">OGP</span>:
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
    <div className="border border-[#333] bg-[#242424] rounded-sm p-4 flex gap-3">
      <div
        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? "bg-[#5f7f68] text-[#151515]" : "bg-[#333] text-[#777]"}`}
      >
        {item.done ? <Check size={13} /> : <AlertTriangle size={12} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[13px] text-[#ddd]">{item.title}</h3>
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener"
              className="text-[11px] text-[#888] hover:text-[#ddd] transition-colors flex-shrink-0"
            >
              開く
            </a>
          ) : (
            <button
              onClick={() => item.tab && onOpenTab(item.tab)}
              className="text-[11px] text-[#888] hover:text-[#ddd] transition-colors flex-shrink-0"
            >
              開く
            </button>
          )}
        </div>
        <p
          className={`${compact ? "text-[11px] leading-5" : "text-[12px] leading-6"} text-[#888] mt-1`}
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
const DEFAULT_CAMERA_PRESETS = [
  "PENTAX 67",
  "Leica M6",
  "Bronica S2",
  "Sony α1",
  "PENTAX 67II",
];
const DEFAULT_LENS_PRESETS = [
  "SMC Takumar 105mm f/2.4",
  "SMC Takumar 55mm f/1.8",
  "Nokton 50mm f/1.5",
  "FE 35mm f/1.8",
];

// Parse a settings JSON-array string into a clean string[].
function parsePresetList(raw?: string): string[] {
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
function effectivePresets(saved: string[], defaults: string[]): string[] {
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

type Photo = {
  id: number;
  url: string;
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
  | "feature"
  | "unfeature"
  | "rotate_left"
  | "rotate_right"
  | "reset_rotation"
  | "reset_focal_point";

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

function adminPhotoSrc(
  photo: { url: string; rotationDeg?: number | null },
  w: number,
  q: number,
): string {
  return srcFor(photo.url, w, q, undefined, photo.rotationDeg);
}

function adminPhotoObjectPosition(photo: {
  focalX?: number | null;
  focalY?: number | null;
}): string {
  return objectPositionFromFocal(photo.focalX, photo.focalY);
}

// adminApi is loosely typed (see lib/api.ts) — these annotate its query results.
type AdminSeries = {
  id: number;
  slug: string;
  title: string;
  subtitle?: string;
  statement?: string;
  coverPhotoId?: number | null;
  sortOrder?: number;
  isPublished?: boolean;
};
type HeroPhotoRow = { id: number; photoId: number; sortOrder: number };

// O6: smart album — a named, saved set of photo conditions (a virtual folder).
// Every field is optional; only the set ones constrain the match (AND).
type AlbumCond = {
  camera?: string;
  filmType?: string;
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
  category: "all",
  series: "all",
  size: "all",
  featured: false,
  published: "all",
  recent: "all",
};

function GalleryTab({
  onUploadingChange,
}: {
  onUploadingChange?: (v: boolean) => void;
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
  const [editForm, setEditForm] = useState({
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
  });
  const [dragSrcId, setDragSrcId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [batchCatOpen, setBatchCatOpen] = useState(false);
  const [batchSeriesOpen, setBatchSeriesOpen] = useState(false);
  const [batchToast, setBatchToast] = useState<string | null>(null);
  const [batchEditOpen, setBatchEditOpen] = useState(false); // O2: bulk metadata panel
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
  const [undoToast, setUndoToast] = useState<{
    ids: number[];
    count: number;
  } | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
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
  const libraryScrollRestoredRef = useRef(false);
  const libraryScrollSaveRafRef = useRef<number | null>(null);
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

  const { data: photosData, isLoading } = useQuery({
    queryKey: ["photos", "all"],
    queryFn: async () =>
      jsonOrThrow(await api.photos.$get({ query: { all: "1" } })),
  });
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
      if (filterOrientation !== "all" && photoOrientation(p) !== filterOrientation)
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
    filterOrientation,
    filterFeatured,
    filterPublished,
    filterMissingShotAt,
    filterMissingCapture,
    filterRecent,
    isUncategorized,
    featuredIds,
    activeAlbum,
  ]);
  const anyFilterActive =
    filterCat !== "all" ||
    searchQuery.trim() !== "" ||
    filterSeries !== "all" ||
    filterSize !== "all" ||
    filterOrientation !== "all" ||
    filterFeatured ||
    filterPublished !== "all" ||
    filterMissingShotAt ||
    filterMissingCapture ||
    filterRecent !== "all" ||
    activeAlbumId !== null;
  const clearLibraryFilters = useCallback(() => {
    setSearchQuery("");
    setFilterCat("all");
    setFilterSeries("all");
    setFilterSize("all");
    setFilterOrientation("all");
    setFilterFeatured(false);
    setFilterPublished("all");
    setFilterMissingShotAt(false);
    setFilterMissingCapture(false);
    setFilterRecent("all");
    setActiveAlbumId(null);
  }, []);

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
        id == null
          ? "￿"
          : (seriesList.find((s) => s.id === id)?.title ?? String(id));
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
    [librarySort, seriesList],
  );
  const displayed = useMemo(
    () => sortPhotosForView(filtered),
    [filtered, sortPhotosForView],
  );
  const missingShotAtCount = useMemo(
    () => allPhotos.filter((p) => !p.shotAt).length,
    [allPhotos],
  );
  const missingCaptureCount = useMemo(
    () => allPhotos.filter((p) => !p.camera && !p.lens).length,
    [allPhotos],
  );
  const unpublishedCount = useMemo(
    () => allPhotos.filter((p) => p.isPublished === false).length,
    [allPhotos],
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
      }
      const count = (data as { count?: number })?.count ?? selected.size;
      setBatchToast(`${count}枚を更新しました`);
      setTimeout(() => setBatchToast(null), 2000);
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
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const skipped = files.length - imageFiles.length;
    if (!imageFiles.length) {
      setUploadNotice(
        skipped > 0
          ? `画像ファイルではないため ${skipped} 件をスキップしました`
          : null,
      );
      return;
    }
    setUploadNotice(null);
    setRetryFiles([]);
    setUploadingAndNotify(true);
    setUploadProgress({ done: 0, total: imageFiles.length });
    const failed: File[] = [];
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
        const shotAtVal = shotAtForUploadedPhoto(
          shotAt,
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
      } catch {
        failed.push(file);
      } finally {
        done += 1;
        setUploadProgress({ done, total: imageFiles.length });
      }
    };

    try {
      // Limited concurrency — faster than serial without overwhelming the server
      const queue = [...imageFiles];
      const CONCURRENCY = Math.min(3, queue.length);
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
      setRetryFiles(failed);
      const parts: string[] = [];
      if (failed.length)
        parts.push(
          `${failed.length} 件失敗: ${failed
            .slice(0, 3)
            .map((f) => f.name)
            .join(", ")}${failed.length > 3 ? " ほか" : ""}`,
        );
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
    setEditForm({
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
    });
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
    requestAnimationFrame(() =>
      document
        .getElementById(`admin-photo-${photo.id}`)
        ?.scrollIntoView({ block: "nearest" }),
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
            label: `${selected.size}枚の写真を削除しますか？`,
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
        {/* Toolbar — Lr style */}
        <div className="bg-[#2a2a2a] border-b border-[#333] px-2 sm:px-4 py-2 flex items-center gap-2 sm:gap-4 flex-wrap flex-shrink-0">
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
              placeholder="検索（タイトル・機材・フィルム・ファイル名）"
              aria-label="写真を検索"
              className="bg-[#333] text-[#ccc] text-[11px] pl-6 pr-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888] transition-colors w-44 placeholder:text-[#555]"
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
              <option value="createdAt-desc">アップロード日（新しい順）</option>
              <option value="createdAt-asc">アップロード日（古い順）</option>
              <option value="shotAt-desc">撮影日（新しい順）</option>
              <option value="shotAt-asc">撮影日（古い順）</option>
              <option value="series">シリーズ</option>
              <option value="size">表示サイズ（S→L）</option>
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

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#777] uppercase tracking-wider">
              Filter
            </span>
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
            {/* M3: Series filter */}
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
                未割り当て ({allPhotos.filter((p) => p.seriesId == null).length}
                )
              </option>
            </select>
            {/* M3: Size filter */}
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
              value={filterOrientation}
              onChange={(e) => setFilterOrientation(e.target.value)}
              aria-label="写真の向きで絞り込み"
              className="bg-[#333] text-[#ccc] text-[11px] px-2 py-1 rounded-sm border border-[#444] outline-none focus:border-[#888]"
            >
              <option value="all">All orientations</option>
              <option value="portrait">縦写真 ({orientationCounts.portrait})</option>
              <option value="landscape">
                横写真 ({orientationCounts.landscape})
              </option>
              <option value="square">正方形 ({orientationCounts.square})</option>
            </select>
            {/* M3: Featured filter */}
            <button
              onClick={() => setFilterFeatured((v) => !v)}
              aria-pressed={filterFeatured}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm border transition-colors ${
                filterFeatured
                  ? "bg-amber-900/40 text-amber-300 border-amber-700/50"
                  : "bg-[#333] text-[#999] border-[#444] hover:bg-[#3a3a3a]"
              }`}
            >
              <Star size={11} /> Featured ({featuredIds.size})
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
              <option value="unpublished">非公開のみ ({unpublishedCount})</option>
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
              日付なし ({missingShotAtCount})
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
            {/* O4: recently uploaded */}
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

          {/* O6: smart albums — saved condition sets (virtual folders) */}
          {!showTrash && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <FolderOpen size={12} className="text-[#666]" />
              {smartAlbums.map((a) => (
                <span
                  key={a.id}
                  className={`group/al inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-1 rounded-sm border transition-colors ${
                    activeAlbumId === a.id
                      ? "bg-[#4a4a4a] text-[#eee] border-[#666]"
                      : "bg-[#333] text-[#aaa] border-[#444] hover:bg-[#3a3a3a]"
                  }`}
                >
                  <button
                    onClick={() =>
                      setActiveAlbumId((id) => (id === a.id ? null : a.id))
                    }
                    className="flex items-center"
                  >
                    {a.name}
                  </button>
                  <button
                    onClick={() => {
                      const next = smartAlbums.filter((x) => x.id !== a.id);
                      if (activeAlbumId === a.id) setActiveAlbumId(null);
                      saveAlbums.mutate(next);
                    }}
                    aria-label={`${a.name}を削除`}
                    className="opacity-50 group-hover/al:opacity-100 text-[#888] hover:text-red-400 transition-all"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
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
          )}

          <div className="h-4 w-px bg-[#444] hidden md:block" />

          {/* Thumb size slider — hidden on mobile (no precise drag) */}
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

          <div className="h-4 w-px bg-[#444] hidden md:block" />

          {/* Count */}
          <span className="text-[11px] text-[#777]">
            {displayed.length} photos
            {selected.size > 0 && (
              <span className="text-[#aaa]"> · {selected.size} selected</span>
            )}
          </span>

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

          <div className="flex-1" />

          {/* Batch actions */}
          {selected.size > 1 && !showTrash && (
            <div className="flex items-center gap-2">
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

              {/* M2: Feature / unfeature (hero) */}
              <button
                onClick={() => batchOp.mutate({ operation: "feature" })}
                disabled={batchOp.isPending}
                className="flex items-center gap-1 text-[11px] text-amber-300/80 bg-[#333] px-2.5 py-1 rounded-sm hover:bg-[#3a3a3a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Star size={11} /> Feature
              </button>
              <button
                onClick={() => batchOp.mutate({ operation: "unfeature" })}
                disabled={batchOp.isPending}
                className="flex items-center gap-1 text-[11px] text-[#999] bg-[#333] px-2.5 py-1 rounded-sm hover:bg-[#3a3a3a] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <StarOff size={11} /> Unfeature
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
                    label: `${selected.size}枚を削除しますか？`,
                  })
                }
                className="flex items-center gap-1 text-[11px] text-red-400/70 bg-[#333] px-2.5 py-1 rounded-sm hover:bg-red-900/30 transition-colors"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          )}

          {/* 機能5: アップロード前のフィルム/デジタル選択 */}
          <div className="flex items-center gap-1">
            {[["digital", "Digital"] as const, ["film", "Film"] as const].map(
              ([val, lbl]) => (
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
              ),
            )}
          </div>

          {/* Upload button */}
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
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
          />
        </div>

        {/* Upload progress bar */}
        {uploading && uploadProgress && (
          <div className="bg-[#252525] px-4 py-2 border-b border-[#333] flex items-center gap-3">
            <Loader2 size={12} className="animate-spin text-[#888]" />
            <span className="text-[11px] text-[#888]">
              Importing {uploadProgress.done} / {uploadProgress.total}
            </span>
            <div className="flex-1 h-1 bg-[#333] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#888] transition-all duration-300 rounded-full"
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
          onScroll={(e) => rememberLibraryScroll(e.currentTarget)}
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
                <Trash2 size={40} strokeWidth={1} className="text-[#333]" />
                <p className="text-sm">ゴミ箱は空です</p>
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
                  className="grid gap-[3px]"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`,
                  }}
                >
                  {(trashData?.photos ?? []).map((photo) => {
                    // Days until lazy auto-purge — lets 秋 triage what to rescue first.
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
              <ImageLucide size={40} strokeWidth={1} className="text-[#444]" />
              <p className="text-sm">No photos</p>
              <p className="text-[11px] text-[#444]">
                Drop images here or click Import
              </p>
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
                className="grid gap-[3px]"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`,
                }}
              >
                {displayed.map((photo, idx) => {
                  const isSelected = selected.has(photo.id);
                  const isInspect = inspectPhoto?.id === photo.id;
                  const catColor = catColors[photo.category] ?? "#666";
                  const isUnpublished = photo.isPublished === false;
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
                      className={`relative group transition-all ${
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
                      {/* Selection check */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#aaa] rounded-sm flex items-center justify-center">
                          <Check size={10} className="text-[#1e1e1e]" />
                        </div>
                      )}
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
            </>
          )}
        </div>
      </div>

      {/* M2: batch-operation result toast */}
      {batchToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-800/70 border border-emerald-700/60 text-emerald-50 text-[12px] px-4 py-2.5 rounded-sm shadow-xl">
          <Check size={13} /> <span>{batchToast}</span>
        </div>
      )}

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
              Cancel
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
              Cancel
            </button>
            <button
              onClick={() => {
                const cond: AlbumCond = {};
                if (albumDraft.camera.trim())
                  cond.camera = albumDraft.camera.trim();
                if (albumDraft.filmType) cond.filmType = albumDraft.filmType;
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
      {actionError && (
        <div
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
        </div>
      )}

      {/* Undo toast (B3) */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#333] border border-[#444] text-[#ddd] text-[12px] px-4 py-2.5 rounded-sm shadow-xl">
          <span>{undoToast.count}枚削除しました</span>
          <button
            onClick={() => restorePhotos.mutate(undoToast.ids)}
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
        </div>
      )}

      {/* Upload result notice (failures / skipped files) */}
      {uploadNotice && (
        <div
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
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)}>
          <p className="text-[13px] text-[#ddd] mb-4">{deleteConfirm.label}</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-1.5 text-[11px] text-[#888] hover:text-[#ccc] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deletePhotos.mutate(deleteConfirm.ids);
                setDeleteConfirm(null);
              }}
              className="px-4 py-1.5 text-[11px] bg-red-600/70 text-white rounded-sm hover:bg-red-600/90 transition-colors"
            >
              Delete
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

          {/* Metadata form */}
          <div className="px-3 pb-4 flex flex-col gap-3 flex-1">
            <div className="border-b border-[#333] pb-2 mb-1">
              <span className="text-[10px] text-[#666] uppercase tracking-wider">
                Metadata
              </span>
            </div>

            {/* M4: status badges — at-a-glance featured / series / category state */}
            {(() => {
              const featured = featuredIds.has(inspectPhoto.id);
              const seriesName = inspectPhoto.seriesId
                ? seriesList.find((s) => s.id === inspectPhoto.seriesId)?.title
                : null;
              const catLabel = categories.find(
                (c) => c.slug === inspectPhoto.category,
              )?.label;
              return (
                <div className="flex flex-wrap gap-1.5">
                  {inspectPhoto.isPublished === false && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#3a2a2a] text-[#d99] border border-[#5a3a3a]">
                      <EyeOff size={9} /> 非公開
                    </span>
                  )}
                  {featured && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/40">
                      <Star size={9} /> フィーチャー
                    </span>
                  )}
                  {seriesName && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#333] text-[#bbb] border border-[#444]">
                      <Layers size={9} /> {seriesName}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#333] text-[#bbb] border border-[#444]">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: catLabel
                          ? (catColors[inspectPhoto.category] ?? "#888")
                          : "transparent",
                        border: catLabel ? "none" : "1px solid #666",
                      }}
                    />
                    {catLabel ?? "未分類"}
                  </span>
                </div>
              );
            })()}

            <InspectField
              label="向き"
              hint="保存後、Gallery / Hero / Lightbox の表示に反映"
            >
              <div className="flex items-center gap-1">
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
                  className="w-8 h-8 flex items-center justify-center bg-[#333] text-[#aaa] border border-[#444] rounded-sm hover:bg-[#3a3a3a] hover:text-[#ddd] transition-colors"
                >
                  <RotateCcw size={14} />
                </button>
                <div className="grid grid-cols-4 gap-1 flex-1">
                  {ROTATION_OPTIONS.map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() =>
                        setEditForm((f) => ({ ...f, rotationDeg: deg }))
                      }
                      aria-pressed={editForm.rotationDeg === deg}
                      className={`h-8 text-[11px] rounded-sm transition-colors ${
                        editForm.rotationDeg === deg
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
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
                  className="w-8 h-8 flex items-center justify-center bg-[#333] text-[#aaa] border border-[#444] rounded-sm hover:bg-[#3a3a3a] hover:text-[#ddd] transition-colors"
                >
                  <RotateCw size={14} />
                </button>
              </div>
            </InspectField>

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

            <InspectField label="Category" hint="ギャラリーのフィルタ分類">
              <select
                value={
                  categories.some((c) => c.slug === editForm.category)
                    ? editForm.category
                    : ""
                }
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, category: e.target.value }))
                }
                className="w-full bg-[#333] text-[#ddd] text-[12px] px-2 py-1.5 rounded-sm border border-[#444] outline-none focus:border-[#888] transition-colors"
              >
                <option value="">— uncategorized —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </InspectField>

            <InspectField
              label="Series"
              hint="作品群への割り当て（任意）。分類とは別軸。先頭を選ぶと割り当て解除"
            >
              <select
                value={
                  seriesList.some((s) => s.id === Number(editForm.seriesId))
                    ? editForm.seriesId
                    : ""
                }
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, seriesId: e.target.value }))
                }
                className="w-full bg-[#333] text-[#ddd] text-[12px] px-2 py-1.5 rounded-sm border border-[#444] outline-none focus:border-[#888] transition-colors"
              >
                <option value="">— シリーズなし（割り当て解除）—</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                    {s.isPublished ? "" : "（下書き）"}
                  </option>
                ))}
              </select>
            </InspectField>

            <InspectField
              label="Display Size"
              hint="ギャラリーグリッドでの表示サイズ"
            >
              <div className="flex gap-1">
                {(["S", "M", "L"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() =>
                      setEditForm((f) => ({ ...f, displaySize: size }))
                    }
                    className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                      editForm.displaySize === size
                        ? "bg-[#888] text-[#1e1e1e] font-medium"
                        : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </InspectField>

            <InspectField
              label="公開状態"
              hint="非公開にするとサイトに表示されません（管理画面には残ります）"
            >
              <div className="flex gap-1">
                {(
                  [
                    [true, "公開"],
                    [false, "非公開"],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={lbl}
                    onClick={() =>
                      setEditForm((f) => ({ ...f, isPublished: val }))
                    }
                    className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                      editForm.isPublished === val
                        ? "bg-[#888] text-[#1e1e1e] font-medium"
                        : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </InspectField>

            <div className="flex gap-2 mt-1">
              <button
                disabled={updatePhoto.isPending}
                onClick={() => {
                  setMetaSaved(false);
                  setMetaError(false);
                  // 撮影日は date 入力（日付まで）。未変更ならEXIF由来の時刻部分を保持する。
                  const shotAtToSave =
                    editForm.shotAt === (inspectPhoto.shotAt || "").slice(0, 10)
                      ? inspectPhoto.shotAt || ""
                      : editForm.shotAt;
                  updatePhoto.mutate(
                    { id: inspectPhoto.id, ...editForm, shotAt: shotAtToSave },
                    {
                      // Update the local inspect view only once the server confirms
                      onSuccess: () => {
                        // editForm.seriesId is a string ("" = none); store it back as number|null
                        setInspectPhoto({
                          ...inspectPhoto,
                          ...editForm,
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
                  setEditForm({
                    title: inspectPhoto.title,
                    camera: inspectPhoto.camera || "",
                    lens: inspectPhoto.lens || "",
                    filmType: inspectPhoto.filmType || "",
                    shotAt: (inspectPhoto.shotAt || "").slice(0, 10),
                    description: inspectPhoto.description || "",
                    category: inspectPhoto.category,
                    displaySize: inspectPhoto.displaySize || "M",
                    seriesId: inspectPhoto.seriesId
                      ? String(inspectPhoto.seriesId)
                      : "",
                    isPublished: inspectPhoto.isPublished !== false,
                    rotationDeg: normalizeRotationDeg(inspectPhoto.rotationDeg),
                    focalX: inspectPhoto.focalX ?? 50,
                    focalY: inspectPhoto.focalY ?? 50,
                  });
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
                    label: "Delete this photo?",
                  })
                }
                className="w-full flex items-center justify-center gap-1.5 text-[11px] text-red-400/60 bg-[#333] py-2 rounded-sm hover:bg-red-900/20 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} /> Delete Photo
              </button>
            </div>
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
        <ImageLucide size={40} strokeWidth={1} className="text-[#444]" />
        <p className="text-sm">No photos</p>
        <p className="text-[11px] text-[#444]">
          フィルターを変更するか、写真をインポートしてください
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
      <label className="block text-[10px] text-[#777] uppercase tracking-wider mb-1">
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
function HeroTab() {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [heroError, setHeroError] = useState("");

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

  const onHeroError = () =>
    setHeroError(
      "操作に失敗しました。通信状況を確認するか、再ログインしてください。",
    );

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
    mutationFn: async (photoIds: number[]) => {
      const res = await adminApi["hero-photos"].reorder.$post({
        json: { photoIds },
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

  const handleDrop = (targetId: number) => {
    if (dragId == null || dragId === targetId) return;
    const ids = heroPhotos.map((p) => p.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId);
    reorderHero.mutate(ids);
    setDragId(null);
    setDragOverId(null);
  };

  // Move a hero slide by ±1 (touch-friendly alternative to drag)
  const moveHero = (id: number, delta: number) => {
    const ids = heroPhotos.map((p) => p.id);
    const idx = ids.indexOf(id);
    const to = idx + delta;
    if (idx < 0 || to < 0 || to >= ids.length) return;
    ids.splice(idx, 1);
    ids.splice(to, 0, id);
    reorderHero.mutate(ids);
  };

  if (photosLoading || heroLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-[#555] text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-4xl mx-auto">
      {heroError && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 text-[11px] text-red-300 bg-red-900/25 border border-red-900/40 rounded-sm px-3 py-2"
        >
          <span>{heroError}</span>
          <button
            onClick={() => setHeroError("")}
            aria-label="閉じる"
            className="text-red-300/60 hover:text-red-200 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {/* Dangling selections — photos that were trashed/purged after being picked */}
      {danglingHeroIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 text-[11px] text-amber-200/90 bg-amber-900/20 border border-amber-900/40 rounded-sm px-3 py-2">
          <span>
            {danglingHeroIds.length}{" "}
            件のヒーロー選択が削除済み（ゴミ箱内含む）の写真を参照しています。公開サイトには表示されず、ゴミ箱から復元すると突然ヒーローに再表示されます。
          </span>
          <button
            onClick={() => cleanupDangling.mutate()}
            disabled={cleanupDangling.isPending}
            className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-sm bg-amber-900/40 hover:bg-amber-900/60 transition-colors disabled:opacity-50"
          >
            {cleanupDangling.isPending ? "整理中..." : "選択から外す"}
          </button>
        </div>
      )}
      {/* Selected Hero Photos */}
      <div className="mb-8">
        <h2 className="text-[11px] tracking-widest uppercase text-[#666] mb-1">
          Hero Slides
        </h2>
        <p className="text-[10px] text-[#444] mb-4">
          トップページのカルーセルに表示する写真。ドラッグで並び替え。未選択の場合はギャラリーの先頭から自動表示。
        </p>
        {heroPhotos.length === 0 ? (
          <div className="border border-dashed border-[#333] rounded-sm p-8 text-center">
            <Star size={18} className="mx-auto text-[#444] mb-2" />
            <p className="text-[12px] text-[#555]">ヒーロー写真が未設定です</p>
            <p className="text-[10px] text-[#444] mt-1">
              下のギャラリーから写真を選んでください
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {heroPhotos.map((photo, i) => (
              <div
                key={photo.id}
                draggable
                onDragStart={() => setDragId(photo.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(photo.id);
                }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={() => handleDrop(photo.id)}
                className={`group relative rounded-sm overflow-hidden cursor-grab active:cursor-grabbing border-2 transition-colors ${
                  dragOverId === photo.id
                    ? "border-white/40"
                    : "border-transparent"
                }`}
              >
                <img
                  src={adminPhotoSrc(photo, 400, 75)}
                  alt={photo.title}
                  className="w-full aspect-[4/3] object-cover"
                  style={{ objectPosition: adminPhotoObjectPosition(photo) }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors">
                  <span className="absolute top-1 left-1 text-[9px] text-white/70 bg-black/50 px-1.5 py-0.5 rounded">
                    {i + 1}
                  </span>
                  {/* Controls — always visible on mobile (no hover), hover-reveal on desktop */}
                  <div className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveHero(photo.id, -1)}
                      disabled={i === 0}
                      aria-label="前へ移動"
                      className="w-7 h-7 flex items-center justify-center bg-black/60 text-white/90 rounded-sm hover:bg-black/80 disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => removeHero.mutate(photo.id)}
                      disabled={removeHero.isPending}
                      aria-label="ヒーローから削除"
                      className="w-7 h-7 flex items-center justify-center bg-red-500/80 text-white rounded-sm hover:bg-red-500 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <X size={13} />
                    </button>
                    <button
                      onClick={() => moveHero(photo.id, 1)}
                      disabled={i === heroPhotos.length - 1}
                      aria-label="後へ移動"
                      className="w-7 h-7 flex items-center justify-center bg-black/60 text-white/90 rounded-sm hover:bg-black/80 disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gallery: Pick photos */}
      <div>
        <h2 className="text-[11px] tracking-widest uppercase text-[#666] mb-1">
          Gallery
        </h2>
        <p className="text-[10px] text-[#444] mb-4">
          クリックでヒーローに追加 / 解除
        </p>
        {allPhotos.length === 0 ? (
          <p className="text-[12px] text-[#555] text-center py-8">
            ギャラリーに写真がありません
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
                  aria-label={`${photo.title || photo.filename || "写真"} をヒーローから${isHero ? "外す" : "追加"}`}
                  className={`relative rounded-sm overflow-hidden cursor-pointer group border-2 transition-colors disabled:opacity-50 disabled:pointer-events-none ${
                    isHero
                      ? "border-amber-400/70"
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
                        className="text-amber-400 fill-amber-400"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PROFILE TAB — with profile photo upload
══════════════════════════════════════════════════ */
function ProfileTab({
  onUnsavedChange,
}: {
  onUnsavedChange?: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });

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
  const hasUnsaved = Object.keys(form).length > 0;
  useEffect(() => {
    onUnsavedChange?.(hasUnsaved);
  }, [hasUnsaved, onUnsavedChange]);
  useEffect(() => () => onUnsavedChange?.(false), [onUnsavedChange]);
  // Warn on browser close/reload with unsaved changes
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await adminApi.settings.$post({ json: form });
      assertOk(res);
    },
    onSuccess: () => {
      setSaveError(false);
      qc.setQueryData(
        ["settings"],
        (old: Record<string, string> | undefined) => ({ ...old, ...form }),
      );
      setForm({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => setSaveError(true),
  });

  const saveSettings = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      const res = await adminApi.settings.$post({ json: body });
      assertOk(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleProfilePhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setPhotoError("画像ファイルを選択してください");
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
      assertOk(res);
      const { url } = await res.json();
      if (!url) throw new Error("no url");
      await saveSettings.mutateAsync({ profilePhotoUrl: url });
    } catch {
      setPhotoError("プロフィール写真のアップロードに失敗しました");
    } finally {
      setPhotoUploading(false);
    }
  };

  const set = (key: string, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full gap-2 text-[#555] text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading...
      </div>
    );

  const fields = [
    {
      key: "profileName",
      label: "Name (JP)",
      placeholder: "Photographer Name",
    },
    {
      key: "profileNameKata",
      label: "振り仮名 (カタカナ)",
      placeholder: "エグチアキ",
    },
    {
      key: "profileNameEn",
      label: "Name (EN)",
      placeholder: "Photographer Name",
    },
    {
      key: "profileBio",
      label: "Bio",
      multiline: true,
      placeholder: "Write your bio...",
    },
    {
      key: "profileStatement",
      label: "Statement (作家ステートメント)",
      multiline: true,
      placeholder: "空欄でも崩れません。後から追記OK",
    },
    {
      key: "profileGear",
      label: "使用機材 (1行に1つ)",
      multiline: true,
      placeholder: "PENTAX 67\nLeica M6\n...",
    },
    {
      key: "profileInstagram",
      label: "Instagram",
      placeholder: "https://instagram.com/...",
    },
    {
      key: "profileTwitter",
      label: "X URL",
      placeholder: "https://twitter.com/...",
    },
    {
      key: "profileNote",
      label: "note URL",
      placeholder: "https://note.com/...",
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-8 max-w-lg mx-auto">
      <h2 className="text-[11px] tracking-widest uppercase text-[#666] mb-6">
        Profile
      </h2>

      {/* Profile Photo Upload */}
      <div className="mb-8">
        <p className="text-[10px] text-[#777] uppercase tracking-wider mb-3">
          Profile Photo (About page)
        </p>
        <div className="flex items-start gap-4">
          {data?.profilePhotoUrl ? (
            <img
              src={`${data.profilePhotoUrl}?w=300&q=80`}
              alt="Profile"
              className="w-28 h-36 object-cover border border-[#333] rounded-sm"
            />
          ) : (
            <div className="w-28 h-36 bg-[#2a2a2a] border border-[#333] rounded-sm flex items-center justify-center">
              <User size={20} className="text-[#444]" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className={`border border-dashed rounded-sm px-4 py-3 text-center transition-all w-full ${
                photoUploading
                  ? "border-[#555] cursor-default"
                  : "border-[#333] hover:border-[#555] cursor-pointer"
              }`}
            >
              {photoUploading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 size={12} className="animate-spin text-[#888]" />
                  <span className="text-[11px] text-[#666]">Uploading...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Upload size={12} className="text-[#555]" />
                  <span className="text-[11px] text-[#666]">Upload photo</span>
                </div>
              )}
            </button>
            <input
              aria-label="プロフィール写真を選択"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleProfilePhoto(f);
              }}
            />
            <p className="text-[10px] text-[#444]">3:4 portrait recommended</p>
            {photoError && (
              <p className="text-[10px] text-red-400/80">{photoError}</p>
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
                className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors resize-y rounded-sm placeholder:text-[#555]"
              />
            ) : (
              <input
                type="text"
                aria-label={f.label}
                value={current[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
              />
            )}
          </AdminField>
        ))}
        <div className="flex items-center gap-3">
          <SaveButton
            onClick={() => save.mutate()}
            disabled={save.isPending || Object.keys(form).length === 0}
            saved={saved}
            pending={save.isPending}
          />
          {saveError && (
            <span className="text-[11px] text-red-400/80">
              保存に失敗しました
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   CATEGORIES TAB
══════════════════════════════════════════════════ */
function CategoriesTab() {
  const qc = useQueryClient();
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
      setCatError(
        "追加に失敗しました。スラッグが重複していないか確認してください。",
      ),
  });

  const handleAddCat = () => {
    const slug = newSlug.trim();
    if (RESERVED_SLUGS.includes(slug)) {
      setCatError(`"${slug}" は予約語のため使用できません。`);
      return;
    }
    if (categories.some((c) => c.slug === slug)) {
      setCatError(`スラッグ "${slug}" は既に存在します。`);
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
    onError: () => setCatError("削除に失敗しました。"),
  });

  // Reorder controls the gallery filter order. Optimistically reorder the cache so
  // the move feels instant, then persist.
  const reorderCats = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await adminApi.categories.reorder.$post({ json: { ids } });
      assertOk(res);
    },
    onSuccess: () => {
      setReorderError("");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    // Revert the optimistic reorder and surface the failure instead of leaving the
    // UI showing an order that wasn't saved.
    onError: () => {
      setReorderError("並び替えの保存に失敗しました。");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const moveCat = (id: number, delta: number) => {
    const ids = categories.map((c) => c.id);
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
    reorderCats.mutate(ids);
  };

  return (
    <div className="h-full overflow-y-auto p-8 max-w-md mx-auto">
      <h2 className="text-[11px] tracking-widest uppercase text-[#666] mb-2">
        Categories
      </h2>
      <p className="text-[11px] text-[#555] mb-6">
        ギャラリーのフィルターとして使用。↑↓で並び替え（この順で表示されます）。
      </p>

      {reorderError && (
        <p role="alert" className="text-[11px] text-red-400/80 mb-3">
          {reorderError}
        </p>
      )}

      <div className="flex flex-col gap-1 mb-8">
        {categories.length === 0 && !catsLoading && (
          <p className="text-sm text-[#555] py-4 text-center">
            No categories yet
          </p>
        )}
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className="flex items-center justify-between bg-[#2a2a2a] border border-[#333] px-3 py-2.5 rounded-sm group"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="flex flex-col flex-shrink-0">
                <button
                  onClick={() => moveCat(cat.id, -1)}
                  disabled={i === 0 || reorderCats.isPending}
                  aria-label="上へ移動"
                  className="text-[#555] hover:text-[#aaa] disabled:opacity-20 disabled:hover:text-[#555] transition-colors leading-none"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  onClick={() => moveCat(cat.id, 1)}
                  disabled={
                    i === categories.length - 1 || reorderCats.isPending
                  }
                  aria-label="下へ移動"
                  className="text-[#555] hover:text-[#aaa] disabled:opacity-20 disabled:hover:text-[#555] transition-colors leading-none"
                >
                  <ChevronDown size={13} />
                </button>
              </div>
              <span className="text-[12px] text-[#ccc] truncate">
                {cat.label}
              </span>
              <span className="text-[11px] text-[#555] font-mono truncate">
                {cat.slug}
              </span>
            </div>
            <button
              onClick={() =>
                setDeleteCatConfirm({ id: cat.id, label: cat.label })
              }
              aria-label={`${cat.label} を削除`}
              className="text-[#444] hover:text-red-400/80 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0 ml-2"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-[#333] pt-5">
        <p className="text-[11px] tracking-wider uppercase text-[#555] mb-4">
          New Category
        </p>
        <div className="flex flex-col gap-3">
          <AdminField label="Label">
            <input
              aria-label="カテゴリ名"
              value={newLabel}
              onChange={(e) => {
                setNewLabel(e.target.value);
                setCatError("");
              }}
              placeholder="e.g. Street"
              className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
            />
          </AdminField>
          <AdminField label="Slug">
            <input
              aria-label="スラッグ"
              value={newSlug}
              onChange={(e) => {
                setNewSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                );
                setCatError("");
              }}
              placeholder="e.g. street"
              className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm font-mono placeholder:text-[#555]"
            />
          </AdminField>
          {catError && (
            <p className="text-[11px] text-red-400/80">{catError}</p>
          )}
          <button
            onClick={handleAddCat}
            disabled={!newSlug || !newLabel || addCat.isPending}
            className="flex items-center gap-1.5 self-start px-4 py-2 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors disabled:opacity-40"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteCatConfirm && (
        <Modal onClose={() => setDeleteCatConfirm(null)}>
          <p className="text-[13px] text-[#ddd] mb-4">
            Delete "{deleteCatConfirm.label}"?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDeleteCatConfirm(null)}
              className="px-4 py-1.5 text-[11px] text-[#888] hover:text-[#ccc] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deleteCat.mutate(deleteCatConfirm.id);
                setDeleteCatConfirm(null);
              }}
              className="px-4 py-1.5 text-[11px] bg-red-600/70 text-white rounded-sm hover:bg-red-600/90 transition-colors"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
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

function SeriesTab() {
  const qc = useQueryClient();
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

  const { data: photosData } = useQuery({
    queryKey: ["photos", "all"],
    queryFn: async () =>
      jsonOrThrow(await api.photos.$get({ query: { all: "1" } })),
  });
  const photos = photosData?.photos ?? [];
  const photoLabel = (id: number | null) => {
    if (!id) return "";
    const p = photos.find((x) => x.id === id);
    return p ? p.title || p.filename : `#${id}`;
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
      setAddError(
        "追加に失敗しました。スラッグが重複していないか確認してください。",
      ),
  });
  const handleAdd = () => {
    const slug = newSlug.trim();
    if (!slug || !newTitle.trim()) return;
    if (series.some((s) => s.slug === slug)) {
      setAddError(`スラッグ "${slug}" は既に存在します。`);
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
    onError: () => setRowError("保存に失敗しました。"),
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
    onError: () => setRowError("削除に失敗しました。"),
  });

  const reorder = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await adminApi.series.reorder.$post({ json: { ids } });
      assertOk(res);
    },
    onSuccess: () => {
      setRowError("");
      qc.invalidateQueries({ queryKey: ["admin-series"] });
      qc.invalidateQueries({ queryKey: ["series"] });
    },
    onError: () => {
      setRowError("並び替えの保存に失敗しました。");
      qc.invalidateQueries({ queryKey: ["admin-series"] });
    },
  });
  const move = (id: number, delta: number) => {
    const ids = series.map((s) => s.id);
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
    reorder.mutate(ids);
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
    <div className="h-full overflow-y-auto p-8 max-w-lg mx-auto">
      <h2 className="text-[11px] tracking-widest uppercase text-[#666] mb-2">
        Series
      </h2>
      <p className="text-[11px] text-[#555] mb-6">
        作品群（"Still, life"
        のようなまとまり）。↑↓で並び替え。公開トグルで下書き/公開。写真の割り当ては
        Library のインスペクタ「Series」から。シリーズ内の写真の並び替えは
        Library でそのシリーズに絞り込んでドラッグ。
      </p>

      {rowError && (
        <p role="alert" className="text-[11px] text-red-400/80 mb-3">
          {rowError}
        </p>
      )}

      <div className="flex flex-col gap-2 mb-8">
        {series.length === 0 && !isLoading && (
          <p className="text-sm text-[#555] py-4 text-center">No series yet</p>
        )}
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
            <div
              key={s.id}
              className="bg-[#2a2a2a] border border-[#333] rounded-sm overflow-hidden"
            >
              {cover && (
                <img
                  src={adminPhotoSrc(cover, 600, 80)}
                  alt={s.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-28 object-cover border-b border-[#333]"
                  style={{ objectPosition: adminPhotoObjectPosition(cover) }}
                />
              )}
              <div className="flex items-center justify-between px-3 py-2.5 group">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="flex flex-col flex-shrink-0">
                    <button
                      onClick={() => move(s.id, -1)}
                      disabled={i === 0 || reorder.isPending}
                      aria-label="上へ移動"
                      className="text-[#555] hover:text-[#aaa] disabled:opacity-20 disabled:hover:text-[#555] transition-colors leading-none"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      onClick={() => move(s.id, 1)}
                      disabled={i === series.length - 1 || reorder.isPending}
                      aria-label="下へ移動"
                      className="text-[#555] hover:text-[#aaa] disabled:opacity-20 disabled:hover:text-[#555] transition-colors leading-none"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#ccc] truncate">
                        {s.title}
                      </span>
                      <span className="text-[11px] text-[#555] font-mono truncate">
                        {s.slug}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#555]">
                      {count} 枚
                      {s.coverPhotoId
                        ? ` ・ 表紙: ${photoLabel(s.coverPhotoId)}`
                        : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <button
                    onClick={() =>
                      patchSeries.mutate({
                        id: s.id,
                        isPublished: !s.isPublished,
                      })
                    }
                    aria-pressed={s.isPublished}
                    className={`text-[10px] px-2 py-1 rounded-sm transition-colors ${s.isPublished ? "bg-emerald-700/40 text-emerald-300/90" : "bg-[#333] text-[#777] hover:bg-[#3a3a3a]"}`}
                  >
                    {s.isPublished ? "公開" : "下書き"}
                  </button>
                  <button
                    onClick={() =>
                      editId === s.id ? setEditId(null) : openEdit(s)
                    }
                    aria-label="編集"
                    className="text-[#555] hover:text-[#bbb] transition-colors"
                  >
                    {editId === s.id ? (
                      <ChevronUp size={14} />
                    ) : (
                      <Pencil size={13} />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      setDeleteTarget({ id: s.id, title: s.title })
                    }
                    aria-label={`${s.title} を削除`}
                    className="text-[#444] hover:text-red-400/80 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Inline editor */}
              {editId === s.id && (
                <div className="border-t border-[#333] px-3 py-3 flex flex-col gap-3">
                  <AdminField label="Title">
                    <input
                      aria-label="シリーズのタイトル"
                      value={draft.title}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, title: e.target.value }))
                      }
                      placeholder="Still, life"
                      className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                    />
                  </AdminField>
                  <AdminField label="Slug" hint="URL（/series/◯◯）に使用">
                    <input
                      aria-label="シリーズのスラッグ"
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
                      className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm font-mono placeholder:text-[#555]"
                    />
                  </AdminField>
                  <AdminField label="Subtitle" hint="任意のサブタイトル">
                    <input
                      aria-label="サブタイトル"
                      value={draft.subtitle}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, subtitle: e.target.value }))
                      }
                      placeholder="2023–2024"
                      className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                    />
                  </AdminField>
                  <AdminField
                    label="Statement"
                    hint="シリーズのコンセプト文（改行可）"
                  >
                    <textarea
                      aria-label="ステートメント"
                      rows={4}
                      value={draft.statement}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, statement: e.target.value }))
                      }
                      placeholder="このシリーズについて…"
                      className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm resize-y placeholder:text-[#555]"
                    />
                  </AdminField>
                  <AdminField
                    label="Cover Photo"
                    hint="シリーズ一覧の表紙。未設定ならシリーズ先頭の写真を自動使用"
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
                            className={`text-[11px] px-2 py-1 rounded-sm border transition-colors self-start ${
                              draft.coverPhotoId === ""
                                ? "bg-[#555] text-[#1e1e1e] border-[#666]"
                                : "bg-[#333] text-[#888] border-[#444] hover:bg-[#3a3a3a]"
                            }`}
                          >
                            なし（自動）
                          </button>
                          {allForPicker.length > 0 ? (
                            <div className="grid grid-cols-5 gap-1 max-h-44 overflow-y-auto rounded-sm border border-[#444] bg-[#1e1e1e] p-1">
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
                                  className={`relative aspect-square overflow-hidden rounded-sm transition-all ${
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
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400/80" />
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#555]">
                              写真がありません
                            </p>
                          )}
                          {draft.coverPhotoId &&
                            (() => {
                              const sel = photos.find(
                                (p) => String(p.id) === draft.coverPhotoId,
                              );
                              return sel ? (
                                <p className="text-[10px] text-[#777] truncate">
                                  選択中: {sel.title || sel.filename}
                                </p>
                              ) : null;
                            })()}
                        </div>
                      );
                    })()}
                  </AdminField>
                  {/* 機能9: シリーズ固有のレイアウト・テーマ設定 */}
                  <div className="border-t border-[#2a2a2a] pt-3 mt-1">
                    <p className="text-[10px] tracking-wider uppercase text-[#555] mb-2">
                      Layout &amp; Theme
                    </p>
                    <AdminField
                      label="レイアウト"
                      hint="「グローバルに従う」はSettings→ギャラリー配置の設定を使います"
                    >
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            ["", "グローバル"],
                            ["mosaic", "モザイク"],
                            ["grid", "均等グリッド"],
                            ["scroll", "縦スクロール"],
                            ["stagger", "ずらし大"],
                            ["editorial", "雑誌見開き"],
                            ["collage", "コラージュ"],
                            ["clean-grid", "クリーングリッド"],
                            ["masonry", "マソンリー"],
                            ["large-format", "大判"],
                          ] as const
                        ).map(([val, lbl]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setThemeKey("layout", val)}
                            className={`text-[10px] py-1.5 rounded-sm border transition-colors ${(parsedTheme.layout ?? "") === val ? "bg-[#888] text-[#1e1e1e] border-[#888] font-medium" : "bg-[#333] text-[#aaa] border-[#444] hover:bg-[#3a3a3a]"}`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </AdminField>
                    <AdminField
                      label="写真の並び順"
                      hint="「グローバルに従う」はSettings→シリーズ並び順の設定を使います"
                    >
                      <div className="grid grid-cols-2 gap-1">
                        {(
                          [
                            ["inherit", "グローバル"],
                            ["manual", "手動順"],
                            ["date_desc", "撮影日↓新しい順"],
                            ["date_asc", "撮影日↑古い順"],
                          ] as const
                        ).map(([val, lbl]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setThemeKey("photoOrder", val)}
                            className={`text-[10px] py-1.5 rounded-sm border transition-colors ${(parsedTheme.photoOrder ?? "inherit") === val ? "bg-[#888] text-[#1e1e1e] border-[#888] font-medium" : "bg-[#333] text-[#aaa] border-[#444] hover:bg-[#3a3a3a]"}`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </AdminField>
                    <AdminField
                      label="背景色"
                      hint="空欄=グローバル設定。#fff / #000 / #1a1a1a など"
                    >
                      <input
                        type="text"
                        value={parsedTheme.bgColor ?? ""}
                        onChange={(e) =>
                          setThemeKey("bgColor", e.target.value.trim())
                        }
                        placeholder="（グローバル設定を使用）"
                        className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm font-mono placeholder:text-[#555]"
                      />
                    </AdminField>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={
                        patchSeries.isPending || !draft.title || !draft.slug
                      }
                      className="flex items-center gap-1.5 px-4 py-2 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors disabled:opacity-40"
                    >
                      {patchSeries.isPending ? (
                        <>
                          <Loader2 size={11} className="animate-spin" />{" "}
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check size={11} /> Save
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="px-4 py-2 text-[11px] text-[#888] hover:text-[#ccc] transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#333] pt-5">
        <p className="text-[11px] tracking-wider uppercase text-[#555] mb-4">
          New Series
        </p>
        <div className="flex flex-col gap-3">
          <AdminField label="Title">
            <input
              aria-label="新しいシリーズのタイトル"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                setAddError("");
                if (!newSlug) {
                  /* leave slug to user */
                }
              }}
              placeholder="Still, life"
              className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
            />
          </AdminField>
          <AdminField label="Slug">
            <input
              aria-label="新しいシリーズのスラッグ"
              value={newSlug}
              onChange={(e) => {
                setNewSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                );
                setAddError("");
              }}
              placeholder="still-life"
              className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm font-mono placeholder:text-[#555]"
            />
          </AdminField>
          {addError && (
            <p className="text-[11px] text-red-400/80">{addError}</p>
          )}
          <button
            onClick={handleAdd}
            disabled={!newSlug || !newTitle || addSeries.isPending}
            className="flex items-center gap-1.5 self-start px-4 py-2 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors disabled:opacity-40"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <p className="text-[13px] text-[#ddd] mb-1">
            「{deleteTarget.title}」を削除しますか？
          </p>
          <p className="text-[11px] text-[#777] mb-5">
            写真は削除されず、シリーズの割り当てだけが外れます。
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-1.5 text-[11px] text-[#888] hover:text-[#ccc] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deleteSeries.mutate(deleteTarget.id);
                if (editId === deleteTarget.id) setEditId(null);
                setDeleteTarget(null);
              }}
              className="px-4 py-1.5 text-[11px] bg-red-600/70 text-white rounded-sm hover:bg-red-600/90 transition-colors"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
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

function PricingTab() {
  const qc = useQueryClient();
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
    onError: () => setRowError("追加に失敗しました。"),
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
    onError: () => setRowError("保存に失敗しました。"),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminApi.pricing[":id"].$delete({
        param: { id: String(id) },
      });
      assertOk(res);
    },
    onSuccess: refresh,
    onError: () => setRowError("削除に失敗しました。"),
  });

  const reorder = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await adminApi.pricing.reorder.$post({ json: { ids } });
      assertOk(res);
    },
    onSuccess: () => {
      setRowError("");
      refresh();
    },
    onError: () => {
      setRowError("並び替えの保存に失敗しました。");
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
    },
  });
  const move = (id: number, delta: number) => {
    const ids = plans.map((p) => p.id);
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
    reorder.mutate(ids);
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
    <div className="h-full overflow-y-auto p-8 max-w-lg mx-auto">
      <h2 className="text-[11px] tracking-widest uppercase text-[#666] mb-2">
        Pricing
      </h2>
      <p className="text-[11px] text-[#555] mb-6">
        撮影依頼の料金プラン。↑↓で並び替え。公開トグルで下書き/公開。公開サイトでは
        Contact ページに表示されます。
      </p>

      {rowError && (
        <p role="alert" className="text-[11px] text-red-400/80 mb-3">
          {rowError}
        </p>
      )}

      <div className="flex flex-col gap-2 mb-8">
        {plans.length === 0 && !isLoading && (
          <p className="text-sm text-[#555] py-4 text-center">No plans yet</p>
        )}
        {plans.map((p, i) => (
          <div
            key={p.id}
            className="bg-[#2a2a2a] border border-[#333] rounded-sm"
          >
            <div className="flex items-center justify-between px-3 py-2.5 group">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex flex-col flex-shrink-0">
                  <button
                    onClick={() => move(p.id, -1)}
                    disabled={i === 0 || reorder.isPending}
                    aria-label="上へ移動"
                    className="text-[#555] hover:text-[#aaa] disabled:opacity-20 disabled:hover:text-[#555] transition-colors leading-none"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    onClick={() => move(p.id, 1)}
                    disabled={i === plans.length - 1 || reorder.isPending}
                    aria-label="下へ移動"
                    className="text-[#555] hover:text-[#aaa] disabled:opacity-20 disabled:hover:text-[#555] transition-colors leading-none"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#ccc] truncate">
                      {p.title}
                    </span>
                    {p.price && (
                      <span className="text-[11px] text-[#777] truncate">
                        {p.price}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <button
                  onClick={() =>
                    patchPlan.mutate({ id: p.id, isPublished: !p.isPublished })
                  }
                  aria-pressed={p.isPublished}
                  className={`text-[10px] px-2 py-1 rounded-sm transition-colors ${p.isPublished ? "bg-emerald-700/40 text-emerald-300/90" : "bg-[#333] text-[#777] hover:bg-[#3a3a3a]"}`}
                >
                  {p.isPublished ? "公開" : "下書き"}
                </button>
                <button
                  onClick={() =>
                    editId === p.id ? setEditId(null) : openEdit(p)
                  }
                  aria-label="編集"
                  className="text-[#555] hover:text-[#bbb] transition-colors"
                >
                  {editId === p.id ? (
                    <ChevronUp size={14} />
                  ) : (
                    <Pencil size={13} />
                  )}
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: p.id, title: p.title })}
                  aria-label={`${p.title} を削除`}
                  className="text-[#444] hover:text-red-400/80 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {editId === p.id && (
              <div className="border-t border-[#333] px-3 py-3 flex flex-col gap-3">
                <AdminField label="Title">
                  <input
                    aria-label="プランのタイトル"
                    value={draft.title}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, title: e.target.value }))
                    }
                    placeholder="ポートレート"
                    className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                  />
                </AdminField>
                <AdminField label="Price" hint="自由記述（例: ¥15,000〜）">
                  <input
                    aria-label="価格"
                    value={draft.price}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, price: e.target.value }))
                    }
                    placeholder="¥15,000〜"
                    className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                  />
                </AdminField>
                <AdminField label="Description" hint="プランの説明（任意）">
                  <textarea
                    aria-label="プランの説明"
                    rows={2}
                    value={draft.description}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, description: e.target.value }))
                    }
                    placeholder="2時間・データ20枚 など"
                    className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm resize-y placeholder:text-[#555]"
                  />
                </AdminField>
                <AdminField label="含まれるもの" hint="1行に1項目（箇条書き）">
                  <textarea
                    aria-label="含まれるもの"
                    rows={4}
                    value={draft.features}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, features: e.target.value }))
                    }
                    placeholder={"撮影2時間\nデータ20枚\nレタッチ込み"}
                    className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm resize-y placeholder:text-[#555]"
                  />
                </AdminField>
                <AdminField label="補足" hint="注意書きなど（任意）">
                  <input
                    aria-label="補足"
                    value={draft.note}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, note: e.target.value }))
                    }
                    placeholder="交通費別途"
                    className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                  />
                </AdminField>
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={patchPlan.isPending || !draft.title}
                    className="flex items-center gap-1.5 px-4 py-2 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors disabled:opacity-40"
                  >
                    {patchPlan.isPending ? (
                      <>
                        <Loader2 size={11} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check size={11} /> Save
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="px-4 py-2 text-[11px] text-[#888] hover:text-[#ccc] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => addPlan.mutate()}
        disabled={addPlan.isPending}
        className="flex items-center gap-1.5 px-4 py-2 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors disabled:opacity-40"
      >
        <Plus size={12} /> プランを追加
      </button>

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <p className="text-[13px] text-[#ddd] mb-4">
            「{deleteTarget.title}」を削除しますか？
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-1.5 text-[11px] text-[#888] hover:text-[#ccc] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deletePlan.mutate(deleteTarget.id);
                if (editId === deleteTarget.id) setEditId(null);
                setDeleteTarget(null);
              }}
              className="px-4 py-1.5 text-[11px] bg-red-600/70 text-white rounded-sm hover:bg-red-600/90 transition-colors"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
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
    return <p className="text-[10px] text-[#666]">公開中の写真がありません</p>;
  return (
    <div className="max-h-64 overflow-y-auto border border-[#3a3a3a] rounded-sm p-1.5 grid grid-cols-5 gap-1">
      {photos.map((p) => {
        const pos = picked.indexOf(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            title={p.title || p.filename}
            aria-label={`${p.title || p.filename}${pos >= 0 ? "（選択中）" : ""}`}
            aria-pressed={pos >= 0}
            className={`relative aspect-square overflow-hidden rounded-[2px] transition-opacity ${pos >= 0 ? "ring-2 ring-[#aaa]" : "opacity-55 hover:opacity-100"}`}
          >
            <img
              src={adminPhotoSrc(p, 200, 60)}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="w-full h-full object-cover bg-[#2a2a2a]"
              style={{ objectPosition: adminPhotoObjectPosition(p) }}
            />
            {pos >= 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-0.5 bg-[#ddd] text-[#1e1e1e] text-[9px] font-medium rounded-sm flex items-center justify-center">
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
  return (
    <div className="border-b border-[#333]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-1 text-[11px] tracking-widest uppercase text-[#888] hover:text-[#bbb] transition-colors cursor-pointer"
      >
        <span>{title}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && <div className="pb-5 space-y-3">{children}</div>}
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
      <span className="text-[10px] text-[#777] uppercase tracking-wider">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-[#2a2a2a] border border-[#444] rounded px-2.5 py-1.5 text-[12px] text-[#ccc] focus:border-[#666] outline-none"
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
      <span className="text-[10px] text-[#777] uppercase tracking-wider">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full bg-[#2a2a2a] border border-[#444] rounded px-2.5 py-1.5 text-[12px] text-[#ccc] focus:border-[#666] outline-none resize-y leading-relaxed"
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
  return (
    <div className="flex items-center gap-1 ml-auto shrink-0">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        className="p-0.5 text-[#666] hover:text-[#aaa] disabled:opacity-30 disabled:cursor-not-allowed"
        title="上へ"
      >
        <ChevronUp size={12} />
      </button>
      <button
        type="button"
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
        className="p-0.5 text-[#666] hover:text-[#aaa] disabled:opacity-30 disabled:cursor-not-allowed"
        title="下へ"
      >
        <ChevronDown size={12} />
      </button>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="p-0.5 text-[#666] hover:text-red-400"
        title="削除"
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

function ServiceTab({
  onUnsavedChange,
}: {
  onUnsavedChange?: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });

  const saved = parseServicePageConfig(data?.servicePageConfig);
  const [draft, setDraft] = usePersistentState<ServicePageConfig>(
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
      setDraft(fromDb);
    }
  }, [data]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    onUnsavedChange?.(hasChanges);
  }, [hasChanges, onUnsavedChange]);

  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await adminApi.settings.$post({
        json: { servicePageConfig: JSON.stringify(draft) },
      });
      assertOk(res);
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
        <Loader2 size={20} className="animate-spin text-[#555]" />
      </div>
    );

  return (
    <div className="h-full overflow-y-auto p-8 max-w-lg mx-auto">
      <h2 className="text-[11px] tracking-widest uppercase text-[#666] mb-2">
        Service Page
      </h2>
      <p className="text-[11px] text-[#555] mb-6">
        /service 販売ページの内容を編集します。akieguchi.com
        でのみ表示されます。
      </p>

      {/* Save bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={!hasChanges || save.isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] tracking-wider bg-[#4a9eff] text-white rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3a8eef] transition-colors"
        >
          {save.isPending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Check size={11} />
          )}
          保存
        </button>
        {hasChanges && (
          <button
            type="button"
            onClick={reset}
            className="text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
          >
            リセット
          </button>
        )}
        {justSaved && (
          <span className="text-[11px] text-green-400/80">保存しました</span>
        )}
        {saveError && (
          <span className="text-[11px] text-red-400/80">
            保存に失敗しました
          </span>
        )}
      </div>

      {/* Enabled toggle */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#333]">
        <span className="text-[11px] text-[#888]">ページ公開</span>
        <div className="flex gap-1">
          {(["on", "off"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set("enabled", v)}
              className={`px-3 py-1 text-[10px] tracking-wider rounded transition-colors ${
                draft.enabled === v
                  ? "bg-[#3a3a3a] text-[#e0e0e0]"
                  : "text-[#666] hover:text-[#aaa]"
              }`}
            >
              {v === "on" ? "公開" : "非公開"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero ── */}
      <ServiceSection title="Hero" defaultOpen>
        <SvcInput
          label="ラベル"
          value={draft.hero.label}
          onChange={(v) => setHero({ label: v })}
        />
        <SvcTextarea
          label="見出し（改行で行分割）"
          value={draft.hero.title}
          onChange={(v) => setHero({ title: v })}
          rows={2}
        />
        <SvcTextarea
          label="説明文"
          value={draft.hero.body}
          onChange={(v) => setHero({ body: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <SvcInput
            label="CTA: 料金"
            value={draft.hero.ctaPricing}
            onChange={(v) => setHero({ ctaPricing: v })}
          />
          <SvcInput
            label="CTA: 実例"
            value={draft.hero.ctaExample}
            onChange={(v) => setHero({ ctaExample: v })}
          />
        </div>
      </ServiceSection>

      {/* ── Examples ── */}
      <ServiceSection title="実例セクション">
        <SvcInput
          label="ラベル"
          value={draft.examples.label}
          onChange={(v) => setExamples({ label: v })}
        />
        <SvcTextarea
          label="見出し"
          value={draft.examples.title}
          onChange={(v) => setExamples({ title: v })}
          rows={2}
        />
        <SvcTextarea
          label="説明文"
          value={draft.examples.body}
          onChange={(v) => setExamples({ body: v })}
        />
        <SvcInput
          label="CTA"
          value={draft.examples.cta}
          onChange={(v) => setExamples({ cta: v })}
        />
        <p className="text-[10px] text-[#666] mt-2">実例リンク</p>
        {draft.examples.links.map((link, i) => (
          <div key={i} className="border border-[#333] rounded p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#555]">#{i + 1}</span>
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
              label="タイトル"
              value={link.title}
              onChange={(v) =>
                setExamples({
                  links: updateItem(draft.examples.links, i, { title: v }),
                })
              }
            />
            <SvcInput
              label="説明"
              value={link.body}
              onChange={(v) =>
                setExamples({
                  links: updateItem(draft.examples.links, i, { body: v }),
                })
              }
            />
            <SvcInput
              label="リンク先"
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
          className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
        >
          <Plus size={11} /> 追加
        </button>
      </ServiceSection>

      {/* ── Pain/Solutions ── */}
      <ServiceSection title="こんな悩み / このサイトなら">
        <SvcInput
          label="ラベル"
          value={draft.painSolutions.label}
          onChange={(v) => setPainSolutions({ label: v })}
        />
        {draft.painSolutions.items.map((item, i) => (
          <div key={i} className="border border-[#333] rounded p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#555]">#{i + 1}</span>
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
              label="悩みタイトル"
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
              label="悩み本文"
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
              label="解決タイトル"
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
              label="解決本文"
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
          className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
        >
          <Plus size={11} /> 追加
        </button>
      </ServiceSection>

      {/* ── Pricing ── */}
      <ServiceSection title="料金">
        <SvcInput
          label="ラベル"
          value={draft.pricing.label}
          onChange={(v) => setPricing({ label: v })}
        />
        {draft.pricing.plans.map((plan, i) => (
          <div key={i} className="border border-[#333] rounded p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#555]">プラン {i + 1}</span>
              {plan.primary && (
                <span className="text-[9px] bg-[#4a9eff]/20 text-[#4a9eff] px-1.5 py-0.5 rounded">
                  RECOMMENDED
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
                label="プラン名"
                value={plan.name}
                onChange={(v) =>
                  setPricing({
                    plans: updateItem(draft.pricing.plans, i, { name: v }),
                  })
                }
              />
              <SvcInput
                label="価格"
                value={plan.price}
                onChange={(v) =>
                  setPricing({
                    plans: updateItem(draft.pricing.plans, i, { price: v }),
                  })
                }
              />
            </div>
            <SvcTextarea
              label="説明文"
              value={plan.sub}
              onChange={(v) =>
                setPricing({
                  plans: updateItem(draft.pricing.plans, i, { sub: v }),
                })
              }
              rows={2}
            />
            <SvcTextarea
              label="特徴（1行ごとに箇条書き）"
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
              label="Stripe Payment Link"
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
              label="CTA文言"
              value={plan.cta}
              onChange={(v) =>
                setPricing({
                  plans: updateItem(draft.pricing.plans, i, { cta: v }),
                })
              }
            />
            <label className="flex items-center gap-2 text-[11px] text-[#888]">
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
                className="accent-[#4a9eff]"
              />
              おすすめ表示
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
          className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
        >
          <Plus size={11} /> プラン追加
        </button>
        <SvcTextarea
          label="決済後の案内文（Stripe有効時）"
          value={draft.pricing.noteOnline}
          onChange={(v) => setPricing({ noteOnline: v })}
          rows={2}
        />
        <SvcTextarea
          label="決済準備中の案内文"
          value={draft.pricing.noteOffline}
          onChange={(v) => setPricing({ noteOffline: v })}
          rows={2}
        />
        <SvcTextarea
          label="外部費用の注意書き"
          value={draft.pricing.disclaimer}
          onChange={(v) => setPricing({ disclaimer: v })}
          rows={2}
        />
      </ServiceSection>

      {/* ── Purchase Flow ── */}
      <ServiceSection title="購入後の流れ">
        <SvcInput
          label="ラベル"
          value={draft.purchaseFlow.label}
          onChange={(v) => setPurchaseFlow({ label: v })}
        />
        <SvcInput
          label="見出し"
          value={draft.purchaseFlow.title}
          onChange={(v) => setPurchaseFlow({ title: v })}
        />
        <SvcTextarea
          label="説明文"
          value={draft.purchaseFlow.body}
          onChange={(v) => setPurchaseFlow({ body: v })}
        />
        <p className="text-[10px] text-[#666] mt-2">ステップ</p>
        {draft.purchaseFlow.steps.map((step, i) => (
          <div key={i} className="border border-[#333] rounded p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#555]">
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
              label="タイトル"
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
              label="本文"
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
          className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
        >
          <Plus size={11} /> ステップ追加
        </button>
        <SvcTextarea
          label="脚注"
          value={draft.purchaseFlow.footnote}
          onChange={(v) => setPurchaseFlow({ footnote: v })}
          rows={2}
        />
      </ServiceSection>

      {/* ── FAQ ── */}
      <ServiceSection title="FAQ">
        <SvcInput
          label="ラベル"
          value={draft.faq.label}
          onChange={(v) => setFaq({ label: v })}
        />
        {draft.faq.items.map((item, i) => (
          <div key={i} className="border border-[#333] rounded p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#555]">Q{i + 1}</span>
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
              label="質問"
              value={item.q}
              onChange={(v) =>
                setFaq({
                  items: updateItem(draft.faq.items, i, { q: v }),
                })
              }
              rows={2}
            />
            <SvcTextarea
              label="回答"
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
          className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
        >
          <Plus size={11} /> 質問追加
        </button>
      </ServiceSection>

      {/* ── Final CTA ── */}
      <ServiceSection title="最下部CTA">
        <SvcInput
          label="見出し"
          value={draft.finalCta.title}
          onChange={(v) => setFinalCta({ title: v })}
        />
        <SvcTextarea
          label="説明文"
          value={draft.finalCta.body}
          onChange={(v) => setFinalCta({ body: v })}
          rows={2}
        />
        <div className="grid grid-cols-2 gap-2">
          <SvcInput
            label="CTA（Stripe有効時）"
            value={draft.finalCta.ctaOnline}
            onChange={(v) => setFinalCta({ ctaOnline: v })}
          />
          <SvcInput
            label="CTA（オフライン時）"
            value={draft.finalCta.ctaOffline}
            onChange={(v) => setFinalCta({ ctaOffline: v })}
          />
        </div>
        <p className="text-[10px] text-[#666] mt-2">SNSリンク</p>
        {draft.finalCta.snsLinks.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
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
              className="flex-1 bg-[#2a2a2a] border border-[#444] rounded px-2 py-1 text-[11px] text-[#ccc] focus:border-[#666] outline-none"
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
              className="flex-[2] bg-[#2a2a2a] border border-[#444] rounded px-2 py-1 text-[11px] text-[#ccc] focus:border-[#666] outline-none"
            />
            <button
              type="button"
              onClick={() =>
                setFinalCta({
                  snsLinks: removeItem(draft.finalCta.snsLinks, i),
                })
              }
              className="p-0.5 text-[#666] hover:text-red-400"
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
          className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
        >
          <Plus size={11} /> SNS追加
        </button>
      </ServiceSection>

      {/* ── Sticky CTA ── */}
      <ServiceSection title="Sticky CTA">
        <SvcInput
          label="左側テキスト"
          value={draft.stickyCta.text}
          onChange={(v) => setStickyCta({ text: v })}
        />
        <SvcInput
          label="料金リンク文言"
          value={draft.stickyCta.pricingCta}
          onChange={(v) => setStickyCta({ pricingCta: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <SvcInput
            label="CTA（Stripe有効時）"
            value={draft.stickyCta.ctaOnline}
            onChange={(v) => setStickyCta({ ctaOnline: v })}
          />
          <SvcInput
            label="CTA（オフライン時）"
            value={draft.stickyCta.ctaOffline}
            onChange={(v) => setStickyCta({ ctaOffline: v })}
          />
        </div>
      </ServiceSection>

      {/* ── Admin Showcase ── */}
      <ServiceSection title="管理画面紹介">
        <SvcInput
          label="ラベル"
          value={draft.adminShowcase.label}
          onChange={(v) => setAdminShowcase({ label: v })}
        />
        <SvcInput
          label="見出し"
          value={draft.adminShowcase.title}
          onChange={(v) => setAdminShowcase({ title: v })}
        />
        <SvcTextarea
          label="説明文"
          value={draft.adminShowcase.body}
          onChange={(v) => setAdminShowcase({ body: v })}
        />
        <p className="text-[10px] text-[#666] mt-2">機能リスト</p>
        {draft.adminShowcase.features.map((feat, i) => (
          <div key={i} className="border border-[#333] rounded p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#555]">#{i + 1}</span>
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
              label="タイトル"
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
              label="説明"
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
          className="flex items-center gap-1 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
        >
          <Plus size={11} /> 機能追加
        </button>
      </ServiceSection>

      {/* Bottom save */}
      {hasChanges && (
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] tracking-wider bg-[#4a9eff] text-white rounded disabled:opacity-40 hover:bg-[#3a8eef] transition-colors"
          >
            {save.isPending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Check size={11} />
            )}
            保存
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
          >
            リセット
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsTab({
  onUnsavedChange,
}: {
  onUnsavedChange?: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });

  // V: the unsaved draft and preview prefs survive tab switches / page moves.
  const [form, setForm] = usePersistentState<Record<string, string>>(
    "admin:settingsDraft",
    {},
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showPreview, setShowPreview] = usePersistentState(
    "admin:showPreview",
    false,
  );
  const [previewDevice, setPreviewDevice] = usePersistentState<
    "desktop" | "mobile"
  >("admin:previewDevice", "desktop");
  const [liveSync, setLiveSync] = usePersistentState("admin:liveSync", true);
  const [newCamPreset, setNewCamPreset] = useState("");
  const [newLensPreset, setNewLensPreset] = useState("");
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
      const res = await adminApi.settings.$post({ json: payload });
      assertOk(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
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
      const res = await adminApi.settings.$post({ json: form });
      assertOk(res);
    },
    onSuccess: () => {
      setSaveError(false);
      qc.setQueryData(
        ["settings"],
        (old: Record<string, string> | undefined) => ({ ...old, ...form }),
      );
      setForm({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => setSaveError(true),
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
  const handleIframeLoad = useCallback(() => {
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

  // Warn on unsaved changes. These hooks must run before the isLoading early
  // return — a hook after a conditional return crashes React ("Rendered more
  // hooks than during the previous render") the moment isLoading flips.
  const hasUnsaved = Object.keys(form).length > 0;
  useEffect(() => {
    onUnsavedChange?.(hasUnsaved);
  }, [hasUnsaved, onUnsavedChange]);
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full gap-2 text-[#555] text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading...
      </div>
    );

  const fields = [
    {
      key: "siteName",
      label: "Site Name (Logo)",
      placeholder: "Photographer Name",
      hint: "全ページ左上のロゴ（日本語）",
    },
    {
      key: "siteNameEn",
      label: "Site Name (EN)",
      placeholder: "Photographer Name",
      hint: "ロゴ下・OGP等の英語表記",
    },
    {
      key: "heroSubtitle",
      label: "Hero Subtitle",
      placeholder: "Photography",
      hint: "トップの作家名の下に表示",
    },
    {
      key: "siteDescription",
      label: "Site Description (SEO)",
      placeholder: "Photography portfolio.",
      hint: "検索結果・OGP・SNSシェア時の説明文（meta description）。空欄なら左の文を自動使用",
    },
    {
      key: "footerText",
      label: "Footer Text",
      placeholder: "空欄 = © 今年 サイト名（自動）",
      hint: "全ページ下部のフッター。空欄なら「© 現在の年 サイト名」を自動表示",
    },
    {
      key: "contactIntro",
      label: "Contact Page Intro",
      placeholder: "Feel free to...",
      hint: "お問い合わせページ上部の案内文",
    },
    {
      key: "contactEmail",
      label: "Contact Email",
      placeholder: "you@example.com",
      hint: "Displayed on the contact page for direct email",
    },
    {
      key: "formspreeUrl",
      label: "Formspree URL",
      placeholder: "https://formspree.io/f/...",
      hint: "Get your form URL from formspree.io to enable the contact form",
    },
    {
      key: "siteUrl",
      label: "サイトURL（公開ドメイン）",
      placeholder: "https://example.com",
      hint: "sitemap・canonical・OGP・JSON-LD の基準URL。空欄ならサーバー側の SITE_URL を使います",
    },
    {
      key: "googleSiteVerification",
      label: "Google サイト確認コード",
      placeholder: "例: AbC123xyz...",
      hint: 'Search Console「HTMLタグ」方式の content="..." の中身だけを貼り付け。保存後すぐ全ページの <head> に出力されます（画像サイトマップの登録に必要）',
    },
    {
      key: "footerCtaLabel",
      label: "フッター導線テキスト（任意）",
      placeholder: "例: 撮影のご相談はこちら",
      hint: "入力するとフッターに Contact への控えめなリンクを表示。空欄なら非表示",
    },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Settings panel */}
      <div
        className={`flex flex-col overflow-hidden transition-all duration-300 ${showPreview ? "w-full md:w-[420px] md:flex-shrink-0" : "max-w-lg mx-auto flex-1"}`}
      >
        {/* Sticky header with save */}
        <div className="z-10 bg-[#1e1e1e] border-b border-[#333] px-8 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] tracking-widest uppercase text-[#666]">
              Settings
            </h2>
            {Object.keys(form).length > 0 && (
              <span className="text-[10px] text-[#c90] bg-[#c90]/10 px-2 py-0.5 rounded-sm">
                {Object.keys(form).length} unsaved
              </span>
            )}
            {saveError && (
              <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-sm">
                保存失敗
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SaveButton
              onClick={() => save.mutate()}
              disabled={save.isPending || Object.keys(form).length === 0}
              saved={saved}
              pending={save.isPending}
            />
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-wider rounded-sm transition-colors ${
                showPreview
                  ? "bg-[#4a6fa5] text-white hover:bg-[#5a7fb5]"
                  : "bg-[#333] text-[#888] hover:text-[#ccc] hover:bg-[#3a3a3a]"
              }`}
            >
              {showPreview ? <EyeOff size={11} /> : <Eye size={11} />}
              {showPreview ? "Hide Preview" : "Live Preview"}
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
          <div className="flex flex-col gap-2">
            {/* General */}
            <Section title="General" defaultOpen={false}>
              {fields.map((f) => (
                <AdminField key={f.key} label={f.label} hint={f.hint}>
                  <input
                    type="text"
                    aria-label={f.label}
                    value={current[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                  />
                </AdminField>
              ))}
            </Section>

            {/* E1: Hero display mode */}
            <Section title="Hero（ファーストビュー）" defaultOpen={false}>
              <AdminField
                label="表示モード"
                hint="カルーセル/1枚絵=従来 / 静謐グリッド・エディトリアル・没入型=新レイアウト。切替は保存後に反映"
              >
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      ["carousel", "カルーセル"],
                      ["single", "1枚絵"],
                      ["quiet-grid", "静謐グリッド"],
                      ["editorial", "エディトリアル"],
                      ["immersive", "没入型"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("heroMode", val)}
                      className={`text-[11px] py-1.5 rounded-sm transition-colors ${
                        (current["heroMode"] || "carousel") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <AdminField
                label="画面の使い方"
                hint="フルスクリーン=最初の1画面を写真が覆う（下の「高さ」設定は無視されます）"
              >
                <div className="flex gap-1">
                  {(
                    [
                      ["normal", "通常（高さ設定に従う）"],
                      ["fullscreen", "フルスクリーン"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("heroDisplayMode", val)}
                      className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                        (current["heroDisplayMode"] || "normal") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <AdminField
                label="高さ"
                hint="ビューポート高に対する割合。スマホは自動で上限調整。フルスクリーン時は無効"
              >
                <TypoControl
                  label="高さ"
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
                label="名前の表示位置"
                hint="1枚絵/フルスクリーンでは写真上の位置、カルーセル（通常）では写真下の文字寄せとして効きます"
              >
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["center", "中央（既定）"],
                      ["bottom-left", "左下"],
                      ["bottom-right", "右下"],
                      ["top-left", "左上"],
                      ["top-right", "右上"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("heroTitlePosition", val)}
                      className={`text-[11px] py-1.5 rounded-sm transition-colors ${
                        (current["heroTitlePosition"] || "center") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <AdminField
                label="スクロール演出"
                hint="トップを下にスクロールしたときの写真の動き。OS設定で「視差効果を減らす」の人には自動で無効になります"
              >
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      ["none", "なし（既定）"],
                      ["fade", "フェード"],
                      ["sink", "沈み込み"],
                      ["parallax", "パララックス"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("heroScrollEffect", val)}
                      className={`text-[10px] leading-tight py-1.5 rounded-sm transition-colors ${
                        (current["heroScrollEffect"] || "none") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <AdminField
                label="オーバーレイ"
                hint="1枚絵モードで名前を読みやすくする暗いグラデーション"
              >
                <div className="flex gap-1">
                  {(
                    [
                      ["on", "あり"],
                      ["off", "なし"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("heroOverlay", val)}
                      className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                        (current["heroOverlay"] || "on") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
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
                    "heroHeight",
                    "heroOverlay",
                    "heroDisplayMode",
                    "heroTitlePosition",
                    "heroScrollEffect",
                  ].forEach((k) => set(k, ""));
                }}
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset to default
              </button>
            </Section>

            {/* BB: nav position + hover effect */}
            <Section title="ナビゲーション（位置・ホバー）" defaultOpen={false}>
              <AdminField
                label="位置"
                hint="スマホでは位置に関わらず従来のハンバーガーメニューになります"
              >
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["top", "上（既定）"],
                      ["left", "左 縦置き"],
                      ["bottom", "下 固定"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("navPosition", val)}
                      className={`text-[11px] py-1.5 rounded-sm transition-colors ${
                        (current["navPosition"] || "top") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <AdminField
                label="ホバー演出"
                hint="マウスを乗せたとき/キーボードフォーカス時の反応"
              >
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      ["fade", "フェード（既定）"],
                      ["underline", "下線が伸びる"],
                      ["dot", "点がともる"],
                      ["blur", "にじみ→くっきり"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("navHoverEffect", val)}
                      className={`text-[10px] leading-tight py-1.5 rounded-sm transition-colors ${
                        (current["navHoverEffect"] || "fade") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <button
                onClick={() => {
                  ["navPosition", "navHoverEffect"].forEach((k) => set(k, ""));
                }}
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset to default
              </button>
            </Section>

            {/* CC: section spacing multipliers */}
            <Section title="余白・スペーシング" defaultOpen={false}>
              <p className="text-[10px] text-[#666] leading-relaxed -mt-1">
                ページの「間」の量を倍率で調整します。1.0
                が現在のリズム。スマホは元の比率のまま縮みます。
              </p>
              <AdminField
                label="ヒーロー直下"
                hint="ヒーロー写真と作品セクションの間"
              >
                <TypoControl
                  label="倍率"
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
                label="セクション間"
                hint="作品〜CTA〜フッターなどセクション同士の基本余白"
              >
                <TypoControl
                  label="倍率"
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
                label="ページ冒頭"
                hint="ギャラリー・シリーズ・About・Contact など各ページ最初の「ため」"
              >
                <TypoControl
                  label="倍率"
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
              <AdminField label="フッター上" hint="ページ末尾とフッターの間">
                <TypoControl
                  label="倍率"
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
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset to default
              </button>
            </Section>

            {/* DD: paper/grain background texture */}
            <Section title="背景の質感（グレイン）" defaultOpen={false}>
              <AdminField
                label="テクスチャ"
                hint="背景にごく薄いノイズを敷きます。写真の上やLightboxには乗りません"
              >
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      ["none", "なし（既定）"],
                      ["grain-fine", "フィルム粒子"],
                      ["grain-coarse", "粗い紙"],
                      ["paper", "和紙・繊維"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("bgTexture", val)}
                      className={`text-[10px] leading-tight py-1.5 rounded-sm transition-colors ${
                        (current["bgTexture"] || "none") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <AdminField
                label="濃度"
                hint="0.05前後がおすすめ。上げすぎると写真より質感が目立ちます"
              >
                <TypoControl
                  label="濃度"
                  valueKey="bgTextureOpacity"
                  current={current}
                  set={set}
                  min={0}
                  max={0.15}
                  step={0.01}
                  unit=""
                  defaultVal="0.05"
                />
              </AdminField>
              <button
                onClick={() => {
                  ["bgTexture", "bgTextureOpacity"].forEach((k) => set(k, ""));
                }}
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset to default
              </button>
            </Section>

            {/* 写真のフェードイン方式（photoRevealEffect） */}
            <Section title="写真のフェードイン" defaultOpen={false}>
              <AdminField
                label="現れ方"
                hint="写真がスクロールで現れるときの動き。コラージュのような枠・傾きつきレイアウトでは「浮き上がり」より「フェード」「なし」が自然に見えます"
              >
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      ["fade", "フェード（既定）"],
                      ["none", "なし（即表示）"],
                      ["rise", "浮き上がり"],
                      ["scale", "ズーム"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("photoRevealEffect", val)}
                      className={`text-[10px] leading-tight py-1.5 rounded-sm transition-colors ${
                        (current["photoRevealEffect"] || "fade") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <button
                onClick={() => set("photoRevealEffect", "")}
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset to default
              </button>
            </Section>

            {/* G/N: Gallery layout type + controlled-random tuning */}
            <Section title="ギャラリー配置" defaultOpen={false}>
              <p className="text-[10px] text-[#666] leading-relaxed -mt-1">
                ページごとに写真の並べ方を選べます。プレビューで{" "}
                <span className="text-[#999]">トップ</span> /{" "}
                <span className="text-[#999]">Gallery</span> /{" "}
                <span className="text-[#999]">Series</span>{" "}
                ページを開くと即反映。下の調整は「モザイク」に効きます。
              </p>
              {/* N1: layout-type pickers (more types arrive one at a time) */}
              {(
                [
                  ["galleryLayout", "ギャラリーページ", "mosaic"],
                  ["seriesLayout", "シリーズページ", "mosaic"],
                  ["topWorksLayout", "トップ（Works）", "stagger"],
                ] as const
              ).map(([key, label, fallback]) => (
                <AdminField key={key} label={`${label}のレイアウト`}>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ["mosaic", "モザイク", "S/M/L混在・抜け感"],
                        ["grid", "均等グリッド", "全部同サイズ・整列"],
                        ["scroll", "縦スクロール1枚", "1枚ずつ大きく＋情報"],
                        ["stagger", "ずらし大", "1枚ずつ左右互い違い"],
                        ["editorial", "雑誌見開き", "2枚1組・左大右小"],
                        ["collage", "コラージュ", "重なり・角度でスナップ風"],
                        ["clean-grid", "クリーングリッド", "4列均一・装飾なし"],
                        ["masonry", "マソンリー", "3列・縦横比維持"],
                        ["large-format", "大判", "2列大判＋キャプション"],
                      ] as const
                    ).map(([val, name, desc]) => (
                      <button
                        key={val}
                        onClick={() => set(key, val)}
                        title={desc}
                        className={`text-[10px] leading-tight px-1.5 py-2 rounded-sm border transition-colors ${
                          (current[key] || fallback) === val
                            ? "bg-[#888] text-[#1e1e1e] border-[#888] font-medium"
                            : "bg-[#333] text-[#aaa] border-[#444] hover:bg-[#3a3a3a]"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </AdminField>
              ))}
              {/* トップ Works の写真選択（ヒーロー最上部スライドとは別の設定） */}
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                トップ（Works）に出す写真
              </p>
              <AdminField
                label="選び方"
                hint="自動=ギャラリーの並び順の先頭9枚 / ランダム=訪問ごとに入れ替え / 手動=下で選んだ写真を選んだ順に表示。最上部のヒーロー写真とは別の設定です"
              >
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["auto", "並び順から自動", "ギャラリーの並びの先頭9枚"],
                      ["random", "ランダム", "訪問ごとにシャッフル"],
                      ["manual", "手動で選択", "下で写真を選ぶ"],
                    ] as const
                  ).map(([val, name, desc]) => (
                    <button
                      key={val}
                      onClick={() => set("topWorksMode", val)}
                      title={desc}
                      className={`text-[10px] leading-tight px-1.5 py-2 rounded-sm border transition-colors ${
                        (current["topWorksMode"] || "auto") === val
                          ? "bg-[#888] text-[#1e1e1e] border-[#888] font-medium"
                          : "bg-[#333] text-[#aaa] border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </AdminField>
              {(current["topWorksMode"] || "auto") === "manual" && (
                <AdminField
                  label="トップに出す写真"
                  hint="クリックで選択/解除。番号の順（選んだ順）に表示されます。未選択のあいだは自動と同じ表示"
                >
                  <TopWorksPicker
                    value={current["topWorksIds"] ?? ""}
                    onChange={(v) => set("topWorksIds", v)}
                  />
                </AdminField>
              )}
              <AdminField
                label="初期表示枚数"
                hint="トップページのヒーロー下 Works 欄に最初から表示する写真の枚数。スクロールするとさらに追加表示されます"
              >
                <TypoControl
                  label="初期表示枚数"
                  valueKey="homeGalleryCount"
                  current={current}
                  set={set}
                  min={1}
                  max={200}
                  step={1}
                  unit="枚"
                  defaultVal="12"
                />
              </AdminField>
              {/* X: ギャラリーとトップ（Works）で列数・大きさ・余白を独立調整。
                W: 列数は「最大」を決め、実際の列数は画面幅で自動段階調整。 */}
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                ギャラリーの列数・大きさ・余白
              </p>
              <AdminField
                label="最大列数"
                hint="広い画面で最大何列まで並べるか。実際の列数は画面幅に応じて自動で減ります（スマホは1〜2列）"
              >
                <TypoControl
                  label="最大列数"
                  valueKey="galleryColumns"
                  current={current}
                  set={set}
                  min={1}
                  max={8}
                  step={1}
                  unit="列"
                  defaultVal="3"
                />
              </AdminField>
              <AdminField
                label="写真の大きさ"
                hint="大きくすると1枚が広くなり、その分列数が自動で減ります"
              >
                <TypoControl
                  label="大きさ"
                  valueKey="gallerySizeScale"
                  current={current}
                  set={set}
                  min={0.5}
                  max={3.0}
                  step={0.05}
                  unit="×"
                  defaultVal="1"
                />
              </AdminField>
              <AdminField
                label="間隔"
                hint="写真同士の余白の倍率（0.2=詰める / 3.0=広い）"
              >
                <TypoControl
                  label="余白倍率"
                  valueKey="galleryGapScale"
                  current={current}
                  set={set}
                  min={0.2}
                  max={5.0}
                  step={0.05}
                  unit="×"
                  defaultVal="1"
                />
              </AdminField>
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                トップ（Works）の列数・大きさ・余白 —
                動かすまではギャラリーと同じ値
              </p>
              <AdminField
                label="最大列数（トップ）"
                hint="トップ下部の作品の最大列数。ギャラリーとは独立です"
              >
                <TypoControl
                  label="最大列数"
                  valueKey="topWorksColumns"
                  current={current}
                  set={set}
                  min={1}
                  max={8}
                  step={1}
                  unit="列"
                  defaultVal={current["galleryColumns"] || "3"}
                />
              </AdminField>
              <AdminField
                label="写真の大きさ（トップ）"
                hint="トップ下部の作品の大きさ。ギャラリーとは独立です"
              >
                <TypoControl
                  label="大きさ"
                  valueKey="topWorksSizeScale"
                  current={current}
                  set={set}
                  min={0.5}
                  max={3.0}
                  step={0.05}
                  unit="×"
                  defaultVal={current["gallerySizeScale"] || "1"}
                />
              </AdminField>
              <AdminField
                label="間隔（トップ）"
                hint="トップ下部の作品の余白倍率。ギャラリーとは独立です"
              >
                <TypoControl
                  label="余白倍率"
                  valueKey="topWorksGapScale"
                  current={current}
                  set={set}
                  min={0.2}
                  max={5.0}
                  step={0.05}
                  unit="×"
                  defaultVal={current["galleryGapScale"] || "1"}
                />
              </AdminField>
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                モザイクの調整
              </p>
              <AdminField
                label="抜け（空セル）の頻度"
                hint="0で抜けなし＝詰める。大きいほど余白が増える。スマホでは自動的に控えめになります"
              >
                <TypoControl
                  label="抜け頻度"
                  valueKey="galleryEmptyRate"
                  current={current}
                  set={set}
                  min={0}
                  max={0.4}
                  step={0.01}
                  unit=""
                  defaultVal="0.1"
                />
              </AdminField>
              <AdminField
                label="サイズの緩急"
                hint="S/M/L の大きさの差をどれだけ強調するか。0=ほぼ均一 / 1.0=メリハリ最大"
              >
                <TypoControl
                  label="緩急の強さ"
                  valueKey="gallerySizeVariation"
                  current={current}
                  set={set}
                  min={0}
                  max={1.0}
                  step={0.05}
                  unit=""
                  defaultVal="0.5"
                />
              </AdminField>
              <div className="pt-2 border-t border-[#333]">
                <AdminField
                  label="配置のシャッフル"
                  hint="写真は同じまま、抜けの入る位置を別パターンに変えます。今の配置がイマイチなら押してみてください"
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        set(
                          "gallerySeed",
                          String(Math.floor(Math.random() * 1_000_000) + 1),
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-2 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors"
                    >
                      <Shuffle size={12} /> 配置をシャッフル
                    </button>
                    <span className="text-[10px] text-[#666] tabular-nums">
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
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset to default
              </button>
            </Section>

            {/* I: Series navigation toggle */}
            <Section title="シリーズ" defaultOpen={false}>
              <AdminField
                label="ナビに「Series」を表示"
                hint="「自動」は公開シリーズが1つでもあればリンクを表示します（既定）。「表示」は常に表示、「非表示」は常に隠します。シリーズの作成・写真割り当ては上部の Series タブ・Library のインスペクタから"
              >
                <div className="flex gap-1">
                  {(
                    [
                      ["auto", "自動"],
                      ["on", "表示"],
                      ["off", "非表示"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("seriesNavEnabled", val)}
                      className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                        (current["seriesNavEnabled"] || "auto") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>

              {/* P: series grid (Works series view) */}
              <div className="pt-3 mt-1 border-t border-[#333] space-y-3">
                <p className="text-[10px] text-[#666] leading-relaxed">
                  シリーズ一覧（表紙写真のグリッド）の見せ方。プレビューで{" "}
                  <span className="text-[#999]">Series</span> ページ、または{" "}
                  <span className="text-[#999]">Gallery</span> ページ上部の
                  Photos / Series
                  切り替えで反映されます。タイルは表紙写真のみ（文字なし）。表紙未設定のシリーズは先頭写真が自動で使われます。
                </p>
                <AdminField
                  label="Gallery で最初に見せるもの"
                  hint="Gallery ページを開いたとき、写真一覧（Photos）とシリーズ一覧（Series）のどちらを先に表示するか"
                >
                  <div className="flex gap-1">
                    {(
                      [
                        ["photos", "写真一覧"],
                        ["series", "シリーズ"],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("worksDefaultView", val)}
                        className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                          (current["worksDefaultView"] || "photos") === val
                            ? "bg-[#888] text-[#1e1e1e] font-medium"
                            : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <AdminField
                  label="シリーズ列数（PC）"
                  hint="タイルを大きく見せたいなら少なめ（2〜3列推奨）"
                >
                  <TypoControl
                    label="PC 列数"
                    valueKey="seriesGridColumns"
                    current={current}
                    set={set}
                    min={1}
                    max={8}
                    step={1}
                    unit="列"
                    defaultVal="3"
                  />
                </AdminField>
                <AdminField
                  label="シリーズ列数（スマホ）"
                  hint="スマホ表示時の列数"
                >
                  <TypoControl
                    label="スマホ 列数"
                    valueKey="seriesGridColumnsMobile"
                    current={current}
                    set={set}
                    min={1}
                    max={3}
                    step={1}
                    unit="列"
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
                  className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
                >
                  Reset to default
                </button>
              </div>

              {/* 機能8: 並び順独立設定 */}
              <div className="pt-3 mt-1 border-t border-[#333] space-y-3">
                <p className="text-[10px] text-[#666] leading-relaxed">
                  写真の並び順。「手動順」は Library
                  でドラッグした順番。シリーズごとに上書きしたい場合は Series
                  タブの各シリーズ編集から設定できます。
                </p>
                <AdminField
                  label="ギャラリーの並び順"
                  hint="ギャラリーページ・トップの写真の並べ方"
                >
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        ["manual", "手動順（D&D）"],
                        ["date_desc", "撮影日↓新しい順"],
                        ["date_asc", "撮影日↑古い順"],
                        ["upload_desc", "アップロード↓新しい順"],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("gallerySortOrder", val)}
                        className={`text-[10px] py-1.5 rounded-sm border transition-colors ${(current["gallerySortOrder"] || "manual") === val ? "bg-[#888] text-[#1e1e1e] border-[#888] font-medium" : "bg-[#333] text-[#aaa] border-[#444] hover:bg-[#3a3a3a]"}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </AdminField>
                <AdminField
                  label="シリーズ内の並び順"
                  hint="各シリーズ詳細ページの写真の並べ方（シリーズ側で個別設定もできます）"
                >
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        ["manual", "手動順（D&D）"],
                        ["date_desc", "撮影日↓新しい順"],
                        ["date_asc", "撮影日↑古い順"],
                        ["upload_desc", "アップロード↓新しい順"],
                      ] as const
                    ).map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => set("seriesSortOrder", val)}
                        className={`text-[10px] py-1.5 rounded-sm border transition-colors ${(current["seriesSortOrder"] || "manual") === val ? "bg-[#888] text-[#1e1e1e] border-[#888] font-medium" : "bg-[#333] text-[#aaa] border-[#444] hover:bg-[#3a3a3a]"}`}
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
                  className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
                >
                  Reset to default
                </button>
              </div>
            </Section>

            {/* J: note RSS integration */}
            <Section title="note連携" defaultOpen={false}>
              <p className="text-[10px] text-[#666] leading-relaxed -mt-1">
                note に投稿すると最新記事が About
                ページの「Journal」に自動表示されます（30分キャッシュ）。取得失敗時はセクションが消えるだけでサイトは壊れません。
              </p>
              <AdminField
                label="表示"
                hint="About ページに最新記事を表示するか"
              >
                <div className="flex gap-1">
                  {(
                    [
                      ["on", "表示"],
                      ["off", "非表示"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("noteEnabled", val)}
                      className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                        (current["noteEnabled"] || "off") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <AdminField
                label="note ユーザー名"
                hint="note.com/◯◯ の ◯◯ 部分（例: chi_aki_zip）"
              >
                <input
                  aria-label="note ユーザー名"
                  type="text"
                  value={current["noteUsername"] ?? ""}
                  onChange={(e) => set("noteUsername", e.target.value.trim())}
                  placeholder="chi_aki_zip"
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm font-mono placeholder:text-[#555]"
                />
              </AdminField>
              <AdminField label="表示件数" hint="一覧に表示する記事数">
                <TypoControl
                  label="件数"
                  valueKey="noteShowCount"
                  current={current}
                  set={set}
                  min={1}
                  max={8}
                  step={1}
                  unit="件"
                  defaultVal="3"
                />
              </AdminField>
            </Section>

            {/* K: print sales (external store) */}
            <Section title="プリント販売" defaultOpen={false}>
              <p className="text-[10px] text-[#666] leading-relaxed -mt-1">
                外部ストア（BOOTH等）への控えめなリンクを About
                ページに表示します。未設定なら何も表示されません。
              </p>
              <AdminField
                label="表示"
                hint="About ページにプリント購入リンクを表示するか"
              >
                <div className="flex gap-1">
                  {(
                    [
                      ["on", "表示"],
                      ["off", "非表示"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("printEnabled", val)}
                      className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                        (current["printEnabled"] || "off") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <AdminField label="ストアURL" hint="BOOTH等の販売ページURL">
                <input
                  aria-label="ストアURL"
                  type="url"
                  value={current["printStoreUrl"] ?? ""}
                  onChange={(e) => set("printStoreUrl", e.target.value.trim())}
                  placeholder="https://..."
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                />
              </AdminField>
              <AdminField label="リンク文言" hint="ボタンの表示テキスト">
                <input
                  aria-label="リンク文言"
                  type="text"
                  value={current["printStoreLabel"] ?? ""}
                  onChange={(e) => set("printStoreLabel", e.target.value)}
                  placeholder="プリントを購入する"
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                />
              </AdminField>
              <AdminField label="説明文（任意）" hint="サイズ・価格の概要など">
                <textarea
                  aria-label="プリント説明文"
                  rows={2}
                  value={current["printDescription"] ?? ""}
                  onChange={(e) => set("printDescription", e.target.value)}
                  placeholder="A4 / ¥3,000〜 ..."
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm resize-y placeholder:text-[#555]"
                />
              </AdminField>
            </Section>

            {/* 撮影依頼 CTA — closing "work with me" band */}
            <Section title="撮影依頼 CTA" defaultOpen={false}>
              <p className="text-[10px] text-[#666] leading-relaxed -mt-1">
                トップ・ギャラリー・シリーズ各ページの末尾に「撮影のご依頼」への導線を表示します。閲覧者が作品を見終えた直後に依頼へつなげる動線です。
              </p>
              <AdminField label="表示" hint="各ページ末尾に依頼CTAを表示するか">
                <div className="flex gap-1">
                  {(
                    [
                      ["on", "表示"],
                      ["off", "非表示"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("homeCtaEnabled", val)}
                      className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                        (current["homeCtaEnabled"] || "off") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <AdminField label="見出し" hint="例: 撮影のご依頼 / Work with me">
                <input
                  aria-label="CTA見出し"
                  type="text"
                  value={current["homeCtaTitle"] ?? ""}
                  onChange={(e) => set("homeCtaTitle", e.target.value)}
                  placeholder="撮影のご依頼"
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                />
              </AdminField>
              <AdminField
                label="本文（任意）"
                hint="依頼を後押しする一言。撮影ジャンル・対応範囲など"
              >
                <textarea
                  aria-label="CTA本文"
                  rows={2}
                  value={current["homeCtaText"] ?? ""}
                  onChange={(e) => set("homeCtaText", e.target.value)}
                  placeholder="ポートレート・作品撮り・取材など、お気軽にご相談ください。"
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm resize-y placeholder:text-[#555]"
                />
              </AdminField>
              <AdminField
                label="ボタン文言"
                hint="Contact ページへのリンク文言"
              >
                <input
                  aria-label="CTAボタン文言"
                  type="text"
                  value={current["homeCtaButton"] ?? ""}
                  onChange={(e) => set("homeCtaButton", e.target.value)}
                  placeholder="お問い合わせ"
                  className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                />
              </AdminField>
            </Section>

            {/* Theme Colors */}
            <Section title="Theme Colors" defaultOpen={false}>
              <div className="flex gap-4">
                <AdminField label="Background">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="背景色"
                      type="color"
                      value={current["themeBg"] || "#F5F0EB"}
                      onChange={(e) => set("themeBg", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <input
                      aria-label="背景色（HEX）"
                      type="text"
                      value={current["themeBg"] || ""}
                      onChange={(e) => set("themeBg", e.target.value)}
                      placeholder="#F5F0EB"
                      className="flex-1 bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                    />
                  </div>
                </AdminField>
                <AdminField label="Text">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="文字色"
                      type="color"
                      value={current["themeText"] || "#1a1a1a"}
                      onChange={(e) => set("themeText", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <input
                      aria-label="文字色（HEX）"
                      type="text"
                      value={current["themeText"] || ""}
                      onChange={(e) => set("themeText", e.target.value)}
                      placeholder="#1a1a1a"
                      className="flex-1 bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                    />
                  </div>
                </AdminField>
              </div>
              <button
                onClick={() => {
                  set("themeBg", "");
                  set("themeText", "");
                }}
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset to default
              </button>
            </Section>

            {/* Fonts */}
            <Section title="Fonts" defaultOpen={false}>
              {/* A6: one-click 和英 pairing presets — sets the existing fontJa/fontEn
                keys, so live preview and Save work exactly like manual picks. */}
              <AdminField
                label="ペアリング"
                hint="和文と欧文の組み合わせをワンクリックで一括設定。下の個別選択でいつでも上書きできます"
              >
                <PairingPicker current={current} set={set} />
              </AdminField>
              <FontPicker
                label="日本語フォント"
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
                label="英語フォント"
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
                      className={`text-[11px] px-2.5 py-1.5 rounded-sm transition-colors ${
                        !(current[key] || "")
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      既定（{defWeight}）
                    </button>
                    {weights.map((w) => (
                      <button
                        key={w}
                        onClick={() => set(key, String(w))}
                        className={`text-[11px] px-2.5 py-1.5 rounded-sm transition-colors ${
                          (current[key] || "") === String(w)
                            ? "bg-[#888] text-[#1e1e1e] font-medium"
                            : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                        }`}
                        style={{ fontWeight: w }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                );
                const hint = jaDef
                  ? "選択中の日本語フォントが読み込むウェイトから選択"
                  : "フォント未選択/カスタムのため一般的なウェイトを表示（フォント側が未対応の値は近似表示になります）";
                return (
                  <>
                    <AdminField label="ヒーロー名の太さ" hint={hint}>
                      {row("heroNameWeight", "700")}
                    </AdminField>
                    <AdminField
                      label="本文の太さ"
                      hint="サイト全体の本文の太さ"
                    >
                      {row("bodyWeight", "400")}
                    </AdminField>
                  </>
                );
              })()}
            </Section>

            {/* Typography — 大きさ (D4: 軸別2階層。まず調整軸→対象) */}
            <Section title="Typography ｜ 大きさ" defaultOpen={false}>
              <AdminField
                label="全体スケール"
                hint="全部の文字をまとめて大小（モバイル縮小率と併用可）"
              >
                <TypoControl
                  label="スケール"
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
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                ヒーロー名 / サブタイトル
              </p>
              <TypoControl
                label="名前"
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
                label="EN名"
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
                label="サブタイトル"
                valueKey="heroSubSize"
                current={current}
                set={set}
                min={6}
                max={60}
                step={1}
                unit="px"
                defaultVal="12"
              />
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                ナビゲーション
              </p>
              <TypoControl
                label="サイズ"
                valueKey="navSize"
                current={current}
                set={set}
                min={8}
                max={48}
                step={1}
                unit="px"
                defaultVal="14"
              />
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                セクション見出し（Recent Work / Contact 等）
              </p>
              <TypoControl
                label="サイズ"
                valueKey="sectionLabelSize"
                current={current}
                set={set}
                min={8}
                max={40}
                step={1}
                unit="px"
                defaultVal="16"
              />
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                ページ見出し（About名前）
              </p>
              <TypoControl
                label="サイズ"
                valueKey="headingSize"
                current={current}
                set={set}
                min={12}
                max={80}
                step={1}
                unit="px"
                defaultVal="30"
              />
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                本文
              </p>
              <TypoControl
                label="サイズ"
                valueKey="bodySize"
                current={current}
                set={set}
                min={10}
                max={36}
                step={1}
                unit="px"
                defaultVal="16"
              />
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                フッター
              </p>
              <TypoControl
                label="サイズ"
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
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset to default
              </button>
            </Section>

            {/* Typography — 色 */}
            <Section title="Typography ｜ 色" defaultOpen={false}>
              <p className="text-[9px] text-[#666] -mb-2">
                ヒーロー名 / サブタイトル
              </p>
              <ColorRow
                label="名前"
                valueKey="heroNameColor"
                current={current}
                set={set}
                placeholder="#ffffff"
              />
              <ColorRow
                label="EN名"
                valueKey="heroNameEnColor"
                current={current}
                set={set}
                placeholder="rgba(255,255,255,0.75)"
              />
              <ColorRow
                label="サブタイトル"
                valueKey="heroSubColor"
                current={current}
                set={set}
                placeholder="rgba(255,255,255,0.75)"
              />
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                アクセントカラー（差し色）
              </p>
              <ColorRow
                label="アクセント"
                valueKey="accentColor"
                current={current}
                set={set}
                placeholder="未設定 = 従来の色"
                hint="ホバー・選択中・フォーカスにまとめて効く差し色。薄い色は背景とのコントラストが低く見えにくい場合があります"
              />
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                リンク
              </p>
              <ColorRow
                label="ホバー色"
                valueKey="linkHoverColor"
                current={current}
                set={set}
                placeholder="#1a1a1a"
                hint="本文中リンクのホバー色。未設定ならアクセントカラー→既定の順で適用"
              />
              <AdminField label="下線" hint="リンクに下線を表示するか">
                <div className="flex gap-1">
                  {(
                    [
                      ["on", "あり"],
                      ["off", "なし"],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => set("linkUnderline", val)}
                      className={`flex-1 text-[11px] py-1.5 rounded-sm transition-colors ${
                        (current["linkUnderline"] || "off") === val
                          ? "bg-[#888] text-[#1e1e1e] font-medium"
                          : "bg-[#333] text-[#888] border border-[#444] hover:bg-[#3a3a3a]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </AdminField>
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                不透明度（詳細）
              </p>
              <TypoControl
                label="ナビ"
                valueKey="navOpacity"
                current={current}
                set={set}
                min={0.05}
                max={1}
                step={0.01}
                isOpacity
              />
              <TypoControl
                label="セクション見出し"
                valueKey="sectionLabelOpacity"
                current={current}
                set={set}
                min={0.05}
                max={1}
                step={0.01}
                isOpacity
              />
              <TypoControl
                label="フッター"
                valueKey="footerOpacity"
                current={current}
                set={set}
                min={0.05}
                max={1}
                step={0.01}
                isOpacity
              />
              <TypoControl
                label="SNSアイコン"
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
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset to default
              </button>
            </Section>

            {/* Typography — 間隔（字間・行間） */}
            <Section
              title="Typography ｜ 間隔（字間・行間）"
              defaultOpen={false}
            >
              <p className="text-[9px] text-[#666] -mb-2">ヒーロー名</p>
              <TypoControl
                label="名前 字間"
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
                label="EN名 字間"
                valueKey="heroNameEnTracking"
                current={current}
                set={set}
                min={-0.06}
                max={0.6}
                step={0.01}
                unit="em"
                defaultVal="0.08"
              />
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                ナビゲーション
              </p>
              <TypoControl
                label="字間"
                valueKey="navTracking"
                current={current}
                set={set}
                min={-0.06}
                max={0.8}
                step={0.01}
                unit="em"
                defaultVal="0.04"
              />
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                セクション見出し
              </p>
              <TypoControl
                label="字間"
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
                label="行間"
                valueKey="sectionLeading"
                current={current}
                set={set}
                min={0.9}
                max={3.0}
                step={0.05}
                unit=""
                defaultVal="1.2"
              />
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                本文
              </p>
              <TypoControl
                label="字間"
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
                label="行間"
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
                className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reset to default
              </button>
            </Section>

            {/* サイト文言 (D2) — サイトに一度だけ出る固定文言。各項目に表示場所を明記 */}
            <Section title="サイト文言" defaultOpen={false}>
              <p className="text-[9px] text-[#666] -mb-2">ナビゲーション</p>
              {(
                [
                  {
                    key: "navLabelTop",
                    label: "ロゴ (TOP)",
                    placeholder: "TOP",
                    hint: "全ページ左上のロゴ／TOPリンク",
                  },
                  {
                    key: "navLabelGallery",
                    label: "Gallery リンク",
                    placeholder: "Gallery",
                    hint: "ヘッダーナビの Gallery リンク",
                  },
                  {
                    key: "navLabelAbout",
                    label: "About リンク",
                    placeholder: "About",
                    hint: "ヘッダーナビの About リンク",
                  },
                  {
                    key: "navLabelContact",
                    label: "Contact リンク",
                    placeholder: "Contact",
                    hint: "ヘッダーナビの Contact リンク",
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
                    className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                  />
                </AdminField>
              ))}
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                SNS ラベル
              </p>
              {(
                [
                  {
                    key: "snsLabelInstagram",
                    label: "Instagram",
                    placeholder: "Instagram",
                    hint: "フッター等のSNSリンク表示名",
                  },
                  {
                    key: "snsLabelTwitter",
                    label: "X / Twitter",
                    placeholder: "X",
                    hint: "フッター等のSNSリンク表示名",
                  },
                  {
                    key: "snsLabelNote",
                    label: "note",
                    placeholder: "note",
                    hint: "フッター等のSNSリンク表示名",
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
                    className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                  />
                </AdminField>
              ))}
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                セクション見出し
              </p>
              {(
                [
                  {
                    key: "worksLabel",
                    label: "Works 見出し",
                    placeholder: "Works",
                    hint: "トップの最新作品セクションの見出し",
                  },
                  {
                    key: "viewAllLabel",
                    label: "View all リンク",
                    placeholder: "View all →",
                    hint: "トップの作品セクション見出し横の小リンク文言",
                  },
                  {
                    key: "viewAllCtaLabel",
                    label: "View all ボタン",
                    placeholder: "すべての作品を見る",
                    hint: "トップの作品一覧の下に出る大きめボタンの文言",
                  },
                  {
                    key: "galleryLabel",
                    label: "Gallery 見出し",
                    placeholder: "Gallery",
                    hint: "ギャラリーページ上部の見出し",
                  },
                  {
                    key: "filterAllLabel",
                    label: "フィルター All",
                    placeholder: "All",
                    hint: "ギャラリー上部のフィルタ最左ボタン",
                  },
                  {
                    key: "profileLabel",
                    label: "Profile 見出し",
                    placeholder: "Profile",
                    hint: "プロフィールページ上部の見出し",
                  },
                  {
                    key: "contactLabel",
                    label: "Contact 見出し",
                    placeholder: "Contact",
                    hint: "お問い合わせページ上部の見出し",
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
                    className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                  />
                </AdminField>
              ))}
              <p className="text-[9px] text-[#666] -mb-2 pt-2 border-t border-[#333]">
                コンタクトフォーム（お問い合わせページのフォーム内）
              </p>
              {(
                [
                  {
                    key: "contactFormName",
                    label: "Name ラベル",
                    placeholder: "Name",
                  },
                  {
                    key: "contactFormEmail",
                    label: "Email ラベル",
                    placeholder: "Email",
                  },
                  {
                    key: "contactFormSubject",
                    label: "Subject ラベル",
                    placeholder: "Subject",
                  },
                  {
                    key: "contactSubjectOptions",
                    label: "件名選択肢 (カンマ区切り)",
                    placeholder: "Shooting,Press / Media,Collaboration,Other",
                  },
                  {
                    key: "contactFormMessage",
                    label: "Message ラベル",
                    placeholder: "Message",
                  },
                  {
                    key: "contactSendButton",
                    label: "送信ボタン",
                    placeholder: "Send",
                  },
                  {
                    key: "contactSendingButton",
                    label: "送信中ボタン",
                    placeholder: "Sending...",
                  },
                  {
                    key: "contactSentMessage",
                    label: "送信完了メッセージ",
                    placeholder: "Message sent.",
                  },
                  {
                    key: "contactSendAnother",
                    label: "もう一通送る",
                    placeholder: "Send another",
                  },
                  {
                    key: "contactErrorMessage",
                    label: "エラーメッセージ",
                    placeholder: "Failed to send. Please try again.",
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
                    className="w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
                  />
                </AdminField>
              ))}
            </Section>

            {/* 撮影情報プリセット — インスペクタの Camera / Lens 候補 */}
            <Section title="撮影情報プリセット" defaultOpen={false}>
              <p className="text-[9px] text-[#666] -mb-1">
                写真編集インスペクタの Camera / Lens
                入力候補。初期候補も削除できます。
              </p>

              <PresetEditor
                label="カメラ"
                items={cameraPresets}
                value={newCamPreset}
                onChange={setNewCamPreset}
                onAdd={addCamPreset}
                onRemove={removeCamPreset}
                placeholder="例: Hasselblad 500C/M"
                busy={savePresets.isPending}
              />
              <PresetEditor
                label="レンズ"
                items={lensPresets}
                value={newLensPreset}
                onChange={setNewLensPreset}
                onAdd={addLensPreset}
                onRemove={removeLensPreset}
                placeholder="例: Planar 80mm f/2.8"
                busy={savePresets.isPending}
              />
            </Section>

            {/* Admin */}
            <div className="pt-3">
              <p className="text-[11px] tracking-wider uppercase text-[#555] mb-2">
                Admin Password
              </p>
              <p className="text-[11px] text-[#444] leading-relaxed">
                Set via environment variable{" "}
                <code className="text-[#666] bg-[#333] px-1 py-0.5 rounded-sm font-mono text-[10px]">
                  ADMIN_PASSWORD
                </code>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Panel — mobile: full-screen overlay; desktop: side panel */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#111] md:static md:z-auto md:flex-1 md:border-l md:border-[#333] min-w-0 overflow-hidden">
          {/* Preview toolbar */}
          <div className="flex items-center justify-between px-4 h-10 border-b border-[#333] bg-[#1a1a1a] flex-shrink-0">
            <span className="text-[10px] tracking-widest uppercase text-[#555]">
              Preview
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPreviewDevice("desktop")}
                className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] transition-colors ${previewDevice === "desktop" ? "bg-[#333] text-[#ccc]" : "text-[#555] hover:text-[#888]"}`}
                title="PC幅で確認"
                aria-label="PC幅で確認"
              >
                <Monitor size={13} /> PC幅
              </button>
              <button
                onClick={() => setPreviewDevice("mobile")}
                className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] transition-colors ${previewDevice === "mobile" ? "bg-[#333] text-[#ccc]" : "text-[#555] hover:text-[#888]"}`}
                title="スマホ幅で確認"
                aria-label="スマホ幅で確認"
              >
                <Smartphone size={13} /> スマホ幅
              </button>
              <button
                onClick={() => setLiveSync(!liveSync)}
                className={`ml-2 px-2 py-0.5 rounded-sm text-[10px] transition-colors ${liveSync ? "bg-[#2a3a2a] text-[#6c6]" : "bg-[#3a2a2a] text-[#c66]"}`}
                title={
                  liveSync
                    ? "設定変更がリアルタイム反映中"
                    : "リアルタイム反映OFF"
                }
              >
                {liveSync ? "Sync ON" : "Sync OFF"}
              </button>
              <button
                onClick={() =>
                  iframeRef.current?.contentWindow?.location.reload()
                }
                className="ml-1 text-[10px] text-[#555] hover:text-[#888] transition-colors"
              >
                Reload
              </button>
              {/* Close — needed to dismiss the mobile full-screen overlay */}
              <button
                onClick={() => setShowPreview(false)}
                className="md:hidden ml-1 p-1.5 rounded-sm text-[#888] hover:text-[#ccc] transition-colors"
                title="Close preview"
                aria-label="Close preview"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {/* iframe container */}
          <div className="flex-1 flex items-start justify-center overflow-auto p-4">
            <div
              className={`bg-white rounded-sm overflow-hidden shadow-lg transition-all duration-300 ${
                previewDevice === "mobile"
                  ? "w-[375px] h-[667px]"
                  : "w-full h-full"
              }`}
              style={
                previewDevice === "mobile"
                  ? { border: "8px solid #333", borderRadius: "20px" }
                  : {}
              }
            >
              <iframe
                ref={iframeRef}
                src="/"
                onLoad={handleIframeLoad}
                className="w-full h-full border-0"
                title="Site Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Collapsible Section ─────────────────────────── */
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#333] pb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left py-2 text-[10px] tracking-widest uppercase text-[#666] hover:text-[#999] transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="pt-1 flex flex-col gap-4">{children}</div>}
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
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-[#888]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <span className="text-[10px] text-[#555]">候補なし</span>
        )}
        {items.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 bg-[#333] border border-[#444] text-[#ccc] text-[11px] pl-2 pr-1 py-1 rounded-sm"
          >
            {p}
            <button
              onClick={() => onRemove(p)}
              disabled={busy}
              aria-label={`${p} を削除`}
              className="text-[#777] hover:text-red-400 transition-colors disabled:opacity-40"
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
          className="flex-1 bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
        />
        <button
          onClick={onAdd}
          disabled={busy || !value.trim()}
          className="flex items-center gap-1 px-3 py-2 text-[11px] bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors disabled:opacity-40"
        >
          <Plus size={12} /> 追加
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
            className={`text-left px-3 py-2.5 rounded-sm transition-colors ${active ? "bg-[#888] text-[#1e1e1e]" : "bg-[#333] text-[#aaa] border border-[#444] hover:bg-[#3a3a3a]"}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-[11px] ${active ? "font-medium" : ""}`}>
                {name}
              </span>
              <span
                className={`text-[9px] shrink-0 ${active ? "text-[#1e1e1e]/60" : "text-[#555]"}`}
              >
                {ja} × {en}
              </span>
            </div>
            <div
              className={`mt-1.5 flex gap-3 items-baseline ${active ? "text-[#1e1e1e]/80" : "text-[#999]"}`}
            >
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
      setUploadError("対応形式は .woff2 / .woff / .ttf / .otf です");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("フォントファイルは2MBまでです");
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
        const err = await res.json().catch(() => ({}));
        setUploadError(err.error || "アップロードに失敗しました");
        return;
      }
      const data = await res.json();
      const name = file.name.replace(/\.[^.]+$/, "");
      set(customNameKey, name);
      set(customUrlKey, data.url);
    } catch {
      setUploadError("アップロードに失敗しました（ネットワークエラー）");
    } finally {
      setUploading(false);
    }
  };

  const selectCls =
    "w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm appearance-none cursor-pointer";
  const inputCls =
    "w-full bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]";

  // Correct fallback for preview
  const previewFamily = def
    ? `'${value}', ${fontFallbackStr(def.category)}`
    : isCustom && current[customNameKey]
      ? `'${current[customNameKey]}', ${fontFallbackStr((current[customCategoryKey] || "sans-serif") as "serif" | "sans-serif")}`
      : undefined;

  return (
    <div>
      <label className="block text-[10px] text-[#777] uppercase tracking-wider mb-1">
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
        <option value="">Default</option>
        {presets.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value="custom">Custom (upload)</option>
      </select>

      {/* Preview */}
      {previewFamily && (
        <p
          className="mt-2 text-[13px] text-[#aaa]"
          style={{ fontFamily: previewFamily }}
        >
          あいうえお ABCabc 123
        </p>
      )}

      {isCustom && (
        <div className="mt-2 flex flex-col gap-2">
          {uploadError && (
            <p role="alert" className="text-[11px] text-red-400/90">
              {uploadError}
            </p>
          )}
          <input
            aria-label="フォント名"
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
                className={`flex-1 text-[11px] py-1 rounded-sm transition-colors ${
                  (current[customCategoryKey] || "sans-serif") === cat
                    ? "bg-[#888] text-[#1e1e1e]"
                    : "bg-[#333] text-[#666] border border-[#444] hover:bg-[#3a3a3a]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {current[customUrlKey] ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#888] truncate flex-1">
                {current[customUrlKey].split("/").pop()}
              </span>
              <label className="text-[10px] text-[#666] hover:text-[#aaa] cursor-pointer transition-colors">
                Replace
                <input
                  aria-label="フォントファイルを選択"
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <label
              className={`inline-flex items-center gap-1.5 text-[11px] text-[#888] hover:text-[#ccc] cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Upload size={12} />
              {uploading
                ? "Uploading..."
                : "Upload font file (.woff2, .woff, .ttf, .otf)"}
              <input
                aria-label="フォントファイルを選択"
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
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-[#666] w-32 shrink-0">{label}</span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(valueKey, e.target.value)}
        className="flex-1 h-1 accent-[#888] cursor-pointer"
      />
      <input
        aria-label={`${label}（数値入力）`}
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
            ? `0〜1（現在 ${Math.round(value * 100)}%）`
            : unit
              ? `単位: ${unit}`
              : undefined
        }
        className="w-16 shrink-0 bg-[#333] border border-[#444] rounded-sm text-[11px] text-[#aaa] text-right px-1.5 py-0.5 tabular-nums outline-none focus:border-[#888] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {unit ? (
        <span className="text-[10px] text-[#555] w-4 shrink-0">{unit}</span>
      ) : isOpacity ? (
        <span className="text-[10px] text-[#555] w-4 shrink-0">α</span>
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
  // Wire Escape (native `cancel`) and backdrop click via the DOM rather than JSX
  // props: <dialog> is a non-interactive element, so JSX mouse/key handlers on it
  // trip jsx-a11y — addEventListener keeps the behaviour without the lint.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const onClick = (e: MouseEvent) => {
      if (e.target === d) onCloseRef.current();
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    d.addEventListener("click", onClick);
    d.addEventListener("cancel", onCancel);
    return () => {
      d.removeEventListener("click", onClick);
      d.removeEventListener("cancel", onCancel);
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`bg-[#2a2a2a] border border-[#444] rounded-sm p-6 ${widthClass} shadow-xl m-auto text-left backdrop:bg-black/60`}
    >
      {children}
    </dialog>
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
      <label className="block text-[10px] text-[#777] uppercase tracking-wider mb-1">
        {label}
      </label>
      {hint && (
        <p className="text-[10px] text-[#555] mb-1.5 leading-relaxed">{hint}</p>
      )}
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
  return (
    <AdminField label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
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
          className="flex-1 bg-[#333] border border-[#444] text-[#ddd] px-3 py-2 text-[12px] outline-none focus:border-[#888] transition-colors rounded-sm placeholder:text-[#555]"
        />
      </div>
    </AdminField>
  );
}

function SaveButton({
  onClick,
  disabled,
  saved,
  pending,
}: {
  onClick: () => void;
  disabled: boolean;
  saved: boolean;
  pending: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="self-start flex items-center gap-1.5 px-5 py-2 text-[11px] tracking-wider bg-[#555] text-[#1e1e1e] rounded-sm hover:bg-[#666] transition-colors disabled:opacity-40"
    >
      {saved ? (
        <>
          <Check size={11} /> Saved
        </>
      ) : pending ? (
        <>
          <Loader2 size={11} className="animate-spin" /> Saving...
        </>
      ) : (
        "Save"
      )}
    </button>
  );
}
