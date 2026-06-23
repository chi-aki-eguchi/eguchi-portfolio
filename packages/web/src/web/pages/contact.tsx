import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { safeHref } from "../lib/utils";

type Status = "idle" | "sending" | "success" | "error";

export default function ContactPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.settings.$get()).json(),
  });
  // H1: published pricing plans (撮影依頼の料金). Empty-safe — section hides when none.
  const { data: pricingData } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => (await api.pricing.$get()).json(),
  });
  const plans = pricingData?.plans ?? [];

  const formspreeUrl = data?.formspreeUrl ?? "";
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
              color: `rgba(var(--foreground-rgb), var(--section-label-opacity, 0.35))`,
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
                      className="mt-4 text-[rgba(var(--foreground-rgb),0.55)]"
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
                          className="flex gap-2 text-[rgba(var(--foreground-rgb),0.55)]"
                          style={{
                            fontSize: "var(--body-size, 0.85rem)",
                            lineHeight: "1.6",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="text-[rgba(var(--foreground-rgb),0.30)] select-none"
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
                      className="mt-5 pt-4 border-t border-[rgba(var(--foreground-rgb),0.06)] text-[rgba(var(--foreground-rgb),0.40)]"
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
            className="text-center mt-10 md:mt-12 text-[rgba(var(--foreground-rgb),0.40)] page-entrance page-entrance-delay-2"
            style={{ fontSize: "var(--body-size, 0.85rem)" }}
          >
            ご依頼・ご相談は下記フォームよりお気軽にどうぞ。
          </p>
        </section>
      )}

      <section
        className="max-w-md mx-auto px-6 pt-[calc(3rem*var(--spacing-page-top,1))] md:pt-[calc(5rem*var(--spacing-page-top,1))] pb-12 md:pb-20 min-h-[calc(100vh-180px)]"
        ref={entranceRef}
      >
        <h1
          className="font-en uppercase text-center mb-12 page-entrance"
          style={{
            fontSize: "var(--section-label-size, 0.75rem)",
            color: `rgba(var(--foreground-rgb), var(--section-label-opacity, 0.35))`,
            letterSpacing: "var(--section-label-tracking, 0.10em)",
            lineHeight: "var(--section-leading, 1.2)",
          }}
        >
          {data?.contactLabel ?? "Contact"}
        </h1>

        {!formspreeUrl ? (
          <div className="py-4 space-y-6 page-entrance page-entrance-delay-1">
            {data?.contactIntro && (
              <p
                className="text-[rgba(var(--foreground-rgb),0.55)]"
                style={{
                  fontSize: "var(--body-size, 0.875rem)",
                  lineHeight: "var(--body-leading, 2)",
                  letterSpacing: "var(--body-tracking, 0.01em)",
                }}
              >
                {data.contactIntro}
              </p>
            )}
            {data?.contactEmail && (
              <a
                href={`mailto:${data.contactEmail}`}
                className="inline-block font-en text-sm tracking-[0.03em] text-[rgba(var(--foreground-rgb),0.45)] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300 py-1"
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
                    className="font-en text-xs tracking-[0.06em] text-[rgba(var(--foreground-rgb),0.30)] hover:text-[rgba(var(--foreground-rgb),0.55)] nav-link-luxury transition-colors duration-300 py-1.5"
                  >
                    {data?.snsLabelInstagram ?? "Instagram"}
                  </a>
                )}
                {data?.profileTwitter && (
                  <a
                    href={safeHref(data.profileTwitter)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-en text-xs tracking-[0.06em] text-[rgba(var(--foreground-rgb),0.30)] hover:text-[rgba(var(--foreground-rgb),0.55)] nav-link-luxury transition-colors duration-300 py-1.5"
                  >
                    {data?.snsLabelTwitter ?? "X"}
                  </a>
                )}
              </div>
            )}
            {/* Nothing configured yet — avoid a blank page (but not while still loading) */}
            {!isLoading &&
              !data?.contactIntro &&
              !data?.contactEmail &&
              !data?.profileInstagram &&
              !data?.profileTwitter && (
                <p
                  className="text-[rgba(var(--foreground-rgb),0.35)] italic"
                  style={{
                    fontSize: "var(--body-size, 0.875rem)",
                    lineHeight: "var(--body-leading, 2)",
                  }}
                >
                  準備中です。
                </p>
              )}
          </div>
        ) : status === "success" ? (
          <div className="text-center py-12 page-entrance page-entrance-delay-1">
            <p
              aria-live="polite"
              className="text-sm text-[rgba(var(--foreground-rgb),0.50)]"
            >
              {data?.contactSentMessage ?? "Message sent."}
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-6 font-en text-xs tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.30)] hover:text-[rgba(var(--foreground-rgb),0.55)] transition-colors duration-300"
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
                aria-label={data?.contactFormName ?? "Name"}
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
                aria-label={data?.contactFormEmail ?? "Email"}
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
                aria-label={data?.contactFormMessage ?? "Message"}
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
  } text-[var(--foreground)] px-3 py-2.5 text-sm rounded-md outline-none focus:border-[var(--accent-color,rgba(var(--foreground-rgb),0.25))] transition-colors duration-300 placeholder:text-[rgba(var(--foreground-rgb),0.20)]`;
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
        className="font-en text-xs tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.40)]"
      >
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
