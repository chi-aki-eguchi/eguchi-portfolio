import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Undo2,
  X,
} from "lucide-react";

export type ReorderBarTarget = {
  id: number;
  thumbnailSrc: string;
  title: string;
  position: number;
  total: number;
};

export type ReorderBarFeedback = {
  state: "saving" | "saved" | "error";
  message: string;
} | null;

export function AdminReorderBar({
  scope = "library",
  target,
  busy,
  feedback,
  moveSummary,
  undoAvailable,
  positionValue,
  positionInvalid,
  labels,
  onMoveFirst,
  onMovePrevious,
  onMoveNext,
  onMoveLast,
  onPositionChange,
  onMoveToPosition,
  onUndo,
  onChooseAgain,
  destructiveAction,
}: {
  scope?: "library" | "hero";
  target: ReorderBarTarget;
  busy: boolean;
  feedback: ReorderBarFeedback;
  moveSummary: string | null;
  undoAvailable: boolean;
  positionValue: string;
  positionInvalid: boolean;
  labels: {
    region: string;
    position: string;
    moveFirst: string;
    movePrevious: string;
    moveNext: string;
    moveLast: string;
    positionInput: string;
    moveAction: string;
    undo: string;
    chooseAgain: string;
    invalidPosition: string;
  };
  onMoveFirst: () => void;
  onMovePrevious: () => void;
  onMoveNext: () => void;
  onMoveLast: () => void;
  onPositionChange: (value: string) => void;
  onMoveToPosition: () => void;
  onUndo: () => void;
  onChooseAgain: () => void;
  destructiveAction?: {
    label: string;
    onAction: () => void;
    disabled?: boolean;
  };
}) {
  const atFirst = target.position <= 1;
  const atLast = target.position >= target.total;
  const positionInputId = `${scope}-reorder-position`;

  return (
    <section
      aria-label={labels.region}
      data-library-reorder-bar
      data-library-reorder-target={target.id}
      data-admin-reorder-scope={scope}
      className="admin-library-action-bar admin-library-reorder-bar"
    >
      <div className="admin-library-reorder-bar__identity">
        <img
          src={target.thumbnailSrc}
          alt=""
          className="admin-library-reorder-bar__thumb"
          draggable={false}
        />
        <div className="min-w-0">
          <p className="truncate text-[length:var(--admin-text-body)] text-[var(--admin-ink)]">
            {target.title}
          </p>
          <p
            data-library-reorder-position
            className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]"
          >
            {labels.position}
          </p>
        </div>
      </div>

      <div
        className="admin-library-reorder-bar__moves"
        aria-label={labels.region}
      >
        <button
          type="button"
          onClick={onMoveFirst}
          disabled={busy || atFirst}
          aria-label={labels.moveFirst}
          title={labels.moveFirst}
          className="admin-library-action-bar__icon"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          type="button"
          onClick={onMovePrevious}
          disabled={busy || atFirst}
          aria-label={labels.movePrevious}
          title={labels.movePrevious}
          className="admin-library-action-bar__icon"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={onMoveNext}
          disabled={busy || atLast}
          aria-label={labels.moveNext}
          title={labels.moveNext}
          className="admin-library-action-bar__icon"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={onMoveLast}
          disabled={busy || atLast}
          aria-label={labels.moveLast}
          title={labels.moveLast}
          className="admin-library-action-bar__icon"
        >
          <ChevronsRight size={16} />
        </button>
      </div>

      <form
        className="admin-library-reorder-bar__position"
        onSubmit={(event) => {
          event.preventDefault();
          if (!positionInvalid && !busy) onMoveToPosition();
        }}
      >
        <label className="sr-only" htmlFor={positionInputId}>
          {labels.positionInput}
        </label>
        <input
          id={positionInputId}
          data-library-position-input
          type="number"
          inputMode="numeric"
          min={1}
          max={target.total}
          step={1}
          value={positionValue}
          onChange={(event) => onPositionChange(event.target.value)}
          aria-invalid={positionInvalid || undefined}
          aria-describedby={
            positionInvalid ? "library-reorder-position-error" : undefined
          }
          disabled={busy}
          className="admin-library-reorder-bar__input"
        />
        <span className="text-[length:var(--admin-text-note)] text-[var(--admin-muted)]">
          / {target.total}
        </span>
        <button
          type="submit"
          disabled={busy || positionInvalid}
          className="admin-library-action-bar__button admin-btn-primary"
        >
          {labels.moveAction}
        </button>
        {positionInvalid && (
          <span
            id="library-reorder-position-error"
            className="basis-full text-[length:var(--admin-text-note)] text-[var(--admin-warning)]"
          >
            {labels.invalidPosition}
          </span>
        )}
      </form>

      <div
        data-library-reorder-announcement
        data-library-reorder-status={feedback?.state ?? "idle"}
        role={feedback?.state === "error" ? "alert" : "status"}
        aria-live="polite"
        className="admin-library-reorder-bar__status"
      >
        {feedback?.state === "saving" && (
          <Loader2 size={13} className="animate-spin" />
        )}
        <span>{feedback?.message ?? moveSummary ?? "\u00a0"}</span>
        {feedback?.state === "saved" && moveSummary && (
          <span className="text-[var(--admin-muted)]">· {moveSummary}</span>
        )}
        {undoAvailable && !busy && (
          <button
            type="button"
            data-library-reorder-undo
            onClick={onUndo}
            className="admin-library-action-bar__button"
          >
            <Undo2 size={13} />
            {labels.undo}
          </button>
        )}
      </div>

      <div className="admin-library-reorder-bar__choose">
        <button
          type="button"
          onClick={onChooseAgain}
          disabled={busy}
          className="admin-library-action-bar__button"
        >
          <X size={13} />
          {labels.chooseAgain}
        </button>
        {destructiveAction && (
          <button
            type="button"
            onClick={destructiveAction.onAction}
            disabled={busy || destructiveAction.disabled}
            aria-label={destructiveAction.label}
            className="admin-text-danger admin-library-action-bar__button"
          >
            {destructiveAction.label}
          </button>
        )}
      </div>
    </section>
  );
}
