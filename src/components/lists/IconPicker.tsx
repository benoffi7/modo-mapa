import { Dialog, DialogTitle, DialogContent, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LIST_ICON_OPTIONS } from '../../constants/listIcons';
import type { ListIconOption } from '../../constants/listIcons';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (icon: ListIconOption) => void;
  selectedId: string | undefined;
}

export default function IconPicker({ open, onClose, onSelect, selectedId }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Elegir icono
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1 }}>
          {LIST_ICON_OPTIONS.map((icon) => (
            <Box
              key={icon.id}
              onClick={() => { onSelect(icon); onClose(); }}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                p: 0.75,
                borderRadius: 2,
                border: selectedId === icon.id ? 2 : 1,
                borderColor: selectedId === icon.id ? 'primary.main' : 'divider',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Typography fontSize={24}>{icon.emoji}</Typography>
              <Typography variant="caption" noWrap sx={{ maxWidth: 48, fontSize: '0.6rem' }}>{icon.label}</Typography>
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
