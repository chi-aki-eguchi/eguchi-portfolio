export function matchDateRecoveryPhoto<
  T extends { id: number; filename: string },
>(fileName: string, photos: T[]): T | null {
  const key = (name: string) => name.normalize("NFC").toLowerCase();
  const exact = photos.filter((photo) => key(photo.filename) === key(fileName));
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const stem = (name: string) => key(name).replace(/\.[^.]+$/, "");
  const matches = photos.filter(
    (photo) => stem(photo.filename) === stem(fileName),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function photoDateSourceLabel(
  source: string | null | undefined,
  film: boolean,
  ja: boolean,
) {
  if (source === "exif_original")
    return film
      ? ja
        ? "Exif・カメラ複写日時"
        : "EXIF camera scan time"
      : ja
        ? "Exif・撮影日時"
        : "EXIF capture time";
  if (source === "exif_digitized")
    return ja ? "Exif・デジタル化日時" : "EXIF digitization time";
  if (source === "file_modified")
    return ja
      ? "ファイル更新日（撮影日は未確認）"
      : "File modification time (capture date unverified)";
  if (source === "manual") return ja ? "手動設定" : "Manually set";
  return ja ? "日付の出所は未確認" : "Date source unverified";
}
