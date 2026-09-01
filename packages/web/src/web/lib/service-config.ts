import {
  DEFAULT_SERVICE_FAQ,
  DEFAULT_SERVICE_PLANS,
} from "../../shared/service-defaults";

export type PainSolutionItem = {
  concern: string;
  concernBody: string;
  solution: string;
  solutionBody: string;
};

export type PlanItem = {
  name: string;
  price: string;
  sub: string;
  points: string[];
  stripeUrl: string;
  cta: string;
  primary: boolean;
};

export type StepItem = { title: string; body: string };
export type FaqItem = { q: string; a: string };
export type SnsLinkItem = { label: string; url: string };
export type ExampleLinkItem = { title: string; body: string; href: string };
export type FeatureItem = { title: string; body: string };

export type ServicePageConfig = {
  enabled: "on" | "off";

  hero: {
    label: string;
    title: string;
    body: string;
    facts: FeatureItem[];
    ctaPricing: string;
    ctaExample: string;
  };

  examples: {
    label: string;
    title: string;
    body: string;
    cta: string;
    links: ExampleLinkItem[];
  };

  painSolutions: {
    label: string;
    items: PainSolutionItem[];
  };

  pricing: {
    label: string;
    noteOnline: string;
    noteOffline: string;
    disclaimer: string;
    plans: PlanItem[];
  };

  purchaseFlow: {
    label: string;
    title: string;
    body: string;
    steps: StepItem[];
    footnote: string;
  };

  faq: {
    label: string;
    items: FaqItem[];
  };

  finalCta: {
    title: string;
    body: string;
    ctaOnline: string;
    ctaOffline: string;
    snsLinks: SnsLinkItem[];
  };

  stickyCta: {
    text: string;
    ctaOnline: string;
    ctaOffline: string;
    pricingCta: string;
  };

  adminShowcase: {
    label: string;
    title: string;
    body: string;
    features: FeatureItem[];
    demoCta: string;
  };
};

