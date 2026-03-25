import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('calls console methods in DEV mode', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Default test env is DEV=true
    const { logger } = await import('./logger');
    logger.error('err', new Error('test'));
    logger.warn('warn');
    logger.log('log');
    expect(errorSpy).toHaveBeenCalledWith('err', expect.any(Error));
    expect(warnSpy).toHaveBeenCalledWith('warn');
    expect(logSpy).toHaveBeenCalledWith('log');
  });

  it('does not throw when called with various argument types', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { logger } = await import('./logger');
    expect(() => logger.error('msg', 42, null, { key: 'val' })).not.toThrow();
    expect(() => logger.warn('msg')).not.toThrow();
    expect(() => logger.log('msg', [1, 2])).not.toThrow();
  });
});
