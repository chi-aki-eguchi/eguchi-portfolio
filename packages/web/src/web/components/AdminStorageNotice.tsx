import { Upload, X } from "lucide-react";
import { storageNotConfiguredNotice } from "../lib/upload-file";

// 「写真保存先」の状態表示。setup-health は環境変数の有無しか見ないため、
// 「接続済み」とは言い切らず「必要な設定は入力済み」と正確に伝える
// (誤ったBucket名・認証値でも緑になるので、実接続は最初のアップロードで
// 確認される旨を添える)。
export function StorageHealthLine({
  health,
  copy,
}: {
  health?: { storageConfigured: boolean; missingStorageVariables: string[] };
  copy: {
    configured: string;
    missingSummary: string;
    missingAction: string;
  };
}) {
  if (!health) return null;
  if (health.storageConfigured) {
    return (
      <p className="text-[11px] text-[color:var(--admin-muted)]">
        {copy.configured}
      </p>
    );
  }
  return (
    <div className="border border-amber-300 bg-amber-50 rounded-sm px-4 py-3 space-y-1">
      <p className="text-[12px] text-amber-900">
        {copy.missingSummary}
      </p>
      <p className="text-[11px] leading-5 text-amber-800">
        {copy.missingAction}
      </p>
    </div>
  );
}

// 保存先未接続(STORAGE_NOT_CONFIGURED)の専用バナー。通常のアップロード
// 失敗トーストと分け、自動では消えない(設定を直すまで何度試しても失敗
// するため)。missing は変数名のみで、値は絶対に受け取らない・表示しない。
export function StorageAlertBanner({
  missing,
  canRetry,
  onRetry,
  onClose,
  copy,
}: {
  missing: string[];
  canRetry: boolean;
  onRetry: () => void;
  onClose: () => void;
  copy?: {
    title: string;
    close: string;
    missing: string;
    detail: string;
    handoff: string;
    retry: string;
  };
}) {
  const notice = storageNotConfiguredNotice(missing);
  const title = copy?.title ?? notice.title;
  const detail = copy?.detail ?? notice.detail;
  const handoff = copy?.handoff ?? notice.handoff;
  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(560px,90vw)] bg-[var(--admin-paper-soft)] border border-amber-700/60 rounded-sm shadow-xl px-5 py-4 space-y-2"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-[var(--admin-ink)]">{title}</p>
        <button
          onClick={onClose}
          aria-label={copy?.close ?? "閉じる"}
          className="text-[var(--admin-muted)] hover:text-[var(--admin-ink)] transition-colors flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>
      {missing.length > 0 && (
        <p className="text-[12px] leading-5 text-amber-800">
          {copy?.missing ?? "写真の追加に必要な準備が完了していません。"}
        </p>
      )}
      <p className="text-[12px] leading-5 text-[var(--admin-muted)]">
        {detail}
      </p>
      <p className="text-[12px] leading-5 text-[var(--admin-muted)]">
        {handoff}
      </p>
      {canRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 text-[11px] text-[var(--admin-ink)] underline underline-offset-2 hover:opacity-70 transition-opacity"
        >
          <Upload size={11} /> {copy?.retry ?? "設定を直したあとに再試行する"}
        </button>
      )}
    </div>
  );
}
