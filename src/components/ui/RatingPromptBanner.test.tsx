import { render, screen, fireEvent } from '@testing-library/react';
import RatingPromptBanner from './RatingPromptBanner';

describe('RatingPromptBanner', () => {
  const defaultProps = {
    businessName: 'Test Cafe',
    onRate: vi.fn(),
    onDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders banner with businessName', () => {
    render(<RatingPromptBanner {...defaultProps} />);
    expect(screen.getByText(/Test Cafe/)).toBeInTheDocument();
    expect(screen.getByText(/C.mo fue tu visita a Test Cafe/)).toBeInTheDocument();
  });

  it('calls onRate when Calificar button is clicked', () => {
    render(<RatingPromptBanner {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Calificar' }));
    expect(defaultProps.onRate).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when close button is clicked', () => {
    render(<RatingPromptBanner {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows star icon', () => {
    render(<RatingPromptBanner {...defaultProps} />);
    expect(screen.getByTestId('StarIcon')).toBeInTheDocument();
  });
});
