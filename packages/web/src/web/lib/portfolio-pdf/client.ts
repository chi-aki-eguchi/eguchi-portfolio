import subsetWasmUrl from "harfbuzzjs/dist/harfbuzz-subset.wasm?url";
import type { PortfolioDocument, SourcePhoto } from "./model";
import type { PdfAsset, PdfResult } from "./render";
/** PDF の書体。本文はゴシック、題と作品名はサイトと同じしっぽり明朝（編集画面の見本も同じ物）。 */
export const PDF_FONTS = {
  sans: "/fonts/pdf/NotoSansJP-Regular.ttf",
  serif: "/fonts/pdf/ShipporiMincho-Medium.ttf",
} as const;
export async function readJson<T>(url: string): Promise<T> {
  const r = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (r.status === 401)
    throw new Error("認証が切れました。管理画面からログインし直してください");
  if (!r.ok)
    throw new Error("読み込みに失敗しました。接続を確認して再試行してください");
  return r.json();
}
export async function generate(
  book: PortfolioDocument,
  quality: "screen" | "print",
  progress: (value: string) => void,
  signal: AbortSignal,
): Promise<PdfResult> {
  const { photos } = await readJson<{ photos: SourcePhoto[] }>(
    "/api/admin/pdf/photos",
  );
  for (const [index, item] of book.items.entries()) {
    const current = photos.find((p) => p.id === item.sourcePhotoId);
    if (!current || current.sourceAssetReference !== item.sourceAssetReference)
      throw new Error(
        `作品 ${index + 1} の保存画像が削除・変更されています。写真を選び直してください`,
      );
  }
  // フォント（本文のゴシックと、題の明朝）と、フォントを使う文字だけに減らす道具は、
  // 写真と同時に読み始める。道具が読めなければ元のフォントのまま作る。
  const loadFont = (url: string) => {
    const request = fetch(url, { signal }).then(async (r) => {
      if (!r.ok)
        throw new Error("日本語フォントを読み込めません。再試行してください");
      return new Uint8Array(await r.arrayBuffer());
    });
    request.catch(() => {});
    return request;
  };
  const fontRequest = loadFont(PDF_FONTS.sans);
  const serifRequest = loadFont(PDF_FONTS.serif);
  const wasmRequest = fetch(subsetWasmUrl, { signal })
    .then(async (w) => (w.ok ? new Uint8Array(await w.arrayBuffer()) : undefined))
    .catch(() => undefined);
  // 写真は2枚ずつ前後して頼む。サーバーは1枚ずつ作るが、受け取りと次の準備が重なる。
  const assets: PdfAsset[] = Array.from({ length: book.items.length });
  let next = 0,
    done = 0,
    failed = false;
  const fetchImage = async (index: number) => {
    const item = book.items[index];
    const r = await fetch(
      `/api/admin/pdf/photos/${item.sourcePhotoId}/image?quality=${quality === "print" ? "print" : "send"}`,
      {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
      },
    );
    if (!r.ok)
      throw new Error(
        r.status === 401
          ? "認証が切れました。ログインし直してください"
          : `作品 ${index + 1} の画像を読み込めません。接続と保存画像を確認して再試行してください`,
      );
    assets[index] = { id: item.id, bytes: new Uint8Array(await r.arrayBuffer()) };
    progress(`画像を準備 ${++done} / ${book.items.length}`);
  };
  progress(`画像を準備 0 / ${book.items.length}`);
  await Promise.all(
    Array.from({ length: Math.min(2, book.items.length) }, async () => {
      while (!failed && next < book.items.length) {
        signal.throwIfAborted();
        try {
          await fetchImage(next++);
        } catch (e) {
          failed = true;
          throw e;
        }
      }
    }),
  );
  const fontBytes = await fontRequest;
  const serifBytes = await serifRequest;
  const subsetWasm = await wasmRequest;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pdf.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
      clearTimeout(timer);
    };
    const abort = () => {
      finish();
      reject(new Error("出力を中止しました"));
    };
    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          "出力が時間切れになりました。写真を減らして再試行してください",
        ),
      );
    }, 120000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => {
      finish();
      reject(new Error("PDF処理に失敗しました。再試行してください"));
    };
    worker.onmessage = ({ data }) => {
      if (data.type === "progress")
        progress(`PDFを組版 ${data.done} / ${data.total} ページ`);
      else {
        finish();
        if (data.type === "result") resolve(data.result);
        else reject(new Error(data.message));
      }
    };
    worker.postMessage({ book, assets, fontBytes, serifBytes, quality, subsetWasm });
  });
}
