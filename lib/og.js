// PNG share card for a short link: /api/og?id=xxxxxxxx
import { ImageResponse } from '@cloudflare/pages-plugin-vercel-og/api';
import { cmd, json } from './_db.js';
import { card, fonts } from './_card.js';
export default async function handler(req, res) {
  try {
    const id = String(req.query.id || '').replace(/[^a-z0-9]/g, '').slice(0, 8);
    const origin = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host);
    const j = id && json(await cmd('GET', `s:${id}`));
    const s = (j && j.sum) || {};
    const r = new ImageResponse(card(s, origin), { width: 1200, height: 630, fonts: await fonts(origin, globalThis.__ASSETS ? async f => (await globalThis.__ASSETS.fetch(new Request(origin + '/og/fonts/' + f))).arrayBuffer() : undefined) });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.status(500).send('card failed'); }
}
