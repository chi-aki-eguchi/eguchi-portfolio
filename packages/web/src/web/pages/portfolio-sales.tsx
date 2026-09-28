import { useInitialHashScroll } from "../hooks/useInitialHashScroll";
import { useState } from "react";
import { OWNER_SERVICE_FAQ } from "../../shared/portfolio-service-copy";
import { PORTFOLIO_PRODUCT } from "../../shared/portfolio-product";
import { PortfolioServicePricing } from "../components/PortfolioServicePricing";
import { AdminControlPreview } from "../components/AdminControlPreview";
import { sendAnalyticsEvent } from "../lib/analytics";
import "./portfolio-sales.css";

const samples = [
  {
    id: "home",
    title: "トップ",
    copy: "代表作を置くトップページ。",
    alt: "LAND / ARCHIVEのトップ。風景写真を余白とともに並べた納品見本",
  },
  {
    id: "series",
    title: "シリーズ",
    copy: "写真をシリーズごとにまとめます。",
    alt: "地形を読むシリーズ。題名と説明に続いて作品を並べた画面",
  },
  {
    id: "gallery",
    title: "写真一覧",
    copy: "一覧と拡大表示で作品を見られます。",
    alt: "作品を一覧できるギャラリーの画面",
  },
  {
    id: "profile",
    title: "プロフィール",
    copy: "プロフィールと連絡先を掲載します。",
    alt: "名前と紹介文をまとめたプロフィールの画面",
  },
] as const;

