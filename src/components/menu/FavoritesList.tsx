import { useMemo, useCallback } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useAuth } from '../../context/AuthContext';
import { distanceKm, formatDistance } from '../../utils/distance';
import { useSortLocation } from '../../hooks/useSortLocation';
import { CATEGORY_LABELS } from '../../types';
import { useListFilters } from '../../hooks/useListFilters';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { allBusinesses } from '../../hooks/useBusinesses';
import { removeFavorite, getFavoritesCollection } from '../../services/favorites';
import ListFilters from './ListFilters';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import type { Business, Favorite } from '../../types';

interface FavoriteItem {
  businessId: string;
  business: Business;
  createdAt: Date;
}

interface Props {
  onSelectBusiness: (business: Business) => void;
}

export default function FavoritesList({ onSelectBusiness }: Props) {
  const { user } = useAuth();
  const sortLocation = useSortLocation();

  const collectionRef = useMemo(() => getFavoritesCollection(), []);

  const { items: rawItems, isLoading, error, hasMore, isLoadingMore, loadMore, reload } =
    usePaginatedQuery<Favorite>(collectionRef, user?.uid, 'createdAt');

  const favorites = useMemo(() => {
    const result: FavoriteItem[] = [];
    for (const data of rawItems) {
      const business = allBusinesses.find((b) => b.id === data.businessId);
      if (business) {
        result.push({ businessId: data.businessId, business, createdAt: data.createdAt });
      }
    }
    return result;
  }, [rawItems]);

  const {
    filtered,
    total,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    sortBy,
    setSortBy,
  } = useListFilters(favorites, { userLocation: sortLocation });

  const handleRefresh = useCallback(async () => { reload(); }, [reload]);

  const handleRemoveFavorite = async (businessId: string) => {
    if (!user) return;
    await removeFavorite(user.uid, businessId);
    reload();
  };

  const handleSelectBusiness = (business: Business) => {
    onSelectBusiness(business);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Cargando...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          Error al cargar favoritos
        </Typography>
        <Button size="small" onClick={reload}>Reintentar</Button>
      </Box>
    );
  }

  if (favorites.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <FavoriteBorderIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No tenés favoritos todavía
        </Typography>
      </Box>
    );
  }

  return (
    <PullToRefreshWrapper onRefresh={handleRefresh}>
      <ListFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        showDistanceSort
        resultCount={filtered.length}
        totalCount={total}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 2, py: 1 }}>
        {filtered.map((fav) => {
          const dist = formatDistance(distanceKm(sortLocation.lat, sortLocation.lng, fav.business.lat, fav.business.lng));
          return (
            <Box
              key={fav.businessId}
              onClick={() => handleSelectBusiness(fav.business)}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                p: 1.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600}>{fav.business.name}</Typography>
                    <FavoriteIcon sx={{ fontSize: 16, color: 'error.main' }} />
                  </Box>
                  <Typography variant="caption" color="primary.main">
                    {CATEGORY_LABELS[fav.business.category]}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleRemoveFavorite(fav.businessId); }}
                >
                  <Typography sx={{ fontSize: 18 }}>...</Typography>
                </IconButton>
              </Box>
              <Box sx={{ borderTop: 1, borderColor: 'divider', mt: 1, pt: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Typography sx={{ fontSize: 14, color: 'warning.main' }}>&#9733;</Typography>
                  <Typography variant="caption" fontWeight={600}>--</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">{dist}</Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
      {hasMore && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Button size="small" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Cargar más
          </Button>
        </Box>
      )}
    </PullToRefreshWrapper>
  );
}
