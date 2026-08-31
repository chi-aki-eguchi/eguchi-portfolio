import { test, expect } from "@playwright/test";

/**
 * **「宣言した長さ」ではなく「目に見えている長さ」を見張る。**
 *
 * 2026-08-30 に現れ方の duration を 750→1000ms へ広げたのに、オーナーには
 * 速いままに見えていた。原因は duration ではなくカーブだった。当時の
 * `cubic-bezier(0.16, 1, 0.3, 1)`（ease-out-expo系）は変化の 50% を最初の
 * 10%、90% を 33% で使い切る。宣言 1000ms のフェードが 333ms で終わって見え、
 * 長さを足しても伸びるのは 97%→100% の見えない尾だけだった。
 *
 *     宣言 1000ms の写真1枚      50%到達  90%到達
 *       旧 (0.16, 1, 0.3, 1)      109ms    333ms
 *       新 (0.3, .12, .22, 1)     298ms    615ms
 *
 * その上で 8/31 に宣言そのものも上げた（1000→1450ms）。**カーブが直った後
 * だから効く**——旧カーブのままなら 483ms にしかならなかった。
 *
 * だからここでは duration を検査しない。**実際に走らせて computed style を
 * rAF で拾い、目に見えている時間を測る。**カーブを前のめりなものへ戻すと、
 * duration が同じままでもここが落ちる。
 *
 * 上限も置いているのは、逆に伸ばしすぎると「余裕」ではなく「重い」になるため。
 */

type Sample = { t: number; v: number };

/** 進み具合が target を最初に超えた時刻(ms)。届かなければ null。 */
function crossing(samples: Sample[], target: number): number | null {
  for (const s of samples) if (s.v >= target) return Math.round(s.t);
  return null;
}

/**
 * `className` の要素を1つ作って `.visible` を足し、opacity の進み方を
 * rAF ごとに拾う。宣言 duration も一緒に返す。
 */
