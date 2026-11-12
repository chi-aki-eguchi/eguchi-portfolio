import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, api, jsonOrThrow } from "../lib/api";
import { sortPhotosBySetting } from "../lib/photo-sort";
import { planCoverSave, type PagePhoto } from "../lib/page-photos";
import {
  developTopStyle,
  developDoorCopy,
  developListPhotos,
  isDevelopDesignValue,
  parsePhotoIdList,
  type DevelopListKind,
} from "../../shared/develop-structure";
import { tokyoPhotoIds } from "../../shared/tokyo-shoot";
import { EXHIBITION_BUILT_IN, exhibitionPhotoList, exhibitionShowsWall } from "../../shared/exhibition";
import {
  EXHIBITION_ARCHIVE_MAX,
  exhibitionDisplayTitle,
  exhibitionEntries,
  exhibitionPath,
  newExhibitionSlug,
  readExhibitionArchive,
  writeExhibitionArchive,
  type ExhibitionRecord,
} from "../../shared/exhibitions";
import { isServiceOwnerSite } from "../../shared/service-visibility";
import { AdminBottomBar, safeAdminFrom } from "../components/admin-book/AdminBottomBar";
import { DoorNames } from "../components/page-photos/DoorNames";
import { ExhibitionCaptions, ExhibitionCopy, ExhibitionVisits } from "../components/page-photos/ExhibitionPanel";
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
/** 東京の撮影プラン（/tokyo）の作例。オーナー本人のサイトにだけ在るページなので、タブもそこでだけ出す。 */
const TOKYO_KEY = "tokyoPhotoIds";
const TOKYO_NAME = "東京";
/** 表紙のタブの名前。Portrait／Life は扉の名前（設定 developDoors）から。 */
const COVER_NAME = "表紙";
/** 展示のタブの名前。 */
const EXHIBITION_NAME = "展示";
/** トップの展示、表紙（トップの最初の写真）と、写真を選んで並べる2つのページ。 */
type Tab = "exhibition" | "cover" | DevelopListKind | "tokyo";
const TABS: readonly Tab[] = ["exhibition", "cover", "portrait", "life", "tokyo"];
type SavedKey =
  | (typeof LIST_KEY)[DevelopListKind]
  | typeof TOKYO_KEY
  | "siteDesign"
  | "heroMode"
  | "developDoors"
  | "exhibitionOnTop"
  | "exhibitionTitle"
  | "exhibitionDates"
  | "exhibitionText"
  | "exhibitionThanks"
  | "exhibitionPhotoIds"
  | "exhibitionCaptions"
  | "exhibitionArchive";
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
 * - 展示（2026-10-31、shared/exhibition.ts）は、トップに出すかどうか・写真・題と会期をここで変える。
 *   同梱の写真とライブラリの写真は同じ並びに入れられる。止めるといつものトップに戻る
 * - 展示は何件でも足せる（2026-11-10、shared/exhibitions.ts）。前の展示・次の展示を、写真を選んで
 *   題と会期を書けば、サイトの Exhibition に同じ形で並ぶ。写真を1枚選ぶまでは公開されない
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

  // 展示をトップに出している間は、展示のタブから開く。押して選んだタブが優先。
  // 「サイト」の各ページの中から来たときは ?tab= で開くタブが決まる（知らない値は無視）。
  // ?from= は戻る先（/admin から始まる同じサイトの道だけ。無ければ「サイト」へ）。
  const [requestedTab] = useState<Tab | null>(() => {
    const raw = new URLSearchParams(window.location.search).get("tab");
    return TABS.find((kind) => kind === raw) ?? null;
  });
  const [backHref] = useState(() => safeAdminFrom(new URLSearchParams(window.location.search).get("from"), "/admin#site"));
  // 「サイト」→ トップ →「扉の名前」から来たときは、扉の名前の欄を開いて見せる（?focus=doors、2026-11-12）。
  const [focusDoors] = useState(() => new URLSearchParams(window.location.search).get("focus") === "doors");
  const pageReady = Boolean(settingsQ.data && photosQ.data);
  useEffect(() => {
    if (!focusDoors || !pageReady) return;
    const id = requestAnimationFrame(() => {
      const doors = document.querySelector<HTMLDetailsElement>(".pp-doors");
      if (!doors) return;
      doors.open = true;
      doors.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [focusDoors, pageReady]);
  const [chosenTab, setTab] = useState<Tab | null>(null);
  // 展示のタブで、いま編集している展示（slug）。選んでいなければ、一覧の先頭。
  const [chosenShow, setShow] = useState<string | null>(null);
  // 呼ばれたタブがこのサイトに出ない物（配布先の展示・東京プラン）なら、いつもの開き方にする。
  const requestedShown =
    requestedTab !== null &&
    (requestedTab === "tokyo"
      ? isServiceOwnerSite(settings?.siteUrl as string | undefined, window.location.hostname)
      : requestedTab !== "exhibition" ||
        settings?.exhibitionOnTop === "on" ||
        isServiceOwnerSite(settings?.siteUrl as string | undefined, window.location.hostname));
  const tab: Tab =
    chosenTab ?? (requestedShown ? requestedTab : settings?.exhibitionOnTop === "on" ? "exhibition" : "portrait");
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
  // 東京の撮影プランの作例。選んでいなければ仮の並び（消した・公開をやめた写真は飛ばす）。
  const tokyoIds = useMemo(() => {
    const live = new Set(photos.map((photo) => photo.id));
    return tokyoPhotoIds(savedValue(TOKYO_KEY)).filter((id) => live.has(id));
  }, [photos, savedValue]);
  const usedOnTokyo = useMemo(() => new Set<number>(tokyoIds), [tokyoIds]);
  // 展示の候補は、同梱の写真＋公開中の写真。
  const exhibitionCatalog = useMemo(() => [...EXHIBITION_BUILT_IN, ...photos] as PagePhoto[], [photos]);
  const exhibitionPhotos = useMemo(
    () => exhibitionPhotoList(savedValue("exhibitionPhotoIds"), photos) as PagePhoto[],
    [photos, savedValue],
  );
  const exhibitionIds = useMemo(() => exhibitionPhotos.map((p) => p.id), [exhibitionPhotos]);
  // 展示の一覧（新しい順。日藝祭の展示と、足した展示）。保存しようとしている値で見る。
  const archiveValue = savedValue("exhibitionArchive");
  const archive = useMemo(() => readExhibitionArchive(archiveValue), [archiveValue]);
  const shows = useMemo(
    () =>
      exhibitionEntries(
        {
          ...(settings as Record<string, string | null | undefined> | undefined),
          siteDesign: "develop",
          exhibitionArchive: archiveValue,
          exhibitionTitle: savedValue("exhibitionTitle"),
          exhibitionDates: savedValue("exhibitionDates"),
        },
        window.location.hostname,
      ),
    [settings, archiveValue, savedValue],
  );
  const show = shows.find((entry) => entry.slug === chosenShow) ?? shows[0] ?? null;
  const record = show && !show.builtIn ? (archive.find((entry) => entry.slug === show.slug) ?? null) : null;
  const recordPhotos = useMemo(() => {
    if (!record) return [];
    const byId = new Map(photos.map((photo) => [photo.id, photo]));
    return parsePhotoIdList(record.photoIds)
      .map((id) => byId.get(id))
      .filter((photo): photo is PagePhoto => Boolean(photo));
  }, [record, photos]);
  const recordIds = useMemo(() => recordPhotos.map((photo) => photo.id), [recordPhotos]);
  const usedOnRecord = useMemo(() => new Set<number>(recordIds), [recordIds]);
  const saveArchive = (next: ExhibitionRecord[], message: string) =>
    save("exhibitionArchive", writeExhibitionArchive(next), message, archiveValue);
  const patchRecord = (slug: string, patch: Partial<ExhibitionRecord>, message: string) =>
    saveArchive(
      archive.map((entry) => (entry.slug === slug ? { ...entry, ...patch } : entry)),
      message,
    );
  const addShow = () => {
    const slug = newExhibitionSlug(
      archive.map((entry) => entry.slug),
      Date.now().toString(36),
    );
    saveArchive([{ slug, title: "", dates: "", text: "", photoIds: "", captions: "" }, ...archive], "展示を足しました");
    setShow(slug);
  };
  const usedOnExhibition = useMemo(() => new Set<number>(exhibitionIds), [exhibitionIds]);
  const used = useMemo(() => new Set([...lists.portrait, ...lists.life]), [lists]);
  const usedOnCover = useMemo(() => new Set<number>(coverIds), [coverIds]);
  const series = useMemo(
    () => [...(seriesQ.data?.series ?? []), ...(worksQ.data?.series ?? [])].map((s) => ({ id: s.id, title: s.title })),
    [seriesQ.data, worksQ.data],
  );

  const frame = (body: React.ReactNode) => (
    <div className="pp-root">
      <div className="pp-page">{body}</div>
      {/* スマホの下の入口。この画面は「サイト」の中の一部なので、サイトを現在地にする。 */}
      <AdminBottomBar current="site" />
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

  const key = tab === "cover" || tab === "exhibition" ? null : tab === "tokyo" ? TOKYO_KEY : LIST_KEY[tab];
  const picked = key ? parsePhotoIdList(savedValue(key)).length > 0 : coverIds.length > 0;
  // 表紙の出し方。今までの設定 heroMode をそのまま使う（1枚＝single、それ以外はスライドとして出る）。
  const heroMode = savedValue("heroMode") || "carousel";
  const coverSingle = heroMode === "single";
  const counts = {
    exhibition: record ? recordIds.length : exhibitionIds.length,
    cover: coverIds.length,
    portrait: lists.portrait.length,
    life: lists.life.length,
    tokyo: tokyoIds.length,
  };
  // タブの名前は、扉の名前に合わせる（名前を変えたら、ここも変わる）。
  const doorCopy = developDoorCopy(savedValue("developDoors"));
  const pageName = {
    exhibition: EXHIBITION_NAME,
    cover: COVER_NAME,
    portrait: doorCopy.portrait.label,
    life: doorCopy.life.label,
    tokyo: TOKYO_NAME,
  };
  const design = savedValue("siteDesign");
  const isDevelop = isDevelopDesignValue(design);
  const exhibitionShown = savedValue("exhibitionOnTop") === "on";
  // 見開きのトップ（SpreadTop）では、表紙の1枚目と2枚目が左右の頁になる。
  const spreadTop = developTopStyle(settings?.developTopStyle as string | undefined) === "spread";
  // 同梱の写真は持ち主の物なので、配布版の管理画面には展示のタブを出さない。
  const ownerSite = isServiceOwnerSite(settings?.siteUrl as string | undefined, window.location.hostname);
  const tabs = TABS.filter((kind) =>
    kind === "tokyo" ? ownerSite : kind !== "exhibition" || exhibitionShown || ownerSite,
  );

  return frame(
    <>
      {/* スマホでは「戻る・題・サイトで見る」を1行にまとめる（題に1行使うと、写真の始まりが 40px 下がる）。 */}
      <header className="pp-head">
        <a className="pp-back" href={backHref} aria-label="管理画面へ戻る">
          <span aria-hidden="true">←</span>
          <span>
            <span className="pp-back__long">管理画面へ</span>戻る
          </span>
        </a>
        <h1>ページの写真</h1>
        {/* いま並べているページを、新しい構成で開く（保存した構成が今までの物でも、下見できる）。 */}
        <a
          className="pp-back pp-back--view"
          href={`${
            tab === "exhibition"
              ? show && (show.builtIn || recordIds.length > 0)
                ? exhibitionPath(show.slug)
                : "/"
              : tab === "cover"
                ? "/"
                : `/${tab}`
          }${tab === "tokyo" ? "" : "?design=develop"}`}
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
        {tabs.map((kind) => (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={tab === kind}
            data-pp-tab={kind}
            onClick={() => setTab(kind)}
          >
            {pageName[kind]}
            <small>{counts[kind]}</small>
          </button>
        ))}
      </div>
      {error && (
        <p className="pp-error" role="alert">
          {error}
        </p>
      )}
      {tab === "exhibition" && (
        /* どの展示を編集するか。足した展示は、サイトの Exhibition に新しい順で並ぶ。 */
        <fieldset className="pp-cover-mode pp-shows">
          <legend className="sr-only">編集する展示</legend>
          {shows.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              aria-pressed={show?.slug === entry.slug}
              data-pp-show={entry.slug}
              onClick={() => setShow(entry.slug)}
            >
              {entry.title || entry.dates ? exhibitionDisplayTitle(entry) : "（題のない展示）"}
            </button>
          ))}
          {archive.length < EXHIBITION_ARCHIVE_MAX && (
            <button type="button" aria-pressed={false} data-pp-show-add onClick={addShow}>
              ＋ 展示を足す
            </button>
          )}
        </fieldset>
      )}
      {tab === "exhibition" && record ? (
        <>
          <p className="pp-note">
            {recordIds.length === 0
              ? "写真を選ぶと、サイトの Exhibition に出ます。先頭の写真が表紙になり、この順に続きます。"
              : "先頭の写真が表紙になり、この順に続きます。"}
          </p>
          <PagePhotoEditor
            key={`show-${record.slug}`}
            photos={photos}
            value={recordIds}
            used={usedOnRecord}
            series={series}
            name={EXHIBITION_NAME}
            onChange={(next, message) => patchRecord(record.slug, { photoIds: next.join(",") }, message)}
          />
          <ExhibitionCopy
            builtIn={false}
            title={record.title}
            dates={record.dates}
            text={record.text}
            thanks=""
            onSave={(field, next, message) => {
              if (field === "exhibitionThanks") return;
              const key = field === "exhibitionTitle" ? "title" : field === "exhibitionDates" ? "dates" : "text";
              // まだ公開していない展示（写真なし）は、会期の年が分かった時点で住所に年を入れる。
              // 公開したあとは、共有された住所が切れないように変えない。
              if (key === "dates" && recordIds.length === 0 && record.slug.startsWith("ex-")) {
                const slug = newExhibitionSlug(
                  archive.map((entry) => entry.slug),
                  record.slug,
                  next,
                );
                patchRecord(record.slug, { dates: next, slug }, message);
                setShow(slug);
                return;
              }
              patchRecord(record.slug, { [key]: next }, message);
            }}
          />
          <ExhibitionCaptions
            photos={recordPhotos}
            value={record.captions}
            onSave={(next, message) => patchRecord(record.slug, { captions: next }, message)}
          />
          <p className="pp-show-remove">
            <button
              type="button"
              data-pp-show-remove
              onClick={() => {
                saveArchive(
                  archive.filter((entry) => entry.slug !== record.slug),
                  "展示を消しました",
                );
                setShow(null);
              }}
            >
              この展示を消す
            </button>
          </p>
        </>
      ) : tab === "exhibition" ? (
        <>
          {/* トップに展示を出すか。止めると、いつものトップ（表紙＋扉）に戻る。写真と文は残る。 */}
          <fieldset className="pp-cover-mode">
            <legend className="sr-only">トップの出し方</legend>
            <span className="pp-cover-mode__label" aria-hidden="true">
              トップ
            </span>
            <button
              type="button"
              aria-pressed={exhibitionShown}
              data-pp-exhibition-mode="on"
              onClick={() => {
                if (exhibitionShown) return;
                setTab("exhibition");
                save("exhibitionOnTop", "on", "トップを展示にしました", "off");
              }}
            >
              展示
            </button>
            <button
              type="button"
              aria-pressed={!exhibitionShown}
              data-pp-exhibition-mode="off"
              onClick={() => {
                if (!exhibitionShown) return;
                setTab("exhibition");
                save("exhibitionOnTop", "off", "いつものトップに戻しました", "on");
              }}
            >
              いつもの
            </button>
          </fieldset>
          <ExhibitionVisits />
          <p className="pp-note">
            {exhibitionShowsWall(savedValue("exhibitionPhotoIds"))
              ? "この順に並びます。同梱の5枚が揃っている間は、展示のページの最初に会場の壁の配置が出ます。"
              : "先頭の写真が表紙になり、この順に続きます。"}
          </p>
          <PagePhotoEditor
            key="exhibition"
            photos={exhibitionCatalog}
            value={exhibitionIds}
            used={usedOnExhibition}
            series={series}
            name={EXHIBITION_NAME}
            onChange={(next, message) =>
              save("exhibitionPhotoIds", next.join(","), message, savedValue("exhibitionPhotoIds"))
            }
          />
          <ExhibitionCopy
            title={savedValue("exhibitionTitle")}
            dates={savedValue("exhibitionDates")}
            text={savedValue("exhibitionText")}
            thanks={savedValue("exhibitionThanks")}
            onSave={(field, next, message) => save(field, next, message, savedValue(field))}
          />
          <ExhibitionCaptions
            photos={exhibitionPhotos}
            value={savedValue("exhibitionCaptions")}
            onSave={(next, message) => save("exhibitionCaptions", next, message, savedValue("exhibitionCaptions"))}
          />
        </>
      ) : tab === "cover" ? (
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
            {exhibitionShown
              ? "いまはトップに展示を出しているので、ここで選んだ表紙は出ません。「展示」のタブで「いつもの」に戻すと出ます。"
              : spreadTop
                ? coverIds.length >= 2
                  ? "トップは見開きです。1枚目が左の頁（Portrait）、2枚目が右の頁（Works）に出ます。"
                  : "トップは見開きです。2枚選ぶと、1枚目が左の頁（Portrait）、2枚目が右の頁（Works）に出ます。"
              : !picked
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
            name={COVER_NAME}
            onChange={(next, message) => saveCover(next, message, coverIds)}
          />
        </>
      ) : tab === "tokyo" ? (
        <>
          <p className="pp-note">
            {picked
              ? "東京の撮影プラン（/tokyo）の作例です。1枚目が表紙で、あとは2枚ずつ並びます。"
              : "まだ選んでいないので、仮の写真が出ています。動かしたり足したりすると、その並びが保存されます。1枚目が表紙です。"}
          </p>
          <PagePhotoEditor
            key="tokyo"
            photos={photos}
            value={tokyoIds}
            used={usedOnTokyo}
            series={series}
            name={TOKYO_NAME}
            onChange={(next, message) => save(TOKYO_KEY, next.join(","), message, savedValue(TOKYO_KEY))}
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
            name={pageName[tab]}
            onChange={(next, message) => save(LIST_KEY[tab], next.join(","), message, savedValue(LIST_KEY[tab]))}
          />
        </>
      )}

      <DoorNames
        value={savedValue("developDoors")}
        onSave={(next, message) => save("developDoors", next, message, savedValue("developDoors"))}
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
