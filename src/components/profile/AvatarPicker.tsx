import { Dialog, DialogTitle, DialogContent, Box, ButtonBase, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { AVATAR_OPTIONS } from '../../constants/avatars';
import type { AvatarOption } from '../../constants/avatars';
import { MSG_COMMON } from '../../constants/messages';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (avatar: AvatarOption) => void;
  selectedId: string | undefined;
}

export default function AvatarPicker({ open, onClose, onSelect, selectedId }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Elegir avatar
        <IconButton size="small" aria-label={MSG_COMMON.closeAriaLabel} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
          {AVATAR_OPTIONS.map((avatar) => (
            <ButtonBase
              key={avatar.id}
              aria-label={avatar.label}
              aria-pressed={selectedId === avatar.id}
              onClick={() => { onSelect(avatar); onClose(); }}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                p: 1,
                borderRadius: 2,
                border: selectedId === avatar.id ? 2 : 1,
                borderColor: selectedId === avatar.id ? 'primary.main' : 'divider',
                width: '100%',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Typography fontSize={28}>{avatar.emoji}</Typography>
              <Typography variant="caption" noWrap sx={{ maxWidth: 56 }}>{avatar.label}</Typography>
            </ButtonBase>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
