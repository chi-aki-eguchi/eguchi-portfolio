/**
 * 名刺の QR の行き先（`/card.html`、印刷済み）。読んだ人が行き先を選ぶ1枚のページ。
 *
 * 2026-11-10、オーナー「名刺のQRはinstagramとxとwebページ、あとこれから用意するstill,lifeってのに
 * 飛べるようにしたい。選択制。」。今までは同梱の HTML（名前と住所が書き込み）だったので、設定から組む。
 * 住所の入っていない行き先は出さない（still,life は、住所を入れたら並ぶ）。
 */
import { EXHIBITION_CARD_PLACES } from "../shared/exhibition";
import { isServiceOwnerSite } from "../shared/service-visibility";
import { escapeHtml } from "./ogp";

/** 足せる行き先の名前（設定 `cardExtraLabel` が空のとき）。 */
export const CARD_EXTRA_LABEL_DEFAULT = "still,life";

type SettingsLike = Record<string, string | null | undefined>;

export type CardLink = { label: string; href: string; me: boolean };

/** http(s) の住所だけ通す。それ以外は空。 */
function webUrl(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/** 並べる行き先。Website はいつも先頭。 */
export function cardLinks(settings: SettingsLike, siteUrl: string): CardLink[] {
  const links: CardLink[] = [{ label: "Website", href: `${siteUrl.replace(/\/+$/, "")}/`, me: false }];
  const add = (label: string, value: string | null | undefined, me: boolean) => {
    const href = webUrl(value);
    if (href) links.push({ label, href, me });
  };
  add(settings.snsLabelInstagram?.trim() || "Instagram", settings.profileInstagram, true);
  add(settings.snsLabelTwitter?.trim() || "X", settings.profileTwitter, true);
  add(settings.cardExtraLabel?.trim() || CARD_EXTRA_LABEL_DEFAULT, settings.cardExtraUrl, false);
  return links;
}

export function renderCardPage(settings: SettingsLike, siteUrl: string): string {
  const name = settings.profileName?.trim() || settings.siteName?.trim() || "";
  const roman = settings.profileNameEn?.trim() || "";
  const links = cardLinks(settings, siteUrl);
  const labels = links.map((link) => link.label).join("・");
  // 名前を縦に組むのは、かな・漢字の短い名前のときだけ。
  const vertical = /^[぀-ヿ㐀-鿿\s]{1,8}$/.test(name);
  const owner = isServiceOwnerSite(settings.siteUrl ?? undefined, undefined) || isServiceOwnerSite(siteUrl, undefined);
  const places = owner ? EXHIBITION_CARD_PLACES : "";
  const base = siteUrl.replace(/\/+$/, "");
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <meta name="robots" content="noindex, follow">
  <meta name="description" content="${escapeHtml(`${[name, roman].filter(Boolean).join(" / ")} — ${labels}へのリンク。`)}">
  <title>${escapeHtml(name ? `${name} | Links` : "Links")}</title>
  <link rel="canonical" href="${escapeHtml(`${base}/card.html`)}">
  <style>
    * { box-sizing: border-box; }
    :root { --bg: #fff; --ink: #171717; --line: #ddd; --soft: #595959; --press: #f6f6f6; }
    @media (prefers-color-scheme: dark) { :root { --bg: #111; --ink: #ededed; --line: #333; --soft: #a3a3a3; --press: #1c1c1c; } }
    html { background: var(--bg); color: var(--ink); }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Noto Sans", Arial, sans-serif; -webkit-text-size-adjust: 100%; }
    main { width: min(100%, 392px); min-height: 100svh; margin-inline: auto; padding: max(48px, env(safe-area-inset-top)) 36px max(32px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; justify-content: center; }
    header { text-align: center; margin-bottom: 36px; }
    h1 { margin: 0 auto; font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif; font-size: 30px; font-weight: 400; line-height: 1.25; letter-spacing: .24em; }
    h1.v { writing-mode: vertical-rl; }
    .roman { margin: 18px 0 0; font-size: 14px; letter-spacing: .055em; }
    nav { display: grid; gap: 0; }
    a { display: flex; align-items: center; justify-content: center; min-height: 64px; padding: 16px 12px; border-top: 1px solid var(--line); color: inherit; font-size: 18px; line-height: 1.5; text-align: center; text-decoration: none; -webkit-tap-highlight-color: transparent; }
    a:last-child { border-bottom: 1px solid var(--line); }
    a:active { background: var(--press); }
    @media (hover: hover) { a:hover { background: var(--press); } }
    a:focus-visible { position: relative; outline: 2px solid currentColor; outline-offset: 3px; }
    footer { margin-top: 36px; font-size: 10px; line-height: 1.7; letter-spacing: .065em; color: var(--soft); text-align: center; }
    @media (max-height: 600px) { main { padding-top: 28px; padding-bottom: 24px; } header { margin-bottom: 24px; } h1 { font-size: 25px; } a { min-height: 56px; padding-block: 12px; } footer { margin-top: 24px; } }
    @media (prefers-contrast: more) { a { border-color: currentColor; } footer { color: inherit; } }
  </style>
</head>
<body>
  <main>
${
  name
    ? `    <header>
      <h1${vertical ? ' class="v"' : ""}>${escapeHtml(name)}</h1>${roman ? `\n      <p class="roman" lang="en">${escapeHtml(roman)}</p>` : ""}
    </header>\n`
    : ""
}    <nav aria-label="${escapeHtml(`${labels}から選択`)}">
${links
  .map(
    (link) =>
      `      <a href="${escapeHtml(link.href)}" lang="en"${link.me ? ' rel="me"' : ""}>${escapeHtml(link.label)}</a>`,
  )
  .join("\n")}
    </nav>${places ? `\n    <footer lang="en">${escapeHtml(places)}</footer>` : ""}
  </main>
</body>
</html>
`;
}
