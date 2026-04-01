import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EditorsDialog from '../EditorsDialog';

vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock('../../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: false }),
}));

const mockFetchEditorName = vi.fn();
const mockRemoveEditor = vi.fn();
vi.mock('../../../services/sharedLists', () => ({
  fetchEditorName: (...args: unknown[]) => mockFetchEditorName(...args),
  removeEditor: (...args: unknown[]) => mockRemoveEditor(...args),
}));

describe('EditorsDialog', () => {
  const editorIds = ['uid_abc12345', 'uid_def67890'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchEditorName.mockImplementation((uid: string) =>
      Promise.resolve(uid === 'uid_abc12345' ? 'Alice' : 'Bob'),
    );
  });

  it('shows "Editor" as secondary text instead of UID', async () => {
    render(
      <EditorsDialog
        open={true}
        onClose={vi.fn()}
        listId="list1"
        editorIds={editorIds}
        onEditorRemoved={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const editorLabels = screen.getAllByText('Editor');
    expect(editorLabels).toHaveLength(2);
  });

  it('does not render any UID in the DOM', async () => {
    const { container } = render(
      <EditorsDialog
        open={true}
        onClose={vi.fn()}
        listId="list1"
        editorIds={editorIds}
        onEditorRemoved={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const html = container.innerHTML;
    expect(html).not.toContain('uid_abc12345');
    expect(html).not.toContain('uid_def67890');
    expect(html).not.toContain('uid_abc1');
    expect(html).not.toContain('uid_def6');
  });
});
