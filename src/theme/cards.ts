import type { SxProps, Theme } from '@mui/material';

/**
 * Design system: reusable card styles used across the app.
 * Import these instead of duplicating border/radius/hover patterns.
 */

/** Standard bordered card — used in Favorites, Followed, Recommendations, Specials, Settings, Lists */
export const cardSx: SxProps<Theme> = {
  border: 1,
  borderColor: 'divider',
  borderRadius: 2,
  p: 1.5,
  cursor: 'pointer',
  '&:hover': { bgcolor: 'action.hover' },
};

/** Card with colored icon header — used in ListCardGrid, ForYouSection */
export const iconCardSx: SxProps<Theme> = {
  ...cardSx,
  display: 'flex',
  flexDirection: 'column',
  gap: 0.5,
};

/** Icon circle — used in ListCardGrid, SpecialsSection, QuickActions */
export const iconCircleSx = (color: string, size = 44): SxProps<Theme> => ({
  width: size,
  height: size,
  borderRadius: 1.5,
  bgcolor: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

/** Chip tab styles — used in ListsScreen, SocialScreen */
export const chipTabSx = (isActive: boolean): SxProps<Theme> => ({
  fontWeight: isActive ? 600 : 400,
  borderRadius: 2,
  px: 1,
  height: 36,
  '& .MuiChip-label': { px: 1 },
  '& .MuiChip-icon': { ml: 0.5 },
});

/** Section title — "Acciones rapidas", "Especiales", "Para Ti", etc. */
export const sectionTitleSx: SxProps<Theme> = {
  mb: 1,
};

/** Dashed button — "Crear nueva lista", "Crear acceso directo" */
export const dashedButtonSx: SxProps<Theme> = {
  borderStyle: 'dashed',
  py: 1.5,
  color: 'text.secondary',
  borderColor: 'divider',
};
