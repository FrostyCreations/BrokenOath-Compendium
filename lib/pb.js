// Planner builds: builds players upload from the planner to share (guides, levelling plans, theorycrafts). Not the ladder.
// A planner build is a short link (s:<sid>, made by /api/s) plus a title, a tag and a few lines about it.
// Uploading needs Discord sign-in (api/auth): the creator is the signed-in Discord user, so names can't be faked.
// Storage (Upstash Redis): hash 'pbuilds' id -> entry, hash 'pbstars' id -> star count, set pbstar:<id> -> hashed voter keys.
import { cmd, pipe, pairs, json } from './_db.js';
import { createHash, randomBytes } from 'node:crypto';
import { readSession, enabled, avatarUrl } from './_session.js';
import { isBlocked } from './_block.js';

const SID = /^[a-z0-9]{8}$/;
const ID = /^[a-f0-9]{12}$/;
const SECRET = /^[a-f0-9]{32,128}$/;
const t = (v, n) => String(v ?? '').replace(/[<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
const TAGS = ['Guide', 'Levelling', 'Endgame', 'Bossing', 'Mapping', 'Budget', 'Theorycraft', 'Other'];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      // the list page gets the 300 most starred plus the 100 newest; ?creator=<discord id> gets all of one creator's builds.
      // Cached at Vercel's edge for 10 s, so the database is read at most once per 10 s however many people open the planner.
      const [bs, st] = await pipe([['HGETALL', 'pbuilds'], ['HGETALL', 'pbstars']]); const stars = pairs(st);
      let items = Object.values(pairs(bs)).map(json).filter(Boolean).map(b => ({ ...b, stars: Math.max(0, +stars[b.id] || 0) }));
      const total = items.length, cr = String(req.query.creator || '');
      if (/^\d{5,25}$/.test(cr)) items = items.filter(b => b.uid === cr);
      else { const top = [...items].sort((a, b) => (b.stars - a.stars) || (b.up || b.at || '').localeCompare(a.up || a.at || '')).slice(0, 300);
        const fresh = [...items].sort((a, b) => (b.up || b.at || '').localeCompare(a.up || a.at || '')).slice(0, 100);
        const seen = new Set(); items = [...top, ...fresh].filter(b => !seen.has(b.id) && seen.add(b.id)); }
      res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=50');
      return res.status(200).json({ builds: items, total });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (req.method === 'POST' && req.query.star) {
      // star or unstar: one star per browser (its voter key, stored only as a hash)
      const id = String(req.query.star); if (!ID.test(id)) return res.status(400).json({ error: 'Bad id.' });
      if (!SECRET.test(String(body.voter || ''))) return res.status(400).json({ error: 'Missing voter key.' });
      if (!(await cmd('HEXISTS', 'pbuilds', id))) return res.status(404).json({ error: 'Not found.' });
      const v = createHash('sha256').update('broked-pbstar:' + body.voter).digest('hex').slice(0, 24); const on = body.on !== false;
      const changed = await cmd(on ? 'SADD' : 'SREM', `pbstar:${id}`, v);
      const stars = changed ? await cmd('HINCRBY', 'pbstars', id, on ? 1 : -1) : +(await cmd('HGET', 'pbstars', id)) || 0;
      return res.status(200).json({ stars: Math.max(0, stars), on });
    }
    if (req.method === 'POST') {
      if (!enabled()) return res.status(503).json({ error: 'Discord sign-in is not set up yet.' });
      const me = readSession(req); if (!me) return res.status(401).json({ error: 'Sign in with Discord to upload.' });
      if (await isBlocked(me.uid)) return res.status(403).json({ error: 'This account is blocked from uploading.' });
      const sid = String(body.sid || ''); if (!SID.test(sid)) return res.status(400).json({ error: 'Make the share link first.' });
      const title = t(body.title, 50); if (!title) return res.status(400).json({ error: 'Give the build a title.' });
      const link = json(await cmd('GET', `s:${sid}`)); if (!link) return res.status(404).json({ error: 'That share link does not exist.' });
      // updating your own upload keeps its id and stars
      let id = String(body.id || ''), old = null;
      if (id) { if (!ID.test(id)) return res.status(400).json({ error: 'Bad id.' }); old = json(await cmd('HGET', 'pbuilds', id));
        if (!old || old.uid !== me.uid) return res.status(403).json({ error: 'Only the person who uploaded it can change it.' }); }
      else { if ((await cmd('HLEN', 'pbuilds')) >= 2000) return res.status(429).json({ error: 'The list is full for now.' }); id = randomBytes(6).toString('hex'); }
      const s = link.sum || {};
      const e = { id, sid, title, uid: me.uid, by: me.name, av: avatarUrl(me.uid, me.av), tag: TAGS.includes(body.tag) ? body.tag : 'Other', desc: t(body.desc, 300),
        c: s.c || '', l: s.l || 0, sk: s.sk || '', skn: s.skn || '', vs: s.vs || 0, pts: s.pts || 0, uq: s.uq || [], gb: s.gb || 0, sets: Math.max(1, Math.min(8, +body.sets || 1)),
        at: old ? old.at : new Date().toISOString(), up: new Date().toISOString() };
      await cmd('HSET', 'pbuilds', id, JSON.stringify(e));
      return res.status(200).json({ id, updated: !!old });
    }
    if (req.method === 'DELETE') {
      const id = String(req.query.id || ''); if (!ID.test(id)) return res.status(400).json({ error: 'Bad id.' });
      const e = json(await cmd('HGET', 'pbuilds', id)); if (!e) return res.status(404).json({ error: 'Not found.' });
      const me0 = readSession(req), admin = String(req.headers['x-admin-key'] || ''), me = me0 && !(await isBlocked(me0.uid)) ? me0 : null;
      if (!((me && e.uid === me.uid) || (admin && process.env.ADMIN_KEY && admin === process.env.ADMIN_KEY))) return res.status(403).json({ error: 'Only the person who uploaded it can remove it.' });
      await pipe([['HDEL', 'pbuilds', id], ['HDEL', 'pbstars', id], ['DEL', `pbstar:${id}`]]); return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE'); return res.status(405).json({ error: 'Use GET, POST or DELETE.' });
  } catch (e) { return res.status(500).json({ error: 'Something went wrong.' }); }
}
