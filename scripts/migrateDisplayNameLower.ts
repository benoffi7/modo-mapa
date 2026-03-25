/**
 * One-off migration: adds `displayNameLower` and `followersCount`/`followingCount`
 * to all existing user docs in the `users` collection.
 *
 * Run with: npx ts-node scripts/migrateDisplayNameLower.ts
 * Or via Firebase Admin SDK in production.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS env var)
initializeApp();
const db = getFirestore();

async function migrate() {
  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} users to migrate`);

  let updated = 0;
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const displayName = data.displayName as string | undefined;

    if (!displayName) continue;

    const updates: Record<string, unknown> = {};

    if (!data.displayNameLower) {
      updates.displayNameLower = displayName.toLowerCase();
    }
    if (data.followersCount === undefined) {
      updates.followersCount = 0;
    }
    if (data.followingCount === undefined) {
      updates.followingCount = 0;
    }

    if (Object.keys(updates).length > 0) {
      batch.update(userDoc.ref, updates);
      updated++;
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`Committed batch of ${batchCount} updates`);
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`Migration complete. Updated ${updated} of ${usersSnap.size} users.`);
}

migrate().catch(console.error);
