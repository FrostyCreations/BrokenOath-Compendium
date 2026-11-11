// Broken Oath offline save maker for the Build Planner.
// Reads and writes Unreal GVAS saves in the browser, keeping every byte it does not need to change.
// A build becomes a new offline hero (BO_Char_<id>.sav) and an entry in the player's BO_Account.sav hero list.
(function(){
const te=new TextEncoder(), td=new TextDecoder('latin1'), tdu=new TextDecoder('utf-16le');
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
class R{ constructor(b,p=0){ this.b=b; this.p=p; this.v=new DataView(b.buffer,b.byteOffset,b.byteLength); }
  i32(){ const x=this.v.getInt32(this.p,true); this.p+=4; return x; } u8(){ return this.b[this.p++]; } raw(n){ const x=this.b.slice(this.p,this.p+n); this.p+=n; return x; }
  fstr(){ const n=this.i32(); if(n===0) return ''; if(n<0){ const x=this.raw(-n*2); return tdu.decode(x.slice(0,-2)); } const x=this.raw(n); return td.decode(x.slice(0,-1)); } }
const cat=a=>{ const n=a.reduce((s,x)=>s+x.length,0), o=new Uint8Array(n); let p=0; for(const x of a){ o.set(x,p); p+=x.length; } return o; };
const i32=v=>{ const o=new Uint8Array(4); new DataView(o.buffer).setInt32(0,v,true); return o; };
const f32=v=>{ const o=new Uint8Array(4); new DataView(o.buffer).setFloat32(0,v,true); return o; };
const i64=v=>{ const o=new Uint8Array(8); new DataView(o.buffer).setBigInt64(0,typeof v==='bigint'?v:BigInt(Math.round(v)),true); return o; };
function wstr(t){ t=String(t??''); if(t==='') return i32(0); if(/^[\x00-\x7f]*$/.test(t)){ const b=cat([te.encode(t),new Uint8Array([0])]); return cat([i32(b.length),b]); }
  const u=new Uint8Array((t.length+1)*2); for(let i=0;i<t.length;i++){ u[i*2]=t.charCodeAt(i)&255; u[i*2+1]=t.charCodeAt(i)>>8; } return cat([i32(-(u.length/2)),u]); }
const CORE=new Set(['DateTime','Timespan','Guid','Vector','Rotator','LinearColor','Color','IntPoint','Vector2D','Quat']);
function rtype(r){ const name=r.fstr(), n=r.i32(), kids=[]; for(let i=0;i<n;i++) kids.push(rtype(r)); return [name,kids]; }
const typebytes=t=>cat([wstr(t[0]),i32(t[1].length),...t[1].map(typebytes)]);
function parse(r){ const out=[]; for(;;){ const name=r.fstr(); if(name==='None'||name==='') return out;
    const p={name,t:rtype(r)}; const size=r.i32(); p.flags=r.u8(); const st=r.p;
    if(p.flags&1) r.i32(); if(p.flags&2) r.raw(16); if(p.flags&4){ const ef=r.u8(); if(ef&2){ r.u8(); r.raw(16); } }
    p.extra=r.b.slice(st,r.p); const vs=r.p; p.raw=r.b.slice(vs,vs+size); const tn=p.t[0];
    if(tn==='StructProperty'&&p.t[1].length&&!CORE.has(p.t[1][0][0])) p.kids=parse(new R(r.b,vs));
    else if(tn==='ArrayProperty'&&p.t[1].length&&p.t[1][0][0]==='StructProperty'&&p.t[1][0][1].length&&!CORE.has(p.t[1][0][1][0][0])){ const rr=new R(r.b,vs), c=rr.i32(); p.elems=[]; for(let i=0;i<c;i++) p.elems.push(parse(rr)); }
    r.p=vs+(tn==='BoolProperty'?0:size); out.push(p); } }
function ser(ps){ const parts=[]; for(const p of ps){ const val=p.kids?ser(p.kids):p.elems?cat([i32(p.elems.length),...p.elems.map(ser)]):p.raw; const size=p.t[0]==='BoolProperty'?0:val.length;
    parts.push(wstr(p.name),typebytes(p.t),i32(size),new Uint8Array([p.flags]),p.extra,p.t[0]==='BoolProperty'?new Uint8Array(0):val); } parts.push(wstr('None')); return cat(parts); }
const get=(ps,n)=>ps.find(p=>p.name===n);
const sval=p=>new R(p.raw).fstr();
const ival=p=>new R(p.raw).i32();
const clone=o=>o instanceof Uint8Array?o.slice():Array.isArray(o)?o.map(clone):o&&typeof o==='object'?Object.fromEntries(Object.entries(o).map(([k,v])=>[k,clone(v)])):o;
const setv=(ps,k,raw)=>{ const p=get(ps,k); if(p) p.raw=raw; };
const setb=(ps,k,on)=>{ const p=get(ps,k); if(p) p.flags=on?(p.flags|16):(p.flags&~16); };
const strarr=l=>cat([i32(l.length),...l.map(wstr)]);
const readArr=p=>{ const r=new R(p.raw), n=r.i32(), o=[]; for(let i=0;i<n;i++) o.push(r.fstr()); return o; };
const readMap=p=>{ const r=new R(p.raw); r.i32(); const n=r.i32(), o=new Map(); for(let i=0;i<n;i++){ const k=r.fstr(); o.set(k,r.i32()); } return o; };
const writeMap=m=>cat([i32(0),i32(m.size),...[...m].flatMap(([k,v])=>[wstr(k),i32(v)])]);
const readMap64=p=>{ const r=new R(p.raw); r.i32(); const n=r.i32(), o=new Map(); for(let i=0;i<n;i++){ const k=r.fstr(); o.set(k,r.v.getBigInt64((r.p+=8)-8,true)); } return o; };
const writeMap64=m=>cat([i32(0),i32(m.size),...[...m].flatMap(([k,v])=>[wstr(k),i64(v)])]);
// every material the forge, the cube and the vendors use (craftdata materials); the stash wallet and each hero carry the same set
const MATS=['ember','rune','oathsteel','whetstone','rivet','heartwood','sunstone','frost_iron','deepstone','bog_amber','core_ember'];
const RICH={gold:10000000,mats:999};
let CT=null; const crc32=b=>{ if(!CT){ CT=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; CT[n]=c>>>0; } } let c=0xFFFFFFFF; for(let i=0;i<b.length;i++) c=CT[(c^b[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
function findSig(b){ const sig=cat([i32(14),te.encode('SchemaVersion\0')]); outer: for(let i=0;i<b.length-sig.length;i++){ for(let j=0;j<sig.length;j++) if(b[i+j]!==sig[j]) continue outer; return i; } return -1; }
function load(buf){ const b=buf instanceof Uint8Array?buf:new Uint8Array(buf); const at=findSig(b); if(at<0) throw new Error('This is not a Broken Oath save.');
  const r=new R(b,at); const props=parse(r); return {head:b.slice(0,at),props}; }
function save(doc){ const body=cat([doc.head,ser(doc.props),i32(0)]); const t=new Uint8Array(12); t.set(te.encode('BOCK')); const dv=new DataView(t.buffer); dv.setUint32(4,body.length,true); dv.setUint32(8,crc32(body),true); return cat([body,t]); }
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const seed=()=>new DataView(rnd(4).buffer).getInt32(0,true)&0x7fffffff||1;
const guidName=g=>[0,4,8,12].map(i=>[...g.slice(i,i+4)].reverse().map(x=>x.toString(16).padStart(2,'0')).join('')).join('').toUpperCase();
// XP held at a level: known points from real saves, a 10.6% step per level between and below them
const XPK=[[90,112348832],[100,308931880],[150,48e9],[160,124e9]];
function xpAt(L){ if(L<=1) return 0; if(L<=90) return Math.round(XPK[0][1]/Math.pow(1.106,90-L)); for(let i=1;i<XPK.length;i++){ const [a,xa]=XPK[i-1],[b,xb]=XPK[i]; if(L<=b) return Math.round(xa*Math.pow(xb/xa,(L-a)/(b-a))); }
  const [a,xa]=XPK[XPK.length-1]; return Math.round(xa*Math.pow(1.1,L-a)); }
// idols: the 5x5 panel without its corners; keep the build's spots when they fit, otherwise pack the biggest first
function placeIdols(idols,P){ const size=it=>{ const m=/(\d)x(\d)/.exec((P.base[String(it.b).toLowerCase()]||{}).c||''); return m?[+m[1],+m[2]]:[1,1]; };
  const occ=new Set(['0,0','4,0','0,4','4,4']), pos=new Map(); const cells=(x,y,w,h)=>{ const o=[]; for(let a=0;a<w;a++) for(let b=0;b<h;b++) o.push((x+a)+','+(y+b)); return o; };
  const fits=c=>c.every(k=>{ const [x,y]=k.split(',').map(Number); return x<=4&&y<=4&&!occ.has(k); });
  const rest=[]; for(const it of idols){ const [w,h]=size(it); const c=it.gx>=0&&it.gy>=0?cells(it.gx,it.gy,w,h):null; if(c&&fits(c)){ c.forEach(k=>occ.add(k)); pos.set(it,[it.gx,it.gy]); } else rest.push(it); }
  rest.sort((a,b)=>{ const [aw,ah]=size(a),[bw,bh]=size(b); return bw*bh-aw*ah; });
  const go=k=>{ if(k===rest.length) return true; const it=rest[k]; const [w,h]=size(it);
    for(let y=0;y<5;y++) for(let x=0;x<5;x++){ const c=cells(x,y,w,h); if(!fits(c)) continue; c.forEach(q=>occ.add(q)); pos.set(it,[x,y]); if(go(k+1)) return true; c.forEach(q=>occ.delete(q)); pos.delete(it); } return false; };
  if(!go(0)) throw new Error('The idols do not fit in the idol panel together.'); return pos; }

// build: the planner's build (currentBuild()), P: pdata, tpl: savetpl.json, name: the hero's name
function makeHero(build,P,tpl,name,opts){
  const doc=load(b64(tpl.hero)); const K=get(doc.props,'Record').kids, summ=get(K,'Summary').kids;
  const id=rnd(16); id[6]=(id[6]&0x0f)|0x40; id[8]=(id[8]&0x3f)|0x80;
  const cls=build.c||'Ranger', L=Math.max(1,Math.min(200,+build.l||1)); const app=b64(tpl.app[cls]||tpl.app.Ranger);
  setv(summ,'ID',id); setv(summ,'Name',wstr(name)); setv(summ,'ClassId',wstr(cls)); setv(summ,'Level',i32(L)); setv(summ,'Appearance',app); setv(K,'Experience',i64(xpAt(L)));
  if(get(summ,'Appearance')&&get(summ,'Appearance').kids) get(summ,'Appearance').kids=parse(new R(app));
  const bid=b=>{ const x=P.base[String(b||'').toLowerCase()]; return x?x.id:String(b||''); };
  // ---- gear
  const items=get(K,'Items'), itpl=items.elems[0], atpl=get(itpl,'Affixes').elems[0];
  const eq=(build.it||[]).filter(it=>it&&it.s&&it.b); const idols=eq.filter(it=>it.s==='Idol'); const ipos=placeIdols(idols,P);
  const taken=(build.t||[]).filter(t=>/^r60_socket_\d+$/.test(t)).map(t=>+t.split('_').pop()).sort((a,b)=>a-b);
  const runeFree=taken.filter(n=>!eq.some(it=>it.s==='DwarvenRune'&&it.gx===n));
  const mkAff=(arr,tplA)=>arr.map(a=>{ const x=clone(tplA); setv(x,'AffixId',wstr(a[0])); setv(x,'Tier',i32(+a[1]||0)); setv(x,'Value',f32(+a[2]||0)); setv(x,'Value2',f32(+a[3]||0)); setb(x,'bCrafted',a[4]===1); setb(x,'bOath83',a[4]===3); return x; });
  items.elems=eq.map(it=>{ const e=clone(itpl); setv(e,'ID',rnd(16)); setv(e,'Seed',i32(seed())); setv(e,'BaseID',wstr(bid(it.b))); setv(e,'ItemLevel',i32(+it.il||84));
    const u=it.u||''; setv(e,'Rarity',wstr(u?'Unique':(it.r||'Normal'))); setv(e,'UniqueID',wstr(u||'None')); setv(e,'Name',wstr(it.n||(P.uniq[u]?P.uniq[u].n:'')));
    setv(e,'Quality',i32(+it.q||0)); setv(e,'Forged79',i32(it.ef?1:0)); setv(e,'ForgeSpent',i32(0)); setv(e,'Look',wstr('None')); setb(e,'bLocked',false);
    const ru=(it.ru||[]).filter(Boolean); setv(e,'Sockets',i32(ru.length)); setv(e,'Runes',strarr(ru));
    let gx=-1, gy=-1; if(it.s==='Idol'){ [gx,gy]=ipos.get(it); } else if(it.s==='DwarvenRune'){ gx=it.gx>=0?it.gx:(runeFree.length?runeFree.shift():0); }
    setv(e,'EquippedSlot',wstr(it.s)); setv(e,'GridX',i32(gx)); setv(e,'GridY',i32(gy));
    get(e,'Affixes').elems=mkAff(it.a||[],atpl); return e; });
  const mh=eq.find(it=>it.s==='MainHand'); setv(K,'WeaponId',wstr(mh?(mh.u?'u_'+mh.u:bid(mh.b).toLowerCase()):''));
  // ---- tree and Dragonling
  setv(K,'PassiveNodeIds',strarr(build.t||[])); setv(K,'DragonlingNodes',strarr(build.dn||[])); if(build.as) setv(K,'DragonlingAspect',wstr(build.as));
  // ---- skills: the build's sockets, plus a bare socket for every other skill on the bar
  const socks=get(K,'Sockets'), stpl=socks.elems[0]; const so=(build.so||[]).filter(x=>x&&x.k);
  // the bar: the build's bar plus every buff it counts (Heralds, Woes, Death Sentence...), so the game runs what the planner counted
  const bar=[...new Set([...(build.hb||[]),...(Array.isArray(build.ab)?build.ab:[])].filter(Boolean))].slice(0,13);
  const want=so.map(x=>[x.k,(x.s||[]).filter(Boolean),x.c||'']).concat(bar.filter(k=>!so.some(x=>x.k===k)).map(k=>[k,[],'']));
  socks.elems=want.map(([k,sups,link])=>{ const e=clone(stpl); setv(e,'SkillId',wstr(k)); setv(e,'Supports',strarr(sups.concat(Array(6).fill('')).slice(0,6))); setv(e,'ConduitLink',wstr(link)); return e; });
  const gems=readArr(get(K,'Gems')); for(const [k] of want) if(!gems.includes(k)) gems.push(k); setv(K,'Gems',strarr(gems));
  const sg=readArr(get(K,'SupportGems')); const low=new Set(sg.map(x=>x.toLowerCase())); for(const [,sups] of want) for(const s of sups) if(!low.has(s.toLowerCase())){ sg.push(s); low.add(s.toLowerCase()); } setv(K,'SupportGems',strarr(sg));
  setv(K,'Hotbar',strarr(bar.concat(Array(13).fill('')).slice(0,13).map(x=>x||'')));
  const gl=readMap(get(K,'GemLevels')); const bgl={...Object.fromEntries(want.map(([k])=>[k,20])),...(build.gl||{})}; // the planner plays a skill with no level set at 20
  for(const [k,v] of Object.entries(bgl)) gl.set(k,Math.max(gl.get(k)||1,+v||1)); setv(K,'GemLevels',writeMap(gl));
  // ---- potions: into the satchel and the four potion slots (Life, Mana, Utility 1, Utility 2)
  const ps=get(K,'PotionSatchel79'), ptpl=ps.elems[0], patpl=get(ptpl,'Affixes').elems[0]; const ORDER=['LifeFlask','ManaFlask','UtilityPotion1','UtilityPotion2']; const slots=[0,1,2,3].map(()=>new Uint8Array(16));
  ps.elems=(build.pot||[]).filter(p=>p&&p.b).map(pt=>{ const e=clone(ptpl), gid=rnd(16); setv(e,'ID',gid); setv(e,'Seed',i32(seed())); setv(e,'BaseID',wstr({life:'Life',mana:'Mana'}[pt.b]||pt.b));
    setv(e,'ItemLevel',i32(+pt.il||84)); setv(e,'Rarity',wstr(pt.r||'Magic')); setv(e,'UniqueID',wstr(pt.u||'None')); setv(e,'Look',wstr(pt.v||'oathbound')); setv(e,'Quality',i32(+pt.q||0)); setv(e,'EquippedSlot',wstr('None'));
    get(e,'Affixes').elems=mkAff(pt.a||[],patpl); const i=ORDER.indexOf(pt.s); if(i>=0) slots[i]=gid; return e; });
  setv(K,'PotionSlots79',cat([i32(4),...slots]));
  // ---- gold and materials: the stash wallet is shared by every hero; a hero holds a copy. A new hero holds nothing unless rich.
  // with a stash, the hero holds exactly what the raised wallet holds (wallet: opts.wallet from walletOf), so the game sees no difference to add or take away
  const rich=!!(opts&&opts.rich), W=opts&&opts.wallet; setv(K,'gold',i64(rich?(W?W.gold:BigInt(RICH.gold)):0n));
  const rm=get(K,'RiftMap'); if(rm&&rm.kids){ const fm=get(rm.kids,'ForgeMats'); if(fm) fm.raw=writeMap(new Map(rich?(W?[...W.mats]:MATS.map(m=>[m,RICH.mats])):[])); const dd=get(rm.kids,'DwarvenDust'); if(dd) dd.raw=i32(rich?RICH.mats:0); }
  const bytes=save(doc); load(bytes); // read it back to be sure it is whole
  // ---- the hero-list entry for BO_Account.sav
  const entry=parse(new R(b64(tpl.entry))); setv(entry,'ID',id); setv(entry,'Name',wstr(name)); setv(entry,'ClassId',wstr(cls)); setv(entry,'Level',i32(L));
  const ea=get(entry,'Appearance'); if(ea){ ea.raw=app; if(ea.kids) ea.kids=parse(new R(app)); }
  const lp=get(entry,'LastPlayedUtc'); if(lp) lp.raw=i64(BigInt(Date.now())*10000n+621355968000000000n);
  return {bytes,file:'BO_Char_'+guidName(id)+'.sav',hid:guidName(id),entry,name,level:L,cls,rich};
}
function addToAccount(buf,hero){ const doc=load(buf); const ch=get(doc.props,'Characters'); if(!ch||!ch.elems) throw new Error('No hero list in that file. Pick BO_Account.sav.');
  const names=ch.elems.map(x=>sval(get(x,'Name'))); ch.elems.push(hero.entry); const out=save(doc); load(out); return {bytes:out,names}; }
// the stash wallet after raising it to 10,000,000 gold and 999 of each material (keeps anything already higher)
function walletOf(buf){ const doc=load(buf); const wg=get(doc.props,'WalletGold'), wm=get(doc.props,'WalletMats'); if(!wg||!wm) throw new Error('That is not a stash file. Pick BO_Stash_Standard.sav.');
  const g0=new DataView(wg.raw.buffer,wg.raw.byteOffset).getBigInt64(0,true); const mats=readMap(wm); for(const m of MATS) mats.set(m,Math.max(mats.get(m)||0,RICH.mats)); return {gold:g0>BigInt(RICH.gold)?g0:BigInt(RICH.gold),mats}; }
function fillStash(buf,hero){ const doc=load(buf); const P_=n=>get(doc.props,n); const wg=P_('WalletGold'), wm=P_('WalletMats'), ws=P_('WalletSeen');
  if(!wg||!wm) throw new Error('That is not a stash file. Pick BO_Stash_Standard.sav.');
  const g0=new DataView(wg.raw.buffer,wg.raw.byteOffset).getBigInt64(0,true); const gold=g0>BigInt(RICH.gold)?g0:BigInt(RICH.gold); wg.raw=i64(gold);
  const mats=readMap(wm); for(const m of MATS) mats.set(m,Math.max(mats.get(m)||0,RICH.mats)); wm.raw=writeMap(mats);
  if(ws){ const seen=readMap64(ws); seen.set(hero.hid,gold); for(const [m,v] of mats) seen.set(hero.hid+'|'+m,BigInt(v)); ws.raw=writeMap64(seen); }
  const out=save(doc); load(out); return {bytes:out,gold:Number(gold),mats:Object.fromEntries(mats)}; }
// one download holding every file, so the browser can't rename or block any of them (stored zip, no compression)
function zip(files){ const parts=[], cen=[]; let off=0; const d=new Date(), dt=((d.getFullYear()-1980)<<25)|((d.getMonth()+1)<<21)|(d.getDate()<<16)|(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1);
  const u16=v=>{ const o=new Uint8Array(2); new DataView(o.buffer).setUint16(0,v,true); return o; }, u32=v=>{ const o=new Uint8Array(4); new DataView(o.buffer).setUint32(0,v>>>0,true); return o; };
  for(const [name,data] of files){ const n=te.encode(name), c=crc32(data);
    const loc=cat([u32(0x04034b50),u16(20),u16(0),u16(0),u32(dt),u32(c),u32(data.length),u32(data.length),u16(n.length),u16(0),n]); parts.push(loc,data);
    cen.push(cat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u32(dt),u32(c),u32(data.length),u32(data.length),u16(n.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off),n])); off+=loc.length+data.length; }
  const cd=cat(cen); return cat([...parts,cd,u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(off),u16(0)]); }
window.BOSave={makeHero,addToAccount,fillStash,walletOf,zip,xpAt};
})();
