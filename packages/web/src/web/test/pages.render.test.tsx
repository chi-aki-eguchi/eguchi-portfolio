/**
 * Page-level render smoke tests (壊れにくさの砦):
 * every public page + admin login + the shared viewer components must mount
 * without crashing, in BOTH a populated state (canned API) and the empty
 * state (0 photos / empty settings). A throw inside any component leaves the
 * host empty or rejects — either fails here before a ZIP can be built.
 */
import { test, expect, describe } from "bun:test";
import { setupDom, canned, samplePhotos, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement, StrictMode } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } =
  await import("@tanstack/react-query");

function seedAdminPhotos(qc: InstanceType<typeof QueryClient>) {
  qc.setQueryData(["photos", "all"], { photos: samplePhotos });
}

// 2026-07-10仕様変更への追随: setupCompletedがtrueでないと初回マウントで
// 「はじめに」へ着地するようになった(自動バックフィル削除)。Library着地を
// 前提とするテストは「セットアップ完了済みの既存運用サイト」を明示する。
// admin-me も同時にseedする: 認証確定が settings の再フェッチ(canned {})より
// 遅れると、初回判定が「未完了」で走って「はじめに」へ着地してしまうため。
function seedCompletedSetup(qc: InstanceType<typeof QueryClient>) {
  qc.setQueryData(["settings"], { setupCompleted: "true" });
  qc.setQueryData(["admin-me"], { authenticated: true });
}

function seedEstablishedAdminSite(qc: InstanceType<typeof QueryClient>) {
  seedAdminPhotos(qc);
  seedCompletedSetup(qc);
}

function makeLargeAdminPhotos(count = 445) {
  return Array.from({ length: count }, (_, index) => ({
    ...samplePhotos[index % samplePhotos.length],
    id: index + 1,
    filename: `p-${String(index).padStart(3, "0")}.jpg`,
    url: `/api/images/photos/p-${String(index).padStart(3, "0")}.jpg`,
    thumbUrl: `/api/images/thumbs/p-${String(index).padStart(3, "0")}.webp`,
    mediumUrl: `/api/images/medium/p-${String(index).padStart(3, "0")}.webp`,
    title: `P${String(index).padStart(3, "0")}`,
    sortOrder: index,
    fileHash: `large-${index}`,
  }));
}

