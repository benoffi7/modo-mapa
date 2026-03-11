import { useState, useCallback } from 'react';
import { Paper, InputBase, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import MenuIcon from '@mui/icons-material/Menu';
import { useMapContext } from '../../context/MapContext';

interface Props {
  onMenuClick: () => void;
}

export default function SearchBar({ onMenuClick }: Props) {
  const { searchQuery, setSearchQuery } = useMapContext();
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
      <IconButton size="small" onClick={onMenuClick} sx={{ p: 1, color: '#5f6368' }}>
        <MenuIcon />
      </IconButton>
      <InputBase
        placeholder="Buscar comercios..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        sx={{
          flex: 1,
          ml: 0.5,
          fontSize: '1rem',
          '& input': { p: 0 },
        }}
      />
      {searchQuery ? (
        <IconButton size="small" onClick={handleClear} sx={{ p: 1, color: '#5f6368' }}>
          <ClearIcon />
        </IconButton>
      ) : (
        <IconButton size="small" sx={{ p: 1, color: '#5f6368' }}>
          <SearchIcon />
        </IconButton>
      )}
    </Paper>
  );
}
