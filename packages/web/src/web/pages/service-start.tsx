import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Image as ImageIcon,
  KeyRound,
  Mail,
} from "lucide-react";
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

// テンプレートは非公開(unpublished)で、購入者だけに設置リンクを渡す運用。
// 2026-07-10 の使い捨て実デプロイで確認した実機挙動が正:
// 初期画面は「2 services and 1 bucket」+ ADMIN_PASSWORD 1 variable required、
// Deploy は eguchi-portfolio-app の Configure → Save Config を終えるまで
// disabled、Bucket の empty 表示は写真0枚の正常状態。通常導線はこの3ステップ
// だけに絞り、Variables や Logs の話は「困ったとき」の折りたたみへ隔離する。
const selfSteps = [
  {
    title: "設置リンクを開いて、パスワードを設定する",
    body: "購入後にお送りする設置リンクを開くと、Railwayに「2 services and 1 bucket」という画面が出ます。eguchi-portfolio-app のカードの Configure を押し、ADMIN_PASSWORD の欄に管理画面用のパスワード(8文字以上。あとで見返せる場所にメモ)を入力して Save Config を押します。それまで押せなかった下の Deploy ボタンが押せるようになるので、押して待ちます。あなたが入力するのは、このパスワードひとつだけです。",
  },
  {
    title: "Online になったら、公開URLを作る",
    body: "数分待つと Postgres と eguchi-portfolio-app が Online になります(Bucket が empty のままなのは、まだ写真が0枚なだけの正常な状態です)。eguchi-portfolio-app を開き、Settings → Networking にある Generate Domain を押すと、公開用のURLができます。",
  },
  {
    title: "管理画面に入って、写真を1枚入れる",
    body: "できたURLの後ろに /admin/login を付けて開き、1番で決めたパスワードでログインします。最初に「はじめに」画面が開くので、案内にしたがって写真を1枚アップロードし、公開URLで表示されれば完成です。",
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

const S3_BUCKET_VARS = [
  "S3_ENDPOINT=${{ Bucket.ENDPOINT }}",
  "S3_BUCKET=${{ Bucket.BUCKET }}",
  "S3_ACCESS_KEY_ID=${{ Bucket.ACCESS_KEY_ID }}",
  "S3_SECRET_ACCESS_KEY=${{ Bucket.SECRET_ACCESS_KEY }}",
  "S3_REGION=${{ Bucket.REGION }}",
  "S3_FORCE_PATH_STYLE=true",
] as const;

const screenshotChecklist = [
  "Railwayのプロジェクト全体画面(サービスが並んでいる画面)",
  "eguchi-portfolio-appサービスの Logs 画面",
  "eguchi-portfolio-appサービスの Variables のキー名一覧",
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

function CodeBlock({ lines }: { lines: readonly string[] }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-md border border-[rgba(var(--foreground-rgb),0.12)] bg-[rgba(var(--foreground-rgb),0.035)] p-4 font-mono text-[12px] leading-6 text-[rgba(var(--foreground-rgb),0.72)]">
      {lines.join("\n")}
    </pre>
  );
}

function Callout({
  tone = "note",
  children,
}: {
  tone?: "note" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-md border px-4 py-3 text-[13px] leading-6 ${
        tone === "error"
          ? "border-red-400/50 text-red-600"
          : "border-[rgba(var(--foreground-rgb),0.14)] text-[rgba(var(--foreground-rgb),0.66)]"
      }`}
      style={tone === "error" ? undefined : bodyStyle}
    >
      {children}
    </div>
  );
}

// 折りたたみ(details/summary)にすることで、通常導線を読む人の画面から
// トラブル対応の長文を消す。JSなしで開閉でき、モバイルでも本文が短く保てる。
function TroubleItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--foreground-rgb),0.014)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5 font-ja text-sm text-[rgba(var(--foreground-rgb),0.72)] hover:text-[rgba(var(--foreground-rgb),0.88)] transition-colors duration-200 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          size={15}
          className="shrink-0 text-[rgba(var(--foreground-rgb),0.38)] transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div
        className="space-y-3 border-t border-[rgba(var(--foreground-rgb),0.08)] px-4 py-4 sm:px-5 text-[rgba(var(--foreground-rgb),0.58)]"
        style={bodyStyle}
      >
        {children}
      </div>
    </details>
  );
}

function TroubleSection({ contactEmail }: { contactEmail: string }) {
  return (
    <section className="mt-12 md:mt-16">
      <p className="font-en uppercase mb-3" style={labelStyle}>
        Troubleshooting
      </p>
      <h2
        className="font-ja text-[rgba(var(--foreground-rgb),0.84)]"
        style={{ fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)", lineHeight: 1.55 }}
      >
        困ったときだけ、開いてください。
      </h2>
      <p
        className="mt-4 max-w-2xl text-[rgba(var(--foreground-rgb),0.56)]"
        style={bodyStyle}
      >
        ふつうは上の3ステップだけで完成します。エラーが出たときだけ、当てはまる項目を開いてください。
      </p>

      <div className="mt-7 space-y-3">
        <TroubleItem title="GitHubのエラーで止まったとき">
          <p>
            「repository
            へのアクセス権限がありません」のようなエラーで止まった場合は、次の順で確認します。
          </p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>RailwayとGitHubの両方にログインできているか確認する</li>
            <li>Railwayの画面に戻り、もう一度 Deploy をやり直す</li>
            <li>
              それでも同じエラーになる場合は、プロジェクト全体画面とエラー画面のスクリーンショットを、テンプレートを渡してくれた人に送って相談する
            </li>
          </ol>
          <p>
            ※
            自分でリポジトリをfork(複製)して自分のGitHubリポジトリからデプロイしている場合のみ、GitHubの
            Settings → Applications → Railway の「Repository
            access」で対象リポジトリにチェックが入っているかを確認してください。テンプレートをそのまま使っている場合、この設定は関係ありません。
          </p>
        </TroubleItem>

        <TroubleItem title="写真がアップロードできないとき">
          <p>
            保存先の設定に問題があるときは、管理画面の「はじめに」に
            <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
              「写真の保存先: 設定が不足しています」
            </strong>
            という黄色い案内が出て、足りない設定の名前を教えてくれます。まずはその案内に書かれている内容が、いちばん確実な手がかりです(何も問題がなければ「必要な設定は入力済み」と表示されています)。
          </p>
          <p>案内が出ていない・読んでも分からないときは、次の順で見ます。</p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Railwayのプロジェクト画面で eguchi-portfolio-app を開く</li>
            <li>
              <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
                Logs
              </strong>
              タブを開いたまま、管理画面でもう一度アップロードする
            </li>
            <li>Logsに出てくる赤いエラー文を読む</li>
          </ol>
          <p>
            保存先の設定はテンプレートが自動で入れるので、ふつうは触る必要がありません。それでも確認したいときは、eguchi-portfolio-app
            の
            <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
              {" "}
              Variables{" "}
            </strong>
            タブで、Bucket関連の設定が次の形になっているかを見ます。
          </p>
          <CodeBlock lines={S3_BUCKET_VARS} />
          <p className="text-[12px] text-[rgba(var(--foreground-rgb),0.46)]">
            {
              "${{ Bucket.BUCKET }} のような書き方は、Railwayが Bucket サービスの値をそのまま読みに行くための参照です。値を直接コピー&ペーストする必要はありません。"
            }
          </p>
          <p>
            Variablesを直したら、上の
            <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
              {" "}
              Deploy changes{" "}
            </strong>
            (または
            Redeploy)を押して反映させてから、もう一度アップロードしてください。
          </p>
        </TroubleItem>

        <TroubleItem title="相談するとき(送ってほしいスクショ)">
          <p>詰まったときは、この3枚があると解決が早いです。</p>
          <ul className="space-y-2">
            {screenshotChecklist.map((row) => (
              <li key={row} className="flex items-start gap-2.5">
                <ImageIcon
                  size={15}
                  className="mt-0.5 shrink-0 text-[rgba(var(--foreground-rgb),0.4)]"
                />
                <span>{row}</span>
              </li>
            ))}
          </ul>
          <Callout>
            <span className="flex items-start gap-2.5">
              <AlertTriangle
                size={15}
                className="mt-0.5 shrink-0 text-[rgba(var(--foreground-rgb),0.42)]"
              />
              <span>
                Variablesのスクショでは、キー名(S3_BUCKETなど)だけが見えれば十分です。値の列は隠すか、切り取ってから送ってください。特にパスワードや
                SECRET_ACCESS_KEY
                系の値は、そのまま画面に映さないよう注意してください。
              </span>
            </span>
          </Callout>
          {contactEmail && (
            <div className="pt-1">
              <ExternalButton
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                  "セットアップでのエラー相談",
                )}&body=${encodeURIComponent(
                  "困っている内容:\n\n\n(できれば) 添付:\n- Railwayのプロジェクト全体画面\n- eguchi-portfolio-app の Logs\n- eguchi-portfolio-app の Variables のキー名一覧(値は隠す)",
                )}`}
              >
                <Mail size={15} />
                エラー相談メールを送る
              </ExternalButton>
            </div>
          )}
        </TroubleItem>
      </div>
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
          <p
            className="mt-4 text-[rgba(var(--foreground-rgb),0.52)]"
            style={bodyStyle}
          >
            GitHubや環境変数の話は出さず、写真家本人が使う入口だけをまとめます。
          </p>
        </div>
        <div className="rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--foreground-rgb),0.025)] p-4 sm:p-5">
          <p
            className="font-en text-xs uppercase tracking-[0.12em] text-[rgba(var(--foreground-rgb),0.36)]"
            style={{ fontSize: "var(--section-label-size, 0.75rem)" }}
          >
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
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => jsonOrThrow(await api.settings.$get()),
  });
  const contactEmail = resolveServiceContactEmail(
    settingsData?.contactEmail,
    settingsData?.siteUrl,
    typeof window === "undefined" ? undefined : window.location.hostname,
  );

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
          <p
            className="mt-7 max-w-xl text-[rgba(var(--foreground-rgb),0.56)]"
            style={bodyStyle}
          >
            設置のためのリンクは公開されておらず、購入後に案内メールまたは個別メッセージでお送りします。
            あなたが入力するのは
            <strong className="text-[rgba(var(--foreground-rgb),0.8)]">
              管理画面用のパスワード(ADMIN_PASSWORD)ひとつだけ
            </strong>
            。あとの設定はすべて自動で入ります。
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            {contactEmail && (
              <ExternalButton
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                  "Portfolio Kit 購入後の相談",
                )}`}
              >
                <Mail size={15} />
                購入後の相談をする
              </ExternalButton>
            )}
            <Link
              to="/portfolio-kit"
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
          title="自分で立てる人は、3ステップ。"
          subtitle="Self setup"
          steps={selfSteps}
        >
          {contactEmail && (
            <ExternalButton
              href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                "自分で立てるコースの案内再送",
              )}`}
              variant="outline"
            >
              <Mail size={15} />
              設置リンクの案内メールを確認する
            </ExternalButton>
          )}
          <Link
            to="/portfolio-kit"
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
          {contactEmail && (
            <ExternalButton
              href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                "公開おまかせの素材送付",
              )}`}
            >
              <Mail size={15} />
              素材を送る
            </ExternalButton>
          )}
          <ExternalButton href="/admin/login" variant="outline">
            <KeyRound size={15} />
            管理画面へ
          </ExternalButton>
        </StepPanel>
      </div>

      <TroubleSection contactEmail={contactEmail} />

      <HandoffCard />
    </section>
  );
}
