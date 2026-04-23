import { vi, it, expect, beforeEach } from 'vitest';

vi.mock('./pwa/registerPwa', () => ({ registerPwa: vi.fn() }));
vi.mock('./config/sentry', () => ({ initSentry: vi.fn() }));
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: vi.fn() })),
}));
vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: unknown }) => children,
}));
vi.mock('./App', () => ({ default: () => null }));
vi.mock('./index.css', () => ({}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

it('registerPwa is called exactly once during app bootstrap', async () => {
  const { registerPwa } = await import('./pwa/registerPwa');
  await import('./main');
  expect(registerPwa).toHaveBeenCalledTimes(1);
});

it('initSentry is called exactly once during app bootstrap', async () => {
  const { initSentry } = await import('./config/sentry');
  await import('./main');
  expect(initSentry).toHaveBeenCalledTimes(1);
});
