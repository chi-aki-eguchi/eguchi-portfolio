// 実データ496枚の実測に基づく暫定値。間隔の分布は6〜24時間が谷で9/495個。
// 運用しながら調整する。
export const BAND_GAP_HOURS = 12;
export const BAND_MIN_PHOTOS = 5;

const BAND_GAP_MS = BAND_GAP_HOURS * 60 * 60 * 1000;

export type PhotoBandPhoto = {
  id: string | number;
  shotAt?: string | null;
  createdAt?: string | number | null;
};

type PhotoBandBase<T extends PhotoBandPhoto> = {
  id: string;
  photos: readonly T[];
  firstPhoto: T;
  photoCount: number;
  startAt: string | null;
  endAt: string | null;
};

export type AutomaticPhotoSheet<T extends PhotoBandPhoto> = PhotoBandBase<T> & {
  kind: "sheet";
  source: "auto";
};

// A later manual grouping feature can add ManualPhotoSheet values to the same
// PhotoBandItem array. Shared fields keep the screen independent of how a
// sheet was created.
export type ManualPhotoSheet<T extends PhotoBandPhoto> = PhotoBandBase<T> & {
  kind: "sheet";
  source: "manual";
};

export type PhotoFlow<T extends PhotoBandPhoto> = PhotoBandBase<T> & {
  kind: "flow";
  source: "auto";
};

export type AutomaticPhotoBandItem<T extends PhotoBandPhoto> =
  | AutomaticPhotoSheet<T>
  | PhotoFlow<T>;

export type PhotoBandItem<T extends PhotoBandPhoto> =
  | AutomaticPhotoBandItem<T>
  | ManualPhotoSheet<T>;

type TimedPhoto<T extends PhotoBandPhoto> = {
  photo: T;
  time: number;
};

function timeValue(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function photoTime(photo: PhotoBandPhoto): number | null {
  // shotAtが無い、または日時として読めない場合は、既存の写真並べ替えと同じく
  // createdAtを使う。どちらも無い写真は、近さを推測して束ねると誤った関係を
  // 作るため、日時なしの単独flowとして扱う。
  return timeValue(photo.shotAt) ?? timeValue(photo.createdAt);
}

function identityKey(photo: PhotoBandPhoto): string {
  return `${typeof photo.id}:${String(photo.id)}`;
}

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function membershipHash(photos: readonly PhotoBandPhoto[]): string {
  const membership = photos
    .map(identityKey)
    .sort(compareText)
    .join("\u001f");
  let hash = 0xcbf29ce484222325n;
  for (const character of membership) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(36);
}

function automaticId(
  kind: AutomaticPhotoBandItem<PhotoBandPhoto>["kind"],
  photos: readonly PhotoBandPhoto[],
): string {
  return `auto-${kind}:${photos.length}:${membershipHash(photos)}`;
}

function timedItem<T extends PhotoBandPhoto>(
  entries: readonly TimedPhoto<T>[],
): AutomaticPhotoBandItem<T> {
  const first = entries[0];
  const last = entries[entries.length - 1];
  if (!first || !last) {
    throw new Error("A photo band cannot be empty");
  }

  const photos = entries.map(({ photo }) => photo);
  const kind = photos.length >= BAND_MIN_PHOTOS ? "sheet" : "flow";
  return {
    id: automaticId(kind, photos),
    kind,
    source: "auto",
    photos,
    firstPhoto: first.photo,
    photoCount: photos.length,
    startAt: new Date(first.time).toISOString(),
    endAt: new Date(last.time).toISOString(),
  };
}

function undatedFlow<T extends PhotoBandPhoto>(photo: T): PhotoFlow<T> {
  return {
    id: automaticId("flow", [photo]),
    kind: "flow",
    source: "auto",
    photos: [photo],
    firstPhoto: photo,
    photoCount: 1,
    startAt: null,
    endAt: null,
  };
}

/**
 * Returns automatic sheets and flows in chronological order (oldest first).
 * The input array and its photo objects are never changed.
 *
 * 区切りは隣り合う2枚の間隔だけで決まるため、1枚ずつが BAND_GAP_HOURS 以内で
 * つながり続ける限り、全体が何日にわたっても1つのシートになる。これは仕様であり
 * 不具合ではない。実データ496枚では6〜24時間の間隔が495個中9個しかなく、
 * この連鎖はほぼ起きない。シート1つの上限期間を設けるかはまだ決めていない。
 */
export function buildPhotoBands<T extends PhotoBandPhoto>(
  photos: readonly T[],
): AutomaticPhotoBandItem<T>[] {
  const timed: TimedPhoto<T>[] = [];
  const undated: T[] = [];

  for (const photo of photos) {
    const time = photoTime(photo);
    if (time === null) {
      undated.push(photo);
    } else {
      timed.push({ photo, time });
    }
  }

  timed.sort(
    (a, b) =>
      a.time - b.time ||
      compareText(identityKey(a.photo), identityKey(b.photo)),
  );
  undated.sort((a, b) =>
    compareText(identityKey(a), identityKey(b)),
  );

  const result: AutomaticPhotoBandItem<T>[] = [];
  let candidate: TimedPhoto<T>[] = [];

  for (const entry of timed) {
    const previous = candidate[candidate.length - 1];
    if (previous && entry.time - previous.time > BAND_GAP_MS) {
      result.push(timedItem(candidate));
      candidate = [];
    }
    candidate.push(entry);
  }

  if (candidate.length > 0) {
    result.push(timedItem(candidate));
  }

  // Unknown dates cannot be placed on the timeline, so they follow all dated
  // items in deterministic ID order and remain separate from each other.
  result.push(...undated.map(undatedFlow));
  return result;
}
