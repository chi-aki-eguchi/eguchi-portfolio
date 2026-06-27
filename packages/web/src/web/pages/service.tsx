import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { api, jsonOrThrow } from "../lib/api";
import { objectPositionFromFocal, srcFor, srcSetFor } from "../lib/picture";

// Stripe Payment Links (live). These are public checkout links — safe to keep in
// the repo. Never put Stripe secret keys / webhook secrets / dashboard URLs here.
// Both being real https links flips STRIPE_LIVE → true: buttons point at Stripe and
// the "online payment in prep" note disappears.
const STRIPE_SELF = "https://buy.stripe.com/8x25kDdou8xldeEfHqgrS00";
const STRIPE_CONCIERGE = "https://buy.stripe.com/aFa14n0BIcNB0rScvegrS01";
// Until BOTH are real https links, the page shows the "in preparation" copy and the
// buttons open an email inquiry instead of a dead anchor — so a click is never a
// dead end, and nobody mistakes it for a completed purchase.
const STRIPE_LIVE =
  /^https?:/.test(STRIPE_SELF) && /^https?:/.test(STRIPE_CONCIERGE);
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

const PAIN_SOLUTIONS = [
  {
    concern: "作品が流れてしまう",
    concernBody:
      "SNSに投稿した写真も、時間が経つと見つけてもらいにくくなります。",
    solution: "写真が主役の見え方",
    solutionBody:
      "余白、並び、サイズ感が最初から整った場所に、作品を長く置いておけます。",
  },
  {
    concern: "仕事用に見せる場所がほしい",
    concernBody:
      "依頼や展示の話が来たとき、作品とプロフィールをまとめて渡せるURLが必要になります。",
    solution: "プロフィールと連絡先まで一体化",
    solutionBody:
      "作品一覧、プロフィール、問い合わせ導線をひとつのサイトとして見せられます。",
  },
  {
    concern: "写真の並びまで整えたい",
    concernBody:
      "写真の順番、余白、大きさまで、自分の見せ方に寄せたくなることがあります。",
    solution: "管理画面から更新",
    solutionBody:
      "写真、並び順、プロフィール、連絡先、見た目をブラウザから調整できます。",
  },
] as const;

const PURCHASE_DETAILS = [
  {
    title: "決済後の案内",
    body: "Stripe の支払い控えが届いたあと、こちらでも確認し、選んだプランに合わせて次の案内を送ります。",
  },
  {
    title: "管理画面で更新",
    body: "写真の追加、並び替え、プロフィール、連絡先、見た目の調整をブラウザから行えます。",
  },
  {
    title: "自分で立てる場合",
    body: "立ち上げ用リンクと手順書を見ながら公開します。つまずいたところは相談できます。",
  },
  {
    title: "おまかせ設定の場合",
    body: "写真・プロフィール・連絡先などを伺い、設定後にサイトURL、管理画面URL、パスワードを渡します。",
  },
] as const;

const LIVE_LINKS = [
  {
    href: "/gallery",
    title: "作品一覧",
    body: "写真の並び、カテゴリ、余白の見え方を確認できます。",
  },
  {
    href: "/about",
    title: "プロフィール",
    body: "作家情報、プロフィール写真、文章の入り方を確認できます。",
  },
  {
    href: "/contact",
    title: "問い合わせ",
    body: "仕事につながる連絡先とSNS導線の置き方を確認できます。",
  },
] as const;

