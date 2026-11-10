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

export type CardLink = { label: string; href: string; me: boolean; note: string };

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

/** 行き先の名前に添える小さい字。SNS は @名前、ほかは場所の名前（akieguchi.com）。 */
function linkNote(href: string, account: boolean): string {
  try {
    const url = new URL(href);
    const handle = url.pathname.split("/").filter(Boolean)[0];
    if (account && handle) return `@${decodeURIComponent(handle)}`;
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 並べる行き先。Website はいつも先頭。 */
export function cardLinks(settings: SettingsLike, siteUrl: string): CardLink[] {
  const home = `${siteUrl.replace(/\/+$/, "")}/`;
  const links: CardLink[] = [{ label: "Website", href: home, me: false, note: linkNote(home, false) }];
  const add = (label: string, value: string | null | undefined, me: boolean) => {
    const href = webUrl(value);
    if (href) links.push({ label, href, me, note: linkNote(href, me) });
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
  // 名前を縦に組むのは、かな・漢字の短い名前のときだけ（本の背のように、右に立てる）。
  const vertical = /^[\u3040-\u30ff\u3400-\u9fff\s]{1,8}$/.test(name);
  const owner = isServiceOwnerSite(settings.siteUrl ?? undefined, undefined) || isServiceOwnerSite(siteUrl, undefined);
  const places = owner ? EXHIBITION_CARD_PLACES : "";
  const base = siteUrl.replace(/\/+$/, "");
  const top = vertical ? roman : name;
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
    * { box-sizing: border-box; margin: 0; }
    :root { --bg: #f7f6f2; --ink: #1a1917; --line: #d9d6ce; --soft: #7b776e; --en: "Cormorant Garamond", "Hoefler Text", Baskerville, "Baskerville Old Face", Garamond, "Times New Roman", serif; --ja: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", "Noto Serif JP", serif; }
    @media (prefers-color-scheme: dark) { :root { --bg: #131211; --ink: #ece9e2; --line: #34322e; --soft: #9a958a; } }
    html { background: var(--bg); color: var(--ink); -webkit-text-size-adjust: 100%; }
    body { font-family: var(--ja); }
    main { width: min(100%, 460px); min-height: 100svh; margin-inline: auto; padding: max(28px, env(safe-area-inset-top)) 28px max(24px, env(safe-area-inset-bottom)); display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto 1fr auto; column-gap: 26px; }
    .top { grid-column: 1; font: 400 13px var(--en); letter-spacing: .3em; text-transform: uppercase; padding-top: 2px; }
    .spine { grid-column: 2; grid-row: 1 / 4; display: flex; flex-direction: column; align-items: center; gap: 18px; }
    .spine::before, .spine::after { content: ""; width: 1px; background: var(--line); }
    .spine::before { height: 44px; }
    .spine::after { flex: 1; }
    h1 { font: 500 27px / 1 var(--ja); letter-spacing: .34em; writing-mode: vertical-rl; }
    h1.h { grid-column: 1; writing-mode: horizontal-tb; font-size: 26px; letter-spacing: .12em; line-height: 1.4; }
    nav { grid-column: 1; grid-row: 2; align-self: end; padding-top: 56px; }
    a { display: grid; grid-template-columns: 1fr auto; align-items: baseline; column-gap: 12px; padding: 17px 0 15px; border-top: 1px solid var(--line); color: inherit; text-decoration: none; -webkit-tap-highlight-color: transparent; }
    a:last-child { border-bottom: 1px solid var(--line); }
    a b { font: 400 34px / 1.15 var(--en); letter-spacing: .01em; }
    a i { font: 400 20px var(--en); color: var(--soft); transition: color .3s; }
    a small { grid-column: 1 / 3; margin-top: 5px; font: 400 11px var(--en); letter-spacing: .16em; color: var(--soft); }
    a:active { opacity: .55; }
    @media (hover: hover) { a:hover i { color: var(--ink); } a:hover b { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 7px; } }
    a:focus-visible { outline: 1px solid currentColor; outline-offset: 4px; }
    footer { grid-column: 1; grid-row: 3; margin-top: 30px; font: 400 10px var(--en); letter-spacing: .3em; color: var(--soft); }
    @media (max-height: 600px) { nav { padding-top: 28px; } a { padding: 12px 0 11px; } a b { font-size: 29px; } footer { margin-top: 20px; } }
    @media (prefers-reduced-motion: no-preference) {
      .top, .spine, a, footer { animation: in .9s both; }
      a:nth-child(1) { animation-delay: .12s; } a:nth-child(2) { animation-delay: .2s; } a:nth-child(3) { animation-delay: .28s; } a:nth-child(4) { animation-delay: .36s; }
      footer { animation-delay: .5s; }
      @keyframes in { from { opacity: 0; } }
    }
    @media (prefers-contrast: more) { :root { --line: currentColor; --soft: currentColor; } }
  </style>
</head>
<body>
  <main>
${top ? `    <p class="top"${vertical ? ' lang="en"' : ""}>${escapeHtml(top)}</p>\n` : ""}${
    name && vertical ? `    <div class="spine"><h1 class="v">${escapeHtml(name)}</h1></div>\n` : ""
  }    <nav aria-label="${escapeHtml(`${labels}から選択`)}">
${links
  .map(
    (link) =>
      `      <a href="${escapeHtml(link.href)}" lang="en"${link.me ? ' rel="me"' : ""}><b>${escapeHtml(link.label)}</b><i aria-hidden="true">→</i>${link.note ? `<small>${escapeHtml(link.note)}</small>` : ""}</a>`,
  )
  .join("\n")}
    </nav>${places ? `\n    <footer lang="en">${escapeHtml(places)}</footer>` : ""}
  </main>
</body>
</html>
`;
}
