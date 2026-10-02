import { useEffect, useMemo, useState } from "react";
import { adminPhotoSrc } from "../../pages/admin-shared";
import {
  batch,
  createSeries,
  patchPhoto,
  patchSeries,
  reorderSeriesPhotos,
  seriesPhotos,
  shotLine,
  slugFromTitle,
  trashPhoto,
  restorePhoto,
  useStudio,
  type StudioData,
  type StudioPhoto,
} from "./studio-data";
import { adminText as tx } from "../../pages/admin-i18n";
import type { MoveWhere } from "../../lib/work-order";

const FILM = "フィルム";
const DIGITAL = "デジタル";

/**
 * 右の欄。選んだ写真の公開・シリーズ・トップ・言葉・撮影情報をその場で直す。
 * 1枚のときは詳しく、複数のときはまとめて。
 *
 * シリーズは「入れる／外す」のチェック。1枚を何本にも入れられる。
 */
/**
 * 並びを変えるボタン（先頭へ・1つ前へ・1つ後へ・最後へ）の中身（2026-10-02）。
 * ドラッグはスマホで使えず、PC でも遠くへ動かすのが大変だった。呼ぶ側が、いま見えている
 * 並びと、ドラッグと同じ並べ替えの処理を渡す。並べ替えられない一覧（探している最中など）では渡さない。
 */
export type InspectorOrder = {
  /** 選んだ写真のうち先頭が、いま見えている並びの何番目か（0 始まり）と、並びの数 */
  index: number;
  total: number;
  /** サイトでの並びか、シリーズの中の並びか */
  scope: "site" | "series";
  /** その向きに動かすときの位置。動かせないときは null */
  target: (where: MoveWhere) => number | null;
  apply: (at: number) => Promise<void>;
};

export function Inspector({
  data,
  selection,
  seriesContext,
  onClear,
  onOpenDetails,
  picking = false,
  order,
  step,
}: {
  data: StudioData;
  selection: StudioPhoto[];
  /** シリーズの画面で開いているとき、そのシリーズ（表紙・外すを出す） */
  seriesContext?: number;
  onClear: () => void;
  /** 回転・構図・日付の一括入力など、詳しい道具の画面を開く */
  onOpenDetails?: (photoId: number) => void;
  /**
   * 「まとめて選ぶ」の最中か（2026-10-01）。スマホでは欄を下の1行にたたみ、写真を
   * 続けて押せるようにする。以前は1枚押すと画面の7割を覆う面が開き、2枚目を
   * 押せなかった（選ぶたびに面を閉じる必要があった）。「操作する」で広げる。
   * 広い画面では何も変わらない（たたむのは styles の 760px 以下だけ）。
   */
  picking?: boolean;
  order?: InspectorOrder;
  /**
   * 開いたまま隣の写真へ移る（2026-10-02）。以前は欄を閉じて次の写真を押し直す必要があり、
   * スマホでは欄が画面の大半を覆うので特に手間だった。端では渡さない（押せなくする）。
   */
  step?: { prev?: () => void; next?: () => void };
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!picking) setOpen(false);
  }, [picking]);
  if (selection.length === 0) return null;
  const collapsed = picking && !open;
  // 1枚は「その写真を開いている」状態。複数を選んだとき・まとめて選んでいるときだけ
  // 「選ぶ」の言葉を使う（2026-09-30。1枚押しただけで「選ぶのをやめる」と出て、
  // 選ぶ操作をした覚えが無いのに選択の画面に入ったように見えていた）。
  const opened = selection.length === 1 && !picking;
  return (
    <aside className="st-inspector" data-collapsed={collapsed || undefined} aria-label={tx("選んでいる写真", "Selected photos")}>
      <div className="st-inspector__head">
        <p className="st-inspector__count">
          {opened ? tx("この写真", "This photo") : tx(`${selection.length}枚を選んでいます`, `${selection.length} selected`)}
        </p>
        {opened && step && (
          <fieldset className="st-step" aria-label={tx("写真を移る", "Move between photos")}>
            <button
              type="button"
              className="st-ax-btn st-link"
              disabled={!step.prev}
              onClick={step.prev}
              aria-label={tx("前の写真", "Previous photo")}
              title={tx("前の写真（←）", "Previous photo (←)")}
            >
              ‹ {tx("前", "Prev")}
            </button>
            <button
              type="button"
              className="st-ax-btn st-link"
              disabled={!step.next}
              onClick={step.next}
              aria-label={tx("次の写真", "Next photo")}
              title={tx("次の写真（→）", "Next photo (→)")}
            >
              {tx("次", "Next")} ›
            </button>
          </fieldset>
        )}
        {picking && (
          <button
            type="button"
            className="st-ax-btn st-link st-inspector__toggle"
            aria-expanded={!collapsed}
            onClick={() => setOpen((v) => !v)}
          >
            {collapsed ? tx("操作する", "Actions") : tx("たたむ", "Collapse")}
          </button>
        )}
        <button type="button" className="st-ax-btn st-link" onClick={onClear}>
          {opened ? tx("閉じる", "Close") : tx("選ぶのをやめる", "Clear selection")}
        </button>
      </div>
      {selection.length === 1 ? (
        <Single
          key={selection[0]!.id}
          data={data}
          photo={selection[0]!}
          seriesContext={seriesContext}
          onClear={onClear}
          onOpenDetails={onOpenDetails}
          order={order}
        />
      ) : (
        <Many data={data} photos={selection} seriesContext={seriesContext} onClear={onClear} order={order} />
      )}
    </aside>
  );
}

