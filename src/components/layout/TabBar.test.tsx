import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  setActiveTab: vi.fn(),
  trackEvent: vi.fn(),
  activeTab: 'inicio' as 'inicio' | 'social' | 'buscar' | 'listas' | 'perfil',
}));

vi.mock('../../context/TabContext', () => ({
  useTab: () => ({
    activeTab: mocks.activeTab,
    setActiveTab: mocks.setActiveTab,
  }),
}));

vi.mock('../../utils/analytics', () => ({
  trackEvent: mocks.trackEvent,
}));

import TabBar from './TabBar';

describe('TabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeTab = 'inicio';
  });

  it('renderiza los 5 tabs con sus labels', () => {
    render(<TabBar />);
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('Buscar')).toBeInTheDocument();
    expect(screen.getByText('Listas')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
  });

  it('renderiza SearchFab dentro del action de Buscar', () => {
    const { container } = render(<TabBar />);
    // El SearchIcon dentro del FAB debe estar presente (es decorativo)
    expect(container.querySelector('[data-testid="SearchIcon"]')).toBeInTheDocument();
  });

  it('cuando activeTab=buscar, SearchFab recibe active=true (bgcolor primary.dark)', () => {
    mocks.activeTab = 'buscar';
    const { container } = render(<TabBar />);
    const fab = container.querySelector('[data-testid="SearchIcon"]')?.parentElement as HTMLElement;
    expect(fab).toBeTruthy();
    const bgWhenActive = window.getComputedStyle(fab).backgroundColor;

    // Re-render con activeTab distinto
    mocks.activeTab = 'inicio';
    const { container: c2 } = render(<TabBar />);
    const fab2 = c2.querySelector('[data-testid="SearchIcon"]')?.parentElement as HTMLElement;
    const bgWhenInactive = window.getComputedStyle(fab2).backgroundColor;

    expect(bgWhenActive).not.toBe(bgWhenInactive);
  });

  it('al click en otro tab dispara setActiveTab + trackEvent', () => {
    render(<TabBar />);
    fireEvent.click(screen.getByText('Listas'));
    expect(mocks.setActiveTab).toHaveBeenCalledWith('listas');
    expect(mocks.trackEvent).toHaveBeenCalledWith('tab_switched', { from: 'inicio', to: 'listas' });
  });

  it('al click en el tab activo no dispara setActiveTab', () => {
    mocks.activeTab = 'inicio';
    render(<TabBar />);
    fireEvent.click(screen.getByText('Inicio'));
    expect(mocks.setActiveTab).not.toHaveBeenCalled();
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });
});
