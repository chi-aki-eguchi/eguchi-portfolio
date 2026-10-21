/**
 * 写真の一時的な取り寄せ失敗を、少し待って取り直す（installImageRetry）。
 *
 * 2026-10-21 本番: トップの Life の扉の写真が 503 のまま壊れた画像で残っていた。
 */
import { test, expect, beforeEach, afterEach } from "bun:test";
import { JSDOM } from "jsdom";
import { installImageRetry, IMAGE_RETRY_DELAYS_MS } from "./image-retry";

let dom: JSDOM;
let doc: Document;
let pending: { fn: () => void; ms: number }[];
let uninstall: () => void;
let status: number;
let probed: string[];
// 問い合わせ（HEAD）の結果を待つ
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://akieguchi.com/" });
  doc = dom.window.document;
  pending = [];
  status = 503;
  probed = [];
  uninstall = installImageRetry(
    doc,
    (fn, ms) => pending.push({ fn, ms }),
    async (url) => {
      probed.push(url);
      return status;
    },
  );
});
afterEach(() => uninstall());

function photo(src: string, parent: Element = doc.body) {
  const img = doc.createElement("img");
  img.setAttribute("src", src);
  parent.appendChild(img);
  const seen: string[] = [];
  img.addEventListener("error", () => seen.push("error"));
  const sets: string[] = [];
  const original = img.setAttribute.bind(img);
  img.setAttribute = (name: string, value: string) => {
    sets.push(`${name}=${value}`);
    original(name, value);
  };
  const fail = async () => {
    img.dispatchEvent(new dom.window.Event("error"));
    await settle();
  };
  return { img, seen, sets, fail };
}

test("a temporarily failed photo is fetched again after a pause, and the component only hears the last failure", async () => {
  const { seen, sets, fail } = photo("/api/images/thumbs/a.webp");

  for (const [i, ms] of IMAGE_RETRY_DELAYS_MS.entries()) {
    await fail();
    expect(seen).toEqual([]);
    expect(pending.map((p) => p.ms)).toEqual([ms]);
    pending.shift()!.fn();
    // 印を付け替えて取り直す（Safari 系は同じ URL だと取り直さない）
    expect(sets[sets.length - 1]).toBe(`src=/api/images/thumbs/a.webp#retry-${i + 1}`);
  }
  // 問い合わせには印を付けない（サーバーへは同じ URL）
  expect(probed[1]).toBe("/api/images/thumbs/a.webp");

  await fail();
  expect(seen).toEqual(["error"]);
  expect(pending).toEqual([]);
});

test("a photo that is really missing goes straight to the component", async () => {
  status = 404;
  const { seen, sets, fail } = photo("/api/images/profile/missing.svg");
  await fail();
  expect(seen).toEqual(["error"]);
  expect(pending).toEqual([]);
  expect(sets).toEqual([]);
});

test("a photo that is ready by the time we ask is fetched again too", async () => {
  status = 200;
  const { seen, fail } = photo("/api/images/thumbs/ready.webp");
  await fail();
  expect(seen).toEqual([]);
  expect(pending.map((p) => p.ms)).toEqual([IMAGE_RETRY_DELAYS_MS[0]]);
});

test("every candidate in the <picture> is marked, so the browser picks again", async () => {
  const picture = doc.createElement("picture");
  picture.innerHTML = '<source type="image/webp" srcset="/api/images/thumbs/p.webp?w=400 400w, /api/images/thumbs/p.webp?w=800 800w">';
  doc.body.appendChild(picture);
  const { img, fail } = photo("/api/images/thumbs/p.webp", picture);
  img.setAttribute("srcset", "/api/images/thumbs/p.webp?w=400 400w");
  await fail();
  pending.shift()!.fn();
  expect(picture.querySelector("source")!.getAttribute("srcset")).toBe(
    "/api/images/thumbs/p.webp?w=400#retry-1 400w, /api/images/thumbs/p.webp?w=800#retry-1 800w",
  );
  expect(img.getAttribute("srcset")).toBe("/api/images/thumbs/p.webp?w=400#retry-1 400w");
  expect(img.getAttribute("src")).toBe("/api/images/thumbs/p.webp#retry-1");
});

test("a photo that loads gets its retries back", async () => {
  const { img, seen, fail } = photo("/api/images/thumbs/b.webp");
  await fail();
  pending.shift()!.fn();
  img.dispatchEvent(new dom.window.Event("load"));
  await fail();
  expect(seen).toEqual([]);
  expect(pending.map((p) => p.ms)).toEqual([IMAGE_RETRY_DELAYS_MS[0]]);
});

test("the viewer, other sites' images and removed images are left alone", async () => {
  const dialog = doc.createElement("dialog");
  doc.body.appendChild(dialog);
  const inViewer = photo("/api/images/originals/c.jpg", dialog);
  await inViewer.fail();
  expect(inViewer.seen).toEqual(["error"]);

  const external = photo("https://note.com/x.jpg");
  await external.fail();
  expect(external.seen).toEqual(["error"]);
  expect(pending).toEqual([]);
  expect(probed).toEqual([]);

  const gone = photo("/api/images/thumbs/d.webp");
  await gone.fail();
  gone.img.remove();
  pending.shift()!.fn();
  expect(gone.sets).toEqual([]);
});
