import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  label: string;
  count: number;
}

export default function UserStatsRow({ icon, label, count }: Props) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}
        <Typography variant="body2">{label}</Typography>
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {count}
      </Typography>
    </Box>
  );
}
