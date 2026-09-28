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

  return (
    <section lang={language} className="inquiry-note" ref={ref}>
      <div className="section-reveal">
        <h2 className="break-words">{title}</h2>
        {text && <p className="break-words">{text}</p>}
      </div>
      <Link to={english ? "/en/contact" : "/contact"} className="inquiry-note__link section-reveal">
        {button}
      </Link>
    </section>
  );
}
