import { useState } from "react";
import { LibraryView } from "./LibraryView";
import { SeriesView } from "./SeriesView";
import { StudioProvider, useStudio, useStudioData } from "./studio-data";
import "./studio.css";

export type StudioView = "photos" | "series";

/**
 * 写真中心の管理画面（2026-09-26 作り直し）。「写真」と「シリーズ」の2つの画面が
 * 同じデータ・同じ通知・同じ取り込みを使う。
 */
export function Studio({
  view,
  onView,
  onOpenDetails,
  onUploadingChange,
}: {
  view: StudioView;
  onView: (view: StudioView) => void;
  /** 構図・日付の一括入力など、詳しい道具（従来の写真の一覧）を開く */
  onOpenDetails: (photoId: number) => void;
  onUploadingChange?: (busy: boolean) => void;
}) {
  return (
    <StudioProvider onUploadingChange={onUploadingChange}>
      <StudioScreens view={view} onView={onView} onOpenDetails={onOpenDetails} />
      <StudioToast />
    </StudioProvider>
  );
}

function StudioScreens({
  view,
  onView,
  onOpenDetails,
}: {
  view: StudioView;
  onView: (view: StudioView) => void;
  onOpenDetails: (photoId: number) => void;
}) {
  const data = useStudioData();
  const [seriesTarget, setSeriesTarget] = useState<number | null>(null);
  const [libraryRequest, setLibraryRequest] = useState<{ seriesId: number; n: number } | null>(null);
  const { upload } = useStudio();
  return (
    <div className="st-root">
      {upload && (
        <div className="st-progress" aria-live="polite">
          <span>
            取り込んでいます {upload.done} / {upload.total}
            {upload.target != null && data.seriesById.get(upload.target)
              ? `（「${data.seriesById.get(upload.target)!.title}」へ）`
              : ""}
          </span>
          <span className="st-progress__bar">
            <span style={{ width: `${(upload.done / Math.max(1, upload.total)) * 100}%` }} />
          </span>
          <span className="st-note">取り込みが終わるまで、このページを閉じないでください。</span>
        </div>
      )}
      {view === "photos" ? (
        <LibraryView
          data={data}
          request={libraryRequest}
          onRequestHandled={() => setLibraryRequest(null)}
          onOpenSeries={(id) => {
            setSeriesTarget(id);
            onView("series");
          }}
          onOpenDetails={onOpenDetails}
        />
      ) : (
        <SeriesView
          data={data}
          initialId={seriesTarget}
          onShowInLibrary={(id) => {
            setLibraryRequest((r) => ({ seriesId: id, n: (r?.n ?? 0) + 1 }));
            onView("photos");
          }}
        />
      )}
    </div>
  );
}

function StudioToast() {
  const { notice, dismiss, undo } = useStudio();
  if (!notice) return null;
  return (
    <div className="st-toast" aria-live="polite" data-tone={notice.tone}>
      <span>{notice.text}</span>
      {notice.undo && (
        <button type="button" className="st-ax-btn st-toast__undo" onClick={() => void undo(notice.undo)}>
          元に戻す
        </button>
      )}
      <button type="button" className="st-ax-btn st-toast__close" aria-label="閉じる" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
