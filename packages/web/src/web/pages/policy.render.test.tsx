import { afterEach, describe, expect, test } from "bun:test";
import { setupDom, flush } from "../test/jsdom-setup";

const dom = setupDom();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { Router } = await import("wouter");
const PolicyPage = (await import("./policy")).default;

const mounted: Array<() => void> = [];

async function mount(kind: "privacy" | "terms" | "legal", language: "ja" | "en") {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(
        Router,
        null,
        createElement(PolicyPage, { kind, language }) as never,
      ),
    );
    await flush(40);
  });
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  return host;
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.();
  dom.window.document.documentElement.lang = "ja";
});

describe("PolicyPage", () => {
  test("JP sales page shows confirmed terms and visibly marks missing owner input", async () => {
    const host = await mount("legal", "ja");
    expect(host.querySelector("h1")?.textContent).toBe(
      "特定商取引法に基づく表記・販売条件",
    );
    expect(host.textContent).toContain("¥30,000");
    expect(host.textContent).toContain("決済後24時間以内");
    expect(host.textContent).toContain("素材が揃ってから3日以内");
    expect(host.textContent?.match(/要確認/g)?.length).toBe(5);
    expect(host.querySelector('a[href="/contact"]')?.textContent).toContain(
      "購入前の条件を確認する",
    );
  });

  test("English privacy page renders English copy and links external policies safely", async () => {
    const host = await mount("privacy", "en");
    // <html lang> itself is covered by page-language.test.tsx. Reading the
    // process-global document here races other render files in Bun's full suite.
    const page = host.querySelector<HTMLElement>('[data-policy-language="en"]');
    expect(page?.getAttribute("lang")).toBe("en");
    expect(page?.querySelector("h1")?.classList.contains("font-en")).toBeTrue();
    expect(page?.querySelector("h1")?.classList.contains("font-ja")).toBeFalse();
    const lead = page?.querySelector<HTMLElement>("header p:last-of-type");
    expect(lead?.style.fontSize).toContain("max(0.875rem");
    expect(lead?.style.lineHeight).toContain("max(1.75");
    expect(host.querySelector("h1")?.textContent).toBe("Privacy Policy");
    const google = host.querySelector<HTMLAnchorElement>(
      'a[href^="https://policies.google.com/privacy"]',
    );
    expect(google?.target).toBe("_blank");
    expect(google?.rel).toContain("noopener");
    // Portfolio Kit is hidden on a distributed site where the service is off.
    expect(host.textContent).not.toContain("Stripe Privacy Policy");
  });

  test("a distributed site does not advertise the owner-only product or sales page", async () => {
    const host = await mount("terms", "ja");
    expect(host.textContent).not.toContain("Portfolio Kit");
    expect(host.querySelector('a[href="/legal"]')).toBeNull();
    expect(host.querySelector('a[href="/privacy"]')).not.toBeNull();
    expect(host.querySelector('a[href="/terms"]')).not.toBeNull();
  });
});
