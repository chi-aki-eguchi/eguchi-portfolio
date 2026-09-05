import { test, expect } from "@playwright/test";

/**
 * **送っている最中に版面が動かないこと。**
 *
 * ギャラリーは写真を下へ足していくので、足すたびに、その下にある「奥付」と
 * 「撮影のご依頼」が押し下げられていた。実測（2026-08-30 / 全497点・1440px）:
 *
 *     ゆっくり読む（約2,400px/秒）   ズレ 0.751
 *     ふつうに流す（約5,400px/秒）   ズレ 0.138
 *     一気に下まで（約13,000px/秒）  ズレ 1.671
 *
 * **ゆっくり見ている人ほど、その帯が画面に居る時間が長いので被害が大きい。**
 * 読んでいる最中に文字が飛ぶのは、動きの中でいちばん落ち着かない。
 *
 * 直し方は2つ:
 *   1. これから足す写真のぶんの場所を先に取る（1枚あたりの高さは実寸から出す）
 *   2. 終わりの帯は、本当に出しきったときだけ出す
 *
 * ここが 0.1 を超えたら、そのどちらかが壊れている。閾値は Core Web Vitals の
 * 「良好」の線と同じ。**数値ではなく体感の話**なので、閾値だけ緩めない。
 */
const LIMIT = 0.1;

// 2026-09-02: 次の写真が追加される前に共通footerが見え、追加時に押し出される
// 不具合を特定。2026-09-05の統合ではStudio導線にも同じ問題が出た。
// ギャラリーが続く間は両方の終端ブロックを出さず、最終バッチで表示する。
// retryで成功しても最初の失敗は調査対象。動いた要素も記録する。
test.describe.configure({ retries: 1 });

