import { normalizeShelfKind, type ShelfKind } from "../../shared/shelf";

/**
 * 設定プレビューで確認できる公開ページの定義。
 *
 * プレビューは公開サイトそのものを iframe で開き、未保存の「設定」だけを
 * 送り込む。作品・写真のデータは公開APIから読むので、**非公開の作品は
 * プレビューにも出ない。** その作品は選べないようにして、理由を出す。
 * 公開ページの見え方を変えるために、非公開データを公開APIへ出すことはしない。
 */

export const PREVIEW_STATIC_PATHS = [
  "/",
  "/gallery",
  "/series",
  "/work",
  "/about",
  "/contact",
] as const;

export type PreviewWork = {
  id: number;
  slug: string;
  title: string;
  kind: ShelfKind;
  isPublished: boolean;
};

/** 作品の詳細ページ。slug はURLの1区切りとして符号化する。 */
export function previewWorkPath(work: Pick<PreviewWork, "kind" | "slug">): string {
  return `/${work.kind}/${encodeURIComponent(work.slug)}`;
}

/** 固定のページか、正しく符号化された作品の詳細ページか。 */
export function isPreviewablePath(path: string): boolean {
  if ((PREVIEW_STATIC_PATHS as readonly string[]).includes(path)) return true;
  const segment = path.match(/^\/(?:series|work)\/([^/?#]+)$/)?.[1];
  if (!segment) return false;
  try {
    return encodeURIComponent(decodeURIComponent(segment)) === segment;
  } catch {
    return false;
  }
}

/** 管理用のシリーズ一覧（`/api/admin/series`）を、選択肢に使う形へ。 */
export function previewWorksFrom(rows: unknown): PreviewWork[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    if (typeof r.slug !== "string" || !r.slug) return [];
    return [
      {
        id: Number(r.id),
        slug: r.slug,
        title: typeof r.title === "string" && r.title.trim() ? r.title : r.slug,
        kind: normalizeShelfKind(r.kind),
        isPublished: r.isPublished !== false,
      },
    ];
  });
}

export type PreviewPageNotice =
  | { reason: "unpublished"; title: string }
  | { reason: "missing" }
  | { reason: "work-shelf-empty" };

/**
 * 選んでいるページが、いま公開サイトで見られないときの理由。見られるときと、
 * 作品の一覧がまだ無い（読み込み中・失敗）ときは null。一覧が無いうちは
 * 作品ページの可否を決めつけない。
 */
export function previewPageNotice(
  path: string,
  works: PreviewWork[] | undefined,
): PreviewPageNotice | null {
  if (!works) return null;
  if (path === "/work") {
    // 公開中の Work が1つも無いと、サーバーは /work を /series へ移す。
    return works.some((w) => w.kind === "work" && w.isPublished)
      ? null
      : { reason: "work-shelf-empty" };
  }
  if (!/^\/(series|work)\/[^/?#]+$/.test(path)) return null;
  const work = works.find((w) => previewWorkPath(w) === path);
  if (!work) return { reason: "missing" };
  if (!work.isPublished) return { reason: "unpublished", title: work.title };
  return null;
}