// ── 共通の小さな部品 ────────────────────────────────────────

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <fieldset className="st-seg" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          className="st-ax-btn st-seg__item"
          onClick={() => value !== v && onChange(v)}
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="st-section">
      <div className="st-section__head">
        <h3 className="st-section__title">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const MOVES: [MoveWhere, string, string][] = [
  ["first", "先頭へ", "To start"],
  ["prev", "1つ前へ", "Earlier"],
  ["next", "1つ後へ", "Later"],
  ["last", "最後へ", "To end"],
];
function OrderRow({ order, count }: { order: InspectorOrder; count: number }) {
  const [busy, setBusy] = useState(false);
  const go = async (where: MoveWhere) => {
    const at = order.target(where);
    if (at == null || busy) return;
    setBusy(true);
    try {
      await order.apply(at);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section
      title={order.scope === "series" ? tx("シリーズの中の並び", "Order in the series") : tx("サイトでの並び", "Order on the site")}
      aside={
        <span className="st-order__pos">
          {count > 1
            ? tx(`${count}枚をまとめて動かします`, `Moves ${count} together`)
            : tx(`${order.index + 1}番目 / ${order.total}枚`, `${order.index + 1} of ${order.total}`)}
        </span>
      }
    >
      <div className="st-order">
        {MOVES.map(([where, ja, en]) => (
          <button
            key={where}
            type="button"
            className="st-ax-btn st-button st-order__btn"
            disabled={busy || order.target(where) == null}
            onClick={() => void go(where)}
          >
            {tx(ja, en)}
          </button>
        ))}
      </div>
    </Section>
  );
}

/** シリーズのチェック一覧。tri-state（一部だけ入っている）にも対応。 */
function SeriesChecklist({
  data,
  photos,
}: {
  data: StudioData;
  photos: StudioPhoto[];
}) {
  const { remember, fail, refresh } = useStudio();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  // 押した瞬間にチェックを変える（保存の往復を待たない）。保存が済むか失敗したら外す。
  const [pending, setPending] = useState<Map<number, boolean>>(new Map());
  const ids = photos.map((p) => p.id);
  const toggle = async (seriesId: number, add: boolean) => {
    setPending((m) => new Map(m).set(seriesId, add));
    try {
      await toggleNow(seriesId, add);
    } finally {
      setPending((m) => {
        const next = new Map(m);
        next.delete(seriesId);
        return next;
      });
    }
  };
  const toggleNow = async (seriesId: number, add: boolean) => {
    const name = data.seriesById.get(seriesId)?.title ?? "";
    const members = new Set(data.membersBySeries.get(seriesId) ?? []);
    const changing = ids.filter((id) => members.has(id) !== add);
    if (changing.length === 0) return;
    const before = data.allMembersBySeries.get(seriesId) ?? [];
    try {
      await seriesPhotos(seriesId, add ? { add: changing } : { remove: changing });
      await refresh();
      remember(
        {
          label: add ? tx("シリーズへ入れる", "Add to series") : tx("シリーズから外す", "Remove from series"),
          run: async () => {
            await seriesPhotos(seriesId, add ? { remove: changing } : { add: changing });
            if (!add) {
              // 外す前の並びに戻す。
              await reorderSeriesPhotos(seriesId, before);
            }
          },
        },
        tx(`${changing.length === 1 ? "" : `${changing.length}枚を`}「${name}」${add ? "に入れました" : "から外しました"}`, `${add ? "Added" : "Removed"} ${changing.length === 1 ? "1 photo" : `${changing.length} photos`} ${add ? "to" : "from"} “${name}”`),
      );
    } catch {
      fail(tx("シリーズを保存できませんでした。", "Could not save the series."));
    }
  };
  const create = async () => {
    const t = title.trim();
    if (!t) return;
    try {
      const { series } = await createSeries({ title: t, slug: slugFromTitle(t), kind: "series", isPublished: true });
      await seriesPhotos(series.id, { add: ids });
      setTitle("");
      setCreating(false);
      await refresh();
      remember(
        { label: tx("シリーズへ入れる", "Add to series"), run: () => seriesPhotos(series.id, { remove: ids }) },
        tx(`新しいシリーズ「${t}」を作って入れました`, `Created “${t}” and added the photos`),
      );
    } catch {
      fail(tx("シリーズを作れませんでした（同じ URL のシリーズが既にあるかもしれません）。", "Could not create the series (a series with the same URL may already exist)."));
    }
  };
  return (
    <Section
      title={tx("シリーズ", "Series")}
      aside={
        !creating && (
          <button type="button" className="st-ax-btn st-link" onClick={() => setCreating(true)}>
            {tx("＋ 新しく作る", "+ New")}
          </button>
        )
      }
    >
      {data.series.length === 0 && !creating && (
        <p className="st-note">{tx("まだシリーズがありません。どのシリーズにも入れなくても、写真はサイトに並びます。", "No series yet. Photos appear on the site even when they are in no series.")}</p>
      )}
      <ul className="st-checks">
        {data.series.map((s) => {
          const members = new Set(data.membersBySeries.get(s.id) ?? []);
          const n = ids.filter((id) => members.has(id)).length;
          const want = pending.get(s.id);
          const state =
            want !== undefined ? (want ? "all" : "none") : n === 0 ? "none" : n === ids.length ? "all" : "some";
          return (
            <li key={s.id}>
              <label className="st-check">
                <input
                  type="checkbox"
                  checked={state === "all"}
                  ref={(el) => {
                    if (el) el.indeterminate = state === "some";
                  }}
                  onChange={() => void toggle(s.id, state !== "all")}
                />
                <span className="st-check__label">{s.title}</span>
                {s.kind === "work" && <span className="st-tag">{tx("仕事", "Work")}</span>}
                {s.isPublished === false && <span className="st-tag">{tx("非公開", "Hidden")}</span>}
              </label>
            </li>
          );
        })}
      </ul>
      {creating && (
        <form
          className="st-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            className="st-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tx("シリーズの題名", "Series title")}
            aria-label={tx("新しいシリーズの題名", "New series title")}
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <button type="submit" className="st-ax-btn st-button st-button--primary" disabled={!title.trim()}>
            {tx("作って入れる", "Create and add")}
          </button>
          <button type="button" className="st-ax-btn st-link" onClick={() => setCreating(false)}>
            {tx("やめる", "Cancel")}
          </button>
        </form>
      )}
    </Section>
  );
}

