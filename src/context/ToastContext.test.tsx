import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ToastProvider, useToast } from './ToastContext';

// Mock MUI components to avoid heavy rendering
vi.mock('@mui/material', () => ({
  Snackbar: ({ children, open }: { children: ReactNode; open: boolean; onClose?: unknown }) => (
    open ? <div data-testid="snackbar">{children}</div> : null
  ),
  Alert: ({ children, onClose }: { children: ReactNode; onClose?: () => void; severity?: string; variant?: string; action?: ReactNode; sx?: unknown }) => (
    <div data-testid="alert" onClick={onClose}>{children}</div>
  ),
  IconButton: ({ children, onClick }: { children: ReactNode; onClick?: () => void; size?: string; color?: string; 'aria-label'?: string }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock('@mui/icons-material/Close', () => ({
  default: () => <span>X</span>,
}));

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('ToastContext / useToast', () => {
  it('throws when used outside ToastProvider', () => {
    expect(() => renderHook(() => useToast())).toThrow('useToast must be used within a ToastProvider');
  });

  it('success, error, warning, info methods are callable', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => { result.current.success('Done!'); });
    act(() => { result.current.error('Fail!'); });
    act(() => { result.current.warning('Warn!'); });
    act(() => { result.current.info('Info!'); });
    // No throw — all four methods callable
  });
});
