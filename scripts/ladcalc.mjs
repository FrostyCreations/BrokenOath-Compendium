// Every 30 minutes: work out every published Online Ladder build once, on the live site, and store the numbers (POST /api/ladcalc),
// so visitors get them in one request instead of working out up to 300 builds each in their browser.
// Needs ADMIN_KEY (GitHub secret). SITE defaults to the live address.
import { chromium } from 'playwright-core';
const SITE = process.env.SITE || 'https://broked-db.pages.dev', KEY = process.env.ADMIN_KEY;
const DRY = !!process.env.DRY; // DRY=1: work everything out, store nothing
if (!KEY && !DRY) { console.error('ADMIN_KEY is not set'); process.exit(1); }
const ch = process.env.PW_CHANNEL ?? 'chrome', browser = await chromium.launch(ch ? { channel: ch } : {});
const page = await browser.newPage();
page.on('pageerror', e => console.log('page error:', e.message));
await page.goto(SITE + '/live', { waitUntil: 'load' });
await page.waitForFunction(() => typeof api === 'function' && typeof planner === 'function', null, { timeout: 60000 });
const leagues = await page.evaluate(async () => (await api('leagues.json')).leagues.map(l => l.id));
let total = 0;
for (const l of leagues) {
  const t0 = Date.now();
  const out = await page.evaluate(async (l) => {
    let lad; try { lad = await api(`ladder/${l}.json`); } catch (e) { return null; }
    const hs = (lad.heroes || []).filter(h => h.has_build && h.build); if (!hs.length) return { n: 0 };
    const L = await planner(), heroes = {};
    // download a few build files ahead while the planner works
    const files = new Map(); let next = 0; const pull = async () => { while (next < hs.length) { const h = hs[next++]; const p = api(h.build).catch(() => null); files.set(h.hero, p); await p; } };
    for (let i = 0; i < 6; i++) pull();
    for (const h of hs) {
      while (!files.has(h.hero)) await new Promise(r => setTimeout(r, 20));
      const o = await files.get(h.hero); if (!o || !o.build) continue;
      try {
        const r = await L.fromApi(o, h.main_skill), uq = [...new Set((o.build.items || []).map(x => x.unique).filter(Boolean))];
        heroes[h.hero] = { u: h.updated_at, dps: r.dps || 0, life: r.life || 0, es: r.es || 0, ehp: r.ehp || 0, ks: r.ks || [], uq, m: r.dps > 0 ? r.main : '', s: r.dps > 0 ? (r.sup || []) : [] };
      } catch (e) {}
    }
    return { n: hs.length, cv: CV, heroes };
  }, l);
  if (!out || !out.n) continue;
  if (DRY) { console.log(`${l}: ${Object.keys(out.heroes).length} of ${out.n} builds in ${((Date.now() - t0) / 1000).toFixed(1)} s (dry run)`); total++; continue; }
  const res = await fetch(SITE + '/api/ladcalc', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify({ l, cv: out.cv, heroes: out.heroes }) });
  const j = await res.json().catch(() => ({}));
  console.log(`${l}: ${Object.keys(out.heroes).length} of ${out.n} builds in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${res.status} ${JSON.stringify(j)}`);
  if (res.ok) total++;
}
await browser.close();
if (!total) { console.error('nothing stored'); process.exit(1); }