function PublishRow({ photos }: { photos: StudioPhoto[] }) {
  const { remember, fail, refresh } = useStudio();
  const [want, setWant] = useState<boolean | null>(null);
  const shown = photos.filter((p) => p.isPublished !== false).length;
  const value =
    want !== null ? (want ? "public" : "hidden") : shown === photos.length ? "public" : shown === 0 ? "hidden" : null;
  const set = async (publish: boolean) => {
    setWant(publish);
    try {
      await setNow(publish);
    } finally {
      setWant(null);
    }
  };
  const setNow = async (publish: boolean) => {
    const changing = photos.filter((p) => (p.isPublished !== false) !== publish).map((p) => p.id);
    if (!changing.length) return;
    try {
      await batch(changing, publish ? "publish" : "unpublish");
      await refresh();
      remember(
        { label: publish ? tx("公開にする", "Publish") : tx("非公開にする", "Hide"), run: () => batch(changing, publish ? "unpublish" : "publish") },
        tx(`${changing.length === 1 ? "" : `${changing.length}枚を`}${publish ? "公開しました" : "非公開にしました（サイトに出ません）"}`, `${publish ? "Published" : "Hid"} ${changing.length === 1 ? "1 photo" : `${changing.length} photos`}${publish ? "" : " (not on the site)"}`),
      );
    } catch {
      fail(tx("公開の設定を保存できませんでした。", "Could not save the visibility."));
    }
  };
  return (
    <Segmented
      label={tx("公開", "Visibility")}
      value={value}
      options={[
        ["public", tx("公開", "Public")],
        ["hidden", tx("非公開", "Hidden")],
      ]}
      onChange={(v) => void set(v === "public")}
    />
  );
}

