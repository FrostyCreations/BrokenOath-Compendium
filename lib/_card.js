// The share card Discord and others show for a /b/<id> link. Plain element objects, no JSX build step.
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat().filter(c => c !== null && c !== undefined && c !== false) } });
const img = (src, w, style = {}) => ({ type: 'img', props: { src, width: w, height: w, style: { width: w, height: w, ...style } } });
const C = { bg: '#0f1218', panel: '#161b24', line: '#2a3240', ink: '#e8e2d4', mute: '#8d96a6', gold: '#d9a441', fire: '#e0603a', cold: '#5fa8e8', light: '#e8cf4a', pois: '#7fc46a', unique: '#c9772e' };
const big = n => { n = +n || 0; if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return String(Math.round(n)); };
export function card(s, origin) {
  const stat = (label, value, color) => h('div', { flexDirection: 'column', gap: 2 }, h('div', { fontSize: 18, color: C.mute }, label), h('div', { fontSize: 34, color: color || C.ink, fontFamily: 'Mono' }, value));
  const res = s.res || {};
  const resRow = h('div', { flexDirection: 'column', gap: 2 }, h('div', { fontSize: 18, color: C.mute }, 'Resistances'),
    h('div', { fontSize: 34, fontFamily: 'Mono', gap: 0 },
      h('span', { color: C.fire }, `${res.f ?? '-'}%`), h('span', { color: C.mute }, '/'),
      h('span', { color: C.cold }, `${res.c ?? '-'}%`), h('span', { color: C.mute }, '/'),
      h('span', { color: C.light }, `${res.l ?? '-'}%`)));
  const uniq = (s.uq || []).slice(0, 7);
  return h('div', { width: 1200, height: 630, background: C.bg, padding: 34, fontFamily: 'Sans', color: C.ink },
    h('div', { flex: 1, flexDirection: 'column', background: C.panel, border: `2px solid ${C.line}`, borderRadius: 18, padding: '30px 36px', gap: 22 },
      h('div', { alignItems: 'center', gap: 26 },
        img(`${origin}/og/p/${s.c || 'Ranger'}.png`, 150, { borderRadius: 75, border: `3px solid ${C.gold}` }),
        h('div', { flexDirection: 'column', flex: 1, gap: 4 },
          h('div', { fontSize: 64, fontFamily: 'Display', color: C.ink, lineHeight: 1 }, s.n || 'Unnamed'),
          h('div', { fontSize: 26, color: C.mute }, `Level ${s.l || '?'} ${s.c || ''}${s.rl ? ' · Deepest Rupture ' + s.rl : ''}${s.pts ? ' · ' + s.pts + ' passives' : ''}`),
          h('div', { alignItems: 'center', gap: 14, marginTop: 10, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 16px' },
            s.sk ? img(`${origin}/og/sk/${s.sk}.png`, 54, { borderRadius: 8 }) : null,
            h('div', { flexDirection: 'column', flex: 1 },
              h('div', { fontSize: 28, color: C.ink }, s.skn || 'Main skill'),
              h('div', { fontSize: 19, color: C.mute }, `${s.aps ? s.aps + '/s' : ''}${s.cr ? ' · ' + s.cr + '% crit' : ''}${s.mu ? ' · ×' + s.mu + ' multi' : ''}${s.L ? ' · level ' + s.L : ''}`)),
            h('div', { flexDirection: 'column', alignItems: 'flex-end' },
              h('div', { fontSize: 50, fontFamily: 'Mono', color: C.gold, lineHeight: 1 }, big(s.vs)),
              h('div', { fontSize: 16, color: C.mute }, 'boss DPS'))))),
      h('div', { gap: 56, borderTop: `1px solid ${C.line}`, paddingTop: 20 },
        stat('Tooltip DPS', big(s.sh)), stat('Average hit', big(s.hit)), resRow, s.vw ? stat('Vows', String(s.vw), C.unique) : null),
      h('div', { alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
        h('div', { gap: 10 }, ...uniq.map(u => img(`${origin}/og/u/${u}.png`, 58, { background: C.bg, borderRadius: 8, border: `1px solid ${C.line}` }))),
        h('div', { fontSize: 24, color: C.mute, fontFamily: 'Display' }, 'broked-db · Build Planner'))));
}
export async function fonts(origin, read) {
  const f = async n => read ? read(n) : await (await fetch(`${origin}/og/fonts/${n}`)).arrayBuffer();
  return [
    { name: 'Display', data: await f('spectral-sc-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Sans', data: await f('alegreya-sans-latin-500-normal.woff'), weight: 500, style: 'normal' },
    { name: 'Mono', data: await f('jetbrains-mono-latin-500-normal.woff'), weight: 500, style: 'normal' },
  ];
}
