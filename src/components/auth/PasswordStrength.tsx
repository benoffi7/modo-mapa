import { Box, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { validatePassword } from '../../constants/auth';

const RULES = [
  { key: 'length', label: '8+ caracteres' },
  { key: 'uppercase', label: 'Una mayúscula' },
  { key: 'number', label: 'Un número' },
  { key: 'symbol', label: 'Un símbolo' },
] as const;

interface Props {
  password: string;
}

export default function PasswordStrength({ password }: Props) {
  if (!password) return null;

  const validation = validatePassword(password);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.25, mt: -0.5 }}>
      {RULES.map(({ key, label }) => {
        const passed = validation[key];
        return (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {passed ? (
              <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
            ) : (
              <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            )}
            <Typography
              variant="caption"
              sx={{ fontSize: '0.7rem', color: passed ? 'text.secondary' : 'text.disabled' }}
            >
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
