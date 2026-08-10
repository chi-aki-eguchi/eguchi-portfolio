/**
 * Contact（お問い合わせ）の構成（contactLayout）の回帰テスト。
 *
 * 既定は 448px の細い1列で、説明文も中央揃え。中央揃えの日本語は2行以上に
 * なると行末が揃わず読みにくいので、左寄せと2列も選べるようにした。
 *
 * ここで縛るのは次の3点。
 *  1. 既定（center）が従来どおりであること
 *  2. left / split が別の骨格になること
 *  3. **説明文が何も無いときに split を選んでも、左が空の2列にしないこと**
 */
import { test, expect, describe, afterEach } from "bun:test";
import { setupDom, canned, flush } from "./jsdom-setup";

const dom = setupDom();

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import(
  "@tanstack/react-query"
);
const { Router } = await import("wouter");
const ContactPage = (await import("../pages/contact")).default;

const doc = dom.window.document;

// 説明文がある状態を既定にする（split の判定に効くため）
const WITH_LEAD = {
  contactIntro: "撮影のご相談はこちらから。",
  formspreeUrl: "https://formspree.test/f/abc",
};

async function mountContact(settings: Record<string, string> = {}) {
  canned["/api/settings"] = settings;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(Router, null, createElement(ContactPage, null) as never),
    ),
  );
  await flush(120);
  return {
    host,
    frame: () => host.querySelector("[data-contact-layout]"),
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/settings"] = {};
});

describe("Contact の構成", () => {
  test("既定は中央・細い1列", async () => {
    const m = await mountContact(WITH_LEAD);
    try {
      expect(m.frame()?.getAttribute("data-contact-layout")).toBe("center");
      expect(m.frame()?.className).toContain("max-w-md");
      expect(m.host.querySelector("h1")?.className).toContain("text-center");
    } finally {
      m.cleanup();
    }
  });

  test("left は左寄せで、中央揃えを使わない", async () => {
    const m = await mountContact({ ...WITH_LEAD, contactLayout: "left" });
    try {
      expect(m.frame()?.getAttribute("data-contact-layout")).toBe("left");
      expect(m.frame()?.className).toContain("max-w-xl");
      expect(m.host.querySelector("h1")?.className).not.toContain("text-center");
    } finally {
      m.cleanup();
    }
  });

  test("split は2列の枠を使い、幅を広げる", async () => {
    const m = await mountContact({ ...WITH_LEAD, contactLayout: "split" });
    try {
      expect(m.frame()?.getAttribute("data-contact-layout")).toBe("split");
      expect(m.frame()?.className).toContain("max-w-3xl");
      expect(m.host.innerHTML).toContain("md:grid-cols-2");
    } finally {
      m.cleanup();
    }
  });

  test("説明が空なら split を選んでも left へ倒す（左が空の2列を作らない）", async () => {
    const m = await mountContact({
      formspreeUrl: "https://formspree.test/f/abc",
      contactLayout: "split",
    });
    try {
      expect(m.frame()?.getAttribute("data-contact-layout")).toBe("left");
      expect(m.host.innerHTML).not.toContain("md:grid-cols-2");
    } finally {
      m.cleanup();
    }
  });

  test("知らない値は既定へ倒す（DBに変な値が入っても壊さない）", async () => {
    const m = await mountContact({ ...WITH_LEAD, contactLayout: "ドーン" });
    try {
      expect(m.frame()?.getAttribute("data-contact-layout")).toBe("center");
    } finally {
      m.cleanup();
    }
  });

  // 新しく足した2枚の div が条件分岐をまたいでいないかを見る。
  // またいでいると、フォーム未設定のときの連絡先が枠の外へ出たり消えたりする。
  test("フォーム未設定でも、構成を変えて連絡先が消えない", async () => {
    for (const layout of ["center", "left", "split"]) {
      const m = await mountContact({
        contactIntro: "メールでご連絡ください。",
        contactEmail: "hello@example.test",
        contactLayout: layout,
      });
      try {
        expect(m.host.querySelector("form")).toBeNull();
        const mail = m.host.querySelector('a[href^="mailto:"]');
        expect(mail, `${layout} でメール連絡先が要る`).not.toBeNull();
        // 連絡先が構成の枠の中にあること（枠の外に飛び出していない）
        expect(m.frame()?.contains(mail!)).toBe(true);
      } finally {
        m.cleanup();
      }
    }
  });

  test("フォームは構成を変えても消えない", async () => {
    for (const layout of ["center", "left", "split"]) {
      const m = await mountContact({ ...WITH_LEAD, contactLayout: layout });
      try {
        expect(m.host.querySelector("form")).not.toBeNull();
        expect(m.host.querySelector("#contact-name")).not.toBeNull();
      } finally {
        m.cleanup();
      }
    }
  });
});
