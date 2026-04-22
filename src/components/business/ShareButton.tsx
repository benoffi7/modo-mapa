import { useState } from 'react';
import { IconButton, Snackbar } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import { trackEvent } from '../../utils/analytics';
import type { Business } from '../../types';

interface Props {
  business: Business;
}

export default function ShareButton({ business }: Props) {
  const [snackOpen, setSnackOpen] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/?business=${business.id}`;
    const text = `Mirá ${business.name} en Modo Mapa — ${business.address}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: business.name, text, url });
        trackEvent('business_share', { business_id: business.id, method: 'share_api' });
      } catch {
        // User cancelled share — ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      setSnackOpen(true);
      trackEvent('business_share', { business_id: business.id, method: 'clipboard' });
    }
  };

  return (
    <>
      <IconButton onClick={handleShare} aria-label="Compartir comercio" sx={{ color: 'text.primary' }}>
        <ShareIcon />
      </IconButton>
      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        message="Link copiado al portapapeles"
      />
    </>
  );
}
