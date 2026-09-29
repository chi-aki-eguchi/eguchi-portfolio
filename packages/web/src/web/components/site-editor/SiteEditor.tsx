import { useState, type ReactNode } from "react";
import {
  AlignLeft, ArrowUpDown, AtSign, Baseline, Bookmark, BookOpen, Briefcase, Columns2, GalleryHorizontal,
  Globe, Heading, Image, Images, JapaneseYen, LayoutGrid, LayoutTemplate, Layers, ListChecks, Mail,
  Maximize2, Menu, MessageSquare, MoveVertical, Package, Palette, PanelBottom, Printer, Quote,
  SlidersHorizontal, Sparkles, SquareUser, Tags, TextQuote, Type, WandSparkles, type LucideIcon,
} from "lucide-react";
import {
  SETTINGS_NAVIGATION,
  SITE_LOOK_PARTS,
  SITE_MORE_PARTS,
  SITE_PAGES,
  SITE_PARTS,
  partIsListed,
  settingsNavigationItems,
  type SitePageId,
  type SitePart,
  type SitePartId,
  type SiteSkeleton,
} from "../../pages/admin-settings-navigation";
import "./site-editor.css";

/**
 * 管理画面「サイト」（2026-09-29 作り直し）。公開サイトを大きく出し、変えたい所を
 * 押して直す。オーナー「目次が長くてわかりづらい・ださい」を受けて、32項目の目次を
 * やめた。右の欄には、見ているページにある部分だけを並べる。
 *
 *   上の帯    トップ / Gallery / Series / About / Contact ｜ 全体の見た目 ｜ そのほか
 *   真ん中    公開サイトのプレビュー（部分に乗ると枠と「〜を変える」、押すと右に設定）
 *   右の欄    このページで変えられるところ → 押すとその設定だけ
 */

export type SiteEditorMode = "page" | "look" | "more";

/** 開いている部分。部分の id か、設定の節を直接開く `section:<節の id>`（探す・案内から）。 */
export type SiteEditorTarget = SitePartId | `section:${string}` | null;

export type SiteEditorLanguage = "ja" | "en";

const SECTION_LABELS = new Map<string, { ja: string; en: string }>(
  SETTINGS_NAVIGATION.flatMap((group) => group.items.map((item) => [item.id, { ja: item.ja, en: item.en }] as const)),
);

export function sectionLabel(sectionId: string, language: SiteEditorLanguage): string {
  const label = SECTION_LABELS.get(sectionId);
  return label ? label[language] : sectionId;
}

export function partLabel(part: SitePart, language: SiteEditorLanguage): string {
  return language === "ja" ? part.ja : part.en;
}

/** 一覧で目印にする形。文字だけの一覧は拾い読みしにくい（2026-09-29）。 */
const PART_ICONS: Record<SitePartId, LucideIcon> = {
  name: Type, menu: Menu, footer: PanelBottom, "top-photos": Image, statement: Quote, works: LayoutGrid,
  "series-strip": GalleryHorizontal, cta: Mail, "page-title": Heading, "gallery-photos": LayoutGrid,
  order: ArrowUpDown, viewer: Maximize2, "series-cards": Layers, "series-layout": LayoutGrid, about: SquareUser, "about-layout": Columns2,
  "contact-layout": Columns2, "contact-info": AtSign, "contact-words": MessageSquare, fonts: Baseline,
  body: AlignLeft, headings: Heading, theme: Palette, structure: LayoutTemplate, mood: Sparkles,
  spacing: MoveVertical, reveal: WandSparkles, "site-basics": Globe, "site-copy": TextQuote,
  "hero-photos": Images, categories: Tags, "series-details": Layers, pricing: JapaneseYen, service: Briefcase,
  "portfolio-kit": Package, presets: Bookmark, note: BookOpen, print: Printer, setup: ListChecks,
};

function iconFor(target: SiteEditorTarget): LucideIcon {
  return target && !target.startsWith("section:") ? PART_ICONS[target as SitePartId] ?? SlidersHorizontal : SlidersHorizontal;
}

/** 部分の目印（⌘K の行など、一覧の外で使う）。 */
export function SitePartIcon({ id, size = 15 }: { id: string; size?: number }) {
  const Icon = iconFor(id as SiteEditorTarget);
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}

function partNote(part: SitePart, language: SiteEditorLanguage): string | undefined {
  return language === "ja" ? part.noteJa : part.noteEn;
}

