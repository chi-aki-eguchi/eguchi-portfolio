import { describe, expect, test } from "bun:test";
import { SERVICE_START_COPY, getCheckoutArrivalCopy } from "./service-start-copy";

describe("getCheckoutArrivalCopy", () => {
  const languages = ["ja", "en"] as const;

  const assertBannerShape = (language: "ja" | "en") => {
    const banner = getCheckoutArrivalCopy(language, "?thanks=1");
    expect(banner).not.toBeNull();
    expect(banner).toEqual(expect.objectContaining({
      badge: expect.any(String),
      title: expect.any(String),
      body: expect.any(String),
      summaryRows: expect.any(Array),
    }));
    expect(banner?.summaryRows).toHaveLength(3);
    expect(banner?.summaryRows[0]).toMatchObject({
      label: expect.any(String),
      value: expect.any(String),
    });
  };

  test("returns null for a generic visit", () => {
    for (const language of languages) {
      expect(getCheckoutArrivalCopy(language, "")).toBeNull();
      expect(getCheckoutArrivalCopy(language, "?utm_source=test")).toBeNull();
    }
  });

  test("returns banner for thanks flag in both languages", () => {
    for (const language of languages) {
      const banner = getCheckoutArrivalCopy(language, "?thanks=1");
      expect(banner).not.toBeNull();
      expect(banner?.badge).toBe(SERVICE_START_COPY[language].arrival.badge);
    }
  });

  test("returns banner for forged thanks flag value", () => {
    for (const language of languages) {
      const banner = getCheckoutArrivalCopy(language, "?thanks=foo");
      expect(banner).not.toBeNull();
      expect(banner).toEqual(expect.objectContaining({
        summaryRows: expect.arrayContaining([]),
      }));
    }
  });

  test("returns banner for fake checkout session id in both languages", () => {
    for (const language of languages) {
      const banner = getCheckoutArrivalCopy(language, "?checkout_session_id=cs_test_fake");
      assertBannerShape(language);
      expect(banner).toEqual(expect.objectContaining({
        body: SERVICE_START_COPY[language].arrival.body,
      }));
    }
  });
});
