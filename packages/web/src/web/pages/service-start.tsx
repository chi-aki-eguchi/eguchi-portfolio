import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Image as ImageIcon,
  KeyRound,
  Mail,
} from "lucide-react";
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

// 自分で立てる人向けの、Railwayテンプレート専用くわしい手順。実際に第三者に
// 使ってもらった際に詰まった箇所(GitHub権限エラー・S3_BUCKET未設定)を
// トラブルシュートとして具体的に書く。README/docsではなく、購入者が実際に
// たどり着く公開URL(このページ)に置くことで、迷った瞬間に見てもらえるようにする。
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

function GuideSection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`guide-${n}`}
      className="scroll-mt-24 border-t border-[rgba(var(--foreground-rgb),0.10)] py-8 first:border-t-0 first:pt-0"
    >
      <div className="grid grid-cols-[2.25rem_1fr] gap-4 sm:grid-cols-[2.5rem_1fr] sm:gap-5">
        <span
          className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(var(--foreground-rgb),0.16)] font-en text-sm text-[rgba(var(--foreground-rgb),0.56)]"
          aria-hidden="true"
        >
          {n}
        </span>
        <div className="min-w-0">
          <h3
            className="font-ja text-[rgba(var(--foreground-rgb),0.84)]"
            style={{ fontSize: "1.05rem", lineHeight: 1.6 }}
          >
            {title}
          </h3>
          <div
            className="mt-3 space-y-3 text-[rgba(var(--foreground-rgb),0.58)]"
            style={bodyStyle}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function GuideNav() {
  const items = [
    "まず確認するもの",
    "Railwayでテンプレートを開く",
    "GitHubアクセスエラーが出たら",
    "Variablesで確認するもの",
    "公開URLを開く",
    "/admin にログイン",
    "初回セットアップを進める",
    "写真を1枚アップロードして確認",
    "エラーが出たときの見方",
    "こちらに送ってほしいスクショ",
  ];
  return (
    <nav
      aria-label="設置ナビの目次"
      className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2"
    >
      {items.map((label, i) => (
        <a
          key={label}
          href={`#guide-${i + 1}`}
          className="flex items-baseline gap-2 text-[13px] text-[rgba(var(--foreground-rgb),0.56)] hover:text-[rgba(var(--foreground-rgb),0.82)] transition-colors duration-200"
        >
          <span className="font-en text-[11px] text-[rgba(var(--foreground-rgb),0.34)]">
            {String(i + 1).padStart(2, "0")}
          </span>
          {label}
        </a>
      ))}
    </nav>
  );
}