function HeroRow({ data, photos }: { data: StudioData; photos: StudioPhoto[] }) {
  const { remember, fail, refresh } = useStudio();
  const ids = photos.map((p) => p.id);
  const [want, setWant] = useState<boolean | null>(null);
  const n = ids.filter((id) => data.heroSet.has(id)).length;
  const on = want ?? n === ids.length;
  const toggle = async () => {
    const next = !on;
    setWant(next);
    try {
      await toggleNow(next);
    } finally {
      setWant(null);
    }
  };
  const toggleNow = async (next: boolean) => {
    const changing = ids.filter((id) => data.heroSet.has(id) !== next);
    try {
      await batch(changing, next ? "feature" : "unfeature");
      await refresh();
      remember(
        { label: tx("トップに出す写真", "Home page photos"), run: () => batch(changing, next ? "unfeature" : "feature") },
        next ? tx("トップに出す写真に加えました", "Added to the home page") : tx("トップの選択から外しました（Galleryには残ります）", "Removed from the home page (still in Gallery)"),
      );
    } catch {
      fail(tx("トップの設定を保存できませんでした。", "Could not save the home page choice."));
    }
  };
  return (
    <label className="st-check st-check--line">
      <input
        type="checkbox"
        checked={on}
        ref={(el) => {
          if (el) el.indeterminate = want === null && n > 0 && !on;
        }}
        onChange={() => void toggle()}
      />
      <span className="st-check__label">{tx("トップに出す", "Show on the home page")}</span>
    </label>
  );
}

function MediumRow({ photos }: { photos: StudioPhoto[] }) {
  const { remember, fail, refresh } = useStudio();
  const [want, setWant] = useState<"film" | "digital" | null>(null);
  const film = photos.filter((p) => p.filmType === FILM).length;
  const digital = photos.filter((p) => p.filmType === DIGITAL).length;
  const value = want ?? (film === photos.length ? "film" : digital === photos.length ? "digital" : null);
  const set = async (medium: "film" | "digital") => {
    setWant(medium);
    try {
      await setNow(medium);
    } finally {
      setWant(null);
    }
  };
  const setNow = async (medium: "film" | "digital") => {
    const target = medium === "film" ? FILM : DIGITAL;
    const changing = photos.filter((p) => p.filmType !== target);
    const before = new Map<string | null, number[]>();
    for (const p of changing) before.set(p.filmType ?? null, [...(before.get(p.filmType ?? null) ?? []), p.id]);
    try {
      await batch(changing.map((p) => p.id), "filmType", target);
      await refresh();
      remember(
        {
          label: tx("媒体", "Medium"),
          run: async () => {
            for (const [ft, ids] of before) await batch(ids, "filmType", ft ?? "");
          },
        },
        tx(`${changing.length === 1 ? "" : `${changing.length}枚を`}${target}にしました`, `Set ${changing.length === 1 ? "1 photo" : `${changing.length} photos`} to ${target === "フィルム" ? "film" : "digital"}`),
      );
    } catch {
      fail(tx("媒体を保存できませんでした。", "Could not save the medium."));
    }
  };
  return (
    <Segmented
      label={tx("媒体", "Medium")}
      value={value}
      options={[
        ["film", tx(FILM, "Film")],
        ["digital", tx(DIGITAL, "Digital")],
      ]}
      onChange={(v) => void set(v)}
    />
  );
}

