import { useEffect } from "react";

/**
 * いま表示している言語を `<html lang>` に反映する。
 *
 * 直接URLで開いた場合は既にサーバーが正しく出している（`ogp.ts` が `/en/*` と
 * `/portfolio-kit/en` などで `<html lang="en">` へ差し替える）。**足りないのは
 * ヘッダーの JP | EN を押したときだけ。** あの切替はページを読み込み直さず
 * 中身だけ差し替えるので、`index.html` の `lang="ja"` が残る。読み上げソフトは
 * 英語の本文を日本語の発音で読み、ブラウザの自動翻訳も判断を誤る。
 *
 * **戻すときは「ja」と決め打ちしない。** `service.tsx` と `service-start.tsx`
 * が決め打ちで戻していたため、英語の販売ページから英語のAboutへ移ると、
 * 途中で一度 `ja` に落ちる。直前の値を覚えて戻せば、その取りこぼしが無い。
 * この形は `admin-i18n.tsx` の言語プロバイダが既に採っている（発明ではない）。
 */
export function usePageLanguage(language: "ja" | "en") {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [language]);
}
