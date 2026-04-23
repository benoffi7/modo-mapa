import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', isAnonymous: false } }),
}));

import BusinessRating from '../BusinessRating';

const ratingData = {
  averageRating: 4.2,
  totalRatings: 10,
  myRating: 3,
  criteriaAverages: {},
  myCriteria: {},
  hasCriteriaData: false,
  handleRate: vi.fn(),
  handleDeleteRating: vi.fn(),
  handleCriterionRate: vi.fn(),
};

describe('BusinessRating', () => {
  it('muestra "Tu calificación" cuando readOnly=false (default)', () => {
    render(<BusinessRating ratingData={ratingData as never} ratings={[]} isLoading={false} />);
    expect(screen.getByText('Tu calificación:')).toBeInTheDocument();
  });

  it('oculta "Tu calificación" cuando readOnly=true', () => {
    render(<BusinessRating ratingData={ratingData as never} ratings={[]} isLoading={false} readOnly />);
    expect(screen.queryByText('Tu calificación:')).not.toBeInTheDocument();
  });

  it('siempre muestra el rating promedio', () => {
    render(<BusinessRating ratingData={ratingData as never} ratings={[]} isLoading={false} readOnly />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
  });
});
