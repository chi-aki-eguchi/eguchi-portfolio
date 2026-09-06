import { ArrowUpRight, CheckCircle2, Info, KeyRound, Mail } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { resolveServiceContactEmail } from "../../shared/service-visibility";
import {
  SERVICE_START_COPY,
  getCheckoutArrivalCopy,
  type ServiceStartLanguage,
  type ArrivalBannerCopy,
} from "../lib/service-start-copy";
import { api, jsonOrThrow } from "../lib/api";
import { usePageLanguage } from "../hooks/usePageLanguage";

const bodyStyle = {
  fontSize: "max(0.875rem, var(--body-size, 0.9rem))",
  lineHeight: "max(1.75, var(--body-leading, 1.95))",
  letterSpacing: "var(--body-tracking, 0.01em)",
} as const;

const labelStyle = {
  fontSize: "var(--section-label-size-eff, 0.75rem)",
  color: "var(--section-label-color)",
  letterSpacing: "var(--section-label-tracking, 0.10em)",
  lineHeight: "var(--section-leading, 1.2)",
} as const;

function checkoutArrivalSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

function LanguageSwitch({
  language,
  search,
}: {
  language: ServiceStartLanguage;
  search: string;
}) {
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
        <Link to={`/start${search}`} className="hover:text-[rgba(var(--foreground-rgb),0.76)]">
          JP
        </Link>
      )}
      <span aria-hidden="true">|</span>
      {language === "en" ? (
        <span aria-current="page" className="text-[rgba(var(--foreground-rgb),0.76)]">
          EN
        </span>
      ) : (
        <Link to={`/start/en${search}`} className="hover:text-[rgba(var(--foreground-rgb),0.76)]">
          EN
        </Link>
      )}
    </nav>
  );
}

