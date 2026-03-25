import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShareIcon from '@mui/icons-material/Share';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { ACTION_LABELS, SCORING, getUserTier, TIERS } from '../../constants/rankings';
import { evaluateBadges } from '../../constants/badges';
import { fetchUserScoreHistory } from '../../services/rankings';
import BadgesList from './BadgesList';
import ScoreSparkline from './ScoreSparkline';
import type { UserRankingEntry } from '../../types';
import { logger } from '../../utils/logger';

/** Theme-aware bar colors: [light, dark] */
const BAR_COLOR_PAIRS: Record<keyof UserRankingEntry['breakdown'], [string, string]> = {
  photos: ['#e65100', '#ff8a50'],
  comments: ['#1565c0', '#42a5f5'],
  ratings: ['#2e7d32', '#66bb6a'],
  likes: ['#c62828', '#ef5350'],
  tags: ['#6a1b9a', '#ab47bc'],
  favorites: ['#f9a825', '#ffee58'],
};

function TierProgress({ score, isDark }: { score: number; isDark: boolean }) {
  const tier = getUserTier(score);
  const tierIdx = TIERS.findIndex((t) => t.name === tier.name);
  const nextTier = tierIdx > 0 ? TIERS[tierIdx - 1] : null;

  const progress = nextTier
    ? ((score - tier.minScore) / (nextTier.minScore - tier.minScore)) * 100
    : 100;

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {tier.icon} {tier.name}
        </Typography>
        {nextTier && (
          <Typography variant="caption" color="text.secondary">
            {nextTier.minScore - score} pts → {nextTier.icon} {nextTier.name}
          </Typography>
        )}
      </Box>
      <Box sx={{ height: 5, bgcolor: 'action.hover', borderRadius: 3, overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%',
            width: `${Math.min(progress, 100)}%`,
            bgcolor: tier.color[isDark ? 1 : 0],
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }}
        />
      </Box>
    </Box>
  );
}

interface Props {
  entry: UserRankingEntry | undefined;
  position: number | undefined;
  isLive?: boolean;
  periodLabel?: string;
  periodType?: 'weekly' | 'monthly' | 'yearly' | 'alltime';
}

async function handleShare(position: number | undefined, score: number, periodLabel: string) {
  const posText = position ? `#${position}` : '';
  const text = posText
    ? `Soy ${posText} en el ranking ${periodLabel} de Modo Mapa con ${score} puntos!`
    : `Tengo ${score} puntos en el ranking ${periodLabel} de Modo Mapa!`;

  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch {
      // user cancelled
    }
  } else {
    await navigator.clipboard.writeText(text);
  }
}

export default function UserScoreCard({ entry, position, isLive, periodLabel = 'semanal', periodType = 'weekly' }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);

  const userId = entry?.userId;
  useEffect(() => {
    if (!userId || periodType === 'alltime') return;
    let cancelled = false;
    fetchUserScoreHistory(userId, periodType).then((h) => {
      if (!cancelled) setScoreHistory(h);
    }).catch((err) => logger.error('[UserScoreCard] fetchUserScoreHistory failed:', err));
    return () => { cancelled = true; };
  }, [userId, periodType]);

  if (!entry) {
    return null;
  }

  const tier = getUserTier(entry.score);
  const badges = evaluateBadges(entry.breakdown, { position, streak: entry.streak });
  const maxContribution = Math.max(
    ...Object.keys(SCORING).map(
      (k) => entry.breakdown[k as keyof typeof entry.breakdown] * SCORING[k as keyof typeof SCORING],
    ),
    1,
  );

  return (
    <Card variant="outlined" sx={{ mx: 2, mb: 2, p: 1.5 }}>
      {/* Collapsed: 2-line summary */}
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Line 1: Title + position */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Tu actividad
            </Typography>
            {isLive && (
              <Typography variant="caption" color="text.secondary">
                (en vivo)
              </Typography>
            )}
            {position != null && (
              <Chip label={`#${position}`} size="small" color="primary" variant="outlined" sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }} />
            )}
          </Box>

          {/* Line 2: Tier + badges + score */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            <Typography variant="caption" color="text.secondary">
              {tier.icon} {tier.name}
            </Typography>
            {entry.streak != null && entry.streak > 0 && (
              <Typography variant="caption" color="text.secondary">
                · 🔥{entry.streak}d
              </Typography>
            )}
            {badges.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                · {badges.length} logros
              </Typography>
            )}
          </Box>
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
          {entry.score} pts
        </Typography>

        <IconButton
          size="small"
          sx={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            p: 0.25,
          }}
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Expanded: full details */}
      <Collapse in={expanded}>
        <Box sx={{ mt: 1.5 }}>
          {/* Breakdown bars */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {(Object.entries(ACTION_LABELS) as Array<[keyof UserRankingEntry['breakdown'], string]>).map(
              ([key, label]) => {
                const count = entry.breakdown[key];
                const points = count * SCORING[key];
                const pct = maxContribution > 0 ? (points / maxContribution) * 100 : 0;

                return (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{ minWidth: 75, color: 'text.secondary', fontSize: '0.7rem' }}
                    >
                      {label}
                    </Typography>
                    <Box sx={{ flex: 1, position: 'relative', height: 12, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          height: '100%',
                          width: `${pct}%`,
                          bgcolor: BAR_COLOR_PAIRS[key][isDark ? 1 : 0],
                          borderRadius: 1,
                          transition: 'width 0.4s ease',
                          minWidth: count > 0 ? 4 : 0,
                        }}
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ minWidth: 28, textAlign: 'right', fontWeight: 600, fontSize: '0.7rem' }}
                    >
                      {points > 0 ? `+${points}` : '0'}
                    </Typography>
                  </Box>
                );
              },
            )}
          </Box>

          {/* Badges */}
          {badges.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <BadgesList badges={badges} compact />
            </Box>
          )}

          {/* Tier progress */}
          <TierProgress score={entry.score} isDark={isDark} />

          {/* Score evolution */}
          <ScoreSparkline scores={scoreHistory} />

          {/* Share + total */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Tooltip title="Compartir tu logro">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleShare(position, entry.score, periodLabel); }} aria-label="Compartir tu logro">
                <ShareIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Total: {entry.score} pts
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Card>
  );
}
