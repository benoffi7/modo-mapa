import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CommentListFooter from './CommentListFooter';
import type { ComponentProps } from 'react';

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

describe('CommentListFooter — #340 W1: undo estable ante cambio de conectividad', () => {
  type Props = ComponentProps<typeof CommentListFooter>;
  const renderFooter = (props: Partial<Props> & { isOffline: boolean }) =>
    render(
      <CommentListFooter
        deleteSnackbarProps={baseSnackbarProps}
        profileUser={null}
        onCloseProfile={vi.fn()}
        {...props}
      />,
    );

  it('mantiene "Deshacer" si pasa a offline DURANTE la ventana de undo (snackbar ya abierto)', () => {
    const { rerender } = renderFooter({ isOffline: false });
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeTruthy();

    // online → offline mientras el snackbar sigue abierto: el boton NO debe desaparecer.
    rerender(
      <CommentListFooter
        deleteSnackbarProps={baseSnackbarProps}
        profileUser={null}
        onCloseProfile={vi.fn()}
        isOffline={true}
      />,
    );

    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeTruthy();
    expect(screen.getByText('Comentario eliminado')).toBeTruthy();
  });

  it('un delete iniciado offline NO muestra "Deshacer" aunque luego vuelva online', () => {
    const { rerender } = renderFooter({ isOffline: true });
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();

    rerender(
      <CommentListFooter
        deleteSnackbarProps={baseSnackbarProps}
        profileUser={null}
        onCloseProfile={vi.fn()}
        isOffline={false}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  });

  it('recalcula el modo al ABRIR un nuevo snackbar', () => {
    const closed = { ...baseSnackbarProps, open: false };
    const { rerender } = render(
      <CommentListFooter
        deleteSnackbarProps={closed}
        profileUser={null}
        onCloseProfile={vi.fn()}
        isOffline={false}
      />,
    );

    // Ahora offline y se abre un nuevo snackbar → modo offline, sin "Deshacer".
    rerender(
      <CommentListFooter
        deleteSnackbarProps={baseSnackbarProps}
        profileUser={null}
        onCloseProfile={vi.fn()}
        isOffline={true}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
    expect(
      screen.getByText('Eliminado offline (se sincronizará cuando vuelvas online)'),
    ).toBeTruthy();
  });
});
