import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { CustomTag } from '../../../types';

const mocks = vi.hoisted(() => ({ isOffline: false }));

const mockCreateCustomTag = vi.fn();
const mockUpdateCustomTag = vi.fn();
const mockDeleteCustomTag = vi.fn();
const mockGenerateCustomTagId = vi.fn(() => 'client-tag-id');
const mockAddUserTag = vi.fn();
const mockRemoveUserTag = vi.fn();
const mockWithOfflineSupport = vi.fn();
const mockToastInfo = vi.fn();
const mockOnTagsChange = vi.fn();

vi.mock('../../../services/tags', () => ({
  addUserTag: (...a: unknown[]) => mockAddUserTag(...a),
  removeUserTag: (...a: unknown[]) => mockRemoveUserTag(...a),
  createCustomTag: (...a: unknown[]) => mockCreateCustomTag(...a),
  updateCustomTag: (...a: unknown[]) => mockUpdateCustomTag(...a),
  deleteCustomTag: (...a: unknown[]) => mockDeleteCustomTag(...a),
  generateCustomTagId: () => mockGenerateCustomTagId(),
}));

vi.mock('../../../services/offlineInterceptor', () => ({
  OFFLINE_ENQUEUED_MSG: 'Guardado offline — se sincronizará al reconectar',
  withOfflineSupport: (...a: unknown[]) => mockWithOfflineSupport(...a),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}));
vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ info: mockToastInfo }),
}));
vi.mock('../../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mocks.isOffline }),
}));
vi.mock('../../../context/BusinessScopeContext', () => ({
  useBusinessScope: () => ({ businessId: 'biz_1', businessName: 'Cafe Uno' }),
}));
vi.mock('../../../hooks/useFollowedTags', () => ({
  useFollowedTags: () => ({ isFollowed: () => false, followTag: vi.fn(), unfollowTag: vi.fn() }),
}));

import BusinessTags from '../BusinessTags';

const existingTag: CustomTag = {
  id: 'tag-existing',
  userId: 'u1',
  businessId: 'biz_1',
  label: 'Pet friendly',
  createdAt: new Date(),
};

function renderTags(customTags: CustomTag[] = []) {
  return render(
    <BusinessTags
      seedTags={[]}
      userTags={[]}
      customTags={customTags}
      isLoading={false}
      onTagsChange={mockOnTagsChange}
    />,
  );
}

describe('BusinessTags — custom tag offline (#344)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOffline = false;
    // online: run the wrapped action; offline: enqueue + toast
    mockWithOfflineSupport.mockImplementation(
      async (isOffline: boolean, _type, _meta, _payload, onlineAction, toast) => {
        if (!isOffline) return onlineAction();
        toast?.info('Guardado offline — se sincronizará al reconectar');
      },
    );
  });

  it('create online: generates a client-side id and runs createCustomTag with it', async () => {
    renderTags();
    fireEvent.click(screen.getByText('Agregar'));
    fireEvent.change(screen.getByPlaceholderText('Ej: Tiene estacionamiento'), { target: { value: 'Wifi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(mockCreateCustomTag).toHaveBeenCalled());
    expect(mockGenerateCustomTagId).toHaveBeenCalled();
    expect(mockCreateCustomTag).toHaveBeenCalledWith('u1', 'biz_1', 'Wifi', 'client-tag-id');
    // the enqueued referenceId is the same generated id
    const [, type, meta, payload] = mockWithOfflineSupport.mock.calls[0];
    expect(type).toBe('custom_tag_create');
    expect(meta.referenceId).toBe('client-tag-id');
    expect(payload).toEqual({ label: 'Wifi' });
    expect(mockOnTagsChange).toHaveBeenCalled();
  });

  it('create offline: enqueues custom_tag_create and shows the offline toast', async () => {
    mocks.isOffline = true;
    renderTags();
    fireEvent.click(screen.getByText('Agregar'));
    fireEvent.change(screen.getByPlaceholderText('Ej: Tiene estacionamiento'), { target: { value: 'Wifi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(mockWithOfflineSupport).toHaveBeenCalled());
    expect(mockCreateCustomTag).not.toHaveBeenCalled();
    expect(mockToastInfo).toHaveBeenCalledWith('Guardado offline — se sincronizará al reconectar');
    const [, type, meta] = mockWithOfflineSupport.mock.calls[0];
    expect(type).toBe('custom_tag_create');
    expect(meta.referenceId).toBe('client-tag-id');
  });

  it('update online: runs updateCustomTag via withOfflineSupport with the tag id as referenceId', async () => {
    renderTags([existingTag]);
    fireEvent.click(screen.getByText('Pet friendly'));
    fireEvent.click(screen.getByText('Editar'));
    const input = screen.getByDisplayValue('Pet friendly');
    fireEvent.change(input, { target: { value: 'Pet ok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(mockUpdateCustomTag).toHaveBeenCalledWith('tag-existing', 'Pet ok'));
    const [, type, meta] = mockWithOfflineSupport.mock.calls[0];
    expect(type).toBe('custom_tag_update');
    expect(meta.referenceId).toBe('tag-existing');
  });

  it('delete offline: enqueues custom_tag_delete referencing the same tag id, with toast', async () => {
    mocks.isOffline = true;
    renderTags([existingTag]);
    fireEvent.click(screen.getByText('Pet friendly'));
    fireEvent.click(screen.getByText('Eliminar'));
    // DeleteTagDialog confirm button
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));

    await waitFor(() => expect(mockWithOfflineSupport).toHaveBeenCalled());
    expect(mockDeleteCustomTag).not.toHaveBeenCalled();
    const [, type, meta, payload] = mockWithOfflineSupport.mock.calls[0];
    expect(type).toBe('custom_tag_delete');
    expect(meta.referenceId).toBe('tag-existing');
    expect(payload).toEqual({ _type: 'custom_tag_delete' });
    expect(mockToastInfo).toHaveBeenCalledWith('Guardado offline — se sincronizará al reconectar');
  });
});
