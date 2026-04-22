import { Box, Stack, Typography, Button, IconButton, Fade } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import CloseIcon from '@mui/icons-material/Close';
import { MSG_COMMON } from '../../constants/messages';

interface RatingPromptBannerProps {
  businessName: string;
  onRate: () => void;
  onDismiss: () => void;
}

export default function RatingPromptBanner({ businessName, onRate, onDismiss }: RatingPromptBannerProps) {
  return (
    <Fade in timeout={200}>
      <Box
        sx={{
          position: 'absolute',
          bottom: 80,
          left: 8,
          right: 8,
          zIndex: 1100,
          bgcolor: 'action.hover',
          borderLeft: 4,
          borderColor: 'warning.main',
          borderRadius: 1,
          px: 2,
          py: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <StarIcon color="warning" fontSize="small" />
          <Typography variant="body2" sx={{ flex: 1 }}>
            {`\u00bfC\u00f3mo fue tu visita a ${businessName}?`}
          </Typography>
          <Button
            size="small"
            variant="contained"
            onClick={onRate}
            sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            Calificar
          </Button>
          <IconButton size="small" onClick={onDismiss} aria-label={MSG_COMMON.closeAriaLabel}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Fade>
  );
}
