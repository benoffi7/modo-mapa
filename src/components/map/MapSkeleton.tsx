import { Box, Skeleton } from '@mui/material';

export default function MapSkeleton() {
  return (
    <Box
      role="status"
      aria-busy
      aria-label="Cargando mapa"
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        bgcolor: (theme) =>
          theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        animation="pulse"
      />
    </Box>
  );
}
