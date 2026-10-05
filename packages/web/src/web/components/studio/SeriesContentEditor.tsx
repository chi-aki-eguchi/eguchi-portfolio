import { useEffect, useRef, useState } from "react";
import { EMPTY_SERIES_CONTENT, MAX_CONTENT_BLOCKS, parseSeriesContent, parseSeriesContentDraft, type SeriesContent as Content, type ContentBlock } from "../../../shared/series-content";
import { SeriesContent } from "../SeriesContent";
import { adminText as tx } from "../../pages/admin-i18n";
import { patchSeries, useStudio, type StudioPhoto, type StudioSeries } from "./studio-data";
import "./series-content-editor.css";

type Draft = { base: string | null; content: Content };
const tabDrafts = new Map<string, Draft>();
function initialDraft(series: StudioSeries, key: string): Draft {
  const base = series.content ?? null;
  if (tabDrafts.has(key)) return tabDrafts.get(key)!;
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (stored && (stored.base === null || typeof stored.base === "string")) {
      parseSeriesContent(stored.base);
      const content = parseSeriesContentDraft(JSON.stringify(stored.content));
      if (content) return { base: stored.base, content };
    }
  } catch { /* Storage can be unavailable. */ }
  return { base, content: parseSeriesContent(base) ?? structuredClone(EMPTY_SERIES_CONTENT) };
}