const FAQS = [
  {
    q: "購入したあと、すぐサイトが自動でできますか？",
    a: "自動でアカウント発行されるサービスではありません。決済後にこちらで確認し、自分で立てる場合は手順書と立ち上げ用リンク、おまかせ設定の場合は必要情報のご案内を送ります。",
  },
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

type ServicePhoto = {
  id: number;
  url: string;
  title?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  rotationDeg?: number | null;
  focalX?: number | null;
  focalY?: number | null;
};

function SectionLabel({ children }: { children: string }) {
  return (
    <p className={`${labelCls} mb-8`} style={labelStyle}>
      {children}
    </p>
  );
}

function ServiceButton({
  href,
  children,
  variant = "solid",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "solid" | "outline";
}) {
  const cls =
    variant === "solid"
      ? "bg-[var(--foreground)] text-[var(--background)] hover:opacity-85"
      : "border border-[rgba(var(--foreground-rgb),0.18)] text-[rgba(var(--foreground-rgb),0.64)] hover:border-[rgba(var(--foreground-rgb),0.32)] hover:text-[rgba(var(--foreground-rgb),0.82)]";
  return (
    <a
      href={href}
      className={`inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-md px-7 py-2.5 font-en text-sm tracking-[0.03em] transition-all duration-300 ${cls}`}
    >
      {children}
    </a>
  );
}

/* ── Collapsible wrapper (grid-row animation) ── */
function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/* ── Accordion ── */
function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="border-y border-[rgba(var(--foreground-rgb),0.08)]">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={item.q}
            className="border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)]"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full text-left py-5 flex items-start justify-between gap-4 group cursor-pointer"
              aria-expanded={isOpen}
            >
              <span
                className="font-ja text-[rgba(var(--foreground-rgb),0.76)] group-hover:text-[rgba(var(--foreground-rgb),0.90)] transition-colors duration-300"
                style={{
                  fontSize: "0.98rem",
                  letterSpacing: "0.03em",
                  lineHeight: 1.65,
                }}
              >
                {item.q}
              </span>
              <span
                className="mt-1 shrink-0 text-[rgba(var(--foreground-rgb),0.30)] transition-transform duration-300"
                style={{
                  fontSize: "0.75rem",
                  transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                }}
                aria-hidden="true"
              >
                +
              </span>
            </button>
            <Collapsible open={isOpen}>
              <p
                className="pb-5 text-[rgba(var(--foreground-rgb),0.53)]"
                style={bodyStyle}
              >
                {item.a}
              </p>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}

function PhotoTile({
  photo,
  size,
  loading = "lazy",
}: {
  photo: ServicePhoto;
  size: "large" | "small";
  loading?: "eager" | "lazy";
}) {
  const width = size === "large" ? 1200 : 600;
  const quality = size === "large" ? 88 : 84;
  const variantUrl =
    size === "large"
      ? (photo.mediumUrl ?? photo.thumbUrl)
      : (photo.thumbUrl ?? photo.mediumUrl);
  return (
    <img
      src={
        variantUrl ??
        srcFor(photo.url, width, quality, undefined, photo.rotationDeg)
      }
      srcSet={
        variantUrl
          ? undefined
          : srcSetFor(photo.url, "grid", undefined, photo.rotationDeg)
      }
      sizes={size === "large" ? "(min-width: 1024px) 46vw, 65vw" : "30vw"}
      alt={photo.title || "Portfolio photograph"}
      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
      style={{
        objectPosition: objectPositionFromFocal(photo.focalX, photo.focalY),
      }}
      loading={loading}
      decoding="async"
    />
  );
}

