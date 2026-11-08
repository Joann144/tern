"use strict";
/* ═══════════════════════════════════════════════════════════
   Tern — open trip planner
   tiles OpenFreeMap · search Photon · drive OSRM
   walk/bike Valhalla · transit Transitous (MOTIS) · traffic TomTom
   ═══════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const OFM = 'https://tiles.openfreemap.org';
/* ── custom cartography, so the map does not look stock ───── */
const PAL = {
  dark:{
    bg:'#10141b', land:'#10141b', wood:'#15201a', park:'#15221b', sand:'#1d1f1c',
    water:'#0b2331', river:'#103043',
    bldgLo:'#1a202a', bldgHi:'#2b3542',
    casing:'#0b0e14', minor:'#222935', mid:'#2d3543', major:'#3d4555',
    moto:'#4b5465', motoHi:'#5d6677',
    rail:'#1d232d', border:'#2c3443',
    label:'#c9d4e2', halo:'#080b11', labelDim:'#8694a7',
    poi:'#6f7f94', poiText:'#93a2b6', waterLabel:'#3f7fa0'
  },
  light:{
    bg:'#f5f3ee', land:'#f5f3ee', wood:'#dde7d4', park:'#dfeadb', sand:'#efe8d8',
    water:'#bfdcea', river:'#a8cfe2',
    bldgLo:'#e8e3d9', bldgHi:'#ddd6c9',
    casing:'#d8d3c8', minor:'#ffffff', mid:'#ffffff', major:'#fdf6e8',
    moto:'#efe9dd', motoHi:'#e2dace',
    rail:'#ded8cc', border:'#c9c2b4',
    label:'#262d38', halo:'#f7f5f1', labelDim:'#5d6673',
    poi:'#8d7f66', poiText:'#5a5245', waterLabel:'#5b8aa3'
  }
};
function roadLayer(id, classes, color, widths, minzoom){
  return { id, type:'line', source:'omt', 'source-layer':'transportation', minzoom: minzoom || 0,
    filter:['match',['get','class'], classes, true, false],
    layout:{ 'line-cap':'round','line-join':'round' },
    paint:{ 'line-color':color,
      'line-width':['interpolate',['exponential',1.5],['zoom'],5,widths[0],12,widths[1],18,widths[2]] } };
}
function mapStyle(mode){
  const c = PAL[mode];
  return {
    version:8, name:'Tern ' + mode,
    glyphs: OFM + '/fonts/{fontstack}/{range}.pbf',
    sprite: OFM + '/sprites/ofm_f384/ofm',
    sources:{ omt:{ type:'vector', url: OFM + '/planet' } },
    light:{ anchor:'viewport', color:'#ffffff', intensity: mode === 'dark' ? 0.28 : 0.42 },
    layers:[
      { id:'bg', type:'background', paint:{ 'background-color': c.bg } },
      { id:'landcover', type:'fill', source:'omt', 'source-layer':'landcover',
        filter:['match',['get','class'],['wood','grass','scrub'],true,false],
        paint:{ 'fill-color': c.wood, 'fill-opacity': mode === 'dark' ? 0.75 : 0.9 } },
      { id:'sand', type:'fill', source:'omt', 'source-layer':'landcover',
        filter:['match',['get','class'],['sand','farmland'],true,false],
        paint:{ 'fill-color': c.sand, 'fill-opacity':0.55 } },
      { id:'park', type:'fill', source:'omt', 'source-layer':'park',
        paint:{ 'fill-color': c.park, 'fill-opacity':0.8 } },
      { id:'water', type:'fill', source:'omt', 'source-layer':'water',
        paint:{ 'fill-color': c.water } },
      { id:'waterway', type:'line', source:'omt', 'source-layer':'waterway',
        paint:{ 'line-color': c.river,
          'line-width':['interpolate',['linear'],['zoom'],8,0.6,16,3.4] } },
      { id:'rail', type:'line', source:'omt', 'source-layer':'transportation', minzoom:11,
        filter:['==',['get','class'],'rail'],
        paint:{ 'line-color': c.rail, 'line-dasharray':[3,2],
          'line-width':['interpolate',['linear'],['zoom'],11,0.6,18,2.2] } },
      roadLayer('r-path',['path','track','pedestrian'], c.minor, [0,0.5,2.4], 13),
      { id:'r-casing', type:'line', source:'omt', 'source-layer':'transportation',
        filter:['match',['get','class'],['minor','service','secondary','tertiary','primary','trunk','motorway'],true,false],
        layout:{ 'line-cap':'round','line-join':'round' },
        paint:{ 'line-color': c.casing,
          'line-width':['interpolate',['exponential',1.5],['zoom'],5,1.4,12,5,18,22] } },
      roadLayer('r-minor',['minor','service'], c.minor, [0,1.1,7]),
      roadLayer('r-mid',['secondary','tertiary'], c.mid, [0.3,2.1,12]),
      roadLayer('r-major',['primary','trunk'], c.major, [0.5,2.9,16]),
      { id:'r-moto-glow', type:'line', source:'omt', 'source-layer':'transportation',
        filter:['==',['get','class'],'motorway'],
        paint:{ 'line-color': c.motoHi, 'line-blur':6, 'line-opacity': mode === 'dark' ? 0.4 : 0.25,
          'line-width':['interpolate',['exponential',1.5],['zoom'],5,2,12,9,18,26] } },
      roadLayer('r-moto',['motorway'], c.moto, [0.9,3.6,19]),
      { id:'building', type:'fill-extrusion', source:'omt', 'source-layer':'building', minzoom:14,
        paint:{
          'fill-extrusion-color':['interpolate',['linear'],['get','render_height'],
            0, c.bldgLo, 30, c.bldgLo, 120, c.bldgHi],
          'fill-extrusion-height':['interpolate',['linear'],['zoom'],14,0,15.5,['coalesce',['get','render_height'],6]],
          'fill-extrusion-base':['coalesce',['get','render_min_height'],0],
          'fill-extrusion-opacity': mode === 'dark' ? 0.92 : 0.82,
          'fill-extrusion-vertical-gradient':true } },
      { id:'boundary', type:'line', source:'omt', 'source-layer':'boundary',
        filter:['<=',['get','admin_level'],4],
        paint:{ 'line-color': c.border, 'line-dasharray':[4,3], 'line-width':0.9 } },
      { id:'poi-dot', type:'circle', source:'omt', 'source-layer':'poi', minzoom:15,
        filter:['<=',['get','rank'],24],
        paint:{ 'circle-radius':['interpolate',['linear'],['zoom'],15,2,18,3.4],
          'circle-color': c.poi, 'circle-opacity':0.9 } },
      { id:'poi-label', type:'symbol', source:'omt', 'source-layer':'poi', minzoom:15.5,
        filter:['<=',['get','rank'],18],
        layout:{ 'text-field':['get','name'], 'text-font':['Noto Sans Regular'],
          'text-size':['interpolate',['linear'],['zoom'],15.5,10,18,12],
          'text-anchor':'left', 'text-offset':[0.6,0], 'text-max-width':9,
          'text-optional':true },
        paint:{ 'text-color': c.poiText, 'text-halo-color': c.halo, 'text-halo-width':1.2 } },
      { id:'road-label', type:'symbol', source:'omt', 'source-layer':'transportation_name', minzoom:13,
        layout:{ 'symbol-placement':'line', 'text-field':['get','name'],
          'text-font':['Noto Sans Regular'], 'text-letter-spacing':0.02,
          'text-size':['interpolate',['linear'],['zoom'],13,10,18,13] },
        paint:{ 'text-color': c.labelDim, 'text-halo-color': c.halo, 'text-halo-width':1.3 } },
      { id:'water-label', type:'symbol', source:'omt', 'source-layer':'water_name',
        layout:{ 'text-field':['get','name'], 'text-font':['Noto Sans Italic'],
          'text-size':12, 'text-max-width':7 },
        paint:{ 'text-color': c.waterLabel, 'text-halo-color': c.halo, 'text-halo-width':1.1 } },
      { id:'place-minor', type:'symbol', source:'omt', 'source-layer':'place', minzoom:11,
        filter:['match',['get','class'],['village','suburb','neighbourhood','hamlet'],true,false],
        layout:{ 'text-field':['get','name'], 'text-font':['Noto Sans Regular'],
          'text-size':11.5, 'text-letter-spacing':0.07, 'text-transform':'uppercase', 'text-max-width':8 },
        paint:{ 'text-color': c.labelDim, 'text-halo-color': c.halo, 'text-halo-width':1.3 } },
      { id:'place-major', type:'symbol', source:'omt', 'source-layer':'place',
        filter:['match',['get','class'],['city','town','state','country'],true,false],
        layout:{ 'text-field':['get','name'], 'text-font':['Noto Sans Bold'], 'text-max-width':9,
          'text-size':['interpolate',['linear'],['zoom'],3,11,6,14,10,19,14,23] },
        paint:{ 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width':1.6 } }
    ]
  };
}
const STYLE = { get light(){ return mapStyle('light'); }, get dark(){ return mapStyle('dark'); } };
const MOTIS = 'https://api.transitous.org';

const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
};

let theme    = store.get('tern.theme', 'dark');
if(theme !== 'dark') theme = 'light';
let units    = store.get('tern.units', 'imperial');
let ttKey    = store.get('tern.ttkey', '');
/* null means "leave now"; otherwise a timestamp to plan the trip for. */
let departAt = null;
const departBase = () => departAt || Date.now();
/* TomTom wants a local time with its offset, not a Z timestamp. */
function isoLocal(ms){
  const d = new Date(ms), p = n => String(n).padStart(2, '0');
  const o = -d.getTimezoneOffset(), sg = o >= 0 ? '+' : '-', ao = Math.abs(o);
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) +
    'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':00' +
    sg + p(Math.floor(ao/60)) + ':' + p(ao%60);
}
let mode     = store.get('tern.mode', 'drive');
let trafficOn= store.get('tern.traffic', '1') === '1';
document.documentElement.setAttribute('data-theme', theme);

const IMP = () => units === 'imperial';

/* ── network: timeout + retry on everything ───────────────── */
const NET = {
  async json(url, opt, cfg){
    cfg = cfg || {};
    const tries = cfg.tries == null ? 1 : cfg.tries;
    const ms = cfg.ms || 12000;
    const label = cfg.label || 'Request';
    let last;
    for(let a = 0; a <= tries; a++){
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), ms);
      let signal = ac.signal;
      if(opt && opt.signal && typeof AbortSignal !== 'undefined' && AbortSignal.any){
        try{ signal = AbortSignal.any([opt.signal, ac.signal]); }catch(e){}
      }
      try{
        const r = await fetch(url, Object.assign({}, opt, { signal }));
        clearTimeout(timer);
        if(r.status === 429) throw new Error(label + ' is rate limited (429)');
        if(r.status === 403) throw new Error(label + ' rejected the key (403)');
        if(!r.ok) throw new Error(label + ' returned HTTP ' + r.status);
        return await r.json();
      }catch(e){
        clearTimeout(timer);
        if(opt && opt.signal && opt.signal.aborted) throw e;
        last = e.name === 'AbortError'
          ? new Error(label + ' timed out after ' + (ms >= 1000 ? Math.round(ms/1000) + 's' : ms + 'ms'))
          : e;
        if(!navigator.onLine){ last = new Error('You are offline'); break; }
        if(a < tries) await new Promise(f => setTimeout(f, 400 * Math.pow(2, a)));
      }
    }
    throw last;
  }
};

/* ── formatting ───────────────────────────────────────────── */
const fmtDist = m => IMP()
  ? (m < 161 ? Math.round(m * 3.28084) + ' ft' : (m/1609.34).toFixed(m < 16093 ? 1 : 0) + ' mi')
  : (m < 1000 ? Math.round(m) + ' m' : (m/1000).toFixed(m < 10000 ? 1 : 0) + ' km');
const fmtDur = s => {
  s = Math.round(s);
  const h = Math.floor(s/3600), m = Math.round((s % 3600)/60);
  return h ? (m ? h + ' hr ' + m + ' min' : h + ' hr') : Math.max(1, m) + ' min';
};
const fmtShort = s => {
  s = Math.round(s);
  const h = Math.floor(s/3600), m = Math.round((s % 3600)/60);
  return h ? h + 'h ' + m + 'm' : Math.max(1, m) + 'm';
};
const clock = d => new Date(d).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hav = (a,b) => {
  const R = 6371008.8, t = x => x * Math.PI/180;
  const dLa = t(b.lat - a.lat), dLo = t(b.lon - a.lon);
  const h = Math.sin(dLa/2)**2 + Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};
function decodePoly(str, precision){
  const f = Math.pow(10, precision == null ? 6 : precision);
  let i = 0, lat = 0, lon = 0; const out = [];
  while(i < str.length){
    let b, sh = 0, res = 0;
    do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << sh; sh += 5; } while(b >= 0x20);
    lat += (res & 1) ? ~(res >> 1) : (res >> 1);
    sh = 0; res = 0;
    do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << sh; sh += 5; } while(b >= 0x20);
    lon += (res & 1) ? ~(res >> 1) : (res >> 1);
    out.push([lon/f, lat/f]);
  }
  return out;
}

/* ── toast / fatal ────────────────────────────────────────── */
let toastT;
function toast(msg, ms){
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 3200);
}
const bootErrs = [];
function fatal(h, p){
  $('fatalH').textContent = h; $('fatalP').textContent = p;
  const detail = bootErrs.slice(0, 6).join('\n');
  $('fatalPre').textContent = detail;
  $('fatalPre').hidden = !detail;          // an empty box explains nothing
  $('fatal').hidden = false;
}
window.addEventListener('error', e => { bootErrs.push(e.message); });

