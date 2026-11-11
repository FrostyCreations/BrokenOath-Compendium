// Read-through cache for the Broken Oath public API (https://api.playbrokenoath.com/v1/).
// The API asks tool sites to cache on their own server rather than fetch per visitor, so pages call /api/bo?p=<file>
// and Vercel's edge cache keeps each file for its refresh time: version, leagues and ladders 15 minutes, builds and meta an hour.
const BASE = 'https://api.playbrokenoath.com/v1/';
const CLS = '(Warrior|Mage|Necromancer|Paladin|Ranger|Samurai)';
const OK = [
  [/^version\.json$/, 120],
  [/^leagues\.json$/, 600],
  [/^ladder\/[a-z0-9-]{2,40}\.json$/, 240],
  [new RegExp(`^builds/[a-z0-9-]{2,40}/${CLS}\\.json$`), 3600],
  [new RegExp(`^builds/[a-z0-9-]{2,40}/${CLS}/[a-f0-9]{16}\\.json$`), 3600],
  [/^meta\/[a-z0-9-]{2,40}\.json$/, 3600],
];

export default async function handler(req, res) {
  const p = String(req.query.p || '');
  const rule = OK.find(([re]) => re.test(p));
  if (!rule) { res.setHeader('Cache-Control', 'no-store'); return res.status(400).json({ error: 'Unknown file.' }); }
  const ttl = rule[1];
  try {
    const r = await fetch(BASE + p, { headers: { accept: 'application/json', 'user-agent': 'broked-db (fan tools site)' } });
    if (r.status === 404) { res.setHeader('Cache-Control', `public, s-maxage=${Math.min(ttl, 300)}`); return res.status(404).json({ error: 'Not found.' }); }
    if (!r.ok) throw new Error('Upstream ' + r.status);
    const body = await r.text();
    JSON.parse(body); // only pass on valid JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', `public, max-age=60, s-maxage=${ttl}, stale-while-revalidate=${Math.min(ttl, 600)}`);
    return res.status(200).send(body);
  } catch (e) {
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(502).json({ error: 'The Broken Oath API did not answer. Try again in a minute.' });
  }
}
