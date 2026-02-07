import { QueryCtx, MutationCtx } from '../_generated/server';
import { getFamily } from './auth';
import { ADMIN_EMAILS } from './constants';

/**
 * Check if the current user is an admin by looking up their family record.
 * Works with both QueryCtx and MutationCtx.
 */
export async function checkIsAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const family = await getFamily(ctx);
  if (!family) return false;
  return ADMIN_EMAILS.includes(family.email);
}
