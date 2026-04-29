import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CommentListFooter from './CommentListFooter';

vi.mock('../user/UserProfileSheet', () => ({
  default: () => <div data-testid="user-profile-sheet" />,
}));

const baseSnackbarProps = {
  open: true,
  message: 'Comentario eliminado',
  onUndo: vi.fn(),
  autoHideDuration: 5000,
  onClose: vi.fn(),
};

describe('CommentListFooter — snackbar diferenciado offline (#323)', () => {
  it('online: muestra mensaje original + boton Deshacer', () => {
    render(
      <CommentListFooter
        deleteSnackbarProps={baseSnackbarProps}
        profileUser={null}
        onCloseProfile={vi.fn()}
        isOffline={false}
      />,
    );

    expect(screen.getByText('Comentario eliminado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeTruthy();
  });

  it('offline: muestra copy "Eliminado offline" SIN boton Deshacer', () => {
    render(
      <CommentListFooter
        deleteSnackbarProps={baseSnackbarProps}
        profileUser={null}
        onCloseProfile={vi.fn()}
        isOffline={true}
      />,
    );

    expect(
      screen.getByText('Eliminado offline (se sincronizará cuando vuelvas online)'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  });

  it('default isOffline=false: comportamiento online', () => {
    render(
      <CommentListFooter
        deleteSnackbarProps={baseSnackbarProps}
        profileUser={null}
        onCloseProfile={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeTruthy();
  });
});
