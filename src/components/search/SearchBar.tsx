import { useState, useCallback } from 'react';
import { Paper, InputBase, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import MenuIcon from '@mui/icons-material/Menu';
import { useFilters } from '../../context/MapContext';
import { useAuth } from '../../context/AuthContext';
import { trackEvent } from '../../utils/analytics';
import NotificationBell from '../notifications/NotificationBell';

interface Props {
  onMenuClick: () => void;
}

export default function SearchBar({ onMenuClick }: Props) {
  const { searchQuery, setSearchQuery } = useFilters();
  const { user } = useAuth();
  const [focused, setFocused] = useState(false);

  const handleClear = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  return (
    <Paper
      elevation={focused ? 4 : 2}
      sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        borderRadius: '28px',
        px: 1,
        py: 0.5,
        transition: 'box-shadow 0.2s',
      }}
    >
      <IconButton size="small" aria-label="Menú" onClick={onMenuClick} sx={{ p: 1, color: 'text.secondary' }}>
        <MenuIcon />
      </IconButton>
      <InputBase
        placeholder="Buscar comercios..."
        slotProps={{ htmlInput: { 'aria-label': 'Buscar comercios' } }}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (searchQuery.trim()) {
            trackEvent('business_search', { query: searchQuery.trim() });
          }
        }}
        sx={{
          flex: 1,
          ml: 0.5,
          fontSize: '1rem',
          '& input': { p: 0 },
        }}
      />
      {searchQuery ? (
        <IconButton size="small" aria-label="Limpiar búsqueda" onClick={handleClear} sx={{ p: 1, color: 'text.secondary' }}>
          <ClearIcon />
        </IconButton>
      ) : (
        <IconButton size="small" aria-label="Buscar" sx={{ p: 1, color: 'text.secondary' }}>
          <SearchIcon />
        </IconButton>
      )}
      {user && <NotificationBell />}
    </Paper>
  );
}
