import { CONSULT_PATH } from "../lib/portfolio-intake";
import { studioHref } from "./StudioBridge";

export function PortfolioServicePricing({ en = false }: { en?: boolean }) {
  const plans = [
    { id: "basic", name: en ? "Setup & publishing" : "公開おまかせ", price: "30,000", intro: en ? "For photographs and text you have already prepared." : "写真と文章は、自分で用意できる方へ。", items: en ? ["Site setup with your photographs and text", "Your own domain and public launch", "An admin panel you can keep using"] : ["ご用意いただいた写真・文章でサイトを設定", "独自ドメインの設定・公開確認", "納品後も自分で使える管理画面"] },
    { id: "editorial", name: en ? "Editing, setup & publishing" : "写真・文章編集付き", price: "69,800", intro: en ? "For help choosing the photographs and finding the words." : "写真選び・並べ方・プロフィールから相談したい方へ。", items: en ? ["Everything in setup & publishing", "Select up to 30 photographs from 60 candidates", "Organize up to 1,500 Japanese characters", "Home, 3 galleries, profile and contact", "45-minute meeting and one revision", "Target: 7 business days after receiving all materials"] : ["公開おまかせの内容をすべて含む", "候補60枚から掲載30枚までを選定・構成", "日本語1,500字までの文章を整理", "トップ・3ギャラリー・プロフィール・問い合わせ", "45分の打ち合わせ・修正1回", "素材が揃ってから7営業日を目安に公開"] },
  ];
  return <div data-portfolio-pricing="unified">
    <h2 className="text-center text-2xl leading-relaxed mb-4">{en ? "One website. Choose how much help you need." : "同じサイトを、どこから一緒につくるか。"}</h2>
    <p className="max-w-2xl mx-auto text-center text-base leading-8 mb-8 text-[color:var(--text-quiet)]">{en ? "Both plans use the same Portfolio Kit admin panel. Aki Eguchi handles your consultation, production and delivery. Support is in Japanese." : "どちらも同じ Portfolio Kit の管理画面で、自分で更新できるサイトです。相談から制作・納品まで江口秋が担当します。違いは、写真と文章の編集を含めるかどうか。"}</p>
    <div className="grid sm:grid-cols-2 gap-6 items-stretch">{plans.map(p => <article key={p.id} className="border border-[rgba(var(--foreground-rgb),0.2)] rounded-lg p-6 md:p-8 flex flex-col">
      <h3 className="text-xl leading-8">{p.name}</h3><p className="mt-4 font-en text-3xl">¥{p.price}<span className="ml-2 text-sm">{en ? "total / one-time" : "税込・一回"}</span></p>
      <p className="mt-4 text-base leading-8 text-[color:var(--text-quiet)]">{p.intro}</p>
      <ul className="my-6 pl-5 list-disc space-y-3 text-base leading-7">{p.items.map(item => <li key={item}>{item}</li>)}</ul>
      <a href={`${CONSULT_PATH}?plan=${p.id}`} className="mt-auto inline-flex justify-center rounded-md px-4 py-4 bg-[var(--foreground)] text-[var(--background)] text-base">{en ? "Ask about this plan (Japanese)" : "このプランで無料相談"}</a>
    </article>)}</div>
    <p className="mt-6 text-base leading-8">{en ? "¥69,800 includes the ¥30,000 setup plan — no double payment. Hosting and domain charges are separate and confirmed before the contract. No charge for consultation; scope, schedule and terms are agreed before payment." : "69,800円は制作費の総額です。30,000円が別途加算されることはありません。サーバー・ドメインの実費は別途、契約前に提示します。相談は無料。制作範囲・日程・取引条件に合意してからお支払いへ進みます。"}</p>
    <div className="mt-8 border-t border-[rgba(var(--foreground-rgb),0.15)] pt-6 text-base leading-8"><h3 className="text-lg">{en ? "After launch: optional updates" : "公開後の更新も任せたいときだけ"}</h3><p className="mt-3">{en ? "Optional ¥9,800/month: one update session, up to 10 photos or 500 Japanese characters, within 60 minutes. Separately agreed; not added automatically." : "月額9,800円（税込・任意）。月1回、写真10枚または文章500字までの差し替え・表示確認を60分以内で対応。開始日・停止条件は個別に合意し、自動では追加されません。"}</p><a className="inline-block mt-3 underline underline-offset-4" href={`${CONSULT_PATH}?plan=care`}>{en ? "Discuss updates (Japanese) →" : "更新について相談 →"}</a></div>
    <div className="mt-8 text-center text-sm leading-7"><a className="underline underline-offset-4" href={studioHref("/tools/readiness", "pricing-readiness")}>{en ? "Not sure? Free readiness check (Japanese) →" : "迷ったら、無料の公開準備チェック →"}</a></div>
  </div>;
}
