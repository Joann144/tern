"use strict";
const $=id=>document.getElementById(id);
const OFM='https://tiles.openfreemap.org';
const STYLES={dark:OFM+'/styles/dark', light:OFM+'/styles/bright'};
const ls={
  get(k,d){ try{ const v=localStorage.getItem(k); return v===null?d:v; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};
let theme=ls.get('tern.theme','dark');
let TTKEY=ls.get('tern.ttkey','');
let IMP=ls.get('tern.units','mi')==='mi';
let mode=ls.get('tern.mode','drive');
let trafficOn=ls.get('tern.traffic','0')==='1';

document.documentElement.setAttribute('data-t',theme);

/* ---------------- network: every call times out and retries ---------------- */
const NET={
  async json(url,opt,cfg){
    cfg=cfg||{};
    const tries=cfg.tries==null?2:cfg.tries, ms=cfg.ms||12000, label=cfg.label||'Request';
    let last;
    for(let a=0;a<=tries;a++){
      const ac=new AbortController();
      const timer=setTimeout(()=>ac.abort(),ms);
      let sig=ac.signal;
      if(opt&&opt.signal&&typeof AbortSignal!=='undefined'&&AbortSignal.any){
        try{ sig=AbortSignal.any([opt.signal,ac.signal]); }catch(e){}
      }
      try{
        const r=await fetch(url,Object.assign({},opt,{signal:sig}));
        clearTimeout(timer);
        if(r.status===429) throw new Error(label+' is rate limited right now (429)');
        if(r.status===403) throw new Error(label+' rejected the key (403)');
        if(!r.ok) throw new Error(label+' returned HTTP '+r.status);
        return await r.json();
      }catch(e){
        clearTimeout(timer);
        if(opt&&opt.signal&&opt.signal.aborted) throw e;          // caller cancelled, do not retry
        last = (e.name==='AbortError') ? new Error(label+' timed out after '+(ms>=1000?Math.round(ms/1000)+'s':ms+'ms')) : e;
        if(!navigator.onLine) { last=new Error('You are offline'); break; }
        if(a<tries) await new Promise(f=>setTimeout(f,400*Math.pow(2,a)));
      }
    }
    throw last;
  }
};

/* ---------------- formatting ---------------- */
const fmtD=m=>IMP
  ? (m<160?Math.round(m*3.28084)+' ft':(m/1609.34).toFixed(m<16093?1:0)+' mi')
  : (m<1000?Math.round(m)+' m':(m/1000).toFixed(m<10000?1:0)+' km');
const fmtT=s=>{ s=Math.round(s); const h=Math.floor(s/3600), m=Math.round((s%3600)/60);
  return h ? (m? h+' hr '+m+' min' : h+' hr') : Math.max(1,m)+' min'; };
const hav=(a,b)=>{ const R=6371008.8,t=x=>x*Math.PI/180;
  const dLa=t(b.lat-a.lat), dLo=t(b.lon-a.lon);
  const h=Math.sin(dLa/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(h)); };
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------------- failure surfaces ---------------- */
const errs=[];
function fail(msg){
  if(!errs.includes(msg)) errs.push(msg);
  $('failb').innerHTML='<h3>Something broke on startup</h3><p>'+esc(msg)+
    '</p><pre>'+esc(errs.join('\n'))+'</pre>';
  $('fail').classList.add('on');
}
let tt;
function toast(m,ms){ const t=$('toast'); t.className='p on'; t.innerHTML=m;
  clearTimeout(tt); tt=setTimeout(()=>t.classList.remove('on'),ms||3000); }
window.addEventListener('error',e=>{ errs.push(e.message); console.error(e.message); });

/* ---------------- map ---------------- */
let map;
try{
  const probe=document.createElement('canvas');
  if(!(probe.getContext('webgl2')||probe.getContext('webgl')))
    throw new Error('WebGL is not available in this browser. Enable hardware acceleration, or try Chrome or Edge.');
  map=new maplibregl.Map({
    container:'map', style:STYLES[theme],
    center:[-80.8431,35.2271], zoom:12.4, pitch:52, bearing:-14,
    antialias:true, fadeDuration:110, maxTileCacheSize:500, hash:false,
    attributionControl:{compact:true, customAttribution:'OpenFreeMap &middot; OpenStreetMap'}
  });
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'bottom-right');
  map.addControl(new maplibregl.ScaleControl({unit:IMP?'imperial':'metric'}),'bottom-right');
}catch(e){ fail(e.message); throw e; }

map.on('error',e=>{
  const m=(e&&e.error&&(e.error.message||String(e.error)))||'map error';
  errs.push(m); console.warn('[tern]',m);
  if(/style|tilejson|planet|glyph/i.test(m)) fail('Could not load the map style from OpenFreeMap. '+
    'If you are offline, or this file is open inside an app that blocks network requests, tiles cannot load. '+
    'Open the file directly in Chrome or Edge.');
});
let firstTile=false;
map.on('data',e=>{ if(e.tile&&!firstTile){ firstTile=true;
  const b=$('boot'); if(b){ b.classList.add('gone'); setTimeout(()=>b.remove(),400); } } });
setTimeout(()=>{ if(!firstTile) fail('No map tiles arrived within 12 seconds. '+
  'Check the internet connection, and make sure this file is open in a browser rather than inside another app.'); },12000);

const firstSymbol=()=>{ const ly=map.getStyle().layers||[];
  for(const l of ly) if(l.type==='symbol') return l.id; return undefined; };

/* ---------------- overlays, rebuilt on every style load ---------------- */
function addOverlays(){
  if(!map.getSource('route')){
    map.addSource('route',{type:'geojson',data:fc()});
    map.addLayer({id:'route-glow',type:'line',source:'route',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#00e8ff','line-blur':12,'line-opacity':.5,
        'line-width':['interpolate',['linear'],['zoom'],8,14,16,30]}},firstSymbol());
    map.addLayer({id:'route-case',type:'line',source:'route',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':theme==='dark'?'#00323c':'#005566',
        'line-width':['interpolate',['linear'],['zoom'],8,8,16,17],'line-opacity':.95}},firstSymbol());
    map.addLayer({id:'route-line',type:'line',source:'route',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#00e8ff','line-width':['interpolate',['linear'],['zoom'],8,3.5,16,8]}},firstSymbol());
  }
  if(!map.getSource('inc')){
    map.addSource('inc',{type:'geojson',data:fc()});
    map.addLayer({id:'inc-line',type:'line',source:'inc',
      filter:['==',['geometry-type'],'LineString'],
      layout:{'line-cap':'round'},
      paint:{'line-color':['get','col'],'line-width':['interpolate',['linear'],['zoom'],9,3,16,7],'line-opacity':.95}});
    map.addLayer({id:'inc-pt',type:'circle',source:'inc',
      filter:['==',['geometry-type'],'Point'],
      paint:{'circle-radius':['interpolate',['linear'],['zoom'],9,4,16,8],
        'circle-color':['get','col'],'circle-stroke-color':'#fff','circle-stroke-width':1.6}});
    map.on('click','inc-line',e=>showIncident(e.features[0]));
    map.on('click','inc-pt',e=>showIncident(e.features[0]));
    for(const L of ['inc-line','inc-pt']){
      map.on('mouseenter',L,()=>map.getCanvas().style.cursor='pointer');
      map.on('mouseleave',L,()=>map.getCanvas().style.cursor='');
    }
  }
  if(trafficOn) addTraffic();
  if(routeGeo) setRoute(routeGeo);
  if(incData) map.getSource('inc').setData(incData);
}
const fc=()=>({type:'FeatureCollection',features:[]});
map.on('load',()=>{
  addOverlays(); wireMapClicks(); locate(true);
  try{
    const saved=JSON.parse(ls.get('tern.dest','null'));
    if(saved&&isFinite(saved.lat)&&isFinite(saved.lon)){
      dest=saved;
      destMk=new maplibregl.Marker({element:pinEl(),anchor:'bottom'})
        .setLngLat([saved.lon,saved.lat]).addTo(map);
      showPlace();
    }
  }catch(e){}
});

/* ---------------- traffic ---------------- */
function addTraffic(){
  if(!TTKEY || map.getSource('flow')) return;
  const st=theme==='dark'?'relative0-dark':'relative0';
  map.addSource('flow',{type:'raster',tileSize:256,
    tiles:['https://api.tomtom.com/traffic/map/4/tile/flow/'+st+'/{z}/{x}/{y}.png?key='+
      encodeURIComponent(TTKEY)+'&tileSize=256&thickness=4'],
    attribution:'Traffic &copy; TomTom'});
  const before = map.getLayer('route-case') ? 'route-case' : firstSymbol();
  map.addLayer({id:'flow',type:'raster',source:'flow',paint:{'raster-opacity':.85}},before);
}
function removeTraffic(){
  if(map.getLayer('flow')) map.removeLayer('flow');
  if(map.getSource('flow')) map.removeSource('flow');
}
const CAT={0:['Unknown','#8b949f'],1:['Accident','#e8503d'],2:['Fog','#8b949f'],3:['Hazard','#e8a33d'],
  4:['Rain','#3d8fe8'],5:['Ice','#3dd6e8'],6:['Traffic jam','#e8a33d'],7:['Lane closed','#e8743d'],
  8:['Road closed','#e8503d'],9:['Road works','#e8a33d'],10:['Wind','#8b949f'],11:['Flooding','#3d8fe8'],
  14:['Broken down vehicle','#e8743d']};
const MAG={0:'Unknown',1:'Minor',2:'Moderate',3:'Major',4:'Closure'};
let incData=null, incTimer=null, incBusy=false, lastInc=0;
const QUOTA=2500;
function quotaKey(){ return 'tern.tt.'+new Date().toISOString().slice(0,10); }
function quotaUsed(){ return +(ls.get(quotaKey(),'0'))||0; }
function quotaBump(){
  const n=quotaUsed()+1; ls.set(quotaKey(),String(n));
  if(n===Math.floor(QUOTA*0.8)) toast('TomTom free tier: '+n+' of '+QUOTA+' requests used today',6000);
  if(n===QUOTA) toast('TomTom free tier used up for today. Traffic will resume tomorrow.',7000);
  stamp(); return n;
}

function bboxKm2(b){
  const dLat=(b.getNorth()-b.getSouth())*111.32;
  const dLon=(b.getEast()-b.getWest())*111.32*Math.cos((b.getNorth()+b.getSouth())/2*Math.PI/180);
  return Math.abs(dLat*dLon);
}
async function loadIncidents(quiet){
  if(!TTKEY||!trafficOn||incBusy) return;
  if(document.hidden) return;                       // do not burn quota in a background tab
  if(quotaUsed()>=QUOTA){ if(!quiet) toast('TomTom free tier used up for today'); return; }
  if(!navigator.onLine){ if(!quiet) toast('You are offline'); return; }
  if(map.getZoom()<9){ if(!quiet) toast('Zoom in to load live incidents'); return; }
  const b=map.getBounds();
  if(bboxKm2(b)>9000){ if(!quiet) toast('Zoom in a little, the area is too large for the incident feed'); return; }
  incBusy=true;
  const fields='{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,'+
    'events{description,code},startTime,endTime,from,to,length,delay,roadNumbers}}}';
  const url='https://api.tomtom.com/traffic/services/5/incidentDetails?key='+encodeURIComponent(TTKEY)+
    '&bbox='+[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].map(v=>v.toFixed(6)).join(',')+
    '&fields='+fields+'&language=en-GB&timeValidityFilter=present';
  try{
    quotaBump();
    const j=await NET.json(url,null,{tries:1,ms:12000,label:'Traffic'});
    const feats=(j.incidents||[]).filter(Boolean).map(f=>{
      const p=f.properties||{}, cat=CAT[p.iconCategory]||CAT[0];
      return {type:'Feature',geometry:f.geometry,properties:{
        col:cat[1], cat:cat[0], mag:MAG[p.magnitudeOfDelay]||'Unknown',
        desc:(p.events&&p.events[0]&&p.events[0].description)||cat[0],
        from:p.from||'', to:p.to||'', delay:p.delay||0, len:p.length||0,
        road:(p.roadNumbers||[]).join(', '), end:p.endTime||''}};
    });
    incData={type:'FeatureCollection',features:feats};
    if(map.getSource('inc')) map.getSource('inc').setData(incData);
    lastInc=Date.now(); stamp();
    if(!quiet) toast(feats.length? feats.length+' live incidents in view' : 'No incidents reported in view');
  }catch(e){ if(!quiet) toast(esc(e.message),5000); console.warn(e); }
  finally{ incBusy=false; }
}
function stamp(){
  const el=$('upd'); if(!el) return;
  const bits=[];
  if(lastInc) bits.push('traffic '+new Date(lastInc).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  if(TTKEY) bits.push(quotaUsed()+'/'+QUOTA+' today');
  if(!navigator.onLine) bits.push('OFFLINE');
  el.innerHTML=bits.map(b=>b==='OFFLINE'?'<b>OFFLINE</b>':b).join('  \u00b7  ');
}
function showIncident(f){
  const p=f.properties;
  $('card').classList.add('on');
  $('cardb').innerHTML='<div class="kick">'+esc(p.cat)+' &middot; '+esc(p.mag)+'</div>'+
    '<h2>'+esc(p.desc)+'</h2>'+
    (p.from||p.to? '<div class="sub">'+esc(p.from)+(p.to?' to '+esc(p.to):'')+'</div>':'')+
    '<table class="kv">'+
    (p.road?'<tr><td>Road</td><td>'+esc(p.road)+'</td></tr>':'')+
    (p.delay?'<tr><td>Delay</td><td>'+fmtT(p.delay)+'</td></tr>':'')+
    (p.len?'<tr><td>Length affected</td><td>'+fmtD(p.len)+'</td></tr>':'')+
    (p.end?'<tr><td>Expected clear</td><td>'+esc(new Date(p.end).toLocaleString())+'</td></tr>':'')+
    '</table>';
}
let incDeb;
map.on('moveend',()=>{ clearTimeout(incDeb); incDeb=setTimeout(()=>loadIncidents(true),700); });
incTimer=setInterval(()=>loadIncidents(true),60000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&trafficOn) loadIncidents(true); });
addEventListener('offline',()=>{ stamp(); toast('You went offline. Tiles, search and routing will fail until you are back.',6000); });
addEventListener('online',()=>{ stamp(); toast('Back online',2500); if(trafficOn) loadIncidents(true); });
addEventListener('beforeunload',()=>{
  if(watchId!=null&&navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  if(incTimer) clearInterval(incTimer);
});

/* ---------------- search ---------------- */
let hits=[], hsel=-1, sdeb, sabort;
$('q').addEventListener('input',()=>{
  $('qx').hidden=!$('q').value;
  clearTimeout(sdeb);
  const v=$('q').value.trim();
  if(v.length<2){ $('hits').classList.remove('on'); hits=[]; return; }
  sdeb=setTimeout(()=>geocode(v),250);
});
$('qx').onclick=()=>{ $('q').value=''; $('qx').hidden=true; $('hits').classList.remove('on'); $('q').focus(); };
async function geocode(v){
  const c=map.getCenter();
  if(sabort) sabort.abort();
  sabort=new AbortController();
  try{
    const u='https://photon.komoot.io/api?q='+encodeURIComponent(v)+'&limit=7&lang=en&lat='+
      c.lat.toFixed(4)+'&lon='+c.lng.toFixed(4);
    const j=await NET.json(u,{signal:sabort.signal},{tries:1,ms:8000,label:'Search'});
    hits=(j.features||[]).map(f=>{
      const p=f.properties;
      return {name:p.name||p.street||'Unnamed',
        detail:[p.housenumber&&p.street?p.housenumber+' '+p.street:p.street,p.city||p.county,p.state,p.country]
          .filter(Boolean).join(', '),
        lon:f.geometry.coordinates[0], lat:f.geometry.coordinates[1]};
    });
    hsel=-1; paintHits();
  }catch(e){
    if(e.name==='AbortError') return;
    $('hits').innerHTML='<div class="msg">Search is unreachable. Check the connection.</div>';
    $('hits').classList.add('on');
  }
}
function paintHits(){
  const h=$('hits');
  if(!hits.length){ h.innerHTML='<div class="msg">No matches.</div>'; h.classList.add('on'); return; }
  h.innerHTML=hits.map((r,i)=>'<div class="h'+(i===hsel?' sel':'')+'" data-i="'+i+'">'+
    '<div class="d"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 22s7-6.3 7-12a7 7 0 10-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2.4"/></svg></div>'+
    '<div class="tx"><div class="a">'+esc(r.name)+'</div><div class="b">'+esc(r.detail)+'</div></div></div>').join('');
  h.classList.add('on');
  [...h.children].forEach(el=>{ if(el.dataset.i!==undefined) el.onclick=()=>pick(hits[+el.dataset.i]); });
}
$('q').addEventListener('keydown',e=>{
  if(e.key==='Escape'){ $('hits').classList.remove('on'); $('q').blur(); return; }
  if(!hits.length) return;
  if(e.key==='ArrowDown'){ e.preventDefault(); hsel=Math.min(hits.length-1,hsel+1); paintHits(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); hsel=Math.max(0,hsel-1); paintHits(); }
  else if(e.key==='Enter'){ e.preventDefault(); pick(hits[hsel<0?0:hsel]); }
});

/* ---------------- destination ---------------- */
let dest=null, destMk=null;
function pinEl(){ const d=document.createElement('div'); d.className='mk';
  d.innerHTML='<svg viewBox="0 0 26 34"><path d="M13 33S25 21 25 12.5A12 12 0 101 12.5C1 21 13 33 13 33z" fill="#6d5efc"/><circle cx="13" cy="12.5" r="4.4" fill="#fff"/></svg>';
  return d; }
function pick(r){
  if(!r) return;
  $('hits').classList.remove('on'); $('q').value=r.name; $('q').blur();
  setDest({name:r.name,detail:r.detail,lon:r.lon,lat:r.lat});
}
function setDest(p){
  if(!p||!isFinite(p.lat)||!isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180){
    toast('That place has no usable coordinates'); return; }
  dest=p;
  ls.set('tern.dest',JSON.stringify(p));
  if(destMk) destMk.remove();
  destMk=new maplibregl.Marker({element:pinEl(),anchor:'bottom'}).setLngLat([p.lon,p.lat]).addTo(map);
  map.flyTo({center:[p.lon,p.lat],zoom:Math.max(map.getZoom(),15),speed:1.4,essential:true});
  showPlace();
}
function wireMapClicks(){
  map.on('click',e=>{
    const f=map.queryRenderedFeatures(e.point,{layers:['inc-line','inc-pt','route-line','route-case','route-glow']
      .filter(id=>map.getLayer(id))});
    if(f.length) return;
    dropPin(e.lngLat.lng,e.lngLat.lat);
  });
}
async function dropPin(lon,lat){
  setDest({name:'Dropped pin',detail:lat.toFixed(5)+', '+lon.toFixed(5),lon,lat});
  try{
    const j=await NET.json('https://photon.komoot.io/reverse?lat='+lat+'&lon='+lon+'&limit=1&lang=en',
      null,{tries:1,ms:8000,label:'Address lookup'});
    const f=(j.features||[])[0];
    if(f&&dest){
      const p=f.properties;
      dest.name=p.name||[p.housenumber,p.street].filter(Boolean).join(' ')||'Dropped pin';
      dest.detail=[p.street&&p.housenumber?p.housenumber+' '+p.street:p.street,p.city||p.county,p.state,p.postcode]
        .filter(Boolean).join(', ')||(lat.toFixed(5)+', '+lon.toFixed(5));
      if($('card').classList.contains('on')&&!routeGeo) showPlace();
    }
  }catch(e){}
}
function showPlace(){
  if(!dest) return;
  $('card').classList.add('on');
  $('cardb').innerHTML='<div class="kick">Destination</div><h2>'+esc(dest.name)+'</h2>'+
    '<div class="sub">'+esc(dest.detail)+'</div>'+
    '<div class="row"><button class="btn go" id="godir">Directions</button>'+
    '<button class="btn sq" id="gohere" title="Start routes from this point">'+
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg></button>'+
    '<button class="btn sq" id="gocopy" title="Copy coordinates">'+
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a2 2 0 00-2 2v9"/></svg></button></div>';
  $('godir').onclick=()=>route();
  $('gohere').onclick=()=>{
    manualMe=true; setMe(dest.lat,dest.lon); setGps('manual');
    toast('Routes now start from this point. Search a destination next.',4500);
  };
  $('gocopy').onclick=async()=>{
    const t=dest.lat.toFixed(6)+', '+dest.lon.toFixed(6);
    try{ await navigator.clipboard.writeText(t); toast('Coordinates copied'); }catch(e){ toast(t,6000); }
  };
}

/* ---------------- gps ---------------- */
let me=null, meMk=null, watchId=null, follow=false, manualMe=false;
let gpsState='idle';
function setGps(st,msg){
  gpsState=st;
  const chip=$('gpschip'); if(!chip) return;
  const label={idle:'GPS OFF',waiting:'GPS SEARCHING',live:'GPS LIVE',
    manual:'START SET BY HAND',denied:'GPS BLOCKED',unsupported:'GPS UNAVAILABLE'}[st]||st;
  chip.textContent=label+(msg?' \u00b7 '+msg:'');
  chip.className='chip '+(st==='live'?'ok':st==='waiting'?'wait':st==='manual'?'man':
    (st==='denied'||st==='unsupported')?'no':'');
  $('loc').classList.toggle('live',st==='live');
}
function locate(quiet){
  if(!navigator.geolocation){ setGps('unsupported'); if(!quiet) toast('This browser will not share a location'); return; }
  setGps('waiting');
  navigator.geolocation.getCurrentPosition(p=>{
    manualMe=false;
    setMe(p.coords.latitude,p.coords.longitude,p.coords.speed);
    setGps('live');
    if(!dest) map.flyTo({center:[me.lon,me.lat],zoom:14.5,speed:1.3,essential:true});
  },err=>{
    setGps(err.code===1?'denied':'idle', err.code===1?'allow it, or click the map':'no fix');
    if(!quiet) toast(err.code===1
      ? 'Location was blocked. Click anywhere on the map and choose START FROM HERE instead.'
      : 'No location fix. Click the map and choose START FROM HERE instead.',6000);
  },{enableHighAccuracy:true,timeout:9000,maximumAge:20000});
}
let spd=null;
function setMe(lat,lon,speed){
  me={lat,lon};
  if(speed!=null&&speed>=0) spd = IMP ? speed*2.23694 : speed*3.6;
  advanceNav();
  if(!meMk){ const d=document.createElement('div'); d.className='gps';
    meMk=new maplibregl.Marker({element:d}).setLngLat([lon,lat]).addTo(map); }
  else meMk.setLngLat([lon,lat]);
}
function toggleFollow(){
  follow=!follow;
  $('loc').classList.toggle('on',follow);
  if(follow){
    if(!navigator.geolocation){ setGps('unsupported'); toast('This browser will not share a location');
      follow=false; $('loc').classList.remove('on'); return; }
    setGps('waiting');
    watchId=navigator.geolocation.watchPosition(p=>{
      manualMe=false; setGps('live');
      setMe(p.coords.latitude,p.coords.longitude,p.coords.speed);
      map.easeTo({center:[me.lon,me.lat],duration:600,essential:true,
        bearing:(p.coords.heading!=null&&!isNaN(p.coords.heading))?p.coords.heading:map.getBearing()});
    },err=>{ setGps(err.code===1?'denied':'idle', err.code===1?'allow it, or click the map':'signal lost');
      toast(err.code===1
        ? 'Location blocked by the browser. Click the map and choose START FROM HERE.'
        : 'Lost the GPS signal.',5000);
      follow=false; $('loc').classList.remove('on');
      if(watchId!=null) navigator.geolocation.clearWatch(watchId);
    },{enableHighAccuracy:true,maximumAge:2000,timeout:12000});
    toast('Following your position');
  }else{
    if(watchId!=null) navigator.geolocation.clearWatch(watchId);
    watchId=null; locate(false);
  }
}

/* ---------------- routing ---------------- */
let routeGeo=null, routeInfo=null;
function setRoute(geo){
  routeGeo=geo;
  const s=map.getSource('route');
  if(s) s.setData({type:'Feature',geometry:geo,properties:{}});
}
function clearRoute(){
  navSt=null;
  $('hud').classList.remove('on');
  $('find').style.display='';
  routeGeo=null; routeInfo=null;
  const s=map.getSource('route'); if(s) s.setData(fc());
}

function dec6(str){
  let i=0,lat=0,lon=0,out=[];
  while(i<str.length){
    let b,sh=0,res=0;
    do{ b=str.charCodeAt(i++)-63; res|=(b&0x1f)<<sh; sh+=5; }while(b>=0x20);
    lat+=(res&1)?~(res>>1):(res>>1);
    sh=0;res=0;
    do{ b=str.charCodeAt(i++)-63; res|=(b&0x1f)<<sh; sh+=5; }while(b>=0x20);
    lon+=(res&1)?~(res>>1):(res>>1);
    out.push([lon/1e6,lat/1e6]);
  }
  return out;
}
function osrmText(s){
  const m=s.maneuver||{}, mod=(m.modifier||'').replace(/_/g,' '), on=s.name?' onto '+s.name:'';
  const dir=b=>['north','northeast','east','southeast','south','southwest','west','northwest']
    [Math.round(((b||0)%360)/45)%8];
  switch(m.type){
    case 'depart': return 'Head '+dir(m.bearing_after)+(s.name?' on '+s.name:'');
    case 'arrive': return 'Arrive at your destination';
    case 'turn': return 'Turn '+mod+on;
    case 'new name': return 'Continue'+(s.name?' on '+s.name:'');
    case 'merge': return 'Merge '+mod+on;
    case 'on ramp': return 'Take the ramp '+mod+on;
    case 'off ramp': return 'Take the exit '+mod+on;
    case 'fork': return 'Keep '+mod+on;
    case 'roundabout': case 'rotary': return 'Enter the roundabout'+(m.exit?' and take exit '+m.exit:'');
    case 'end of road': return 'At the end of the road, turn '+mod+on;
    case 'continue': return 'Continue '+mod+on;
    default: return (m.type?m.type.charAt(0).toUpperCase()+m.type.slice(1):'Continue')+(mod?' '+mod:'')+on;
  }
}
async function osrm(a,b){
  const u='https://router.project-osrm.org/route/v1/driving/'+a.lon+','+a.lat+';'+b.lon+','+b.lat+
    '?overview=full&geometries=geojson&steps=true';
  const j=await NET.json(u,null,{tries:2,ms:15000,label:'Router'});
  const rt=(j.routes||[])[0];
  if(!rt) throw new Error('No driving route found between those points');
  const steps=[];
  rt.legs.forEach(l=>l.steps.forEach(s=>{
    const m=s.maneuver||{};
    steps.push({text:osrmText(s),dist:s.distance,road:s.name||'',
      lon:m.location?m.location[0]:null, lat:m.location?m.location[1]:null, mod:(m.modifier||'')});
  }));
  return {dist:rt.distance,time:rt.duration,geo:rt.geometry,steps,src:'OSRM'};
}
async function valhalla(a,b,costing){
  const body={locations:[{lat:a.lat,lon:a.lon},{lat:b.lat,lon:b.lon}],costing,
    directions_options:{units:IMP?'miles':'kilometers',language:'en-US'}};
  const j=await NET.json('https://valhalla1.openstreetmap.de/route',
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},
    {tries:2,ms:20000,label:'Backup router'});
  const t=j.trip;
  if(!t||!t.legs) throw new Error('No route found for that mode');
  let coords=[], steps=[];
  const unit=IMP?1609.34:1000;
  t.legs.forEach(l=>{
    const shp=dec6(l.shape), base=coords.length;
    coords=coords.concat(shp);
    (l.maneuvers||[]).forEach(m=>{
      const pt=shp[Math.min(shp.length-1,m.begin_shape_index||0)]||null;
      steps.push({text:m.instruction,dist:(m.length||0)*unit,
        road:(m.street_names||[]).join(', '),
        lon:pt?pt[0]:null, lat:pt?pt[1]:null, mod:''});
    });
  });
  return {dist:t.summary.length*unit,time:t.summary.time,
    geo:{type:'LineString',coordinates:coords},steps,src:'Valhalla'};
}
async function route(){
  if(!dest){ toast('Pick a destination first'); return; }
  const from=me||{lat:map.getCenter().lat,lon:map.getCenter().lng};
  if(!me) toast('No GPS fix yet, routing from the centre of the map',4000);
  $('card').classList.add('on');
  $('cardb').innerHTML='<div class="kick">Route</div><h2>'+esc(dest.name)+'</h2>'+
    '<div class="sub" style="margin-top:8px"><span class="pulse" style="display:inline-block"></span> Calculating</div>';
  try{
    let r;
    if(mode==='drive'){
      try{ r=await osrm(from,dest); }
      catch(e1){
        console.warn('primary router failed:',e1.message);
        toast('Primary router unreachable, using the backup',3500);
        r=await valhalla(from,dest,'auto');
      }
    } else {
      r=await valhalla(from,dest, mode==='walk'?'pedestrian':'bicycle');
    }
    routeInfo=r; setRoute(r.geo); fitRoute(r.geo); showRoute(r);
  }catch(e){
    $('cardb').innerHTML='<div class="kick">Route</div><h2>'+esc(dest.name)+'</h2>'+
      '<div class="sub" style="color:var(--bad);margin-top:8px">'+esc(e.message)+'</div>'+modes();
    wireModes();
  }
}
function fitRoute(geo){
  const c=geo.coordinates; if(!c||!c.length) return;
  let a=180,b=90,d=-180,f=-90;
  for(const p of c){ a=Math.min(a,p[0]); d=Math.max(d,p[0]); b=Math.min(b,p[1]); f=Math.max(f,p[1]); }
  const wide=innerWidth>=760;
  map.fitBounds([[a,b],[d,f]],{duration:850,pitch:0,
    padding:{top:90,right:70,bottom:wide?70:Math.round(innerHeight*.45),left:wide?400:40}});
}
function modes(){
  return '<div class="modes">'+
    [['drive','Drive'],['walk','Walk'],['bike','Bike']].map(([k,l])=>
      '<div class="mode'+(k===mode?' on':'')+'" data-m="'+k+'">'+l+'</div>').join('')+
    '<div class="mode" data-u="1">'+(IMP?'mi':'km')+'</div></div>';
}
function wireModes(){
  $('cardb').querySelectorAll('[data-m]').forEach(el=>el.onclick=()=>{
    mode=el.dataset.m; ls.set('tern.mode',mode); route(); });
  const u=$('cardb').querySelector('[data-u]');
  if(u) u.onclick=()=>{ IMP=!IMP; ls.set('tern.units',IMP?'mi':'km'); if(routeInfo) route(); };
}
const ARROW={left:'<path d="M9 5L4 10l5 5"/><path d="M4 10h10a6 6 0 016 6v3"/>',
  right:'<path d="M15 5l5 5-5 5"/><path d="M20 10H10a6 6 0 00-6 6v3"/>',
  straight:'<path d="M12 21V5"/><path d="M6 11l6-6 6 6"/>',
  dest:'<path d="M12 22s7-6.3 7-12a7 7 0 10-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2"/>'};
