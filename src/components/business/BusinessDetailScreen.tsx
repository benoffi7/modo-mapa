import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { Box, IconButton, Chip, Button, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConnectivity } from '../../context/ConnectivityContext';
import { BusinessScopeProvider } from '../../context/BusinessScopeContext';
import type { BusinessScope } from '../../context/BusinessScopeContext';
import { useBusinessData } from '../../hooks/useBusinessData';
import { useBusinessRating } from '../../hooks/useBusinessRating';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { useTrending } from '../../hooks/useTrending';
import { trackEvent } from '../../utils/analytics';
import {
  EVT_BUSINESS_DETAIL_OPENED,
  EVT_BUSINESS_DETAIL_TAB_CHANGED,
  EVT_SUB_TAB_SWITCHED,
} from '../../constants/analyticsEvents';
import { NAV_CHIP_SX } from '../../constants/ui';
import { MSG_BUSINESS_DETAIL } from '../../constants/messages/businessDetail';
import BusinessSheetHeader from './BusinessSheetHeader';
import CheckInButton from './CheckInButton';
import FavoriteButton from './FavoriteButton';
import ShareButton from './ShareButton';
import AddToListDialog from './AddToListDialog';
import BusinessSheetSkeleton from './BusinessSheetSkeleton';
import StaleBanner from '../ui/StaleBanner';
import CriteriaSection from './CriteriaSection';
import BusinessPriceLevel from './BusinessPriceLevel';
import BusinessTags from './BusinessTags';
import MenuPhotoSection from './MenuPhotoSection';
import OpinionesTab from './OpinionesTab';
import type { PriceLevelData, TagsData, PhotoData } from '../../types/businessDetail';
import type { Business } from '../../types';
import type { BusinessDetailTab } from '../../types';

const RecommendDialog = lazy(() => import('./RecommendDialog'));

const CHIP_LABELS: Record<BusinessDetailTab, string> = MSG_BUSINESS_DETAIL.chipLabels;

const CHIP_ORDER: BusinessDetailTab[] = ['criterios', 'precio', 'tags', 'foto', 'opiniones'];

interface Props {
  business: Business;
  initialTab?: BusinessDetailTab;
}

function DetailError({ onRetry }: { onRetry: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, px: 3, gap: 2 }}>
      <ErrorOutlineIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {MSG_BUSINESS_DETAIL.loadError}
      </Typography>
      <Button variant="outlined" size="small" onClick={onRetry} startIcon={<RefreshIcon />}>
        {MSG_BUSINESS_DETAIL.retry}
      </Button>
    </Box>
  );
}

