import { useState, useEffect, useMemo } from 'react';
import { SwipeableDrawer, Box, Divider, IconButton, Tooltip, Tabs, Tab } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useAuth } from '../../context/AuthContext';
import { useSelection } from '../../context/MapContext';
import { useBusinessData } from '../../hooks/useBusinessData';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { useTrending } from '../../hooks/useTrending';
import { trackEvent } from '../../utils/analytics';
import BusinessHeader from './BusinessHeader';
import BusinessRating from './BusinessRating';
import BusinessPriceLevel from './BusinessPriceLevel';
import BusinessTags from './BusinessTags';
import MenuPhotoSection from './MenuPhotoSection';
import BusinessComments from './BusinessComments';
import BusinessQuestions from './BusinessQuestions';
import FavoriteButton from './FavoriteButton';
import ShareButton from './ShareButton';
import AddToListDialog from './AddToListDialog';
import BusinessSheetSkeleton from './BusinessSheetSkeleton';
import CheckInButton from './CheckInButton';
import StaleBanner from '../ui/StaleBanner';
import DiscardDialog from '../common/DiscardDialog';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import SendIcon from '@mui/icons-material/Send';
import { lazy, Suspense } from 'react';

const RecommendDialog = lazy(() => import('./RecommendDialog'));

export default function BusinessSheet() {
  const { user } = useAuth();
  const { selectedBusiness, setSelectedBusiness } = useSelection();
  const isOpen = selectedBusiness !== null;
  const businessId = selectedBusiness?.id ?? null;
  const data = useBusinessData(businessId);
  const { recordVisit } = useVisitHistory();
  const { data: trendingData } = useTrending();
  const isTrending = trendingData?.businesses.some((b) => b.businessId === businessId) ?? false;
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [recommendDialogOpen, setRecommendDialogOpen] = useState(false);
  const [commentsDirty, setCommentsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'questions'>('comments');
  const { confirmClose, dialogProps } = useUnsavedChanges(commentsDirty ? 'x' : '');
  const showSkeleton = data.isLoading;
  const regularComments = useMemo(() => data.comments.filter((c) => c.type !== 'question'), [data.comments]);
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
            {data.stale && (
              <StaleBanner
                businessId={selectedBusiness.id}
                onRefresh={() => data.refetch()}
              />
            )}
            <BusinessHeader
              business={selectedBusiness}
              isTrending={isTrending}
              favoriteButton={
                <FavoriteButton
                  businessId={selectedBusiness.id}
                  businessName={selectedBusiness.name}
                  isFavorite={data.isFavorite}
                  isLoading={data.isLoading}
                  onToggle={() => data.refetch('favorites')}
                />
              }
              shareButton={<ShareButton business={selectedBusiness} />}
              recommendButton={
                user && !user.isAnonymous ? (
                  <IconButton onClick={() => setRecommendDialogOpen(true)} aria-label="Recomendar">
                    <SendIcon />
                  </IconButton>
                ) : undefined
              }
              addToListButton={
                user && !user.isAnonymous ? (
                  <IconButton onClick={() => setListDialogOpen(true)} aria-label="Guardar en lista">
                    <BookmarkBorderIcon />
                  </IconButton>
                ) : undefined
              }
            />
            <Box sx={{ my: 1, display: 'flex', justifyContent: 'center' }}>
              <CheckInButton
                businessId={selectedBusiness.id}
                businessName={selectedBusiness.name}
                businessLocation={{ lat: selectedBusiness.lat, lng: selectedBusiness.lng }}
              />
            </Box>
            <Divider sx={{ my: 1.5 }} />
            <BusinessRating
              businessId={selectedBusiness.id}
              businessName={selectedBusiness.name}
              ratings={data.ratings}
              isLoading={data.isLoading}
              onRatingChange={() => data.refetch('ratings')}
            />
            <Divider sx={{ my: 1.5 }} />
            <BusinessPriceLevel
              key={selectedBusiness.id}
              businessId={selectedBusiness.id}
              businessName={selectedBusiness.name}
              priceLevels={data.priceLevels}
              isLoading={data.isLoading}
              onPriceLevelChange={() => data.refetch('priceLevels')}
            />
            <Divider sx={{ my: 1.5 }} />
            <BusinessTags
              businessId={selectedBusiness.id}
              businessName={selectedBusiness.name}
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
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              variant="fullWidth"
              sx={{ minHeight: 36, mb: 1, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: '0.85rem' } }}
            >
              <Tab label="Comentarios" value="comments" />
              <Tab label="Preguntas" value="questions" />
            </Tabs>
            {activeTab === 'comments' ? (
              <BusinessComments
                businessId={selectedBusiness.id}
                businessName={selectedBusiness.name}
                comments={regularComments}
                userCommentLikes={data.userCommentLikes}
                isLoading={data.isLoading}
                onCommentsChange={() => data.refetch('comments')}
                onDirtyChange={setCommentsDirty}
              />
            ) : (
              <BusinessQuestions
                businessId={selectedBusiness.id}
                businessName={selectedBusiness.name}
                comments={data.comments}
                userCommentLikes={data.userCommentLikes}
                isLoading={data.isLoading}
                onCommentsChange={() => data.refetch('comments')}
              />
            )}
          </Box>
          )}
        </Box>
      )}
    </SwipeableDrawer>
    <DiscardDialog {...dialogProps} />
    {selectedBusiness && (
      <>
        <AddToListDialog
          open={listDialogOpen}
          onClose={() => setListDialogOpen(false)}
          businessId={selectedBusiness.id}
          businessName={selectedBusiness.name}
        />
        <Suspense fallback={null}>
          {recommendDialogOpen && (
            <RecommendDialog
              open
              onClose={() => setRecommendDialogOpen(false)}
              businessId={selectedBusiness.id}
              businessName={selectedBusiness.name}
            />
          )}
        </Suspense>
      </>
    )}
    </>
  );
}
