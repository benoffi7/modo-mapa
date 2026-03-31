import { Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useFollowedTags } from '../../hooks/useFollowedTags';
import FollowTagChip from '../common/FollowTagChip';
import { SUGGESTED_TAGS } from '../../constants/interests';

/**
 * Full management view for followed tags, used inside ProfileScreen.
 * Shows all followed tags with unfollow option + suggested tags to add.
 */
export default function InterestsSection() {
  const { tags, followTag, unfollowTag } = useFollowedTags();

  const unfollowedSuggestions = SUGGESTED_TAGS.filter((t) => !tags.includes(t));

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      {tags.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Tags que seguis
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            {tags.map((tag) => (
              <Box key={tag} sx={{ display: 'inline-flex', alignItems: 'center' }}>
                <FollowTagChip tag={tag} followed onToggle={() => {/* no-op, use X */}} />
                <IconButton size="small" onClick={() => unfollowTag(tag, 'profile')} aria-label={`Dejar de seguir ${tag}`} sx={{ ml: -0.5, minWidth: 44, minHeight: 44 }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        </>
      )}

      {tags.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          No seguis ningun tag. Agrega algunos para descubrir negocios.
        </Typography>
      )}

      {unfollowedSuggestions.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Sugeridos
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {unfollowedSuggestions.map((tag) => (
              <FollowTagChip key={tag} tag={tag} followed={false} onToggle={() => followTag(tag, 'profile')} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
