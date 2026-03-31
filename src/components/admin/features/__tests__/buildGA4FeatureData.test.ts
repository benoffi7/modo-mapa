import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildGA4FeatureData } from '../../FeaturesPanel';
import type { GA4EventCount } from '../../../../types/admin';

describe('buildGA4FeatureData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set "today" to 2026-03-15
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aggregates multiple event names correctly', () => {
    const events: GA4EventCount[] = [
      { eventName: 'list_created', date: '20260315', eventCount: 5 },
      { eventName: 'list_item_added', date: '20260315', eventCount: 10 },
    ];

    const result = buildGA4FeatureData(events, ['list_created', 'list_item_added']);
    expect(result.today).toBe(15);
    expect(result.total).toBe(15);
  });

  it('calculates today count from YYYYMMDD format', () => {
    const events: GA4EventCount[] = [
      { eventName: 'surprise_me', date: '20260315', eventCount: 7 },
      { eventName: 'surprise_me', date: '20260314', eventCount: 3 },
    ];

    const result = buildGA4FeatureData(events, ['surprise_me']);
    expect(result.today).toBe(7);
  });

  it('calculates yesterday count', () => {
    const events: GA4EventCount[] = [
      { eventName: 'surprise_me', date: '20260315', eventCount: 7 },
      { eventName: 'surprise_me', date: '20260314', eventCount: 3 },
    ];

    const result = buildGA4FeatureData(events, ['surprise_me']);
    expect(result.yesterday).toBe(3);
  });

  it('calculates total across all dates', () => {
    const events: GA4EventCount[] = [
      { eventName: 'surprise_me', date: '20260315', eventCount: 7 },
      { eventName: 'surprise_me', date: '20260314', eventCount: 3 },
      { eventName: 'surprise_me', date: '20260313', eventCount: 10 },
    ];

    const result = buildGA4FeatureData(events, ['surprise_me']);
    expect(result.total).toBe(20);
  });

  it('returns trend sorted chronologically with YYYY-MM-DD format', () => {
    const events: GA4EventCount[] = [
      { eventName: 'surprise_me', date: '20260315', eventCount: 7 },
      { eventName: 'surprise_me', date: '20260313', eventCount: 10 },
      { eventName: 'surprise_me', date: '20260314', eventCount: 3 },
    ];

    const result = buildGA4FeatureData(events, ['surprise_me']);
    expect(result.trend).toEqual([
      { date: '2026-03-13', value: 10 },
      { date: '2026-03-14', value: 3 },
      { date: '2026-03-15', value: 7 },
    ]);
  });

  it('returns zeros for empty events array', () => {
    const result = buildGA4FeatureData([], ['surprise_me']);
    expect(result.today).toBe(0);
    expect(result.yesterday).toBe(0);
    expect(result.total).toBe(0);
    expect(result.trend).toEqual([]);
  });

  it('returns zeros when no events match today or yesterday', () => {
    const events: GA4EventCount[] = [
      { eventName: 'surprise_me', date: '20260310', eventCount: 5 },
      { eventName: 'surprise_me', date: '20260311', eventCount: 8 },
    ];

    const result = buildGA4FeatureData(events, ['surprise_me']);
    expect(result.today).toBe(0);
    expect(result.yesterday).toBe(0);
    expect(result.total).toBe(13);
  });

  it('ignores events not in the eventNames list', () => {
    const events: GA4EventCount[] = [
      { eventName: 'surprise_me', date: '20260315', eventCount: 7 },
      { eventName: 'unrelated_event', date: '20260315', eventCount: 100 },
    ];

    const result = buildGA4FeatureData(events, ['surprise_me']);
    expect(result.today).toBe(7);
    expect(result.total).toBe(7);
  });
});
