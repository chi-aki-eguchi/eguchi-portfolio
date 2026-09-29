import { useInitialHashScroll } from "../hooks/useInitialHashScroll";
import { useState } from "react";
import { OWNER_SERVICE_FAQ, OWNER_SERVICE_FAQ_EN } from "../../shared/portfolio-service-copy";
import { PORTFOLIO_PRODUCT } from "../../shared/portfolio-product";
import { PortfolioServicePricing } from "../components/PortfolioServicePricing";
import { AdminControlPreview } from "../components/AdminControlPreview";
import { sendAnalyticsEvent } from "../lib/analytics";
import "./portfolio-sales.css";

/**
 * オーナーのサイトの制作案内（日本語・英語）。
 *
 * 2026-09-29 の組み直し:
 * - 以前は5つの節がすべて「左に大見出し・右に2行の説明」の同じ型で、英字の肩書き・
 *   標語の帯・同じ見本画像の2回続きがあった。英語版は別の古い構成（悩みと解決の対比、
 *   大文字の小見出し）だった。
 * - 今は日英とも同じ順序・同じ事実。見出しと説明は上から下へ読む1列にし、節ごとに
 *   中身に合った形（画面を大きく見せる／比べる／手順を順に読む／質問を開く）にする。
 * - 見本の最初の画面（トップ）は冒頭に出しているので、見本の切替はシリーズから始める。
 * 料金・条件・見本の出典は変えていない。
 */

type Lang = "ja" | "en";

const SOURCE_URL =
  "https://unwritten-record.blogs.archives.gov/2021/04/27/79-aa-ansel-adams-photographs-of-national-parks-and-monuments-1941-1942/";

const SAMPLES = {
  ja: [
    { id: "series", title: "シリーズ", copy: "写真をシリーズごとにまとめたページ。", alt: "地形を読むシリーズ。題名と説明に続いて作品を並べた画面" },
    { id: "gallery", title: "写真一覧", copy: "一覧と拡大表示で作品を見るページ。", alt: "作品を一覧できるギャラリーの画面" },
    { id: "profile", title: "プロフィール", copy: "プロフィールと連絡先のページ。", alt: "名前と紹介文をまとめたプロフィールの画面" },
    { id: "home", title: "トップ", copy: "代表作を置くトップページ。", alt: "LAND / ARCHIVEのトップ。風景写真を余白とともに並べた納品見本" },
  ],
  en: [
    { id: "series", title: "Series", copy: "Photographs grouped as a series.", alt: "A series page: title and statement followed by the photographs" },
    { id: "gallery", title: "Gallery", copy: "All photographs, with an enlarged view.", alt: "A gallery page listing the photographs" },
    { id: "profile", title: "Profile", copy: "Biography and contact details.", alt: "A profile page with the photographer's name and biography" },
    { id: "home", title: "Home", copy: "The home page, opening with key work.", alt: "LAND / ARCHIVE home page: landscape photographs with generous margins" },
  ],
} as const;

