import { usePageEntrance } from "../hooks/usePageEntrance";

// Stripe Payment Links — placeholders until the real links are issued. Swap these
// two constants for the live URLs (self-serve / concierge) and nothing else changes:
// the buttons then point at Stripe and the "online payment in prep" note disappears.
const STRIPE_SELF = "#stripe-self";
const STRIPE_CONCIERGE = "#stripe-concierge";
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
    <div className="border border-[rgba(var(--foreground-rgb),0.08)] rounded-lg p-6 md:p-8 flex flex-col">
      <h3 className="font-ja font-medium break-words" style={{ fontSize: "1.0625rem", color: `rgba(var(--foreground-rgb),0.82)`, letterSpacing: "0.02em", lineHeight: 1.5 }}>
        {name}
      </h3>
      <p className="mt-2 font-en tracking-[0.02em] text-[rgba(var(--foreground-rgb),0.62)]" style={{ fontSize: "1.05rem" }}>
        {price}
      </p>
      <p className="mt-3 text-[rgba(var(--foreground-rgb),0.55)]" style={bodyStyle}>{sub}</p>
      <ul className="mt-5 space-y-2 flex-1">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2 text-[rgba(var(--foreground-rgb),0.55)]" style={{ fontSize: "var(--body-size, 0.85rem)", lineHeight: "1.7" }}>
            <span aria-hidden="true" className="text-[rgba(var(--foreground-rgb),0.30)] select-none">—</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <a
        href={finalHref}
        {...(isLive ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`mt-7 self-start font-en text-sm tracking-[0.03em] px-6 py-2.5 rounded-md transition-opacity duration-300 ${
          primary
            ? "bg-[var(--foreground)] text-[var(--background)] hover:opacity-85"
            : "border border-[rgba(var(--foreground-rgb),0.25)] text-[rgba(var(--foreground-rgb),0.70)] hover:opacity-70"
        }`}
      >
        {cLabel}
      </a>
    </div>
  );
}

export default function ServicePage() {
  const ref = usePageEntrance([]);
  return (
    <section ref={ref} className="max-w-3xl mx-auto px-6 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(6rem*var(--spacing-page-top,1))] pb-16 md:pb-24">
      {/* Header */}
      <p className={`${labelCls} mb-8 page-entrance`} style={labelStyle}>Service</p>
      <h1 className="font-ja text-center page-entrance" style={{ fontSize: "1.5rem", color: `rgba(var(--foreground-rgb),0.85)`, letterSpacing: "0.02em", lineHeight: 1.7 }}>
        写真が主役の、<wbr />あなただけのポートフォリオサイト
      </h1>
      <p className="mt-6 text-center text-[rgba(var(--foreground-rgb),0.55)] page-entrance page-entrance-delay-1 max-w-xl mx-auto" style={bodyStyle}>
        テンプレートと格闘せずに持てる、静かで完成されたポートフォリオ。
        写真を上げて並べるだけで、雑誌のように見えるサイトになります。
      </p>
      <p className="mt-4 text-center text-[rgba(var(--foreground-rgb),0.40)] page-entrance page-entrance-delay-1" style={{ fontSize: "0.8rem" }}>
        実際にこの仕組みで動いているサイト：akieguchi.com
      </p>

      {/* What you get */}
      <div className="mt-16 md:mt-20 page-entrance">
        <p className={`${labelCls} mb-8`} style={labelStyle}>What you get</p>
        <ul className="max-w-xl mx-auto space-y-3">
          {[
            "あなたの名前・あなたのドメインで持てる専用サイト",
            "写真が主役の、編集された静けさのあるデザイン（最初から整っています）",
            "S / M / L のサイズ指定と並べ替えで、雑誌のような見え方に",
            "プロフィール・連絡先・撮影依頼フォーム",
            "SNS共有・検索向けの情報が最初から正しく出る",
            "スマホ対応・独自ドメイン対応",
            "写真と文章は、コード不要でブラウザの管理画面から",
          ].map((t, i) => (
            <li key={i} className="flex gap-2.5 text-[rgba(var(--foreground-rgb),0.58)]" style={bodyStyle}>
              <span aria-hidden="true" className="text-[rgba(var(--foreground-rgb),0.28)] select-none">—</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pricing */}
      <div className="mt-16 md:mt-20 page-entrance">
        <p className={`${labelCls} mb-10`} style={labelStyle}>Pricing</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
          <Plan
            name="自分で立てる"
            price="¥10,000"
            sub="手順書を見ながら、自分でサイトを立ち上げるコースです。"
            points={[
              "テンプレート利用料（一回）",
              "公開の場所（Railway）は使った分の実費（月500〜1,000円程度）",
              "ボタンを押して進めるガイド付き",
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
              "月額なし（公開の場所の実費のみ・月500〜1,000円程度）",
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
          載せた写真・文章・データはあなたのものです。あとからドメインを変えたり、やめたりも自由です。
        </p>
      </div>

      {/* Contact */}
      <div className="mt-16 md:mt-20 page-entrance">
        <p className={`${labelCls} mb-8`} style={labelStyle}>Contact</p>
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
      </div>
    </section>
  );
}
