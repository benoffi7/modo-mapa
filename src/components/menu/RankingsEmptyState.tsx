import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

interface Props {
  /** true when nobody participated yet; false when only the current user has no activity */
  noRankingData: boolean;
}

export default function RankingsEmptyState({ noRankingData }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        px: 3,
        py: 5,
        textAlign: 'center',
      }}
    >
      <EmojiEventsIcon sx={{ fontSize: 48, color: 'text.disabled' }} />

      <Typography variant="subtitle2" color="text.secondary">
        {noRankingData ? 'Todavía no hay ranking para este período' : 'No estás en el ranking aún'}
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 260 }}>
        {noRankingData
          ? 'Sé el primero en participar. Cada acción suma puntos.'
          : 'Empezá a sumar puntos para aparecer en el ranking.'}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          mt: 1,
          alignItems: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          ¿Cómo sumar puntos?
        </Typography>
        {[
          { action: 'Subí una foto del menú', pts: 5 },
          { action: 'Dejá un comentario', pts: 3 },
          { action: 'Calificá un comercio', pts: 2 },
          { action: 'Deja un like, etiqueta o favorito', pts: 1 },
        ].map((item) => (
          <Typography key={item.action} variant="caption" color="text.secondary">
            {item.action} → <strong>+{item.pts} pts</strong>
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
