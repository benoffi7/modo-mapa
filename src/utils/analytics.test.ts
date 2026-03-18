import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAnalytics = vi.fn(() => 'mock-analytics-instance');
const mockSetAnalyticsCollectionEnabled = vi.fn();
const mockLogEvent = vi.fn();
const mockSetUserProperties = vi.fn();

vi.mock('firebase/analytics', () => ({
  getAnalytics: mockGetAnalytics,
  setAnalyticsCollectionEnabled: mockSetAnalyticsCollectionEnabled,
  logEvent: mockLogEvent,
  setUserProperties: mockSetUserProperties,
}));

const fakeApp = { name: 'test-app' } as Parameters<
  typeof import('./analytics').initAnalytics
>[0];

// Module-level state resets between tests by re-importing
async function loadModule() {
  const mod = await import('./analytics');
  return mod;
}

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  describe('initAnalytics', () => {
    it('does nothing when not in PROD', async () => {
      vi.stubGlobal('import.meta', { env: { PROD: false } });
      const { initAnalytics } = await loadModule();

      initAnalytics(fakeApp);

      expect(mockGetAnalytics).not.toHaveBeenCalled();
    });

    it('activates analytics in PROD when consent is true in localStorage', async () => {
      import.meta.env.PROD = true;
      localStorage.setItem('analytics-consent', 'true');
      const { initAnalytics } = await loadModule();

      initAnalytics(fakeApp);
      await vi.dynamicImportSettled();

      expect(mockGetAnalytics).toHaveBeenCalledWith(fakeApp);
      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenCalledWith(
        'mock-analytics-instance',
        true,
      );
    });

    it('does not activate analytics in PROD when consent is absent', async () => {
      import.meta.env.PROD = true;
      const { initAnalytics } = await loadModule();

      initAnalytics(fakeApp);
      await vi.dynamicImportSettled();

      expect(mockGetAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('setAnalyticsEnabled', () => {
    it('stores consent value in localStorage', async () => {
      const { setAnalyticsEnabled } = await loadModule();

      setAnalyticsEnabled(true);

      expect(localStorage.getItem('analytics-consent')).toBe('true');
    });

    it('activates analytics in PROD when enabling and analytics not yet created', async () => {
      import.meta.env.PROD = true;
      const { initAnalytics, setAnalyticsEnabled } = await loadModule();

      initAnalytics(fakeApp); // sets firebaseApp without activating (no consent)
      setAnalyticsEnabled(true);
      await vi.dynamicImportSettled();

      expect(mockGetAnalytics).toHaveBeenCalledWith(fakeApp);
      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenCalledWith(
        'mock-analytics-instance',
        true,
      );
    });

    it('calls setAnalyticsCollectionEnabled(false) when disabling already-active analytics', async () => {
      import.meta.env.PROD = true;
      localStorage.setItem('analytics-consent', 'true');
      const { initAnalytics, setAnalyticsEnabled } = await loadModule();

      initAnalytics(fakeApp);
      await vi.dynamicImportSettled();
      mockSetAnalyticsCollectionEnabled.mockClear();

      setAnalyticsEnabled(false);
      await vi.dynamicImportSettled();

      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenCalledWith(
        'mock-analytics-instance',
        false,
      );
    });

    it('does nothing beyond localStorage when not in PROD', async () => {
      import.meta.env.PROD = false;
      const { initAnalytics, setAnalyticsEnabled } = await loadModule();

      initAnalytics(fakeApp);
      setAnalyticsEnabled(true);
      await vi.dynamicImportSettled();

      expect(mockGetAnalytics).not.toHaveBeenCalled();
      expect(localStorage.getItem('analytics-consent')).toBe('true');
    });
  });

  describe('trackEvent', () => {
    it('does nothing when analytics is not enabled', async () => {
      const { trackEvent } = await loadModule();

      trackEvent('test_event', { key: 'value' });
      await vi.dynamicImportSettled();

      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('calls logEvent when analytics is active', async () => {
      import.meta.env.PROD = true;
      localStorage.setItem('analytics-consent', 'true');
      const { initAnalytics, trackEvent } = await loadModule();

      initAnalytics(fakeApp);
      await vi.dynamicImportSettled();

      trackEvent('page_view', { page: '/home' });
      await vi.dynamicImportSettled();

      expect(mockLogEvent).toHaveBeenCalledWith('mock-analytics-instance', 'page_view', {
        page: '/home',
      });
    });
  });

  describe('setUserProperty', () => {
    it('does nothing when analytics is not enabled', async () => {
      const { setUserProperty } = await loadModule();

      setUserProperty('theme', 'dark');
      await vi.dynamicImportSettled();

      expect(mockSetUserProperties).not.toHaveBeenCalled();
    });

    it('calls setUserProperties when analytics is active', async () => {
      import.meta.env.PROD = true;
      localStorage.setItem('analytics-consent', 'true');
      const { initAnalytics, setUserProperty } = await loadModule();

      initAnalytics(fakeApp);
      await vi.dynamicImportSettled();

      setUserProperty('theme', 'dark');
      await vi.dynamicImportSettled();

      expect(mockSetUserProperties).toHaveBeenCalledWith('mock-analytics-instance', {
        theme: 'dark',
      });
    });
  });
});
