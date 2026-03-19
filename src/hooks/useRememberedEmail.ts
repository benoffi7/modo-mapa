import { useState, useCallback } from 'react';
import { STORAGE_KEY_REMEMBERED_EMAIL } from '../constants/storage';

export function useRememberedEmail() {
  const [email, setEmail] = useState(() => localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL) ?? '');
  const [remember, setRemember] = useState(() => !!localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL));

  const save = useCallback((emailToSave: string) => {
    if (remember) localStorage.setItem(STORAGE_KEY_REMEMBERED_EMAIL, emailToSave);
  }, [remember]);

  const toggleRemember = useCallback((_: unknown, checked: boolean) => {
    setRemember(checked);
    if (!checked) localStorage.removeItem(STORAGE_KEY_REMEMBERED_EMAIL);
  }, []);

  const reset = useCallback(() => {
    setEmail(localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL) ?? '');
  }, []);

  return { email, setEmail, remember, toggleRemember, save, reset };
}
