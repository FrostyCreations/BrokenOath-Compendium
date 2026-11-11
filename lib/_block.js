// Blocked Discord accounts: they can't sign in, upload, edit or star Build Guides.
// Add a Discord username (lowercase, the @handle not the display name) or a numeric user ID below and redeploy.
// When a blocked username signs in, its permanent user ID is saved in the "blocked_ids" set, so changing the username later doesn't get around it.
import { cmd } from './_db.js';

const BLOCKED_NAMES = new Set(['1stcata']);   // blocked 10 Nov 2026 (spam bot ads in Discord DMs)
const BLOCKED_IDS = new Set([]);

export async function isBlocked(uid, username) {
  uid = String(uid || ''); const name = String(username || '').toLowerCase();
  if (!uid && !name) return false;
  if (BLOCKED_IDS.has(uid)) return true;
  if (name && BLOCKED_NAMES.has(name)) { if (uid) await cmd('SADD', 'blocked_ids', uid).catch(() => {}); return true; }
  if (uid) { const r = await cmd('SISMEMBER', 'blocked_ids', uid).catch(() => 0); return Number(r && r.result !== undefined ? r.result : r) === 1; }
  return false;
}
