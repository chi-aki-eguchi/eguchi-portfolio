import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { siteDesignFrom, usesDevelopStructure } from "../lib/book";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { DEVELOP_INQUIRY_HREF } from "../../shared/develop-structure";
import { JaPhrases } from "./JaPhrases";

/**
 * Closing "work with me" band shown at the foot of the Top / Gallery / Series
 * pages — the conversion moment for an engaged viewer. Quiet and editorial by
 * design (large serif line, generous whitespace), so it invites rather than
 * shouts. Hidden entirely unless enabled in Settings.
 */
export function InquiryCta({
  language = "ja",
}: {
  language?: "ja" | "en";
}) {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const ref = useScrollFadeIn([data?.homeCtaEnabled]);
  const [location] = useLocation();

  if ((data?.homeCtaEnabled ?? "off") !== "on") return null;

  // The owner-configured CTA currently has one (Japanese) copy field. Reusing
  // it on /en/about made the page switch languages again at the exact moment
  // a visitor was ready to enquire. Keep the configured copy unchanged on all
  // existing Japanese callers, and give the English profile a complete,
  // self-contained invitation until dedicated EN settings exist.
  const english = language === "en";
  const title = english
    ? "Photography inquiries"
    : data?.homeCtaTitle || "撮影のご依頼";
  const text = english
    ? "Portraits, editorial work, and collaborations are welcome."
    : data?.homeCtaText || "";
  const button = english ? "Get in touch" : data?.homeCtaButton || "お問い合わせ";
  // 新しい構成では、メニューと同じ Info の料金と依頼フォームへ（DEVELOP_INQUIRY_HREF の説明）。
  const href = english
    ? "/en/contact"
    : usesDevelopStructure(siteDesignFrom(data?.siteDesign), location)
      ? DEVELOP_INQUIRY_HREF
      : "/contact";

  return (
    <section lang={language} className="inquiry-note" ref={ref}>
      <div className="section-reveal">
        <h2 className="break-words"><JaPhrases>{title}</JaPhrases></h2>
        {text && <p className="break-words"><JaPhrases>{text}</JaPhrases></p>}
      </div>
      <Link to={href} className="inquiry-note__link section-reveal">
        {button}
      </Link>
    </section>
  );
}

/**
 * 依頼の入口の1行（2026-11-10）。新しい構成のトップの、表紙のすぐ下に置く。
 *
 * それまで、何を頼めるか・料金・入口はトップに無かった（展示のトップ）。写真を見に来た人が最初の画面で
 * 分かるように、帯と同じ設定の言葉（料金の文と見出し）を1行で出す。帯を出さない設定（homeCtaEnabled）
 * なら出さない。Portrait の写真の上には置かない：見出しを出さない設定では、写真は上の帯のすぐ下から
 * 始める決まり（2026-10-12、余白の指摘。smoke「写真は幅を使い切り、余白は区切りにだけ使う」）。
 */
export function InquiryLine() {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const [location] = useLocation();
  if ((data?.homeCtaEnabled ?? "off") !== "on") return null;
  if (!usesDevelopStructure(siteDesignFrom(data?.siteDesign), location)) return null;
  const text = (data?.homeCtaText || "").trim();
  const label = data?.homeCtaTitle || "撮影のご依頼";
  return (
    <p className="inquiry-line">
      {text && (
        <span className="inquiry-line__text">
          <JaPhrases>{text}</JaPhrases>
        </span>
      )}
      <Link to={DEVELOP_INQUIRY_HREF} className="inquiry-line__link">
        {label}
        <span aria-hidden="true" className="font-en">
          →
        </span>
      </Link>
    </p>
  );
}
