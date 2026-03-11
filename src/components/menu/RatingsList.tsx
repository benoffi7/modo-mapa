import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Rating,
} from '@mui/material';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useMapContext } from '../../context/MapContext';
import { useListFilters } from '../../hooks/useListFilters';
import ListFilters from './ListFilters';
import type { Business } from '../../types';
import businessesData from '../../data/businesses.json';

const allBusinesses: Business[] = businessesData as Business[];

interface RatingItem {
  businessId: string;
  business: Business | null;
  score: number;
  updatedAt: Date;
}

interface Props {
  onNavigate: () => void;
}

export default function RatingsList({ onNavigate }: Props) {
  const { user } = useAuth();
  const { setSelectedBusiness } = useMapContext();
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const loadRatings = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'ratings'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const items: RatingItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          businessId: data.businessId,
          business: allBusinesses.find((b) => b.id === data.businessId) || null,
          score: data.score,
          updatedAt: data.updatedAt?.toDate() || data.createdAt?.toDate() || new Date(),
        };
      });
      setRatings(items);
    } catch (error) {
      console.error('Error loading ratings:', error);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

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
    </Box>
  );
}
