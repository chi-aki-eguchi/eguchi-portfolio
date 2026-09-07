import { useMemo, useRef, useState } from "react";
import { Check, Eye, Search, SlidersHorizontal, X } from "lucide-react";
import { useAdminI18n } from "./admin-i18n";
import { adminPhotoSrc, type Photo } from "./admin-shared";
import { LibraryPhotoPreview } from "../components/LibraryPhotoPreview";
import { heroCandidates, type HeroCandidateSort } from "../lib/hero-candidates";
import "./admin-hero-picker.css";

export function AdminHeroPicker({ photos, selectedIds, busy, onToggle }: {
  photos: Photo[]; selectedIds: ReadonlySet<number>; busy: boolean; onToggle: (photo: Photo) => void;
}) {
  const { t } = useAdminI18n();
  const copy = t.phase2b.hero;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<HeroCandidateSort>("newest");
  const [category, setCategory] = useState("");
  const [orientation, setOrientation] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [density, setDensity] = useState("standard");
  const [preview, setPreview] = useState<Photo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const candidates = useMemo(() => heroCandidates(photos, selectedIds, { search, sort, category, orientation, selectedOnly }), [photos, selectedIds, search, sort, category, orientation, selectedOnly]);
  const categories = useMemo(() => [...new Set(photos.map(photo => photo.category).filter(Boolean))].sort(), [photos]);
  const resetScroll = () => { if (scrollRef.current) scrollRef.current.scrollTop = 0; };
  const hasFilters = !!(search || category || orientation || selectedOnly);
  return <section className="hero-picker" aria-label={copy.galleryTitle}>
    <div className="hero-picker-toolbar">
      <label className="hero-picker-search"><Search size={15} /><input type="search" aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => { setSearch(event.target.value); resetScroll(); }} />{search && <button type="button" aria-label={t.phase2b.library.filters.clearSearch} onClick={() => setSearch("")}><X size={14} /></button>}</label>
      <label className="hero-picker-sort"><span>{copy.sortLabel}</span><select aria-label={copy.sortLabel} value={sort} onChange={event => { setSort(event.target.value as HeroCandidateSort); resetScroll(); }}>{(["newest", "oldest", "shot", "name", "manual"] as const).map(key => <option key={key} value={key}>{copy.sortOptions[key]}</option>)}</select></label>
      <button type="button" className="hero-picker-filter-toggle" aria-expanded={filtersOpen} aria-controls="hero-candidate-filters" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={14} />{copy.filters}{category || orientation ? " •" : ""}</button>
    </div>
    {filtersOpen && <div className="hero-picker-filters" id="hero-candidate-filters">
      <label>{copy.category}<select value={category} onChange={event => { setCategory(event.target.value); resetScroll(); }}><option value="">{copy.all}</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>{copy.orientation}<select value={orientation} onChange={event => { setOrientation(event.target.value); resetScroll(); }}><option value="">{copy.all}</option>{(["landscape", "portrait", "square"] as const).map(value => <option key={value} value={value}>{copy.orientations[value]}</option>)}</select></label>
      <button type="button" onClick={() => setFiltersOpen(false)}>{t.common.close}<X size={14} /></button>
    </div>}
    <div className="hero-picker-summary">
      <output>{copy.results(candidates.length)}</output>
      <button type="button" aria-pressed={selectedOnly} onClick={() => { setSelectedOnly(value => !value); resetScroll(); }}>{copy.selectedOnly}</button>
      {hasFilters && <button type="button" onClick={() => { setSearch(""); setCategory(""); setOrientation(""); setSelectedOnly(false); resetScroll(); }}>{copy.reset}</button>}
      <label className="hero-picker-density"><span>{copy.density}</span><select aria-label={copy.density} value={density} onChange={event => setDensity(event.target.value)}>{(["compact", "standard", "large"] as const).map(key => <option key={key} value={key}>{copy.densities[key]}</option>)}</select></label>
    </div>
    <div ref={scrollRef} className="hero-picker-scroll">
      {candidates.length ? <div className="hero-picker-grid" data-density={density}>{candidates.map(photo => {
        const selected = selectedIds.has(photo.id);
        const name = photo.title || photo.filename || t.phase2b.library.inspector.photoFallback;
        return <article key={photo.id} className="hero-candidate" data-selected={selected}>
          <button type="button" data-hero-candidate={photo.id} aria-label={copy.toggleAria(name, selected)} aria-pressed={selected} disabled={busy} onClick={() => onToggle(photo)}>
            <img src={adminPhotoSrc(photo, 320, 75)} alt="" loading="lazy" />
            <span className="hero-candidate-check" aria-hidden="true">{selected ? <Check size={13} /> : "+"}</span>
          </button>
          <footer><span title={name}>{name}</span><button type="button" aria-label={copy.preview(name)} onClick={event => { event.currentTarget.focus(); setPreview(photo); }}><Eye size={14} /></button></footer>
        </article>;
      })}</div> : <div className="hero-picker-empty"><p>{photos.length ? copy.noMatches : copy.noPhotosYet}</p>{hasFilters && <button type="button" onClick={() => { setSearch(""); setCategory(""); setOrientation(""); setSelectedOnly(false); }}>{copy.reset}</button>}</div>}
    </div>
    <p className="hero-picker-footnote">{copy.galleryHint}</p>
    {preview && <LibraryPhotoPreview src={adminPhotoSrc(preview, 1600, 85)} title={preview.title || preview.filename} closeLabel={t.common.close} previousLabel={t.phase2b.library.inspector.previous} nextLabel={t.phase2b.library.inspector.next} onClose={() => setPreview(null)} />}
  </section>;
}