function arrow(t){
  const a=(t||'').toLowerCase();
  const k = a.includes('arrive')||a.includes('destination') ? 'dest'
          : a.includes('left') ? 'left' : a.includes('right') ? 'right' : 'straight';
  return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+ARROW[k]+'</svg>';
}
function showRoute(r){
  $('card').classList.add('on');
  $('cardb').innerHTML='<div class="kick">Route &middot; '+esc(r.src)+'</div>'+
    '<div class="big"><div class="v num">'+fmtT(r.time)+'</div><div class="u num">'+fmtD(r.dist)+'</div>'+
    '<div class="sep">/</div><div class="u">'+esc(dest.name)+'</div></div>'+
    modes()+
    '<div class="row"><button class="btn go" id="start">Start</button>'+
    '<button class="btn sq" id="rx" title="Clear route">'+
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'+
    '<div class="steps">'+r.steps.map((s,i)=>'<div class="st" data-i="'+i+'">'+
      '<div class="i">'+arrow(s.text)+'</div><div><div class="a">'+esc(s.text)+'</div>'+
      '<div class="b">'+(s.dist?fmtD(s.dist):'')+(s.road?' &middot; '+esc(s.road):'')+'</div></div></div>').join('')+
    '</div>';
  wireModes();
  $('rx').onclick=()=>{ clearRoute(); showPlace(); };
  $('start').onclick=()=>startNav(r);
  $('cardb').querySelectorAll('.st').forEach(el=>el.onclick=()=>{
    const s=r.steps[+el.dataset.i];
    if(s.lon!=null) map.flyTo({center:[s.lon,s.lat],zoom:17,speed:1.5});
  });
}
let navSt=null;
function startNav(r){
  navSt={r,i:0};
  $('card').classList.remove('on');
  $('find').style.display='none';
  $('hud').classList.add('on');
  paintHud();
  map.easeTo({pitch:62,zoom:17,duration:950});
  if(!follow && !manualMe) toggleFollow();
}
function hudStep(d){
  if(!navSt) return;
  const r=navSt.r;
  navSt.i=Math.max(0,Math.min(r.steps.length-1,navSt.i+d));
  const s=r.steps[navSt.i];
  if(s.lon!=null) map.easeTo({center:[s.lon,s.lat],zoom:17,pitch:62,duration:650});
  paintHud();
}
function exitNav(){
  navSt=null;
  $('hud').classList.remove('on');
  $('find').style.display='';
  map.easeTo({pitch:52,duration:700});
  if(routeInfo) showRoute(routeInfo);
}
function paintHud(){
  if(!navSt) return;
  const {r,i}=navSt, s=r.steps[i];
  $('hudmi').innerHTML=arrow(s.text);
  $('hudi').textContent=s.text;
  $('hudr').textContent='Step '+(i+1)+' of '+r.steps.length+(s.road?' \u00b7 '+s.road:'');
  let d=null;
  if(me&&s.lat!=null) d=hav(me,{lat:s.lat,lon:s.lon});
  else if(s.dist) d=s.dist;
  $('hudd').textContent = d!=null? fmtD(d) : '--';
  let remD=0;
  for(let k=i;k<r.steps.length;k++) remD+=r.steps[k].dist||0;
  const remT = r.dist? r.time*(remD/r.dist) : 0;
  $('hudrem').textContent=fmtD(remD);
  $('hudeta').textContent=new Date(Date.now()+remT*1000)
    .toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  $('hudsp').textContent = (spd!=null&&gpsState==='live')? Math.round(spd)+(IMP?' mph':' kph') : '--';
  $('hudprev').disabled = navSt.i===0;
  $('hudnext').disabled = navSt.i>=r.steps.length-1;
}
function advanceNav(){
  if(!navSt||!me||gpsState!=='live') return;
  const r=navSt.r;
  let near=-1, nd=Infinity;
  for(let k=0;k<r.steps.length;k++){
    const st=r.steps[k]; if(st.lat==null) continue;
    const d=hav(me,{lat:st.lat,lon:st.lon});
    if(d<nd){ nd=d; near=k; }
  }
  if(near>=0){
    // within 40 m of a maneuver means it is done, so aim at the next one
    const target = nd<40 ? Math.min(near+1, r.steps.length-1) : near;
    if(target>navSt.i) navSt.i=target;   // never step backwards
  }
  paintHud();
}