function materialsMailtoHref(contactEmail: string, language: ServiceStartLanguage): string {
  const rows = SERVICE_START_COPY[language].materialsChecklist;
  const subject =
    language === "en" ? "Portfolio Kit materials" : "Portfolio Kit 素材の送付";
  return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    rows.join("\n"),
  )}`;
}

function PaymentGuidanceBanner({
  language,
  copy,
}: {
  language: ServiceStartLanguage;
  copy: ArrivalBannerCopy;
}) {
  const en = language === "en";
  const summaryRows = copy.summaryRows;
  return (
    <section className="mb-10 rounded-md border border-[rgba(var(--foreground-rgb),0.20)] bg-[rgba(var(--foreground-rgb),0.035)] p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <Info
          size={22}
          className="mt-1 shrink-0 text-[rgba(var(--foreground-rgb),0.72)]"
          aria-hidden="true"
        />
        <div>
          <p className="font-en uppercase mb-1" style={labelStyle}>
            {copy.badge}
          </p>
          <h2
            className={`${en ? "font-en" : "font-ja"} text-[rgba(var(--foreground-rgb),0.88)]`}
            style={{ fontSize: "clamp(1.25rem, 2.6vw, 1.7rem)", lineHeight: 1.5 }}
          >
            {copy.title}
          </h2>
        </div>
      </div>
      <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-3 border-t border-[rgba(var(--foreground-rgb),0.10)] pt-5">
        {summaryRows.map((row) => (
          <div key={row.label}>
            <dt
              className="font-en uppercase"
              style={{
                fontSize: "0.68rem",
                letterSpacing: "0.10em",
                color: "var(--text-quiet)",
              }}
            >
              {row.label}
            </dt>
            <dd
              className={`${en ? "font-en" : "font-ja"} mt-1 text-[rgba(var(--foreground-rgb),0.80)]`}
              style={{ fontSize: "0.95rem" }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 max-w-2xl text-[color:var(--text-quiet)]" style={bodyStyle}>
        {copy.body}
      </p>
    </section>
  );
}

function DomainReassurance({ language }: { language: ServiceStartLanguage }) {
  const en = language === "en";
  return (
    <section className="mt-12 md:mt-16 rounded-md border border-[rgba(var(--foreground-rgb),0.12)] bg-[rgba(var(--foreground-rgb),0.025)] p-5 sm:p-7">
      <p className="font-en uppercase mb-3" style={labelStyle}>
        Your domain
      </p>
      <h2
        className={`${en ? "font-en" : "font-ja"} text-[rgba(var(--foreground-rgb),0.84)]`}
        style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)", lineHeight: 1.55 }}
      >
        {en
          ? "You do not need to own a domain yet."
          : "独自ドメインを持っていなくても、大丈夫です。"}
      </h2>
      <p
        className="mt-4 max-w-3xl text-[color:var(--text-quiet)]"
        style={bodyStyle}
      >
        {en
          ? "A domain is the address people use to open your site. If you already have one, I will connect it. If not, we will choose and register one together over screen share. It will be registered in your name, and you only pay the domain provider's actual fee separately. I will explain each step before anything is purchased."
          : "独自ドメインとは、あなたのサイトを開くための専用の住所です。すでにお持ちなら、こちらでサイトにつなぎます。まだお持ちでなければ、画面を一緒に見ながら候補を選び、あなた名義で取得します。ドメイン会社へ支払う実費だけ別にかかりますが、購入前に内容と金額を確認しながら進めます。"}
      </p>
    </section>
  );
}

function ExternalButton({
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
      : "border border-[rgba(var(--foreground-rgb),0.18)] text-[rgba(var(--foreground-rgb),0.66)] hover:border-[rgba(var(--foreground-rgb),0.34)] hover:text-[rgba(var(--foreground-rgb),0.84)]";
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className={`inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-md px-6 py-2.5 font-ja text-sm transition-all duration-300 ${cls}`}
    >
      {children}
      {href.startsWith("http") ? <ArrowUpRight size={15} /> : null}
    </a>
  );
}

function StepPanel({
  title,
  subtitle,
  steps,
  children,
}: {
  title: string;
  subtitle: string;
  steps: readonly { title: string; body: string }[];
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--foreground-rgb),0.018)] p-5 sm:p-7">
      <p className="font-en uppercase mb-3" style={labelStyle}>
        {subtitle}
      </p>
      <h2
        className="font-ja text-[rgba(var(--foreground-rgb),0.84)]"
        style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)", lineHeight: 1.55 }}
      >
        {title}
      </h2>
      <ol className="mt-7 space-y-5">
        {steps.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-4">
            <span
              className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(var(--foreground-rgb),0.14)] font-en text-xs text-[color:var(--text-quiet)]"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="font-ja text-[rgba(var(--foreground-rgb),0.78)]">
                {step.title}
              </h3>
              <p
                className="mt-1 text-[color:var(--text-quiet)]"
                style={bodyStyle}
              >
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
        {children}
      </div>
    </section>
  );
}

function SupportSection({
  contactEmail,
  language,
}: {
  contactEmail: string;
  language: ServiceStartLanguage;
}) {
  const en = language === "en";
  return (
    <section className="mt-12 md:mt-16">
      <p className="font-en uppercase mb-3" style={labelStyle}>
        Support
      </p>
      <h2
        className={`${en ? "font-en" : "font-ja"} text-[rgba(var(--foreground-rgb),0.84)]`}
        style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)", lineHeight: 1.55 }}
      >
        {en ? "If anything is unclear, just ask." : "困ったら、そのまま聞いてください。"}
      </h2>
      <p
        className="mt-4 max-w-2xl text-[color:var(--text-quiet)]"
        style={bodyStyle}
      >
        {en
          ? "I handle the technical settings for you. If something does not look right, you do not need to diagnose it yourself — just email me what you were trying to do. A screenshot helps; please hide any passwords before sending one."
          : "難しい設定はこちらで対応します。何かおかしいと感じても、ご自身で原因を調べなくて大丈夫です。\n\n" +
            "「何をしようとしたか」をそのままメールで教えてください。画面のスクリーンショットがあると確認が早いです（パスワードは映さないようご注意ください）。"}
      </p>
      {contactEmail && (
        <div className="mt-6">
          <ExternalButton
            href={`mailto:${contactEmail}?subject=${encodeURIComponent(
              en ? "Portfolio Kit support" : "Portfolio Kit 相談",
            )}&body=${encodeURIComponent(
              en
                ? "What happened:\n\n\n(If possible, attach a screenshot — hide any passwords.)"
                : "困っている内容:\n\n\n(できれば画面のスクリーンショットを添付してください。パスワードは隠してください。)",
            )}`}
          >
            <Mail size={15} />
            {en ? "Email me" : "メールで相談する"}
          </ExternalButton>
        </div>
      )}
    </section>
  );
}

function HandoffCard({ language }: { language: ServiceStartLanguage }) {
  const en = language === "en";
  const copy = SERVICE_START_COPY[language];
  return (
    <section className="mt-12 md:mt-16 rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--background-rgb),0.52)] p-5 sm:p-7">
      <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start">
        <div>
          <p className="font-en uppercase mb-3" style={labelStyle}>
            Handoff card
          </p>
          <h2
            className={`${en ? "font-en" : "font-ja"} text-[rgba(var(--foreground-rgb),0.84)]`}
            style={{
              fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)",
              lineHeight: 1.55,
            }}
          >
            {en
              ? "The handover is one simple card."
              : "納品時に渡すのは、これだけです。"}
          </h2>
          <p
            className="mt-4 text-[color:var(--text-quiet)]"
            style={bodyStyle}
          >
            {copy.handoffIntro}
          </p>
          <p
            className="mt-4 text-[color:var(--text-quiet)]"
            style={bodyStyle}
          >
            {copy.handoffPasswordNote}
          </p>
        </div>
        <div className="rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--foreground-rgb),0.025)] p-4 sm:p-5">
          <p className="font-en text-xs uppercase tracking-[0.12em] text-[color:var(--text-quiet)]">
            Aki Eguchi Portfolio Kit
          </p>
          <div className="mt-5 divide-y divide-[rgba(var(--foreground-rgb),0.08)]">
            {copy.handoffRows.map((row) => (
              <div key={row} className="flex items-center gap-3 py-3">
                <CheckCircle2
                  size={16}
                  className="shrink-0 text-[color:var(--text-quiet)]"
                />
                <span
                  className={`${en ? "font-en" : "font-ja"} text-sm text-[rgba(var(--foreground-rgb),0.66)]`}
                >
                  {row}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ServiceStartPage({
  language = "ja",
}: {
  language?: ServiceStartLanguage;
}) {
  const copy = SERVICE_START_COPY[language];
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const contactEmail = resolveServiceContactEmail(
    settingsData?.contactEmail,
    settingsData?.siteUrl,
    typeof window === "undefined" ? undefined : window.location.hostname,
  );
  const en = language === "en";
  const search = checkoutArrivalSearch();
  const checkoutArrivalCopy = getCheckoutArrivalCopy(language, search);

  usePageLanguage(language);

  return (
    <section
      lang={language}
      className="max-w-5xl mx-auto px-5 sm:px-6 md:px-12 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(6.5rem*var(--spacing-page-top,1))] pb-16 md:pb-28"
    >
      <LanguageSwitch language={language} search={search} />
      {checkoutArrivalCopy ? (
        <PaymentGuidanceBanner language={language} copy={checkoutArrivalCopy} />
      ) : null}
      <header className="grid gap-10 md:grid-cols-[1.02fr_0.98fr] md:items-center">
        <div>
          <p className="font-en uppercase mb-7" style={labelStyle}>
            {copy.pageLabel}
          </p>
          <h1
            className={`${en ? "font-en" : "font-ja"} text-[rgba(var(--foreground-rgb),0.88)]`}
            style={{
              fontSize: "clamp(1.75rem, 4vw, 3rem)",
              lineHeight: 1.45,
              letterSpacing: "0.02em",
            }}
          >
            {copy.pageTitle}
          </h1>
          <p
            className="mt-7 max-w-xl text-[color:var(--text-quiet)]"
            style={bodyStyle}
          >
            {copy.intro}
          </p>
          <p
            className="mt-2 max-w-xl text-[color:var(--text-quiet)]"
            style={bodyStyle}
          >
            {copy.introNote}
          </p>
          <div className="mt-6 rounded-md border border-[rgba(var(--foreground-rgb),0.12)] bg-[rgba(var(--foreground-rgb),0.018)] px-4 py-3 text-[color:var(--text-quiet)]"
            style={bodyStyle}
          >
            <p>{copy.supportNotice}</p>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            {contactEmail && (
              <ExternalButton href={materialsMailtoHref(contactEmail, language)}>
                <Mail size={15} />
                {en ? "Send your materials" : "素材を送る"}
              </ExternalButton>
            )}
            <Link
              to={en ? "/portfolio-kit/en" : "/portfolio-kit"}
              className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-md border border-[rgba(var(--foreground-rgb),0.16)] px-6 py-2.5 font-ja text-sm text-[rgba(var(--foreground-rgb),0.62)] hover:border-[rgba(var(--foreground-rgb),0.32)] hover:text-[rgba(var(--foreground-rgb),0.82)] transition-colors duration-300"
            >
              {en ? "Back to pricing" : "料金ページへ戻る"}
            </Link>
          </div>
          <p
            className="mt-5 text-[color:var(--text-quiet)]"
            style={{ fontSize: "0.78rem", lineHeight: 1.8 }}
          >
            {en
              ? (
                <>
                  {copy.supportFooter}
                  <br />
                  If you have not purchased yet, please start from the pricing page.
                </>
              )
              : (
                <>
                  {copy.supportFooter}
                  <br />
                  まだ購入していない方は、先に料金ページをご覧ください。
                </>
              )}
          </p>
        </div>

        <figure className="rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--foreground-rgb),0.018)] p-3 shadow-[0_20px_70px_rgba(var(--foreground-rgb),0.06)]">
          <img
            src="/og-service.jpg"
            alt="Aki Eguchi Portfolio Kit"
            width="1200"
            height="630"
            className="aspect-[1200/630] w-full rounded-[4px] object-cover"
            loading="eager"
            decoding="async"
          />
        </figure>
      </header>

      <DomainReassurance language={language} />

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <StepPanel
          title={copy.deliveryPanelTitle}
          subtitle="Delivery"
          steps={copy.deliverySteps}
        >
          {contactEmail && (
            <ExternalButton href={materialsMailtoHref(contactEmail, language)}>
              <Mail size={15} />
              {en ? "Send your materials" : "素材を送る"}
            </ExternalButton>
          )}
        </StepPanel>

        <StepPanel
          title={copy.afterHandoffTitle}
          subtitle="First steps"
          steps={copy.afterHandoffSteps}
        >
          <ExternalButton href="/admin/login" variant="outline">
            <KeyRound size={15} />
            {en ? "Open the admin login" : "管理画面へ"}
          </ExternalButton>
        </StepPanel>
      </div>

      <SupportSection contactEmail={contactEmail} language={language} />

      <HandoffCard language={language} />
    </section>
  );
}
