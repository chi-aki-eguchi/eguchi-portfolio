import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { usePageLanguage } from "../hooks/usePageLanguage";
import { api, jsonOrThrow } from "../lib/api";
import { objectPositionFromFocal, srcFor, srcSetFor } from "../lib/picture";
import { safeHref } from "../lib/utils";
import { resolveServiceContactEmail } from "../../shared/service-visibility";
import {
  parseServicePageConfig,
  ENGLISH_PLAN_COPY,
  englishPlanSources,
  priceWithUsdEstimate,
  yenAmountFromPrice,
  isStripeLive,
  anyPlanLive,
  primaryStripeUrl,
  startingStripeUrl,
  mailtoFallback,
  type ServicePageConfig,
  type PlanItem,
  type FaqItem,
  type ExampleLinkItem,
} from "../lib/service-config";

const labelCls = "font-en uppercase text-center";
const labelStyle = {
  fontSize: "var(--section-label-size, 0.75rem)",
  color: "var(--section-label-color)",
  letterSpacing: "var(--section-label-tracking, 0.10em)",
  lineHeight: "var(--section-leading, 1.2)",
} as const;
const bodyStyle = {
  fontSize: "var(--body-size, 0.9rem)",
  lineHeight: "var(--body-leading, 1.95)",
  letterSpacing: "var(--body-tracking, 0.01em)",
} as const;

type ServiceLanguage = "ja" | "en";

