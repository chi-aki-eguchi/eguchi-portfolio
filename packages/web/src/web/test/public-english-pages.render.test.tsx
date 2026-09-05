import { afterEach, describe, expect, test } from "bun:test";
import { canned, flush, setupDom } from "./jsdom-setup";

const dom = setupDom();
const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { Router } = await import("wouter");

const CJK_TEXT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

async function mount(node: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(Router, null, node as never),
    ),
  );
  await flush(150);
  return {
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

const mixedProfileSettings = {
  profileLabel: "プロフィール",
  profilePhotoUrl: "https://example.test/portrait.jpg",
  profileName: "江口 秋",
  profileNameEn: "Aki Eguchi",
  profileBio: "日本語の自己紹介です。",
  profileBioEn:
    "English biography.\n\n繁體中文的自我介紹。\n\nA second English paragraph.",
  profileStatement: "日本語の作家文です。",
  profileStatementEn:
    "English artist statement.\n\n中文作家自述。",
  profileGear: "Nikon Z6\n日本語の機材説明",
  noteEnabled: "on",
  profileNote: "https://note.example.test/aki",
  snsLabelNote: "ノート",
  printEnabled: "on",
  printStoreUrl: "https://prints.example.test",
  printStoreLabel: "プリントを購入する",
  printDescription: "English print note.\n\n日本語の説明。",
  homeCtaEnabled: "on",
  homeCtaTitle: "撮影のご依頼",
  homeCtaText: "ポートレートなどお気軽に。",
  homeCtaButton: "お問い合わせ",
};

const mixedContactSettings = {
  siteUrl: "https://akieguchi.com",
  formspreeUrl: "https://formspree.test/f/contact",
  contactLabel: "お問い合わせ",
  contactIntro: "日本語の案内です。",
  contactIntroEn: "English introduction.\n\n繁體中文的說明。",
  contactNote: "日本語の補足です。",
  contactNoteEn: "Early-stage enquiries are welcome.\n\n中文補充。",
  contactAreas: "東京・福岡・台北を中心に。",
  contactAreasEn: "",
  contactFlow: "ご相談 → 撮影 → 納品",
  contactFlowEn: "Consultation → photography → delivery",
  contactEnglishNote: "English inquiries welcome.",
  contactFormName: "お名前",
  contactFormEmail: "メール",
  contactFormSubject: "件名",
  contactFormMessage: "本文",
  contactMessagePlaceholder: "希望日と場所をご記入ください",
  contactSubjectOptions:
    "Shooting,Press / Media,Collaboration,テンプレートについて,其他,Other",
  contactSentMessage: "送信ありがとうございます。",
  contactSendAnother: "もう一度送る",
  contactErrorMessage: "送信できませんでした。",
  contactSendButton: "送信",
  contactSendingButton: "送信中",
};

afterEach(() => {
  canned["/api/settings"] = {};
  canned["/api/pricing"] = { plans: [] };
  canned["/api/note-posts"] = { posts: [] };
  dom.reconfigure({ url: "http://localhost/" });
});

describe("public English routes keep one language", () => {
  test("English About keeps English paragraphs, identity, print label, and enquiry route", async () => {
    canned["/api/settings"] = mixedProfileSettings;
    canned["/api/note-posts"] = {
      posts: [
        {
          title: "日本語の記事",
          excerpt: "日本語の抜粋",
          link: "https://note.example.test/post",
        },
      ],
    };
    const ProfilePage = (await import("../pages/profile")).default;
    const page = await mount(createElement(ProfilePage, { language: "en" }));
    try {
      const text = page.host.textContent ?? "";
      expect(text).toContain("Aki Eguchi");
      expect(text).toContain("English biography.");
      expect(text).toContain("A second English paragraph.");
      expect(text).toContain("English artist statement.");
      expect(text).toContain("English print note.");
      expect(text).toContain("Photography inquiries");
      expect(text).not.toMatch(CJK_TEXT);
      expect(page.host.querySelector("img")?.getAttribute("alt")).toBe(
        "Aki Eguchi",
      );
      expect(
        page.host.querySelector('a[href="/en/contact"]')?.textContent,
      ).toContain("Get in touch");
      expect(page.host.querySelector('a[href="/contact"]')).toBeNull();
      expect(
        page.host.querySelector('a[href="https://prints.example.test"]')
          ?.textContent,
      ).toContain("View prints");
      expect(
        page.host
          .querySelector('a[href="https://prints.example.test"]')
          ?.getAttribute("data-analytics-event"),
      ).toBe("print_store_click");
    } finally {
      page.cleanup();
    }
  });

  test("Japanese About keeps the configured Japanese identity, sections, and CTA", async () => {
    canned["/api/settings"] = mixedProfileSettings;
    canned["/api/note-posts"] = {
      posts: [
        {
          title: "日本語の記事",
          excerpt: "日本語の抜粋",
          link: "https://note.example.test/post",
        },
      ],
    };
    const ProfilePage = (await import("../pages/profile")).default;
    const page = await mount(createElement(ProfilePage));
    try {
      const text = page.host.textContent ?? "";
      expect(text).toContain("江口 秋");
      expect(text).toContain("日本語の自己紹介です。");
      expect(text).toContain("日本語の記事");
      expect(text).toContain("プリントを購入する");
      expect(text).toContain("撮影のご依頼");
      expect(page.host.querySelector('a[href="/contact"]')).not.toBeNull();
    } finally {
      page.cleanup();
    }
  });

  test("English Contact replaces shared Japanese UI copy and mixed subject options", async () => {
    canned["/api/settings"] = mixedContactSettings;
    canned["/api/pricing"] = {
      plans: [
        {
          id: 1,
          title: "日本語料金",
          price: "¥30,000",
          description: "日本語の説明",
          features: "",
          note: "",
        },
        {
          id: 2,
          title: "Portrait session",
          price: "¥30,000",
          description: "An English plan.",
          features: "Edited photographs",
          note: "",
        },
      ],
    };
    const ContactPage = (await import("../pages/contact")).default;
    const page = await mount(createElement(ContactPage, { language: "en" }));
    try {
      const text = page.host.textContent ?? "";
      expect(text).toContain("English introduction.");
      expect(text).toContain("Tokyo / Fukuoka / Taipei");
      expect(text).toContain("Portrait session");
      expect(text).toContain("Portfolio Kit");
      expect(text).not.toMatch(CJK_TEXT);
      expect(page.host.querySelector('a[href="/privacy/en"]')).not.toBeNull();
      expect(
        page.host
          .querySelector("#contact-message")
          ?.getAttribute("placeholder"),
      ).toContain("Tell me about the project");

      const previousFetch = globalThis.fetch;
      const previousFormData = globalThis.FormData;
      const previousGtag = window.gtag;
      const analyticsCalls: unknown[][] = [];
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch;
      globalThis.FormData = dom.window.FormData as unknown as typeof FormData;
      window.gtag = (...args: unknown[]) => analyticsCalls.push(args);
      try {
        (page.host.querySelector("#contact-name") as HTMLInputElement).value =
          "Alex";
        (page.host.querySelector("#contact-email") as HTMLInputElement).value =
          "alex@example.test";
        (
          page.host.querySelector("#contact-message") as HTMLTextAreaElement
        ).value = "Hello";
        page.host.querySelector("form")?.dispatchEvent(
          new dom.window.Event("submit", {
            bubbles: true,
            cancelable: true,
          }),
        );
        await flush(100);
      } finally {
        globalThis.fetch = previousFetch;
        globalThis.FormData = previousFormData;
        window.gtag = previousGtag;
      }
      expect(analyticsCalls).toEqual([
        ["event", "contact_submit_start", { language: "en" }],
        ["event", "contact_submit_success", { language: "en" }],
      ]);
      expect(page.host.textContent).toContain(
        "Thank you. Your message has been sent.",
      );
      expect(page.host.textContent).toContain("Send another");
      expect(page.host.textContent).not.toMatch(CJK_TEXT);
    } finally {
      page.cleanup();
    }
  });

  test("Japanese Contact keeps its configured copy, placeholder, plans, and subjects", async () => {
    canned["/api/settings"] = mixedContactSettings;
    canned["/api/pricing"] = {
      plans: [
        {
          id: 1,
          title: "日本語料金",
          price: "¥30,000",
          description: "日本語の説明",
          features: "",
          note: "",
        },
      ],
    };
    const ContactPage = (await import("../pages/contact")).default;
    const page = await mount(createElement(ContactPage));
    try {
      const text = page.host.textContent ?? "";
      expect(text).toContain("日本語の案内です。");
      expect(text).toContain("日本語料金");
      expect(text).toContain("テンプレートについて");
      expect(page.host.querySelector('a[href="/privacy"]')).not.toBeNull();
      expect(
        page.host
          .querySelector("#contact-message")
          ?.getAttribute("placeholder"),
      ).toBe("希望日と場所をご記入ください");
    } finally {
      page.cleanup();
    }
  });

  test("Contact analytics records a valid attempt but not a success when delivery fails", async () => {
    canned["/api/settings"] = mixedContactSettings;
    const ContactPage = (await import("../pages/contact")).default;
    const page = await mount(createElement(ContactPage, { language: "en" }));
    const previousFetch = globalThis.fetch;
    const previousFormData = globalThis.FormData;
    const previousGtag = window.gtag;
    const analyticsCalls: unknown[][] = [];
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "not delivered" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    globalThis.FormData = dom.window.FormData as unknown as typeof FormData;
    window.gtag = (...args: unknown[]) => analyticsCalls.push(args);
    try {
      (page.host.querySelector("#contact-name") as HTMLInputElement).value =
        "Private Name";
      (page.host.querySelector("#contact-email") as HTMLInputElement).value =
        "private@example.test";
      (
        page.host.querySelector("#contact-message") as HTMLTextAreaElement
      ).value = "Private message";
      page.host.querySelector("form")?.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await flush(100);
      expect(analyticsCalls).toEqual([
        ["event", "contact_submit_start", { language: "en" }],
      ]);
      expect(JSON.stringify(analyticsCalls)).not.toContain("Private");
      expect(JSON.stringify(analyticsCalls)).not.toContain("private@example");
    } finally {
      globalThis.fetch = previousFetch;
      globalThis.FormData = previousFormData;
      window.gtag = previousGtag;
      page.cleanup();
    }
  });

  test("English Contact does not infer a location when no configured area can be translated", async () => {
    canned["/api/settings"] = {
      ...mixedContactSettings,
      contactAreas: "",
      contactAreasEn: "",
    };
    const ContactPage = (await import("../pages/contact")).default;
    const page = await mount(createElement(ContactPage, { language: "en" }));
    try {
      const text = page.host.textContent ?? "";
      expect(text).not.toContain("Tokyo");
      expect(text).not.toContain("Fukuoka");
      expect(text).not.toContain("Taipei");
    } finally {
      page.cleanup();
    }
  });

  test("English Portfolio Kit keeps example, fallback-contact, and policy links in English routes", async () => {
    canned["/api/settings"] = {
      siteUrl: "https://portfolio.example",
      contactEmail: "",
      servicePageConfig: JSON.stringify({
        pricing: {
          plans: [
            {
              name: "公開おまかせ",
              price: "¥30,000",
              sub: "日本語の説明",
              points: ["日本語の機能"],
              stripeUrl: "",
              cta: "申し込む",
              primary: true,
            },
          ],
        },
        finalCta: {
          snsLinks: [
            { label: "写真SNS", url: "https://social.example/aki" },
          ],
        },
      }),
    };
    const ServicePage = (await import("../pages/service")).default;
    const page = await mount(createElement(ServicePage, { language: "en" }));
    try {
      const text = page.host.textContent ?? "";
      expect(text).not.toMatch(CJK_TEXT);
      expect(page.host.querySelector('a[href="/en/about"]')).not.toBeNull();
      expect(page.host.querySelector('a[href="/en/contact"]')).not.toBeNull();
      expect(page.host.querySelector('a[href="/about"]')).toBeNull();
      expect(page.host.querySelector('a[href="/contact"]')).toBeNull();
      expect(page.host.querySelector('a[href="/legal/en"]')).toBeNull();
      const experienceLink = Array.from(page.host.querySelectorAll("a")).find(
        (link) => link.getAttribute("href")?.includes("portfolio-kit-experience"),
      );
      expect(experienceLink?.getAttribute("href")).toBe(
        "/?portfolio-kit-experience=1&lang=en",
      );
      expect(text).toContain("social.example");
    } finally {
      page.cleanup();
    }
  });

  test("Japanese Portfolio Kit keeps Japanese internal routes", async () => {
    canned["/api/settings"] = {
      siteUrl: "https://portfolio.example",
      contactEmail: "",
      servicePageConfig: JSON.stringify({
        pricing: {
          plans: [
            {
              name: "公開おまかせ",
              price: "¥30,000",
              sub: "日本語の説明",
              points: ["日本語の機能"],
              stripeUrl: "",
              cta: "申し込む",
              primary: true,
            },
          ],
        },
      }),
    };
    const ServicePage = (await import("../pages/service")).default;
    const page = await mount(createElement(ServicePage));
    try {
      expect(page.host.querySelector('a[href="/about"]')).not.toBeNull();
      expect(page.host.querySelector('a[href="/contact"]')).not.toBeNull();
      expect(page.host.querySelector('a[href="/legal"]')).toBeNull();
      expect(page.host.querySelector('a[href="/legal/en"]')).toBeNull();
      expect(page.host.querySelector('a[href="/terms/en"]')).toBeNull();
      const experienceLink = Array.from(page.host.querySelectorAll("a")).find(
        (link) => link.getAttribute("href")?.includes("portfolio-kit-experience"),
      );
      expect(experienceLink?.getAttribute("href")).toBe(
        "/?portfolio-kit-experience=1",
      );
    } finally {
      page.cleanup();
    }
  });

  test("English Portfolio Kit experience panel keeps its controls and return link in English", async () => {
    dom.reconfigure({
      url: "https://akieguchi.com/?portfolio-kit-experience=1&lang=en",
    });
    const PortfolioKitExperience = (
      await import("../components/PortfolioKitExperience")
    ).default;
    const page = await mount(
      createElement(PortfolioKitExperience, { initialSettings: {} }),
    );
    try {
      const panel = page.host.querySelector("aside");
      expect(panel?.textContent).toContain("Try the design controls");
      expect(panel?.textContent).toContain("Photo layout");
      expect(panel?.textContent).not.toMatch(CJK_TEXT);
      expect(panel?.getAttribute("lang")).toBe("en");
      expect(
        panel?.querySelector('a[href="/portfolio-kit/en"]'),
      ).not.toBeNull();
    } finally {
      page.cleanup();
    }
  });
});
