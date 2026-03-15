import { useState, useRef, useEffect, useCallback } from 'react';

interface UseUndoDeleteOptions<T> {
  onConfirmDelete: (item: T) => Promise<void>;
  onDeleteComplete?: () => void;
  timeout?: number;
  message?: string;
}

interface SnackbarProps {
  open: boolean;
  message: string;
  onUndo: () => void;
  autoHideDuration: number;
  onClose: () => void;
}

interface UseUndoDeleteReturn<T> {
  isPendingDelete: (id: string) => boolean;
  markForDelete: (id: string, item: T) => void;
  undoDelete: (id: string) => void;
  undoLast: () => void;
  snackbarProps: SnackbarProps;
}

export function useUndoDelete<T>(
  options: UseUndoDeleteOptions<T>,
): UseUndoDeleteReturn<T> {
  const { onConfirmDelete, onDeleteComplete, timeout = 5000, message = 'Eliminado' } = options;
  const pendingRef = useRef<Map<string, { item: T; timer: ReturnType<typeof setTimeout> }>>(
    new Map(),
  );
  const [lastDeletedId, setLastDeletedId] = useState<string | null>(null);
  const lastDeletedIdRef = useRef<string | null>(null);

  // Sync ref with state (must be in effect, not during render)
  useEffect(() => {
    lastDeletedIdRef.current = lastDeletedId;
  }, [lastDeletedId]);

  // Cleanup ALL timers on unmount — deletes are cancelled silently
  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      for (const { timer } of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    };
  }, []);

  const confirmDelete = useCallback(
    async (id: string) => {
      const entry = pendingRef.current.get(id);
      if (!entry) return;
      pendingRef.current.delete(id);
      try {
        await onConfirmDelete(entry.item);
        onDeleteComplete?.();
      } catch {
        // Item already removed from UI, nothing to revert visually
      }
      if (lastDeletedIdRef.current === id) setLastDeletedId(null);
    },
    [onConfirmDelete, onDeleteComplete],
  );

  const markForDelete = useCallback(
    (id: string, item: T) => {
      const existing = pendingRef.current.get(id);
      if (existing) clearTimeout(existing.timer);

      const timer = setTimeout(() => confirmDelete(id), timeout);
      pendingRef.current.set(id, { item, timer });
      setLastDeletedId(id);
    },
    [confirmDelete, timeout],
  );

  const undoDelete = useCallback((id: string) => {
    const entry = pendingRef.current.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      pendingRef.current.delete(id);
    }
    setLastDeletedId((prev) => (prev === id ? null : prev));
  }, []);

  const undoLast = useCallback(() => {
    const id = lastDeletedIdRef.current;
    if (id) undoDelete(id);
  }, [undoDelete]);

  const isPendingDelete = useCallback(
    (id: string) => pendingRef.current.has(id),
    [],
  );

  const snackbarProps: SnackbarProps = {
    open: lastDeletedId !== null,
    message,
    onUndo: undoLast,
    autoHideDuration: timeout,
    onClose: () => setLastDeletedId(null),
  };

  return { isPendingDelete, markForDelete, undoDelete, undoLast, snackbarProps };
}
