import { describe, it, expect, vi } from 'vitest';
import { incrementCounter, trackWrite, trackDelete } from '../../utils/counters';

function mockDb() {
  const set = vi.fn().mockResolvedValue(undefined);
  return {
    doc: vi.fn().mockReturnValue({ set }),
    _set: set,
  };
}

describe('incrementCounter', () => {
  it('calls set with merge and FieldValue.increment', async () => {
    const db = mockDb();
    await incrementCounter(db as never, 'comments', 1);

    expect(db.doc).toHaveBeenCalledWith('config/counters');
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ comments: expect.anything() }),
      { merge: true },
    );
  });
});

describe('trackWrite', () => {
  it('increments dailyWrites and writesByCollection', async () => {
    const db = mockDb();
    await trackWrite(db as never, 'comments');

    expect(db.doc).toHaveBeenCalledWith('config/counters');
    expect(db.doc).toHaveBeenCalledWith(expect.stringContaining('dailyMetrics/'));
    expect(db._set).toHaveBeenCalledTimes(2);
  });
});

describe('trackDelete', () => {
  it('increments dailyDeletes and deletesByCollection', async () => {
    const db = mockDb();
    await trackDelete(db as never, 'comments');

    expect(db.doc).toHaveBeenCalledWith('config/counters');
    expect(db.doc).toHaveBeenCalledWith(expect.stringContaining('dailyMetrics/'));
    expect(db._set).toHaveBeenCalledTimes(2);
  });
});
