import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  secondary?: ReactNode;
}

export default function KpiCard({ label, value, secondary }: Props) {
  return (
    <Card variant="outlined" sx={{ minWidth: 140, flex: '1 1 0' }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {value}
          </Typography>
          {secondary}
        </Box>
      </CardContent>
    </Card>
  );
}