/* ── map ──────────────────────────────────────────────────── */
let map;
try{
  const probe = document.createElement('canvas');
  if(!(probe.getContext('webgl2') || probe.getContext('webgl')))
    throw new Error('WebGL is unavailable. Turn on hardware acceleration, or use Chrome, Edge or Firefox.');
  map = new maplibregl.Map({
    container:'map', style: STYLE[theme],
    center:[-80.8431, 35.2271], zoom: 12.4, pitch: 0,
    antialias:true, fadeDuration:110, maxTileCacheSize:520,
    attributionControl:false
  });
  map.addControl(new maplibregl.ScaleControl({ unit: IMP() ? 'imperial' : 'metric' }), 'bottom-right');
}catch(e){ bootErrs.push(e.message); fatal('Cannot start the map', e.message); throw e; }

let gotTile = false;
map.on('data', e => { if(e.tile) gotTile = true; });
map.on('error', e => {
  const m = (e && e.error && (e.error.message || String(e.error))) || 'map error';
  if(!bootErrs.includes(m)) bootErrs.push(m);
});
/* Ask the map what it is actually holding rather than trusting that one
   event arrived. A backgrounded tab throttles timers and events, so a
   single deadline will accuse a perfectly good map of being broken. */
function tilesHeld(){
  try{
    const sc = map.style && map.style.sourceCaches && map.style.sourceCaches.omt;
    return sc ? Object.keys(sc._tiles || {}).length : 0;
  }catch(e){ return 0; }
}
let tileTries = 0;
function tileWatch(){
  if(gotTile) return;
  if(tilesHeld() > 0){ gotTile = true; return; }
  // never cry failure over a tab that was never on screen to draw
  if(document.hidden || ++tileTries < 3){ setTimeout(tileWatch, 7000); return; }
  fatal('No map tiles loaded',
    'The page is running but could not reach the tile server. Check your connection, then use System check for detail.');
}
setTimeout(tileWatch, 14000);
document.addEventListener('visibilitychange', () => { if(!document.hidden && !gotTile) tileTries = 0; });

const firstSymbol = () => {
  const ls = (map.getStyle() && map.getStyle().layers) || [];
  for(const l of ls) if(l.type === 'symbol') return l.id;
};

const EMPTY = { type:'FeatureCollection', features:[] };
function addLayers(){
  if(!map.getSource('route')){
    map.addSource('route', { type:'geojson', data: EMPTY });
    map.addLayer({ id:'route-case', type:'line', source:'route',
      layout:{ 'line-cap':'round','line-join':'round' },
      paint:{ 'line-color': theme === 'dark' ? '#0b0d10' : '#ffffff',
        'line-width':['interpolate',['linear'],['zoom'],8,7,16,15] } }, firstSymbol());
    map.addLayer({ id:'route-line', type:'line', source:'route',
      filter:['!=',['get','walk'], true],
      layout:{ 'line-cap':'round','line-join':'round' },
      paint:{ 'line-color':['get','color'],
        'line-width':['interpolate',['linear'],['zoom'],8,4,16,9] } }, firstSymbol());
    map.addLayer({ id:'route-walk', type:'line', source:'route',
      filter:['==',['get','walk'], true],
      layout:{ 'line-cap':'butt','line-join':'round' },
      paint:{ 'line-color':['get','color'], 'line-dasharray':[0.1,1.9],
        'line-width':['interpolate',['linear'],['zoom'],8,4,16,8] } }, firstSymbol());
  }
  if(!map.getSource('jams')){
    map.addSource('jams', { type:'geojson', data: EMPTY });
    map.addLayer({ id:'jams', type:'line', source:'jams',
      layout:{ 'line-cap':'round','line-join':'round' },
      paint:{ 'line-color':['get','col'],
        'line-width':['interpolate',['linear'],['zoom'],8,4,16,9] } }, firstSymbol());
  }
  if(!map.getSource('alts')){
    map.addSource('alts', { type:'geojson', data: EMPTY });
    map.addLayer({ id:'alts', type:'line', source:'alts',
      layout:{ 'line-cap':'round','line-join':'round' },
      paint:{ 'line-color': theme === 'dark' ? '#5b6675' : '#9aa4b2', 'line-width':5, 'line-opacity':.65 } },
      map.getLayer('route-case') ? 'route-case' : firstSymbol());
  }
  if(!map.getSource('signals')){
    map.addSource('signals', { type:'geojson', data: EMPTY });
    map.addLayer({ id:'signal-halo', type:'circle', source:'signals', minzoom:12,
      paint:{ 'circle-radius':['interpolate',['linear'],['zoom'],12,4,17,9],
        'circle-color':['get','col'], 'circle-opacity':0.22 } });
    map.addLayer({ id:'signal-dot', type:'circle', source:'signals', minzoom:12,
      paint:{ 'circle-radius':['interpolate',['linear'],['zoom'],12,2,17,4.5],
        'circle-color':['get','col'],
        'circle-stroke-color': theme === 'dark' ? '#10141b' : '#ffffff',
        'circle-stroke-width':1.4 } });
  }
  if(!map.getSource('stops')){
    map.addSource('stops', { type:'geojson', data: EMPTY });
    map.addLayer({ id:'stops', type:'circle', source:'stops',
      paint:{ 'circle-radius':4.5, 'circle-color':'#ffffff',
        'circle-stroke-color':['get','color'], 'circle-stroke-width':2.5 } });
  }
  if(!map.getSource('inc')){
    map.addSource('inc', { type:'geojson', data: EMPTY });
    map.addLayer({ id:'inc-line', type:'line', source:'inc',
      filter:['==',['geometry-type'],'LineString'],
      layout:{ 'line-cap':'round' },
      paint:{ 'line-color':['get','col'], 'line-opacity':.95,
        'line-width':['interpolate',['linear'],['zoom'],9,3,16,7] } });
    map.addLayer({ id:'inc-pt', type:'circle', source:'inc',
      filter:['==',['geometry-type'],'Point'],
      paint:{ 'circle-radius':['interpolate',['linear'],['zoom'],9,4,16,8],
        'circle-color':['get','col'], 'circle-stroke-color':'#fff', 'circle-stroke-width':2 } });
    ['inc-line','inc-pt'].forEach(id => {
      map.on('click', id, e => showIncident(e.features[0]));
      map.on('mouseenter', id, () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', id, () => map.getCanvas().style.cursor = '');
    });
  }
  if(incData && map.getSource('inc')) map.getSource('inc').setData(incData);
  if(trafficOn && ttKey) addTraffic();
  if(current) paintRoute(current);
}
map.on('load', () => { addLayers(); wireMap(); watchIncidents(); initialLocate(); loadIncidents(true); });

/* ── places ───────────────────────────────────────────────── */
let abortGeo;
async function geocode(q){
  const c = map.getCenter();
  if(abortGeo) abortGeo.abort();
  abortGeo = new AbortController();
  const url = 'https://photon.komoot.io/api?q=' + encodeURIComponent(q) +
    '&limit=7&lang=en&lat=' + c.lat.toFixed(4) + '&lon=' + c.lng.toFixed(4);
  const j = await NET.json(url, { signal: abortGeo.signal }, { tries:1, ms:8000, label:'Search' });
  return (j.features || []).map(f => {
    const p = f.properties || {};
    const street = p.housenumber && p.street ? p.housenumber + ' ' + p.street : p.street;
    return {
      name: p.name || street || 'Unnamed place',
      detail: [street && p.name ? street : null, p.city || p.county, p.state, p.country].filter(Boolean).join(', '),
      lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0]
    };
  });
}
async function reverse(lat, lon){
  try{
    const j = await NET.json('https://photon.komoot.io/reverse?lat=' + lat + '&lon=' + lon + '&limit=1&lang=en',
      null, { tries:1, ms:8000, label:'Address lookup' });
    const f = (j.features || [])[0];
    if(!f) return null;
    const p = f.properties || {};
    const street = p.housenumber && p.street ? p.housenumber + ' ' + p.street : p.street;
    return { name: p.name || street || 'Dropped pin',
      detail: [p.city || p.county, p.state, p.postcode].filter(Boolean).join(', '),
      lat, lon };
  }catch(e){ return null; }
}

/* ── trip state ───────────────────────────────────────────── */
const trip = { from:null, to:null };
let current = null;          // chosen itinerary
let options = [];            // itineraries for the active mode
const etaCache = {};         // mode -> seconds
let markFrom = null, markTo = null;

function pin(color){
  const d = document.createElement('div'); d.className = 'mk';
  d.innerHTML = '<svg viewBox="0 0 26 34"><path d="M13 33S25 21 25 12.5A12 12 0 101 12.5C1 21 13 33 13 33z" fill="' +
    color + '"/><circle cx="13" cy="12.5" r="4.4" fill="#fff"/></svg>';
  return d;
}
let userStart = false;          // true once the user has chosen a start themselves
function setPlace(slot, place, auto){
  if(!place || !isFinite(place.lat) || !isFinite(place.lon)) return;
  if(slot === 'from' && !auto) userStart = true;
  trip[slot] = place;
  $(slot + 'Input').value = place.name;
  if(slot === 'to') $('clearTo').hidden = false;
  const mk = slot === 'from' ? markFrom : markTo;
  if(mk) mk.remove();
  const m = new maplibregl.Marker({ element: pin(slot === 'from' ? '#6b7684' : '#1f6feb'), anchor:'bottom' })
    .setLngLat([place.lon, place.lat]).addTo(map);
  if(slot === 'from') markFrom = m; else markTo = m;
  store.set('tern.' + slot, JSON.stringify(place));
  if(slot === 'to') rememberRecent(place);
  if(trip.from && trip.to){ planAll(); return; }
  map.flyTo({ center:[place.lon, place.lat], zoom: Math.max(map.getZoom(), 14.5), speed:1.3 });
  if(slot === 'to' && !trip.from) needStart();
}

/* ── no start point yet: ask for one, loudly and usefully ─── */
function needStart(){
  $('live').hidden = true;
  $('results').innerHTML =
    '<div class="empty">' +
      '<div class="eicon">' + svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>' +
        '<path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>', 2) + '</div>' +
      '<h3>Where are you starting from?</h3>' +
      '<p>Pick a starting point and all four travel times appear at once.</p>' +
      '<div class="go" style="margin-top:14px">' +
        '<button class="btn primary" id="startHere">Use my location</button></div>' +
      '<div class="tips"><span>Or tap anywhere on the map to set it</span></div>' +
    '</div>';
  const b = $('startHere');
  if(b) b.onclick = () => { b.textContent = 'Locating…'; useGps(); };
  if(navigator.geolocation) locateNow(true, false);   // automatic: must not override a typed start
}

/* ── recent destinations ──────────────────────────────────── */
function recents(){ try{ return JSON.parse(store.get('tern.recent', '[]')) || []; }catch(e){ return []; } }
function rememberRecent(p){
  const list = recents().filter(x => Math.abs(x.lat - p.lat) > 1e-5 || Math.abs(x.lon - p.lon) > 1e-5);
  list.unshift({ name:p.name, detail:p.detail || '', lat:p.lat, lon:p.lon });
  store.set('tern.recent', JSON.stringify(list.slice(0, 6)));
}

/* ── routers, all returning one shape ─────────────────────── */
const COLOR = { WALK:'#8a93a1', BIKE:'#13a8a0', CAR:'#ff5a1f', TRANSIT:'#7c5cff' };

function osrmText(s){
  const m = s.maneuver || {}, mod = (m.modifier || '').replace(/_/g,' '), on = s.name ? ' onto ' + s.name : '';
  const dir = b => ['north','northeast','east','southeast','south','southwest','west','northwest'][Math.round(((b||0)%360)/45)%8];
  switch(m.type){
    case 'depart': return 'Head ' + dir(m.bearing_after) + (s.name ? ' on ' + s.name : '');
    case 'arrive': return 'Arrive at your destination';
    case 'turn': return 'Turn ' + mod + on;
    case 'new name': return 'Continue' + (s.name ? ' on ' + s.name : '');
    case 'merge': return 'Merge ' + mod + on;
    case 'on ramp': return 'Take the ramp ' + mod + on;
    case 'off ramp': return 'Take the exit ' + mod + on;
    case 'fork': return 'Keep ' + mod + on;
    case 'roundabout': case 'rotary': return 'Enter the roundabout' + (m.exit ? ' and take exit ' + m.exit : '');
    case 'end of road': return 'At the end of the road, turn ' + mod + on;
    case 'continue': return 'Continue ' + mod + on;
    default: return (m.type ? m.type[0].toUpperCase() + m.type.slice(1) : 'Continue') + (mod ? ' ' + mod : '') + on;
  }
}
function viaLabel(steps){
  const tally = {};
  steps.forEach(s => { if(s.road) tally[s.road] = (tally[s.road] || 0) + (s.dist || 0); });
  const best = Object.keys(tally).sort((x,y) => tally[y] - tally[x])[0];
  return best ? 'via ' + best : '';
}
async function routeOSRM(a, b){
  const url = 'https://router.project-osrm.org/route/v1/driving/' +
    a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat +
    '?overview=full&geometries=geojson&steps=true&alternatives=3';
  const j = await NET.json(url, null, { tries:1, ms:15000, label:'Driving router' });
  const routes = j.routes || [];
  if(!routes.length) throw new Error('No driving route exists between those points');
  return routes.map(r => {
    const steps = [];
    r.legs.forEach(l => l.steps.forEach(s => {
      const m = s.maneuver || {};
      steps.push({ text: osrmText(s), dist: s.distance, road: s.name || '',
        lon: m.location ? m.location[0] : null, lat: m.location ? m.location[1] : null });
    }));
    return { mode:'drive', duration:r.duration, distance:r.distance, source:'OSRM',
      freeDuration:r.duration, delay:0, traffic:false,
      arrive: departBase() + r.duration * 1000,
      via: viaLabel(steps),
      legs:[{ kind:'CAR', color:COLOR.CAR, coords:r.geometry.coordinates, steps }] };
  }).sort((x,y) => x.duration - y.duration);
}

