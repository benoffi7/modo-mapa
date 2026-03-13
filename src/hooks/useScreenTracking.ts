import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../utils/analytics';

export function useScreenTracking(): void {
  const location = useLocation();

  useEffect(() => {
    const screenName =
      location.pathname === '/'
        ? 'map'
        : location.pathname.replace(/^\//, '').replace(/\//g, '_');

    trackEvent('screen_view', { screen_name: screenName });
  }, [location.pathname]);
}
