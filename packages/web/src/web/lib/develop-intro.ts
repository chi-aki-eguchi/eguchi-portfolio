/**
 * 開いた瞬間の見せ場（新しい構成、2026-10-14）：写真集の扉。
 *
 * 紙の上に、表紙の写真の小さな図版と名前が現れ、図版が現像されて、表紙いっぱいに
 * 引き伸ばされる。終わると、いつもの表紙がそのまま下にある（表紙の部品・設定には触らない）。
 *
 * ここにあるのは、流すかどうかの判断と、図版・名前の置き場所の計算だけ（画面の無い所で
 * 確かめられるように分けてある）。描くのは `components/develop/DevelopIntro.tsx`。
 */

/** そのタブで一度流したら、もう流さない（戻ってくるたびに待たせない）。 */
export const INTRO_SEEN_KEY = "dv-intro-seen";
/** 住所に付けると、もう一度流す（確かめる用）。 */
export const INTRO_REPLAY_PARAM = "intro";

/** 時間（ms）。styles 側の長さ（develop.css の .dv-intro）と揃える。 */
export const INTRO_FONT_WAIT_MS = 1200;
export const INTRO_IMAGE_WAIT_MS = 3000;
/** 名前が現れ始めてから、図版が出るまで。 */
export const INTRO_PLATE_AFTER_MS = 450;
/** 図版が出てから、引き伸ばし始めるまで（この間に現像される）。 */
export const INTRO_GROW_AFTER_MS = 1250;
export const INTRO_GROW_MS = 1150;
export const INTRO_OUT_MS = 300;

export type IntroEnvironment = {
  /** 新しい構成のトップか。 */
  developTop: boolean;
  pathname: string;
  search: string;
  /** そのタブで、もう流したか。 */
  seen: boolean;
  /** サイトへ入ってきた最初のページがトップだったか（ほかのページから移ってきたのではない）。 */
  landedOnTop: boolean;
  reducedMotion: boolean;
  /** 設定「写真の現れ方」。"none" なら流さない。 */
  reveal: string | null | undefined;
  /** 別のページの中（管理画面のプレビューなど）に埋め込まれているか。 */
  framed: boolean;
  /** 開いた時点で、もう下へ送られているか（戻る・進むで位置が戻ったとき）。 */
  scrolled: boolean;
  /** 描くのに要る仕組み（ResizeObserver）があるか。 */
  capable: boolean;
};

/**
 * 見せ場を流すか。
 *
 * サイトへ `/` から入ってきた、最初の1回だけ。ほかのページを見てからトップへ移ったとき・
 * 動きを減らす設定・「写真の現れ方：なし」・埋め込み・途中の位置から開いたときは流さない
 *（いつもの表紙がそのまま出る）。住所に `?intro` を付ければ、もう一度流せる。
 */
export function shouldPlayIntro(env: IntroEnvironment): boolean {
  if (!env.developTop || !env.capable) return false;
  if (env.pathname !== "/") return false;
  if (env.reducedMotion || env.reveal === "none") return false;
  if (env.framed || env.scrolled) return false;
  if (new URLSearchParams(env.search).has(INTRO_REPLAY_PARAM)) return true;
  return env.landedOnTop && !env.seen;
}

/** 縦に組む名前か（漢字・かなを含む短い名前）。英字だけの名前は、図版の下に横で組む。 */
export function isVerticalName(name: string): boolean {
  const chars = Array.from(name.trim());
  if (chars.length === 0 || chars.length > 8) return false;
  return /[぀-ヿ㐀-鿿豈-﫿]/.test(name);
}

export type IntroBox = { x: number; y: number; w: number; h: number };
export type IntroLayout = {
  vertical: boolean;
  /** 図版：表紙の写真と同じ箱を、最初はこの変形で小さく置く（終わりは変形なし）。 */
  plate: { scale: number; dx: number; dy: number };
  name: { left: number; top: number; fontSize: number };
  caption: { left: number; top: number };
};

/**
 * 図版と名前の置き場所。
 *
 * stage は見せ場を重ねる箱（表紙全体）、photo はその中での表紙の写真の箱。
 * 図版＋名前をひとまとまりとして、箱の中央に置く（図版だけを中央に置くと、
 * 名前のぶん右へ寄って見える）。
 */
export function introLayout(
  stage: { w: number; h: number },
  photo: IntroBox,
  vertical: boolean,
): IntroLayout {
  const narrow = stage.w < 640;
  const scale = narrow ? 0.4 : 0.36;
  const plateW = photo.w * scale;
  const plateH = photo.h * scale;
  if (vertical) {
    const fontSize = narrow ? 28 : 36;
    const gap = narrow ? 22 : 32;
    const left = (stage.w - (plateW + gap + fontSize)) / 2;
    const top = (stage.h - plateH) / 2 - (narrow ? 10 : 6);
    return {
      vertical,
      plate: { scale, dx: left - photo.x, dy: top - photo.y },
      name: { left: left + plateW + gap, top: top - 2, fontSize },
      caption: { left, top: top + plateH + (narrow ? 14 : 18) },
    };
  }
  const fontSize = narrow ? 18 : 22;
  const below = fontSize * 1.5 + 16;
  const left = (stage.w - plateW) / 2;
  const top = (stage.h - plateH - below) / 2;
  return {
    vertical,
    plate: { scale, dx: left - photo.x, dy: top - photo.y },
    name: { left, top: top + plateH + 16, fontSize },
    caption: { left, top: top + plateH + 16 + fontSize * 1.5 + 6 },
  };
}
