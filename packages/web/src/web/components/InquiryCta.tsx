import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";

/**
 * Closing "work with me" band shown at the foot of the Top / Gallery / Series
 * pages — the conversion moment for an engaged viewer. Quiet and editorial by
 * design (large serif line, generous whitespace), so it invites rather than
 * shouts. Hidden entirely unless enabled in Settings.
 */
export function InquiryCta() {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const ref = useScrollFadeIn([data?.homeCtaEnabled]);

  if ((data?.homeCtaEnabled ?? "off") !== "on") return null;

  const title = data?.homeCtaTitle || "撮影のご依頼";
  const text = data?.homeCtaText || "";
  const button = data?.homeCtaButton || "お問い合わせ";

  return (
    <section className="max-w-3xl mx-auto px-6 pt-[calc(5rem*var(--spacing-section-gap,1))] pb-[calc(6rem*var(--spacing-section-gap,1))] md:pt-[calc(7rem*var(--spacing-section-gap,1))] md:pb-[calc(9rem*var(--spacing-section-gap,1))] text-center" ref={ref}>
      <div
        aria-hidden="true"
        className="mx-auto mb-10 md:mb-14 section-reveal"
        style={{ width: 1, height: 48, background: `rgba(var(--foreground-rgb), 0.18)` }}
      />
      <h2
        className="font-ja section-reveal"
        style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.4rem)", letterSpacing: "0.08em", lineHeight: 1.45, color: `rgba(var(--foreground-rgb), 0.82)` }}
      >
        {title}
      </h2>
      {text && (
        <p
          className="section-reveal mt-5 md:mt-6 mx-auto max-w-md"
          style={{ fontSize: "var(--body-size, 0.875rem)", lineHeight: "var(--body-leading, 1.9)", letterSpacing: "0.02em", color: `rgba(var(--foreground-rgb), 0.5)`, transitionDelay: "0.05s" }}
        >
          {text}
        </p>
      )}
      <div className="section-reveal mt-9 md:mt-11" style={{ transitionDelay: "0.1s" }}>
        <Link
          to="/contact"
          className="font-en inline-block uppercase nav-link-luxury transition-colors duration-300"
          style={{ fontSize: "0.8125rem", letterSpacing: "0.14em", paddingBottom: 6, color: `rgba(var(--foreground-rgb), 0.6)`, borderBottom: `1px solid rgba(var(--foreground-rgb), 0.25)` }}
          onMouseEnter={(e) => { e.currentTarget.style.color = `var(--accent-color, rgba(var(--foreground-rgb), 0.9))`; e.currentTarget.style.borderColor = `var(--accent-color, rgba(var(--foreground-rgb), 0.6))`; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = `rgba(var(--foreground-rgb), 0.6)`; e.currentTarget.style.borderColor = `rgba(var(--foreground-rgb), 0.25)`; }}
        >
          {button}
        </Link>
      </div>
    </section>
  );
}