export const DEFAULT_SERVICE_CONFIG: ServicePageConfig = {
  enabled: "on",

  hero: {
    label: "Portfolio Kit",
    title: "いま見ているこのサイトが、\nそのまま見本です。",
    body: "Aki Eguchi Portfolio Kit は、写真家のための完成済みポートフォリオサイト。\n設定はすべてこちらで行い、あなたの名前とドメインで公開した状態でお渡しします。",
    facts: [
      { title: "Price", body: "¥30,000（買い切り・月額なし）" },
      {
        title: "Included",
        body: "ドメイン取得から公開設定まで、全部おまかせ",
      },
      {
        title: "Launch",
        body: "素材が揃ってから3日以内に納品",
      },
    ],
    ctaPricing: "料金と流れを見る",
    ctaExample: "サイト内を見る",
  },

  examples: {
    label: "Actual site",
    title: "今見ているこのサイトが、\n公開後の見え方の実例です。",
    body: "今見ているこのサイトの Gallery・About・Contact をそのまま確認できます。写真の並び、プロフィール、問い合わせ導線の参考にしてください。",
    cta: "料金を見る",
    links: [
      {
        title: "作品一覧",
        body: "写真の並び、カテゴリ、余白の見え方を確認できます。",
        href: "/gallery",
      },
      {
        title: "プロフィール",
        body: "作家情報、プロフィール写真、文章の入り方を確認できます。",
        href: "/about",
      },
      {
        title: "問い合わせ",
        body: "仕事につながる連絡先とSNS導線の置き方を確認できます。",
        href: "/contact",
      },
    ],
  },

  painSolutions: {
    label: "For photographers",
    items: [
      {
        concern: "作品が流れてしまう",
        concernBody:
          "SNSに投稿した写真は、時間が経つほど見つけてもらいにくくなります。",
        solution: "写真が主役の見え方",
        solutionBody:
          "余白、並び、サイズ感が最初から整った場所に、作品を長く置いておけます。",
      },
      {
        concern: "仕事用に見せる場所がほしい",
        concernBody:
          "依頼や展示の話が来たとき、作品・プロフィール・連絡先をまとめて見せられるURLが必要になります。",
        solution: "プロフィールと連絡先まで一体化",
        solutionBody:
          "作品一覧、プロフィール、問い合わせ導線をひとつのサイトとして見せられます。",
      },
      {
        concern: "写真の並びまで整えたい",
        concernBody:
          "写真の順番、余白、大きさまで、自分の見せ方に合わせて整えられます。",
        solution: "管理画面から更新",
        solutionBody:
          "写真、並び順、プロフィール、連絡先をブラウザから更新できます。",
      },
    ],
  },

  pricing: {
    label: "Pricing",
    noteOnline:
      "決済後は、画面を閉じても大丈夫です。24時間以内に、素材のお願いをメールでお送りします（Stripe の支払い控えも自動で届きます）。",
    noteOffline:
      "いまはオンライン決済を準備中です。当面は上のボタン（メールが開きます）か、下の連絡先からお申し込みください。",
    disclaimer:
      "別途かかる実費: 公開場所が月500〜1,000円程度、独自ドメインが年1,500〜2,000円程度（あなた名義で取得します）。デザイン変更・個別カスタムは別途お見積もりです。",
    plans: [...DEFAULT_SERVICE_PLANS],
  },

  purchaseFlow: {
    label: "After purchase",
    title: "購入後の流れ。",
    body: "決済後24時間以内に素材のお願いが届き、素材が揃ってから3日以内に、公開した状態でお渡しします。",
    steps: [
      {
        title: "決済後の案内（24時間以内）",
        body: "Stripe の支払い控えが届いたあと、24時間以内に素材のお願いをメールでお送りします。決済画面を閉じてしまっても、同じ案内がメールで届きます。",
      },
      {
        title: "素材を送る",
        body: "サイトに出すお名前、プロフィール文、連絡先、SNS、最初に載せたい写真を返信で送ります。数枚だけでも始められます。独自ドメインを使う場合は、画面共有で30分ほど、一緒に取得します（あなた名義）。",
      },
      {
        title: "こちらで設置（3日以内）",
        body: "素材が揃ってから3日以内に、公開場所の設定、ドメイン接続、プロフィールや連絡先の初期設定まで、公開した状態に整えます。",
      },
      {
        title: "納品",
        body: "サイトURL・管理画面URL・パスワードをお渡しします。あとは管理画面から写真を入れるだけ。操作方法の相談は納品後もいつでもどうぞ（当面は期間・回数の制限なし）。",
      },
    ],
    footnote:
      "写真の大きさ調整は、見せたい作品に強弱をつけるための機能です。すべて同じ大きさで整えることもできます。",
  },

  faq: {
    label: "FAQ",
    items: [...DEFAULT_SERVICE_FAQ],
  },

  finalCta: {
    title: "まずは写真を見せてください。",
    body: "どんなサイトになるか、具体的にご案内します。",
    ctaOnline: "公開おまかせを申し込む",
    ctaOffline: "メールで相談する",
    snsLinks: [
      { label: "Instagram", url: "https://instagram.com/chi._.aki._" },
      { label: "X", url: "https://x.com/chi_aki_jpg" },
    ],
  },

  stickyCta: {
    text: "¥30,000・公開までおまかせ",
    ctaOnline: "申し込む",
    ctaOffline: "相談する",
    pricingCta: "料金を見る",
  },

  adminShowcase: {
    label: "Admin panel",
    title: "並べ方12種類・140以上の設定を、管理画面から。",
    body: "コードは触らず、写真の追加から作品の見せ方、プロフィールや連絡先まで、自分の感覚で少しずつ整えられます。",
    features: [
      {
        title: "写真の管理",
        body: "写真の追加、並べ替え、カテゴリ分け、焦点位置の調整まで行えます。",
      },
      {
        title: "並べ方と余白",
        body: "12種類のレイアウトから選び、順番、大きさ、余白を作品に合わせて整えられます。",
      },
      {
        title: "文字と色",
        body: "和英の書体、文字サイズ、行間、背景色、紙やフィルムのような質感を選べます。",
      },
      {
        title: "プロフィールと連絡先",
        body: "名前、経歴、SNS、問い合わせの案内を、日本語と英語で編集できます。",
      },
      {
        title: "シリーズ・カテゴリ",
        body: "作品をシリーズやカテゴリに整理し、カバー写真や説明文を設定できます。",
      },
      {
        title: "共有と検索",
        body: "SNSで見せる画像、サイトの説明、検索サービス向けの情報を整えられます。",
      },
    ],
    demoCta: "実際に触って確かめる",
  },
};

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function arr<T>(v: unknown, fallback: T[], guard: (x: unknown) => x is T): T[] {
  if (!Array.isArray(v)) return fallback;
  return v.filter(guard);
}

