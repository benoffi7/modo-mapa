import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';

interface Props {
  /** Score values ordered from oldest to newest */
  scores: number[];
  label?: string;
}

export default function ScoreSparkline({ scores, label = 'Evolución' }: Props) {
  const theme = useTheme();

  if (scores.length < 2) return null;

  const max = Math.max(...scores, 1);
  const min = Math.min(...scores, 0);
  const range = max - min || 1;

  const width = 160;
  const height = 36;
  const padding = 2;

  const points = scores.map((s, i) => {
    const x = padding + (i / (scores.length - 1)) * (width - padding * 2);
    const y = height - padding - ((s - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const strokeColor = theme.palette.primary.main;
  const fillColor = alpha(theme.palette.primary.main, 0.12);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
        <path d={areaD} fill={fillColor} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* Last point dot */}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2.5} fill={strokeColor} />
      </svg>
    </Box>
  );
}
