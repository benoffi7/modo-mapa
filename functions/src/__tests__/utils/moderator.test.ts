import { describe, it, expect, beforeEach } from 'vitest';
import { checkModeration, resetModerationCache } from '../../utils/moderator';

function mockDb(bannedWords: string[]) {
  return {
    doc: () => ({
      get: async () => ({
        data: () => ({ bannedWords }),
      }),
    }),
  } as never;
}

describe('checkModeration', () => {
  beforeEach(() => {
    resetModerationCache();
  });

  it('returns false for clean text', async () => {
    const db = mockDb(['mala', 'insulto']);
    const result = await checkModeration(db, 'Este es un buen lugar');
    expect(result).toBe(false);
  });

  it('returns true for text with banned word', async () => {
    const db = mockDb(['mala', 'insulto']);
    const result = await checkModeration(db, 'Este lugar es mala');
    expect(result).toBe(true);
  });

  it('detects banned words with accents (normalization)', async () => {
    const db = mockDb(['mierda']);
    const result = await checkModeration(db, 'Qué miérdá de lugar');
    expect(result).toBe(true);
  });

  it('does not match partial words (word boundary)', async () => {
    const db = mockDb(['mal']);
    const result = await checkModeration(db, 'El animal es lindo');
    expect(result).toBe(false);
  });

  it('returns false when no banned words configured', async () => {
    const db = mockDb([]);
    const result = await checkModeration(db, 'Cualquier texto');
    expect(result).toBe(false);
  });

  it('is case insensitive', async () => {
    const db = mockDb(['malo']);
    const result = await checkModeration(db, 'Este lugar es MALO');
    expect(result).toBe(true);
  });
});
