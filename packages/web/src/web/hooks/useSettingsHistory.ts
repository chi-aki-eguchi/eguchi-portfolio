import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
type Draft = Record<string, string>;

export function useSettingsHistory(draft: Draft, setDraft: Dispatch<SetStateAction<Draft>>) {
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const undoStack = useRef<Draft[]>([]), redoStack = useRef<Draft[]>([]);
  const lastEdit = useRef({ key: "", at: 0 });
  const [, refresh] = useState(0);
  const apply = useCallback((values: Draft, key = "") => {
      const current = currentDraft.current;
      if (Object.entries(values).every(([k, v]) => current[k] === v)) return;
      const now = Date.now();
      if (!key || key !== lastEdit.current.key || now - lastEdit.current.at > 500 || !undoStack.current.length)
        undoStack.current = [...undoStack.current.slice(-79), { ...current }];
      lastEdit.current = { key, at: now };
      redoStack.current = [];
      currentDraft.current = { ...current, ...values };
      setDraft(currentDraft.current);
      refresh(n => n + 1);
  }, [setDraft]);
  const update = useCallback((key: string, value: string) => apply({ [key]: value }, key), [apply]);
  const step = useCallback((undo: boolean) => {
    const from = undo ? undoStack : redoStack, to = undo ? redoStack : undoStack;
    const next = from.current.pop();
    if (!next) return;
    to.current.push({ ...currentDraft.current });
    currentDraft.current = next;
    setDraft(next);
    lastEdit.current = { key: "", at: 0 };
    refresh(n => n + 1);
  }, [setDraft]);
  const clear = useCallback(() => {
    undoStack.current = []; redoStack.current = []; lastEdit.current = { key: "", at: 0 };
    refresh(n => n + 1);
  }, []);
  return { update, apply, undo: () => step(true), redo: () => step(false), clear,
    canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0 };
}