// 合計値だけ残すと、落ちても「0.14 だった」としか分からない。**何が動いたか**
// を一緒に控える。数字しか残っていなかったせいで、この検査は一度
// 別の要素のせいにされている（backlog B-23 の 2026-09-02 訂正）。
const OBSERVE = () => {
  const w = window as any;
  w.__cls = 0;
  w.__on = false;
  w.__moved = [];
  const nameOf = (n: any): string => {
    if (!n || n.nodeType !== 1) return String(n);
    const el = n as Element;
    const cls = (el.getAttribute("class") || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(".");
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}`;
  };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as any[]) {
      if (e.hadRecentInput || !w.__on) continue;
      w.__cls += e.value;
      for (const s of (e.sources || []).slice(0, 2)) {
        w.__moved.push(
          `${nameOf(s.node)} ${Math.round(s.previousRect.y)}→${Math.round(
            s.currentRect.y,
          )}px (${e.value.toFixed(4)})`,
        );
      }
    }
  }).observe({ type: "layout-shift", buffered: true });
};

/** 1コマあたりの送り量。60fps 換算で 2,400px/秒 と 13,000px/秒。 */
for (const [step, label] of [[40, "ゆっくり読む速さ"], [220, "一気に下まで送る速さ"]] as [number, string][]) {
  test(`公開サイト — 送っている最中に版面が動かない › ギャラリーを${label}で送る`, async ({
    page,
  }) => {
    await page.addInitScript(OBSERVE);
    await page.goto("/gallery", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      (window as any).__cls = 0;
      (window as any).__on = true;
    });
    await page.evaluate(async (s) => {
      for (let y = 0; y < 9000; y += s) {
        window.scrollBy(0, s);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
    }, step);
    await page.waitForTimeout(1500);
    const { cls, moved } = await page.evaluate(() => ({
      cls: (window as any).__cls as number,
      moved: (window as any).__moved as string[],
    }));
    expect(
      cls,
      `送っている最中のズレ ${cls.toFixed(4)}（上限 ${LIMIT}）\n動いたもの: ${
        moved.join(" / ") || "記録なし"
      }`,
    ).toBeLessThan(LIMIT);
  });
}

/**
 * **飛ぶのを止める代わりに、穴を開けていないか。**
 *
 * 版面のズレを消すために「これから足す写真のぶんの場所」を先に取っている。
 * その場所を空のままにすると、送るのが速い人はそこへ入り込んで**真っ白な画面**
 * を見る（実測 2026-08-30: 直した直後の実装で、3600px の地点に写真が0枚の
 * 画面があった）。**飛ばない代わりに何も無い、は直したことにならない。**
 * 場所取りの中は、読み込み中と同じ静かな枠で埋める。
 */
test("公開サイト — 送っている最中に版面が動かない › 送っている間、画面が空にならない", async ({
  page,
}) => {
  await page.goto("/gallery", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  let worst = { y: 0, n: Number.POSITIVE_INFINITY };
  for (let i = 0; i < 24; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(260);
    const r = await page.evaluate(() => {
      // **場所を取っているだけの写真は数えない。**タイルは現れる途中は
      // opacity 0 から始まる。並んでいるかどうかだけを数えると、「全部
      // 揃っているが全部まだ透明」＝人の目には真っ白、を通してしまう。
      // 2026-08-31 に現れ方を長くしたので、ここを実際の濃さで見るよう変えた。
      const litEnough = (e: Element) => {
        let o = 1;
        for (let n: Element | null = e; n; n = n.parentElement) {
          o *= parseFloat(getComputedStyle(n).opacity || "1");
          if (n === document.body) break;
        }
        return o > 0.15;
      };
      const seen = (sel: string) =>
        Array.from(document.querySelectorAll(sel)).filter((e) => {
          const b = e.getBoundingClientRect();
          if (!(b.bottom > 0 && b.top < innerHeight && b.width > 20 && b.height > 20))
            return false;
          return litEnough(e);
        }).length;
      // 写真そのものと、これから写真が入る枠。どちらも「何かある」に数える。
      // すべての写真を出し切った後は、奥付や問い合わせ導線が見えていれば
      // それも完成した版面であって「真っ白」ではない。全体実行が速いと24回の
      // 途中で終端へ届くため、写真だけを数えると実画面に文字があるのに誤検知する。
      return {
        n:
          seen("main img") +
          seen(".gallery-skeleton > div") +
          seen(".series-colophon") +
          seen('main a[href="/contact"]'),
        y: Math.round(window.scrollY),
      };
    });
    if (r.n < worst.n) worst = r;
    if (r.n === 0) break;
  }
  expect(worst.n, `${worst.y}px の地点で画面に何も無かった`).toBeGreaterThan(0);
});

test("公開サイト — 送っている最中に版面が動かない › 出しきったら奥付と締めの帯が出る", async ({
  page,
}) => {
  await page.goto("/gallery", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  // 全部は出しきれないので、点数の少ない分類に絞る。**「出さない」だけの
  // 修正になっていないことを見張る** — 終端に着いたら必ず出ること。
  const buttons = page.locator(".gallery-filter-row button");
  const n = await buttons.count();
  let switched = false;
  for (let i = 1; i < n; i++) {
    const label = (await buttons.nth(i).innerText()).trim();
    if (!label || /^(All|Film|Digital)$/i.test(label)) continue;
    await buttons.nth(i).click();
    await page.waitForTimeout(1800);
    const shown = await page.locator(".series-colophon").count();
    if (shown > 0) { switched = true; break; }
  }
  expect(switched, "どの分類でも奥付が出なかった").toBe(true);
  await expect(page.locator("footer")).toBeVisible();
  const studio = page.locator('[data-studio-bridge="footer"]');
  if (await studio.count()) await expect(studio).toBeVisible();
});

/**
 * **触れた時点で、移動先の中身を取りに行っているか。**
 *
 * 効いているかどうかは画面に出ない。配線が外れても、各ページはこれまでどおり
 * 自分で取りに行くので、誰も気づかない（気づけるのは「前より遅い気がする」だけ）。
 * だから「押す前に通信が出ていること」を実物で見張る。
 *
 * 実測（2026-08-30 / まっさらな入れ物で3回ずつ・1440px）: TOP から Gallery へ
 * 移って写真が6枚出るまで、中央値 2496ms → 1978ms。
 */
test("公開サイト — 移動先の先読み › ナビに触れた時点で、押す前に写真を取りに行く", async ({
  page,
}) => {
  const asked: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/")) asked.push(u.pathname);
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  asked.length = 0;

  // 狭い画面では横並びのナビは**DOMには在るが display:none**。数だけ見ると
  // 見落とすので、見えているかで分ける。狭いときはハンバーガーを開いてから
  // その中のリンクに触れる（触る端末で実際に通る道はこちら）。
  let link = page.locator('header ul a[href="/gallery"]').first();
  if (!(await link.isVisible().catch(() => false))) {
    const burger = page.locator('button[aria-controls="mobile-menu"]');
    if ((await burger.count()) === 0) test.skip(true, "この幅にはナビが無い");
    await burger.click();
    link = page.locator('#mobile-menu a[href="/gallery"]').first();
    await link.waitFor({ state: "visible" });
    asked.length = 0;
  }
  await link.hover();
  await page.waitForTimeout(1200);

  // **押していない。**それでも写真の取得が始まっていること。
  expect(page.url()).not.toContain("/gallery");
  expect(asked, `触れたあとに出た通信: ${asked.join(", ") || "なし"}`).toContain("/api/photos");
});
