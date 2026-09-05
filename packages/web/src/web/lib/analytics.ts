/**
 * Public-site analytics helpers.
 *
 * The initial page view is sent by the GA snippet injected by the server. This
 * module covers the navigation and buying actions that happen afterwards in
 * the SPA. Values are deliberately limited to route/host names: form fields,
 * photo ids, checkout tokens, and query strings must never be sent here.
 */

import {
  analyticsPagePath,
  analyticsRoutePath,
  comparableAnalyticsRoutePath,
  isAnalyticsDynamicPath,
  isAnalyticsPublicPath,
} from "../../shared/analytics-path";

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    /** Set by the server GA bootstrap so a recovered detail page is not lost or doubled. */
    __portfolioInitialPageViewSent?: boolean;
  }
}

export type AnalyticsEvent = {
  name: string;
  params: Record<string, string>;
};

export const ANALYTICS_PAGE_READY_EVENT = "portfolio:analytics-page-ready";

/** Signal that a dynamic route's API returned a real public page. */
export function signalAnalyticsPageReady(path: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ path: string }>(ANALYTICS_PAGE_READY_EVENT, {
      detail: { path },
    }),
  );
}

/** Accept a ready signal only for the dynamic route currently on screen. */
export function confirmedDynamicAnalyticsPath(
  signaledPath: string,
  currentPath: string,
  alreadyResolved: boolean,
): string | null {
  if (alreadyResolved || !isAnalyticsDynamicPath(signaledPath)) return null;
  if (
    comparableAnalyticsRoutePath(signaledPath) !==
    comparableAnalyticsRoutePath(currentPath)
  ) {
    return null;
  }
  return analyticsRoutePath(currentPath);
}

const LANGUAGE_PAIRS = new Set([
  "/about|/en/about",
  "/contact|/en/contact",
  "/privacy|/privacy/en",
  "/terms|/terms/en",
  "/portfolio-kit|/portfolio-kit/en",
]);

export function isTrackablePublicPath(path: string): boolean {
  return isAnalyticsPublicPath(path);
}

export function analyticsEventForLink(
  rawHref: string,
  currentPath: string,
  origin: string,
): AnalyticsEvent | null {
  let target: URL;
  try {
    target = new URL(rawHref, origin);
  } catch {
    return null;
  }

  if (!/^https?:$/.test(target.protocol)) return null;
  const from = analyticsPagePath(currentPath);
  const to = analyticsPagePath(target.pathname);
  const params = {
    from_path: from,
    destination_path: to,
    destination_host: target.host,
  };

  if (target.host === "buy.stripe.com") {
    return {
      name: "portfolio_kit_checkout_click",
      // A payment-link path can contain a reusable checkout token. The event
      // needs only to record that checkout was opened, not which secret URL did it.
      params: { ...params, destination_path: "/checkout" },
    };
  }
  if (to === "/admin/demo" && from.startsWith("/portfolio-kit")) {
    return { name: "portfolio_kit_demo_click", params };
  }
  if (
    LANGUAGE_PAIRS.has(`${from}|${to}`) ||
    LANGUAGE_PAIRS.has(`${to}|${from}`)
  ) {
    return {
      name: "language_switch",
      params: {
        ...params,
        language:
          to.startsWith("/en/") || to.endsWith("/en") ? "en" : "ja",
      },
    };
  }
  if (to === "/contact" || to === "/en/contact") {
    return { name: "contact_cta_click", params };
  }
  if (target.origin !== origin) {
    return { name: "outbound_click", params };
  }
  return null;
}

export function sendAnalyticsEvent(
  name: string,
  params: Record<string, string> = {},
): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

export function sendSpaPageView(path: string): void {
  if (!isTrackablePublicPath(path) || typeof document === "undefined") return;
  sendAnalyticsEvent("page_view", {
    page_path: analyticsPagePath(path),
    page_location: `${window.location.origin}${analyticsPagePath(path)}`,
    page_title: document.title,
  });
}
