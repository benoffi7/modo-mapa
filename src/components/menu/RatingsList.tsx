import { useMemo } from 'react';
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
import { collection } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { ratingConverter } from '../../config/converters';
import { useAuth } from '../../context/AuthContext';
import { useMapContext } from '../../context/MapContext';
import { useListFilters } from '../../hooks/useListFilters';
import { usePaginatedQuery } from '../../hooks/usePaginatedQuery';
import { allBusinesses } from '../../hooks/useBusinesses';
import ListFilters from './ListFilters';
import type { Business, Rating as RatingType } from '../../types';

interface Props {
  onNavigate: () => void;
}

export default function RatingsList({ onNavigate }: Props) {
  const { user } = useAuth();
  const { setSelectedBusiness } = useMapContext();

  const collectionRef = useMemo(
    () => collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
    [],
  );

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
  } = useListFilters(ratings, { enableScoreFilter: true });

  const handleSelectBusiness = (business: Business | null) => {
    if (!business) return;
    setSelectedBusiness(business);
    onNavigate();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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
          Error al cargar calificaciones
        </Typography>
        <Button size="small" onClick={reload}>Reintentar</Button>
      </Box>
    );
  }

  if (ratings.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <StarBorderIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No calificaste comercios todavía
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <ListFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        showScoreFilter
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
                    {formatDate(item.updatedAt)}
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
    </Box>
  );
}
