import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, api, jsonOrThrow } from "../lib/api";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { planCoverSave, type PagePhoto } from "../lib/page-photos";
import {
  developListPhotos,
  isDevelopDesignValue,
  parsePhotoIdList,
  type DevelopListKind,
} from "../../shared/develop-structure";
import { PagePhotoEditor } from "../components/page-photos/PagePhotoEditor";
import {
  assertOk,
  jsonOrThrow as adminJsonOrThrow,
  postAdminSettings,
  type HeroPhotoRow,
} from "./admin-shared";

/** 表紙の登録を読む（今までの管理画面の「トップに出す」と同じ一覧）。 */
async function loadCoverRows(): Promise<{ heroPhotos: HeroPhotoRow[] }> {
  return adminJsonOrThrow(await adminApi["hero-photos"].$get());
}

const LIST_KEY = { portrait: "developPortraitIds", life: "developLifeIds" } as const;
const PAGE_NAME = { cover: "表紙", portrait: "Portrait", life: "Life" } as const;
/** 表紙（トップの最初の写真）と、写真を選んで並べる2つのページ。 */
type Tab = "cover" | DevelopListKind;
const TABS: readonly Tab[] = ["cover", "portrait", "life"];
type SavedKey = (typeof LIST_KEY)[DevelopListKind] | "siteDesign" | "heroMode";
type Toast = { text: string; undo?: () => void };

/**
 * ページの写真（/admin/pages、2026-10-11）。
 *
 * 新しい構成（siteDesign = "develop"）の Portrait／Life に出す写真を選んで並べる画面と、
 * サイトの構成（今までの構成 ⇄ 新しい構成）の切り替え。
 *
 * - 表紙（トップの最初の写真）もここで選ぶ（2026-10-13）。登録先は今までの管理画面の「トップに出す」と
 *   同じ（hero_photos）。表紙の出し方（1枚／スライド）も、今までの設定 `heroMode` をそのまま使う
 * - 並びを変えると、その場で保存する（`developPortraitIds`／`developLifeIds`）。失敗したら元へ戻して知らせる
 * - まだ何も選んでいないページは、いま出ている写真（分類から）をそのまま見せる。動かしたら、その並びを保存する
 * - 構成の切り替えは、公開サイトが変わるので、押してから一度確かめる
 */
