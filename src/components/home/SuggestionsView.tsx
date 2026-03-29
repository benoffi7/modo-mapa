import { useMemo, useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Typography,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useSuggestions } from '../../hooks/useSuggestions';
import { useListFilters } from '../../hooks/useListFilters';
import { distanceKm, formatDistance } from '../../utils/distance';
import { useSortLocation } from '../../hooks/useSortLocation';
import { CATEGORY_LABELS } from '../../types';
import ListFilters from '../common/ListFilters';
import TrendingList from './TrendingList';
import type { Business, SuggestionReason } from '../../types';

const REASON_LABELS: Record<SuggestionReason, string> = {
  category: 'Te gusta esta categoría',
  tags: 'Tags similares',
  nearby: 'Cerca tuyo',
};

const REASON_COLORS: Record<SuggestionReason, 'primary' | 'secondary' | 'success'> = {
  category: 'primary',
  tags: 'secondary',
  nearby: 'success',
};

interface Props {
  onSelectBusiness: (business: Business) => void;
}

export default function SuggestionsView({ onSelectBusiness }: Props) {
  const [tab, setTab] = useState<'suggestions' | 'trending'>('suggestions');
  const sortLocation = useSortLocation();
  const { suggestions, isLoading, error } = useSuggestions();

  const suggestionItems = useMemo(() =>
    suggestions.map((s) => ({ ...s, createdAt: undefined })),
    [suggestions],
  );

  const {
    filtered,
    total,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    sortBy,
    setSortBy,
  } = useListFilters(suggestionItems, { userLocation: sortLocation });

  const handleSelectBusiness = (business: Business) => {
    onSelectBusiness(business);
  };

  const renderSuggestions = () => {
    if (isLoading) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <CircularProgress size={24} sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Cargando...
          </Typography>
        </Box>
      );
    }

    if (error) {
      return (
        <Box role="alert" sx={{ p: 3, textAlign: 'center' }}>
          <ErrorOutlineIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No se pudieron cargar las sugerencias
          </Typography>
        </Box>
      );
    }

    if (suggestions.length === 0) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <LightbulbOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Calificá y guardá favoritos para recibir sugerencias
          </Typography>
        </Box>
      );
    }

    return (
      <>
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
          {filtered.map((item) => (
            <ListItemButton
              key={item.business.id}
              onClick={() => handleSelectBusiness(item.business)}
            >
              <ListItemText
                primary={item.business.name}
                secondary={
                  <>
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 0.5 }}
                    >
                      {CATEGORY_LABELS[item.business.category]}
                      {' · '}
                      {item.business.address}
                      {' · '}
                      {formatDistance(distanceKm(sortLocation.lat, sortLocation.lng, item.business.lat, item.business.lng))}
                    </Typography>
                    <Box component="span" sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {item.reasons.map((reason) => (
                        <Chip
                          key={reason}
                          label={REASON_LABELS[reason]}
                          size="small"
                          color={REASON_COLORS[reason]}
                          variant="outlined"
                          component="span"
                          sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                      ))}
                    </Box>
                  </>
                }
                primaryTypographyProps={{ fontWeight: 500, fontSize: '0.9rem' }}
              />
            </ListItemButton>
          ))}
        </List>
      </>
    );
  };

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        aria-label="Sugerencias y tendencias"
        sx={{ mb: 1, minHeight: 40 }}
      >
        <Tab
          value="suggestions"
          label="Para vos"
          icon={<LightbulbOutlinedIcon />}
          iconPosition="start"
          sx={{ minHeight: 40, textTransform: 'none' }}
        />
        <Tab
          value="trending"
          label="Tendencia"
          icon={<TrendingUpIcon />}
          iconPosition="start"
          sx={{ minHeight: 40, textTransform: 'none' }}
        />
      </Tabs>
      {tab === 'trending' ? (
        <TrendingList onSelectBusiness={onSelectBusiness} />
      ) : (
        renderSuggestions()
      )}
    </Box>
  );
}
