import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "../components/PageTitle";
import { api, jsonOrThrow } from "../lib/api";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { usePageLanguage } from "../hooks/usePageLanguage";
import { safeHref } from "../lib/utils";
import {
  usableContactEmail,
  usableContactEndpoint,
} from "../../shared/contact-settings";
import { buildFailoverMailto } from "../../shared/contact-failover";
import { sendAnalyticsEvent } from "../lib/analytics";

type Status = "idle" | "sending" | "success" | "error";
type ContactAnalyticsEvent =
  | "contact_submit_start"
  | "contact_submit_success";

const CJK_TEXT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

function trackContactEvent(
  name: ContactAnalyticsEvent,
  language: "ja" | "en",
) {
  try {
    sendAnalyticsEvent(name, { language });
  } catch {
    // A blocked or broken analytics script must never block an inquiry.
  }
}

function englishOnly(value: string | null | undefined): string {
  return (value ?? "")
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !CJK_TEXT.test(line))
        .join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");
}

function englishInline(
  value: string | null | undefined,
  fallback: string,
): string {
  return englishOnly(value).replace(/\s*\n+\s*/g, " ").trim() || fallback;
}

const KNOWN_ENGLISH_AREAS = [
  { names: ["東京"], english: "Tokyo" },
  { names: ["福岡"], english: "Fukuoka" },
  { names: ["台北", "臺北"], english: "Taipei" },
] as const;

function englishAreasFrom(value: string | null | undefined): string {
  const authoredEnglish = englishOnly(value);
  if (authoredEnglish) return authoredEnglish;

  const source = value ?? "";
  return KNOWN_ENGLISH_AREAS.map(({ names, english }) => ({
    english,
    index: Math.min(
      ...names
        .map((name) => source.indexOf(name))
        .filter((index) => index >= 0),
    ),
  }))
    .filter(({ index }) => Number.isFinite(index))
    .sort((a, b) => a.index - b.index)
    .map(({ english }) => english)
    .join(" / ");
}

const EN_SUBJECT_TRANSLATIONS: Record<string, string> = {
  "撮影": "Shooting",
  "撮影依頼": "Shooting",
  "取材": "Press / Media",
  "コラボレーション": "Collaboration",
  "テンプレートについて": "Portfolio Kit",
  "その他": "Other",
};

function subjectOptionsFor(
  value: string | null | undefined,
  language: "ja" | "en",
): string[] {
  const raw = (
    value ?? "Shooting,Press / Media,Collaboration,Other"
  )
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
  if (language === "ja") return raw;

  const english = raw
    .map((option) => EN_SUBJECT_TRANSLATIONS[option] ?? option)
    .filter((option) => !CJK_TEXT.test(option));
  const options =
    english.length > 0
      ? english
      : ["Shooting", "Press / Media", "Collaboration", "Other"];
  return [...new Set(options)];
}

const readableBodyStyle = {
  fontSize: "max(0.875rem, var(--body-size, 0.875rem))",
  lineHeight: "max(1.75, var(--body-leading, 2))",
  letterSpacing: "var(--body-tracking, 0.01em)",
} as const;

