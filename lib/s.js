// Short share links for the Build Planner: POST a packed build (the same code a #b= link carries),
// get back a short id. GET ?id= returns the code. Stored in Upstash Redis as s:<id>, never listed on the ladder.
import { cmd, json } from './_db.js';
import { createHash } from 'node:crypto';

const ID = /^[a-z0-9]{8}$/;
const CODE = /^z?[A-Za-z0-9_-]{20,60000}$/;

const t = (v, n) => String(v ?? '').replace(/[<>]/g, '').slice(0, n);
const n = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : 0; };
const CLS = ['Warrior', 'Mage', 'Ranger', 'Necromancer', 'Paladin', 'Samurai'];
// the numbers shown on the share card, worked out in the planner when the link is made
function clean(s) { if (!s || typeof s !== 'object') return null;
  return { n: t(s.n, 24), c: CLS.includes(s.c) ? s.c : 'Ranger', l: n(s.l, 1, 200), rl: n(s.rl, 0, 999), pts: n(s.pts, 0, 400), sk: t(s.sk, 60).replace(/[^a-z0-9_]/g, ''), skn: t(s.skn, 40),
    vs: n(s.vs, 0, 1e13), sh: n(s.sh, 0, 1e13), hit: n(s.hit, 0, 1e12), aps: n(s.aps, 0, 100), cr: n(s.cr, 0, 100), mu: n(s.mu, 0, 100), L: n(s.L, 0, 100), vw: n(s.vw, 0, 200),
    res: { f: n(s.res && s.res.f, -200, 100), c: n(s.res && s.res.c, -200, 100), l: n(s.res && s.res.l, -200, 100) },
    gb: n(s.gb, 0, 9999),
    uq: Array.isArray(s.uq) ? s.uq.slice(0, 8).map(x => t(x, 60).replace(/[^a-z0-9_]/g, '')) : [] }; }
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const code = String(body.code || '');
      if (!CODE.test(code)) return res.status(400).json({ error: 'That is not a planner build.' });
      // same build, same id: hash the code itself
      const id = BigInt('0x' + createHash('sha256').update(code).digest('hex').slice(0, 16)).toString(36).slice(0, 8).padStart(8, '0');
      const sum = clean(body.sum);
      const rec = JSON.stringify({ code, sum, at: new Date().toISOString() });
      // a new summary replaces the old card; without one, keep whatever is there
      if (sum) await cmd('SET', `s:${id}`, rec); else await cmd('SET', `s:${id}`, rec, 'NX');
      return res.status(200).json({ id });
    }
    if (req.method === 'GET') {
      const id = String(req.query.id || '');
      if (!ID.test(id)) return res.status(400).json({ error: 'Bad link.' });
      const j = json(await cmd('GET', `s:${id}`));
      if (!j) return res.status(404).json({ error: 'This short link does not exist.' });
      return res.status(200).json({ code: j.code });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Use GET or POST.' });
  } catch (e) {
    return res.status(500).json({ error: 'Something went wrong saving the link.' });
  }
}
