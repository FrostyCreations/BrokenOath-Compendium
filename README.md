# broked-db on Cloudflare Pages

Fan-made tools for the Broken Oath playtest: Database, Build Planner, Build Guides, Crafting, Loot Filter, Online Ladder.

- `site/` is the built site (made by `build_all.py` in the tools workspace, then `sync.py`). Cloudflare settings: build command `npm ci` (installs the share card package the Functions need), output folder `site`.
- `functions/` are the API routes (`/api/*`, `/b/<id>`). They run the original handlers in `lib/` through `lib/adapt.js`.
- Data lives in Upstash Redis. Set these in Cloudflare Pages, Settings, Variables and Secrets (Production):
  `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`), `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` (if used), `ADMIN_KEY`.
- Discord sign in: add `https://<project>.pages.dev/api/auth/callback` as a redirect in the Discord developer portal.

Data: Broken Oath public API (Online Ladder). Not an official Broken Oath site.