/* TomTom knows what the roads are actually doing right now; OSRM only knows
   the speed limits. When a key is present the live numbers win. */
async function routeTomTom(a, b){
  const url = 'https://api.tomtom.com/routing/1/calculateRoute/' +
    a.lat + ',' + a.lon + ':' + b.lat + ',' + b.lon + '/json' +
    '?key=' + encodeURIComponent(ttKey) +
    '&traffic=true&computeTravelTimeFor=all&maxAlternatives=2' +
    '&instructionsType=text&routeRepresentation=polyline&sectionType=traffic' +
    '&travelMode=car&routeType=fastest' +
    (departAt ? '&departAt=' + encodeURIComponent(isoLocal(departAt)) : '');
  const j = await NET.json(url, null, { tries:1, ms:18000, label:'Driving router' });
  qBump();
  const routes = j.routes || [];
  if(!routes.length) throw new Error('No driving route exists between those points');
  return routes.map(r => {
    const sum = r.summary || {};
    const coords = [];
    (r.legs || []).forEach(l => (l.points || []).forEach(p => coords.push([p.longitude, p.latitude])));
    const ins = (r.guidance && r.guidance.instructions) || [];
    const steps = ins.map((m, k) => {
      const next = ins[k + 1];
      const off = m.routeOffsetInMeters || 0;
      return { text: m.message || m.maneuver || '', road: m.street || '',
        dist: next ? Math.max(0, (next.routeOffsetInMeters || 0) - off) : Math.max(0, (sum.lengthInMeters || 0) - off),
        offset: off, t: m.travelTimeInSeconds || 0,
        lon: m.point ? m.point.longitude : null, lat: m.point ? m.point.latitude : null };
    }).filter(st => st.text);
    const jams = (r.sections || []).filter(x => x.sectionType === 'TRAFFIC').map(x => ({
      from: x.startPointIndex, to: x.endPointIndex,
      delay: x.delayInSeconds || 0, mag: x.magnitudeOfDelay || 0,
      kind: x.simpleCategory || 'OTHER' }));
    const live = sum.travelTimeInSeconds || 0;
    const free = sum.noTrafficTravelTimeInSeconds || live;
    return { mode:'drive', duration:live, distance: sum.lengthInMeters || 0, source:'TomTom',
      freeDuration: free, delay: Math.max(0, sum.trafficDelayInSeconds || (live - free)),
      traffic:true,
      arrive: sum.arrivalTime ? new Date(sum.arrivalTime).getTime() : departBase() + live * 1000,
      depart: sum.departureTime ? new Date(sum.departureTime).getTime() : departBase(),
      jams, via: viaLabel(steps),
      legs:[{ kind:'CAR', color:COLOR.CAR, coords, steps }] };
  }).sort((x,y) => x.duration - y.duration);
}

async function routeDrive(a, b){
  /* Live times are better, but never at the cost of getting no route at all:
     anything that goes wrong at TomTom quietly falls back to OSRM. */
  if(ttKey && quotaUsed() < QUOTA){
    try{
      const r = await routeTomTom(a, b);
      if(r.length) return r;
    }catch(e){}
  }
  return routeOSRM(a, b);
}
async function routeValhalla(a, b, costing){
  const body = { locations:[{lat:a.lat,lon:a.lon},{lat:b.lat,lon:b.lon}], costing, alternates:2,
    directions_options:{ units: IMP() ? 'miles' : 'kilometers', language:'en-US' } };
  const j = await NET.json(MOTIS_FALLBACK_VALHALLA, { method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) },
    { tries:1, ms:20000, label: costing === 'bicycle' ? 'Cycling router' : 'Walking router' });
  const trips = [j.trip].concat((j.alternates || []).map(x => x && x.trip).filter(Boolean));
  if(!trips[0] || !trips[0].legs) throw new Error('No route found for that mode');
  const unit = IMP() ? 1609.34 : 1000;
  const built = trips.filter(t => t && t.legs).map(t => {
  let coords = [], steps = [];
  t.legs.forEach(l => {
    const shp = decodePoly(l.shape, 6);
    coords = coords.concat(shp);
    (l.maneuvers || []).forEach(m => {
      const pt = shp[Math.min(shp.length - 1, m.begin_shape_index || 0)] || null;
      steps.push({ text: m.instruction, dist:(m.length || 0) * unit,
        road:(m.street_names || []).join(', '), lon: pt ? pt[0] : null, lat: pt ? pt[1] : null });
    });
  });
  return { mode: costing === 'bicycle' ? 'bike' : 'walk', duration:t.summary.time,
    distance:t.summary.length * unit, source:'Valhalla', via: viaLabel(steps),
    arrive: departBase() + t.summary.time * 1000,
    legs:[{ kind: costing === 'bicycle' ? 'BIKE' : 'WALK',
      color: costing === 'bicycle' ? COLOR.BIKE : COLOR.WALK, coords, steps }] };
  });
  return built.sort((x,y) => x.duration - y.duration);
}
const MOTIS_FALLBACK_VALHALLA = 'https://valhalla1.openstreetmap.de/route';

function transitLabel(m){
  if(!m) return 'Transit';
  const k = String(m).toUpperCase();
  if(k === 'BUS' || k === 'COACH') return 'Bus';
  if(k === 'SUBWAY' || k === 'METRO') return 'Subway';
  if(k === 'LIGHT_RAIL' || k === 'STREETCAR') return 'Light rail';
  if(k === 'TRAM') return 'Tram';
  if(k === 'FERRY') return 'Ferry';
  if(k === 'CABLE_CAR' || k === 'FUNICULAR' || k === 'AERIAL_LIFT') return 'Cable car';
  if(/RAIL|TRAIN|SUBURBAN|REGIONAL|HIGHSPEED|LONG_DISTANCE|NIGHT/.test(k)) return 'Train';
  return k.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}

