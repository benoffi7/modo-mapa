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
