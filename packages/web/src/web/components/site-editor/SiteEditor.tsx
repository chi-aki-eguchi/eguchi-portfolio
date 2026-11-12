import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AlignLeft, ArrowUpDown, AtSign, Baseline, Bookmark, BookOpen, Briefcase, ChevronDown, Columns2,
  DoorOpen, Frame, GalleryHorizontal, Globe, Heading, Image, Images, JapaneseYen, LayoutGrid, LayoutTemplate, Layers,
  ListChecks, Mail, Maximize2, Menu, MessageSquare, MoveVertical, Package, Palette, PanelBottom, PanelsTopLeft, Printer,
  QrCode, Quote, SlidersHorizontal, Sparkles, SquareUser, Tags, Type, WandSparkles, type LucideIcon,
} from "lucide-react";
import {
  SETTINGS_NAVIGATION,
  SITE_PARTS,
  partText,
  searchSite,
  type SiteOutline,
  type SiteOutlineContext,
  type SiteOutlineGroupId,
  type SitePageId,
  type SitePart,
  type SitePartId,
  type SiteStructure,
} from "../../pages/admin-settings-navigation";
import "./site-editor.css";

/**
 * 管理画面「サイト」（2026-09-29 作り直し）。公開サイトを大きく出し、変えたい所を
 * 押して直す。オーナー「目次が長くてわかりづらい・ださい」を受けて、32項目の目次を
 * やめた。右の欄には、見ているページにある部分だけを並べる。
 *
 *   上の帯    公開サイトのページ ｜ ページに依らないまとまり
 *   真ん中    公開サイトのプレビュー（部分に乗ると枠と「〜を変える」、押すと右に設定）
 *   右の欄    このページで変えられるところ → 押すとその設定だけ
 *
 * 2026-11-12: 帯のページは公開サイトのページそのもの（新しい構成ならトップ／Portrait／
 * Works／Info／展示／東京プラン／名刺のQR、まとまりは 共通／見た目／そのほか）。
 * スマホは横に送る帯をやめ、1行の「いまのページ ▾」（押すと下から全部のページが出る）と、
 * 右に「編集／プレビュー」。横に隠れる入口を無くす（帯 554px が画面 390px に入らず、
 * 「そのほか」が見えなかった）。
 */

/** 右の欄の一覧。"page" は見ているページ、ほかはページに依らないまとまり。 */
export type SiteEditorMode = "page" | SiteOutlineGroupId;

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

export function partLabel(part: SitePart, language: SiteEditorLanguage, structure: SiteStructure = "classic"): string {
  return partText(part, structure, language).label;
}

/** 一覧で目印にする形。文字だけの一覧は拾い読みしにくい（2026-09-29）。 */
const PART_ICONS: Record<SitePartId, LucideIcon> = {
  name: Type, menu: Menu, footer: PanelBottom, "top-photos": Image, statement: Quote, works: LayoutGrid,
  "series-strip": GalleryHorizontal, cta: Mail, "page-title": Heading, "gallery-photos": LayoutGrid,
  order: ArrowUpDown, viewer: Maximize2, "series-cards": Layers, "series-layout": LayoutGrid, about: SquareUser, "about-layout": Columns2,
  "contact-layout": Columns2, "contact-info": AtSign, "contact-words": MessageSquare, fonts: Baseline,
  body: AlignLeft, theme: Palette, structure: LayoutTemplate, mood: Sparkles,
  spacing: MoveVertical, reveal: WandSparkles, "site-basics": Globe,
  "hero-photos": Images, categories: Tags, "series-details": Layers, pricing: JapaneseYen, service: Briefcase,
  "portfolio-kit": Package, presets: Bookmark, note: BookOpen, print: Printer, setup: ListChecks,
  "top-style": LayoutTemplate, "cover-photos": Images, doors: DoorOpen, "portrait-photos": Images, gallery: LayoutGrid,
  "cta-ref": Mail, "works-series": Layers, "life-photos": Images, "works-other": MessageSquare, "info-statement": Quote,
  "exhibition-photos": Frame, "tokyo-photos": Images, card: QrCode, "card-profile": SquareUser,
};

const GROUP_ICONS: Record<SiteOutlineGroupId, LucideIcon> = { shared: PanelsTopLeft, look: Palette, more: SlidersHorizontal };

function iconFor(target: SiteEditorTarget): LucideIcon {
  return target && !target.startsWith("section:") ? PART_ICONS[target as SitePartId] ?? SlidersHorizontal : SlidersHorizontal;
}

