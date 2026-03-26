import { Box, Card, CardActionArea, CardContent, Typography, CircularProgress } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import { useSuggestions } from '../../hooks/useSuggestions';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { CATEGORY_LABELS } from '../../constants/business';
import { trackEvent } from '../../utils/analytics';
import type { BusinessCategory } from '../../types';

export default function ForYouSection() {
  const { suggestions, isLoading } = useSuggestions();
  const { navigateToBusiness } = useNavigateToBusiness();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Para ti
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, overflow: 'auto', pb: 1 }}>
        {suggestions.slice(0, 8).map((s) => (
          <Card
            key={s.business.id}
            variant="outlined"
            sx={{ minWidth: 160, maxWidth: 180, flexShrink: 0 }}
          >
            <CardActionArea
              onClick={() => {
                trackEvent('for_you_tapped', { business_id: s.business.id });
                navigateToBusiness(s.business);
              }}
            >
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="subtitle2" noWrap fontWeight={600}>
                  {s.business.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {CATEGORY_LABELS[s.business.category as BusinessCategory] ?? s.business.category}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <ChatBubbleOutlineIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.secondary">0</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <ThumbUpOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.secondary">0</Typography>
                  </Box>
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