/** 上の帯。公開サイトのページと、ページに依らない「全体の見た目」「そのほか」。 */
export function SiteEditorBar({
  page,
  mode,
  onPage,
  onMode,
  language,
}: {
  page: SitePageId;
  mode: SiteEditorMode;
  onPage: (page: SitePageId) => void;
  onMode: (mode: SiteEditorMode) => void;
  language: SiteEditorLanguage;
}) {
  const ja = language === "ja";
  return (
    <div className="se-bar">
      <nav className="se-bar__pages" aria-label={ja ? "公開サイトのページ" : "Public pages"}>
        {SITE_PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            className="se-bar__page"
            data-site-page={p.id}
            aria-current={mode === "page" && page === p.id ? "page" : undefined}
            onClick={() => onPage(p.id)}
          >
            {ja ? p.ja : p.en}
          </button>
        ))}
      </nav>
      <div className="se-bar__more">
        <button
          type="button"
          className="se-bar__mode"
          data-site-mode="look"
          aria-pressed={mode === "look"}
          onClick={() => onMode("look")}
        >
          <Palette size={15} aria-hidden="true" />
          {/* スマホは短く（帯を横に送らなくても見えるように） */}
          <span className="se-bar__long">{ja ? "全体の見た目" : "Overall look"}</span>
          <span className="se-bar__short">{ja ? "見た目" : "Look"}</span>
        </button>
        <button
          type="button"
          className="se-bar__mode"
          data-site-mode="more"
          aria-pressed={mode === "more"}
          onClick={() => onMode("more")}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          {ja ? "そのほか" : "More"}
        </button>
      </div>
    </div>
  );
}

type Row = { target: SiteEditorTarget; label: string; note?: string; missing?: boolean };

/**
 * 出す・出さないを選べる部分。プレビューに見つからないときは「今は出ていません」と
 * 添える（出ていない部分を押しても、プレビューのどこも変わらず迷うため。2026-09-30）。
 */
export const SITE_PARTS_THAT_CAN_BE_HIDDEN: readonly string[] = [
  "statement", "cta", "works", "series-strip", "note", "print", "pricing", "contact-words",
];

