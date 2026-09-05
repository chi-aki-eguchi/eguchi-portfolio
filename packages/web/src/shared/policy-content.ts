export type PolicyKind = "privacy" | "terms";
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

const documents: Record<PolicyLanguage, Record<PolicyKind, PolicyDocument>> = {
  "ja": {
    "privacy": {
      "eyebrow": "Privacy",
      "title": "プライバシーポリシー",
      "description": "本サイトで取り扱う問い合わせ情報、アクセス解析、外部サービスについて説明します。",
      "lead": "本サイトで取り扱う情報と、その利用方法を説明します。",
      "sections": [
        {
          "heading": "取り扱う情報",
          "paragraphs": [
            "問い合わせフォームでは、お名前、メールアドレス、件名（任意）、メッセージを入力いただきます。",
            "サイトの閲覧時には、アクセスしたページや利用環境に関する情報が、アクセス解析サービスを通じて処理される場合があります。"
          ]
        },
        {
          "heading": "利用目的",
          "bullets": [
            "問い合わせへの返信と、依頼・取引に必要な連絡",
            "迷惑送信の抑制と、サイトの安全な運用",
            "サイトの利用状況の把握と改善"
          ]
        },
        {
          "heading": "外部サービス",
          "paragraphs": [
            "問い合わせフォームは、サイト運営者が設定した外部のフォーム送信サービスへ入力内容を送信します。送信前に入力内容をご確認ください。",
            "本サイトでは Google Analytics を使用する場合があります。Google による情報の取り扱いは、同社が公開する方針をご確認ください。"
          ],
          "links": [
            {
              "label": "Google プライバシーポリシー",
              "href": "https://policies.google.com/privacy?hl=ja",
              "external": true
            },
            {
              "label": "Google によるサイト利用情報の取り扱い",
              "href": "https://policies.google.com/technologies/partner-sites?hl=ja",
              "external": true
            }
          ]
        },
        {
          "heading": "Cookie とブラウザ内の保存",
          "paragraphs": [
            "表示テーマの選択を保つため、ブラウザのローカルストレージを使用します。アクセス解析サービスが Cookie 等を使用する場合があります。ブラウザの設定から保存済みデータを削除できます。"
          ]
        },
        {
          "heading": "保管・確認・削除の相談",
          "paragraphs": [
            "サイト運営者が保管する情報は、上記の利用目的に必要な範囲で取り扱います。外部サービス側での保管は、各サービスの方針に従います。ご自身の情報の確認、訂正、削除については Contact からご相談ください。"
          ]
        },
        {
          "heading": "変更",
          "paragraphs": [
            "取り扱う情報や利用するサービスを変更した場合は、このページの内容を更新します。"
          ]
        }
      ],
      "contactLabel": "個人情報について問い合わせる"
    },
    "terms": {
      "eyebrow": "Terms",
      "title": "利用条件",
      "description": "本サイトの閲覧、掲載コンテンツ、問い合わせに関する利用条件を説明します。",
      "lead": "本サイトの閲覧・利用に適用する条件です。",
      "sections": [
        {
          "heading": "掲載コンテンツ",
          "paragraphs": [
            "写真、文章、デザインその他の掲載コンテンツに関する権利は、それぞれの権利者に帰属します。個別に許可された場合を除き、転載、複製、改変、再配布、販売、その他の商用利用はできません。利用を希望する場合は、事前に Contact からご相談ください。"
          ]
        },
        {
          "heading": "禁止事項",
          "bullets": [
            "本サイトや第三者の権利を侵害する行為",
            "不正アクセス、過度な負荷、その他サイトの運営を妨げる行為",
            "問い合わせフォームを使った虚偽、迷惑、営業目的の大量送信",
            "法令に違反する行為"
          ]
        },
        {
          "heading": "外部サービス・リンク",
          "paragraphs": [
            "本サイトから外部サービスへ移動した後は、各サービスの利用条件とプライバシーポリシーが適用されます。"
          ]
        },
        {
          "heading": "変更・問い合わせ",
          "paragraphs": [
            "条件を変更した場合は、このページの内容を更新します。不明点や利用許諾の相談は Contact からご連絡ください。"
          ]
        }
      ],
      "contactLabel": "利用条件について問い合わせる"
    }
  },
  "en": {
    "privacy": {
      "eyebrow": "Privacy",
      "title": "Privacy Policy",
      "description": "How this website handles inquiry details, analytics data, and external services.",
      "lead": "This page explains what information this website handles and why.",
      "sections": [
        {
          "heading": "Information handled",
          "paragraphs": [
            "The contact form asks for your name, email address, an optional subject, and your message.",
            "When you visit the site, information about viewed pages and your browsing environment may be processed through an analytics service."
          ]
        },
        {
          "heading": "Purposes",
          "bullets": [
            "Replying to inquiries and communicating about requests or transactions",
            "Reducing spam and operating the site safely",
            "Understanding site usage and improving the site"
          ]
        },
        {
          "heading": "External services",
          "paragraphs": [
            "The contact form sends the information you enter to the external form-delivery service configured by the site operator. Please check your message before sending it.",
            "This site may use Google Analytics. Please see Google's published policies for details about how Google handles information."
          ],
          "links": [
            {
              "label": "Google Privacy Policy",
              "href": "https://policies.google.com/privacy?hl=en",
              "external": true
            },
            {
              "label": "How Google uses information from sites",
              "href": "https://policies.google.com/technologies/partner-sites?hl=en",
              "external": true
            }
          ]
        },
        {
          "heading": "Cookies and browser storage",
          "paragraphs": [
            "The site uses browser local storage to remember your theme preference. Analytics services may use cookies or similar technologies. You can remove stored data in your browser settings."
          ]
        },
        {
          "heading": "Retention and requests",
          "paragraphs": [
            "Information held by the site operator is handled only as needed for the purposes above. Retention by external services follows each provider's policy. To ask about access, correction, or deletion of your information, use the Contact page."
          ]
        },
        {
          "heading": "Changes",
          "paragraphs": [
            "This page will be updated if the information handled or the services used by this site change."
          ]
        }
      ],
      "contactLabel": "Ask about personal information"
    },
    "terms": {
      "eyebrow": "Terms",
      "title": "Terms of Use",
      "description": "Terms for browsing this website and using its content and contact form.",
      "lead": "These terms apply to browsing and using this website.",
      "sections": [
        {
          "heading": "Site content",
          "paragraphs": [
            "Rights in the photographs, writing, design, and other content belong to their respective rightsholders. Unless you have specific permission, you may not reproduce, copy, modify, redistribute, sell, or otherwise use the content commercially. Please ask through Contact before using any content."
          ]
        },
        {
          "heading": "Prohibited activity",
          "bullets": [
            "Infringing the rights of this site or any third party",
            "Unauthorized access, excessive load, or other interference with the site",
            "False, abusive, or bulk promotional submissions through the contact form",
            "Activity that violates applicable law"
          ]
        },
        {
          "heading": "External services and links",
          "paragraphs": [
            "Once you move to an external service from this site, that provider's terms and privacy policy apply."
          ]
        },
        {
          "heading": "Changes and questions",
          "paragraphs": [
            "If these terms change, this page will be updated. For questions or permission to use content, contact the site operator through Contact."
          ]
        }
      ],
      "contactLabel": "Ask about these terms"
    }
  }
};

const policyRoutes: Record<string, { kind: PolicyKind; language: PolicyLanguage }> = {
  "/privacy": { kind: "privacy", language: "ja" },
  "/privacy/en": { kind: "privacy", language: "en" },
  "/terms": { kind: "terms", language: "ja" },
  "/terms/en": { kind: "terms", language: "en" },
};

export const POLICY_PATHS = Object.freeze(Object.keys(policyRoutes));
export const INDEXABLE_POLICY_PATHS = POLICY_PATHS;

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