/** 部分の目印（⌘K の行など、一覧の外で使う）。 */
export function SitePartIcon({ id, size = 15 }: { id: string; size?: number }) {
  const Icon = iconFor(id as SiteEditorTarget);
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}

/** 帯・選ぶ欄に出す、いまの場所の名前。 */
function currentName(outline: SiteOutline, page: SitePageId, mode: SiteEditorMode, language: SiteEditorLanguage, short = false) {
  const ja = language === "ja";
  if (mode !== "page") {
    const group = outline.groups.find((g) => g.id === mode);
    if (group) return short ? (ja ? group.shortJa : group.shortEn) : ja ? group.ja : group.en;
  }
  const p = outline.pages.find((x) => x.id === page) ?? outline.pages[0]!;
  return ja ? p.ja : p.en;
}

/**
 * スマホの「いまのページ ▾」。押すと、全部のページと 共通・見た目・そのほか が下から出る。
 * 各ページの下にはそのページの部分も並べ、押せばその部分が開く（サイトの地図。どこに何が
 * あるかを1枚で見せ、自己紹介・書体などへ /admin から3回で届くように）。
 * 選ぶ・外を押す・Escape で閉じ、閉じたら押したボタンへ戻る（外を押したときは、押した先を優先）。
 */
function PagePicker({
  outline,
  page,
  mode,
  onPage,
  onMode,
  onPart,
  partName,
  language,
}: {
  outline: SiteOutline;
  page: SitePageId;
  mode: SiteEditorMode;
  onPage: (page: SitePageId) => void;
  onMode: (mode: SiteOutlineGroupId) => void;
  onPart?: (part: SitePartId) => void;
  partName: (part: SitePartId) => string;
  language: SiteEditorLanguage;
}) {
  const ja = language === "ja";
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const sheetId = useId();
  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    // いまの場所の行を、選ぶ欄の上に見せてから押せるようにする。
    const current = sheet?.querySelector<HTMLElement>('[aria-current="true"]') ?? sheet?.querySelector<HTMLElement>("button");
    if (sheet && current) sheet.scrollTop = Math.max(0, current.offsetTop - 10);
    current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
        return;
      }
      // 開いている間は、選ぶ欄の中だけを Tab で回る。
      if (e.key === "Tab" && sheet) {
        const items = Array.from(sheet.querySelectorAll<HTMLElement>("button"));
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || sheet?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const row = (key: string, label: string, current: boolean, onChoose: () => void, parts: readonly SitePartId[]) => (
    <li key={key}>
      <button
        type="button"
        className="se-pagepick__row"
        data-site-pick={key}
        aria-current={current ? "true" : undefined}
        onClick={() => {
          close(true);
          onChoose();
        }}
      >
        <span>{label}</span>
      </button>
      {onPart && parts.length > 0 && (
        <ul className="se-pagepick__parts">
          {parts.map((id) => (
            <li key={id}>
              <button
                type="button"
                className="se-pagepick__part"
                data-site-pick-part={id}
                onClick={() => {
                  close(false);
                  onPart(id);
                }}
              >
                {partName(id)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
  return (
    <div className="se-pagepick">
      <button
        ref={buttonRef}
        type="button"
        className="se-pagepick__button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? sheetId : undefined}
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        <span className="se-pagepick__current">{currentName(outline, page, mode, language)}</span>
        <ChevronDown size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="se-pagepick__scrim" aria-hidden="true" onClick={() => close(true)} />
          <dialog open data-phase="show" ref={sheetRef} id={sheetId} className="se-pagepick__sheet" aria-modal="true" aria-label={ja ? "ページを選ぶ" : "Choose a page"}>
            <ul className="se-pagepick__list">
              {outline.pages.map((p) => row(p.id, ja ? p.ja : p.en, mode === "page" && page === p.id, () => onPage(p.id), p.parts))}
            </ul>
            <ul className="se-pagepick__list se-pagepick__list--groups">
              {outline.groups.map((g) => row(g.id, ja ? g.ja : g.en, mode === g.id, () => onMode(g.id), [...g.parts, ...g.advanced]))}
            </ul>
          </dialog>
        </>
      )}
    </div>
  );
}

/**
 * 上の帯。公開サイトのページと、ページに依らないまとまり。PC は全部を並べ、スマホは
 * 「いまのページ ▾」と、右に「編集／プレビュー」（設定の画面が `viewHostRef` の所へ置く）。
 */
export function SiteEditorBar({
  outline,
  page,
  mode,
  onPage,
  onMode,
  language,
  viewHostRef,
  onPart,
  doors,
}: {
  outline: SiteOutline;
  page: SitePageId;
  mode: SiteEditorMode;
  onPage: (page: SitePageId) => void;
  onMode: (mode: SiteOutlineGroupId) => void;
  language: SiteEditorLanguage;
  viewHostRef?: (element: HTMLElement | null) => void;
  /** スマホの選ぶ欄から、部分を直接開く */
  onPart?: (part: SitePartId) => void;
  doors?: SiteOutlineContext["doors"];
}) {
  const ja = language === "ja";
  return (
    <div className="se-bar" data-structure={outline.structure}>
      <nav className="se-bar__pages" aria-label={ja ? "公開サイトのページ" : "Public pages"}>
        {outline.pages.map((p) => (
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
        {outline.groups.map((g) => {
          const Icon = GROUP_ICONS[g.id];
          const long = ja ? g.ja : g.en;
          const short = ja ? g.shortJa : g.shortEn;
          return (
            <button
              key={g.id}
              type="button"
              className="se-bar__mode"
              data-site-mode={g.id}
              aria-pressed={mode === g.id}
              onClick={() => onMode(g.id)}
            >
              <Icon size={15} aria-hidden="true" />
              {long === short ? (
                long
              ) : (
                <>
                  {/* 細い画面は短く（帯を横に送らなくても見えるように） */}
                  <span className="se-bar__long">{long}</span>
                  <span className="se-bar__short">{short}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <PagePicker
        outline={outline}
        page={page}
        mode={mode}
        onPage={onPage}
        onMode={onMode}
        onPart={onPart}
        partName={(id) => partText(SITE_PARTS[id], outline.structure, language, doors).label}
        language={language}
      />
      <div className="se-bar__view" ref={viewHostRef} />
    </div>
  );
}

type Row = {
  target: SiteEditorTarget;
  label: string;
  note?: string;
  /** 探して当たった欄 */
  field?: string;
  unused?: boolean;
};

/**
 * 出す・出さないを選べる部分。プレビューに見つからないときは「今は出ていません」と
 * 添える（出ていない部分を押しても、プレビューのどこも変わらず迷うため。2026-09-30）。
 */
export const SITE_PARTS_THAT_CAN_BE_HIDDEN: readonly string[] = [
  "statement", "cta", "works", "series-strip", "note", "print", "pricing", "contact-words",
];

/** 行の右端の印（設定はその場で開く、ほかの画面へ行く行は ↗、同じ設定を指す行は ↩）。 */
function rowKind(target: SiteEditorTarget): "settings" | "away" | "ref" {
  if (!target || target.startsWith("section:")) return "settings";
  const part: SitePart | undefined = (SITE_PARTS as Record<string, SitePart>)[target];
  if (part?.ref) return "ref";
  if (part?.pagesTab || part?.view) return "away";
  return "settings";
}

/** 右の欄の一覧（どのページ・まとまり）と、その上の「探す」。 */
export function SitePartsPanel({
  mode,
  page,
  outline,
  context,
  foundParts,
  changedSections,
  sectionsFor,
  onOpen,
  onHover,
  language,
}: {
  mode: SiteEditorMode;
  page: SitePageId;
  outline: SiteOutline;
  context: SiteOutlineContext;
  /** プレビューの中で見つかった部分（押せる所） */
  foundParts: readonly string[];
  changedSections: readonly string[];
  sectionsFor: (target: SiteEditorTarget) => readonly string[];
  /** 開く。探して欄に当たったときは、その欄の名前も渡す（開いたらその欄へ送る） */
  onOpen: (target: SiteEditorTarget, field?: string) => void;
  onHover: (target: SiteEditorTarget) => void;
  language: SiteEditorLanguage;
}) {
  const ja = language === "ja";
  const structure = outline.structure;
  const [query, setQuery] = useState("");
  const pageDef = outline.pages.find((p) => p.id === page) ?? outline.pages[0]!;
  const group = mode === "page" ? undefined : outline.groups.find((g) => g.id === mode);
  const rowFor = (id: SitePartId): Row => {
    const text = partText(SITE_PARTS[id], structure, language, context.doors);
    return { target: id, label: text.label, note: text.note };
  };
  const rows: Row[] = (group ? group.parts : pageDef.parts).map(rowFor);
  const advancedRows: Row[] = (group?.advanced ?? []).map(rowFor);

  // 探す: 並びにある部分・設定の節と、その中の欄の名前から（今の構成で使わない節は印付き）。
  const searching = query.trim().length > 0;
  const searchRows: Row[] = searching
    ? searchSite(query, outline, context, language).map((hit) => {
        if (hit.target.startsWith("section:")) {
          const sid = hit.target.slice("section:".length);
          return { target: hit.target as SiteEditorTarget, label: sectionLabel(sid, language), field: hit.field, unused: hit.unused };
        }
        return { ...rowFor(hit.target as SitePartId), field: hit.field, unused: hit.unused };
      })
    : [];

  const heading = group
    ? ja ? group.ja : group.en
    : ja ? `${pageDef.ja}で変えられるところ` : `What you can change on ${pageDef.en}`;
  const lede = group
    ? group.id === "shared"
      ? ja ? "どのページにも出るメニュー・フッター・写真の開き方・見出しです。" : "The menu, footer, photo viewer and headings shared by every page."
      : group.id === "look"
        ? structure === "develop"
          ? ja ? "すべてのページに効く書体・色・文字・余白です。" : "Typefaces, colour, text and spacing for every page."
          : ja ? "すべてのページに効く書体・色・文字と、どのページにも出るメニュー・フッター・見出しです。" : "Typefaces, colour and text for every page, and the menu, footer and headings that appear on each page."
        : ja ? "ページの見た目に出ない設定と、ほかの編集画面です。" : "Settings that do not show on a page, and other editors."
    : structure === "develop"
      ? ja ? "ページの上から見える順に並んでいます。" : "Listed in the order they appear on the page."
      : ja ? "プレビューの中の変えたい所を押しても選べます。" : "You can also click the part you want in the preview.";

  const shown = searching ? searchRows : rows;
  const renderRow = (row: Row) => {
    const changed = sectionsFor(row.target).some((sid) => changedSections.includes(sid));
    const onPage = mode === "page" && !searching && typeof row.target === "string" && foundParts.includes(row.target);
    // 「今は出ていません」はプレビューの中の部品の目印（今までの構成の物）で決める。新しい構成の
    // ページには目印が無いので、付けない（出ている物まで「出ていません」と言ってしまう）。
    const offPage =
      structure === "classic" && mode === "page" && !searching && foundParts.length > 0 && typeof row.target === "string" &&
      SITE_PARTS_THAT_CAN_BE_HIDDEN.includes(row.target) && !foundParts.includes(row.target);
    const Icon = iconFor(row.target);
    const kind = rowKind(row.target);
    const note = row.field ? (ja ? `「${row.field}」の欄` : `Field: ${row.field}`) : row.note;
    return (
      <li key={String(row.target)}>
        <button
          type="button"
          className="se-part"
          data-site-part={row.target ?? undefined}
          data-site-sections={sectionsFor(row.target).join(" ") || undefined}
          data-site-row={kind === "settings" ? undefined : kind}
          data-on-page={onPage || undefined}
          data-off-page={offPage || undefined}
          data-unused={row.unused || undefined}
          onClick={() => onOpen(row.target, row.field)}
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
          {(note || row.unused || offPage) && (
            <span className="se-part__note">
              {offPage && <em className="se-part__off">{ja ? "今は出ていません" : "Not shown now"}</em>}
              {row.unused && <em className="se-part__off">{ja ? "今の構成では使いません" : "Not used by the current structure"}</em>}
              {note}
            </span>
          )}
          <span className="se-part__go" aria-hidden="true">{kind === "away" ? "↗" : kind === "ref" ? "↩" : "›"}</span>
        </button>
      </li>
    );
  };
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
              onOpen(shown[0].target, shown[0].field);
            }
          }}
          aria-label={ja ? "設定を探す" : "Find a setting"}
          placeholder={ja ? "設定を探す（メール・書体・Instagram…）" : "Find a setting (email, typeface, Instagram…)"}
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
        {shown.map(renderRow)}
      </ul>
      {!searching && advancedRows.length > 0 && (
        <details className="se-parts-more">
          <summary>{ja ? `詳しい設定（${advancedRows.length}）` : `More settings (${advancedRows.length})`}</summary>
          <ul className="se-parts" aria-label={ja ? "詳しい設定" : "More settings"}>
            {advancedRows.map(renderRow)}
          </ul>
        </details>
      )}
    </div>
  );
}

/** 部分を開いているときの右の欄の上（戻る・名前・関係する画面への入口）。 */
export function SitePartHeader({
  backLabel,
  onBack,
  target,
  offPage,
  unused,
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
  /** 今の構成では使わない（値は残っている） */
  unused?: string;
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
      {unused && <p className="se-part-head__off" data-structure-unused role="note">{unused}</p>}
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
