import { memo } from 'react';
import { Button, CircularProgress } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import { useFollow } from '../hooks/useFollow';

interface FollowButtonProps {
  targetUserId: string;
}

export const FollowButton = memo(function FollowButton({ targetUserId }: FollowButtonProps) {
  const { following, loading, toggling, toggle, isSelf } = useFollow(targetUserId);

  if (isSelf || loading) return null;

  return (
    <Button
      size="small"
      variant={following ? 'outlined' : 'contained'}
      onClick={toggle}
      disabled={toggling}
      startIcon={
        toggling
          ? <CircularProgress size={16} />
          : following ? <PersonRemoveIcon /> : <PersonAddIcon />
      }
      sx={{ textTransform: 'none', minWidth: 110 }}
    >
      {following ? 'Siguiendo' : 'Seguir'}
    </Button>
  );
});