function isPainSolution(v: unknown): v is PainSolutionItem {
  if (!isObj(v)) return false;
  return (
    typeof v.concern === "string" &&
    typeof v.concernBody === "string" &&
    typeof v.solution === "string" &&
    typeof v.solutionBody === "string"
  );
}

function isPlan(v: unknown): v is PlanItem {
  if (!isObj(v)) return false;
  return (
    typeof v.name === "string" &&
    typeof v.price === "string" &&
    typeof v.sub === "string" &&
    // 要素の型まで確認しないと、壊れた保存JSON(points内のオブジェクト等)を
    // 通してしまい、描画側がReactの子として出力できずページ全体が落ちる
    Array.isArray(v.points) &&
    v.points.every((p) => typeof p === "string") &&
    typeof v.stripeUrl === "string" &&
    typeof v.cta === "string" &&
    typeof v.primary === "boolean"
  );
}

function isStep(v: unknown): v is StepItem {
  return isObj(v) && typeof v.title === "string" && typeof v.body === "string";
}

function isFaq(v: unknown): v is FaqItem {
  return isObj(v) && typeof v.q === "string" && typeof v.a === "string";
}

function isSnsLink(v: unknown): v is SnsLinkItem {
  return isObj(v) && typeof v.label === "string" && typeof v.url === "string";
}

function isExampleLink(v: unknown): v is ExampleLinkItem {
  return (
    isObj(v) &&
    typeof v.title === "string" &&
    typeof v.body === "string" &&
    typeof v.href === "string"
  );
}

function isFeature(v: unknown): v is FeatureItem {
  return isObj(v) && typeof v.title === "string" && typeof v.body === "string";
}

const D = DEFAULT_SERVICE_CONFIG;

