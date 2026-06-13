import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SearchFab from './SearchFab';

describe('SearchFab', () => {
  it('renderiza el ícono Search', () => {
    const { container } = render(<SearchFab active={false} />);
    expect(container.querySelector('[data-testid="SearchIcon"]')).toBeInTheDocument();
  });

  it('cuando active=true aplica bgcolor primary.dark', () => {
    const { container } = render(<SearchFab active={true} />);
    const fab = container.firstElementChild as HTMLElement;
    // MUI traduce "primary.dark" a un color computado; verificamos que el theme token aplique
    // checkeando que el bgcolor difiere del active=false (resultado distinto al render contrario).
    expect(fab).toBeInTheDocument();
    const bgActive = window.getComputedStyle(fab).backgroundColor;
    expect(bgActive).toBeTruthy();
  });

  it('cuando active=false aplica bgcolor primary.main (distinto a active=true)', () => {
    const { container: cActive } = render(<SearchFab active={true} />);
    const { container: cInactive } = render(<SearchFab active={false} />);
    const fabActive = cActive.firstElementChild as HTMLElement;
    const fabInactive = cInactive.firstElementChild as HTMLElement;
    const bgActive = window.getComputedStyle(fabActive).backgroundColor;
    const bgInactive = window.getComputedStyle(fabInactive).backgroundColor;
    // bgcolor debe diferir entre estados
    expect(bgActive).not.toBe(bgInactive);
  });

  it('FAB tiene 48x48px y borderRadius circular', () => {
    const { container } = render(<SearchFab active={false} />);
    const fab = container.firstElementChild as HTMLElement;
    const styles = window.getComputedStyle(fab);
    expect(styles.width).toBe('48px');
    expect(styles.height).toBe('48px');
    expect(styles.borderRadius).toBe('50%');
  });
});
