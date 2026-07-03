import { useEffect, useState } from "react";
import { objectPositionFromFocal, srcFor } from "../lib/picture";

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

export function isAdminTab(value: unknown): value is Tab {
  return typeof value === "string" && ADMIN_TAB_KEYS.has(value as Tab);
}

export function groupForTab(tab: Tab): AdminTabGroup {
  return (
    ADMIN_TAB_GROUPS.find((group) => group.tabs.includes(tab)) ??
    ADMIN_TAB_GROUPS[0]
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

export function effectivePresets(saved: string[], defaults: string[]): string[] {
  return saved.length > 0 ? saved : defaults;
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
