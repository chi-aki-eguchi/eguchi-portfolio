import type { PortfolioDocument, SourcePhoto } from "./model";
import type { PdfAsset, PdfResult } from "./render";
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
  const assets: PdfAsset[] = [];
  for (const [index, item] of book.items.entries()) {
    signal.throwIfAborted();
    const current = photos.find((p) => p.id === item.sourcePhotoId);
    if (!current || current.sourceAssetReference !== item.sourceAssetReference)
      throw new Error(
        `作品 ${index + 1} の保存画像が削除・変更されています。写真を選び直してください`,
      );
    progress(`画像を準備 ${index + 1} / ${book.items.length}`);
    const r = await fetch(
      `/api/admin/pdf/photos/${item.sourcePhotoId}/image?quality=${quality}`,
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
    assets.push({ id: item.id, bytes: new Uint8Array(await r.arrayBuffer()) });
  }
  const r = await fetch("/fonts/pdf/NotoSansJP-Regular.ttf", { signal });
  if (!r.ok)
    throw new Error("日本語フォントを読み込めません。再試行してください");
  const fontBytes = new Uint8Array(await r.arrayBuffer());
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
    worker.postMessage({ book, assets, fontBytes });
  });
}
