/**
 * Admin services — rate limits inspector wrappers (#327).
 *
 * Thin wrappers around the `adminListRateLimits` and `adminResetRateLimit`
 * Firebase callables. The callables already enforce admin auth, App Check,
 * per-admin rate limit, input validation and abuse log auditing — these
 * services do nothing more than expose typed entry points to consumers.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import type { AdminRateLimitItem } from '../../types/admin';

interface ListAdminRateLimitsRequest {
  userId?: string;
  limit?: number;
}

interface ListAdminRateLimitsResponse {
  items: AdminRateLimitItem[];
}

interface ResetAdminRateLimitRequest {
  docId: string;
}

interface SuccessResponse {
  success: true;
}

/** List active `_rateLimits` docs for admin inspection. Admin-only. */
export async function listAdminRateLimits(
  params: ListAdminRateLimitsRequest = {},
): Promise<AdminRateLimitItem[]> {
  const fn = httpsCallable<ListAdminRateLimitsRequest, ListAdminRateLimitsResponse>(
    functions,
    'adminListRateLimits',
  );
  const request: ListAdminRateLimitsRequest = {};
  if (params.userId !== undefined) request.userId = params.userId;
  if (params.limit !== undefined) request.limit = params.limit;
  const result = await fn(request);
  return result.data.items;
}

/** Reset (delete) a `_rateLimits` doc by `docId`. Admin-only. */
export async function resetAdminRateLimit(docId: string): Promise<void> {
  const fn = httpsCallable<ResetAdminRateLimitRequest, SuccessResponse>(
    functions,
    'adminResetRateLimit',
  );
  await fn({ docId });
}
