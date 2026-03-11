import { SwipeableDrawer, Box, Divider } from '@mui/material';
import { useMapContext } from '../../context/MapContext';
import BusinessHeader from './BusinessHeader';
import BusinessRating from './BusinessRating';
import BusinessTags from './BusinessTags';
import BusinessComments from './BusinessComments';

export default function BusinessSheet() {
  const { selectedBusiness, setSelectedBusiness } = useMapContext();
  const isOpen = selectedBusiness !== null;

  const handleClose = () => setSelectedBusiness(null);
  const handleOpen = () => {};

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isOpen}
      onClose={handleClose}
      onOpen={handleOpen}
      disableSwipeToOpen
      swipeAreaWidth={0}
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '85dvh',
          overflow: 'hidden',
        },
      }}
    >
      {selectedBusiness && (
        <Box sx={{ overflow: 'auto', maxHeight: '85dvh' }}>
          {/* Drag handle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#dadce0',
              }}
            />
          </Box>

          <Box sx={{ px: 2, pb: 3 }}>
            <BusinessHeader business={selectedBusiness} />
            <Divider sx={{ my: 1.5 }} />
            <BusinessRating businessId={selectedBusiness.id} />
            <Divider sx={{ my: 1.5 }} />
            <BusinessTags businessId={selectedBusiness.id} seedTags={selectedBusiness.tags} />
            <Divider sx={{ my: 1.5 }} />
            <BusinessComments businessId={selectedBusiness.id} />
          </Box>
        </Box>
      )}
    </SwipeableDrawer>
  );
}
