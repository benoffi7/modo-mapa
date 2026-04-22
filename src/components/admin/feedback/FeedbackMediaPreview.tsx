import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { isValidStorageUrl } from '../../../utils/media';

export interface FeedbackMediaPreviewProps {
  mediaUrl: string | null | undefined;
  mediaType: string | null | undefined;
  onOpenImage: (url: string) => void;
}

/**
 * Render del adjunto de feedback: PDF como link, imagen como thumbnail,
 * o mensaje de adjunto no disponible si la URL no es válida.
 * Extraído de FeedbackList para bajar LOC del archivo orquestador.
 */
export default function FeedbackMediaPreview({ mediaUrl, mediaType, onOpenImage }: FeedbackMediaPreviewProps) {
  if (isValidStorageUrl(mediaUrl ?? undefined) && mediaType === 'pdf') {
    return (
      <Link href={mediaUrl!} target="_blank" rel="noopener" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
        <PictureAsPdfIcon color="error" fontSize="small" />
        <Typography variant="caption">PDF adjunto</Typography>
      </Link>
    );
  }
  if (isValidStorageUrl(mediaUrl ?? undefined)) {
    return (
      <Box
        component="img"
        src={mediaUrl!}
        alt="Adjunto"
        onClick={() => onOpenImage(mediaUrl!)}
        sx={{ maxHeight: 60, borderRadius: 0.5, mt: 0.5, cursor: 'pointer', objectFit: 'cover' }}
      />
    );
  }
  if (mediaUrl) {
    return <Typography variant="caption" color="error">Adjunto no disponible</Typography>;
  }
  return null;
}
