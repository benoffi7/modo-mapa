import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FiltersProvider } from '../context/FiltersContext';
import { useBusinessById } from '../hooks/useBusinessById';
import { BUSINESS_DETAIL_TABS } from '../types';
import type { BusinessDetailTab } from '../types';
import type { Business } from '../types';
import BusinessDetailScreen from '../components/business/BusinessDetailScreen';
import BusinessNotFound from '../components/business/BusinessNotFound';

function setMetaTag(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function useBusinessPageMeta(business: Business) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${business.name} — Modo Mapa`;
    setMetaTag('og:title', business.name);
    setMetaTag('og:description', `${business.category} · ${business.address}`);
    setMetaTag('og:url', `${window.location.origin}/comercio/${business.id}`);
    setMetaTag('og:type', 'place');
    return () => { document.title = prev; };
  }, [business.id, business.name, business.category, business.address]);
}

function BusinessDetailPageInner({ business, initialTab }: { business: Business; initialTab: BusinessDetailTab | undefined }) {
  useBusinessPageMeta(business);
  const tabProps = initialTab !== undefined ? { initialTab } : {};
  return (
    <FiltersProvider>
      <BusinessDetailScreen business={business} {...tabProps} />
    </FiltersProvider>
  );
}

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

  return <BusinessDetailPageInner business={business} initialTab={initialTab} />;
}