function englishServiceConfigFrom(
  source: ServicePageConfig,
): ServicePageConfig {
  const planSources = englishPlanSources(source);
  const plans: PlanItem[] = ENGLISH_PLAN_COPY.flatMap((copy, index) => {
    const plan = planSources[index];
    if (!plan) return [];
    const { yen: _yen, namePattern: _namePattern, ...text } = copy;
    return [
      {
        ...text,
        points: [...text.points],
        price: priceWithUsdEstimate(plan.price),
        stripeUrl: plan.stripeUrl,
        primary: plan.primary,
      },
    ];
  });
  const startingPlan = planSources
    .filter((plan): plan is PlanItem => plan !== undefined)
    .sort(
      (a, b) =>
        (yenAmountFromPrice(a.price) ?? Number.POSITIVE_INFINITY) -
        (yenAmountFromPrice(b.price) ?? Number.POSITIVE_INFINITY),
    )[0];
  const startingPrice = startingPlan?.price ?? "¥30,000";

  return {
    enabled: source.enabled,
    hero: {
      label: "Portfolio Kit",
      title: "A quiet portfolio,\nready for your photographs.",
      body: "Aki Eguchi Portfolio Kit is a finished portfolio site made for photographers.\nI set everything up and hand it over already published, under your own name and domain.",
      facts: [
        {
          title: "Price",
          body: `${priceWithUsdEstimate(startingPrice)}, one-time`,
        },
        {
          title: "Included",
          body: "Domain, hosting, and setup — all handled for you",
        },
        {
          title: "Launch",
          body: "Delivered within three days of receiving your materials",
        },
      ],
      ctaPricing: "View pricing and the process",
      ctaExample: "Explore the example site",
    },
    examples: {
      label: "Actual site",
      title: "The site you are viewing is\nthe working example.",
      body: "Explore its Gallery, About, and Contact pages to see the pacing, spacing, and path from photographs to inquiries.",
      cta: "View pricing",
      links: [
        {
          title: "Gallery",
          body: "See how photographs, categories, and white space work together.",
          href: "/gallery",
        },
        {
          title: "About",
          body: "See how a portrait, biography, and artist information are presented.",
          href: "/about",
        },
        {
          title: "Contact",
          body: "See a simple path to inquiries and social links.",
          href: "/contact",
        },
      ],
    },
    painSolutions: {
      label: "For photographers",
      items: [
        {
          concern: "Your work disappears into the feed",
          concernBody:
            "Photographs shared on social media become harder to find as time passes.",
          solution: "A lasting home for the work",
          solutionBody:
            "Keep photographs in a considered space where sequence, scale, and white space are already part of the design.",
        },
        {
          concern: "You need one professional link",
          concernBody:
            "When an assignment or exhibition comes up, you need one place for your work, profile, and contact details.",
          solution: "Work, profile, and contact together",
          solutionBody:
            "Share one site that moves quietly from the photographs to the person and a clear way to get in touch.",
        },
        {
          concern: "You want control over the edit",
          concernBody:
            "The order, size, and spacing of photographs are part of how the work is read.",
          solution: "Update it from the admin panel",
          solutionBody:
            "Add photographs, change their order, and edit your profile and contact details in the browser.",
        },
      ],
    },
    pricing: {
      label: "Pricing",
      noteOnline:
        "You can close the checkout page safely. Within 24 hours of payment, I will email a short request for your materials (Stripe also sends a receipt automatically).",
      noteOffline:
        "Online checkout is being prepared. For now, use the email button or the contact details below.",
      disclaimer:
        "Checkout is charged in JPY. USD amounts are estimates only and vary with exchange rates and your card provider. Separate running costs: hosting is usually about ¥500–¥1,000 per month, and a custom domain about ¥1,500–¥2,000 per year, registered in your name. Design changes and custom work are quoted separately.",
      plans,
    },
    purchaseFlow: {
      label: "After purchase",
      title: "A clear handover, without a hidden wait.",
      body: "Within 24 hours of payment you receive a request for your materials, and once they are ready, the site is delivered within three days, already published.",
      steps: [
        {
          title: "Your first email (within 24 hours)",
          body: "Within 24 hours of payment, I will email a short request for your materials. Even if you close the checkout page, the same guidance arrives by email.",
        },
        {
          title: "Send your materials",
          body: "Reply with the name you want displayed, profile text, contact details, social links, and the first photographs. A small selection is enough. If you want a custom domain, we register it together in about 30 minutes over screen share, in your name.",
        },
        {
          title: "I set everything up (within three days)",
          body: "Once your materials are ready, I prepare the hosting, connect the domain, and set up your profile and contact details — the site is handed over already published.",
        },
        {
          title: "Handover",
          body: "You receive the public site URL, admin URL, and password. From there, you only add photographs. Guidance on everyday use stays available — currently unlimited.",
        },
      ],
      footnote:
        "Photograph sizing is there to create rhythm and emphasis. You can also keep every image at the same size.",
    },
    faq: {
      label: "FAQ",
      items: [
        {
          q: "Is the site created automatically as soon as I pay?",
          a: "No — I prepare each site personally. Within 24 hours of payment you receive a request for your materials, and once they are ready, the site is delivered within three days, already published.",
        },
        {
          q: "Can I use my own domain?",
          a: "Yes. You can publish at an address such as yourname.com. If you already own a domain, I connect it for you. If not, we register one together (about ¥1,500–¥2,000 per year, in your name).",
        },
        {
          q: "Are there monthly costs?",
          a: "Portfolio Kit has no monthly subscription. The only running costs are external services: hosting is usually about ¥500–¥1,000 per month, and a custom domain about ¥1,500–¥2,000 per year. Provider prices and usage can change.",
        },
        {
          q: "Can I change photographs and text later?",
          a: "Yes. You can update photographs, order, profile text, and contact details from the admin panel. Larger design changes and individual customisation are quoted separately.",
        },
        {
          q: "What does one purchase allow?",
          a: "One purchase covers one website. A second website requires another purchase. The kit may not be resold or redistributed as a template. Kit updates are currently provided at no additional charge, but this may change in the future. Guidance on everyday use is currently unlimited, though this may become time-limited in the future. Design changes and custom work are quoted separately.",
        },
        {
          q: "What languages are available?",
          a: "The admin panel is available in English and Japanese — switch anytime with the JP | EN toggle. Support is provided in Japanese and simple English.",
        },
        {
          q: "What happens if I stop using the site?",
          a: "You can stop the recurring hosting cost by ending the hosting service. Deleting the project also deletes its photographs and settings, so save anything you need first.",
        },
      ],
    },
    finalCta: {
      title: "Begin with the photographs.",
      body: "Tell me what you want the site to hold, and I will explain the most suitable way to begin.",
      ctaOnline: "Choose assisted setup",
      ctaOffline: "Ask by email",
      snsLinks: source.finalCta.snsLinks,
    },
    stickyCta: {
      text: `${priceWithUsdEstimate(startingPrice)} — publishing handled for you`,
      ctaOnline: "Apply",
      ctaOffline: "Ask a question",
      pricingCta: "View pricing",
    },
    adminShowcase: {
      label: "Admin panel",
      title: "Twelve layouts and more than 140 settings, in one place.",
      body: "Without editing code, you can add photographs and shape their sequence, spacing, typography, profile, and contact path at your own pace.",
      features: [
        {
          title: "Photographs",
          body: "Upload, reorder, categorise, and adjust the focal point of each image.",
        },
        {
          title: "Layout and space",
          body: "Choose from twelve layouts, then tune order, scale, and white space to suit the work.",
        },
        {
          title: "Type and colour",
          body: "Choose Japanese and Latin typefaces, size, leading, background colour, and subtle paper or film textures.",
        },
        {
          title: "Profile and contact",
          body: "Edit your name, biography, social links, and inquiry details in Japanese and English.",
        },
        {
          title: "Series and categories",
          body: "Group work into series or categories, with a cover image and statement.",
        },
        {
          title: "Sharing and search",
          body: "Prepare the image and description shown on social platforms and in search results.",
        },
      ],
      demoCta: "See the visual preview",
    },
  };
}

