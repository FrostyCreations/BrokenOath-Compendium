// Runs the site's Vercel-style API handlers (req, res) as Cloudflare Pages Functions, unchanged.
// Cloudflare's environment variables are copied onto process.env, the request becomes req.query / req.body / req.headers,
// and res.status().json() / send() / setHeader() build the Response.
export function adapt(handler, extraQuery = {}) {
  return async (ctx) => {
    const { request, env, params } = ctx;
    globalThis.process = globalThis.process || { env: {} };
    process.env = Object.assign(process.env || {}, env);
    globalThis.__ASSETS = env.ASSETS; // the site's own static files, read without a network round trip
    const url = new URL(request.url);
    const headers = {}; request.headers.forEach((v, k) => { headers[k] = v; });
    headers.host = headers.host || url.host;
    const query = Object.assign(Object.fromEntries(url.searchParams), params || {}, extraQuery);
    let body;
    if (!['GET', 'HEAD'].includes(request.method)) {
      const t = await request.text();
      body = t;
      if ((headers['content-type'] || '').includes('application/json')) { try { body = JSON.parse(t); } catch { body = t; } }
    }
    const req = { method: request.method, url: url.pathname + url.search, headers, query, body };
    const out = new Headers(); let status = 200, payload = null, done = false;
    const res = {
      get statusCode() { return status; }, set statusCode(c) { status = c; },
      status(c) { status = c; return res; },
      setHeader(k, v) { if (Array.isArray(v)) { out.delete(k); v.forEach(x => out.append(k, String(x))); } else out.set(k, String(v)); return res; },
      getHeader(k) { return k.toLowerCase() === 'set-cookie' ? (out.getSetCookie ? out.getSetCookie() : out.get(k)) : out.get(k); },
      json(o) { if (!out.has('content-type')) out.set('content-type', 'application/json; charset=utf-8'); payload = JSON.stringify(o); done = true; return res; },
      send(b) { if (b != null && typeof b === 'object' && !(b instanceof ArrayBuffer) && !ArrayBuffer.isView(b)) return res.json(b); payload = b; done = true; return res; },
      end(b) { if (b != null) payload = b; done = true; return res; },
    };
    await handler(req, res);
    if (!done && payload == null && status === 200) status = 204;
    return new Response(payload, { status, headers: out });
  };
}
