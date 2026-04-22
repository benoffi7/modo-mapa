import { SwipeableDrawer, Box } from '@mui/material';
import { useSelection } from '../../context/SelectionContext';
import UserProfileContent from './UserProfileContent';

interface Props {
  userId: string | null;
  userName?: string | undefined;
  onClose: () => void;
}

export default function UserProfileSheet({ userId, userName, onClose }: Props) {
  const isOpen = userId !== null;
  const { setSelectedBusiness } = useSelection();
  const handleOpen = () => {};

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isOpen}
      onClose={onClose}
      onOpen={handleOpen}
      disableSwipeToOpen
      swipeAreaWidth={0}
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '75dvh',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', maxHeight: '75dvh' }}>
        {/* Drag handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'divider',
            }}
          />
        </Box>

        <Box sx={{ px: 2, pb: 'calc(24px + env(safe-area-inset-bottom))' }}>
          {userId && (
            <UserProfileContent
              userId={userId}
              userName={userName}
              onClose={onClose}
              onNavigateToBusiness={setSelectedBusiness}
            />
          )}
        </Box>
      </Box>
    </SwipeableDrawer>
  );
}
