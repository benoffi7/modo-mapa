import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchConfigDocs = vi.fn();
const mockUpdateModerationBannedWords = vi.fn();

vi.mock('../../../services/admin/config', () => ({
  fetchConfigDocs: () => mockFetchConfigDocs(),
  updateModerationBannedWords: (words: string[]) => mockUpdateModerationBannedWords(words),
}));

vi.mock('../../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../../constants/analyticsEvents', () => ({
  ADMIN_CONFIG_VIEWED: 'admin_config_viewed',
  ADMIN_MODERATION_UPDATED: 'admin_moderation_updated',
}));

import ConfigPanel from '../ConfigPanel';

describe('ConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    mockFetchConfigDocs.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ConfigPanel />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error state', async () => {
    mockFetchConfigDocs.mockRejectedValue(new Error('fail'));
    render(<ConfigPanel />);
    expect(await screen.findByText('No se pudo cargar la configuración.')).toBeInTheDocument();
  });

  it('renders config docs as accordions', async () => {
    mockFetchConfigDocs.mockResolvedValue([
      { id: 'counters', data: { users: 100, comments: 50 } },
      { id: 'moderation', data: { bannedWords: ['spam'] } },
      { id: 'appVersion', data: { current: '2.0.0' } },
    ]);

    render(<ConfigPanel />);

    expect(await screen.findByText('counters')).toBeInTheDocument();
    expect(screen.getByText('moderation')).toBeInTheDocument();
    expect(screen.getByText('appVersion')).toBeInTheDocument();
  });

  it('renders ModerationEditor in moderation accordion', async () => {
    mockFetchConfigDocs.mockResolvedValue([
      { id: 'moderation', data: { bannedWords: ['bad', 'word'] } },
    ]);

    render(<ConfigPanel />);

    expect(await screen.findByText('Palabras baneadas')).toBeInTheDocument();
    // Words appear twice: once in ConfigDocViewer and once as Chips in ModerationEditor
    expect(screen.getAllByText('bad').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('word').length).toBeGreaterThanOrEqual(1);
  });

  it('renders ActivityFeedDiag section', async () => {
    mockFetchConfigDocs.mockResolvedValue([]);
    render(<ConfigPanel />);

    expect(await screen.findByText('Diagnóstico de Activity Feed')).toBeInTheDocument();
  });
});
