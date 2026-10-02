/**
 * Gallery の HTML が先に始める、写真一覧（/api/photos）の取り寄せ。
 *
 * Gallery は一覧が届くまで写真を1枚も置けない。画面のプログラムが動いてから
 * 頼むと遅いので、HTML の先頭の小さなスクリプトで取り寄せを始め、画面
 * （`web/lib/early-photos.ts`）がその結果を受け取る。スマホ・4G 相当で写真が
 * 見えるのが約0.5秒早まった（2026-10-03）。
 *
 * `<link rel="preload" as="fetch">` は使わない。Safari は fetch() にその応答を
 * 使わず、同じ一覧を2回取り寄せた（警告「preloaded but not used」）。
 *
 * サーバー（server.ts）が差し込み、画面が読む。名前と URL はここ1か所に置く。
 */
export const EARLY_PHOTOS_GLOBAL = "__earlyPhotos";
export const EARLY_PHOTOS_URL = "/api/photos";

/**
 * スタイルシートより前に置く（後ろに置くと、スタイルシートが届くまで動かない）。
 * 失敗しても null にして、画面はふだんどおり自分で取り寄せる。
 */
export function earlyPhotosScript(): string {
  return `<script>window.${EARLY_PHOTOS_GLOBAL}=fetch("${EARLY_PHOTOS_URL}").then(function(r){return r.ok?r.json():null}).catch(function(){return null})</script>`;
}
