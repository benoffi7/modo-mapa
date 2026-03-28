import { useState, memo } from 'react';
import {
  TextField, List, ListItemButton, ListItemText, ListItemAvatar,
  Avatar, Paper, Typography, CircularProgress, InputAdornment, Box,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useUserSearch } from '../hooks/useUserSearch';
import { MSG_COMMON } from '../constants/messages';

interface UserSearchFieldProps {
  onSelect: (userId: string, displayName: string) => void;
  placeholder?: string;
  excludeUserId?: string | undefined;
}

export const UserSearchField = memo(function UserSearchField({
  onSelect,
  placeholder = 'Buscar usuarios...',
  excludeUserId,
}: UserSearchFieldProps) {
  const { results, searching, search, clear } = useUserSearch();
  const [value, setValue] = useState('');

  const filtered = excludeUserId
    ? results.filter((r) => r.userId !== excludeUserId)
    : results;

  return (
    <Box sx={{ position: 'relative' }}>
      <TextField
        fullWidth
        size="small"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          search(e.target.value);
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                {searching ? <CircularProgress size={18} /> : <SearchIcon fontSize="small" />}
              </InputAdornment>
            ),
          },
        }}
      />
      {value.length >= 2 && (filtered.length > 0 || (!searching && results.length === 0)) && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            zIndex: 10, maxHeight: 240, overflow: 'auto', mt: 0.5,
          }}
        >
          {filtered.length > 0 ? (
            <List dense disablePadding>
              {filtered.map((u) => (
                <ListItemButton
                  key={u.userId}
                  onClick={() => {
                    onSelect(u.userId, u.displayName);
                    setValue('');
                    clear();
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                      {u.displayName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={u.displayName} />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {MSG_COMMON.noUsersFound}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {MSG_COMMON.publicProfileHint}
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
});
