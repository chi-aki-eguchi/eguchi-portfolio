import { useCallback, useEffect, useState } from "react";

// 管理画面だけの明暗の選択。**端末ローカル**（localStorage）で、公開サイトの
// `theme-preference`（`useDarkMode`）とは別に持つ。理由:
// - 「管理画面の明るさ」は閲覧者ごとの表示の好みであって、公開サイトの構成
//   （site_settings / Portfolio Kit の配布内容）ではない。新しい DB キーを増やさない。
// - オーナーは管理画面を黒ベースで使いたい。未選択の既定は "dark"。
// 色相そのもの（背景・文字・アクセント）は従来どおり CMS の明/暗パレットから
// `adminThemeFromSettings` が派生する。ここが決めるのは「どちらのパレットを使うか」だけ。
export type AdminSurfacePreference = "light" | "dark" | "site";

const STORAGE_KEY = "admin-surface-preference";
const DEFAULT_PREFERENCE: AdminSurfacePreference = "dark";

function readStored(): AdminSurfacePreference {
  if (typeof window === "undefined") return DEFAULT_PREFERENCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "site") return raw;
  } catch {
    /* private mode / quota */
  }
  return DEFAULT_PREFERENCE;
}

/**
 * @param siteResolved 公開サイト側の解決済みテーマ（"site" を選んだときの追従先）
 */
export function useAdminSurface(siteResolved: "light" | "dark") {
  const [preference, setPreferenceState] =
    useState<AdminSurfacePreference>(readStored);

  // 別タブ／別画面（公開サイトのフッター等）から変えられた場合に追従する。
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setPreferenceState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const resolved: "light" | "dark" =
    preference === "site" ? siteResolved : preference;

  const setPreference = useCallback((next: AdminSurfacePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* keep in-memory */
    }
  }, []);

  return { preference, resolved, setPreference } as const;
}