function endName(n, place){
  const k = String(n).trim().toUpperCase();
  if(!n || k === 'START' || k === 'END' || k === 'ORIGIN' || k === 'DESTINATION')
    return (place && place.name) || 'your destination';
  return n;
}
async function routeTransit(a, b){
  const url = MOTIS + '/api/v5/plan?fromPlace=' + a.lat + ',' + a.lon +
    '&toPlace=' + b.lat + ',' + b.lon +
    '&time=' + encodeURIComponent(new Date(departBase()).toISOString()) +
    '&numItineraries=4&pedestrianProfile=FOOT';
  const j = await NET.json(url, null, { tries:1, ms:20000, label:'Transit router' });
  const its = j.itineraries || [];
  if(!its.length) throw new Error('NO_TRANSIT');
  const out = its.map(it => {
    const legs = (it.legs || []).map(l => {
      const g = l.legGeometry || {};
      const coords = g.points ? decodePoly(g.points, g.precision == null ? 6 : g.precision) : [];
      const isWalk = l.mode === 'WALK';
      const kind = isWalk ? 'WALK' : 'TRANSIT';
      return {
        kind, color: isWalk ? COLOR.WALK : (l.routeColor ? '#' + String(l.routeColor).replace(/^#/,'') : COLOR.TRANSIT),
        coords,
        line: l.routeShortName || l.displayName || '',
        vehicle: transitLabel(l.mode),
        headsign: l.headsign || (l.to && l.to.name) || '',
        fromName: endName((l.from && l.from.name) || '', a), toName: endName((l.to && l.to.name) || '', b),
        startTime: l.startTime, endTime: l.endTime,
        schedStart: l.scheduledStartTime || null,
        realTime: l.realTime === true,
        delay: (l.scheduledStartTime && l.startTime)
          ? Math.round((new Date(l.startTime) - new Date(l.scheduledStartTime)) / 60000) : null,
        stopId: (l.from && (l.from.stopId || l.from.id)) || null,
        duration: l.duration, distance: l.distance || 0, steps: []
      };
    });
    const dur = it.duration != null ? it.duration
      : (new Date(it.endTime) - new Date(it.startTime))/1000;
    return { mode:'transit', duration:dur,
      distance: legs.reduce((s,l) => s + (l.distance || 0), 0),
      walkDistance: legs.filter(l => l.kind === 'WALK').reduce((s,l) => s + (l.distance || 0), 0),
      depart: it.startTime, arrive: it.endTime,
      transfers: Math.max(0, legs.filter(l => l.kind === 'TRANSIT').length - 1),
      live: legs.some(l => l.realTime),
      maxDelay: legs.reduce((d,l) => (l.delay != null && Math.abs(l.delay) > Math.abs(d)) ? l.delay : d, 0),
      source:'Transitous', legs };
  });
  out.sort((x, y) => new Date(x.arrive) - new Date(y.arrive));
  return out;
}
async function planMode(m){
  const a = trip.from, b = trip.to;
  if(m === 'drive')  return await routeDrive(a,b);
  if(m === 'walk')   return await routeValhalla(a,b,'pedestrian');
  if(m === 'bike')   return await routeValhalla(a,b,'bicycle');
  return await routeTransit(a,b);
}

/* ── planning ─────────────────────────────────────────────── */
let planToken = 0;
async function planAll(){
  if(!trip.from || !trip.to) return;
  const token = ++planToken;
  options = []; current = null;
  paintRoute(null);
  $('results').innerHTML = '<div class="note">Finding routes…</div>';
  document.querySelectorAll('.mode').forEach(el => { el.classList.add('busy'); el.querySelector('em').textContent = ''; });

  const jobs = ['drive','transit','bike','walk'].map(async m => {
    try{
      const res = await planMode(m);
      if(token !== planToken) return;
      etaCache[m] = res[0] ? res[0].duration : null;
      setTab(m, res[0] ? fmtShort(res[0].duration) : '—');
      if(m === mode){ options = res; current = res[0]; renderOptions(); paintRoute(current); fitRoute(current);
        refreshDepartures(current); loadSignals(current);
        if(isPhone() && sheetIdx < 1) snapSheet(1); }
    }catch(e){
      if(token !== planToken) return;
      etaCache[m] = null;
      setTab(m, e.message === 'NO_TRANSIT' ? 'none' : '—');
      if(m === mode){ options = []; current = null; renderError(m, e); }
    }
  });
  await Promise.all(jobs);
}
function setTab(m, txt){
  const el = document.querySelector('.mode[data-mode="' + m + '"]');
  if(!el) return;
  el.classList.remove('busy');
  el.querySelector('em').textContent = txt;
}
function emptyState(){
  $('live').hidden = true;
  $('results').innerHTML =
    '<div class="empty">' +
      '<div class="eicon">' + svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 2) + '</div>' +
      '<h3>Where are you going?</h3>' +
      '<p>Type a destination above, or tap anywhere on the map. ' +
      'We will price up driving, transit, cycling and walking side by side.</p>' +
      recentHtml() +
      '<div class="tips">' +
        '<span>Tap the map to drop a point</span>' +
        '<span>Transit shows live delays</span>' +
      '</div>' +
    '</div>';
  wireRecents();
}
function recentHtml(){
  const list = recents();
  if(!list.length) return '';
  return '<div class="recents"><div class="rhead">Recent</div>' +
    list.map((r,i) => '<button class="rec" data-r="' + i + '">' +
      svg('<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>', 1.8) +
      '<span>' + esc(r.name) + '</span></button>').join('') + '</div>';
}
function wireRecents(){
  const list = recents();
  document.querySelectorAll('.rec').forEach(el => el.addEventListener('click', () => {
    sugSlot = 'to'; setPlace('to', list[+el.dataset.r]);
  }));
}

/* "No transit" has two very different causes: the agency publishes no feed,
   or there is simply nothing running at this hour. Guessing wrong is how you
   tell somebody their city has no buses. So ask again for a weekday morning
   and let the answer decide what to say. */
function nextWeekdayMorning(from){
  const d = new Date(from || Date.now());
  d.setSeconds(0, 0);
  do { d.setDate(d.getDate() + 1); } while(d.getDay() === 0 || d.getDay() === 6);
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}
async function transitProbe(a, b){
  const when = nextWeekdayMorning();
  const url = MOTIS + '/api/v5/plan?fromPlace=' + a.lat + ',' + a.lon +
    '&toPlace=' + b.lat + ',' + b.lon +
    '&time=' + encodeURIComponent(new Date(when).toISOString()) +
    '&numItineraries=1&pedestrianProfile=FOOT';
  try{
    const j = await NET.json(url, null, { tries:1, ms:15000, label:'Transit probe' });
    const it = (j.itineraries || [])[0];
    if(!it) return null;
    return { when, duration: it.duration };
  }catch(e){ return null; }
}
function renderError(m, e){
  if(e.message === 'NO_TRANSIT'){
    $('results').innerHTML = '<div class="note"><b>No transit route right now.</b><br>Checking whether anything runs at another time…</div>';
    const a = trip.from, b = trip.to, token = planToken;
    transitProbe(a, b).then(hit => {
      if(token !== planToken || mode !== 'transit') return;
      if(hit){
        const d = new Date(hit.when);
        const day = d.toLocaleDateString(undefined, { weekday:'long' });
        $('results').innerHTML = '<div class="note"><b>Nothing is running at this hour.</b><br>' +
          'There is a ' + fmtShort(hit.duration) + ' trip if you leave ' + day + ' at ' + clock(hit.when) +
          '.</div><div class="go"><button class="btn primary" id="useWhen">Plan it for then</button></div>';
        const btn = $('useWhen');
        if(btn) btn.onclick = () => setDepart(hit.when);
      } else {
        $('results').innerHTML = '<div class="note"><b>No transit here.</b><br>' +
          'No agency covering this trip publishes an open timetable, so there is nothing to route on. ' +
          'Coverage is thin across much of the United States.</div>';
      }
    });
    return;
  }
  $('results').innerHTML = '<div class="note"><b>No ' + m + ' route.</b><br>' + esc(e.message) + '</div>';
}

/* ── live departures at the boarding stop ─────────────────── */
async function departures(stopId, name){
  const url = MOTIS + '/api/v1/stoptimes?stopId=' + encodeURIComponent(stopId) +
    '&time=' + encodeURIComponent(new Date().toISOString()) + '&n=6&arriveBy=false';
  const j = await NET.json(url, null, { tries:0, ms:12000, label:'Departure board' });
  const rows = (j.stopTimes || j.departures || []).map(d => {
    const t = d.place || d;
    const when = t.departure || t.time || t.scheduledDeparture;
    const sched = t.scheduledDeparture || null;
    const delay = (sched && when) ? Math.round((new Date(when) - new Date(sched)) / 60000) : null;
    return { when, sched, delay,
      realTime: d.realTime === true,                       // lives on the entry, not on place
      cancelled: d.cancelled === true || d.tripCancelled === true,
      line: (d.routeShortName || d.displayName || ''), headsign: d.headsign || '',
      mode: transitLabel(d.mode) };
  }).filter(r => r.when);
  return { name: (j.place && j.place.name) || name, rows };
}
function renderDepartures(board){
  const box = $('live');
  if(!board || !board.rows.length){ box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<div class="livehead"><span class="dotlive"></span>Live departures · ' +
    esc(board.name) + '</div>' +
    board.rows.slice(0,5).map(r => {
      const late = r.delay != null && r.delay !== 0;
      const cls = r.cancelled ? ' late' : late ? (r.delay > 0 ? ' late' : ' early') : '';
      const right = r.cancelled
        ? 'Cancelled'
        : clock(r.when) + (late ? '  ' + (r.delay > 0 ? '+' : '') + r.delay : '');
      const sub = (late && !r.cancelled) ? '<s>' + clock(r.sched) + '</s>' : (r.realTime ? 'live' : '');
      return '<div class="dep"><b>' + esc(r.line || r.mode) + '</b>' +
        '<span class="to">' + esc(r.headsign) + '</span>' +
        '<span class="sched">' + sub + '</span>' +
        '<span class="at' + cls + '">' + right + '</span></div>';
    }).join('');
}
async function refreshDepartures(it){
  const box = $('live');
  if(!it || it.mode !== 'transit'){ box.hidden = true; return; }
  const leg = it.legs.find(l => l.kind === 'TRANSIT' && l.stopId);
  if(!leg){ box.hidden = true; return; }
  try{ renderDepartures(await departures(leg.stopId, leg.fromName)); }
  catch(e){ box.hidden = true; }
}

/* ── rendering routes ─────────────────────────────────────── */
function paintAlts(){
  const asrc = map.getSource('alts');
  if(!asrc) return;
  const feats = [];
  options.forEach(o => {
    if(o === current) return;
    o.legs.forEach(l => { if(l.coords && l.coords.length > 1)
      feats.push({ type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates:l.coords } }); });
  });
  asrc.setData({ type:'FeatureCollection', features: feats });
}

/* TomTom hands back the stretches that are actually slow, as index ranges
   into the route's points. Drawn over the route, they read like the
   red-and-amber bands people already expect on a map. */
const JAM_COL = ['#f0a92b','#f0a92b','#ef7d1a','#e23b2e','#b5231a'];
function jamData(it){
  const leg = it.legs && it.legs[0];
  if(!it.jams || !it.jams.length || !leg || !leg.coords) return EMPTY;
  const c = leg.coords;
  const feats = it.jams.map(j => {
    const a = Math.max(0, Math.min(c.length - 1, j.from));
    const b = Math.max(a + 1, Math.min(c.length, j.to + 1));
    const seg = c.slice(a, b);
    if(seg.length < 2) return null;
    return { type:'Feature',
      properties:{ col: JAM_COL[Math.max(0, Math.min(4, j.mag))] || JAM_COL[2] },
      geometry:{ type:'LineString', coordinates: seg } };
  }).filter(Boolean);
  return { type:'FeatureCollection', features: feats };
}
function paintRoute(it){
  const src = map.getSource('route'), ssrc = map.getSource('stops');
  if(!src) return;
  paintAlts();
  const jsrc = map.getSource('jams');
  if(!it){ src.setData(EMPTY); if(ssrc) ssrc.setData(EMPTY); if(jsrc) jsrc.setData(EMPTY); return; }
  if(jsrc) jsrc.setData(jamData(it));
  const feats = it.legs.filter(l => l.coords && l.coords.length > 1).map(l => ({
    type:'Feature', properties:{ color:l.color, walk: l.kind === 'WALK' },
    geometry:{ type:'LineString', coordinates:l.coords }
  }));
  src.setData({ type:'FeatureCollection', features: feats });
  if(ssrc){
    const pts = [];
    it.legs.forEach(l => {
      if(l.kind === 'TRANSIT' && l.coords.length){
        pts.push({ type:'Feature', properties:{ color:l.color },
          geometry:{ type:'Point', coordinates:l.coords[0] } });
        pts.push({ type:'Feature', properties:{ color:l.color },
          geometry:{ type:'Point', coordinates:l.coords[l.coords.length-1] } });
      }
    });
    ssrc.setData({ type:'FeatureCollection', features: pts });
  }
}
function fitRoute(it){
  if(!it) return;
  let mnx=180,mny=90,mxx=-180,mxy=-90, any=false;
  it.legs.forEach(l => l.coords.forEach(p => {
    any=true; mnx=Math.min(mnx,p[0]); mxx=Math.max(mxx,p[0]); mny=Math.min(mny,p[1]); mxy=Math.max(mxy,p[1]);
  }));
  if(!any) return;
  const wide = innerWidth >= 760;
  // frame the route in the map you can actually see, not behind the sheet
  const pad = wide
    ? { top:70, right:60, bottom:60, left:432 }
    : sheetPad();
  map.fitBounds([[mnx,mny],[mxx,mxy]], { duration:800, pitch:0, padding:pad });
}
const ICON = {
  WALK:'<path d="M13 4.2a1.6 1.6 0 100-.1zM11 21l2-6-2.5-2.5L9.5 9 13 7.5l3 2.5 2.5 1M10.5 12.5L7 15l-1 6"/>',
  BIKE:'<circle cx="5.5" cy="17" r="3.3"/><circle cx="18.5" cy="17" r="3.3"/><path d="M5.5 17l4-9h5M12 17l3-8"/>',
  CAR:'<path d="M5 17h14M4 17v-4.2l1.8-4.3A2 2 0 017.6 7h8.8a2 2 0 011.8 1.5L20 12.8V17"/>',
  TRANSIT:'<rect x="6" y="3" width="12" height="13" rx="2.5"/><path d="M6 10h12M9 20l-1.5 2M15 20l1.5 2"/>'
};
const svg = (p, s) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
  (s || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';

function renderOptions(){
  if(!options.length){ $('results').innerHTML = ''; return; }
  const html = options.map((it, i) => {
    const sel = it === current ? ' on' : '';
    let chain = '';
    if(it.mode === 'transit'){
      const parts = [];
      it.legs.forEach(l => {
        if(l.kind === 'WALK'){
          parts.push('<span class="pill">' + svg(ICON.WALK, 2) + fmtShort(l.duration || 0) + '</span>');
        } else {
          parts.push('<span class="pill t" style="background:' + l.color + '">' +
            svg(ICON.TRANSIT, 2) + esc(l.line || l.vehicle) + '</span>');
        }
      });
      chain = '<div class="chain">' + parts.join('<span class="sepx">›</span>') + '</div>';
    }
    const when = it.mode === 'transit'
      ? (it.depart ? clock(it.depart) + ' → ' + clock(it.arrive) : '')
      : (it.arrive ? clock(it.arrive) : '');
    const liveTag = it.live
      ? '<span class="livetag"><span class="dotlive"></span>' +
        (it.maxDelay ? (it.maxDelay > 0 ? it.maxDelay + ' min late' : Math.abs(it.maxDelay) + ' min early') : 'On time') +
        '</span>' : '';
    const sum = it.mode === 'transit'
      ? (it.transfers === 0 ? 'Direct' : it.transfers + ' transfer' + (it.transfers > 1 ? 's' : ''))
      : [it.via || '', (i === 0 && options.length > 1 ? 'fastest' : ''),
         (it.delay >= 60 ? fmtShort(it.delay) + ' of traffic' : (it.traffic ? 'traffic is clear' : ''))]
        .filter(Boolean).join(' · ');
    return '<div class="opt' + sel + '" data-i="' + i + '">' +
      '<div class="top"><span class="dur">' + fmtDur(it.duration) + '</span>' +
      '<span class="dist">' + (it.mode === 'transit'
        ? fmtDist(it.walkDistance || 0) + ' walking'
        : fmtDist(it.distance)) + '</span>' +
      (when ? '<span class="when">' + when + '</span>' : '') + '</div>' +
      chain + ((sum || liveTag) ? '<div class="sum">' + esc(sum) + (sum && liveTag ? ' · ' : '') + liveTag + '</div>' : '') +
      (it === current ? detailHtml(it) : '') + '</div>';
  }).join('');
  $('results').innerHTML = html;
  $('results').querySelectorAll('.opt').forEach(el => {
    el.addEventListener('click', ev => {
      if(ev.target.closest('.step') || ev.target.closest('.btn')) return;
      current = options[+el.dataset.i];
      renderOptions(); paintRoute(current); fitRoute(current); refreshDepartures(current); loadSignals(current);
    });
  });
  const startBtn = $('startNav');
  if(startBtn) startBtn.onclick = () => startNav(current);
  const unitBtn = $('unitBtn');
  if(unitBtn) unitBtn.onclick = () => {
    units = IMP() ? 'metric' : 'imperial'; store.set('tern.units', units); planAll();
  };
  $('results').querySelectorAll('.step').forEach(el => el.addEventListener('click', () => {
    const leg = current.legs[+el.dataset.l], s = leg.steps[+el.dataset.s];
    if(s && s.lon != null) map.flyTo({ center:[s.lon, s.lat], zoom:16.5, speed:1.4 });
  }));
}
function detailHtml(it){
  let rows = '';
  if(it.mode === 'transit'){
    rows = it.legs.map(l => {
      const head = l.kind === 'WALK'
        ? 'Walk ' + fmtShort(l.duration || 0) + (l.toName ? ' to ' + esc(l.toName) : '')
        : esc(l.vehicle) + (l.line ? ' ' + esc(l.line) : '') + (l.headsign ? ' toward ' + esc(l.headsign) : '');
      const dly = (l.delay != null && l.delay !== 0)
        ? ' <span class="' + (l.delay > 0 ? 'late' : 'early') + '">' +
          (l.delay > 0 ? '+' : '') + l.delay + ' min</span>' : (l.realTime ? ' <span class="ontime">on time</span>' : '');
      const sub = l.kind === 'WALK'
        ? fmtDist(l.distance || 0)
        : clock(l.startTime) + dly + ' ' + esc(l.fromName) + ' → ' + clock(l.endTime) + ' ' + esc(l.toName);
      return '<div class="step"><div class="ic">' + svg(l.kind === 'WALK' ? ICON.WALK : ICON.TRANSIT) +
        '</div><div><div class="a">' + head + '</div><div class="b">' + sub + '</div></div></div>';
    }).join('');
  } else {
    const leg = it.legs[0];
    rows = leg.steps.map((s, i) =>
      '<div class="step" data-l="0" data-s="' + i + '"><div class="ic">' + turnIcon(s.text) +
      '</div><div><div class="a">' + esc(s.text) + '</div><div class="b">' +
      (s.dist ? fmtDist(s.dist) : '') + (s.road ? ' · ' + esc(s.road) : '') + '</div></div></div>').join('');
  }
  const canNav = it.mode !== 'transit' && it.legs[0] && it.legs[0].steps.length;
  const go = canNav
    ? '<div class="go"><button class="btn primary" id="startNav">Start</button>' +
      '<button class="btn" id="unitBtn">' + (IMP() ? 'mi' : 'km') + '</button></div>'
    : '';
  return go + '<div class="steps">' + rows + '</div>';
}
function turnIcon(t){
  const a = (t || '').toLowerCase();
  if(a.includes('left'))  return svg('<path d="M9 5L4 10l5 5"/><path d="M4 10h10a6 6 0 016 6v3"/>', 2.1);
  if(a.includes('right')) return svg('<path d="M15 5l5 5-5 5"/><path d="M20 10H10a6 6 0 00-6 6v3"/>', 2.1);
  if(a.includes('arrive') || a.includes('destination'))
    return svg('<path d="M12 22s7-6.3 7-12a7 7 0 10-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2"/>', 2);
  return svg('<path d="M12 21V5"/><path d="M6 11l6-6 6 6"/>', 2.1);
}

/* ── suggestions ──────────────────────────────────────────── */
let sugList = [], sugSel = -1, sugSlot = 'to', sugTimer;
function bindField(slot){
  const input = $(slot + 'Input');
  input.addEventListener('input', () => {
    sugSlot = slot;
    if(slot === 'to') $('clearTo').hidden = !input.value;
    clearTimeout(sugTimer);
    const v = input.value.trim();
    if(v.length < 2){ hideSug(); return; }
    sugTimer = setTimeout(async () => {
      try{ sugList = await geocode(v); sugSel = -1; drawSug(); }
      catch(e){
        if(e.name === 'AbortError') return;
        $('suggest').hidden = false;
        $('suggest').innerHTML = '<div class="note" style="padding:11px">' + esc(e.message) + '</div>';
      }
    }, 240);
  });
  input.addEventListener('keydown', e => {
    if(e.key === 'Escape'){ hideSug(); input.blur(); return; }
    if(!sugList.length) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); sugSel = Math.min(sugList.length-1, sugSel+1); drawSug(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); sugSel = Math.max(0, sugSel-1); drawSug(); }
    else if(e.key === 'Enter'){ e.preventDefault(); choose(sugList[sugSel < 0 ? 0 : sugSel]); }
  });
}
function drawSug(){
  const box = $('suggest');
  if(!sugList.length){ box.hidden = false; box.innerHTML = '<div class="note" style="padding:11px">No matches.</div>'; return; }
  box.hidden = false;
  box.innerHTML = sugList.map((r,i) =>
    '<div class="sug' + (i === sugSel ? ' sel' : '') + '" data-i="' + i + '">' +
    '<span class="pin">' + svg('<path d="M12 22s7-6.3 7-12a7 7 0 10-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2.4"/>', 2) + '</span>' +
    '<span style="min-width:0"><b>' + esc(r.name) + '</b><small>' + esc(r.detail) + '</small></span></div>').join('');
  box.querySelectorAll('.sug').forEach(el => el.addEventListener('click', () => choose(sugList[+el.dataset.i])));
}
function hideSug(){ $('suggest').hidden = true; sugList = []; sugSel = -1; }
function choose(r){ if(!r) return; hideSug(); setPlace(sugSlot, r); }

