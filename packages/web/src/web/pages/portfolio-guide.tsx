import { useInitialHashScroll } from "../hooks/useInitialHashScroll";
import { usePageEntrance } from "../hooks/usePageEntrance";
import {
  PORTFOLIO_DISCOVERY_GUIDE,
  type PortfolioGuideSection,
} from "../../shared/portfolio-guide";

const headingClass = "font-en text-[0.72rem] tracking-[0.14em] uppercase";
const sectionTitleClass = "mt-12 scroll-mt-24 border-t border-[rgba(var(--foreground-rgb),0.12)] pt-8";

function GuideSection({
  section,
  index,
}: {
  section: PortfolioGuideSection;
  index: number;
}) {
  return (
    <section id={section.id} className={sectionTitleClass}>
      <h2 className="text-[1.05rem] md:text-[1.2rem] leading-tight">{`${index}. ${section.title}`}</h2>
      {section.body.map((paragraph) => (
        <p
          key={paragraph}
          className="mt-4 leading-8"
          style={{ maxWidth: "72ch" }}
        >
          {paragraph}
        </p>
      ))}
      {section.checklist?.length ? (
        <ul className="mt-5 space-y-2">
          {section.checklist.map((item) => (
            <li key={item} className="leading-7 pl-2">
              <span aria-hidden="true">・</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function GuideLinks({
  links,
}: {
  links: readonly { href: string; label: string; note: string }[];
}) {
  return (
    <section className="mt-14 border-y border-[rgba(var(--foreground-rgb),0.12)] pt-10 pb-10">
      <p className={`${headingClass} text-[color:var(--text-quiet)]`}>関連リンク</p>
      <h2 className="mt-2 text-xl md:text-2xl">
        自分に合うか、まず確かめてみる
      </h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <li
            key={link.href}
            className="border-t border-[rgba(var(--foreground-rgb),0.16)] py-4"
          >
            <a
              href={link.href}
              className="text-sm md:text-base leading-6 hover:underline underline-offset-4"
            >
              {link.label}
            </a>
            <p className="mt-2 text-xs leading-6 text-[color:var(--text-quiet)]">
              {link.note}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PortfolioGuidePage() {
  useInitialHashScroll();
  usePageEntrance([]);

  return (
    <article className="max-w-3xl mx-auto px-5 sm:px-6 md:px-8 py-16 md:py-20">
      <p className={`${headingClass} text-[color:var(--text-quiet)]`}>ガイド</p>
      <h1
        className="mt-3 font-normal text-[1.7rem] sm:text-[2rem] leading-snug"
        style={{ letterSpacing: "0.01em" }}
      >
        写真ポートフォリオの作り方
      </h1>
      <p className="mt-4 text-xs text-[color:var(--text-quiet)] tracking-[0.05em]">
        文・運営：{PORTFOLIO_DISCOVERY_GUIDE.author}
      </p>
      <p className="mt-5 leading-8">
        {PORTFOLIO_DISCOVERY_GUIDE.description}
      </p>
      {PORTFOLIO_DISCOVERY_GUIDE.summary.map((line) => (
        <p key={line} className="mt-4 leading-8">
          {line}
        </p>
      ))}
      <p className="mt-6 text-sm leading-7 text-[color:var(--text-quiet)]">
        このサイトは作者自身の運用例です。<a href="/" className="underline underline-offset-4">作品を見る</a> ／ <a href="/about" className="underline underline-offset-4">作者について</a>
      </p>



      <nav
        aria-label="目次"
        className="mt-8 border-y border-[rgba(var(--foreground-rgb),0.12)] py-6"
      >
        <p className={`${headingClass} text-[color:var(--text-quiet)]`}>
          目次
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {PORTFOLIO_DISCOVERY_GUIDE.sections.map((section, index) => (
            <li key={section.id} className="text-sm leading-7">
              <a
                className="underline underline-offset-4 hover:text-[rgba(var(--foreground-rgb),0.72)]"
                href={`#${section.id}`}
              >
                <span className="font-en text-[0.66rem] tracking-[0.09em] text-[color:var(--text-quiet)] mr-2">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {PORTFOLIO_DISCOVERY_GUIDE.sections.map((section, index) => (
        <div key={section.id}>
          <GuideSection section={section} index={index + 1} />
          {section.id === "finished-example" && (
            <figure className="mt-6 border border-[rgba(var(--foreground-rgb),0.12)]">
              <a href="/portfolio-kit#samples" aria-label="完成見本の各ページと出典を見る">
                <img src="/portfolio-kit/sample/home.webp" alt="説明用のLAND / ARCHIVE。代表作の大きな写真と続く2枚を並べたトップ" width={1200} height={1500} loading="lazy" decoding="async" className="block w-full max-h-[560px] object-cover object-top" />
              </a>
              <figcaption className="p-4 text-sm leading-7 text-[color:var(--text-quiet)]">架空サイトの実画面。<a href="/portfolio-kit#samples" className="underline underline-offset-4">シリーズ・プロフィールとPDFの見本を見る</a> ／ <a href="/portfolio-kit#sample-sources" className="underline underline-offset-4">写真の出典</a></figcaption>
            </figure>
          )}
          {section.id === "operations" && (
            <figure className="mt-6 overflow-hidden border border-[rgba(var(--foreground-rgb),0.12)]">
              <a href="/portfolio-kit/admin-20260929-settings.jpg" target="_blank" rel="noopener noreferrer" aria-label="実際の管理画面を拡大する（新しいタブ）">
                <img src="/portfolio-kit/admin-20260929-settings.jpg" alt="実際の管理画面。左でサイトの構成を選び、右で公開画面を確認できます。" width={1244} height={996} loading="lazy" decoding="async" className="block h-auto w-full" />
              </a>
              <figcaption className="px-4 py-4 text-sm leading-7 text-[color:var(--text-quiet)]">
                体験版の実画面です。<a href="/portfolio-kit#admin-video" className="underline underline-offset-4">現在の管理画面を見る</a> ／ <a href="/admin/demo" className="underline underline-offset-4">自分で触ってみる</a>
              </figcaption>
            </figure>
          )}
        </div>
      ))}

      <section className={sectionTitleClass}>
        <h2 className="text-[1.05rem] md:text-[1.2rem] leading-tight">
          最後に
        </h2>
        {PORTFOLIO_DISCOVERY_GUIDE.notes.map((note) => (
          <p key={note} className="mt-4 leading-8">
            {note}
          </p>
        ))}
      </section>

      <aside className="mt-8 border-y border-[rgba(var(--foreground-rgb),0.12)] py-5 text-sm leading-7" aria-label="サイト制作の実例と相談">
        <p>自分で更新できるサイトを検討している方へ。Portfolio Kit は、写真・文章・並び方を管理画面から変えられる、このサイトと同じ仕組みです。</p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <a href="/portfolio-kit#samples" className="underline underline-offset-4">完成見本を見る</a>
          <a href="/portfolio-kit#pricing" className="underline underline-offset-4">制作内容・料金を見る</a>
          <a href="/admin/demo" className="underline underline-offset-4">登録せず管理画面を試す</a>
          <a href="/portfolio-kit/consult" className="underline underline-offset-4">制作を相談する</a>
        </p>
      </aside>

      <GuideLinks links={PORTFOLIO_DISCOVERY_GUIDE.links} />
    </article>
  );
}