export default function BusinessDetailScreen({ business, initialTab }: Props) {
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const [activeChip, setActiveChip] = useState<BusinessDetailTab>(initialTab ?? 'criterios');
  const businessId = business.id;
  const data = useBusinessData(businessId);
  const { refetch } = data;
  const { recordVisit } = useVisitHistory();
  const { data: trendingData } = useTrending();
  const isTrending = trendingData?.businesses.some((b) => b.businessId === businessId) ?? false;
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [recommendDialogOpen, setRecommendDialogOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    if (!headerRef.current) return;
    setHeaderHeight(headerRef.current.getBoundingClientRect().height);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setHeaderHeight(entry.contentRect.height);
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [data.isLoading]);

  const handleRatingChange = useCallback(() => refetch('ratings'), [refetch]);
  const handleTagsChange = useCallback(() => { refetch('userTags'); refetch('customTags'); }, [refetch]);

  const ratingData = useBusinessRating({
    businessId: business.id,
    businessName: business.name,
    ratings: data.ratings,
    isLoading: data.isLoading,
    onRatingChange: handleRatingChange,
  });

  const scope = useMemo<BusinessScope>(
    () => ({ businessId: business.id, businessName: business.name, location: { lat: business.lat, lng: business.lng } }),
    [business.id, business.name, business.lat, business.lng],
  );

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

  const regularComments = useMemo(() => data.comments.filter((c) => c.type !== 'question'), [data.comments]);

  useEffect(() => {
    recordVisit(business.id);
    trackEvent(EVT_BUSINESS_DETAIL_OPENED, {
      business_id: business.id,
      source: initialTab ? 'deep_link' : 'sheet_cta',
    });
  }, [business, recordVisit, initialTab]);

  const handleChipChange = (chip: BusinessDetailTab) => {
    const previous = activeChip;
    setActiveChip(chip);
    setSearchParams({ tab: chip }, { replace: true });
    trackEvent(EVT_BUSINESS_DETAIL_TAB_CHANGED, { business_id: business.id, tab: chip, previous_tab: previous });
    trackEvent(EVT_SUB_TAB_SWITCHED, { parent: 'comercio', tab: chip });
  };

  const handleBack = () => {
    if (location.key === 'default') {
      navigate('/');
    } else {
      navigate(-1);
    }
  };

  return (
    <BusinessScopeProvider scope={scope}>
      <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', bgcolor: 'background.paper', maxWidth: { sm: 640, md: 720 }, mx: 'auto' }}>
        <Box sx={{ px: 1, pt: 1 }}>
          <IconButton onClick={handleBack} aria-label="Volver al mapa">
            <ArrowBackIcon />
          </IconButton>
        </Box>

        {data.isLoading ? (
          <BusinessSheetSkeleton />
        ) : (data.error && !isOffline) ? (
          <DetailError onRetry={() => data.refetch()} />
        ) : (
          <>
            {data.stale && <StaleBanner businessId={business.id} onRefresh={() => data.refetch()} />}
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

            <Box
              sx={{
                position: 'sticky',
                top: headerHeight,
                zIndex: 10,
                background: 'inherit',
                display: 'flex',
                gap: 1,
                px: 2,
                py: 1,
                overflow: 'auto',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {CHIP_ORDER.map((chip) => (
                <Chip
                  key={chip}
                  label={CHIP_LABELS[chip]}
                  onClick={() => handleChipChange(chip)}
                  variant={activeChip === chip ? 'filled' : 'outlined'}
                  color={activeChip === chip ? 'primary' : 'default'}
                  sx={{ ...NAV_CHIP_SX, fontWeight: activeChip === chip ? 600 : 400 }}
                />
              ))}
            </Box>

            <Box sx={{ pb: 'calc(24px + env(safe-area-inset-bottom))' }}>
              <Box sx={{ display: activeChip === 'criterios' ? 'block' : 'none', px: 2, pt: 1 }}>
                <CriteriaSection
                  criteriaAverages={ratingData.criteriaAverages}
                  myCriteria={ratingData.myCriteria}
                  myRating={ratingData.myRating}
                  hasCriteriaData={ratingData.hasCriteriaData}
                  onCriterionRate={ratingData.handleCriterionRate}
                />
              </Box>
              <Box sx={{ display: activeChip === 'precio' ? 'block' : 'none', px: 2, pt: 1 }}>
                <BusinessPriceLevel
                  priceLevels={priceLevelData.levels}
                  isLoading={data.isLoading}
                  onPriceLevelChange={priceLevelData.onChange}
                />
              </Box>
              <Box sx={{ display: activeChip === 'tags' ? 'block' : 'none', px: 2, pt: 1 }}>
                <BusinessTags
                  seedTags={tagsData.seed}
                  userTags={tagsData.user}
                  customTags={tagsData.custom}
                  isLoading={data.isLoading}
                  onTagsChange={tagsData.onChange}
                />
              </Box>
              <Box sx={{ display: activeChip === 'foto' ? 'block' : 'none', px: 2, pt: 1 }}>
                <MenuPhotoSection
                  menuPhoto={photoData.photo}
                  isLoading={data.isLoading}
                  onPhotoChange={photoData.onChange}
                />
              </Box>
              <Box sx={{ display: activeChip === 'opiniones' ? 'block' : 'none' }}>
                <OpinionesTab
                  comments={data.comments}
                  regularComments={regularComments}
                  userCommentLikes={data.userCommentLikes}
                  isLoading={data.isLoading}
                  onCommentsChange={() => data.refetch('comments')}
                  onDirtyChange={() => {}}
                />
              </Box>
            </Box>
          </>
        )}
      </Box>
      </Box>

      <AddToListDialog open={listDialogOpen} onClose={() => setListDialogOpen(false)} />
      <Suspense fallback={null}>
        {recommendDialogOpen && <RecommendDialog open onClose={() => setRecommendDialogOpen(false)} />}
      </Suspense>
    </BusinessScopeProvider>
  );
}
