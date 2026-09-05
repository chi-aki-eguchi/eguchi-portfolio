import { isServiceOwnerSite } from "../../shared/service-visibility";

export const STUDIO_URL = "https://photo-work-pricing.chi-aki-18.chatgpt.site";

export function studioHref(path = "/", placement = "portfolio-kit") {
  const url = new URL(path, STUDIO_URL);
  url.searchParams.set("utm_source", "partner");
  url.searchParams.set("utm_medium", "owned_site");
  url.searchParams.set("utm_campaign", "akieguchi");
  url.searchParams.set("utm_content", placement);
  return url.toString();
}

// The kit is distributed to other photographers. Never advertise our service
// on a customer's site merely because their sales page is enabled.
export function StudioBridge({ siteUrl, language = "ja", compact = false }: {
  siteUrl?: string; language?: "ja" | "en"; compact?: boolean;
}) {
  if (!isServiceOwnerSite(siteUrl, undefined)) return null;
  const en = language === "en";
  if (compact) return (
    <aside data-studio-bridge="footer" className="max-w-5xl mx-auto px-6 md:px-12 pt-10 pb-4">
      <div className="border-t border-[rgba(var(--foreground-rgb),0.12)] pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm leading-7">
        <div><p className="font-en tracking-wider">FOR PHOTOGRAPHERS</p><p className="text-[color:var(--text-quiet)]">{en ? "A website for your photographs." : "あなたの写真にも、見てもらう場所を。"}</p></div>
        <a href={studioHref("/tools/readiness", "footer")} className="underline underline-offset-4 py-2">{en ? "Free portfolio readiness check (Japanese) →" : "無料で公開準備をチェック →"}</a>
      </div>
    </aside>
  );
  return (
    <section data-studio-bridge="service" aria-labelledby="studio-bridge-title" className="mt-12 md:mt-16 border border-[rgba(var(--foreground-rgb),0.16)] p-6 sm:p-9 rounded-lg">
      <p className="font-en text-sm tracking-wider">PORTFOLIO STUDIO / BY AKI EGUCHI</p>
      <h2 id="studio-bridge-title" className="mt-4 text-xl sm:text-2xl leading-relaxed">{en ? "Need help choosing the photos and words, too?" : "写真選びと文章から、一緒に整えたい方へ。"}</h2>
      <p className="mt-4 text-base leading-8 text-[color:var(--text-quiet)]">{en ? "Portfolio Kit covers setup and publishing. Portfolio Studio adds photo selection and sequencing, Japanese profile editing, and a review before publishing. These are two levels of the same service, provided by Aki Eguchi." : "3万円のPortfolio Kitは、用意した写真・文章で公開するプラン。Portfolio Studioは、写真の選定・並べ方・プロフィール文の整理まで含めて公開する、江口秋の制作サービスです。"}</p>
      <p className="mt-5 text-lg">{en ? "Editorial + publishing: ¥69,800 total" : "編集付き公開：69,800円（税込・一回）"}</p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--text-quiet)]">{en ? "Includes Portfolio Kit; the ¥30,000 is not added again. Hosting and domain costs are separate. Consultation is free. Japanese-language support." : "Portfolio Kitを含む総額です。3万円が別途加算されることはありません。サーバー・ドメインは別途実費。相談だけで料金は発生しません。"}</p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <a href={studioHref("/", "service-editorial")} className="inline-flex justify-center px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-md text-base">{en ? "See editorial support (Japanese) →" : "編集付き公開の内容を見る →"}</a>
        <a href={studioHref("/tools/readiness", "service-check")} className="inline-flex justify-center px-6 py-3 border border-[rgba(var(--foreground-rgb),0.20)] rounded-md text-base">{en ? "Check what you need (Japanese)" : "自分に必要か、5問で確認"}</a>
      </div>
    </section>
  );
}
