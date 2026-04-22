import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { MAX_ADMIN_RESPONSE_LENGTH } from '../../../constants/feedback';

export interface FeedbackRespondFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
}

/**
 * Form inline para responder feedback dentro de la tabla.
 * Extraído de FeedbackList para evitar que el archivo supere 400 LOC.
 */
export default function FeedbackRespondForm({ value, onChange, onSubmit, onCancel, submitting }: FeedbackRespondFormProps) {
  const trimmedEmpty = !value.trim();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <TextField
        size="small"
        multiline
        maxRows={3}
        placeholder="Escribir respuesta..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        slotProps={{ htmlInput: { maxLength: MAX_ADMIN_RESPONSE_LENGTH } }}
      />
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Button
          size="small"
          variant="contained"
          disabled={trimmedEmpty || submitting}
          onClick={onSubmit}
        >
          Enviar
        </Button>
        <Button size="small" onClick={onCancel}>
          Cancelar
        </Button>
      </Box>
    </Box>
  );
}
