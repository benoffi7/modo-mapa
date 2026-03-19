import { render, screen, fireEvent } from '@testing-library/react';
import AccountBanner from './AccountBanner';

const mockTrackEvent = vi.fn();

vi.mock('../../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

let mockAuthMethod = 'anonymous';
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ authMethod: mockAuthMethod }),
}));

describe('AccountBanner', () => {
  const onCreateAccount = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAuthMethod = 'anonymous';
  });

  it('does not render for non-anonymous users', () => {
    mockAuthMethod = 'email';
    localStorage.setItem('hint_shown_post_first_rating', 'true');
    const { container } = render(<AccountBanner onCreateAccount={onCreateAccount} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render if user has not interacted yet', () => {
    const { container } = render(<AccountBanner onCreateAccount={onCreateAccount} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render if already dismissed', () => {
    localStorage.setItem('hint_shown_post_first_rating', 'true');
    localStorage.setItem('account_banner_dismissed', 'true');
    const { container } = render(<AccountBanner onCreateAccount={onCreateAccount} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders for anonymous users who have interacted', () => {
    localStorage.setItem('hint_shown_post_first_rating', 'true');
    render(<AccountBanner onCreateAccount={onCreateAccount} />);
    expect(screen.getByText('Creá tu cuenta para no perder tus datos')).toBeInTheDocument();
    expect(mockTrackEvent).toHaveBeenCalledWith('onboarding_banner_shown');
  });

  it('calls onCreateAccount and tracks event when CTA clicked', () => {
    localStorage.setItem('hint_shown_post_first_rating', 'true');
    render(<AccountBanner onCreateAccount={onCreateAccount} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(onCreateAccount).toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('onboarding_banner_clicked');
  });

  it('dismisses and persists to localStorage when X clicked', () => {
    localStorage.setItem('hint_shown_post_first_rating', 'true');
    render(<AccountBanner onCreateAccount={onCreateAccount} />);
    fireEvent.click(screen.getByRole('button', { name: '' })); // IconButton with no text
    expect(localStorage.getItem('account_banner_dismissed')).toBe('true');
    expect(mockTrackEvent).toHaveBeenCalledWith('onboarding_banner_dismissed');
  });
});
