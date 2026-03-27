import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STORAGE_KEY_REMEMBERED_EMAIL } from '../constants/storage';

import { useRememberedEmail } from './useRememberedEmail';

describe('useRememberedEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with empty email when nothing stored', () => {
    const { result } = renderHook(() => useRememberedEmail());
    expect(result.current.email).toBe('');
    expect(result.current.remember).toBe(false);
  });

  it('initializes with stored email', () => {
    localStorage.setItem(STORAGE_KEY_REMEMBERED_EMAIL, 'test@example.com');
    const { result } = renderHook(() => useRememberedEmail());
    expect(result.current.email).toBe('test@example.com');
    expect(result.current.remember).toBe(true);
  });

  it('setEmail updates email state', () => {
    const { result } = renderHook(() => useRememberedEmail());

    act(() => { result.current.setEmail('new@example.com'); });

    expect(result.current.email).toBe('new@example.com');
  });

  it('save stores email when remember is on', () => {
    localStorage.setItem(STORAGE_KEY_REMEMBERED_EMAIL, 'old@example.com');
    const { result } = renderHook(() => useRememberedEmail());

    act(() => { result.current.save('saved@example.com'); });

    expect(localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL)).toBe('saved@example.com');
  });

  it('save does not store email when remember is off', () => {
    const { result } = renderHook(() => useRememberedEmail());

    act(() => { result.current.save('test@example.com'); });

    expect(localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL)).toBeNull();
  });

  it('toggleRemember enables remembering', () => {
    const { result } = renderHook(() => useRememberedEmail());

    act(() => { result.current.toggleRemember(undefined, true); });

    expect(result.current.remember).toBe(true);
  });

  it('toggleRemember disables remembering and removes stored email', () => {
    localStorage.setItem(STORAGE_KEY_REMEMBERED_EMAIL, 'test@example.com');
    const { result } = renderHook(() => useRememberedEmail());

    expect(result.current.remember).toBe(true);

    act(() => { result.current.toggleRemember(undefined, false); });

    expect(result.current.remember).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY_REMEMBERED_EMAIL)).toBeNull();
  });

  it('reset reloads email from localStorage', () => {
    localStorage.setItem(STORAGE_KEY_REMEMBERED_EMAIL, 'stored@example.com');
    const { result } = renderHook(() => useRememberedEmail());

    // Change email in state
    act(() => { result.current.setEmail('modified@example.com'); });
    expect(result.current.email).toBe('modified@example.com');

    // Reset to stored value
    act(() => { result.current.reset(); });
    expect(result.current.email).toBe('stored@example.com');
  });

  it('reset returns empty string when nothing in localStorage', () => {
    const { result } = renderHook(() => useRememberedEmail());

    act(() => { result.current.setEmail('temp@example.com'); });
    act(() => { result.current.reset(); });

    expect(result.current.email).toBe('');
  });
});
