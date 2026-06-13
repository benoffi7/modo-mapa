import { Box } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface SearchFabProps {
  /** True cuando el tab "Buscar" está activo (cambia bgcolor a primary.dark). */
  active: boolean;
}

/**
 * Botón circular elevado del centro de TabBar.
 * Decorativo dentro del `<BottomNavigationAction label="Buscar">` —
 * la semántica del tab la provee el action, no este componente.
 *
 * Props-driven para evitar acoplamiento al `useTab` (test-friendly).
 * El active es derivado en TabBar y pasado como prop, cierra Guard #305 R3
 * (no se depende del markup interno de MUI para estilo activo).
 */
export default function SearchFab({ active }: SearchFabProps) {
  return (
    <Box
      sx={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        bgcolor: active ? 'primary.dark' : 'primary.main',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mt: -2.5,
        boxShadow: 3,
      }}
    >
      <SearchIcon sx={{ color: 'primary.contrastText', fontSize: 28 }} />
    </Box>
  );
}
