import fs from 'fs';
import path from 'path';
import { USER_OWNED_COLLECTIONS } from './userOwnedCollections';
import { COLLECTIONS } from '../src/config/collections';

const SERVICES_DIR = path.resolve(__dirname, '../src/services');

/** Map from COLLECTIONS key (e.g. CHECKINS) to value (e.g. 'checkins') */
const COLLECTIONS_MAP: Record<string, string> = COLLECTIONS;

/** Scan all service files for where('fieldName', patterns and extract collection+field pairs */
function discoverUserFieldUsages(): Array<{ file: string; collection: string; field: string }> {
  const serviceFiles = fs.readdirSync(SERVICES_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const results: Array<{ file: string; collection: string; field: string }> = [];

  const userFields = ['userId', 'ownerId', 'followerId', 'followedId', 'fromUserId', 'toUserId', 'addedBy'];
  const wherePattern = new RegExp(`where\\(['"](${ userFields.join('|') })['"]`, 'g');

  for (const file of serviceFiles) {
    const content = fs.readFileSync(path.join(SERVICES_DIR, file), 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = wherePattern.exec(content)) !== null) {
      const field = match[1]!;
      // Look backwards from match position for collection name
      const before = content.slice(0, match.index);

      // Match COLLECTIONS.KEY pattern - find the nearest one before this where()
      const collectionKeyMatches = [...before.matchAll(/COLLECTIONS\.([A-Z_]+)/g)];
      // Also match literal collection('name') patterns
      const literalMatches = [...before.matchAll(/collection\([^,)]*,\s*['"]([a-zA-Z_]+)['"]\)/g)];

      let collectionName: string | null = null;

      // Find the last COLLECTIONS.X or literal collection reference
      const allMatches = [
        ...collectionKeyMatches.map((m) => ({ index: m.index!, type: 'key' as const, value: m[1]! })),
        ...literalMatches.map((m) => ({ index: m.index!, type: 'literal' as const, value: m[1]! })),
      ].sort((a, b) => a.index - b.index);

      if (allMatches.length > 0) {
        const last = allMatches[allMatches.length - 1]!;
        if (last.type === 'key') {
          // Resolve COLLECTIONS.KEY to its string value
          collectionName = COLLECTIONS_MAP[last.value] ?? null;
        } else {
          collectionName = last.value;
        }
      }

      if (collectionName) {
        // Avoid duplicate entries from same file
        if (!results.some((r) => r.collection === collectionName && r.field === field && r.file === file)) {
          results.push({ file, collection: collectionName, field });
        }
      }
    }
  }
  return results;
}

/** Collections that are read-only lookups, not user-owned data requiring deletion */
const READ_ONLY_LOOKUPS: Set<string> = new Set([
  // userRankings are computed aggregates, rebuilt from other data
  'userRankings',
]);

describe('USER_OWNED_COLLECTIONS registry', () => {
  it('covers all user-field queries found in service files', () => {
    const usages = discoverUserFieldUsages();
    const registryLookup = new Set(
      USER_OWNED_COLLECTIONS.flatMap((entry) => {
        const keys = [`${entry.collection}:${entry.field ?? ''}`];
        if (entry.biField) keys.push(`${entry.collection}:${entry.biField}`);
        // doc-by-uid entries cover userId queries on that collection too
        if (entry.type === 'doc-by-uid') keys.push(`${entry.collection}:userId`);
        return keys;
      }),
    );

    const missing: string[] = [];
    for (const usage of usages) {
      if (READ_ONLY_LOOKUPS.has(usage.collection)) continue;
      const key = `${usage.collection}:${usage.field}`;
      if (!registryLookup.has(key)) {
        missing.push(`${usage.file}: ${usage.collection} (field: ${usage.field})`);
      }
    }

    expect(missing, `Collections with user queries not in USER_OWNED_COLLECTIONS:\n${missing.join('\n')}`).toEqual([]);
  });

  it('has no duplicate entries', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const entry of USER_OWNED_COLLECTIONS) {
      const key = `${entry.collection}:${entry.type}:${entry.field ?? ''}:${entry.biField ?? ''}`;
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it('all entries have valid type values', () => {
    const validTypes = new Set(['doc-by-uid', 'query', 'subcollection']);
    for (const entry of USER_OWNED_COLLECTIONS) {
      expect(validTypes.has(entry.type), `Invalid type "${entry.type}" for ${entry.collection}`).toBe(true);
    }
  });

  it('query-type entries have a field property', () => {
    const queryEntries = USER_OWNED_COLLECTIONS.filter((e) => e.type === 'query');
    for (const entry of queryEntries) {
      expect(entry.field, `query entry "${entry.collection}" missing field`).toBeTruthy();
    }
  });

  it('subcollection-type entries have a path property', () => {
    const subEntries = USER_OWNED_COLLECTIONS.filter((e) => e.type === 'subcollection');
    for (const entry of subEntries) {
      expect(entry.path, `subcollection entry "${entry.collection}" missing path`).toBeTruthy();
      expect(entry.path).toContain('{uid}');
    }
  });

  it('doc-by-uid entries do not have field or path', () => {
    const docEntries = USER_OWNED_COLLECTIONS.filter((e) => e.type === 'doc-by-uid');
    for (const entry of docEntries) {
      expect(entry.field, `doc-by-uid "${entry.collection}" should not have field`).toBeUndefined();
      expect(entry.path, `doc-by-uid "${entry.collection}" should not have path`).toBeUndefined();
    }
  });

  it('contains at least the known core collections', () => {
    const collections = USER_OWNED_COLLECTIONS.map((e) => e.collection);
    expect(collections).toContain('ratings');
    expect(collections).toContain('comments');
    expect(collections).toContain('favorites');
    expect(collections).toContain('follows');
    expect(collections).toContain('sharedLists');
    expect(collections).toContain('users');
    expect(collections).toContain('userSettings');
  });
});
