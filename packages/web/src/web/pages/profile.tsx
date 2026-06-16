import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { InquiryCta } from "../components/InquiryCta";

export default function ProfilePage() {
  const [photoBroken, setPhotoBroken] = useState(false);
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.settings.$get()).json(),
  });
  const data = settings;

  // J1: latest note posts (server-fetched + cached). Empty on failure/disabled.
  const noteOn = data?.noteEnabled === "on";
  const { data: noteData } = useQuery({
    queryKey: ["note-posts"],
    queryFn: async () => (await api["note-posts"].$get()).json(),
    enabled: noteOn,
    staleTime: 10 * 60_000,
  });
  const notePosts = noteData?.posts ?? [];

  // K1: print store link (external). Shown only when enabled + URL present.
  const printOn = data?.printEnabled === "on" && !!data?.printStoreUrl;

  const bio = data?.profileBio ?? "";
  const statement = data?.profileStatement ?? "";
  const gear = (data?.profileGear ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const nameJa = data?.profileName ?? "江口秋";
  const nameEn = data?.profileNameEn ?? "Aki Eguchi";

  const hasSns = data?.profileInstagram || data?.profileTwitter || data?.profileNote;
  // Re-run entrance observer when settings arrive so the (conditionally-rendered)
  // Statement / Equipment sections fade in instead of staying invisible.
  const entranceRef = usePageEntrance([data]);

  return (
    <section className="max-w-3xl mx-auto px-5 md:px-10 pt-[calc(3rem*var(--spacing-page-top,1))] md:pt-[calc(5rem*var(--spacing-page-top,1))] pb-12 md:pb-20 min-h-[60vh]" ref={entranceRef}>
      <h1
        className="font-en uppercase mb-12 text-center page-entrance"
        style={{ fontSize: "var(--section-label-size, 0.75rem)", color: `rgba(var(--foreground-rgb), var(--section-label-opacity, 0.35))`, letterSpacing: "var(--section-label-tracking, 0.10em)", lineHeight: "var(--section-leading, 1.2)" }}
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
              onError={() => setPhotoBroken(true)}
              className="w-full aspect-[3/4] object-cover rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
            />
          ) : (
            <div className="w-full aspect-[3/4] bg-[rgba(var(--foreground-rgb),0.05)] rounded-lg" />
          )}
        </div>

        {/* Bio */}
        <div className="pt-1 flex flex-col">
          <h3
            className="font-bold tracking-[0.03em] text-[var(--foreground)] page-entrance page-entrance-delay-1"
            style={{ fontSize: "var(--heading-size, 1.25rem)" }}
          >
            {nameJa}
          </h3>
          <p className="font-en text-sm tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.40)] mt-1 page-entrance page-entrance-delay-1">
            {nameEn}
          </p>

          {bio ? (
            <div className="mt-8 space-y-3 page-entrance page-entrance-delay-2">
              {bio.split("\n").filter(Boolean).map((line, i) => (
                <p key={i} className="text-[rgba(var(--foreground-rgb),0.55)]" style={{ fontSize: "var(--body-size, 0.875rem)", lineHeight: "var(--body-leading, 2)", letterSpacing: "var(--body-tracking, 0.01em)" }}>{line}</p>
              ))}
            </div>
          ) : (
            <div className="mt-8 page-entrance page-entrance-delay-2">
              <p className="text-[rgba(var(--foreground-rgb),0.30)] italic" style={{ fontSize: "var(--body-size, 0.875rem)", lineHeight: "var(--body-leading, 2)", letterSpacing: "var(--body-tracking, 0.01em)" }}>
                {settings?.heroSubtitle || "Photographer"}
              </p>
            </div>
          )}

          {/* E5: Statement (作家ステートメント) — 空欄なら非表示 */}
          {statement && (
            <div className="mt-10 page-entrance page-entrance-delay-2">
              <h4 className="font-en uppercase text-[10px] tracking-[0.14em] text-[rgba(var(--foreground-rgb),0.30)] mb-3">Statement</h4>
              <div className="space-y-3">
                {statement.split("\n").filter(Boolean).map((line, i) => (
                  <p key={i} className="text-[rgba(var(--foreground-rgb),0.55)]" style={{ fontSize: "var(--body-size, 0.875rem)", lineHeight: "var(--body-leading, 2)", letterSpacing: "var(--body-tracking, 0.01em)" }}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* E5: Equipment (使用機材) — 空欄なら非表示 */}
          {gear.length > 0 && (
            <div className="mt-10 page-entrance page-entrance-delay-2">
              <h4 className="font-en uppercase text-[10px] tracking-[0.14em] text-[rgba(var(--foreground-rgb),0.30)] mb-3">Equipment</h4>
              <ul className="space-y-1.5">
                {gear.map((item, i) => (
                  <li key={i} className="font-en text-[rgba(var(--foreground-rgb),0.50)]" style={{ fontSize: "var(--body-size, 0.8125rem)", letterSpacing: "0.02em" }}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex-1" />

          {hasSns && (
            <div className="flex gap-5 mt-10 pt-6 border-t border-[rgba(var(--foreground-rgb),0.06)] page-entrance page-entrance-delay-2">
              {data?.profileInstagram && (
                <a
                  href={data.profileInstagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-en text-xs tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.30)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300"
                >
                  {data?.snsLabelInstagram ?? "Instagram"}
                </a>
              )}
              {data?.profileTwitter && (
                <a
                  href={data.profileTwitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-en text-xs tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.30)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300"
                >
                  {data?.snsLabelTwitter ?? "X"}
                </a>
              )}
              {data?.profileNote && (
                <a
                  href={data.profileNote}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-en text-xs tracking-[0.04em] text-[rgba(var(--foreground-rgb),0.30)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300"
                >
                  {data?.snsLabelNote ?? "note"}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* J1: Journal — latest note posts. Hidden if disabled or fetch returned nothing. */}
      {noteOn && notePosts.length > 0 && (
        <div className="mt-20 md:mt-28 pt-12 border-t border-[rgba(var(--foreground-rgb),0.06)] page-entrance">
          <h4 className="font-en uppercase text-[10px] tracking-[0.14em] text-[rgba(var(--foreground-rgb),0.30)] mb-6">Journal</h4>
          <ul className="space-y-5">
            {notePosts.map((post) => (
              <li key={post.link}>
                <a
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-4 items-start"
                >
                  {post.thumbnail && (
                    <img
                      src={post.thumbnail}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      // note's external RSS thumbnail URLs expire; hide the broken-image
                      // icon if one 404s (the adjacent title keeps the link usable).
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                      className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-md flex-shrink-0 bg-[rgba(var(--foreground-rgb),0.04)]"
                    />
                  )}
                  <div className="min-w-0">
                    <p
                      className="text-[rgba(var(--foreground-rgb),0.65)] group-hover:text-[rgba(var(--foreground-rgb),0.85)] transition-colors duration-300"
                      style={{ fontSize: "var(--body-size, 0.9rem)", lineHeight: "1.6", letterSpacing: "0.01em" }}
                    >
                      {post.title}
                    </p>
                    {post.date && (
                      <p className="mt-1 font-en text-[11px] tracking-[0.05em] text-[rgba(var(--foreground-rgb),0.30)]">
                        {formatNoteDate(post.date)}
                      </p>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
          {data?.profileNote && (
            <a
              href={data.profileNote}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-6 font-en text-xs tracking-[0.06em] text-[rgba(var(--foreground-rgb),0.35)] hover:text-[rgba(var(--foreground-rgb),0.60)] nav-link-luxury transition-colors duration-300"
            >
              {data?.snsLabelNote ?? "note"} →
            </a>
          )}
        </div>
      )}

      {/* K1: Prints — quiet external store link. Hidden unless enabled + URL set. */}
      {printOn && (
        <div className="mt-16 md:mt-20 pt-12 border-t border-[rgba(var(--foreground-rgb),0.06)] page-entrance">
          <h4 className="font-en uppercase text-[10px] tracking-[0.14em] text-[rgba(var(--foreground-rgb),0.30)] mb-4">Prints</h4>
          {data?.printDescription && (
            <p
              className="text-[rgba(var(--foreground-rgb),0.55)] mb-5 whitespace-pre-line"
              style={{ fontSize: "var(--body-size, 0.875rem)", lineHeight: "var(--body-leading, 2)", letterSpacing: "var(--body-tracking, 0.01em)" }}
            >
              {data.printDescription}
            </p>
          )}
          <a
            href={data?.printStoreUrl ?? ""}
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
