import { Box, Skeleton } from '@mui/material';

export default function BusinessSheetSkeleton() {
  return (
    <Box role="status" aria-busy aria-label="Cargando comercio" sx={{ px: 2, pb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="70%" height={28} />
          <Skeleton variant="rounded" width={80} height={24} sx={{ mt: 0.5 }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="circular" width={32} height={32} />
        </Box>
      </Box>

      <Skeleton variant="text" width="85%" height={20} sx={{ mt: 1 }} />
      <Skeleton variant="rounded" width={120} height={36} sx={{ mt: 1 }} />

      <Skeleton variant="text" width="50%" height={24} sx={{ mt: 1 }} />
      <Skeleton variant="text" width="40%" height={20} sx={{ mt: 0.5 }} />

      <Skeleton variant="rounded" width="100%" height={44} sx={{ mt: 2, borderRadius: 1 }} />
    </Box>
  );
}