// 2026-07-18 単一プラン化のlegacy migration。旧2プラン時代(自分で立てる¥10,000
// + 公開おまかせ¥30,000)のservicePageConfigがDBに残っているサイトでは、保存値を
// そのまま優先すると廃止済みの¥10,000プランと旧販売条件をJAだけが再表示し、
// EN(ENGLISH_PLAN_COPY=30kのみ)と商品・約束が食い違う。そこで旧プラン署名を
// 検出したら、販売条件に関わる節(hero/pricing/purchaseFlow/faq/finalCta/
// stickyCta)を現行既定へ差し替える。無関係なカスタム値(snsLinks・examples等)と
// 30kプランの既存Stripe URLは保持する。
function legacyPlanYen(price: unknown): number | null {
  if (typeof price !== "string") return null;
  const match = price.match(/[¥￥]\s*([0-9][0-9,]*)|([0-9][0-9,]*)\s*円/);
  const rawYen = match?.[1] ?? match?.[2];
  if (!rawYen) return null;
  const value = Number(rawYen.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

// 金額と名称の両方が旧カタログ一致の場合のみself署名とみなす。金額だけでは
// 正当なカスタム2プラン(例: Basic ¥10,000 + Premium ¥30,000)を旧構成と誤検知
// し、保存時に既定文面で上書きしてしまう(Codexデバッグ 2026-07-20 P1)。
function isLegacySelfPlan(plan: PlanItem): boolean {
  return (
    legacyPlanYen(plan.price) === 10_000 && /自分で立てる|self/i.test(plan.name)
  );
}

function isLegacyAssistedPlan(plan: PlanItem): boolean {
  return (
    legacyPlanYen(plan.price) === 30_000 ||
    /おまかせ|assisted|concierge/i.test(plan.name)
  );
}

// self署名プラン単独では発動しない: 配布先が正当に使う単一¥10,000カスタム
// プラン等を既定で上書きしないため、旧カタログの「組み合わせ」(self署名 +
// 別のおまかせ/30k署名の併存)を必須にする(Codex T-8 2周目P1)。
function findLegacyAssistedPlan(plans: PlanItem[]): PlanItem | undefined {
  if (!plans.some(isLegacySelfPlan)) return undefined;
  return plans.find(
    (plan) => !isLegacySelfPlan(plan) && isLegacyAssistedPlan(plan),
  );
}

function migrateLegacyPlans(plans: PlanItem[]): PlanItem[] {
  const assisted = findLegacyAssistedPlan(plans);
  if (!assisted) return plans;
  const [current] = D.pricing.plans;
  return [
    {
      ...current,
      points: [...current.points],
      // 配布先が独自のPayment Linkを設定済みの場合はそれを残す
      stripeUrl: assisted.stripeUrl,
    },
  ];
}

export function parseServicePageConfig(
  raw: string | undefined,
): ServicePageConfig {
  if (!raw) return D;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return D;
  }
  if (!isObj(parsed)) return D;

  const hero = isObj(parsed.hero) ? parsed.hero : {};
  const examples = isObj(parsed.examples) ? parsed.examples : {};
  const painSolutions = isObj(parsed.painSolutions) ? parsed.painSolutions : {};
  const pricing = isObj(parsed.pricing) ? parsed.pricing : {};
  const purchaseFlow = isObj(parsed.purchaseFlow) ? parsed.purchaseFlow : {};
  const faq = isObj(parsed.faq) ? parsed.faq : {};
  const finalCta = isObj(parsed.finalCta) ? parsed.finalCta : {};
  const stickyCta = isObj(parsed.stickyCta) ? parsed.stickyCta : {};
  const adminShowcase = isObj(parsed.adminShowcase) ? parsed.adminShowcase : {};

  const savedPlans = arr(pricing.plans, D.pricing.plans, isPlan);
  const isLegacyTwoPlan = findLegacyAssistedPlan(savedPlans) !== undefined;
  const plans = migrateLegacyPlans(savedPlans);

  if (isLegacyTwoPlan) {
    return {
      enabled: parsed.enabled === "off" ? "off" : "on",
      // 販売条件に関わる節は現行既定で上書き(冒頭のmigrationコメント参照)
      hero: D.hero,
      pricing: { ...D.pricing, plans },
      purchaseFlow: D.purchaseFlow,
      faq: D.faq,
      stickyCta: D.stickyCta,
      finalCta: {
        ...D.finalCta,
        snsLinks: arr(finalCta.snsLinks, D.finalCta.snsLinks, isSnsLink),
      },
      // 販売条件と無関係な節はカスタム値を維持
      examples: {
        label: str(examples.label, D.examples.label),
        title: str(examples.title, D.examples.title),
        body: str(examples.body, D.examples.body),
        cta: str(examples.cta, D.examples.cta),
        links: arr(examples.links, D.examples.links, isExampleLink),
      },
      painSolutions: {
        label: str(painSolutions.label, D.painSolutions.label),
        items: arr(painSolutions.items, D.painSolutions.items, isPainSolution),
      },
      adminShowcase: {
        label: str(adminShowcase.label, D.adminShowcase.label),
        title: str(adminShowcase.title, D.adminShowcase.title),
        body: str(adminShowcase.body, D.adminShowcase.body),
        features: arr(
          adminShowcase.features,
          D.adminShowcase.features,
          isFeature,
        ),
        demoCta: str(adminShowcase.demoCta, D.adminShowcase.demoCta),
      },
    };
  }

  return {
    enabled: parsed.enabled === "off" ? "off" : "on",

    hero: {
      label: str(hero.label, D.hero.label),
      title: str(hero.title, D.hero.title),
      body: str(hero.body, D.hero.body),
      facts: arr(hero.facts, D.hero.facts, isFeature),
      ctaPricing: str(hero.ctaPricing, D.hero.ctaPricing),
      ctaExample: str(hero.ctaExample, D.hero.ctaExample),
    },

    examples: {
      label: str(examples.label, D.examples.label),
      title: str(examples.title, D.examples.title),
      body: str(examples.body, D.examples.body),
      cta: str(examples.cta, D.examples.cta),
      links: arr(examples.links, D.examples.links, isExampleLink),
    },

    painSolutions: {
      label: str(painSolutions.label, D.painSolutions.label),
      items: arr(painSolutions.items, D.painSolutions.items, isPainSolution),
    },

    pricing: {
      label: str(pricing.label, D.pricing.label),
      noteOnline: str(pricing.noteOnline, D.pricing.noteOnline),
      noteOffline: str(pricing.noteOffline, D.pricing.noteOffline),
      disclaimer: str(pricing.disclaimer, D.pricing.disclaimer),
      plans,
    },

    purchaseFlow: {
      label: str(purchaseFlow.label, D.purchaseFlow.label),
      title: str(purchaseFlow.title, D.purchaseFlow.title),
      body: str(purchaseFlow.body, D.purchaseFlow.body),
      steps: arr(purchaseFlow.steps, D.purchaseFlow.steps, isStep),
      footnote: str(purchaseFlow.footnote, D.purchaseFlow.footnote),
    },

    faq: {
      label: str(faq.label, D.faq.label),
      items: arr(faq.items, D.faq.items, isFaq),
    },

    finalCta: {
      title: str(finalCta.title, D.finalCta.title),
      body: str(finalCta.body, D.finalCta.body),
      ctaOnline: str(finalCta.ctaOnline, D.finalCta.ctaOnline),
      ctaOffline: str(finalCta.ctaOffline, D.finalCta.ctaOffline),
      snsLinks: arr(finalCta.snsLinks, D.finalCta.snsLinks, isSnsLink),
    },

    stickyCta: {
      text: str(stickyCta.text, D.stickyCta.text),
      ctaOnline: str(stickyCta.ctaOnline, D.stickyCta.ctaOnline),
      ctaOffline: str(stickyCta.ctaOffline, D.stickyCta.ctaOffline),
      pricingCta: str(stickyCta.pricingCta, D.stickyCta.pricingCta),
    },

    adminShowcase: {
      label: str(adminShowcase.label, D.adminShowcase.label),
      title: str(adminShowcase.title, D.adminShowcase.title),
      body: str(adminShowcase.body, D.adminShowcase.body),
      features: arr(
        adminShowcase.features,
        D.adminShowcase.features,
        isFeature,
      ),
      demoCta: str(adminShowcase.demoCta, D.adminShowcase.demoCta),
    },
  };
}

export function isStripeLive(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "buy.stripe.com";
  } catch {
    return false;
  }
}

