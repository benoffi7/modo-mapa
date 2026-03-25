import Chip from '@mui/material/Chip';
import type { HealthStatus } from '../../types/admin';

const CONFIG: Record<HealthStatus, { label: string; color: 'success' | 'warning' | 'error' }> = {
  ok: { label: 'OK', color: 'success' },
  warning: { label: 'Atrasado', color: 'warning' },
  error: { label: 'Sin datos', color: 'error' },
};

interface Props {
  status: HealthStatus;
}

export default function HealthIndicator({ status }: Props) {
  const { label, color } = CONFIG[status];
  return <Chip label={label} color={color} size="small" variant="outlined" />;
}
