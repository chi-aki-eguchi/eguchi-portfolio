import type { ReactNode } from "react";

/* ══════════════════════════════════════════════════
   管理画面の共通部品(2026-07-31 刷新)

   なぜ1ファイルにまとめるか:
   刷新前は同じ役割の部品(行・入力欄・追加フォーム・見出し)が画面ごとに
   別々のTailwind文字列で書かれていた。そのため Series は塗られた丸角カード、
   Categories は別の塗られた丸角カード、Settings はまた別、という状態になり、
   「画面ごとにデザイン規則が統一されていない」という指摘の原因になっていた。
   ここに置いた部品だけを使えば、規則は1箇所で決まる。

   設計の約束(docs/specs/admin-renewal-goal.md「決定した原則」):
   - 面(塗り)で区切らない。余白と細い罫で区切る
   - カードは「もの」(写真・シリーズ)にだけ。設定項目や一覧行はカードにしない
   - 入力欄は箱ではなく下罫線。枠の数を減らす
   - 黒塗りはその画面で最も強い1操作だけ
   ══════════════════════════════════════════════════ */

/* ── ページ枠 ──────────────────────────────────────
   全タブが同じ左端・同じ上余白・同じ最大幅の種類を使う。
   kind は「用途」であって画面名ではない。増やさない。 */
export type PageWidth = "form" | "list" | "wide";

const PAGE_MAX: Record<PageWidth, string> = {
  // 入力が主役の画面。1行が長くなりすぎると読み書きしづらい
  form: "max-w-[640px]",
  // 一覧が主役の画面。行の右端(操作)まで目が届く範囲
  list: "max-w-[860px]",
  // 写真グリッドなど、幅を使い切ってよい画面
  wide: "max-w-none",
};

export function Page({
  width = "list",
  children,
}: {
  width?: PageWidth;
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto" data-admin-page-shell={width}>
      <div className={`ax-page ${PAGE_MAX[width]}`}>{children}</div>
    </div>
  );
}

/* ── ページ見出し ──────────────────────────────────
   タイトルは欧文セリフ、説明は1つだけ。操作は右端。
   狭い幅では操作がタイトルの下へ落ちる(重ならない・隠れない)。 */
export function PageTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ax-page-title">
      <div className="min-w-0">
        <h1 className="ax-page-title__text admin-page-header__title">
          {title}
        </h1>
        {description && <p className="ax-page-title__note">{description}</p>}
      </div>
      {actions && <div className="ax-page-title__actions">{actions}</div>}
    </header>
  );
}

/* ── 節見出し ──────────────────────────────────────
   罫線ではなく「小さい文字 + 大きな上余白」で節を分ける。
   rule を付けたときだけ細い罫を引く(段が深い画面のみ)。 */
export function SectionTitle({
  children,
  hint,
  rule,
  actions,
}: {
  children: ReactNode;
  hint?: ReactNode;
  rule?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className={`ax-section-title${rule ? " ax-section-title--rule" : ""}`}>
      <div className="min-w-0">
        <h2 className="ax-section-title__text">{children}</h2>
        {hint && <p className="ax-section-title__hint">{hint}</p>}
      </div>
      {actions && <div className="ax-section-title__actions">{actions}</div>}
    </div>
  );
}

/* ── 一覧 ──────────────────────────────────────────
   塗らない。行の間は1本の細い罫。操作はホバー/フォーカスで濃くなる。 */
export function RowList({ children }: { children: ReactNode }) {
  return <ul className="ax-rows">{children}</ul>;
}

export function Row({
  media,
  title,
  meta,
  note,
  lead,
  actions,
}: {
  /** 表紙写真など「もの」がある行だけ。無い行に灰色の箱を置かない */
  media?: ReactNode;
  title: ReactNode;
  /** slug など、タイトルに添える機械的な文字列 */
  meta?: ReactNode;
  /** 説明。空なら何も出さない(空の "…" を出さない) */
  note?: ReactNode;
  /** 並べ替えなど、行の先頭に来る操作 */
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="ax-row">
      {lead && <div className="ax-row__lead">{lead}</div>}
      {media && <div className="ax-row__media">{media}</div>}
      <div className="ax-row__body">
        <div className="ax-row__line">
          <span className="ax-row__title">{title}</span>
          {meta && <span className="ax-row__meta">{meta}</span>}
        </div>
        {note && <p className="ax-row__note">{note}</p>}
      </div>
      {actions && <div className="ax-row__actions">{actions}</div>}
    </li>
  );
}

