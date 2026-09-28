/**
 * 「写真をどこまで見せるか」を決める2つの設定の回帰。
 *
 * どちらも 2026-09-19 の調査で見つかった同じ問題への答えになっている。
 * オーナーは「写真の元の縦横比を尊重してほしい／グリッドやHEROで切られる」
 * と言っていて、実測すると
 *   - ビューアは写真を画面の高さの94%まで広げるので、選べるはずの「壁」が
 *     上下3%しか見えない
 *   - 表紙は写真を枠に合わせて切り抜く（`object-fit: cover`）
 * だった。ここで見るのは、その2つが**選べるようになったこと**と、
 * **既定では今日までとまったく同じであること**の両方。
 */
import { test, expect } from "bun:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM(
  "<!doctype html><html><body><div id='root'></div></body></html>",
  { url: "http://localhost/", pretendToBeVisual: true },
);
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  HTMLImageElement: dom.window.HTMLImageElement,
  HTMLDialogElement: dom.window.HTMLDialogElement,
  Image: dom.window.Image,
  matchMedia:
    dom.window.matchMedia ??
    (() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
});
if (typeof globalThis.ResizeObserver === "undefined") {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.assign(globalThis, { ResizeObserver: RO });
  Object.assign(dom.window, { ResizeObserver: RO });
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { viewerMat } = await import("./Lightbox");
const { SeriesCover } = await import("./SeriesCover");

/** マットの実効レイアウト。VIEWER_MATS の註と同じ式で、dvh 単位の割合。 */
function matGeometry(style: string | undefined) {
  const mat = viewerMat(style);
  const height = Number.parseFloat(mat.h);
  const lift = Number.parseFloat(mat.lift);
  const top = (100 - lift - height) / 2;
  return { height, top, bottom: top + lift };
}

test("the default viewer mat is exactly today's framing", () => {
  // 既定を変えると、設定を触っていない全サイトの見え方が変わる。
  const { height, top, bottom } = matGeometry(undefined);
  expect(height).toBe(94);
  expect(top).toBe(3);
  expect(bottom).toBe(3);
  expect(viewerMat(undefined).w).toBe("95vw");
  // 知らない値（古い保存値・手書き）も既定へ倒す。
  expect(viewerMat("nonsense")).toEqual(viewerMat("full"));
});

test("a matted viewer leaves the wall visible and lifts the photo optically", () => {
  const framed = matGeometry("framed");
  const soft = matGeometry("soft");
  const full = matGeometry("full");

  // 壁が見える = 写真が画面いっぱいではない。
  expect(framed.height).toBeLessThan(full.height);
  expect(soft.height).toBeLessThan(full.height);
  expect(soft.height).toBeGreaterThan(framed.height);

  // 上の余白は下より狭い。人の目は図形の中心を幾何学的な中心よりわずかに
  // 上に感じるので、上下を同じにすると写真が沈んで見える。
  expect(framed.top).toBeLessThan(framed.bottom);
  expect(soft.top).toBeLessThan(soft.bottom);
  // 既定だけは従来どおり上下対称（＝何も動かさない）。
  expect(full.top).toBe(full.bottom);

  // 上下の余白を足したものが、写真に使わない高さと一致する（式の取り違えで
  // 写真が画面からはみ出さないこと）。
  expect(framed.top + framed.height + framed.bottom).toBeCloseTo(100, 6);
  expect(soft.top + soft.height + soft.bottom).toBeCloseTo(100, 6);
});

async function renderCover(series: Record<string, unknown> | undefined) {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(SeriesCover, {
        series: series as never,
        title: "SICF Fukuoka",
      }),
    );
  });
  const frame = host.querySelector<HTMLElement>(".series-cover__frame");
  const ar = frame?.style.getPropertyValue("--photo-ar").trim() ?? "";
  await act(async () => {
    root.unmount();
  });
  host.remove();
  return ar;
}

// 「切り抜かず全体を見せる」を選ぶと、表紙の枠の高さは写真の縦横比から決まる
// （styles.css の body[data-photo-crop="whole"] が --photo-ar を読む）。
// **測らずに先に渡す**のが要点で、画像の読み込み後に測って高さを変えると
// 版がずれる（CLS）。本番のトップと作品ページは現在どちらも CLS 0 で、
// ここを崩さない。
test("the cover hands its aspect ratio to CSS before the image loads", async () => {
  expect(await renderCover({ coverUrl: "/a.jpg", coverWidth: 3200, coverHeight: 2133 }))
    .toBe("3200 / 2133");
});

test("a rotated cover hands over the ratio as displayed, not as stored", async () => {
  // 回転は画像の配信側で当てているので、画面に出るのは縦横が入れ替わった形。
  // 保存値そのままを渡すと、縦位置の表紙に横位置ぶんの高さを取ってしまう。
  expect(
    await renderCover({
      coverUrl: "/a.jpg",
      coverWidth: 3200,
      coverHeight: 2133,
      coverRotationDeg: 90,
    }),
  ).toBe("2133 / 3200");
});

test("a cover with no stored dimensions keeps the fixed frame height", async () => {
  // 寸法の無い古い記録。変数を出さないので CSS 側の既定（従来の固定高）の
  // まま contain になる。推測した比で高さを決めると、そのぶん版がずれる。
  expect(await renderCover({ coverUrl: "/a.jpg" })).toBe("");
});