export default function PortfolioSalesPage() {
  useInitialHashScroll();
  const [sample, setSample] = useState(0);
  const chosen = samples[sample];
  function selectSample(index: number) {
    setSample(index);
    sendAnalyticsEvent("portfolio_sample_view", { view: samples[index].id });
  }
  return (
    <article className="kit-sales" lang="ja">
      <div className="ks-wrap ks-subnav">
        <p>
          <a href="/">江口秋のサイト</a> / ポートフォリオ制作
        </p>
        <nav aria-label="制作案内">
          <a href="#samples">仕上がり</a>
          <a href="#admin-video">更新方法</a>
          <a href="#pricing">料金</a>
          <a href="/portfolio-kit/en" lang="en">
            EN
          </a>
        </nav>
      </div>
      <section className="ks-wrap ks-hero">
        <div className="ks-hero-copy">
          <p className="ks-label">AKI EGUCHI / PORTFOLIO KIT</p>
          <h1>
            写真家のための
            <br />
            ポートフォリオサイト制作
          </h1>
          <p className="ks-lead">
            写真と文章を整え、公開まで担当します。
            <br />
            公開後は、管理画面から自分で更新できます。
          </p>
          <p className="ks-quiet">
            写真家・江口秋が、相談から制作・納品まで担当します。
          </p>
          <div className="ks-actions">
            <a className="ks-button" href="#samples">
              納品の見本を見る
            </a>
            <a href="/portfolio-kit/consult?plan=basic">
              制作を相談する
            </a>
          </div>
          <p className="ks-cost">
            初期制作 ¥{PORTFOLIO_PRODUCT.setupPrice.toLocaleString("ja-JP")}
            〜（税込）
            <br />
            <small>
              サーバー・ドメインの継続実費は別途。契約前に総額を提示します。
            </small>
          </p>
        </div>
        <figure className="ks-hero-image">
          <a href="#samples">
            <img
              src="/portfolio-kit/sample/home.webp"
              width="1200"
              height="1726"
              fetchPriority="high"
              alt={samples[0].alt}
            />
          </a>
          <figcaption>
            設定済みサイトの見本 / LAND / ARCHIVE
            <br />
            説明用の架空サイトです。<a href="#sample-sources">写真の出典</a>
          </figcaption>
        </figure>
      </section>
      <div className="ks-band">
        <div className="ks-wrap">
          仕事の依頼先へ代表作を送る。展示の案内から見てもらう。シリーズを残し、制作を続ける。
        </div>
      </div>
      <section className="ks-wrap ks-section" id="samples">
        <div className="ks-heading">
          <div>
            <h2>納品見本</h2>
          </div>
          <p>
            写真の一覧、制作のまとまり、あなたについて。
            <br />
            実際に作成・更新・復元を試した見本の画面です。
          </p>
        </div>
        <div className="ks-sample">
          <div role="tablist" aria-label="納品見本のページ" className="ks-tabs">
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
                  if (event.key === "ArrowRight")
                    next = (index + 1) % samples.length;
                  if (event.key === "ArrowLeft")
                    next = (index + samples.length - 1) % samples.length;
                  if (event.key === "Home") next = 0;
                  if (event.key === "End") next = samples.length - 1;
                  if (next !== undefined) {
                    event.preventDefault();
                    selectSample(next);
                    document
                      .getElementById(`sample-tab-${samples[next].id}`)
                      ?.focus();
                  }
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
          <figure
            role="tabpanel"
            id="sample-panel"
            aria-labelledby={`sample-tab-${chosen.id}`}
            tabIndex={0}
          >
            <a
              href={`/portfolio-kit/sample/${chosen.id}.webp`}
              target="_blank"
              rel="noopener"
            >
              <img
                src={`/portfolio-kit/sample/${chosen.id}.webp`}
                alt={chosen.alt}
                loading="lazy"
                width="1200"
                height="1500"
              />
            </a>
            <figcaption>
              {chosen.copy}{" "}
              <a
                href={`/portfolio-kit/sample/${chosen.id}.webp`}
                target="_blank"
                rel="noopener"
              >
                画面全体を開く ↗
              </a>
            </figcaption>
          </figure>
        </div>
        <div className="ks-deliverables">
          <h3>受け取るもの</h3>
          <ul>
            <li>あなたの写真と文章を設定したサイト</li>
            <li>自分で更新するための管理画面</li>
            <li>短い操作ガイドと本人による更新確認</li>
            <li>継続費用・運用窓口・データの引渡し案内</li>
          </ul>
        </div>
      </section>
      <section className="ks-wrap ks-section" id="update">
        <div className="ks-heading">
          <div>
            <h2>公開後の更新</h2>
          </div>
          <p>
            写真の追加・並べ替え、プロフィールの変更。
            <br />
            更新のたびに、制作を依頼する必要はありません。
          </p>
        </div>
        <AdminControlPreview language="ja" />
        <div className="ks-actions">
          <a className="ks-button" href="/admin/demo">
            管理画面を試す →
          </a>
          <span className="ks-quiet">
            登録不要。体験版での変更は、本番の作品には保存されません。
          </span>
        </div>
        <div className="ks-responsibility">
          <div>
            <h3>ご自身で更新すること</h3>
            <p>
              写真・文章・シリーズ、公開する作品、用意された書体・色・並べ方の設定。
            </p>
          </div>
          <div>
            <h3>担当者と確認すること</h3>
            <p>
              初期設置、ドメイン、プログラムの版更新、バックアップ・復元。担当と費用は契約前に確認します。
            </p>
          </div>
        </div>
      </section>
      <section className="ks-band">
        <div className="ks-wrap ks-pdf">
          <div>
            <h2>PDF作品集</h2>
            <p>
              Webとは別の順序や文章で、提出用の作品集を作れます。掲載しているのは見本から出力した実際のページです。
            </p>
            <a
              className="ks-button"
              href="/portfolio-kit/sample/portfolio.pdf"
              target="_blank"
              rel="noopener"
            >
              実物のPDFを見る ↗
            </a>
            <p className="ks-quiet">A4縦・4ページ / 約0.94MB</p>
            <details>
              <summary>現在の試作範囲と保存について</summary>
              <p>
                1冊20枚・ブラウザー内保存。作品集JSONと画像は別に保管します。端末間同期、自由配置の完成、印刷所への適合保証は含みません。20枚は現在の試作上限で、将来の最終仕様ではありません。
              </p>
            </details>
          </div>
          <figure className="ks-pdf-pages">
            <img
              src="/portfolio-kit/sample/pdf-2.webp"
              loading="lazy"
              width="600"
              height="848"
              alt="実際のPDF2ページ目。川の風景写真と作品情報"
            />
            <img
              src="/portfolio-kit/sample/pdf-3.webp"
              loading="lazy"
              width="600"
              height="848"
              alt="実際のPDF3ページ目。山の風景写真と作品情報"
            />
          </figure>
        </div>
      </section>
      <section className="ks-wrap ks-section" id="pricing">
        <PortfolioServicePricing />
        <p className="ks-quiet">
          制作費は初期設定と制作の費用です。任意の作品更新代行は、環境保守や24時間監視を含むプランではありません。
        </p>
      </section>
      <section className="ks-wrap ks-section" id="delivery">
        <div className="ks-heading">
          <div>
            <h2>相談から納品まで</h2>
          </div>
          <p>
            公開後、ご本人による写真の追加・保存を一緒に確認します。
            <br />
            操作ガイドと管理画面をお渡しします。
          </p>
        </div>
        <ol className="ks-flow">
          {[
            [
              "用途を相談する",
              "仕事・展示・作品紹介など、使う場面と希望時期を教えてください。写真選びからの相談も可能です。",
            ],
            [
              "総額と範囲を決める",
              "制作内容・継続費用・納期・保守・終了時の条件を確認し、合意後にお支払いへ進みます。",
            ],
            [
              "素材を預かり、設定する",
              "掲載許可のある写真と文章で制作。順序・文章・スマホ表示を本人が確認し、承認後に公開します。",
            ],
            [
              "受け取り、自分で更新する",
              "サイトURLと管理画面、ガイドをお渡し。写真追加・並べ替え・保存・公開確認・再ログインを試します。",
            ],
          ].map(([title, body], i) => (
            <li key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="ks-wrap ks-section ks-faq">
        <div>
          <h2>よくある質問</h2>
        </div>
        <div>
          {OWNER_SERVICE_FAQ.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="ks-band">
        <div className="ks-wrap ks-consult">
          <div>
            <h2>制作のご相談</h2>
            <p>
              まずは用途と、今困っていることから。
              <br />
              見積もりと範囲を確かめてから、依頼するか決められます。
            </p>
            <a className="ks-button" href="/portfolio-kit/consult?plan=basic">
              無料で制作を相談する →
            </a>
            <p className="ks-quiet">
              送信だけで注文・決済は成立しません。写真の添付も不要です。
            </p>
          </div>
          <div>
            <h3>ご相談で教えてほしいこと</h3>
            <ol>
              <li>誰に・何のために見せたいか</li>
              <li>使い始めたい時期</li>
              <li>写真と文章の準備状況</li>
            </ol>
            <a href="/portfolio-kit/guide">
              写真ポートフォリオの作り方を読む →
            </a>
          </div>
        </div>
      </section>
      <div className="ks-wrap ks-bottom">
        <details id="sample-sources">
          <summary>見本写真の出典と、見本について</summary>
          <p>
            LAND /
            ARCHIVEは説明用の架空サイトで、実顧客の納品実績・推薦ではありません。写真はAnsel
            Adams / National Archivesの79-AA-G01、79-AA-G09、79-AAB-10です。
            <a
              href="https://unwritten-record.blogs.archives.gov/2021/04/27/79-aa-ansel-adams-photographs-of-national-parks-and-monuments-1941-1942/"
              target="_blank"
              rel="noreferrer"
            >
              公文書館が使用条件を説明する79-AAシリーズ
            </a>
            を使用しています。すべてのAdams作品が同じ条件という意味ではありません。
          </p>
        </details>
        <a href="/">← 江口秋の作品サイトへ戻る</a>
      </div>
    </article>
  );
}
