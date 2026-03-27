import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVerificationCooldown } from './useVerificationCooldown';

describe('useVerificationCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() =>
      useVerificationCooldown(vi.fn()),
    );
    expect(result.current.verificationSent).toBe(false);
    expect(result.current.verificationLoading).toBe(false);
    expect(result.current.verificationCooldown).toBe(0);
  });

  it('sends verification and starts cooldown', async () => {
    const resendFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useVerificationCooldown(resendFn, 60),
    );

    await act(async () => {
      await result.current.handleResendVerification();
    });

    expect(resendFn).toHaveBeenCalled();
    expect(result.current.verificationSent).toBe(true);
    expect(result.current.verificationCooldown).toBe(60);
  });

  it('counts down cooldown', async () => {
    const resendFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useVerificationCooldown(resendFn, 3),
    );

    await act(async () => {
      await result.current.handleResendVerification();
    });

    expect(result.current.verificationCooldown).toBe(3);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.verificationCooldown).toBe(2);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.verificationCooldown).toBe(0);
  });

  it('handles resend failure gracefully', async () => {
    const resendFn = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() =>
      useVerificationCooldown(resendFn),
    );

    await act(async () => {
      await result.current.handleResendVerification();
    });

    expect(result.current.verificationSent).toBe(false);
    expect(result.current.verificationLoading).toBe(false);
    expect(result.current.verificationCooldown).toBe(0);
  });
});
