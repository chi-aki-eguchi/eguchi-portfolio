import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { safeHref } from "../lib/utils";

type Status = "idle" | "sending" | "success" | "error";

export default function ContactPage({
  language = "ja",
}: {
  language?: "ja" | "en";
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  // H1: published pricing plans (撮影依頼の料金). Empty-safe — section hides when none.
  const { data: pricingData } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => jsonOrThrow(await api.pricing.$get()),
  });
  const plans = pricingData?.plans ?? [];

  const formspreeUrl = data?.formspreeUrl ?? "";
  // i18n Phase 3: EN page falls back to the JP copy per field when no EN text is
  // set yet, so /en/contact never goes blank while the owner is still translating.
  const intro =
    language === "en"
      ? data?.contactIntroEn || data?.contactIntro
      : data?.contactIntro;
  const note =
    language === "en"
      ? data?.contactNoteEn || data?.contactNote
      : data?.contactNote;
  const flow =
    language === "en"
      ? data?.contactFlowEn || data?.contactFlow
      : data?.contactFlow;
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  // Re-run entrance observer when settings load or the form state switches, so
  // newly-rendered sections (form / success view) fade in rather than stay hidden.
  const entranceRef = usePageEntrance([data, status]);
  const pricingRef = usePageEntrance([pricingData]);

  const validate = (fd: FormData) => {
    const e: Record<string, string> = {};
    if (!fd.get("name")) e.name = "Required";
    const email = String(fd.get("email") ?? "");
    if (!email) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid";
    if (!fd.get("message")) e.message = "Required";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formspreeUrl) return;

    const fd = new FormData(e.currentTarget);
    // Honeypot: humans never fill the hidden `_gotcha` field; bots that auto-fill
    // everything do. Pretend success without sending, so the bot gets no signal
    // and a real inquiry channel doesn't get buried in spam. (Formspree also drops
    // _gotcha-filled submissions server-side; this is belt-and-suspenders.)
    if ((fd.get("_gotcha") as string)?.trim()) {
      setStatus("success");
      return;
    }
    const errs = validate(fd);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Move focus to the first invalid field
      const firstKey = Object.keys(errs)[0];
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstKey}"]`)
        ?.focus();
      return;
    }
    setErrors({});
    setStatus("sending");

    try {
      const res = await fetch(formspreeUrl, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      setStatus(res.ok ? "success" : "error");
      if (res.ok) formRef.current?.reset();
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      {/* H1: Pricing — quiet cards, only when published plans exist */}
      {plans.length > 0 && (
        <section
          className="max-w-3xl mx-auto px-6 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(6rem*var(--spacing-page-top,1))] pb-4"
          ref={pricingRef}
        >
          <h2
            className="font-en uppercase text-center mb-12 md:mb-16 page-entrance"
            style={{
              fontSize: "var(--section-label-size, 0.75rem)",
              color: "var(--text-quiet)",
              letterSpacing: "var(--section-label-tracking, 0.10em)",
              lineHeight: "var(--section-leading, 1.2)",
            }}
          >
            Pricing
          </h2>
          <div
            className={`grid grid-cols-1 gap-6 md:gap-8 ${plans.length === 1 ? "max-w-sm mx-auto" : "sm:grid-cols-2"}`}
          >
            {plans.map((p, i) => {
              const features = (p.features ?? "")
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
              return (
                <div
                  key={p.id}
                  className={`page-entrance page-entrance-delay-${Math.min(i + 1, 2)} border border-[rgba(var(--foreground-rgb),0.08)] rounded-lg p-6 md:p-8 flex flex-col`}
                >
                  <h3
                    className="font-ja font-medium break-words"
                    style={{
                      fontSize: "1.0625rem",
                      color: `rgba(var(--foreground-rgb),0.82)`,
                      letterSpacing: "0.02em",
                      lineHeight: 1.5,
                    }}
                  >
                    {p.title}
                  </h3>
                  {p.price && (
                    <p
                      className="mt-2 font-en tracking-[0.02em] text-[rgba(var(--foreground-rgb),0.62)]"
                      style={{ fontSize: "var(--body-size, 0.95rem)" }}
                    >
                      {p.price}
                    </p>
                  )}
                  {p.description && (
                    <p
                      className="mt-4 text-[color:var(--text-quiet)]"
                      style={{
                        fontSize: "var(--body-size, 0.875rem)",
                        lineHeight: "var(--body-leading, 1.9)",
                        letterSpacing: "var(--body-tracking, 0.01em)",
                      }}
                    >
                      {p.description}
                    </p>
                  )}
                  {features.length > 0 && (
                    <ul className="mt-5 space-y-2">
                      {features.map((f, j) => (
                        <li
                          key={j}
                          className="flex gap-2 text-[color:var(--text-quiet)]"
                          style={{
                            fontSize: "var(--body-size, 0.85rem)",
                            lineHeight: "1.6",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="text-[color:var(--text-quiet)] select-none"
                          >
                            —
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.note && (
                    <p
                      className="mt-5 pt-4 border-t border-[rgba(var(--foreground-rgb),0.06)] text-[color:var(--text-quiet)]"
                      style={{ fontSize: "0.78rem", lineHeight: "1.7" }}
                    >
                      {p.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p
            className="text-center mt-10 md:mt-12 text-[color:var(--text-quiet)] page-entrance page-entrance-delay-2"
            style={{ fontSize: "var(--body-size, 0.85rem)" }}
          >
            {language === "en"
              ? "For inquiries or requests, please use the form below."
              : "ご依頼・ご相談は下記フォームよりお気軽にどうぞ。"}
          </p>
        </section>
      )}

      <section
        className="max-w-md mx-auto px-6 pt-[calc(3rem*var(--spacing-page-top,1))] md:pt-[calc(5rem*var(--spacing-page-top,1))] pb-12 md:pb-20 min-h-[calc(100dvh-180px)]"
        ref={entranceRef}
      >
        <h1
          className="font-en uppercase text-center mb-12 page-entrance"
          style={{
            fontSize: "var(--section-label-size, 0.75rem)",
            color: "var(--text-quiet)",
            letterSpacing: "var(--section-label-tracking, 0.10em)",
            lineHeight: "var(--section-leading, 1.2)",
          }}
        >
          {data?.contactLabel ?? "Contact"}
        </h1>

        {/* i18n Phase 3: "English inquiries welcome" note — always visible near the
            heading regardless of the JP/EN toggle, so an English-only visitor on the
            default JP page still sees they can reach out. Hidden when set to "". */}
        {status !== "success" && data?.contactEnglishNote && (
          <p
            className="text-center font-en text-xs tracking-[0.02em] text-[color:var(--text-quiet)] -mt-6 mb-8 page-entrance page-entrance-delay-1"
          >
            {data.contactEnglishNote}
          </p>
        )}

        {/* contactIntro is the owner's own lead-in; it used to render only in the
            no-form branch, leaving the configured text invisible once Formspree
            was set up. Show it above the form too (success view keeps it hidden
            so the thank-you moment stays quiet). */}
        {formspreeUrl && status !== "success" && intro && (
          <p
            className="text-center text-[color:var(--text-quiet)] -mt-4 mb-5 page-entrance page-entrance-delay-1"
            style={{
              fontSize: "var(--body-size, 0.875rem)",
              lineHeight: "var(--body-leading, 2)",
              letterSpacing: "var(--body-tracking, 0.01em)",
            }}
          >
            {intro}
          </p>
        )}
        {/* 2026-07-08 動線改善: 「頼んでいいんだ」と思える橋 — 相談歓迎の一言と
            依頼の流れ。どちらも設定で空にすれば消える。 */}
        {formspreeUrl && status !== "success" && note && (
          <p
            className="text-center text-[color:var(--text-quiet)] mb-8 page-entrance page-entrance-delay-1"
            style={{ fontSize: "0.8rem", lineHeight: 1.9 }}
          >
            {note}
          </p>
        )}
        {formspreeUrl && status !== "success" && flow && (
          <div className="mb-10 px-5 py-4 border border-[rgba(var(--foreground-rgb),0.08)] rounded-lg page-entrance page-entrance-delay-1">
            <p className="font-en uppercase text-[length:var(--text-note)] tracking-[0.14em] text-[color:var(--text-quiet)] mb-2">
              Flow
            </p>
            <p
              className="text-[color:var(--text-quiet)]"
              style={{ fontSize: "0.8rem", lineHeight: 1.9 }}
            >
              {flow}
            </p>
          </div>
        )}
        {!formspreeUrl ? (
          <div className="py-4 space-y-6 page-entrance page-entrance-delay-1">
            {intro && (
              <p
                className="text-[color:var(--text-quiet)]"
                style={{
                  fontSize: "var(--body-size, 0.875rem)",
                  lineHeight: "var(--body-leading, 2)",
                  letterSpacing: "var(--body-tracking, 0.01em)",
                }}
              >
                {intro}
              </p>
            )}
            {data?.contactEmail && (
              <a
                href={`mailto:${data.contactEmail}`}
                className="inline-block font-en text-sm tracking-[0.03em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300 py-1"
              >
                {data.contactEmail}
              </a>
            )}
            {(data?.profileInstagram || data?.profileTwitter) && (
              <div className="flex gap-6 pt-4 border-t border-[rgba(var(--foreground-rgb),0.06)]">
                {data?.profileInstagram && (
                  <a
                    href={safeHref(data.profileInstagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-en text-xs tracking-[0.06em] text-[color:var(--text-quiet)] hover:text-[color:var(--text-quiet)] nav-link-luxury transition-colors duration-300 py-1.5"
                  >
                    {data?.snsLabelInstagram ?? "Instagram"}
                  </a>
                )}
                {data?.profileTwitter && (
                  <a
                    href={safeHref(data.profileTwitter)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-en text-xs tracking-[0.06em] text-[color:var(--text-quiet)] hover:text-[color:var(--text-quiet)] nav-link-luxury transition-colors duration-300 py-1.5"
                  >
                    {data?.snsLabelTwitter ?? "X"}
                  </a>
                )}
              </div>
            )}
            {/* Nothing configured yet — avoid a blank page (but not while still loading) */}
            {!isLoading &&
              !intro &&
              !data?.contactEmail &&
              !data?.profileInstagram &&
              !data?.profileTwitter && (
                <p
                  className="text-[color:var(--text-quiet)] italic"
                  style={{
                    fontSize: "var(--body-size, 0.875rem)",
                    lineHeight: "var(--body-leading, 2)",
                  }}
                >
                  {language === "en" ? "Coming soon." : "準備中です。"}
                </p>
              )}
          </div>
        ) : status === "success" ? (
          <div className="text-center py-12 page-entrance page-entrance-delay-1">
            <p
              aria-live="polite"
              className="text-sm text-[color:var(--text-quiet)]"
            >
              {data?.contactSentMessage ?? "Message sent."}
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-6 font-en text-xs tracking-[0.04em] text-[color:var(--text-quiet)] hover:text-[color:var(--text-quiet)] transition-colors duration-300"
            >
              {data?.contactSendAnother ?? "Send another"}
            </button>
          </div>
        ) : (
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 page-entrance page-entrance-delay-1"
            noValidate
          >
            {/* Honeypot — off-screen, not announced, skipped by Tab/autofill. Real
              users leave it empty; bots that fill every field get silently dropped. */}
            <input
              type="text"
              name="_gotcha"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] w-px h-px opacity-0 pointer-events-none"
            />
            <Field
              label={data?.contactFormName ?? "Name"}
              htmlFor="contact-name"
              error={errors.name}
            >
              <input
                id="contact-name"
                type="text"
                name="name"
                autoComplete="name"
                aria-required="true"
                aria-invalid={!!errors.name || undefined}
                aria-describedby={
                  errors.name ? "contact-name-error" : undefined
                }
                onChange={() => setErrors((e) => ({ ...e, name: "" }))}
                className={inputCls(!!errors.name)}
              />
            </Field>

            <Field
              label={data?.contactFormEmail ?? "Email"}
              htmlFor="contact-email"
              error={errors.email}
            >
              <input
                id="contact-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                aria-required="true"
                aria-invalid={!!errors.email || undefined}
                aria-describedby={
                  errors.email ? "contact-email-error" : undefined
                }
                onChange={() => setErrors((e) => ({ ...e, email: "" }))}
                className={inputCls(!!errors.email)}
              />
            </Field>

            <Field
              label={data?.contactFormSubject ?? "Subject"}
              htmlFor="contact-subject"
            >
              <select
                id="contact-subject"
                name="subject"
                className={`${inputCls(false)} cursor-pointer appearance-none pr-9`}
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%23999' stroke-width='1.4'%3E%3Cpath d='M3 4.5l3 3 3-3'/%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "12px",
                }}
              >
                <option value="">—</option>
                {(
                  data?.contactSubjectOptions ??
                  "Shooting,Press / Media,Collaboration,Other"
                )
                  .split(",")
                  .map((opt) => opt.trim())
                  .filter(Boolean)
                  .map((opt) => (
                    // Use the human-readable label as the value so notifications are
                    // legible and non-ASCII (e.g. Japanese) options don't collide.
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
              </select>
            </Field>

            <Field
              label={data?.contactFormMessage ?? "Message"}
              htmlFor="contact-message"
              error={errors.message}
            >
              <textarea
                id="contact-message"
                name="message"
                rows={5}
                placeholder={data?.contactMessagePlaceholder || undefined}
                aria-required="true"
                aria-invalid={!!errors.message || undefined}
                aria-describedby={
                  errors.message ? "contact-message-error" : undefined
                }
                onChange={() => setErrors((e) => ({ ...e, message: "" }))}
                className={`${inputCls(!!errors.message)} resize-y`}
              />
            </Field>

            {status === "error" && (
              <p role="alert" className="text-xs text-red-600">
                {data?.contactErrorMessage ??
                  "Failed to send. Please try again."}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              aria-busy={status === "sending" || undefined}
              className="self-start font-en text-sm tracking-[0.03em] bg-[var(--foreground)] text-[var(--background)] px-6 py-2 rounded-md hover:opacity-85 transition-opacity duration-300 disabled:opacity-30 mt-1"
            >
              {status === "sending"
                ? (data?.contactSendingButton ?? "Sending...")
                : (data?.contactSendButton ?? "Send")}
            </button>
          </form>
        )}
      </section>
    </>
  );
}

function inputCls(hasError: boolean) {
  return `w-full bg-[var(--background)] border ${
    hasError ? "border-red-400/50" : "border-[rgba(var(--foreground-rgb),0.10)]"
  } text-[var(--foreground)] px-3 py-2.5 text-sm rounded-md outline-none focus:border-[var(--accent-color,rgba(var(--foreground-rgb),0.25))] transition-colors duration-300 placeholder:text-[color:var(--text-quiet)]`;
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="font-en text-xs tracking-[0.04em] text-[color:var(--text-quiet)]"
      >
        {label}
      </label>
      {children}
      {error && (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="text-xs text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
