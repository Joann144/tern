import fs from 'fs';
const app=fs.readFileSync('/home/claude/nav/app.js','utf8');

/* ---------- stubs ---------- */
const store={};
globalThis.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>store[k]=String(v)};
const el=id=>({id,innerHTML:'',textContent:'',value:'',hidden:false,className:'',style:{},dataset:{},
  classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},
    toggle(c,v){v===undefined?(this._s.has(c)?this._s.delete(c):this._s.add(c)):(v?this._s.add(c):this._s.delete(c))},
    contains(c){return this._s.has(c)}},
  addEventListener(e,f){(this._h=this._h||{})[e]=f},
  querySelectorAll:()=>[],querySelector:()=>null,focus(){},blur(){},select(){},remove(){},
  get children(){return []}});
const E={};
globalThis.document={hidden:false,getElementById:i=>E[i]||(E[i]=el(i)),
  documentElement:{setAttribute(){}}, createElement:()=>Object.assign(el('tmp'),{getContext:()=>({})}), addEventListener(){}};
globalThis.addEventListener=()=>{};
globalThis.window=globalThis;
globalThis.location={protocol:'file:'};
globalThis.innerWidth=1200; globalThis.innerHeight=800;
Object.defineProperty(globalThis,'navigator',{configurable:true,writable:true,
  value:{onLine:true,geolocation:{getCurrentPosition(ok){ok({coords:{latitude:35.2271,longitude:-80.8431}})},
    watchPosition(){return 1},clearWatch(){}}, clipboard:{writeText:async()=>{}}}});
const handlers={};
class FakeMap{
  constructor(){ this._src={}; this._lay={}; }
  on(ev,a,b){ const k=b?ev+':'+a:ev; (handlers[k]=handlers[k]||[]).push(b||a); }
  once(ev,f){ this.on(ev,f); } off(){}
  addControl(){} getCanvas(){return {style:{}}}
  addSource(id,s){this._src[id]=s} getSource(id){ const s=this._src[id];
    return s?{setData(d){s._data=d}}:undefined }
  removeSource(id){delete this._src[id]}
  addLayer(l){this._lay[l.id]=l} getLayer(id){return this._lay[id]} removeLayer(id){delete this._lay[id]}
  getStyle(){return {layers:[{id:'water',type:'fill'},{id:'place-label',type:'symbol'}]}}
  getCenter(){return {lat:35.2271,lng:-80.8431}} getZoom(){return 12} getPitch(){return 0}
  getBounds(){return {getWest:()=>-80.95,getSouth:()=>35.15,getEast:()=>-80.75,getNorth:()=>35.31}}
  flyTo(){} easeTo(){} fitBounds(){} setStyle(){} queryRenderedFeatures(){return []}
}
globalThis.maplibregl={Map:FakeMap,
  Marker:class{constructor(){} setLngLat(){return this} addTo(){return this} remove(){}},
  NavigationControl:class{}, ScaleControl:class{}};

/* ---------- canned API responses ---------- */
function enc6(pts){ // polyline6 encoder, to prove the decoder round-trips
  let lat=0,lon=0,out='';
  const v=n=>{ n=n<0?~(n<<1):(n<<1); let s='';
    while(n>=0x20){ s+=String.fromCharCode((0x20|(n&0x1f))+63); n>>=5; }
    return s+String.fromCharCode(n+63); };
  for(const [x,y] of pts){ const la=Math.round(y*1e6), lo=Math.round(x*1e6);
    out+=v(la-lat)+v(lo-lon); lat=la; lon=lo; }
  return out;
}
const SHAPE=[[-80.8431,35.2271],[-80.8402,35.2310],[-80.8350,35.2388]];
const RESP={
  photon:{features:[{properties:{name:'Freedom Park',street:'East Blvd',housenumber:'1900',
    city:'Charlotte',state:'North Carolina',country:'United States'},
    geometry:{coordinates:[-80.8456,35.1924]}}]},
  osrm:{code:'Ok',routes:[{distance:6823.4,duration:842.1,geometry:{type:'LineString',coordinates:SHAPE},
    legs:[{steps:[
      {distance:640,name:'S Tryon St',maneuver:{type:'depart',bearing_after:184,location:[-80.8431,35.2271]}},
      {distance:1770,name:'E Morehead St',maneuver:{type:'turn',modifier:'right',location:[-80.8402,35.2310]}},
      {distance:3100,name:'East Blvd',maneuver:{type:'turn',modifier:'left',location:[-80.8350,35.2388]}},
      {distance:0,name:'',maneuver:{type:'arrive',location:[-80.8456,35.1924]}}]}]}]},
  valhalla:{trip:{summary:{length:2.6,time:1980},legs:[{shape:enc6(SHAPE),
    maneuvers:[{instruction:'Walk south on South Tryon Street.',length:0.4,street_names:['South Tryon Street']},
      {instruction:'Turn right onto East Morehead Street.',length:1.1,street_names:['East Morehead Street']},
      {instruction:'You have arrived at your destination.',length:0}]}]}},
  tomtom:{incidents:[
    {type:'Feature',geometry:{type:'LineString',coordinates:[[-80.84,35.22],[-80.839,35.221]]},
     properties:{iconCategory:8,magnitudeOfDelay:4,events:[{description:'Closed',code:401}],
       startTime:'2026-11-07T01:00:00Z',endTime:'2026-11-07T09:00:00Z',
       from:'S Tryon St',to:'E Morehead St',length:238.553,delay:0,roadNumbers:['US-74']}},
    {type:'Feature',geometry:{type:'Point',coordinates:[-80.85,35.23]},
     properties:{iconCategory:1,magnitudeOfDelay:3,events:[{description:'Accident',code:108}],
       from:'I-277',to:'',length:120,delay:540,roadNumbers:['I-277']}},
    null]}
};
const seen=[];
globalThis.fetch=async(url,opt)=>{
  const u=String(url); seen.push(u.split('?')[0]);
  const pick = u.includes('photon')&&u.includes('/reverse') ? RESP.photon
    : u.includes('photon') ? RESP.photon
    : u.includes('project-osrm') ? RESP.osrm
    : u.includes('valhalla') ? RESP.valhalla
    : u.includes('tomtom') ? RESP.tomtom : {};
  globalThis.__lastUrl=u; globalThis.__lastOpt=opt;
  return {ok:true,status:200,json:async()=>pick};
};

