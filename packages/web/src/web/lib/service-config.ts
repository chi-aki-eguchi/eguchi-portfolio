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
    body: "Aki Eguchi Portfolio Kit は、写真家のための完成済みポートフォリオサイト。\n写真と文章を入れ替えれば、あなたの名前とドメインで公開できます。",
    facts: [
      { title: "Price", body: "¥10,000〜（買い切り）" },
      {
        title: "Included",
        body: "サイト一式・管理画面・公開ガイド",
      },
      {
        title: "Launch",
        body: "自分で10〜15分／公開おまかせも選べます",
      },
    ],
    ctaPricing: "プランと料金を見る",
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
      "購入後は24時間以内に、設置リンクと選んだプランのご案内をメールでお送りします。Stripe の支払い控えも届きます。",
    noteOffline:
      "いまはオンライン決済を準備中です。当面は上のボタン（メールが開きます）か、下の連絡先からお申し込みください。",
    disclaimer:
      "公開場所・独自ドメインなどの外部費用は別途かかります。デザイン変更や個別カスタムは別途お見積もりになります。",
    plans: [
      {
        name: "自分で立てる",
        price: "¥10,000",
        sub: "手順を見ながら、ご自身でサイトを公開するプランです。",
        points: [
          "テンプレート利用料",
          "公開までのガイド付き",
          "チェックリスト付き",
          "独自ドメイン接続の手順付き",
          "操作方法に関する初回相談つき",
        ],
        stripeUrl: "https://buy.stripe.com/8x25kDdou8xldeEfHqgrS00",
        cta: "このプランを申し込む",
        primary: false,
      },
      {
        name: "公開おまかせ",
        price: "¥30,000",
        sub: "初期設定はこちらで行い、公開できる状態まで整えるプランです。",
        points: [
          "初期設定の代行",
          "公開場所の設定",
          "独自ドメイン接続対応",
          "写真と文章の入れ方を案内",
          "公開後7日間の簡単な操作相談つき",
        ],
        stripeUrl: "https://buy.stripe.com/aFa14n0BIcNB0rScvegrS01",
        cta: "このプランを申し込む",
        primary: true,
      },
    ],
  },

  purchaseFlow: {
    label: "After purchase",
    title: "購入後の流れ。",
    body: "購入後は24時間以内に、設置リンクと選んだプランのご案内をメールでお送りします。写真の入れ方や管理画面での更新も、最初にまとめてお伝えします。",
    steps: [
      {
        title: "決済後の案内",
        body: "Stripe の支払い控えが届いたあと、24時間以内に設置リンクと次の案内をメールでお送りします。",
      },
      {
        title: "管理画面で更新",
        body: "写真の追加、並び替え、プロフィール、連絡先、見た目の調整をブラウザから行えます。",
      },
      {
        title: "自分で立てる場合",
        body: "立ち上げ用リンクと手順書を見ながら公開します。操作方法に関する初回相談も含みます。",
      },
      {
        title: "公開おまかせの場合",
        body: "写真・プロフィール・連絡先などの素材が揃ってから3日以内に、サイトURL、管理画面URL、パスワードを渡します。公開後7日間の操作相談も含みます。",
      },
    ],
    footnote:
      "写真の大きさ調整は、見せたい作品に強弱をつけるための機能です。すべて同じ大きさで整えることもできます。",
  },

  faq: {
    label: "FAQ",
    items: [
      {
        q: "購入したあと、すぐサイトが自動でできますか？",
        a: "いいえ。決済後すぐに自動生成されるサービスではありません。確認後、選んだプランに合わせてご案内します。自分で立てるプランは手順をお送りします。公開おまかせプランは、こちらで初期設定を進めます。",
      },
      {
        q: "自分のドメインを使えますか？",
        a: "yourname.com のような自分のURLで公開できるように設定することです。すでにドメインをお持ちの場合は接続を案内します。まだお持ちでない場合は、取得方法からご案内できます。",
      },
      {
        q: "維持費や月額料金はいくらですか？",
        a: "Portfolio Kit自体の月額料金はありません。ただし、公開場所や独自ドメインなど、外部サービスの実費がかかります。公開場所は月500〜1,000円程度が目安で、料金改定や使用量により変わります。",
      },
      {
        q: "あとから写真や文章を変えられますか？",
        a: "はい。管理画面から写真、並び順、プロフィール、連絡先などを更新できます。大きなデザイン変更や個別カスタムは、内容に応じて別途ご相談になります。",
      },
      {
        q: "購入すると、どこまで利用できますか？",
        a: "1回の購入につき1サイトで利用できます。2サイト目以降は追加購入が必要です。テンプレートとしての再販売・再配布はできません。テンプレート本体の更新は現時点では無償で提供しますが、今後変更する場合があります。自分で立てるプランは操作方法の初回相談、公開おまかせプランは公開後7日間の操作相談を含みます。それ以降の相談・作業、デザイン変更、個別カスタムは内容に応じて別途お見積もりします。",
      },
      {
        q: "やめたいときはどうなりますか？",
        a: "公開場所の契約を止めれば、月々の実費も止められます。プロジェクトを削除すると写真や設定も消えるため、必要な写真や文章は先に手元へ保存してください。",
      },
    ],
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
    text: "¥10,000 から始められます",
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
    Array.isArray(v.points) &&
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
      plans: arr(pricing.plans, D.pricing.plans, isPlan),
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
