import { useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, jsonOrThrow } from "../lib/api";
import { sendAnalyticsEvent } from "../lib/analytics";
import { isServiceOwnerSite } from "../../shared/service-visibility";
import { CONSULT_PLANS, consultPlan, INTAKE_ORIGIN, submitPortfolioInquiry } from "../lib/portfolio-intake";

const control = "w-full rounded-md border border-[rgba(var(--foreground-rgb),0.22)] bg-[var(--background)] px-4 py-3 text-base focus:outline-2 focus:outline-offset-2";
export default function ServiceConsultPage() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: async () => jsonOrThrow(await api.settings.$get()) });
  const [plan, setPlan] = useState(() => consultPlan(new URLSearchParams(window.location.search).get("plan")));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ id: string; notification: string } | null>(null);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const started = useRef(Date.now());
  const sending = useRef(false);
  const owner = isServiceOwnerSite(settings?.siteUrl, undefined);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!owner || sending.current) return;
    const form = new FormData(event.currentTarget);
    const values = { name: String(form.get("name") || "").trim(), email: String(form.get("email") || "").trim(), website: String(form.get("website") || "").trim(), brief: String(form.get("brief") || "").trim(), plan };
    const key = JSON.stringify(values);
    if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    sending.current = true; setBusy(true); setError("");
    try {
      setReceipt(await submitPortfolioInquiry({ ...values, id: attempt.current.id, source: "partner", consent: form.get("consent") === "on", company: String(form.get("company") || ""), elapsed: Date.now() - started.current }));
      // Conversion only after durable receipt. No names, emails, free text or IDs.
      try { sendAnalyticsEvent("portfolio_consult_saved", { plan }); } catch { /* Measurement must never affect the receipt. */ }
    } catch (e) { setError(e instanceof Error ? e.message : "通信を確認して再送してください。"); }
    finally { sending.current = false; setBusy(false); }
  }
  if (!settings) return <p className="p-12">読込中…</p>;
  if (!owner) return <p className="p-12">このサイトでは制作相談を受け付けていません。<a href="/contact">お問い合わせ</a></p>;
  return <main className="max-w-3xl mx-auto px-5 sm:px-8 py-14 md:py-20 text-base leading-8">
    <a href="/portfolio-kit#pricing" className="underline underline-offset-4">← 制作内容・料金を見る</a>
    <p className="mt-10 font-en text-sm tracking-widest">AKI EGUCHI / PORTFOLIO</p>
    <h1 className="mt-3 text-3xl sm:text-4xl leading-snug">あなたの写真を、<br />公開するところから。</h1>
    <p className="mt-6 text-[color:var(--text-quiet)]">写真が揃っていなくても大丈夫です。使う目的と、困っていることを教えてください。江口秋が内容を確認し、原則2営業日以内に返信します。</p>
    {receipt ? <section className="mt-10 border rounded-lg p-6 sm:p-8" aria-live="polite">
      <h2 className="text-2xl">相談を受け付けました</h2>
      <p className="mt-4">ご相談内容を保存しました。この時点では契約・お支払いは発生していません。</p>
      <p className="mt-4 text-sm break-all">受付番号：{receipt.id}</p>
      {receipt.notification !== "client_accepted" && <p className="mt-4">内容の保存は完了していますが、通知の確認ができませんでした。再送は不要です。お急ぎの場合は下記メールへ受付番号をお送りください。</p>}
      <p className="mt-4">2営業日を過ぎても返信がない場合は、迷惑メールをご確認のうえ、<a className="underline" href={`mailto:autumnal303@gmail.com?subject=${encodeURIComponent(`制作相談 ${receipt.id}`)}`}>autumnal303@gmail.com</a> へご連絡ください。</p>
    </section> : <form onSubmit={submit} className="mt-10 space-y-6">
      <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
        <legend className="sr-only">無料相談の内容</legend>
        <label className="block">希望するプラン<select className={`${control} mt-2`} name="plan" value={plan} onChange={e => setPlan(consultPlan(e.target.value))}>{Object.entries(CONSULT_PLANS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <p className="text-sm text-[color:var(--text-quiet)]">どちらの制作プランも、同じ管理画面と公開サイトです。69,800円は写真・文章編集を含む総額で、30,000円の追加購入は不要。サーバー・ドメイン実費は別途、契約前にお知らせします。</p>
        <div className="grid sm:grid-cols-2 gap-6">
          <label className="block">お名前 <span className="text-sm">（必須）</span><input className={`${control} mt-2`} name="name" autoComplete="name" required maxLength={80} /></label>
          <label className="block">メールアドレス <span className="text-sm">（必須）</span><input className={`${control} mt-2`} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        </div>
        <label className="block">現在のサイト・SNS <span className="text-sm">（任意）</span><input className={`${control} mt-2`} name="website" type="url" placeholder="https://" maxLength={500} /></label>
        <label className="block">使う目的・相談したいこと <span className="text-sm">（必須）</span><textarea className={`${control} mt-2 min-h-40`} name="brief" required maxLength={6000} placeholder="例：仕事の依頼につながる作品サイトを作りたい。写真は40枚ほどあるが、選び方とプロフィールの文章に迷っている。来月の公開を希望。" /></label>
        <div className="hidden" aria-hidden="true"><label>会社名（入力不要）<input name="company" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="flex items-start gap-3"><input type="checkbox" name="consent" required className="mt-2 h-5 w-5 shrink-0" /><span className="text-sm leading-7"><a href={`${INTAKE_ORIGIN}/privacy`} target="_blank" rel="noopener noreferrer" className="underline">個人情報の取扱い</a>と<a href={`${INTAKE_ORIGIN}/terms`} target="_blank" rel="noopener noreferrer" className="underline">相談・制作条件</a>を確認し、返信のための情報利用に同意します。相談内容は江口秋の受付システムへ保存し、通知サービスを通じて本人へ送信します。</span></label>
        <button type="submit" className="w-full sm:w-auto rounded-md bg-[var(--foreground)] text-[var(--background)] px-8 py-4">{busy ? "受付を確認しています…" : "無料で相談を送る"}</button>
      </fieldset>
      {error && <p role="alert" className="border border-red-500 rounded p-4">{error}</p>}
      <p className="text-sm text-[color:var(--text-quiet)]">送信だけでは購入になりません。制作範囲・総額・納期・取引条件をご確認いただいてから、ご希望の場合のみお支払いへ進みます。写真データのアップロードは不要です。</p>
    </form>}
  </main>;
}