async function mount(
  node: unknown,
  setupQueryClient?: (qc: InstanceType<typeof QueryClient>) => void,
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setupQueryClient?.(qc);
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      StrictMode,
      null,
      createElement(QueryClientProvider, { client: qc }, node as never),
    ),
  );
  await flush(30); // let queries resolve against the canned fetch and re-render
  return {
    qc,
    host,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

function buttonWithText(host: Element, text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll("button")).find((el) =>
    el.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

// モード分離(2026-07-23承認・docs/specs/library-redesign-spec.md)後、通常/選択/
// 並べるの切替はこの data 属性が入口になる。テキストは JA/EN で変わるため属性で引く。
function modeAction(host: Element, action: string): HTMLButtonElement {
  const button = host.querySelector(
    `[data-library-mode-action="${action}"]`,
  ) as HTMLButtonElement | null;
  if (!button) throw new Error(`Mode action not found: ${action}`);
  return button;
}

function inputByLabel(host: Element, label: string): HTMLInputElement {
  const input = host.querySelector(
    `input[aria-label="${label}"]`,
  ) as HTMLInputElement | null;
  if (!input) throw new Error(`Input not found: ${label}`);
  return input;
}

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function setupOpenButton(host: Element, rowTitle: string): HTMLButtonElement {
  const row = Array.from(host.querySelectorAll("div"))
    .filter(
      (el) =>
        el.textContent?.includes(rowTitle) &&
        Array.from(el.querySelectorAll("button")).some(
          (button) => button.textContent?.trim() === "開く",
        ),
    )
    .sort(
      (a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0),
    )[0];
  const button = row?.querySelector("button") as HTMLButtonElement | null;
  if (!button) throw new Error(`Setup row button not found: ${rowTitle}`);
  return button;
}

// 2026-07-11 スマホナビ再設計: グループボタンはボトムシートを開き、
// タブはシート内の行から選ぶ(グループ→タブの2クリック導線は不変)。
// グループは .admin-bottom-nav__btn を直接探す — buttonWithText だと
// 「サイトで確認」等の同語ボタンに先にマッチするため。
function navGroup(host: Element, label: string): HTMLButtonElement {
  const btn = Array.from(host.querySelectorAll(".admin-bottom-nav__btn")).find(
    (el) => el.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  if (!btn) throw new Error(`Bottom nav group not found: ${label}`);
  return btn;
}

function sheetRow(host: Element, label: string): HTMLButtonElement {
  const row = Array.from(host.querySelectorAll(".admin-sheet__row")).find(
    (el) => el.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  if (!row) throw new Error(`Sheet row not found: ${label}`);
  return row;
}

async function waitForText(host: Element, text: string, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    if (host.textContent?.includes(text)) return;
    await flush(50);
  }
  expect(host.textContent).toContain(text);
}

async function waitForButton(host: Element, selector: string, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    const button = host.querySelector(selector) as HTMLButtonElement | null;
    if (button) return button;
    await flush(50);
  }
  const button = host.querySelector(selector) as HTMLButtonElement | null;
  expect(button).not.toBeNull();
  return button!;
}

const pages: [string, () => Promise<{ default: React.ComponentType }>][] = [
  ["top", () => import("../pages/top")],
  ["gallery", () => import("../pages/gallery")],
  ["series", () => import("../pages/series")],
  ["series-detail", () => import("../pages/series-detail")],
  ["profile", () => import("../pages/profile")],
  ["contact", () => import("../pages/contact")],
  ["service", () => import("../pages/service")],
  ["service-start", () => import("../pages/service-start")],
  ["admin-login", () => import("../pages/admin-login")],
];

describe("public pages render (populated API)", () => {
  for (const [name, load] of pages) {
    test(name, async () => {
      const Page = (await load()).default;
      const { host, cleanup } = await mount(createElement(Page));
      expect(host.innerHTML.length).toBeGreaterThan(0);
      cleanup();
    });
  }

  test("top random works fetches a limited random photo payload", async () => {
    const prevSettings = canned["/api/settings"];
    const prevFetch = globalThis.fetch;
    const seen: string[] = [];
    canned["/api/settings"] = {
      topWorksMode: "random",
      homeGalleryCount: "12",
    };
    globalThis.fetch = (async (input: string | URL | Request) => {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const u = new URL(raw, "http://localhost/");
      seen.push(`${u.pathname}${u.search}`);
      return prevFetch(input);
    }) as typeof fetch;
    try {
      const Top = (await import("../pages/top")).default;
      const { cleanup } = await mount(createElement(Top));
      await flush(60);

      expect(
        seen.some(
          (url) =>
            url.startsWith("/api/photos?") &&
            url.includes("limit=48") &&
            url.includes("order=random"),
        ),
      ).toBe(true);
      expect(seen).not.toContain("/api/photos");
      cleanup();
    } finally {
      canned["/api/settings"] = prevSettings;
      globalThis.fetch = prevFetch;
    }
  });

  // 0.55 は AA(4.5:1) を満たしていなかった（実測3.82:1）。
  // T-11 の記録にあった 5.26:1 は誤り。--text-quiet（0.62 / 約4.77:1）へ移行した。
  test("profile secondary text keeps the WCAG AA opacity floor", async () => {
    const previousSettings = canned["/api/settings"];
    const previousNotePosts = canned["/api/note-posts"];
    canned["/api/settings"] = {
      profileName: "江口 秋",
      profileNameEn: "Aki Eguchi",
      profileBio: "Biography",
      profileStatement: "Statement body",
      profileGear: "Camera",
      profileInstagram: "https://example.com/instagram",
      profileTwitter: "https://example.com/x",
      profileNote: "https://example.com/note",
      noteEnabled: "on",
      printEnabled: "on",
      printStoreUrl: "https://example.com/prints",
    };
    canned["/api/note-posts"] = {
      posts: [
        {
          link: "https://example.com/journal",
          title: "Journal title",
          excerpt: "Journal excerpt",
          date: "2026-07-21T00:00:00.000Z",
          thumbnail: "",
        },
      ],
    };
    try {
      const ProfilePage = (await import("../pages/profile")).default;
      const { host, cleanup } = await mount(createElement(ProfilePage));
      await waitForText(host, "Journal excerpt");

      const accessibleSecondaryText = Array.from(
        host.querySelectorAll(".text-\\[color\\:var\\(--text-quiet\\)\\]"),
      );
      const expectedText = [
        "Aki Eguchi",
        "Statement",
        "Equipment",
        "Instagram",
        "X",
        "note",
        "Journal",
        "2026.07.21",
        "Journal excerpt",
        "Prints",
      ];
      for (const text of expectedText) {
        expect(
          accessibleSecondaryText.some((element) =>
            element.textContent?.includes(text),
          ),
        ).toBe(true);
      }
      expect(accessibleSecondaryText.length).toBeGreaterThanOrEqual(11);
      cleanup();
    } finally {
      canned["/api/settings"] = previousSettings;
      canned["/api/note-posts"] = previousNotePosts;
    }
  });
});

describe("public pages render (empty state: 写真0枚・設定空)", () => {
  test("all public pages keep rendering when settings API returns 500 JSON", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const path = new URL(raw, "http://localhost/").pathname;
      if (path === "/api/settings") {
        return new Response(JSON.stringify({ error: "settings unavailable" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input);
    }) as typeof fetch;

    try {
      for (const [name, load] of pages) {
        if (name === "admin-login") continue;
        const Page = (await load()).default;
        const { host, cleanup } = await mount(createElement(Page));
        expect(host.innerHTML.length).toBeGreaterThan(0);
        cleanup();
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("all pages survive an empty site", async () => {
    const prevPhotos = canned["/api/photos"];
    canned["/api/photos"] = { photos: [] };
    try {
      for (const [, load] of pages) {
        const Page = (await load()).default;
        const { host, cleanup } = await mount(createElement(Page));
        expect(host.innerHTML.length).toBeGreaterThan(0);
        cleanup();
      }
    } finally {
      canned["/api/photos"] = prevPhotos;
    }
  });

  test("empty public pages do not fall back to production identity", async () => {
    const prevPhotos = canned["/api/photos"];
    canned["/api/photos"] = { photos: [] };
    try {
      for (const [name, load] of pages) {
        if (name.startsWith("service")) continue;
        const Page = (await load()).default;
        const { host, cleanup } = await mount(createElement(Page));
        expect(host.textContent).not.toContain("江口秋");
        expect(host.textContent).not.toContain("Aki Eguchi");
        cleanup();
      }
    } finally {
      canned["/api/photos"] = prevPhotos;
    }
  });
});

describe("shared components", () => {
  test("Service page bodies render independently of the shared route gate", async () => {
    dom.reconfigure({ url: "https://example.com/" });
    try {
      for (const load of [
        () => import("../pages/service"),
        () => import("../pages/service-start"),
      ]) {
        const Page = (await load()).default;
        const { host, cleanup } = await mount(createElement(Page));
        expect(host.innerHTML.length).toBeGreaterThan(0);
        cleanup();
      }
    } finally {
      dom.reconfigure({ url: "http://localhost/" });
    }
  });

  test("distributed Portfolio Kit pages never render the owner email fallback", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = {
      servicePageMode: "on",
      siteUrl: "https://portfolio.example",
      contactEmail: "",
    };
    dom.reconfigure({ url: "https://portfolio.example/portfolio-kit" });
    try {
      for (const load of [
        () => import("../pages/service"),
        () => import("../pages/service-start"),
      ]) {
        const Page = (await load()).default;
        const { host, cleanup } = await mount(createElement(Page));
        expect(host.innerHTML).not.toContain("akieguchi33@gmail.com");
        cleanup();
      }
    } finally {
      canned["/api/settings"] = previousSettings;
      dom.reconfigure({ url: "http://localhost/" });
    }
  });

  test("Portfolio Kit answers the core buying questions in its default copy", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = { servicePageConfig: "" };
    try {
      const PortfolioKitPage = (await import("../pages/service")).default;
      const { host, cleanup } = await mount(createElement(PortfolioKitPage));
      expect(host.textContent).toContain("いま見ているこのサイトが");
      expect(host.textContent).toContain("¥30,000（買い切り・月額なし）");
      expect(host.textContent).toContain(
        "ドメイン取得から公開設定まで、全部おまかせ",
      );
      expect(host.textContent).toContain("素材が揃ってから3日以内");
      expect(host.textContent).toContain("24時間以内に素材のお願い");
      expect(host.textContent).toContain("維持費や月額料金はいくらですか？");
      expect(host.textContent).toContain("やめたいときはどうなりますか？");
      expect(host.textContent).toContain("並べ方12種類・140以上の設定");
      const adminPanels = host.querySelectorAll("#admin-panel");
      expect(adminPanels).toHaveLength(1);
      expect(
        adminPanels[0]?.querySelector("[data-admin-feature-list]")?.children
          .length,
      ).toBeLessThanOrEqual(6);
      expect(
        host.querySelector('a[href="/?portfolio-kit-experience=1"]'),
      ).not.toBeNull();
      expect(
        host.querySelector('a[href="/portfolio-kit/en"]'),
      ).not.toBeNull();
      const startPreview = host.querySelector('a[href="/start"]');
      expect(startPreview?.textContent).toContain("購入後の流れを先に見る");
      cleanup();
    } finally {
      canned["/api/settings"] = previousSettings;
    }
  });

  test("English Portfolio Kit renders the single-plan terms and language link", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = { servicePageConfig: "" };
    try {
      const PortfolioKitPage = (await import("../pages/service")).default;
      const { host, cleanup } = await mount(
        createElement(PortfolioKitPage, { language: "en" }),
      );
      const text = host.textContent ?? "";
      expect(text).toContain("Within 24 hours of payment");
      expect(text).toContain("delivered within three days");
      expect(text).toContain("One purchase covers one website");
      expect(text).toContain("may not be resold or redistributed");
      expect(text).toContain("currently provided at no additional charge");
      expect(text).toContain("may change in the future");
      expect(text).toContain("¥30,000 (approx. $195 USD)");
      expect(text).toContain("exchange rates and your card provider");
      expect(text).toContain(
        "The admin panel is available in English and Japanese — switch anytime with the JP | EN toggle.",
      );
      expect(text).toContain(
        "Support is provided in Japanese and simple English.",
      );
      expect(host.querySelectorAll("#pricing article")).toHaveLength(1);
      expect(text).not.toContain("¥50,000");
      expect(text).not.toContain("¥10,000");
      expect(text).not.toContain("Self setup");
      expect(host.querySelector('a[href="/portfolio-kit"]')).not.toBeNull();
      const startPreview = host.querySelector('a[href="/start/en"]');
      expect(startPreview?.textContent).toContain(
        "Preview what happens after purchase",
      );
      cleanup();
    } finally {
      canned["/api/settings"] = previousSettings;
    }
  });

  test("English Portfolio Kit sells only the assisted plan from a stale two-plan config", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = {
      servicePageConfig: JSON.stringify({
        pricing: {
          plans: [
            {
              name: "公開おまかせ",
              price: "¥30,000",
              sub: "B",
              points: [],
              stripeUrl: "https://buy.stripe.com/assisted-plan",
              cta: "B",
              primary: true,
            },
            {
              name: "自分で立てる",
              price: "¥10,000",
              sub: "A",
              points: [],
              stripeUrl: "https://buy.stripe.com/self-plan",
              cta: "A",
              primary: false,
            },
          ],
        },
      }),
    };
    try {
      const PortfolioKitPage = (await import("../pages/service")).default;
      const { host, cleanup } = await mount(
        createElement(PortfolioKitPage, { language: "en" }),
      );
      const cards = host.querySelectorAll("#pricing article");
      expect(cards).toHaveLength(1);
      expect(cards[0]?.textContent).toContain("Assisted setup");
      expect(cards[0]?.textContent).toContain("¥30,000");
      expect(cards[0]?.querySelector("a")?.getAttribute("href")).toBe(
        "https://buy.stripe.com/assisted-plan",
      );
      cleanup();
    } finally {
      canned["/api/settings"] = previousSettings;
    }
  });

  test("TopPage shows the experience panel only on the owner host with the experience query", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = { topWorksLayout: "large-format" };
    dom.reconfigure({
      url: "https://akieguchi.com/?portfolio-kit-experience=1",
    });
    try {
      const TopPage = (await import("../pages/top")).default;
      const { host, cleanup } = await mount(createElement(TopPage));
      await waitForText(host, "これは体験です。実際のサイトは変わりません。");
      expect(
        host.querySelector('[aria-label="Portfolio Kit 体験モード"]'),
      ).not.toBeNull();
      expect(host.querySelector('a[href="/portfolio-kit"]')).not.toBeNull();
      cleanup();
    } finally {
      canned["/api/settings"] = previousSettings;
      dom.reconfigure({ url: "http://localhost/" });
    }
  });

  test("TopPage omits the experience panel for normal visits and distributed hosts", async () => {
    const TopPage = (await import("../pages/top")).default;
    for (const url of [
      "https://akieguchi.com/",
      "https://portfolio.example/?portfolio-kit-experience=1",
    ]) {
      dom.reconfigure({ url });
      const { host, cleanup } = await mount(createElement(TopPage));
      await flush(20);
      expect(
        host.querySelector('[aria-label="Portfolio Kit 体験モード"]'),
      ).toBeNull();
      cleanup();
    }
    dom.reconfigure({ url: "http://localhost/" });
  });

  test("ServiceStartPage promises the assisted delivery without any deploy path", async () => {
    const ServiceStartPage = (await import("../pages/service-start")).default;
    const { host, cleanup } = await mount(createElement(ServiceStartPage));
    const text = host.textContent ?? "";
    expect(text).toContain("Aki Eguchi Portfolio Kit");
    expect(text).toContain("決済後24時間以内に素材のお願い");
    expect(text).toContain("素材が揃ってから3日以内");
    expect(text).toContain("当面は期間・回数の制限なく受け付けます");
    expect(text).not.toContain("公開後7日間");
    expect(text).not.toContain("設置リンク");
    expect(host.innerHTML).not.toContain("railway.com/deploy");
    expect(host.querySelector('a[href="/start/en"]')).not.toBeNull();
    cleanup();
  });

  test("English start page renders the assisted flow and reciprocal JP link", async () => {
    const ServiceStartPage = (await import("../pages/service-start")).default;
    const { host, cleanup } = await mount(
      createElement(ServiceStartPage, { language: "en" }),
    );
    const text = host.textContent ?? "";
    expect(text).toContain("Within 24 hours of payment");
    expect(text).toContain("within three days");
    expect(text).toContain("Send your materials");
    expect(text).toContain("Handover");
    expect(text).toContain(
      "The admin panel is available in English and Japanese",
    );
    expect(host.innerHTML).not.toContain("railway.com/deploy");
    expect(host.querySelector('a[href="/start"]')).not.toBeNull();
    expect(
      host.querySelector('a[href="/portfolio-kit/en"]'),
    ).not.toBeNull();
    cleanup();
  });

  test("English Portfolio Kit routes render through the shared visibility gate", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = {
      servicePageMode: "on",
      siteUrl: "https://portfolio.example",
      servicePageConfig: "",
    };
    const App = (await import("../app")).default;
    try {
      for (const [url, expected] of [
        [
          "https://portfolio.example/portfolio-kit/en",
          "ready for your photographs.",
        ],
        [
          "https://portfolio.example/start/en",
          "After purchase, you send materials and wait.",
        ],
      ] as const) {
        dom.reconfigure({ url });
        const { host, cleanup } = await mount(createElement(App));
        await waitForText(host, expected);
        expect(host.textContent).toContain(expected);
        cleanup();
      }
    } finally {
      canned["/api/settings"] = previousSettings;
      dom.reconfigure({ url: "http://localhost/" });
    }
  });

  // 2026-07-18 単一プラン化の回帰ガード: 購入者ページから Railway の画面名や
  // 環境変数などの技術用語が完全に消えていること(設置は全てオーナー側の作業)。
  test("ServiceStartPage keeps technical setup jargon away from buyers", async () => {
    const ServiceStartPage = (await import("../pages/service-start")).default;
    for (const language of ["ja", "en"] as const) {
      const { host, cleanup } = await mount(
        createElement(ServiceStartPage, { language }),
      );
      const text = host.textContent ?? "";
      expect(text).not.toContain("ADMIN_PASSWORD");
      expect(text).not.toContain("Configure");
      expect(text).not.toContain("Generate Domain");
      expect(text).not.toContain("S3_BUCKET");
      expect(text).not.toContain("SECRET_ACCESS_KEY");
      expect(text).not.toContain("Railway");
      expect(
        host.querySelector('a[href="/admin/login"]'),
      ).not.toBeNull();
      cleanup();
    }
  });

  // 2026-07-20: Stripe Payment Linkは完了画面を出さず /start?thanks=1 へ
  // リダイレクトする(オーナー設定)。決済帰りの着地だけ購入お礼を表示し、
  // 素の /start(LPからの下見)には出さない
  test("ServiceStartPage thanks the buyer only when arriving from checkout", async () => {
    const ServiceStartPage = (await import("../pages/service-start")).default;
    try {
      dom.reconfigure({ url: "http://localhost/start?thanks=1" });
      {
        const { host, cleanup } = await mount(createElement(ServiceStartPage));
        const text = host.textContent ?? "";
        expect(text).toContain("ご購入、誠にありがとうございます");
        expect(text).toContain("すぐに何かをしなくても大丈夫です");
        // 2026-07-20: 「情報が少ない」というオーナー指摘を受け、
        // プラン・支払い方法・領収書送付先を明記した領収書調の要約を追加
        expect(text).toContain("公開おまかせ（¥30,000）");
        expect(text).toContain("Stripeにて完了");
        expect(text).toContain("購入時のメールアドレスへ送付");
        // 言語切替でお礼が消えないよう、クエリはJP|ENリンクにも引き継ぐ
        expect(
          host.querySelector('a[href="/start/en?thanks=1"]'),
        ).not.toBeNull();
        cleanup();
      }
      dom.reconfigure({
        url: "http://localhost/start?checkout_session_id=cs_test_123",
      });
      {
        const { host, cleanup } = await mount(
          createElement(ServiceStartPage, { language: "en" }),
        );
        const text = host.textContent ?? "";
        expect(text).toContain("Thank you for your purchase.");
        expect(text).toContain("Assisted Publishing — ¥30,000");
        cleanup();
      }
      dom.reconfigure({ url: "http://localhost/start" });
      {
        const { host, cleanup } = await mount(createElement(ServiceStartPage));
        expect(host.textContent ?? "").not.toContain(
          "ご購入、誠にありがとうございます",
        );
        cleanup();
      }
    } finally {
      dom.reconfigure({ url: "http://localhost/" });
    }
  });

  // 2026-07-20: 「素材を送る」は白紙メールではなく、送付項目リスト
  // (docs/purchase-thankyou.md 由来)を本文の下書きに差し込む
  test("ServiceStartPage prefills the materials email with the checklist", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = {
      servicePageMode: "on",
      siteUrl: "https://portfolio.example",
      contactEmail: "owner@portfolio.example",
    };
    try {
      const ServiceStartPage = (await import("../pages/service-start")).default;
      const { host, cleanup } = await mount(createElement(ServiceStartPage));
      const href =
        host
          .querySelector('a[href^="mailto:owner@portfolio.example"]')
          ?.getAttribute("href") ?? "";
      expect(href).toContain(encodeURIComponent("お名前（サイトに出す表記）"));
      expect(href).toContain(encodeURIComponent("載せたい写真"));
      expect(href).toContain(encodeURIComponent("プロフィール文・連絡先・SNS"));
      expect(href).toContain(encodeURIComponent("独自ドメイン"));
      expect(href).toContain(encodeURIComponent("なくても大丈夫です"));
      expect(href).toContain(encodeURIComponent("あなた名義"));
      cleanup();
    } finally {
      canned["/api/settings"] = previousSettings;
    }
  });

  test("ServiceStartPage walks the buyer from handover to the first photograph", async () => {
    const ServiceStartPage = (await import("../pages/service-start")).default;
    const { host, cleanup } = await mount(createElement(ServiceStartPage));
    const text = host.textContent ?? "";
    expect(text).toContain("納品後の最初の一歩");
    expect(text).toContain("写真を1枚");
    expect(text).toContain("はじめに");
    expect(text).toContain("トップ写真に選んだあと");
    expect(text).toContain("実際のトップページ");
    cleanup();
  });

  test("ServiceStartPage reassures first-time buyers about domains in JA and EN", async () => {
    const ServiceStartPage = (await import("../pages/service-start")).default;
    {
      const { host, cleanup } = await mount(createElement(ServiceStartPage));
      const text = host.textContent ?? "";
      expect(text).toContain("独自ドメインを持っていなくても、大丈夫です");
      expect(text).toContain("あなた名義");
      expect(text).toContain("実費だけ別にかかります");
      expect(text).toContain("購入前に内容と金額を確認");
      cleanup();
    }
    {
      const { host, cleanup } = await mount(
        createElement(ServiceStartPage, { language: "en" }),
      );
      const text = host.textContent ?? "";
      expect(text).toContain("You do not need to own a domain yet");
      expect(text).toContain("registered in your name");
      expect(text).toContain("actual fee separately");
      cleanup();
    }
  });

  test("SeriesGrid renders its empty state", async () => {
    const { SeriesGrid } = await import("../components/SeriesGrid");
    const { host, cleanup } = await mount(createElement(SeriesGrid));
    expect(host.textContent).toContain("まだシリーズがありません");
    cleanup();
  });

  test("SeriesGrid renders tiles with titles (R1)", async () => {
    const prev = canned["/api/series"];
    canned["/api/series"] = {
      series: [
        {
          id: 3,
          slug: "s",
          title: "indigo blue",
          subtitle: "2026",
          statement: "",
          coverPhotoId: 2,
          sortOrder: 0,
          isPublished: true,
          coverUrl: "/api/images/photos/b.jpg",
        },
      ],
    };
    try {
      const { SeriesGrid } = await import("../components/SeriesGrid");
      const { host, cleanup } = await mount(createElement(SeriesGrid));
      expect(host.textContent).toContain("indigo blue");
      cleanup();
    } finally {
      canned["/api/series"] = prev;
    }
  });

  test("Lightbox mounts, navigates and closes without crashing", async () => {
    const { Lightbox } = await import("../components/Lightbox");
    const originalBack = dom.window.history.back.bind(dom.window.history);
    let historyBackCalls = 0;
    dom.window.history.back = () => {
      historyBackCalls += 1;
      originalBack();
    };
    let closed = 0;
    let index = 0;
    const photos = samplePhotos.map((p) => ({
      url: p.url,
      title: p.title,
      camera: p.camera,
      lens: p.lens,
      filmType: p.filmType,
    }));
    try {
      const { cleanup } = await mount(
        createElement(Lightbox, {
          photos,
          index,
          onClose: () => {
            closed += 1;
          },
          onPrev: () => {
            index = (index + photos.length - 1) % photos.length;
          },
          onNext: () => {
            index = (index + 1) % photos.length;
          },
        }),
      );
      const dlg = dom.window.document.querySelector("dialog");
      expect(dlg).not.toBeNull();
      // StrictMode effect replay must not immediately history.back() and close the
      // just-opened viewer (the real gallery symptom was a black flicker).
      expect(historyBackCalls).toBe(0);
      // Keyboard navigation + Escape-equivalent close button stay wired.
      dom.window.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: "ArrowRight" }),
      );
      const closeBtn = dom.window.document.querySelector(
        'dialog button[aria-label="閉じる"]',
      ) as HTMLButtonElement | null;
      expect(closeBtn).not.toBeNull();
      closeBtn!.click();
      await flush(420);
      expect(closed).toBe(1);
      expect(historyBackCalls).toBe(0);
      cleanup();
      await flush(5); // popstate/scroll-restore cleanup must not throw after unmount
      expect(historyBackCalls).toBe(1);
    } finally {
      dom.window.history.back = originalBack;
    }
  });

  test("PhotoGallery click keeps the lightbox open under StrictMode", async () => {
    const { PhotoGallery } = await import("../components/PhotoGallery");
    const originalBack = dom.window.history.back.bind(dom.window.history);
    let historyBackCalls = 0;
    dom.window.history.back = () => {
      historyBackCalls += 1;
      originalBack();
    };
    try {
      const { host, cleanup } = await mount(
        createElement(PhotoGallery, {
          photos: samplePhotos,
          layoutType: "grid",
        }),
      );
      const firstTile = host.querySelector(
        'button[aria-label="A"]',
      ) as HTMLButtonElement | null;
      expect(firstTile).not.toBeNull();
      firstTile!.click();
      await flush(30);
      expect(dom.window.document.querySelector("dialog")).not.toBeNull();
      expect(historyBackCalls).toBe(0);
      cleanup();
      await flush(5);
      expect(historyBackCalls).toBe(1);
    } finally {
      dom.window.history.back = originalBack;
    }
  });

  test("AdminPage: unauthenticated renders the redirect guard (null), no crash", async () => {
    const Admin = (await import("../pages/admin")).default;
    const { host, cleanup } = await mount(createElement(Admin));
    expect(host.innerHTML).toBe(""); // designed: guard returns null and redirects
    cleanup();
  });

  test("Admin demo reuses the full admin and shows the permanent experience banner", async () => {
    dom.reconfigure({ url: "https://akieguchi.com/admin/demo" });
    dom.window.localStorage.clear();
    try {
      const Demo = (await import("../pages/admin-demo")).default;
      const { host, cleanup } = await mount(createElement(Demo), seedAdminPhotos);
      await waitForText(host, "これは体験版です");
      expect(host.querySelector("[data-admin-demo-banner]")).not.toBeNull();
      expect(host.textContent).toContain("Library");
      cleanup();
    } finally {
      dom.reconfigure({ url: "http://localhost/" });
      dom.window.localStorage.clear();
    }
  });

  test("Admin demo keeps its open tab out of the real admin's storage key", async () => {
    // デモと本番は同一オリジンなので localStorage を共有する。同じキーだと、
    // 購入検討者がデモで開いたタブがオーナーの本番管理画面の開始タブを
    // 書き換えてしまう (2026-08-04 に Codex の read-only レビューで発見)。
    dom.reconfigure({ url: "https://akieguchi.com/admin/demo" });
    dom.window.localStorage.clear();
    dom.window.localStorage.setItem("admin:tab", JSON.stringify("settings"));
    try {
      const Demo = (await import("../pages/admin-demo")).default;
      const { host, cleanup } = await mount(createElement(Demo), seedAdminPhotos);
      await waitForText(host, "これは体験版です");
      // デモは専用キーへ保存する。本番用キーは読みも書きもしない。
      expect(dom.window.localStorage.getItem("admin:tab:demo")).not.toBeNull();
      expect(dom.window.localStorage.getItem("admin:tab")).toBe(
        JSON.stringify("settings"),
      );
      cleanup();
    } finally {
      dom.reconfigure({ url: "http://localhost/" });
      dom.window.localStorage.clear();
    }
  });

  test("Admin demo renders its banner, guide, purchase route, and save notice in EN", async () => {
    dom.reconfigure({ url: "https://akieguchi.com/admin/demo" });
    dom.window.localStorage.clear();
    const { ADMIN_LANGUAGE_STORAGE_KEY } =
      await import("../pages/admin-i18n");
    dom.window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, "en");
    try {
      const Demo = (await import("../pages/admin-demo")).default;
      const { ADMIN_DEMO_WRITE_EVENT } =
        await import("../lib/admin-demo-fetch");
      const { host, cleanup } = await mount(createElement(Demo), seedAdminPhotos);
      await waitForText(host, "This is a demo");
      expect(host.textContent).toContain("Start with these three steps");
      expect(host.textContent).toContain("Change a photo layout in Gallery");
      expect(host.textContent).toContain("Start exploring");
      expect(host.textContent).toContain("Start over");
      expect(
        host
          .querySelector('[data-admin-demo-banner] a')
          ?.getAttribute("href"),
      ).toBe("/portfolio-kit/en#pricing");
      expect(
        (host.querySelector(".admin-atelier") as HTMLElement).style.paddingTop,
      ).toContain("--admin-demo-banner-height");
      const guide = host.querySelector(
        "[data-admin-demo-guide]",
      ) as HTMLDialogElement;
      expect(guide.hasAttribute("open")).toBe(true);
      expect(guide.contains(dom.window.document.activeElement)).toBe(true);
      guide.dispatchEvent(
        new dom.window.Event("cancel", { cancelable: true }),
      );
      await flush(30);
      expect(host.querySelector("[data-admin-demo-guide]")).toBeNull();

      dom.window.dispatchEvent(new dom.window.Event(ADMIN_DEMO_WRITE_EVENT));
      await waitForText(host, "Applied on this screen only");
      expect(host.textContent).toContain("Nothing was saved");
      cleanup();
    } finally {
      dom.reconfigure({ url: "http://localhost/" });
      dom.window.localStorage.clear();
    }
  });

  test("Admin demo is a 404-equivalent on distribution hosts", async () => {
    dom.reconfigure({ url: "https://portfolio.example/admin/demo" });
    try {
      const Demo = (await import("../pages/admin-demo")).default;
      const { host, cleanup } = await mount(createElement(Demo));
      expect(host.textContent).toContain("404");
      expect(host.querySelector("[data-admin-demo-banner]")).toBeNull();
      cleanup();
    } finally {
      dom.reconfigure({ url: "http://localhost/" });
    }
  });

  test("AdminPage: authenticated mounts the full admin UI", async () => {
    const prev = canned["/api/admin/me"];
    const prevSettings = canned["/api/settings"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/settings"] = { siteNameEn: "Template Studio" };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );
      expect(host.textContent).toContain("Template Studio");
      expect(host.textContent).not.toContain("Aki Eguchi");
      expect(host.textContent).toContain("写真");
      expect(host.textContent).toContain("見せ方");
      expect(host.textContent).toContain("サイト");
      expect(host.textContent).toContain("Library");
      expect(host.textContent).toContain("取り込む");
      // Digital/Film は Import 設定 — 絞り込みと誤読されない明札付きグループ
      expect(
        host.querySelector('fieldset[aria-label="取り込み媒体"]'),
      ).not.toBeNull();
      expect(host.textContent).toContain("デジタル");
      expect(host.textContent).toContain("フィルム");
      expect(host.textContent).toContain("絞り込み");
      // Workspace仕様: 検索は主要操作として常時表示し、詳細条件だけを展開する。
      expect(
        host.querySelector('input[aria-label="写真を検索"]'),
      ).not.toBeNull();
      expect(
        host
          .querySelector("[data-library-filters-toggle]")
          ?.getAttribute("aria-expanded"),
      ).toBe("false");
      expect(host.textContent).toContain("3 / 3 枚");
      // 未入力バッジは通常表示ではタイルに載せない（写真が主役）
      expect(host.querySelector('[aria-label^="未入力:"]')).toBeNull();

      buttonWithText(host, "絞り込み").click();
      await flush(30);
      expect(
        host
          .querySelector("[data-library-filters-toggle]")
          ?.getAttribute("aria-expanded"),
      ).toBe("true");
      expect(host.textContent).toContain("撮影日なし");
      expect(host.textContent).toContain("機材なし");
      expect(host.textContent).toContain("公開のみ");
      expect(host.textContent).toContain("縦写真");
      expect(host.textContent).toContain("すべての媒体");

      // 機材なし絞り込みを有効にした時だけ、該当タイルにバッジが出る
      buttonWithText(host, "機材なし (").click();
      await flush(30);
      const hygieneBadge = host.querySelector('[aria-label^="未入力:"]');
      expect(hygieneBadge).not.toBeNull();
      expect(hygieneBadge!.getAttribute("aria-label")).toContain("機材なし");
      expect(hygieneBadge!.getAttribute("aria-label")).not.toContain(
        "日付なし",
      );
      buttonWithText(host, "機材なし (").click();
      await flush(30);
      expect(host.querySelector('[aria-label^="未入力:"]')).toBeNull();
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      canned["/api/settings"] = prevSettings;
      dom.window.sessionStorage.clear(); // don't leak persisted tab/sort into other tests
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: EN localStorage translates the shared shell, headers, and unsaved UI", async () => {
    const prev = canned["/api/admin/me"];
    const prevSettings = canned["/api/settings"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/settings"] = {
      setupCompleted: "true",
      siteNameEn: "Template Studio",
      servicePageMode: "on",
    };
    const { ADMIN_LANGUAGE_STORAGE_KEY } =
      await import("../pages/admin-i18n");
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    dom.window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, "en");
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );
      expect(host.textContent).toContain("Photos");
      expect(host.textContent).toContain("Presentation");
      expect(host.textContent).toContain("Getting started");
      expect(host.textContent).toContain("View on site");
      expect(
        host.querySelector('[data-admin-language-toggle][data-language="en"]'),
      ).not.toBeNull();

      navGroup(host, "Site").click();
      await flush(30);
      sheetRow(host, "Profile").click();
      await waitForText(
        host,
        "Your biography and profile photo shown on the About page.",
      );
      changeInput(inputByLabel(host, "Name (JP)"), "Draft Name");
      await waitForText(host, "You have unsaved changes");
      expect(host.textContent).toContain("Discard");
      expect(host.textContent).toContain("Save");

      navGroup(host, "Presentation").click();
      await flush(30);
      sheetRow(host, "Hero").click();
      await waitForText(host, "Your changes have not been saved");
      expect(host.textContent).toContain("Cancel");
      expect(host.textContent).toContain("Leave without saving");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      canned["/api/settings"] = prevSettings;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: EN translates Phase 2b Library filters, metadata, and bulk edit", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevCategories = canned["/api/categories"];
    const prevSeries = canned["/api/admin/series"];
    const prevHero = canned["/api/admin/hero-photos"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/categories"] = {
      categories: [
        { id: 1, slug: "snap", label: "Street Work", sortOrder: 0 },
        { id: 2, slug: "portrait", label: "Portraits", sortOrder: 1 },
      ],
    };
    canned["/api/admin/series"] = {
      series: [
        {
          id: 3,
          slug: "indigo",
          title: "Indigo Days",
          subtitle: "",
          statement: "",
          coverPhotoId: 2,
          sortOrder: 0,
          isPublished: true,
        },
      ],
    };
    canned["/api/admin/hero-photos"] = { heroPhotos: [] };
    const { ADMIN_LANGUAGE_STORAGE_KEY } =
      await import("../pages/admin-i18n");
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    dom.window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, "en");
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      await waitForText(host, "Filters");
      expect(
        host.querySelector('select[aria-label="Sort Library view"]'),
      ).not.toBeNull();
      expect(
        host.querySelector('fieldset[aria-label="Import medium"]'),
      ).not.toBeNull();
      expect(host.textContent).toContain("Import as");
      expect(host.textContent).toContain("Digital");
      expect(host.textContent).toContain("Film");

      buttonWithText(host, "Filters").click();
      await flush(30);
      expect(
        host.querySelector('input[aria-label="Search photos"]'),
      ).not.toBeNull();
      expect(host.textContent).toContain("No date taken");
      expect(host.textContent).toContain("Publication: All");
      expect(host.textContent).toContain("Portrait");

      const tile = host.querySelector(
        ".admin-photo-tile > button",
      ) as HTMLButtonElement | null;
      expect(tile).not.toBeNull();
      tile!.click();
      await waitForText(host, "Focal point");
      expect(host.textContent).toContain("Date taken");
      expect(host.textContent).toContain("Duplicate this photo");
      expect(host.textContent).toContain("Move photo to Trash");

      // モード分離(2026-07-23承認)後、一括編集は選択モードで1枚以上選んでから出る。
      modeAction(host, "select").click();
      await flush(30);
      (
        host.querySelector(".admin-photo-tile > button") as HTMLButtonElement
      ).click();
      await flush(30);
      buttonWithText(host, "Bulk edit").click();
      await waitForText(host, "Bulk metadata edit");
      expect(host.textContent).toContain("Leave unchanged");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      canned["/api/categories"] = prevCategories;
      if (prevSeries === undefined) delete canned["/api/admin/series"];
      else canned["/api/admin/series"] = prevSeries;
      if (prevHero === undefined) delete canned["/api/admin/hero-photos"];
      else canned["/api/admin/hero-photos"] = prevHero;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("CategoriesTab and SeriesTab render their Phase 2b controls in EN", async () => {
    const prevCategories = canned["/api/categories"];
    const prevSeries = canned["/api/admin/series"];
    canned["/api/categories"] = {
      categories: [
        { id: 1, slug: "portrait", label: "Portraits", sortOrder: 0 },
      ],
    };
    canned["/api/admin/series"] = {
      series: [
        {
          id: 3,
          slug: "indigo",
          title: "Indigo Days",
          subtitle: "",
          statement: "",
          coverPhotoId: 2,
          sortOrder: 0,
          isPublished: true,
          themeConfig: "",
        },
      ],
    };
    const { ADMIN_LANGUAGE_STORAGE_KEY, AdminLanguageProvider } =
      await import("../pages/admin-i18n");
    const { CategoriesTab, SeriesTab } =
      await import("../pages/admin-tabs");
    dom.window.localStorage.clear();
    dom.window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, "en");
    try {
      const categories = await mount(
        createElement(
          AdminLanguageProvider,
          null,
          createElement(CategoriesTab),
        ),
      );
      await waitForText(categories.host, "Used as Gallery filters");
      expect(categories.host.textContent).toContain("New Category");
      expect(
        categories.host.querySelector('input[aria-label="Category name"]'),
      ).not.toBeNull();
      expect(
        categories.host.querySelector('button[aria-label="Move up"]'),
      ).not.toBeNull();
      categories.cleanup();

      const series = await mount(
        createElement(
          AdminLanguageProvider,
          null,
          createElement(SeriesTab),
        ),
      );
      await waitForText(series.host, "1 photo · Cover: B");
      expect(series.host.textContent).toContain("Published");
      expect(series.host.textContent).toContain("New Series");
      const edit = series.host.querySelector(
        'button[aria-label="Edit"]',
      ) as HTMLButtonElement | null;
      expect(edit).not.toBeNull();
      edit!.click();
      await waitForText(series.host, "Layout & Theme");
      expect(series.host.textContent).toContain("Cover Photo");
      expect(series.host.textContent).toContain("Photo order");
      expect(series.host.textContent).toContain("Background color");
      expect(series.host.textContent).toContain("Aspect-ratio grid");
      series.cleanup();
    } finally {
      canned["/api/categories"] = prevCategories;
      if (prevSeries === undefined) delete canned["/api/admin/series"];
      else canned["/api/admin/series"] = prevSeries;
      dom.window.localStorage.clear();
    }
  });

  // 読込中の「偽のゼロ」防止: 写真クエリ解決前に 0 / 0 photos・0 枚 と断定表示しない
  test("AdminPage: Library header shows … (not 0 / 0) while photos are loading", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const path = new URL(raw, "http://localhost/").pathname;
      if (path === "/api/photos") return new Promise<Response>(() => {});
      return origFetch(input);
    }) as typeof fetch;
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin));
      expect(host.textContent).toContain("… 枚");
      expect(host.textContent).not.toContain("0 / 0 枚");
      cleanup();
    } finally {
      globalThis.fetch = origFetch;
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  // 回帰(2026-07-12): Library仮想グリッドのタイル画像はeager固定。lazyへ戻すと
  // 高速スワイプ中のremountでキャッシュ済みサムネイルまで白抜けする強いチラつきが
  // 再発する(マウント数は仮想化が既に可視+overscanへ絞っており、eagerでも
  // 読込対象はその範囲に留まる)。scratch/flicker-repro.mjs で実測済み。
  test("AdminPage: Library tile images load eagerly (virtualized grid must not use lazy)", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevPhotos = canned["/api/photos"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/photos"] = { photos: samplePhotos };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      const tileImages = Array.from(
        host.querySelectorAll(".admin-photo-tile img"),
      );
      expect(tileImages.length).toBeGreaterThan(0);
      for (const img of tileImages) {
        expect(img.getAttribute("loading")).toBe("eager");
      }
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      canned["/api/photos"] = prevPhotos;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  // 写真クエリが解決するまで「0 枚」と断定しないことが要点。
  // 2026-07-31 の刷新で、読み込み中は行の説明文そのものを出さないようにした
  // (意味のない "…" を置かない — admin-renewal-goal.md 到達点(7))。
  test("SeriesTab: 写真の読み込み中に 0 枚と断定しない", async () => {
    const prevSeries = canned["/api/admin/series"];
    canned["/api/admin/series"] = {
      series: [
        {
          id: 1,
          slug: "still-life",
          title: "Still life",
          subtitle: "",
          statement: "",
          coverPhotoId: 9999,
          sortOrder: 0,
          isPublished: true,
        },
      ],
    };
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const path = new URL(raw, "http://localhost/").pathname;
      if (path === "/api/photos") return new Promise<Response>(() => {});
      return origFetch(input);
    }) as typeof fetch;
    try {
      const { SeriesTab } = await import("../pages/admin-tabs");
      const { host, cleanup } = await mount(createElement(SeriesTab));
      await waitForText(host, "Still life");
      expect(host.textContent).not.toContain("0 枚");
      expect(host.textContent).not.toContain("#9999");
      cleanup();
    } finally {
      globalThis.fetch = origFetch;
      canned["/api/admin/series"] = prevSeries;
    }
  });

  test("SeriesTab: dangling cover photo is explained in words, not a bare #id", async () => {
    const prevSeries = canned["/api/admin/series"];
    canned["/api/admin/series"] = {
      series: [
        {
          id: 1,
          slug: "still-life",
          title: "Still life",
          subtitle: "",
          statement: "",
          coverPhotoId: 9999, // canned photos に存在しない = 削除済み
          sortOrder: 0,
          isPublished: true,
        },
      ],
    };
    try {
      const { SeriesTab } = await import("../pages/admin-tabs");
      const { host, cleanup } = await mount(createElement(SeriesTab));
      await waitForText(host, "枚");
      expect(host.textContent).toContain("表紙: 元の写真は削除済み");
      expect(host.textContent).not.toContain("#9999");
      cleanup();
    } finally {
      canned["/api/admin/series"] = prevSeries;
    }
  });

  // Library のサイトプレビュー: 並べ替え/S/M/L の結果をその場で誌面確認できる
  test("AdminPage: Library site preview opens, switches pages and closes", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );
      expect(host.querySelector('iframe[title="サイトプレビュー"]')).toBeNull();

      buttonWithText(host, "サイトで確認").click();
      await flush(30);
      const iframe = host.querySelector(
        'iframe[title="サイトプレビュー"]',
      ) as HTMLIFrameElement | null;
      expect(iframe).not.toBeNull();
      expect(iframe!.getAttribute("src")).toBe("/gallery");

      buttonWithText(host, "トップ").click();
      await flush(30);
      expect(
        host
          .querySelector('iframe[title="サイトプレビュー"]')!
          .getAttribute("src"),
      ).toBe("/");

      (
        host.querySelector(
          'button[aria-label="プレビューを閉じる"]',
        ) as HTMLButtonElement
      ).click();
      await flush(30);
      expect(host.querySelector('iframe[title="サイトプレビュー"]')).toBeNull();
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: Library keeps filters collapsed and shows batch actions only after selection", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );
      expect(
        host.querySelector('input[aria-label="写真を検索"]'),
      ).not.toBeNull();
      expect(
        host
          .querySelector("[data-library-filters-toggle]")
          ?.getAttribute("aria-expanded"),
      ).toBe("false");
      expect(host.textContent).not.toContain("選択中 1枚");

      // モード分離(2026-07-23承認)後: 通常モードのタイルクリックは詳細を開くだけで、
      // 選択にも一括操作にも入らない。一括操作は選択モードに入ってから出る。
      const firstTile = host.querySelector(
        'button[aria-label="A"]',
      ) as HTMLButtonElement | null;
      expect(firstTile).not.toBeNull();
      firstTile!.click();
      await flush(30);
      expect(host.textContent).not.toContain("選択中 1枚");
      expect(host.textContent).not.toContain("一括編集");

      modeAction(host, "select").click();
      await flush(30);
      const tileInSelectMode = host.querySelector(
        'button[aria-label="A"]',
      ) as HTMLButtonElement | null;
      expect(tileInSelectMode).not.toBeNull();
      tileInSelectMode!.click();
      await flush(30);
      expect(host.textContent).toContain("選択中 1枚");
      expect(host.textContent).toContain("公開");
      expect(host.textContent).toContain("Heroに追加");
      expect(host.textContent).toContain("Heroから外す");
      expect(host.textContent).toContain("一括編集");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: grouped navigation reaches every tab within two clicks", async () => {
    const prev = canned["/api/admin/me"];
    const prevSettings = canned["/api/settings"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/settings"] = {
      ...(prevSettings as Record<string, unknown>),
      servicePageMode: "on",
    };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );

      expect(host.textContent).toContain("Library");

      navGroup(host, "見せ方").click();
      await flush(30);
      sheetRow(host, "Hero").click();
      await waitForText(host, "トップページの写真");

      navGroup(host, "見せ方").click();
      await flush(30);
      sheetRow(host, "Series").click();
      await waitForText(host, "新しいシリーズ");

      navGroup(host, "見せ方").click();
      await flush(30);
      sheetRow(host, "Categories").click();
      await waitForText(host, "新しいカテゴリ");

      navGroup(host, "サイト").click();
      await flush(30);
      sheetRow(host, "Profile").click();
      await waitForText(host, "プロフィール写真（Aboutページ）");

      navGroup(host, "サイト").click();
      await flush(30);
      sheetRow(host, "Pricing").click();
      await waitForText(host, "プランを追加");
      expect(host.textContent).toContain("Contactページに表示される料金です");

      buttonWithText(host, "Portfolio Kit").click();
      await waitForText(host, "/portfolio-kit 販売ページの内容を編集します");
      buttonWithText(host, "料金").click();
      await waitForText(host, "/portfolio-kit 販売ページの料金です");

      buttonWithText(host, "Settings").click();
      await waitForText(host, "プレビューを開く");
      // 設定の本文は目次で選んだ1節だけを出す（2026-07-30）。
      (
        host.querySelector(
          '[data-settings-section-link="portfolio-kit"]',
        ) as HTMLButtonElement
      ).click();
      await flush(40);
      const serviceModeSelect = host.querySelector(
        'select[aria-label="Portfolio Kitの表示"]',
      ) as HTMLSelectElement | null;
      expect(serviceModeSelect).not.toBeNull();
      expect(
        Array.from(serviceModeSelect!.options).map((option) => option.value),
      ).toEqual(["", "on", "off"]);

      buttonWithText(host, "はじめに").click();
      await waitForText(host, "公開までにやること");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      canned["/api/settings"] = prevSettings;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: unsaved guard appears when switching groups", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );

      navGroup(host, "サイト").click();
      await flush(30);
      sheetRow(host, "Profile").click();
      await waitForText(host, "プロフィール写真（Aboutページ）");
      const nameInput = inputByLabel(host, "名前（日本語）");
      changeInput(nameInput, "Draft Name");
      await flush(80);

      navGroup(host, "見せ方").click();
      await flush(30);
      sheetRow(host, "Hero").click();
      await flush(80);
      expect(host.textContent).toContain("未保存の変更があります");
      expect(host.textContent).toContain(
        "保存していない内容があります。このまま移動しますか？",
      );
      expect(host.textContent).toContain("プロフィール写真（Aboutページ）");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: photo detail edits warn before switching groups", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      const tile = await waitForButton(host, 'button[aria-label="A"]');
      tile.click();
      await flush(60);

      changeInput(inputByLabel(host, "タイトル"), "Unsaved photo title");
      await flush(80);
      navGroup(host, "見せ方").click();
      await flush(30);
      sheetRow(host, "Hero").click();
      await flush(80);

      expect(host.textContent).toContain("未保存の変更があります");
      expect(host.textContent).toContain(
        "保存していない内容があります。このまま移動しますか？",
      );
      expect(host.textContent).toContain("Library");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: saved photo detail edits do not warn before switching groups", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevPhoto = canned["/api/admin/photos/1"];
    const prevSettings = canned["/api/admin/settings"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/admin/photos/1"] = { ok: true };
    canned["/api/admin/settings"] = { ok: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      const tile = await waitForButton(host, 'button[aria-label="A"]');
      tile.click();
      await flush(60);

      changeInput(inputByLabel(host, "タイトル"), "Saved photo title");
      await flush(80);
      buttonWithText(host, "保存").click();
      await waitForText(host, "保存しました");

      navGroup(host, "見せ方").click();
      await flush(30);
      sheetRow(host, "Hero").click();
      await waitForText(host, "トップページの写真");
      expect(host.textContent).not.toContain("未保存の変更があります");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      if (prevPhoto === undefined) delete canned["/api/admin/photos/1"];
      else canned["/api/admin/photos/1"] = prevPhoto;
      if (prevSettings === undefined) delete canned["/api/admin/settings"];
      else canned["/api/admin/settings"] = prevSettings;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  // 2026-07-11: Inspector の × は未保存編集を無言で破棄しない(背景タップ
  // 保護と一貫)。未編集なら即閉じ、未保存なら confirmDialog を通す。
  test("AdminPage: inspector × closes immediately when clean, confirms when dirty", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      const inspectorClose = () =>
        host.querySelector(
          "button[data-library-inspector-close]",
        ) as HTMLButtonElement | null;

      // 未編集: × は直ちに閉じる(確認なし)
      const tile = await waitForButton(host, 'button[aria-label="A"]');
      tile.click();
      await flush(60);
      expect(host.textContent).toContain("写真を編集");
      inspectorClose()!.click();
      await flush(60);
      expect(host.textContent).not.toContain("写真を編集");
      expect(host.textContent).not.toContain("保存せずに閉じますか");

      // 未保存の編集あり: × で確認が出て、キャンセルなら編集を続けられる
      tile.click();
      await flush(60);
      changeInput(inputByLabel(host, "タイトル"), "Dirty close title");
      await flush(80);
      inspectorClose()!.click();
      await flush(60);
      expect(host.textContent).toContain(
        "保存していない編集があります。保存せずに閉じますか？",
      );
      expect(host.textContent).toContain("写真を編集");
      buttonWithText(host, "キャンセル").click();
      await flush(60);
      expect(host.textContent).not.toContain("保存せずに閉じますか");
      expect(host.textContent).toContain("写真を編集");
      expect((inputByLabel(host, "タイトル") as HTMLInputElement).value).toBe(
        "Dirty close title",
      );

      // 「保存せず閉じる」を選ぶと閉じる
      inspectorClose()!.click();
      await flush(60);
      buttonWithText(host, "保存せず閉じる").click();
      await flush(60);
      expect(host.textContent).not.toContain("写真を編集");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  // 2026-07-30: 古い確認ダイアログの後始末が、新しく開いた確認ダイアログを
  // 閉じてしまう不具合の回帰防止。
  //
  // 実測(Playwright): × を押すと2つ目の確認が DOM に追加された約40ms後に消え、
  // 詳細欄は開いたまま何も起きなかった。原因は Modal の退場アニメーション用
  // setTimeout(…, 160) が unmount 後も生き残り、発火時に onCloseRef.current() を
  // 呼んで「その時点で開いているダイアログ」を閉じていたこと。
  // 修正は (1) unmount でタイマーを取り消す (2) 世代番号が一致するときだけ
  // state を消す、の二段構え。ここでは 160ms を必ず越えて待ってから確認する。
  test("AdminPage: stale modal cleanup does not close a newly opened confirm", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      const inspectorClose = () =>
        host.querySelector(
          "button[data-library-inspector-close]",
        ) as HTMLButtonElement | null;
      const confirmShown = () =>
        host.textContent?.includes("保存していない編集があります") ?? false;

      const tile = await waitForButton(host, 'button[aria-label="A"]');
      tile.click();
      await flush(60);
      changeInput(inputByLabel(host, "タイトル"), "Stale cleanup fixture");
      await flush(80);

      // 1回目の確認を出し、背景クリック（= requestClose、160msタイマーが走る）
      inspectorClose()!.click();
      await flush(40);
      expect(confirmShown()).toBe(true);
      const dialog = host.querySelector("dialog");
      expect(dialog).not.toBeNull();
      dialog!.dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }),
      );
      // タイマーが発火する前にキャンセルで即閉じる
      buttonWithText(host, "キャンセル").click();
      await flush(20);
      expect(confirmShown()).toBe(false);

      // すぐに2つ目の確認を開く
      inspectorClose()!.click();
      await flush(20);
      expect(confirmShown()).toBe(true);

      // 160ms を十分に越えて待っても、2つ目が残っていること。
      // 修正前はここで古いタイマーが発火し、確認が消えて詳細欄だけが残った。
      await flush(400);
      expect(
        confirmShown(),
        "古いダイアログの後始末が新しい確認を閉じた",
      ).toBe(true);
      expect(host.textContent).toContain("写真を編集");

      // 2つ目の確認は正常に機能する
      buttonWithText(host, "保存せず閉じる").click();
      await flush(60);
      expect(host.textContent).not.toContain("写真を編集");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  // 2026-07-30: Escape（native cancel）と背景クリックで閉じた直後に次を開いても
  // 消えないこと、および閉じたあとフォーカスが opener（×ボタン）へ戻ること。
  test("AdminPage: confirm survives reopen after Escape / backdrop close, focus returns", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      const inspectorClose = () =>
        host.querySelector(
          "button[data-library-inspector-close]",
        ) as HTMLButtonElement | null;
      const confirmShown = () =>
        host.textContent?.includes("保存していない編集があります") ?? false;

      const tile = await waitForButton(host, 'button[aria-label="A"]');
      tile.click();
      await flush(60);
      changeInput(inputByLabel(host, "タイトル"), "Escape/backdrop fixture");
      await flush(80);

      // --- Escape（native cancel）で閉じる → 直後に2つ目を開く
      inspectorClose()!.click();
      await flush(40);
      expect(confirmShown()).toBe(true);
      host
        .querySelector("dialog")!
        .dispatchEvent(new dom.window.Event("cancel", { cancelable: true }));
      await flush(20);
      inspectorClose()!.click();
      await flush(20);
      expect(confirmShown()).toBe(true);
      await flush(400);
      expect(confirmShown(), "Escape後の残存処理が新しい確認を閉じた").toBe(true);

      // --- 背景クリックで閉じる → 直後に2つ目を開く
      host
        .querySelector("dialog")!
        .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      await flush(20);
      inspectorClose()!.click();
      await flush(20);
      expect(confirmShown()).toBe(true);
      await flush(400);
      expect(confirmShown(), "背景クリック後の残存処理が新しい確認を閉じた").toBe(
        true,
      );

      // --- 閉じたあとフォーカスが opener（×ボタン）へ戻る。
      // jsdom の click() は実ブラウザと違ってフォーカスを移さないため、
      // 実クリック相当になるよう先に focus() してから開く。
      buttonWithText(host, "キャンセル").click();
      await flush(60);
      expect(confirmShown()).toBe(false);
      const closeBtn = inspectorClose()!;
      closeBtn.focus();
      expect(dom.window.document.activeElement).toBe(closeBtn);
      closeBtn.click();
      await flush(40);
      expect(confirmShown()).toBe(true);
      buttonWithText(host, "キャンセル").click();
      await flush(80);
      expect(
        dom.window.document.activeElement,
        "確認を閉じたあとフォーカスが opener（×ボタン）へ戻らない",
      ).toBe(closeBtn);

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  // 2026-07-30: Modal は確認ダイアログ以外にも使われる（一括編集など）。
  // タイマー取り消しの修正が、別用途の Modal の開閉を壊していないこと。
  test("AdminPage: another Modal (bulk edit) still opens and closes", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      // 選択モードへ入り、1枚選んで一括編集の Modal を開く
      const selectMode = host.querySelector(
        '[data-library-mode-action="select"]',
      ) as HTMLButtonElement | null;
      expect(selectMode, "選択モードの切替が見つからない").not.toBeNull();
      selectMode!.click();
      await flush(60);
      const tile = await waitForButton(host, 'button[aria-label="A"]');
      tile.click();
      await flush(60);
      const bulk = Array.from(host.querySelectorAll("button")).find((b) =>
        (b.textContent ?? "").includes("一括編集"),
      ) as HTMLButtonElement | undefined;
      if (bulk) {
        bulk.click();
        await flush(60);
        expect(host.querySelectorAll("dialog").length).toBeGreaterThan(0);
        // 背景クリックで閉じ、160ms を越えても再度開ける
        host
          .querySelector("dialog")!
          .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
        await flush(400);
        expect(host.querySelectorAll("dialog").length).toBe(0);
        bulk.click();
        await flush(60);
        expect(
          host.querySelectorAll("dialog").length,
          "別用途 Modal を再度開けない",
        ).toBeGreaterThan(0);
      }
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  // 2026-07-30: 確認 → 実行 → 直後にもう一度確認、を繰り返しても state が残らない。
  test("AdminPage: confirm dialog can be reopened repeatedly without stale state", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      const inspectorClose = () =>
        host.querySelector(
          "button[data-library-inspector-close]",
        ) as HTMLButtonElement | null;
      const confirmShown = () =>
        host.textContent?.includes("保存していない編集があります") ?? false;

      for (let round = 0; round < 3; round += 1) {
        const tile = await waitForButton(host, 'button[aria-label="A"]');
        tile.click();
        await flush(60);
        changeInput(inputByLabel(host, "タイトル"), `round ${round}`);
        await flush(80);
        inspectorClose()!.click();
        await flush(20);
        expect(confirmShown(), `round ${round}: 確認が出ない`).toBe(true);
        buttonWithText(host, "キャンセル").click();
        await flush(20);
        expect(confirmShown()).toBe(false);
        inspectorClose()!.click();
        await flush(20);
        expect(confirmShown(), `round ${round}: 2回目の確認が出ない`).toBe(true);
        buttonWithText(host, "保存せず閉じる").click();
        await flush(60);
        expect(host.textContent).not.toContain("写真を編集");
      }
      // 全部閉じ切った後、残存タイマーで何かが起きないこと
      await flush(400);
      expect(host.querySelectorAll("dialog").length).toBe(0);

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  // 2026-07-11: ×/Escape 保護の拡張 — 未保存の下書きがある間、別写真への
  // 切替(矢印キー/タイルクリック)も無言で下書きを置き換えない。
  test("AdminPage: inspector photo switch confirms when dirty (arrow / tile click)", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      const pressArrowRight = async () => {
        dom.window.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", {
            key: "ArrowRight",
            bubbles: true,
          }),
        );
        await flush(60);
      };
      const titleInput = () => inputByLabel(host, "タイトル");

      // 下書きなし: ArrowRight は確認なしで次の写真(B)へ
      const tileA = await waitForButton(host, 'button[aria-label="A"]');
      tileA.click();
      await flush(60);
      expect(titleInput().value).toBe("A");
      await pressArrowRight();
      expect(titleInput().value).toBe("B");
      expect(host.textContent).not.toContain("別の写真へ移動しますか");

      // 下書きあり: ArrowRight で確認。キャンセル=写真・入力・選択を維持
      changeInput(titleInput(), "dirty-nav");
      await flush(80);
      await pressArrowRight();
      expect(host.textContent).toContain(
        "保存していない編集があります。保存せずに別の写真へ移動しますか？",
      );
      buttonWithText(host, "キャンセル").click();
      await flush(60);
      expect(titleInput().value).toBe("dirty-nav");
      expect(host.textContent).toContain("b.jpg"); // File Info = まだ B のまま
      // モード分離(2026-07-23承認)後、通常モードでの詳細移動は選択を伴わない。
      // 「選択が維持される」ではなく「選択に入っていない」ことを確認する。
      expect(host.textContent).not.toContain("選択中");

      // 破棄を明示した時だけ次の写真(C)へ移動する
      await pressArrowRight();
      buttonWithText(host, "保存せず移動").click();
      await flush(60);
      expect(host.textContent).toContain("c.jpg");
      expect(titleInput().value).toBe("");

      // タイルクリック入口も同じ3経路(下書きあり→確認→キャンセル→破棄)
      changeInput(titleInput(), "dirty-click");
      await flush(80);
      tileA.click();
      await flush(60);
      expect(host.textContent).toContain("保存せずに別の写真へ移動しますか？");
      buttonWithText(host, "キャンセル").click();
      await flush(60);
      expect(titleInput().value).toBe("dirty-click");
      expect(host.textContent).toContain("c.jpg");
      tileA.click();
      await flush(60);
      buttonWithText(host, "保存せず移動").click();
      await flush(60);
      expect(host.textContent).toContain("a.jpg");
      expect(titleInput().value).toBe("A");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: setup checklist jumps update the active group", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    dom.window.localStorage.setItem("admin:tab", JSON.stringify("setup"));
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );
      await waitForText(host, "公開までにやること");

      // 2026-07-20仕様変更: 名前は最短の必須導線から「あとで整える」へ
      // 移したが、Settingsへの移動ボタンは引き続き機能する。
      setupOpenButton(host, "サイトの名前と説明").click();
      await waitForText(host, "プレビューを開く");

      buttonWithText(host, "写真").click();
      await waitForText(host, "Library");

      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: virtualized keyboard navigation follows selection after resize", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevPhotos = canned["/api/photos"];
    const widthDescriptor = Object.getOwnPropertyDescriptor(
      dom.window.HTMLElement.prototype,
      "clientWidth",
    );
    const heightDescriptor = Object.getOwnPropertyDescriptor(
      dom.window.HTMLElement.prototype,
      "clientHeight",
    );
    let layoutWidth = 1200;
    Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return layoutWidth;
      },
    });
    Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 900;
      },
    });
    const largePhotos = makeLargeAdminPhotos();
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/photos"] = { photos: largePhotos };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), (qc) => {
        qc.setQueryData(["photos", "all"], { photos: largePhotos });
        seedCompletedSetup(qc);
      });
      // モード分離(2026-07-23承認)後、通常モードのタイルクリックは詳細を開く。
      // 詳細が開いたままだとグリッド幅が縮んで列数が変わり、↓の移動先計算が
      // 前提と食い違う。ここで見たいのは「カーソル移動に仮想ウィンドウが追従
      // するか」なので、カーソル(lastClicked)を置いた上で Esc で詳細を閉じ、
      // 通常モードのまま全幅で検証する。
      // キーボード移動をどのモードの道具とするかは未決定
      // (docs/specs/library-redesign-spec.md §5)。このテストはその判断を
      // 先取りせず、通常モードでの退行検知を保つ。
      const firstTile = await waitForButton(host, 'button[aria-label="P000"]');
      firstTile.click();
      await flush(20);
      dom.window.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        }),
      );
      await flush(30);
      const initialThumbs = Array.from(host.querySelectorAll("img"))
        .map((img) => img.getAttribute("src") ?? "")
        .filter((src) => src.includes("/api/images/thumbs/"));
      // Bounds below are computeVirtualGridWindow's exact output for the
      // current admin:thumbSize default (220px) + LIBRARY_GRID_GAP (8px) at
      // the widths this test drives — see computeVirtualGridWindow. Re-derive
      // these if the default thumbnail size changes again.
      expect(initialThumbs.length).toBeLessThanOrEqual(60);
      expect(initialThumbs.length).toBeGreaterThan(0);

      for (let i = 0; i < 74; i += 1) {
        dom.window.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
          }),
        );
        await flush(1);
      }
      await flush(40);
      // 5 columns at gridWidth=1200 (220px thumbs) — 74 × 5 = 370
      expect(host.querySelector('button[aria-label="P370"]')).not.toBeNull();

      layoutWidth = 900;
      dom.window.dispatchEvent(new dom.window.Event("resize"));
      await flush(40);
      dom.window.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "ArrowUp",
          bubbles: true,
        }),
      );
      await flush(40);
      // 3 columns at gridWidth=900 (220px thumbs) — 370 - 3 = 367
      expect(host.querySelector('button[aria-label="P367"]')).not.toBeNull();
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      canned["/api/photos"] = prevPhotos;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
      if (widthDescriptor) {
        Object.defineProperty(
          dom.window.HTMLElement.prototype,
          "clientWidth",
          widthDescriptor,
        );
      } else {
        delete (dom.window.HTMLElement.prototype as { clientWidth?: number })
          .clientWidth;
      }
      if (heightDescriptor) {
        Object.defineProperty(
          dom.window.HTMLElement.prototype,
          "clientHeight",
          heightDescriptor,
        );
      } else {
        delete (dom.window.HTMLElement.prototype as { clientHeight?: number })
          .clientHeight;
      }
    }
  }, 10000);

  test("AdminPage: 497 regular photos + 50 recently added photos renders 110 tiles", async () => {
    const prevPhotos = canned["/api/photos"];
    const widthDescriptor = Object.getOwnPropertyDescriptor(
      dom.window.HTMLElement.prototype,
      "clientWidth",
    );
    const heightDescriptor = Object.getOwnPropertyDescriptor(
      dom.window.HTMLElement.prototype,
      "clientHeight",
    );
    Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 1200;
      },
    });
    Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 900;
      },
    });
    const allPhotos = makeLargeAdminPhotos(547);
    const recentlyAddedPhotoIds = new Set(
      allPhotos.slice(497).map((photo) => photo.id),
    );
    canned["/api/photos"] = { photos: allPhotos };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const { GalleryTab } = await import("../pages/admin");
      const { host, cleanup } = await mount(
        createElement(GalleryTab, { recentlyAddedPhotoIds }),
        (qc) => {
          qc.setQueryData(["photos", "all"], { photos: allPhotos });
        },
      );
      await flush(50);

      const section = host.querySelector(
        "[data-library-recently-added-section]",
      );
      const grid = host.querySelector("[data-library-grid-mode]");
      expect(section).not.toBeNull();
      expect(
        section!.querySelectorAll(".admin-photo-tile").length,
      ).toBe(50);
      expect(grid?.getAttribute("data-virtualized")).toBe("true");
      expect(grid?.getAttribute("data-rendered-count")).toBe("110");
      expect(host.querySelectorAll(".admin-photo-tile").length).toBe(110);
      cleanup();
    } finally {
      canned["/api/photos"] = prevPhotos;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
      if (widthDescriptor) {
        Object.defineProperty(
          dom.window.HTMLElement.prototype,
          "clientWidth",
          widthDescriptor,
        );
      } else {
        delete (dom.window.HTMLElement.prototype as { clientWidth?: number })
          .clientWidth;
      }
      if (heightDescriptor) {
        Object.defineProperty(
          dom.window.HTMLElement.prototype,
          "clientHeight",
          heightDescriptor,
        );
      } else {
        delete (dom.window.HTMLElement.prototype as { clientHeight?: number })
          .clientHeight;
      }
    }
  }, 10000);

  test("AdminPage: inspector surfaces quick edit controls and usage", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevCategories = canned["/api/categories"];
    const prevSeries = canned["/api/admin/series"];
    const prevHero = canned["/api/admin/hero-photos"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/categories"] = {
      categories: [
        { slug: "snap", label: "Street Work", sortOrder: 0 },
        { slug: "portrait", label: "Portraits", sortOrder: 1 },
      ],
    };
    canned["/api/admin/series"] = {
      series: [
        {
          id: 3,
          slug: "indigo",
          title: "Indigo Days",
          subtitle: "",
          statement: "",
          coverPhotoId: 2,
          sortOrder: 0,
          isPublished: true,
        },
      ],
    };
    canned["/api/admin/hero-photos"] = {
      heroPhotos: [{ id: 10, photoId: 2, sortOrder: 0 }],
    };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      await flush(100);
      const tile = host.querySelector(
        'button[aria-label="B"]',
      ) as HTMLButtonElement | null;
      expect(tile).not.toBeNull();
      expect(
        host.querySelector('[aria-label="使用状況: Hero 1, Series, Size L"]'),
      ).not.toBeNull();
      tile!.click();
      await flush(60);

      expect(host.textContent).toContain("よく使う");
      expect(host.textContent).toContain("Hero 1");
      expect(host.textContent).toContain("Portraits");
      expect(host.textContent).toContain("Indigo Days");
      expect(host.textContent).toContain("サイズ L");
      expect(
        host.querySelector('[aria-label="写真の使用状況"]'),
      ).not.toBeNull();
      expect(
        host.querySelector('[aria-label="クイックカテゴリ"]'),
      ).not.toBeNull();
      expect(
        host.querySelector('[aria-label="クイックシリーズ"]'),
      ).not.toBeNull();
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      canned["/api/categories"] = prevCategories;
      if (prevSeries === undefined) delete canned["/api/admin/series"];
      else canned["/api/admin/series"] = prevSeries;
      if (prevHero === undefined) delete canned["/api/admin/hero-photos"];
      else canned["/api/admin/hero-photos"] = prevHero;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: library search matches category labels and series titles", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevCategories = canned["/api/categories"];
    const prevSeries = canned["/api/admin/series"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/categories"] = {
      categories: [
        { slug: "snap", label: "Street Work", sortOrder: 0 },
        { slug: "portrait", label: "Portraits", sortOrder: 1 },
      ],
    };
    canned["/api/admin/series"] = {
      series: [
        {
          id: 3,
          slug: "indigo",
          title: "Indigo Days",
          subtitle: "",
          statement: "",
          coverPhotoId: 2,
          sortOrder: 0,
          isPublished: true,
        },
      ],
    };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedEstablishedAdminSite,
      );
      const input = host.querySelector(
        'input[aria-label="写真を検索"]',
      ) as HTMLInputElement | null;
      expect(input).toBeDefined();
      if (!input) throw new Error("Search input was not rendered");
      const setSearch = async (value: string) => {
        const setter = Object.getOwnPropertyDescriptor(
          dom.window.HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(input, value);
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        // 件数表示は旧値を220msだけ残す入れ替え演出があるため、
        // 新しい現在値だけになってから判定する。
        await flush(260);
      };
      await setSearch("Street Work");
      expect(host.textContent).toContain("1 / 3 枚");
      expect(input.value).toBe("Street Work");
      expect(
        host
          .querySelector("[data-library-filters-toggle]")
          ?.classList.contains("is-active"),
      ).toBe(true);
      await setSearch("Indigo Days");
      expect(host.textContent).toContain("1 / 3 枚");
      await setSearch("No such classification");
      expect(host.textContent).toContain("0 / 3 枚");
      expect(host.textContent).toContain("条件に合う写真が見つかりません。");
      expect(host.textContent).toContain("絞り込みを解除");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      canned["/api/categories"] = prevCategories;
      if (prevSeries === undefined) delete canned["/api/admin/series"];
      else canned["/api/admin/series"] = prevSeries;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: invalid persisted tab falls back to Library", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    dom.window.localStorage.setItem("admin:tab", JSON.stringify("old-tab"));
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );
      await flush(30);
      expect(host.textContent).toContain("Library");
      expect(host.textContent).toContain("取り込む");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: stale persisted library filters fall back to all", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    dom.window.sessionStorage.setItem(
      "admin:filterCat",
      JSON.stringify("ghost"),
    );
    dom.window.sessionStorage.setItem("admin:filterSize", JSON.stringify("XL"));
    dom.window.sessionStorage.setItem(
      "admin:filterPublished",
      JSON.stringify("draft"),
    );
    dom.window.sessionStorage.setItem(
      "admin:filterMedium",
      JSON.stringify("slide"),
    );
    dom.window.sessionStorage.setItem(
      "admin:librarySort",
      JSON.stringify("random-old"),
    );
    dom.window.sessionStorage.setItem("admin:thumbSize", JSON.stringify(9999));
    dom.window.sessionStorage.setItem(
      "admin:uploadMedium",
      JSON.stringify("slide"),
    );
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );
      await flush(80);
      expect(host.textContent).toContain("Library");
      expect(dom.window.sessionStorage.getItem("admin:filterCat")).toBe(
        JSON.stringify("all"),
      );
      expect(dom.window.sessionStorage.getItem("admin:filterSize")).toBe(
        JSON.stringify("all"),
      );
      expect(dom.window.sessionStorage.getItem("admin:filterPublished")).toBe(
        JSON.stringify("all"),
      );
      expect(dom.window.sessionStorage.getItem("admin:filterMedium")).toBe(
        JSON.stringify("all"),
      );
      expect(dom.window.sessionStorage.getItem("admin:librarySort")).toBe(
        JSON.stringify("manual"),
      );
      expect(dom.window.sessionStorage.getItem("admin:thumbSize")).toBe(
        JSON.stringify(300),
      );
      expect(dom.window.sessionStorage.getItem("admin:uploadMedium")).toBe(
        JSON.stringify("digital"),
      );
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: smart album modal includes medium and missing metadata conditions", async () => {
    const prev = canned["/api/admin/me"];
    canned["/api/admin/me"] = { authenticated: true };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );
      buttonWithText(host, "絞り込み").click();
      await flush(30);
      const albumButton = Array.from(host.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("アルバム"),
      ) as HTMLButtonElement | undefined;
      expect(albumButton).toBeDefined();
      albumButton!.click();
      await flush(30);
      expect(dom.window.document.body.textContent).toContain("媒体");
      expect(dom.window.document.body.textContent).toContain("媒体なし");
      expect(dom.window.document.body.textContent).toContain("未入力");
      expect(dom.window.document.body.textContent).toContain("日付");
      expect(dom.window.document.body.textContent).toContain("機材");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prev;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage: saved smart albums show condition labels", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevSettings = canned["/api/settings"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/settings"] = {
      smartAlbums: JSON.stringify([
        {
          id: "review",
          name: "Needs review",
          cond: {
            medium: "film",
            missingShotAt: true,
            missingCapture: true,
            recent: "7",
          },
        },
      ]),
    };
    dom.window.sessionStorage.clear();
    dom.window.localStorage.clear();
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(
        createElement(Admin),
        seedAdminPhotos,
      );
      buttonWithText(host, "絞り込み").click();
      await flush(30);
      expect(host.textContent).toContain("Needs review");
      expect(host.textContent).toContain("フィルム");
      expect(host.textContent).toContain("撮影日なし");
      expect(host.textContent).toContain("機材なし");
      expect(host.textContent).toContain("+1");
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      canned["/api/settings"] = prevSettings;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminPage Hero tab ignores public hero cache shape", async () => {
    const prevAuth = canned["/api/admin/me"];
    const prevAdminHero = canned["/api/admin/hero-photos"];
    const prevPublicHero = canned["/api/hero-photos"];
    canned["/api/admin/me"] = { authenticated: true };
    canned["/api/admin/hero-photos"] = {
      heroPhotos: [{ photoId: 1, sortOrder: 0 }],
    };
    canned["/api/hero-photos"] = { heroPhotos: [samplePhotos[0]] };
    dom.window.localStorage.setItem("admin:tab", JSON.stringify("hero"));
    try {
      const Admin = (await import("../pages/admin")).default;
      const { host, cleanup } = await mount(createElement(Admin), (qc) =>
        qc.setQueryData(["hero-photos"], { heroPhotos: [samplePhotos[0]] }),
      );
      buttonWithText(host, "Hero").click();
      await flush(500);

      expect(host.textContent).toContain("トップページの写真");
      expect(host.textContent).not.toContain("削除済み");
      const heroSlide = host.querySelector("[data-hero-slide]");
      expect(heroSlide).not.toBeNull();
      expect(heroSlide!.querySelectorAll("button")).toHaveLength(1);
      expect(
        host.querySelector('button[aria-label="ヒーローから削除"]'),
      ).toBeNull();
      (heroSlide!.querySelector("button") as HTMLButtonElement).click();
      await flush(30);
      expect(
        host.querySelector('button[aria-label="ヒーローから削除"]'),
      ).not.toBeNull();
      cleanup();
    } finally {
      canned["/api/admin/me"] = prevAuth;
      if (prevAdminHero === undefined) delete canned["/api/admin/hero-photos"];
      else canned["/api/admin/hero-photos"] = prevAdminHero;
      canned["/api/hero-photos"] = prevPublicHero;
      dom.window.sessionStorage.clear();
      dom.window.localStorage.clear();
    }
  });

  test("AdminLogin marks admin auth fresh after successful login", async () => {
    const prev = canned["/api/admin/login"];
    canned["/api/admin/login"] = { ok: true };
    dom.window.localStorage.clear();
    try {
      const AdminLogin = (await import("../pages/admin-login")).default;
      const { qc, host, cleanup } = await mount(createElement(AdminLogin));
      qc.setQueryData(["admin-me"], { authenticated: false });

      const input = host.querySelector(
        'input[aria-label="パスワード"]',
      ) as HTMLInputElement | null;
      expect(input).not.toBeNull();
      input!.value = "correct-password";
      input!.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      const form = host.querySelector("form") as HTMLFormElement | null;
      expect(form).not.toBeNull();
      form!.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await flush(30);

      const authState = qc.getQueryData(["admin-me"]) as
        { authenticated: boolean } | undefined;
      expect(authState).toEqual({ authenticated: true });
      cleanup();
    } finally {
      if (prev === undefined) delete canned["/api/admin/login"];
      else canned["/api/admin/login"] = prev;
      dom.window.localStorage.clear();
    }
  });

  test("AdminLogin toggles to EN and restores the choice after remount", async () => {
    const { ADMIN_LANGUAGE_STORAGE_KEY } =
      await import("../pages/admin-i18n");
    dom.window.localStorage.clear();
    try {
      const AdminLogin = (await import("../pages/admin-login")).default;
      const first = await mount(createElement(AdminLogin));
      expect(first.host.querySelector('input[aria-label="パスワード"]')).not.toBeNull();
      buttonWithText(first.host, "EN").click();
      await flush(20);
      expect(first.host.querySelector('input[aria-label="Password"]')).not.toBeNull();
      expect(first.host.textContent).toContain("Sign in");
      expect(dom.window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY)).toBe(
        "en",
      );
      first.cleanup();

      const second = await mount(createElement(AdminLogin));
      expect(second.host.querySelector('input[aria-label="Password"]')).not.toBeNull();
      expect(
        second.host.querySelector(
          '[data-admin-language-toggle][data-language="en"]',
        ),
      ).not.toBeNull();
      second.cleanup();
    } finally {
      dom.window.localStorage.clear();
    }
  });

  test("Provider applies empty settings and survives a preview-settings message", async () => {
    const { Provider } = await import("../components/provider");
    const { qc, host, cleanup } = await mount(
      createElement(Provider, null, createElement("p", null, "child")),
    );
    expect(host.textContent).toContain("child");
    // Live-preview path (§0 3箇所同期の受信側): a settings payload with new keys
    // must never throw, even with empty / odd values.
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: {
          type: "preview-settings",
          settings: {
            themeBg: "#101010",
            siteName: "Preview Name",
            topWorksMode: "manual",
            topWorksIds: "1,2",
            topWorksColumns: "",
            gallerySizeScale: "1.4",
            heroNameSize: "48",
            bodyLeading: "",
          },
        },
      }),
    );
    await flush(10);
    expect(
      (qc.getQueryData(["settings"]) as Record<string, string>).siteName,
    ).toBe("Preview Name");
    expect(host.textContent).toContain("child");
    cleanup();
  });

  test("Provider preview message updates React-rendered site labels", async () => {
    const { Provider } = await import("../components/provider");
    const Layout = (await import("../components/Layout")).default;
    const { host, cleanup } = await mount(
      createElement(
        Provider,
        null,
        createElement(Layout, null, createElement("p", null, "child")),
      ),
    );
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: {
          type: "preview-settings",
          settings: {
            navLabelTop: "Preview Studio",
            navLabelGallery: "Portfolio",
            navLabelAbout: "Bio",
            navLabelContact: "Booking",
            footerText: "Preview Footer",
            footerCtaLabel: "Ask for a shoot",
            templateCreditLabel: "Template credit",
            templateCreditUrl: "https://example.com/template",
            servicePageMode: "on",
          },
        },
      }),
    );
    await flush(10);
    expect(host.textContent).toContain("Preview Studio");
    expect(host.textContent).toContain("Portfolio");
    expect(host.textContent).toContain("Bio");
    expect(host.textContent).toContain("Booking");
    expect(host.textContent).toContain("Ask for a shoot");
    expect(host.textContent).toContain("Preview Footer");
    const templateCredit = host.querySelector(
      'a[href="https://example.com/template"]',
    );
    expect(templateCredit?.textContent).toBe("Template credit");
    expect(templateCredit?.getAttribute("target")).toBe("_blank");
    expect(templateCredit?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(host.querySelector('a[href="/portfolio-kit"]')).not.toBeNull();

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: {
          type: "preview-settings",
          settings: {
            servicePageMode: "off",
            templateCreditUrl: "javascript:alert(1)",
          },
        },
      }),
    );
    await flush(10);
    expect(host.querySelector('a[href="/portfolio-kit"]')).toBeNull();
    expect(host.textContent).toContain("Template credit");
    expect(host.querySelector('a[href^="javascript:"]')).toBeNull();

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: {
          type: "preview-settings",
          settings: { templateCreditLabel: "" },
        },
      }),
    );
    await flush(10);
    expect(host.textContent).not.toContain("Template credit");
    cleanup();
  });

  test("Layout keeps Portfolio Kit out of nav unless mode is explicitly on", async () => {
    const { Provider } = await import("../components/provider");
    const Layout = (await import("../components/Layout")).default;
    const prevSettings = canned["/api/settings"];
    try {
      canned["/api/settings"] = {};
      const hidden = await mount(
        createElement(
          Provider,
          null,
          createElement(Layout, null, createElement("p", null, "child")),
        ),
      );
      expect(
        hidden.host.querySelector('a[href="/portfolio-kit"]'),
      ).toBeNull();
      hidden.cleanup();

      canned["/api/settings"] = { siteUrl: "https://akieguchi.com" };
      const ownerDefault = await mount(
        createElement(
          Provider,
          null,
          createElement(Layout, null, createElement("p", null, "child")),
        ),
      );
      expect(
        ownerDefault.host.querySelectorAll('a[href="/portfolio-kit"]').length,
      ).toBe(0);
      ownerDefault.cleanup();

      canned["/api/settings"] = {
        siteUrl: "https://portfolio.example",
        servicePageMode: "on",
      };
      const visible = await mount(
        createElement(
          Provider,
          null,
          createElement(Layout, null, createElement("p", null, "child")),
        ),
      );
      expect(
        visible.host.querySelectorAll('a[href="/portfolio-kit"]').length,
      ).toBeGreaterThan(0);
      expect(visible.host.textContent).toContain("Portfolio Kit");
      visible.cleanup();
    } finally {
      canned["/api/settings"] = prevSettings;
    }
  });

  test("DD grain: preview toggles body[data-texture], Layout must not paint over it", async () => {
    const { Provider } = await import("../components/provider");
    const Layout = (await import("../components/Layout")).default;
    const { host, cleanup } = await mount(
      createElement(
        Provider,
        null,
        createElement(Layout, null, createElement("p", null, "child")),
      ),
    );
    // Preview path: texture on → data attribute lights the styles.css ::before
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: {
          type: "preview-settings",
          settings: { bgTexture: "grain-fine", bgTextureOpacity: "0.08" },
        },
      }),
    );
    await flush(5);
    expect(dom.window.document.body.dataset.texture).toBe("grain-fine");
    // texture off → attribute removed (CSS default = no grain)
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: { type: "preview-settings", settings: { bgTexture: "none" } },
      }),
    );
    await flush(5);
    expect(dom.window.document.body.dataset.texture).toBeUndefined();
    // Dark themeBg → blend flips to `screen` (multiply is invisible on dark);
    // clearing themeBg → property removed (CSS default multiply for light bg).
    const rootStyle = dom.window.document.documentElement.style;
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: { type: "preview-settings", settings: { themeBg: "#111111" } },
      }),
    );
    await flush(5);
    expect(rootStyle.getPropertyValue("--bg-texture-blend")).toBe("screen");
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: { type: "preview-settings", settings: { themeBg: "" } },
      }),
    );
    await flush(5);
    expect(rootStyle.getPropertyValue("--bg-texture-blend")).toBe("");
    // A3: font weights flow through the preview path as CSS vars
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: {
          type: "preview-settings",
          settings: { heroNameWeight: "500", bodyWeight: "300" },
        },
      }),
    );
    await flush(5);
    expect(rootStyle.getPropertyValue("--hero-name-weight")).toBe("500");
    expect(rootStyle.getPropertyValue("--body-weight")).toBe("300");
    // photoRevealEffect: non-default variants set body[data-reveal]; fade/"" clear it
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: {
          type: "preview-settings",
          settings: { photoRevealEffect: "rise" },
        },
      }),
    );
    await flush(5);
    expect(dom.window.document.body.dataset.reveal).toBe("rise");
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin: dom.window.location.origin,
        data: {
          type: "preview-settings",
          settings: { photoRevealEffect: "fade" },
        },
      }),
    );
    await flush(5);
    expect(dom.window.document.body.dataset.reveal).toBeUndefined();
    // The grain lives on body::before at z-index:-1, which paints BELOW in-flow
    // block backgrounds. An opaque bg on Layout's full-screen wrapper hides it
    // entirely (the original bug) — the wrapper must stay background-free.
    const wrapper = host.querySelector('[class*="nav-pos-"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).not.toContain("bg-");
    cleanup();
  });

  test("A6 font pairings reference real font-map entries", async () => {
    // A typo (or a future font-map rename) would silently no-op the preset
    // button: provider falls back to system fonts and nothing errors.
    const { FONT_PAIRINGS, GOOGLE_FONTS_JA, GOOGLE_FONTS_EN } =
      await import("../components/provider");
    expect(FONT_PAIRINGS.length).toBeGreaterThanOrEqual(4);
    for (const p of FONT_PAIRINGS) {
      expect(GOOGLE_FONTS_JA[p.ja]).toBeDefined();
      expect(GOOGLE_FONTS_EN[p.en]).toBeDefined();
    }
  });

  test("PhotoGallery: empty photos renders null, missing settings keys fall back", async () => {
    const { PhotoGallery } = await import("../components/PhotoGallery");
    const empty = await mount(
      createElement(PhotoGallery, { photos: [], layoutType: "mosaic" }),
    );
    // photos=[] → component renders nothing, and must not crash.
    empty.cleanup();
    const noDims = await mount(
      createElement(PhotoGallery, {
        photos: [{ id: 9, url: "/api/images/photos/x.jpg", title: "" }],
        layoutType: "unknown-layout-value",
        variant: "top",
      }),
    );
    noDims.cleanup();
  });
});

