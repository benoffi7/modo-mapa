import { Box, Divider, Skeleton } from '@mui/material';

export default function BusinessSheetSkeleton() {
  return (
    <Box sx={{ px: 2, pb: 'calc(24px + env(safe-area-inset-bottom))' }}>
      {/* Name */}
      <Skeleton variant="text" width="70%" height={28} />
      {/* Category chip */}
      <Skeleton variant="rounded" width={80} height={24} sx={{ mt: 0.5 }} />
      {/* Address */}
      <Skeleton variant="text" width="85%" height={20} sx={{ mt: 1 }} />
      {/* Directions button */}
      <Skeleton variant="rounded" width={120} height={36} sx={{ mt: 1 }} />

      <Divider sx={{ my: 1.5 }} />

      {/* Rating */}
      <Skeleton variant="text" width="50%" height={24} />
      <Skeleton variant="text" width="40%" height={20} sx={{ mt: 0.5 }} />

      <Divider sx={{ my: 1.5 }} />

      {/* Price level */}
      <Skeleton variant="text" width="45%" height={24} />

      <Divider sx={{ my: 1.5 }} />

      {/* Tags */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Skeleton variant="rounded" width={60} height={28} />
        <Skeleton variant="rounded" width={60} height={28} />
        <Skeleton variant="rounded" width={60} height={28} />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* Menu photo */}
      <Skeleton variant="rectangular" width="100%" height={80} sx={{ borderRadius: 1 }} />

      <Divider sx={{ my: 1.5 }} />

      {/* Comments */}
      <Skeleton variant="text" width="90%" height={18} />
      <Skeleton variant="text" width="90%" height={18} sx={{ mt: 0.5 }} />
    </Box>
  );
}
