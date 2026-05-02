import { useState, useRef, useCallback } from 'react';

interface UseUnsavedChangesReturn {
  isDirty: boolean;
  confirmClose: (onClose: () => void) => void;
  dialogProps: {
    open: boolean;
    onKeepEditing: () => void;
    onDiscard: () => void;
  };
}

/**
 * Tracks unsaved string-form values and gates close with a confirmation dialog.
 *
 * @remarks
 * The current API is variadic (`...values: string[]`). A caller that passes
 * a non-string (object, null, undefined) crashes the internal `.trim()` call.
 * This is acceptable while all callsites pass primitive form fields, but the
 * variadic shape makes it possible to misuse silently. Followup tracked in
 * the backlog to migrate to an explicit shape (e.g. `Record<string, string>`
 * or a precomputed `isDirty: boolean`).
 */
export function useUnsavedChanges(...values: string[]): UseUnsavedChangesReturn {
  const isDirty = values.some((v) => v.trim().length > 0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingClose = useRef<(() => void) | null>(null);

  const confirmClose = useCallback(
    (onClose: () => void) => {
      if (!isDirty) {
        onClose();
        return;
      }
      pendingClose.current = onClose;
      setDialogOpen(true);
    },
    [isDirty],
  );

  const onDiscard = useCallback(() => {
    setDialogOpen(false);
    pendingClose.current?.();
    pendingClose.current = null;
  }, []);

  const onKeepEditing = useCallback(() => {
    setDialogOpen(false);
    pendingClose.current = null;
  }, []);

  return {
    isDirty,
    confirmClose,
    dialogProps: {
      open: dialogOpen,
      onKeepEditing,
      onDiscard,
    },
  };
}
