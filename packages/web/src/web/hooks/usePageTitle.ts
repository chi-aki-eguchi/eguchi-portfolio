import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { CLIENT_SITE_FALLBACKS } from "../lib/site-fallbacks";

/**
 * Sets document.title on SPA navigation.
 * Subscribes to the settings query so the title refreshes once settings load
 * (not only on the next navigation).
 * Pass a page name like "Gallery" -> "Gallery | Site Name | Photography"
 * Pass nothing → base title.
 */
export function usePageTitle(page?: string) {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });

  useEffect(() => {
    const siteName = settings?.siteName || "";
    const subtitle = settings?.heroSubtitle || "";
    const base = [siteName, subtitle].filter(Boolean).join(" | ") || CLIENT_SITE_FALLBACKS.title;
    document.title = page ? `${page} | ${base}` : base;
  }, [page, settings?.siteName, settings?.heroSubtitle]);
}
