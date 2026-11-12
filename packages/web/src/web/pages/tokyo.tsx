import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { BackToTop } from "../components/BackToTop";
import { Picture } from "../components/Picture";
import type { GalleryPhoto } from "../components/PhotoGallery";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { usePageLanguage } from "../hooks/usePageLanguage";
import { siteDesignFrom } from "../lib/book";
import { orientedAspectRatio, orientedDimensions } from "../lib/picture";
import { safeHref } from "../lib/utils";
import { sendAnalyticsEvent } from "../lib/analytics";
import { CLIENT_SITE_FALLBACKS } from "../lib/site-fallbacks";
import { photoAltText } from "../../shared/photo-alt";
import { usableContactEmail, usableContactEndpoint } from "../../shared/contact-settings";
import { buildFailoverMailto } from "../../shared/contact-failover";
import {
  formatYen,
  TOKYO_COPY,
  TOKYO_FORM_LANGUAGE_DEFAULT,
  TOKYO_FORM_LANGUAGES,
  TOKYO_LANGS,
  TOKYO_PATHS,
  TOKYO_SHOOT,
  tokyoDocumentTitle,
  tokyoInquiryFields,
  tokyoPlanLine,
  type TokyoLang,
} from "../../shared/tokyo-shoot";
import "./tokyo.css";

type Status = "idle" | "sending" | "success" | "error";
type FieldErrors = Partial<Record<"date" | "plan" | "name" | "email", string>>;

const REQUEST_ANCHOR = "request";
// 繁體中文の本文は台湾の字形の明朝で出す。サイトの和文書体には無い字があり、
// そのままだと1文の中で書体が混ざる。このページを開いたときだけ読み込む。
const ZH_FONT_HREF = "https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;600&display=swap";

