import { Box, TextField, IconButton, Autocomplete, ToggleButtonGroup, ToggleButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import type { Business } from '../../types';

type SortMode = 'recent' | 'oldest' | 'useful';

interface Props {
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  filterBusiness: Business | null;
  onFilterBusinessChange: (business: Business | null) => void;
  businessOptions: Business[];
}

export default function CommentsToolbar({
  sortMode, onSortChange,
  searchInput, onSearchChange,
  filterBusiness, onFilterBusinessChange,
  businessOptions,
}: Props) {
  return (
    <>
      {/* Sorting */}
      <ToggleButtonGroup
        value={sortMode}
        exclusive
        onChange={(_, v) => v && onSortChange(v as SortMode)}
        size="small"
        aria-label="Ordenar comentarios"
        sx={{ display: 'flex', gap: 0.5, px: 2, py: 1 }}
      >
        {(['recent', 'oldest', 'useful'] as const).map((mode) => (
          <ToggleButton
            key={mode}
            value={mode}
            sx={{
              height: 24, fontSize: '0.7rem', borderRadius: '16px !important',
              border: '1px solid', borderColor: 'divider', textTransform: 'none', px: 1.5,
            }}
          >
            {mode === 'recent' ? 'Recientes' : mode === 'oldest' ? 'Antiguos' : 'Más likes'}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Search */}
      <Box sx={{ px: 2, mb: 1 }}>
        <TextField
          size="small"
          placeholder="Buscar comentarios..."
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar comentarios"
          fullWidth
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />,
              endAdornment: searchInput ? (
                <IconButton size="small" onClick={() => onSearchChange('')} aria-label="Limpiar búsqueda">
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              ) : null,
            },
          }}
        />
      </Box>

      {/* Filter by business */}
      {businessOptions.length > 1 && (
        <Box sx={{ px: 2, mb: 1 }}>
          <Autocomplete
            size="small"
            options={businessOptions}
            getOptionLabel={(b) => b.name}
            value={filterBusiness}
            onChange={(_, v) => onFilterBusinessChange(v)}
            renderInput={(params) => (
              <TextField {...params} placeholder="Filtrar por comercio..." size="small" />
            )}
          />
        </Box>
      )}
    </>
  );
}
