import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';
import { computeKpis } from './auditHelpers';
import { formatRelativeTime } from '../../../utils/formatDate';
import type { DeletionAuditLogEntry } from '../../../types/admin';

interface AuditKpiCardsProps {
  logs: DeletionAuditLogEntry[];
}

export default function AuditKpiCards({ logs }: AuditKpiCardsProps) {
  const kpis = useMemo(() => computeKpis(logs), [logs]);

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
      <Card variant="outlined">
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography variant="h3" fontWeight="bold">
            {kpis.total.toLocaleString('es-AR')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total eliminaciones
          </Typography>
        </CardContent>
      </Card>
      <Card variant="outlined">
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography variant="h3" fontWeight="bold">
            {kpis.successRate}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tasa de éxito
          </Typography>
        </CardContent>
      </Card>
      <Card variant="outlined">
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography variant="h3" fontWeight="bold">
            {kpis.lastDeletion ? formatRelativeTime(kpis.lastDeletion) : '-'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Última eliminación
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
