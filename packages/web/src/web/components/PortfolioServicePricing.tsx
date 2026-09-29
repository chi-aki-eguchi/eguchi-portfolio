import { portfolioPlans } from "../../shared/portfolio-product";
import { CONSULT_PATH } from "../lib/portfolio-intake";
import { studioHref } from "./StudioBridge";

/**
 * 制作内容・料金（オーナーのサイトの制作案内）。価格・条件の文言は変えない。
 * 2026-09-29: 2つのプランを同じ罫線の上で比べる。各プランの相談リンクと、その下の
 * 総額の説明がくっついていたので、プランの外に間を取って置く。「江口秋が担当」は
 * 冒頭で伝えているので、ここでは違い（編集を含むか）だけを書く。
 */
export function PortfolioServicePricing({ en = false }: { en?: boolean }) {
  const plans = portfolioPlans(en);
  return (
    <div data-portfolio-pricing="unified" className="ks-plans">
      <h2>{en ? "Plans and pricing" : "制作内容・料金"}</h2>
      <p className="ks-plans__lead">
        {en
          ? "Both plans use the same admin panel, so you can update the site yourself. The difference is whether photo selection and text editing are included."
          : "どちらも同じ管理画面で、公開後は自分で更新できます。違いは、写真と文章の編集を含めるかどうかです。"}
      </p>
      <div className="ks-plans__grid">
        {plans.map((p) => (
          <article key={p.id} className="ks-plan">
            <h3>{p.name}</h3>
            <p className="ks-plan__price">
              ¥{p.price}
              <span>{en ? "tax included, one-time" : "税込・一回"}</span>
            </p>
            <p className="ks-plan__intro">{p.intro}</p>
            <ul>
              {p.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a href={`${CONSULT_PATH}?plan=${p.id}`} className="ks-link">
              {en ? "Ask about this plan (Japanese)" : "このプランで無料相談"}
            </a>
          </article>
        ))}
      </div>
      <p className="ks-plans__note">
        {en
          ? "¥69,800 includes the ¥30,000 setup plan — no double payment. Hosting and domain charges are separate and confirmed before the contract. No charge for consultation; scope, schedule and terms are agreed before payment."
          : "69,800円は制作費の総額です。30,000円が別途加算されることはありません。サーバー・ドメインの実費は別途、契約前に提示します。相談は無料。制作範囲・日程・取引条件に合意してからお支払いへ進みます。"}
      </p>
      <div className="ks-plans__care">
        <h3>{en ? "After launch: optional updates" : "公開後の更新も任せたいときだけ"}</h3>
        <p>
          {en
            ? "Optional ¥9,800/month: one update session, up to 10 photos or 500 Japanese characters, within 60 minutes. Separately agreed; not added automatically."
            : "月額9,800円（税込・任意）。月1回、写真10枚または文章500字までの差し替え・表示確認を60分以内で対応。開始日・停止条件は個別に合意し、自動では追加されません。"}
        </p>
        <a className="ks-link" href={`${CONSULT_PATH}?plan=care`}>
          {en ? "Discuss updates (Japanese) →" : "更新について相談 →"}
        </a>
      </div>
      <p className="ks-plans__check">
        <a className="ks-link" href={studioHref("/tools/readiness", "pricing-readiness")}>
          {en ? "Not sure? Free readiness check (Japanese) →" : "迷ったら、無料の公開準備チェック →"}
        </a>
      </p>
    </div>
  );
}
