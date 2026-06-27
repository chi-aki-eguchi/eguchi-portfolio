import { usePageEntrance } from "../hooks/usePageEntrance";

// Stripe Payment Links (live). These are public checkout links — safe to keep in
// the repo. Never put Stripe secret keys / webhook secrets / dashboard URLs here.
// Both being real https links flips STRIPE_LIVE → true: buttons point at Stripe and
// the "online payment in prep" note disappears.
const STRIPE_SELF = "https://buy.stripe.com/8x25kDdou8xldeEfHqgrS00";
const STRIPE_CONCIERGE = "https://buy.stripe.com/aFa14n0BIcNB0rScvegrS01";
// Until BOTH are real https links, the page shows the "in preparation" copy and the
// buttons open an email inquiry instead of a dead anchor — so a click is never a
// dead end, and nobody mistakes it for a completed purchase.
const STRIPE_LIVE = /^https?:/.test(STRIPE_SELF) && /^https?:/.test(STRIPE_CONCIERGE);
const INQUIRY_EMAIL = "akieguchi33@gmail.com";

const labelCls = "font-en uppercase text-center";
const labelStyle = {
  fontSize: "var(--section-label-size, 0.75rem)",
  color: `rgba(var(--foreground-rgb), var(--section-label-opacity, 0.35))`,
  letterSpacing: "var(--section-label-tracking, 0.10em)",
  lineHeight: "var(--section-leading, 1.2)",
} as const;
const bodyStyle = {
  fontSize: "var(--body-size, 0.9rem)",
  lineHeight: "var(--body-leading, 1.95)",
  letterSpacing: "var(--body-tracking, 0.01em)",
} as const;

const FEATURES = [
  {
    title: "写真が主役の見え方",
    body: "余白、並び、サイズ感が最初から整ったポートフォリオ。写真を入れるだけで、作品集のように見せられます。",
  },
  {
    title: "管理画面から更新",
    body: "写真の追加、並び替え、プロフィール、連絡先をブラウザから編集。コードを触らずに運用できます。",
  },
  {
    title: "作品ごとの見せ方",
    body: "S / M / L のサイズ指定、カテゴリ、シリーズ表示に対応。写真の強弱を自分で調整できます。",
  },
  {
    title: "公開後の基本整備",
    body: "スマホ表示、SNS共有、検索向けの情報、問い合わせ導線まで、写真家サイトに必要な土台を揃えています。",
  },
] as const;

const STEPS = [
  "申し込み後に、手順書または設定のご案内を送ります。",
  "サイト名、プロフィール文、連絡先、使いたい写真を準備します。",
  "管理画面から写真を入れて、並びと見せ方を整えます。",
  "公開URLを確認し、必要なら独自ドメインを接続します。",
] as const;

const FAQS = [
  {
    q: "独自ドメイン対応ってどういう意味？",
    a: "お持ちのドメイン、または新しく取得したドメインをサイトに接続できる作りです。ドメインの取得費・更新費は料金に含みません。おまかせ設定では接続作業まで対応し、自分で立てる場合は手順を案内します。",
  },
  {
    q: "月額料金はかかりますか？",
    a: "このサービス自体の月額はありません。サイトを公開する場所の実費が、目安として月500〜1,000円程度かかります。",
  },
  {
    q: "あとから写真や文章を変えられますか？",
    a: "変えられます。管理画面から写真、プロフィール、連絡先、表示順などを更新できます。",
  },
] as const;

function SectionLabel({ children }: { children: string }) {
  return (
    <p className={`${labelCls} mb-8`} style={labelStyle}>
      {children}
    </p>
  );
}