describe("i18n Phase 3 slice 1: /en/about, /en/contact", () => {
  test("English ContactPage shows English copy instead of the Japanese placeholder", async () => {
    const ContactPage = (await import("../pages/contact")).default;
    const { host, cleanup } = await mount(
      createElement(ContactPage, { language: "en" }),
    );
    expect(host.textContent).toContain("Coming soon.");
    expect(host.textContent).not.toContain("準備中です。");
    cleanup();
  });

  test("Japanese ContactPage (default/no language prop) keeps the Japanese placeholder", async () => {
    const ContactPage = (await import("../pages/contact")).default;
    const { host, cleanup } = await mount(createElement(ContactPage));
    expect(host.textContent).toContain("準備中です。");
    expect(host.textContent).not.toContain("Coming soon.");
    cleanup();
  });

  test("English ContactPage shows an English pricing lead-in when plans are published", async () => {
    const prevPricing = canned["/api/pricing"];
    canned["/api/pricing"] = {
      plans: [
        {
          id: 1,
          title: "Shoot",
          price: "¥30,000",
          description: "",
          features: "",
          note: "",
        },
      ],
    };
    try {
      const ContactPage = (await import("../pages/contact")).default;
      const { host, cleanup } = await mount(
        createElement(ContactPage, { language: "en" }),
      );
      expect(host.textContent).toContain(
        "For inquiries or requests, please use the form below.",
      );
      expect(host.textContent).not.toContain(
        "ご依頼・ご相談は下記フォームよりお気軽にどうぞ。",
      );
      cleanup();
    } finally {
      canned["/api/pricing"] = prevPricing;
    }
  });

  test("Layout only shows the JP|EN switch on paired pages", async () => {
    const { Provider } = await import("../components/provider");
    const Layout = (await import("../components/Layout")).default;
    dom.reconfigure({ url: "http://localhost/gallery" });
    try {
      const { host, cleanup } = await mount(
        createElement(
          Provider,
          null,
          createElement(Layout, null, createElement("p", null, "child")),
        ),
      );
      expect(host.querySelector('a[href="/en/contact"]')).toBeNull();
      expect(host.querySelector('a[href="/en/about"]')).toBeNull();
      cleanup();
    } finally {
      dom.reconfigure({ url: "http://localhost/" });
    }
  });

  test("Layout's JP|EN switch on /contact links to /en/contact once English text exists", async () => {
    const { Provider } = await import("../components/provider");
    const Layout = (await import("../components/Layout")).default;
    dom.reconfigure({ url: "http://localhost/contact" });
    const prevSettings = canned["/api/settings"];
    // ガード条件: 公開EN文が1つでも入力されていれば JP|EN を出す。
    canned["/api/settings"] = { contactIntroEn: "Feel free to reach out." };
    try {
      const { host, cleanup } = await mount(
        createElement(
          Provider,
          null,
          createElement(Layout, null, createElement("p", null, "child")),
        ),
      );
      const enLinks = Array.from(
        host.querySelectorAll('a[href="/en/contact"]'),
      );
      expect(enLinks.some((a) => a.textContent === "EN")).toBe(true);
      expect(host.textContent).toContain("本文へスキップ");
      expect(host.textContent).not.toContain("Skip to content");
      cleanup();
    } finally {
      canned["/api/settings"] = prevSettings;
      dom.reconfigure({ url: "http://localhost/" });
    }
  });

  test("Layout hides the JP|EN switch on JP pages while no English text is configured (distributed-template guard)", async () => {
    const { Provider } = await import("../components/provider");
    const Layout = (await import("../components/Layout")).default;
    dom.reconfigure({ url: "http://localhost/contact" });
    const prevSettings = canned["/api/settings"];
    // contactEnglishNote はJPページ用の添え書きなので、これだけでは有効化しない。
    canned["/api/settings"] = {
      contactEnglishNote: "English inquiries welcome.",
    };
    try {
      const { host, cleanup } = await mount(
        createElement(
          Provider,
          null,
          createElement(Layout, null, createElement("p", null, "child")),
        ),
      );
      expect(host.querySelector('a[href="/en/contact"]')).toBeNull();
      cleanup();
    } finally {
      canned["/api/settings"] = prevSettings;
      dom.reconfigure({ url: "http://localhost/" });
    }
  });

  test("Layout's JP|EN switch on /en/contact links back to /contact, and About/Contact nav point at /en/*", async () => {
    const { Provider } = await import("../components/provider");
    const Layout = (await import("../components/Layout")).default;
    dom.reconfigure({ url: "http://localhost/en/contact" });
    try {
      const { host, cleanup } = await mount(
        createElement(
          Provider,
          null,
          createElement(Layout, null, createElement("p", null, "child")),
        ),
      );
      const jaLinks = Array.from(host.querySelectorAll('a[href="/contact"]'));
      expect(jaLinks.some((a) => a.textContent === "JP")).toBe(true);
      expect(host.querySelector('a[href="/en/about"]')).not.toBeNull();
      // Gallery must stay JP even while an /en/* page is showing.
      expect(host.querySelector('a[href="/gallery"]')).not.toBeNull();
      expect(host.textContent).toContain("Skip to content");
      expect(host.textContent).not.toContain("本文へスキップ");
      cleanup();
    } finally {
      dom.reconfigure({ url: "http://localhost/" });
    }
  });

  test("Layout marks About/Contact active on their /en/* counterpart", async () => {
    const { Provider } = await import("../components/provider");
    const Layout = (await import("../components/Layout")).default;
    dom.reconfigure({ url: "http://localhost/en/about" });
    try {
      const { host, cleanup } = await mount(
        createElement(
          Provider,
          null,
          createElement(Layout, null, createElement("p", null, "child")),
        ),
      );
      const aboutLink = host.querySelector('a[href="/en/about"]');
      expect(aboutLink?.getAttribute("aria-current")).toBe("page");
      cleanup();
    } finally {
      dom.reconfigure({ url: "http://localhost/" });
    }
  });
});