const COPY = {
  ja: {
    nav: "制作案内",
    navItems: [["#samples", "見本"], ["#update", "更新"], ["#pricing", "料金"], ["#consult", "相談"]],
    other: { href: "/portfolio-kit/en", label: "English", lang: "en" },
    title: <>写真家のための<br /><span className="ks-keep">ポートフォリオサイト制作</span></>,
    lead: "写真と文章を整えて、サイトを公開するまでを担当します。公開後は、管理画面から自分で更新できます。",
    by: "制作するのは写真家の江口秋です。このサイトも同じ仕組みで作っています。",
    seeSample: "納品の見本を見る",
    consult: "制作を相談する",
    cost: `初期制作 ¥${PORTFOLIO_PRODUCT.setupPrice.toLocaleString("ja-JP")}〜（税込）`,
    costNote: "サーバー・ドメインの継続実費は別途。契約前に総額を提示します。",
    heroAlt: "LAND / ARCHIVEのトップ。風景写真を余白とともに並べた納品見本",
    heroCaption: <>説明用の架空サイト「LAND / ARCHIVE」のトップ。<a href="#sample-sources">写真の出典</a></>,
    samplesTitle: "納品見本",
    samplesLead: "設定済みの見本サイトで、作成・更新・復元まで試した画面です。",
    tablist: "納品見本のページ",
    openFull: "画面全体を開く ↗",
    receiveTitle: "受け取るもの",
    receive: ["あなたの写真と文章を設定したサイト", "自分で更新するための管理画面", "短い操作ガイドと、本人による更新の確認", "継続費用・運用窓口・データの引渡しの案内"],
    updateTitle: "公開後の更新",
    updateLead: "写真の追加や並べ替え、プロフィールの変更は、制作を依頼せずに自分でできます。",
    demo: "管理画面を試す →",
    demoNote: "登録不要。体験版での変更は、公開サイトには保存されません。",
    roles: [
      ["自分で更新すること", "写真・文章・シリーズ、公開する作品、用意された書体・色・並べ方の設定。"],
      ["担当者と確認すること", "初期設置、ドメイン、プログラムの版更新、バックアップ・復元。担当と費用は契約前に確認します。"],
    ],
    pdfTitle: "PDF作品集",
    pdfLead: "Webとは別の順序や文章で、提出用の作品集を作れます。右は見本から出力した実際のページです。",
    pdfOpen: "実物のPDFを見る ↗",
    pdfMeta: "A4縦・4ページ / 約0.94MB",
    pdfScope: "現在の試作範囲と保存について",
    pdfScopeBody: "1冊20枚・ブラウザー内保存。作品集JSONと画像は別に保管します。端末間同期、自由配置の完成、印刷所への適合保証は含みません。20枚は現在の試作上限で、将来の最終仕様ではありません。",
    pdfAlts: ["実際のPDF2ページ目。川の風景写真と作品情報", "実際のPDF3ページ目。山の風景写真と作品情報"],
    pricingNote: "制作費は初期設定と制作の費用です。任意の作品更新代行は、環境保守や24時間監視を含むプランではありません。",
    flowTitle: "相談から納品まで",
    flow: [
      ["用途を相談する", "仕事・展示・作品紹介など、使う場面と希望時期を教えてください。写真選びからの相談もできます。"],
      ["総額と範囲を決める", "制作内容・継続費用・納期・保守・終了時の条件を確認し、合意してからお支払いへ進みます。"],
      ["素材を預かり、設定する", "掲載許可のある写真と文章で制作します。順序・文章・スマホでの表示を確認していただき、承認後に公開します。"],
      ["受け取り、自分で更新する", "サイトのURL・管理画面・ガイドをお渡しし、写真の追加・並べ替え・保存・再ログインを一緒に試します。"],
    ],
    faqTitle: "よくある質問",
    faq: OWNER_SERVICE_FAQ,
    consultTitle: "制作のご相談",
    consultLead: "まずは、誰に何のために見せたいか、今どこで困っているかを教えてください。見積もりと範囲を確かめてから、依頼するかを決められます。",
    consultAsk: "書いてほしいこと",
    consultItems: ["誰に・何のために見せたいか", "使い始めたい時期", "写真と文章の準備状況"],
    consultButton: "無料で制作を相談する →",
    consultNote: "送信だけで注文・決済は成立しません。写真の添付も不要です。",
    guide: "写真ポートフォリオの作り方を読む →",
    sourcesTitle: "見本写真の出典と、見本について",
    sources: (
      <>
        LAND / ARCHIVEは説明用の架空サイトで、実顧客の納品実績・推薦ではありません。写真はAnsel Adams / National Archivesの79-AA-G01、79-AA-G09、79-AAB-10です。
        <a href={SOURCE_URL} target="_blank" rel="noreferrer">公文書館が使用条件を説明する79-AAシリーズ</a>
        を使用しています。すべてのAdams作品が同じ条件という意味ではありません。
      </>
    ),
    back: "← 江口秋の作品サイトへ戻る",
  },
  en: {
    nav: "Portfolio websites",
    navItems: [["#samples", "Samples"], ["#update", "Updating"], ["#pricing", "Pricing"], ["#consult", "Consultation"]],
    other: { href: "/portfolio-kit", label: "日本語", lang: "ja" },
    title: <>Portfolio websites<br />for photographers</>,
    lead: "I set up your photographs and text and publish the site. After launch, you update it yourself from the admin panel.",
    by: "I'm Aki Eguchi, a photographer; this site runs on the same system. Support is in Japanese and simple English.",
    seeSample: "See the samples",
    consult: "Ask about a site",
    cost: `Setup from ¥${PORTFOLIO_PRODUCT.setupPrice.toLocaleString("en-US")} (tax included)`,
    costNote: "Hosting and domain charges are separate. The total is confirmed before the contract.",
    heroAlt: "LAND / ARCHIVE home page: landscape photographs with generous margins",
    heroCaption: <>Home page of LAND / ARCHIVE, a fictional sample site. <a href="#sample-sources">Photo credits</a></>,
    samplesTitle: "Sample site",
    samplesLead: "Screens from a configured sample site, used to test setup, updates and restore.",
    tablist: "Sample site pages",
    openFull: "Open the full screen ↗",
    receiveTitle: "What you receive",
    receive: ["A site set up with your photographs and text", "An admin panel for your own updates", "A short guide, and a check that you can update it yourself", "Notes on running costs, contacts and handing over your data"],
    updateTitle: "Updating after launch",
    updateLead: "Add and reorder photographs or change your profile yourself, without hiring anyone for each update.",
    demo: "Try the admin demo →",
    demoNote: "No sign-up. Changes in the demo are not saved to the live site.",
    roles: [
      ["You update", "Photographs, text, series, what is published, and the provided typefaces, colours and layouts."],
      ["Agreed with me", "Initial setup, domain, software updates, backup and restore. Who handles them, and the costs, are confirmed before the contract."],
    ],
    pdfTitle: "PDF portfolio",
    pdfLead: "Make a portfolio for submissions, with a different order and text from the website. The pages shown are real pages exported from the sample.",
    pdfOpen: "Open the actual PDF ↗",
    pdfMeta: "A4 portrait · 4 pages · about 0.94 MB",
    pdfScope: "Current scope and storage",
    pdfScopeBody: "Up to 20 photographs per book, saved in the browser. The book's JSON and images are kept separately. Syncing between devices, free-form layout and print-shop compatibility are not included. The 20-photo limit belongs to the current trial version.",
    pdfAlts: ["Page 2 of the actual PDF: a river landscape with work details", "Page 3 of the actual PDF: a mountain landscape with work details"],
    pricingNote: "The production fee covers setup and production. Optional update help does not include server maintenance or 24-hour monitoring.",
    flowTitle: "From consultation to delivery",
    flow: [
      ["Tell me what it's for", "Work, exhibitions, introducing your practice — tell me where you'll use it and when. We can start from choosing photographs."],
      ["Agree on the total and scope", "We confirm what's included, running costs, schedule, maintenance and end-of-contract terms before any payment."],
      ["Hand over materials; I set it up", "I build the site with photographs and text you have permission to publish. You check the order, text and phone layout, then approve the launch."],
      ["Receive it and update it yourself", "You receive the site URL, admin access and guide, and we try adding, reordering, saving and signing in again together."],
    ],
    faqTitle: "Questions",
    faq: OWNER_SERVICE_FAQ_EN,
    consultTitle: "Consultation",
    consultLead: "Start with who you want to show your work to, and what isn't working now. You can decide after seeing the estimate and scope.",
    consultAsk: "Useful to include",
    consultItems: ["Who the site is for, and why", "When you want to start using it", "How ready your photographs and text are"],
    consultButton: "Free consultation (form in Japanese) →",
    consultNote: "Sending the form places no order or payment. No photographs needed.",
    guide: "Read the portfolio guide (Japanese) →",
    sourcesTitle: "About the sample and its photographs",
    sources: (
      <>
        LAND / ARCHIVE is a fictional site made for explanation, not a client's delivered work or endorsement. Photographs: Ansel Adams / National Archives 79-AA-G01, 79-AA-G09 and 79-AAB-10, used under the terms described in{" "}
        <a href={SOURCE_URL} target="_blank" rel="noreferrer">the National Archives' note on the 79-AA series</a>
        . This does not mean every Adams work has the same terms.
      </>
    ),
    back: "← Back to Aki Eguchi's photographs",
  },
} as const;

