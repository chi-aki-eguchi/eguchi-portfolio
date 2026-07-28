import { useEffect, useState } from "react";
import { objectPositionFromFocal, srcFor } from "../lib/picture";
import { adminApi } from "../lib/api";
import { getStoredAdminMessages } from "./admin-i18n";

export type Tab =
  | "setup"
  | "gallery"
  | "hero"
  | "profile"
  | "categories"
  | "series"
  | "pricing"
  | "service"
  | "settings";

export const ADMIN_TAB_KEYS = new Set<Tab>([
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

export type AdminTabGroup = {
  key: string;
  label: string;
  tabs: readonly Tab[];
};

// label はここでは JA 固定値だが未使用のフォールバック — 表示側
// (admin.tsx の adminTabGroups useMemo / admin-mobile-nav.tsx の
// groupLabel())が group.key で t.navigation.groups.* に必ず差し替えるため、
// 実際の画面には出ない(EN/JP 両方とも辞書側で解決済み)。値を動的化すると
// admin-mobile-nav.render.test.tsx と scripts/smoke/admin-mobile-nav.spec.ts
// が参照する固定文字列と食い違うリスクがあるため、ここでは変更しない。
export const ADMIN_TAB_GROUPS: AdminTabGroup[] = [
  { key: "photos", label: "写真", tabs: ["gallery"] },
  {
    key: "presentation",
    label: "見せ方",
    tabs: ["hero", "series", "categories"],
  },
  {
    key: "site",
    label: "サイト",
    tabs: ["profile", "pricing", "service", "settings", "setup"],
  },
];

export function adminTabGroupsForService(
  showService: boolean,
): AdminTabGroup[] {
  if (showService) return ADMIN_TAB_GROUPS;
  return ADMIN_TAB_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => tab !== "service"),
  }));
}

export function isAdminTab(value: unknown): value is Tab {
  return typeof value === "string" && ADMIN_TAB_KEYS.has(value as Tab);
}

export function groupForTab(
  tab: Tab,
  groups: readonly AdminTabGroup[] = ADMIN_TAB_GROUPS,
): AdminTabGroup {
  return (
    groups.find((group) => group.tabs.includes(tab)) ?? groups[0]
  );
}

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
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
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

// POST /admin/settings の許可リスト外キーはAPI側で無視され保存されない
// (Q-5)。API はどのキーを無視したかを ignoredKeys で返すが、呼び出し元が
// res.json() を読まず assertOk() だけ見ていると、画面は「保存成功」のまま
// 実際は一部保存されない事故に気づけない(codex-reviewer P1指摘)。
// 全ての settings 保存呼び出しはこの関数を経由させ、無視されたキーがあれば
// 必ずエラーとして表面化させる。
export async function postAdminSettings(
  json: Record<string, string | undefined>,
): Promise<void> {
  const res = await adminApi.settings.$post({ json });
  const body = await jsonOrThrow<{ ok: boolean; ignoredKeys?: string[] }>(res);
  if (body.ignoredKeys && body.ignoredKeys.length > 0) {
    throw new Error(
      getStoredAdminMessages().common.unsupportedSettings(
        body.ignoredKeys.join(", "),
      ),
    );
  }
}

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

export function parsePresetList(raw?: string): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function effectivePresets(
  saved: string[],
  defaults: string[],
): string[] {
  return saved.length > 0 ? saved : defaults;
}

// Library の並び替えロック判定。純関数にして admin.tsx から切り出し、
// 「手動以外のソート / 複合フィルター / シリーズ単独例外 / リセット後」の
// 4状態をテストで固定する(2026-07-11 先輩側並び替え不能調査の副産物)。
// - librarySort が "manual" 以外 → 見た目だけの並びなので保存順は動かせない
// - フィルター中 → 表示が部分集合になり index ずれで順序が壊れるため不可。
//   ただしシリーズ単独絞り込みだけは例外(公開シリーズページの順序編集)。
export type ReorderLockReason = "sort" | "filters" | null;
export function reorderLockReason(
  librarySort: string,
  anyFilterActive: boolean,
  onlySeriesFilter: boolean,
): ReorderLockReason {
  if (librarySort !== "manual") return "sort";
  if (anyFilterActive && !onlySeriesFilter) return "filters";
  return null;
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
  sortOrder?: number | null;
  deletedAt?: number | null;
  createdAt?: string | number | null;
};

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
