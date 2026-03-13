import {
  Box,
  TextField,
  Chip,
  Select,
  MenuItem,
  Typography,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { CATEGORY_LABELS } from '../../types';
import type { BusinessCategory } from '../../types';
import { SCORE_OPTIONS } from '../../constants/validation';
import type { SortOption } from '../../hooks/useListFilters';

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: BusinessCategory | null;
  onCategoryChange: (c: BusinessCategory | null) => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  showScoreFilter?: boolean;
  minScore?: number | null;
  onMinScoreChange?: (s: number | null) => void;
  resultCount: number;
  totalCount: number;
}

export default function ListFilters({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  sortBy,
  onSortChange,
  showScoreFilter,
  minScore,
  onMinScoreChange,
  resultCount,
  totalCount,
}: Props) {
  const hasActiveFilters = resultCount !== totalCount;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 2, py: 1 }}>
      <TextField
        size="small"
        placeholder="Buscar..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', flexWrap: 'nowrap', pb: 0.5 }}>
        {(Object.entries(CATEGORY_LABELS) as [BusinessCategory, string][]).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            size="small"
            variant={categoryFilter === key ? 'filled' : 'outlined'}
            color={categoryFilter === key ? 'primary' : 'default'}
            onClick={() => onCategoryChange(categoryFilter === key ? null : key)}
            sx={{ flexShrink: 0 }}
          />
        ))}
      </Box>

      {showScoreFilter && onMinScoreChange && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap' }}>
          {SCORE_OPTIONS.map((s) => {
            const label = s === 5 ? '5' : `${s}+`;
            const active = minScore === s;
            return (
              <Chip
                key={s}
                label={`${label} ★`}
                size="small"
                variant={active ? 'filled' : 'outlined'}
                color={active ? 'primary' : 'default'}
                onClick={() => onMinScoreChange(active ? null : s)}
              />
            );
          })}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Select
          size="small"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          sx={{ minWidth: 160, fontSize: '0.8rem' }}
        >
          <MenuItem value="date-desc">Más reciente</MenuItem>
          <MenuItem value="date-asc">Más antiguo</MenuItem>
          <MenuItem value="name-asc">Nombre A-Z</MenuItem>
          <MenuItem value="name-desc">Nombre Z-A</MenuItem>
          {showScoreFilter && <MenuItem value="score-desc">Mejor puntuación</MenuItem>}
          {showScoreFilter && <MenuItem value="score-asc">Menor puntuación</MenuItem>}
        </Select>

        {hasActiveFilters && (
          <Typography variant="caption" color="text.secondary">
            {resultCount} de {totalCount}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
