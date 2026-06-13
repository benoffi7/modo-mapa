import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchFollowing: vi.fn(),
  fetchUserDisplayNames: vi.fn(),
  user: { uid: 'me' } as { uid: string } | null,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('../../services/follows', () => ({
  fetchFollowing: mocks.fetchFollowing,
}));

vi.mock('../../services/users', () => ({
  fetchUserDisplayNames: mocks.fetchUserDisplayNames,
}));

vi.mock('../../hooks/useTabRefresh', () => ({
  useSocialSubTabRefresh: vi.fn(),
}));

vi.mock('../UserSearchField', () => ({
  UserSearchField: () => <div>UserSearchField</div>,
}));

vi.mock('../common/PullToRefreshWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { FollowedList } from './FollowedList';

describe('FollowedList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { uid: 'me' };
  });

  it('renderiza items como botones (role=button) con displayName', async () => {
    mocks.fetchFollowing.mockResolvedValue({
      docs: [
        { data: () => ({ followedId: 'u1' }) },
        { data: () => ({ followedId: 'u2' }) },
      ],
      hasMore: false,
      cursor: null,
    });
    mocks.fetchUserDisplayNames.mockResolvedValue(
      new Map([
        ['u1', 'Alice'],
        ['u2', 'Bob'],
      ]),
    );

    render(<FollowedList onUserClick={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    // Cada item es un ListItemButton (role=button)
    const buttons = screen.getAllByRole('button');
    // Alice + Bob (al menos 2 botones del list)
    const aliceBtn = buttons.find((b) => b.textContent?.includes('Alice'));
    const bobBtn = buttons.find((b) => b.textContent?.includes('Bob'));
    expect(aliceBtn).toBeTruthy();
    expect(bobBtn).toBeTruthy();
  });

  it('al click en un item llama onUserClick(uid)', async () => {
    mocks.fetchFollowing.mockResolvedValue({
      docs: [{ data: () => ({ followedId: 'u_alice' }) }],
      hasMore: false,
      cursor: null,
    });
    mocks.fetchUserDisplayNames.mockResolvedValue(new Map([['u_alice', 'Alice']]));

    const onUserClick = vi.fn();
    render(<FollowedList onUserClick={onUserClick} />);

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());

    const aliceBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Alice'))!;
    fireEvent.click(aliceBtn);
    expect(onUserClick).toHaveBeenCalledWith('u_alice');
  });

  it('renderiza empty state cuando no hay seguidos', async () => {
    mocks.fetchFollowing.mockResolvedValue({ docs: [], hasMore: false, cursor: null });
    mocks.fetchUserDisplayNames.mockResolvedValue(new Map());

    render(<FollowedList onUserClick={vi.fn()} />);

    await waitFor(() => {
      // PaginatedListShell empty: muestra el empty message
      expect(screen.getByText(/buscá usuarios arriba para empezar/i)).toBeInTheDocument();
    });
  });
});
