import { Box, CircularProgress } from '@mui/material';

export default function TabLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', py: 4 }}>
      <CircularProgress size={28} />
    </Box>
  );
}
