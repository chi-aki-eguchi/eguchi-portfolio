export type PolicyKind = "privacy" | "terms" | "legal";
export type PolicyLanguage = "ja" | "en";

export type PolicyLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type PolicyRow = {
  label: string;
  value: string;
  pending?: boolean;
};

export type PolicySection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  rows?: readonly PolicyRow[];
  links?: readonly PolicyLink[];
  warning?: boolean;
  serviceOnly?: boolean;
};

export type PolicyDocument = {
  eyebrow: string;
  title: string;
  description: string;
  lead: string;
  sections: readonly PolicySection[];
  contactLabel: string;
};

const documents: Record<
  PolicyLanguage,
  Record<PolicyKind, PolicyDocument>
> = {
  ja: {
    privacy: {
      eyebrow: "Privacy",
      title: "プライバシーポリシー",
      description:
        "本サイトで取り扱う問い合わせ情報、アクセス解析、外部サービスについて説明します。",
      lead: "本サイトで取り扱う情報と、その利用方法を説明します。",
      sections: [
        {
          heading: "取り扱う情報",
          paragraphs: [
            "問い合わせフォームでは、お名前、メールアドレス、件名（任意）、メッセージを入力いただきます。",
            "サイトの閲覧時には、アクセスしたページや利用環境に関する情報が、アクセス解析サービスを通じて処理される場合があります。",
          ],
        },
        {
          heading: "利用目的",
          bullets: [
            "問い合わせへの返信と、依頼・取引に必要な連絡",
            "迷惑送信の抑制と、サイトの安全な運用",
            "サイトの利用状況の把握と改善",
          ],
        },
        {
          heading: "外部サービス",
          paragraphs: [
            "問い合わせフォームは、サイト運営者が設定した外部のフォーム送信サービスへ入力内容を送信します。送信前に入力内容をご確認ください。",
            "本サイトでは Google Analytics を使用する場合があります。Google による情報の取り扱いは、同社が公開する方針をご確認ください。",
          ],
          links: [
            {
              label: "Google プライバシーポリシー",
              href: "https://policies.google.com/privacy?hl=ja",
              external: true,
            },
            {
              label: "Google によるサイト利用情報の取り扱い",
              href: "https://policies.google.com/technologies/partner-sites?hl=ja",
              external: true,
            },
          ],
        },
        {
          heading: "Portfolio Kit の決済",
          paragraphs: [
            "Portfolio Kit の購入手続きへ進む場合は Stripe の決済画面を利用します。決済時に入力する情報は Stripe の方針に従って取り扱われます。",
          ],
          links: [
            {
              label: "Stripe プライバシーポリシー",
              href: "https://stripe.com/jp/privacy",
              external: true,
            },
          ],
          serviceOnly: true,
        },
        {
          heading: "Cookie とブラウザ内の保存",
          paragraphs: [
            "表示テーマの選択を保つため、ブラウザのローカルストレージを使用します。アクセス解析サービスが Cookie 等を使用する場合があります。ブラウザの設定から保存済みデータを削除できます。",
          ],
        },
        {
          heading: "保管・確認・削除の相談",
          paragraphs: [
            "サイト運営者が保管する情報は、上記の利用目的に必要な範囲で取り扱います。外部サービス側での保管は、各サービスの方針に従います。ご自身の情報の確認、訂正、削除については Contact からご相談ください。",
          ],
        },
        {
          heading: "変更",
          paragraphs: [
            "取り扱う情報や利用するサービスを変更した場合は、このページの内容を更新します。",
          ],
        },
      ],
      contactLabel: "個人情報について問い合わせる",
    },
    terms: {
      eyebrow: "Terms",
      title: "利用条件",
      description:
        "本サイトの閲覧、掲載コンテンツ、問い合わせに関する利用条件を説明します。",
      lead: "本サイトの閲覧・利用に適用する条件です。",
      sections: [
        {
          heading: "掲載コンテンツ",
          paragraphs: [
            "写真、文章、デザインその他の掲載コンテンツに関する権利は、それぞれの権利者に帰属します。個別に許可された場合を除き、転載、複製、改変、再配布、販売、その他の商用利用はできません。利用を希望する場合は、事前に Contact からご相談ください。",
          ],
        },
        {
          heading: "禁止事項",
          bullets: [
            "本サイトや第三者の権利を侵害する行為",
            "不正アクセス、過度な負荷、その他サイトの運営を妨げる行為",
            "問い合わせフォームを使った虚偽、迷惑、営業目的の大量送信",
            "法令に違反する行為",
          ],
        },
        {
          heading: "外部サービス・リンク",
          paragraphs: [
            "本サイトから外部サービスへ移動した後は、各サービスの利用条件とプライバシーポリシーが適用されます。",
          ],
        },
        {
          heading: "Portfolio Kit の利用範囲",
          bullets: [
            "1回の購入につき1サイトで利用できます。2サイト目以降は追加購入が必要です。",
            "テンプレートとしての再販売・再配布はできません。",
            "テンプレート本体の更新は現時点では無償ですが、今後変更する場合があります。",
            "操作方法の相談は当面、期間・回数の制限なく受け付けますが、今後変更する場合があります。",
            "デザイン変更、個別カスタム、作業代行は内容に応じて別途見積もりとなります。",
            "公開場所と独自ドメインは購入者名義の外部サービス契約となり、その実費は商品価格に含まれません。",
          ],
          serviceOnly: true,
        },
        {
          heading: "購入前の確認",
          paragraphs: [
            "販売事業者情報、支払い、納品、キャンセル・返金に関する条件は「販売条件・特商法表示」をご確認ください。未確定と表示されている項目は、決済前に Contact から条件の提示を受け、内容を確認してください。",
          ],
          serviceOnly: true,
        },
        {
          heading: "変更・問い合わせ",
          paragraphs: [
            "条件を変更した場合は、このページの内容を更新します。不明点や利用許諾の相談は Contact からご連絡ください。",
          ],
        },
      ],
      contactLabel: "利用条件について問い合わせる",
    },
    legal: {
      eyebrow: "Online sales",
      title: "特定商取引法に基づく表記・販売条件",
      description:
        "Portfolio Kit の価格、支払い、納品と、購入前に確認が必要な販売条件を記載します。",
      lead:
        "このページは Portfolio Kit について、公開済みの販売内容と、購入前に確認が必要な項目を分けて記載します。",
      sections: [
        {
          heading: "購入前に必ずご確認ください",
          paragraphs: [
            "販売事業者の氏名または名称・住所・電話番号、消費税の扱い、キャンセル・返金条件は、公開内容としての確認が完了していません。決済前に Contact からこれらの提示を依頼し、回答を受けて内容に同意できる場合にのみ購入手続きへ進んでください。",
          ],
          warning: true,
        },
        {
          heading: "販売事業者情報",
          rows: [
            {
              label: "販売事業者の氏名または名称",
              value:
                "購入希望者から請求があった場合、購入前に遅滞なく提示します。請求は Contact からお願いします。",
              pending: true,
            },
            {
              label: "住所",
              value:
                "購入希望者から請求があった場合、購入前に遅滞なく提示します。請求は Contact からお願いします。",
              pending: true,
            },
            {
              label: "電話番号",
              value:
                "購入希望者から請求があった場合、購入前に遅滞なく提示します。請求は Contact からお願いします。",
              pending: true,
            },
            {
              label: "問い合わせ窓口",
              value: "本サイトの Contact ページ",
            },
          ],
        },
        {
          heading: "商品と価格",
          rows: [
            {
              label: "商品名",
              value: "Aki Eguchi Portfolio Kit「公開おまかせ」",
            },
            {
              label: "販売価格",
              value:
                "公開中の Portfolio Kit ページでは ¥30,000 と表示しています。決済画面の最終表示をご確認ください。消費税の扱いは購入前にお問い合わせください。",
              pending: true,
            },
            {
              label: "商品代金以外の費用",
              value:
                "外部サービスの実費として、公開場所は月500〜1,000円程度、独自ドメインは年1,500〜2,000円程度が目安です。料金改定や使用量により変わり、購入者名義で契約します。デザイン変更・個別カスタムは別途見積もりです。",
            },
            {
              label: "利用範囲",
              value:
                "1回の購入につき1サイト。2サイト目以降は追加購入が必要で、テンプレートの再販売・再配布はできません。",
            },
          ],
        },
        {
          heading: "支払いと提供時期",
          rows: [
            {
              label: "支払い方法",
              value:
                "Stripe の決済画面に表示される方法を利用します。利用可能な方法は決済画面でご確認ください。",
            },
            {
              label: "支払い時期",
              value:
                "購入手続き時に Stripe で決済します。実際の引き落とし時期は、選択した決済手段の条件に従います。",
            },
            {
              label: "案内・提供時期",
              value:
                "決済後24時間以内に素材のお願いをメールで送ります。必要な素材が揃ってから3日以内に、公開した状態でサイトを渡します。",
            },
          ],
        },
        {
          heading: "キャンセル・返品・返金",
          rows: [
            {
              label: "適用条件",
              value:
                "現在、公開条件としての確認が完了していません。決済前に、作業着手前・着手後・納品後それぞれのキャンセル可否と返金の扱いを Contact から確認してください。回答を受けるまでは決済へ進まないでください。",
              pending: true,
            },
          ],
        },
      ],
      contactLabel: "購入前の条件を確認する",
    },
  },
  en: {
    privacy: {
      eyebrow: "Privacy",
      title: "Privacy Policy",
      description:
        "How this website handles inquiry details, analytics data, and external services.",
      lead: "This page explains what information this website handles and why.",
      sections: [
        {
          heading: "Information handled",
          paragraphs: [
            "The contact form asks for your name, email address, an optional subject, and your message.",
            "When you visit the site, information about viewed pages and your browsing environment may be processed through an analytics service.",
          ],
        },
        {
          heading: "Purposes",
          bullets: [
            "Replying to inquiries and communicating about requests or transactions",
            "Reducing spam and operating the site safely",
            "Understanding site usage and improving the site",
          ],
        },
        {
          heading: "External services",
          paragraphs: [
            "The contact form sends the information you enter to the external form-delivery service configured by the site operator. Please check your message before sending it.",
            "This site may use Google Analytics. Please see Google's published policies for details about how Google handles information.",
          ],
          links: [
            {
              label: "Google Privacy Policy",
              href: "https://policies.google.com/privacy?hl=en",
              external: true,
            },
            {
              label: "How Google uses information from sites",
              href: "https://policies.google.com/technologies/partner-sites?hl=en",
              external: true,
            },
          ],
        },
        {
          heading: "Portfolio Kit checkout",
          paragraphs: [
            "If you proceed to purchase Portfolio Kit, checkout takes place on Stripe. Information entered during payment is handled under Stripe's policies.",
          ],
          links: [
            {
              label: "Stripe Privacy Policy",
              href: "https://stripe.com/privacy",
              external: true,
            },
          ],
          serviceOnly: true,
        },
        {
          heading: "Cookies and browser storage",
          paragraphs: [
            "The site uses browser local storage to remember your theme preference. Analytics services may use cookies or similar technologies. You can remove stored data in your browser settings.",
          ],
        },
        {
          heading: "Retention and requests",
          paragraphs: [
            "Information held by the site operator is handled only as needed for the purposes above. Retention by external services follows each provider's policy. To ask about access, correction, or deletion of your information, use the Contact page.",
          ],
        },
        {
          heading: "Changes",
          paragraphs: [
            "This page will be updated if the information handled or the services used by this site change.",
          ],
        },
      ],
      contactLabel: "Ask about personal information",
    },
    terms: {
      eyebrow: "Terms",
      title: "Terms of Use",
      description:
        "Terms for browsing this website and using its content and contact form.",
      lead: "These terms apply to browsing and using this website.",
      sections: [
        {
          heading: "Site content",
          paragraphs: [
            "Rights in the photographs, writing, design, and other content belong to their respective rightsholders. Unless you have specific permission, you may not reproduce, copy, modify, redistribute, sell, or otherwise use the content commercially. Please ask through Contact before using any content.",
          ],
        },
        {
          heading: "Prohibited activity",
          bullets: [
            "Infringing the rights of this site or any third party",
            "Unauthorized access, excessive load, or other interference with the site",
            "False, abusive, or bulk promotional submissions through the contact form",
            "Activity that violates applicable law",
          ],
        },
        {
          heading: "External services and links",
          paragraphs: [
            "Once you move to an external service from this site, that provider's terms and privacy policy apply.",
          ],
        },
        {
          heading: "Portfolio Kit license scope",
          bullets: [
            "One purchase covers one website. A second site requires an additional purchase.",
            "The template may not be resold or redistributed.",
            "Template updates are currently provided at no charge, but this may change.",
            "Usage guidance is currently available without a time or session limit, but this may change.",
            "Design changes, custom development, and work performed on your behalf are quoted separately.",
            "Hosting and a custom domain are external contracts in the buyer's name, and their fees are not included in the product price.",
          ],
          serviceOnly: true,
        },
        {
          heading: "Before purchasing",
          paragraphs: [
            "See Online Sales Disclosure for seller details, payment, delivery, cancellation, and refund terms. Where an item is marked pending, request the terms through Contact and review the response before paying.",
          ],
          serviceOnly: true,
        },
        {
          heading: "Changes and questions",
          paragraphs: [
            "If these terms change, this page will be updated. For questions or permission to use content, contact the site operator through Contact.",
          ],
        },
      ],
      contactLabel: "Ask about these terms",
    },
    legal: {
      eyebrow: "Online sales",
      title: "Online Sales Disclosure",
      description:
        "Portfolio Kit pricing, payment, delivery, and sales terms that must be confirmed before purchase.",
      lead:
        "For Portfolio Kit, this page separates currently published sales details from items that still require confirmation.",
      sections: [
        {
          heading: "Please confirm before purchasing",
          paragraphs: [
            "The seller's legal name, address and telephone number, tax treatment, and cancellation and refund rules have not yet been confirmed for public display. Before paying, request these items through Contact and proceed only after receiving and accepting the response.",
          ],
          warning: true,
        },
        {
          heading: "Seller information",
          rows: [
            {
              label: "Seller name",
              value:
                "Provided without delay, before purchase, when requested by a prospective buyer through Contact.",
              pending: true,
            },
            {
              label: "Address",
              value:
                "Provided without delay, before purchase, when requested by a prospective buyer through Contact.",
              pending: true,
            },
            {
              label: "Telephone number",
              value:
                "Provided without delay, before purchase, when requested by a prospective buyer through Contact.",
              pending: true,
            },
            {
              label: "Contact",
              value: "The Contact page on this website",
            },
          ],
        },
        {
          heading: "Product and price",
          rows: [
            {
              label: "Product",
              value: 'Aki Eguchi Portfolio Kit, “Done-for-you launch”',
            },
            {
              label: "Price",
              value:
                "The current Portfolio Kit page displays ¥30,000. Check the final amount shown at checkout. Ask about tax treatment before purchase.",
              pending: true,
            },
            {
              label: "Additional costs",
              value:
                "The sales page estimates external hosting at about ¥500–1,000 per month and a custom domain at about ¥1,500–2,000 per year. Actual fees may change and are contracted in the buyer's name. Design changes and custom work are quoted separately.",
            },
            {
              label: "License scope",
              value:
                "One purchase covers one website. A second site requires another purchase, and the template may not be resold or redistributed.",
            },
          ],
        },
        {
          heading: "Payment and delivery",
          rows: [
            {
              label: "Payment method",
              value:
                "Use a method shown on Stripe Checkout. Available methods are displayed at checkout.",
            },
            {
              label: "Payment timing",
              value:
                "Payment is made through Stripe during purchase. The actual charge date follows the terms of the selected payment method.",
            },
            {
              label: "Delivery timing",
              value:
                "A request for your materials is emailed within 24 hours after payment. The published website is delivered within three days after all required materials are received.",
            },
          ],
        },
        {
          heading: "Cancellation, returns, and refunds",
          rows: [
            {
              label: "Applicable terms",
              value:
                "The public terms have not yet been confirmed. Before paying, ask through Contact how cancellation and refunds are handled before work starts, after work starts, and after delivery. Do not proceed until you receive a response.",
              pending: true,
            },
          ],
        },
      ],
      contactLabel: "Confirm the terms before purchase",
    },
  },
};

