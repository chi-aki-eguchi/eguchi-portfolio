import { ArrowUpRight, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { resolveServiceContactEmail } from "../../shared/service-visibility";
import { api, jsonOrThrow } from "../lib/api";

const bodyStyle = {
  fontSize: "var(--body-size, 0.9rem)",
  lineHeight: "var(--body-leading, 1.95)",
  letterSpacing: "var(--body-tracking, 0.01em)",
} as const;

const labelStyle = {
  fontSize: "var(--section-label-size, 0.75rem)",
  color: "rgba(var(--foreground-rgb), var(--section-label-opacity, 0.35))",
  letterSpacing: "var(--section-label-tracking, 0.10em)",
  lineHeight: "var(--section-leading, 1.2)",
} as const;

type ServiceStartLanguage = "ja" | "en";

// Stripe Payment Link は決済後にこのページへリダイレクトする(Stripe側の設定は
// /start?thanks=1)。専用の完了画面が無いため、着地時のお礼と支払い完了の明示は
// このページが担う。素の /start はこれまでどおり購入後ガイドとして振る舞い、
// お礼は出さない(LPからの下見アクセスに「購入済み」と誤って伝えないため)。
// checkout_session_id は Stripe が {CHECKOUT_SESSION_ID} 付きリダイレクト設定
// だった場合の保険。
function checkoutArrivalSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

function isCheckoutArrival(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("thanks") || params.has("checkout_session_id");
}

function LanguageSwitch({
  language,
  search,
}: {
  language: ServiceStartLanguage;
  search: string;
}) {
  return (
    <nav
      aria-label="Language"
      className="mb-8 flex items-center justify-end gap-2 font-en text-[0.7rem] tracking-[0.12em] text-[rgba(var(--foreground-rgb),0.42)]"
    >
      {language === "ja" ? (
        <span aria-current="page" className="text-[rgba(var(--foreground-rgb),0.76)]">
          JP
        </span>
      ) : (
        <Link to={`/start${search}`} className="hover:text-[rgba(var(--foreground-rgb),0.76)]">
          JP
        </Link>
      )}
      <span aria-hidden="true">|</span>
      {language === "en" ? (
        <span aria-current="page" className="text-[rgba(var(--foreground-rgb),0.76)]">
          EN
        </span>
      ) : (
        <Link to={`/start/en${search}`} className="hover:text-[rgba(var(--foreground-rgb),0.76)]">
          EN
        </Link>
      )}
    </nav>
  );
}

// docs/purchase-thankyou.md の送付項目リストをメール下書きに差し込む。
// 決済から着地した購入者が、何を書けばいいか迷わず送れるようにする
function materialsMailtoHref(contactEmail: string, en: boolean): string {
  const subject = en ? "Portfolio Kit materials" : "Portfolio Kit 素材の送付";
  const body = en
    ? [
        "Please fill in what you can — additions and changes are welcome later.",
        "",
        "- Name to display on the site:",
        "",
        "- Photographs (attach them or paste a transfer-service link; a few are enough):",
        "",
        "- Profile text, contact details, social links:",
        "",
        '- Custom domain (or write "let\'s register one together"):',
        "",
      ].join("\n")
    : [
        "わかる範囲でご記入ください（あとからの追加・変更も大丈夫です）。",
        "",
        "■ お名前（サイトに出す表記）:",
        "",
        "■ 載せたい写真（添付か、ファイル転送サービスの共有URL。数枚でも大丈夫です）:",
        "",
        "■ プロフィール文・連絡先・SNS:",
        "",
        "■ 独自ドメイン（あれば。これからの場合は「取得から相談したい」で大丈夫です）:",
        "",
      ].join("\n");
  return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function PurchaseThanksBanner({ language }: { language: ServiceStartLanguage }) {
  const en = language === "en";
  return (
    <section className="mb-10 rounded-md border border-[rgba(var(--foreground-rgb),0.16)] bg-[rgba(var(--foreground-rgb),0.03)] p-5 sm:p-7">
      <p className="font-en uppercase mb-2" style={labelStyle}>
        Payment complete
      </p>
      <h2
        className={`${en ? "font-en" : "font-ja"} text-[rgba(var(--foreground-rgb),0.86)]`}
        style={{ fontSize: "clamp(1.15rem, 2.2vw, 1.5rem)", lineHeight: 1.55 }}
      >
        {en
          ? "Thank you — your payment is complete."
          : "ご購入ありがとうございます。お支払いは完了しています。"}
      </h2>
      <p
        className="mt-3 max-w-2xl text-[rgba(var(--foreground-rgb),0.56)]"
        style={bodyStyle}
      >
        {en
          ? "A receipt is sent to the email address used at checkout. This page is your start guide: you can send your materials right away, or simply wait for my email — it arrives within 24 hours."
          : "領収書は購入時のメールアドレスに届きます。このページがスタートガイドです。今すぐ素材を送っていただいても、24時間以内に届くご案内メールをお待ちいただいても、どちらでも大丈夫です。"}
      </p>
    </section>
  );
}

// 2026-07-18 オーナー決定: 販売プランは「公開おまかせ」のみ。購入者が
// Railway を操作することはなくなったため、このページはセルフ設置ガイドではなく
// 「素材を送る → 3日以内に納品 → 写真を入れる」の購入後案内に徹する。
// 設置リンクはオーナー専用の設置ツールになり、購入者には一切渡さない。
const deliverySteps = [
  {
    title: "素材を送る",
    body: "サイトに出すお名前、プロフィール文、連絡先、SNS、最初に載せたい写真をメールで送ります。数枚だけでも始められます。大きな写真は、ファイル転送サービスの共有URLでも構いません。",
  },
  {
    title: "こちらで設置（3日以内）",
    body: "素材が揃ってから3日以内に、公開場所の設定、独自ドメインの接続、プロフィールの初期設定まで整えます。ドメインをこれから取る場合は、画面共有で30分ほど、一緒に取得します（あなた名義）。",
  },
  {
    title: "納品",
    body: "サイトURL・管理画面URL・パスワードをお渡しします。公開された状態で届くので、あとは写真を入れるだけです。",
  },
] as const;

const afterHandoffSteps = [
  {
    title: "管理画面にログイン",
    body: "納品メールに書かれた管理画面URLを開き、お渡ししたパスワードでログインします。",
  },
  {
    title: "「はじめに」で写真を1枚",
    body: "最初に「はじめに」画面が開きます。案内にしたがって写真を1枚アップロードし、サイトに表示されるのを確かめてください。",
  },
  {
    title: "あとは自分のペースで",
    body: "写真の追加、並び替え、プロフィールの手直しは、いつでも管理画面からできます。わからないことは、そのままメールで聞いてください（当面は期間・回数の制限なし）。",
  },
] as const;

const deliveryStepsEn = [
  {
    title: "Send your materials",
    body: "Email the name you want displayed, profile text, contact details, social links, and the first photographs. A small selection is enough. For large files, a transfer-service link is fine.",
  },
  {
    title: "I set everything up (within three days)",
    body: "Once your materials are ready, I prepare the hosting, connect your domain, and set up your profile within three days. If you do not have a domain yet, we register one together in about 30 minutes over screen share, in your name.",
  },
  {
    title: "Handover",
    body: "You receive the public site URL, admin URL, and password. The site arrives already published — from there, you only add photographs.",
  },
] as const;

const afterHandoffStepsEn = [
  {
    title: "Sign in to the admin panel",
    body: "Open the admin URL from the handover email and sign in with the password you received. Switch the panel to English with the JP | EN toggle if you prefer.",
  },
  {
    title: "Add one photograph from “Getting started”",
    body: "The “Getting started” screen opens first. Follow it to upload one photograph and confirm it appears on your public site.",
  },
  {
    title: "Continue at your own pace",
    body: "Adding photographs, reordering, and editing your profile can all be done from the admin panel at any time. If anything is unclear, just email me — guidance is currently unlimited.",
  },
] as const;

function ExternalButton({
  href,
  children,
  variant = "solid",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "solid" | "outline";
}) {
  const cls =
    variant === "solid"
      ? "bg-[var(--foreground)] text-[var(--background)] hover:opacity-85"
      : "border border-[rgba(var(--foreground-rgb),0.18)] text-[rgba(var(--foreground-rgb),0.66)] hover:border-[rgba(var(--foreground-rgb),0.34)] hover:text-[rgba(var(--foreground-rgb),0.84)]";
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className={`inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-md px-6 py-2.5 font-ja text-sm transition-all duration-300 ${cls}`}
    >
      {children}
      {href.startsWith("http") ? <ArrowUpRight size={15} /> : null}
    </a>
  );
}

function StepPanel({
  title,
  subtitle,
  steps,
  children,
}: {
  title: string;
  subtitle: string;
  steps: readonly { title: string; body: string }[];
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--foreground-rgb),0.018)] p-5 sm:p-7">
      <p className="font-en uppercase mb-3" style={labelStyle}>
        {subtitle}
      </p>
      <h2
        className="font-ja text-[rgba(var(--foreground-rgb),0.84)]"
        style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)", lineHeight: 1.55 }}
      >
        {title}
      </h2>
      <ol className="mt-7 space-y-5">
        {steps.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-4">
            <span
              className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(var(--foreground-rgb),0.14)] font-en text-xs text-[rgba(var(--foreground-rgb),0.52)]"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="font-ja text-[rgba(var(--foreground-rgb),0.78)]">
                {step.title}
              </h3>
              <p
                className="mt-1 text-[rgba(var(--foreground-rgb),0.52)]"
                style={bodyStyle}
              >
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
        {children}
      </div>
    </section>
  );
}

