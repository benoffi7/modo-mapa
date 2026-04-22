import { useParams, useSearchParams } from 'react-router-dom';
import { FiltersProvider } from '../context/FiltersContext';
import { useBusinessById } from '../hooks/useBusinessById';
import { BUSINESS_DETAIL_TABS } from '../types';
import type { BusinessDetailTab } from '../types';
import BusinessDetailScreen from '../components/business/BusinessDetailScreen';
import BusinessNotFound from '../components/business/BusinessNotFound';

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { business, status } = useBusinessById(id);

  const rawTab = searchParams.get('tab');
  const initialTab = BUSINESS_DETAIL_TABS.includes(rawTab as BusinessDetailTab)
    ? (rawTab as BusinessDetailTab)
    : undefined;

  if (status !== 'found' || !business) {
    return <BusinessNotFound reason={status === 'invalid_id' ? 'invalid_id' : 'not_found'} />;
  }

  return (
    <FiltersProvider>
      <BusinessDetailScreen business={business} {...(initialTab !== undefined && { initialTab })} />
    </FiltersProvider>
  );
}
