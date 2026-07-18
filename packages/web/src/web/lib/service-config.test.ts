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

  test("states the purchase scope and concierge delivery terms", () => {
    const faqText = DEFAULT_SERVICE_CONFIG.faq.items
      .map(({ q, a }) => `${q}${a}`)
      .join("");
    expect(faqText).toContain("1回の購入につき1サイト");
    expect(faqText).toContain("再販売・再配布はできません");
    expect(faqText).toContain("現時点では無償");
    expect(faqText).toContain("当面は期間・回数の制限なく受け付けます");
    expect(faqText).not.toContain("公開後7日間");
    expect(DEFAULT_SERVICE_CONFIG.purchaseFlow.steps[2]?.body).toContain(
      "素材が揃ってから3日以内",
    );
  });

  test("sells a single assisted plan with the domain promise", () => {
    expect(DEFAULT_SERVICE_CONFIG.pricing.plans).toHaveLength(1);
    const [assisted] = DEFAULT_SERVICE_CONFIG.pricing.plans;
    expect(assisted?.name).toBe("公開おまかせ");
    expect(assisted?.price).toBe("¥30,000");
    expect(assisted?.primary).toBe(true);
    expect(assisted?.points.join("")).toContain("独自ドメイン");
    const allText = JSON.stringify(DEFAULT_SERVICE_CONFIG);
    expect(allText).not.toContain("自分で立てる");
    expect(allText).not.toContain("¥10,000");
    expect(allText).not.toContain("設置リンク");
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

  test("fills the experience CTA into older saved configs", () => {
    const parsed = parseServicePageConfig(
      JSON.stringify({ adminShowcase: { title: "以前の見出し" } }),
    );

    expect(parsed.adminShowcase.title).toBe("以前の見出し");
    expect(parsed.adminShowcase.demoCta).toBe("実際に触って確かめる");
  });
});