export default function AdminPagesPage() {
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

  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const photosQ = useQuery({
    queryKey: ["photos"],
    queryFn: async () => jsonOrThrow(await api.photos.$get()),
  });
  const seriesQ = useQuery({
    queryKey: ["series"],
    queryFn: async () => jsonOrThrow(await api.series.$get()),
  });
  const worksQ = useQuery({
    queryKey: ["works"],
    queryFn: async () => jsonOrThrow(await api.series.$get({ query: { kind: "work" } })),
  });
  const settings = settingsQ.data;

  // 表紙の登録（今までの管理画面の「トップに出す」と同じ物）。
  const heroQ = useQuery({
    queryKey: ["admin-hero-photos"],
    queryFn: loadCoverRows,
    enabled: auth === "ok",
  });

  const [tab, setTab] = useState<Tab>("portrait");
  // 表紙の並び（保存しようとしている物）。保存して読み直すまでの間、画面はこちらを見る。
  const [localCover, setLocalCover] = useState<number[] | null>(null);
  // 保存した（保存しようとしている）値。設定を読み直すまでの間、画面はこちらを見る。
  const [local, setLocal] = useState<Partial<Record<SavedKey, string>>>({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [asking, setAsking] = useState<"develop" | "classic" | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const savedValue = useCallback(
    (key: SavedKey): string => local[key] ?? (settings?.[key] as string | null | undefined) ?? "",
    [local, settings],
  );

  // 保存は1つずつ順に送る（続けて動かしても、後の並びが前の並びに上書きされない）。
  const save = useCallback(
    (key: SavedKey, value: string, message: string, previous: string, undoable = true) => {
      setError("");
      setLocal((l) => ({ ...l, [key]: value }));
      queue.current = queue.current.then(async () => {
        try {
          await postAdminSettings({ [key]: value });
          await queryClient.invalidateQueries({ queryKey: ["settings"] });
          setToast({
            text: message,
            undo: undoable ? () => save(key, previous, "元に戻しました", value, false) : undefined,
          });
        } catch (e) {
          setLocal((l) => ({ ...l, [key]: previous }));
          setToast(null);
          setError(`保存できませんでした（${e instanceof Error ? e.message : "通信エラー"}）。もう一度お試しください。`);
        }
      });
    },
    [queryClient],
  );

  const photos = useMemo(
    () => sortPhotosBySetting(photosQ.data?.photos ?? [], "manual") as unknown as PagePhoto[],
    [photosQ.data],
  );
  const visibleIds = useMemo(() => new Set(photos.map((p) => p.id)), [photos]);
  // 表紙に選んである写真（公開中の物だけ。選んだ順）。
  const coverIds = useMemo(
    () => localCover ?? (heroQ.data?.heroPhotos ?? []).map((row) => row.photoId).filter((id) => visibleIds.has(id)),
    [localCover, heroQ.data, visibleIds],
  );
  // 表紙の保存：外す・足す・並べ替えを、今までの管理画面と同じ API へ順に送る（lib/page-photos.ts の planCoverSave）。
  const saveCover = useCallback(
    (next: number[], message: string, previous: number[], undoable = true) => {
      setError("");
      setLocalCover(next);
      queue.current = queue.current.then(async () => {
        try {
          const rows = await loadCoverRows();
          const plan = planCoverSave(
            (rows.heroPhotos ?? []).map((row) => row.photoId),
            visibleIds,
            next,
          );
          for (const id of plan.remove)
            assertOk(await adminApi["hero-photos"][":id"].$delete({ param: { id: String(id) } }));
          for (const id of plan.add) assertOk(await adminApi["hero-photos"].$post({ json: { photoId: id } }));
          if (plan.reorder) assertOk(await adminApi["hero-photos"].reorder.$post({ json: plan.reorder }));
          setToast({
            text: message,
            undo: undoable ? () => saveCover(previous, "元に戻しました", next, false) : undefined,
          });
        } catch (e) {
          setToast(null);
          setError(`保存できませんでした（${e instanceof Error ? e.message : "通信エラー"}）。もう一度お試しください。`);
        } finally {
          // 成功しても失敗しても、登録を読み直してから画面を合わせる（途中まで進んで止まった場合も実物どおりに）。
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["admin-hero-photos"] }),
            queryClient.invalidateQueries({ queryKey: ["hero-photos"] }),
          ]).catch(() => {});
          setLocalCover(null);
        }
      });
    },
    [queryClient, visibleIds],
  );
  const lists = useMemo(
    () => ({
      portrait: developListPhotos("portrait", photos, savedValue("developPortraitIds")).map((p) => p.id),
      life: developListPhotos("life", photos, savedValue("developLifeIds")).map((p) => p.id),
    }),
    [photos, savedValue],
  );
  const used = useMemo(() => new Set([...lists.portrait, ...lists.life]), [lists]);
  const usedOnCover = useMemo(() => new Set<number>(coverIds), [coverIds]);
  const series = useMemo(
    () => [...(seriesQ.data?.series ?? []), ...(worksQ.data?.series ?? [])].map((s) => ({ id: s.id, title: s.title })),
    [seriesQ.data, worksQ.data],
  );

  const frame = (body: React.ReactNode) => (
    <div className="pp-root">
      <div className="pp-page">{body}</div>
    </div>
  );
  if (auth === "checking" || settingsQ.isLoading || photosQ.isLoading || (auth === "ok" && heroQ.isLoading))
    return frame(<p>読み込んでいます…</p>);
  if (auth === "no")
    return frame(
      <p>
        この画面はログインが必要です。<a href="/admin/login">ログインする</a>
      </p>,
    );
  if (settingsQ.isError || photosQ.isError || heroQ.isError)
    return frame(
      <p className="pp-error" role="alert">
        読み込めませんでした。接続を確かめて、読み込み直してください。
      </p>,
    );

  const key = tab === "cover" ? null : LIST_KEY[tab];
  const picked = key ? parsePhotoIdList(savedValue(key)).length > 0 : coverIds.length > 0;
  // 表紙の出し方。今までの設定 heroMode をそのまま使う（1枚＝single、それ以外はスライドとして出る）。
  const heroMode = savedValue("heroMode") || "carousel";
  const coverSingle = heroMode === "single";
  const counts = { cover: coverIds.length, portrait: lists.portrait.length, life: lists.life.length };
  const design = savedValue("siteDesign");
  const isDevelop = isDevelopDesignValue(design);

  return frame(
    <>
      {/* スマホでは「戻る・題・サイトで見る」を1行にまとめる（題に1行使うと、写真の始まりが 40px 下がる）。 */}
      <header className="pp-head">
        <a className="pp-back" href="/admin" aria-label="管理画面へ戻る">
          <span aria-hidden="true">←</span>
          <span>
            <span className="pp-back__long">管理画面へ</span>戻る
          </span>
        </a>
        <h1>ページの写真</h1>
        {/* いま並べているページを、新しい構成で開く（保存した構成が今までの物でも、下見できる）。 */}
        <a
          className="pp-back pp-back--view"
          href={`/${tab === "cover" ? "" : tab}?design=develop`}
          target="_blank"
          rel="noopener"
        >
          サイトで見る ↗
        </a>
        <p className="pp-head__lead">
          新しい構成（Portrait・Life・Series・Info）の表紙と、ページに出す写真を選んで、並べます。変えると、その場で保存されます。
        </p>
      </header>

      <div className="pp-tabs" role="tablist" aria-label="ページ">
        {TABS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={tab === kind}
            data-pp-tab={kind}
            onClick={() => setTab(kind)}
          >
            {PAGE_NAME[kind]}
            <small>{counts[kind]}</small>
          </button>
        ))}
      </div>
      {error && (
        <p className="pp-error" role="alert">
          {error}
        </p>
      )}
      {tab === "cover" ? (
        <>
          {/* 表紙の出し方：1枚だけ出すか、選んだ順に入れ替えるか（今までの設定と同じ物）。 */}
          <fieldset className="pp-cover-mode">
            <legend className="sr-only">表紙の出し方</legend>
            <span className="pp-cover-mode__label" aria-hidden="true">
              出し方
            </span>
            <button
              type="button"
              aria-pressed={coverSingle}
              data-pp-cover-mode="single"
              onClick={() => !coverSingle && save("heroMode", "single", "表紙を1枚にしました", heroMode)}
            >
              1枚
            </button>
            <button
              type="button"
              aria-pressed={!coverSingle}
              data-pp-cover-mode="carousel"
              onClick={() => coverSingle && save("heroMode", "carousel", "表紙をスライドにしました", heroMode)}
            >
              スライド
            </button>
          </fieldset>
          <p className="pp-note">
            {!picked
              ? "まだ選んでいないので、写真の並びの先頭が表紙になっています。足すと、その写真が表紙になります。"
              : coverSingle
                ? coverIds.length > 1
                  ? "いまは「1枚」なので、先頭の写真だけが出ます。「スライド」にすると、この順に入れ替わります。"
                  : "この写真が、トップを開いたときの表紙です。"
                : "この順に入れ替わります。"}
          </p>
          <PagePhotoEditor
            key="cover"
            photos={photos}
            value={coverIds}
            used={usedOnCover}
            series={series}
            name={PAGE_NAME.cover}
            onChange={(next, message) => saveCover(next, message, coverIds)}
          />
        </>
      ) : (
        <>
          {!picked && (
            <p className="pp-note">
              いまは写真の分類から出しています。動かしたり足したりすると、その並びが保存されます。
            </p>
          )}
          <PagePhotoEditor
            key={tab}
            photos={photos}
            value={lists[tab]}
            used={used}
            series={series}
            name={PAGE_NAME[tab]}
            onChange={(next, message) => save(LIST_KEY[tab], next.join(","), message, savedValue(LIST_KEY[tab]))}
          />
        </>
      )}

      <section className="pp-design" aria-label="サイトの構成">
        <h2>サイトの構成</h2>
        <p>
          どちらを選んでも、もう片方は消えません。写真・シリーズ・料金・自己紹介と、今までの設定はそのまま残ります。表紙の写真は、管理画面の「写真」で「トップに出す」を選びます。
        </p>
        <div className="pp-design__choices">
          <button type="button" aria-pressed={!isDevelop} data-pp-design="classic" onClick={() => setAsking(isDevelop ? "classic" : null)}>
            {!isDevelop && <i>使用中</i>}
            <b>今までの構成</b>
            <span>Gallery・Series・Work・About・Contact</span>
          </button>
          <button type="button" aria-pressed={isDevelop} data-pp-design="develop" onClick={() => setAsking(isDevelop ? null : "develop")}>
            {isDevelop && <i>使用中</i>}
            <b>新しい構成</b>
            <span>Portrait・Life・Series・Info</span>
          </button>
        </div>
        {asking && (
          <div className="pp-design__confirm" role="alertdialog" aria-label="構成の切り替え">
            <span>
              公開サイトが「{asking === "develop" ? "新しい構成" : "今までの構成"}」に切り替わります。見ている人の画面も変わります。
            </span>
            <button
              type="button"
              className="pp-button pp-button--solid"
              data-pp-confirm
              onClick={() => {
                save(
                  "siteDesign",
                  asking,
                  asking === "develop" ? "新しい構成に切り替えました" : "今までの構成に切り替えました",
                  design,
                );
                setAsking(null);
              }}
            >
              切り替える
            </button>
            <button type="button" className="pp-button" onClick={() => setAsking(null)}>
              やめる
            </button>
          </div>
        )}
        <div className="pp-design__links">
          <a href="/?design=develop" target="_blank" rel="noopener">
            新しい構成を下見する ↗
          </a>
          <a href="/?design=classic" target="_blank" rel="noopener">
            今までの構成で見る ↗
          </a>
        </div>
      </section>

      <output className="pp-toast" data-show={toast ? "" : undefined} aria-live="polite">
        <span>{toast?.text}</span>
        {toast?.undo && (
          <button
            type="button"
            onClick={() => {
              const undo = toast.undo;
              setToast(null);
              undo?.();
            }}
          >
            元に戻す
          </button>
        )}
      </output>
    </>,
  );
}
