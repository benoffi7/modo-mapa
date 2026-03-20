import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OfficeFAB from './OfficeFAB';
import { OFFICE_LOCATION } from '../../constants/map';

const mockPanTo = vi.fn();
const mockSetZoom = vi.fn();

vi.mock('@vis.gl/react-google-maps', () => ({
  useMap: () => ({ panTo: mockPanTo, setZoom: mockSetZoom }),
}));

describe('OfficeFAB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with aria-label', () => {
    render(<OfficeFAB />);
    expect(screen.getByLabelText('Ir a oficina')).toBeTruthy();
  });

  it('pans to office location on click', () => {
    render(<OfficeFAB />);
    fireEvent.click(screen.getByLabelText('Ir a oficina'));
    expect(mockPanTo).toHaveBeenCalledWith(OFFICE_LOCATION);
    expect(mockSetZoom).toHaveBeenCalledWith(15);
  });
});