/* ── map interaction ──────────────────────────────────────── */
function sheetPad(){
  if(!isPhone()) return { top:70, bottom:70, left:70, right:70 };
  const vis = sheetPx || sheetStops()[sheetIdx];
  return { top:70, left:40, right:40,
    bottom: Math.min(Math.round(window.innerHeight * 0.52), vis + 30) };
}
function wireMap(){
  // reaching for the map means you want to see it
  map.on('dragstart', () => { if(isPhone() && sheetIdx > 0 && !sheetDrag) snapSheet(0, true); });
  map.on('click', async e => {
    if(pickingStart){
      pickingStart = false;
      map.getCanvas().style.cursor = '';
      const lat = e.lngLat.lat, lon = e.lngLat.lng;
      store.set('tern.home', JSON.stringify({ lat, lon }));
      showMe(lat, lon);
      setPlace('from', { name:'My position', detail:'set by hand', lat, lon });
      gpsBanner('manual');
      toast('Saved. Routes will start here until you change it.', 4500);
      return;
    }
    const hit = map.queryRenderedFeatures(e.point).find(f =>
      f.layer && /poi|place/i.test(f.layer['source-layer'] || '') && f.properties && f.properties.name);
    const base = { lat:e.lngLat.lat, lon:e.lngLat.lng };
    if(hit){
      setPlace(trip.from ? 'to' : 'from',
        { name: hit.properties.name, detail:'', lat: base.lat, lon: base.lon });
      return;
    }
    const slot = trip.from ? 'to' : 'from';
    setPlace(slot, { name:'Pin ' + base.lat.toFixed(4) + ', ' + base.lon.toFixed(4), detail:'', ...base });
    const got = await reverse(base.lat, base.lon);
    if(got){ trip[slot] = got; $(slot + 'Input').value = got.name; }
  });
  map.on('mousemove', e => {
    const hit = map.queryRenderedFeatures(e.point).find(f =>
      f.layer && /poi/i.test(f.layer['source-layer'] || '') && f.properties && f.properties.name);
    map.getCanvas().style.cursor = hit ? 'pointer' : '';
  });
}

/* ── GPS ──────────────────────────────────────────────────── */
let me = null, meMk = null, watch = null, following = false, speed = null;
function showMe(lat, lon){
  me = { lat, lon };
  if(!meMk){
    const d = document.createElement('div'); d.className = 'me';
    meMk = new maplibregl.Marker({ element:d }).setLngLat([lon, lat]).addTo(map);
  } else meMk.setLngLat([lon, lat]);
}
function requestFix(){
  return new Promise((resolve, reject) => {
    if(!navigator.geolocation) return reject({ code:0 });
    // precise first, briefly; desktops without GPS hardware time out here
    navigator.geolocation.getCurrentPosition(resolve, e1 => {
      if(e1.code === 1) return reject(e1);                 // denied: retrying is pointless
      // coarse retry: wifi and IP positioning, happy to use a cached fix
      navigator.geolocation.getCurrentPosition(resolve, reject,
        { enableHighAccuracy:false, timeout:16000, maximumAge:600000 });
    }, { enableHighAccuracy:true, timeout:7000, maximumAge:60000 });
  });
}
async function ipLocate(){
  const tryOne = async url => {
    const j = await NET.json(url, null, { tries:0, ms:6000, label:'Network location' });
    const lat = parseFloat(j.latitude != null ? j.latitude : j.lat);
    const lon = parseFloat(j.longitude != null ? j.longitude : j.lon);
    if(!isFinite(lat) || !isFinite(lon)) throw new Error('no coordinates');
    return { lat, lon, city: j.city || '', region: j.region || j.region_name || '' };
  };
  try{ return await tryOne('https://ipwho.is/'); }
  catch(e){ return await tryOne('https://ipapi.co/json/'); }
}
function rememberFix(lat, lon){ store.set('tern.lastfix', JSON.stringify({ lat, lon, t:Date.now() })); }
function lastFix(){
  try{
    const f = JSON.parse(store.get('tern.lastfix', 'null'));
    if(f && isFinite(f.lat) && Date.now() - f.t < 7 * 864e5) return f;
  }catch(e){}
  return null;
}
let pickingStart = false;
function beginPickStart(){
  pickingStart = true;
  map.getCanvas().style.cursor = 'crosshair';
  toast('Tap your exact position on the map. It will be remembered.', 6000);
}
function savedHome(){
  try{
    const h = JSON.parse(store.get('tern.home', 'null'));
    if(h && isFinite(h.lat) && isFinite(h.lon)) return h;
  }catch(e){}
  return null;
}
function gpsBanner(state){
  const bar = $('gpsbar'), t = $('gpsTitle'), b = $('gpsBody'), fix = $('gpsFix');
  if(state === 'granted'){ bar.hidden = true; return; }
  bar.hidden = false; fix.hidden = false;
  if(state === 'manual'){
    t.textContent = 'Using the position you set';
    b.textContent = 'Saved on this computer, so routes start here every time. ' +
      'Press Set on map to move it.';
    fix.textContent = 'Try GPS';
  } else if(state === 'approx'){
    t.textContent = 'Using your approximate location';
    b.textContent = 'Worked out from your network address, accurate to around a city. ' +
      'Tap the map to set an exact starting point.';
    fix.textContent = 'Try GPS';
  } else if(state === 'searching'){
    t.textContent = 'Finding your location';
    b.textContent = 'This can take a few seconds on a computer without GPS hardware.';
    fix.hidden = true;
  } else if(state === 'timeout'){
    t.textContent = 'Your browser will not report a location';
    b.textContent = 'Every method timed out. That usually means a VPN, an extension blocking ' +
      'googleapis.com, or Windows location switched off for Chrome. Set your position on the map ' +
      'instead and it will be remembered.';
    fix.textContent = 'Try again';
  } else if(state === 'denied'){
    t.textContent = 'Location is blocked';
    b.textContent = 'Click the icon at the left of the address bar, set Location to Allow, then press Retry. ' +
      'Until then you can tap the map to set a starting point.';
    fix.textContent = 'Retry';
  } else if(state === 'unsupported'){
    t.textContent = 'Location is unavailable';
    b.textContent = 'This browser will not share a position. Tap the map to set a starting point.';
    fix.hidden = true;
  } else {
    t.textContent = 'Turn on location';
    b.textContent = 'Routes then start from where you are, and navigation follows you as you move.';
    fix.textContent = 'Turn on';
  }
  fix.onclick = () => { fix.textContent = 'Locating…'; useGps(); };
  const pick = $('gpsPick');
  if(pick){ pick.hidden = false; pick.onclick = beginPickStart; }
  const hide = $('gpsHide');
  if(hide) hide.onclick = () => { bar.hidden = true; };
}
function checkGpsPermission(){
  if(!navigator.geolocation){ gpsBanner('unsupported'); return; }
  if(navigator.permissions && navigator.permissions.query){
    navigator.permissions.query({ name:'geolocation' }).then(st => {
      if(st.state !== 'granted') gpsBanner(st.state);   // granted only means allowed, not located
      st.onchange = () => { if(st.state === 'granted') locateNow(true, false); else gpsBanner(st.state); };
    }).catch(() => gpsBanner('prompt'));
  } else gpsBanner('prompt');
}
async function locateNow(makeStart, force){
  if(!navigator.geolocation){ gpsBanner('unsupported'); return false; }
  gpsBanner('searching');
  try{
    const p = await requestFix();
    showMe(p.coords.latitude, p.coords.longitude);
    rememberFix(me.lat, me.lon);
    $('locBtn').classList.add('live');
    gpsBanner('granted');
    if(makeStart && (force || !userStart))
      setPlace('from', { name:'Your location', detail:'', lat:me.lat, lon:me.lon }, true);
    return true;
  }catch(e){
    if(e && e.code === 1){ gpsBanner('denied'); return false; }
    // no GPS hardware: fall back to the network address rather than giving up
    try{
      const ip = await ipLocate();
      if(userStart && !force){ gpsBanner('approx'); return false; }   // do not hijack their choice
      showMe(ip.lat, ip.lon);
      if(makeStart) setPlace('from',
        { name:'Approximate location' + (ip.city ? ' · ' + ip.city : ''), detail:'', lat:ip.lat, lon:ip.lon }, true);
      gpsBanner('approx');
      return true;
    }catch(e2){ gpsBanner('timeout'); return false; }
  }
}
const PROVISIONAL = /^(Last known|Approximate|Your) location/i;
function adoptStart(name, lat, lon, fly){
  if(userStart) return;                                        // the user chose one: leave it alone
  if(trip.from && !PROVISIONAL.test(trip.from.name)) return;
  trip.from = { name, detail:'', lat, lon };
  $('fromInput').value = name;
  if(trip.to) planAll();
  else if(fly && !trip.to) map.flyTo({ center:[lon, lat], zoom:13, speed:1.2 });
}
function initialLocate(){
  const home = savedHome();
  if(home){
    showMe(home.lat, home.lon);
    userStart = true;                        // a position they set outranks any guess
    setPlace('from', { name:'My position', detail:'set by hand', lat:home.lat, lon:home.lon });
    gpsBanner('manual');
    if(!trip.to) map.flyTo({ center:[home.lon, home.lat], zoom:14, speed:1.2 });
    return;
  }
  const last = lastFix();
  if(last){ showMe(last.lat, last.lon); adoptStart('Last known location', last.lat, last.lon, true); }

  // approximate position from the network answers in well under a second,
  // so the app is usable immediately instead of after a GPS timeout
  if(!last){
    ipLocate().then(ip => {
      if(me || userStart) return;                     // a real fix, or the user's own choice, already landed
      showMe(ip.lat, ip.lon);
      adoptStart('Approximate location' + (ip.city ? ' · ' + ip.city : ''), ip.lat, ip.lon, true);
      gpsBanner('approx');
    }).catch(() => {});
  }

  // and keep trying for a precise fix, which upgrades the start if it arrives
  locateNow(false).then(got => {
    if(got){ adoptStart('Your location', me.lat, me.lon, !trip.to); }
  });
}
async function useGps(){
  const got = await locateNow(true, true);
  if(!got) toast('No location came back. Tap the map to set your starting point instead.', 6000);
}
function toggleFollow(){
  following = !following;
  $('locBtn').classList.toggle('on', following);
  if(following){
    if(!navigator.geolocation){ following = false; return; }
    watch = navigator.geolocation.watchPosition(p => {
      showMe(p.coords.latitude, p.coords.longitude);
      rememberFix(me.lat, me.lon);
      $('locBtn').classList.add('live'); gpsBanner('granted');
      speed = p.coords.speed != null && p.coords.speed >= 0
        ? (IMP() ? p.coords.speed * 2.23694 : p.coords.speed * 3.6) : null;
      advance();
      map.easeTo({ center:[me.lon, me.lat], duration:650,
        bearing: (p.coords.heading != null && !isNaN(p.coords.heading)) ? p.coords.heading : map.getBearing() });
    }, err => {
      following = false; $('locBtn').classList.remove('on');
      toast(err.code === 1 ? 'Location is blocked for this site.' : 'Lost the GPS signal.', 5000);
    }, { enableHighAccuracy:true, maximumAge:2000, timeout:12000 });
  } else if(watch != null){ navigator.geolocation.clearWatch(watch); watch = null; }
}

