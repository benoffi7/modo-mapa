import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getAuth } from 'firebase-admin/auth';
import type { UserRecord } from 'firebase-admin/auth';
import { captureException } from '../utils/sentry';
import { assertAdmin } from '../helpers/assertAdmin';

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

// ── Types ─────────────────────────────────────────────────────────────

interface AuthUserInfo {
  uid: string;
  displayName: string | null;
  authMethod: 'anonymous' | 'email';
  emailVerified: boolean;
  createdAt: string;
}

interface AuthStatsResponse {
  byMethod: { anonymous: number; email: number };
  emailVerification: { verified: number; unverified: number };
  users: AuthUserInfo[];
}

// ── Helpers ───────────────────────────────────────────────────────────

function classifyUser(user: UserRecord): 'anonymous' | 'email' {
  const providers = user.providerData.map((p) => p.providerId);
  if (providers.includes('password')) return 'email';
  return 'anonymous';
}

// ── Cloud Function ────────────────────────────────────────────────────

export const getAuthStats = onCall(
  { enforceAppCheck: !IS_EMULATOR },
  async (request: CallableRequest): Promise<AuthStatsResponse> => {
    assertAdmin(request.auth);

    const byMethod = { anonymous: 0, email: 0 };
    const emailVerification = { verified: 0, unverified: 0 };
    const users: AuthUserInfo[] = [];

    try {
      let nextPageToken: string | undefined;

      do {
        const listResult = await getAuth().listUsers(1000, nextPageToken);

        for (const user of listResult.users) {
          // Exclude admin from user stats
          if (user.customClaims?.admin === true) continue;

          const authMethod = classifyUser(user);
          byMethod[authMethod]++;

          if (authMethod === 'email') {
            if (user.emailVerified) {
              emailVerification.verified++;
            } else {
              emailVerification.unverified++;
            }
          }

          users.push({
            uid: user.uid,
            displayName: user.displayName ?? null,
            authMethod,
            emailVerified: user.emailVerified,
            createdAt: user.metadata.creationTime ?? new Date().toISOString(),
          });
        }

        nextPageToken = listResult.pageToken;
      } while (nextPageToken);
    } catch (err) {
      captureException(err);
      logger.error('Error fetching auth stats', { error: String(err) });
      throw new HttpsError('internal', 'Error obteniendo estadísticas de autenticación');
    }

    return { byMethod, emailVerification, users };
  },
);
