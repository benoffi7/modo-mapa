import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { uid: 'me' } as { uid: string } | null,
  isOffline: true,
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  fetchAllAccessibleLists: vi.fn(),
  fetchListItems: vi.fn(),
  fetchUserLists: vi.fn(),
  createList: vi.fn().mockResolvedValue(undefined),
  addBusinessToList: vi.fn().mockResolvedValue(undefined),
  removeBusinessFromList: vi.fn().mockResolvedValue(undefined),
  generateListId: vi.fn(() => 'new-list-id'),
  withOfflineSupport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => mocks.toast,
}));

vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mocks.isOffline }),
}));

vi.mock('../../context/BusinessScopeContext', () => ({
  useOptionalBusinessScope: () => null,
}));

vi.mock('../../services/sharedLists', () => ({
  createList: (...a: unknown[]) => mocks.createList(...a),
  generateListId: () => mocks.generateListId(),
  addBusinessToList: (...a: unknown[]) => mocks.addBusinessToList(...a),
  removeBusinessFromList: (...a: unknown[]) => mocks.removeBusinessFromList(...a),
  fetchListItems: (...a: unknown[]) => mocks.fetchListItems(...a),
  fetchAllAccessibleLists: (...a: unknown[]) => mocks.fetchAllAccessibleLists(...a),
  fetchUserLists: (...a: unknown[]) => mocks.fetchUserLists(...a),
}));

vi.mock('../../services/offlineInterceptor', () => ({
  withOfflineSupport: (...a: unknown[]) => mocks.withOfflineSupport(...a),
}));

vi.mock('../../utils/busyFlag', () => ({
  withBusyFlag: (_flag: string, fn: () => Promise<void>) => fn(),
}));

import AddToListDialog from './AddToListDialog';

describe('AddToListDialog — #340 W4: lista creada offline sobrevive al re-fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { uid: 'me' };
    mocks.isOffline = true;
    mocks.fetchAllAccessibleLists.mockResolvedValue([]);
    mocks.fetchListItems.mockResolvedValue([]);
    mocks.generateListId.mockReturnValue('new-list-id');
  });

  it('preserva la lista optimista cuando el effect re-fetchea (cambia businessId)', async () => {
    const { rerender } = render(
      <AddToListDialog open onClose={vi.fn()} businessId="biz1" businessName="Café Luna" />,
    );

    // Espera el fetch inicial (vacio).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /nueva lista/i })).toBeInTheDocument(),
    );

    // Crea una lista offline.
    fireEvent.click(screen.getByRole('button', { name: /nueva lista/i }));
    const input = screen.getByPlaceholderText(/nombre de la lista/i);
    fireEvent.change(input, { target: { value: 'Mi lista offline' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^crear$/i }));
    });

    await waitFor(() => expect(screen.getByText('Mi lista offline')).toBeInTheDocument());

    // El effect re-fetchea (businessId cambia) y sigue devolviendo [] (offline no persistio).
    rerender(
      <AddToListDialog open onClose={vi.fn()} businessId="biz2" businessName="Café Luna" />,
    );

    // La lista optimista NO debe desaparecer.
    await waitFor(() => expect(mocks.fetchAllAccessibleLists).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Mi lista offline')).toBeInTheDocument();
  });

  it('online: recarga listas reales tras crear (no usa estado optimista)', async () => {
    mocks.isOffline = false;
    mocks.fetchUserLists.mockResolvedValue([
      { id: 'new-list-id', ownerId: 'me', name: 'Lista real', description: '', isPublic: false, featured: false, editorIds: [], itemCount: 1, createdAt: new Date(), updatedAt: new Date() },
    ]);

    render(<AddToListDialog open onClose={vi.fn()} businessId="biz1" businessName="Café Luna" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /nueva lista/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /nueva lista/i }));
    fireEvent.change(screen.getByPlaceholderText(/nombre de la lista/i), { target: { value: 'Lista real' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^crear$/i }));
    });

    await waitFor(() => expect(mocks.fetchUserLists).toHaveBeenCalled());
    expect(screen.getByText('Lista real')).toBeInTheDocument();
  });
});
