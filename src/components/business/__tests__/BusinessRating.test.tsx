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

  it('IconButton "Borrar calificación" respeta touch target ≥44x44 (Guard #305 R2)', () => {
    render(<BusinessRating ratingData={ratingData as never} ratings={[]} isLoading={false} />);
    const btn = screen.getByLabelText('Borrar calificación') as HTMLElement;
    const styles = window.getComputedStyle(btn);
    expect(styles.minWidth).toBe('44px');
    expect(styles.minHeight).toBe('44px');
  });

  it('cuando ratingData.myRating cambia (null → 4) entre renders, refleja el nuevo valor (S6 stale guard)', () => {
    // Escenario: tras volver de BusinessDetailScreen al sheet, el cache memoria
    // se hidrata con ratings actualizados → useBusinessRating recomputa myRating
    // → BusinessRating debe reflejar el nuevo valor sin cachear el viejo.
    const { rerender } = render(
      <BusinessRating ratingData={{ ...ratingData, myRating: null } as never} ratings={[]} isLoading={false} />,
    );
    // Con myRating=null, el botón "Borrar calificación" no se muestra
    expect(screen.queryByLabelText('Borrar calificación')).not.toBeInTheDocument();

    // Re-render con myRating=4 (simulando refetch post-rate desde detail)
    rerender(
      <BusinessRating ratingData={{ ...ratingData, myRating: 4 } as never} ratings={[]} isLoading={false} />,
    );
    expect(screen.getByLabelText('Borrar calificación')).toBeInTheDocument();
  });
});
