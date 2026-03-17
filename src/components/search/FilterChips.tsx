import { Box, Chip, Divider } from '@mui/material';
import { useFilters } from '../../context/MapContext';
import { trackEvent } from '../../utils/analytics';
import { PREDEFINED_TAGS } from '../../types';
import { PRICE_CHIPS } from '../../constants/business';

export default function FilterChips() {
  const { activeFilters, toggleFilter, activePriceFilter, setPriceFilter } = useFilters();

  const chipSx = (isActive: boolean) => ({
    backgroundColor: isActive ? undefined : 'background.paper',
    boxShadow: 1,
    flexShrink: 0,
    '&:hover': {
      boxShadow: 2,
      backgroundColor: isActive ? undefined : 'background.paper',
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
            onClick={() => {
              trackEvent('business_filter_tag', { tag_name: tag.id, active: !isActive });
              toggleFilter(tag.id);
            }}
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
            onClick={() => {
              trackEvent('business_filter_price', { price_level: chip.level, active: !isActive });
              setPriceFilter(chip.level);
            }}
            variant={isActive ? 'filled' : 'outlined'}
            color={isActive ? 'secondary' : 'default'}
            sx={chipSx(isActive)}
          />
        );
      })}
    </Box>
  );
}
