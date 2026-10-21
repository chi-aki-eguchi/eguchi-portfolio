/**
 * 写真の取り寄せが一時的に失敗したとき、少し待って取り直す（2026-10-21）。
 *
 * まだ一度も作られていない縮小画像は、保存先が遅いとサーバーが時間内に返せず
 * 503（Retry-After: 5）になる。少し後に取り直せば 200 で返るのに、ブラウザーの
 * <img> は取り直さないので、本番のトップで Life の扉の写真が壊れた画像のまま
 * 残っていた（巡回2回とも）。各部品の onError は「隠す」「壊れた印を付ける」だけで、
 * 取り直す所はどこにも無かった。
 *
 * 部品ごとに足すと漏れるので、ページ全体の error を捕まえる側（capture）で1か所に
 * まとめる。失敗したら、まず同じ URL の状態だけを HEAD で問い合わせる。
 * - 一時的な失敗（通信切れ・408・429・5xx。2xx も）: 部品の onError へ届けず、待って取り直す
 *   （隠してしまうと、成功しても戻らない）。回数を使い切ったら部品へ渡す。
 * - 本当に無い写真（404 など）: 待たずに、今までどおりすぐ部品へ渡す（About の
 *   「写真が無いときの組み方」などが遅れないように）。
 *
 * 対象はこのサイトの写真（/api/images/）だけ。写真ビューア（<dialog> の中）は
 * 失敗したら手元の画像へ切り替える仕組みを持っているので、待たせずにそのまま渡す。
 */
export const IMAGE_RETRY_DELAYS_MS = [1500, 5000] as const;

type Schedule = (fn: () => void, ms: number) => unknown;
/** 状態だけを問い合わせる。通信が切れたら 0。 */
type Probe = (url: string) => Promise<number>;

const probeByHead: Probe = (url) =>
  fetch(url, { method: "HEAD", cache: "no-store" }).then((r) => r.status, () => 0);

/** 取り直す価値があるか。「無い」「見せられない」（408・429 以外の 4xx）だけは取り直さない。
 * 2xx も取り直す（問い合わせの間に縮小画像ができあがっていれば、次は届く）。 */
function worthRetrying(status: number): boolean {
  return status < 400 || status === 408 || status === 429 || status >= 500;
}

function isOwnPhoto(img: HTMLImageElement, origin: string): boolean {
  const url = img.currentSrc || img.getAttribute("src") || "";
  if (!url) return false;
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin && parsed.pathname.startsWith("/api/images/");
  } catch {
    return false;
  }
}

/** URL の後ろに取り直しの印（#retry-N）を付ける。前の印は付け替える。 */
function marked(url: string, n: number): string {
  return `${url.replace(/#retry-\d+$/, "")}#retry-${n}`;
}

function markedSrcset(srcset: string, n: number): string {
  return srcset
    .split(",")
    .map((candidate) => candidate.replace(/^(\s*)(\S+)/, (_, space: string, url: string) => space + marked(url, n)))
    .join(",");
}

/**
 * 同じ URL を入れ直すだけでは、Safari 系は失敗した画像を覚えていて取り直さない
 * （2026-10-21 実測。Chrome 系は取り直す）。URL の後ろに印（#retry-N）を付ける。
 * # 以降はサーバーへ送られないので、サーバーの変換・控えもサービスワーカーの控えも
 * 今までと同じ URL のまま使われる。<picture> の候補（<source>）にも付ける。
 */
function reload(img: HTMLImageElement, n: number): void {
  const picture = img.parentElement?.tagName === "PICTURE" ? img.parentElement : null;
  for (const source of picture ? Array.from(picture.querySelectorAll("source")) : []) {
    const srcset = source.getAttribute("srcset");
    if (srcset) source.setAttribute("srcset", markedSrcset(srcset, n));
  }
  const srcset = img.getAttribute("srcset");
  if (srcset) img.setAttribute("srcset", markedSrcset(srcset, n));
  const src = img.getAttribute("src");
  if (src) img.setAttribute("src", marked(src, n));
}

export function installImageRetry(
  doc: Document = document,
  schedule: Schedule = (fn, ms) => window.setTimeout(fn, ms),
  probe: Probe = probeByHead,
): () => void {
  const origin = doc.defaultView?.location.origin ?? "";
  const tries = new WeakMap<HTMLImageElement, number>();
  const ImageCtor = doc.defaultView?.HTMLImageElement;
  const EventCtor = doc.defaultView?.Event ?? Event;
  // 部品へそのまま渡すと決めて、こちらから出し直した error（もう一度は捕まえない）
  const handedOver = new WeakSet<Event>();

  const onError = (event: Event) => {
    const img = event.target;
    if (!ImageCtor || !(img instanceof ImageCtor)) return;
    if (img.closest("dialog")) return;
    if (!isOwnPhoto(img, origin)) return;
    if (handedOver.has(event)) return;
    const used = tries.get(img) ?? 0;
    if (used >= IMAGE_RETRY_DELAYS_MS.length) return;
    event.stopImmediatePropagation();
    const url = (img.currentSrc || img.getAttribute("src") || "").replace(/#.*$/, "");
    void probe(url).then((status) => {
      if (!img.isConnected) return;
      if (!worthRetrying(status)) {
        const again = new EventCtor("error");
        handedOver.add(again);
        img.dispatchEvent(again);
        return;
      }
      tries.set(img, used + 1);
      schedule(() => {
        if (img.isConnected) reload(img, used + 1);
      }, IMAGE_RETRY_DELAYS_MS[used]!);
    });
  };
  // 届いたら数え直す（同じ <img> が後で別の写真に替わっても、また取り直せる）。
  const onLoad = (event: Event) => {
    if (ImageCtor && event.target instanceof ImageCtor) tries.delete(event.target);
  };

  doc.addEventListener("error", onError, true);
  doc.addEventListener("load", onLoad, true);
  return () => {
    doc.removeEventListener("error", onError, true);
    doc.removeEventListener("load", onLoad, true);
  };
}
