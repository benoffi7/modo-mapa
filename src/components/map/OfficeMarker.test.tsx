import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfficeMarker from './OfficeMarker';

vi.mock('@vis.gl/react-google-maps', () => ({
  AdvancedMarker: ({ children, position }: { children: React.ReactNode; position: { lat: number; lng: number } }) => (
    <div data-testid="advanced-marker" data-lat={position.lat} data-lng={position.lng}>
      {children}
    </div>
  ),
}));

describe('OfficeMarker', () => {
  it('renders at office coordinates', () => {
    render(<OfficeMarker />);
    const marker = screen.getByTestId('advanced-marker');
    expect(marker.dataset.lat).toBe('-34.5591511');
    expect(marker.dataset.lng).toBe('-58.4473681');
  });

  it('has aria-label "Oficina"', () => {
    render(<OfficeMarker />);
    expect(screen.getByLabelText('Oficina')).toBeTruthy();
  });
});