export function SeriesContentEditor({ series, photos }: { series: StudioSeries; photos: StudioPhoto[] }) {
  const { refresh, remember, demoSeed } = useStudio();
  const key = `intro-draft:${demoSeed || "admin"}:${series.id}`;
  // Unknown future versions must not be silently overwritten by this editor.
  let readable = true;
  try { parseSeriesContent(series.content); } catch { readable = false; }
  return readable ? <Editor key={key} series={series} photos={photos} storageKey={key} refresh={refresh} remember={remember} />
    : <p role="alert" className="st-note">{tx("この紹介ページの形式には未対応です。内容は保持されています。", "This introduction format is not supported. Its content has been preserved.")}</p>;
}
function Editor({ series, photos, storageKey, refresh, remember }: {
  series: StudioSeries; photos: StudioPhoto[]; storageKey: string;
  refresh: ReturnType<typeof useStudio>["refresh"]; remember: ReturnType<typeof useStudio>["remember"];
}) {
  const [draft, setDraft] = useState(() => initialDraft(series, storageKey));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [removed, setRemoved] = useState<{ block: ContentBlock; at: number } | null>(null);
  const content = draft.content;
  const serialized = JSON.stringify(content);
  const baseValue = JSON.stringify(parseSeriesContent(draft.base) ?? EMPTY_SERIES_CONTENT);
  const dirty = serialized !== baseValue;
  const conflict = (series.content ?? null) !== draft.base;
  useEffect(() => {
    if (!dirty && !saving && conflict) setDraft({ base: series.content ?? null, content: parseSeriesContent(series.content) ?? structuredClone(EMPTY_SERIES_CONTENT) });
  }, [dirty, saving, conflict, series.content]);
  useEffect(() => {
    if (dirty) tabDrafts.set(storageKey, draft);
    else tabDrafts.delete(storageKey);
    try {
      if (dirty) sessionStorage.setItem(storageKey, JSON.stringify(draft));
      else sessionStorage.removeItem(storageKey);
    } catch { /* Browser close warning below still protects an active draft. */ }
  }, [draft, dirty, storageKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = (next: Content) => {
    setDraft(d => ({ ...d, content: next })); setError(""); setStatus("");
  };
  const update = (id: string, block: ContentBlock) => change({ ...content, blocks: content.blocks.map(b => b.id === id ? block : b) });
  const add = (type: ContentBlock["type"]) => {
    const id = crypto.randomUUID();
    const block: ContentBlock = type === "text" ? { id, type, heading: "", text: "" }
      : type === "image" ? { id, type, photoId: photos[0]?.id ?? null, caption: "" }
      : type === "link" ? { id, type, label: "", url: "", description: "" }
      : { id, type, items: [{ label: tx("担当", "Role"), value: "" }, { label: tx("制作年", "Year"), value: "" }] };
    change({ ...content, blocks: [...content.blocks, block] });
  };
  const move = (at: number, delta: number) => {
    const blocks = [...content.blocks];
    const [item] = blocks.splice(at, 1); blocks.splice(at + delta, 0, item!);
    change({ ...content, blocks });
  };
  const save = async () => {
    if (savingRef.current) return;
    setError("");
    let value: string;
    try { value = JSON.stringify(parseSeriesContent(serialized)); }
    catch (e) { setError(e instanceof Error ? e.message : tx("入力を確認してください。", "Check the input.")); return; }
    savingRef.current = true; setSaving(true);
    const before = draft.base;
    try {
      await patchSeries(series.id, { content: value, expectedContent: before });
      setDraft({ base: value, content: JSON.parse(value) });
      tabDrafts.delete(storageKey);
      try { sessionStorage.removeItem(storageKey); } catch { /* optional storage */ }
      await refresh();
      remember({ label: tx("紹介ページ", "Introduction"), run: () => patchSeries(series.id, { content: before, expectedContent: value }) }, tx("紹介ページを保存しました", "Introduction saved"));
      setStatus(tx("保存しました", "Saved"));
    } catch {
      setError(tx("保存できませんでした。下書きは残っています。接続を確認し、別の画面で編集した場合は最新の内容を読み直してください。", "Could not save. Your draft is kept. Check the connection or reload the latest content if it was edited elsewhere."));
    } finally { savingRef.current = false; setSaving(false); }
  };
  const names = { text: tx("文章", "Text"), image: tx("画像", "Image"), link: tx("外部リンク", "Link"), facts: tx("制作情報", "Details") };
  return <section className="intro-editor" aria-label={tx("紹介ページの編集", "Introduction editor")}>
    <div className="intro-editor__heading"><h2>{tx("ページの見せ方", "Page presentation")}</h2><p className="st-note">{tx("紹介ページでは、下の部品を上から順に表示します。切り替えても内容と写真は残ります。", "Introduction blocks appear in order. Switching layouts keeps your content and photos.")}</p></div>
    <fieldset className="intro-editor__controls" disabled={saving}>
      <fieldset className="st-seg" aria-label={tx("ページの見せ方", "Page presentation")}>
        <button type="button" className="st-ax-btn st-seg__item" aria-pressed={!content.enabled} onClick={() => change({ ...content, enabled: false })}>{tx("写真を並べる", "Photo gallery")}</button>
        <button type="button" className="st-ax-btn st-seg__item" aria-pressed={content.enabled} onClick={() => change({ ...content, enabled: true })}>{tx("紹介ページ", "Introduction")}</button>
      </fieldset>
      {content.enabled && <>
        <div className="intro-editor__blocks">
          {content.blocks.map((block, at) => <section className="intro-editor__block" key={block.id} aria-label={`${at + 1}. ${names[block.type]}`}>
            <header><h3>{at + 1}. {names[block.type]}</h3><div className="intro-editor__actions">
              <button type="button" className="st-button" aria-label={tx(`${at + 1}番目を上へ`, `Move block ${at + 1} up`)} disabled={at === 0} onClick={() => move(at, -1)}>↑</button>
              <button type="button" className="st-button" aria-label={tx(`${at + 1}番目を下へ`, `Move block ${at + 1} down`)} disabled={at === content.blocks.length - 1} onClick={() => move(at, 1)}>↓</button>
              <button type="button" className="st-button" aria-label={tx(`${at + 1}番目を取り除く`, `Remove block ${at + 1}`)} onClick={() => { setRemoved({ block, at }); change({ ...content, blocks: content.blocks.filter(b => b.id !== block.id) }); }}>{tx("取り除く", "Remove")}</button>
            </div></header>
            {block.type === "text" && <>
              <label className="st-field">{tx("見出し", "Heading")}<input className="st-input" maxLength={200} value={block.heading} onChange={e => update(block.id, { ...block, heading: e.target.value })} /></label>
              <label className="st-field">{tx("本文", "Body")}<textarea className="st-input" rows={6} maxLength={20000} value={block.text} onChange={e => update(block.id, { ...block, text: e.target.value })} /></label>
            </>}
            {block.type === "image" && <>
              <label className="st-field">{tx("使う画像", "Image to use")}<select className="st-input" value={block.photoId ?? ""} onChange={e => update(block.id, { ...block, photoId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">{tx("画像を選ぶ", "Choose an image")}</option>
                {block.photoId && !photos.some(p => p.id === block.photoId) && <option value={block.photoId}>{tx("現在このシリーズにない写真", "Photo no longer in this series")}</option>}
                {photos.map(p => <option key={p.id} value={p.id}>{p.title || p.filename}{p.isPublished === false ? tx("（非公開）", " (hidden)") : ""}</option>)}
              </select></label>
              <p className="st-note">{tx("下の写真一覧に加えた画像から選べます。非公開・削除済み・シリーズから外した写真は公開ページに出ません。", "Choose from the photos below. Hidden, deleted or detached photos are not shown on the public page.")}</p>
              <label className="st-field">{tx("画像の説明", "Caption")}<textarea className="st-input" rows={2} maxLength={1000} value={block.caption} onChange={e => update(block.id, { ...block, caption: e.target.value })} /></label>
            </>}
            {block.type === "link" && <>
              <label className="st-field">{tx("リンクの名前", "Link label")}<input className="st-input" maxLength={200} value={block.label} onChange={e => update(block.id, { ...block, label: e.target.value })} /></label>
              <label className="st-field">URL<input className="st-input" type="url" maxLength={2000} placeholder="https://" value={block.url} onChange={e => update(block.id, { ...block, url: e.target.value })} /></label>
              <label className="st-field">{tx("リンクの説明", "Link description")}<textarea className="st-input" rows={2} maxLength={2000} value={block.description} onChange={e => update(block.id, { ...block, description: e.target.value })} /></label>
            </>}
            {block.type === "facts" && <>
              {block.items.map((item, i) => <div className="intro-editor__fact" key={i}>
                <label className="st-field">{tx(`項目名 ${i + 1}`, `Label ${i + 1}`)}<input className="st-input" maxLength={80} value={item.label} onChange={e => update(block.id, { ...block, items: block.items.map((v, j) => j === i ? { ...v, label: e.target.value } : v) })} /></label>
                <label className="st-field">{tx(`内容 ${i + 1}`, `Value ${i + 1}`)}<input className="st-input" maxLength={1000} value={item.value} onChange={e => update(block.id, { ...block, items: block.items.map((v, j) => j === i ? { ...v, value: e.target.value } : v) })} /></label>
                <button type="button" className="st-button" aria-label={tx(`項目 ${i + 1} を取り除く`, `Remove detail ${i + 1}`)} onClick={() => update(block.id, { ...block, items: block.items.filter((_, j) => j !== i) })}>×</button>
              </div>)}
              <button type="button" className="st-button" disabled={block.items.length >= 12} onClick={() => update(block.id, { ...block, items: [...block.items, { label: "", value: "" }] })}>{tx("＋ 項目を加える", "+ Add detail")}</button>
            </>}
          </section>)}
          {content.blocks.length === 0 && <p className="st-note">{tx("文章だけでも作れます。下から最初の部品を選んでください。", "Text alone is enough. Choose your first block below.")}</p>}
        </div>
        <div className="intro-editor__add">{(Object.keys(names) as ContentBlock["type"][]).map(type => <button type="button" className="st-button" key={type} disabled={content.blocks.length >= MAX_CONTENT_BLOCKS} onClick={() => add(type)}>＋ {names[type]}</button>)}</div>
        {removed && <button type="button" className="st-link" disabled={content.blocks.length >= MAX_CONTENT_BLOCKS} onClick={() => { const blocks = [...content.blocks]; blocks.splice(removed.at, 0, removed.block); change({ ...content, blocks }); setRemoved(null); }}>{tx("取り除いた部品を戻す", "Restore removed block")}</button>}
      </>}
    </fieldset>
    {(dirty || saving || status || error) && <div className="intro-editor__save">
      <button type="button" className="st-button st-button--primary" onClick={() => void save()} disabled={!dirty || saving || conflict}>{saving ? tx("保存しています…", "Saving…") : tx("紹介ページを保存", "Save introduction")}</button>
      <output className="st-note">{dirty ? tx("未保存の下書き — このタブに保持しています", "Unsaved draft — kept in this tab") : status}</output>
    </div>}
    {conflict && dirty && <div role="alert"><p>{tx("保存済みの内容が別の操作で変わりました。下書きをコピーしてから、最新の内容を読み直してください。", "The saved content changed elsewhere. Copy your draft before reloading the latest content.")}</p><button type="button" className="st-button" onClick={() => { if (window.confirm(tx("下書きを破棄して最新の紹介文を読み込みますか？", "Discard this draft and load the latest introduction?"))) { setDraft({ base: series.content ?? null, content: parseSeriesContent(series.content) ?? structuredClone(EMPTY_SERIES_CONTENT) }); setError(""); } }}>{tx("最新の内容を読み込む", "Load latest")}</button></div>}
    {error && <p className="intro-editor__error" role="alert">{error}</p>}
    {content.enabled && <details className="intro-editor__preview"><summary>{tx("紹介本文のプレビュー", "Preview introduction")}</summary><SeriesContent content={content} photos={photos.filter(p => p.isPublished !== false && !p.deletedAt)} /></details>}
  </section>;
}
