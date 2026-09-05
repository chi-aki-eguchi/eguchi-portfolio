import { useState } from "react";

const views = {
  ja: [
    { id: "library", label: "写真を入れ替える", title: "新作を選んで、サイトへ。", body: "写真を一覧で見ながら追加・選択。公開する写真、並び順、カテゴリを管理できます。", alt: "Portfolio Kitの写真管理画面。写真の一覧、取り込み、公開写真の整理に使う操作が並んでいる。" },
    { id: "settings", label: "見せ方を変える", title: "仕上がりを見ながら、自分の雰囲気に。", body: "レイアウト、書体、色、余白を選んで調整。設定画面のプレビューで、サイトの見え方を確認できます。", alt: "Portfolio Kitの設定画面。設定項目の隣に公開サイトのプレビューが表示されている。" },
    { id: "profile", label: "文章を更新する", title: "活動が変わったら、プロフィールも。", body: "名前、プロフィール文、作家としての説明、SNSリンクを編集。日本語と英語の文章も、それぞれ入力できます。", alt: "Portfolio Kitのプロフィール管理画面。名前、日本語と英語のプロフィール、SNSなどを入力する欄がある。" },
  ],
  en: [
    { id: "library", label: "Update photos", title: "New work, ready for your site.", body: "Browse your photographs visually, add and select images, and manage what is published, their order, and categories.", alt: "Portfolio Kit photo library with a visual photo grid, import controls, and tools for organising published work." },
    { id: "settings", label: "Shape the design", title: "See the result as you find your style.", body: "Choose layouts, typefaces, colours, and spacing. Check the site preview alongside the settings as you refine the design.", alt: "Portfolio Kit settings with design controls alongside a preview of the public site." },
    { id: "profile", label: "Edit your profile", title: "Your practice changes. Your profile can too.", body: "Edit your name, biography, artist statement, and social links, with separate fields for Japanese and English text.", alt: "Portfolio Kit profile editor with name, Japanese and English biography, and social link fields." },
  ],
} as const;

/** Actual demo screenshots, with a separate link to the working admin demo. */
export function AdminControlPreview({ language }: { language: "ja" | "en" }) {
  const [selected, setSelected] = useState(0);
  const items = views[language];
  const current = items[selected];
  const src = `/portfolio-kit/admin-${current.id}-${language}.jpg`;

  return (
    <div className="mt-8 overflow-hidden rounded-lg border border-[rgba(var(--foreground-rgb),0.14)]">
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
            className={`min-h-14 px-2 py-3 text-xs leading-5 sm:text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] ${index === selected ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[rgba(var(--foreground-rgb),0.025)] text-[color:var(--text-quiet)] hover:bg-[rgba(var(--foreground-rgb),0.07)]"}`}
          >
            <span className="block font-en text-[10px] tracking-widest opacity-70 sm:mb-1">0{index + 1}</span>
            {item.label}
          </button>
        ))}
      </fieldset>
      <figure id="admin-screen-preview">
        <figcaption className="px-5 py-6 sm:px-8" aria-live="polite" aria-atomic="true">
          <p className="mb-2 font-en text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-quiet)]">
            {language === "en" ? "Inside the actual admin panel" : "実際の管理画面から"}
          </p>
          <h3 className="font-ja text-lg leading-8 text-[rgba(var(--foreground-rgb),0.85)]">{current.title}</h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-quiet)]">{current.body}</p>
        </figcaption>
        <a href={src} target="_blank" rel="noopener noreferrer" className="block bg-[#f7f5f0] focus-visible:outline-2 focus-visible:outline-offset-[-4px]" aria-label={language === "en" ? `Enlarge: ${current.label} (opens a new tab)` : `${current.label}の画面を大きく見る（新しいタブ）`}>
          <img key={src} src={src} alt={current.alt} width={1440} height={1000} loading="lazy" decoding="async" className="block h-auto w-full" />
        </a>
      </figure>
      <p className="border-t border-[rgba(var(--foreground-rgb),0.10)] px-5 py-3 text-xs leading-6 text-[color:var(--text-quiet)]">
        {language === "en"
          ? "Screenshots from the demo. Tap an image to enlarge it, or try the controls yourself in the admin demo below."
          : "デモの実画面です。画像を押すと拡大できます。下の「管理画面を触ってみる」から、実際の操作も試せます。"}
      </p>
    </div>
  );
}