const probe=`;globalThis.T={fmtD,fmtT,dec6,osrmText,osrm,valhalla,bboxKm2,loadIncidents,geocode,
  arrow,CAT,MAG,route,setDest,showPlace,showRoute,get incData(){return incData},
  get hits(){return hits}, set TTKEY(v){TTKEY=v}, get TTKEY(){return TTKEY},
  set trafficOn(v){trafficOn=v}, setMe, get map(){return map}, addOverlays, addTraffic,
  selftest, SVC, startNav, exitNav, paintHud, clearRoute, hav, hudStep, setGps, NET,
  quotaUsed, quotaBump, loadIncidents,
  get gpsState(){return gpsState}, set manualMe(v){manualMe=v},
  get navSt(){return navSt}, get routeInfo(){return routeInfo}};`;
try{ new Function(app+probe)(); }catch(e){ console.log('APP THREW ON LOAD:',e.message); process.exit(1); }
console.log('app evaluated with no throw');
const T=globalThis.T;

/* ---------- formatters ---------- */
console.log('\n-- units --');
for(const m of [45,160,1200,6823,160000]) console.log('  '+m+' m ->', T.fmtD(m));
for(const s of [40,95,842,7200]) console.log('  '+s+' s ->', T.fmtT(s));

/* ---------- polyline round trip ---------- */
const dec=T.dec6(enc6(SHAPE));
const maxErr=Math.max(...dec.map((p,i)=>Math.max(Math.abs(p[0]-SHAPE[i][0]),Math.abs(p[1]-SHAPE[i][1]))));
console.log('\n-- polyline6 --\n  points',dec.length,'of',SHAPE.length,'| max coord error',maxErr.toExponential(1));
if(dec.length!==SHAPE.length||maxErr>1e-6){ console.log('POLYLINE DECODE WRONG'); process.exit(1); }

/* ---------- osrm ---------- */
const r=await T.osrm({lat:35.2271,lon:-80.8431},{lat:35.1924,lon:-80.8456});
console.log('\n-- driving route (OSRM) --');
console.log('  summary:',T.fmtT(r.time),'/',T.fmtD(r.dist),'| steps:',r.steps.length);
r.steps.forEach(s=>console.log('   •',s.text,'['+(s.dist?T.fmtD(s.dist):'')+']'));
if(r.steps.length!==4||!/Head south/.test(r.steps[0].text)||!/Arrive/.test(r.steps[3].text)){
  console.log('OSRM STEP TEXT WRONG'); process.exit(1); }

/* ---------- valhalla ---------- */
const w=await T.valhalla({lat:35.2271,lon:-80.8431},{lat:35.1924,lon:-80.8456},'pedestrian');
console.log('\n-- walking route (Valhalla) --');
console.log('  summary:',T.fmtT(w.time),'/',T.fmtD(w.dist),'| geometry points:',w.geo.coordinates.length);
console.log('  POST body sent:',String(globalThis.__lastOpt&&globalThis.__lastOpt.body).slice(0,96));
if(w.geo.coordinates.length!==3){ console.log('VALHALLA SHAPE WRONG'); process.exit(1); }

