import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { BadgeDefinition } from '../../constants/badges';
import type { VerificationBadge as VerificationBadgeType } from '../../types';
import VerificationBadge from './VerificationBadge';

interface Props {
  badges: BadgeDefinition[];
  verificationBadges?: VerificationBadgeType[] | undefined;
  compact?: boolean;
}

export default function BadgesList({ badges, verificationBadges, compact = false }: Props) {
  const hasVerification = verificationBadges && verificationBadges.length > 0;
  const hasActivity = badges.length > 0;

  if (!hasVerification && !hasActivity) return null;

  if (compact) {
    return (
      <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
        {hasVerification && verificationBadges.map((vb) => (
          <VerificationBadge key={vb.id} badge={vb} compact />
        ))}
        {badges.map((b) => (
          <Tooltip key={b.id} title={`${b.name}: ${b.description}`}>
            <Typography component="span" sx={{ fontSize: '0.85rem', cursor: 'default' }}>
              {b.icon}
            </Typography>
          </Tooltip>
        ))}
      </Box>
    );
  }

  return (
    <Box>
      {hasVerification && (
        <Box sx={{ mb: hasActivity ? 1.5 : 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
            Verificaci&oacute;n
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {verificationBadges.map((vb) => (
              <VerificationBadge key={vb.id} badge={vb} compact />
            ))}
          </Box>
        </Box>
      )}

      {hasVerification && hasActivity && <Divider sx={{ my: 1 }} />}

      {hasActivity && (
        <Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {badges.map((b) => (
              <Tooltip key={b.id} title={b.description}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.25,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                  }}
                >
                  <Typography component="span" sx={{ fontSize: '0.85rem' }}>
                    {b.icon}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>
                    {b.name}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