/* ── Hero site preview ── */
function HeroSitePreview({ photos }: { photos: ServicePhoto[] }) {
  const heroPhotos = photos.slice(0, 4);
  if (heroPhotos.length === 0) return null;

  const heroHeight = "clamp(260px, 40vw, 460px)";

  return (
    <div className="mt-9 md:mt-12 page-entrance page-entrance-delay-2">
      <div
        className="overflow-hidden rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--foreground-rgb),0.018)] shadow-[0_18px_60px_rgba(var(--foreground-rgb),0.06)]"
        aria-label="Portfolio site preview"
      >
        <div className="flex items-center justify-between border-b border-[rgba(var(--foreground-rgb),0.08)] px-4 py-2.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="block h-2 w-2 rounded-full bg-[rgba(var(--foreground-rgb),0.18)]" />
            <span className="block h-2 w-2 rounded-full bg-[rgba(var(--foreground-rgb),0.14)]" />
            <span className="block h-2 w-2 rounded-full bg-[rgba(var(--foreground-rgb),0.10)]" />
          </div>
          <p className="font-en text-[0.58rem] tracking-[0.12em] uppercase text-[rgba(var(--foreground-rgb),0.36)]">
            akieguchi.com / gallery
          </p>
          <Link
            to="/gallery"
            className="font-en text-[0.58rem] tracking-[0.12em] uppercase text-[rgba(var(--foreground-rgb),0.36)] hover:text-[rgba(var(--foreground-rgb),0.62)] transition-colors duration-300"
          >
            Open
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[7rem_1fr]">
          <aside className="hidden md:flex flex-col justify-between border-r border-[rgba(var(--foreground-rgb),0.08)] px-5 py-6">
            <div>
              <p className="font-en text-[0.62rem] tracking-[0.14em] uppercase text-[rgba(var(--foreground-rgb),0.62)]">
                Aki Eguchi
              </p>
              <nav className="mt-8 space-y-4" aria-label="Preview navigation">
                {["Gallery", "About", "Contact"].map((label) => (
                  <span
                    key={label}
                    className="block font-en text-[0.58rem] tracking-[0.10em] text-[rgba(var(--foreground-rgb),0.34)]"
                  >
                    {label}
                  </span>
                ))}
              </nav>
            </div>
            <p className="font-en text-[0.56rem] tracking-[0.12em] uppercase text-[rgba(var(--foreground-rgb),0.24)]">
              Portfolio
            </p>
          </aside>

          <Link
            to="/gallery"
            className="group block p-2 md:p-3"
            aria-label="Gallery"
          >
            <div
              className="hidden sm:grid grid-cols-12 gap-2 md:gap-3 overflow-hidden"
              style={{ height: heroHeight }}
            >
              <div className="col-span-7 block h-full min-h-0 overflow-hidden bg-[rgba(var(--foreground-rgb),0.04)]">
                <PhotoTile photo={heroPhotos[0]} size="large" loading="eager" />
              </div>
              <div className="col-span-5 grid h-full min-h-0 grid-rows-3 gap-2 md:gap-3 overflow-hidden">
                {heroPhotos.slice(1, 4).map((photo, i) => (
                  <div
                    key={photo.id}
                    className="block h-full min-h-0 overflow-hidden bg-[rgba(var(--foreground-rgb),0.04)]"
                  >
                    <PhotoTile
                      photo={photo}
                      size="small"
                      loading={i === 0 ? "eager" : "lazy"}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div
              className="grid sm:hidden grid-cols-2 gap-2 overflow-hidden"
              style={{ height: "clamp(200px, 52vw, 300px)" }}
            >
              {heroPhotos.slice(0, 2).map((photo) => (
                <div
                  key={photo.id}
                  className="block h-full min-h-0 overflow-hidden bg-[rgba(var(--foreground-rgb),0.04)]"
                >
                  <PhotoTile photo={photo} size="small" loading="eager" />
                </div>
              ))}
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function SitePagePreview({
  item,
  photo,
}: {
  item: (typeof LIVE_LINKS)[number];
  photo: ServicePhoto | undefined;
}) {
  return (
    <Link
      to={item.href}
      className="group grid grid-cols-[5.5rem_1fr] sm:grid-cols-[7rem_1fr] gap-4 border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-4"
    >
      <span className="block aspect-[4/3] overflow-hidden bg-[rgba(var(--foreground-rgb),0.035)]">
        {photo ? (
          <PhotoTile photo={photo} size="small" />
        ) : (
          <span className="block h-full w-full" />
        )}
      </span>
      <span className="min-w-0">
        <span className="font-en text-[0.58rem] tracking-[0.12em] uppercase text-[rgba(var(--foreground-rgb),0.34)] group-hover:text-[rgba(var(--foreground-rgb),0.58)] transition-colors duration-300">
          View
        </span>
        <span
          className="mt-1.5 block font-ja text-[rgba(var(--foreground-rgb),0.76)]"
          style={{
            fontSize: "0.98rem",
            letterSpacing: "0.03em",
            lineHeight: 1.55,
          }}
        >
          {item.title}
        </span>
        <span
          className="mt-1.5 block text-[rgba(var(--foreground-rgb),0.50)]"
          style={{ fontSize: "0.82rem", lineHeight: 1.8 }}
        >
          {item.body}
        </span>
      </span>
    </Link>
  );
}

/* ── Actual site proof (compact) ── */
function PortfolioProof({ photos }: { photos: ServicePhoto[] }) {
  return (
    <section id="example" className="mt-7 md:mt-10 page-entrance scroll-mt-24">
      <SectionLabel>Actual site</SectionLabel>
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className="font-ja text-[rgba(var(--foreground-rgb),0.82)]"
          style={{
            fontSize: "clamp(1.18rem, 2vw, 1.55rem)",
            letterSpacing: "0.03em",
            lineHeight: 1.75,
          }}
        >
          実例は、
          <wbr />
          このサイト内でそのまま見られます。
        </h2>
        <p
          className="mt-4 text-[rgba(var(--foreground-rgb),0.56)]"
          style={bodyStyle}
        >
          このサイト自体が実例です。Gallery・About・Contact
          をそのまま確認できます。
        </p>
      </div>
      <div className="mt-8 max-w-3xl mx-auto border-y border-[rgba(var(--foreground-rgb),0.08)]">
        {LIVE_LINKS.map((item, i) => (
          <SitePagePreview key={item.href} item={item} photo={photos[i]} />
        ))}
      </div>
      <div className="mt-7 text-center">
        <ServiceButton href="#pricing">料金を見る</ServiceButton>
      </div>
    </section>
  );
}

/* ── Pain / solution pairs ── */
function AudienceAndFeatures() {
  return (
    <section className="mt-10 md:mt-14 page-entrance">
      <SectionLabel>For photographers</SectionLabel>
      <div className="max-w-4xl mx-auto border-y border-[rgba(var(--foreground-rgb),0.08)]">
        {PAIN_SOLUTIONS.map((item) => (
          <div
            key={item.concern}
            className="grid grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 md:gap-10 border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-5"
          >
            <div>
              <p className="font-ja text-[0.62rem] tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.36)]">
                こんな悩み
              </p>
              <h2
                className="mt-1.5 font-ja text-[rgba(var(--foreground-rgb),0.76)]"
                style={{
                  fontSize: "0.98rem",
                  letterSpacing: "0.03em",
                  lineHeight: 1.6,
                }}
              >
                {item.concern}
              </h2>
              <p
                className="mt-1.5 text-[rgba(var(--foreground-rgb),0.48)]"
                style={{ fontSize: "0.84rem", lineHeight: 1.85 }}
              >
                {item.concernBody}
              </p>
            </div>
            <div>
              <p className="font-ja text-[0.62rem] tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.36)]">
                このサイトなら
              </p>
              <h2
                className="mt-1.5 font-ja text-[rgba(var(--foreground-rgb),0.76)]"
                style={{
                  fontSize: "0.98rem",
                  letterSpacing: "0.03em",
                  lineHeight: 1.6,
                }}
              >
                {item.solution}
              </h2>
              <p
                className="mt-1.5 text-[rgba(var(--foreground-rgb),0.50)]"
                style={{ fontSize: "0.84rem", lineHeight: 1.85 }}
              >
                {item.solutionBody}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Purchase details (collapsible) ── */
function PurchaseDetails() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <section
      id="after-purchase"
      className="mt-10 md:mt-14 page-entrance scroll-mt-24"
    >
      <SectionLabel>After purchase</SectionLabel>
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className="font-ja text-[rgba(var(--foreground-rgb),0.82)]"
          style={{
            fontSize: "clamp(1.18rem, 2vw, 1.55rem)",
            letterSpacing: "0.03em",
            lineHeight: 1.75,
          }}
        >
          購入後の流れ。
        </h2>
        <p
          className="mt-4 text-[rgba(var(--foreground-rgb),0.56)]"
          style={bodyStyle}
        >
          確認後、選んだプランに合わせて案内を送ります。写真の入れ方や管理画面での更新も、最初にまとめてお伝えします。
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="mt-5 inline-flex items-center gap-2 font-en text-xs tracking-[0.08em] uppercase text-[rgba(var(--foreground-rgb),0.40)] hover:text-[rgba(var(--foreground-rgb),0.65)] transition-colors duration-300 cursor-pointer"
        >
          <span>{isOpen ? "Close" : "Details"}</span>
          <span
            className="transition-transform duration-300"
            style={{
              transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
              fontSize: "0.7rem",
            }}
            aria-hidden="true"
          >
            +
          </span>
        </button>
      </div>

      <Collapsible open={isOpen}>
        <ol className="mt-8 max-w-3xl mx-auto border-y border-[rgba(var(--foreground-rgb),0.08)]">
          {PURCHASE_DETAILS.map((step, i) => (
            <li
              key={step.title}
              className="grid grid-cols-[2.5rem_1fr] gap-4 border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-4"
            >
              <span
                className="font-en text-[rgba(var(--foreground-rgb),0.35)] tracking-[0.08em]"
                style={{ fontSize: "0.82rem" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <span
                  className="block font-ja text-[rgba(var(--foreground-rgb),0.74)]"
                  style={{
                    fontSize: "0.98rem",
                    lineHeight: 1.65,
                    letterSpacing: "0.03em",
                  }}
                >
                  {step.title}
                </span>
                <span
                  className="mt-1.5 block text-[rgba(var(--foreground-rgb),0.52)]"
                  style={bodyStyle}
                >
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p
          className="mt-5 max-w-2xl mx-auto text-center text-[rgba(var(--foreground-rgb),0.44)]"
          style={{ fontSize: "0.82rem", lineHeight: 1.9 }}
        >
          写真の大きさ調整は、見せたい作品に強弱をつけるための機能です。
          すべて同じ大きさで整えることもできます。
        </p>
      </Collapsible>
    </section>
  );
}

/* ── Pricing card ── */
function Plan({
  name,
  price,
  sub,
  points,
  href,
  cta,
  primary,
}: {
  name: string;
  price: string;
  sub: string;
  points: string[];
  href: string;
  cta: string;
  primary?: boolean;
}) {
  const isLive = /^https?:/.test(href);
  const finalHref = isLive
    ? href
    : `mailto:${INQUIRY_EMAIL}?subject=${encodeURIComponent(`ポートフォリオサイトのお申し込み（${name}）`)}`;
  const cLabel = isLive ? cta : "メールで申し込む・相談する";
  return (
    <article
      className={`relative rounded-md flex flex-col min-h-full transition-shadow duration-300 ${
        primary
          ? "border-2 border-[rgba(var(--foreground-rgb),0.28)] bg-[rgba(var(--foreground-rgb),0.025)] p-7 md:p-9 shadow-[0_2px_20px_rgba(var(--foreground-rgb),0.06)]"
          : "border border-[rgba(var(--foreground-rgb),0.10)] p-6 md:p-8"
      }`}
    >
      {primary && (
        <p className="absolute right-5 top-5 font-en text-[0.60rem] tracking-[0.12em] uppercase bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1 rounded-sm">
          Recommended
        </p>
      )}
      <h3
        className="font-ja font-medium break-words"
        style={{
          fontSize: primary ? "1.15rem" : "1.08rem",
          color: `rgba(var(--foreground-rgb),0.82)`,
          letterSpacing: "0.02em",
          lineHeight: 1.5,
        }}
      >
        {name}
      </h3>
      <p
        className="mt-3 font-en tracking-[0.02em] text-[rgba(var(--foreground-rgb),0.68)]"
        style={{ fontSize: primary ? "1.4rem" : "1.2rem" }}
      >
        {price}
      </p>
      <p
        className="mt-3 text-[rgba(var(--foreground-rgb),0.56)]"
        style={bodyStyle}
      >
        {sub}
      </p>
      <ul className="mt-5 space-y-2.5 flex-1">
        {points.map((p, i) => (
          <li
            key={i}
            className="flex gap-2.5 text-[rgba(var(--foreground-rgb),0.55)]"
            style={{
              fontSize: "var(--body-size, 0.85rem)",
              lineHeight: "1.75",
            }}
          >
            <span
              aria-hidden="true"
              className="text-[rgba(var(--foreground-rgb),0.30)] select-none"
            >
              —
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <a
        href={finalHref}
        {...(isLive ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`mt-7 inline-flex min-h-11 items-center self-start font-en text-sm tracking-[0.03em] px-7 py-2.5 rounded-md transition-opacity duration-300 ${
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

/* ── Final CTA section ── */
function FinalCTA() {
  const href = STRIPE_LIVE
    ? STRIPE_SELF
    : `mailto:${INQUIRY_EMAIL}?subject=${encodeURIComponent("ポートフォリオサイトについて相談")}`;
  return (
    <section className="mt-14 md:mt-20 page-entrance text-center">
      <div className="max-w-2xl mx-auto border-t border-[rgba(var(--foreground-rgb),0.08)] pt-10 md:pt-14">
        <p
          className="font-ja text-[rgba(var(--foreground-rgb),0.78)]"
          style={{
            fontSize: "clamp(1.18rem, 2vw, 1.55rem)",
            letterSpacing: "0.03em",
            lineHeight: 1.75,
          }}
        >
          まずは写真を見せてください。
        </p>
        <p
          className="mt-4 text-[rgba(var(--foreground-rgb),0.50)]"
          style={bodyStyle}
        >
          どんなサイトになるか、具体的にご案内します。
        </p>
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={href}
            {...(STRIPE_LIVE
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="inline-flex min-h-11 items-center font-en text-sm tracking-[0.03em] bg-[var(--foreground)] text-[var(--background)] px-8 py-2.5 rounded-md hover:opacity-85 transition-opacity duration-300"
          >
            {STRIPE_LIVE ? "申し込む" : "メールで相談する"}
          </a>
          <nav className="flex items-center gap-5" aria-label="SNS">
            <a
              href="https://instagram.com/chi._.aki._"
              target="_blank"
              rel="noopener noreferrer"
              className="font-en text-xs tracking-[0.06em] text-[rgba(var(--foreground-rgb),0.35)] hover:text-[rgba(var(--foreground-rgb),0.65)] transition-colors duration-300 py-1.5"
            >
              Instagram
            </a>
            <a
              href="https://x.com/chi_aki_jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="font-en text-xs tracking-[0.06em] text-[rgba(var(--foreground-rgb),0.35)] hover:text-[rgba(var(--foreground-rgb),0.65)] transition-colors duration-300 py-1.5"
            >
              X
            </a>
          </nav>
        </div>
      </div>
    </section>
  );
}

/* ── Sticky CTA bar ── */
function StickyCtaBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setVisible(window.scrollY > Math.min(420, window.innerHeight * 0.35));
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const href = STRIPE_LIVE
    ? STRIPE_SELF
    : `mailto:${INQUIRY_EMAIL}?subject=${encodeURIComponent("ポートフォリオサイトについて相談")}`;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 md:left-[11rem] z-40 pointer-events-none transition-all duration-300"
      style={{
        transform: visible ? "translateY(0)" : "translateY(100%)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-6 md:px-12 pb-5">
        <div
          className="pointer-events-auto bg-[var(--background)] border border-[rgba(var(--foreground-rgb),0.10)] backdrop-blur-md rounded-lg shadow-[0_-4px_24px_rgba(var(--foreground-rgb),0.08)] px-5 py-3 flex items-center justify-between gap-4"
        >
          <p
            className="font-ja text-sm text-[rgba(var(--foreground-rgb),0.60)] hidden sm:block"
            style={{ letterSpacing: "0.02em" }}
          >
            ¥10,000 から始められます
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <a
              href="#pricing"
              className="font-ja text-xs tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.45)] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300 py-1.5"
            >
              料金を見る
            </a>
            <a
              href={href}
              {...(STRIPE_LIVE
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="inline-flex items-center font-en text-sm tracking-[0.03em] bg-[var(--foreground)] text-[var(--background)] px-5 py-2 rounded-md hover:opacity-85 transition-opacity duration-300"
            >
              {STRIPE_LIVE ? "申し込む" : "相談する"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const SERVICE_HOST = "akieguchi.com";

function isServiceHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.replace(/^www\./, "").toLowerCase();
  return host === SERVICE_HOST || host === "localhost" || host === "127.0.0.1";
}

export default function ServicePage() {
  const { data: photosData } = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });
  const photos = (photosData?.photos ?? []) as ServicePhoto[];
  const ref = usePageEntrance([photos.length]);

  if (!isServiceHost()) return null;

  return (
    <section
      ref={ref}
      className="max-w-5xl mx-auto px-5 sm:px-6 md:px-12 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(6.5rem*var(--spacing-page-top,1))] pb-16 md:pb-28"
    >
      {/* ── Hero ── */}
      <header className="max-w-3xl mx-auto text-center">
        <p className={`${labelCls} mb-8 page-entrance`} style={labelStyle}>
          Service
        </p>
        <h1
          className="font-ja page-entrance"
          style={{
            fontSize: "clamp(1.55rem, 3vw, 2.35rem)",
            color: `rgba(var(--foreground-rgb),0.86)`,
            letterSpacing: "0.02em",
            lineHeight: 1.65,
          }}
        >
          写真が主役の、
          <wbr />
          あなただけのポートフォリオサイト
        </h1>
        <p
          className="mt-7 text-[rgba(var(--foreground-rgb),0.58)] page-entrance page-entrance-delay-1 max-w-2xl mx-auto"
          style={bodyStyle}
        >
          テンプレートと格闘せずに持てる、静かで完成されたポートフォリオ。
          管理画面から写真、プロフィール、連絡先を入れて、自分の作品を見せる場所として運用できます。
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 page-entrance page-entrance-delay-1">
          <ServiceButton href="#pricing">料金を見る</ServiceButton>
          <ServiceButton href="#example" variant="outline">
            実例を見る
          </ServiceButton>
        </div>
      </header>

      {/* ── Hero site preview ── */}
      <HeroSitePreview photos={photos} />

      {/* ── Actual site links ── */}
      <PortfolioProof photos={photos} />

      {/* ── Fit + value ── */}
      <AudienceAndFeatures />

      {/* ── Pricing ── */}
      <section
        id="pricing"
        className="mt-12 md:mt-16 page-entrance scroll-mt-24"
      >
        <SectionLabel>Pricing</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8 items-start">
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
        <p
          className="text-center mt-7 text-[rgba(var(--foreground-rgb),0.45)]"
          style={{ fontSize: "0.82rem", lineHeight: 1.8 }}
        >
          {STRIPE_LIVE
            ? "決済後、Stripe の支払い控えが届きます。こちらでも確認後、手順書またはおまかせ設定の案内を送ります。"
            : "いまはオンライン決済を準備中です。当面は上のボタン（メールが開きます）か、下の連絡先からお申し込みください。"}
        </p>
        <p
          className="text-center mt-2 text-[rgba(var(--foreground-rgb),0.42)]"
          style={{ fontSize: "0.8rem", lineHeight: 1.9 }}
        >
          載せた写真・文章・データはあなたのものです。独自ドメインの取得費・更新費、公開場所の実費は別です。
        </p>
      </section>

      {/* Sentinel for sticky CTA visibility */}
      <StickyCtaBar />

      {/* ── Purchase details (collapsible) ── */}
      <PurchaseDetails />

      {/* ── FAQ (accordion) ── */}
      <section className="mt-10 md:mt-14 page-entrance">
        <SectionLabel>FAQ</SectionLabel>
        <div className="max-w-2xl mx-auto">
          <Accordion items={FAQS.map((f) => ({ q: f.q, a: f.a }))} />
        </div>
      </section>

      {/* ── Final CTA (replaces old Contact section) ── */}
      <FinalCTA />
    </section>
  );
}
