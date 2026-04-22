import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { Box, IconButton, Button } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import EastIcon from '@mui/icons-material/East';
import SendIcon from '@mui/icons-material/Send';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BusinessScopeProvider } from '../../context/BusinessScopeContext';
import type { BusinessScope } from '../../context/BusinessScopeContext';
import { useBusinessData } from '../../hooks/useBusinessData';
import { useBusinessRating } from '../../hooks/useBusinessRating';
import { useVisitHistory } from '../../hooks/useVisitHistory';
import { useTrending } from '../../hooks/useTrending';
import { trackEvent } from '../../utils/analytics';
import { EVT_BUSINESS_DETAIL_CTA_CLICKED } from '../../constants/analyticsEvents';
import { STORAGE_KEY_LAST_BUSINESS_SHEET } from '../../constants/storage';
import BusinessSheetHeader from './BusinessSheetHeader';
import FavoriteButton from './FavoriteButton';
import ShareButton from './ShareButton';
import AddToListDialog from './AddToListDialog';
import BusinessSheetSkeleton from './BusinessSheetSkeleton';
import StaleBanner from '../ui/StaleBanner';
import type { Business } from '../../types';

const RecommendDialog = lazy(() => import('./RecommendDialog'));

interface Props {
  business: Business;
}

export default function BusinessSheetCompactContent({ business }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const businessId = business.id;
  const data = useBusinessData(businessId);
  const { refetch } = data;
  const { recordVisit } = useVisitHistory();
  const { data: trendingData } = useTrending();
  const isTrending = trendingData?.businesses.some((b) => b.businessId === businessId) ?? false;
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [recommendDialogOpen, setRecommendDialogOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  const handleRatingChange = useCallback(() => refetch('ratings'), [refetch]);
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

  useEffect(() => {
    recordVisit(business.id);
    trackEvent('business_view', { business_id: business.id, business_name: business.name, category: business.category });
  }, [business, recordVisit]);

  const handleViewDetails = () => {
    try { sessionStorage.setItem(STORAGE_KEY_LAST_BUSINESS_SHEET, business.id); } catch (e) { void e; }
    trackEvent(EVT_BUSINESS_DETAIL_CTA_CLICKED, { business_id: business.id });
    navigate(`/comercio/${business.id}`);
  };

  return (
    <BusinessScopeProvider scope={scope}>
      {data.isLoading ? (
        <BusinessSheetSkeleton />
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
            checkInButton={null}
          />
          <Box sx={{ px: 2, pb: 2, pt: 1 }}>
            <Button
              variant="contained"
              fullWidth
              endIcon={<EastIcon />}
              onClick={handleViewDetails}
              aria-label="Ver detalles del comercio"
            >
              Ver detalles
            </Button>
          </Box>
        </>
      )}
      <AddToListDialog open={listDialogOpen} onClose={() => setListDialogOpen(false)} />
      <Suspense fallback={null}>
        {recommendDialogOpen && <RecommendDialog open onClose={() => setRecommendDialogOpen(false)} />}
      </Suspense>
    </BusinessScopeProvider>
  );
}
