/**
 * トップの展示（2026-10-31、日藝祭 2026。siteDesign = "develop" のとき）。
 *
 * 展示を見てくれた人がスマホで開いて、写真をもう一度眺め、ほかの作品・自己紹介・Instagram へ
 * 進めるトップ。会期（2026-11-01〜03）が過ぎても続ける（オーナーの決定）ので、**日付で切り替える
 * 処理は持たない**。次に見せたい作品ができたら、管理画面の「ページの写真」→「展示」で入れ替えるか、
 * 止めると、いつものトップに戻る。文は会期中でも会期後でも読める、記録の形にしてある。
 *
 * 会場の壁と同じ順に写真を並べ、最後に詩を会場の紙と同じ組みで置く。
 *
 * 写真の5枚はリポジトリに同梱する（`packages/web/assets/exhibition/`）。本番の写真の保存先へ入れなくても
 * push だけで出せるようにするため。配信は `/api/images/exhibition/…`（いつもの変換を通る）。
 * 同梱の写真は負の ID を持ち、ライブラリの写真（正の ID）と同じ並びに入れられる。
 * 公開の写真一覧（/api/photos）には入らないので、Gallery には出ない。
 */
import { isDevelopDesignValue, parsePhotoIdList } from "./develop-structure";
import { isServiceOwnerSite } from "./service-visibility";

export const EXHIBITION_ASSET_PREFIX = "exhibition/";

export type ExhibitionPhoto = {
  id: number;
  url: string;
  title: string;
  /** 読み上げの言葉。ビューアの説明には出さない。 */
  alt: string;
  width: number;
  height: number;
};

const builtIn = (
  id: number,
  name: string,
  width: number,
  height: number,
  alt: string,
): ExhibitionPhoto => ({
  id,
  url: `/api/images/${EXHIBITION_ASSET_PREFIX}2026-nichigei/${name}.jpg`,
  title: "",
  alt,
  width,
  height,
});

/**
 * 並びは会場の壁と同じ：上の段の左から 芝生の腕・花と窓・部屋、下の段の左から 背中・髪。
 * 壁はこのあと詩の紙、名前の札と続く。サイトも同じ順で読めるようにする（オーナーの展示の順）。
 * 撮影日は持たせない（元の記録はフィルムを複写した日で、ビューアに撮影日として出てしまう）。
 */
export const EXHIBITION_BUILT_IN: readonly ExhibitionPhoto[] = [
  builtIn(-4, "grass", 2800, 2240, "芝生に投げ出された、縞のシャツの腕と開いた手"),
  builtIn(-3, "flowers", 2240, 2800, "明るい窓の前に横たわる体と、かぎ針編みの花"),
  builtIn(-2, "room", 2800, 2222, "薄いカーテンの光の前で、椅子に座りこちらを見ている人"),
  builtIn(-1, "back", 2799, 2800, "こちらに背を向けた人の、濡れた黒髪と肩"),
  builtIn(-5, "hair", 2800, 1866, "白い布を背にした、髪の先"),
];

/**
 * 名刺の QR から来た人にだけ出す、壁に掛けなかった1枚（2026-11-01。原本は `距離感/_A1K0738.jpg`）。
 * 詩のあとに、ドアから腕だけ出して親指を立てる。公開の写真一覧にも Gallery にも入れない。
 */
export const EXHIBITION_THANKS_PHOTO = builtIn(
  -6,
  "thanks",
  2000,
  2000,
  "ドアの向こうから腕だけ出して、親指を立てている",
);

export type WallBox = { x: number; y: number; w: number; h: number };

/**
 * 会場の壁の配置（2026-10-31 オーナーが送ってくれた会場の写真から測った。壁の範囲に対する %）。
 * frame は額、print は額の中の写真の位置（額に対する %）。sheet は詩の紙、cards は名前と QR の札。
 *
 * phone はスマホの縦の画面に掛け直した位置（2026-11-01）。会場の比のままでは写真が幅 115px ほどにしか
 * ならないので、3枚2段を2枚3段に。順はそのまま（左から右、上から下）で、右下が詩の紙と名刺なのも会場と同じ。
 * 枠の比は写真の比と同じなので、スマホでは写真が枠いっぱいになる。
 */