/* ---------------- diagnostics ---------------- */
const isFile = location.protocol==='file:';
const SVC=[
 {id:'sv-tile',n:'Map tiles',run:async()=>{
   const r=await fetch(OFM+'/styles/dark'); if(!r.ok) throw new Error('HTTP '+r.status);
   await r.json(); return 'OpenFreeMap reachable'; }},
 {id:'sv-geo',n:'Search',run:async()=>{
   const r=await fetch('https://photon.komoot.io/api?q=charlotte&limit=1&lang=en');
   if(!r.ok) throw new Error('HTTP '+r.status);
   const j=await r.json(); return (j.features||[]).length+' result from Photon'; }},
 {id:'sv-rt1',n:'Router (OSRM)',run:async()=>{
   const r=await fetch('https://router.project-osrm.org/route/v1/driving/'+
     '-80.8431,35.2271;-80.8456,35.1924?overview=false');
   if(!r.ok) throw new Error('HTTP '+r.status);
   const j=await r.json(); if(j.code!=='Ok') throw new Error('returned '+j.code);
   return 'route in '+fmtT(j.routes[0].duration); }},
 {id:'sv-rt2',n:'Router backup',run:async()=>{
   const r=await fetch('https://valhalla1.openstreetmap.de/status');
   if(!r.ok) throw new Error('HTTP '+r.status);
   const j=await r.json(); return 'Valhalla '+(j.version||'ok'); }},
 {id:'sv-traf',n:'Live traffic',run:async()=>{
   if(!TTKEY) throw new Error('no TomTom key saved yet');
   const r=await fetch('https://api.tomtom.com/traffic/services/5/incidentDetails?key='+
     encodeURIComponent(TTKEY)+'&bbox=-80.90,35.18,-80.78,35.28&fields={incidents{type}}'+
     '&language=en-GB&timeValidityFilter=present');
   if(r.status===403) throw new Error('key rejected (403). Check it, and that Traffic is enabled on it.');
   if(!r.ok) throw new Error('HTTP '+r.status);
   const j=await r.json(); return ((j.incidents||[]).length)+' incidents near Charlotte'; }},
 {id:'sv-gps',n:'GPS',run:()=>new Promise((ok,no)=>{
   if(!navigator.geolocation) return no(new Error('not supported by this browser'));
   navigator.geolocation.getCurrentPosition(
     p=>ok('fix at '+p.coords.latitude.toFixed(4)+', '+p.coords.longitude.toFixed(4)),
     e=>no(new Error(e.code===1?'permission denied by the browser':e.message)),
     {timeout:9000,maximumAge:30000});
 })}
];
let diagFails=0;
async function selftest(){
  diagFails=0;
  for(const sv of SVC){
    const row=$(sv.id); if(!row) continue;
    row.querySelector('.sd').className='sd wait';
    row.querySelector('.se').textContent='testing';
  }
  await Promise.all(SVC.map(async sv=>{
    const row=$(sv.id); if(!row) return;
    try{ const msg=await sv.run();
      row.querySelector('.sd').className='sd ok';
      row.querySelector('.se').textContent=msg;
    }catch(e){
      const soft = sv.id==='sv-traf' && /no TomTom key/.test(e.message);
      row.querySelector('.sd').className='sd '+(soft?'':'no');
      row.querySelector('.se').textContent=e.message;
      if(!soft) diagFails++;
    }
  }));
  $('fix').style.display = (diagFails&&isFile)?'block':'none';
  const b=$('diagdot'); if(b) b.style.display=diagFails?'block':'none';
  return diagFails;
}

