import { EARLY_PHOTOS_GLOBAL } from "../../shared/early-photos";
import { api, jsonOrThrow } from "./api";

async function fetchPhotos() {
  return jsonOrThrow(await api.photos.$get());
}
export type PhotosBody = Awaited<ReturnType<typeof fetchPhotos>>;

/**
 * Gallery の HTML が先に始めた写真一覧の取り寄せ（`shared/early-photos.ts`）を、
 * 1回だけ受け取る。無ければ null。2回目以降はふだんどおり自分で取り寄せる
 * （一覧の更新のたびに古い結果を使わないように）。
 */
export function takeEarlyPhotos(): Promise<unknown> | null {
  if (typeof window === "undefined") return null;
  const holder = window as unknown as Record<string, Promise<unknown> | undefined>;
  const early = holder[EARLY_PHOTOS_GLOBAL] ?? null;
  holder[EARLY_PHOTOS_GLOBAL] = undefined;
  return early;
}

/**
 * 公開の写真一覧（キャッシュの鍵 ["photos"]）。HTML が先に始めた取り寄せがあれば、
 * その結果を使う。`main.tsx` の先回りと Gallery の両方がここを通る（先に動いた方が
 * 受け取る。片方だけだと、もう片方が同じ一覧をもう一度取り寄せる）。
 */
export async function loadPhotos(): Promise<PhotosBody> {
  const early = (await takeEarlyPhotos()) as PhotosBody | null;
  if (early && Array.isArray(early.photos)) return early;
  return fetchPhotos();
}
