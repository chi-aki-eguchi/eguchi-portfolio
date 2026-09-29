import { useEffect, useRef } from "react";
import { Link } from "wouter";

/**
 * トップの名前の帯（2026-09-26 作り直し）。
 *
 * 前の表紙は「左に名前・右に写真」の2列で、縦の写真だと左上の半分が空いていた
 * （オーナー「TOP の謎の余白」）。今は名前を1行の帯にして、その下の表紙の段を
 * 写真1枚を元の比で収める（PhotoStream の selection）。
 *
 * 大きさ・太さ・色・字間は管理画面の「名前」の設定がそのまま効く。
 * 帯が見えている間は、上の帯の名前を隠す（同じ名前が二重に並ばないように）。
 */
export function TopName({
  name,
  nameEn,
  subtitle,
}: {
  name: string;
  nameEn?: string | null;
  subtitle?: string | null;
}) {
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
    <header ref={ownRef} className="ps-top-name">
      <h1 className="ps-top-name__main font-ja">{name}</h1>
      {(en || subtitle) && (
        <p className="ps-top-name__sub font-en">
          {en && <span className="ps-top-name__en">{en}</span>}
          {subtitle && <span className="ps-top-name__role">{subtitle}</span>}
        </p>
      )}
    </header>
  );
}

type Settings = Record<string, string | null | undefined> | undefined;

/**
 * 撮影のご依頼（写真中心のサイト）。管理画面「撮影のご依頼」の設定を読む
 * （出す／出さない・題・文）。
 *
 * 2026-09-29: 以前は Gallery・Series と同じ大きさの枠で並べていた。作品の入口と
 * 依頼の案内が同じ強さになり、写真を見終えるたびに大きな「Contact」が出ていた。
 * 今は1行の案内にして、写真の後ろに静かに置く。
 */
function InquiryLine({ settings }: { settings: Settings }) {
  if ((settings?.homeCtaEnabled ?? "off") !== "on") return null;
  return (
    <p className="ps-inquiry">
      <span className="ps-inquiry__title">{settings?.homeCtaTitle || "撮影のご依頼"}</span>
      {settings?.homeCtaText && <span className="ps-inquiry__text">{settings.homeCtaText}</span>}
      <Link to="/contact" className="ps-inquiry__link">
        {settings?.homeCtaButton || "お問い合わせ"}
      </Link>
    </p>
  );
}

/**
 * トップの終わりの目次: すべての写真（Gallery）と Series。
 *
 * 2026-09-29: 3つの同じ枠（Gallery／Series／Contact）をやめ、写真集の目次のように
 * 1行ずつ。メニューと同じ言葉を大きく繰り返すより、何枚・いくつあるかを添える
 * ほうが、次に何を見るかを選べる。数は公開中の写真・シリーズから数える。
 */
export function TopEntrances({
  settings,
  showSeries,
  photoCount,
  seriesCount,
}: {
  settings: Settings;
  showSeries: boolean;
  photoCount?: number;
  seriesCount?: number;
}) {
  return (
    <>
      <nav className="ps-entrances" aria-label="写真を見る">
        <Link to="/gallery" className="ps-entrance">
          <span className="ps-entrance__en font-en">{settings?.navLabelGallery || "Gallery"}</span>
          <span className="ps-entrance__ja">すべての写真</span>
          {photoCount ? <span className="ps-entrance__count">{photoCount}枚</span> : null}
        </Link>
        {showSeries && (
          <Link to="/series" className="ps-entrance">
            <span className="ps-entrance__en font-en">Series</span>
            <span className="ps-entrance__ja">シリーズで見る</span>
            {seriesCount ? <span className="ps-entrance__count">{seriesCount}組</span> : null}
          </Link>
        )}
      </nav>
      <InquiryLine settings={settings} />
    </>
  );
}

/** Gallery・シリーズのページの終わりの撮影のご依頼（設定が「出す」のときだけ）。 */
export function PhotoInquiry({ settings }: { settings: Settings }) {
  return <InquiryLine settings={settings} />;
}