function TrashButton({ photos, onDone }: { photos: StudioPhoto[]; onDone: () => void }) {
  const { remember, fail, refresh } = useStudio();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [photos]);
  const run = async () => {
    const done: number[] = [];
    try {
      for (const p of photos) {
        await trashPhoto(p.id);
        done.push(p.id);
      }
    } catch {
      fail(done.length ? tx(`${done.length}枚だけゴミ箱へ移しました。`, `Moved only ${done.length} to the trash.`) : tx("ゴミ箱へ移せませんでした。", "Could not move to the trash."));
    }
    if (!done.length) return;
    await refresh();
    onDone();
    remember(
      {
        label: tx("ゴミ箱への移動", "Move to trash"),
        run: async () => {
          for (const id of done) await restorePhoto(id);
        },
      },
      tx(`${done.length === 1 ? "" : `${done.length}枚を`}ゴミ箱へ移しました（ゴミ箱から戻せます）`, `Moved ${done.length === 1 ? "1 photo" : `${done.length} photos`} to the trash (you can restore from the trash)`),
    );
  };
  return confirm ? (
    <div className="st-confirm">
      <p>{tx(`${photos.length === 1 ? "この写真" : `${photos.length}枚`}をゴミ箱へ移しますか？（ゴミ箱から戻せます）`, `Move ${photos.length === 1 ? "this photo" : `${photos.length} photos`} to the trash? (You can restore it from the trash.)`)}</p>
      <div className="st-confirm__actions">
        <button type="button" className="st-ax-btn st-button st-button--danger" onClick={() => void run()}>
          {tx("ゴミ箱へ移す", "Move to trash")}
        </button>
        <button type="button" className="st-ax-btn st-link" onClick={() => setConfirm(false)}>
          {tx("やめる", "Cancel")}
        </button>
      </div>
    </div>
  ) : (
    <button type="button" className="st-ax-btn st-link st-link--danger" onClick={() => setConfirm(true)}>
      {tx("ゴミ箱へ", "Trash")}
    </button>
  );
}

function SeriesContextActions({
  data,
  seriesId,
  photos,
  onClear,
}: {
  data: StudioData;
  seriesId: number;
  photos: StudioPhoto[];
  onClear: () => void;
}) {
  const { remember, fail, refresh } = useStudio();
  const s = data.seriesById.get(seriesId);
  if (!s) return null;
  const ids = photos.map((p) => p.id);
  const single = photos.length === 1 ? photos[0]! : null;
  const setCover = async () => {
    if (!single) return;
    const before = s.coverPhotoId ?? null;
    try {
      await patchSeries(s.id, { coverPhotoId: single.id });
      await refresh();
      remember({ label: tx("表紙", "Cover"), run: () => patchSeries(s.id, { coverPhotoId: before }) }, tx(`「${s.title}」の表紙にしました`, `Made it the cover of “${s.title}”`));
    } catch {
      fail(tx("表紙を保存できませんでした。", "Could not save the cover."));
    }
  };
  const remove = async () => {
    const before = data.allMembersBySeries.get(seriesId) ?? [];
    try {
      await seriesPhotos(seriesId, { remove: ids });
      await refresh();
      onClear();
      remember(
        {
          label: tx("シリーズから外す", "Remove from series"),
          run: async () => {
            await seriesPhotos(seriesId, { add: ids });
            await reorderSeriesPhotos(seriesId, before);
          },
        },
        tx(`${ids.length === 1 ? "" : `${ids.length}枚を`}「${s.title}」から外しました（写真は残ります）`, `Removed ${ids.length === 1 ? "1 photo" : `${ids.length} photos`} from “${s.title}” (the photos are kept)`),
      );
    } catch {
      fail(tx("シリーズから外せませんでした。", "Could not remove from the series."));
    }
  };
  return (
    <div className="st-context">
      {single && (
        <button
          type="button"
          className="st-ax-btn st-button"
          disabled={s.coverPhotoId === single.id}
          onClick={() => void setCover()}
        >
          {s.coverPhotoId === single.id ? tx("このシリーズの表紙です", "This is the series cover") : tx("このシリーズの表紙にする", "Make it the series cover")}
        </button>
      )}
      <button type="button" className="st-ax-btn st-button" onClick={() => void remove()}>
        {tx("このシリーズから外す", "Remove from this series")}
      </button>
    </div>
  );
}

// ── 1枚のとき ───────────────────────────────────────────

