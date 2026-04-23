import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockWithBusyFlag = vi.hoisted(() => vi.fn((_kind: string, fn: (h: () => void) => Promise<unknown>) => fn(() => {})));
vi.mock('../../utils/busyFlag', () => ({
  withBusyFlag: mockWithBusyFlag,
  isBusyFlagActive: vi.fn(() => false),
}));

const mockSendFeedback = vi.hoisted(() => vi.fn());
vi.mock('../../services/feedback', () => ({
  sendFeedback: mockSendFeedback,
  fetchUserFeedback: vi.fn(() => Promise.resolve([])),
  markFeedbackViewed: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user1' } }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: false }),
}));

vi.mock('../../hooks/useBusinesses', () => ({
  allBusinesses: [],
}));

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

import FeedbackForm from './FeedbackForm';

describe('FeedbackForm – withBusyFlag integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendFeedback.mockResolvedValue(undefined);
  });

  it('submit invoca withBusyFlag con kind: feedback_submit', async () => {
    render(<FeedbackForm />);

    const textarea = screen.getByPlaceholderText('Escribí tu mensaje...');
    fireEvent.change(textarea, { target: { value: 'Mi feedback de prueba' } });

    const sendButton = screen.getByRole('button', { name: /enviar/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockWithBusyFlag).toHaveBeenCalledWith('feedback_submit', expect.any(Function));
    });
  });

  it('sendFeedback es llamado dentro de withBusyFlag', async () => {
    render(<FeedbackForm />);

    const textarea = screen.getByPlaceholderText('Escribí tu mensaje...');
    fireEvent.change(textarea, { target: { value: 'Feedback de test' } });

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => {
      expect(mockSendFeedback).toHaveBeenCalled();
    });
  });
});
