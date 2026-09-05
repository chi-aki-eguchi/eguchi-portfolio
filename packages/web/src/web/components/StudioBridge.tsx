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
export function StudioBridge({ siteUrl, language = "ja" }: {
  siteUrl?: string; language?: "ja" | "en"; compact?: boolean;
}) {
  if (!isServiceOwnerSite(siteUrl, undefined)) return null;
  const en = language === "en";
  const label = en ? "Portfolio websites & pricing →" : "ポートフォリオ制作・料金を見る →";
  const copy = en ? "Create and publish your portfolio." : "写真を公開するための、料金ページはこちら。";
  return (
    <aside data-studio-bridge="footer" className="max-w-5xl mx-auto px-6 md:px-12 pt-10 pb-4">
      <div className="border-t border-[rgba(var(--foreground-rgb),0.12)] pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm leading-7">
        <div><p className="font-en tracking-wider">FOR PHOTOGRAPHERS</p><p className="text-[color:var(--text-quiet)]">{copy}</p></div>
        <a href="/portfolio-kit#pricing" className="underline underline-offset-4 py-2">{label}</a>
      </div>
    </aside>
  );
}
