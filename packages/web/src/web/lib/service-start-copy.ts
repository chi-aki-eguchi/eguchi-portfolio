export type ServiceStartLanguage = "ja" | "en";

export type ArrivalBannerCopy = {
  badge: string;
  title: string;
  body: string;
  summaryRows: { label: string; value: string }[];
};

export type StepCopy = { title: string; body: string };

type StartPageCopy = {
  pageLabel: string;
  pageTitle: string;
  intro: string;
  introNote: string;
  arrival: ArrivalBannerCopy;
  supportNotice: string;
  materialsChecklist: string[];
  deliveryPanelTitle: string;
  deliverySteps: StepCopy[];
  afterHandoffTitle: string;
  afterHandoffSteps: StepCopy[];
  supportFooter: string;
  handoffRows: string[];
  handoffIntro: string;
  handoffPasswordNote: string;
};

const deliveryMaterialRequest = {
  ja: "公開に使う範囲でOKの写真だけを添付、または合意済みの非公開共有先（転送サービス）で共有してください。",
  en: "Please send photos only you authorize for publication, either as attachments or via the agreed private sharing destination.",
} as const;

export const SERVICE_START_COPY: Record<ServiceStartLanguage, StartPageCopy> = {
  ja: {
    pageLabel: "開始ガイド",
    pageTitle: "購入後の進め方",
    intro:
      "設定はすべてこちらで行います。通常2営業日以内に素材のお願いをメールでお送りします。素材がそろってからは、合意した見積内容に基づいて制作を進めます。既存のご購入条件や合意内容がある場合は、それを優先します。",
    introNote:
      "このページだけでは入金状況を確認できません。お支払い内容はStripeの確認画面・メールと、合意した見積書をご確認ください。",
    arrival: {
      badge: "支払い・制作のご案内",
      title: "次は、素材と日程を確認します。",
      body: "お支払いがお済みの方は、下の案内に沿って素材をご準備ください。入金確認後、合意した内容で制作を進めます。このページだけでは入金状況は確認できません。",
      summaryRows: [
        { label: "お支払い", value: "Stripeの確認画面・メールをご確認ください" },
        { label: "領収書", value: "このページでは発行していません" },
        {
          label: "条件",
          value: "プラン・金額・日程は、合意済みの見積書・契約をご確認ください",
        },
      ],
    },
    supportNotice:
      "日本語・簡単英語での運用サポートは当面継続しています。デザイン変更や追加作業は都度見積します。",
    materialsChecklist: [
      "わかる範囲でご記入ください（あとからの追加・変更も大丈夫です）。",
      "",
      "■ お名前（サイトに出す表記）:",
      "",
      "■ 載せたい写真（掲載許可を確認した写真のみ）:",
      "",
      "■ プロフィール文・連絡先・SNS:",
      "",
      "■ 独自ドメイン（なくても大丈夫です。「取得から相談したい」と書いてください。あなた名義で取得します。ドメイン会社への実費は別途）:",
      "",
      `■ 写真共有先（合意済みの非公開先）: ${deliveryMaterialRequest.ja}`,
      "",
    ],
    deliveryPanelTitle: "公開までの流れ",
    deliverySteps: [
      {
        title: "素材を送る",
        body: "サイトに出すお名前、プロフィール文、連絡先、SNS、最初に載せたい写真をメールで送ります。数枚だけでも始められます。大きいファイルは合意済みの非公開共有先で共有してください。",
      },
      {
        title: "こちらで設置",
        body: "素材がそろってから、合意した見積内容に基づいて公開準備を進めます。条件の詳細は別途の見積や既存契約を優先します。",
      },
      {
        title: "納品",
        body: "サイトURL・管理画面URL・運用ガイドを1通のメールで渡します。公開準備は完了しています。",
      },
    ],
    afterHandoffTitle: "納品後の最初の一歩",
    afterHandoffSteps: [
      {
        title: "管理画面にログイン",
        body: "納品メールに書かれた管理画面URLを開き、別経路で案内したログイン情報で入ります。",
      },
      {
        title: "「はじめに」で写真を1枚",
        body: "最初に「はじめに」画面が開きます。案内に沿って写真を1枚追加し、トップ写真に選んだあと、実際のトップページに表示されるところまで確認できます。",
      },
      {
        title: "あとは自分のペースで",
        body: "写真の追加、並び替え、プロフィールの手直しは、いつでも管理画面からできます。わからないことは、そのままメールで聞いてください。",
      },
    ],
    supportFooter:
      "操作方法の相談は、当面は期間・回数の制限なく受け付けます。デザイン変更・作業代行は内容に応じて別途お見積りします。",
    handoffRows: [
      "あなたのサイトURL",
      "管理画面URL",
      "運用ガイド",
      "最初に入れる写真",
      "困った時の連絡先",
    ],
    handoffIntro:
      "引き渡し時にまとめて渡すのは、実作業に必要なURL・ガイド・連絡窓口です。ログインパスワードは、別の安全な経路（別メール/別窓口）で送付します。",
    handoffPasswordNote: "運用上の安全性のため、管理パスワードは引き渡し本文とは分けて送ります。",
  },
  en: {
    pageLabel: "Start guide",
    pageTitle: "After purchase, next steps",
    intro:
      "I handle the technical setup. After verifying payment, I normally email the materials request within 2 business days. Once your materials are ready, I follow the agreed quote and schedule. Any existing agreement, including an earlier response or delivery deadline, takes precedence.",
    introNote:
      "This page cannot confirm payment by itself. Please verify payment from the Stripe confirmation screen, your confirmation email, and your agreed quote.",
    arrival: {
      badge: "Payment and delivery guide",
      title: "Next, we confirm your materials and schedule.",
      body: "If you have completed payment, you can prepare your materials using the guide below. Work starts after payment is verified, according to your agreement. This page cannot confirm payment by itself.",
      summaryRows: [
        { label: "Payment", value: "Check your Stripe confirmation screen or email." },
        { label: "Receipt", value: "No receipt is issued on this page." },
        { label: "Agreement", value: "Check your agreed quote or contract for the plan, amount and schedule." },
      ],
    },
    supportNotice:
      "The admin panel is available in English and Japanese — switch anytime with the JP | EN toggle. Support is provided in Japanese and simple English. Design changes and custom work are quoted separately.",
    materialsChecklist: [
      "Please fill in what you can — additions and changes are welcome later.",
      "",
      "- Name to display on the site:",
      "",
      "- Publish-authorized photographs (a few are enough):",
      "",
      "- Profile text, contact details, social links:",
      "",
      '- Custom domain (if you do not have one, write "let\'s register one together"; it will be in your name and provider fee is separate):',
      "",
      `- Private sharing destination (agreed): ${deliveryMaterialRequest.en}`,
      "",
    ],
    deliveryPanelTitle: "From materials to handover",
    deliverySteps: [
      {
        title: "Send your materials",
        body: "Email your site name, profile text, contact details, social links, and first photos. A small selection is fine. For big files, use the agreed private sharing destination.",
      },
      {
        title: "I prepare and launch",
        body: "After your materials are ready, I prepare the site according to the agreed scope and quotes. If there is an existing contract, that contract governs the timeline.",
      },
      {
        title: "Handover",
        body: "You receive the public site URL, admin URL, and admin guide in one message. The site is already published.",
      },
    ],
    afterHandoffTitle: "First steps after handover",
    afterHandoffSteps: [
      {
        title: "Sign in to the admin panel",
        body: "Open the admin URL from the handover email and sign in with credentials sent through a separate secure route.",
      },
      {
        title: "Add one photograph from “Getting started”",
        body: "The “Getting started” screen opens first. Follow it to add one photograph, choose it as your lead image, and confirm it appears on the actual home page.",
      },
      {
        title: "Continue at your own pace",
        body: "You can add, reorder, and edit your profile from the admin panel at any time. If anything is unclear, email me.",
      },
    ],
    supportFooter:
      "Guidance on using the site and admin panel is currently unlimited (this may become time-limited in the future). Design changes and custom execution are quoted separately.",
    handoffRows: [
      "Your public site URL",
      "Admin panel URL",
      "Usage documentation",
      "First photograph to add",
      "Support contact",
    ],
    handoffIntro:
      "What I send in handoff is one clear message with the URLs and documentation you actually use. Login credentials are sent through a separate secure route.",
    handoffPasswordNote: "For security, passwords are not included in the same handoff email.",
  },
} as const;

export function getCheckoutArrivalCopy(
  language: ServiceStartLanguage,
  search: string,
): ArrivalBannerCopy | null {
  const params = new URLSearchParams(search);
  if (!params.has("thanks") && !params.has("checkout_session_id")) {
    return null;
  }
  return SERVICE_START_COPY[language].arrival;
}
