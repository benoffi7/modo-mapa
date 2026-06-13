import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StaleBanner from './StaleBanner';

describe('StaleBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el mensaje de datos desactualizados', () => {
    render(<StaleBanner businessId="biz_test_1" onRefresh={vi.fn()} />);
    expect(screen.getByText(/datos pueden no estar actualizados/i)).toBeInTheDocument();
  });

  it('al click en refrescar dispara onRefresh', () => {
    const onRefresh = vi.fn();
    render(<StaleBanner businessId="biz_test_2" onRefresh={onRefresh} />);
    fireEvent.click(screen.getByLabelText('Actualizar datos'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('al click en cerrar oculta el banner (no aparece más en el DOM)', () => {
    const { container } = render(<StaleBanner businessId="biz_test_3" onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Cerrar aviso'));
    expect(container.firstChild).toBeNull();
  });

  it('IconButton refrescar respeta touch target ≥44x44', () => {
    render(<StaleBanner businessId="biz_test_4" onRefresh={vi.fn()} />);
    const btn = screen.getByLabelText('Actualizar datos') as HTMLElement;
    const styles = window.getComputedStyle(btn);
    expect(styles.minWidth).toBe('44px');
    expect(styles.minHeight).toBe('44px');
  });

  it('IconButton cerrar respeta touch target ≥44x44', () => {
    render(<StaleBanner businessId="biz_test_5" onRefresh={vi.fn()} />);
    const btn = screen.getByLabelText('Cerrar aviso') as HTMLElement;
    const styles = window.getComputedStyle(btn);
    expect(styles.minWidth).toBe('44px');
    expect(styles.minHeight).toBe('44px');
  });
});
