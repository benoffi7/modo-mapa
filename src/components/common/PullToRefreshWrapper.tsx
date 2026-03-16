import { Box, CircularProgress } from '@mui/material';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import type { ReactNode } from 'react';

interface Props {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export default function PullToRefreshWrapper({ onRefresh, children }: Props) {
  const { containerRef, isRefreshing, pullProgress } = usePullToRefresh(onRefresh);

  return (
    <Box ref={containerRef} sx={{ position: 'relative', overflow: 'auto', height: '100%' }}>
      {(pullProgress > 0 || isRefreshing) && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 1,
            opacity: isRefreshing ? 1 : pullProgress,
            transition: isRefreshing ? 'none' : 'opacity 0.1s',
          }}
        >
          <CircularProgress
            size={24}
            variant={isRefreshing ? 'indeterminate' : 'determinate'}
            value={pullProgress * 100}
          />
        </Box>
      )}
      {children}
    </Box>
  );
}
