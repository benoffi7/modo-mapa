import type { ReactNode } from 'react';
import { Box, Typography, Button, CircularProgress, Skeleton } from '@mui/material';
import { MSG_COMMON } from '../../constants/messages';

interface PaginatedListShellProps {
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  emptyIcon: ReactNode;
  emptyMessage: string;
  emptySubtext?: string;
  noResultsMessage?: string;
  isFiltered?: boolean;
  skeletonCount?: number;
  renderSkeleton?: () => ReactNode;
  onRetry: () => void;
  onLoadMore: () => void;
  children: ReactNode;
}

function DefaultSkeleton() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
      <Box sx={{ flex: 1 }}>
        <Skeleton width="60%" height={20} />
        <Skeleton width="90%" height={16} sx={{ mt: 0.5 }} />
        <Skeleton width="30%" height={14} sx={{ mt: 0.5 }} />
      </Box>
      <Skeleton variant="circular" width={32} height={32} />
    </Box>
  );
}

export function PaginatedListShell({
  isLoading,
  error,
  isEmpty,
  hasMore,
  isLoadingMore,
  emptyIcon,
  emptyMessage,
  emptySubtext,
  noResultsMessage = 'No se encontraron resultados',
  isFiltered = false,
  skeletonCount = 5,
  renderSkeleton,
  onRetry,
  onLoadMore,
  children,
}: PaginatedListShellProps) {
  if (isLoading) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Box key={i}>{renderSkeleton ? renderSkeleton() : <DefaultSkeleton />}</Box>
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
        <Button size="small" onClick={onRetry}>
          Reintentar
        </Button>
      </Box>
    );
  }

  if (isEmpty && isFiltered) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {noResultsMessage}
        </Typography>
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ color: 'action.disabled', mb: 1 }}>{emptyIcon}</Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {emptyMessage}
        </Typography>
        {emptySubtext && (
          <Typography variant="caption" color="text.secondary">
            {emptySubtext}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <>
      {children}
      {hasMore && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Button
            size="small"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            aria-label={MSG_COMMON.loadMore}
            startIcon={isLoadingMore ? <CircularProgress size={16} /> : null}
          >
            {isLoadingMore ? MSG_COMMON.loading : MSG_COMMON.loadMore}
          </Button>
        </Box>
      )}
    </>
  );
}