async function sampleReveal(
  page: import("@playwright/test").Page,
  className: string,
) {
  return page.evaluate(async (cls) => {
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;top:0;left:0;width:40px;height:40px;pointer-events:none;";
    el.className = cls;
    document.body.appendChild(el);
    // 開始状態を描かせてから切り替える。同じフレームで足すと transition が
    // 走らず、いきなり最終値になる（測っているつもりで何も測っていない）。
    void el.getBoundingClientRect();
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const declared = Math.max(
      ...(getComputedStyle(el).transitionDuration || "0s")
        .split(",")
        .map((s) => parseFloat(s) * 1000),
    );

    const samples: { t: number; v: number }[] = [];
    const start = performance.now();
    el.classList.add("visible");
    await new Promise<void>((resolve) => {
      const tick = () => {
        const t = performance.now() - start;
        samples.push({ t, v: parseFloat(getComputedStyle(el).opacity) });
        if (t > 2000) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    el.remove();
    return { declared, samples };
  }, className);
}

// 目に見えている時間の許容帯（ms）。中央値は 2026-08-31 の実測。
// **2026-08-31 に尺を上げた**（オーナー「全体的にまだ速い」）。カーブを直した
// あとなので、伸ばした分の約6割が目に見える時間になる——前のカーブでは3割しか
// 増えず、伸ばしても効かなかった。
const REVEALS: { name: string; className: string; min: number; max: number }[] =
  [
    { name: "写真1枚のフェードイン", className: "fade-in-item", min: 680, max: 1150 },
    { name: "節の見出し", className: "section-reveal", min: 500, max: 900 },
    { name: "ページ入り", className: "page-entrance", min: 500, max: 900 },
    { name: "締めの帯", className: "footer-reveal", min: 540, max: 950 },
  ];

for (const r of REVEALS) {
  test(`公開サイト — 現れ方の体感 › ${r.name}が目に見えている時間`, async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const { declared, samples } = await sampleReveal(page, r.className);

    expect(samples.length, "サンプルが取れていない").toBeGreaterThan(20);
    const half = crossing(samples, 0.5);
    const most = crossing(samples, 0.9);
    expect(most, `${r.name} が 90% まで届かなかった`).not.toBeNull();
    expect(half).not.toBeNull();

    // 1. 目に見えている時間そのもの。
    expect(
      most,
      `${r.name}: 90%到達 ${most}ms（宣言 ${Math.round(declared)}ms）。` +
        `帯は ${r.min}〜${r.max}ms`,
    ).toBeGreaterThanOrEqual(r.min);
    expect(most).toBeLessThanOrEqual(r.max);

    // 2. **カーブが前のめりでないこと。**duration をいくつに変えても効く検査。
    //    旧 expo はここが 10% だった。
    const halfFraction = (half as number) / declared;
    expect(
      halfFraction,
      `${r.name}: 半分まで ${half}ms＝宣言の ${(halfFraction * 100).toFixed(0)}%。` +
        `20% を切ると、長さを足しても見えない尾が伸びるだけになる`,
    ).toBeGreaterThan(0.2);
  });
}

test("公開サイト — 現れ方の体感 › 写真が現れる（ぼけが晴れて原寸へ落ち着く）", async ({
  page,
}) => {
  await page.goto("/gallery", { waitUntil: "networkidle" });

  const result = await page.evaluate(async () => {
    const card = document.createElement("div");
    card.className = "photo-card";
    card.style.cssText =
      "position:fixed;top:0;left:0;width:80px;height:80px;pointer-events:none;";
    const img = document.createElement("img");
    img.className = "lqip-loading";
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    card.appendChild(img);
    document.body.appendChild(card);
    void img.getBoundingClientRect();
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const read = () => {
      const cs = getComputedStyle(img);
      const b = /blur\(([\d.]+)px\)/.exec(cs.filter || "");
      const m = /matrix\(([\d.]+)/.exec(cs.transform || "");
      return { blur: b ? parseFloat(b[1]) : 0, scale: m ? parseFloat(m[1]) : 1 };
    };
    const from = read();

    const samples: { t: number; blur: number; scale: number }[] = [];
    const start = performance.now();
    img.className = "lqip-loaded";
    await new Promise<void>((resolve) => {
      const tick = () => {
        const t = performance.now() - start;
        samples.push({ t, ...read() });
        if (t > 2200) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    card.remove();
    return { from, samples };
  });

  // blur-up が効いていること自体を先に確かめる。ぼけが 0 から始まっていたら、
  // 以下の時間はすべて「一瞬で終わった」と読めてしまい、通ってしまう。
  expect(result.from.blur, "ぼけが最初から 0＝blur-up が効いていない").toBeGreaterThan(2);
  expect(result.from.scale, "拡大が最初から 1＝落ち着く動きが無い").toBeGreaterThan(1);

  const blurGone = crossing(
    result.samples.map((s) => ({ t: s.t, v: 1 - s.blur / result.from.blur })),
    0.9,
  );
  const scaleSettled = crossing(
    result.samples.map((s) => ({
      t: s.t,
      v: 1 - (s.scale - 1) / (result.from.scale - 1),
    })),
    0.9,
  );

  expect(blurGone, "ぼけが晴れきらなかった").not.toBeNull();
  expect(scaleSettled, "原寸へ落ち着かなかった").not.toBeNull();

  // 写真が出る瞬間はこのサイトの主役なので、他の「現れる」より長く取る。
  expect(blurGone, `ぼけが 90% 晴れるまで ${blurGone}ms`).toBeGreaterThanOrEqual(800);
  expect(blurGone).toBeLessThanOrEqual(1350);

  // ぼけが晴れてから落ち着く。**逆順になっていないこと**が設計の要。
  expect(
    scaleSettled,
    `原寸へ 90% 戻るまで ${scaleSettled}ms。ぼけ(${blurGone}ms)より後であること`,
  ).toBeGreaterThan(blurGone as number);
  expect(scaleSettled).toBeLessThanOrEqual(1600);
});