function useAutosave(photo: StudioPhoto, field: "title" | "description" | "camera" | "lens" | "shotAt") {
  const { fail, refresh, say } = useStudio();
  const raw = (photo[field] as string | null | undefined) ?? "";
  // 撮影日は日付だけを見せる（2026-10-01）。保存されている値は EXIF の時刻つき
  // （2026-03-11T00:15:53。本番の353枚すべて）で、欄に「T」入りの機械の形が
  // そのまま出ていた。時刻は捨てない: 日付を書き換えたときも元の時刻を付け直す。
  const timePart = field === "shotAt" && /^\d{4}-\d{2}-\d{2}T/.test(raw) ? raw.slice(10) : "";
  const initial = timePart ? raw.slice(0, 10) : raw;
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  const save = async () => {
    if (value === initial) return;
    if (field === "shotAt" && value && !/^\d{4}-\d{2}-\d{2}/.test(value)) {
      fail(tx("撮影日は 2025-10-04 の形で入れてください。", "Enter the date as 2025-10-04."));
      return;
    }
    const trimmed = value.trim();
    const next = timePart && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed + timePart : trimmed;
    try {
      await patchPhoto(photo.id, { [field]: next ? next : field === "title" || field === "description" ? "" : null });
      await refresh();
      say({ text: tx("保存しました", "Saved") });
    } catch {
      fail(tx("保存できませんでした。もう一度お試しください。", "Could not save. Please try again."));
    }
  };
  return { value, setValue, save };
}