/* ---------------- chrome ---------------- */
$('cardx').onclick=()=>$('card').classList.remove('on');
$('loc').onclick=()=>toggleFollow();
$('tilt').onclick=()=>{ const on=map.getPitch()<20;
  $('tilt').classList.toggle('on',on); map.easeTo({pitch:on?58:0,duration:650}); };
$('theme').onclick=()=>{
  theme = theme==='dark'?'light':'dark';
  ls.set('tern.theme',theme);
  document.documentElement.setAttribute('data-t',theme);
  const hadFlow=!!map.getSource('flow');
  map.setStyle(STYLES[theme]);
  map.once('styledata',()=>{ if(!hadFlow) removeTraffic(); addOverlays(); });
};
$('traf').onclick=()=>{
  if(!TTKEY){ $('diag').classList.add('on'); selftest(); toast('Add a free TomTom key to switch traffic on',4500); return; }
  trafficOn=!trafficOn; ls.set('tern.traffic',trafficOn?'1':'0');
  $('traf').classList.toggle('on',trafficOn);
  if(trafficOn){ addTraffic(); loadIncidents(false); }
  else { removeTraffic(); incData=null;
    if(map.getSource('inc')) map.getSource('inc').setData(fc()); lastInc=0; stamp(); }
};
$('gear').onclick=()=>{ $('diag').classList.add('on'); selftest(); };
$('diag').onclick=e=>{ if(e.target===$('diag')) $('diag').classList.remove('on'); };
$('diagx').onclick=()=>$('diag').classList.remove('on');
$('retest').onclick=()=>selftest();
$('hudx').onclick=()=>exitNav();
$('hudprev').onclick=()=>hudStep(-1);
$('hudnext').onclick=()=>hudStep(1);
addEventListener('keydown',e=>{
  if(!navSt||e.target===$('q')) return;
  if(e.key==='ArrowRight'||e.key===' '){ e.preventDefault(); hudStep(1); }
  if(e.key==='ArrowLeft'){ e.preventDefault(); hudStep(-1); }
});
$('keysave').onclick=()=>{
  TTKEY=$('key').value.trim(); ls.set('tern.ttkey',TTKEY);
  keyStat();
  if(TTKEY){ trafficOn=true; ls.set('tern.traffic','1'); $('traf').classList.add('on');
    removeTraffic(); addTraffic(); loadIncidents(false); }
  selftest();
};
function keyStat(){
  const d=$('kdot'), t=$('ktxt');
  if(TTKEY){ d.className='dot good'; t.textContent='Key saved in this browser. Traffic and incidents are on.'; }
  else { d.className='dot'; t.textContent='No key yet. Traffic flow and incidents stay off.'; }
}
addEventListener('keydown',e=>{
  if(e.target===$('q')) return;
  if(e.key==='/'){ e.preventDefault(); $('q').focus(); $('q').select(); }
  else if(e.key==='Escape'){ $('hits').classList.remove('on'); $('diag').classList.remove('on');
    if(navSt) exitNav(); }
  else if(e.key==='t'){ $('theme').click(); }
  else if(e.key==='g'){ $('loc').click(); }
});
$('key').value=TTKEY; keyStat(); setGps('idle');
setTimeout(()=>selftest().then(n=>{ if(n) { $('diag').classList.add('on');
  toast(n+' service'+(n>1?'s':'')+' failed, see the panel',5000); } }),1800);
$('traf').classList.toggle('on',trafficOn&&!!TTKEY);
stamp();