function useZhFont(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    if (document.querySelector(`link[href="${ZH_FONT_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = ZH_FONT_HREF;
    document.head.appendChild(link);
  }, [enabled]);
}

/** 今日の日付（その人の端末の日付）。過ぎた日を希望日に選べないようにする。 */
function todayForDateInput(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function track(name: "contact_submit_start" | "contact_submit_success", language: TokyoLang) {
  try {
    sendAnalyticsEvent(name, { language, form: "tokyo" });
  } catch {
    // 計測が止まっていても、申し込みは止めない。
  }
}

/**
 * 東京の旅行者向け撮影プラン（2026-11-12）。写真と余白が主役で、文字は名前・料金・流れだけ。
 * 料金・エリア・文・作例の写真は `shared/tokyo-shoot.ts` の1か所で決める。
 * 送信は Contact と同じ送信先（設定 `formspreeUrl`）へ。決済はここでは扱わない。
 *
 * サイトのメニューと帯・フッターは出さない（2026-11-12、オーナー「ある程度独立させた方が良くない？」）。
 * 旅行者が読むのはこの1枚で、日本語の Info（別の料金）へ迷い込まないようにする。
 * 上は名前と言語の切り替えだけ、下にポートフォリオへの出口を1本だけ置く。
 */
export default function TokyoPage({ language }: { language: TokyoLang }) {
  const copy = TOKYO_COPY[language];
  usePageLanguage(language);
  useZhFont(language === "zh-Hant");

  const { data: settings, isError: settingsError } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const photosQ = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });

  // 題はサーバー（api/ogp.ts）と同じ式。設定が届くまでは、サーバーが出した題のままにする。
  useEffect(() => {
    if (!settings && !settingsError) return;
    document.title = tokyoDocumentTitle(language, {
      nameJa: settings?.siteName || CLIENT_SITE_FALLBACKS.siteName,
      nameEn: settings?.siteNameEn || CLIENT_SITE_FALLBACKS.siteNameEn,
      subtitle: settings?.heroSubtitle || CLIENT_SITE_FALLBACKS.heroSubtitle,
    });
  }, [language, settings, settingsError]);

  // 選んだ写真を、選んだ順で。公開をやめた・消した写真は飛ばす。
  const photos = useMemo(() => {
    const byId = new Map(((photosQ.data?.photos ?? []) as GalleryPhoto[]).map((p) => [p.id, p]));
    return TOKYO_SHOOT.photoIds.map((id) => byId.get(id)).filter((p): p is GalleryPhoto => !!p);
  }, [photosQ.data]);
  const [cover, ...rest] = photos;
  // 表紙のあとは2枚ずつ、文の合間に置く。
  const pairs: GalleryPhoto[][] = [];
  for (let i = 0; i < rest.length; i += 2) pairs.push(rest.slice(i, i + 2));

  const nameJa = settings?.siteName || "";
  const nameEn = settings?.siteNameEn || "";
  const photographerName = nameJa || nameEn;
  const formspreeUrl = usableContactEndpoint(settings?.formspreeUrl);
  const contactEmail = usableContactEmail(settings?.contactEmail);

  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failoverMailto, setFailoverMailto] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const sentRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (status === "success") sentRef.current?.focus({ preventScroll: true });
  }, [status]);

  const entranceRef = usePageEntrance([photos.length, settings, status, language]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || !formspreeUrl) return;
    const fd = new FormData(event.currentTarget);
    const text = (name: string) => String(fd.get(name) ?? "").trim();
    // 人は見えない欄に書かない。書いてあれば送らずに、送れたように見せる（Contact と同じ）。
    if (text("_gotcha")) {
      setStatus("success");
      return;
    }
    const next: FieldErrors = {};
    if (!text("date")) next.date = copy.form.errors.date;
    if (!text("plan")) next.plan = copy.form.errors.plan;
    if (!text("name")) next.name = copy.form.errors.name;
    if (!text("email")) next.email = copy.form.errors.email;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text("email"))) next.email = copy.form.errors.emailFormat;
    if (Object.keys(next).length > 0) {
      setErrors(next);
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }
    setErrors({});
    const fields = tokyoInquiryFields({
      pageLang: language,
      date: text("date"),
      people: text("people"),
      planId: text("plan"),
      areaId: text("area"),
      name: text("name"),
      email: text("email"),
      social: text("social"),
      language: text("language"),
      message: text("message"),
    });
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);

    submittingRef.current = true;
    setStatus("sending");
    track("contact_submit_start", language);
    const failed = () => {
      // 送れなかったときも、書いた内容をそのままメールへ持っていけるようにする。
      const lines = Object.entries(fields)
        .filter(([key]) => !["subject", "name", "email"].includes(key))
        .map(([key, value]) => (key === "message" ? value : `${key}: ${value}`));
      const values: Record<string, string> = { subject: fields.subject, name: fields.name, message: lines.join("\n") };
      setFailoverMailto(buildFailoverMailto(contactEmail, { get: (name) => values[name] ?? null }));
      setStatus("error");
    };
    try {
      const res = await fetch(formspreeUrl, { method: "POST", headers: { Accept: "application/json" }, body });
      if (res.ok) {
        setFailoverMailto("");
        setStatus("success");
        formRef.current?.reset();
        track("contact_submit_success", language);
      } else failed();
    } catch {
      failed();
    } finally {
      submittingRef.current = false;
    }
  };

  const clear = (key: keyof FieldErrors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  const peopleOptions = Array.from({ length: TOKYO_SHOOT.maxPeople }, (_, i) => i + 1);

  return (
    <div className="tk site-page" lang={language} data-tokyo-lang={language} ref={entranceRef}>
      <header className="tk-bar">
        {nameEn && (
          <p className="tk-bar__name font-en" lang="en">
            {nameEn}
          </p>
        )}
      <nav className="tk-lang" aria-label="Language">
        {TOKYO_LANGS.map((lang) => (
          <Link
            key={lang}
            to={TOKYO_PATHS[lang]}
            lang={lang}
            hrefLang={lang}
            aria-current={lang === language ? "page" : undefined}
            className="tk-lang__link"
          >
            {TOKYO_COPY[lang].langName}
          </Link>
        ))}
      </nav>
      </header>

      <main id="main-content">
      <div className="tk-top">
        {/* 写真が届くまで同じ大きさの場所を取っておく（届いたときに文が下へ動かないように）。 */}
        <div className="tk-top__cover">{cover ? <Photo photo={cover} copy={copy} name={photographerName} cover /> : <div className="tk-cover-hold" />}</div>
        <header className="tk-head">
          <h1 className="tk-title">{copy.heading}</h1>
          {(nameJa || nameEn) && (
            <p className="tk-name">
              {nameJa && nameJa !== nameEn && <span lang="ja">{nameJa}</span>}
              {nameEn && (
                <span className="font-en" lang="en">
                  {nameEn}
                </span>
              )}
            </p>
          )}
          <div className="tk-lead">
            {copy.lead.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </header>
      </div>

      {pairs[0] && <PhotoRow photos={pairs[0]} copy={copy} name={photographerName} />}

      <section className="tk-section page-entrance" aria-labelledby="tk-plans">
        <h2 id="tk-plans" className="tk-label">
          {copy.plansLabel}
        </h2>
        <ul className="tk-plans">
          {TOKYO_SHOOT.plans.map((plan) => (
            <li key={plan.id} className="tk-plan">
              <h3 className="tk-plan__name">{copy.plan[plan.id].name}</h3>
              <p className="tk-plan__price font-en">{formatYen(plan.priceYen)}</p>
              <p className="tk-plan__detail">
                {copy.duration(plan.minutes)}
                <span aria-hidden="true">　</span>
                {copy.plan[plan.id].detail(plan)}
              </p>
            </li>
          ))}
        </ul>
        <a href={`#${REQUEST_ANCHOR}`} className="tk-to-form">
          {copy.toForm}
          <span aria-hidden="true" className="font-en">
            ↓
          </span>
        </a>
      </section>

      {pairs[1] && <PhotoRow photos={pairs[1]} copy={copy} name={photographerName} />}

      <div className="tk-facts">
        <section className="tk-section page-entrance" aria-labelledby="tk-areas">
          <h2 id="tk-areas" className="tk-label">
            {copy.areasLabel}
          </h2>
          <ul className="tk-areas">
            {TOKYO_SHOOT.areas.map((id) => (
              <li key={id}>{copy.areas[id]}</li>
            ))}
          </ul>
          <p className="tk-quiet">{copy.areasNote}</p>
        </section>
        <section className="tk-section page-entrance" aria-labelledby="tk-flow">
          <h2 id="tk-flow" className="tk-label">
            {copy.flowLabel}
          </h2>
          <ol className="tk-flow">
            {copy.flow.map((step, i) => (
              <li key={step}>
                <span className="tk-flow__n font-en" aria-hidden="true">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {pairs.slice(2).map((pair) => (
        <PhotoRow key={pair[0].id} photos={pair} copy={copy} name={photographerName} />
      ))}

      <div className="tk-request">
        <section className="tk-section page-entrance" aria-labelledby="tk-notes" data-tokyo-provisional>
          <h2 id="tk-notes" className="tk-label">
            {copy.notesLabel}
          </h2>
          <ul className="tk-notes">
            {copy.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>

        <section className="tk-section page-entrance" id={REQUEST_ANCHOR} aria-labelledby="tk-form">
          <h2 id="tk-form" className="tk-label">
            {copy.form.label}
          </h2>
          {status === "success" ? (
            <div className="tk-sent">
              <p ref={sentRef} tabIndex={-1} aria-live="polite" className="tk-sent__text">
                {copy.form.sent}
              </p>
              <button type="button" className="tk-sent__again" onClick={() => setStatus("idle")}>
                {copy.form.sendAnother}
              </button>
            </div>
          ) : !formspreeUrl ? (
            // 送信先が無いサイト設定のときは、メールだけを出す（押せないフォームを出さない）。
            contactEmail && (
              <a href={`mailto:${contactEmail}`} className="tk-mail font-en">
                {contactEmail}
              </a>
            )
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="tk-form" noValidate>
              <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" aria-hidden="true" className="tk-trap" />
              <div className="tk-form__pair">
                <Field id="tk-date" label={copy.form.date} error={errors.date}>
                  <input
                    id="tk-date"
                    type="date"
                    name="date"
                    min={todayForDateInput()}
                    aria-required="true"
                    aria-invalid={!!errors.date || undefined}
                    aria-describedby={errors.date ? "tk-date-error" : undefined}
                    onChange={() => clear("date")}
                    className="tk-input"
                  />
                </Field>
                <Field id="tk-people" label={copy.form.people}>
                  <select id="tk-people" name="people" defaultValue="1人" className="tk-input tk-select">
                    {peopleOptions.map((n) => {
                      const more = n === TOKYO_SHOOT.maxPeople;
                      // 通知に入る値は日本語で揃える（オーナーが読む）。
                      return (
                        <option key={n} value={TOKYO_COPY.ja.form.peopleOption(n, more)}>
                          {copy.form.peopleOption(n, more)}
                        </option>
                      );
                    })}
                  </select>
                </Field>
              </div>
              <Field id="tk-plan" label={copy.form.plan} error={errors.plan}>
                <select
                  id="tk-plan"
                  name="plan"
                  defaultValue=""
                  aria-required="true"
                  aria-invalid={!!errors.plan || undefined}
                  aria-describedby={errors.plan ? "tk-plan-error" : undefined}
                  onChange={() => clear("plan")}
                  className="tk-input tk-select"
                >
                  <option value="" disabled>
                    {copy.form.choose}
                  </option>
                  {TOKYO_SHOOT.plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {tokyoPlanLine(language, plan)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="tk-area" label={copy.form.area}>
                <select id="tk-area" name="area" defaultValue="" className="tk-input tk-select">
                  <option value="">{copy.form.areaOther}</option>
                  {TOKYO_SHOOT.areas.map((id) => (
                    <option key={id} value={id}>
                      {copy.areas[id]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="tk-name" label={copy.form.name} error={errors.name}>
                <input
                  id="tk-name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  aria-required="true"
                  aria-invalid={!!errors.name || undefined}
                  aria-describedby={errors.name ? "tk-name-error" : undefined}
                  onChange={() => clear("name")}
                  className="tk-input"
                />
              </Field>
              <Field id="tk-email" label={copy.form.email} error={errors.email}>
                <input
                  id="tk-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  aria-required="true"
                  aria-invalid={!!errors.email || undefined}
                  aria-describedby={errors.email ? "tk-email-error" : undefined}
                  onChange={() => clear("email")}
                  className="tk-input"
                />
              </Field>
              <Field id="tk-social" label={copy.form.social}>
                <input id="tk-social" type="text" name="social" autoComplete="off" autoCapitalize="none" className="tk-input" />
              </Field>
              <Field id="tk-language" label={copy.form.language}>
                <select
                  id="tk-language"
                  name="language"
                  defaultValue={TOKYO_FORM_LANGUAGE_DEFAULT[language]}
                  className="tk-input tk-select"
                >
                  {TOKYO_FORM_LANGUAGES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="tk-message" label={copy.form.message}>
                <textarea id="tk-message" name="message" rows={3} placeholder={copy.form.messagePlaceholder} className="tk-input tk-textarea" />
              </Field>

              {status === "error" && (
                <div role="alert" className="tk-form__error">
                  <p data-tokyo-error>{copy.form.sendError}</p>
                  {failoverMailto && (
                    <p className="tk-quiet">
                      {copy.form.mailtoLead}{" "}
                      <a href={failoverMailto} className="font-en tk-underline">
                        {contactEmail}
                      </a>
                    </p>
                  )}
                </div>
              )}

              <p className="tk-quiet tk-privacy">
                {copy.form.privacyBefore}
                <a href={language === "ja" ? "/privacy" : "/privacy/en"} className="tk-underline">
                  {copy.form.privacyLink}
                </a>
                {copy.form.privacyAfter}
              </p>
              <button type="submit" disabled={status === "sending"} aria-busy={status === "sending" || undefined} className="tk-send">
                {status === "sending" ? copy.form.sending : copy.form.send}
              </button>
            </form>
          )}
        </section>
      </div>
      </main>

      <footer className="tk-foot">
        <Link to={siteDesignFrom(settings?.siteDesign) === "develop" ? "/portrait" : "/gallery"} className="tk-foot__more">
          {copy.morePhotos}
          <span aria-hidden="true" className="font-en">
            →
          </span>
        </Link>
        <div className="tk-foot__row">
          {settings?.profileInstagram && (
            <a href={safeHref(settings.profileInstagram)} target="_blank" rel="noopener noreferrer" className="tk-foot__link font-en">
              Instagram
            </a>
          )}
          {photographerName && (
            <p className="tk-foot__copy font-en">
              © {new Date().getFullYear()} {language === "en" ? nameEn || nameJa : <span lang="ja">{nameJa || nameEn}</span>}
            </p>
          )}
        </div>
      </footer>
      <BackToTop language={language === "ja" ? "ja" : "en"} />
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="tk-field">
      <label htmlFor={id} className="tk-field__label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="tk-field__error">
          {error}
        </p>
      )}
    </div>
  );
}

function PhotoRow({ photos, copy, name }: { photos: GalleryPhoto[]; copy: (typeof TOKYO_COPY)[TokyoLang]; name: string }) {
  return (
    <div className="tk-row page-entrance" data-count={photos.length}>
      {photos.map((photo) => (
        <Photo key={photo.id} photo={photo} copy={copy} name={name} />
      ))}
    </div>
  );
}

function Photo({
  photo,
  copy,
  name,
  cover = false,
}: {
  photo: GalleryPhoto;
  copy: (typeof TOKYO_COPY)[TokyoLang];
  name: string;
  cover?: boolean;
}) {
  const dims = orientedDimensions(photo.width, photo.height, photo.rotationDeg);
  const ratio = dims.width && dims.height ? dims.width / dims.height : 1;
  const film = photo.filmType?.trim() === "フィルム";
  return (
    // 横に並べるとき、縦横比のぶんだけ幅を分けると高さがそろう。
    <figure className="tk-photo" data-tokyo-photo={photo.id} style={{ "--tk-ratio": ratio } as React.CSSProperties}>
      <Picture
        url={photo.url}
        thumbUrl={photo.thumbUrl}
        mediumUrl={photo.mediumUrl}
        width={photo.width}
        height={photo.height}
        rotationDeg={photo.rotationDeg}
        alt={photoAltText(photo, { photographerName: name })}
        preset="lightbox"
        sizes={cover ? "(max-width: 767px) 100vw, 540px" : "(max-width: 767px) 100vw, 720px"}
        fallbackW={1200}
        fallbackQ={82}
        className="tk-photo__img"
        style={{ aspectRatio: orientedAspectRatio(photo.width, photo.height, photo.rotationDeg) }}
        loading={cover ? "eager" : "lazy"}
        fetchPriority={cover ? "high" : "auto"}
        draggable={false}
      />
      {/* フィルムで撮った写真にだけ、機材の記録（写真のデータにある名前）を添える。 */}
      {film && (
        <figcaption className="tk-photo__note">
          {copy.film}
          {photo.camera && <span className="font-en"> · {photo.camera}</span>}
        </figcaption>
      )}
    </figure>
  );
}
