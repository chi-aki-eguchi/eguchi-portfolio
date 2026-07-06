import { ArrowUpRight, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { Link } from "wouter";
import { isServiceHost } from "../lib/service-visibility";

const CONTACT_EMAIL = "akieguchi33@gmail.com";

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

const selfSteps = [
  {
    title: "パスワードを決める",
    body: "管理画面に入るためのパスワードを1つ決めます。8文字以上で、あとで見返せる場所にメモしておきます。",
  },
  {
    title: "購入後メールのDeployリンクを開く",
    body: "決済後に届く案内の中にあるリンクから進みます。公開ページ上にはリンクを置かないので、購入前の人がそのまま使うことはできません。",
  },
  {
    title: "公開URLを作る",
    body: "Railwayの web サービスから Generate Domain を押すと、公開用のURLができます。",
  },
  {
    title: "管理画面へ入る",
    body: "できたURLの後ろに /admin/login を付けてログインし、はじめに画面から写真とプロフィールを入れます。",
  },
] as const;

const conciergeSteps = [
  {
    title: "素材を送る",
    body: "名前の表記、プロフィール文、連絡先、SNS、最初に載せたい写真を送ります。数枚だけでも始められます。",
  },
  {
    title: "こちらで初期設定",
    body: "公開場所、管理画面、写真の最初の入り方をこちらで整えます。必要なら独自ドメインも一緒に見ます。",
  },
  {
    title: "URLとパスワードを受け取る",
    body: "完成後は、サイトURL、管理画面URL、パスワード、最初にやることだけをまとめて渡します。",
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
              <p className="mt-1 text-[rgba(var(--foreground-rgb),0.52)]" style={bodyStyle}>
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">{children}</div>
    </section>
  );
}

function HandoffCard() {
  const rows = [
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
            className="font-ja text-[rgba(var(--foreground-rgb),0.84)]"
            style={{
              fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)",
              lineHeight: 1.55,
            }}
          >
            おまかせ設定では、最後にこれだけ渡します。
          </h2>
          <p className="mt-4 text-[rgba(var(--foreground-rgb),0.52)]" style={bodyStyle}>
            GitHubや環境変数の話は出さず、写真家本人が使う入口だけをまとめます。
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
                <span className="font-ja text-sm text-[rgba(var(--foreground-rgb),0.66)]">
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

export default function ServiceStartPage() {
  if (!isServiceHost()) return null;

  return (
    <section className="max-w-5xl mx-auto px-5 sm:px-6 md:px-12 pt-[calc(4rem*var(--spacing-page-top,1))] md:pt-[calc(6.5rem*var(--spacing-page-top,1))] pb-16 md:pb-28">
      <header className="grid gap-10 md:grid-cols-[1.02fr_0.98fr] md:items-center">
        <div>
          <p className="font-en uppercase mb-7" style={labelStyle}>
            Start guide
          </p>
          <h1
            className="font-ja text-[rgba(var(--foreground-rgb),0.88)]"
            style={{
              fontSize: "clamp(1.75rem, 4vw, 3rem)",
              lineHeight: 1.45,
              letterSpacing: "0.02em",
            }}
          >
            Aki Eguchi Portfolio Kitを、迷わず公開するための入口。
          </h1>
          <p className="mt-7 max-w-xl text-[rgba(var(--foreground-rgb),0.56)]" style={bodyStyle}>
            コードやGitHubを知らなくても進められるように、購入後に必要なことだけをまとめました。
            実際の公開リンクは、決済後の案内メールまたは個別メッセージでお送りします。
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <ExternalButton
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                "Portfolio Kit 購入後の相談",
              )}`}
            >
              <Mail size={15} />
              購入後の相談をする
            </ExternalButton>
            <Link
              to="/service"
              className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-md border border-[rgba(var(--foreground-rgb),0.16)] px-6 py-2.5 font-ja text-sm text-[rgba(var(--foreground-rgb),0.62)] hover:border-[rgba(var(--foreground-rgb),0.32)] hover:text-[rgba(var(--foreground-rgb),0.82)] transition-colors duration-300"
            >
              料金ページへ戻る
            </Link>
          </div>
          <p
            className="mt-5 text-[rgba(var(--foreground-rgb),0.42)]"
            style={{ fontSize: "0.78rem", lineHeight: 1.8 }}
          >
            まだ購入していない方は、先に料金ページからコースを選んでください。
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
          title="自分で立てる人"
          subtitle="Self setup"
          steps={selfSteps}
        >
          <ExternalButton
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
              "自分で立てるコースの案内再送",
            )}`}
          >
            <Mail size={15} />
            案内メールを確認する
          </ExternalButton>
          <Link
            to="/service"
            className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-md border border-[rgba(var(--foreground-rgb),0.16)] px-6 py-2.5 font-ja text-sm text-[rgba(var(--foreground-rgb),0.62)] hover:border-[rgba(var(--foreground-rgb),0.32)] hover:text-[rgba(var(--foreground-rgb),0.82)] transition-colors duration-300"
          >
            料金ページへ戻る
          </Link>
        </StepPanel>

        <StepPanel
          title="おまかせ設定の人"
          subtitle="Concierge setup"
          steps={conciergeSteps}
        >
          <ExternalButton
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
              "公開おまかせの素材送付",
            )}`}
          >
            <Mail size={15} />
            素材を送る
          </ExternalButton>
          <ExternalButton href="/admin/login" variant="outline">
            <KeyRound size={15} />
            管理画面へ
          </ExternalButton>
        </StepPanel>
      </div>

      <HandoffCard />
    </section>
  );
}
