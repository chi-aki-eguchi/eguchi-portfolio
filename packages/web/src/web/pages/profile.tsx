import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "../components/PageTitle";
import { api, jsonOrThrow } from "../lib/api";
import { CLIENT_SITE_FALLBACKS } from "../lib/site-fallbacks";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { InquiryCta } from "../components/InquiryCta";
import { safeHref } from "../lib/utils";

export default function ProfilePage({
  language = "ja",
}: {
  language?: "ja" | "en";
}) {
  const [photoBroken, setPhotoBroken] = useState(false);
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const data = settings;

  // J1: latest note posts (server-fetched + cached). Empty on failure/disabled.
  const noteOn = data?.noteEnabled === "on";
  const { data: noteData } = useQuery({
    queryKey: ["note-posts"],
    queryFn: async () => jsonOrThrow(await api["note-posts"].$get()),
    enabled: noteOn,
    staleTime: 10 * 60_000,
  });
  const notePosts = noteData?.posts ?? [];

  // K1: print store link (external). Shown only when enabled + URL present.
  const printOn = data?.printEnabled === "on" && !!data?.printStoreUrl;

  // i18n Phase 3: English page falls back to the JP copy when no EN text is set,
  // so /en/about never goes blank while the owner is still translating.
  const bio =
    language === "en"
      ? data?.profileBioEn || data?.profileBio || ""
      : (data?.profileBio ?? "");
  const statement =
    language === "en"
      ? data?.profileStatementEn || data?.profileStatement || ""
      : (data?.profileStatement ?? "");
  const gear = (data?.profileGear ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const nameJa = data?.profileName ?? CLIENT_SITE_FALLBACKS.profileName;
  const nameEn = data?.profileNameEn ?? CLIENT_SITE_FALLBACKS.profileNameEn;

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
      alt={nameJa}
      decoding="async"
      fetchPriority="high"
      onError={() => setPhotoBroken(true)}
      className={
        layout === "stack"
          ? "w-full aspect-[3/2] object-cover"
          : "w-full aspect-[3/4] object-cover rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
      }
    />
  ) : null;
  // Re-run entrance observer when settings OR note data arrive so all
  // conditionally-rendered sections (Statement, Equipment, Journal) fade in
  // instead of staying invisible. noteData is fetched after settings, so
  // without it the Journal section mounts after the observer last ran and
  // stays at opacity:0.
  const entranceRef = usePageEntrance([data, noteData]);

  return (
    <section
      className="max-w-3xl mx-auto px-5 md:px-10 pt-[calc(3rem*var(--spacing-page-top,1))] md:pt-[calc(5rem*var(--spacing-page-top,1))] pb-12 md:pb-20 min-h-[60vh]"
      ref={entranceRef}
    >
      <PageTitle className="mb-12">{data?.profileLabel ?? "Profile"}</PageTitle>

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
            {nameJa}
          </h2>
          <p className="font-en text-sm tracking-[0.04em] text-[color:var(--text-quiet)] mt-1 break-words page-entrance page-entrance-delay-1">
            {nameEn}
          </p>

          {bio ? (
            <div className="mt-8 space-y-3 page-entrance page-entrance-delay-2">
              {bio
                .split("\n")
                .filter(Boolean)
                .map((line, i) => (
                  <p
                    key={i}
                    className="text-[color:var(--text-quiet)] break-words"
                    style={{
                      fontSize: "var(--body-size, 0.875rem)",
                      lineHeight: "var(--body-leading, 2)",
                      letterSpacing: "var(--body-tracking, 0.01em)",
                    }}
                  >
                    {line}
                  </p>
                ))}
            </div>
          ) : (
            <div className="mt-8 page-entrance page-entrance-delay-2">
              <p
                className="text-[color:var(--text-quiet)] italic break-words"
                style={{
                  fontSize: "var(--body-size, 0.875rem)",
                  lineHeight: "var(--body-leading, 2)",
                  letterSpacing: "var(--body-tracking, 0.01em)",
                }}
              >
                {settings?.heroSubtitle || "Photographer"}
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
                      className="text-[color:var(--text-quiet)] text-pretty break-words"
                      style={{
                        fontSize: "var(--body-size, 0.875rem)",
                        lineHeight: "var(--body-leading, 2)",
                        letterSpacing: "var(--body-tracking, 0.01em)",
                      }}
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
                  {data?.snsLabelInstagram ?? "Instagram"}
                </a>
              )}
              {data?.profileTwitter && (
                <a
                  href={safeHref(data.profileTwitter)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target font-en text-xs tracking-[0.04em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300 py-1.5"
                >
                  {data?.snsLabelTwitter ?? "X"}
                </a>
              )}
              {data?.profileNote && (
                <a
                  href={safeHref(data.profileNote)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target font-en text-xs tracking-[0.04em] text-[color:var(--text-quiet)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300 py-1.5"
                >
                  {data?.snsLabelNote ?? "note"}
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
          {data?.printDescription && (
            <p
              className="text-[color:var(--text-quiet)] mb-5 whitespace-pre-line"
              style={{
                fontSize: "var(--body-size, 0.875rem)",
                lineHeight: "var(--body-leading, 2)",
                letterSpacing: "var(--body-tracking, 0.01em)",
              }}
            >
              {data.printDescription}
            </p>
          )}
          <a
            href={safeHref(data?.printStoreUrl ?? "")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-en text-sm tracking-[0.03em] border border-[rgba(var(--foreground-rgb),0.18)] text-[rgba(var(--foreground-rgb),0.65)] px-6 py-2.5 rounded-md hover:border-[rgba(var(--foreground-rgb),0.35)] hover:text-[rgba(var(--foreground-rgb),0.85)] transition-colors duration-300"
          >
            {data?.printStoreLabel || "プリントを購入する"}
          </a>
        </div>
      )}

      <InquiryCta />
    </section>
  );
}

// note's pubDate is RFC-822; show a short ja-style date, falling back to raw text.
function formatNoteDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
