import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

/* ── DOM / canvas / map stubs ─────────────────────────────── */
const E = {};
const mkEl = (id='') => ({ id, innerHTML:'', textContent:'', value:'', hidden:false, disabled:false,
  dataset:{}, style:{},
  classList:{ _s:new Set(),
    add(...c){c.forEach(x=>this._s.add(x))}, remove(...c){c.forEach(x=>this._s.delete(x))},
    toggle(c,v){ v===undefined ? (this._s.has(c)?this._s.delete(c):this._s.add(c)) : (v?this._s.add(c):this._s.delete(c)); },
    contains(c){return this._s.has(c)}, set className(v){}, },
  set className(v){ this._cn=v; }, get className(){ return this._cn||''; },
  addEventListener(ev,fn){ (this._h=this._h||{})[ev]=fn; },
  querySelector(sel){ if(sel==='em') return this._em||(this._em=mkEl('em'));
                      if(sel==='i') return this._i||(this._i=mkEl('i'));
                      if(sel==='span') return this._sp||(this._sp=mkEl('span'));
                      return mkEl('x'); },
  querySelectorAll(){ return []; },
  getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800}),
  getContext:()=>({}), focus(){}, blur(){}, remove(){},
});
const MODES = ['drive','transit','bike','walk'].map(m => { const e = mkEl('mode-'+m); e.dataset.mode = m; return e; });
globalThis.document = {
  hidden:false,
  documentElement:{ setAttribute(){}, },
  getElementById: id => E[id] || (E[id] = mkEl(id)),
  createElement: () => mkEl('tmp'),
  querySelectorAll: sel => sel === '.mode' ? MODES : [],
  querySelector: sel => { const m = /data-mode="([a-z]+)"/.exec(sel); return m ? MODES.find(x=>x.dataset.mode===m[1]) : mkEl('q'); },
  addEventListener(){},
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.innerWidth = 1280; globalThis.innerHeight = 800;
globalThis.location = { protocol:'https:' };
const LS = {};
globalThis.localStorage = { getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>LS[k]=String(v) };
Object.defineProperty(globalThis, 'navigator', { configurable:true, writable:true, value:{
  onLine:true,
  geolocation:{ getCurrentPosition(ok){ ok({coords:{latitude:35.2271,longitude:-80.8431,speed:11,heading:90}}); },
                watchPosition(){ return 7; }, clearWatch(){} } } });
let RAFQ = new Map(), rid = 0;
globalThis.requestAnimationFrame = fn => { RAFQ.set(++rid, fn); return rid; };
globalThis.cancelAnimationFrame = id => RAFQ.delete(id);
class FakeMap {
  constructor(){ this.src={}; this.lay={}; this.pitch=0; }
  on(){} once(){} addControl(){} getCanvas(){ return {style:{}}; }
  addSource(id,s){ this.src[id]={...s,_data:null}; }
  getSource(id){ const s=this.src[id]; return s?{setData(d){s._data=d}}:undefined; }
  removeSource(id){ delete this.src[id]; }
  addLayer(l){ this.lay[l.id]=l; } getLayer(id){ return this.lay[id]; } removeLayer(id){ delete this.lay[id]; }
  getStyle(){ return { layers:[{id:'water',type:'fill'},{id:'poi-label',type:'symbol'}] }; }
  getCenter(){ return {lat:35.2271,lng:-80.8431}; } getZoom(){ return 12; } getPitch(){ return this.pitch; }
  getBearing(){ return 0; }
  flyTo(){} easeTo(o){ if(o&&o.pitch!=null) this.pitch=o.pitch; } fitBounds(o){ this._fit=o; }
  setStyle(){} queryRenderedFeatures(){ return []; }
}
globalThis.maplibregl = { Map: FakeMap,
  Marker: class { constructor(){} setLngLat(){return this} addTo(){return this} remove(){} },
  ScaleControl: class {} };

/* ── encoded polylines for the mocks ──────────────────────── */
function enc(pts, precision=6){
  const f = Math.pow(10, precision);
  let lat=0, lon=0, out='';
  const v = n => { n = n<0 ? ~(n<<1) : (n<<1); let s='';
    while(n>=0x20){ s += String.fromCharCode((0x20|(n&0x1f))+63); n >>= 5; }
    return s + String.fromCharCode(n+63); };
  for(const [x,y] of pts){ const la=Math.round(y*f), lo=Math.round(x*f);
    out += v(la-lat) + v(lo-lon); lat=la; lon=lo; }
  return out;
}
const SEG1 = [[-80.8431,35.2271],[-80.8420,35.2260]];
const SEG2 = [[-80.8420,35.2260],[-80.8470,35.2050],[-80.8456,35.1960]];
const SEG3 = [[-80.8456,35.1960],[-80.8456,35.1924]];
const T0 = '2026-11-07T16:42:00Z', T1='2026-11-07T16:48:00Z', T2='2026-11-07T17:06:00Z', T3='2026-11-07T17:15:00Z';

const MOCK = {
  photon:{ features:[
    { properties:{ name:'Freedom Park', housenumber:'1900', street:'East Blvd', city:'Charlotte', state:'North Carolina', country:'United States' },
      geometry:{ coordinates:[-80.8456,35.1924] } },
    { properties:{ name:'Freedom Park Bandshell', city:'Charlotte', state:'North Carolina', country:'United States' },
      geometry:{ coordinates:[-80.8460,35.1930] } } ] },
  osrm:{ code:'Ok', routes:[
    { distance:9100, duration:1010,
      geometry:{ type:'LineString', coordinates: SEG1.concat(SEG2) },
      legs:[{ steps:[
        { distance:900, name:'I-277', maneuver:{ type:'depart', bearing_after:90, location:[-80.8431,35.2271] } },
        { distance:5200, name:'I-277', maneuver:{ type:'merge', modifier:'right', location:[-80.8420,35.2260] } },
        { distance:0, name:'', maneuver:{ type:'arrive', location:[-80.8456,35.1924] } } ] }] },
    { distance:7400, duration:905,
      geometry:{ type:'LineString', coordinates: SEG2 },
      legs:[{ steps:[
        { distance:4000, name:'Park Rd', maneuver:{ type:'depart', bearing_after:180, location:[-80.8431,35.2271] } },
        { distance:0, name:'', maneuver:{ type:'arrive', location:[-80.8456,35.1924] } } ] }] },
    { distance:6823.4, duration:842.1,
    geometry:{ type:'LineString', coordinates: SEG1.concat(SEG2) },
    legs:[{ steps:[
      { distance:640, name:'S Tryon St', maneuver:{ type:'depart', bearing_after:184, location:[-80.8431,35.2271] } },
      { distance:1770, name:'E Morehead St', maneuver:{ type:'turn', modifier:'right', location:[-80.8420,35.2260] } },
      { distance:3100, name:'East Blvd', maneuver:{ type:'turn', modifier:'left', location:[-80.8470,35.2050] } },
      { distance:0, name:'', maneuver:{ type:'arrive', location:[-80.8456,35.1924] } } ] }] }] },
  valhalla:{ trip:{ summary:{ length:2.6, time:1980 }, legs:[{ shape: enc(SEG1.concat(SEG2),6),
    maneuvers:[
      { instruction:'Walk south on South Tryon Street.', length:0.4, street_names:['South Tryon Street'], begin_shape_index:0 },
      { instruction:'Turn right onto East Morehead Street.', length:1.1, street_names:['East Morehead Street'], begin_shape_index:1 },
      { instruction:'You have arrived at your destination.', length:0, begin_shape_index:3 } ] }] },
    alternates:[{ trip:{ summary:{ length:3.1, time:2300 }, legs:[{ shape: enc(SEG2,6),
      maneuvers:[
        { instruction:'Walk along the greenway.', length:3.1, street_names:['Little Sugar Creek Greenway'], begin_shape_index:0 },
        { instruction:'You have arrived.', length:0, begin_shape_index:2 } ] }] } }] },
  valhallaStatus:{ version:'3.5.1-0d04136' },
  motis:{ itineraries:[
    { duration:1980, startTime:T0, endTime:T3, legs:[
      { mode:'WALK', from:{name:'Your location'}, to:{name:'Tryon St & 5th St'},
        startTime:T0, endTime:T1, duration:360, distance:430, legGeometry:{points:enc(SEG1,6),precision:6} },
      { mode:'BUS', routeShortName:'11', headsign:'Freedom Dr', routeColor:'1f6feb',
        from:{name:'Tryon St & 5th St', stopId:'us-cats_1234'}, to:{name:'East Blvd & Dilworth Rd'},
        startTime:T1, endTime:T2, scheduledStartTime:'2026-11-07T16:44:00Z', realTime:true,
        duration:1080, distance:5200, legGeometry:{points:enc(SEG2,6),precision:6} },
      { mode:'WALK', from:{name:'East Blvd & Dilworth Rd'}, to:{name:'Freedom Park'},
        startTime:T2, endTime:T3, duration:540, distance:610, legGeometry:{points:enc(SEG3,6),precision:6} } ] },
    { duration:2400, startTime:T0, endTime:T3, legs:[
      { mode:'WALK', from:{name:'Your location'}, to:{name:'Stonewall St'},
        startTime:T0, endTime:T1, duration:400, distance:500, legGeometry:{points:enc(SEG1,6),precision:6} },
      { mode:'LIGHT_RAIL', routeShortName:'Blue Line', headsign:'I-485', routeColor:'1e88e5',
        from:{name:'Stonewall St'}, to:{name:'East/West Blvd'},
        startTime:T1, endTime:T2, duration:1200, distance:4800, legGeometry:{points:enc(SEG2,6),precision:6} },
      { mode:'WALK', from:{name:'East/West Blvd'}, to:{name:'Freedom Park'},
        startTime:T2, endTime:T3, duration:800, distance:900, legGeometry:{points:enc(SEG3,6),precision:6} } ] } ] },
  stoptimes:{ stopTimes:[
    { routeShortName:'11', headsign:'Freedom Dr', mode:'BUS', realTime:true,
      place:{ departure:'2026-11-07T16:52:00Z', scheduledDeparture:'2026-11-07T16:50:00Z' } },
    { routeShortName:'6', headsign:'Uptown', mode:'BUS', realTime:true,
      place:{ departure:'2026-11-07T16:58:00Z', scheduledDeparture:'2026-11-07T16:58:00Z' } },
    { routeShortName:'Blue', headsign:'I-485', mode:'LIGHT_RAIL', realTime:true, cancelled:false,
      place:{ departure:'2026-11-07T17:03:00Z', scheduledDeparture:'2026-11-07T17:05:00Z' } },
    { routeShortName:'9', headsign:'Airport', mode:'BUS', realTime:true, tripCancelled:true,
      place:{ departure:'2026-11-07T17:10:00Z', scheduledDeparture:'2026-11-07T17:10:00Z' } } ] },
  tomtom:{ incidents:[{type:'Feature'},{type:'Feature'},{type:'Feature'}] },
  style:{ layers:new Array(42).fill({}) }
};
const seen = [];
let failTransit = false;
globalThis.fetch = async (url, opt) => {
  const u = String(url); seen.push(u.split('?')[0]);
  let body = {};
  if(u.includes('photon')) body = MOCK.photon;
  else if(u.includes('project-osrm')) body = MOCK.osrm;
  else if(u.includes('valhalla') && u.includes('/status')) body = MOCK.valhallaStatus;
  else if(u.includes('valhalla')) body = MOCK.valhalla;
  else if(u.includes('transitous') && u.includes('stoptimes')) body = MOCK.stoptimes;
  else if(u.includes('transitous')) body = failTransit ? { itineraries:[] } : MOCK.motis;
  else if(u.includes('tomtom')) body = MOCK.tomtom;
  else if(u.includes('openfreemap')) body = MOCK.style;
  globalThis.__last = u;
  return { ok:true, status:200, json: async () => body };
};

const probe = `;globalThis.T = { fmtDist, fmtDur, fmtShort, decodePoly, geocode, routeDrive, routeValhalla,
  routeTransit, planMode, planAll, renderOptions, paintRoute, systemCheck, startNav, navStep, endNav, advance,
  setPlace, trip, SERVICES, hav, addLayers, paintAlts, viaLabel, departures, refreshDepartures, emptyState,
  setOptions:(o,c)=>{ options=o; current=c; },
  get options(){return options}, get current(){return current}, get nav(){return nav}, set nav(v){nav=v},
  get map(){return map}, get me(){return me}, set me(v){me=v}, set following(v){following=v},
  set mode(v){mode=v}, get mode(){return mode}, set ttKey(v){ttKey=v} };`;
let ok = true;
const chk = (cond, msg) => { if(!cond){ console.log('  ✗ ' + msg); ok = false; } };

try { new Function(app + probe)(); } catch(e){ console.log('APP THREW ON LOAD:', e.message); process.exit(1); }
console.log('app loaded with no exception');
const T = globalThis.T;

/* ── formatting ───────────────────────────────────────────── */
console.log('\n── formatting');
console.log('  ', [45,160,1200,6823,160000].map(m=>T.fmtDist(m)).join(' | '));
console.log('  ', [40,95,842,3600,7320].map(s=>T.fmtDur(s)).join(' | '));
chk(T.fmtDur(3600)==='1 hr', 'fmtDur(3600) should be "1 hr", got ' + T.fmtDur(3600));

/* ── polyline ─────────────────────────────────────────────── */
const rt = T.decodePoly(enc(SEG2,6), 6);
const err = Math.max(...rt.map((p,i)=>Math.max(Math.abs(p[0]-SEG2[i][0]), Math.abs(p[1]-SEG2[i][1]))));
console.log('\n── polyline: ' + rt.length + ' pts, max error ' + err.toExponential(1));
chk(rt.length===SEG2.length && err < 1e-6, 'polyline round-trip');

/* ── search ───────────────────────────────────────────────── */
const hits = await T.geocode('freedom park');
console.log('\n── search');
hits.forEach(h => console.log('   ' + h.name + ' — ' + h.detail));
chk(hits[0].name === 'Freedom Park', 'first search hit');

/* ── drive ────────────────────────────────────────────────── */
const A = { lat:35.2271, lon:-80.8431 }, B = { lat:35.1924, lon:-80.8456 };
const drives = await T.routeDrive(A,B);
const d = drives[0];
console.log('\n── drive: ' + drives.length + ' alternatives');
drives.forEach((r,i) => console.log('   ' + (i+1) + ') ' + T.fmtDur(r.duration).padEnd(10) +
  T.fmtDist(r.distance).padEnd(9) + (r.via || '')));
chk(drives.length===3, 'three driving alternatives, got ' + drives.length);
chk(drives[0].duration <= drives[1].duration && drives[1].duration <= drives[2].duration,
    'alternatives sorted fastest first');
chk(/via /.test(drives[1].via), 'alternative carries a via label, got ' + JSON.stringify(drives[1].via));
console.log('   fastest steps:');
d.legs[0].steps.forEach(s => console.log('     • ' + s.text));
chk(d.legs[0].steps.length===4 && /Head south/.test(d.legs[0].steps[0].text), 'drive steps');

/* ── walk / bike ──────────────────────────────────────────── */
const walks = await T.routeValhalla(A,B,'pedestrian');
const w = walks[0];
const bk = (await T.routeValhalla(A,B,'bicycle'))[0];
console.log('\n── walk: ' + walks.length + ' options, fastest ' + T.fmtDur(w.duration) +
  ' / ' + T.fmtDist(w.distance) + ' ' + (w.via||''));
chk(walks.length===2, 'valhalla alternate parsed, got ' + walks.length);
console.log('── bike: kind ' + bk.legs[0].kind + ', colour ' + bk.legs[0].color);
chk(w.legs[0].kind==='WALK' && bk.legs[0].kind==='BIKE', 'walk/bike leg kinds');
chk(w.legs[0].steps[1].lat != null, 'valhalla maneuver coordinates resolved from shape index');

/* ── transit ──────────────────────────────────────────────── */
const tr = await T.routeTransit(Object.assign({name:'Uptown'},A), Object.assign({name:'Freedom Park'},B));
console.log('\n── transit: ' + tr.length + ' itineraries');
tr.forEach((it,i) => {
  const chain = it.legs.map(l => l.kind==='WALK' ? 'walk' : (l.vehicle+' '+l.line)).join(' › ');
  console.log('   ' + (i+1) + ') ' + T.fmtDur(it.duration) + '  ' + chain + '  transfers=' + it.transfers);
});
chk(tr.length===2, 'two transit itineraries');
chk(tr[0].legs[1].vehicle==='Bus' && tr[0].legs[1].line==='11', 'bus leg named');
chk(tr[1].legs[1].vehicle==='Light rail', 'LIGHT_RAIL maps to Light rail, got ' + tr[1].legs[1].vehicle);
chk(tr[0].transfers===0, 'single transit leg means 0 transfers, got ' + tr[0].transfers);
chk(tr[0].legs[0].coords.length===2, 'walk leg geometry decoded');
chk(tr[0].legs[1].color==='#1f6feb', 'route colour honoured, got ' + tr[0].legs[1].color);
chk(tr[0].legs[2].toName==='Freedom Park' || tr[0].legs[2].toName==='your destination',
    'MOTIS END placeholder replaced, got ' + tr[0].legs[2].toName);
chk(Math.round(tr[0].walkDistance)===1040, 'walking distance summed from walk legs only, got ' + Math.round(tr[0].walkDistance));
console.log('   itinerary 1 walking: ' + T.fmtDist(tr[0].walkDistance) + ' of ' + T.fmtDist(tr[0].distance) + ' total');
const arrOrder = tr.map(x => +new Date(x.arrive));
chk(arrOrder.every((v,i)=>i===0||v>=arrOrder[i-1]), 'itineraries sorted by arrival time');
console.log('   arrival order: ' + tr.map(x=>new Date(x.arrive).toISOString().slice(11,16)).join(' , '));

/* ── real-time delays ─────────────────────────────────────── */
console.log('\n── real-time');
const busLeg = tr.find(x => x.legs.some(l => l.realTime)).legs.find(l => l.realTime);
console.log('   ' + busLeg.vehicle + ' ' + busLeg.line + ': scheduled ' +
  new Date(busLeg.schedStart).toISOString().slice(11,16) + ', actual ' +
  new Date(busLeg.startTime).toISOString().slice(11,16) + ' -> ' + busLeg.delay + ' min late');
chk(busLeg.delay === 4, 'delay computed from scheduled vs actual, got ' + busLeg.delay);
chk(tr.some(x => x.live), 'itinerary flagged as carrying live data');

/* ── live departure board ─────────────────────────────────── */
const board = await T.departures('us-cats_1234', 'Tryon St & 5th St');
console.log('\n── departure board at ' + board.name);
board.rows.forEach(r => console.log('   ' + String(r.line).padEnd(6) + (r.cancelled?'CANCELLED ':'') +
  new Date(r.when).toISOString().slice(11,16) +
  (r.delay ? '  ' + (r.delay>0?'+':'') + r.delay + ' min' : '  on time') + '   ' + r.headsign));
chk(board.rows.length === 4, 'four live departures parsed, got ' + board.rows.length);
chk(board.rows.every(r => r.realTime), 'realTime read from the entry, not from place');
chk(board.rows[3].cancelled === true, 'cancelled trip detected');
chk(board.rows[0].delay === 2, 'departure delay computed, got ' + board.rows[0].delay);
chk(board.rows[1].delay === 0, 'punctual departure reads zero, got ' + board.rows[1].delay);
chk(board.rows[2].delay === -2, 'early departure reads negative, got ' + board.rows[2].delay);

/* ── empty state tells you what to do ─────────────────────── */
T.emptyState();
const eh = document.getElementById('results').innerHTML;
chk(/Where are you going/.test(eh) && /tap anywhere on the map/i.test(eh), 'empty state guides the user');
console.log('\n── empty state present');

/* ── all four modes in parallel ───────────────────────────── */
console.log('\n── planning all modes');
T.setPlace('from', { name:'Your location', lat:A.lat, lon:A.lon });
T.setPlace('to',   { name:'Freedom Park',  lat:B.lat, lon:B.lon });
await T.planAll();
const tabs = {};
document.querySelectorAll('.mode').forEach(el => tabs[el.dataset.mode] = el.querySelector('em').textContent);
console.log('   tab ETAs:', JSON.stringify(tabs));
chk(Object.values(tabs).every(v => v && v !== ''), 'every mode tab shows an ETA');
chk(/m$/.test(tabs.drive), 'drive tab shows a duration, got ' + tabs.drive);

/* ── rendered output ──────────────────────────────────────── */
T.mode = 'transit';
globalThis.T.nav = null;
const opts = await T.planMode('transit');
console.log('\n── transit rendering');
const html = (()=>{ const o = T.options; return ''; })();
chk(opts.length===2, 'planMode transit returns itineraries');

/* ── map layers + geometry painted ────────────────────────── */
T.addLayers();                       // the stub never fires map 'load'
T.paintRoute(tr[0]);
const routeData = T.map.src['route']._data;
const stopData  = T.map.src['stops']._data;
console.log('   route features: ' + routeData.features.length +
  ' (walk flags: ' + routeData.features.map(f=>f.properties.walk?'W':'T').join('') + ')');
console.log('   transit stop dots: ' + stopData.features.length);
chk(routeData.features.length===3, 'three leg features painted');
chk(stopData.features.length===2, 'board and alight dots');
chk(['route-case','route-line','route-walk','stops','alts'].every(l => T.map.lay[l]), 'all route layers registered');

/* ── alternatives drawn greyed behind the choice ──────────── */
T.mode = 'drive';
const dopts = await T.planMode('drive');
T.setOptions(dopts, dopts[0]);
T.paintRoute(dopts[0]);
const altData = T.map.src['alts']._data;
console.log('\n── alternatives on the map: ' + altData.features.length + ' greyed, 1 highlighted');
chk(altData.features.length===2, 'the two unchosen routes are drawn greyed, got ' + altData.features.length);

/* ── no-transit path ──────────────────────────────────────── */
failTransit = true;
let msg='';
try { await T.routeTransit(A,B); } catch(e){ msg = e.message; }
console.log('\n── no transit coverage -> ' + msg);
chk(msg==='NO_TRANSIT', 'empty itineraries raise NO_TRANSIT');
failTransit = false;

/* ── turn by turn ─────────────────────────────────────────── */
console.log('\n── navigation');
T.startNav(d);
console.log('   start: step ' + (T.nav.i+1) + ' — ' + E['navInstr'].textContent + ' in ' + E['navDist'].textContent);
console.log('   arrive ' + E['navEta'].textContent + ', left ' + E['navLeft'].textContent);
T.navStep(1);
chk(T.nav.i===1, 'manual next');
T.navStep(-1); chk(T.nav.i===0, 'manual back');
T.me = { lat:d.legs[0].steps[1].lat, lon:d.legs[0].steps[1].lon };
T.following = true; T.advance();
console.log('   GPS at maneuver 2 -> step ' + (T.nav.i+1));
chk(T.nav.i===2, 'gps advance moves past a reached maneuver, got ' + T.nav.i);
T.me = { lat:d.legs[0].steps[0].lat, lon:d.legs[0].steps[0].lon }; T.advance();
chk(T.nav.i===2, 'gps jitter must not rewind');
T.endNav(); chk(E['nav'].hidden===true, 'nav closes');

/* ── system check ─────────────────────────────────────────── */
console.log('\n── system check');
const svcList = document.getElementById('svcList');
const rows = {};
svcList.querySelector = sel => { const m=/data-svc="([a-z]+)"/.exec(sel); if(!m) return mkEl('x');
  return rows[m[1]] || (rows[m[1]] = mkEl('row-'+m[1])); };
T.ttKey = 'TESTKEY';
const bad = await T.systemCheck();
for(const s of T.SERVICES){ const r = rows[s.id];
  console.log('   ' + s.id.padEnd(9) + (r.querySelector('i').className||'soft').padEnd(6) + r.querySelector('span').textContent); }
console.log('   failing: ' + bad);
chk(bad===0, 'no hard failures with all mocks healthy');

console.log('\nhosts: ' + [...new Set(seen)].join('\n       '));
console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
