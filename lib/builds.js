// Builds Ladder API: POST a build from the planner, GET the ladder or one build.
import { cmd, pipe, pairs, json } from './_db.js';
import { createHash } from 'node:crypto';

const CLASSES = ['Warrior', 'Mage', 'Ranger', 'Necromancer', 'Paladin', 'Samurai'];
const ID = /^[a-f0-9]{16}$/;
const str = (v, n) => String(v ?? '').replace(/[<>]/g, '').slice(0, n);
const num = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo; };
const arr = (v, n) => Array.isArray(v) ? v.slice(0, n) : [];
const SECRET = /^[a-f0-9]{32,128}$/;
const ownerHash = s => createHash('sha256').update('broked-ladder:' + s).digest('hex');
// Storage (Upstash Redis): b:<id> holds the full build, the hash 'ladder' holds one short summary per build,
// so the ladder page is a single read however many builds there are.
async function stored(id) { return json(await cmd('GET', `b:${id}`)); }

const item = i => ({ id: str(i.id, 16), s: str(i.s, 20), b: str(i.b, 60), u: str(i.u, 80), r: str(i.r, 12), n: str(i.n, 40), ef: i.ef ? 1 : 0, il: num(i.il, 0, 200), q: num(i.q, 0, 100),
      ...(i.gx != null ? { gx: num(i.gx, -1, 30), gy: num(i.gy, -1, 30) } : {}),
      ru: arr(i.ru, 6).map(x => str(x, 40)), a: arr(i.a, 24).map(a => [str(a[0], 60), num(a[1], 0, 20), num(a[2], -1e6, 1e6), num(a[3], -1e6, 1e6), [1, 2, 3].includes(a[4]) ? a[4] : 0]) });
