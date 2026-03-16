import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import { formatBytes } from './perfHelpers';
import type { StorageStats } from '../../../types/admin';

const FREE_TIER_STORAGE = 1 * 1024 * 1024 * 1024; // 1 GB

interface Props {
  stats: StorageStats | null;
}

export default function StorageCard({ stats }: Props) {
  if (!stats) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2">Fotos Menu - Storage</Typography>
          <Alert severity="warning" sx={{ mt: 1 }}>No se pudo obtener datos de storage.</Alert>
        </CardContent>
      </Card>
    );
  }

  const pct = (stats.totalBytes / FREE_TIER_STORAGE) * 100;
  const barColor = pct < 50 ? 'success' : pct < 80 ? 'warning' : 'error';

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>Fotos Menu - Storage</Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {formatBytes(stats.totalBytes)}
          <Typography component="span" variant="body2" color="text.secondary"> / {formatBytes(FREE_TIER_STORAGE)}</Typography>
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(pct, 100)}
          color={barColor}
          sx={{ my: 1, height: 8, borderRadius: 4 }}
        />
        <Typography variant="caption" color="text.secondary">
          {stats.fileCount} archivos &middot; {pct.toFixed(1)}% usado
        </Typography>
      </CardContent>
    </Card>
  );
}