/* ---------- incidents ---------- */
console.log('\n-- live incidents (TomTom) --');
console.log('  bbox area km2:', Math.round(T.bboxKm2(T.map.getBounds())));
T.TTKEY='TESTKEY'; T.trafficOn=true;
await T.loadIncidents(true);
const inc=T.incData;
console.log('  parsed features:',inc.features.length,'(one null dropped)');
inc.features.forEach(f=>console.log('   •',f.properties.cat,'|',f.properties.mag,'|',
  f.properties.desc,'|',f.properties.from||'-','| delay',f.properties.delay,'| colour',f.properties.col));
if(inc.features.length!==2){ console.log('INCIDENT PARSE WRONG'); process.exit(1); }
if(inc.features[0].properties.cat!=='Road closed'||inc.features[1].properties.cat!=='Accident'){
  console.log('INCIDENT CATEGORY MAPPING WRONG'); process.exit(1); }
console.log('  request url shape:', globalThis.__lastUrl.split('&').slice(0,3).join('&').replace('TESTKEY','KEY'));

/* ---------- search ---------- */
await T.geocode('freedom park');
console.log('\n-- search --');
T.hits.forEach(h=>console.log('   •',h.name,'|',h.detail,'|',h.lat,h.lon));
if(!T.hits.length||T.hits[0].name!=='Freedom Park'){ console.log('SEARCH PARSE WRONG'); process.exit(1); }

/* ---------- maneuver icons ---------- */
console.log('\n-- maneuver icons --');
for(const t of ['Turn left onto X','Turn right onto Y','Continue on Z','Arrive at your destination'])
  console.log('  '+t.padEnd(30), T.arrow(t).includes('M9 5L4 10')?'left-arrow'
    : T.arrow(t).includes('M15 5l5 5')?'right-arrow'
    : T.arrow(t).includes('M12 22s7')?'destination-pin':'straight-arrow');

/* ---------- overlay layers ---------- */
T.addOverlays();
console.log('\n-- layers registered --', Object.keys(T.map._lay).join(', '));
for(const need of ['route-case','route-line','inc-line','inc-pt','flow'])
  if(!T.map._lay[need]){ console.log('MISSING LAYER:',need); process.exit(1); }

/* ---------- self test ---------- */
for(const sv of T.SVC){ const row=E[sv.id]=el(sv.id); const cell={className:'',textContent:''};
  const dot={className:''}; row.querySelector=s2=>s2==='.sd'?dot:cell; row._dot=dot; row._cell=cell; }
T.TTKEY='TESTKEY';
const fails=await T.selftest();
console.log('\n-- self test --');
for(const sv of T.SVC) console.log('  '+sv.n.padEnd(15), E[sv.id]._dot.className.padEnd(7), E[sv.id]._cell.textContent);
console.log('  failing services:',fails);
if(fails!==0){ console.log('SELFTEST REPORTED FAILURES WITH ALL MOCKS OK'); process.exit(1); }

/* ---------- nav HUD: manual stepping with NO gps ---------- */
T.setDest({name:'Freedom Park',detail:'',lat:35.1924,lon:-80.8456});
await T.route();
const ri=T.routeInfo;
T.manualMe=true;              // pretend the user set a start by hand, so follow is not engaged
T.setGps('denied');
T.startNav(ri);
console.log('\n-- nav HUD without GPS --');
console.log('  step', T.navSt.i, '|', E['hudi'].textContent, '| next btn disabled =', E['hudnext'].disabled);
T.hudStep(1);
console.log('  after pressing NEXT -> step', T.navSt.i, '|', E['hudi'].textContent);
T.hudStep(1); T.hudStep(1);
console.log('  at last step', T.navSt.i, '| next disabled =', E['hudnext'].disabled, '| prev disabled =', E['hudprev'].disabled);
T.hudStep(-1);
console.log('  after BACK -> step', T.navSt.i);
if(T.navSt.i!==2){ console.log('MANUAL STEPPING BROKEN'); process.exit(1); }

/* ---------- gps must not hijack steps unless it is actually live ---------- */
T.navSt.i=0; T.setGps('denied');
T.setMe(ri.steps[2].lat, ri.steps[2].lon, 20);
console.log('\n-- gps gating --\n  position jumped while GPS is blocked -> step', T.navSt.i, '(must stay 0)');
if(T.navSt.i!==0){ console.log('BLOCKED GPS STILL MOVED THE STEP'); process.exit(1); }
T.setGps('live');
T.setMe(ri.steps[1].lat, ri.steps[1].lon, 20);
console.log('  same move with GPS live -> step', T.navSt.i, '| speed', E['hudsp'].textContent);
if(T.navSt.i!==2){ console.log('LIVE GPS DID NOT ADVANCE'); process.exit(1); }
console.log('  chip reads:', E['gpschip'].textContent);
T.exitNav(); T.clearRoute();
console.log('  exit + clear ok');

