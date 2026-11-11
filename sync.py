#!/usr/bin/env python3
# Copies the built site (deploy/broked-db) into the Cloudflare Pages project: static files into site/,
# the API handlers into functions/_lib/ (they run unchanged through functions/_lib/adapt.js).
import os, shutil, re
BO = '/home/claude/bo'; SRC = f'{BO}/deploy/broked-db'; CF = f'{BO}/cf'
SKIP = {'api', 'node_modules', '.vercel', 'vercel.json', 'package.json', 'package-lock.json', '.gitignore', '.env.local', '.env'}
site = f'{CF}/site'
if os.path.isdir(site): shutil.rmtree(site)
os.makedirs(site)
for n in os.listdir(SRC):
    if n in SKIP or n.startswith('.env'): continue
    s = f'{SRC}/{n}'
    (shutil.copytree if os.path.isdir(s) else shutil.copy2)(s, f'{site}/{n}')
# API handlers (not the one-off Vercel Blob migration, and the share card uses Cloudflare's own image renderer)
lib = f'{CF}/lib'
for n in os.listdir(f'{SRC}/api'):
    if not n.endswith('.js') or n in ('migrate.js',): continue
    t = open(f'{SRC}/api/{n}').read()
    if n == 'og.js': t = t.replace("import { ImageResponse } from '@vercel/og';", "import { ImageResponse } from '@cloudflare/pages-plugin-vercel-og/api';")
    if n == 'og.js': t = t.replace('fonts: await fonts(origin)', "fonts: await fonts(origin, globalThis.__ASSETS ? async f => (await globalThis.__ASSETS.fetch(new Request(origin + '/og/fonts/' + f))).arrayBuffer() : undefined)")
    open(f'{lib}/{n}', 'w').write(t)
# Vercel's analytics script doesn't exist on Cloudflare (Cloudflare Web Analytics is switched on in the Pages dashboard instead)
VA = '<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};</script><script defer src="/_vercel/insights/script.js"></script>'
for n in os.listdir(site):
    if n.endswith('.html'):
        p = f'{site}/{n}'; t = open(p, encoding='utf-8').read()
        if VA in t: open(p, 'w', encoding='utf-8').write(t.replace(VA, ''))
shutil.copy2(f'{CF}/_headers', f'{site}/_headers')
shutil.copy2(f'{CF}/_redirects', f'{site}/_redirects')
print('synced', sum(len(f) for _, _, f in os.walk(site)), 'files')
