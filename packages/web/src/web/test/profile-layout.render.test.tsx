/**
 * About（プロフィール）の構成（profileLayout）の回帰テスト。
 *
 * 目的は「買った人のサイトが全部同じ形にならない」こと。色や文字の大きさを
 * 変えても骨格は変わらないので、写真と文章の関係そのものを選べるようにした。
 *
 * ここで縛るのは次の3点。
 *  1. 既定（side）は従来どおり写真左・本文右のままであること
 *  2. stack / quiet が実際に別の骨格になること
 *  3. **写真が無いときに空の灰色の四角を置かないこと**。以前は
 *     `profilePhotoUrl` が空でも 3:4 の灰色の箱を場所取りしていた
 *     （admin-renewal-goal 到達点(6)「意味のない灰色の箱を見せない」違反）
 *
 * 実際の見た目・余白は CSS 側なので jsdom では測れない。
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
const ProfilePage = (await import("../pages/profile")).default;

const doc = dom.window.document;
const PHOTO = "https://example.test/me.jpg";

async function mountProfile(settings: Record<string, string> = {}) {
  canned["/api/settings"] = settings;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(Router, null, createElement(ProfilePage, null) as never),
    ),
  );
  await flush(120);
  return {
    host,
    frame: () => host.querySelector("[data-profile-layout]"),
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
}

afterEach(() => {
  canned["/api/settings"] = {};
});

describe("About の構成", () => {
  test("既定は写真左・本文右のまま", async () => {
    const m = await mountProfile({ profilePhotoUrl: PHOTO });
    try {
      expect(m.frame()?.getAttribute("data-profile-layout")).toBe("side");
      expect(m.frame()?.className).toContain("md:grid-cols-[300px_1fr]");
      expect(m.host.querySelector("img")).not.toBeNull();
    } finally {
      m.cleanup();
    }
  });

  test("stack は写真を上に置き、横並びの枠を使わない", async () => {
    const m = await mountProfile({
      profilePhotoUrl: PHOTO,
      profileLayout: "stack",
    });
    try {
      expect(m.frame()?.getAttribute("data-profile-layout")).toBe("stack");
      expect(m.frame()?.className).not.toContain("md:grid-cols-[300px_1fr]");
      const img = m.host.querySelector("img");
      expect(img).not.toBeNull();
      // 上に大きく置くので 3:4 の肖像切りではなく 3:2
      expect(img?.className).toContain("aspect-[3/2]");
    } finally {
      m.cleanup();
    }
  });

  test("quiet は写真を出さない", async () => {
    const m = await mountProfile({
      profilePhotoUrl: PHOTO,
      profileLayout: "quiet",
    });
    try {
      expect(m.frame()?.getAttribute("data-profile-layout")).toBe("quiet");
      expect(m.host.querySelector("img")).toBeNull();
    } finally {
      m.cleanup();
    }
  });

  test("写真が未設定なら、何を選んでも quiet で描く（空の箱を置かない）", async () => {
    for (const requested of ["side", "stack", "quiet", ""]) {
      const m = await mountProfile({ profileLayout: requested });
      try {
        expect(m.frame()?.getAttribute("data-profile-layout")).toBe("quiet");
        expect(m.host.querySelector("img")).toBeNull();
        // 3:4 の灰色の場所取りが残っていないこと
        expect(m.host.innerHTML).not.toContain("aspect-[3/4]");
      } finally {
        m.cleanup();
      }
    }
  });

  // 折り返せない長い語（URL を名前欄に貼った等）で列そのものが広がる。
  // 実測（2026-08-11・320px の画面）: 名前が50文字の連続英字だと About が
  // **1650px** まで伸びていた。本文の段落でも同じことが起きる。
  // jsdom では幅を測れないので、折り返しの指定が付いていることで縛る。
  test("名前と本文に折り返しの指定がある（長い語で横に伸びない）", async () => {
    const m = await mountProfile({
      profilePhotoUrl: PHOTO,
      profileName: "A".repeat(50),
      profileBio: "B".repeat(50),
      profileStatement: "C".repeat(50),
    });
    try {
      const name = m.host.querySelector("h2");
      expect(name?.className, "名前").toContain("break-words");
      // 名前を包む列。grid の子は min-width:auto なので、これが無いと
      // break-words だけでは列が広がる
      expect(name?.parentElement?.className, "名前を包む列").toContain("min-w-0");
      const paras = [...m.host.querySelectorAll("p")].filter((p) =>
        /^(B|C)+$/.test((p.textContent ?? "").trim()),
      );
      expect(paras.length, "本文とステートメントが出ている").toBeGreaterThan(0);
      for (const p of paras)
        expect(p.className, `本文: ${p.textContent?.slice(0, 6)}`).toContain(
          "break-words",
        );
    } finally {
      m.cleanup();
    }
  });

  test("知らない値は既定へ倒す（DBに変な値が入っても壊さない）", async () => {
    const m = await mountProfile({
      profilePhotoUrl: PHOTO,
      profileLayout: "ドーン",
    });
    try {
      expect(m.frame()?.getAttribute("data-profile-layout")).toBe("side");
    } finally {
      m.cleanup();
    }
  });
});
