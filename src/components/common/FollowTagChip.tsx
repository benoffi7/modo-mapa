import { memo } from 'react';
import Chip from '@mui/material/Chip';
import Badge from '@mui/material/Badge';
import { getTagLabel } from '../../utils/businessHelpers';

interface Props {
  tag: string;
  followed: boolean;
  onToggle: (tag: string) => void;
  newCount?: number | undefined;
}

export default memo(function FollowTagChip({ tag, followed, onToggle, newCount }: Props) {
  const chip = (
    <Chip
      label={getTagLabel(tag)}
      size="small"
      variant={followed ? 'filled' : 'outlined'}
      color={followed ? 'primary' : 'default'}
      onClick={() => onToggle(tag)}
      sx={{ borderRadius: 1 }}
    />
  );

  if (newCount && newCount > 0) {
    return (
      <Badge badgeContent={newCount} color="error" max={9}>
        {chip}
      </Badge>
    );
  }

  return chip;
});