export const EXHIBITION_WALL: {
  ratio: number;
  works: readonly { id: number; frame: WallBox; print: WallBox; phone: WallBox }[];
  sheet: WallBox;
  cards: readonly WallBox[];
  phone: { ratio: number; sheet: WallBox; cards: readonly WallBox[] };
} = {
  ratio: 1738 / 1220,
  works: [
    {
      id: -4,
      frame: { x: 0, y: 4.5, w: 33.7, h: 36.5 },
      print: { x: 21.3, y: 20.2, w: 56.5, h: 58.9 },
      phone: { x: 0, y: 4.25, w: 48.05, h: 29.09 },
    },
    {
      id: -3,
      frame: { x: 38, y: 0, w: 25.1, h: 46.3 },
      print: { x: 20.6, y: 21.9, w: 58.7, h: 57.2 },
      phone: { x: 53.07, y: 0, w: 46.93, h: 44.59 },
    },
    {
      id: -2,
      frame: { x: 68, y: 5.2, w: 32, h: 35.8 },
      print: { x: 21.9, y: 20.8, w: 57.3, h: 58.4 },
      phone: { x: 0, y: 37.79, w: 48.05, h: 29.09 },
    },
    {
      id: -1,
      frame: { x: 3, y: 53.3, w: 26.1, h: 46.7 },
      print: { x: 21, y: 27.2, w: 58.5, h: 46.1 },
      phone: { x: 58.1, y: 47.98, w: 41.9, h: 31.85 },
    },
    {
      id: -5,
      frame: { x: 33.7, y: 57.2, w: 32.2, h: 35.6 },
      print: { x: 15.9, y: 20.5, w: 68.4, h: 59.4 },
      phone: { x: 0, y: 71.34, w: 55.87, h: 28.24 },
    },
  ],
  sheet: { x: 76.4, y: 53.3, w: 12, h: 24.4 },
  cards: [
    { x: 91.3, y: 80.6, w: 3.1, h: 4.5 },
    { x: 95.3, y: 80.6, w: 3.1, h: 4.5 },
  ],
  phone: {
    ratio: 358 / 471,
    sheet: { x: 73.18, y: 83.23, w: 15.64, h: 16.77 },
    cards: [
      { x: 91.06, y: 95.54, w: 3.91, h: 2.97 },
      { x: 96.09, y: 95.54, w: 3.91, h: 2.97 },
    ],
  },
};

/** 同梱の5枚が全部並びに入っている間は、トップの最初に壁の配置を出す。外すと先頭の写真が表紙になる。 */
export function exhibitionShowsWall(ids: string | null | undefined): boolean {
  const list = parsePhotoIdList(ids);
  return list.length === 0 || EXHIBITION_BUILT_IN.every((photo) => list.includes(photo.id));
}

export const EXHIBITION_ASSET_KEYS: ReadonlySet<string> = new Set(
  [...EXHIBITION_BUILT_IN, EXHIBITION_THANKS_PHOTO].map((photo) => photo.url.replace("/api/images/", "")),
);

/** 会場の壁の詩（原稿 `~/Downloads/poem_A4_tate_vector.pdf`）。一字も変えない。 */
export const EXHIBITION_POEM = [
  "どこへいくのかわからない",
  "ぼくたちはなにをしてるの",
  "どうして生きていられるの",
  "いつまで生きなきゃいけないの",
  "うれしいことはある",
  "かなしいことがある",
  "かわいいものもある",
  "だけど私のものじゃないの",
].join("\n");

/** 題・会期・詩の初めの値。題は本申し込みの作品名のまま「無題」（2026-11-01 オーナー）。 */
export const EXHIBITION_DEFAULTS = {
  title: "無題",
  dates: "日藝祭 2026年11月1日〜3日",
  text: EXHIBITION_POEM,
  /** 名刺の QR から来た人へのひとこと。空にすると、写真と欄ごと出さない。 */
  thanks: "きてくれてありがとう。",
} as const;

/**
 * 名刺の裏の言葉（`~/01_simple_square_55x55_print.pdf`）。電話番号とメールはサイトに載せない。
 * 名刺の QR の行き先は `/card.html`（印刷済みで変えられない）。展示がトップの間は、そこから展示へ通す（`server.ts`）。
 */
export const EXHIBITION_CARD_PLACES = "TOKYO / FUKUOKA / TAIPEI";

/** 名刺の QR を通った印（`server.ts` が `/card.html` で付ける）。1年残す。後日また開いた人も、名刺の人として迎える。 */
export const EXHIBITION_CARD_COOKIE = "ex_card";
export const EXHIBITION_CARD_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 名刺の QR から来た人か。`?card` は同じ画面を確かめるための入口。 */
export function exhibitionCardVisitor(cookie: string, search: string): boolean {
  if (new URLSearchParams(search).has("card")) return true;
  return cookie.split(";").some((part) => part.trim() === `${EXHIBITION_CARD_COOKIE}=1`);
}

