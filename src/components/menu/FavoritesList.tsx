import { useMemo, useCallback } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Chip,
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
      <List disablePadding>
        {filtered.map((fav) => (
          <ListItemButton
            key={fav.businessId}
            onClick={() => handleSelectBusiness(fav.business)}
            sx={{ pr: 2, py: 1 }}
          >
            <ListItemText
              primary={fav.business.name}
              secondary={
                <>
                  <Chip
                    label={CATEGORY_LABELS[fav.business.category]}
                    size="small"
                    component="span"
                    sx={{ alignSelf: 'flex-start', fontSize: '0.7rem', height: 20, display: 'inline-flex', mt: 0.5 }}
                  />
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {fav.business.address}
                    {' · '}
                    {formatDistance(distanceKm(sortLocation.lat, sortLocation.lng, fav.business.lat, fav.business.lng))}
                  </Typography>
                </>
              }
              primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
            />
            <IconButton
              edge="end"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFavorite(fav.businessId);
              }}
              sx={{ color: 'secondary.main' }}
            >
              <FavoriteIcon />
            </IconButton>
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
