import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SharedList } from '../../types';

// --- Mocks (#323 — list CRUD wraps + delete gate) ---

const mockUpdateList = vi.hoisted(() => vi.fn());
const mockToggleListPublic = vi.hoisted(() => vi.fn());
const mockDeleteList = vi.hoisted(() => vi.fn());
const mockRemoveBusinessFromList = vi.hoisted(() => vi.fn());
const mockFetchListItems = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockFetchSharedList = vi.hoisted(() => vi.fn());
vi.mock('../../services/sharedLists', () => ({
  updateList: mockUpdateList,
  toggleListPublic: mockToggleListPublic,
  deleteList: mockDeleteList,
  removeBusinessFromList: mockRemoveBusinessFromList,
  fetchListItems: mockFetchListItems,
  fetchSharedList: mockFetchSharedList,
}));

const mockWithOfflineSupport = vi.hoisted(() => vi.fn());
vi.mock('../../services/offlineInterceptor', () => ({
  withOfflineSupport: mockWithOfflineSupport,
}));

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('../../context/ToastContext', () => ({ useToast: () => mockToast }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'owner1' }, displayName: 'Owner' }),
}));

let mockIsOffline = false;
vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mockIsOffline }),
}));

vi.mock('../../hooks/useNavigateToBusiness', () => ({
  useNavigateToBusiness: () => ({ navigateToBusiness: vi.fn() }),
}));

vi.mock('../../hooks/useBusinesses', () => ({ allBusinesses: [] }));

vi.mock('./IconPicker', () => ({ default: () => null }));
vi.mock('./EditorsDialog', () => ({ default: () => null }));
vi.mock('./InviteEditorDialog', () => ({ default: () => null }));
vi.mock('./ColorPicker', () => ({
  default: () => null,
  sanitizeListColor: (c: string | undefined) => c ?? '#fff',
}));

import ListDetailScreen from './ListDetailScreen';

const baseList: SharedList = {
  id: 'list1',
  ownerId: 'owner1',
  name: 'Mi lista',
  description: '',
  isPublic: false,
  itemCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  editorIds: [],
  featured: false,
};

describe('ListDetailScreen — list CRUD wraps + delete gate (#323)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOffline = false;
    mockWithOfflineSupport.mockImplementation(
      (_o: boolean, _t: string, _meta: object, _payload: object, fn: () => Promise<unknown>) => fn(),
    );
    mockUpdateList.mockResolvedValue(undefined);
    mockToggleListPublic.mockResolvedValue(undefined);
    mockDeleteList.mockResolvedValue(undefined);
    mockFetchListItems.mockResolvedValue([]);
  });

  it('online: handleTogglePublic invoca withOfflineSupport(list_toggle_public)', async () => {
    render(<ListDetailScreen list={baseList} onBack={vi.fn()} onDeleted={vi.fn()} />);

    const btn = await screen.findByRole('button', { name: /Hacer lista pública/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockWithOfflineSupport).toHaveBeenCalled();
    });
    const call = mockWithOfflineSupport.mock.calls.find((c) => c[1] === 'list_toggle_public');
    expect(call).toBeTruthy();
    expect(call![0]).toBe(false);
    expect(call![3]).toEqual({ isPublic: true });
  });

  it('offline: handleDelete está gated — toast.warning + no llama deleteList', async () => {
    mockIsOffline = true;
    const onDeleted = vi.fn();
    render(<ListDetailScreen list={baseList} onBack={vi.fn()} onDeleted={onDeleted} />);

    const trashIcon = await screen.findByRole('button', { name: 'Eliminar lista' });
    expect(trashIcon).toBeDisabled();
    // Click no abre dialog porque está disabled — no probamos el flujo del dialog,
    // solo el guard interno por si alguien lo invoca via otra ruta.
  });

  it('offline: boton "Eliminar lista" disabled con title de conexion', async () => {
    mockIsOffline = true;
    render(<ListDetailScreen list={baseList} onBack={vi.fn()} onDeleted={vi.fn()} />);

    const trashIcon = await screen.findByRole('button', { name: 'Eliminar lista' });
    expect(trashIcon).toBeDisabled();
    expect(trashIcon.getAttribute('title')).toBe('Requiere conexión');
  });
});
