import { Dialog, DialogTitle, DialogContent, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export const LIST_COLORS = [
  { id: 'blue', hex: '#1e88e5' },
  { id: 'orange', hex: '#fb8c00' },
  { id: 'pink', hex: '#e91e63' },
  { id: 'green', hex: '#43a047' },
  { id: 'purple', hex: '#8e24aa' },
  { id: 'red', hex: '#e53935' },
  { id: 'teal', hex: '#00897b' },
  { id: 'amber', hex: '#ffb300' },
];

const ALLOWED_COLORS = new Set(LIST_COLORS.map((c) => c.hex));
export const DEFAULT_LIST_COLOR = '#1e88e5';

/** Validates a color hex against the whitelist. Returns default if invalid. */
export function sanitizeListColor(color: string | undefined): string {
  if (!color || !ALLOWED_COLORS.has(color)) return DEFAULT_LIST_COLOR;
  return color;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (hex: string) => void;
  selectedHex: string | undefined;
}

export default function ColorPicker({ open, onClose, onSelect, selectedHex }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Elegir color
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'center' }}>
          {LIST_COLORS.map((c) => (
            <Box
              key={c.id}
              onClick={() => { onSelect(c.hex); onClose(); }}
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: c.hex,
                cursor: 'pointer',
                border: selectedHex === c.hex ? 3 : 0,
                borderColor: 'common.white',
                boxShadow: selectedHex === c.hex ? 3 : 0,
                '&:hover': { opacity: 0.8 },
              }}
            />
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