function serviceMailtoFallback(
  contactEmail: string,
  language: ServiceLanguage,
  planName?: string,
): string {
  if (language === "ja") return mailtoFallback(contactEmail, planName);
  const subject = planName
    ? `Portfolio Kit inquiry (${planName})`
    : "Portfolio Kit inquiry";
  return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}`;
}

function LanguageSwitch({ language }: { language: ServiceLanguage }) {
  return (
    <nav
      aria-label="Language"
      className="mb-8 flex items-center justify-end gap-2 font-en text-[0.7rem] tracking-[0.12em] text-[color:var(--text-quiet)]"
    >
      {language === "ja" ? (
        <span aria-current="page" className="text-[rgba(var(--foreground-rgb),0.76)]">
          JP
        </span>
      ) : (
        <Link to="/portfolio-kit" className="hover:text-[rgba(var(--foreground-rgb),0.76)]">
          JP
        </Link>
      )}
      <span aria-hidden="true">|</span>
      {language === "en" ? (
        <span aria-current="page" className="text-[rgba(var(--foreground-rgb),0.76)]">
          EN
        </span>
      ) : (
        <Link to="/portfolio-kit/en" className="hover:text-[rgba(var(--foreground-rgb),0.76)]">
          EN
        </Link>
      )}
    </nav>
  );
}

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
function Accordion({ items }: { items: FaqItem[] }) {
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
                className="mt-1 shrink-0 text-[color:var(--text-quiet)] transition-transform duration-300"
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
                className="pb-5 text-[color:var(--text-quiet)]"
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
          <p className="font-en text-[0.58rem] tracking-[0.12em] uppercase text-[color:var(--text-quiet)]">
            akieguchi.com / gallery
          </p>
          <Link
            to="/gallery"
            className="tap-target font-en text-[0.58rem] tracking-[0.12em] uppercase text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.62)] transition-colors duration-300"
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
                    className="block font-en text-[0.58rem] tracking-[0.10em] text-[color:var(--text-quiet)]"
                  >
                    {label}
                  </span>
                ))}
              </nav>
            </div>
            <p className="font-en text-[0.56rem] tracking-[0.12em] uppercase text-[color:var(--text-quiet)]">
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
  item: ExampleLinkItem;
  photo: ServicePhoto | undefined;
}) {
  // `to` pushes history, so only an in-site path belongs there. Anything else
  // is treated as an external link and goes through the same guard as the rest
  // of the site — previously any settings string landed in the router.
  const inSite = item.href.startsWith("/") && !item.href.startsWith("//");
  const linkClass =
    "group grid grid-cols-[5.5rem_1fr] sm:grid-cols-[7rem_1fr] gap-4 border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-4";
  const inner = (
    <>
      <span className="block aspect-[4/3] overflow-hidden bg-[rgba(var(--foreground-rgb),0.035)]">
        {photo ? (
          <PhotoTile photo={photo} size="small" />
        ) : (
          <span className="block h-full w-full" />
        )}
      </span>
      <span className="min-w-0">
        <span className="font-en text-[0.58rem] tracking-[0.12em] uppercase text-[color:var(--text-quiet)] group-hover:text-[color:var(--text-quiet)] transition-colors duration-300">
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
          className="mt-1.5 block text-[color:var(--text-quiet)]"
          style={{ fontSize: "0.82rem", lineHeight: 1.8 }}
        >
          {item.body}
        </span>
      </span>
    </>
  );

  return inSite ? (
    <Link to={item.href} className={linkClass}>
      {inner}
    </Link>
  ) : (
    <a
      href={safeHref(item.href)}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
    >
      {inner}
    </a>
  );
}

/* ── Actual site proof (compact) ── */
function PortfolioProof({
  photos,
  config,
}: {
  photos: ServicePhoto[];
  config: ServicePageConfig["examples"];
}) {
  return (
    <section id="example" className="mt-7 md:mt-10 page-entrance scroll-mt-24">
      <SectionLabel>{config.label}</SectionLabel>
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className="font-ja text-[rgba(var(--foreground-rgb),0.82)]"
          style={{
            fontSize: "clamp(1.18rem, 2vw, 1.55rem)",
            letterSpacing: "0.03em",
            lineHeight: 1.75,
          }}
        >
          {config.title.split("\n").map((line, i) => (
            <span key={i} className={i > 0 ? "block" : undefined}>
              {i > 0 && <wbr />}
              {line}
            </span>
          ))}
        </h2>
        <p
          className="mt-4 text-[color:var(--text-quiet)]"
          style={bodyStyle}
        >
          {config.body}
        </p>
      </div>
      <div className="mt-8 max-w-3xl mx-auto border-y border-[rgba(var(--foreground-rgb),0.08)]">
        {config.links.map((item, i) => (
          <SitePagePreview key={item.href} item={item} photo={photos[i]} />
        ))}
      </div>
      <div className="mt-7 text-center">
        <ServiceButton href="#pricing">{config.cta}</ServiceButton>
      </div>
    </section>
  );
}

/* ── Pain / solution pairs ── */
function AudienceAndFeatures({
  config,
  language,
}: {
  config: ServicePageConfig["painSolutions"];
  language: ServiceLanguage;
}) {
  return (
    <section className="mt-10 md:mt-14 page-entrance">
      <SectionLabel>{config.label}</SectionLabel>
      <div className="max-w-4xl mx-auto border-y border-[rgba(var(--foreground-rgb),0.08)]">
        {config.items.map((item) => (
          <div
            key={item.concern}
            className="grid grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 md:gap-10 border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-5"
          >
            <div>
              <p className="font-ja text-[0.62rem] tracking-[0.04em] text-[color:var(--text-quiet)]">
                {language === "en" ? "What feels difficult" : "こんな悩み"}
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
                className="mt-1.5 text-[color:var(--text-quiet)]"
                style={{ fontSize: "0.84rem", lineHeight: 1.85 }}
              >
                {item.concernBody}
              </p>
            </div>
            <div>
              <p className="font-ja text-[0.62rem] tracking-[0.04em] text-[color:var(--text-quiet)]">
                {language === "en" ? "With this kit" : "このサイトなら"}
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
                className="mt-1.5 text-[color:var(--text-quiet)]"
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
function PurchaseDetails({
  config,
}: {
  config: ServicePageConfig["purchaseFlow"];
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <section
      id="after-purchase"
      className="mt-10 md:mt-14 page-entrance scroll-mt-24"
    >
      <SectionLabel>{config.label}</SectionLabel>
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className="font-ja text-[rgba(var(--foreground-rgb),0.82)]"
          style={{
            fontSize: "clamp(1.18rem, 2vw, 1.55rem)",
            letterSpacing: "0.03em",
            lineHeight: 1.75,
          }}
        >
          {config.title}
        </h2>
        <p
          className="mt-4 text-[color:var(--text-quiet)]"
          style={bodyStyle}
        >
          {config.body}
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="mt-5 inline-flex items-center gap-2 font-en text-xs tracking-[0.08em] uppercase text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.65)] transition-colors duration-300 cursor-pointer"
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
          {config.steps.map((step, i) => (
            <li
              key={step.title}
              className="grid grid-cols-[2.5rem_1fr] gap-4 border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-4"
            >
              <span
                className="font-en text-[color:var(--text-quiet)] tracking-[0.08em]"
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
                  className="mt-1.5 block text-[color:var(--text-quiet)]"
                  style={bodyStyle}
                >
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
        {config.footnote && (
          <p
            className="mt-5 max-w-2xl mx-auto text-center text-[color:var(--text-quiet)]"
            style={{ fontSize: "0.82rem", lineHeight: 1.9 }}
          >
            {config.footnote}
          </p>
        )}
      </Collapsible>
    </section>
  );
}

/* ── Pricing card ── */
function PlanCard({
  plan,
  contactEmail,
  language,
}: {
  plan: PlanItem;
  contactEmail: string;
  language: ServiceLanguage;
}) {
  const live = isStripeLive(plan.stripeUrl);
  const finalHref = live
    ? plan.stripeUrl
    : contactEmail
      ? serviceMailtoFallback(contactEmail, language, plan.name)
      : "/contact";
  const cLabel = live
    ? plan.cta
    : contactEmail
      ? language === "en"
        ? "Apply or ask by email"
        : "メールで申し込む・相談する"
      : language === "en"
        ? "Contact"
        : "問い合わせる";
  return (
    <article
      className={`relative rounded-md flex flex-col min-h-full transition-shadow duration-300 ${
        plan.primary
          ? "border-2 border-[rgba(var(--foreground-rgb),0.28)] bg-[rgba(var(--foreground-rgb),0.025)] p-7 md:p-9 shadow-[0_2px_20px_rgba(var(--foreground-rgb),0.06)]"
          : "border border-[rgba(var(--foreground-rgb),0.10)] p-6 md:p-8"
      }`}
    >
      {plan.primary && (
        <p className="absolute right-5 top-5 font-en text-[0.60rem] tracking-[0.12em] uppercase bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1 rounded-sm">
          Recommended
        </p>
      )}
      <h3
        className="font-ja font-medium break-words"
        style={{
          fontSize: plan.primary ? "1.15rem" : "1.08rem",
          color: `rgba(var(--foreground-rgb),0.82)`,
          letterSpacing: "0.02em",
          lineHeight: 1.5,
        }}
      >
        {plan.name}
      </h3>
      <p
        className="mt-3 font-en tracking-[0.02em] text-[rgba(var(--foreground-rgb),0.68)]"
        style={{ fontSize: plan.primary ? "1.4rem" : "1.2rem" }}
      >
        {plan.price}
      </p>
      <p
        className="mt-3 text-[color:var(--text-quiet)]"
        style={bodyStyle}
      >
        {plan.sub}
      </p>
      <ul className="mt-5 space-y-2.5 flex-1">
        {plan.points.map((p, i) => (
          <li
            key={i}
            className="flex gap-2.5 text-[color:var(--text-quiet)]"
            style={{
              fontSize: "var(--body-size, 0.85rem)",
              lineHeight: "1.75",
            }}
          >
            <span
              aria-hidden="true"
              className="text-[color:var(--text-quiet)] select-none"
            >
              —
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <a
        href={finalHref}
        {...(live ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`mt-7 inline-flex min-h-11 items-center self-start font-en text-sm tracking-[0.03em] px-7 py-2.5 rounded-md transition-opacity duration-300 ${
          plan.primary
            ? "bg-[var(--foreground)] text-[var(--background)] hover:opacity-85"
            : "border border-[rgba(var(--foreground-rgb),0.25)] text-[rgba(var(--foreground-rgb),0.70)] hover:opacity-70"
        }`}
      >
        {cLabel}
      </a>
    </article>
  );
}

/* ── Admin showcase section ── */
function AdminShowcase({
  config,
  language,
}: {
  config: ServicePageConfig["adminShowcase"];
  language: ServiceLanguage;
}) {
  return (
    <section
      id="admin-panel"
      className="mt-10 md:mt-14 page-entrance scroll-mt-24"
    >
      <SectionLabel>{config.label}</SectionLabel>
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className="font-ja text-[rgba(var(--foreground-rgb),0.82)]"
          style={{
            fontSize: "clamp(1.18rem, 2vw, 1.55rem)",
            letterSpacing: "0.03em",
            lineHeight: 1.75,
          }}
        >
          {config.title}
        </h2>
        <p
          className="mt-4 text-[color:var(--text-quiet)]"
          style={bodyStyle}
        >
          {config.body}
        </p>
      </div>
      <div
        data-admin-feature-list
        className="mt-8 max-w-3xl mx-auto border-y border-[rgba(var(--foreground-rgb),0.08)]"
      >
        {config.features.map((feat) => (
          <div
            key={feat.title}
            className="grid grid-cols-[5.5rem_1fr] sm:grid-cols-[7rem_1fr] gap-4 border-t first:border-t-0 border-[rgba(var(--foreground-rgb),0.08)] py-4"
          >
            <span
              className="font-ja text-[rgba(var(--foreground-rgb),0.74)]"
              style={{
                fontSize: "0.88rem",
                letterSpacing: "0.03em",
                lineHeight: 1.55,
              }}
            >
              {feat.title}
            </span>
            <span
              className="text-[color:var(--text-quiet)]"
              style={{ fontSize: "0.84rem", lineHeight: 1.85 }}
            >
              {feat.body}
            </span>
          </div>
        ))}
      </div>
      {language === "en" && (
        <div
          role="note"
          className="mt-7 max-w-3xl mx-auto rounded-md border border-[rgba(var(--foreground-rgb),0.12)] bg-[rgba(var(--foreground-rgb),0.018)] px-5 py-4 text-left text-[color:var(--text-quiet)]"
          style={bodyStyle}
        >
          <p>
            The admin panel is available in English and Japanese — switch
            anytime with the JP | EN toggle.
          </p>
          <p className="mt-2">
            Support is provided in Japanese and simple English.
          </p>
        </div>
      )}
      <div className="mt-8 text-center">
        <ServiceButton href="/admin/demo">
          {language === "en" ? "Try the current admin demo" : "管理画面を触ってみる"}
        </ServiceButton>
        <div className="mt-3">
          <a className="text-[0.76rem] leading-7 text-[color:var(--text-quiet)] underline underline-offset-4" href="/?portfolio-kit-experience=1">{config.demoCta}</a>
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA section ── */
function FinalCTA({
  config,
  stripeHref,
  contactEmail,
  language,
}: {
  config: ServicePageConfig["finalCta"];
  stripeHref: string | null;
  contactEmail: string;
  language: ServiceLanguage;
}) {
  const live = !!stripeHref;
  const href =
    stripeHref ??
    (contactEmail
      ? serviceMailtoFallback(contactEmail, language)
      : "/contact");
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
          {config.title}
        </p>
        <p
          className="mt-4 text-[color:var(--text-quiet)]"
          style={bodyStyle}
        >
          {config.body}
        </p>
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={href}
            {...(live ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex min-h-11 items-center font-en text-sm tracking-[0.03em] bg-[var(--foreground)] text-[var(--background)] px-8 py-2.5 rounded-md hover:opacity-85 transition-opacity duration-300"
          >
            {live ? config.ctaOnline : config.ctaOffline}
          </a>
          {config.snsLinks.length > 0 && (
            <nav className="flex items-center gap-5" aria-label="SNS">
              {config.snsLinks.map((link) => (
                <a
                  key={link.label}
                  // Settings-supplied URL. Every other page routes these through
                  // safeHref; this one rendered them raw.
                  href={safeHref(link.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-en text-xs tracking-[0.06em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.65)] transition-colors duration-300 py-1.5"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Sticky CTA bar ── */
function StickyCtaBar({
  config,
  stripeHref,
  contactEmail,
  language,
}: {
  config: ServicePageConfig["stickyCta"];
  stripeHref: string | null;
  contactEmail: string;
  language: ServiceLanguage;
}) {
  const [visible, setVisible] = useState(false);
  const live = !!stripeHref;

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

  const href =
    stripeHref ??
    (contactEmail
      ? serviceMailtoFallback(contactEmail, language)
      : "/contact");

  return (
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
            {config.text}
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <a
              href="#pricing"
              className="font-ja text-xs tracking-[0.04em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300 py-1.5"
            >
              {config.pricingCta}
            </a>
            <a
              href={href}
              {...(live
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="inline-flex items-center font-en text-sm tracking-[0.03em] bg-[var(--foreground)] text-[var(--background)] px-5 py-2 rounded-md hover:opacity-85 transition-opacity duration-300"
            >
              {live ? config.ctaOnline : config.ctaOffline}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServicePage({
  language = "ja",
}: {
  language?: ServiceLanguage;
}) {
  const { data: photosData } = useQuery({
    queryKey: ["photos", "service-preview"],
    queryFn: async () =>
      jsonOrThrow(await api.photos.$get({ query: { limit: "8" } })),
  });
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const photos = (photosData?.photos ?? []) as ServicePhoto[];
  const sourceConfig = parseServicePageConfig(settingsData?.servicePageConfig);
  const config =
    language === "en"
      ? englishServiceConfigFrom(sourceConfig)
      : sourceConfig;
  const contactEmail = resolveServiceContactEmail(
    settingsData?.contactEmail,
    settingsData?.siteUrl,
    typeof window === "undefined" ? undefined : window.location.hostname,
  );
  const live = anyPlanLive(config);
  const ref = usePageEntrance([photos.length, language]);

  usePageLanguage(language);

  return (
    <section
      ref={ref}
      lang={language}
      className="max-w-5xl mx-auto px-5 sm:px-6 md:px-12 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(6.5rem*var(--spacing-page-top,1))] pb-16 md:pb-28"
    >
      <LanguageSwitch language={language} />
      {/* ── Hero ── */}
      <header className="max-w-3xl mx-auto text-center">
        <p className={`${labelCls} mb-8 page-entrance`} style={labelStyle}>
          {config.hero.label}
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
          {config.hero.title.split("\n").map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p
          className="mt-7 text-[color:var(--text-quiet)] page-entrance page-entrance-delay-1 max-w-2xl mx-auto"
          style={bodyStyle}
        >
          {config.hero.body.split("\n").map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 border-y border-[rgba(var(--foreground-rgb),0.10)] page-entrance page-entrance-delay-1">
          {config.hero.facts.map((fact) => (
            <div
              key={fact.title}
              className="px-4 py-4 sm:border-l sm:first:border-l-0 border-[rgba(var(--foreground-rgb),0.10)]"
            >
              <p className={labelCls} style={labelStyle}>
                {fact.title}
              </p>
              <p
                className="mt-2 font-ja text-[rgba(var(--foreground-rgb),0.72)]"
                style={{ fontSize: "0.82rem", lineHeight: 1.7 }}
              >
                {fact.body}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 page-entrance page-entrance-delay-1">
          <ServiceButton href="/admin/demo">
            {language === "en" ? "Try the current admin demo" : "管理画面を触ってみる"}
          </ServiceButton>
          <ServiceButton href="#pricing" variant="outline">
            {config.hero.ctaPricing}
          </ServiceButton>
        </div>
      </header>

      {/* ── Hero site preview ── */}
      <HeroSitePreview photos={photos} />

      {/* ── Actual site links ── */}
      <PortfolioProof photos={photos} config={config.examples} />

      {/* ── Fit + value ── */}
      <AudienceAndFeatures config={config.painSolutions} language={language} />

      {/* ── Pricing ── */}
      <section
        id="pricing"
        className="mt-12 md:mt-16 page-entrance scroll-mt-24"
      >
        <SectionLabel>{config.pricing.label}</SectionLabel>
        <div
          className={`grid grid-cols-1 gap-6 md:gap-8 items-start ${
            config.pricing.plans.length > 1
              ? "sm:grid-cols-2"
              : "max-w-xl mx-auto"
          }`}
        >
          {config.pricing.plans.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              contactEmail={contactEmail}
              language={language}
            />
          ))}
        </div>
        <p
          className="text-center mt-7 text-[color:var(--text-quiet)]"
          style={{ fontSize: "0.82rem", lineHeight: 1.8 }}
        >
          {live ? config.pricing.noteOnline : config.pricing.noteOffline}
        </p>
        <p
          className="text-center mt-2 text-[color:var(--text-quiet)]"
          style={{ fontSize: "0.8rem", lineHeight: 1.9 }}
        >
          {config.pricing.disclaimer}
        </p>
        <p className="mt-4 text-center">
          <Link
            to={language === "en" ? "/start/en" : "/start"}
            className="text-[0.76rem] leading-7 text-[color:var(--text-quiet)] underline underline-offset-4 transition-colors duration-300 hover:text-[rgba(var(--foreground-rgb),0.70)]"
          >
            {language === "en"
              ? "Preview what happens after purchase"
              : "購入後の流れを先に見る"}
          </Link>
        </p>
      </section>

      <StickyCtaBar
        config={config.stickyCta}
        stripeHref={startingStripeUrl(config)}
        contactEmail={contactEmail}
        language={language}
      />

      {/* ── Purchase details (collapsible) ── */}
      <PurchaseDetails config={config.purchaseFlow} />

      {/* ── Admin showcase ── */}
      <AdminShowcase config={config.adminShowcase} language={language} />

      {/* ── FAQ (accordion) ── */}
      <section className="mt-10 md:mt-14 page-entrance">
        <SectionLabel>{config.faq.label}</SectionLabel>
        <div className="max-w-2xl mx-auto">
          <Accordion items={config.faq.items} />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <FinalCTA
        config={config.finalCta}
        stripeHref={primaryStripeUrl(config)}
        contactEmail={contactEmail}
        language={language}
      />
    </section>
  );
}