function SupportSection({
  contactEmail,
  language,
}: {
  contactEmail: string;
  language: ServiceStartLanguage;
}) {
  const en = language === "en";
  return (
    <section className="mt-12 md:mt-16">
      <p className="font-en uppercase mb-3" style={labelStyle}>
        Support
      </p>
      <h2
        className={`${en ? "font-en" : "font-ja"} text-[rgba(var(--foreground-rgb),0.84)]`}
        style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)", lineHeight: 1.55 }}
      >
        {en ? "If anything is unclear, just ask." : "困ったら、そのまま聞いてください。"}
      </h2>
      <p
        className="mt-4 max-w-2xl text-[rgba(var(--foreground-rgb),0.56)]"
        style={bodyStyle}
      >
        {en
          ? "Technical settings are handled on my side, so you never need to touch them. When something looks wrong, email me what happened — a screenshot helps. Please hide passwords before sending one."
          : "サーバーやドメインなどの技術的な設定はこちらで持つので、あなたが触る必要はありません。何かおかしいと感じたら、状況をそのままメールで送ってください。画面のスクリーンショットがあると確認が早いです（パスワードは映さないようご注意ください）。"}
      </p>
      {contactEmail && (
        <div className="mt-6">
          <ExternalButton
            href={`mailto:${contactEmail}?subject=${encodeURIComponent(
              en ? "Portfolio Kit support" : "Portfolio Kit 相談",
            )}&body=${encodeURIComponent(
              en
                ? "What happened:\n\n\n(If possible, attach a screenshot — hide any passwords.)"
                : "困っている内容:\n\n\n(できれば画面のスクリーンショットを添付してください。パスワードは隠してください。)",
            )}`}
          >
            <Mail size={15} />
            {en ? "Email me" : "メールで相談する"}
          </ExternalButton>
        </div>
      )}
    </section>
  );
}