describe("i18n Phase 3 slice 2+3: EN profile/contact copy + English welcome note", () => {
  test("English ProfilePage shows profileBioEn instead of the Japanese bio", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = {
      profileBio: "日本語の自己紹介です。",
      profileBioEn: "English bio goes here.",
    };
    try {
      const ProfilePage = (await import("../pages/profile")).default;
      const { host, cleanup } = await mount(
        createElement(ProfilePage, { language: "en" }),
      );
      expect(host.textContent).toContain("English bio goes here.");
      expect(host.textContent).not.toContain("日本語の自己紹介です。");
      cleanup();
    } finally {
      canned["/api/settings"] = previousSettings;
    }
  });

  test("English ProfilePage falls back to the Japanese bio when profileBioEn is unset", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = { profileBio: "日本語の自己紹介です。" };
    try {
      const ProfilePage = (await import("../pages/profile")).default;
      const { host, cleanup } = await mount(
        createElement(ProfilePage, { language: "en" }),
      );
      expect(host.textContent).toContain("日本語の自己紹介です。");
      cleanup();
    } finally {
      canned["/api/settings"] = previousSettings;
    }
  });

  test("English ContactPage shows contactIntroEn instead of the Japanese intro", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = {
      contactIntro: "日本語の案内文です。",
      contactIntroEn: "English intro copy goes here.",
    };
    try {
      const ContactPage = (await import("../pages/contact")).default;
      const { host, cleanup } = await mount(
        createElement(ContactPage, { language: "en" }),
      );
      expect(host.textContent).toContain("English intro copy goes here.");
      expect(host.textContent).not.toContain("日本語の案内文です。");
      cleanup();
    } finally {
      canned["/api/settings"] = previousSettings;
    }
  });

  test("contactEnglishNote shows on the default JP ContactPage (language unspecified)", async () => {
    const previousSettings = canned["/api/settings"];
    canned["/api/settings"] = {
      contactEnglishNote: "English inquiries welcome.",
    };
    try {
      const ContactPage = (await import("../pages/contact")).default;
      const { host, cleanup } = await mount(createElement(ContactPage));
      expect(host.textContent).toContain("English inquiries welcome.");
      cleanup();
    } finally {
      canned["/api/settings"] = previousSettings;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2026-08-05: 「設定したのに反映されない」の再発防止。
//
// Hero の3レイアウト(quiet-grid / editorial / immersive)と、ギャラリーの
// masonry / clean-grid / large-format は、寸法・色・列数・余白を自前の定数で
// 書いていたため、admin のスライダーを動かしても何も起きなかった。
// ここは「どの配置を選んでいても設定が届く」ことだけを見る。
// 修正を戻すと(定数に戻すと)必ず落ちる。
// ─────────────────────────────────────────────────────────────────────────────
describe("settings reach every layout (dead-control regression)", () => {
  const HERO_MODES = [
    "carousel",
    "single",
    "quiet-grid",
    "editorial",
    "immersive",
  ];

  for (const heroMode of HERO_MODES) {
    test(`heroMode=${heroMode} renders worksLabel / viewAllLabel / heroSubtitle`, async () => {
      const previousSettings = canned["/api/settings"];
      canned["/api/settings"] = {
        heroMode,
        worksLabel: "WORKS_PROBE",
        viewAllLabel: "VIEWALL_PROBE",
        heroSubtitle: "SUBTITLE_PROBE",
      };
      try {
        const TopPage = (await import("../pages/top")).default;
        const { host, cleanup } = await mount(createElement(TopPage));
        await flush(60);
        const text = host.textContent ?? "";
        expect(text).toContain("WORKS_PROBE");
        expect(text).toContain("VIEWALL_PROBE");
        expect(text).toContain("SUBTITLE_PROBE");
        cleanup();
      } finally {
        canned["/api/settings"] = previousSettings;
      }
    });
  }

  for (const heroMode of HERO_MODES) {
    test(`heroMode=${heroMode} sizes the hero name from --hero-name-size, not a constant`, async () => {
      const previousSettings = canned["/api/settings"];
      canned["/api/settings"] = { heroMode, siteName: "NAME_PROBE" };
      try {
        const TopPage = (await import("../pages/top")).default;
        const { host, cleanup } = await mount(createElement(TopPage));
        await flush(60);
        const heading = Array.from(host.querySelectorAll("h1")).find((el) =>
          el.textContent?.includes("NAME_PROBE"),
        );
        expect(heading).toBeDefined();
        const style = (heading as HTMLElement).getAttribute("style") ?? "";
        expect(style).toContain("--hero-name-size");
        expect(style).toContain("--hero-name-weight");
        expect(style).toContain("--hero-name-tracking");
        cleanup();
      } finally {
        canned["/api/settings"] = previousSettings;
      }
    });
  }

  // 列数は「最大」であって固定値ではない(実際の列数は幅で下がる)。jsdom は幅0
  // なので列数そのものは見ず、「設定を変えると DOM が変わる」ことを見る。
  const COLUMN_LAYOUTS = [
    "mosaic",
    "grid",
    "masonry",
    "clean-grid",
    "large-format",
    "collage",
    "portrait-grid",
    "landscape-grid",
  ];

  for (const galleryLayout of COLUMN_LAYOUTS) {
    test(`galleryLayout=${galleryLayout} applies galleryGapScale instead of a hardcoded gap`, async () => {
      const { PhotoGallery } = await import("../components/PhotoGallery");
      const previousSettings = canned["/api/settings"];
      const gapsSeen = new Set<string>();
      try {
        for (const galleryGapScale of ["1", "4"]) {
          canned["/api/settings"] = { galleryGapScale, galleryColumns: "4" };
          const { host, cleanup } = await mount(
            createElement(PhotoGallery, {
              photos: samplePhotos as never,
              layoutType: galleryLayout,
            }),
          );
          await flush(60);
          // Collect every gap-ish inline value in the subtree.
          const gaps = Array.from(host.querySelectorAll("[style]"))
            .map((el) => (el as HTMLElement).getAttribute("style") ?? "")
            .filter((s) => /gap/i.test(s))
            .join("|");
          gapsSeen.add(gaps);
          cleanup();
        }
      } finally {
        canned["/api/settings"] = previousSettings;
      }
      // Two different gap scales must produce two different renderings.
      expect(gapsSeen.size).toBe(2);
    });
  }

  // heroScrollEffect writes transforms onto .hero-fx-layer. Three Hero layouts
  // had no such layer at all, and carousel only grew one after its photos
  // arrived — by which point the effect had already bailed on a null ref.
  for (const heroMode of HERO_MODES) {
    test(`heroMode=${heroMode} renders the hero fx layer heroScrollEffect needs`, async () => {
      const previousSettings = canned["/api/settings"];
      canned["/api/settings"] = { heroMode, heroScrollEffect: "parallax" };
      try {
        const TopPage = (await import("../pages/top")).default;
        const { host, cleanup } = await mount(createElement(TopPage));
        await flush(80);
        expect(host.querySelector(".hero-fx-layer")).not.toBeNull();
        cleanup();
      } finally {
        canned["/api/settings"] = previousSettings;
      }
    });
  }

  test("sectionLabelOpacity drives every section label, not only Series", async () => {
    const pages: [string, () => Promise<{ default: unknown }>][] = [
      ["top", () => import("../pages/top")],
      ["gallery", () => import("../pages/gallery")],
      ["profile", () => import("../pages/profile")],
      ["contact", () => import("../pages/contact")],
      ["series", () => import("../pages/series")],
    ];
    for (const [name, load] of pages) {
      const Page = (await load()).default;
      const { host, cleanup } = await mount(createElement(Page as never));
      await flush(40);
      const labels = Array.from(host.querySelectorAll("[style]")).filter((el) =>
        ((el as HTMLElement).getAttribute("style") ?? "").includes(
          "--section-label-size",
        ),
      );
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        const style = (label as HTMLElement).getAttribute("style") ?? "";
        expect(
          `${name}: ${style}`,
        ).toContain("--section-label-color");
      }
      cleanup();
    }
  });
});
