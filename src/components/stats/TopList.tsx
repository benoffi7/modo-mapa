import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';

interface TopListItem {
  label: string;
  value: number;
  secondary?: string;
}

interface TopListProps {
  title: string;
  items: TopListItem[];
}

export default function TopList({ title, items }: TopListProps) {
  const maxValue = items.length > 0 ? Math.max(...items.map((i) => i.value)) : 1;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        {items.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Sin datos
          </Typography>
        )}
        {items.map((item, idx) => (
          <Box key={idx} sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>
                {item.label}
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {item.value}
                {item.secondary ? ` (${item.secondary})` : ''}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(item.value / maxValue) * 100}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