export function anyPlanLive(config: ServicePageConfig): boolean {
  return config.pricing.plans.some((p) => isStripeLive(p.stripeUrl));
}

function yenAmount(price: string): number | null {
  const match = price.match(/[¥￥]\s*([0-9][0-9,]*)|([0-9][0-9,]*)\s*円/);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

export function primaryStripeUrl(config: ServicePageConfig): string | null {
  const primary = config.pricing.plans.find(
    (p) => p.primary && isStripeLive(p.stripeUrl),
  );
  if (primary) return primary.stripeUrl;
  const first = config.pricing.plans.find((p) => isStripeLive(p.stripeUrl));
  return first?.stripeUrl ?? null;
}

/**
 * 決済直後のお礼に出す「何を買ったか」。
 *
 * 決済から戻ってくるURLはプランを区別しないので、**買った本人が誰かは分かるが、
 * どのプランかはURLからは分からない。** 支払える状態にあるプラン（Stripeの
 * リンクが本物のもの）のうち、販売ページで主役として出しているものを採る。
 * 販売ページのボタンが指すプランと同じ選び方なので、単一プランの現状では
 * 必ず一致する。
 *
 * **一致させられないときは null を返す。** 呼び出し側は金額の行ごと出さない。
 * 金額を直書きしていたため、値上げ・値下げをすると販売ページは新しい金額、
 * 支払った直後の画面だけ古い金額、という食い違いが起きていた。
 * 間違った金額を出すより、出さないほうがよい。
 */
export function purchasedPlanFrom(
  config: ServicePageConfig,
): PlanItem | null {
  const live = config.pricing.plans.filter((p) => isStripeLive(p.stripeUrl));
  return live.find((p) => p.primary) ?? live[0] ?? null;
}

export function startingStripeUrl(config: ServicePageConfig): string | null {
  const livePlans = config.pricing.plans.filter((p) =>
    isStripeLive(p.stripeUrl),
  );
  if (livePlans.length === 0) return null;

  const cheapest = livePlans
    .map((plan, index) => ({ plan, index, amount: yenAmount(plan.price) }))
    .filter(
      (item): item is { plan: PlanItem; index: number; amount: number } =>
        item.amount !== null,
    )
    .sort((a, b) => a.amount - b.amount || a.index - b.index)[0];

  return (cheapest?.plan ?? livePlans[0]).stripeUrl;
}

export function mailtoFallback(
  contactEmail: string,
  planName?: string,
): string {
  const subject = planName
    ? `ポートフォリオサイトのお申し込み（${planName}）`
    : "ポートフォリオサイトについて相談";
  return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}`;
}

/* ── 英語ページのプラン表記 ───────────────────────────
   販売ページと、決済直後のお礼画面の**両方**が使う。以前は販売ページの中に
   閉じていて、お礼画面はプラン名と金額を直書きしていた。そのため
   「Assisted Publishing — ¥30,000」（お礼画面）と「Assisted setup」（販売ページ）
   のように、同じ商品の呼び名すら食い違っていた。出どころを1つにする。 */
export const ENGLISH_PLAN_COPY = [
  {
    yen: 30_000,
    namePattern: /おまかせ|assisted|concierge/i,
    name: "Assisted setup",
    sub: "I prepare everything and hand over a site that is already published. You only add photographs.",
    points: [
      "Hosting and admin panel set up for you",
      "Custom domain purchase support and connection (registered in your name; fee separate)",
      "Name, profile, and contact details prepared before handover",
      "After handover, you only add photographs from the admin panel",
      "Guidance on using the site and admin panel — currently unlimited",
    ],
    cta: "Choose assisted setup",
  },
] as const;

export function yenAmountFromPrice(price: string): number | null {
  const match = price.match(/[¥￥]\s*([0-9][0-9,]*)/);
  if (!match) return null;
  const yen = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(yen) ? yen : null;
}

export function priceWithUsdEstimate(price: string): string {
  const yen = yenAmountFromPrice(price);
  if (yen === null) return price;
  const usd = Math.round(yen / 154 / 5) * 5;
  return `${price} (approx. $${usd} USD)`;
}

export function englishPlanSources(source: ServicePageConfig): (PlanItem | undefined)[] {
  const remaining = [...source.pricing.plans];
  return ENGLISH_PLAN_COPY.map((copy) => {
    const matches = [
      (plan: PlanItem) => yenAmountFromPrice(plan.price) === copy.yen,
      (plan: PlanItem) => copy.namePattern.test(plan.name),
    ];
    let index = -1;
    for (const matchesPlan of matches) {
      index = remaining.findIndex(matchesPlan);
      if (index >= 0) break;
    }
    return index >= 0 ? remaining.splice(index, 1)[0] : undefined;
  });
}


/** 英語ページに出すプラン1件。日本語側の設定から金額とStripeリンクを引く。 */
export function englishPlanFor(config: ServicePageConfig): PlanItem | null {
  const sources = englishPlanSources(config);
  for (const [i, copy] of ENGLISH_PLAN_COPY.entries()) {
    const plan = sources[i];
    if (!plan) continue;
    const { yen: _yen, namePattern: _namePattern, ...text } = copy;
    return {
      ...text,
      points: [...text.points],
      price: priceWithUsdEstimate(plan.price),
      stripeUrl: plan.stripeUrl,
      primary: plan.primary,
    };
  }
  return null;
}
