"use strict";
/* ═══════════════════════════════════════════════════════════
   Tern — open trip planner
   tiles OpenFreeMap · search Photon · drive OSRM
   walk/bike Valhalla · transit Transitous (MOTIS) · traffic TomTom
   ═══════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const OFM = 'https://tiles.openfreemap.org';
const SKINS = {
  apple:  { map: OFM + '/styles/positron', dark:false },
  google: { map: OFM + '/styles/liberty',  dark:false },
  uber:   { map: OFM + '/styles/dark',     dark:true  }
};
const MOTIS = 'https://api.transitous.org';

const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
};

let skin     = store.get('tern.skin', 'apple');
if(!SKINS[skin]) skin = 'apple';
let units    = store.get('tern.units', 'imperial');
let ttKey    = store.get('tern.ttkey', '');
let mode     = store.get('tern.mode', 'drive');
let trafficOn= store.get('tern.traffic', '0') === '1';
document.documentElement.setAttribute('data-skin', skin);

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
  $('fatalPre').textContent = bootErrs.slice(0,6).join('\n');
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
    container:'map', style: SKINS[skin].map,
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
setTimeout(() => {
  if(!gotTile) fatal('No map tiles loaded',
    'The page is running but could not reach the tile server. Check your connection, then use System check for detail.');
}, 14000);

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
      paint:{ 'line-color': SKINS[skin].dark ? '#0b0d10' : '#ffffff',
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
  if(!map.getSource('alts')){
    map.addSource('alts', { type:'geojson', data: EMPTY });
    map.addLayer({ id:'alts', type:'line', source:'alts',
      layout:{ 'line-cap':'round','line-join':'round' },
      paint:{ 'line-color': SKINS[skin].dark ? '#5b6675' : '#9aa4b2', 'line-width':5, 'line-opacity':.65 } },
      map.getLayer('route-case') ? 'route-case' : firstSymbol());
  }
  if(!map.getSource('stops')){
    map.addSource('stops', { type:'geojson', data: EMPTY });
    map.addLayer({ id:'stops', type:'circle', source:'stops',
      paint:{ 'circle-radius':4.5, 'circle-color':'#ffffff',
        'circle-stroke-color':['get','color'], 'circle-stroke-width':2.5 } });
  }
  if(trafficOn && ttKey) addTraffic();
  if(current) paintRoute(current);
}
map.on('load', () => { addLayers(); wireMap(); initialLocate(); });

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
function setPlace(slot, place){
  if(!place || !isFinite(place.lat) || !isFinite(place.lon)) return;
  trip[slot] = place;
  $(slot + 'Input').value = place.name;
  if(slot === 'to') $('clearTo').hidden = false;
  const mk = slot === 'from' ? markFrom : markTo;
  if(mk) mk.remove();
  const m = new maplibregl.Marker({ element: pin(slot === 'from' ? '#6b7684' : '#1f6feb'), anchor:'bottom' })
    .setLngLat([place.lon, place.lat]).addTo(map);
  if(slot === 'from') markFrom = m; else markTo = m;
  store.set('tern.' + slot, JSON.stringify(place));
  if(trip.from && trip.to) planAll();
  else map.flyTo({ center:[place.lon, place.lat], zoom: Math.max(map.getZoom(), 14.5), speed:1.3 });
}

/* ── routers, all returning one shape ─────────────────────── */
const COLOR = { WALK:'#6b7684', BIKE:'#0f9d58', CAR:'#1f6feb', TRANSIT:'#8b5cf6' };

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
async function routeDrive(a, b){
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
      via: viaLabel(steps),
      legs:[{ kind:'CAR', color:COLOR.CAR, coords:r.geometry.coordinates, steps }] };
  }).sort((x,y) => x.duration - y.duration);
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
    '&time=' + encodeURIComponent(new Date().toISOString()) +
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
      if(m === mode){ options = res; current = res[0]; renderOptions(); paintRoute(current); fitRoute(current); }
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
function renderError(m, e){
  const why = e.message === 'NO_TRANSIT'
    ? 'No public transport connection was found for this trip. Transitous only has data where a transit agency publishes an open GTFS feed, and coverage is thin in much of the United States.'
    : esc(e.message);
  $('results').innerHTML = '<div class="note"><b>No ' + m + ' route.</b><br>' + why + '</div>';
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
function paintRoute(it){
  const src = map.getSource('route'), ssrc = map.getSource('stops');
  if(!src) return;
  paintAlts();
  if(!it){ src.setData(EMPTY); if(ssrc) ssrc.setData(EMPTY); return; }
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
  map.fitBounds([[mnx,mny],[mxx,mxy]], { duration:800, pitch:0,
    padding:{ top:70, right:60, bottom: wide ? 60 : Math.round(innerHeight*0.5), left: wide ? 432 : 40 } });
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
    const when = it.depart ? clock(it.depart) + ' → ' + clock(it.arrive) : '';
    const sum = it.mode === 'transit'
      ? (it.transfers === 0 ? 'Direct' : it.transfers + ' transfer' + (it.transfers > 1 ? 's' : ''))
      : (it.via || '') + (i === 0 && options.length > 1 ? ' · fastest' : '');
    return '<div class="opt' + sel + '" data-i="' + i + '">' +
      '<div class="top"><span class="dur">' + fmtDur(it.duration) + '</span>' +
      '<span class="dist">' + (it.mode === 'transit'
        ? fmtDist(it.walkDistance || 0) + ' walking'
        : fmtDist(it.distance)) + '</span>' +
      (when ? '<span class="when">' + when + '</span>' : '') + '</div>' +
      chain + (sum ? '<div class="sum">' + sum + '</div>' : '') +
      (it === current ? detailHtml(it) : '') + '</div>';
  }).join('');
  $('results').innerHTML = html;
  $('results').querySelectorAll('.opt').forEach(el => {
    el.addEventListener('click', ev => {
      if(ev.target.closest('.step') || ev.target.closest('.btn')) return;
      current = options[+el.dataset.i];
      renderOptions(); paintRoute(current); fitRoute(current);
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
      const sub = l.kind === 'WALK'
        ? fmtDist(l.distance || 0)
        : clock(l.startTime) + ' ' + esc(l.fromName) + ' → ' + clock(l.endTime) + ' ' + esc(l.toName);
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
function wireMap(){
  map.on('click', async e => {
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
function initialLocate(){
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(p => {
    showMe(p.coords.latitude, p.coords.longitude);
    $('locBtn').classList.add('live');
    if(!trip.from){
      trip.from = { name:'Your location', detail:'', lat:me.lat, lon:me.lon };
      $('fromInput').value = 'Your location';
      if(trip.to) planAll();
    }
    if(!trip.to) map.flyTo({ center:[me.lon, me.lat], zoom:14, speed:1.2 });
  }, () => {}, { enableHighAccuracy:true, timeout:9000, maximumAge:30000 });
}
function useGps(){
  if(!navigator.geolocation){ toast('This browser will not share a location'); return; }
  navigator.geolocation.getCurrentPosition(p => {
    showMe(p.coords.latitude, p.coords.longitude);
    $('locBtn').classList.add('live');
    setPlace('from', { name:'Your location', detail:'', lat:me.lat, lon:me.lon });
  }, err => {
    toast(err.code === 1
      ? 'Location is blocked for this site. Allow it in the padlock menu, or click the map to set a start point.'
      : 'Could not get a GPS fix. Click the map to set a start point instead.', 6000);
  }, { enableHighAccuracy:true, timeout:9000, maximumAge:20000 });
}
function toggleFollow(){
  following = !following;
  $('locBtn').classList.toggle('on', following);
  if(following){
    if(!navigator.geolocation){ following = false; return; }
    watch = navigator.geolocation.watchPosition(p => {
      showMe(p.coords.latitude, p.coords.longitude);
      $('locBtn').classList.add('live');
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

/* ── turn by turn ─────────────────────────────────────────── */
let nav = null;
function startNav(it){
  if(!it || !it.legs[0] || !it.legs[0].steps.length) return;
  nav = { steps: it.legs[0].steps, i:0, total: it.duration, dist: it.distance, via: it.via || '' };
  $('nav').hidden = false;
  $('panel').classList.add('hid');
  map.easeTo({ pitch:60, zoom:17, duration:900 });
  if(!following) toggleFollow();
  paintNav();
}
function endNav(){
  nav = null; $('nav').hidden = true; $('panel').classList.remove('hid');
  map.easeTo({ pitch:0, duration:700 });
}
function paintNav(){
  if(!nav) return;
  const s = nav.steps[nav.i];
  $('navIcon').innerHTML = turnIcon(s.text);
  $('navInstr').textContent = s.text;
  $('navMeta').textContent = 'Step ' + (nav.i+1) + ' of ' + nav.steps.length + (s.road ? ' · ' + s.road : '');
  let d = (me && s.lat != null) ? hav(me, { lat:s.lat, lon:s.lon }) : s.dist;
  $('navDist').textContent = d != null ? fmtDist(d) : '—';
  let left = 0;
  for(let k = nav.i; k < nav.steps.length; k++) left += nav.steps[k].dist || 0;
  $('navLeft').textContent = fmtDist(left);
  const secs = nav.dist ? nav.total * (left / nav.dist) : 0;
  $('navEta').textContent = clock(Date.now() + secs * 1000);
  $('navTimeLeft').textContent = fmtShort(secs);
  $('navTrip').textContent = fmtDur(nav.total) + ' · ' + fmtDist(nav.dist) + (nav.via ? ' · ' + nav.via : '');
  $('navSpeed').textContent = (speed != null && following) ? Math.round(speed) + (IMP() ? ' mph' : ' kph') : '—';
  $('navPrev').disabled = nav.i === 0;
  $('navNext').disabled = nav.i >= nav.steps.length - 1;
}
function navStep(d){
  if(!nav) return;
  nav.i = Math.max(0, Math.min(nav.steps.length - 1, nav.i + d));
  const s = nav.steps[nav.i];
  if(s.lon != null) map.easeTo({ center:[s.lon, s.lat], zoom:17, pitch:60, duration:650 });
  paintNav();
}
function advance(){
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

/* ── traffic ──────────────────────────────────────────────── */
const QUOTA = 2500;
const qKey = () => 'tern.tt.' + new Date().toISOString().slice(0,10);
const qUsed = () => +(store.get(qKey(), '0')) || 0;
function qBump(){ const n = qUsed() + 1; store.set(qKey(), String(n)); stamp(); return n; }
function addTraffic(){
  if(!ttKey || map.getSource('flow')) return;
  const st = SKINS[skin].dark ? 'relative0-dark' : 'relative0';
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
function stamp(){
  $('trafficStamp').textContent = (trafficOn && ttKey) ? qUsed() + '/' + QUOTA + ' traffic calls today' : '';
}

/* ── system check ─────────────────────────────────────────── */
const SERVICES = [
  { id:'tiles', run: async () => { const j = await NET.json(OFM + '/styles/liberty', null, { tries:0, ms:9000, label:'Tiles' });
      return 'OpenFreeMap reachable, ' + ((j.layers||[]).length) + ' style layers'; } },
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
      if(!ttKey) throw new Error('SOFT:no TomTom key saved yet');
      const u = 'https://api.tomtom.com/traffic/services/5/incidentDetails?key=' + encodeURIComponent(ttKey) +
        '&bbox=-80.90,35.18,-80.78,35.28&fields={incidents{type}}&language=en-GB&timeValidityFilter=present';
      const j = await NET.json(u, null, { tries:0, ms:12000, label:'TomTom' });
      return ((j.incidents || []).length) + ' incidents near Charlotte'; } },
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
  if(markTo){ markTo.remove(); markTo = null; } paintRoute(null); $('results').innerHTML=''; hideSug(); };
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
  if(!trip.from || !trip.to){ $('results').innerHTML = ''; return; }
  $('results').innerHTML = '<div class="note">Finding routes…</div>';
  try{
    options = await planMode(mode);
    current = options[0];
    renderOptions(); paintRoute(current); fitRoute(current);
  }catch(e){ options = []; current = null; paintRoute(null); renderError(mode, e); }
}));
document.querySelector('.mode[data-mode="' + mode + '"]').classList.add('on');

$('panelToggle').onclick = () => $('panel').classList.toggle('hid');
function setSkin(next){
  if(!SKINS[next] || next === skin) return;
  skin = next; store.set('tern.skin', skin);
  document.documentElement.setAttribute('data-skin', skin);
  document.querySelectorAll('#skinbar button').forEach(b => b.classList.toggle('on', b.dataset.skin === skin));
  const had = !!map.getSource('flow');
  map.setStyle(SKINS[skin].map);
  map.once('styledata', () => { if(!had) removeTraffic(); addLayers(); });
}
document.querySelectorAll('#skinbar button').forEach(b =>
  b.addEventListener('click', () => setSkin(b.dataset.skin)));
document.querySelectorAll('#skinbar button').forEach(b =>
  b.classList.toggle('on', b.dataset.skin === skin));
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
  if(trafficOn) addTraffic(); else removeTraffic();
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
    ? 'Saved in this browser only. Restrict the key to this domain in your TomTom settings.'
    : 'Without a key the map, search, routing and GPS all still work. Only live traffic is off.';
}
$('navStop').onclick = endNav;
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

$('ttKey').value = ttKey; keyHint(); stamp();
$('trafficBtn').classList.toggle('on', trafficOn && !!ttKey);
try{
  const t = JSON.parse(store.get('tern.to', 'null'));
  if(t && isFinite(t.lat)) { trip.to = t; $('toInput').value = t.name; $('clearTo').hidden = false; }
}catch(e){}