function clean(b) {
  if (!b || typeof b !== 'object') throw new Error('No build sent.');
  if (!ID.test(b.k || '')) throw new Error('This build has no character key. Load it from a save file in the planner.');
  if (!CLASSES.includes(b.c)) throw new Error('Unknown class.');
  return {
    v: 1, k: b.k, n: str(b.n, 24) || 'Unnamed', c: b.c, l: num(b.l, 1, 200), lg: str(b.lg, 40), rl: num(b.rl, 0, 999), bp: num(b.bp, 0, 99),
    t: arr(b.t, 300).map(x => str(x, 60)), qz: arr(b.qz, 40).map(x => num(x, 0, 999)),
    ts: arr(b.ts, 8).map(x => ({ n: str(x && x.n, 30), t: arr(x && x.t, 300).map(y => str(y, 60)), o: arr(x && x.o, 300).map(y => str(y, 60)), ...(x && x.lk ? { lk: str(x.lk, 20) } : {}) })), tsi: num(b.tsi, 0, 7),
    it: arr(b.it, 50).map(item),
    ...(Array.isArray(b.ip) ? { ip: arr(b.ip, 150).map(item), iset: arr(b.iset, 8).map(x => ({ n: str(x && x.n, 30), id: str(x && x.id, 20), ids: arr(x && x.ids, 60).map(y => str(y, 16)) })), isi: num(b.isi, 0, 7) } : {}),

    so: arr(b.so, 40).map(s => ({ k: str(s.k, 60), s: arr(s.s, 6).map(x => str(x, 60)), c: str(s.c, 60) })),
    hb: arr(b.hb, 12).map(x => str(x, 60)), note: str(b.note, 4000),
    ...(Array.isArray(b.ab) ? { ab: arr(b.ab, 20).map(x => str(x, 60)) } : {}),
    gl: Object.fromEntries(Object.entries(b.gl || {}).slice(0, 60).map(([k, v]) => [str(k, 60), num(v, 0, 40)])),
    sd: Object.fromEntries(Object.entries(b.sd || {}).slice(0, 60).map(([k, v]) => [str(k, 60), num(v, 0, 1e15)])),
    pot: arr(b.pot, 4).map(p => ({ s: str(p.s, 20), b: str(p.b, 40), u: str(p.u, 60), r: str(p.r, 12), v: str(p.v, 20), il: num(p.il, 0, 300), q: num(p.q, 0, 30),
      a: arr(p.a, 6).map(a => [str(a[0], 40), num(a[1], 0, 5), num(a[2], -1e6, 1e6), num(a[3], -1e6, 1e6)]) })),
    dn: arr(b.dn, 60).map(x => str(x, 60)), as: str(b.as, 20), w: str(b.w, 60), tv: num(b.tv, 0, 1e6),
    src: ['code', 'link'].includes(b.src) ? b.src : 'save',
    main: str(b.main, 60), dps: num(b.dps, 0, 1e13), sheet: num(b.sheet, 0, 1e13), patch: str(b.patch, 20),
    life: num(b.life, 0, 1e9), es: num(b.es, 0, 1e9), ehp: num(b.ehp, 0, 1e12), ks: arr(b.ks, 20).map(x => str(x, 40)),
    at: new Date().toISOString(),
  };
}
function summary(b, url) {
  return { id: b.k, src: b.src || 'save', n: b.n, c: b.c, l: b.l, lg: b.lg, rl: b.rl, main: b.main, dps: b.dps, sheet: b.sheet, at: b.at, patch: b.patch,
    uniq: b.it.filter(i => i.u).map(i => i.u), sk: b.hb.filter(x => x && x !== 'move'),
    sup: (b.so.find(s => s.k === b.main) || { s: [] }).s, url,
    life: b.life || 0, es: b.es || 0, ehp: b.ehp || 0, ks: b.ks || null, t: b.ks ? undefined : b.t };
}
export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (JSON.stringify(body || {}).length > 60000) return res.status(413).json({ error: 'That build is too large.' });
      const b = clean(body && body.build);
      const secret = String((body && body.secret) || '');
      if (!SECRET.test(secret)) return res.status(400).json({ error: 'Missing owner key. Reload the page and try again.' });
      const old = await stored(b.k);
      if (old && old.oh && old.oh !== ownerHash(secret)) return res.status(403).json({ error: 'This character is already on the ladder and was added by someone else.' });
      const existing = !!old;
      b.oh = ownerHash(secret);
      await pipe([['SET', `b:${b.k}`, JSON.stringify(b)], ['HSET', 'ladder', b.k, JSON.stringify(summary(b))]]);
      return res.status(200).json({ ok: true, id: b.k, updated: existing });
    }
    if (req.method === 'GET') {
      const id = String(req.query.id || '');
      if (id) {
        if (!ID.test(id)) return res.status(400).json({ error: 'Bad build id.' });
        const b = await stored(id);
        if (!b) return res.status(404).json({ error: 'That build is not on the ladder.' });
        delete b.oh;
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
        return res.status(200).json({ build: b });
      }
      const builds = Object.values(pairs(await cmd('HGETALL', 'ladder'))).map(json).filter(Boolean);
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
      return res.status(200).json({ builds });
    }
    if (req.method === 'DELETE') {
      // the uploader (owner key) or moderation (ADMIN_KEY in the Vercel project's environment variables)
      const id = String(req.query.id || '');
      if (!ID.test(id)) return res.status(400).json({ error: 'Bad build id.' });
      const key = String(req.headers['x-admin-key'] || '');
      const admin = !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
      if (!admin) {
        const secret = String(req.headers['x-owner-key'] || '');
        const old = await stored(id);
        if (!old) return res.status(404).json({ error: 'That build is not on the ladder.' });
        if (!SECRET.test(secret) || !old.oh || old.oh !== ownerHash(secret)) return res.status(403).json({ error: 'Only the person who added this build can remove it.' });
      }
      await pipe([['DEL', `b:${id}`], ['HDEL', 'ladder', id]]);
      return res.status(200).json({ ok: true, removed: id });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Use GET or POST.' });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Something went wrong.' });
  }
}
