/**
 * 管理画面の色は公開サイトと同期し、書体は同期しない。
 *
 * **2026-08-17 オーナー判断で「色も独立させる」を撤回した。**
 * 「独立させない。admin で変えられる公開サイトの色と同期させよう」。
 * よって色の正本は `admin.tsx` の `adminThemeFromSettings`（`admin-theme-contrast`
 * が中身を見張る）で、このファイルが見張るのは次の3点だけになる。
 *
 * 1. `styles.css` 側は「JSが当たる前の一瞬」に使う控えであり、admin.tsx の
 *    既定値と一致していること（ずれると、読み込み直後だけ別の色が出る）
 * 2. 控えの側で公開サイトのトークンを `var()` で継いでいないこと。継ぐと、
 *    JSが動く前の一瞬だけ別経路の色が出て、しかも明暗の解決を通らない
 * 3. **書体の独立は撤回されていない**（2026-08-07 決定のまま）。オーナーが
 *    公開サイトへ装飾書体を選んでも、道具の文字は静かなままにする
 */
import { describe, expect, test } from "bun:test";

const styles = await Bun.file(
  new URL("../styles.css", import.meta.url),
).text();

/** `セレクタ { ... }` を1ブロックだけ取り出す（入れ子のない宣言ブロック前提）。
 *  コメントは落とす。ここでの「継いでいない」判定は宣言についての話であり、
 *  やめた書き方をコメントで引用した瞬間に落ちるのは、テストの側の誤りになる。 */
