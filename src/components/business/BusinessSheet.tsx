import { useState, useEffect, useMemo, useRef } from 'react';
import { SwipeableDrawer, Box, Tabs, Tab, IconButton, Tooltip, Typography, Button } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '../../context/AuthContext';
import { useSelection } from '../../context/SelectionContext';
import { useBusinessData } from '../../hooks/useBusinessData';
import { useBusinessRating } from '../../hooks/useBusinessRating';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { useTrending } from '../../hooks/useTrending';
import { trackEvent } from '../../utils/analytics';
import { EVT_BUSINESS_SHEET_TAB_CHANGED } from '../../constants/analyticsEvents';
import { STORAGE_KEY_DRAG_HANDLE_SEEN } from '../../constants/storage';
import BusinessSheetHeader from './BusinessSheetHeader';
import InfoTab from './InfoTab';
import OpinionesTab from './OpinionesTab';
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

function BusinessSheetError({ onRetry }: { onRetry: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, px: 3, gap: 2 }}>
      <ErrorOutlineIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
      <Typography variant="body2" color="text.secondary" textAlign="center">
        No se pudo cargar la información del comercio.
      </Typography>
      <Button variant="outlined" size="small" onClick={onRetry} startIcon={<RefreshIcon />}>
        Reintentar
      </Button>
    </Box>
  );
}

const RecommendDialog = lazy(() => import('./RecommendDialog'));

type BusinessSheetTab = 'info' | 'opiniones';

export default function BusinessSheet() {
  const { user } = useAuth();
  const { selectedBusiness, setSelectedBusiness, selectedBusinessTab, setSelectedBusinessTab } = useSelection();
  const isOpen = selectedBusiness !== null;
  const businessId = selectedBusiness?.id ?? null;
  const data = useBusinessData(businessId);
  const { recordVisit } = useVisitHistory();
  const { data: trendingData } = useTrending();
  const isTrending = trendingData?.businesses.some((b) => b.businessId === businessId) ?? false;
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [recommendDialogOpen, setRecommendDialogOpen] = useState(false);
  const [commentsDirty, setCommentsDirty] = useState(false);
  const prevBusinessIdRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<BusinessSheetTab>(() => selectedBusinessTab ?? 'info');

  // Consume deep-link tab + reset tab on business change (synchronous, no effect needed)
  if (selectedBusinessTab) {
    setSelectedBusinessTab(null);
    if (activeTab !== selectedBusinessTab) {
      setActiveTab(selectedBusinessTab);
    }
  }
  if (businessId !== prevBusinessIdRef.current) {
    prevBusinessIdRef.current = businessId;
    if (activeTab !== 'info' && businessId !== null) {
      setActiveTab('info');
    }
  }
  const { confirmClose, dialogProps } = useUnsavedChanges(commentsDirty ? 'x' : '');
  const showSkeleton = data.isLoading;
  const showError = !data.isLoading && data.error;
  const regularComments = useMemo(() => data.comments.filter((c) => c.type !== 'question'), [data.comments]);
  const [showTooltip, setShowTooltip] = useState(() => !localStorage.getItem(STORAGE_KEY_DRAG_HANDLE_SEEN));
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Measure header height for sticky tabs positioning
  useEffect(() => {
    if (!headerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderHeight(entry.contentRect.height);
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [showSkeleton]);

  // Rating hook - instantiated once, shared between header and InfoTab
  const ratingData = useBusinessRating({
    businessId: selectedBusiness?.id ?? '',
    businessName: selectedBusiness?.name,
    ratings: data.ratings,
    isLoading: data.isLoading,
    onRatingChange: () => data.refetch('ratings'),
  });

  useEffect(() => {
    if (showTooltip && isOpen) {
      const timer = setTimeout(() => {
        setShowTooltip(false);
        localStorage.setItem(STORAGE_KEY_DRAG_HANDLE_SEEN, '1');
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

  const handleTabChange = (_: unknown, newTab: BusinessSheetTab) => {
    const previousTab = activeTab;
    setActiveTab(newTab);
    if (selectedBusiness) {
      trackEvent(EVT_BUSINESS_SHEET_TAB_CHANGED, {
        business_id: selectedBusiness.id,
        tab: newTab,
        previous_tab: previousTab,
      });
    }
  };

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
          ) : showError ? (
            <BusinessSheetError onRetry={() => data.refetch()} />
          ) : (
          <Box sx={{
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
            <BusinessSheetHeader
              ref={headerRef}
              business={selectedBusiness}
              isTrending={isTrending}
              ratings={data.ratings}
              isLoading={data.isLoading}
              ratingData={ratingData}
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
              checkInButton={
                <CheckInButton
                  businessId={selectedBusiness.id}
                  businessName={selectedBusiness.name}
                  businessLocation={{ lat: selectedBusiness.lat, lng: selectedBusiness.lng }}
                />
              }
            />

            {/* Sticky tabs */}
            <Box
              sx={{
                position: 'sticky',
                top: headerHeight,
                zIndex: 2,
                bgcolor: 'background.paper',
                px: 2,
              }}
            >
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: '0.9rem', fontWeight: 600 } }}
              >
                <Tab label="Info" value="info" />
                <Tab label="Opiniones" value="opiniones" />
              </Tabs>
            </Box>

            {/* Tab content — display:none preserves internal state */}
            <Box sx={{ display: activeTab === 'info' ? 'block' : 'none' }}>
              <InfoTab
                business={selectedBusiness}
                ratingData={ratingData}
                priceLevels={data.priceLevels}
                onPriceLevelChange={() => data.refetch('priceLevels')}
                seedTags={selectedBusiness.tags}
                userTags={data.userTags}
                customTags={data.customTags}
                onTagsChange={() => { data.refetch('userTags'); data.refetch('customTags'); }}
                menuPhoto={data.menuPhoto}
                onPhotoChange={() => data.refetch('menuPhotos')}
                isLoading={data.isLoading}
              />
            </Box>
            <Box sx={{ display: activeTab === 'opiniones' ? 'block' : 'none' }}>
              <OpinionesTab
                businessId={selectedBusiness.id}
                businessName={selectedBusiness.name}
                comments={data.comments}
                regularComments={regularComments}
                userCommentLikes={data.userCommentLikes}
                isLoading={data.isLoading}
                onCommentsChange={() => data.refetch('comments')}
                onDirtyChange={setCommentsDirty}
              />
            </Box>
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
