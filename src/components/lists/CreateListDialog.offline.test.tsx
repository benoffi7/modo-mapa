import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (#323) ---

const mockCreateList = vi.hoisted(() => vi.fn());
const mockGenerateListId = vi.hoisted(() => vi.fn(() => 'generated-list-id'));
vi.mock('../../services/sharedLists', () => ({
  createList: mockCreateList,
  generateListId: mockGenerateListId,
}));

const mockWithOfflineSupport = vi.hoisted(() => vi.fn());
vi.mock('../../services/offlineInterceptor', () => ({
  withOfflineSupport: mockWithOfflineSupport,
}));

vi.mock('../../utils/busyFlag', () => ({
  withBusyFlag: vi.fn((_kind: string, fn: () => Promise<unknown>) => fn()),
  isBusyFlagActive: vi.fn(() => false),
}));

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('../../context/ToastContext', () => ({ useToast: () => mockToast }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user1' }, displayName: 'Test User' }),
}));

let mockIsOffline = false;
vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mockIsOffline }),
}));

vi.mock('./IconPicker', () => ({ default: () => null }));

import CreateListDialog from './CreateListDialog';

describe('CreateListDialog — wrap createList con withOfflineSupport (#323)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOffline = false;
    mockWithOfflineSupport.mockImplementation(
      (_o: boolean, _t: string, _meta: object, _payload: object, fn: () => Promise<unknown>) => fn(),
    );
    mockCreateList.mockResolvedValue('generated-list-id');
  });

  it('online: invoca withOfflineSupport con isOffline=false y pasa generated listId', async () => {
    const onCreated = vi.fn();
    render(<CreateListDialog open onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Mi lista' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(mockWithOfflineSupport).toHaveBeenCalledTimes(1);
    });

    const call = mockWithOfflineSupport.mock.calls[0]!;
    expect(call[0]).toBe(false);
    expect(call[1]).toBe('list_create');
    expect(call[2]).toEqual({ userId: 'user1', businessId: '', listId: 'generated-list-id' });
    expect(call[3]).toMatchObject({ name: 'Mi lista', description: '' });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('generated-list-id', 'Mi lista', '', undefined);
    });
  });

  it('offline: invoca withOfflineSupport con isOffline=true y onCreated igualmente (optimistic UI)', async () => {
    mockIsOffline = true;
    mockWithOfflineSupport.mockImplementationOnce(async () => undefined);

    const onCreated = vi.fn();
    render(<CreateListDialog open onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Mi lista offline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('generated-list-id', 'Mi lista offline', '', undefined);
    });

    expect(mockWithOfflineSupport.mock.calls[0]![0]).toBe(true);
    expect(mockCreateList).not.toHaveBeenCalled();
    // No success toast offline (interceptor maneja info toast)
    expect(mockToast.success).not.toHaveBeenCalled();
  });
});
