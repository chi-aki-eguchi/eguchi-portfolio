/**
 * 新しい構成（siteDesign = "develop"、2026-10-10）で API と画面の両方が使う決まり。
 *
 * 扉は Portrait／Life／Series／Info の4つ。今までのページ（Gallery・Series・Work・
 * About・Contact・英語・方針）は無くさず、同じ住所でそのまま開ける。
 * 増えるのは下の3つの住所だけで、今までの構成のサイトでは今までどおり 404。
 */
export const DEVELOP_ONLY_PATHS = ["/portrait", "/life", "/info"] as const;

export function isDevelopDesignValue(value: string | null | undefined): boolean {
  return value === "develop";
}

export function isDevelopOnlyPath(pathname: string): boolean {
  return (DEVELOP_ONLY_PATHS as readonly string[]).includes(pathname);
}

export type DevelopListKind = "portrait" | "life";

/**
 * 扉（メニューの4つの入口）の名前と添え書き（2026-10-13）。
 *
 * 初めの値は下のとおり。管理画面の「ページの写真」→「扉の名前」で変えられ、設定 `developDoors` に
 * JSON で入る：`{"portrait":["Portrait","人を撮る"], …}`（変えた扉だけ入れる。空なら全部初めの値）。
 * 添え書きは初めは無し（2026-10-23）。扉の写真と名前で行き先は分かるので、言葉を足さない。
 * メニュー・トップの扉の目次・スマホのメニュー・ページの見出し・検索や共有に出る題名が、同じ言葉を使う。
 */
export type DevelopDoorKey = "portrait" | "life" | "series" | "info";
export type DevelopDoorCopy = Record<DevelopDoorKey, { label: string; note: string }>;
export const DEVELOP_DOOR_KEYS: readonly DevelopDoorKey[] = ["portrait", "life", "series", "info"];
export const DEVELOP_DOOR_DEFAULTS: DevelopDoorCopy = {
  portrait: { label: "Portrait", note: "" },
  life: { label: "Life", note: "" },
  series: { label: "Series", note: "" },
  info: { label: "Info", note: "" },
};
/** 名前は 24 文字、添え書きは 30 文字まで（メニューの1行に収まる長さ）。 */
export const DEVELOP_DOOR_LABEL_MAX = 24;
export const DEVELOP_DOOR_NOTE_MAX = 30;

/** 改行や見えない制御文字を空白にし、前後を詰めて、長さを止める。 */
function tidyDoorText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(text).slice(0, max).join("");
}

/**
 * 設定の文字列から、扉の名前と添え書きを読む。壊れた値・足りない扉・空の名前は、初めの値で補う
 * （メニューから名前の無い項目を出さない）。添え書きは空にできる（出さない）。
 */
export function developDoorCopy(value: string | null | undefined): DevelopDoorCopy {
  const copy: DevelopDoorCopy = {
    portrait: { ...DEVELOP_DOOR_DEFAULTS.portrait },
    life: { ...DEVELOP_DOOR_DEFAULTS.life },
    series: { ...DEVELOP_DOOR_DEFAULTS.series },
    info: { ...DEVELOP_DOOR_DEFAULTS.info },
  };
  if (!value) return copy;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return copy;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return copy;
  for (const key of DEVELOP_DOOR_KEYS) {
    const entry = (parsed as Record<string, unknown>)[key];
    if (!Array.isArray(entry)) continue;
    const label = tidyDoorText(entry[0], DEVELOP_DOOR_LABEL_MAX);
    const note = tidyDoorText(entry[1], DEVELOP_DOOR_NOTE_MAX);
    if (label) copy[key].label = label;
    if (note !== null) copy[key].note = note;
  }
  return copy;
}

/** 保存する文字列。初めの値のままの扉は入れない（全部そのままなら空＝設定なし）。 */
export function serializeDevelopDoors(copy: DevelopDoorCopy): string {
  const tidy = developDoorCopy(
    JSON.stringify(Object.fromEntries(DEVELOP_DOOR_KEYS.map((key) => [key, [copy[key].label, copy[key].note]]))),
  );
  const changed = DEVELOP_DOOR_KEYS.filter(
    (key) => tidy[key].label !== DEVELOP_DOOR_DEFAULTS[key].label || tidy[key].note !== DEVELOP_DOOR_DEFAULTS[key].note,
  );
  if (changed.length === 0) return "";
  return JSON.stringify(Object.fromEntries(changed.map((key) => [key, [tidy[key].label, tidy[key].note]])));
}

/** "12, 7,12 ,x" → [12, 7]。重複は最初の1つを残す（`web/lib/top-works-ids.ts` と同じ読み方）。 */
export function parsePhotoIdList(value: string | null | undefined): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const part of (value ?? "").split(",")) {
    const id = parseInt(part.trim(), 10);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Portrait／Life に出す写真。
 *
 * 1. 選んだ写真があれば（設定 `developPortraitIds`／`developLifeIds`）、その写真を選んだ順で。
 *    公開していない・消した写真のIDは飛ばす。
 * 2. 選んでいなければ（または選んだ写真が1枚も残っていなければ）写真の分類から出す：
 *    Portrait は分類が portrait の写真、Life は portrait 以外の分類が付いた写真
 *    （life・nature など）。分類の無い写真はどちらにも出さない（全部の写真は Gallery）。
 *    並びは渡された順のまま（呼ぶ側が管理画面の並び順で渡す）。
 */
export function developListPhotos<T extends { id?: number; category?: string | null }>(
  kind: DevelopListKind,
  photos: T[],
  picked?: string | null,
): T[] {
  const ids = parsePhotoIdList(picked);
  if (ids.length > 0) {
    const byId = new Map(photos.map((p) => [p.id, p]));
    const chosen = ids.map((id) => byId.get(id)).filter((p): p is T => Boolean(p));
    if (chosen.length > 0) return chosen;
  }
  return photos.filter((p) => {
    const c = (p.category ?? "").trim();
    return kind === "portrait" ? c === "portrait" : c !== "" && c !== "portrait";
  });
}
