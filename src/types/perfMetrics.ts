import type { Timestamp } from 'firebase/firestore';

export interface PerfVitals {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  ttfb: number | null;
}

export interface QueryTiming {
  p50: number;
  p95: number;
  count: number;
}

export interface DeviceInfo {
  type: 'mobile' | 'desktop';
  connection: string;
}

export interface PerfMetricsDoc {
  sessionId: string;
  userId: string | null;
  timestamp: Timestamp;
  vitals: PerfVitals;
  queries: Record<string, QueryTiming>;
  device: DeviceInfo;
  appVersion: string;
}
