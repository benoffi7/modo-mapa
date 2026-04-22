import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { Box, Tabs, Tab, IconButton, Typography, Button } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '../../context/AuthContext';
import { BusinessScopeProvider } from '../../context/BusinessScopeContext';
import type { BusinessScope } from '../../context/BusinessScopeContext';
import { useBusinessData } from '../../hooks/useBusinessData';
import { useBusinessRating } from '../../hooks/useBusinessRating';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { useTrending } from '../../hooks/useTrending';
import { trackEvent } from '../../utils/analytics';
import { EVT_BUSINESS_SHEET_TAB_CHANGED } from '../../constants/analyticsEvents';
import BusinessSheetHeader from './BusinessSheetHeader';
import InfoTab from './InfoTab';
import type { PriceLevelData, TagsData, PhotoData } from './InfoTab';
import OpinionesTab from './OpinionesTab';
import FavoriteButton from './FavoriteButton';
import ShareButton from './ShareButton';
import AddToListDialog from './AddToListDialog';
import BusinessSheetSkeleton from './BusinessSheetSkeleton';
import CheckInButton from './CheckInButton';
import StaleBanner from '../ui/StaleBanner';
import type { Business } from '../../types';
import type { BusinessSheetTab } from '../../context/SelectionContext';

const RecommendDialog = lazy(() => import('./RecommendDialog'));

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

interface BusinessSheetContentProps {
  business: Business;
  initialTab?: BusinessSheetTab | undefined;
  onTabConsumed?: (() => void) | undefined;
  onDirtyChange?: ((dirty: boolean) => void) | undefined;
}

export default function BusinessSheetContent({
  business,
  initialTab,
  onTabConsumed,
  onDirtyChange,
}: BusinessSheetContentProps) {
  const { user } = useAuth();
  const businessId = business.id;
  const data = useBusinessData(businessId);
  const { refetch } = data;
  const { recordVisit } = useVisitHistory();
  const { data: trendingData } = useTrending();
  const isTrending = trendingData?.businesses.some((b) => b.businessId === businessId) ?? false;
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [recommendDialogOpen, setRecommendDialogOpen] = useState(false);
  const [commentsDirty, setCommentsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<BusinessSheetTab>(() => initialTab ?? 'info');

  // Notify parent that the deep-link tab has been consumed (on mount when initialTab is set).
  // Tab reset on business change is handled by key={business.id} in the parent (BusinessSheet).
  useEffect(() => {
    if (initialTab) onTabConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  const showSkeleton = data.isLoading;
  const showError = !data.isLoading && data.error;
  const regularComments = useMemo(() => data.comments.filter((c) => c.type !== 'question'), [data.comments]);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

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

  const handleRatingChange = useCallback(() => refetch('ratings'), [refetch]);
  const handleTagsChange = useCallback(() => {
    refetch('userTags');
    refetch('customTags');
  }, [refetch]);

  const ratingData = useBusinessRating({
    businessId: business.id,
    businessName: business.name,
    ratings: data.ratings,
    isLoading: data.isLoading,
    onRatingChange: handleRatingChange,
  });

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(commentsDirty);
    }
  }, [commentsDirty, onDirtyChange]);

  useEffect(() => {
    recordVisit(business.id);
    trackEvent('business_view', {
      business_id: business.id,
      business_name: business.name,
      category: business.category,
    });
  }, [business, recordVisit]);

  const handleTabChange = (_: unknown, newTab: BusinessSheetTab) => {
    const previousTab = activeTab;
    setActiveTab(newTab);
    trackEvent(EVT_BUSINESS_SHEET_TAB_CHANGED, {
      business_id: business.id,
      tab: newTab,
      previous_tab: previousTab,
    });
  };

  // Scope para el subárbol (eliminamos prop-drilling de businessId/businessName/location).
  const scope = useMemo<BusinessScope>(
    () => ({
      businessId: business.id,
      businessName: business.name,
      location: { lat: business.lat, lng: business.lng },
    }),
    [business.id, business.name, business.lat, business.lng],
  );

  // Grupos de data para InfoTab (evita re-renders si los subobjetos no cambian).
  const handlePriceLevelChange = useCallback(() => refetch('priceLevels'), [refetch]);
  const handlePhotoChange = useCallback(() => refetch('menuPhotos'), [refetch]);
  const priceLevelData = useMemo<PriceLevelData>(
    () => ({ levels: data.priceLevels, onChange: handlePriceLevelChange }),
    [data.priceLevels, handlePriceLevelChange],
  );
  const tagsData = useMemo<TagsData>(
    () => ({ seed: business.tags, user: data.userTags, custom: data.customTags, onChange: handleTagsChange }),
    [business.tags, data.userTags, data.customTags, handleTagsChange],
  );
  const photoData = useMemo<PhotoData>(
    () => ({ photo: data.menuPhoto, onChange: handlePhotoChange }),
    [data.menuPhoto, handlePhotoChange],
  );

  return (
    <BusinessScopeProvider scope={scope}>
      {showSkeleton ? (
        <BusinessSheetSkeleton />
      ) : showError ? (
        <BusinessSheetError onRetry={() => data.refetch()} />
      ) : (
        <Box sx={{
          '@keyframes fadeIn': {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
          animation: 'fadeIn 200ms ease-in',
        }}>
          {data.stale && (
            <StaleBanner
              businessId={business.id}
              onRefresh={() => data.refetch()}
            />
          )}
          <BusinessSheetHeader
            ref={headerRef}
            business={business}
            isTrending={isTrending}
            ratings={data.ratings}
            isLoading={data.isLoading}
            ratingData={ratingData}
            favoriteButton={
              <FavoriteButton
                isFavorite={data.isFavorite}
                isLoading={data.isLoading}
                onToggle={() => data.refetch('favorites')}
              />
            }
            shareButton={<ShareButton business={business} />}
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
            checkInButton={<CheckInButton />}
          />

          {/* Sticky tabs */}
          <Box
            sx={{
              position: 'sticky',
              top: headerHeight,
              zIndex: 10,
              background: 'inherit',
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

          {/* Tab content */}
          <Box sx={{ display: activeTab === 'info' ? 'block' : 'none' }}>
            <InfoTab
              ratingData={ratingData}
              priceLevelData={priceLevelData}
              tagsData={tagsData}
              photoData={photoData}
              isLoading={data.isLoading}
            />
          </Box>
          <Box sx={{ display: activeTab === 'opiniones' ? 'block' : 'none' }}>
            <OpinionesTab
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

      <AddToListDialog
        open={listDialogOpen}
        onClose={() => setListDialogOpen(false)}
      />
      <Suspense fallback={null}>
        {recommendDialogOpen && (
          <RecommendDialog
            open
            onClose={() => setRecommendDialogOpen(false)}
          />
        )}
      </Suspense>
    </BusinessScopeProvider>
  );
}
