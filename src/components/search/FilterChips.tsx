import { Box, Chip, Divider } from '@mui/material';
import { useMapContext } from '../../context/MapContext';
import { PREDEFINED_TAGS } from '../../types';

const PRICE_CHIPS = [
  { level: 1, label: '$' },
  { level: 2, label: '$$' },
  { level: 3, label: '$$$' },
] as const;

export default function FilterChips() {
  const { activeFilters, toggleFilter, activePriceFilter, setPriceFilter } = useMapContext();

  const chipSx = (isActive: boolean) => ({
    backgroundColor: isActive ? undefined : 'background.paper',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    flexShrink: 0,
    '&:hover': {
      boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
    },
  });

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
        pointerEvents: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
        '& > *': { pointerEvents: 'auto' },
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
            sx={chipSx(isActive)}
          />
        );
      })}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {PRICE_CHIPS.map((chip) => {
        const isActive = activePriceFilter === chip.level;
        return (
          <Chip
            key={`price-${chip.level}`}
            label={chip.label}
            onClick={() => setPriceFilter(chip.level)}
            variant={isActive ? 'filled' : 'outlined'}
            color={isActive ? 'secondary' : 'default'}
            sx={chipSx(isActive)}
          />
        );
      })}
    </Box>
  );
}
