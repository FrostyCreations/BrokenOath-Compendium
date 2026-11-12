// Online Ladder results worked out ahead of time, so a visitor does not have to work out 300 builds in the browser.
// A job every 30 minutes (.github/workflows/ladder.yml) opens the live Online Ladder in a headless browser, works out every published
// build with the same Build Planner, and stores the numbers here with the admin key. The page reads them with one request
// and only works out heroes that changed since.
//   GET  /api/ladcalc?l=<league>                       -> { cv, at, heroes: { <hero id>: { u, dps, life, es, ehp, ks, uq, m, s } } }
//   POST /api/ladcalc  (x-admin-key) { l, cv, heroes }   -> stores it for 7 days
import { cmd, json } from './_db.js';
const LID = /^[a-z0-9-]{2,40}$/;
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const l = String(req.query.l || '');
      if (!LID.test(l)) return res.status(400).json({ error: 'Unknown league.' });
      const v = json(await cmd('GET', 'ladcalc:' + l));
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
      return res.status(200).json(v || { heroes: {} });
    }
    if (req.method === 'POST') {
      const key = process.env.ADMIN_KEY;
      if (!key || req.headers['x-admin-key'] !== key) return res.status(403).json({ error: 'Not allowed.' });
      const b = typeof req.body === 'string' ? json(req.body) : req.body;
      if (!b || !LID.test(String(b.l || '')) || typeof b.heroes !== 'object') return res.status(400).json({ error: 'Bad body.' });
      const out = { cv: +b.cv || 0, at: new Date().toISOString(), heroes: {} };
      for (const [id, h] of Object.entries(b.heroes).slice(0, 2000)) {
        if (!/^[a-f0-9]{8,32}$/.test(id) || !h) continue;
        out.heroes[id] = { u: String(h.u || '').slice(0, 40), dps: +h.dps || 0, life: +h.life || 0, es: +h.es || 0, ehp: +h.ehp || 0,
          ks: (h.ks || []).slice(0, 12).map(x => String(x).slice(0, 60)), uq: (h.uq || []).slice(0, 20).map(x => String(x).slice(0, 80)),
          m: String(h.m || '').slice(0, 60), s: (h.s || []).slice(0, 8).map(x => String(x).slice(0, 60)) };
      }
      await cmd('SET', 'ladcalc:' + b.l, JSON.stringify(out), 'EX', 7 * 86400);
      return res.status(200).json({ ok: true, heroes: Object.keys(out.heroes).length });
    }
    res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'GET or POST.' });
  } catch (e) { res.setHeader('Cache-Control', 'no-store'); return res.status(500).json({ error: 'Storage error.' }); }
}