/* ── spoken guidance ──────────────────────────────────────── */
let voiceOn = store.get('tern.voice', '1') === '1';
const canSpeak = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
function speak(text, force){
  if((!voiceOn && !force) || !canSpeak() || !text) return;
  try{
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.03; u.pitch = 1; u.volume = 1; u.lang = 'en-US';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }catch(e){}
}
function spokenDistance(m){
  if(m == null) return '';
  if(IMP()){
    const ft = m * 3.28084, mi = m / 1609.34;
    if(mi >= 0.45) return 'In half a mile, ';
    if(mi >= 0.2)  return 'In a quarter mile, ';
    if(ft >= 400)  return 'In ' + (Math.round(ft / 100) * 100) + ' feet, ';
    if(ft >= 150)  return 'In ' + (Math.round(ft / 50) * 50) + ' feet, ';
    return '';
  }
  if(m >= 800) return 'In ' + (m / 1000).toFixed(1).replace('.0','') + ' kilometres, ';
  if(m >= 150) return 'In ' + (Math.round(m / 50) * 50) + ' metres, ';
  return '';
}
function spokenStep(text){
  return String(text || '')
    .replace(/\bSt\b/g, 'Street').replace(/\bRd\b/g, 'Road').replace(/\bAve\b/g, 'Avenue')
    .replace(/\bBlvd\b/g, 'Boulevard').replace(/\bDr\b/g, 'Drive').replace(/\bHwy\b/g, 'Highway')
    .replace(/\bLn\b/g, 'Lane').replace(/\bPkwy\b/g, 'Parkway').replace(/\bI-(\d+)/g, 'Interstate $1');
}
const VOICE_MARKS = [800, 300, 60];
function voiceTick(){
  if(!nav || nav.done || !me) return;
  const s = nav.steps[nav.i];
  if(!s || s.lat == null) return;
  const d = (s.along != null && nav.routeLen)
    ? Math.max(0, s.along - nav.travelled)
    : hav(me, { lat:s.lat, lon:s.lon });
  nav.said = nav.said || {};
  const done = nav.said[nav.i] = nav.said[nav.i] || [];
  // announce for the band the distance actually falls in, so sitting on top of
  // a turn does not silently consume the half-mile warning
  let band = null;
  for(let k = 0; k < VOICE_MARKS.length; k++){
    const hi = VOICE_MARKS[k], lo = VOICE_MARKS[k + 1] || 0;
    if(d <= hi && d > lo){ band = hi; break; }
  }
  if(band && done.indexOf(band) === -1){
    done.push(band);
    speak(spokenDistance(d) + spokenStep(s.text));
  }
}

