import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { useFollowedTags } from '../../hooks/useFollowedTags';
import { useInterestsFeed } from '../../hooks/useInterestsFeed';
import { useNavigateToBusiness } from '../../hooks/useNavigateToBusiness';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import { useAuth } from '../../context/AuthContext';
import { SUGGESTED_TAGS } from '../../constants/interests';
import { CATEGORY_LABELS } from '../../constants/business';
import { trackEvent } from '../../utils/analytics';
import {
  EVT_INTERESTS_SECTION_VIEWED,
  EVT_INTERESTS_BUSINESS_TAPPED,
  EVT_INTERESTS_CTA_TAPPED,
  EVT_INTERESTS_SUGGESTED_TAPPED,
} from '../../constants/analyticsEvents';
import FollowTagChip from '../common/FollowTagChip';
import type { BusinessCategory, InterestFeedGroup } from '../../types';

function BusinessCard({ group, onTap }: { group: InterestFeedGroup; onTap: (businessId: string, tag: string) => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {group.businesses.map(({ business }) => (
        <Box
          key={business.id}
          onClick={() => onTap(business.id, group.tag)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1,
            borderRadius: 1,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {business.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {CATEGORY_LABELS[business.category as BusinessCategory] ?? business.category}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function EmptyState({ onFollow, onExplore }: { onFollow: (tag: string) => void; onExplore: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2, gap: 1 }}>
      <LocalOfferIcon color="action" sx={{ fontSize: 36 }} />
      <Typography variant="subtitle2" fontWeight={600}>
        Segui temas que te interesan
      </Typography>
      <Typography variant="caption" color="text.secondary" textAlign="center">
        Te mostraremos negocios que coincidan con tus gustos
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center', mt: 0.5 }}>
        {SUGGESTED_TAGS.map((tag) => (
          <FollowTagChip
            key={tag}
            tag={tag}
            followed={false}
            onToggle={() => {
              trackEvent(EVT_INTERESTS_SUGGESTED_TAPPED, { tag });
              onFollow(tag);
            }}
          />
        ))}
      </Box>
      <Button
        size="small"
        onClick={() => {
          trackEvent(EVT_INTERESTS_CTA_TAPPED);
          onExplore();
        }}
        sx={{ mt: 0.5 }}
      >
        Explorar mas tags
      </Button>
    </Box>
  );
}

export default function YourInterestsSection() {
  const { user } = useAuth();
  const { tags, followTag, isFollowed } = useFollowedTags();
  const { groups, markSeen, loading } = useInterestsFeed();
  const { navigateToBusiness } = useNavigateToBusiness();
  const { navigateToSearch } = useTabNavigation();
  const [manualTag, setManualTag] = useState<string | null>(null);

  // Derive effective selected tag: manual selection if still valid, else first tag
  const selectedTag = useMemo(() => {
    if (manualTag && tags.includes(manualTag)) return manualTag;
    return tags.length > 0 ? tags[0] : null;
  }, [manualTag, tags]);

  // Mark seen when section renders with data
  useEffect(() => {
    if (groups.length > 0) {
      trackEvent(EVT_INTERESTS_SECTION_VIEWED, { tag_count: tags.length, total_new: 0 });
      markSeen();
    }
  }, [groups.length, tags.length, markSeen]);

  if (!user || loading) return null;

  const handleBusinessTap = (businessId: string, tag: string) => {
    trackEvent(EVT_INTERESTS_BUSINESS_TAPPED, { business_id: businessId, tag });
    navigateToBusiness(businessId);
  };

  const handleChipToggle = (tag: string) => {
    if (isFollowed(tag)) {
      setManualTag(tag);
    }
  };

  const activeGroup = groups.find((g) => g.tag === selectedTag);

  if (tags.length === 0) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Tus intereses
        </Typography>
        <EmptyState
          onFollow={(tag) => followTag(tag, 'home')}
          onExplore={navigateToSearch}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Tus intereses
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.75, overflow: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
        {tags.map((tag) => {
          const group = groups.find((g) => g.tag === tag);
          return (
            <FollowTagChip
              key={tag}
              tag={tag}
              followed={selectedTag === tag}
              onToggle={handleChipToggle}
              newCount={group?.newCount}
            />
          );
        })}
      </Box>
      {activeGroup && activeGroup.businesses.length > 0 && (
        <BusinessCard group={activeGroup} onTap={handleBusinessTap} />
      )}
      {activeGroup && activeGroup.businesses.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ py: 1 }}>
          No hay negocios con este tag todavia
        </Typography>
      )}
    </Box>
  );
}
