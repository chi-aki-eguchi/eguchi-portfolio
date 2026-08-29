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
