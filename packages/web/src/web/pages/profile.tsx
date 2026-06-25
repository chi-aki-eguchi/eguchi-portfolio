import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { CLIENT_SITE_FALLBACKS } from "../lib/site-fallbacks";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { InquiryCta } from "../components/InquiryCta";
import { safeHref } from "../lib/utils";

export default function ProfilePage() {
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

  const bio = data?.profileBio ?? "";
  const statement = data?.profileStatement ?? "";
  const gear = (data?.profileGear ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const nameJa = data?.profileName ?? CLIENT_SITE_FALLBACKS.profileName;
  const nameEn = data?.profileNameEn ?? CLIENT_SITE_FALLBACKS.profileNameEn;

  const hasSns =
    data?.profileInstagram || data?.profileTwitter || data?.profileNote;
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
      <h1
        className="font-en uppercase mb-12 text-center page-entrance"
        style={{
          fontSize: "var(--section-label-size, 0.75rem)",
          color: `rgba(var(--foreground-rgb), var(--section-label-opacity, 0.35))`,
          letterSpacing: "var(--section-label-tracking, 0.10em)",
          lineHeight: "var(--section-leading, 1.2)",
        }}
      >
        {data?.profileLabel ?? "Profile"}
      </h1>

      <div className="grid md:grid-cols-[300px_1fr] gap-14 items-start">
        {/* Photo */}
        <div className="page-entrance">
          {data?.profilePhotoUrl && !photoBroken ? (
            <img
              src={`${data.profilePhotoUrl}?w=900&q=90`}
              srcSet={`${data.profilePhotoUrl}?w=600&q=90 600w, ${data.profilePhotoUrl}?w=900&q=90 900w, ${data.profilePhotoUrl}?w=1200&q=90 1200w`}
              sizes="(min-width: 768px) 300px, 90vw"
              alt={nameJa}
              decoding="async"
              fetchPriority="high"
              onError={() => setPhotoBroken(true)}
              className="w-full aspect-[3/4] object-cover rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
            />
          ) : (
            <div className="w-full aspect-[3/4] bg-[rgba(var(--foreground-rgb),0.05)] rounded-lg" />
          )}
        </div>

        {/* Bio */}
        <div className="pt-1 flex flex-col">
          <h2
            className="font-bold tracking-[0.03em] text-[var(--foreground)] page-entrance page-entrance-delay-1"
            style={{ fontSize: "var(--heading-size, 1.25rem)" }}
          >
            {nameJa}
          </h2>
          <p className="font-en text-sm tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.40)] mt-1 page-entrance page-entrance-delay-1">
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
                    className="text-[rgba(var(--foreground-rgb),0.55)]"
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
                className="text-[rgba(var(--foreground-rgb),0.30)] italic"
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
              <h3 className="font-en uppercase text-[10px] tracking-[0.14em] text-[rgba(var(--foreground-rgb),0.30)] mb-3">
                Statement
              </h3>
              <div className="space-y-3">
                {statement
                  .split(/\n{2,}/)
                  .filter(Boolean)
                  .map((para, i) => (
                    <p
                      key={i}
                      className="text-[rgba(var(--foreground-rgb),0.55)] text-pretty"
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
              <h3 className="font-en uppercase text-[10px] tracking-[0.14em] text-[rgba(var(--foreground-rgb),0.30)] mb-3">
                Equipment
              </h3>
              <ul className="space-y-1.5">
                {gear.map((item, i) => (
                  <li
                    key={i}
                    className="font-en text-[rgba(var(--foreground-rgb),0.50)]"
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
                  className="font-en text-xs tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.30)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300 py-1.5"
                >
                  {data?.snsLabelInstagram ?? "Instagram"}
                </a>
              )}
              {data?.profileTwitter && (
                <a
                  href={safeHref(data.profileTwitter)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-en text-xs tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.30)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300 py-1.5"
                >
                  {data?.snsLabelTwitter ?? "X"}
                </a>
              )}
              {data?.profileNote && (
                <a
                  href={safeHref(data.profileNote)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-en text-xs tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.30)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300 py-1.5"
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
          <h3 className="font-en uppercase text-[10px] tracking-[0.14em] text-[rgba(var(--foreground-rgb),0.30)] mb-8">
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
                  <p className="font-en text-[10px] tracking-[0.10em] text-[rgba(var(--foreground-rgb),0.30)] mb-2">
                    {formatNoteDate(post.date)}
                  </p>
                )}
                {/* Title */}
                <p
                  className="text-[rgba(var(--foreground-rgb),0.68)] group-hover:text-[rgba(var(--foreground-rgb),0.88)] transition-colors duration-300 mb-2"
                  style={{
                    fontSize: "var(--body-size, 0.875rem)",
                    lineHeight: "1.6",
                    letterSpacing: "0.01em",
                  }}
                >
                  {post.title}
                </p>
                {/* Excerpt — first ~120 chars, 2-line clamp */}
                {post.excerpt && (
                  <p
                    className="line-clamp-2 text-[rgba(var(--foreground-rgb),0.38)]"
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
              className="inline-block mt-8 font-en text-xs tracking-[0.06em] text-[rgba(var(--foreground-rgb),0.35)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300 py-1.5"
            >
              {data?.snsLabelNote ?? "note"} →
            </a>
          )}
        </div>
      )}

      {/* K1: Prints — quiet external store link. Hidden unless enabled + URL set. */}
      {printOn && (
        <div className="mt-16 md:mt-20 pt-12 border-t border-[rgba(var(--foreground-rgb),0.06)] page-entrance">
          <h3 className="font-en uppercase text-[10px] tracking-[0.14em] text-[rgba(var(--foreground-rgb),0.30)] mb-4">
            Prints
          </h3>
          {data?.printDescription && (
            <p
              className="text-[rgba(var(--foreground-rgb),0.55)] mb-5 whitespace-pre-line"
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
