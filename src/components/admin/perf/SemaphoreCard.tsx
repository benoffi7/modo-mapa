import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import {
  VITAL_LABELS, VITAL_DESCRIPTIONS, getSemaphoreColor, formatVital,
} from './perfHelpers';
import type { VitalKey, AggregatedVitals } from './perfHelpers';

interface Props {
  vitalKey: VitalKey;
  data: AggregatedVitals | null;
}

export default function SemaphoreCard({ vitalKey, data }: Props) {
  const theme = useTheme();
  const label = VITAL_LABELS[vitalKey];
  const description = VITAL_DESCRIPTIONS[vitalKey];

  if (!data) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary">{label.name}</Typography>
          <Typography variant="caption" color="text.secondary">{description}</Typography>
          <Typography variant="h5" sx={{ mt: 1 }}>--</Typography>
          <Typography variant="caption" color="text.secondary">Sin datos</Typography>
        </CardContent>
      </Card>
    );
  }

  const status = getSemaphoreColor(vitalKey, data.p75);
  const color = theme.palette[status].main;

  return (
    <Card variant="outlined" sx={{ borderLeft: `4px solid ${color}` }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
          <Typography variant="subtitle2">{label.name}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">{description}</Typography>
        <Typography variant="h4" sx={{ mt: 1, fontWeight: 700 }}>
          {formatVital(vitalKey, data.p75)}
          {label.unit && <Typography component="span" variant="body2" color="text.secondary"> {label.unit}</Typography>}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          p75 &middot; {data.samples} sesiones
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            p50: {formatVital(vitalKey, data.p50)} &middot; p95: {formatVital(vitalKey, data.p95)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
