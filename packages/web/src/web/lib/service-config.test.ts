import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SERVICE_CONFIG,
  parseServicePageConfig,
  primaryStripeUrl,
  startingStripeUrl,
  type PlanItem,
  type ServicePageConfig,
} from "./service-config";

const plan = (patch: Partial<PlanItem>): PlanItem => ({
  name: "Plan",
  price: "¥10,000",
  sub: "",
  points: [],
  stripeUrl: "https://buy.stripe.com/default",
  cta: "申し込む",
  primary: false,
  ...patch,
});

const configWithPlans = (plans: PlanItem[]): ServicePageConfig => ({
  ...DEFAULT_SERVICE_CONFIG,
  pricing: {
    ...DEFAULT_SERVICE_CONFIG.pricing,
    plans,
  },
});

describe("service Stripe URL selection", () => {
  test("keeps primary CTA on the recommended plan", () => {
    const config = configWithPlans([
      plan({
        name: "自分で立てる",
        price: "¥10,000",
        stripeUrl: "https://buy.stripe.com/starter",
      }),
      plan({
        name: "公開おまかせ",
        price: "¥30,000",
        stripeUrl: "https://buy.stripe.com/concierge",
        primary: true,
      }),
    ]);

    expect(primaryStripeUrl(config)).toBe("https://buy.stripe.com/concierge");
  });

  test("sends the starting-price CTA to the cheapest live plan", () => {
    const config = configWithPlans([
      plan({
        name: "公開おまかせ",
        price: "¥30,000",
        stripeUrl: "https://buy.stripe.com/concierge",
        primary: true,
      }),
      plan({
        name: "自分で立てる",
        price: "¥10,000",
        stripeUrl: "https://buy.stripe.com/starter",
      }),
    ]);

    expect(startingStripeUrl(config)).toBe("https://buy.stripe.com/starter");
  });

  test("falls back to the first live plan when prices are not numeric", () => {
    const config = configWithPlans([
      plan({
        price: "ご相談",
        stripeUrl: "https://buy.stripe.com/custom",
      }),
      plan({
        price: "Ask",
        stripeUrl: "https://buy.stripe.com/ask",
      }),
    ]);

    expect(startingStripeUrl(config)).toBe("https://buy.stripe.com/custom");
  });
});

describe("Portfolio Kit config migration", () => {
  test("promises the post-purchase email within 24 hours", () => {
    expect(DEFAULT_SERVICE_CONFIG.pricing.noteOnline).toContain("24時間以内");
    expect(DEFAULT_SERVICE_CONFIG.purchaseFlow.body).toContain("24時間以内");
  });

  test("fills new first-view facts into older saved configs", () => {
    const parsed = parseServicePageConfig(
      JSON.stringify({
        hero: {
          label: "Old label",
          title: "Old title",
          body: "Old body",
        },
      }),
    );

    expect(parsed.hero.title).toBe("Old title");
    expect(parsed.hero.facts).toEqual(DEFAULT_SERVICE_CONFIG.hero.facts);
  });
});