export default function ContactPage({
  language = "ja",
}: {
  language?: "ja" | "en";
}) {
  usePageLanguage(language);
  const english = language === "en";
  const {
    data,
    isLoading,
    isError: settingsFailed,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  // H1: published pricing plans (撮影依頼の料金). Empty-safe — section hides when none.
  const { data: pricingData } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => jsonOrThrow(await api.pricing.$get()),
  });
  const plans = pricingData?.plans ?? [];
  // Pricing does not have separate EN fields yet. Do not put a Japanese plan
  // card into the English route; an English-authored plan still renders.
  const visiblePlans = english
    ? plans.filter((plan) =>
        [plan.title, plan.description, plan.features, plan.note].every(
          (text) => !CJK_TEXT.test(text ?? ""),
        ),
      )
    : plans;

  // 旧DBに残った不正な設定値をそのままフォームの送信先やmailtoへ渡さない。
  // 有効値だけを使うので、管理画面を通らない古いデータでも壊れた連絡先を公開しない。
  const formspreeUrl = usableContactEndpoint(data?.formspreeUrl);
  const contactEmail = usableContactEmail(data?.contactEmail);
  // An untranslated field used to fall straight back to Japanese. That kept
  // the page non-empty, but produced a mixed-language enquiry form. Use neutral
  // English guidance instead. Location names are translated only when their
  // Japanese source is actually configured below.
  const intro = english
    ? data
      ? englishOnly(data.contactIntroEn) ||
        "For assignments, interviews, or collaborations, feel free to get in touch."
      : ""
    : data?.contactIntro;
  const note = english
    ? data
      ? englishOnly(data.contactNoteEn) ||
        "You are welcome to write even if the details are still taking shape."
      : ""
    : data?.contactNote;
  const flow = english
    ? englishOnly(data?.contactFlowEn)
    : data?.contactFlow;
  // 撮影を受ける地域。頼む側がいちばん先に知りたいことで、かつ検索で
  // 実際に打たれる言葉（地名）でもある。空なら節ごと出さない。
  const areas = english
    ? englishOnly(data?.contactAreasEn) || englishAreasFrom(data?.contactAreas)
    : data?.contactAreas;
  const englishWelcome = english
    ? englishOnly(data?.contactEnglishNote)
    : data?.contactEnglishNote;
  const pageLabel = english
    ? englishInline(data?.contactLabel, "Contact")
    : data?.contactLabel ?? "Contact";
  const formName = english
    ? englishInline(data?.contactFormName, "Name")
    : data?.contactFormName ?? "Name";
  const formEmail = english
    ? englishInline(data?.contactFormEmail, "Email")
    : data?.contactFormEmail ?? "Email";
  const formSubject = english
    ? englishInline(data?.contactFormSubject, "Subject")
    : data?.contactFormSubject ?? "Subject";
  const formMessage = english
    ? englishInline(data?.contactFormMessage, "Message")
    : data?.contactFormMessage ?? "Message";
  const messagePlaceholder = english
    ? englishInline(
        data?.contactMessagePlaceholder,
        "Tell me about the project, preferred date and location, and any visual references.",
      )
    : data?.contactMessagePlaceholder || undefined;
  const subjectOptions = subjectOptionsFor(
    data?.contactSubjectOptions,
    language,
  );
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // 失敗したときだけ組み立てる mailto。書いた本文をそのまま持っていける形に
  // する（もう一度打ち直させない）。フォームは非制御なので、送信時の
  // FormData から作って持っておく。
  const [failoverMailto, setFailoverMailto] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  // React state is applied after the current event finishes. A second submit
  // in that same event could therefore pass the disabled-button check before
  // the first `setStatus("sending")` was rendered. This ref is the synchronous
  // lock for the actual network request; it is released in `finally` so a
  // failed request can still be retried.
  const submittingRef = useRef(false);
  const successMessageRef = useRef<HTMLParagraphElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const focusNameOnIdleRef = useRef(false);

  // Move screen-reader and keyboard focus to the newly-rendered success notice,
  // without adding it to the normal Tab order or changing the user's scroll
  // position. The live region remains the announcement mechanism.
  useEffect(() => {
    if (status !== "success") return;
    successMessageRef.current?.focus({ preventScroll: true });
  }, [status]);

  // "Send another" replaces the success view with a fresh form. Focus the
  // first field only for that explicit action; initial page load stays passive.
  useEffect(() => {
    if (status !== "idle" || !focusNameOnIdleRef.current) return;
    focusNameOnIdleRef.current = false;
    nameInputRef.current?.focus({ preventScroll: true });
  }, [status]);

  // Contact の構成。既定（center）は 448px の細い1列で、説明文も中央揃え。
  // 中央揃えの日本語は2行以上になると行末が揃わず、読みづらい。左寄せと
  // 2列も選べるようにして、写真家ごとに「依頼の受け方」の印象を変えられる
  // ようにする。
  //   center — 中央・細い1列（既定。従来どおり）
  //   left   — 左寄せ1列・やや広い
  //   split  — 説明を左、フォームを右（PCのみ2列。スマホは縦に積む）
  const contactLayout = ["center", "left", "split"].includes(
    data?.contactLayout ?? "",
  )
    ? data!.contactLayout!
    : "center";
  // 説明が何も無いのに2列にすると、左が空いた歪な画面になる。
  const hasLead = !!(englishWelcome || intro || note || flow || areas);
  const layout =
    contactLayout === "split" && !hasLead ? "left" : contactLayout;
  const leadAlign = layout === "center" ? "text-center" : "text-left";
  // Re-run entrance observer when settings load or the form state switches, so
  // newly-rendered sections (form / success view) fade in rather than stay hidden.
  const entranceRef = usePageEntrance([data, status]);
  const pricingRef = usePageEntrance([pricingData]);

  // 入力エラーの文言。ここだけ英語直書きで、日本語のサイトでも "Required" と
  // 出ていた（他の文言はすべて settings か言語ルートで切り替わる）。
  // 何が足りないかを名指しするほうが、直す手が早い。
  const messages =
    language === "en"
      ? {
          name: "Please enter your name.",
          email: "Please enter your email address.",
          emailFormat: "Please check the format of your email address.",
          message: "Please enter your message.",
        }
      : {
          name: "お名前を入力してください。",
          email: "メールアドレスを入力してください。",
          emailFormat: "メールアドレスの形式をご確認ください。",
          message: "本文を入力してください。",
        };
  // 設定が空のときの控えの文。ラベル（Name / Email）は英語のままでよい
  // ——サイト全体が英語の見出しで揃えてある——が、訪問者へ向けた「文」は
  // ページの言語に合わせる。
  const fallbackSent =
    language === "en" ? "Message sent." : "送信しました。";
  const fallbackSendError =
    language === "en"
      ? "Failed to send. Please try again."
      : "送信できませんでした。もう一度お試しください。";
  const fallbackSubjectNone = language === "en" ? "Not specified" : "指定なし";
  // 送信が失敗したときだけ出す逃げ道。フォームがある間、メールアドレスは
  // このページのどこにも出ていない（表示するのは「フォーム未設定のとき」の枝
  // だけ）ので、繰り返しても直らない失敗——送信先サービスの停止や上限超過——に
  // 当たった人は、連絡する手段を失ったまま去ることになる。
  const fallbackMailtoLead =
    language === "en"
      ? "Still not going through? Email works too:"
      : "うまく送れないときは、メールでも受け付けています。";
  const sentMessage = english
    ? englishInline(
      data?.contactSentMessage,
        "Thank you. Your message has been sent.",
      )
    : data?.contactSentMessage ?? fallbackSent;
  const sendAnother = english
    ? englishInline(data?.contactSendAnother, "Send another")
    : data?.contactSendAnother ?? "Send another";
  const sendError = english
    ? englishInline(data?.contactErrorMessage, fallbackSendError)
    : data?.contactErrorMessage ?? fallbackSendError;
  const sendButton = english
    ? englishInline(data?.contactSendButton, "Send")
    : data?.contactSendButton ?? "Send";
  const sendingButton = english
    ? englishInline(data?.contactSendingButton, "Sending...")
    : data?.contactSendingButton ?? "Sending...";

  const validate = (fd: FormData) => {
    const e: Record<string, string> = {};
    if (!fd.get("name")) e.name = messages.name;
    const email = String(fd.get("email") ?? "");
    if (!email) e.email = messages.email;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = messages.emailFormat;
    if (!fd.get("message")) e.message = messages.message;
    return e;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current) return;
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
    submittingRef.current = true;
    setStatus("sending");
    trackContactEvent("contact_submit_start", language);

    const failed = () => {
      setFailoverMailto(buildFailoverMailto(contactEmail, fd));
      setStatus("error");
    };

    try {
      const res = await fetch(formspreeUrl, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      if (res.ok) {
        setFailoverMailto("");
        setStatus("success");
        formRef.current?.reset();
        trackContactEvent("contact_submit_success", language);
      } else {
        failed();
      }
    } catch {
      failed();
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <>
      {/* H1: Pricing — quiet cards, only when published plans exist */}
      {visiblePlans.length > 0 && (
        <section
          lang={language}
          className="max-w-3xl mx-auto site-page site-page-top pb-4"
          ref={pricingRef}
        >
          <h2
            className="font-en uppercase text-center mb-12 md:mb-16 page-entrance"
            style={{
              fontSize: "var(--section-label-size-eff, 0.75rem)",
              color: "var(--section-label-color)",
              letterSpacing: "var(--section-label-tracking, 0.10em)",
              lineHeight: "var(--section-leading, 1.2)",
            }}
          >
            Pricing
          </h2>
          <div
            className={`grid grid-cols-1 gap-6 md:gap-8 ${visiblePlans.length === 1 ? "max-w-sm mx-auto" : "sm:grid-cols-2"}`}
          >
            {visiblePlans.map((p, i) => {
              const features = (p.features ?? "")
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
              return (
                <div
                  key={p.id}
                  className={`page-entrance page-entrance-delay-${Math.min(i + 1, 2)} border border-[rgba(var(--foreground-rgb),0.08)] rounded-lg p-6 md:p-8 flex flex-col min-w-0`}
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
                      className="mt-2 font-en tracking-[0.02em] break-words text-[rgba(var(--foreground-rgb),0.62)]"
                      style={{ fontSize: "var(--body-size, 0.95rem)" }}
                    >
                      {p.price}
                    </p>
                  )}
                  {p.description && (
                    <p
                      className="mt-4 break-words text-[color:var(--text-quiet)]"
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
                          className="flex gap-2 min-w-0 text-[color:var(--text-quiet)]"
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
                          {/* flex の子は内容より狭くならない。長い機能名で
                              料金カードごと横に伸びるのを防ぐ */}
                          <span className="min-w-0 break-words">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.note && (
                    <p
                      className="mt-5 pt-4 border-t border-[rgba(var(--foreground-rgb),0.06)] break-words text-[color:var(--text-quiet)]"
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
        lang={language}
        className={`${
          layout === "center"
            ? "max-w-md"
            : layout === "left"
              ? "max-w-xl"
              : "max-w-3xl"
        } mx-auto site-page ${visiblePlans.length > 0 ? "pt-[calc(3rem*var(--spacing-page-top,1))] md:pt-[calc(5rem*var(--spacing-page-top,1))]" : "site-page-top"} pb-12 md:pb-20 min-h-[calc(100dvh-180px)]`}
        ref={entranceRef}
        data-contact-layout={layout}
      >
        {/* Contact だけは自分の構成（center/left/split）に見出しを合わせる。
            全体の見出しの型より、そのページの並びのほうが優先される。 */}
        <PageTitle
          className="mb-12"
          align={layout === "center" ? "center" : "left"}
        >
          {pageLabel}
        </PageTitle>

        {/* split では説明とフォームを横に並べる。スマホは常に縦積み。 */}
        <div
          className={
            layout === "split"
              ? "md:grid md:grid-cols-2 md:gap-12 md:items-start"
              : ""
          }
        >
        <div>
        {/* i18n Phase 3: "English inquiries welcome" note — always visible near the
            heading regardless of the JP/EN toggle, so an English-only visitor on the
            default JP page still sees they can reach out. Hidden when set to "". */}
        {status !== "success" && englishWelcome && (
          <p
            className={`${leadAlign} font-en text-xs tracking-[0.02em] text-[color:var(--text-quiet)] -mt-6 mb-8 break-words page-entrance page-entrance-delay-1`}
          >
            {englishWelcome}
          </p>
        )}

        {/* contactIntro is the owner's own lead-in; it used to render only in the
            no-form branch, leaving the configured text invisible once Formspree
            was set up. Show it above the form too (success view keeps it hidden
            so the thank-you moment stays quiet). */}
        {formspreeUrl && status !== "success" && intro && (
          <p
            className={`${leadAlign} text-[color:var(--text-quiet)] -mt-4 mb-5 break-words ${english ? "font-en" : "ja-prose"} page-entrance page-entrance-delay-1`}
            style={readableBodyStyle}
          >
            {intro}
          </p>
        )}
        {/* 2026-07-08 動線改善: 「頼んでいいんだ」と思える橋 — 相談歓迎の一言と
            依頼の流れ。どちらも設定で空にすれば消える。 */}
        {formspreeUrl && status !== "success" && note && (
          <p
            className={`${leadAlign} text-[color:var(--text-quiet)] mb-8 break-words ${english ? "font-en" : "ja-prose"} page-entrance page-entrance-delay-1`}
            style={readableBodyStyle}
          >
            {note}
          </p>
        )}
        {areas && (
          <p
            className={`${leadAlign} text-[color:var(--text-quiet)] mb-8 break-words ${english ? "font-en" : "ja-prose"} page-entrance page-entrance-delay-1`}
            style={readableBodyStyle}
          >
            {areas}
          </p>
        )}
        {formspreeUrl && status !== "success" && flow && (
          <div className="mb-10 px-5 py-4 border border-[rgba(var(--foreground-rgb),0.08)] rounded-lg page-entrance page-entrance-delay-1">
            <p className="font-en uppercase text-[length:var(--text-note)] tracking-[0.14em] text-[color:var(--text-quiet)] mb-2">
              Flow
            </p>
            <p
              className={`text-[color:var(--text-quiet)] break-words ${english ? "font-en" : "ja-prose"}`}
              style={readableBodyStyle}
            >
              {flow}
            </p>
          </div>
        )}
        </div>
        <div>
        {!formspreeUrl ? (
          <div className="py-4 space-y-6 page-entrance page-entrance-delay-1">
            {intro && (
              <p
                className={`text-[color:var(--text-quiet)] break-words ${english ? "font-en" : "ja-prose"}`}
                style={readableBodyStyle}
              >
                {intro}
              </p>
            )}
            {contactEmail && (
              <a
                href={`mailto:${contactEmail}`}
                className="inline-block font-en text-sm tracking-[0.03em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300 py-1"
              >
                {contactEmail}
              </a>
            )}
            {(data?.profileInstagram || data?.profileTwitter) && (
              <div className="flex gap-6 pt-4 border-t border-[rgba(var(--foreground-rgb),0.06)]">
                {data?.profileInstagram && (
                  <a
                    href={safeHref(data.profileInstagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tap-target font-en text-xs tracking-[0.06em] text-[color:var(--text-quiet)] hover:text-[color:var(--text-quiet)] nav-link-luxury transition-colors duration-300 py-1.5"
                  >
                    {english
                      ? "Instagram"
                      : data?.snsLabelInstagram ?? "Instagram"}
                  </a>
                )}
                {data?.profileTwitter && (
                  <a
                    href={safeHref(data.profileTwitter)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tap-target font-en text-xs tracking-[0.06em] text-[color:var(--text-quiet)] hover:text-[color:var(--text-quiet)] nav-link-luxury transition-colors duration-300 py-1.5"
                  >
                    {english ? "X" : data?.snsLabelTwitter ?? "X"}
                  </a>
                )}
              </div>
            )}
            {/* Nothing configured yet — avoid a blank page (but not while still loading) */}
            {!isLoading &&
              !intro &&
              !contactEmail &&
              !data?.profileInstagram &&
              !data?.profileTwitter &&
              // A failed settings load used to land here too, so a server
              // hiccup told the visitor "準備中です。" — that this photographer
              // is not taking enquiries — and offered no way to get in touch.
              // Say what actually happened, and let them retry.
              (settingsFailed ? (
                <div className="space-y-3">
                  <p
                    role="alert"
                    className={`text-[color:var(--text-quiet)] break-words ${english ? "font-en" : "ja-prose"}`}
                    style={readableBodyStyle}
                  >
                    {language === "en"
                      ? "Could not load the contact details just now."
                      : "連絡先を読み込めませんでした。"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetchSettings()}
                    className="tap-target font-en text-xs tracking-[0.06em] text-[color:var(--text-quiet)] hover:text-[var(--accent-color,rgba(var(--foreground-rgb),0.85))] nav-link-luxury transition-colors duration-300 py-1.5"
                  >
                    {language === "en" ? "Try again" : "再試行"}
                  </button>
                </div>
              ) : (
                <p
                  className="text-[color:var(--text-quiet)] italic"
                  style={readableBodyStyle}
                >
                  {language === "en" ? "Coming soon." : "準備中です。"}
                </p>
              ))}
          </div>
        ) : status === "success" ? (
          <div className="text-center py-12 page-entrance page-entrance-delay-1">
            <p
              ref={successMessageRef}
              tabIndex={-1}
              aria-live="polite"
              className="text-sm text-[color:var(--text-quiet)]"
            >
              {sentMessage}
            </p>
            <button
              onClick={() => {
                focusNameOnIdleRef.current = true;
                setStatus("idle");
              }}
              className="mt-6 font-en text-xs tracking-[0.04em] text-[color:var(--text-quiet)] hover:text-[color:var(--text-quiet)] transition-colors duration-300"
            >
              {sendAnother}
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
              label={formName}
              htmlFor="contact-name"
              error={errors.name}
            >
              <input
                ref={nameInputRef}
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
              label={formEmail}
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
              label={formSubject}
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
                {/* 「—」だけでは、選ばなくてよいのか選び忘れなのか分からない。
                    件名は必須ではないので、そのことが分かる語を置く
                    （到達点(7)「意味のない仮の表示をしない」）。 */}
                <option value="">{fallbackSubjectNone}</option>
                {subjectOptions.map((opt) => (
                    // Use the human-readable label as the value so notifications are
                    // legible and non-ASCII (e.g. Japanese) options don't collide.
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
              </select>
            </Field>

            <Field
              label={formMessage}
              htmlFor="contact-message"
              error={errors.message}
            >
              <textarea
                id="contact-message"
                name="message"
                rows={5}
                placeholder={messagePlaceholder}
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
              <div role="alert" className="space-y-2">
                {/* 逃げ道の一文も同じ alert の中に置く。読み上げソフトには
                    「送れなかった」だけでなく「代わりにこれがある」まで
                    届いてほしい。文言の回帰は data-contact-error を指して
                    測るので、付け足しでテストが緩まない。 */}
                <p
                  data-contact-error
                  className="text-xs text-[color:var(--form-error)]"
                >
                  {sendError}
                </p>
                {/* メールを設定していないサイトでは何も足さない（購入者の
                    まっさらな状態で、押せない案内を出さないため）。 */}
                {failoverMailto && (
                  <p
                    className="text-xs text-[color:var(--text-quiet)]"
                    style={{ lineHeight: 1.9 }}
                  >
                    {fallbackMailtoLead}{" "}
                    <a
                      href={failoverMailto}
                      className="font-en tracking-[0.03em] underline underline-offset-4 decoration-[rgba(var(--foreground-rgb),0.25)] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300"
                    >
                      {contactEmail}
                    </a>
                  </p>
                )}
              </div>
            )}

            <p
              className="text-xs text-[color:var(--text-quiet)]"
              style={{ lineHeight: 1.8 }}
            >
              {english ? (
                <>
                  Please review the{" "}
                  <a
                    href="/privacy/en"
                    className="underline underline-offset-4 decoration-[rgba(var(--foreground-rgb),0.25)] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300"
                  >
                    Privacy Policy
                  </a>{" "}
                  before sending.
                </>
              ) : (
                <>
                  送信前に
                  <a
                    href="/privacy"
                    className="underline underline-offset-4 decoration-[rgba(var(--foreground-rgb),0.25)] hover:text-[rgba(var(--foreground-rgb),0.70)] transition-colors duration-300"
                  >
                    プライバシーポリシー
                  </a>
                  をご確認ください。
                </>
              )}
            </p>

            <button
              type="submit"
              disabled={status === "sending"}
              aria-busy={status === "sending" || undefined}
              className="self-start font-en text-sm tracking-[0.03em] bg-[var(--foreground)] text-[var(--background)] px-6 py-2 rounded-md hover:opacity-85 transition-opacity duration-300 disabled:opacity-30 mt-1"
            >
              {status === "sending"
                ? sendingButton
                : sendButton}
            </button>
          </form>
        )}
        </div>
        </div>
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
          className="text-xs text-[color:var(--form-error)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