const policyRoutes: Record<string, { kind: PolicyKind; language: PolicyLanguage }> = {
  "/privacy": { kind: "privacy", language: "ja" },
  "/privacy/en": { kind: "privacy", language: "en" },
  "/terms": { kind: "terms", language: "ja" },
  "/terms/en": { kind: "terms", language: "en" },
  "/legal": { kind: "legal", language: "ja" },
  "/legal/en": { kind: "legal", language: "en" },
};

/**
 * The sales disclosure still contains owner-confirmation fields. Keep checkout
 * behind a pre-purchase enquiry until those fields and the cancellation terms
 * are replaced with confirmed copy. This single flag also controls noindex.
 */
export const SALES_DISCLOSURE_PENDING = true;

export const POLICY_PATHS = Object.freeze(Object.keys(policyRoutes));

// `/legal` は本人確認待ちの Pending 欄が残る間も購入前リンクから読めるが、
// 検索入口としては推さない。公開済みのPrivacy・利用条件だけを sitemap に載せる。
export const INDEXABLE_POLICY_PATHS = Object.freeze([
  "/privacy",
  "/privacy/en",
  "/terms",
  "/terms/en",
] as const);

export function policyDocument(
  kind: PolicyKind,
  language: PolicyLanguage,
): PolicyDocument {
  return documents[language][kind];
}

export function policyRoute(
  pathname: string,
): { kind: PolicyKind; language: PolicyLanguage } | null {
  return policyRoutes[pathname.replace(/\/+$/, "") || "/"] ?? null;
}

export function policyPath(
  kind: PolicyKind,
  language: PolicyLanguage,
): string {
  return language === "en" ? `/${kind}/en` : `/${kind}`;
}
