// Sign in with Discord, used only to upload planner builds (builds made without a save file).
//   /api/auth?a=login&ret=/planner.html   -> off to Discord (scope "identify": id, name and avatar, never email)
//   /api/auth/callback                     -> back from Discord, sets the session cookie, returns to ret
//   /api/auth?a=me                         -> { enabled, user }
//   POST /api/auth?a=logout                -> signs out
//   DELETE /api/auth?a=me                  -> removes every planner build you uploaded and signs you out
// Needs DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in the Vercel project's environment variables.
import { randomBytes } from 'node:crypto';
import { cmd, pipe, pairs, json } from './_db.js';
import { isBlocked } from './_block.js';
import { enabled, readSession, makeSession, sessionCookie, clearCookie, setCookie, cookies, avatarUrl } from './_session.js';

const origin = req => 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
const redirectUri = req => origin(req) + '/api/auth/callback';
const safeRet = r => { r = String(r || ''); return /^\/(?!\/)[\w\-./?=&#%]*$/.test(r) ? r.slice(0, 2000) : '/planner.html'; };
const go = (res, to) => { res.statusCode = 302; res.setHeader('Location', to); res.end(); };
const back = (req, res, ret, msg) => go(res, ret.split('#')[0] + (ret.includes('?') ? '&' : '?') + 'signin=' + msg + (ret.includes('#') ? '#' + ret.split('#').slice(1).join('#') : ''));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const a = String(req.query.a || (req.url.includes('/callback') ? 'cb' : ''));
  try {
    if (a === 'me' && req.method === 'GET') { let s = readSession(req); if (s && await isBlocked(s.uid)) { clearCookie(res); s = null; } return res.status(200).json({ enabled: enabled(), user: s ? { uid: s.uid, name: s.name, avatar: avatarUrl(s.uid, s.av) } : null }); }
    if (!enabled()) return res.status(503).json({ error: 'Discord sign-in is not set up yet.' });
    if (a === 'login') {
      const state = randomBytes(16).toString('hex'), ret = safeRet(req.query.ret);
      setCookie(res, 'bo_st', state + '|' + ret, 600);
      const q = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, response_type: 'code', scope: 'identify', redirect_uri: redirectUri(req), state, prompt: 'none' });
      return go(res, 'https://discord.com/oauth2/authorize?' + q);
    }
    if (a === 'cb') {
      const st = cookies(req).bo_st || ''; const [state, ...r] = st.split('|'); const ret = safeRet(r.join('|')); clearCookie(res, 'bo_st');
      if (req.query.error) return back(req, res, ret, 'cancelled');
      if (!state || state !== String(req.query.state || '')) return back(req, res, ret, 'failed');
      const tk = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code: String(req.query.code || ''), redirect_uri: redirectUri(req) }) });
      const t = await tk.json().catch(() => ({})); if (!tk.ok || !t.access_token) return back(req, res, ret, 'failed');
      const me = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${t.access_token}` } });
      const u = await me.json().catch(() => ({})); if (!me.ok || !u.id) return back(req, res, ret, 'failed');
      if (await isBlocked(u.id, u.username)) return back(req, res, ret, 'blocked');
      const name = String(u.global_name || u.username || 'Discord user').replace(/[<>]/g, '').slice(0, 32);
      sessionCookie(res, makeSession({ uid: String(u.id), name, av: /^(a_)?[a-f0-9]{32}$/.test(u.avatar || '') ? u.avatar : '' }));
      return back(req, res, ret, 'ok');
    }
    if (a === 'logout' && req.method === 'POST') { clearCookie(res); return res.status(200).json({ ok: true }); }
    if (a === 'me' && req.method === 'DELETE') {
      const s = readSession(req); if (!s) return res.status(401).json({ error: 'Sign in first.' });
      const mine = Object.values(pairs(await cmd('HGETALL', 'pbuilds'))).map(json).filter(b => b && b.uid === s.uid);
      if (mine.length) await pipe(mine.flatMap(b => [['HDEL', 'pbuilds', b.id], ['HDEL', 'pbstars', b.id], ['DEL', `pbstar:${b.id}`]]));
      clearCookie(res); return res.status(200).json({ ok: true, removed: mine.length });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e) { return res.status(500).json({ error: 'Sign-in went wrong. Try again.' }); }
}
