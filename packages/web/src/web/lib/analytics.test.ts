import { describe, expect, test } from "bun:test";
import {
  analyticsEventForLink,
  confirmedDynamicAnalyticsPath,
  isTrackablePublicPath,
} from "./analytics";
import {
  analyticsRoutePath,
  isAnalyticsDynamicPath,
} from "../../shared/analytics-path";

const ORIGIN = "https://akieguchi.com";

describe("public analytics", () => {
  test("tracks real public/support pages but keeps admin and 404 paths out", () => {
    expect(isTrackablePublicPath("/gallery")).toBe(true);
    expect(isTrackablePublicPath("/portfolio-kit/en")).toBe(true);
    expect(isTrackablePublicPath("/start/en")).toBe(true);
    expect(isTrackablePublicPath("/legal")).toBe(true);
    expect(isTrackablePublicPath("/photo/1607?share=private")).toBe(true);
    expect(isTrackablePublicPath("/admin")).toBe(false);
    expect(isTrackablePublicPath("/admin/demo")).toBe(false);
    expect(isTrackablePublicPath("/not-a-page")).toBe(false);
    expect(isTrackablePublicPath("/photo/01")).toBe(false);
  });

  test("waits for detail API success only on dynamic SPA routes", () => {
    expect(isAnalyticsDynamicPath("/series/sea")).toBe(true);
    expect(isAnalyticsDynamicPath("/work/client-a/")).toBe(true);
    expect(isAnalyticsDynamicPath("/photo/1607?share=private")).toBe(true);
    expect(isAnalyticsDynamicPath("/photo/01")).toBe(false);
    expect(isAnalyticsDynamicPath("/contact")).toBe(false);
    expect(analyticsRoutePath("/series/sea/?preview=1#top")).toBe(
      "/series/sea",
    );
    expect(
      confirmedDynamicAnalyticsPath(
        "/series/missing",
        "/series/missing",
        false,
      ),
    ).toBe("/series/missing");
    expect(
      confirmedDynamicAnalyticsPath(
        "/series/late-response",
        "/series/current",
        false,
      ),
    ).toBeNull();
    expect(
      confirmedDynamicAnalyticsPath(
        "/series/current",
        "/series/current",
        true,
      ),
    ).toBeNull();
    expect(
      confirmedDynamicAnalyticsPath("/contact", "/contact", false),
    ).toBeNull();
    expect(
      confirmedDynamicAnalyticsPath(
        "/series/client%3Aone",
        "/series/client:one",
        false,
      ),
    ).toBe("/series/client:one");
  });

  test("classifies the actions that lead to an inquiry or purchase", () => {
    expect(
      analyticsEventForLink("/contact?from=gallery", "/gallery", ORIGIN)?.name,
    ).toBe("contact_cta_click");
    expect(
      analyticsEventForLink(
        "https://buy.stripe.com/example?prefilled_email=private",
        "/portfolio-kit",
        ORIGIN,
      ),
    ).toEqual({
      name: "portfolio_kit_checkout_click",
      params: {
        from_path: "/portfolio-kit",
        destination_path: "/checkout",
        destination_host: "buy.stripe.com",
      },
    });
    expect(
      analyticsEventForLink("/admin/demo", "/portfolio-kit", ORIGIN)?.name,
    ).toBe("portfolio_kit_demo_click");
  });

  test("tracks language changes and ordinary outbound links without query data", () => {
    expect(analyticsEventForLink("/en/about", "/about", ORIGIN)).toEqual({
      name: "language_switch",
      params: {
        from_path: "/about",
        destination_path: "/en/about",
        destination_host: "akieguchi.com",
        language: "en",
      },
    });
    expect(
      analyticsEventForLink("/contact", "/en/contact", ORIGIN)?.name,
    ).toBe("language_switch");
    expect(
      analyticsEventForLink("/privacy/en", "/privacy", ORIGIN),
    ).toMatchObject({ name: "language_switch", params: { language: "en" } });
    expect(
      analyticsEventForLink(
        "/portfolio-kit",
        "/portfolio-kit/en",
        ORIGIN,
      ),
    ).toMatchObject({ name: "language_switch", params: { language: "ja" } });
    expect(
      analyticsEventForLink(
        "https://www.instagram.com/example/?secret=x",
        "/about",
        ORIGIN,
      ),
    ).toEqual({
      name: "outbound_click",
      params: {
        from_path: "/about",
        destination_path: "/example",
        destination_host: "www.instagram.com",
      },
    });
  });

  test("removes a photo id and query data from conversion events", () => {
    expect(
      analyticsEventForLink(
        "/contact?photo=1607",
        "/photo/1607?share=private",
        ORIGIN,
      ),
    ).toEqual({
      name: "contact_cta_click",
      params: {
        from_path: "/photo/:id",
        destination_path: "/contact",
        destination_host: "akieguchi.com",
      },
    });
  });

  test("ignores non-web links and ordinary internal navigation", () => {
    expect(analyticsEventForLink("mailto:test@example.com", "/contact", ORIGIN)).toBeNull();
    expect(analyticsEventForLink("/gallery", "/", ORIGIN)).toBeNull();
  });
});
