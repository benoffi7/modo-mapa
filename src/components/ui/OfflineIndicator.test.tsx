import { render, screen, act } from '@testing-library/react';
import { OfflineIndicator } from './OfflineIndicator';

describe('OfflineIndicator', () => {
  const originalOnLine = navigator.onLine;

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  it('shows chip when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineIndicator />);
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
  });

  it('hides chip when online', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
    render(<OfflineIndicator />);
    expect(screen.queryByText('Sin conexión')).not.toBeInTheDocument();
  });

  it('reacts to offline event', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
    render(<OfflineIndicator />);
    expect(screen.queryByText('Sin conexión')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
  });

  it('reacts to online event', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineIndicator />);
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText('Sin conexión')).not.toBeInTheDocument();
  });
});
