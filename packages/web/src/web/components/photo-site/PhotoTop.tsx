import { forwardRef, useEffect, useRef } from "react";
import { Link } from "wouter";

/**
 * トップの名前の帯（2026-09-26 作り直し）。
 *
 * 前の表紙は「左に名前・右に写真」の2列で、縦の写真だと左上の半分が空いていた
 * （オーナー「TOP の謎の余白」）。今は名前を1行の帯にして、その下の表紙の段を
 * 写真で横いっぱいに埋める（PhotoStream の lead）。
 *
 * 大きさ・太さ・色・字間は管理画面の「名前」の設定がそのまま効く。
 * 帯が見えている間は、上の帯の名前を隠す（同じ名前が二重に並ばないように）。
 */
export const TopName = forwardRef<
  HTMLElement,
  { name: string; nameEn?: string | null; subtitle?: string | null }
>(function TopName({ name, nameEn, subtitle }, ref) {
  const ownRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ownRef.current;
    const root = document.documentElement;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) root.dataset.psCover = "";
        else delete root.dataset.psCover;
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete root.dataset.psCover;
    };
  }, []);
  const en = nameEn && nameEn !== name ? nameEn : "";
  return (
    <header
      ref={(el) => {
        ownRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      className="ps-top-name"
    >
      <h1 className="ps-top-name__main font-ja">{name}</h1>
      {(en || subtitle) && (
        <p className="ps-top-name__sub font-en">
          {en && <span className="ps-top-name__en">{en}</span>}
          {subtitle && <span className="ps-top-name__role">{subtitle}</span>}
        </p>
      )}
    </header>
  );
});

type Settings = Record<string, string | null | undefined> | undefined;

/**
 * 撮影のご依頼の枠（写真中心のサイト）。管理画面「撮影のご依頼」の設定を読む
 * （出す／出さない・題・文）。大きな言葉はメニューの Contact の呼び方にそろえる。いつもの構成の帯（中央寄せ・縦の飾り線・
 * 大文字のボタン）は使わず、入口と同じ並びの1枠にする。
 */
function InquiryCell({ settings }: { settings: Settings }) {
  if ((settings?.homeCtaEnabled ?? "off") !== "on") return null;
  return (
    <Link to="/contact" className="ps-entrance">
      <span className="ps-entrance__en font-en">{settings?.navLabelContact || "Contact"}</span>
      <span className="ps-entrance__ja">{settings?.homeCtaTitle || "撮影のご依頼"}</span>
      {settings?.homeCtaText && <span className="ps-entrance__note">{settings.homeCtaText}</span>}
    </Link>
  );
}

/** トップの終わりの入口: すべての写真（Gallery）・Series・撮影のご依頼。 */
export function TopEntrances({
  settings,
  showSeries,
}: {
  settings: Settings;
  showSeries: boolean;
}) {
  return (
    <nav className="ps-entrances" aria-label="写真を見る">
      <Link to="/gallery" className="ps-entrance">
        <span className="ps-entrance__en font-en">{settings?.navLabelGallery || "Gallery"}</span>
        <span className="ps-entrance__ja">すべての写真</span>
      </Link>
      {showSeries && (
        <Link to="/series" className="ps-entrance">
          <span className="ps-entrance__en font-en">Series</span>
          <span className="ps-entrance__ja">シリーズで見る</span>
        </Link>
      )}
      <InquiryCell settings={settings} />
    </nav>
  );
}

/** Gallery・シリーズのページの終わりの撮影のご依頼（設定が「出す」のときだけ）。 */
export function PhotoInquiry({ settings }: { settings: Settings }) {
  if ((settings?.homeCtaEnabled ?? "off") !== "on") return null;
  return (
    <div className="ps-entrances ps-entrances--single">
      <InquiryCell settings={settings} />
    </div>
  );
}