/** 詩の書体。原稿と同じ。 */
export const EXHIBITION_POEM_FONT = "Zen Old Mincho";

/**
 * 縦書きの紙に組める文か。行が多い・長い文（長い説明文など）は紙からはみ出すので、横書きで出す。
 * 紙の幅と高さは A4 の比で、スマホでも読める字の大きさにしたときに収まる数。
 */
export function exhibitionTextFitsSheet(text: string): boolean {
  const lines = text.trim().split("\n");
  return lines.length <= 10 && lines.every((line) => Array.from(line.trim()).length <= 24);
}

export const EXHIBITION_TITLE_MAX = 40;
export const EXHIBITION_DATES_MAX = 40;
export const EXHIBITION_TEXT_MAX = 600;
export const EXHIBITION_CAPTION_MAX = 60;
export const EXHIBITION_THANKS_MAX = 120;
/** 本人へ送る、ひとことの長さ。 */
export const EXHIBITION_REPLY_MAX = 600;

/**
 * 展示のトップを出すか。保存値が無いときは持ち主のサイトだけ出す（配布版のサイトに、
 * 江口秋の展示が出ないように）。`server.ts` は生の設定を読むので、同じ判断をここに置く。
 */
export function exhibitionStatus(value: string | null | undefined, siteUrl: string | null | undefined): "on" | "off" {
  if (value === "on" || value === "off") return value;
  return isServiceOwnerSite(siteUrl ?? undefined, undefined) ? "on" : "off";
}

/** トップが展示になっているか（`server.ts` の判定。新しい構成のときだけ展示のトップがある）。 */
export function exhibitionIsTop(
  settings: { siteDesign?: string | null; homeExhibition?: string | null },
  siteUrl: string | null | undefined,
): boolean {
  return isDevelopDesignValue(settings.siteDesign) && exhibitionStatus(settings.homeExhibition, siteUrl) === "on";
}

/** 並びにライブラリの写真が入っているか（入っていれば、写真の一覧を待ってから表紙を決める）。 */
export function exhibitionNeedsLibrary(ids: string | null | undefined): boolean {
  return parsePhotoIdList(ids).some((id) => id > 0);
}

/**
 * 展示に出す写真。並びが空、または1枚も残っていないときは同梱の写真を壁の順で出す
 * （展示が空のトップにならないように）。同梱とライブラリの写真は混ぜて並べられる。
 */
export function exhibitionPhotoList<T extends { id: number }>(
  ids: string | null | undefined,
  library: readonly T[],
): (T | ExhibitionPhoto)[] {
  const byId = new Map<number, T | ExhibitionPhoto>(EXHIBITION_BUILT_IN.map((photo) => [photo.id, photo]));
  for (const photo of library) byId.set(photo.id, photo);
  const chosen = parsePhotoIdList(ids)
    .map((id) => byId.get(id))
    .filter((photo): photo is T | ExhibitionPhoto => Boolean(photo));
  return chosen.length > 0 ? chosen : [...EXHIBITION_BUILT_IN];
}

/** 写真ごとの題（設定 `exhibitionCaptions` の JSON）。壊れた値は無かったことにする。 */
export function readExhibitionCaptions(value: string | null | undefined): Record<number, string> {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const captions: Record<number, string> = {};
  for (const [key, text] of Object.entries(parsed)) {
    const id = Number(key);
    if (!Number.isInteger(id) || typeof text !== "string") continue;
    const tidy = Array.from(text.replace(/\s+/g, " ").trim()).slice(0, EXHIBITION_CAPTION_MAX).join("");
    if (tidy) captions[id] = tidy;
  }
  return captions;
}

/** 保存する文字列。題の無い写真は入れない（全部空なら空文字）。 */
export function writeExhibitionCaptions(captions: Record<number, string>): string {
  const tidy = readExhibitionCaptions(JSON.stringify(captions));
  return Object.keys(tidy).length > 0 ? JSON.stringify(tidy) : "";
}

export type ExhibitionShape = "wide" | "square" | "tall";

/** 写真の形。PC での置き方を決める（スマホはどの形も端から端まで）。 */
export function exhibitionShape(width: number | null | undefined, height: number | null | undefined): ExhibitionShape {
  if (!width || !height) return "wide";
  const ratio = width / height;
  return ratio >= 1.15 ? "wide" : ratio >= 0.95 ? "square" : "tall";
}