/** 右の欄の一覧（どのページ・全体の見た目・そのほか）と、その上の「探す」。 */
export function SitePartsPanel({
  mode,
  page,
  skeleton,
  showService,
  foundParts,
  changedSections,
  sectionsFor,
  onOpen,
  onHover,
  language,
}: {
  mode: SiteEditorMode;
  page: SitePageId;
  skeleton: SiteSkeleton;
  showService: boolean;
  /** プレビューの中で見つかった部分（押せる所） */
  foundParts: readonly string[];
  changedSections: readonly string[];
  sectionsFor: (target: SiteEditorTarget) => readonly string[];
  onOpen: (target: SiteEditorTarget) => void;
  onHover: (target: SiteEditorTarget) => void;
  language: SiteEditorLanguage;
}) {
  const ja = language === "ja";
  const [query, setQuery] = useState("");
  const listed = (id: SitePartId) => partIsListed(SITE_PARTS[id], skeleton, showService);
  const pageDef = SITE_PAGES.find((p) => p.id === page) ?? SITE_PAGES[0]!;
  const ids: readonly SitePartId[] =
    mode === "look" ? SITE_LOOK_PARTS : mode === "more" ? SITE_MORE_PARTS : pageDef.parts;
  const rowFor = (id: SitePartId): Row => ({
    target: id,
    label: partLabel(SITE_PARTS[id], language),
    note: partNote(SITE_PARTS[id], language),
  });
  const rows: Row[] = ids.filter(listed).map(rowFor);

  // 探す: すべての部分と、すべての設定の節から（名前・一言・関連語で）。
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;
  const matches = (text: string) => {
    const haystack = text.toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  };
  const searchRows: Row[] = [];
  if (searching) {
    const seenSections = new Set<string>();
    const allIds = Array.from(
      new Set<SitePartId>([...SITE_PAGES.flatMap((p) => p.parts), ...SITE_LOOK_PARTS, ...SITE_MORE_PARTS]),
    ).filter(listed);
    for (const id of allIds) {
      const part: SitePart = SITE_PARTS[id];
      const sectionWords = sectionsFor(id).map((sid) => {
        const item = settingsNavigationItems.find((i) => i.id === sid);
        return item ? `${item.ja} ${item.en} ${item.keywords}` : "";
      });
      if (!matches(`${part.ja} ${part.en} ${part.noteJa ?? ""} ${part.noteEn ?? ""} ${part.keywords ?? ""} ${sectionWords.join(" ")} ${sectionsFor(id).join(" ")}`)) continue;
      const sections = sectionsFor(id);
      if (sections.length && sections.every((sid) => seenSections.has(sid))) continue;
      sections.forEach((sid) => seenSections.add(sid));
      searchRows.push(rowFor(id));
    }
    // 今の骨格の一覧に無い節も、探せば開ける（値は残っている）。
    for (const group of SETTINGS_NAVIGATION) {
      for (const item of group.items) {
        if (seenSections.has(item.id)) continue;
        if (!matches(`${item.ja} ${item.en} ${item.keywords} ${item.id}`)) continue;
        seenSections.add(item.id);
        searchRows.push({ target: `section:${item.id}`, label: ja ? item.ja : item.en });
      }
    }
  }

  const heading =
    mode === "look"
      ? ja ? "全体の見た目" : "Overall look"
      : mode === "more"
        ? ja ? "そのほか" : "More"
        : ja ? `${pageDef.ja}で変えられるところ` : `What you can change on ${pageDef.en}`;
  const lede =
    mode === "look"
      ? ja ? "すべてのページに効く書体・文字・色です。" : "Typefaces, text and colour for every page."
      : mode === "more"
        ? ja ? "ページの見た目に出ない設定と、ほかの編集画面です。" : "Settings that do not show on a page, and other editors."
        : ja ? "プレビューの中の変えたい所を押しても選べます。" : "You can also click the part you want in the preview.";

  const shown = searching ? searchRows : rows;
  return (
    <div className="se-panel">
      <div className="se-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && shown[0]) {
              e.preventDefault();
              onOpen(shown[0].target);
            }
          }}
          aria-label={ja ? "設定を探す" : "Find a setting"}
          placeholder={ja ? "設定を探す（メール・書体…）" : "Find a setting (email, typeface…)"}
        />
      </div>
      {!searching && (
        <header className="se-panel__head">
          <h2 className="se-panel__title">{heading}</h2>
          <p className="se-panel__lede">{lede}</p>
        </header>
      )}
      {searching && shown.length === 0 && (
        <output className="se-panel__empty">
          {ja ? `「${query.trim()}」に当たる設定は見つかりませんでした。` : `No settings match “${query.trim()}”.`}
        </output>
      )}
      <ul className="se-parts" aria-label={heading}>
        {shown.map((row) => {
          const changed = sectionsFor(row.target).some((sid) => changedSections.includes(sid));
          const onPage = mode === "page" && !searching && typeof row.target === "string" && foundParts.includes(row.target);
          const offPage =
            mode === "page" && !searching && foundParts.length > 0 && typeof row.target === "string" &&
            SITE_PARTS_THAT_CAN_BE_HIDDEN.includes(row.target) && !foundParts.includes(row.target);
          const Icon = iconFor(row.target);
          return (
            <li key={String(row.target)}>
              <button
                type="button"
                className="se-part"
                data-site-part={row.target ?? undefined}
                data-site-sections={sectionsFor(row.target).join(" ") || undefined}
                data-on-page={onPage || undefined}
                data-off-page={offPage || undefined}
                onClick={() => onOpen(row.target)}
                onMouseEnter={() => onHover(row.target)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(row.target)}
                onBlur={() => onHover(null)}
              >
                <span className="se-part__icon" aria-hidden="true">
                  <Icon size={17} strokeWidth={1.6} />
                </span>
                <span className="se-part__label">
                  {row.label}
                  {changed && (
                    <span className="se-part__changed" data-settings-section-changed>
                      <span className="sr-only">{ja ? "（保存していない変更があります）" : " (unsaved changes)"}</span>
                    </span>
                  )}
                </span>
                {row.note && (
                  <span className="se-part__note">
                    {offPage && <em className="se-part__off">{ja ? "今は出ていません" : "Not shown now"}</em>}
                    {row.note}
                  </span>
                )}
                <span className="se-part__go" aria-hidden="true">›</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 部分を開いているときの右の欄の上（戻る・名前・関係する画面への入口）。 */
export function SitePartHeader({
  backLabel,
  onBack,
  target,
  offPage,
  title,
  note,
  links,
}: {
  backLabel: string;
  onBack: () => void;
  /** 一覧と同じ目印を見出しの横に出す */
  target?: SiteEditorTarget;
  /** 今このページに出ていない（出す・出さないを選べる部分） */
  offPage?: string;
  title: string;
  note?: string;
  links?: readonly { label: string; onClick: () => void }[];
}) {
  return (
    <header className="se-part-head">
      <button type="button" className="se-part-head__back" onClick={onBack}>
        ← {backLabel}
      </button>
      <div className="se-part-head__row">
        {target !== undefined && (() => {
          const Icon = iconFor(target);
          return (
            <span className="se-part__icon se-part-head__icon" aria-hidden="true">
              <Icon size={17} strokeWidth={1.6} />
            </span>
          );
        })()}
        <h2 className="se-part-head__title">{title}</h2>
      </div>
      {note && <p className="se-part-head__note">{note}</p>}
      {offPage && <p className="se-part-head__off">{offPage}</p>}
      {links && links.length > 0 && (
        <div className="se-part-head__links">
          {links.map((link) => (
            <button key={link.label} type="button" className="se-part-head__link" onClick={link.onClick}>
              {link.label} →
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

/** 「サイト」の器。上の帯と、その下の作業面（プレビュー＋右の欄、または編集画面）。 */
export function SiteEditorFrame({ bar, children, fullEditor }: { bar: ReactNode; children: ReactNode; fullEditor?: boolean }) {
  return (
    <div className="se-frame" data-full-editor={fullEditor || undefined}>
      {bar}
      <div className="se-frame__body">{children}</div>
    </div>
  );
}
