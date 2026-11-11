// Sign-in sessions for "Sign in with Discord": a signed cookie, nothing stored per session on the server.
// The cookie holds the Discord user id, display name and avatar hash, signed with a key made from DISCORD_CLIENT_SECRET
// (or SESSION_SECRET when it is set), so it can't be forged or edited.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'bo_s';
const DAYS = 30;
export const enabled = () => !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
const key = () => createHmac('sha256', process.env.SESSION_SECRET || process.env.DISCORD_CLIENT_SECRET || '').update('broked-session-v1').digest();
const b64u = b => Buffer.from(b).toString('base64url');
const sign = s => createHmac('sha256', key()).update(s).digest('base64url');

export function cookies(req) { const o = {}; for (const p of String(req.headers.cookie || '').split(';')) { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } return o; }
export function makeSession(u) { const body = b64u(JSON.stringify({ uid: u.uid, name: u.name, av: u.av || '', exp: Date.now() + DAYS * 864e5 })); return body + '.' + sign(body); }
export function readSession(req) {
  if (!enabled()) return null;
  const v = cookies(req)[COOKIE]; if (!v) return null; const [body, sig] = v.split('.'); if (!body || !sig) return null;
  const want = Buffer.from(sign(body)), got = Buffer.from(sig); if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try { const s = JSON.parse(Buffer.from(body, 'base64url').toString()); if (!s.uid || !(s.exp > Date.now())) return null; return s; } catch { return null; }
}
export const setCookie = (res, name, val, maxAge) => res.setHeader('Set-Cookie', [].concat(res.getHeader('Set-Cookie') || [], `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`));
export const sessionCookie = (res, s) => setCookie(res, COOKIE, s, DAYS * 86400);
export const clearCookie = (res, name = COOKIE) => setCookie(res, name, '', 0);
export const avatarUrl = (uid, av) => av ? `https://cdn.discordapp.com/avatars/${uid}/${av}.png?size=64` : '';
