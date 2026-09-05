import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  ANALYTICS_PAGE_READY_EVENT,
  analyticsEventForLink,
  confirmedDynamicAnalyticsPath,
  isTrackablePublicPath,
  sendAnalyticsEvent,
  sendSpaPageView,
} from "../lib/analytics";
import {
  isAnalyticsDynamicPath,
} from "../../shared/analytics-path";

/**
 * Completes the server-injected GA page view for this SPA and observes the
 * small set of public actions that lead to an inquiry or sale.
 */
export function PublicAnalytics() {
  const [location] = useLocation();
  const hasMounted = useRef(false);
  // Dynamic routes begin unresolved and become eligible for both page-view and
  // CTA events only after their detail API returns a real public record.
  const activePageResolved = useRef(!isAnalyticsDynamicPath(location));
  // The server normally owns the first document page_view. If its detail lookup
  // failed transiently, its bootstrap explicitly leaves this false so the
  // browser can recover the hit after the API confirms the real record.
  const dynamicNavigationNeedsPageView = useRef(false);

  useEffect(() => {
    // The initial document already sends a page_view in the server-injected GA
    // config. Only client-side navigations belong here, otherwise every landing
    // is counted twice.
    if (!hasMounted.current) {
      hasMounted.current = true;
      activePageResolved.current = !isAnalyticsDynamicPath(location);
      dynamicNavigationNeedsPageView.current =
        isAnalyticsDynamicPath(location) &&
        window.__portfolioInitialPageViewSent !== true;
      return;
    }
    // A syntactically valid detail URL can still be unpublished or missing.
    // Its page component sends a ready event after the detail API returns 200.
    if (isAnalyticsDynamicPath(location)) {
      activePageResolved.current = false;
      dynamicNavigationNeedsPageView.current = true;
      return;
    }
    activePageResolved.current = true;
    dynamicNavigationNeedsPageView.current = false;
    // Route titles are applied by the page component in the same commit. Defer
    // one task so `page_title` reflects the destination, not the page we left.
    const timer = window.setTimeout(() => sendSpaPageView(location), 0);
    return () => window.clearTimeout(timer);
  }, [location]);

  useEffect(() => {
    const onPageReady = (event: Event) => {
      const path = (event as CustomEvent<{ path?: unknown }>).detail?.path;
      if (typeof path !== "string") return;
      const routePath = confirmedDynamicAnalyticsPath(
        path,
        window.location.pathname,
        activePageResolved.current,
      );
      if (!routePath) return;
      activePageResolved.current = true;
      // Detail pages signal only after their title-setting effect and settings
      // query are ready, so this cannot inherit the title of the page we left.
      if (dynamicNavigationNeedsPageView.current) {
        dynamicNavigationNeedsPageView.current = false;
        sendSpaPageView(routePath);
      }
    };
    window.addEventListener(ANALYTICS_PAGE_READY_EVENT, onPageReady);
    return () =>
      window.removeEventListener(ANALYTICS_PAGE_READY_EVENT, onPageReady);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!isTrackablePublicPath(window.location.pathname)) return;
      if (!activePageResolved.current) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const measurement = analyticsEventForLink(
        link.href,
        window.location.pathname,
        window.location.origin,
      );
      if (!measurement) return;
      const explicit = link.dataset.analyticsEvent;
      const eventName =
        explicit === "print_store_click" ? explicit : measurement.name;
      sendAnalyticsEvent(eventName, measurement.params);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
