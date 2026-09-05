export const INTAKE_ORIGIN = "https://photo-work-pricing.chi-aki-18.chatgpt.site";
export const CONSULT_PATH = "/portfolio-kit/consult";
export const CONSULT_PLANS = {
  basic: "公開おまかせ · 30,000円",
  editorial: "写真・文章編集付き · 69,800円",
  care: "公開後の更新 · 月額9,800円（任意）",
} as const;
export type ConsultPlan = keyof typeof CONSULT_PLANS;
export type Intake = { id: string; name: string; email: string; website: string; plan: ConsultPlan; brief: string; consent: boolean; company: string; elapsed: number; source: string };
type Claim = { token?: string; attemptedAt?: string; status: string };
export function consultPlan(value: string | null): ConsultPlan {
  return value && Object.prototype.hasOwnProperty.call(CONSULT_PLANS, value) ? value as ConsultPlan : "editorial";
}

// Both destinations are fixed owner-operated endpoints. Never send browser
// credentials or follow a redirect with a customer's personal information.
export async function submitPortfolioInquiry(data: Intake, send: typeof fetch = fetch) {
  const request = { method: "POST", credentials: "omit", redirect: "error", headers: { "Content-Type": "application/json", Accept: "application/json" } } as const;
  const response = await send(`${INTAKE_ORIGIN}/api/inquiries`, { ...request, signal: AbortSignal.timeout(15000), body: JSON.stringify(data) });
  const result = await response.json() as { id?: string; error?: string; notification?: Claim };
  if (!response.ok || result.id !== data.id) throw new Error(result.error || "受付を確認できませんでした。同じ内容のまま再送してください。");
  const claim = result.notification;
  // From this point onward the inquiry is saved. A notification failure must
  // never masquerade as a failed submission and create a second inquiry.
  let notification = claim?.status || "pending";
  if (claim?.token && claim.attemptedAt) {
    try {
      const sent = await send("https://formspree.io/f/mbdeebae", { ...request, signal: AbortSignal.timeout(8000), body: JSON.stringify({
        name: data.name.trim(), email: data.email.trim(), _subject: `Aki Eguchi｜制作相談 ${data.id}`,
        message: `ポートフォリオ制作の無料相談です。契約・入金は未成立です。\n\n受付番号：${data.id}\nプラン：${CONSULT_PLANS[data.plan]}\nサイト：${data.website || "未記入"}\n流入：${data.source}\n\n${data.brief}\n\n案件管理：${INTAKE_ORIGIN}/ops\nこのメールへの返信で相談者へ連絡できます。原則2営業日以内に返信してください。`,
      }) });
      const accepted = await sent.json() as { ok?: boolean };
      notification = sent.ok && accepted.ok === true ? "client_accepted" : "failed";
    } catch { notification = "failed"; }
    try {
      const acknowledged = await send(`${INTAKE_ORIGIN}/api/inquiries/notification`, { ...request, signal: AbortSignal.timeout(8000), body: JSON.stringify({ id: data.id, attemptedAt: claim.attemptedAt, token: claim.token, status: notification }) });
      if (!acknowledged.ok) notification = "pending";
    } catch { notification = "pending"; }
  }
  return { id: data.id, notification };
}
