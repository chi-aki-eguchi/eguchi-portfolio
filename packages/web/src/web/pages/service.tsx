import { useState, useEffect, useRef } from "react";
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
    body: "見せたい写真を大きく、流れで見せたい写真を控えめに。カテゴリやシリーズも含めて、作品の見え方を整えられます。",
  },
  {
    title: "公開後の基本整備",
    body: "スマホ表示、SNS共有、検索向けの情報、問い合わせ導線まで、写真家サイトに必要な土台を揃えています。",
  },
] as const;

const CONCERNS = [
  {
    lead: "作品が流れてしまう",
    body: "SNSに投稿した写真も、時間が経つと見つけてもらいにくくなります。",
  },
  {
    lead: "仕事用に見せる場所がほしい",
    body: "依頼や展示の話が来たとき、作品とプロフィールをまとめて渡せるURLを用意できます。",
  },
  {
    lead: "写真の並びまで整えたい",
    body: "写真の順番、余白、大きさをあとから調整して、自分の見せ方に寄せられます。",
  },
] as const;

const LIVE_LINKS = [
  {
    href: "/gallery",
    title: "作品一覧",
    body: "写真の並び、カテゴリ、余白の見え方を実際に確認できます。",
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

const ADMIN_CONNECTIONS = [
  {
    admin: "写真を追加・並び替え",
    public: "作品一覧とトップページの見え方に反映",
    href: "/gallery",
  },
  {
    admin: "プロフィール文と写真を更新",
    public: "プロフィールページに反映",
    href: "/about",
  },
  {
    admin: "連絡先・SNS・問い合わせ先を更新",
    public: "Contact とフッター導線に反映",
    href: "/contact",
  },
  {
    admin: "文字サイズ、余白、色を調整",
    public: "サイト全体の雰囲気に反映",
    href: undefined,
  },
] as const;

const AFTER_PURCHASE = [
  {
    title: "決済完了",
    body: "購入ボタンから Stripe の決済ページへ移動します。決済後、Stripe の支払い控えが届きます。",
  },
  {
    title: "こちらで確認",
    body: "入金を確認したら、決済時のメールアドレスまたは連絡先へ、次に必要な案内を送ります。",
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

/* ── Hero photo showcase ── */
function HeroShowcase({ photos }: { photos: ServicePhoto[] }) {
  const heroPhotos = photos.slice(0, 4);
  if (heroPhotos.length === 0) return null;

  const heroHeight = "clamp(260px, 40vw, 460px)";

  return (
    <div className="mt-9 md:mt-12 page-entrance page-entrance-delay-2">
      {/* Desktop: 1 large + up to 3 stacked */}
      <div
        className="hidden sm:grid grid-cols-12 gap-2 md:gap-3 overflow-hidden"
        style={{ height: heroHeight }}
      >
        <Link
          to="/gallery"
          className="col-span-7 block h-full min-h-0 overflow-hidden bg-[rgba(var(--foreground-rgb),0.04)] group"
          aria-label="Gallery"
        >
          <img
            src={
              heroPhotos[0].thumbUrl ??
              heroPhotos[0].mediumUrl ??
              srcFor(
                heroPhotos[0].url,
                1200,
                88,
                undefined,
                heroPhotos[0].rotationDeg,
              )
            }
            srcSet={
              heroPhotos[0].thumbUrl || heroPhotos[0].mediumUrl
                ? undefined
                : srcSetFor(
                    heroPhotos[0].url,
                    "grid",
                    undefined,
                    heroPhotos[0].rotationDeg,
                  )
            }
            sizes="(min-width: 1024px) 55vw, 65vw"
            alt={heroPhotos[0].title || "Portfolio photograph"}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            style={{
              objectPosition: objectPositionFromFocal(
                heroPhotos[0].focalX,
                heroPhotos[0].focalY,
              ),
            }}
            loading="eager"
            decoding="async"
          />
        </Link>
        <div className="col-span-5 grid h-full min-h-0 grid-rows-3 gap-2 md:gap-3 overflow-hidden">
          {heroPhotos.slice(1, 4).map((photo, i) => (
            <Link
              key={photo.id}
              to="/gallery"
              className="block h-full min-h-0 overflow-hidden bg-[rgba(var(--foreground-rgb),0.04)] group"
              aria-label="Gallery"
            >
              <img
                src={
                  photo.thumbUrl ??
                  photo.mediumUrl ??
                  srcFor(photo.url, 600, 84, undefined, photo.rotationDeg)
                }
                srcSet={
                  photo.thumbUrl || photo.mediumUrl
                    ? undefined
                    : srcSetFor(photo.url, "grid", undefined, photo.rotationDeg)
                }
                sizes="(min-width: 1024px) 28vw, 35vw"
                alt={photo.title || "Portfolio photograph"}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                style={{
                  objectPosition: objectPositionFromFocal(
                    photo.focalX,
                    photo.focalY,
                  ),
                }}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile: 2 photos side by side */}
      <div
        className="grid sm:hidden grid-cols-2 gap-2 overflow-hidden"
        style={{ height: "clamp(200px, 52vw, 300px)" }}
      >
        {heroPhotos.slice(0, 2).map((photo) => (
          <Link
            key={photo.id}
            to="/gallery"
            className="block h-full min-h-0 overflow-hidden bg-[rgba(var(--foreground-rgb),0.04)]"
            aria-label="Gallery"
          >
            <img
              src={
                photo.thumbUrl ??
                photo.mediumUrl ??
                srcFor(photo.url, 600, 84, undefined, photo.rotationDeg)
              }
              srcSet={
                photo.thumbUrl || photo.mediumUrl
                  ? undefined
                  : srcSetFor(photo.url, "grid", undefined, photo.rotationDeg)
              }
              sizes="48vw"
              alt={photo.title || "Portfolio photograph"}
              className="h-full w-full object-cover"
              style={{
                objectPosition: objectPositionFromFocal(
                  photo.focalX,
                  photo.focalY,
                ),
              }}
              loading="eager"
              decoding="async"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Actual site proof (compact) ── */
function PortfolioProof() {
  return (
    <section id="example" className="mt-10 md:mt-14 page-entrance scroll-mt-24">
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
          akieguchi.com
          の作品一覧、プロフィール、問い合わせ導線が、そのまま公開後の見え方の参考になります。
        </p>
      </div>
      <div className="mt-8 max-w-3xl mx-auto border-y border-[rgba(var(--foreground-rgb),0.08)]">
        {LIVE_LINKS.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="grid grid-cols-[5rem_1fr] gap-5 border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-4 group"
          >
            <span className="font-en text-[0.62rem] tracking-[0.12em] uppercase text-[rgba(var(--foreground-rgb),0.34)] group-hover:text-[rgba(var(--foreground-rgb),0.58)] transition-colors duration-300">
              View
            </span>
            <span>
              <span
                className="block font-ja text-[rgba(var(--foreground-rgb),0.76)]"
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
        ))}
      </div>
      <div className="mt-7 text-center">
        <ServiceButton href="#pricing" variant="outline">
          料金を見る
        </ServiceButton>
      </div>
    </section>
  );
}

/* ── Audience + value (compact) ── */
function AudienceAndFeatures() {
  return (
    <section className="mt-10 md:mt-14 page-entrance">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14">
        <div>
          <SectionLabel>For photographers</SectionLabel>
          <div className="border-y border-[rgba(var(--foreground-rgb),0.08)]">
            {CONCERNS.map((item) => (
              <div
                key={item.lead}
                className="border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-4"
              >
                <h2
                  className="font-ja text-[rgba(var(--foreground-rgb),0.76)]"
                  style={{
                    fontSize: "0.98rem",
                    letterSpacing: "0.03em",
                    lineHeight: 1.6,
                  }}
                >
                  {item.lead}
                </h2>
                <p
                  className="mt-1.5 text-[rgba(var(--foreground-rgb),0.50)]"
                  style={{ fontSize: "0.84rem", lineHeight: 1.85 }}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>What you get</SectionLabel>
          <div className="border-y border-[rgba(var(--foreground-rgb),0.08)]">
            {FEATURES.map((item) => (
              <div
                key={item.title}
                className="border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-4"
              >
                <h2
                  className="font-ja text-[rgba(var(--foreground-rgb),0.76)]"
                  style={{
                    fontSize: "0.98rem",
                    letterSpacing: "0.03em",
                    lineHeight: 1.6,
                  }}
                >
                  {item.title}
                </h2>
                <p
                  className="mt-1.5 text-[rgba(var(--foreground-rgb),0.50)]"
                  style={{ fontSize: "0.84rem", lineHeight: 1.85 }}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Admin (collapsible) ── */
function AdminConnection() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <section id="admin" className="mt-12 md:mt-16 page-entrance scroll-mt-24">
      <SectionLabel>Admin</SectionLabel>
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className="font-ja text-[rgba(var(--foreground-rgb),0.82)]"
          style={{
            fontSize: "clamp(1.18rem, 2vw, 1.55rem)",
            letterSpacing: "0.03em",
            lineHeight: 1.75,
          }}
        >
          管理画面で変えた内容が、
          <wbr />
          公開サイトに反映されます。
        </h2>
        <p
          className="mt-4 text-[rgba(var(--foreground-rgb),0.56)]"
          style={bodyStyle}
        >
          写真、プロフィール、連絡先、見た目をブラウザで編集し、その結果が各ページに出ます。
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
        <div className="mt-8 max-w-4xl mx-auto border-y border-[rgba(var(--foreground-rgb),0.08)]">
          {ADMIN_CONNECTIONS.map((item) => (
            <div
              key={item.admin}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2 md:gap-8 border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-4 md:py-5"
            >
              <div>
                <p className="font-en text-[0.58rem] tracking-[0.14em] uppercase text-[rgba(var(--foreground-rgb),0.34)]">
                  Edit in admin
                </p>
                <p
                  className="mt-1.5 text-[rgba(var(--foreground-rgb),0.72)]"
                  style={{
                    fontSize: "0.95rem",
                    lineHeight: 1.7,
                    letterSpacing: "0.03em",
                  }}
                >
                  {item.admin}
                </p>
              </div>
              <div>
                <p className="font-en text-[0.58rem] tracking-[0.14em] uppercase text-[rgba(var(--foreground-rgb),0.34)]">
                  Public site
                </p>
                {item.href ? (
                  <Link
                    to={item.href}
                    className="mt-1.5 inline-block text-[rgba(var(--foreground-rgb),0.56)] hover:text-[rgba(var(--foreground-rgb),0.78)] transition-colors duration-300"
                    style={{
                      fontSize: "0.95rem",
                      lineHeight: 1.7,
                      letterSpacing: "0.03em",
                    }}
                  >
                    {item.public}
                  </Link>
                ) : (
                  <p
                    className="mt-1.5 text-[rgba(var(--foreground-rgb),0.56)]"
                    style={{
                      fontSize: "0.95rem",
                      lineHeight: 1.7,
                      letterSpacing: "0.03em",
                    }}
                  >
                    {item.public}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <p
          className="mt-5 max-w-2xl mx-auto text-center text-[rgba(var(--foreground-rgb),0.44)]"
          style={{ fontSize: "0.82rem", lineHeight: 1.9 }}
        >
          写真の大きさ調整は、見せたい作品に強弱をつけるための機能です。
          すべて同じ大きさで整えることもできるので、S/M/Lを覚える必要はありません。
        </p>
      </Collapsible>
    </section>
  );
}

/* ── After purchase (collapsible) ── */
function AfterPurchase() {
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
          購入後は、
          <wbr />
          手順書か初期設定の案内へ進みます。
        </h2>
        <p
          className="mt-4 text-[rgba(var(--foreground-rgb),0.56)]"
          style={bodyStyle}
        >
          決済確認後、選んだプランに合わせて次の案内を送ります。
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
          {AFTER_PURCHASE.map((step, i) => (
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
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show only when sentinel has scrolled above the viewport (user scrolled
        // past pricing), not when it's below (initial load / hasn't reached yet).
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0, rootMargin: "0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const href = STRIPE_LIVE
    ? STRIPE_SELF
    : `mailto:${INQUIRY_EMAIL}?subject=${encodeURIComponent("ポートフォリオサイトについて相談")}`;

  return (
    <>
      {/* Invisible sentinel placed right after pricing section */}
      <div ref={sentinelRef} className="h-0 w-0" aria-hidden="true" />
      <div
        className="fixed bottom-0 left-0 right-0 md:left-[11rem] z-40 pointer-events-none transition-all duration-300"
        style={{
          transform: visible ? "translateY(0)" : "translateY(100%)",
          opacity: visible ? 1 : 0,
        }}
      >
        <div className="max-w-5xl mx-auto px-5 sm:px-6 md:px-12 pb-5">
          <div className="pointer-events-auto bg-[var(--background)] border border-[rgba(var(--foreground-rgb),0.10)] backdrop-blur-md rounded-lg shadow-[0_-4px_24px_rgba(var(--foreground-rgb),0.08)] px-5 py-3 flex items-center justify-between gap-4">
            <p
              className="font-ja text-sm text-[rgba(var(--foreground-rgb),0.60)] hidden sm:block"
              style={{ letterSpacing: "0.02em" }}
            >
              ¥10,000 から始められます
            </p>
            <div className="flex items-center gap-3 ml-auto">
              <a
                href="#pricing"
                className="font-en text-xs tracking-[0.06em] text-[rgba(var(--foreground-rgb),0.45)] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300 py-1.5"
              >
                Plans
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
    </>
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
        {/* Sub-nav: pill-style buttons */}
        <nav
          className="mt-6 flex flex-wrap items-center justify-center gap-2.5 page-entrance page-entrance-delay-1"
          aria-label="Page navigation"
        >
          {[
            { href: "#example", label: "Example" },
            { href: "#pricing", label: "Pricing" },
            { href: "#admin", label: "Admin" },
            { href: "#after-purchase", label: "After" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-en text-[0.68rem] tracking-[0.10em] uppercase text-[rgba(var(--foreground-rgb),0.50)] hover:text-[rgba(var(--foreground-rgb),0.80)] border border-[rgba(var(--foreground-rgb),0.12)] hover:border-[rgba(var(--foreground-rgb),0.28)] rounded-full px-4 py-1.5 transition-all duration-300"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      {/* ── Hero photo showcase ── */}
      <HeroShowcase photos={photos} />

      {/* ── Actual site links ── */}
      <PortfolioProof />

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

      {/* ── Admin (collapsible) ── */}
      <AdminConnection />

      {/* ── After purchase (collapsible) ── */}
      <AfterPurchase />

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