function SelfSetupGuide() {
  return (
    <section
      id="guide"
      className="mt-12 md:mt-16 rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--foreground-rgb),0.014)] p-5 sm:p-8 md:p-10"
    >
      <p className="font-en uppercase mb-3" style={labelStyle}>
        Self setup guide
      </p>
      <h2
        className="font-ja text-[rgba(var(--foreground-rgb),0.88)]"
        style={{ fontSize: "clamp(1.35rem, 2.6vw, 2rem)", lineHeight: 1.5 }}
      >
        Railwayテンプレートで、自分の手で公開するくわしい手順。
      </h2>
      <p
        className="mt-4 max-w-2xl text-[rgba(var(--foreground-rgb),0.56)]"
        style={bodyStyle}
      >
        上から順番に進めれば、公開URLが出て、管理画面に入って、写真が1枚表示されるところまで行けます。
        途中でエラーが出た場合は、9番の「エラーが出たときの見方」を先に見てください。
      </p>

      <div className="mt-8 rounded-md border border-[rgba(var(--foreground-rgb),0.10)] bg-[rgba(var(--background-rgb),0.4)] p-5">
        <GuideNav />
      </div>

      <div className="mt-8">
        <GuideSection n={1} title="まず確認するもの">
          <p>この3つがあれば進められます。</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Railwayアカウント(GitHubアカウントでそのまま作れます)</li>
            <li>GitHubアカウント</li>
            <li>
              管理画面用のパスワードを1つ決めておく(8文字以上。あとで見返せる場所にメモ)
            </li>
          </ul>
        </GuideSection>

        <GuideSection n={2} title="Railwayでテンプレートを開く">
          <p>
            決済後の案内メールに入っている Deploy リンクを開きます。Deploy
            先を聞かれたら
            <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
              {" "}
              New Project{" "}
            </strong>
            を選んでください。
          </p>
          <p>
            少し待つと、
            <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
              Postgres・eguchi-portfolio-app・Bucket
            </strong>
            の3つのサービスが自動で作られます。3つとも緑色(Deployed)になるまで待ちます。
          </p>
        </GuideSection>

        <GuideSection n={3} title="GitHubアクセスエラーが出たら">
          <p>
            「repository
            へのアクセス権限がありません」のようなエラーで止まった場合、Railway側ではなく
            GitHub側の権限設定が原因です。
          </p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>GitHubの Settings → Applications → Railway を開く</li>
            <li>
              「Repository
              access」を確認し、対象のリポジトリにチェックが入っているか見る
            </li>
            <li>入っていなければチェックして Save</li>
            <li>Railwayの画面に戻り、もう一度 Deploy をやり直す</li>
          </ol>
        </GuideSection>

        <GuideSection n={4} title="Variablesで確認するもの">
          <p>
            eguchi-portfolio-appサービスを開き、
            <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
              {" "}
              Variables{" "}
            </strong>
            タブを見ます。特に大事なのは Bucket
            関連の5つです。テンプレートが自動で埋めるはずですが、空になっている場合は次の形になっているか確認してください。
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
            (または Redeploy)を押して、変更を反映させてください。
          </p>
        </GuideSection>

        <GuideSection n={5} title="公開URLを開く">
          <p>
            eguchi-portfolio-appサービスの Settings → Networking にある
            <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
              {" "}
              Generate Domain{" "}
            </strong>
            を押すと、公開用のURLができます。そのURLを開いて、トップページが表示されれば公開はここまで成功です。
          </p>
        </GuideSection>

        <GuideSection n={6} title="/admin にログイン">
          <p>
            できた公開URLの後ろに
            <code className="mx-1 rounded bg-[rgba(var(--foreground-rgb),0.06)] px-1.5 py-0.5 font-mono text-[12px]">
              /admin/login
            </code>
            を付けて開き、1番で決めたパスワードでログインします。
          </p>
        </GuideSection>

        <GuideSection n={7} title="初回セットアップを進める">
          <p>
            初めてログインすると、自動的に
            <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
              {" "}
              「はじめに」{" "}
            </strong>
            画面が開きます(いきなり写真一覧が開いた場合は、左のメニューから「はじめに」を選んでください)。上から順にサイトの名前・プロフィール・写真を埋めていくと、チェックが増えていきます。
          </p>
        </GuideSection>

        <GuideSection n={8} title="写真を1枚アップロードして確認">
          <p>
            「はじめに」の案内にしたがって、まず1枚だけ写真をアップロードします(test.jpgのような軽いファイルで構いません)。アップロードが終わったら、公開URLを開き直して写真が表示されているか確認してください。
          </p>
        </GuideSection>

        <GuideSection n={9} title="エラーが出たときの見方">
          <p>
            写真アップロードで
            <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
              {" "}
              Internal server error{" "}
            </strong>
            が出た場合は、次の順で見てください。
          </p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Railwayのプロジェクト画面を開く</li>
            <li>eguchi-portfolio-appサービスを開く</li>
            <li>
              <strong className="text-[rgba(var(--foreground-rgb),0.84)]">
                Logs
              </strong>
              タブを開く
            </li>
            <li>管理画面でもう一度アップロードする</li>
            <li>Logsに出てくる赤いエラー文を読む</li>
          </ol>
          <Callout tone="error">
            例えば
            <code className="mx-1 rounded bg-[rgba(var(--foreground-rgb),0.06)] px-1.5 py-0.5 font-mono text-[12px] text-[rgba(var(--foreground-rgb),0.72)]">
              No value provided for input HTTP label: Bucket.
            </code>
            と出ていたら、原因は
            <strong> S3_BUCKET が正しく設定されていないこと</strong>
            です。4番のVariablesに戻り、
            <code className="mx-1 rounded bg-[rgba(var(--foreground-rgb),0.06)] px-1.5 py-0.5 font-mono text-[12px] text-[rgba(var(--foreground-rgb),0.72)]">
              {"S3_BUCKET=${{ Bucket.BUCKET }}"}
            </code>
            になっているか確認し、直したら Deploy changes
            を押して、もう一度アップロードしてください。
          </Callout>
          <p>
            他のエラー文が出た場合や、直しても解決しない場合は、10番のスクショを送ってください。ログを見れば、たいていの原因はすぐに分かります。
          </p>
        </GuideSection>

        <GuideSection n={10} title="こちらに送ってほしいスクショ">
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
          <div className="pt-1">
            <ExternalButton
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                "セットアップでのエラー相談",
              )}&body=${encodeURIComponent(
                "困っている内容:\n\n\n(できれば) 添付:\n- Railwayのプロジェクト全体画面\n- app の Logs\n- app の Variables のキー名一覧(値は隠す)",
              )}`}
            >
              <Mail size={15} />
              エラー相談メールを送る
            </ExternalButton>
          </div>
        </GuideSection>
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
          <p
            className="mt-7 max-w-xl text-[rgba(var(--foreground-rgb),0.56)]"
            style={bodyStyle}
          >
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
          <a
            href="#guide"
            className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-md bg-[var(--foreground)] px-6 py-2.5 font-ja text-sm text-[var(--background)] transition-opacity duration-300 hover:opacity-85"
          >
            くわしい手順を見る
          </a>
          <ExternalButton
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
              "自分で立てるコースの案内再送",
            )}`}
            variant="outline"
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

      <SelfSetupGuide />

      <HandoffCard />
    </section>
  );
}