function HandoffCard({ language }: { language: ServiceStartLanguage }) {
  const en = language === "en";
  const rows = en
    ? [
        "Your public site URL",
        "Your admin URL",
        "Your admin password",
        "The first photographs to add",
        "Where to ask for help",
      ]
    : [
        "あなたのサイトURL",
        "管理画面URL",
        "管理パスワード",
        "最初に入れる写真",
        "困った時の連絡先",
      ];
  return (
    <section className="mt-12 md:mt-16 rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--background-rgb),0.52)] p-5 sm:p-7">
      <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start">
        <div>
          <p className="font-en uppercase mb-3" style={labelStyle}>
            Handoff card
          </p>
          <h2
            className={`${en ? "font-en" : "font-ja"} text-[rgba(var(--foreground-rgb),0.84)]`}
            style={{
              fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)",
              lineHeight: 1.55,
            }}
          >
            {en
              ? "The handover is one simple card."
              : "納品時に渡すのは、これだけです。"}
          </h2>
          <p
            className="mt-4 text-[rgba(var(--foreground-rgb),0.52)]"
            style={bodyStyle}
          >
            {en
              ? "You receive the entrances you will actually use, without a long list of technical settings."
              : "サーバーや環境変数の話は出しません。あなたが実際に使う入口だけをまとめて渡します。"}
          </p>
        </div>
        <div className="rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--foreground-rgb),0.025)] p-4 sm:p-5">
          <p className="font-en text-xs uppercase tracking-[0.12em] text-[rgba(var(--foreground-rgb),0.36)]">
            Aki Eguchi Portfolio Kit
          </p>
          <div className="mt-5 divide-y divide-[rgba(var(--foreground-rgb),0.08)]">
            {rows.map((row) => (
              <div key={row} className="flex items-center gap-3 py-3">
                <CheckCircle2
                  size={16}
                  className="shrink-0 text-[rgba(var(--foreground-rgb),0.42)]"
                />
                <span
                  className={`${en ? "font-en" : "font-ja"} text-sm text-[rgba(var(--foreground-rgb),0.66)]`}
                >
                  {row}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ServiceStartPage({
  language = "ja",
}: {
  language?: ServiceStartLanguage;
}) {
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const contactEmail = resolveServiceContactEmail(
    settingsData?.contactEmail,
    settingsData?.siteUrl,
    typeof window === "undefined" ? undefined : window.location.hostname,
  );
  const en = language === "en";
  const search = checkoutArrivalSearch();
  const arrivedFromCheckout = isCheckoutArrival(search);

  useEffect(() => {
    document.documentElement.lang = language;
    return () => {
      document.documentElement.lang = "ja";
    };
  }, [language]);

  return (
    <section
      lang={language}
      className="max-w-5xl mx-auto px-5 sm:px-6 md:px-12 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(6.5rem*var(--spacing-page-top,1))] pb-16 md:pb-28"
    >
      <LanguageSwitch language={language} search={search} />
      {arrivedFromCheckout && <PurchaseThanksBanner language={language} />}
      <header className="grid gap-10 md:grid-cols-[1.02fr_0.98fr] md:items-center">
        <div>
          <p className="font-en uppercase mb-7" style={labelStyle}>
            Start guide
          </p>
          <h1
            className={`${en ? "font-en" : "font-ja"} text-[rgba(var(--foreground-rgb),0.88)]`}
            style={{
              fontSize: "clamp(1.75rem, 4vw, 3rem)",
              lineHeight: 1.45,
              letterSpacing: "0.02em",
            }}
          >
            {en
              ? "After purchase, you send materials and wait."
              : "購入後は、素材を送って待つだけ。"}
          </h1>
          <p
            className="mt-7 max-w-xl text-[rgba(var(--foreground-rgb),0.56)]"
            style={bodyStyle}
          >
            {en ? (
              <>
                Every setting is handled on my side. Within 24 hours of payment,
                I will email a short request for your materials, and once they
                are ready, your site is delivered within three days — already
                published. If the email has not arrived after 24 hours, contact
                me from the email address used for payment.
              </>
            ) : (
              <>
                設定はすべてこちらで行います。決済後24時間以内に素材のお願いを
                メールでお送りし、素材が揃ってから3日以内に、
                <strong className="text-[rgba(var(--foreground-rgb),0.8)]">
                  公開した状態で
                </strong>
                お渡しします。24時間を過ぎてもメールが届かない場合は、
                購入時のメールアドレスからお問い合わせください。
              </>
            )}
          </p>
          {en && (
            <div
              className="mt-6 rounded-md border border-[rgba(var(--foreground-rgb),0.12)] bg-[rgba(var(--foreground-rgb),0.018)] px-4 py-3 text-[rgba(var(--foreground-rgb),0.58)]"
              style={bodyStyle}
            >
              <p>
                The admin panel is available in English and Japanese — switch
                anytime with the JP | EN toggle.
              </p>
              <p className="mt-2">
                Support is provided in Japanese and simple English.
              </p>
            </div>
          )}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            {contactEmail && (
              <ExternalButton href={materialsMailtoHref(contactEmail, en)}>
                <Mail size={15} />
                {en ? "Send your materials" : "素材を送る"}
              </ExternalButton>
            )}
            <Link
              to={en ? "/portfolio-kit/en" : "/portfolio-kit"}
              className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-md border border-[rgba(var(--foreground-rgb),0.16)] px-6 py-2.5 font-ja text-sm text-[rgba(var(--foreground-rgb),0.62)] hover:border-[rgba(var(--foreground-rgb),0.32)] hover:text-[rgba(var(--foreground-rgb),0.82)] transition-colors duration-300"
            >
              {en ? "Back to pricing" : "料金ページへ戻る"}
            </Link>
          </div>
          <p
            className="mt-5 text-[rgba(var(--foreground-rgb),0.42)]"
            style={{ fontSize: "0.78rem", lineHeight: 1.8 }}
          >
            {en ? (
              <>
                Guidance on everyday use of the site and admin panel is
                currently unlimited (this may become time-limited in the
                future). Design changes and custom work are quoted separately.
                <br />
                If you have not purchased yet, please start from the pricing
                page.
              </>
            ) : (
              <>
                操作方法の相談は、当面は期間・回数の制限なく受け付けます
                （今後、期間制に変更する可能性があります）。デザイン変更・作業の代行は、内容に応じて別途お見積もりします。
                <br />
                まだ購入していない方は、先に料金ページをご覧ください。
              </>
            )}
          </p>
        </div>

        <figure className="rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--foreground-rgb),0.018)] p-3 shadow-[0_20px_70px_rgba(var(--foreground-rgb),0.06)]">
          <img
            src="/og-service.jpg"
            alt="Aki Eguchi Portfolio Kit"
            width="1200"
            height="630"
            className="aspect-[1200/630] w-full rounded-[4px] object-cover"
            loading="eager"
            decoding="async"
          />
        </figure>
      </header>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <StepPanel
          title={en ? "From payment to handover" : "公開までの流れ"}
          subtitle="Delivery"
          steps={en ? deliveryStepsEn : deliverySteps}
        >
          {contactEmail && (
            <ExternalButton href={materialsMailtoHref(contactEmail, en)}>
              <Mail size={15} />
              {en ? "Send your materials" : "素材を送る"}
            </ExternalButton>
          )}
        </StepPanel>

        <StepPanel
          title={en ? "After the handover" : "納品後の最初の一歩"}
          subtitle="First steps"
          steps={en ? afterHandoffStepsEn : afterHandoffSteps}
        >
          <ExternalButton href="/admin/login" variant="outline">
            <KeyRound size={15} />
            {en ? "Open the admin login" : "管理画面へ"}
          </ExternalButton>
        </StepPanel>
      </div>

      <SupportSection contactEmail={contactEmail} language={language} />

      <HandoffCard language={language} />
    </section>
  );
}
