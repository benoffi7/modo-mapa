import { useState, useCallback } from 'react';
import type { Comment } from '../types';

interface UseCommentEditOptions {
  /** Called when saving the edit. Should throw on failure. */
  onSave: (commentId: string, newText: string) => Promise<void>;
  /** Called after successful save */
  onSaveComplete?: () => void;
}

export function useCommentEdit({ onSave, onSaveComplete }: UseCommentEditOptions) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const startEdit = useCallback((comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editText.trim()) return;
    setIsSavingEdit(true);
    try {
      await onSave(editingId, editText.trim());
      setEditingId(null);
      setEditText('');
      onSaveComplete?.();
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingId, editText, onSave, onSaveComplete]);

  return {
    editingId,
    editText,
    isSavingEdit,
    setEditText,
    startEdit,
    cancelEdit,
    saveEdit,
  };
}
