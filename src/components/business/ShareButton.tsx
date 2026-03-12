import { useState } from 'react';
import { IconButton, Snackbar } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
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
      } catch {
        // User cancelled share — ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      setSnackOpen(true);
    }
  };

  return (
    <>
      <IconButton onClick={handleShare} aria-label="Compartir comercio" sx={{ color: '#5f6368' }}>
        <ShareIcon />
      </IconButton>
      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        message="Link copiado"
      />
    </>
  );
}
