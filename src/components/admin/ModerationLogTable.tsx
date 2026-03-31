import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import type { ModerationLog } from '../../types/admin';
import { formatDateShort } from '../../utils/formatDate';
import { MODERATION_ACTION_LABELS, MODERATION_TARGET_LABELS } from '../../constants/admin';
import ActivityTable from './ActivityTable';

interface ModerationLogTableProps {
  logs: ModerationLog[];
}

export default function ModerationLogTable({ logs }: ModerationLogTableProps) {
  return (
    <ActivityTable
      items={logs}
      columns={[
        {
          label: 'Fecha',
          render: (log) => formatDateShort(log.timestamp),
        },
        {
          label: 'Admin',
          render: (log) => (
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {log.adminId.slice(0, 8)}
            </Typography>
          ),
        },
        {
          label: 'Acción',
          render: (log) => (
            <Chip
              label={MODERATION_ACTION_LABELS[log.action]}
              size="small"
              color={log.action === 'delete' ? 'error' : 'default'}
              variant={log.action === 'delete' ? 'filled' : 'outlined'}
            />
          ),
        },
        {
          label: 'Tipo',
          render: (log) => MODERATION_TARGET_LABELS[log.targetCollection],
        },
        {
          label: 'Usuario',
          render: (log) => (
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {log.targetUserId.slice(0, 8)}
            </Typography>
          ),
        },
        {
          label: 'Contenido',
          render: (log) => {
            const content = log.snapshot.text || log.snapshot.label || log.snapshot.score || '';
            const text = String(content);
            return (
              <Typography variant="body2" color="text.secondary">
                {text.length > 60 ? `${text.slice(0, 60)}...` : text}
              </Typography>
            );
          },
        },
        {
          label: 'Motivo',
          render: (log) => (
            <Typography variant="body2" color="text.secondary">
              {log.reason || '–'}
            </Typography>
          ),
        },
      ]}
    />
  );
}
