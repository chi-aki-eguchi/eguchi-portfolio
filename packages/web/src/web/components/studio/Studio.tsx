import { useState } from "react";
import { LibraryView } from "./LibraryView";
import { SeriesView } from "./SeriesView";
import { StudioProvider, useStudio, useStudioData } from "./studio-data";
import "./studio.css";
import { adminText as tx, useAdminI18n } from "../../pages/admin-i18n";
import { JaPhrases } from "../JaPhrases";

export type StudioView = "photos" | "series";

/**
 * 写真中心の管理画面（2026-09-26 作り直し）。「写真」と「シリーズ」の2つの画面が
 * 同じデータ・同じ通知・同じ取り込みを使う。
 */
export function Studio({
  demoSeed,
  view,
  onView,
  onOpenDetails,
  onOpenSeriesDetails,
  onUploadingChange,
}: {
  demoSeed?: string;
  view: StudioView;
  onView: (view: StudioView) => void;
  /** 構図・日付の一括入力など、詳しい道具（従来の写真の一覧）を開く */
  onOpenDetails: (photoId: number) => void;
  /** シリーズごとの配色・並び順の上書きなど、詳しい設定を開く */
  onOpenSeriesDetails?: () => void;
  onUploadingChange?: (busy: boolean) => void;
}) {
  return (
    <StudioProvider demoSeed={demoSeed} onUploadingChange={onUploadingChange}>
      <StudioScreens view={view} onView={onView} onOpenDetails={onOpenDetails} onOpenSeriesDetails={onOpenSeriesDetails} />
      <StudioToast />
    </StudioProvider>
  );
}

function StudioScreens({
  view,
  onView,
  onOpenDetails,
  onOpenSeriesDetails,
}: {
  view: StudioView;
  onView: (view: StudioView) => void;
  onOpenDetails: (photoId: number) => void;
  onOpenSeriesDetails?: () => void;
}) {
  const data = useStudioData();
  const [seriesTarget, setSeriesTarget] = useState<number | null>(null);
  const [libraryRequest, setLibraryRequest] = useState<{ seriesId: number; n: number } | null>(null);
  const { upload } = useStudio();
  useAdminI18n(); // 言語を変えたら描き直す（写真・シリーズの言葉は adminText）
  return (
    <div className="st-root">
      {upload && (
        <div className="st-progress" aria-live="polite">
          <span>
            {tx("取り込んでいます", "Importing")} {upload.done} / {upload.total}
            {upload.target != null && data.seriesById.get(upload.target)
              ? tx(`（「${data.seriesById.get(upload.target)!.title}」へ）`, ` (into “${data.seriesById.get(upload.target)!.title}”)`)
              : ""}
          </span>
          <span className="st-progress__bar">
            <span style={{ width: `${(upload.done / Math.max(1, upload.total)) * 100}%` }} />
          </span>
          <span className="st-note">{tx("取り込みが終わるまで、このページを閉じないでください。", "Please keep this page open until the import finishes.")}</span>
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
          onOpenDetails={onOpenSeriesDetails}
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
      {/* 文節の切れ目で折る。「（サイトに出ませ／ん）」のように語の途中で割らない。 */}
      <span className="st-toast__text"><JaPhrases>{notice.text}</JaPhrases></span>
      {notice.undo && (
        <button type="button" className="st-ax-btn st-toast__undo" onClick={() => void undo(notice.undo)}>
          {tx("元に戻す", "Undo")}
        </button>
      )}
      <button type="button" className="st-ax-btn st-toast__close" aria-label={tx("閉じる", "Close")} onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
