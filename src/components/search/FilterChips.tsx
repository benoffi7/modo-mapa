import { Box, Chip } from '@mui/material';
import { useMapContext } from '../../context/MapContext';
import { PREDEFINED_TAGS } from '../../types';

export default function FilterChips() {
  const { activeFilters, toggleFilter } = useMapContext();

  return (
    <Box
      role="group"
      aria-label="Filtros de etiquetas"
      sx={{
        position: 'absolute',
        top: 72,
        left: 0,
        right: 0,
        zIndex: 1100,
        display: 'flex',
        gap: 1,
        px: 2,
        overflowX: 'auto',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      {PREDEFINED_TAGS.map((tag) => {
        const isActive = activeFilters.includes(tag.id);
        return (
          <Chip
            key={tag.id}
            label={tag.label}
            onClick={() => toggleFilter(tag.id)}
            variant={isActive ? 'filled' : 'outlined'}
            color={isActive ? 'primary' : 'default'}
            sx={{
              backgroundColor: isActive ? undefined : '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              flexShrink: 0,
              '&:hover': {
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              },
            }}
          />
        );
      })}
    </Box>
  );
}