/* ── 入力 ──────────────────────────────────────────
   ラベルは上、補足は必要なときだけ。枠ではなく下罫線。 */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  span,
}: {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  /** 2列レイアウトのとき、この項目だけ全幅にする */
  span?: boolean;
}) {
  return (
    <div className={`ax-field${span ? " ax-field--span" : ""}`}>
      <label className="ax-field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {hint && <p className="ax-field__hint">{hint}</p>}
      {children}
    </div>
  );
}

/** 入力欄が横に並ぶとき。1列/2列は幅で自動で決まる(container query) */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="ax-field-grid">{children}</div>;
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean },
) {
  const { mono, className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`ax-input${mono ? " ax-input--mono" : ""} ${className}`}
    />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`ax-input ax-input--area ${className}`} />;
}

/* ── ボタン ────────────────────────────────────────
   tone は3つだけ。黒塗り(primary)は1画面に1つを原則にする。 */
export function Button({
  tone = "quiet",
  size = "base",
  icon,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "quiet" | "ghost" | "danger";
  size?: "base" | "small";
  icon?: ReactNode;
}) {
  const toneClass =
    tone === "primary"
      ? "admin-btn-primary ax-btn--primary"
      : tone === "danger"
        ? "ax-btn--danger admin-danger-on-hover"
        : tone === "ghost"
          ? "ax-btn--ghost"
          : "ax-btn--quiet";
  return (
    <button
      type="button"
      {...rest}
      className={`ax-btn ${toneClass}${size === "small" ? " ax-btn--small" : ""} ${rest.className ?? ""}`}
    >
      {icon}
      {children}
    </button>
  );
}

/* ── 追加フォーム ──────────────────────────────────
   一覧の下に置く。一覧と同じ左端に揃える(以前は Series だけ右にずれていた)。 */
export function AddBlock({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  // 空の追加フォームを常に開いたまま置かない。シリーズもカテゴリも
  // 毎回作るものではないのに、画面の下に空欄が居座っていた。
  // 押したときだけ開く。`<details>` なのでキーボードでも開ける。
  return (
    <details className="ax-add">
      <summary className="ax-add__title">{title}</summary>
      <div className="ax-add__body">{children}</div>
    </details>
  );
}

/* ── 状態表示 ──────────────────────────────────────
   公開/下書きのような「状態」はボタンに見せない。文字と点で出す。 */
export function StatusDot({
  on,
  children,
}: {
  on: boolean;
  children: ReactNode;
}) {
  return (
    <span className="ax-status" data-on={on || undefined}>
      <span aria-hidden="true" className="ax-status__dot" />
      {children}
    </span>
  );
}

/* ── 空状態 ────────────────────────────────────────
   中央寄せの大きなイラスト+2行の説明+ボタン、という型を使わない。
   一覧の続きに、静かに1行だけ置く。 */
export function EmptyNote({ children }: { children: ReactNode }) {
  // RowList(<ul>)の直下に置くので <li>。<p> を直接入れると一覧として
  // 読み上げられない(Codex独立監査 2026-07-31 指摘)。
  return <li className="ax-empty">{children}</li>;
}

/* ── 一覧の状態 ────────────────────────────────────
   一覧は3つの状態を持つ。**読み込み中 / 読み込めなかった / 本当に0件。**
   これを2つ（読み込み中 / それ以外）で書くと、通信が失敗したときに
   「まだありません」と表示することになる。実際、ゴミ箱・シリーズ・
   カテゴリ・料金の4画面がそうなっていた。オーナーには「シリーズが全部
   消えた」「ゴミ箱の写真はもう無い」と見える。

   正しい形は既に9箇所で動いていたので、それを1つの部品にして揃える。
   `EmptyNote` は「本当に0件」のときだけ使う。 */
export function ListLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center h-24 gap-2 text-[var(--admin-muted)] text-[length:var(--admin-text-note)]">
      <span
        aria-hidden="true"
        className="inline-block w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin"
      />
      <output>{label}</output>
    </div>
  );
}

export function ListLoadFailed({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="admin-status-warning rounded-sm px-3 py-2.5 flex items-center justify-between gap-4 text-[length:var(--admin-text-note)]"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 underline underline-offset-4 transition-opacity hover:opacity-70"
      >
        {retryLabel}
      </button>
    </div>
  );
}
