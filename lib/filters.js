// Shared loot filters: GET the list, POST one (name, who made it, which build it suits, the BOFILTER code), DELETE your own with its owner key.
// Storage (Upstash Redis): hash 'filters' id -> filter, hash 'fstars' id -> star count, set fstar:<id> -> hashed voter keys.
import { cmd, pipe, pairs, json } from './_db.js';
import { createHash, randomBytes } from 'node:crypto';

const CODE = /^BOFILTER:1,-?\d{1,3}(\|\d{1,3}(,\d{1,3}){6,9}){1,40}$/;
const SECRET = /^[a-f0-9]{32,128}$/;
const ID = /^[a-f0-9]{12}$/;
const t = (v, n) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const oh = s => createHash('sha256').update('broked-filter:' + s).digest('hex');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const [fs, st] = await pipe([['HGETALL', 'filters'], ['HGETALL', 'fstars']]); const stars = pairs(st);
      const items = Object.values(pairs(fs)).map(json).filter(Boolean)
        .map(({ oh: _, sv, ...f }) => ({ ...f, stars: Math.max(0, +stars[f.id] || 0) })).sort((a, b) => (b.stars - a.stars) || (b.at || '').localeCompare(a.at || ''));
      return res.status(200).json({ filters: items });
    }
    if (req.method === 'POST' && req.query.star) {
      // star or unstar: one star per browser (its voter key, stored only as a hash)
      const id = String(req.query.star); if (!ID.test(id)) return res.status(400).json({ error: 'Bad id.' });
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (!SECRET.test(String(b.voter || ''))) return res.status(400).json({ error: 'Missing voter key.' });
      if (!(await cmd('HEXISTS', 'filters', id))) return res.status(404).json({ error: 'Not found.' });
      const v = createHash('sha256').update('broked-star:' + b.voter).digest('hex').slice(0, 24); const on = b.on !== false;
      const changed = await cmd(on ? 'SADD' : 'SREM', `fstar:${id}`, v);
      const stars = changed ? await cmd('HINCRBY', 'fstars', id, on ? 1 : -1) : +(await cmd('HGET', 'fstars', id)) || 0;
      return res.status(200).json({ stars: Math.max(0, stars), on });
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const code = String(b.code || '').trim();
      if (!CODE.test(code)) return res.status(400).json({ error: 'That is not a Broken Oath loot filter.' });
      if (!SECRET.test(String(b.secret || ''))) return res.status(400).json({ error: 'Missing owner key.' });
      const name = t(b.name, 40); if (!name) return res.status(400).json({ error: 'Give the filter a name.' });
      if ((await cmd('HLEN', 'filters')) >= 500) return res.status(429).json({ error: 'The shared list is full for now.' });
      const id = randomBytes(6).toString('hex');
      const f = { id, name, by: t(b.by, 24) || 'Anonymous', tag: t(b.tag, 40), note: t(b.note, 200), code, rules: code.split('|').length - 1, at: new Date().toISOString(), oh: oh(b.secret) };
      await cmd('HSET', 'filters', id, JSON.stringify(f));
      return res.status(200).json({ id });
    }
    if (req.method === 'DELETE') {
      const id = String(req.query.id || ''); if (!ID.test(id)) return res.status(400).json({ error: 'Bad id.' });
      const f = json(await cmd('HGET', 'filters', id)); if (!f) return res.status(404).json({ error: 'Not found.' });
      const key = String(req.headers['x-owner-key'] || ''), admin = String(req.headers['x-admin-key'] || '');
      if (!((key && f.oh === oh(key)) || (admin && process.env.ADMIN_KEY && admin === process.env.ADMIN_KEY))) return res.status(403).json({ error: 'Only the person who shared it can remove it.' });
      await pipe([['HDEL', 'filters', id], ['HDEL', 'fstars', id], ['DEL', `fstar:${id}`]]); return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE'); return res.status(405).json({ error: 'Use GET, POST or DELETE.' });
  } catch (e) { return res.status(500).json({ error: 'Something went wrong.' }); }
}
