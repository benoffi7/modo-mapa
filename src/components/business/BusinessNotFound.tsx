import { Box, Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useNavigate } from 'react-router-dom';
import { MSG_BUSINESS_DETAIL } from '../../constants/messages/businessDetail';

interface Props {
  reason: 'invalid_id' | 'not_found' | 'offline_no_cache';
}

const MESSAGES: Record<Props['reason'], string> = {
  invalid_id: MSG_BUSINESS_DETAIL.invalidId,
  not_found: MSG_BUSINESS_DETAIL.notFound,
  offline_no_cache: MSG_BUSINESS_DETAIL.offlineNoCache,
};

export default function BusinessNotFound({ reason }: Props) {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        gap: 2,
        px: 3,
        textAlign: 'center',
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
      <Typography variant="body1" color="text.secondary">
        {MESSAGES[reason]}
      </Typography>
      <Button variant="outlined" onClick={() => navigate('/')}>
        {MSG_BUSINESS_DETAIL.backToMap}
      </Button>
    </Box>
  );
}
