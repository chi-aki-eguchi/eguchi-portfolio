/** Current published offer, not a new price or contract approval. Shared by UI, HTML and delivery tools. */
export const PORTFOLIO_PRODUCT = {
  id: "portfolio-kit-concierge",
  termsVersion: "published-2026-09-06",
  currency: "JPY",
  taxIncluded: true,
  setupPrice: 30000,
  editorialPrice: 69800,
  optionalEditingMonthlyPrice: 9800,
  hosting: "separate-actual-cost",
  delivery: ["configured-site", "private-admin-access", "recipient-guide", "release-record"],
  pdf: "browser-local-projects-and-json; images-backed-up-separately; no-press-certification",
} as const;

export function portfolioPlans(en = false) {
  return [
    { id: "basic", name: en ? "Setup & publishing" : "公開おまかせ", price: PORTFOLIO_PRODUCT.setupPrice.toLocaleString("ja-JP"), intro: en ? "For photographs and text you have already prepared." : "写真と文章は、自分で用意できる方へ。", items: en ? ["Site setup with your photographs and text", "Your own domain and public launch", "An admin panel you can keep using"] : ["ご用意いただいた写真・文章でサイトを設定", "独自ドメインの設定・公開確認", "納品後も自分で使える管理画面"] },
    { id: "editorial", name: en ? "Editing, setup & publishing" : "写真・文章編集付き", price: PORTFOLIO_PRODUCT.editorialPrice.toLocaleString("ja-JP"), intro: en ? "For help choosing the photographs and finding the words." : "写真選び・並べ方・プロフィールから相談したい方へ。", items: en ? ["Everything in setup & publishing", "Select up to 30 photographs from 60 candidates", "Organize up to 1,500 Japanese characters", "Home, 3 galleries, profile and contact", "45-minute meeting and one revision", "Target: 7 business days after receiving all materials"] : ["公開おまかせの内容をすべて含む", "候補60枚から掲載30枚までを選定・構成", "日本語1,500字までの文章を整理", "トップ・3ギャラリー・プロフィール・問い合わせ", "45分の打ち合わせ・修正1回", "素材が揃ってから7営業日を目安に公開"] },
  ];
}
