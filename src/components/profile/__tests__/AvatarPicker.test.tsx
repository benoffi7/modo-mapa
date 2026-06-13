import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../constants/avatars', () => ({
  AVATAR_OPTIONS: [
    { id: 'a1', emoji: '😀', label: 'Sonrisa' },
    { id: 'a2', emoji: '😎', label: 'Lentes' },
  ],
}));
vi.mock('../../../constants/messages', () => ({
  MSG_COMMON: { closeAriaLabel: 'Cerrar' },
}));

import AvatarPicker from '../AvatarPicker';

describe('AvatarPicker — offline gate (#344)', () => {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('online: avatar buttons enabled and onSelect fires on click', () => {
    render(<AvatarPicker open onClose={onClose} onSelect={onSelect} selectedId={undefined} isOffline={false} />);
    const btn = screen.getByRole('button', { name: 'Sonrisa' });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledWith({ id: 'a1', emoji: '😀', label: 'Sonrisa' });
  });

  it('offline: avatar buttons disabled with aria-disabled and onSelect does NOT fire', () => {
    render(<AvatarPicker open onClose={onClose} onSelect={onSelect} selectedId={undefined} isOffline />);
    const btn = screen.getByRole('button', { name: 'Sonrisa' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
