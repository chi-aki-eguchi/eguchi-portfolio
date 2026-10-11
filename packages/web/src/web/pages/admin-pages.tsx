import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { sortPhotosBySetting } from "../lib/photo-sort";
import type { PagePhoto } from "../lib/page-photos";
import {
  developListPhotos,
  isDevelopDesignValue,
  parsePhotoIdList,
  type DevelopListKind,
} from "../../shared/develop-structure";
import { PagePhotoEditor } from "../components/page-photos/PagePhotoEditor";
import { postAdminSettings } from "./admin-shared";

const LIST_KEY = { portrait: "developPortraitIds", life: "developLifeIds" } as const;
const PAGE_NAME = { portrait: "Portrait", life: "Life" } as const;
type SavedKey = (typeof LIST_KEY)[DevelopListKind] | "siteDesign";
type Toast = { text: string; undo?: () => void };

/**
 * ページの写真（/admin/pages、2026-10-11）。
 *
 * 新しい構成（siteDesign = "develop"）の Portrait／Life に出す写真を選んで並べる画面と、
 * サイトの構成（今までの構成 ⇄ 新しい構成）の切り替え。
 *
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

  const [tab, setTab] = useState<DevelopListKind>("portrait");
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
  const lists = useMemo(
    () => ({
      portrait: developListPhotos("portrait", photos, savedValue("developPortraitIds")).map((p) => p.id),
      life: developListPhotos("life", photos, savedValue("developLifeIds")).map((p) => p.id),
    }),
    [photos, savedValue],
  );
  const used = useMemo(() => new Set([...lists.portrait, ...lists.life]), [lists]);
  const series = useMemo(
    () => [...(seriesQ.data?.series ?? []), ...(worksQ.data?.series ?? [])].map((s) => ({ id: s.id, title: s.title })),
    [seriesQ.data, worksQ.data],
  );

  const frame = (body: React.ReactNode) => (
    <div className="pp-root">
      <div className="pp-page">{body}</div>
    </div>
  );
  if (auth === "checking" || settingsQ.isLoading || photosQ.isLoading) return frame(<p>読み込んでいます…</p>);
  if (auth === "no")
    return frame(
      <p>
        この画面はログインが必要です。<a href="/admin/login">ログインする</a>
      </p>,
    );
  if (settingsQ.isError || photosQ.isError)
    return frame(
      <p className="pp-error" role="alert">
        読み込めませんでした。接続を確かめて、読み込み直してください。
      </p>,
    );

  const key = LIST_KEY[tab];
  const picked = parsePhotoIdList(savedValue(key)).length > 0;
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
        <a className="pp-back pp-back--view" href={`/${tab}?design=develop`} target="_blank" rel="noopener">
          サイトで見る ↗
        </a>
        <p className="pp-head__lead">
          新しい構成（Portrait・Life・Series・Info）のページに出す写真を選んで、並べます。変えると、その場で保存されます。
        </p>
      </header>

      <div className="pp-tabs" role="tablist" aria-label="ページ">
        {(["portrait", "life"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={tab === kind}
            data-pp-tab={kind}
            onClick={() => setTab(kind)}
          >
            {PAGE_NAME[kind]}
            <small>{lists[kind].length}</small>
          </button>
        ))}
      </div>
      {error && (
        <p className="pp-error" role="alert">
          {error}
        </p>
      )}
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
        onChange={(next, message) => save(key, next.join(","), message, savedValue(key))}
      />

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
