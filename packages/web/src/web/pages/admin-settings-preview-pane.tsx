import { forwardRef } from "react";
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCw,
  Smartphone,
} from "lucide-react";

// Settings のプレビュー列。ツールバーと iframe だけを持ち、幅の管理と
// 「大きく表示」の状態は呼び出し側(admin-tabs の SettingsTab)が持つ。
// iframe をこのツリーから外さないことが前提 — 外すと読み込み済みの
// プレビューとスクロール位置が消える(仕様 §5-1)。

export type AdminSettingsPreviewCopy = {
  title: string;
  desktop: string;
  desktopTitle: string;
  mobile: string;
  mobileTitle: string;
  syncOn: string;
  syncOff: string;
  syncOnTitle: string;
  syncOffTitle: string;
  reload: string;
  expand: string;
  collapse: string;
  expandTitle: string;
  openInNewTab: string;
  openInNewTabTitle: string;
  resetWidth: string;
  resetWidthTitle: string;
  unsavedWhileExpanded: (count: number) => string;
};

export type AdminSettingsPreviewDevice = "desktop" | "mobile";

// スマホ枠は等倍で出す。横に潰すと「スマホ幅の確認」が成立しない(P3)。
export const SETTINGS_PREVIEW_MOBILE_FRAME_WIDTH = 375;
export const SETTINGS_PREVIEW_MOBILE_FRAME_HEIGHT = 667;

export const AdminSettingsPreviewPane = forwardRef<
  HTMLIFrameElement,
  {
    device: AdminSettingsPreviewDevice;
    onDeviceChange: (device: AdminSettingsPreviewDevice) => void;
    liveSync: boolean;
    onLiveSyncChange: (next: boolean) => void;
    src: string;
    publicHref: string;
    onIframeLoad: () => void;
    onReload: () => void;
    expanded: boolean;
    onToggleExpanded: () => void;
    expandButtonRef?: React.Ref<HTMLButtonElement>;
    // 幅を標準へ戻す明示操作(§3-3)。ダブルクリックだけに頼らせない。
    canResetWidth: boolean;
    onResetWidth: () => void;
    unsavedCount: number;
    dragging: boolean;
    copy: AdminSettingsPreviewCopy;
  }
>(function AdminSettingsPreviewPane(
  {
    device,
    onDeviceChange,
    liveSync,
    onLiveSyncChange,
    src,
    publicHref,
    onIframeLoad,
    onReload,
    expanded,
    onToggleExpanded,
    expandButtonRef,
    canResetWidth,
    onResetWidth,
    unsavedCount,
    dragging,
    copy,
  },
  iframeRef,
) {
  return (
    <section
      className="admin-settings-preview"
      aria-label={copy.title}
      data-settings-preview
    >
      {/* 上部操作は sticky。スクロールしても PC幅/スマホ幅へ戻れる(§3-5)。
          グループ単位で折り返す — 1列へ押し込まない(§4-1)。 */}
      <div className="admin-settings-preview__toolbar">
        <div className="admin-settings-preview__group admin-settings-preview__segment">
          <button
            type="button"
            aria-pressed={device === "desktop"}
            onClick={() => onDeviceChange("desktop")}
            title={copy.desktopTitle}
          >
            <Monitor size={13} aria-hidden="true" />
            {copy.desktop}
          </button>
          <button
            type="button"
            aria-pressed={device === "mobile"}
            onClick={() => onDeviceChange("mobile")}
            title={copy.mobileTitle}
          >
            <Smartphone size={13} aria-hidden="true" />
            {copy.mobile}
          </button>
        </div>

        {/* 同期の状態と、今の内容を取り直す操作。 */}
        <div className="admin-settings-preview__group">
          <button
            type="button"
            aria-pressed={liveSync}
            onClick={() => onLiveSyncChange(!liveSync)}
            title={liveSync ? copy.syncOnTitle : copy.syncOffTitle}
          >
            {liveSync ? copy.syncOn : copy.syncOff}
          </button>
          <button type="button" onClick={onReload}>
            <RotateCw size={13} aria-hidden="true" />
            {copy.reload}
          </button>
        </div>

        {/* どこで見るか。「大きく表示」は Admin Shell 内の Workspace 展開で、
            全画面 overlay を作らないので左ナビ・言語切替はそのまま残る(§5-1)。
            「別窓」は保存済みの公開サイトだけ。window.open は使わない(§6)。 */}
        <div className="admin-settings-preview__group">
          <button
            type="button"
            ref={expandButtonRef}
            className="admin-settings-preview__expand"
            aria-pressed={expanded}
            onClick={onToggleExpanded}
            title={copy.expandTitle}
          >
            {expanded ? (
              <Minimize2 size={13} aria-hidden="true" />
            ) : (
              <Maximize2 size={13} aria-hidden="true" />
            )}
            {expanded ? copy.collapse : copy.expand}
          </button>
          <a
            href={publicHref}
            target="_blank"
            rel="noopener"
            title={copy.openInNewTabTitle}
          >
            <ExternalLink size={13} aria-hidden="true" />
            {copy.openInNewTab}
          </a>
        </div>

        {/* 幅を標準へ戻す。幅を変えたときだけ出す。 */}
        {canResetWidth && (
          <div className="admin-settings-preview__group">
            <button
              type="button"
              className="admin-settings-preview__reset-width"
              onClick={onResetWidth}
              title={copy.resetWidthTitle}
            >
              {copy.resetWidth}
            </button>
          </div>
        )}
      </div>

      {/* 展開中は保存バーが見えないので、未保存の件数だけ文字で残す(§5-1)。 */}
      {expanded && unsavedCount > 0 && (
        <p className="admin-settings-preview__unsaved" aria-live="polite">
          {copy.unsavedWhileExpanded(unsavedCount)}
        </p>
      )}

      <div className="admin-settings-preview__stage">
        <div className="admin-settings-preview__frame" data-device={device}>
          <iframe
            ref={iframeRef}
            src={src}
            onLoad={onIframeLoad}
            title="Site Preview"
            // ドラッグ中に iframe がマウスイベントを飲むと掴んだ帯が外れる。
            style={dragging ? { pointerEvents: "none" } : undefined}
          />
        </div>
      </div>
    </section>
  );
});
