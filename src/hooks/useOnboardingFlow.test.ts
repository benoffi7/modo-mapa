import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STORAGE_KEY_BENEFITS_SHOWN } from '../constants/storage';

import { useOnboardingFlow } from './useOnboardingFlow';

describe('useOnboardingFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('starts with all dialogs closed', () => {
    const { result } = renderHook(() => useOnboardingFlow());

    expect(result.current.benefitsOpen).toBe(false);
    expect(result.current.emailDialogOpen).toBe(false);
    expect(result.current.emailDialogTab).toBe('register');
    expect(result.current.benefitsSource).toBe('banner');
  });

  it('handleCreateAccount opens benefits dialog when not seen before', () => {
    const { result } = renderHook(() => useOnboardingFlow());

    act(() => { result.current.handleCreateAccount(); });

    expect(result.current.benefitsOpen).toBe(true);
    expect(result.current.emailDialogOpen).toBe(false);
    expect(result.current.benefitsSource).toBe('banner');
  });

  it('handleCreateAccount opens email dialog directly when benefits already shown', () => {
    localStorage.setItem(STORAGE_KEY_BENEFITS_SHOWN, 'true');

    const { result } = renderHook(() => useOnboardingFlow());

    act(() => { result.current.handleCreateAccount(); });

    expect(result.current.benefitsOpen).toBe(false);
    expect(result.current.emailDialogOpen).toBe(true);
    expect(result.current.emailDialogTab).toBe('register');
  });

  it('handleCreateAccount passes custom source', () => {
    const { result } = renderHook(() => useOnboardingFlow());

    act(() => { result.current.handleCreateAccount('menu'); });

    expect(result.current.benefitsSource).toBe('menu');
    expect(result.current.benefitsOpen).toBe(true);
  });

  it('handleCreateAccount uses settings source', () => {
    const { result } = renderHook(() => useOnboardingFlow());

    act(() => { result.current.handleCreateAccount('settings'); });

    expect(result.current.benefitsSource).toBe('settings');
  });

  it('handleLogin opens email dialog with login tab', () => {
    const { result } = renderHook(() => useOnboardingFlow());

    act(() => { result.current.handleLogin(); });

    expect(result.current.emailDialogOpen).toBe(true);
    expect(result.current.emailDialogTab).toBe('login');
  });

  it('handleBenefitsContinue closes benefits and opens email dialog', () => {
    const { result } = renderHook(() => useOnboardingFlow());

    // First open benefits
    act(() => { result.current.handleCreateAccount(); });
    expect(result.current.benefitsOpen).toBe(true);

    // Then continue
    act(() => { result.current.handleBenefitsContinue(); });

    expect(result.current.benefitsOpen).toBe(false);
    expect(result.current.emailDialogOpen).toBe(true);
  });

  it('closeBenefits closes benefits dialog', () => {
    const { result } = renderHook(() => useOnboardingFlow());

    act(() => { result.current.handleCreateAccount(); });
    expect(result.current.benefitsOpen).toBe(true);

    act(() => { result.current.closeBenefits(); });
    expect(result.current.benefitsOpen).toBe(false);
  });

  it('closeEmailDialog closes email dialog', () => {
    const { result } = renderHook(() => useOnboardingFlow());

    act(() => { result.current.handleLogin(); });
    expect(result.current.emailDialogOpen).toBe(true);

    act(() => { result.current.closeEmailDialog(); });
    expect(result.current.emailDialogOpen).toBe(false);
  });

  it('handleCreateAccount sets register tab even after handleLogin set login tab', () => {
    localStorage.setItem(STORAGE_KEY_BENEFITS_SHOWN, 'true');
    const { result } = renderHook(() => useOnboardingFlow());

    // First login
    act(() => { result.current.handleLogin(); });
    expect(result.current.emailDialogTab).toBe('login');

    // Close and create account
    act(() => { result.current.closeEmailDialog(); });
    act(() => { result.current.handleCreateAccount(); });

    expect(result.current.emailDialogTab).toBe('register');
  });

  it('full flow: banner -> benefits -> continue -> email dialog -> close', () => {
    const { result } = renderHook(() => useOnboardingFlow());

    act(() => { result.current.handleCreateAccount('banner'); });
    expect(result.current.benefitsOpen).toBe(true);

    act(() => { result.current.handleBenefitsContinue(); });
    expect(result.current.benefitsOpen).toBe(false);
    expect(result.current.emailDialogOpen).toBe(true);

    act(() => { result.current.closeEmailDialog(); });
    expect(result.current.emailDialogOpen).toBe(false);
  });
});
