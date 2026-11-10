import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, api, jsonOrThrow } from "../lib/api";
import { assertOk } from "./admin-shared";
import "../components/page-photos/page-photos.css";
import "../components/admin-words/admin-words.css";

type WordPhoto = {
  id: number;
  url: string;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  filename?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  width?: number | null;
  height?: number | null;
};
type Draft = { title: string; description: string; category: string };
type Scope = "todo" | "all";

const draftOf = (photo: WordPhoto): Draft => ({
  title: photo.title ?? "",
  description: photo.description ?? "",
  category: photo.category ?? "",
});
/** まだ言葉の無い写真（題が空）。分類だけ付いた写真も、題が無ければ「まだ」。 */
const needsWords = (draft: Draft) => draft.title.trim() === "";

/**
 * 言葉を付ける（/admin/words、2026-11-10）。
 *
 * 写真1枚ずつに、題・説明・分類を付けていく画面。オーナー「題・説明・分類を書く」のが一番つらい、
 * 「スマホでも使いづらい」。公開中の写真 353 枚のうち題は 0 件だった。
 *
 * - 1画面に写真は1枚。写真を見ながら書き、下の「保存して次へ」で次の写真へ（親指の届く所に置く）
 * - 始めは「まだの写真」だけを順に出す。途中でやめても、次に開くと続きから
 * - 何も変えていなければ保存は送らない。失敗したら、その写真に留まって知らせる
 * - 分類は押して選ぶ（もう一度押すと外す）。Portrait／Life のページは、この分類から写真が出る
 */
