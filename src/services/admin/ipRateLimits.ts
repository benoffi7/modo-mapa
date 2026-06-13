/**
 * Admin services — IP rate limits inspector wrappers (#348).
 *
 * Thin wrappers around the `adminListIpRateLimits` and `adminResetIpRateLimit`
 * Firebase callables. The callables already enforce admin auth, App Check,
 * per-admin rate limit, input validation and abuse log auditing — these
 * services do nothing more than expose typed entry points to consumers.
 *
 * Privacy: the payload only ever carries `ipHash` (16-hex SHA-256), never a
 * raw IP — the `_ipRateLimits` collection never stores raw IPs.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import type { AdminIpRateLimitItem } from '../../types/admin';

interface ListAdminIpRateLimitsRequest {
  action?: string;
  ipHash?: string;
  limit?: number;
}

interface ListAdminIpRateLimitsResponse {
  items: AdminIpRateLimitItem[];
}

interface ResetAdminIpRateLimitRequest {
  docId: string;
}

interface SuccessResponse {
  success: true;
}

/** List `_ipRateLimits` docs for admin inspection. Admin-only. */
export async function listAdminIpRateLimits(
  params: ListAdminIpRateLimitsRequest = {},
): Promise<AdminIpRateLimitItem[]> {
  const fn = httpsCallable<ListAdminIpRateLimitsRequest, ListAdminIpRateLimitsResponse>(
    functions,
    'adminListIpRateLimits',
  );
  const request: ListAdminIpRateLimitsRequest = {};
  if (params.action !== undefined) request.action = params.action;
  if (params.ipHash !== undefined) request.ipHash = params.ipHash;
  if (params.limit !== undefined) request.limit = params.limit;
  const result = await fn(request);
  return result.data.items;
}

/** Reset (delete) an `_ipRateLimits` doc by `docId`. Admin-only. */
export async function resetAdminIpRateLimit(docId: string): Promise<void> {
  const fn = httpsCallable<ResetAdminIpRateLimitRequest, SuccessResponse>(
    functions,
    'adminResetIpRateLimit',
  );
  await fn({ docId });
}
