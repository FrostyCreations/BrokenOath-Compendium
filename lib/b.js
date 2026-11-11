// Short build link with a preview card: /b/<id> -> Open Graph tags for Discord etc, then on to the planner.
import { cmd, json } from './_db.js';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const big = n => { n = +n || 0; return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)); };
export default async function handler(req, res) {
  const id = String(req.query.id || '').replace(/[^a-z0-9]/g, '').slice(0, 8);
  const origin = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
  let s = {}, ver = '';
  try { const j = id && json(await cmd('GET', `s:${id}`)); if (j) { s = j.sum || {}; ver = String(Date.parse(j.at) || ''); } } catch (e) {}
  const to = `${origin}/planner.html#s=${id}`;
  const title = s.n ? `${s.n}, level ${s.l} ${s.c}${s.skn ? ' · ' + s.skn : ''}` : 'Broken Oath build';
  const desc = s.vs ? `${big(s.vs)} boss DPS${s.sh ? ', ' + big(s.sh) + ' tooltip DPS' : ''}${s.rl ? ' · Deepest Rupture ' + s.rl : ''}. Open it in the Broken Oath Build Planner.` : 'Open this build in the Broken Oath Build Planner.';
  const img = `${origin}/api/og?id=${id}&v=${encodeURIComponent(ver)}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="broked-db · Broken Oath tools">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(origin + '/b/' + id)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}"><meta name="theme-color" content="#d9a441">
<meta http-equiv="refresh" content="0;url=${esc(to)}"></head><body><script>location.replace(${JSON.stringify(to)})</script><a href="${esc(to)}">Open the build</a></body></html>`);
}
