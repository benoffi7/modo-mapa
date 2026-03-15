import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { PERF_FLUSH_DELAY_MS } from '../constants/performance';
import { trackEvent } from './analytics';
import type { PerfVitals, QueryTiming } from '../types/perfMetrics';

// --- Module state ---
const vitals: PerfVitals = { lcp: null, inp: null, cls: null, ttfb: null };
const queryTimings = new Map<string, number[]>();
let sessionId = '';
let flushed = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// --- Public API ---

export function initPerfMetrics(_uid: string, analyticsEnabled: boolean): void {
  if (!import.meta.env.PROD) return;
  if (!analyticsEnabled) return;
  if (sessionId) return; // already initialized

  sessionId = crypto.randomUUID();

  observeLCP();
  observeINP();
  observeCLS();
  observeTTFB();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPerfMetrics();
    }
  });
}

export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!sessionId) return fn();

  const start = performance.now();
  const result = await fn();
  const elapsed = performance.now() - start;
  recordQueryTiming(name, elapsed);
  return result;
}

// --- Observers ---

function observeLCP(): void {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        vitals.lcp = entries[entries.length - 1].startTime;
        scheduleFlush();
      }
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* unsupported */ }
}

function observeINP(): void {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = entry.duration;
        if (vitals.inp === null || duration > vitals.inp) {
          vitals.inp = duration;
        }
      }
    });
    observer.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  } catch { /* unsupported */ }
}

function observeCLS(): void {
  try {
    let clsValue = 0;
    let clsEntries: PerformanceEntry[] = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (shift.hadRecentInput) continue;

        clsEntries.push(entry);

        // Sliding window: keep only entries within last 5 seconds
        const now = entry.startTime;
        clsEntries = clsEntries.filter((e) => now - e.startTime < 5000);

        const windowValue = clsEntries.reduce(
          (sum, e) => sum + ((e as unknown as { value: number }).value ?? 0),
          0,
        );

        if (windowValue > clsValue) {
          clsValue = windowValue;
          vitals.cls = clsValue;
        }
      }
      scheduleFlush();
    });
    observer.observe({ type: 'layout-shift', buffered: true });
  } catch { /* unsupported */ }
}

function observeTTFB(): void {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        const nav = entries[0] as PerformanceNavigationTiming;
        vitals.ttfb = nav.responseStart;
        scheduleFlush();
      }
    });
    observer.observe({ type: 'navigation', buffered: true });
  } catch { /* unsupported */ }
}

// --- Internal helpers ---

function recordQueryTiming(name: string, elapsed: number): void {
  const timings = queryTimings.get(name) ?? [];
  timings.push(elapsed);
  queryTimings.set(name, timings);
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flushPerfMetrics(), PERF_FLUSH_DELAY_MS);
}

export function calculatePercentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function getDeviceInfo(): { type: 'mobile' | 'desktop'; connection: string } {
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  const connection = nav.connection?.effectiveType ?? 'unknown';
  return { type: mobile ? 'mobile' : 'desktop', connection };
}

function buildQueryStats(): Record<string, QueryTiming> {
  const stats: Record<string, QueryTiming> = {};
  for (const [name, timings] of queryTimings) {
    stats[name] = {
      p50: calculatePercentile(timings, 50),
      p95: calculatePercentile(timings, 95),
      count: timings.length,
    };
  }
  return stats;
}

async function flushPerfMetrics(): Promise<void> {
  if (flushed) return;
  if (!sessionId) return;

  // Only flush if at least 1 vital was captured
  const hasVitals = vitals.lcp !== null || vitals.inp !== null
    || vitals.cls !== null || vitals.ttfb !== null;
  if (!hasVitals) return;

  flushed = true;
  if (flushTimer) clearTimeout(flushTimer);

  const APP_VERSION: string = __APP_VERSION__;

  try {
    const writePerfMetrics = httpsCallable(functions, 'writePerfMetrics');
    await writePerfMetrics({
      sessionId,
      vitals: { ...vitals },
      queries: buildQueryStats(),
      device: getDeviceInfo(),
      appVersion: APP_VERSION,
    });

    trackEvent('perf_vitals_captured', {
      lcp: vitals.lcp ?? 0,
      inp: vitals.inp ?? 0,
      cls: vitals.cls ?? 0,
      ttfb: vitals.ttfb ?? 0,
      device_type: getDeviceInfo().type,
    });
  } catch {
    // Silent fail — perf metrics are best-effort
    flushed = false;
  }
}
