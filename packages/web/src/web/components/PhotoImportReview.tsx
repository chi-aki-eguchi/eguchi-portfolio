import { useEffect, useState } from "react";
import { readPhotoDates, type PhotoDates } from "../../shared/photo-dates";
import {
  imageFileTooLarge,
  isUploadableImageFile,
  uploadSizeLimitLabel,
} from "../lib/upload-file";
import { shotAtWithSourceForUploadedPhoto } from "../lib/upload-date";

export type ImportDatePolicy = "exif" | "file";
export function PhotoImportReview({
  files,
  medium,
  onMedium,
  onImport,
  language,
}: {
  files: File[];
  medium: "digital" | "film";
  onMedium: (medium: "digital" | "film") => void;
  onImport: (files: File[], policy: ImportDatePolicy) => void;
  language: string;
}) {
  const ja = language === "ja";
  const [dates, setDates] = useState<Map<File, PhotoDates> | null>(null);
  const [policy, setPolicy] = useState<ImportDatePolicy>("exif");
  const [showAll, setShowAll] = useState(false);
  const accepted = files.filter(
    (file) => isUploadableImageFile(file) && !imageFileTooLarge(file),
  );
  useEffect(() => {
    let active = true;
    setDates(null);
    (async () => {
      const result = new Map<File, PhotoDates>();
      for (const file of files) {
        if (!isUploadableImageFile(file) || imageFileTooLarge(file)) continue;
        try {
          result.set(file, await readPhotoDates(file));
        } catch {
          result.set(file, { original: null, digitized: null });
        }
        if (!active) return;
      }
      if (active) setDates(result);
    })();
    return () => {
      active = false;
    };
  }, [files]);
  const missing = accepted.filter(
    (file) => !dates?.get(file)?.original && !dates?.get(file)?.digitized,
  ).length;
  return (
    <div className="admin-import-review">
      <fieldset className="admin-import-medium">
        <legend>{ja ? "写真の種類" : "Photograph type"}</legend>
        {(["digital", "film"] as const).map((value) => (
          <label
            key={value}
            aria-label={
              value === "digital"
                ? ja
                  ? "デジタル写真"
                  : "Digital photographs"
                : ja
                  ? "フィルムのスキャン"
                  : "Film scans"
            }
          >
            <input
              type="radio"
              name="import-medium"
              checked={medium === value}
              onChange={() => onMedium(value)}
            />
            <span>
              <strong>
                {value === "digital"
                  ? ja
                    ? "デジタル写真"
                    : "Digital photographs"
                  : ja
                    ? "フィルムのスキャン"
                    : "Film scans"}
              </strong>
              <small>
                {value === "digital"
                  ? ja
                    ? "Exifの撮影日時で並べる"
                    : "Order by camera capture time"
                  : ja
                    ? "カメラ複写・スキャナーの日時で並べる"
                    : "Order by camera scan / digitization time"}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      <p>
        {ja
          ? "TIFも取り込めます。サイト用JPEGを作成します。元ファイルは手元で保管してください。"
          : "TIF is supported. A JPEG is created for the site; keep your source files locally."}
      </p>
      {!dates ? (
        <output>
          {ja ? "ファイルの日時を確認中…" : "Reading file dates…"}
        </output>
      ) : (
        <>
          <div className="admin-import-summary">
            <strong>
              {ja
                ? `${accepted.length}枚を取り込み`
                : `${accepted.length} photographs`}
            </strong>
            <span>
              {ja
                ? `Exif日時あり ${accepted.length - missing} / 日時なし ${missing}`
                : `With date ${accepted.length - missing} / Missing ${missing}`}
            </span>
          </div>
          {missing > 0 && (
            <label className="admin-import-date-policy">
              <span>
                {ja ? "Exif日時がない写真" : "When EXIF dates are missing"}
              </span>
              <select
                value={policy}
                onChange={(e) => setPolicy(e.target.value as ImportDatePolicy)}
              >
                <option value="exif">
                  {ja
                    ? "日付を空欄にする（日時順では末尾）"
                    : "Leave empty (last in date order)"}
                </option>
                <option value="file">
                  {ja
                    ? "ファイル更新日を使う（撮影・スキャン日とは限りません）"
                    : "Use file modification time (may be an export date)"}
                </option>
              </select>
            </label>
          )}
          <div className="admin-import-file-list">
            <table>
              <thead>
                <tr>
                  <th>{ja ? "ファイル" : "File"}</th>
                  <th>
                    {medium === "film"
                      ? ja
                        ? "スキャン日時"
                        : "Scan date"
                      : ja
                        ? "撮影日時"
                        : "Capture date"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? accepted : accepted.slice(0, 80)).map(
                  (file, index) => {
                    const source = dates.get(file);
                    const date = shotAtWithSourceForUploadedPhoto(
                      source?.original,
                      source?.digitized,
                      file,
                      medium,
                    );
                    const fallback = !date.shotAt && policy === "file";
                    return (
                      <tr key={index}>
                        <td>
                          {file.name}
                          <small>
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </small>
                        </td>
                        <td>
                          {date.shotAt?.replace("T", " ") ||
                            (fallback
                              ? new Date(file.lastModified).toLocaleString(
                                  ja ? "ja-JP" : "en-US",
                                )
                              : ja
                                ? "日時なし"
                                : "No date")}
                          <small>
                            {date.shotAt
                              ? "Exif / XMP"
                              : fallback
                                ? ja
                                  ? "ファイル更新日"
                                  : "File modified"
                                : ja
                                  ? "取り込み後に設定できます"
                                  : "Can be set after import"}
                          </small>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
            {!showAll && accepted.length > 80 && (
              <button type="button" onClick={() => setShowAll(true)}>
                {ja ? "残りのファイルも確認" : "Show remaining files"}
              </button>
            )}
          </div>
        </>
      )}
      {files.length > accepted.length && (
        <output>
          {ja
            ? `${files.length - accepted.length}件は対象外です。対応画像・${uploadSizeLimitLabel()}以下のファイルを選んでください。`
            : `${files.length - accepted.length} files excluded. Use supported images up to ${uploadSizeLimitLabel()}.`}
        </output>
      )}
      <footer>
        <span>
          {ja ? "日付は後から変更できます" : "Dates can be changed later"}
        </span>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={!dates || !accepted.length}
          onClick={() => onImport(accepted, policy)}
        >
          {ja
            ? `${accepted.length}枚を取り込む`
            : `Import ${accepted.length} photographs`}
        </button>
      </footer>
    </div>
  );
}
