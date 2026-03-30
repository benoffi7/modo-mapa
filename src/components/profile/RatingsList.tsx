import { useMemo, useCallback } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Rating,
  Button,
  CircularProgress,
} from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useAuth } from '../../context/AuthContext';
import { getRatingsCollection } from '../../services/ratings';
import { distanceKm, formatDistance } from '../../utils/distance';
import { useSortLocation } from '../../hooks/useSortLocation';
import { useListFilters } from '../../hooks/useListFilters';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { allBusinesses } from '../../hooks/useBusinesses';
import { formatDateMedium } from '../../utils/formatDate';
import ListFilters from '../common/ListFilters';
import PullToRefreshWrapper from '../common/PullToRefreshWrapper';
import type { Business, Rating as RatingType } from '../../types';

interface Props {
  onSelectBusiness: (business: Business) => void;
}

export default function RatingsList({ onSelectBusiness }: Props) {
  const { user } = useAuth();
  const sortLocation = useSortLocation();

  const collectionRef = useMemo(() => getRatingsCollection(), []);

  const { items: rawItems, isLoading, error, hasMore, isLoadingMore, loadMore, reload } =
    usePaginatedQuery<RatingType>(collectionRef, user?.uid, 'updatedAt');

  const ratings = useMemo(() => {
    return rawItems.map((data) => ({
      businessId: data.businessId,
      business: allBusinesses.find((b) => b.id === data.businessId) || null,
      score: data.score,
      updatedAt: data.updatedAt || data.createdAt,
    }));
  }, [rawItems]);

  const {
    filtered,
    total,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    minScore,
    setMinScore,
    sortBy,
    setSortBy,
  } = useListFilters(ratings, { enableScoreFilter: true, userLocation: sortLocation });

  const handleRefresh = useCallback(async () => { reload(); }, [reload]);

  const handleSelectBusiness = useCallback((business: Business | null) => {
    if (!business) return;
    onSelectBusiness(business);
  }, [onSelectBusiness]);

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
          No se pudieron cargar las calificaciones
        </Typography>
        <Button size="small" onClick={reload}>Reintentar</Button>
      </Box>
    );
  }

  if (ratings.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <StarBorderIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No calificaste comercios todavía
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
        showScoreFilter
        showDistanceSort
        minScore={minScore}
        onMinScoreChange={setMinScore}
        resultCount={filtered.length}
        totalCount={total}
      />
      <List disablePadding>
        {filtered.map((item) => (
          <ListItemButton
            key={item.businessId}
            onClick={() => handleSelectBusiness(item.business)}
            disabled={!item.business}
            sx={{ py: 1 }}
          >
            <ListItemText
              primary={item.business?.name || 'Comercio desconocido'}
              secondary={
                <>
                  <Rating
                    value={item.score}
                    readOnly
                    size="small"
                    sx={{ display: 'flex', mt: 0.5 }}
                  />
                  <Typography component="span" variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                    {formatDateMedium(item.updatedAt)}
                    {item.business && (
                      <>
                        {' · '}
                        {formatDistance(distanceKm(sortLocation.lat, sortLocation.lng, item.business.lat, item.business.lng))}
                      </>
                    )}
                  </Typography>
                </>
              }
              primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
            />
          </ListItemButton>
        ))}
      </List>
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
