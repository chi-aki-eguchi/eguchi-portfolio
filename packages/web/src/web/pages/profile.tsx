import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "../components/PageTitle";
import { api, jsonOrThrow } from "../lib/api";
import { CLIENT_SITE_FALLBACKS } from "../lib/site-fallbacks";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { usePageLanguage } from "../hooks/usePageLanguage";
import { InquiryCta } from "../components/InquiryCta";
import { safeHref } from "../lib/utils";

const CJK_TEXT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

// EN settings are owner-entered text. A pasted bilingual draft used to expose
// its Japanese/Traditional-Chinese paragraphs on /en/about. Keep complete
// Latin-script lines and omit untranslated lines instead of switching the page
// language mid-way through the biography.
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

const readableBodyStyle = {
  fontSize: "max(0.875rem, var(--body-size, 0.875rem))",
  lineHeight: "max(1.75, var(--body-leading, 2))",
  letterSpacing: "var(--body-tracking, 0.01em)",
} as const;

export default function ProfilePage({
  language = "ja",
}: {
  language?: "ja" | "en";
}) {
  usePageLanguage(language);
  const english = language === "en";
  const [photoBroken, setPhotoBroken] = useState(false);
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const data = settings;

  // J1: latest note posts (server-fetched + cached). Empty on failure/disabled.
  // note.com entries currently have no translated feed. Showing their Japanese
  // titles and excerpts on the English profile recreates the same language leak
  // even when the biography itself is translated.
  const noteOn = !english && data?.noteEnabled === "on";
  const { data: noteData } = useQuery({
    queryKey: ["note-posts"],
    queryFn: async () => jsonOrThrow(await api["note-posts"].$get()),
    enabled: noteOn,
    staleTime: 10 * 60_000,
  });
  const notePosts = noteData?.posts ?? [];

  // K1: print store link (external). Shown only when enabled + URL present.
  const printOn = data?.printEnabled === "on" && !!data?.printStoreUrl;

  const bio = english
    ? englishOnly(data?.profileBioEn)
    : (data?.profileBio ?? "");
  const statement = english
    ? englishOnly(data?.profileStatementEn)
    : (data?.profileStatement ?? "");
  const gear = (data?.profileGear ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((line) => line && (!english || !CJK_TEXT.test(line)));
  const nameJa = data?.profileName ?? CLIENT_SITE_FALLBACKS.profileName;
  const nameEn = data?.profileNameEn ?? CLIENT_SITE_FALLBACKS.profileNameEn;
  const displayName = english
    ? englishInline(nameEn, CLIENT_SITE_FALLBACKS.profileNameEn)
    : nameJa;
  const pageLabel = english
    ? englishInline(data?.profileLabel, "About")
    : data?.profileLabel ?? "Profile";
  const printDescription = english
    ? englishOnly(data?.printDescription)
    : data?.printDescription ?? "";
  const printLabel = english
    ? englishInline(data?.printStoreLabel, "View prints")
    : data?.printStoreLabel || "プリントを購入する";

  const hasSns =
    data?.profileInstagram || data?.profileTwitter || data?.profileNote;

  // About の構成。買った人のサイトが全部同じ形にならないよう、写真と文章の
  // 関係そのものを選べるようにする（色や大きさだけでは骨格が変わらない）。
  //   side  — 写真左・本文右（既定。従来どおり）
  //   stack — 写真を本文幅いっぱいに置き、その下に名前と文章
  //   quiet — 写真を出さず、名前と文章だけ
  // 写真が無い（未設定・読み込み失敗）ときは、どれを選んでいても quiet で描く。
  // 従来は空の灰色の四角を場所取りしていたが、それは「作りかけに見える」
  // （admin-renewal-goal 到達点(6)）だけで、誰の役にも立っていなかった。
  const hasPhoto = !!data?.profilePhotoUrl && !photoBroken;
  const requestedLayout = ["side", "stack", "quiet"].includes(
    data?.profileLayout ?? "",
  )
    ? data!.profileLayout!
    : "side";
  const layout = hasPhoto ? requestedLayout : "quiet";

  const photoImg = data?.profilePhotoUrl ? (
    <img
      src={`${data.profilePhotoUrl}?w=900&q=90`}
      srcSet={`${data.profilePhotoUrl}?w=600&q=90 600w, ${data.profilePhotoUrl}?w=900&q=90 900w, ${data.profilePhotoUrl}?w=1200&q=90 1200w`}
      sizes={
        layout === "stack" ? "(min-width: 768px) 768px, 90vw" : "(min-width: 768px) 300px, 90vw"
      }
      alt={displayName}
      decoding="async"
      fetchPriority="high"
      onError={() => setPhotoBroken(true)}
      className={
        layout === "stack"
          ? "w-full aspect-[3/2] object-cover"
          : // 写真は角を丸めない（トークンの「the frame principle」）。ここだけ
            // rounded-lg が付いていて、同じ画面の JOURNAL のサムネイルや
            // ギャラリーの写真と角の形が違っていた。影も写真用の共通トークンへ。
            "w-full aspect-[3/4] object-cover shadow-[var(--shadow-photo)]"
      }
    />
  ) : null;
  // Re-run entrance observer when settings OR note data arrive so all
  // conditionally-rendered sections (Statement, Equipment, Journal) fade in
  // instead of staying invisible. noteData is fetched after settings, so
  // without it the Journal section mounts after the observer last ran and
  // stays at opacity:0.
  const entranceRef = usePageEntrance([data, noteData]);

  // **設定が届くまで本文を描かない。**このページの中身（写真・文・見出しの
  // 大きさ・余白）は、全部その設定から来る。先に描くと、届いた瞬間に版面を
  // 組み直すことになる。実測（2026-08-30）では二段組が y=231→137 へ 94px
  // 跳ね、締めの帯ごと下へ流れていた（CLS 0.116）。
  // 1画面ぶん場所だけ取って待つ（`.site-page-hold`）。フックはすべてこの上に
  // あるので、ここで返しても呼び出し順は変わらない。
  if (settingsLoading) {
    return (
      <section
        className="max-w-3xl mx-auto site-page site-page-top site-page-hold"
        aria-hidden="true"
      />
    );
  }

  return (
    <section
      lang={language}
      /* note の記事一覧は設定より後に届く。届いた瞬間に JOURNAL の段が生まれ、
         **その時点で画面に出ている締めの帯を押しのける**（実測 2026-08-31:
         帯が y=537 から画面外へ飛び、ズレ 0.063）。基準内ではあるが、読んで
         いる最中に動くことに変わりはない。届くまで1画面ぶん場所を取り、
         帯を最初から画面の外に置く（`.site-page-hold`）。 */
      className={`max-w-3xl mx-auto site-page site-page-top pb-12 md:pb-20 min-h-[60vh] ${
        noteOn && noteData === undefined ? "site-page-hold" : ""
      }`}
      ref={entranceRef}
    >
      <PageTitle className="mb-12">{pageLabel}</PageTitle>

      <div
        className={
          layout === "side"
            ? "grid md:grid-cols-[300px_1fr] gap-14 items-start"
            : "block"
        }
        data-profile-layout={layout}
      >
        {/* Photo — quiet では出さない */}
        {layout !== "quiet" && (
          <div className={layout === "stack" ? "page-entrance mb-10" : "page-entrance"}>
            {photoImg}
          </div>
        )}

        {/* Bio */}
        {/* min-w-0: grid の子は既定で min-width:auto なので、中身が折り返せない
            とき列そのものが広がる。下の break-words と両方要る。 */}
        <div className="pt-1 flex flex-col min-w-0">
          <h2
            /* break-words が無いと、折り返せない長い名前（URL を貼った等）で
               About が横に伸びる。実測 320px の画面で 1650px まで広がっていた。
               TOP の作家名には元から付いている。 */
            className="font-bold tracking-[0.03em] text-[var(--foreground)] break-words page-entrance page-entrance-delay-1"
            style={{
              // quiet は写真が無いぶん、名前を大きくして紙面の芯にする。
              // 同じ大きさのままだと「写真が抜け落ちた side」に見える。
              fontSize:
                layout === "quiet"
                  ? "calc(var(--heading-size, 1.25rem) * 1.6)"
                  : "var(--heading-size, 1.25rem)",
            }}
          >
            {displayName}
          </h2>
          {!english && (
            <p className="font-en text-sm tracking-[0.04em] text-[color:var(--text-quiet)] mt-1 break-words page-entrance page-entrance-delay-1">
              {nameEn}
            </p>
          )}

          {bio ? (
            <div className="mt-8 space-y-3 page-entrance page-entrance-delay-2">
              {bio
                .split("\n")
                .filter(Boolean)
                .map((line, i) => (
                  <p
                    key={i}
                    className={`text-[color:var(--text-quiet)] break-words ${english ? "font-en" : "ja-prose"}`}
                    style={readableBodyStyle}
                  >
                    {line}
                  </p>
                ))}
            </div>
          ) : (
            <div className="mt-8 page-entrance page-entrance-delay-2">
              <p
                className="text-[color:var(--text-quiet)] italic break-words"
                style={readableBodyStyle}
              >
                {english
                  ? englishInline(settings?.heroSubtitle, "Photographer")
                  : settings?.heroSubtitle || "Photographer"}
              </p>
            </div>
          )}

          {/* E5: Statement (作家ステートメント) — 空欄なら非表示 */}
          {statement && (
            <div className="mt-10 page-entrance page-entrance-delay-2">
              <h3 className="font-en uppercase text-[length:var(--text-note)] tracking-[0.14em] text-[color:var(--text-quiet)] mb-3">
                Statement
              </h3>
              <div className="space-y-3">
                {statement
                  .split(/\n{2,}/)
                  .filter(Boolean)
                  .map((para, i) => (
                    <p
                      key={i}
                      className={`text-[color:var(--text-quiet)] text-pretty break-words ${english ? "font-en" : "ja-prose"}`}
                      style={readableBodyStyle}
                    >
                      {para.replace(/\n/g, " ")}
                    </p>
                  ))}
              </div>
            </div>
          )}

          {/* E5: Equipment (使用機材) — 空欄なら非表示 */}
          {gear.length > 0 && (
            <div className="mt-10 page-entrance page-entrance-delay-2">
              <h3 className="font-en uppercase text-[length:var(--text-note)] tracking-[0.14em] text-[color:var(--text-quiet)] mb-3">
                Equipment
              </h3>
              <ul className="space-y-1.5">
                {gear.map((item, i) => (
                  <li
                    key={i}
                    className="font-en text-[color:var(--text-quiet)] break-words"
                    style={{
                      fontSize: "var(--body-size, 0.8125rem)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex-1" />

          {hasSns && (
            <div className="flex gap-5 mt-10 pt-6 border-t border-[rgba(var(--foreground-rgb),0.06)] page-entrance page-entrance-delay-2">
              {data?.profileInstagram && (
                <a
                  href={safeHref(data.profileInstagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target font-en text-xs tracking-[0.04em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300 py-1.5"
                >
                  {english ? "Instagram" : data?.snsLabelInstagram ?? "Instagram"}
                </a>
              )}
              {data?.profileTwitter && (
                <a
                  href={safeHref(data.profileTwitter)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target font-en text-xs tracking-[0.04em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300 py-1.5"
                >
                  {english ? "X" : data?.snsLabelTwitter ?? "X"}
                </a>
              )}
              {data?.profileNote && (
                <a
                  href={safeHref(data.profileNote)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target font-en text-xs tracking-[0.04em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300 py-1.5"
                >
                  {english ? "note" : data?.snsLabelNote ?? "note"}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* J1: Journal — latest note posts as cards (thumbnail + date + title + excerpt).
          Hidden if disabled or fetch returned nothing. */}
      {noteOn && notePosts.length > 0 && (
        <div className="mt-20 md:mt-28 pt-12 border-t border-[rgba(var(--foreground-rgb),0.06)] page-entrance">
          <h3 className="font-en uppercase text-[length:var(--text-note)] tracking-[0.14em] text-[color:var(--text-quiet)] mb-8">
            Journal
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {notePosts.map((post) => (
              <a
                key={post.link}
                href={safeHref(post.link)}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                {/* Thumbnail — 3:2 photographic ratio */}
                <div className="aspect-[3/2] overflow-hidden bg-[rgba(var(--foreground-rgb),0.04)] mb-4">
                  {post.thumbnail ? (
                    <img
                      src={post.thumbnail}
                      alt={post.title || ""}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  ) : null}
                </div>
                {/* Date */}
                {post.date && (
                  <p className="font-en text-[length:var(--text-note)] tracking-[0.10em] text-[color:var(--text-quiet)] mb-2">
                    {formatNoteDate(post.date)}
                  </p>
                )}
                {/* Title — 2行ぶんの高さを確保する。題名が1行の札と2行の札が
                    混ざると、その下の抜粋の開始位置が札ごとに上下してしまい、
                    横に並べたときに揃って見えない（実測で19pxずれていた）。 */}
                <p
                  className="line-clamp-2 text-[rgba(var(--foreground-rgb),0.68)] group-hover:text-[rgba(var(--foreground-rgb),0.88)] transition-colors duration-300 mb-2"
                  style={{
                    fontSize: "var(--body-size, 0.875rem)",
                    lineHeight: "1.6",
                    letterSpacing: "0.01em",
                    minHeight: "3.2em",
                  }}
                >
                  {post.title}
                </p>
                {/* Excerpt — first ~120 chars, 2-line clamp */}
                {post.excerpt && (
                  <p
                    className="line-clamp-2 text-[color:var(--text-quiet)]"
                    style={{
                      fontSize: "0.78rem",
                      lineHeight: "1.75",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {post.excerpt}
                  </p>
                )}
              </a>
            ))}
          </div>
          {data?.profileNote && (
            <a
              href={safeHref(data.profileNote)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-8 font-en text-xs tracking-[0.06em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300 py-1.5"
            >
              {data?.snsLabelNote ?? "note"} →
            </a>
          )}
        </div>
      )}

      {/* K1: Prints — quiet external store link. Hidden unless enabled + URL set. */}
      {printOn && (
        <div className="mt-16 md:mt-20 pt-12 border-t border-[rgba(var(--foreground-rgb),0.06)] page-entrance">
          <h3 className="font-en uppercase text-[length:var(--text-note)] tracking-[0.14em] text-[color:var(--text-quiet)] mb-4">
            Prints
          </h3>
          {printDescription && (
            <p
              className={`text-[color:var(--text-quiet)] mb-5 whitespace-pre-line break-words ${english ? "font-en" : "ja-prose"}`}
              style={readableBodyStyle}
            >
              {printDescription}
            </p>
          )}
          <a
            href={safeHref(data?.printStoreUrl ?? "")}
            target="_blank"
            rel="noopener noreferrer"
            data-analytics-event="print_store_click"
            className="works-cta font-en"
          >
            {printLabel}
          </a>
        </div>
      )}

      {/* **締めの帯は、上の中身が出そろってから出す。**
          この帯はこの節の中にあるので、節に高さを持たせても押し下がらない
          （`min-height` は中の要素を動かさない。2026-08-31 にそこで一度
          外した）。note の記事が後から届くと JOURNAL の段が生まれ、**画面に
          出ている帯を押しのける**（実測: 帯が y=537 から画面外へ）。
          出そろってから出せば、動くものが無い。 */}
      {(!noteOn || noteData !== undefined) && <InquiryCta language={language} />}
    </section>
  );
}

// note's pubDate is RFC-822; show a short ja-style date, falling back to raw text.
function formatNoteDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
