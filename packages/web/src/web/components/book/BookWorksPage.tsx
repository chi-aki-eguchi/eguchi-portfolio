import { Link } from "wouter";
import { ContentStatus } from "../ContentStatus";
import { useBookChapters, useBookGalleryEntry } from "./useBookChapters";
import { useBookDevelop } from "./BookParts";
import { WorksGrid, WorksList, WorksViewSwitch, useWorksView } from "./BookWorks";

/**
 * Works（写真集の骨格の `/series`・`/work`、2026-09-25 見直し）。
 *
 * それまでの「目次（全作品のベタ焼き）」は、何のページか分かりにくかった
 * （2026-09-25 オーナー）。作品は大きな表紙で並べ（Grid）、作品名で読む
 * 一覧（List）に切り替えられる。ベタ焼きは各作品の中の「Index」に移した。
 * Series と Work の棚はここで1つの並びにする（Series が先）。
 */
export function BookWorksPage({ shelf }: { shelf: "series" | "work" }) {
  const { chapters, isLoading, isError, refetch, settings } = useBookChapters();
  const view = useWorksView();
  const photographerName = settings?.siteName || settings?.siteNameEn || "";
  const gallery = useBookGalleryEntry(settings);
  useBookDevelop([chapters.length, view]);

  return (
    <div className="book bk-page" data-book-view="works">
      <header className="bk-head">
        <h1 className="bk-head__title font-en">Works</h1>
        <WorksViewSwitch base={`/${shelf}`} view={view} />
      </header>

      {isLoading && chapters.length === 0 && <ContentStatus state="loading" />}
      {isError && chapters.length === 0 && <ContentStatus state="error" onRetry={refetch} />}

      {view === "grid" ? (
        <WorksGrid chapters={chapters} photographerName={photographerName} />
      ) : (
        <WorksList chapters={chapters} />
      )}

      {gallery && chapters.length > 0 && (
        <p className="bk-more font-ja">
          <Link to={gallery.href} className="bk-more__link">
            {gallery.label}
            {gallery.count != null && <span className="font-en">（{gallery.count}）</span>}
            <span aria-hidden="true"> →</span>
          </Link>
        </p>
      )}
    </div>
  );
}
