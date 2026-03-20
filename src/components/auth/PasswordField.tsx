import { useState } from 'react';
import { TextField, InputAdornment, IconButton, Box, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'new-password' | 'current-password';
  autoFocus?: boolean;
  error?: boolean | undefined;
  helperText?: string | undefined;
  name?: string;
}

export default function PasswordField({ label, value, onChange, autoComplete, autoFocus, error, helperText, name }: Props) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Box>
      <TextField
        label={label}
        type={showPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        fullWidth
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        name={name}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setShowPassword((prev) => !prev)}
                  edge="end"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      {error && helperText && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <ErrorOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
          <Typography variant="caption" color="error">{helperText}</Typography>
        </Box>
      )}
    </Box>
  );
}
