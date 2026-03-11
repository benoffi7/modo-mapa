import type { Firestore } from 'firebase-admin/firestore';

let cachedWords: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getBannedWords(db: Firestore): Promise<string[]> {
  const now = Date.now();
  if (cachedWords && now - cacheTimestamp < CACHE_TTL) {
    return cachedWords;
  }
  const doc = await db.doc('config/moderation').get();
  cachedWords = (doc.data()?.bannedWords as string[] | undefined) ?? [];
  cacheTimestamp = now;
  return cachedWords;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if text contains banned words.
 * Returns true if the text should be flagged.
 */
export async function checkModeration(
  db: Firestore,
  text: string,
): Promise<boolean> {
  const words = await getBannedWords(db);
  if (words.length === 0) return false;

  const normalized = normalize(text);
  return words.some((word) => {
    const pattern = new RegExp(`\\b${escapeRegex(normalize(word))}\\b`);
    return pattern.test(normalized);
  });
}

/** Reset cache — useful for testing. */
export function resetModerationCache(): void {
  cachedWords = null;
  cacheTimestamp = 0;
}
