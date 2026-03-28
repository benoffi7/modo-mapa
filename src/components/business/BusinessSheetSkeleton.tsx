import { Box, Divider, Skeleton } from '@mui/material';

export default function BusinessSheetSkeleton() {
  return (
    <Box role="status" aria-busy aria-label="Cargando comercio" sx={{ px: 2, pb: 'calc(24px + env(safe-area-inset-bottom))' }}>
      {/* Header: Name + actions */}
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

      {/* Address */}
      <Skeleton variant="text" width="85%" height={20} sx={{ mt: 1 }} />
      {/* Directions button */}
      <Skeleton variant="rounded" width={120} height={36} sx={{ mt: 1 }} />

      {/* CheckIn button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
        <Skeleton variant="rounded" width={100} height={32} />
      </Box>

      {/* Rating compact */}
      <Skeleton variant="text" width="50%" height={24} />
      <Skeleton variant="text" width="40%" height={20} sx={{ mt: 0.5 }} />

      <Divider sx={{ my: 1 }} />

      {/* Tabs */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', my: 1 }}>
        <Skeleton variant="rounded" width={80} height={28} />
        <Skeleton variant="rounded" width={80} height={28} />
      </Box>

      {/* Tab content placeholder */}
      <Skeleton variant="text" width="45%" height={24} sx={{ mt: 1 }} />
      <Skeleton variant="text" width="60%" height={20} sx={{ mt: 0.5 }} />
      <Skeleton variant="rectangular" width="100%" height={60} sx={{ borderRadius: 1, mt: 1 }} />
    </Box>
  );
}
