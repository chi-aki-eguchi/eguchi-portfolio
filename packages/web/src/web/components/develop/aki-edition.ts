import { createContext, useContext } from "react";
import { developTopStyle } from "../../../shared/develop-structure";
import { isServiceOwnerSite } from "../../../shared/service-visibility";
import { siteDesignFrom } from "../../lib/book";
import type { DevelopPhoto } from "./DevelopHome";

export type AkiWork = { href: string; title: string; photo: DevelopPhoto | null };
export type AkiSettings = Record<string, string | undefined>;
export function usesAkiEdition(settings: AkiSettings | undefined, path: string, host?: string) {
  return (
    !!settings &&
    siteDesignFrom(settings.siteDesign) === "develop" &&
    developTopStyle(settings.developTopStyle) === "spread" &&
    isServiceOwnerSite(settings.siteUrl, host) &&
    /^\/(?:|(?:works|gallery|portrait|life|info)|(?:photo|series|work|exhibition)(?:\/[^/]+)?)\/?$/.test(path)
  );
}

/** Keep the gallery position on the history entry it belongs to, before the body is locked. */
export function rememberAkiGallerySpot(photoId?: number) {
  if (window.location.pathname !== "/gallery") return;
  const path = window.location.pathname + window.location.search;
  window.history.replaceState(
    { ...window.history.state, akiSpot: { path, y: window.scrollY, id: photoId } },
    "",
  );
}

export const AkiEdition = createContext<{
  name: string;
  exhibitionOnTop: boolean;
  entries: AkiWork[];
  pending: boolean;
  failed: boolean;
  retry: () => void;
} | null>(null);
export const useAkiEdition = () => useContext(AkiEdition);
