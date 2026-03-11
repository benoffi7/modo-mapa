import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

interface StatCardProps {
  label: string;
  value: number;
}

export default function StatCard({ label, value }: StatCardProps) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="h3" fontWeight="bold">
          {value.toLocaleString('es-AR')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}
