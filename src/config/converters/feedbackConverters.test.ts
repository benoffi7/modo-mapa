import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/formatDate', () => ({
  toDate: vi.fn((v: unknown) => {
    if (v instanceof Date) return v;
    if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
    return new Date(0);
  }),
}));

import { feedbackConverter } from './index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockSnapshot(data: Record<string, unknown>, id = 'test-id'): any {
  return { data: () => data, id };
}

const NOW = new Date('2025-06-01T12:00:00Z');

// ---------------------------------------------------------------------------
// feedbackConverter
// ---------------------------------------------------------------------------
describe('feedbackConverter', () => {
  const baseData = { userId: 'u1', message: 'Bug found', category: 'bug', status: 'pending', createdAt: NOW };

  it('toFirestore serializes required fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = feedbackConverter.toFirestore({ id: 'f1', ...baseData } as any);
    expect(result).toEqual(baseData);
    expect(result).not.toHaveProperty('id');
  });

  it('fromFirestore applies defaults for missing optional fields', () => {
    const snap = mockSnapshot({}, 'f1');
    const result = feedbackConverter.fromFirestore(snap);
    expect(result.id).toBe('f1');
    expect(result.message).toBe('');
    expect(result.category).toBe('otro');
    expect(result.status).toBe('pending');
    expect(result).not.toHaveProperty('flagged');
    expect(result).not.toHaveProperty('adminResponse');
    expect(result).not.toHaveProperty('viewedByUser');
    expect(result).not.toHaveProperty('mediaUrl');
    expect(result).not.toHaveProperty('mediaType');
    expect(result).not.toHaveProperty('githubIssueUrl');
    expect(result).not.toHaveProperty('businessId');
    expect(result).not.toHaveProperty('businessName');
  });

  it('fromFirestore includes flagged only when true', () => {
    const snap = mockSnapshot({ ...baseData, flagged: true }, 'f1');
    expect(feedbackConverter.fromFirestore(snap).flagged).toBe(true);

    const snap2 = mockSnapshot({ ...baseData, flagged: false }, 'f1');
    expect(feedbackConverter.fromFirestore(snap2)).not.toHaveProperty('flagged');
  });

  it('fromFirestore includes admin response fields when present', () => {
    const snap = mockSnapshot({
      ...baseData,
      adminResponse: 'Fixed',
      respondedAt: NOW,
      respondedBy: 'admin1',
    }, 'f1');
    const result = feedbackConverter.fromFirestore(snap);
    expect(result.adminResponse).toBe('Fixed');
    expect(result.respondedAt).toEqual(NOW);
    expect(result.respondedBy).toBe('admin1');
  });

  it('fromFirestore includes viewedByUser only when true', () => {
    const snap = mockSnapshot({ ...baseData, viewedByUser: true }, 'f1');
    expect(feedbackConverter.fromFirestore(snap).viewedByUser).toBe(true);

    const snap2 = mockSnapshot({ ...baseData, viewedByUser: false }, 'f1');
    expect(feedbackConverter.fromFirestore(snap2)).not.toHaveProperty('viewedByUser');
  });

  it('fromFirestore includes media and github fields when present', () => {
    const snap = mockSnapshot({
      ...baseData,
      mediaUrl: 'https://example.com/img.png',
      mediaType: 'image',
      githubIssueUrl: 'https://github.com/issue/1',
      businessId: 'b1',
      businessName: 'Cafe',
    }, 'f1');
    const result = feedbackConverter.fromFirestore(snap);
    expect(result.mediaUrl).toBe('https://example.com/img.png');
    expect(result.mediaType).toBe('image');
    expect(result.githubIssueUrl).toBe('https://github.com/issue/1');
    expect(result.businessId).toBe('b1');
    expect(result.businessName).toBe('Cafe');
  });
});
