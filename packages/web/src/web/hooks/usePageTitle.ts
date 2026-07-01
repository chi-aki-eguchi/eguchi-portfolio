import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { CLIENT_SITE_FALLBACKS } from "../lib/site-fallbacks";
import { composePageTitle } from "../../shared/site-title";

/**
 * Sets document.title on SPA navigation.
 * Subscribes to the settings query so the title refreshes once settings load
 * (not only on the next navigation).
 * Pass a page name like "Gallery" -> "Gallery | Name JA | Name EN | Subtitle"
 * Pass nothing → home title ("Name JA | Name EN Subtitle").
 */
export function usePageTitle(page?: string) {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });

  useEffect(() => {
    // Settings not loaded yet — leave the server-rendered <title> alone
    // rather than briefly overwriting it with an incomplete value. That
    // flash used to make GA record different titles for the same URL
    // depending on hydration timing.
    if (!settings) return;
    document.title = composePageTitle(page, {
      nameJa: settings.siteName || CLIENT_SITE_FALLBACKS.siteName,
      nameEn: settings.siteNameEn || CLIENT_SITE_FALLBACKS.siteNameEn,
      subtitle: settings.heroSubtitle || CLIENT_SITE_FALLBACKS.heroSubtitle,
    });
  }, [page, settings]);
}
