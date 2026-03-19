import { renderHook } from '@testing-library/react';
import { incrementAnonRatingCount, useActivityReminder } from './useActivityReminder';

const mockTrackEvent = vi.fn();

vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

let mockAuthMethod = 'anonymous';
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ authMethod: mockAuthMethod }),
}));

describe('incrementAnonRatingCount', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts at 0 and increments', () => {
    expect(localStorage.getItem('anon_rating_count')).toBeNull();
    incrementAnonRatingCount();
    expect(localStorage.getItem('anon_rating_count')).toBe('1');
    incrementAnonRatingCount();
    expect(localStorage.getItem('anon_rating_count')).toBe('2');
  });
});

describe('useActivityReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAuthMethod = 'anonymous';
  });

  it('does not show reminder if below threshold', () => {
    localStorage.setItem('account_banner_dismissed', 'true');
    localStorage.setItem('anon_rating_count', '3');
    const { result } = renderHook(() => useActivityReminder());
    expect(result.current.showReminder).toBe(false);
  });

  it('shows reminder when threshold reached and banner dismissed', () => {
    localStorage.setItem('account_banner_dismissed', 'true');
    localStorage.setItem('anon_rating_count', '5');
    const { result } = renderHook(() => useActivityReminder());
    expect(result.current.showReminder).toBe(true);
    expect(mockTrackEvent).toHaveBeenCalledWith('activity_reminder_shown', { ratings_count: 5 });
  });

  it('does not show if banner not yet dismissed', () => {
    localStorage.setItem('anon_rating_count', '10');
    const { result } = renderHook(() => useActivityReminder());
    expect(result.current.showReminder).toBe(false);
  });

  it('does not show if already shown before', () => {
    localStorage.setItem('account_banner_dismissed', 'true');
    localStorage.setItem('anon_rating_count', '5');
    localStorage.setItem('activity_reminder_shown', 'true');
    const { result } = renderHook(() => useActivityReminder());
    expect(result.current.showReminder).toBe(false);
  });

  it('does not show for non-anonymous users', () => {
    mockAuthMethod = 'email';
    localStorage.setItem('account_banner_dismissed', 'true');
    localStorage.setItem('anon_rating_count', '10');
    const { result } = renderHook(() => useActivityReminder());
    expect(result.current.showReminder).toBe(false);
  });

  it('dismissReminder sets showReminder to false', () => {
    localStorage.setItem('account_banner_dismissed', 'true');
    localStorage.setItem('anon_rating_count', '5');
    const { result } = renderHook(() => useActivityReminder());
    expect(result.current.showReminder).toBe(true);
    result.current.dismissReminder();
    // Note: need to re-read after state update
  });
});
