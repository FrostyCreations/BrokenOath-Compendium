// Upstash Redis over its REST API (no package needed). Vercel's Upstash integration sets KV_REST_API_URL / KV_REST_API_TOKEN;
// a store connected straight from Upstash sets UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. Either works.
const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function call(path, body) {
  const url = URL_(), token = TOKEN();
  if (!url || !token) throw new Error('Storage is not connected yet.');
  const r = await fetch(url.replace(/\/$/, '') + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error('Storage error' + (j && j.error ? ': ' + j.error : ''));
  return j;
}
// one command: cmd('GET', 'key')
export async function cmd(...args) { const j = await call('', args.map(String)); if (j.error) throw new Error(j.error); return j.result; }
// several commands in one round trip: pipe([['GET','a'],['HGETALL','b']]) -> results in order
export async function pipe(list) { const j = await call('/pipeline', list.map(a => a.map(String))); return j.map(x => { if (x.error) throw new Error(x.error); return x.result; }); }
// HGETALL comes back as [field, value, field, value, ...]
export const pairs = a => { const o = {}; for (let i = 0; a && i < a.length; i += 2) o[a[i]] = a[i + 1]; return o; };
export const json = s => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