/* ---------- router fallback ---------- */
let osrmDown=true;
const realFetch=globalThis.fetch;
globalThis.fetch=async(u,o)=>{ if(osrmDown&&String(u).includes('project-osrm')) throw new Error('Failed to fetch');
  return realFetch(u,o); };
T.setDest({name:'Freedom Park',detail:'',lat:35.1924,lon:-80.8456});
await T.route();
console.log('\n-- router fallback --\n  with OSRM down, route came from', T.routeInfo.src,
  '|', T.fmtT(T.routeInfo.time), '/', T.fmtD(T.routeInfo.dist));
if(T.routeInfo.src!=='Valhalla'){ console.log('FALLBACK DID NOT ENGAGE'); process.exit(1); }
globalThis.fetch=realFetch;

/* ---------- reliability: timeout, retry, offline, quota ---------- */
console.log('\n-- reliability --');
const realF=globalThis.fetch;

// a) transient failure then success -> must retry and win
let attempts=0;
globalThis.fetch=async(u,o)=>{
  if(!String(u).includes('example.test/x')) return {ok:true,status:200,json:async()=>({})};
  attempts++;
  if(attempts<3) throw new Error('ECONNRESET');
  return {ok:true,status:200,json:async()=>({ok:1})}; };
const t0=Date.now();
const got=await T.NET.json('https://example.test/x',null,{tries:3,ms:5000,label:'Thing'});
console.log('  retry: succeeded on attempt',attempts,'after',Date.now()-t0,'ms ->',JSON.stringify(got));
if(attempts!==3){ console.log('RETRY DID NOT WORK'); process.exit(1); }

// b) a hanging request must abort, not hang forever
globalThis.fetch=(u,o)=>{
  if(!String(u).includes('example.test/hang')) return Promise.resolve({ok:true,status:200,json:async()=>({})});
  return new Promise((res,rej)=>{
    if(o&&o.signal) o.signal.addEventListener('abort',()=>{ const e=new Error('aborted'); e.name='AbortError'; rej(e); });
  });};
let timedOut='';
try{ await T.NET.json('https://example.test/hang',null,{tries:0,ms:300,label:'Hanging thing'}); }
catch(e){ timedOut=e.message; }
console.log('  timeout:',timedOut);
if(!/timed out/.test(timedOut)){ console.log('TIMEOUT DID NOT FIRE'); process.exit(1); }

// c) HTTP status codes become readable errors
for(const [code,want] of [[429,'rate limited'],[403,'rejected the key'],[500,'HTTP 500']]){
  globalThis.fetch=async(u)=>String(u).includes('example.test/s')
    ? {ok:code<400,status:code,json:async()=>({})}
    : {ok:true,status:200,json:async()=>({})};
  let m=''; try{ await T.NET.json('https://example.test/s',null,{tries:0,ms:900,label:'Svc'}); }catch(e){ m=e.message; }
  console.log('  HTTP '+code+' ->', m);
  if(!m.includes(want)){ console.log('BAD ERROR TEXT FOR',code); process.exit(1); }
}

// d) offline short-circuits instead of retrying blindly
navigator.onLine=false;
globalThis.fetch=async(u)=>{ if(!String(u).includes('example.test/o'))
    return {ok:true,status:200,json:async()=>({})};
  throw new Error('network down'); };
let off=''; try{ await T.NET.json('https://example.test/o',null,{tries:3,ms:900,label:'Svc'}); }catch(e){ off=e.message; }
console.log('  offline:',off);
if(off!=='You are offline'){ console.log('OFFLINE NOT DETECTED'); process.exit(1); }
navigator.onLine=true;

// e) background tab must not burn the free tier
globalThis.fetch=realF;
const before=T.quotaUsed();
document.hidden=true;  await T.loadIncidents(true);
console.log('  hidden tab: quota went',before,'->',T.quotaUsed(),'(must not move)');
if(T.quotaUsed()!==before){ console.log('BACKGROUND TAB BURNED QUOTA'); process.exit(1); }
document.hidden=false; await T.loadIncidents(true);
console.log('  visible tab: quota went',before,'->',T.quotaUsed(),'(must move)');
if(T.quotaUsed()!==before+1){ console.log('QUOTA NOT COUNTED'); process.exit(1); }

console.log('\nhosts contacted:', [...new Set(seen)].join('\n                 '));
console.log('\nALL NAV CHECKS PASSED');
process.exit(0);
