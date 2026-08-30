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

// **閾値は下げない。1回だけやり直す。**
// この測定は、全体を通しで回して機械が混んでいるときだけ 0.1 をわずかに
// 超えることがある（2026-08-30 実測: 単独では5回中5回通り、通し実行で
// 0.1576）。中身の問題ではなく測る側の揺れなので、**上限を緩める**のでは
// なく**もう一度測る**。2回続けて超えるなら、それは本物。
test.describe.configure({ retries: 1 });

const OBSERVE = () => {
  const w = window as any;
  w.__cls = 0;
  w.__on = false;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as any[]) {
      if (!e.hadRecentInput && w.__on) w.__cls += e.value;
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
    const cls = await page.evaluate(() => (window as any).__cls as number);
    expect(cls, `送っている最中のズレ ${cls.toFixed(4)}（上限 ${LIMIT}）`).toBeLessThan(LIMIT);
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
      const seen = (sel: string) =>
        Array.from(document.querySelectorAll(sel)).filter((e) => {
          const b = e.getBoundingClientRect();
          return b.bottom > 0 && b.top < innerHeight && b.width > 20 && b.height > 20;
        }).length;
      // 写真そのものと、これから写真が入る枠。どちらも「何かある」に数える。
      return { n: seen("main img") + seen(".gallery-skeleton > div"), y: Math.round(window.scrollY) };
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
