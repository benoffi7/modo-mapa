import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useAuth } from '../../context/AuthContext';
import { useRankings } from '../../hooks/useRankings';
import RankingItem from './RankingItem';
import UserScoreCard from './UserScoreCard';

const PERIOD_OPTIONS = [
  { value: 'weekly', label: 'Esta semana' },
  { value: 'monthly', label: 'Este mes' },
  { value: 'yearly', label: 'Este año' },
] as const;

export default function RankingsView() {
  const { user } = useAuth();
  const { ranking, loading, error, periodType, setPeriodType } = useRankings();

  const maxScore = ranking?.rankings[0]?.score ?? 0;
  const currentUserEntry = ranking?.rankings.find((e) => e.userId === user?.uid);
  const currentUserPosition = ranking?.rankings.findIndex((e) => e.userId === user?.uid);
  const position = currentUserPosition != null && currentUserPosition >= 0 ? currentUserPosition + 1 : undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Period selector */}
      <Box sx={{ display: 'flex', gap: 0.5, px: 2, py: 1.5, flexWrap: 'wrap' }}>
        {PERIOD_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            size="small"
            color={periodType === opt.value ? 'primary' : 'default'}
            variant={periodType === opt.value ? 'filled' : 'outlined'}
            onClick={() => setPeriodType(opt.value)}
          />
        ))}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="error">
              Error cargando el ranking.
            </Typography>
          </Box>
        )}

        {!loading && !error && !ranking && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No hay ranking disponible para este periodo.
            </Typography>
          </Box>
        )}

        {!loading && !error && ranking && (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pb: 1.5 }}>
              {ranking.rankings.map((entry, i) => (
                <RankingItem
                  key={entry.userId}
                  entry={entry}
                  position={i + 1}
                  maxScore={maxScore}
                  isCurrentUser={entry.userId === user?.uid}
                />
              ))}
            </Box>

            {ranking.totalParticipants > ranking.rankings.length && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', pb: 1 }}>
                Mostrando top {ranking.rankings.length} de {ranking.totalParticipants} participantes
              </Typography>
            )}
          </>
        )}
      </Box>

      {/* Current user card */}
      {!loading && !error && ranking && (
        <UserScoreCard entry={currentUserEntry} position={position} />
      )}
    </Box>
  );
}