export default function AdminWordsPage() {
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState<"checking" | "ok" | "no">("checking");
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ authenticated?: boolean }>) : { authenticated: false }))
      .then((j) => alive && setAuth(j.authenticated ? "ok" : "no"))
      .catch(() => alive && setAuth("no"));
    return () => {
      alive = false;
    };
  }, []);

  const photosQ = useQuery({
    queryKey: ["admin-words-photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get({ query: { all: "1" } })),
    enabled: auth === "ok",
    staleTime: Infinity,
  });
  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: async () => jsonOrThrow(await api.categories.$get()),
  });
  const photos = useMemo(() => (photosQ.data?.photos ?? []) as unknown as WordPhoto[], [photosQ.data]);
  const categories = categoriesQ.data?.categories ?? [];

  // 保存した言葉（読み直すまでの間、画面はこちらを見る）と、いま書いている言葉。
  const [saved, setSaved] = useState<Record<number, Draft>>({});
  const savedOf = useCallback((photo: WordPhoto): Draft => saved[photo.id] ?? draftOf(photo), [saved]);
  const [scope, setScope] = useState<Scope>("todo");
  // 並びは、開いたとき（と切り替えたとき）に決める。書いている途中で写真が列から消えないように。
  const [queue, setQueue] = useState<number[] | null>(null);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const buildQueue = useCallback(
    (next: Scope) => photos.filter((p) => next === "all" || needsWords(savedOf(p))).map((p) => p.id),
    [photos, savedOf],
  );
  useEffect(() => {
    if (queue !== null || photos.length === 0) return;
    const todo = buildQueue("todo");
    // 全部に題が付いていれば、すべての写真を見直せるようにする。
    if (todo.length === 0) setScope("all");
    setQueue(todo.length > 0 ? todo : buildQueue("all"));
  }, [queue, photos.length, buildQueue]);

  const current = queue && queue.length > 0 ? (byId.get(queue[Math.min(index, queue.length - 1)]!) ?? null) : null;
  useEffect(() => {
    setDraft(current ? savedOf(current) : null);
    setError("");
    // savedOf は保存のたびに変わる。書いている途中の言葉を戻さないよう、写真が変わったときだけ読む。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const total = photos.length;
  const done = useMemo(() => photos.filter((p) => !needsWords(savedOf(p))).length, [photos, savedOf]);
  const base = current ? savedOf(current) : null;
  const changed =
    !!draft && !!base && (draft.title !== base.title || draft.description !== base.description || draft.category !== base.category);

  const switchScope = (next: Scope) => {
    if (next === scope) return;
    setScope(next);
    setQueue(buildQueue(next));
    setIndex(0);
  };
  const move = (step: number) => {
    if (!queue) return;
    setIndex((i) => Math.max(0, Math.min(queue.length, i + step)));
    topRef.current?.scrollIntoView({ block: "start" });
  };
  const saveAndNext = async () => {
    if (!current || !draft || busy) return;
    if (!changed) return move(1);
    setBusy(true);
    setError("");
    const body = { title: draft.title.trim(), description: draft.description.trim(), category: draft.category };
    try {
      assertOk(await adminApi.photos[":id"].$patch({ param: { id: String(current.id) }, json: body }));
      setSaved((s) => ({ ...s, [current.id]: body }));
      // 公開サイトと、ほかの管理画面が持っている写真の控えを読み直させる。
      void queryClient.invalidateQueries({ queryKey: ["photos"] });
      move(1);
    } catch (e) {
      setError(`保存できませんでした（${e instanceof Error ? e.message : "通信エラー"}）。もう一度お試しください。`);
    } finally {
      setBusy(false);
    }
  };

  const frame = (body: React.ReactNode) => (
    <div className="pp-root aw-root">
      <div className="aw-page" ref={topRef}>
        {body}
      </div>
    </div>
  );
  if (auth === "checking" || (auth === "ok" && (photosQ.isLoading || queue === null) && !photosQ.isError && !(photosQ.data && photos.length === 0)))
    return frame(<p className="aw-plain">読み込んでいます…</p>);
  if (auth === "no")
    return frame(
      <p className="aw-plain">
        この画面はログインが必要です。<a href="/admin/login">ログインする</a>
      </p>,
    );
  if (photosQ.isError)
    return frame(
      <p className="pp-error" role="alert">
        読み込めませんでした。接続を確かめて、読み込み直してください。
      </p>,
    );

  const head = (
    <header className="aw-head">
      <a className="aw-back" href="/admin" aria-label="管理画面へ戻る">
        ← 戻る
      </a>
      <h1>言葉を付ける</h1>
      <p className="aw-count" aria-live="polite">
        <b>{done}</b> / {total} 枚
      </p>
      <div className="aw-bar" aria-hidden="true">
        <span style={{ width: total > 0 ? `${(done / total) * 100}%` : 0 }} />
      </div>
      <fieldset className="aw-scope">
        <legend className="sr-only">出す写真</legend>
        <button type="button" aria-pressed={scope === "todo"} onClick={() => switchScope("todo")}>
          まだの写真
        </button>
        <button type="button" aria-pressed={scope === "all"} onClick={() => switchScope("all")}>
          すべて
        </button>
      </fieldset>
    </header>
  );

  if (total === 0) return frame(<>{head}<p className="aw-plain">まだ写真がありません。<a href="/admin">写真を加える</a></p></>);
  const finished = !current || !draft || (queue !== null && index >= queue.length);
  if (finished)
    return frame(
      <>
        {head}
        <div className="aw-finish">
          <p className="aw-finish__title">{scope === "todo" && done < total ? "ここまでです" : "最後の写真まで来ました"}</p>
          <p>
            題の付いた写真は {done} / {total} 枚です。
          </p>
          <p className="aw-finish__actions">
            {done < total && (
              <button
                type="button"
                className="aw-primary"
                onClick={() => {
                  setScope("todo");
                  setQueue(buildQueue("todo"));
                  setIndex(0);
                }}
              >
                残りを続ける
              </button>
            )}
            <a className="aw-quiet" href="/admin">
              管理画面へ戻る
            </a>
          </p>
        </div>
      </>,
    );

  const ratio = current.width && current.height ? `${current.width} / ${current.height}` : undefined;
  return frame(
    <>
      {head}
      <form
        className="aw-card"
        onSubmit={(e) => {
          e.preventDefault();
          void saveAndNext();
        }}
      >
        <figure className="aw-photo">
          <img
            key={current.id}
            src={current.mediumUrl || current.thumbUrl || current.url}
            alt=""
            style={{ aspectRatio: ratio }}
            draggable={false}
          />
          <figcaption>
            {queue ? `${Math.min(index, queue.length - 1) + 1} / ${queue.length}` : ""}
            {current.filename ? `　${current.filename}` : ""}
          </figcaption>
        </figure>
        <div className="aw-fields">
          <label className="aw-field">
            <span>題</span>
            <input
              ref={titleRef}
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              enterKeyHint="next"
              autoComplete="off"
              maxLength={120}
            />
          </label>
          <label className="aw-field">
            <span>説明</span>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              maxLength={2000}
            />
          </label>
          {categories.length > 0 && (
            <fieldset className="aw-field aw-cats">
              <legend>分類</legend>
              <div className="aw-chips">
                {categories.map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    aria-pressed={draft.category === cat.slug}
                    onClick={() => setDraft({ ...draft, category: draft.category === cat.slug ? "" : cat.slug })}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {error && (
            <p className="pp-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="aw-dock">
          <button type="button" className="aw-step" onClick={() => move(-1)} disabled={index === 0 || busy} aria-label="前の写真">
            ←
          </button>
          <button type="button" className="aw-skip" onClick={() => move(1)} disabled={busy}>
            あとで
          </button>
          <button type="submit" className="aw-primary" disabled={busy}>
            {busy ? "保存しています…" : changed ? "保存して次へ" : "次へ"}
          </button>
        </div>
      </form>
    </>,
  );
}
