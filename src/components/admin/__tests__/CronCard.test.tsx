import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CronCard from '../CronCard';
import type { CronConfig } from '../../../constants/admin';
import type { CronRunStatus } from '../../../types/admin';

vi.mock('../../../utils/formatDate', () => ({
  formatRelativeTime: (date: Date) => `relative(${date.toISOString()})`,
}));

const dailyConfig: CronConfig = {
  name: 'dailyMetrics',
  label: 'Metricas diarias',
  schedule: 'Diario 3AM',
  thresholdOkHours: 26,
  thresholdWarningHours: 48,
};

const weeklyConfig: CronConfig = {
  name: 'computeWeeklyRanking',
  label: 'Rankings (semanal)',
  schedule: 'Lunes 4AM',
  thresholdOkHours: 7 * 24,
  thresholdWarningHours: 14 * 24,
};

describe('CronCard', () => {
  it('renders label and schedule', () => {
    render(<CronCard config={dailyConfig} run={null} />);
    expect(screen.getByText('Metricas diarias')).toBeInTheDocument();
    expect(screen.getByText('Diario 3AM')).toBeInTheDocument();
  });

  it('shows "Sin datos" when run is null', () => {
    render(<CronCard config={dailyConfig} run={null} />);
    // "Sin datos" appears in both HealthIndicator chip and Typography
    const sinDatos = screen.getAllByText('Sin datos');
    expect(sinDatos.length).toBe(2);
  });

  it('shows freshness ok for recent run within threshold', () => {
    const recentRun: CronRunStatus = {
      cronName: 'dailyMetrics',
      lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      result: 'success',
      detail: 'Metrics computed',
      durationMs: 5000,
    };
    render(<CronCard config={dailyConfig} run={recentRun} />);
    // HealthIndicator OK chip
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('Duracion: 5.0s')).toBeInTheDocument();
  });

  it('shows freshness warning for run between thresholds', () => {
    const warningRun: CronRunStatus = {
      cronName: 'dailyMetrics',
      lastRunAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours ago (> 26, < 48)
      result: 'success',
    };
    render(<CronCard config={dailyConfig} run={warningRun} />);
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
  });

  it('shows freshness error for run beyond warning threshold', () => {
    const oldRun: CronRunStatus = {
      cronName: 'dailyMetrics',
      lastRunAt: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50 hours ago (> 48)
      result: 'success',
    };
    render(<CronCard config={dailyConfig} run={oldRun} />);
    // HealthIndicator shows "Sin datos" chip for error freshness
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  it('shows error chip when result is error', () => {
    const errorRun: CronRunStatus = {
      cronName: 'dailyMetrics',
      lastRunAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      result: 'error',
      detail: 'DB connection failed',
      durationMs: 150,
    };
    render(<CronCard config={dailyConfig} run={errorRun} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Duracion: 150ms')).toBeInTheDocument();
  });

  it('formats duration in ms for short durations', () => {
    const run: CronRunStatus = {
      cronName: 'dailyMetrics',
      lastRunAt: new Date(),
      result: 'success',
      durationMs: 250,
    };
    render(<CronCard config={dailyConfig} run={run} />);
    expect(screen.getByText('Duracion: 250ms')).toBeInTheDocument();
  });

  it('formats duration in seconds for longer durations', () => {
    const run: CronRunStatus = {
      cronName: 'dailyMetrics',
      lastRunAt: new Date(),
      result: 'success',
      durationMs: 12500,
    };
    render(<CronCard config={dailyConfig} run={run} />);
    expect(screen.getByText('Duracion: 12.5s')).toBeInTheDocument();
  });

  it('uses weekly thresholds correctly', () => {
    const recentWeeklyRun: CronRunStatus = {
      cronName: 'computeWeeklyRanking',
      lastRunAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (within 7*24=168h)
      result: 'success',
    };
    render(<CronCard config={weeklyConfig} run={recentWeeklyRun} />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});
