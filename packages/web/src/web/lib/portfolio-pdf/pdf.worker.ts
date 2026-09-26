import { renderPortfolio, type PdfAsset } from "./render";
import type { PortfolioDocument } from "./model";
self.onmessage = async (
  event: MessageEvent<{
    book: PortfolioDocument;
    assets: PdfAsset[];
    fontBytes: Uint8Array;
  }>,
) => {
  try {
    const { book, assets, fontBytes } = event.data;
    const result = await renderPortfolio(
      book,
      assets,
      fontBytes,
      (done, total) => self.postMessage({ type: "progress", done, total }),
    );
    self.postMessage({ type: "result", result });
  } catch {
    self.postMessage({
      type: "error",
      message: "PDFを作れませんでした。画像・文章を確認して再試行してください",
    });
  }
};
