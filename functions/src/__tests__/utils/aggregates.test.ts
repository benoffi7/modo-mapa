import { describe, it, expect, vi } from 'vitest';

const mockIncrement = vi.hoisted(() => vi.fn((n: number) => ({ __increment: n })));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: mockIncrement },
}));

import { incrementBusinessCount, updateRatingAggregates, incrementTagCount } from '../../utils/aggregates';

function mockDb() {
  const set = vi.fn().mockResolvedValue(undefined);
  return {
    doc: vi.fn().mockReturnValue({ set }),
    _set: set,
  };
}

describe('incrementBusinessCount', () => {
  it('increments business favorites count', async () => {
    const db = mockDb();
    await incrementBusinessCount(db as never, 'businessFavorites', 'biz1', 1);
    expect(db.doc).toHaveBeenCalledWith('config/aggregates');
    expect(db._set).toHaveBeenCalledWith(
      { 'businessFavorites.biz1': expect.anything() },
      { merge: true },
    );
    expect(mockIncrement).toHaveBeenCalledWith(1);
  });

  it('decrements business comments count', async () => {
    const db = mockDb();
    await incrementBusinessCount(db as never, 'businessComments', 'biz2', -1);
    expect(db._set).toHaveBeenCalledWith(
      { 'businessComments.biz2': expect.anything() },
      { merge: true },
    );
    expect(mockIncrement).toHaveBeenCalledWith(-1);
  });
});

describe('updateRatingAggregates', () => {
  it('adds new rating — increments distribution, count, and sum', async () => {
    const db = mockDb();
    await updateRatingAggregates(db as never, 'biz1', 'add', 4);

    const setCall = db._set.mock.calls[0][0];
    expect(setCall).toHaveProperty('ratingDistribution.4');
    expect(setCall).toHaveProperty('businessRatingCount.biz1');
    expect(setCall).toHaveProperty('businessRatingSum.biz1');
  });

  it('updates rating — adjusts distribution and sum without changing count', async () => {
    const db = mockDb();
    await updateRatingAggregates(db as never, 'biz1', 'add', 5, 3);

    const setCall = db._set.mock.calls[0][0];
    // Increments new score distribution
    expect(setCall).toHaveProperty('ratingDistribution.5');
    // Decrements old score distribution
    expect(setCall).toHaveProperty('ratingDistribution.3');
    // Sum adjusted to delta (5-3=2)
    expect(setCall).toHaveProperty('businessRatingSum.biz1');
    // Count should NOT be incremented for updates
    expect(setCall).not.toHaveProperty('businessRatingCount.biz1');
  });

  it('removes rating — decrements distribution, count, and sum', async () => {
    const db = mockDb();
    await updateRatingAggregates(db as never, 'biz1', 'remove', 4);

    const setCall = db._set.mock.calls[0][0];
    expect(setCall).toHaveProperty('ratingDistribution.4');
    expect(setCall).toHaveProperty('businessRatingCount.biz1');
    expect(setCall).toHaveProperty('businessRatingSum.biz1');
    expect(mockIncrement).toHaveBeenCalledWith(-1); // distribution
    expect(mockIncrement).toHaveBeenCalledWith(-4); // sum
  });
});

describe('incrementTagCount', () => {
  it('increments tag count', async () => {
    const db = mockDb();
    await incrementTagCount(db as never, 'barato', 1);
    expect(db.doc).toHaveBeenCalledWith('config/aggregates');
    expect(db._set).toHaveBeenCalledWith(
      { 'tagCounts.barato': expect.anything() },
      { merge: true },
    );
  });
});
