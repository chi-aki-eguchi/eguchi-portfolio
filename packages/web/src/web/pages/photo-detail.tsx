// 写真1枚ぶんの着地ページ。
//
// **なぜ作ったか。**画像検索や共有から、一覧ではなく該当する1枚へ直接
// 着地できるようにするため。
//
// **設計の方針は「静けさ」。**このサイトは写真が主役で、余白と並びで持っている。
// ここも、写真を大きく1枚置いて、事実だけを小さく添える。題や説明が未入力でも、
// 書ける事実だけを使い、内容をでっち上げない。
// 前後の導線は、人のためであると同時に**クローラの通り道**でもある。
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { api } from "../lib/api";
import { ContentStatus } from "../components/ContentStatus";
import { Picture } from "../components/Picture";
import { usePageEntrance } from "../hooks/usePageEntrance";
import { usePageTitle } from "../hooks/usePageTitle";
import { photoAltText } from "../../shared/photo-alt";
import {
  captureFacts,
  type PhotoPageInput,
} from "../../shared/photo-page-text";
import { orientedAspectRatio } from "../../shared/image-url";
import { signalAnalyticsPageReady } from "../lib/analytics";

type PhotoDetailResponse = {
  photo: PhotoPageInput & {
    id: number;
    url: string;
    width: number | null;
    height: number | null;
    thumbUrl?: string | null;
    mediumUrl?: string | null;
    rotationDeg: number | null;
    seriesId: number | null;
  };
  series: { title: string; slug: string; kind: string } | null;
  prev: number | null;
  next: number | null;
};

export default function PhotoDetailPage() {
  const params = useParams();
  const id = params.id ?? "";
  const entranceRef = usePageEntrance();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["photo", id],
    // series-detail と同じ理由で、":id" の枝は型付きクライアントの型が
    // 展開しきれない（lib/api.ts のコメント参照）。応答の形は手で書く。
    queryFn: async (): Promise<PhotoDetailResponse | null> => {
      const res = await (api.photos as Record<string, any>)[":id"].$get({
        param: { id },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!id,
  });

  const { data: settings, isError: settingsError } = useQuery<
    Record<string, string>
  >({
    queryKey: ["settings"],
  });

  const alt = data
    ? photoAltText(data.photo, {
        photographerName: settings?.profileName || settings?.siteName || "",
        seriesName: data.series?.title,
      })
    : "";
  usePageTitle(alt || "Photograph");
  useEffect(() => {
    if (!data || (!settings && !settingsError)) return;
    const timer = window.setTimeout(
      () => signalAnalyticsPageReady(`/photo/${data.photo.id}`),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [data, settings, settingsError]);

  if (isLoading || isError || !data) {
    return (
      <section className="max-w-5xl mx-auto px-6 md:px-12 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(7rem*var(--spacing-page-top,1))] pb-16 md:pb-28 min-h-[60vh]">
        {isLoading ? (
          <ContentStatus state="loading" />
        ) : isError ? (
          <ContentStatus
            state="error"
            error={error}
            onRetry={() => void refetch()}
          />
        ) : (
          <p
            className="py-16 text-center font-ja text-xs tracking-[0.08em]"
            style={{ color: "var(--section-label-color)" }}
          >
            この写真は見つかりませんでした
          </p>
        )}
        <div className="text-center">
          <Link
            href="/gallery"
            className="inline-block mt-8 font-en text-xs tracking-[0.08em] text-[color:var(--text-quiet)] nav-link-luxury transition-colors duration-300"
          >
            GALLERY
          </Link>
        </div>
      </section>
    );
  }

  const { photo, series, prev, next } = data;
  const facts = captureFacts(photo);
  const film = (photo.filmType ?? "").trim();
  const editorialDescription = (photo.description ?? "").trim();
  const shelf = series?.kind === "work" ? "work" : "series";
  const aspectRatio = orientedAspectRatio(
    photo.width,
    photo.height,
    photo.rotationDeg,
  );

  return (
    <section
      ref={entranceRef}
      className="max-w-5xl mx-auto px-6 md:px-12 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(7rem*var(--spacing-page-top,1))] pb-16 md:pb-28 min-h-[60vh]"
    >
      <figure className="m-0 page-entrance">
        <Picture
          url={photo.url}
          thumbUrl={photo.thumbUrl}
          mediumUrl={photo.mediumUrl}
          width={photo.width}
          height={photo.height}
          rotationDeg={photo.rotationDeg}
          alt={alt}
          preset="lightbox"
          sizes="(max-width: 768px) 92vw, min(72vw, 900px)"
          fallbackW={1400}
          fallbackQ={86}
          loading="eager"
          fetchPriority="high"
          className="block w-full h-auto mx-auto"
          style={{
            maxHeight: "78vh",
            objectFit: "contain",
            ...(aspectRatio ? { aspectRatio } : {}),
          }}
        />

        {/* 事実だけ。書けることが事実しか無いので、飾らずに並べる。 */}
        <figcaption
          className="mt-8 md:mt-10 max-w-2xl mx-auto font-ja text-center break-words"
          style={{
            fontSize: "var(--section-label-size-eff, 0.8rem)",
            lineHeight: "1.9",
            color: `rgba(var(--foreground-rgb),0.72)`,
          }}
        >
          <h1
            className="font-ja"
            style={{
              fontSize: "inherit",
              fontWeight: "inherit",
              letterSpacing: "0.02em",
            }}
          >
            {alt}
          </h1>
          {editorialDescription && editorialDescription !== alt && (
            <p
              className="mt-5 text-left md:text-center"
              style={{
                fontSize: "var(--body-size, 0.875rem)",
                lineHeight: "var(--body-leading, 1.9)",
                letterSpacing: "var(--body-tracking, 0.01em)",
                color: "var(--text-quiet)",
              }}
            >
              {editorialDescription}
            </p>
          )}
          {(film || facts.length > 0) && (
            <p
              className="mt-3 font-en"
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.06em",
                color: "var(--section-label-color)",
              }}
            >
              {[film, ...facts].filter(Boolean).join("　/　")}
            </p>
          )}
          {series && (
            <p className="mt-3">
              <Link
                href={`/${shelf}/${series.slug}`}
                className="underline-offset-4 hover:underline"
              >
                {series.title}
              </Link>
            </p>
          )}
        </figcaption>
        <p className="mt-10 text-center">
          <Link
            href="/contact"
            className="inline-block font-ja nav-link-luxury transition-colors duration-300"
            style={{
              fontSize: "var(--body-size, 0.875rem)",
              color: "var(--text-quiet)",
              letterSpacing: "0.04em",
            }}
          >
            この雰囲気で撮影を相談する
          </Link>
        </p>
      </figure>

      {/* 前後の導線。検索非対象の写真も、人は静かに見続けられる。 */}
      <nav
        className="mt-16 md:mt-24 max-w-2xl mx-auto flex items-center justify-between gap-4 font-en"
        style={{
          fontSize: "0.72rem",
          letterSpacing: "0.1em",
          color: "var(--section-label-color)",
        }}
      >
        <span>
          {prev != null ? (
            <Link
              href={`/photo/${prev}`}
              className="hover:underline underline-offset-4"
            >
              ← PREV
            </Link>
          ) : null}
        </span>
        <Link href="/gallery" className="hover:underline underline-offset-4">
          GALLERY
        </Link>
        <span>
          {next != null ? (
            <Link
              href={`/photo/${next}`}
              className="hover:underline underline-offset-4"
            >
              NEXT →
            </Link>
          ) : null}
        </span>
      </nav>
    </section>
  );
}