function Single({
  data,
  photo,
  seriesContext,
  onClear,
  onOpenDetails,
  order,
}: {
  data: StudioData;
  photo: StudioPhoto;
  seriesContext?: number;
  onClear: () => void;
  onOpenDetails?: (photoId: number) => void;
  order?: InspectorOrder;
}) {
  const title = useAutosave(photo, "title");
  const description = useAutosave(photo, "description");
  const camera = useAutosave(photo, "camera");
  const lens = useAutosave(photo, "lens");
  const shotAt = useAutosave(photo, "shotAt");
  const { fail, refresh, say } = useStudio();
  const line = [shotLine(photo), photo.camera].filter(Boolean).join(" · ");
  const setCategory = async (slug: string) => {
    try {
      await patchPhoto(photo.id, { category: slug });
      await refresh();
      say({ text: tx("保存しました", "Saved") });
    } catch {
      fail(tx("分類を保存できませんでした。", "Could not save the category."));
    }
  };
  const rotate = async () => {
    try {
      await batch([photo.id], "rotate_right");
      await refresh();
    } catch {
      fail(tx("回転できませんでした。", "Could not rotate."));
    }
  };
  const keyToSave = (e: React.KeyboardEvent, save: () => Promise<void>) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      void save();
    }
  };
  return (
    <div className="st-inspector__body">
      <figure className="st-preview">
        <img src={adminPhotoSrc(photo, 1200, 80)} alt="" className="st-preview__img" />
        <figcaption className="st-preview__cap">
          <span className="st-preview__file">{photo.filename}</span>
          {line && <span>{line}</span>}
        </figcaption>
      </figure>

      {seriesContext != null && (
        <SeriesContextActions data={data} seriesId={seriesContext} photos={[photo]} onClear={onClear} />
      )}

      <Section title={tx("サイトに出す", "On the site")}>
        <PublishRow photos={[photo]} />
        <HeroRow data={data} photos={[photo]} />
      </Section>
      {order && <OrderRow order={order} count={1} />}

      <SeriesChecklist data={data} photos={[photo]} />

      <Section title={tx("言葉", "Words")}>
        <label className="st-field">
          <span className="st-field__label">{tx("題（なくても構いません）", "Title (optional)")}</span>
          <input
            className="st-input"
            value={title.value}
            onChange={(e) => title.setValue(e.target.value)}
            onBlur={() => void title.save()}
            onKeyDown={(e) => keyToSave(e, title.save)}
          />
        </label>
        <label className="st-field">
          <span className="st-field__label">{tx("説明", "Description")}</span>
          <textarea
            className="st-input st-input--area"
            rows={3}
            value={description.value}
            onChange={(e) => description.setValue(e.target.value)}
            onBlur={() => void description.save()}
          />
        </label>
      </Section>

      <Section title={tx("撮影", "Capture")}>
        <MediumRow photos={[photo]} />
        <div className="st-field-row">
          <label className="st-field">
            <span className="st-field__label">{tx("撮影日", "Date")}</span>
            <input
              className="st-input"
              value={shotAt.value}
              placeholder="2025-10-04"
              onChange={(e) => shotAt.setValue(e.target.value)}
              onBlur={() => void shotAt.save()}
              onKeyDown={(e) => keyToSave(e, shotAt.save)}
            />
          </label>
          {data.categories.length > 0 && (
            <label className="st-field">
              <span className="st-field__label">{tx("分類", "Category")}</span>
              <select
                className="st-input"
                value={photo.category ?? ""}
                onChange={(e) => void setCategory(e.target.value)}
              >
                <option value="">{tx("なし", "None")}</option>
                {data.categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="st-field">
          <span className="st-field__label">{tx("カメラ", "Camera")}</span>
          <input
            className="st-input"
            value={camera.value}
            onChange={(e) => camera.setValue(e.target.value)}
            onBlur={() => void camera.save()}
            onKeyDown={(e) => keyToSave(e, camera.save)}
          />
        </label>
        <label className="st-field">
          <span className="st-field__label">{tx("レンズ", "Lens")}</span>
          <input
            className="st-input"
            value={lens.value}
            onChange={(e) => lens.setValue(e.target.value)}
            onBlur={() => void lens.save()}
            onKeyDown={(e) => keyToSave(e, lens.save)}
          />
        </label>
      </Section>

      <div className="st-inspector__foot">
        <button type="button" className="st-ax-btn st-link" onClick={() => void rotate()}>
          {tx("右に90°回す", "Rotate 90° right")}
        </button>
        {onOpenDetails && (
          <button type="button" className="st-ax-btn st-link" onClick={() => onOpenDetails(photo.id)}>
            {tx("構図・詳しい道具", "Crop and more tools")}
          </button>
        )}
        <TrashButton photos={[photo]} onDone={onClear} />
      </div>
    </div>
  );
}

// ── 複数のとき ─────────────────────────────────────────

function Many({
  data,
  photos,
  seriesContext,
  onClear,
  order,
}: {
  data: StudioData;
  photos: StudioPhoto[];
  seriesContext?: number;
  onClear: () => void;
  order?: InspectorOrder;
}) {
  const strip = useMemo(() => photos.slice(0, 12), [photos]);
  const { fail, refresh, remember } = useStudio();
  const setCategory = async (slug: string) => {
    const before = new Map<string, number[]>();
    for (const p of photos) before.set(p.category ?? "", [...(before.get(p.category ?? "") ?? []), p.id]);
    try {
      await batch(photos.map((p) => p.id), "category", slug);
      await refresh();
      remember(
        {
          label: tx("分類", "Category"),
          run: async () => {
            for (const [c, ids] of before) await batch(ids, "category", c);
          },
        },
        tx(`${photos.length}枚の分類を変えました`, `Changed the category of ${photos.length} photos`),
      );
    } catch {
      fail(tx("分類を保存できませんでした。", "Could not save the category."));
    }
  };
  return (
    <div className="st-inspector__body">
      <div className="st-strip" aria-hidden="true">
        {strip.map((p) => (
          <img key={p.id} src={adminPhotoSrc(p, 240, 60)} alt="" />
        ))}
        {photos.length > strip.length && <span className="st-strip__more">＋{photos.length - strip.length}</span>}
      </div>
      {seriesContext != null && (
        <SeriesContextActions data={data} seriesId={seriesContext} photos={photos} onClear={onClear} />
      )}
      <Section title={tx("サイトに出す", "On the site")}>
        <PublishRow photos={photos} />
        <HeroRow data={data} photos={photos} />
      </Section>
      {order && <OrderRow order={order} count={photos.length} />}
      <SeriesChecklist data={data} photos={photos} />
      <Section title={tx("撮影", "Capture")}>
        <MediumRow photos={photos} />
        {data.categories.length > 0 && (
          <label className="st-field">
            <span className="st-field__label">{tx("分類", "Category")}</span>
            <select
              className="st-input"
              value=""
              onChange={(e) => e.target.value !== "__" && void setCategory(e.target.value)}
            >
              <option value="__">{tx("まとめて変える…", "Change all…")}</option>
              <option value="">{tx("なし", "None")}</option>
              {data.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </Section>
      <div className="st-inspector__foot">
        <TrashButton photos={photos} onDone={onClear} />
      </div>
    </div>
  );
}
