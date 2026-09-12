import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, RotateCw } from "lucide-react";
import { boundedPreviewDimension, fitPreviewViewport, PREVIEW_DESKTOP, PREVIEW_MOBILE, type PreviewViewport } from "../lib/admin-preview-viewport";

export type AdminSettingsPreviewCopy = {
  title: string; desktop: string; desktopTitle: string; mobile: string; mobileTitle: string;
  syncOn: string; syncOff: string; syncOnTitle: string; syncOffTitle: string;
  reload: string; expand: string; collapse: string; expandTitle: string;
  openInNewTab: string; openInNewTabTitle: string; resetWidth: string; resetWidthTitle: string;
  unsavedWhileExpanded: (count: number) => string;
};
export type AdminSettingsPreviewDevice = "desktop" | "mobile";
export const SETTINGS_PREVIEW_MOBILE_FRAME_WIDTH = PREVIEW_MOBILE.width;
export const SETTINGS_PREVIEW_MOBILE_FRAME_HEIGHT = PREVIEW_MOBILE.height;

function DimensionInput({label, value, onCommit}: {label: string; value: number; onCommit: (value: number) => void}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <input type="number" min={280} max={3840} aria-label={label} value={draft}
    onChange={event => setDraft(event.target.value)}
    onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
    onBlur={() => { const next = boundedPreviewDimension(draft.trim() ? Number(draft) : NaN, value); setDraft(String(next)); onCommit(next); }} />;
}

export const AdminSettingsPreviewPane = forwardRef<HTMLIFrameElement, {
  device: AdminSettingsPreviewDevice; onDeviceChange: (device: AdminSettingsPreviewDevice) => void;
  liveSync: boolean; onLiveSyncChange: (next: boolean) => void;
  src: string; publicHref: string; onIframeLoad: () => void; onReload: () => void;
  expanded: boolean; onToggleExpanded: () => void; expandButtonRef?: React.Ref<HTMLButtonElement>;
  unsavedCount: number; onViewportChange?: (viewport: PreviewViewport) => void;
  onSave: () => void; onEdit: () => void; pending: boolean; saveLabel: string; editLabel: string;
  saveError?: string; copy: AdminSettingsPreviewCopy; language?: string;
  page?: string; onPageChange?: (page: string) => void;
}>(function AdminSettingsPreviewPane(props, iframeRef) {
  const { device, onDeviceChange, liveSync, onLiveSyncChange, src, publicHref, onIframeLoad,
    onReload, expanded, onToggleExpanded, expandButtonRef, unsavedCount, onViewportChange,
    onSave, onEdit, pending, saveLabel, editLabel, saveError, copy, page = "/", onPageChange,
  } = props;
  const ja = props.language !== "en";
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState(device === "mobile" ? PREVIEW_MOBILE : PREVIEW_DESKTOP);
  useEffect(() => { onViewportChange?.(viewport); }, [viewport, onViewportChange]);
  useEffect(() => { setViewport(device === "mobile" ? PREVIEW_MOBILE : PREVIEW_DESKTOP); }, [device]);
  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width), height = Math.floor(entry.contentRect.height);
      if (width <= 0 || height <= 0) return;
      setStage(current => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const fit = fitPreviewViewport(viewport, stage);
  const dimensions = `${viewport.width} × ${viewport.height}`;
  return <section className="admin-settings-preview studio-preview" aria-label={copy.title} data-settings-preview>
    <div className="studio-preview-toolbar">
      {onPageChange && <select aria-label={ja ? "確認するページ" : "Preview page"} value={page} onChange={e => onPageChange(e.target.value)}>
        <option value="/">{ja ? "トップページ" : "Home"}</option>
        <option value="/gallery">Gallery</option><option value="/series">Series</option>
        <option value="/about">{ja ? "プロフィール" : "About"}</option>
        <option value="/contact">{ja ? "お問い合わせ" : "Contact"}</option>
      </select>}
      <fieldset className="studio-preview-devices" aria-label={ja ? "画面サイズ" : "Screen size"}>
        <button type="button" aria-pressed={device === "desktop"} onClick={() => { onDeviceChange("desktop"); setViewport(PREVIEW_DESKTOP); }}>{copy.desktop}</button>
        <button type="button" aria-pressed={device === "mobile"} onClick={() => { onDeviceChange("mobile"); setViewport(PREVIEW_MOBILE); }}>{copy.mobile}</button>
      </fieldset>
      <details className="studio-preview-dimensions">
        <summary title={ja ? "幅と高さを指定" : "Set width and height"}>{dimensions}<span>px</span></summary>
        <div>
          <label>{ja ? "幅" : "Width"}<DimensionInput label={ja ? "プレビューの幅" : "Preview width"} value={viewport.width} onCommit={width => setViewport(v => ({...v, width}))} /></label>
          <label>{ja ? "高さ" : "Height"}<DimensionInput label={ja ? "プレビューの高さ" : "Preview height"} value={viewport.height} onCommit={height => setViewport(v => ({...v, height}))} /></label>
          <button type="button" onClick={() => setViewport({ width: window.innerWidth, height: window.innerHeight })}>{ja ? "このウィンドウと同じ" : "Match this window"}</button>
        </div>
      </details>
      <button type="button" ref={expandButtonRef} aria-label={expanded ? copy.collapse : copy.expand} aria-pressed={expanded} onClick={onToggleExpanded}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
    </div>
    <div ref={stageRef} className="studio-preview-stage">
      <div className="studio-preview-frame" data-device={device} style={{ width: fit.width, height: fit.height }}>
        <iframe ref={iframeRef} src={src} onLoad={onIframeLoad} title="Site Preview" style={{ width: viewport.width, height: viewport.height, transform: `scale(${fit.scale})`, transformOrigin: "top left" }} />
      </div>
    </div>
    <footer className="studio-preview-status">
      <select aria-label={ja ? "プレビューの内容" : "Preview content"} value={liveSync ? "draft" : "saved"} onChange={e => onLiveSyncChange(e.target.value === "draft")}>
        <option value="draft">{ja ? "編集中の内容" : "Current draft"}</option><option value="saved">{ja ? "保存済みの内容" : "Saved site"}</option>
      </select>
      <span>{Math.round(fit.scale * 100)}%</span>
      <button type="button" aria-label={copy.reload} title={copy.reload} onClick={onReload}><RotateCw size={14} /></button>
      <a href={publicHref} target="_blank" rel="noopener" title={copy.openInNewTabTitle}>{ja ? "公開サイト" : "Published site"}<ExternalLink size={13} /></a>
    </footer>
    {(expanded || saveError || unsavedCount > 0) && <div className="admin-preview-save-dock" data-expanded={expanded} data-error={!!saveError}>
      <button type="button" onClick={onEdit}>{editLabel}</button>
      <span role={saveError ? "alert" : "status"}>{saveError || (unsavedCount ? copy.unsavedWhileExpanded(unsavedCount) : (ja ? "保存済み" : "Saved"))}</span>
      {unsavedCount > 0 && <button type="button" className="admin-btn-primary" onClick={onSave} disabled={pending}>{saveLabel}</button>}
    </div>}
  </section>;
});