function SitePreview() {
  return (
    <figure
      className="page-entrance page-entrance-delay-2 mt-12 md:mt-16 border-y border-[rgba(var(--foreground-rgb),0.08)] py-6 md:py-8"
      aria-label="ポートフォリオサイトの表示イメージ"
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between border-b border-[rgba(var(--foreground-rgb),0.07)] pb-4">
          <p className="font-en text-[0.72rem] tracking-[0.16em] uppercase text-[rgba(var(--foreground-rgb),0.42)]">
            Aki Eguchi
          </p>
          <div className="hidden sm:flex gap-5 font-en text-[0.62rem] tracking-[0.12em] uppercase text-[rgba(var(--foreground-rgb),0.30)]">
            <span>Gallery</span>
            <span>About</span>
            <span>Contact</span>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-3 md:gap-4 pt-5 md:pt-6">
          <div className="col-span-7 h-52 md:h-72 bg-[rgba(var(--foreground-rgb),0.12)]" />
          <div className="col-span-5 grid gap-3 md:gap-4">
            <div className="h-24 md:h-34 bg-[rgba(var(--foreground-rgb),0.07)]" />
            <div className="h-25 md:h-34 bg-[rgba(var(--foreground-rgb),0.16)]" />
          </div>
          <div className="col-span-4 h-24 md:h-32 bg-[rgba(var(--foreground-rgb),0.08)]" />
          <div className="col-span-4 h-24 md:h-32 bg-[rgba(var(--foreground-rgb),0.18)]" />
          <div className="col-span-4 h-24 md:h-32 bg-[rgba(var(--foreground-rgb),0.10)]" />
        </div>
        <figcaption
          className="mt-5 text-center text-[rgba(var(--foreground-rgb),0.38)]"
          style={{ fontSize: "0.78rem", lineHeight: 1.8 }}
        >
          実際にこの仕組みで動いているサイト：
          <a
            href="https://akieguchi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-en tracking-[0.04em] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300"
          >
            akieguchi.com
          </a>
        </figcaption>
      </div>
    </figure>
  );
}