function ruleBlock(selector: string): string {
  const head = `\n${selector} {`;
  const start = styles.indexOf(head);
  expect(start, `${selector} が styles.css に無い`).toBeGreaterThan(-1);
  const bodyStart = start + head.length;
  const end = styles.indexOf("\n}", bodyStart);
  expect(end, `${selector} の閉じ括弧が見つからない`).toBeGreaterThan(bodyStart);
  return styles.slice(bodyStart, end).replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("CSS側は admin.tsx の控えとして正しい", () => {
  test(".admin-atelier は公開サイトの色トークンを継がない", () => {
    // 色の同期は admin.tsx が明暗を解決したうえで行う。CSS で `var(--background)`
    // を継ぐと、JSが当たる前の一瞬だけその経路が生き、暗いテーマ用の文字色と
    // 明るい背景が混ざる（2026-08-07 に実測した組み合わせで約1.08:1）。
    const block = ruleBlock(".admin-atelier");
    expect(block).not.toContain("var(--background");
    expect(block).not.toContain("var(--foreground");
  });

  test("紙とインクは直値で宣言されている", () => {
    // 2026-08-17 に無彩色（#f7f7f7 / #1a1a1a）から温かい紙と墨へ変更した。
    // ここが見張るのは「値そのもの」ではなく「直値で宣言されていること」。
    const block = ruleBlock(".admin-atelier");
    expect(block).toContain("--admin-paper: #f7f5f1;");
    expect(block).toContain("--admin-ink: #1b1917;");
    expect(block).toContain("--admin-paper-rgb: 247, 245, 241;");
    expect(block).toContain("--admin-ink-rgb: 27, 25, 23;");
  });

  test("hex と rgb の写しがずれていない", () => {
    // rgb 版は color-mix を読めない環境やガラス面の rgba() が使う控え。
    // 片方だけ変えると、面の色だけ元のグレーに戻る（目では気づきにくい）。
    const block = ruleBlock(".admin-atelier");
    for (const name of ["--admin-paper", "--admin-ink"]) {
      const hex = new RegExp(`${name}: #([0-9a-f]{6});`).exec(block);
      const rgb = new RegExp(`${name}-rgb: (\\d+), (\\d+), (\\d+);`).exec(block);
      expect(hex, `${name} の直値が無い`).not.toBeNull();
      expect(rgb, `${name}-rgb が無い`).not.toBeNull();
      const fromHex = [1, 3, 5].map((i) =>
        Number.parseInt(hex![1].slice(i - 1, i + 1), 16),
      );
      expect(fromHex).toEqual(rgb!.slice(1, 4).map(Number));
    }
  });

  test("CSSとJSの既定色が明暗ともに一致している", async () => {
    // 紙とインクの既定は2箇所にある。実際に出るのは admin.tsx の
    // `ATELIER_PAPER`（`adminThemeFromSettings` がインラインstyleとして要素へ
    // 付けるので、CSSのどの宣言よりも強い）。styles.css 側はその控え。
    // 2026-08-17: CSS だけ変えて「変わらない」と悩んだ実例があるため、
    // ずれたらここで落とす。
    const admin = await Bun.file(
      new URL("../pages/admin.tsx", import.meta.url),
    ).text();
    const source = /const ATELIER_PAPER = \{([\s\S]*?)\n\} as const;/.exec(
      admin,
    )?.[1];
    expect(source, "ATELIER_PAPER が見つからない").toBeTruthy();
    const pair = (theme: "light" | "dark") => {
      const line = new RegExp(`${theme}: \\{([^}]*)\\}`).exec(source!)?.[1] ?? "";
      return {
        paper: /paper: "(#[0-9a-f]{6})"/.exec(line)?.[1],
        ink: /ink: "(#[0-9a-f]{6})"/.exec(line)?.[1],
      };
    };
    const light = pair("light");
    const lightBlock = ruleBlock(".admin-atelier");
    expect(lightBlock).toContain(`--admin-paper: ${light.paper};`);
    expect(lightBlock).toContain(`--admin-ink: ${light.ink};`);

    const dark = pair("dark");
    const darkBlock = ruleBlock('[data-theme="dark"] .admin-atelier');
    expect(darkBlock).toContain(`--admin-paper: ${dark.paper};`);
    expect(darkBlock).toContain(`--admin-ink: ${dark.ink};`);
  });

  test("暗いほうの既定は公開サイトと同じ黒", () => {
    const dark = ruleBlock('[data-theme="dark"] .admin-atelier');
    expect(dark).toContain("--admin-paper: #121212;");
    expect(dark).toContain("--admin-ink: #e8e8e8;");
    // 公開サイトの [data-theme="dark"] 既定と同じ値であること。ずれると
    // 「暗くしたのに admin だけ別の黒」になる。
    const publicDark = ruleBlock('[data-theme="dark"]');
    expect(publicDark).toContain("--background: #121212;");
    expect(publicDark).toContain("--foreground: #e8e8e8;");
  });

  test("派生トークンは紙とインクから作り続けている（全部の直書きに逃げていない）", () => {
    const block = ruleBlock(".admin-atelier");
    for (const derived of [
      "--admin-paper-soft",
      "--admin-paper-deep",
      "--admin-muted",
      "--admin-line",
    ]) {
      const at = block.indexOf(`${derived}:`);
      expect(at, `${derived} が無い`).toBeGreaterThan(-1);
      expect(block.slice(at, at + 160)).toContain("color-mix");
    }
  });
});

/**
 * 書体も同じ理由で切り離した（2026-08-07・オーナーから判断を委任）。
 *
 * `--admin-font-title: var(--font-en), ...` / `--admin-font-ui: var(--font-ja), ...`
 * と書かれており、公開サイトの書体設定が管理画面へそのまま流れ込んでいた。
 * 実測（2026-08-07）: 公開サイトへ `Dela Gothic One` / `Bungee Shade` を当てると
 * 管理画面の見出しと本文がまるごとその書体になる。
 *
 * 「見出しだけ借りる」案を採らなかった理由: title は sidebar のタイトルだけでなく
 * `h2` / `h3` と uppercase ラベル全部に当たる。走査の骨格そのものなので、
 * そこへ装飾書体が入る限り読みにくさは残る。
 */
describe("管理画面の書体は公開サイトから独立している", () => {
  test(".admin-atelier は公開サイトの書体トークンを継がない", () => {
    const block = ruleBlock(".admin-atelier");
    const fonts = block
      .split("\n")
      .filter((line) => line.includes("--admin-font-"))
      .join("\n");
    expect(fonts).not.toContain("var(--font-en");
    expect(fonts).not.toContain("var(--font-ja");
  });

  test("admin 自身の書体が宣言されている（未指定にして継承へ落ちていない）", () => {
    const block = ruleBlock(".admin-atelier");
    // 値が長いと prettier が改行を入れるので、空白の入り方には依存させない。
    expect(block.replace(/\s+/g, " ")).toContain(
      '--admin-font-title: "Cormorant Garamond"',
    );
    expect(block).toContain('--admin-font-ui: "Hiragino Sans"');
  });

  test("見出しの和文が環境任せになっていない", () => {
    // 末尾の総称 `serif` だけだと、macOS ではヒラギノ明朝、Windows では別書体に
    // なる。管理画面は購入者も同じ画面を使う商品なので、和文も名指しする。
    const block = ruleBlock(".admin-atelier");
    const title = /--admin-font-title:([^;]+);/.exec(block)?.[1] ?? "";
    expect(title).toMatch(/Shippori Mincho|Hiragino Mincho|Yu Mincho/);
  });

  test("文字の太さも公開サイトから独立している", () => {
    // 2026-08-17 実測（localhost:5173 / getComputedStyle）:
    // 公開サイトの `body { font-weight: var(--body-weight, 400) }` を
    // `.admin-atelier` が継いでいたため、オーナー設定 `--body-weight: 700` が
    // そのまま管理画面へ流れ、太さを明示していない補足文・入力値・一覧の行が
    // すべて 700 で出ていた（軸4「高級感」＝線が細いこと、の逆）。
    const block = ruleBlock(".admin-atelier");
    expect(block).toContain("font-weight: 400;");
    expect(block).not.toContain("var(--body-weight");
  });

  test("ログイン画面は意図どおり公開サイトの書体に追従したまま", () => {
    // `.admin-login` は「公開サイトと道具の間の扉」として、色も書体も
    // 意図的に公開サイトへ追従する。admin 本体と同じ扱いにしない。
    expect(ruleBlock(".admin-login")).toContain("var(--background)");
    expect(ruleBlock(".admin-login__title")).toContain("var(--font-en)");
  });
});
