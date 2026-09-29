import { useState } from "react";

const views = {
  ja: [
    { id: "library", label: "写真の入れ替え", title: "写真を選ぶ・並べる・公開する", body: "写真を一覧で見ながら追加・選択。公開する写真、並び順、カテゴリを管理できます。", alt: "Portfolio Kitの写真管理画面。写真の一覧、取り込み、公開写真の整理に使う操作が並んでいる。" },
    { id: "settings", label: "見せ方の変更", title: "サイトの設定とプレビュー", body: "レイアウト、書体、色、余白を選んで調整。設定画面のプレビューで、サイトの見え方を確認できます。", alt: "Portfolio Kitの設定画面。設定項目の隣に公開サイトのプレビューが表示されている。" },
    { id: "profile", label: "文章の更新", title: "プロフィールの編集", body: "名前、プロフィール文、作家としての説明、SNSリンクを編集。日本語と英語の文章も、それぞれ入力できます。", alt: "Portfolio Kitのプロフィール管理画面。名前、日本語と英語のプロフィール、SNSなどを入力する欄がある。" },
  ],
  en: [
    { id: "library", label: "Update photos", title: "Select, arrange and publish photographs", body: "Browse your photographs visually, add and select images, and manage what is published, their order, and categories.", alt: "Portfolio Kit photo library with a visual photo grid, import controls, and tools for organising published work." },
    { id: "settings", label: "Shape the design", title: "Site settings and preview", body: "Choose layouts, typefaces, colours, and spacing. Check the site preview alongside the settings as you refine the design.", alt: "Portfolio Kit settings with design controls alongside a preview of the public site." },
    { id: "profile", label: "Edit your profile", title: "Edit your biography", body: "Edit your name, biography, artist statement, and social links, with separate fields for Japanese and English text.", alt: "Portfolio Kit profile editor with name, Japanese and English biography, and social link fields." },
  ],
} as const;

/** Actual demo screenshots, with a separate link to the working admin demo. */
export function AdminControlPreview({ language }: { language: "ja" | "en" }) {
  const [selected, setSelected] = useState(0);
  const items = views[language];
  const current = items[selected];
  const src = `/portfolio-kit/admin-20260929-${current.id}.jpg`;

  return (
    <>
    <div id="admin-video" className="mt-8 scroll-mt-24">
      <fieldset
        aria-label={language === "en" ? "Explore the admin screens" : "管理画面の紹介を切り替える"}
        className="grid min-w-0 grid-cols-3 border-b border-[rgba(var(--foreground-rgb),0.14)]"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={index === selected}
            aria-controls="admin-screen-preview"
            onClick={() => setSelected(index)}
            className={`min-h-12 px-1 py-3 text-[13px] leading-5 sm:text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] ${index === selected ? "text-[var(--foreground)] border-b-2 border-current" : "text-[color:var(--text-quiet)] border-b-2 border-transparent hover:text-[var(--foreground)]"}`}
          >
            {item.label}
          </button>
        ))}
      </fieldset>
      <figure id="admin-screen-preview">
        <figcaption className="py-6" aria-live="polite" aria-atomic="true">
          <h3 className="text-base leading-7 text-[var(--foreground)]">{current.title}</h3>
          <p className="mt-1 text-sm leading-7 text-[color:var(--text-quiet)]">{current.body}</p>
        </figcaption>
        <a href={src} target="_blank" rel="noopener noreferrer" className="block bg-[#f7f5f0] focus-visible:outline-2 focus-visible:outline-offset-[-4px]" aria-label={language === "en" ? `Enlarge: ${current.label} (opens a new tab)` : `${current.label}の画面を大きく見る（新しいタブ）`}>
          <img key={src} src={src} alt={current.alt} width={1244} height={996} loading="lazy" decoding="async" className="block h-auto w-full" />
        </a>
      </figure>
      <p className="py-3 text-[13px] leading-6 text-[color:var(--text-quiet)]">
        {language === "en"
          ? "Current Japanese admin screens, captured on 29 September 2026. Try the same controls in the demo. Changes stay in your browser; the public site is not updated."
          : "2026年9月29日の現行管理画面です。体験版では同じ操作を試せます。変更はブラウザー内だけに保存され、公開サイトには反映されません。"}
      </p>
    </div>
    </>
  );
}
