import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

/* ── DOM / canvas / map stubs ─────────────────────────────── */
const E = {};
const mkEl = (id='') => ({ id, innerHTML:'', textContent:'', value:'', hidden:false, disabled:false,
  dataset:{},
  style:{ _v:{}, setProperty(k,v){ this._v[k]=v; }, getPropertyValue(k){ return this._v[k]||''; },
          removeProperty(k){ delete this._v[k]; } },
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
globalThis.matchMedia = q => ({ matches:/max-width:760px/.test(q) ? !!globalThis.__phone : false,
  media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
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
globalThis.localStorage = { getItem:k=>k in LS?LS[k]:null, setItem:(k,v)=>LS[k]=String(v),
  removeItem:k=>{ delete LS[k]; } };
Object.defineProperty(globalThis, 'navigator', { configurable:true, writable:true, value:{
  onLine:true,
  geolocation:{
    mode:'ok',          // 'ok' | 'timeout' | 'precise-timeout' | 'denied'
    calls:[],
    getCurrentPosition(ok, err, opts){
      this.calls.push(opts && opts.enableHighAccuracy ? 'precise' : 'coarse');
      const m = this.mode;
      if(m === 'denied') return err({ code:1, message:'User denied Geolocation' });
      if(m === 'timeout') return err({ code:3, message:'Timeout expired' });
      if(m === 'precise-timeout' && opts && opts.enableHighAccuracy)
        return err({ code:3, message:'Timeout expired' });
      ok({ coords:{ latitude:35.2271, longitude:-80.8431, speed:11, heading:90 } });
    },
    watchPosition(){ return 7; }, clearWatch(){} } } });
const SPOKEN = [];
globalThis.SpeechSynthesisUtterance = class { constructor(t){ this.text = t; } };
globalThis.speechSynthesis = { cancel(){}, speak(u){ SPOKEN.push(u.text); } };
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
  getBounds(){ return { getWest:()=>-80.95, getSouth:()=>35.15, getEast:()=>-80.75, getNorth:()=>35.31 }; }
  getBearing(){ return 0; }
  flyTo(){} easeTo(o){ if(o&&o.pitch!=null) this.pitch=o.pitch; if(o&&o.center) this._ease=o; } fitBounds(o){ this._fit=o; }
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
  ttroute:{ routes:[
    { summary:{ lengthInMeters:9100, travelTimeInSeconds:1200, noTrafficTravelTimeInSeconds:1010,
        trafficDelayInSeconds:190, departureTime:'2026-11-07T16:42:00-05:00',
        arrivalTime:'2026-11-07T17:02:00-05:00' },
      legs:[{ points: SEG1.concat(SEG2).map(([x,y]) => ({ latitude:y, longitude:x })) }],
      sections:[{ sectionType:'TRAFFIC', startPointIndex:1, endPointIndex:2,
        delayInSeconds:190, magnitudeOfDelay:3, simpleCategory:'JAM' }],
      guidance:{ instructions:[
        { routeOffsetInMeters:0, travelTimeInSeconds:0, point:{latitude:35.2271,longitude:-80.8431},
          street:'S Tryon St', maneuver:'DEPART', message:'Leave from S Tryon St' },
        { routeOffsetInMeters:900, travelTimeInSeconds:220, point:{latitude:35.2260,longitude:-80.8420},
          street:'I-277', maneuver:'TURN_RIGHT', message:'Turn right onto I-277' },
        { routeOffsetInMeters:9100, travelTimeInSeconds:1200, point:{latitude:35.1924,longitude:-80.8456},
          maneuver:'ARRIVE', message:'You have arrived' } ] } },
    { summary:{ lengthInMeters:11200, travelTimeInSeconds:1500, noTrafficTravelTimeInSeconds:1480,
        trafficDelayInSeconds:20, arrivalTime:'2026-11-07T17:07:00-05:00' },
      legs:[{ points: SEG2.map(([x,y]) => ({ latitude:y, longitude:x })) }],
      guidance:{ instructions:[
        { routeOffsetInMeters:0, point:{latitude:35.2260,longitude:-80.8420}, street:'Park Rd',
          maneuver:'DEPART', message:'Leave from Park Rd' },
        { routeOffsetInMeters:11200, point:{latitude:35.1924,longitude:-80.8456},
          maneuver:'ARRIVE', message:'You have arrived' } ] } },
    { summary:{ lengthInMeters:12800, travelTimeInSeconds:1620, noTrafficTravelTimeInSeconds:1600,
        trafficDelayInSeconds:20, arrivalTime:'2026-11-07T17:09:00-05:00' },
      legs:[{ points: SEG1.concat(SEG2).map(([x,y]) => ({ latitude:y, longitude:x })) }],
      guidance:{ instructions:[
        { routeOffsetInMeters:0, point:{latitude:35.2271,longitude:-80.8431}, street:'Independence Blvd',
          maneuver:'DEPART', message:'Leave from Independence Blvd' },
        { routeOffsetInMeters:12800, point:{latitude:35.1924,longitude:-80.8456},
          maneuver:'ARRIVE', message:'You have arrived' } ] } }] },
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
  overpass:{ elements:[
    { type:'node', lat:35.20900, lon:-80.8500, tags:{ highway:'traffic_signals' } },
    { type:'node', lat:35.22250, lon:-80.8500, tags:{ highway:'traffic_signals' } },
    { type:'node', lat:35.23350, lon:-80.8500, tags:{ highway:'stop' } },
    { type:'node', lat:35.21000, lon:-80.9900, tags:{ highway:'traffic_signals' } }   // far off route
  ] },
  tomtom:{ incidents:[
    { type:'Feature', geometry:{type:'LineString',coordinates:[[-80.84,35.22],[-80.839,35.221]]},
      properties:{ iconCategory:8, magnitudeOfDelay:4, events:[{description:'Closed'}],
        from:'S Tryon St', to:'E Morehead St', length:238, delay:0, roadNumbers:['US-74'],
        endTime:'2026-11-07T22:00:00Z' } },
    { type:'Feature', geometry:{type:'Point',coordinates:[-80.85,35.23]},
      properties:{ iconCategory:1, magnitudeOfDelay:3, events:[{description:'Accident'}],
        from:'I-277', length:120, delay:540, roadNumbers:['I-277'] } },
    null ] },
  style:{ layers:new Array(42).fill({}) }
};
const seen = [];
let failTransit = false;
let ttRouteFail = false;
globalThis.fetch = async (url, opt) => {
  const u = String(url); seen.push(u.split('?')[0]);
  let body = {};
  if(u.includes('photon')) body = MOCK.photon;
  else if(u.includes('project-osrm')) body = MOCK.osrm;
  else if(u.includes('valhalla') && u.includes('/status')) body = MOCK.valhallaStatus;
  else if(u.includes('valhalla')) body = MOCK.valhalla;
  else if(u.includes('transitous') && u.includes('stoptimes')) body = MOCK.stoptimes;
  else if(u.includes('transitous')) body = failTransit ? { itineraries:[] } : MOCK.motis;
  else if(u.includes('tomtom') && u.includes('calculateRoute')) body = ttRouteFail ? { routes:[] } : MOCK.ttroute;
  else if(u.includes('tomtom')) body = MOCK.tomtom;
  else if(u.includes('openfreemap') && u.endsWith('/planet')) body = { minzoom:0, maxzoom:14, tiles:['x'] };
  else if(u.includes('openfreemap')) body = MOCK.style;
  else if(u.includes('overpass')) body = MOCK.overpass;
  else if(u.includes('ipwho.is')) body = { latitude:35.2271, longitude:-80.8431, city:'Charlotte', region:'North Carolina' };
  else if(u.includes('ipapi.co')) body = { latitude:35.3, longitude:-80.9, city:'Backup City' };
  globalThis.__last = u;
  return { ok:true, status:200, json: async () => body };
};

const probe = `;globalThis.T = { fmtDist, fmtDur, fmtShort, decodePoly, geocode, routeDrive, routeValhalla,
  routeTransit, planMode, planAll, renderOptions, paintRoute, systemCheck, startNav, navStep, endNav, advance,
  setPlace, trip, SERVICES, hav, addLayers, paintAlts, viaLabel, departures, refreshDepartures, emptyState,
  needStart, recents, rememberRecent, adoptKey, get ttKeyNow(){return ttKey},
  loadIncidents, showIncident, clearIncidents, get incNow(){return incData},
  routeTomTom, routeOSRM, jamData, clock, secsLeft, isoLocal,
  get departAt(){return departAt}, set departAt(v){departAt=v}, whenLabel, setDepart,
  transitProbe, nextWeekdayMorning, renderError, set mode(v){mode=v},
  sheetStops, snapSheet, nearestStop, layoutSheet, sheetPad, applySheet,
  get sheetIdx(){return sheetIdx}, set sheetIdx(v){sheetIdx=v},
  get sheetPx(){return sheetPx}, sheetDown, sheetMove, sheetUp, isPhone,
  gpsBanner, recentreNav, arrive, paintNav, requestFix, locateNow, lastFix, ipLocate, adoptStart,
  speak, spokenDistance, spokenStep, voiceTick, bearing, pointAt, cumulative, startSim, stopSim,
  savedHome, beginPickStart, get userStartFlag(){return userStart}, set userStartFlag(v){userStart=v},
  loadSignals, snapToRoute, get signalCountNow(){return signalCount},
  get sim(){return sim},
  set trafficFlag(v){trafficOn=v},
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

/* ── pasting the key is enough, no button press ───────────── */
console.log('\n── traffic key persistence');
T.adoptKey('  PASTED-KEY-123  ');
console.log('   after paste, in use: ' + T.ttKeyNow + ' | stored: ' + localStorage.getItem('tern.ttkey'));
chk(T.ttKeyNow === 'PASTED-KEY-123', 'key trimmed and adopted on paste alone');
chk(localStorage.getItem('tern.ttkey') === 'PASTED-KEY-123', 'key written to storage immediately');
chk(localStorage.getItem('tern.traffic') === '1', 'traffic switched on when a key arrives');

/* ── destination with no start must prompt, not stall ─────── */
T.trip.from = null;
T.setPlace('to', { name:'Freedom Park', lat:B.lat, lon:B.lon });
const ns = document.getElementById('results').innerHTML;
console.log('\n── destination set, no start point');
console.log('   panel: ' + (/Where are you starting from/.test(ns) ? 'prompts for a start point' : 'NOTHING SHOWN'));
chk(/Where are you starting from/.test(ns), 'prompts for a start instead of stalling silently');
chk(/Use my location/.test(ns), 'offers a one-tap location button');

/* ── recent destinations ──────────────────────────────────── */
const rec = T.recents();
console.log('\n── recents: ' + rec.map(r => r.name).join(', '));
chk(rec.length >= 1 && rec[0].name === 'Freedom Park', 'destination remembered for one-tap reuse');
T.trip.from = { name:'Your location', lat:A.lat, lon:A.lon };

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

/* ── live traffic incidents and closures ──────────────────── */
console.log('\n── traffic incidents');
T.trafficFlag = true;
await T.loadIncidents(true);
const inc = T.incNow;
console.log('   parsed ' + inc.features.length + ' incidents (one null dropped)');
inc.features.forEach(f => console.log('   • ' + f.properties.cat + ' · ' + f.properties.mag +
  ' · ' + f.properties.desc + ' · ' + (f.properties.road || '-') + ' · ' + f.properties.col));
chk(inc.features.length === 2, 'two incidents parsed, got ' + inc.features.length);
chk(inc.features[0].properties.cat === 'Road closed', 'closure category mapped');
chk(inc.features[1].properties.cat === 'Accident', 'accident category mapped');
chk(T.map.src['inc']._data.features.length === 2, 'incidents pushed to the map source');
chk(['inc-line','inc-pt'].every(l => T.map.lay[l]), 'incident layers registered');
T.showIncident(inc.features[0]);
const ih = document.getElementById('live').innerHTML;
chk(/Road closed/.test(ih) && /US-74/.test(ih), 'clicking an incident shows its detail');
console.log('   detail card renders road and category');
T.clearIncidents();
chk(T.map.src['inc']._data.features.length === 0, 'turning traffic off clears incidents');

/* ── no-transit path ──────────────────────────────────────── */
failTransit = true;
let msg='';
try { await T.routeTransit(A,B); } catch(e){ msg = e.message; }
console.log('\n── no transit coverage -> ' + msg);
chk(msg==='NO_TRANSIT', 'empty itineraries raise NO_TRANSIT');
failTransit = false;

/* ── navigation maths on a known route ───────────────────── */
console.log('\n── navigation');

// a straight 5 km road north, with a turn exactly halfway and arrival at the end
const line = [];
for(let i = 0; i <= 100; i++) line.push([-80.8500, 35.2000 + i * 0.00045]);
const legLen = T.cumulative(line)[100];
const route = { mode:'drive', duration:600, distance:legLen, via:'via Test Road',
  legs:[{ kind:'CAR', color:'#1f6feb', coords:line, steps:[
    { text:'Head north on Test Road',        dist:legLen/2, road:'Test Road',   lon:line[0][0],   lat:line[0][1] },
    { text:'Turn right onto Second Street',  dist:legLen/2, road:'Second Street', lon:line[50][0], lat:line[50][1] },
    { text:'Arrive at your destination',     dist:0,        road:'',           lon:line[100][0], lat:line[100][1] }
  ]}]};
console.log('   test route is ' + T.fmtDist(legLen) + ' with a turn at the midpoint');

T.trip.to = { name:'Test Destination', lat:line[100][1], lon:line[100][0] };
T.me = { lat:line[0][1], lon:line[0][0] };
T.following = true;
T.endNav(); T.startNav(route);

function at(i){ T.me = { lat:line[i][1], lon:line[i][0] }; T.paintNav(); 
  return { step:T.nav.i, toTurn:E['navDist'].textContent, left:E['navLeft'].textContent,
           pct:E['navProgressFill'].style.width, instr:E['navInstr'].textContent }; }

const p10 = at(10), p40 = at(40), p60 = at(60), p95 = at(95);
console.log('   10% along: ' + p10.instr + ' in ' + p10.toTurn + ' | ' + p10.left + ' left | ' + p10.pct);
console.log('   40% along: ' + p40.instr + ' in ' + p40.toTurn + ' | ' + p40.left + ' left | ' + p40.pct);
console.log('   60% along: ' + p60.instr + ' in ' + p60.toTurn + ' | ' + p60.left + ' left | ' + p60.pct);

// the headline figure and the remaining figure must agree with each other
const toTurn10 = parseFloat(p10.toTurn), left10 = parseFloat(p10.left);
chk(toTurn10 <= left10, 'distance to the turn never exceeds distance remaining (was the reported bug)');
chk(/Turn right/.test(p10.instr), 'shows the turn you are driving towards, got "' + p10.instr + '"');
chk(parseFloat(p40.toTurn) < toTurn10, 'distance to the turn shrinks as you approach it');
chk(/Arrive/.test(p60.instr), 'past the turn it points at the destination');
chk(parseFloat(p10.pct) < parseFloat(p40.pct) && parseFloat(p40.pct) < parseFloat(p60.pct),
    'progress advances with real position, not with button presses');
chk(parseFloat(p95.left) < parseFloat(p10.left), 'distance remaining falls as you drive');

// arrival
at(100);
console.log('   at the end: arrived card ' + (E['arrived'].hidden ? 'HIDDEN' : 'shown') +
  ', nav bar ' + (E['navBar'].hidden ? 'hidden' : 'SHOWN'));
chk(E['arrived'].hidden === false, 'arrival card appears at the destination');
chk(E['navBar'].hidden === true, 'nav bar yields to the arrival card');

// voice announcements as you approach the turn
T.endNav(); T.me = { lat:line[0][1], lon:line[0][0] }; T.startNav(route);
SPOKEN.length = 0;
for(const i of [20, 35, 44, 48, 49]) at(i);
console.log('   approaching the turn, spoken:');
SPOKEN.forEach(x => console.log('     "' + x + '"'));
chk(SPOKEN.length >= 2 && SPOKEN.length <= 3, 'announced once per band, got ' + SPOKEN.length);
chk(SPOKEN.every(x => /Second Street/.test(x)), 'announcements name the upcoming turn');

// manual stepping still works, and a live position takes control back
T.endNav(); T.startNav(route);
const before = T.nav.i;
T.navStep(1);
console.log('   manual next: step ' + before + ' -> ' + T.nav.i);
chk(T.nav.i === before + 1, 'Next turn advances manually');
T.navStep(-1);
chk(T.nav.i === before, 'Back steps manually');
T.me = { lat:line[60][1], lon:line[60][0] };
T.advance();
console.log('   after a live position update, step is ' + T.nav.i + ' (manual override released)');
chk(T.nav.manual === null, 'a live fix releases the manual override');

// off-route detection
T.me = { lat:35.40, lon:-80.40 };
T.paintNav();
console.log('   far from the route -> meta reads: "' + E['navMeta'].textContent + '"');
chk(/Off the route/.test(E['navMeta'].textContent), 'driving away from the route is reported');
T.endNav();

/* ── traffic signals on the route ─────────────────────────── */
console.log('\n── traffic signals');
T.addLayers();
await T.loadSignals(route);
const sig = T.map.src['signals']._data;
console.log('   returned 4 nodes, kept ' + sig.features.length + ' that are actually on the route');
sig.features.forEach(f => console.log('     ' + f.properties.kind + ' at ' +
  T.fmtDist(f.properties.along) + ' along'));
chk(sig.features.length === 3, 'the node far from the route is discarded, got ' + sig.features.length);
chk(T.signalCountNow === 2, 'traffic light count excludes stop signs, got ' + T.signalCountNow);
chk(sig.features[0].properties.along < sig.features[2].properties.along, 'ordered along the route');
chk(sig.features.some(f => f.properties.kind === 'stop'), 'stop signs kept and marked separately');
console.log('   badge: "' + document.getElementById('signalBadge').textContent + '"');
chk(/2 lights/.test(document.getElementById('signalBadge').textContent), 'badge summarises them');

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

/* ── traffic-aware driving times ──────────────────────────── */
console.log('\n── driving times reflect live traffic');
T.ttKey = 'TESTKEY';
const dr = await T.routeDrive({lat:35.2271,lon:-80.8431}, {lat:35.1924,lon:-80.8456});
console.log('   source ' + dr[0].source + ' · live ' + dr[0].duration + 's · free-flow ' +
  dr[0].freeDuration + 's · delay ' + dr[0].delay + 's');
chk(dr[0].source === 'TomTom', 'driving uses the live-traffic router when a key is present');
chk(dr[0].duration === 1200 && dr[0].freeDuration === 1010,
  'the quoted time is the traffic time, not the speed-limit time');
chk(dr[0].delay === 190, 'the delay traffic is costing is carried through');
chk(dr.length === 3, 'alternatives come back too');
chk(dr[0].duration <= dr[1].duration && dr[1].duration <= dr[2].duration, 'sorted fastest first');
console.log('   arrive ' + T.clock(dr[0].arrive));
chk(Math.abs(dr[0].arrive - new Date('2026-11-07T17:02:00-05:00').getTime()) < 1000,
  'arrival clock comes from the router, not from adding seconds to now');

console.log('\n── maneuver offsets are exact, not snapped');
const offs = dr[0].legs[0].steps.map(s => s.offset);
console.log('   offsets ' + JSON.stringify(offs));
chk(offs[0] === 0 && offs[1] === 900 && offs[2] === 9100, 'each turn knows its true distance along the route');
chk(dr[0].legs[0].steps[1].dist === 8200, 'step length is the gap to the next turn');
T.startNav(dr[0]);
const alongs = T.nav.steps.map(s => s.along);
console.log('   along   ' + JSON.stringify(alongs));
chk(JSON.stringify(alongs) === JSON.stringify(offs), 'navigation uses those offsets verbatim');
T.endNav();

console.log('\n── congestion bands');
const jd = T.jamData(dr[0]);
console.log('   bands: ' + jd.features.length + ' colour ' + (jd.features[0]||{properties:{}}).properties.col);
chk(jd.features.length === 1, 'the slow stretch is drawn');
chk(jd.features[0].geometry.coordinates.length === 2, 'it covers just that stretch, not the whole route');
chk(T.jamData(dr[1]).features.length === 0, 'a clear route draws no bands');

console.log('\n── time left follows the route\'s own pace, not a flat average');
T.startNav(dr[0]);
T.nav.travelled = 900;
const atTurn = Math.round(T.secsLeft());
T.nav.travelled = 5000;
const midWay = Math.round(T.secsLeft());
const flat   = Math.round(1200 * (9100 - 5000) / 9100);
console.log('   at the turn ' + atTurn + 's · halfway ' + midWay + 's (flat average would say ' + flat + 's)');
chk(atTurn === 980, 'at a turn, time left is the total minus the time spent reaching it');
chk(midWay === 490, 'between turns it interpolates along the router\'s own pace');
chk(midWay !== flat, 'city crawl and freeway are no longer averaged into one speed');
T.nav.travelled = 9100;
chk(Math.round(T.secsLeft()) === 0, 'arriving reads zero');
T.endNav();

console.log('\n── falling back when TomTom cannot answer');
ttRouteFail = true;
const fb = await T.routeDrive({lat:35.2271,lon:-80.8431}, {lat:35.1924,lon:-80.8456});
ttRouteFail = false;
console.log('   source ' + fb[0].source + ' · ' + fb[0].duration + 's');
chk(fb[0].source === 'OSRM', 'an empty TomTom answer still yields a route');
chk(fb[0].arrive > Date.now(), 'the fallback still reports an arrival time');

console.log('\n── planning for a later departure');
const future = new Date('2026-11-09T17:30:00-05:00').getTime();
T.departAt = future;
await T.routeDrive({lat:35.2271,lon:-80.8431}, {lat:35.1924,lon:-80.8456});
console.log('   drive url tail: ' + globalThis.__last.split('&').filter(x=>x.startsWith('departAt')).join(''));
chk(globalThis.__last.includes('departAt=' + encodeURIComponent(T.isoLocal(future))),
  'the router is asked for that time, with the local offset, so it models rush hour');
chk(/[+-]\d\d:\d\d$/.test(T.isoLocal(future)), 'the timestamp carries a real UTC offset');
chk(!/departAt=.*Z/.test(globalThis.__last), 'not sent as a UTC timestamp, which TomTom reads differently');

const wlk = await T.routeValhalla({lat:35.2271,lon:-80.8431}, {lat:35.1924,lon:-80.8456}, 'pedestrian');
console.log('   walk arrives ' + T.clock(wlk[0].arrive));
chk(Math.abs(wlk[0].arrive - (future + wlk[0].duration*1000)) < 1000,
  'walking arrival counts from the planned departure, not from now');

try{ await T.routeTransit({lat:35.2271,lon:-80.8431}, {lat:35.1924,lon:-80.8456}); }catch(e){}
chk(globalThis.__last.includes(encodeURIComponent(new Date(future).toISOString())),
  'transit is asked for the same departure');
console.log('   label: "' + T.whenLabel() + '"');
chk(/^Leave /.test(T.whenLabel()) && !/now/.test(T.whenLabel()), 'the control says which time it is planning for');
T.departAt = null;
chk(T.whenLabel() === 'Leave now', 'clearing it goes back to now');
const nowDrive = await T.routeDrive({lat:35.2271,lon:-80.8431}, {lat:35.1924,lon:-80.8456});
chk(!/departAt/.test(globalThis.__last), 'and stops pinning the request to a time');
chk(nowDrive[0].source === 'TomTom', 'still live-traffic routing');

console.log('\n── telling "nothing runs now" apart from "no transit here"');
const wk = new Date(T.nextWeekdayMorning());
console.log('   probes ' + wk.toDateString() + ' ' + wk.getHours() + ':00');
chk(wk.getDay() >= 1 && wk.getDay() <= 5, 'the probe lands on a weekday');
chk(wk.getHours() === 8, 'at a morning hour when services run');
chk(wk.getTime() > Date.now(), 'and in the future');

failTransit = true;
const noneNow = await T.transitProbe({lat:35.2271,lon:-80.8431},{lat:35.1924,lon:-80.8456});
failTransit = false;
chk(noneNow === null, 'a genuinely empty area probes empty');
const found = await T.transitProbe({lat:35.2271,lon:-80.8431},{lat:35.1924,lon:-80.8456});
console.log('   weekday probe: ' + (found ? Math.round(found.duration/60) + ' min trip' : 'nothing'));
chk(found && found.duration > 0, 'where there is service, the probe finds it');

T.mode = 'transit';
T.renderError('transit', new Error('NO_TRANSIT'));
await new Promise(r => setTimeout(r, 30));
const txt = document.getElementById('results').innerHTML;
console.log('   message: ' + txt.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,110));
chk(/Nothing is running at this hour/.test(txt), 'it says the hour is the problem, not the city');
chk(/useWhen/.test(txt), 'and offers to plan the trip for when it does run');
T.mode = 'drive';

console.log('\n── the sheet can be moved on a phone');
globalThis.__phone = true;
globalThis.innerHeight = 844;             // a phone, not a desktop
const stops = T.sheetStops();
console.log('   stops ' + JSON.stringify(stops) + ' of ' + innerHeight);
chk(stops.length === 3, 'three resting heights');
chk(stops[0] < 200, 'the peek gives most of the screen back to the map');
chk(stops[0] > 150, 'but still leaves the search within reach');
chk(stops[2] <= innerHeight, 'the tallest never exceeds the screen');
chk(stops[0] < stops[1] && stops[1] < stops[2], 'they ascend');

T.snapSheet(0, true);
chk(T.sheetPx === stops[0], 'collapsing really collapses it');
const panelEl = document.getElementById('panel');
console.log('   collapsed transform: ' + panelEl.style.transform);
chk(panelEl.style.transform === 'translateY(' + (stops[2] - stops[0]) + 'px)',
  'the transform is written directly, so the sheet cannot ignore the new height');
T.snapSheet(2, true);
console.log('   opened transform:    ' + panelEl.style.transform);
chk(panelEl.style.transform === 'translateY(0px)', 'and fully open sits flush');
T.snapSheet(0, true);
T.snapSheet(2, true);
chk(T.sheetPx === stops[2], 'and it opens again');
chk(T.nearestStop(stops[1] + 10) === 1, 'a slow drag lands on the nearest stop');
T.snapSheet(9, true);
chk(T.sheetIdx === 2, 'it cannot be pushed past the top');
T.snapSheet(-4, true);
chk(T.sheetIdx === 0, 'nor below the peek');

console.log('\n── flicking it');
const pd = y => ({ clientY:y, button:0, pointerId:1, currentTarget:{setPointerCapture(){}} });
T.snapSheet(1, true);
T.sheetDown(pd(400));
T.sheetMove({ clientY:380, preventDefault(){} });
T.sheetUp({ clientY:300 });                        // fast upward flick
console.log('   after an upward flick: stop ' + T.sheetIdx);
chk(T.sheetIdx === 2, 'a flick up carries past the nearest stop to the next one');
T.sheetDown(pd(300));
T.sheetMove({ clientY:340, preventDefault(){} });
T.sheetUp({ clientY:420 });                        // fast downward flick
console.log('   after a downward flick: stop ' + T.sheetIdx);
chk(T.sheetIdx === 1, 'and a flick down steps back');

console.log('\n── the map is framed in the part you can see');
T.snapSheet(0, true);
const low = T.sheetPad().bottom;
T.snapSheet(2, true);
const high = T.sheetPad().bottom;
console.log('   bottom padding: peek ' + low + ' · full ' + high);
chk(high > low, 'a taller sheet pushes the route further up the map');
chk(high <= Math.round(innerHeight * 0.52), 'but never so far that the route has nowhere to go');
globalThis.__phone = false;
globalThis.innerHeight = 800;
T.layoutSheet();
console.log('   desktop transform: "' + panelEl.style.transform + '"');
chk(panelEl.style.transform === '', 'on a desktop the sheet transform is taken off entirely');
chk(T.sheetPad().bottom === 70, 'on a desktop the padding is the plain one');

console.log('\nhosts: ' + [...new Set(seen)].join('\n       '));
console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
