export const PERF_THRESHOLDS = {
  lcp: { green: 2500, red: 4000 },
  inp: { green: 200, red: 500 },
  cls: { green: 0.1, red: 0.25 },
  ttfb: { green: 800, red: 1800 },
} as const;

export const PERF_FLUSH_DELAY_MS = 30_000;
