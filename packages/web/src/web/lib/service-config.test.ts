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

// fixtureの複数プランは汎用ヘルパーの分岐を残すための架空カタログ。
// 現行の販売カタログ(単一プラン)を表すものではない。
describe("service Stripe URL selection", () => {
  test("keeps primary CTA on the recommended plan", () => {
    const config = configWithPlans([
      plan({
        name: "ライトプラン",
        price: "¥20,000",
        stripeUrl: "https://buy.stripe.com/light",
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
        name: "ライトプラン",
        price: "¥20,000",
        stripeUrl: "https://buy.stripe.com/light",
      }),
    ]);

    expect(startingStripeUrl(config)).toBe("https://buy.stripe.com/light");
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

  // Codex T-8 P1: 旧2プラン設定が保存済みのサイトで、廃止済み¥10,000と
  // 旧販売条件がJAにだけ再表示され、EN(30kのみ)と食い違う縮退の回帰ガード
  test("migrates a saved two-plan config to the single assisted plan", () => {
    const parsed = parseServicePageConfig(
      JSON.stringify({
        hero: { title: "旧ヒーロー", body: "¥10,000から" },
        pricing: {
          noteOnline: "設置リンクをお送りします",
          plans: [
            {
              name: "自分で立てる",
              price: "¥10,000",
              sub: "旧",
              points: [],
              stripeUrl: "https://buy.stripe.com/self-custom",
              cta: "旧",
              primary: false,
            },
            {
              name: "公開おまかせ",
              price: "¥30,000",
              sub: "旧",
              points: [],
              stripeUrl: "https://buy.stripe.com/assisted-custom",
              cta: "旧",
              primary: true,
            },
          ],
        },
        examples: { title: "カスタム実例タイトル" },
        finalCta: {
          title: "旧CTA",
          snsLinks: [{ label: "IG", url: "https://instagram.com/custom" }],
        },
      }),
    );

    expect(parsed.pricing.plans).toHaveLength(1);
    expect(parsed.pricing.plans[0]?.name).toBe("公開おまかせ");
    expect(parsed.pricing.plans[0]?.price).toBe("¥30,000");
    // 配布先が独自に設定したPayment Linkは維持する
    expect(parsed.pricing.plans[0]?.stripeUrl).toBe(
      "https://buy.stripe.com/assisted-custom",
    );
    // 販売条件の節は現行既定へ
    expect(parsed.hero).toEqual(DEFAULT_SERVICE_CONFIG.hero);
    expect(parsed.pricing.noteOnline).toBe(
      DEFAULT_SERVICE_CONFIG.pricing.noteOnline,
    );
    expect(parsed.faq).toEqual(DEFAULT_SERVICE_CONFIG.faq);
    expect(parsed.stickyCta).toEqual(DEFAULT_SERVICE_CONFIG.stickyCta);
    expect(parsed.finalCta.title).toBe(DEFAULT_SERVICE_CONFIG.finalCta.title);
    // 販売条件と無関係なカスタム値は維持
    expect(parsed.finalCta.snsLinks).toEqual([
      { label: "IG", url: "https://instagram.com/custom" },
    ]);
    expect(parsed.examples.title).toBe("カスタム実例タイトル");
    // 廃止プランの痕跡が出力に残らない
    expect(JSON.stringify(parsed)).not.toContain("¥10,000");
    expect(JSON.stringify(parsed)).not.toContain("自分で立てる");
  });

  // Codex T-8 2周目P1: self署名プラン単独では発動しない(配布先の正当な
  // カスタムカタログを既定で上書きしない)
  test("leaves a legitimate single ¥10,000 custom plan untouched", () => {
    const parsed = parseServicePageConfig(
      JSON.stringify({
        hero: { title: "配布先カスタムヒーロー" },
        pricing: {
          noteOnline: "配布先カスタム案内",
          plans: [
            {
              name: "ミニプラン",
              price: "¥10,000",
              sub: "配布先の独自商品",
              points: ["独自内容"],
              stripeUrl: "https://buy.stripe.com/distributed-mini",
              cta: "申し込む",
              primary: true,
            },
          ],
        },
      }),
    );

    expect(parsed.pricing.plans).toHaveLength(1);
    expect(parsed.pricing.plans[0]?.name).toBe("ミニプラン");
    expect(parsed.pricing.plans[0]?.price).toBe("¥10,000");
    expect(parsed.hero.title).toBe("配布先カスタムヒーロー");
    expect(parsed.pricing.noteOnline).toBe("配布先カスタム案内");
  });

  test("leaves a self-signature plan beside an unrelated plan untouched", () => {
    const parsed = parseServicePageConfig(
      JSON.stringify({
        pricing: {
          plans: [
            {
              name: "Self shooting plan",
              price: "¥10,000",
              sub: "独自",
              points: [],
              stripeUrl: "https://buy.stripe.com/self-shooting",
              cta: "Book",
              primary: false,
            },
            {
              name: "プレミアム",
              price: "¥50,000",
              sub: "独自",
              points: [],
              stripeUrl: "https://buy.stripe.com/premium",
              cta: "申し込む",
              primary: true,
            },
          ],
        },
      }),
    );

    expect(parsed.pricing.plans).toHaveLength(2);
    expect(parsed.pricing.plans.map((p) => p.price)).toEqual([
      "¥10,000",
      "¥50,000",
    ]);
  });

  // Codexデバッグ 2026-07-20 P1: 金額の一致だけでは旧構成とみなさない
  // (¥10,000+¥30,000の正当なカスタム2プランを保存時に既定へ上書きしない)
  test("leaves a custom two-tier catalog without legacy names untouched", () => {
    const parsed = parseServicePageConfig(
      JSON.stringify({
        pricing: {
          plans: [
            {
              name: "Basic",
              price: "¥10,000",
              sub: "独自ベーシック",
              points: ["独自内容"],
              stripeUrl: "https://buy.stripe.com/custom-basic",
              cta: "申し込む",
              primary: false,
            },
            {
              name: "Premium",
              price: "¥30,000",
              sub: "独自プレミアム",
              points: ["独自内容"],
              stripeUrl: "https://buy.stripe.com/custom-premium",
              cta: "申し込む",
              primary: true,
            },
          ],
        },
      }),
    );

    expect(parsed.pricing.plans).toHaveLength(2);
    expect(parsed.pricing.plans.map((p) => p.name)).toEqual([
      "Basic",
      "Premium",
    ]);
  });

  // Codexデバッグ 2026-07-20 P1: points内の非文字列要素は描画時にReactの子に
  // できず販売ページ全体が落ちるため、壊れたプランだけを除外する
  test("drops a plan whose points contain non-string entries", () => {
    const parsed = parseServicePageConfig(
      JSON.stringify({
        pricing: {
          plans: [
            {
              name: "壊れたプラン",
              price: "¥30,000",
              sub: "",
              points: [{}],
              stripeUrl: "https://buy.stripe.com/broken",
              cta: "申し込む",
              primary: true,
            },
            {
              name: "正常プラン",
              price: "¥30,000",
              sub: "カスタム説明",
              points: ["正常項目"],
              stripeUrl: "https://buy.stripe.com/valid",
              cta: "申し込む",
              primary: true,
            },
          ],
        },
      }),
    );

    expect(parsed.pricing.plans.map((p) => p.name)).toEqual(["正常プラン"]);
  });

  test("keeps a saved single-plan config untouched by the migration", () => {
    const parsed = parseServicePageConfig(
      JSON.stringify({
        pricing: {
          plans: [
            {
              name: "公開おまかせ",
              price: "¥30,000",
              sub: "カスタム説明",
              points: ["カスタム項目"],
              stripeUrl: "https://buy.stripe.com/assisted-custom",
              cta: "申し込む",
              primary: true,
            },
          ],
        },
      }),
    );

    expect(parsed.pricing.plans).toHaveLength(1);
    expect(parsed.pricing.plans[0]?.sub).toBe("カスタム説明");
    expect(parsed.pricing.plans[0]?.stripeUrl).toBe(
      "https://buy.stripe.com/assisted-custom",
    );
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
