import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: vi.fn().mockReturnValue('SERVER_TS') },
}));

import { logAbuse } from '../../utils/abuseLogger';

function mockDb() {
  const add = vi.fn().mockResolvedValue({ id: 'log1' });
  return {
    collection: vi.fn().mockReturnValue({ add }),
    _add: add,
  };
}

describe('logAbuse', () => {
  it('writes to abuseLogs collection', async () => {
    const db = mockDb();
    await logAbuse(db as never, {
      userId: 'u1',
      type: 'rate_limit',
      collection: 'comments',
      detail: 'exceeded limit',
    });
    expect(db.collection).toHaveBeenCalledWith('abuseLogs');
    expect(db._add).toHaveBeenCalled();
  });

  it('maps rate_limit to low severity', async () => {
    const db = mockDb();
    await logAbuse(db as never, {
      userId: 'u1',
      type: 'rate_limit',
      collection: 'comments',
      detail: 'test',
    });
    expect(db._add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'low' }),
    );
  });

  it('maps flagged to high severity', async () => {
    const db = mockDb();
    await logAbuse(db as never, {
      userId: 'u1',
      type: 'flagged',
      collection: 'comments',
      detail: 'bad content',
    });
    expect(db._add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'high' }),
    );
  });

  it('maps top_writers to medium severity', async () => {
    const db = mockDb();
    await logAbuse(db as never, {
      userId: 'u1',
      type: 'top_writers',
      collection: 'comments',
      detail: 'many writes',
    });
    expect(db._add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'medium' }),
    );
  });

  it('maps deletion_failure to high severity', async () => {
    const db = mockDb();
    await logAbuse(db as never, {
      userId: 'u1',
      type: 'deletion_failure',
      detail: 'partial failure in deletion',
    });
    expect(db._add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'high' }),
    );
  });

  it('includes all entry fields and timestamp', async () => {
    const db = mockDb();
    await logAbuse(db as never, {
      userId: 'u1',
      type: 'rate_limit',
      collection: 'feedback',
      detail: 'test detail',
    });
    expect(db._add).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        type: 'rate_limit',
        collection: 'feedback',
        detail: 'test detail',
        timestamp: 'SERVER_TS',
      }),
    );
  });
});
