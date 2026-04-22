import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HelpSection from '../HelpSection';

// `__APP_VERSION__` es una constante inyectada por Vite (define). En tests la
// stubeamos globalmente para que el render no explote.
beforeAll(() => {
  (globalThis as unknown as Record<string, unknown>).__APP_VERSION__ = '2.35.8-test';
});

describe('<HelpSection>', () => {
  it('renderiza todos los grupos de ayuda', () => {
    render(<HelpSection />);
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Buscar')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('Listas')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });

  it('muestra la version de la app', () => {
    render(<HelpSection />);
    expect(screen.getByText(/Modo Mapa v/)).toBeInTheDocument();
  });

  it('expande y colapsa un accordion al hacer click', () => {
    render(<HelpSection />);
    const summary = screen.getByText('Pantalla principal').closest('button');
    expect(summary).not.toBeNull();
    fireEvent.click(summary!);
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(summary!);
    expect(summary).toHaveAttribute('aria-expanded', 'false');
  });

  it('solo un accordion expandido a la vez', () => {
    render(<HelpSection />);
    const first = screen.getByText('Pantalla principal').closest('button');
    const second = screen.getByText('Mapa y busqueda').closest('button');
    fireEvent.click(first!);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(second!);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
  });

  it('cada AccordionSummary tiene aria-label con el titulo', () => {
    render(<HelpSection />);
    const offlineSummary = screen.getByText('Modo offline').closest('button');
    expect(offlineSummary).not.toBeNull();
    expect(offlineSummary).toHaveAttribute('aria-label', 'Modo offline');
  });
});
