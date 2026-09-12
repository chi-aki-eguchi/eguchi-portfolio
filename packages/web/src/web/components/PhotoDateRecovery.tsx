import { useState } from "react";
import { readPhotoDates } from "../../shared/photo-dates";
import {
  shotAtWithSourceForUploadedPhoto,
  type ShotAtSource,
} from "../lib/upload-date";
import { matchDateRecoveryPhoto } from "../lib/photo-date-recovery";
import { adminApi } from "../lib/api";
import { assertOk } from "../pages/admin-shared";

type RecoveryPhoto = {
  id: number;
  filename: string;
  shotAt?: string | null;
  filmType?: string | null;
};
type Proposal = {
  photo: RecoveryPhoto;
  fileName: string;
  date: string;
  source: ShotAtSource;
  error?: string;
  saved?: boolean;
};
export function PhotoDateRecovery({
  photos,
  language,
  onUpdated,
  onBusy,
}: {
  photos: RecoveryPhoto[];
  language: string;
  onUpdated: (
    updates: { id: number; shotAt: string; shotAtSource: ShotAtSource }[],
  ) => void;
  onBusy: (busy: boolean) => void;
}) {
  const ja = language === "ja";
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const read = async (files: File[]) => {
    setBusy(true);
    onBusy(true);
    setNotice("");
    const result: Proposal[] = [];
    const seen = new Set<number>();
    let skipped = 0;
    for (const file of files) {
      const photo = matchDateRecoveryPhoto(file.name, photos);
      if (!photo || seen.has(photo.id)) {
        skipped++;
        continue;
      }
      seen.add(photo.id);
      try {
        const dates = await readPhotoDates(file);
        const picked = shotAtWithSourceForUploadedPhoto(
          dates.original,
          dates.digitized,
          file,
          photo.filmType === "デジタル" ? "digital" : "film",
        );
        result.push({
          photo,
          fileName: file.name,
          date: picked.shotAt,
          source: picked.shotAtSource,
        });
      } catch {
        result.push({ photo, fileName: file.name, date: "", source: "none" });
      }
    }
    setProposals(result);
    setNotice(
      skipped
        ? ja
          ? `${skipped}件は名前が一致しないか、重複しているため対象外です。`
          : `${skipped} unmatched or duplicate files excluded.`
        : "",
    );
    setBusy(false);
    onBusy(false);
  };
  const applicable = proposals.filter((p) => p.date && !p.saved);
  const apply = async () => {
    setBusy(true);
    onBusy(true);
    const next = [...proposals];
    const updated: Parameters<typeof onUpdated>[0] = [];
    for (const proposal of applicable) {
      const index = next.indexOf(proposal);
      try {
        const res = await adminApi.photos[":id"].$patch({
          param: { id: String(proposal.photo.id) },
          json: { shotAt: proposal.date, shotAtSource: proposal.source },
        });
        assertOk(res);
        next[index] = { ...proposal, saved: true, error: undefined };
        updated.push({
          id: proposal.photo.id,
          shotAt: proposal.date,
          shotAtSource: proposal.source,
        });
      } catch {
        next[index] = {
          ...proposal,
          error: ja ? "保存できませんでした" : "Could not save",
        };
      }
    }
    setProposals(next);
    setBusy(false);
    onBusy(false);
    if (updated.length) onUpdated(updated);
  };
  return (
    <div className="admin-import-review">
      <p>
        {ja
          ? "元ファイルや同じ名前の書き出し前の写真から、Exif日時だけを読み直します。画像・分類・掲載順はそのままです。"
          : "Read EXIF dates from source files or earlier exports with matching names. Images, classification and manual order are preserved."}
      </p>
      <label className="admin-date-recovery-input">
        <span>
          {ja
            ? `${photos.length}枚の元ファイルを選ぶ`
            : `Choose source files for ${photos.length} photographs`}
        </span>
        <input
          type="file"
          multiple
          disabled={busy}
          aria-label={
            ja ? "日付を読み直す元ファイル" : "Source files for date recovery"
          }
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void read(files);
          }}
        />
      </label>
      <p>
        {ja
          ? "ファイルはこの端末内で読み取ります。同名が複数ある写真は誤更新を避けるため対象外にします。"
          : "Files are read on this device. Ambiguous names are excluded."}
      </p>
      {busy && <output>{ja ? "処理中…" : "Working…"}</output>}
      {notice && <output>{notice}</output>}
      {proposals.length > 0 && (
        <div className="admin-import-file-list">
          <table>
            <thead>
              <tr>
                <th>{ja ? "写真" : "Photograph"}</th>
                <th>
                  {ja
                    ? "現在の日付 → 読み直した日時"
                    : "Current → recovered date"}
                </th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.photo.id}>
                  <td>
                    {p.photo.filename}
                    <small>{p.fileName}</small>
                  </td>
                  <td>
                    <small>{p.photo.shotAt?.replace("T", " ") || "—"}</small>
                    {p.date?.replace("T", " ") ||
                      (ja
                        ? "Exif日時なし・変更しません"
                        : "No EXIF date; unchanged")}
                    {p.saved && <strong>{ja ? " 保存済み" : " Saved"}</strong>}
                    {p.error && <span role="alert">{p.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <footer>
        <span>
          {ja
            ? "Exifがない場合は、元の撮影・複写ファイルを選んでください"
            : "If EXIF is missing, choose the original capture / scan"}
        </span>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || !applicable.length}
          onClick={() => void apply()}
        >
          {ja
            ? `${applicable.length}枚の日付を更新`
            : `Update ${applicable.length} dates`}
        </button>
      </footer>
    </div>
  );
}