/* ── which way am I pointing ──────────────────────────────── */
function bearing(a, b){
  const t = x => x * Math.PI / 180;
  const y = Math.sin(t(b.lon - a.lon)) * Math.cos(t(b.lat));
  const x = Math.cos(t(a.lat)) * Math.sin(t(b.lat)) -
            Math.sin(t(a.lat)) * Math.cos(t(b.lat)) * Math.cos(t(b.lon - a.lon));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/* ── route geometry: snap a position onto the line ────────── */
function snapToRoute(coords, cum, pt){
  const k = Math.cos(pt.lat * Math.PI / 180);
  let bd = Infinity, bs = 0, bi = 0;
  for(let i = 1; i < coords.length; i++){
    const ax = coords[i-1][0], ay = coords[i-1][1];
    const dx = (coords[i][0] - ax) * k, dy = coords[i][1] - ay;
    const px = (pt.lon - ax) * k,       py = pt.lat - ay;
    const len2 = dx*dx + dy*dy;
    let t = len2 ? (px*dx + py*dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = px - t*dx, cy = py - t*dy;
    const d2 = cx*cx + cy*cy;
    if(d2 < bd){ bd = d2; bs = cum[i-1] + t * (cum[i] - cum[i-1]); bi = i; }
  }
  return { metres: Math.sqrt(bd) * 111320, along: bs, index: bi };
}

/* ── turn by turn ─────────────────────────────────────────── */
let nav = null;
function startNav(it){
  if(!it || !it.legs[0] || !it.legs[0].steps.length) return;
  nav = { steps: it.legs[0].steps, i:0, total: it.duration, dist: it.distance, via: it.via || '',
          dest: (trip.to && trip.to.name) || 'your destination', done:false,
          coords: (it.legs[0].coords || []).slice(), said:{} };
  $('arrived').hidden = true; $('navBar').hidden = false;
  nav.cum = cumulative(nav.coords.length > 1 ? nav.coords : [[0,0],[0,0]]);
  nav.routeLen = nav.cum[nav.cum.length - 1] || nav.dist || 0;
  nav.steps.forEach(st => {
    st.along = st.offset != null ? st.offset
      : ((st.lat != null && nav.coords.length > 1)
        ? snapToRoute(nav.coords, nav.cum, { lat:st.lat, lon:st.lon }).along : null);
  });
  nav.profile = nav.steps
    .filter(st => st.along != null && st.t != null)
    .map(st => ({ d: st.along, t: st.t }))
    .sort((x, y) => x.d - y.d);
  if(nav.profile.length < 2) nav.profile = null;
  nav.travelled = 0;
  nav.manual = null;
  nav.lastCheck = Date.now();
  $('nav').hidden = false;
  if(isPhone()) $('panel').style.transform = '';
  $('panel').classList.add('hid');
  // the route's own first point is always right; a guessed position may be miles away
  const head = (nav.coords && nav.coords.length) ? nav.coords[0] : null;
  const first = nav.steps.find(s => s.lat != null);
  const centre = head ? head
    : (first ? [first.lon, first.lat]
    : (me ? [me.lon, me.lat] : null));
  const brg = (nav.coords && nav.coords.length > 1)
    ? bearing({ lat:nav.coords[0][1], lon:nav.coords[0][0] },
              { lat:nav.coords[1][1], lon:nav.coords[1][0] }) : 0;
  map.easeTo(Object.assign({ pitch:60, zoom:17, duration:900, bearing: brg },
    centre ? { center: centre } : {}));
  if(!following) toggleFollow();
  $('voiceBtn').classList.toggle('on', voiceOn);
  speak('Starting route to ' + nav.dest + '. ' + spokenStep(nav.steps[0].text));
  paintNav();
}

/* Traffic that forms after you set off is the main reason a quoted time
   goes wrong. While driving, re-ask the router from where you actually are
   and take the new numbers, so the ETA keeps up with the road. */
const RECHECK_MS = 120000;
let reBusy = false;
async function recheckTraffic(){
  if(!nav || nav.done || reBusy) return;
  if(!ttKey || quotaUsed() >= QUOTA) return;
  if(!me || !trip.to || nav.offRoute) return;
  if(Date.now() - (nav.lastCheck || 0) < RECHECK_MS) return;
  nav.lastCheck = Date.now();
  reBusy = true;
  try{
    const fresh = await routeTomTom({ lat:me.lat, lon:me.lon }, trip.to);
    if(!nav || nav.done || !fresh.length) return;
    const best = fresh[0];
    const was = secsLeft();
    nav.total     = best.duration;
    nav.dist      = best.distance;
    nav.routeLen  = 0;            // rebuilt below from the fresh geometry
    nav.coords    = (best.legs[0].coords || []).slice();
    nav.cum       = cumulative(nav.coords.length > 1 ? nav.coords : [[0,0],[0,0]]);
    nav.routeLen  = nav.cum[nav.cum.length - 1] || best.distance || 0;
    nav.steps     = best.legs[0].steps;
    nav.steps.forEach(st => { st.along = st.offset != null ? st.offset : null; });
    nav.profile   = nav.steps.filter(st => st.along != null && st.t != null)
                      .map(st => ({ d:st.along, t:st.t })).sort((x,y) => x.d - y.d);
    if(nav.profile.length < 2) nav.profile = null;
    nav.travelled = 0;
    nav.manual    = null;
    nav.i         = 0;
    nav.said      = {};
    current = best;
    paintRoute(best);
    const now = secsLeft();
    const diff = Math.round((now - was) / 60);
    if(diff >= 3)       toast('Traffic ahead: ' + diff + ' min slower than planned', 5000);
    else if(diff <= -3) toast('Traffic cleared: ' + Math.abs(diff) + ' min faster', 4000);
    paintNav();
  }catch(e){}
  finally{ reBusy = false; }
}
function endNav(){
  stopSim();
  reBusy = false;
  if(canSpeak()){ try{ speechSynthesis.cancel(); }catch(e){} }
  nav = null;
  $('nav').hidden = true; $('arrived').hidden = true; $('recentre').hidden = true;
  $('panel').classList.remove('hid');
  layoutSheet();
  map.easeTo({ pitch:0, duration:700 });
}
function recentreNav(){
  if(!nav) return;
  const s = nav.steps[nav.i];
  const c = me ? [me.lon, me.lat] : (s && s.lon != null ? [s.lon, s.lat] : null);
  if(c) map.easeTo({ center:c, zoom:17, pitch:60, duration:650 });
  $('recentre').hidden = true;
}
function arrive(){
  if(!nav || nav.done) return;
  nav.done = true;
  stopSim();
  speak('You have arrived at ' + nav.dest);
  $('arrivedWhere').textContent = nav.dest;
  $('arrived').hidden = false;
  $('navBar').hidden = true;
  $('navThen').hidden = true;
}
function navIndexFor(travelled){
  for(let k = 0; k < nav.steps.length; k++){
    const a = nav.steps[k].along;
    if(a == null) continue;
    if(a > travelled + 6) return k;      // the first maneuver still ahead of you
  }
  return nav.steps.length - 1;
}

/* The old estimate scaled the total by distance left, which assumes you
   travel the whole trip at one speed. The router already says how long it
   expects you to take to reach each turn, so interpolate between those. */
function secsLeft(){
  if(!nav || !nav.routeLen) return 0;
  const left = Math.max(0, nav.routeLen - nav.travelled);
  const prof = nav.profile;
  if(!prof || prof.length < 2) return nav.total * (left / nav.routeLen);
  const d = nav.travelled;
  if(d <= prof[0].d) return Math.max(0, nav.total - prof[0].t);
  for(let k = 1; k < prof.length; k++){
    if(d <= prof[k].d){
      const span = prof[k].d - prof[k-1].d;
      const f = span > 0 ? (d - prof[k-1].d) / span : 0;
      const spent = prof[k-1].t + f * (prof[k].t - prof[k-1].t);
      return Math.max(0, nav.total - spent);
    }
  }
  return 0;
}
function paintNav(){
  if(!nav) return;
  if(me && nav.coords && nav.coords.length > 1){
    const sn = snapToRoute(nav.coords, nav.cum, me);
    if(sn.metres < 150){
      nav.travelled = sn.along;
      nav.offRoute = false;
      if(nav.manual == null) nav.i = navIndexFor(nav.travelled);
    } else nav.offRoute = true;
  }
  if(nav.manual != null) nav.i = nav.manual;
  const s = nav.steps[nav.i];
  $('navIcon').innerHTML = turnIcon(s.text);
  $('navInstr').textContent = s.text;
  $('navMeta').textContent = (nav.offRoute ? 'Off the route · ' : '') +
    'Step ' + (nav.i+1) + ' of ' + nav.steps.length + (s.road ? ' · ' + s.road : '');
  const nxt = nav.steps[nav.i + 1];
  if(nxt){
    $('navThen').hidden = false;
    $('navThenIcon').innerHTML = turnIcon(nxt.text);
    $('navThenText').textContent = 'Then ' + nxt.text.charAt(0).toLowerCase() + nxt.text.slice(1);
  } else $('navThen').hidden = true;
  // along the road, not as the crow flies
  let d;
  if(s.along != null && nav.routeLen) d = Math.max(0, s.along - nav.travelled);
  else if(me && s.lat != null)        d = hav(me, { lat:s.lat, lon:s.lon });
  else                                d = s.dist;
  $('navDist').textContent = d != null ? fmtDist(d) : '—';
  const left = nav.routeLen ? Math.max(0, nav.routeLen - nav.travelled) : 0;
  $('navLeft').textContent = fmtDist(left);
  const secs = secsLeft();
  $('navEta').textContent = clock(Date.now() + secs * 1000);
  $('navTimeLeft').textContent = fmtShort(secs);
  $('navTrip').textContent = fmtDur(nav.total) + ' · ' + fmtDist(nav.dist) + (nav.via ? ' · ' + nav.via : '');
  $('navSpeed').textContent = (speed != null && following) ? Math.round(speed) + (IMP() ? ' mph' : ' kph') : '—';
  $('navPrev').disabled = nav.i === 0;
  $('navNext').disabled = nav.i >= nav.steps.length - 1;
  const pct = nav.routeLen ? Math.max(0, Math.min(100, (nav.travelled / nav.routeLen) * 100)) : 0;
  $('navProgressFill').style.width = pct.toFixed(1) + '%';
  voiceTick();
  recheckTraffic();
  if(me && nav.routeLen && nav.travelled > 0 && left < 35) arrive();
}
function navStep(d){
  if(!nav) return;
  nav.manual = Math.max(0, Math.min(nav.steps.length - 1, nav.i + d));
  nav.i = nav.manual;
  const s = nav.steps[nav.i];
  speak(spokenStep(s.text), false);
  if(s.lon != null) map.easeTo({ center:[s.lon, s.lat], zoom:17, pitch:60, duration:650 });
  paintNav();
}
function advance(){
  if(!nav || !me) return;
  nav.manual = null;             // a live position takes control back from the buttons
  paintNav();
}
function advanceByProximity(){
  if(!nav || !me || !following) return;
  let near = -1, nd = Infinity;
  nav.steps.forEach((s, k) => {
    if(s.lat == null) return;
    const d = hav(me, { lat:s.lat, lon:s.lon });
    if(d < nd){ nd = d; near = k; }
  });
  if(near >= 0){
    const target = nd < 40 ? Math.min(near + 1, nav.steps.length - 1) : near;
    if(target > nav.i) nav.i = target;
  }
  paintNav();
}

/* ── traffic signals, stop signs and crossings on the route ── */
const OVERPASS = 'https://overpass-api.de/api/interpreter';
let signalCount = 0;
async function loadSignals(it){
  const src = map.getSource('signals');
  if(!src) return;
  const coords = (it && it.legs || []).reduce((a, l) => a.concat(l.coords || []), []);
  if(coords.length < 2){ src.setData(EMPTY); signalCount = 0; return; }
  let mnx=180, mny=90, mxx=-180, mxy=-90;
  for(const p of coords){
    mnx=Math.min(mnx,p[0]); mxx=Math.max(mxx,p[0]);
    mny=Math.min(mny,p[1]); mxy=Math.max(mxy,p[1]);
  }
  const km2 = Math.abs((mxy-mny)*111.32) * Math.abs((mxx-mnx)*111.32*Math.cos((mxy+mny)/2*Math.PI/180));
  if(km2 > 2500){ src.setData(EMPTY); signalCount = 0; return; }   // too wide to be worth it
  const q = '[out:json][timeout:20];(' +
    'node["highway"="traffic_signals"](' + mny + ',' + mnx + ',' + mxy + ',' + mxx + ');' +
    'node["highway"="stop"](' + mny + ',' + mnx + ',' + mxy + ',' + mxx + ');' +
    'node["highway"="crossing"]["crossing"="traffic_signals"](' + mny + ',' + mnx + ',' + mxy + ',' + mxx + ');' +
    ');out body;';
  try{
    const j = await NET.json(OVERPASS, { method:'POST',
      headers:{ 'Content-Type':'text/plain' }, body:q }, { tries:0, ms:22000, label:'Traffic signals' });
    const cum = cumulative(coords);
    const feats = [];
    for(const el of (j.elements || [])){
      if(el.lat == null) continue;
      const sn = snapToRoute(coords, cum, { lat:el.lat, lon:el.lon });
      if(sn.metres > 25) continue;                     // only what is actually on your route
      const kind = (el.tags && el.tags.highway === 'stop') ? 'stop' : 'signal';
      feats.push({ type:'Feature',
        properties:{ kind, along: sn.along,
          col: kind === 'stop' ? '#dc3545' : '#f0a92b' },
        geometry:{ type:'Point', coordinates:[el.lon, el.lat] } });
    }
    feats.sort((a,b) => a.properties.along - b.properties.along);
    signalCount = feats.filter(f => f.properties.kind === 'signal').length;
    src.setData({ type:'FeatureCollection', features: feats });
    const badge = $('signalBadge');
    if(badge){
      const stops = feats.length - signalCount;
      badge.hidden = feats.length === 0;
      badge.textContent = signalCount + ' light' + (signalCount === 1 ? '' : 's') +
        (stops ? ' · ' + stops + ' stop sign' + (stops === 1 ? '' : 's') : '');
    }
  }catch(e){ src.setData(EMPTY); signalCount = 0; }
}

/* ── drive preview, for machines with no GPS ──────────────── */
let sim = null;
function cumulative(pts){
  const acc = [0];
  for(let i = 1; i < pts.length; i++)
    acc.push(acc[i-1] + hav({ lat:pts[i-1][1], lon:pts[i-1][0] }, { lat:pts[i][1], lon:pts[i][0] }));
  return acc;
}
function pointAt(pts, acc, dist){
  if(dist <= 0) return { lon:pts[0][0], lat:pts[0][1], brg:0, done:false };
  const total = acc[acc.length - 1];
  if(dist >= total){
    const a = pts[pts.length - 2] || pts[0], b = pts[pts.length - 1];
    return { lon:b[0], lat:b[1], brg: bearing({lat:a[1],lon:a[0]}, {lat:b[1],lon:b[0]}), done:true };
  }
  let i = 1;
  while(i < acc.length && acc[i] < dist) i++;
  const seg = acc[i] - acc[i-1] || 1, f = (dist - acc[i-1]) / seg;
  const a = pts[i-1], b = pts[i];
  return { lon: a[0] + (b[0]-a[0]) * f, lat: a[1] + (b[1]-a[1]) * f,
           brg: bearing({lat:a[1],lon:a[0]}, {lat:b[1],lon:b[0]}), done:false };
}
function startSim(){
  if(!nav || !nav.coords || nav.coords.length < 2){ toast('No route geometry to preview'); return; }
  stopSim();
  if(following) toggleFollow();                      // the simulation drives position instead
  const pts = nav.coords, acc = cumulative(pts);
  const realSpeed = nav.dist && nav.total ? nav.dist / nav.total : 12;   // metres per second
  // fast enough to watch, slow enough to follow
  sim = { pts, acc, travelled:0, speed: Math.min(realSpeed * 3, 32), last: performance.now(), id:null };
  $('simBtn').classList.add('on');
  $('simBtn').textContent = 'Stop preview';
  toast('Previewing the drive with spoken directions, sped up', 4500);
  sim.id = setInterval(() => {
    const now = performance.now();
    const dt = Math.min(1, (now - sim.last) / 1000);
    sim.last = now;
    sim.travelled += sim.speed * dt;
    const p = pointAt(sim.pts, sim.acc, sim.travelled);
    me = { lat:p.lat, lon:p.lon };
    speed = IMP() ? sim.speed * 2.23694 : sim.speed * 3.6;
    showMe(p.lat, p.lon);
    map.easeTo({ center:[p.lon, p.lat], bearing:p.brg, pitch:62, zoom:17,
      duration:260, easing:t => t });
    advance();
    if(p.done){ arrive(); }
  }, 260);
}
function stopSim(){
  if(!sim) return;
  clearInterval(sim.id); sim = null;
  const b = $('simBtn');
  if(b){ b.classList.remove('on'); b.textContent = 'Preview drive'; }
}

/* ── traffic ──────────────────────────────────────────────── */
const QUOTA = 2500;
const qKey = () => 'tern.tt.' + new Date().toISOString().slice(0,10);
const quotaUsed = () => +(store.get(qKey(), '0')) || 0;
function qBump(){ const n = quotaUsed() + 1; store.set(qKey(), String(n)); stamp(); return n; }
function addTraffic(){
  if(!ttKey || map.getSource('flow')) return;
  const st = theme === 'dark' ? 'relative0-dark' : 'relative0';
  map.addSource('flow', { type:'raster', tileSize:256,
    tiles:['https://api.tomtom.com/traffic/map/4/tile/flow/' + st + '/{z}/{x}/{y}.png?key=' +
      encodeURIComponent(ttKey) + '&tileSize=256&thickness=4'] });
  map.addLayer({ id:'flow', type:'raster', source:'flow', paint:{ 'raster-opacity':.85 } },
    map.getLayer('route-case') ? 'route-case' : firstSymbol());
}
function removeTraffic(){
  if(map.getLayer('flow')) map.removeLayer('flow');
  if(map.getSource('flow')) map.removeSource('flow');
}
const INC_CAT = { 0:['Unknown','#8b949f'], 1:['Accident','#dc3545'], 2:['Fog','#8b949f'],
  3:['Hazard','#c2800b'], 4:['Rain','#3d8fe8'], 5:['Ice','#3dd6e8'], 6:['Traffic jam','#c2800b'],
  7:['Lane closed','#e8743d'], 8:['Road closed','#dc3545'], 9:['Road works','#c2800b'],
  10:['Wind','#8b949f'], 11:['Flooding','#3d8fe8'], 14:['Broken down vehicle','#e8743d'] };
const INC_MAG = { 0:'Unknown', 1:'Minor', 2:'Moderate', 3:'Major', 4:'Closure' };
let incData = null, incBusy = false, incTimer = null, lastInc = 0;

function bboxKm2(b){
  const dLat = (b.getNorth() - b.getSouth()) * 111.32;
  const dLon = (b.getEast() - b.getWest()) * 111.32 *
    Math.cos((b.getNorth() + b.getSouth()) / 2 * Math.PI / 180);
  return Math.abs(dLat * dLon);
}
async function loadIncidents(quiet){
  if(!ttKey || !trafficOn || incBusy) return;
  if(document.hidden) return;
  if(!navigator.onLine) return;
  if(quotaUsed() >= QUOTA){ if(!quiet) toast('TomTom free tier used up for today'); return; }
  if(!map.getZoom || map.getZoom() < 9){ if(!quiet) toast('Zoom in to load live incidents'); return; }
  const b = map.getBounds();
  if(bboxKm2(b) > 9000){ if(!quiet) toast('Zoom in a little, that area is too large for the feed'); return; }
  incBusy = true;
  const fields = '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,' +
    'events{description,code},startTime,endTime,from,to,length,delay,roadNumbers}}}';
  const url = 'https://api.tomtom.com/traffic/services/5/incidentDetails?key=' + encodeURIComponent(ttKey) +
    '&bbox=' + [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(v => v.toFixed(6)).join(',') +
    '&fields=' + fields + '&language=en-GB&timeValidityFilter=present';
  try{
    qBump();
    const j = await NET.json(url, null, { tries:0, ms:12000, label:'Traffic' });
    const feats = (j.incidents || []).filter(Boolean).map(f => {
      const p = f.properties || {}, cat = INC_CAT[p.iconCategory] || INC_CAT[0];
      return { type:'Feature', geometry:f.geometry, properties:{
        col:cat[1], cat:cat[0], mag: INC_MAG[p.magnitudeOfDelay] || 'Unknown',
        desc:(p.events && p.events[0] && p.events[0].description) || cat[0],
        from:p.from || '', to:p.to || '', delay:p.delay || 0, len:p.length || 0,
        road:(p.roadNumbers || []).join(', '), end:p.endTime || '' } };
    });
    incData = { type:'FeatureCollection', features: feats };
    if(map.getSource('inc')) map.getSource('inc').setData(incData);
    lastInc = Date.now(); stamp();
    if(!quiet) toast(feats.length ? feats.length + ' live incidents in view' : 'No incidents reported in view');
  }catch(e){ if(!quiet) toast(e.message, 5000); }
  finally{ incBusy = false; }
}
function clearIncidents(){
  incData = null; lastInc = 0;
  if(map.getSource('inc')) map.getSource('inc').setData(EMPTY);
  stamp();
}
function showIncident(f){
  if(!f) return;
  const p = f.properties || {};
  $('live').hidden = false;
  $('live').innerHTML = '<div class="livehead"><span class="dotlive"></span>' +
    esc(p.cat) + ' · ' + esc(p.mag) + '</div>' +
    '<div style="font-size:14px;font-weight:600;margin-bottom:4px">' + esc(p.desc) + '</div>' +
    (p.from || p.to ? '<div class="dep"><span class="to">' + esc(p.from) +
      (p.to ? ' → ' + esc(p.to) : '') + '</span></div>' : '') +
    (p.road ? '<div class="dep"><b>Road</b><span class="to">' + esc(p.road) + '</span></div>' : '') +
    (p.delay ? '<div class="dep"><b>Delay</b><span class="to">' + fmtDur(p.delay) + '</span></div>' : '') +
    (p.len ? '<div class="dep"><b>Length</b><span class="to">' + fmtDist(p.len) + '</span></div>' : '') +
    (p.end ? '<div class="dep"><b>Clears</b><span class="to">' +
      esc(new Date(p.end).toLocaleString()) + '</span></div>' : '');
}
let incDeb;
function watchIncidents(){
  map.on('moveend', () => { clearTimeout(incDeb); incDeb = setTimeout(() => loadIncidents(true), 800); });
  incTimer = setInterval(() => loadIncidents(true), 120000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden && trafficOn) loadIncidents(true); });
}
function stamp(){
  const bits = [];
  if(lastInc) bits.push('traffic ' + clock(lastInc));
  if(trafficOn && ttKey) bits.push(quotaUsed() + '/' + QUOTA + ' today');
  $('trafficStamp').textContent = bits.join('  ·  ');
}

/* ── system check ─────────────────────────────────────────── */
const SERVICES = [
  { id:'tiles', run: async () => {
      const j = await NET.json(OFM + '/planet', null, { tries:0, ms:9000, label:'Tiles' });
      return 'OpenFreeMap vector tiles reachable, zoom ' + (j.minzoom != null ? j.minzoom : 0) +
        ' to ' + (j.maxzoom != null ? j.maxzoom : 14); } },
  { id:'geo', run: async () => { const r = await geocode('charlotte'); return r.length + ' results from Photon'; } },
  { id:'drive', run: async () => {
      const j = await NET.json('https://router.project-osrm.org/route/v1/driving/-80.8431,35.2271;-80.8456,35.1924?overview=false',
        null, { tries:0, ms:12000, label:'OSRM' });
      if(j.code !== 'Ok') throw new Error('OSRM said ' + j.code);
      return 'route in ' + fmtDur(j.routes[0].duration); } },
  { id:'walkbike', run: async () => {
      const j = await NET.json('https://valhalla1.openstreetmap.de/status', null, { tries:0, ms:12000, label:'Valhalla' });
      return 'Valhalla ' + (j.version || 'ok'); } },
  { id:'transit', run: async () => {
      const url = MOTIS + '/api/v5/plan?fromPlace=35.2271,-80.8431&toPlace=35.1924,-80.8456&time=' +
        encodeURIComponent(new Date().toISOString()) + '&numItineraries=1';
      const j = await NET.json(url, null, { tries:0, ms:15000, label:'Transitous' });
      const n = (j.itineraries || []).length;
      return n ? n + ' itinerar' + (n===1?'y':'ies') + ' found, feed covers this area' : 'reachable, but no transit feed covers this area'; } },
  { id:'traffic', run: async () => {
      if(!ttKey) throw new Error('SOFT:paste a key below, it is then remembered for good');
      const u = 'https://api.tomtom.com/traffic/services/5/incidentDetails?key=' + encodeURIComponent(ttKey) +
        '&bbox=-80.90,35.18,-80.78,35.28&fields={incidents{type}}&language=en-GB&timeValidityFilter=present';
      const j = await NET.json(u, null, { tries:0, ms:12000, label:'TomTom' });
      return ((j.incidents || []).length) + ' incidents nearby · key saved in this browser'; } },
  { id:'gps', run: () => new Promise((ok, no) => {
      if(!navigator.geolocation) return no(new Error('not supported here'));
      navigator.geolocation.getCurrentPosition(
        p => ok('fix at ' + p.coords.latitude.toFixed(4) + ', ' + p.coords.longitude.toFixed(4)),
        e => no(new Error(e.code === 1 ? 'SOFT:permission not granted for this site' : e.message)),
        { timeout:9000, maximumAge:30000 });
    }) }
];
async function systemCheck(){
  let bad = 0;
  const row = id => $('svcList').querySelector('[data-svc="' + id + '"]');
  SERVICES.forEach(s => { const r = row(s.id); if(r){ r.querySelector('i').className = 'wait'; r.querySelector('span').textContent = 'testing'; } });
  await Promise.all(SERVICES.map(async s => {
    const r = row(s.id); if(!r) return;
    try{
      const msg = await s.run();
      r.querySelector('i').className = 'ok';
      r.querySelector('span').textContent = msg;
    }catch(e){
      const soft = /^SOFT:/.test(e.message);
      r.querySelector('i').className = soft ? '' : 'no';
      r.querySelector('span').textContent = e.message.replace(/^SOFT:/, '');
      if(!soft) bad++;
    }
  }));
  $('diagPip').hidden = bad === 0;
  return bad;
}

/* ── wiring ───────────────────────────────────────────────── */
bindField('from'); bindField('to');
$('clearTo').onclick = () => { $('toInput').value=''; $('clearTo').hidden = true; trip.to = null;
  if(markTo){ markTo.remove(); markTo = null; } paintRoute(null); emptyState(); hideSug(); };
$('useGps').onclick = useGps;
$('swapBtn').onclick = () => {
  const a = trip.from, b = trip.to;
  if(!a && !b) return;
  trip.from = null; trip.to = null;
  if(markFrom){ markFrom.remove(); markFrom = null; }
  if(markTo){ markTo.remove(); markTo = null; }
  $('fromInput').value = ''; $('toInput').value = '';
  if(b) setPlace('from', b);
  if(a) setPlace('to', a);
};
document.querySelectorAll('.mode').forEach(el => el.addEventListener('click', async () => {
  mode = el.dataset.mode; store.set('tern.mode', mode);
  document.querySelectorAll('.mode').forEach(x => x.classList.toggle('on', x === el));
  if(!trip.from || !trip.to){ emptyState(); return; }
  $('results').innerHTML = '<div class="note">Finding routes…</div>';
  try{
    options = await planMode(mode);
    current = options[0];
    renderOptions(); paintRoute(current); fitRoute(current); refreshDepartures(current); loadSignals(current);
  }catch(e){ options = []; current = null; paintRoute(null); renderError(mode, e); }
}));
document.querySelector('.mode[data-mode="' + mode + '"]').classList.add('on');

$('panelToggle').onclick = () => $('panel').classList.toggle('hid');

/* ── the mobile sheet ─────────────────────────────────────────
   A panel you cannot move is a panel that has taken your screen.
   Three resting heights: a peek that leaves the map usable with the
   search still in reach, a middle for reading routes, and full. */
const SHEET_PEEK = 176;
let sheetIdx = 1, sheetPx = 0, sheetDrag = null;
const isPhone = () => window.matchMedia('(max-width:760px)').matches;
function sheetStops(){
  const h = window.innerHeight;
  const full = Math.round(h * 0.88);
  return [Math.min(SHEET_PEEK, full), Math.round(h * 0.55), full];
}
function applySheet(px){
  sheetPx = px;
  const p = $('panel');
  p.style.setProperty('--sheet', px + 'px');
  /* Drive the transform straight from JS. A custom property inside a
     calc() in a transform is one indirection too many for some engines
     to re-evaluate reliably, and a sheet that ignores you is the bug
     this whole thing is fixing. */
  const full = sheetStops()[2];
  p.style.transform = 'translateY(' + Math.round(full - px) + 'px)';
}
function snapSheet(i, quiet){
  const stops = sheetStops();
  sheetIdx = Math.max(0, Math.min(stops.length - 1, i));
  applySheet(stops[sheetIdx]);
  if(!quiet && map) setTimeout(() => { try{ map.resize(); }catch(e){} }, 380);
}
function nearestStop(px){
  const stops = sheetStops();
  let best = 0, bd = Infinity;
  stops.forEach((v, i) => { const d = Math.abs(v - px); if(d < bd){ bd = d; best = i; } });
  return best;
}
function layoutSheet(){
  const p = $('panel'), stops = sheetStops();
  if(!isPhone()){                       // desktop drives the panel from CSS alone
    p.style.transform = '';
    p.style.removeProperty('--sheet');
    p.style.removeProperty('--sheet-full');
    return;
  }
  p.style.setProperty('--sheet-full', stops[2] + 'px');
  applySheet(stops[Math.max(0, Math.min(2, sheetIdx))]);
}
function sheetDown(e){
  if(!isPhone() || e.button) return;
  sheetDrag = { y:e.clientY, from:sheetPx || sheetStops()[sheetIdx], t:Date.now(), moved:false };
  $('panel').classList.add('dragging');
  try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(err){}
}
function sheetMove(e){
  if(!sheetDrag) return;
  const dy = sheetDrag.y - e.clientY;            // dragging up grows the sheet
  if(Math.abs(dy) > 3) sheetDrag.moved = true;
  const stops = sheetStops();
  let v = sheetDrag.from + dy;
  if(v > stops[2]) v = stops[2] + (v - stops[2]) * 0.22;   // resist past the top
  if(v < 56) v = 56 + (v - 56) * 0.4;
  applySheet(v);
  e.preventDefault();
}
function sheetUp(e){
  if(!sheetDrag) return;
  const dy = sheetDrag.y - e.clientY;
  const dt = Math.max(1, Date.now() - sheetDrag.t);
  const vel = dy / dt;                            // px per ms, up positive
  const landed = sheetDrag.from + dy;
  sheetDrag = null;
  $('panel').classList.remove('dragging');
  if(Math.abs(vel) > 0.45){                       // a flick carries to the next stop
    snapSheet(nearestStop(landed) + (vel > 0 ? 1 : -1));
  } else {
    snapSheet(nearestStop(landed));
  }
}
['grab','brand'].forEach(id => {
  const el = $(id);
  if(!el) return;
  el.addEventListener('pointerdown', sheetDown);
  el.addEventListener('pointermove', sheetMove);
  el.addEventListener('pointerup', sheetUp);
  el.addEventListener('pointercancel', sheetUp);
});
$('grab').addEventListener('click', () => { if(isPhone()) snapSheet(sheetIdx >= 2 ? 0 : sheetIdx + 1); });
window.addEventListener('resize', layoutSheet);
layoutSheet();

$('themeBtn').onclick = () => {
  theme = theme === 'light' ? 'dark' : 'light';
  store.set('tern.theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  const had = !!map.getSource('flow');
  map.setStyle(STYLE[theme]);
  map.once('styledata', () => { if(!had) removeTraffic(); addLayers(); });
};
$('locBtn').onclick = () => { if(!me) useGps(); else toggleFollow(); };
$('tiltBtn').onclick = () => {
  const on = map.getPitch() < 20;
  $('tiltBtn').classList.toggle('on', on);
  map.easeTo({ pitch: on ? 58 : 0, duration:650 });
};
$('trafficBtn').onclick = () => {
  if(!ttKey){ openDiag(); toast('Add a free TomTom key to switch traffic on', 4500); return; }
  trafficOn = !trafficOn; store.set('tern.traffic', trafficOn ? '1' : '0');
  $('trafficBtn').classList.toggle('on', trafficOn);
  if(trafficOn){ addTraffic(); loadIncidents(false); } else { removeTraffic(); clearIncidents(); }
  stamp();
};
function openDiag(){ $('diag').hidden = false; systemCheck(); }
$('diagBtn').onclick = openDiag;
$('diagClose').onclick = () => $('diag').hidden = true;
$('diag').addEventListener('click', e => { if(e.target === $('diag')) $('diag').hidden = true; });
$('retest').onclick = systemCheck;
$('saveKey').onclick = () => {
  ttKey = $('ttKey').value.trim(); store.set('tern.ttkey', ttKey);
  keyHint();
  if(ttKey){ trafficOn = true; store.set('tern.traffic','1'); $('trafficBtn').classList.add('on');
    removeTraffic(); addTraffic(); }
  stamp(); systemCheck();
};
function keyHint(){
  $('keyHint').textContent = ttKey
    ? 'Saved in this browser. It stays until you clear site data, you will not be asked again.'
    : 'Paste it once and it is remembered. Without one, everything except live traffic still works.';
  $('keyHint').className = 'hint' + (ttKey ? ' ok' : '');
}
$('navStop').onclick = endNav;
$('recentre').onclick = recentreNav;
$('voiceBtn').onclick = () => {
  voiceOn = !voiceOn; store.set('tern.voice', voiceOn ? '1' : '0');
  $('voiceBtn').classList.toggle('on', voiceOn);
  if(voiceOn) speak('Voice guidance on', true);
  else if(canSpeak()){ try{ speechSynthesis.cancel(); }catch(e){} }
};
$('simBtn').onclick = () => { if(sim) stopSim(); else startSim(); };
$('arrivedDone').onclick = endNav;
map.on('dragstart', () => { if(nav && !nav.done) $('recentre').hidden = false; });
$('navPrev').onclick = () => navStep(-1);
$('navNext').onclick = () => navStep(1);
addEventListener('keydown', e => {
  if(e.target.tagName === 'INPUT') return;
  if(e.key === 'g') $('locBtn').click();
  else if(e.key === 'Escape'){ hideSug(); $('diag').hidden = true; if(nav) endNav(); }
  else if(nav && (e.key === 'ArrowRight' || e.key === ' ')){ e.preventDefault(); navStep(1); }
  else if(nav && e.key === 'ArrowLeft'){ e.preventDefault(); navStep(-1); }
});
addEventListener('offline', () => toast('You are offline. Tiles, search and routing will fail until you reconnect.', 6000));
addEventListener('online', () => toast('Back online', 2200));
addEventListener('beforeunload', () => { if(watch != null && navigator.geolocation) navigator.geolocation.clearWatch(watch); });

function adoptKey(raw){
  const v = String(raw || '').trim();
  if(!v || v === ttKey) return;
  ttKey = v; store.set('tern.ttkey', ttKey);
  keyHint(); stamp();
  trafficOn = true; store.set('tern.traffic', '1');
  $('trafficBtn').classList.add('on');
  removeTraffic(); addTraffic(); loadIncidents(true);
}

/* ── when to leave ────────────────────────────────────────── */
function whenLabel(){
  if(!departAt) return 'Leave now';
  const d = new Date(departAt), n = new Date();
  const sameDay = d.toDateString() === n.toDateString();
  const tomorrow = new Date(n.getTime() + 864e5).toDateString() === d.toDateString();
  const day = sameDay ? '' : (tomorrow ? 'tomorrow ' : d.toLocaleDateString(undefined, { weekday:'short' }) + ' ');
  return 'Leave ' + day + clock(departAt);
}
function paintWhen(){
  $('whenLabel').textContent = whenLabel();
  $('whenBtn').classList.toggle('set', !!departAt);
  $('whenNow').hidden = !departAt;
}
function localValue(ms){
  const d = new Date(ms), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) +
    'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function setDepart(ms){
  departAt = ms;
  paintWhen();
  if(trip.from && trip.to) planAll();
}
$('whenBtn').addEventListener('click', () => {
  const inp = $('whenInput');
  if(inp.hidden){
    // round up to the next five minutes so the default is a sane one
    const base = departAt || (Math.ceil((Date.now() + 6e5) / 3e5) * 3e5);
    inp.value = localValue(base);
    inp.hidden = false; $('whenBtn').hidden = true; $('whenNow').hidden = false;
    inp.focus();
    if(inp.showPicker) try{ inp.showPicker(); }catch(e){}
  }
});
$('whenInput').addEventListener('change', () => {
  const v = $('whenInput').value;
  const ms = v ? new Date(v).getTime() : NaN;
  $('whenInput').hidden = true; $('whenBtn').hidden = false;
  if(isFinite(ms)) setDepart(ms); else paintWhen();
});
$('whenInput').addEventListener('blur', () => {
  setTimeout(() => { if(!$('whenInput').hidden){ $('whenInput').hidden = true; $('whenBtn').hidden = false; paintWhen(); } }, 120);
});
$('whenNow').addEventListener('click', () => {
  $('whenInput').hidden = true; $('whenBtn').hidden = false;
  setDepart(null);
});
paintWhen();

$('ttKey').addEventListener('input', () => adoptKey($('ttKey').value));
$('ttKey').addEventListener('blur',  () => adoptKey($('ttKey').value));
$('ttKey').addEventListener('paste', () => setTimeout(() => adoptKey($('ttKey').value), 0));
$('ttKey').value = ttKey; keyHint(); stamp();
emptyState();
$('trafficBtn').classList.toggle('on', trafficOn && !!ttKey);
try{
  const t = JSON.parse(store.get('tern.to', 'null'));
  if(t && isFinite(t.lat)) { trip.to = t; $('toInput').value = t.name; $('clearTo').hidden = false; }
}catch(e){}
