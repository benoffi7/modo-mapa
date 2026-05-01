import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  notifications: [] as Array<{ id: string; read: boolean }>,
  isOffline: false,
  authMethod: 'email' as 'email' | 'anonymous',
}));

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ notifications: mocks.notifications }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn(), authMethod: mocks.authMethod }),
}));

vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mocks.isOffline }),
}));

vi.mock('../../services/emailAuth', () => ({
  cleanAnonymousData: vi.fn(),
}));

import SettingsMenu from './SettingsMenu';

describe('SettingsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notifications = [];
    mocks.isOffline = false;
    mocks.authMethod = 'email';
  });

  it('renderiza los items principales como botones (role=button)', () => {
    render(<SettingsMenu onNavigate={vi.fn()} hasPendingActions={false} />);
    // Notificaciones, Privacidad, Configuración, Ayuda y soporte = 4 items
    expect(screen.getByRole('button', { name: /notificaciones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /privacidad/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /configuración/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ayuda y soporte/i })).toBeInTheDocument();
  });

  it('click en "Notificaciones" llama onNavigate("notifications")', () => {
    const onNavigate = vi.fn();
    render(<SettingsMenu onNavigate={onNavigate} hasPendingActions={false} />);
    fireEvent.click(screen.getByRole('button', { name: /notificaciones/i }));
    expect(onNavigate).toHaveBeenCalledWith('notifications');
  });

  it('Enter en "Privacidad" llama onNavigate("privacy")', () => {
    const onNavigate = vi.fn();
    render(<SettingsMenu onNavigate={onNavigate} hasPendingActions={false} />);
    const btn = screen.getByRole('button', { name: /privacidad/i });
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
    // ListItemButton dispara onClick con Enter (built-in MUI keyboard a11y)
    fireEvent.click(btn);
    expect(onNavigate).toHaveBeenCalledWith('privacy');
  });

  it('renderiza item "Pendientes" cuando hasPendingActions=true', () => {
    render(<SettingsMenu onNavigate={vi.fn()} hasPendingActions={true} />);
    expect(screen.getByRole('button', { name: /pendientes/i })).toBeInTheDocument();
  });

  it('NO renderiza "Pendientes" cuando hasPendingActions=false', () => {
    render(<SettingsMenu onNavigate={vi.fn()} hasPendingActions={false} />);
    expect(screen.queryByRole('button', { name: /pendientes/i })).not.toBeInTheDocument();
  });

  it('renderiza badge cuando hay notificaciones unread', () => {
    mocks.notifications = [
      { id: '1', read: false },
      { id: '2', read: false },
      { id: '3', read: true },
    ];
    const { container } = render(<SettingsMenu onNavigate={vi.fn()} hasPendingActions={false} />);
    // Badge MUI renderiza un span con clase MuiBadge-badge mostrando "2"
    const badge = container.querySelector('.MuiBadge-badge');
    expect(badge?.textContent).toBe('2');
  });

  it('botón "Cerrar sesión" para usuario email', () => {
    mocks.authMethod = 'email';
    render(<SettingsMenu onNavigate={vi.fn()} hasPendingActions={false} />);
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it('botón "Empezar de cero" para usuario anonymous', () => {
    mocks.authMethod = 'anonymous';
    render(<SettingsMenu onNavigate={vi.fn()} hasPendingActions={false} />);
    expect(screen.getByRole('button', { name: /empezar de cero/i })).toBeInTheDocument();
  });
});
