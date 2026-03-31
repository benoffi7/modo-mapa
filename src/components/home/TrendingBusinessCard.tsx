import { memo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import ListItemButton from '@mui/material/ListItemButton';
import StarIcon from '@mui/icons-material/Star';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { MEDALS } from '../../constants/rankings';
import { CATEGORY_LABELS } from '../../constants/business';
import { trackEvent } from '../../utils/analytics';
import { EVT_TRENDING_BUSINESS_CLICKED } from '../../constants/analyticsEvents';
import type { TrendingBusiness, Business, BusinessCategory } from '../../types';

interface Props {
  business: TrendingBusiness;
  fullBusiness?: Business | undefined;
  rank: number;
  onSelectBusiness: (business: Business) => void;
}

const BREAKDOWN_ITEMS = [
  { key: 'ratings' as const, icon: StarIcon, label: 'calificaciones' },
  { key: 'comments' as const, icon: ChatBubbleOutlineIcon, label: 'comentarios' },
  { key: 'userTags' as const, icon: LocalOfferOutlinedIcon, label: 'tags' },
  { key: 'priceLevels' as const, icon: AttachMoneyIcon, label: 'precios' },
  { key: 'listItems' as const, icon: BookmarkBorderIcon, label: 'en listas' },
] as const;

export default memo(function TrendingBusinessCard({ business, fullBusiness, rank, onSelectBusiness }: Props) {
  const medal = MEDALS[rank] ?? '';

  const handleClick = () => {
    if (fullBusiness) {
      onSelectBusiness(fullBusiness);
    }
    trackEvent(EVT_TRENDING_BUSINESS_CLICKED, { businessId: business.businessId, rank });
  };

  const categoryLabel = CATEGORY_LABELS[business.category as BusinessCategory] ?? business.category;

  return (
    <ListItemButton onClick={handleClick} disabled={!fullBusiness} sx={{ py: 1.5, px: 2, alignItems: 'flex-start', minHeight: 48 }}>
      <Typography
        sx={{ minWidth: 44, fontWeight: 700, fontSize: '1.1rem', pt: 0.5, textAlign: 'center' }}
      >
        {medal || `#${rank}`}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1" fontWeight={600} noWrap>
          {business.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {categoryLabel} · {business.score} pts
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          {BREAKDOWN_ITEMS.map(({ key, icon: Icon, label }) => {
            const count = business.breakdown[key];
            if (!count) return null;
            return (
              <Chip
                key={key}
                icon={<Icon sx={{ fontSize: 14 }} />}
                label={`+${count} ${label}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 24 }}
              />
            );
          })}
        </Box>
      </Box>
    </ListItemButton>
  );
});