function Plan({ name, price, sub, points, href, cta, primary }: {
  name: string; price: string; sub: string; points: string[]; href: string; cta: string; primary?: boolean;
}) {
  // A "#"-prefixed placeholder isn't a real destination yet. Until the real Stripe
  // link exists, send the click to an email inquiry (never a dead anchor); real
  // links (https) open Stripe checkout in a new tab.
  const isLive = /^https?:/.test(href);
  const finalHref = isLive
    ? href
    : `mailto:${INQUIRY_EMAIL}?subject=${encodeURIComponent(`ポートフォリオサイトのお申し込み（${name}）`)}`;
  const cLabel = isLive ? cta : "メールで申し込む・相談する";
  return (
    <article className="border border-[rgba(var(--foreground-rgb),0.10)] rounded-md p-6 md:p-8 flex flex-col min-h-full">
      <h3 className="font-ja font-medium break-words" style={{ fontSize: "1.08rem", color: `rgba(var(--foreground-rgb),0.82)`, letterSpacing: "0.02em", lineHeight: 1.5 }}>
        {name}
      </h3>
      <p className="mt-3 font-en tracking-[0.02em] text-[rgba(var(--foreground-rgb),0.68)]" style={{ fontSize: "1.2rem" }}>
        {price}
      </p>
      <p className="mt-3 text-[rgba(var(--foreground-rgb),0.56)]" style={bodyStyle}>{sub}</p>
      <ul className="mt-6 space-y-2.5 flex-1">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2.5 text-[rgba(var(--foreground-rgb),0.55)]" style={{ fontSize: "var(--body-size, 0.85rem)", lineHeight: "1.75" }}>
            <span aria-hidden="true" className="text-[rgba(var(--foreground-rgb),0.30)] select-none">—</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <a
        href={finalHref}
        {...(isLive ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`mt-8 inline-flex min-h-11 items-center self-start font-en text-sm tracking-[0.03em] px-6 py-2.5 rounded-md transition-opacity duration-300 ${
          primary
            ? "bg-[var(--foreground)] text-[var(--background)] hover:opacity-85"
            : "border border-[rgba(var(--foreground-rgb),0.25)] text-[rgba(var(--foreground-rgb),0.70)] hover:opacity-70"
        }`}
      >
        {cLabel}
      </a>
    </article>
  );
}

export default function ServicePage() {
  const ref = usePageEntrance([]);
  return (
    <main ref={ref} className="max-w-5xl mx-auto px-5 sm:px-6 md:px-12 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(6.5rem*var(--spacing-page-top,1))] pb-16 md:pb-28">
      <header className="max-w-3xl mx-auto text-center">
        <p className={`${labelCls} mb-8 page-entrance`} style={labelStyle}>Service</p>
        <h1 className="font-ja page-entrance" style={{ fontSize: "clamp(1.55rem, 3vw, 2.35rem)", color: `rgba(var(--foreground-rgb),0.86)`, letterSpacing: "0.02em", lineHeight: 1.65 }}>
          写真が主役の、<wbr />あなただけのポートフォリオサイト
        </h1>
        <p className="mt-7 text-[rgba(var(--foreground-rgb),0.58)] page-entrance page-entrance-delay-1 max-w-2xl mx-auto" style={bodyStyle}>
          テンプレートと格闘せずに持てる、静かで完成されたポートフォリオ。
          写真を上げて、順番と大きさを整えるだけで、作品集のように見えるサイトになります。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 page-entrance page-entrance-delay-1">
          <a
            href="#pricing"
            className="font-en text-xs tracking-[0.10em] uppercase text-[rgba(var(--foreground-rgb),0.55)] hover:text-[rgba(var(--foreground-rgb),0.82)] nav-link-luxury transition-colors duration-300 py-1.5"
          >
            Pricing
          </a>
          <a
            href="#contact"
            className="font-en text-xs tracking-[0.10em] uppercase text-[rgba(var(--foreground-rgb),0.45)] hover:text-[rgba(var(--foreground-rgb),0.72)] nav-link-luxury transition-colors duration-300 py-1.5"
          >
            Consultation
          </a>
        </div>
      </header>

      <SitePreview />

      <section className="mt-16 md:mt-24 page-entrance">
        <SectionLabel>For photographers</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 max-w-4xl mx-auto">
          {[
            "Instagramだけでは作品が流れてしまう",
            "仕事用に見せられる場所をひとつ持ちたい",
            "写真の並びや余白まで、自分で整えたい",
          ].map((text) => (
            <p key={text} className="border-t border-[rgba(var(--foreground-rgb),0.10)] pt-5 text-[rgba(var(--foreground-rgb),0.58)]" style={bodyStyle}>
              {text}
            </p>
          ))}
        </div>
      </section>

      <section className="mt-16 md:mt-24 page-entrance">
        <SectionLabel>What you get</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-10 max-w-4xl mx-auto">
          {FEATURES.map((item) => (
            <section key={item.title} className="border-t border-[rgba(var(--foreground-rgb),0.09)] pt-5">
              <h2 className="font-ja text-[rgba(var(--foreground-rgb),0.78)]" style={{ fontSize: "1rem", letterSpacing: "0.03em", lineHeight: 1.6 }}>
                {item.title}
              </h2>
              <p className="mt-3 text-[rgba(var(--foreground-rgb),0.52)]" style={bodyStyle}>
                {item.body}
              </p>
            </section>
          ))}
        </div>
      </section>

      <section id="pricing" className="mt-16 md:mt-24 page-entrance scroll-mt-24">
        <SectionLabel>Pricing</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
          <Plan
            name="自分で立てる"
            price="¥10,000"
            sub="手順書を見ながら、自分でサイトを立ち上げるコースです。"
            points={[
              "テンプレート利用料（一回）",
              "公開場所は使った分の実費（月500〜1,000円程度）",
              "公開までのガイドとチェックリスト付き",
              "独自ドメイン接続の手順付き（必要な場合）",
              "困ったときは相談OK",
            ]}
            href={STRIPE_SELF}
            cta="このプランを申し込む"
            primary
          />
          <Plan
            name="おまかせ設定"
            price="¥30,000"
            sub="設定はこちらで全部済ませて、あなたは管理画面だけ受け取ります。"
            points={[
              "初期設定の代行（一回）",
              "月額なし（公開場所の実費のみ・月500〜1,000円程度）",
              "お持ちの独自ドメイン接続まで対応（必要な場合）",
              "写真と文言の入れ方を初回案内",
              "困ったときの相談もずっと無料",
            ]}
            href={STRIPE_CONCIERGE}
            cta="このプランを申し込む"
          />
        </div>
        <p className="text-center mt-8 text-[rgba(var(--foreground-rgb),0.45)]" style={{ fontSize: "0.82rem", lineHeight: 1.8 }}>
          {STRIPE_LIVE
            ? "お支払いのあと、メールで手順書（自分で立てる場合）またはご案内（おまかせの場合）をお送りします。"
            : "いまはオンライン決済を準備中です。当面は上のボタン（メールが開きます）か、下の連絡先からお申し込みください。お申し込み後、手順書またはご案内をお送りします。"}
        </p>
        <p className="text-center mt-3 text-[rgba(var(--foreground-rgb),0.42)]" style={{ fontSize: "0.8rem", lineHeight: 1.9 }}>
          載せた写真・文章・データはあなたのものです。独自ドメインの取得費・更新費、公開場所の実費は別です。
        </p>
      </section>

      <section className="mt-16 md:mt-24 page-entrance">
        <SectionLabel>How it starts</SectionLabel>
        <ol className="max-w-2xl mx-auto space-y-4">
          {STEPS.map((step, i) => (
            <li key={step} className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-[rgba(var(--foreground-rgb),0.08)] pt-4">
              <span className="font-en text-[rgba(var(--foreground-rgb),0.35)] tracking-[0.08em]" style={{ fontSize: "0.82rem" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[rgba(var(--foreground-rgb),0.56)]" style={bodyStyle}>
                {step}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 md:mt-24 page-entrance">
        <SectionLabel>FAQ</SectionLabel>
        <div className="max-w-2xl mx-auto space-y-8">
          {FAQS.map((item) => (
            <section key={item.q} className="border-t border-[rgba(var(--foreground-rgb),0.08)] pt-5">
              <h2 className="font-ja text-[rgba(var(--foreground-rgb),0.76)]" style={{ fontSize: "0.98rem", letterSpacing: "0.03em", lineHeight: 1.65 }}>
                {item.q}
              </h2>
              <p className="mt-3 text-[rgba(var(--foreground-rgb),0.53)]" style={bodyStyle}>
                {item.a}
              </p>
            </section>
          ))}
        </div>
      </section>

      <section id="contact" className="mt-16 md:mt-24 page-entrance scroll-mt-24">
        <SectionLabel>Contact</SectionLabel>
        <p className="text-center text-[rgba(var(--foreground-rgb),0.55)]" style={bodyStyle}>
          写真を見せていただければ、どんなサイトになるか具体的にご案内できます。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <a href="https://instagram.com/chi._.aki._" target="_blank" rel="noopener noreferrer"
            className="font-en text-xs tracking-[0.06em] text-[rgba(var(--foreground-rgb),0.40)] hover:text-[rgba(var(--foreground-rgb),0.70)] nav-link-luxury transition-colors duration-300 py-1.5">
            Instagram
          </a>
          <a href="https://x.com/chi_aki_jpg" target="_blank" rel="noopener noreferrer"
            className="font-en text-xs tracking-[0.06em] text-[rgba(var(--foreground-rgb),0.40)] hover:text-[rgba(var(--foreground-rgb),0.70)] nav-link-luxury transition-colors duration-300 py-1.5">
            X
          </a>
          <a href="mailto:akieguchi33@gmail.com"
            className="font-en text-xs tracking-[0.03em] text-[rgba(var(--foreground-rgb),0.40)] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300 py-1.5">
            akieguchi33@gmail.com
          </a>
        </div>
      </section>
    </main>
  );
}
