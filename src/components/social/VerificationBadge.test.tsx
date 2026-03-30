import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

import VerificationBadge from './VerificationBadge';
import type { VerificationBadge as VBType } from '../../types';

const earnedBadge: VBType = {
  id: 'local_guide',
  name: 'Local Guide',
  description: '50+ calificaciones en tu ciudad',
  icon: '\u{1F6E1}\u{FE0F}',
  earned: true,
  progress: 100,
  current: 55,
  target: 50,
};

const unearnedBadge: VBType = {
  id: 'verified_visitor',
  name: 'Visitante Verificado',
  description: '5+ check-ins desde el negocio',
  icon: '\u{1F4CD}',
  earned: false,
  progress: 40,
  current: 2,
  target: 5,
};

describe('VerificationBadge', () => {
  it('renders earned badge name', () => {
    render(<VerificationBadge badge={earnedBadge} />);
    expect(screen.getByText('Local Guide')).toBeTruthy();
  });

  it('renders unearned badge with progress', () => {
    render(<VerificationBadge badge={unearnedBadge} />);
    expect(screen.getByText('Visitante Verificado')).toBeTruthy();
    expect(screen.getByText('2/5')).toBeTruthy();
  });

  it('renders compact mode as a chip', () => {
    render(<VerificationBadge badge={earnedBadge} compact />);
    // In compact mode, name appears inside a Chip
    expect(screen.getByText(/Local Guide/)).toBeTruthy();
  });

  it('renders trusted reviewer with percentage format', () => {
    const trBadge: VBType = {
      id: 'trusted_reviewer',
      name: 'Opini\u00F3n Confiable',
      description: 'Ratings consistentes con la comunidad',
      icon: '\u2705',
      earned: false,
      progress: 60,
      current: 60,
      target: 80,
    };
    render(<VerificationBadge badge={trBadge} />);
    expect(screen.getByText('60% consistencia')).toBeTruthy();
  });
});
