import { useState, useEffect } from 'react';
import { SwipeableDrawer, Box, Divider, IconButton, Tooltip } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useAuth } from '../../context/AuthContext';
import { useSelection } from '../../context/MapContext';
import { useBusinessData } from '../../hooks/useBusinessData';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { trackEvent } from '../../utils/analytics';
import BusinessHeader from './BusinessHeader';
import BusinessRating from './BusinessRating';
import BusinessPriceLevel from './BusinessPriceLevel';
import BusinessTags from './BusinessTags';
import MenuPhotoSection from './MenuPhotoSection';
import BusinessComments from './BusinessComments';
import FavoriteButton from './FavoriteButton';
import ShareButton from './ShareButton';
import AddToListDialog from './AddToListDialog';
import BusinessSheetSkeleton from './BusinessSheetSkeleton';
import DiscardDialog from '../common/DiscardDialog';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

export default function BusinessSheet() {
  const { user } = useAuth();
  const { selectedBusiness, setSelectedBusiness } = useSelection();
  const isOpen = selectedBusiness !== null;
  const businessId = selectedBusiness?.id ?? null;
  const data = useBusinessData(businessId);
  const { recordVisit } = useVisitHistory();
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [commentsDirty, setCommentsDirty] = useState(false);
  const { confirmClose, dialogProps } = useUnsavedChanges(commentsDirty ? 'x' : '');
  const showSkeleton = data.isLoading;
  const [showTooltip, setShowTooltip] = useState(() => !localStorage.getItem('dragHandleSeen'));

  useEffect(() => {
    if (showTooltip && isOpen) {
      const timer = setTimeout(() => {
        setShowTooltip(false);
        localStorage.setItem('dragHandleSeen', '1');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showTooltip, isOpen]);

  useEffect(() => {
    if (selectedBusiness) {
      recordVisit(selectedBusiness.id);
      trackEvent('business_view', {
        business_id: selectedBusiness.id,
        business_name: selectedBusiness.name,
        category: selectedBusiness.category,
      });
    }
  }, [selectedBusiness, recordVisit]);

  const handleClose = () => {
    confirmClose(() => setSelectedBusiness(null));
  };
  const handleOpen = () => {};

  return (
    <>
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
        role: 'dialog' as const,
        'aria-label': selectedBusiness ? `Detalle de ${selectedBusiness.name}` : undefined,
      }}
    >
      {selectedBusiness && (
        <Box sx={{ overflow: 'auto', maxHeight: '85dvh' }}>
          {/* Drag handle */}
          <Tooltip
            title="Arrastrá hacia arriba para ver más"
            open={showTooltip && isOpen}
            arrow
            placement="top"
          >
            <Box
              role="button"
              aria-label="Cerrar detalles"
              onClick={handleClose}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                py: 1.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: 'text.secondary',
                  opacity: 0.5,
                }}
              />
              <KeyboardArrowUpIcon
                sx={{
                  fontSize: 20,
                  color: 'text.secondary',
                  opacity: 0.6,
                  mt: 0.25,
                  animation: 'pulseUp 1.5s ease-in-out infinite',
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                  '@keyframes pulseUp': {
                    '0%, 100%': { transform: 'translateY(0)', opacity: 0.6 },
                    '50%': { transform: 'translateY(-3px)', opacity: 1 },
                  },
                }}
              />
            </Box>
          </Tooltip>

          {showSkeleton ? (
            <BusinessSheetSkeleton />
          ) : (
          <Box sx={{
            px: 2,
            pb: 'calc(24px + env(safe-area-inset-bottom))',
            '@keyframes fadeIn': {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
            animation: 'fadeIn 200ms ease-in',
          }}>
            <BusinessHeader
              business={selectedBusiness}
              favoriteButton={
                <FavoriteButton
                  businessId={selectedBusiness.id}
                  isFavorite={data.isFavorite}
                  isLoading={data.isLoading}
                  onToggle={() => data.refetch('favorites')}
                />
              }
              shareButton={<ShareButton business={selectedBusiness} />}
              addToListButton={
                user && !user.isAnonymous ? (
                  <IconButton onClick={() => setListDialogOpen(true)} aria-label="Guardar en lista">
                    <BookmarkBorderIcon />
                  </IconButton>
                ) : undefined
              }
            />
            <Divider sx={{ my: 1.5 }} />
            <BusinessRating
              businessId={selectedBusiness.id}
              ratings={data.ratings}
              isLoading={data.isLoading}
              onRatingChange={() => data.refetch('ratings')}
            />
            <Divider sx={{ my: 1.5 }} />
            <BusinessPriceLevel
              key={selectedBusiness.id}
              businessId={selectedBusiness.id}
              priceLevels={data.priceLevels}
              isLoading={data.isLoading}
              onPriceLevelChange={() => data.refetch('priceLevels')}
            />
            <Divider sx={{ my: 1.5 }} />
            <BusinessTags
              businessId={selectedBusiness.id}
              seedTags={selectedBusiness.tags}
              userTags={data.userTags}
              customTags={data.customTags}
              isLoading={data.isLoading}
              onTagsChange={() => { data.refetch('userTags'); data.refetch('customTags'); }}
            />
            <Divider sx={{ my: 1.5 }} />
            <MenuPhotoSection
              menuPhoto={data.menuPhoto}
              businessId={selectedBusiness.id}
              isLoading={data.isLoading}
              onPhotoChange={() => data.refetch('menuPhotos')}
            />
            <Divider sx={{ my: 1.5 }} />
            <BusinessComments
              businessId={selectedBusiness.id}
              comments={data.comments}
              userCommentLikes={data.userCommentLikes}
              isLoading={data.isLoading}
              onCommentsChange={() => data.refetch('comments')}
              onDirtyChange={setCommentsDirty}
            />
          </Box>
          )}
        </Box>
      )}
    </SwipeableDrawer>
    <DiscardDialog {...dialogProps} />
    {selectedBusiness && (
      <AddToListDialog
        open={listDialogOpen}
        onClose={() => setListDialogOpen(false)}
        businessId={selectedBusiness.id}
        businessName={selectedBusiness.name}
      />
    )}
    </>
  );
}
