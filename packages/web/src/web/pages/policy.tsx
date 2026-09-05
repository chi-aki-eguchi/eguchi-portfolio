import { Link } from "wouter";
import {
  policyDocument,
  policyPath,
  type PolicyKind,
  type PolicyLanguage,
} from "../../shared/policy-content";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { usePageLanguage } from "../hooks/usePageLanguage";
import { useServiceVisibility } from "../components/provider";

const POLICY_KINDS: readonly PolicyKind[] = ["privacy", "terms", "legal"];
const policyBodyStyle = {
  // Conditions that affect a purchase must remain readable even when the
  // portfolio's art-direction settings use a smaller body size or leading.
  fontSize: "max(0.875rem, var(--body-size, 0.95rem))",
  lineHeight: "max(1.75, var(--body-leading, 1.9))",
} as const;

export default function PolicyPage({
  kind,
  language = "ja",
}: {
  kind: PolicyKind;
  language?: PolicyLanguage;
}) {
  usePageLanguage(language);
  const { isResolved, showService } = useServiceVisibility();
  const includeService = kind === "legal" || (isResolved && showService);
  const doc = policyDocument(kind, language);
  const sections = doc.sections.filter(
    (section) => !section.serviceOnly || includeService,
  );
  const entranceRef = usePageEntrance([kind, language, includeService]);
  const contactPath = language === "en" ? "/en/contact" : "/contact";
  const languageFont = language === "en" ? "font-en" : "font-ja";
  const proseClass = language === "en" ? "font-en" : "font-ja ja-prose";

  const labels: Record<PolicyLanguage, Record<PolicyKind, string>> = {
    ja: {
      privacy: "Privacy",
      terms: "利用条件",
      legal: "販売条件・特商法表示",
    },
    en: {
      privacy: "Privacy",
      terms: "Terms",
      legal: "Online sales",
    },
  };

  return (
    <section
      className="max-w-3xl mx-auto site-page site-page-top pb-20 md:pb-28"
      ref={entranceRef}
      lang={language}
      data-policy-kind={kind}
      data-policy-language={language}
    >
      <header className="max-w-2xl page-entrance">
        <p
          className="font-en uppercase text-[color:var(--text-quiet)] mb-5"
          style={{
            fontSize: "var(--text-note, 0.7rem)",
            letterSpacing: "0.14em",
          }}
        >
          {doc.eyebrow}
        </p>
        <h1
          className={`${languageFont} font-medium break-words`}
          style={{
            fontSize: "clamp(1.55rem, 3vw, 2.25rem)",
            lineHeight: 1.4,
            letterSpacing: "0.025em",
          }}
        >
          {doc.title}
        </h1>
        <p
          className={`mt-6 text-[color:var(--text-quiet)] ${proseClass}`}
          style={{
            ...policyBodyStyle,
          }}
        >
          {doc.lead}
        </p>
      </header>

      <nav
        aria-label={language === "en" ? "Policy pages" : "方針・条件ページ"}
        className="mt-10 pt-6 border-t border-[rgba(var(--foreground-rgb),0.08)] flex flex-wrap gap-x-6 gap-y-2 page-entrance page-entrance-delay-1"
      >
        {POLICY_KINDS.filter(
          (item) => item !== "legal" || includeService,
        ).map((item) => (
          <Link
            key={item}
            to={policyPath(item, language)}
            aria-current={item === kind ? "page" : undefined}
            className="tap-target font-en text-xs tracking-[0.05em] nav-link-luxury py-1.5"
            style={
              item === kind
                ? { color: "rgba(var(--foreground-rgb),0.78)" }
                : { color: "var(--text-quiet)" }
            }
          >
            {labels[language][item]}
          </Link>
        ))}
      </nav>

      <div className="mt-14 md:mt-18 space-y-14 md:space-y-16">
        {sections.map((section, index) => (
          <section
            key={section.heading}
            className={`page-entrance page-entrance-delay-${Math.min(index + 1, 2)} ${
              section.warning
                ? "border border-[rgba(176,119,55,0.30)] bg-[rgba(176,119,55,0.055)] rounded-lg p-5 md:p-7"
                : ""
            }`}
          >
            <h2
              className={`${languageFont} font-medium break-words`}
              style={{
                fontSize: "1rem",
                lineHeight: 1.6,
                letterSpacing: "0.035em",
              }}
            >
              {section.heading}
            </h2>

            {section.paragraphs?.map((paragraph) => (
              <p
                key={paragraph}
                className={`mt-4 text-[color:var(--text-quiet)] break-words ${proseClass}`}
                style={policyBodyStyle}
              >
                {paragraph}
              </p>
            ))}

            {section.bullets && section.bullets.length > 0 && (
              <ul className="mt-5 space-y-3">
                {section.bullets.map((item) => (
                  <li
                    key={item}
                    className={`flex gap-3 text-[color:var(--text-quiet)] break-words ${proseClass}`}
                    style={policyBodyStyle}
                  >
                    <span aria-hidden="true" className="select-none opacity-50">
                      —
                    </span>
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {section.rows && section.rows.length > 0 && (
              <dl className="mt-5 border-t border-[rgba(var(--foreground-rgb),0.08)]">
                {section.rows.map((row) => (
                  <div
                    key={row.label}
                    className="py-5 border-b border-[rgba(var(--foreground-rgb),0.08)] grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6"
                  >
                    <dt className={`${languageFont} text-sm font-medium break-words`}>
                      {row.label}
                      {row.pending && (
                        <span className="ml-2 align-middle font-en text-[0.62rem] font-normal tracking-[0.06em] uppercase text-[rgba(176,119,55,0.92)]">
                          {language === "en" ? "Pending" : "要確認"}
                        </span>
                      )}
                    </dt>
                    <dd
                      className={`text-[color:var(--text-quiet)] break-words ${proseClass}`}
                      style={policyBodyStyle}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {section.links && section.links.length > 0 && (
              <ul className="mt-5 flex flex-col items-start gap-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className="tap-target inline-block font-en text-xs tracking-[0.03em] underline underline-offset-4 decoration-[rgba(var(--foreground-rgb),0.22)] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.76)] py-1"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-16 md:mt-20 pt-8 border-t border-[rgba(var(--foreground-rgb),0.08)] page-entrance">
        <Link
          to={contactPath}
          className="tap-target inline-flex items-center font-en text-sm tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.76)] hover:text-[var(--foreground)] nav-link-luxury py-2"
        >
          {doc.contactLabel}
          <span aria-hidden="true" className="ml-2">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
