import { describe, expect, test } from "bun:test";
import { consultPlan, INTAKE_ORIGIN, submitPortfolioInquiry, type Intake } from "./portfolio-intake";
const intake: Intake = { id: "10000000-0000-4000-8000-000000000001", name: "LOCAL QA", email: "qa@example.invalid", website: "", plan: "editorial", brief: "Local test only", consent: true, company: "", elapsed: 5000, source: "partner" };
const claim = { status: "sending", token: "mock-proof", attemptedAt: "2026-09-06T00:00:00.000Z" };
type Call = { url: string; options?: RequestInit };
function fake(responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const send = (async (url: string, options?: RequestInit) => { calls.push({ url, options }); const r = responses.shift(); if (r instanceof Error) throw r; if (!r) throw new Error("Unexpected network request"); return r; }) as typeof fetch;
  return { calls, send };
}
describe("unified portfolio intake, mocked network only", () => {
  test("plan allowlist rejects inherited properties", () => {
    expect(consultPlan("basic")).toBe("basic");
    expect(consultPlan("care")).toBe("care");
    for (const p of [null, "__proto__", "toString", "unknown"]) expect(consultPlan(p)).toBe("editorial");
  });
  test("stored receipt without claim performs no notification", async () => {
    const f = fake([Response.json({ id: intake.id, notification: { status: "pending" } }, { status: 201 })]);
    expect(await submitPortfolioInquiry(intake, f.send)).toEqual({ id: intake.id, notification: "pending" });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(`${INTAKE_ORIGIN}/api/inquiries`);
  });
  test("saves first, then notifies fixed owner endpoint, then acknowledges without PII", async () => {
    const f = fake([Response.json({ id: intake.id, notification: claim }, { status: 201 }), Response.json({ ok: true }), Response.json({})]);
    expect((await submitPortfolioInquiry(intake, f.send)).notification).toBe("client_accepted");
    expect(f.calls.map(c => c.url)).toEqual([`${INTAKE_ORIGIN}/api/inquiries`, "https://formspree.io/f/mbdeebae", `${INTAKE_ORIGIN}/api/inquiries/notification`]);
    for (const c of f.calls) { expect(c.options?.credentials).toBe("omit"); expect(c.options?.redirect).toBe("error"); }
    const ack = JSON.parse(f.calls[2].options?.body as string);
    expect(ack).toEqual({ id: intake.id, attemptedAt: claim.attemptedAt, token: claim.token, status: "client_accepted" });
  });
  test("failed intake and incorrect receipt never notify", async () => {
    for (const response of [Response.json({ error: "保存できません" }, { status: 503 }), Response.json({ id: "wrong", notification: claim })]) {
      const f = fake([response]);
      await expect(submitPortfolioInquiry(intake, f.send)).rejects.toThrow();
      expect(f.calls).toHaveLength(1);
    }
  });
  test("provider failure never loses saved receipt", async () => {
    for (const response of [Response.json({ ok: false }), Response.json({ ok: true }, { status: 429 }), new Error("offline")]) {
      const f = fake([Response.json({ id: intake.id, notification: claim }), response, Response.json({})]);
      expect(await submitPortfolioInquiry(intake, f.send)).toEqual({ id: intake.id, notification: "failed" });
      expect(JSON.parse(f.calls[2].options?.body as string).status).toBe("failed");
    }
  });
  test("missing acknowledgement stays pending, not a failed submission", async () => {
    for (const response of [Response.json({}, { status: 403 }), new Error("offline")]) {
      const f = fake([Response.json({ id: intake.id, notification: claim }), Response.json({ ok: true }), response]);
      expect(await submitPortfolioInquiry(intake, f.send)).toEqual({ id: intake.id, notification: "pending" });
    }
  });
});