export default function PortfolioSalesPage({ language = "ja" }: { language?: Lang }) {
  useInitialHashScroll();
  const t = COPY[language];
  const samples = SAMPLES[language];
  const [sample, setSample] = useState(0);
  const chosen = samples[sample];
  const en = language === "en";
  function selectSample(index: number) {
    setSample(index);
    sendAnalyticsEvent("portfolio_sample_view", { view: samples[index].id });
  }
  return (
    <article className="kit-sales" lang={language}>
      <nav className="ks-wrap ks-subnav" aria-label={t.nav}>
        {t.navItems.map(([href, label]) => (
          <a key={href} href={href}>{label}</a>
        ))}
        <a href={t.other.href} lang={t.other.lang} className="ks-subnav__lang">{t.other.label}</a>
      </nav>

      <header className="ks-wrap ks-hero">
        <div className="ks-hero-copy">
          <h1>{t.title}</h1>
          <p className="ks-lead">{t.lead}</p>
          <p className="ks-by">{t.by}</p>
          <div className="ks-actions">
            <a className="ks-button" href="#samples">{t.seeSample}</a>
            <a className="ks-link" href="/portfolio-kit/consult?plan=basic">{t.consult}</a>
          </div>
          <p className="ks-cost">
            {t.cost}
            <small>{t.costNote}</small>
          </p>
        </div>
        <figure className="ks-hero-image">
          <a href="#samples">
            <img src="/portfolio-kit/sample/home.webp" width="1200" height="1726" fetchPriority="high" alt={t.heroAlt} />
          </a>
          <figcaption>{t.heroCaption}</figcaption>
        </figure>
      </header>

      <section className="ks-wrap ks-section" id="samples">
        <h2>{t.samplesTitle}</h2>
        <p className="ks-section-lead">{t.samplesLead}</p>
        <div className="ks-sample">
          <div role="tablist" aria-label={t.tablist} className="ks-tabs">
            {samples.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`sample-tab-${item.id}`}
                aria-selected={sample === index}
                aria-controls="sample-panel"
                tabIndex={sample === index ? 0 : -1}
                onClick={() => selectSample(index)}
                onKeyDown={(event) => {
                  let next: number | undefined;
                  if (event.key === "ArrowRight") next = (index + 1) % samples.length;
                  if (event.key === "ArrowLeft") next = (index + samples.length - 1) % samples.length;
                  if (event.key === "Home") next = 0;
                  if (event.key === "End") next = samples.length - 1;
                  if (next !== undefined) {
                    event.preventDefault();
                    selectSample(next);
                    document.getElementById(`sample-tab-${samples[next].id}`)?.focus();
                  }
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
          <figure role="tabpanel" id="sample-panel" aria-labelledby={`sample-tab-${chosen.id}`} tabIndex={0}>
            <a href={`/portfolio-kit/sample/${chosen.id}.webp`} target="_blank" rel="noopener">
              <img src={`/portfolio-kit/sample/${chosen.id}.webp`} alt={chosen.alt} loading="lazy" width="1200" height="1500" />
            </a>
            <figcaption>
              <span>{chosen.copy}</span>
              <a href={`/portfolio-kit/sample/${chosen.id}.webp`} target="_blank" rel="noopener">{t.openFull}</a>
            </figcaption>
          </figure>
        </div>
        <div className="ks-deliverables">
          <h3>{t.receiveTitle}</h3>
          <ul>
            {t.receive.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="ks-wrap ks-section" id="update">
        <h2>{t.updateTitle}</h2>
        <p className="ks-section-lead">{t.updateLead}</p>
        <AdminControlPreview language={language} />
        <div className="ks-actions">
          <a className="ks-button" href="/admin/demo">{t.demo}</a>
          <span className="ks-quiet">{t.demoNote}</span>
        </div>
        <dl className="ks-roles">
          {t.roles.map(([term, body]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="ks-wrap ks-section ks-pdf" id="pdf">
        <div className="ks-pdf-copy">
          <h2>{t.pdfTitle}</h2>
          <p>{t.pdfLead}</p>
          <p className="ks-pdf-open">
            <a className="ks-link" href="/portfolio-kit/sample/portfolio.pdf" target="_blank" rel="noopener">{t.pdfOpen}</a>
            <span className="ks-quiet">{t.pdfMeta}</span>
          </p>
          <details>
            <summary>{t.pdfScope}</summary>
            <p>{t.pdfScopeBody}</p>
          </details>
        </div>
        <figure className="ks-pdf-pages">
          <img src="/portfolio-kit/sample/pdf-2.webp" loading="lazy" width="600" height="848" alt={t.pdfAlts[0]} />
          <img src="/portfolio-kit/sample/pdf-3.webp" loading="lazy" width="600" height="848" alt={t.pdfAlts[1]} />
        </figure>
      </section>

      <section className="ks-wrap ks-section ks-pricing" id="pricing">
        <PortfolioServicePricing en={en} />
        <p className="ks-quiet">{t.pricingNote}</p>
      </section>

      <section className="ks-wrap ks-section ks-narrow" id="delivery">
        <h2>{t.flowTitle}</h2>
        <ol className="ks-flow">
          {t.flow.map(([title, body]) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ks-wrap ks-section ks-narrow ks-faq" id="faq">
        <h2>{t.faqTitle}</h2>
        {t.faq.map(({ q, a }) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <section className="ks-wrap ks-section ks-narrow ks-consult" id="consult">
        <h2>{t.consultTitle}</h2>
        <p>{t.consultLead}</p>
        <p className="ks-consult-ask">{t.consultAsk}</p>
        <ul>
          {t.consultItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="ks-actions">
          <a className="ks-button" href="/portfolio-kit/consult?plan=basic">{t.consultButton}</a>
          <a className="ks-link" href="/portfolio-kit/guide">{t.guide}</a>
        </div>
        <p className="ks-quiet">{t.consultNote}</p>
      </section>

      <div className="ks-wrap ks-bottom">
        <details id="sample-sources">
          <summary>{t.sourcesTitle}</summary>
          <p>{t.sources}</p>
        </details>
        <a href={en ? "/en/about" : "/"}>{t.back}</a>
      </div>
    </article>
  );
}
