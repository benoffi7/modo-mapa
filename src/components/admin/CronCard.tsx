import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import HealthIndicator from './HealthIndicator';
import { formatRelativeTime } from '../../utils/formatDate';
import type { CronConfig } from '../../constants/admin';
import type { CronRunStatus, HealthStatus } from '../../types/admin';

function computeFreshness(date: Date, thresholdHours: number, warningHours: number): HealthStatus {
  const ageMs = Date.now() - date.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours <= thresholdHours) return 'ok';
  if (ageHours <= warningHours) return 'warning';
  return 'error';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface CronCardProps {
  config: CronConfig;
  run: CronRunStatus | null;
}

export default function CronCard({ config, run }: CronCardProps) {
  const freshness: HealthStatus = run?.lastRunAt
    ? computeFreshness(run.lastRunAt, config.thresholdOkHours, config.thresholdWarningHours)
    : 'error';

  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>{config.label}</Typography>
          <HealthIndicator status={freshness} />
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {config.schedule}
        </Typography>
        {run?.lastRunAt ? (
          <>
            <Typography variant="caption" color="text.secondary" display="block">
              Ultima ejecucion: {formatRelativeTime(run.lastRunAt)}
            </Typography>
            {run.durationMs != null && (
              <Typography variant="caption" color="text.secondary" display="block">
                Duracion: {formatDuration(run.durationMs)}
              </Typography>
            )}
            {run.result === 'error' && (
              <Tooltip title={run.detail ?? 'Error desconocido'} arrow>
                <Chip label="Error" color="error" size="small" sx={{ mt: 0.5 }} />
              </Tooltip>
            )}
          </>
        ) : (
          <Typography variant="caption" color="text.secondary" display="block">
            Sin datos
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
