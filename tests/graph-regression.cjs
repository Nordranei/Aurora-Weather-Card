const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../src/aurora-weather-card.js'),'utf8');
const classes={};
const flatten=v=>Array.isArray(v)?v.map(flatten).join(''):v==null?'':typeof v==='function'?'':String(v);
const tag=(parts,...values)=>parts.reduce((s,p,i)=>s+p+flatten(values[i]),'');
const context={LitElement:class {},html:tag,svg:tag,css:tag,nothing:'',window:{innerWidth:1200},customElements:{get:n=>classes[n],define:(n,c)=>classes[n]=c},console,Date,Intl};
vm.runInNewContext(source.replace(/^import .*;$/m,''),context);
const Card=classes['aurora-weather-card'];
const card=new Card();
const data=Array.from({length:48},(_,i)=>({time:new Date(Date.UTC(2026,8,24,i)),temperature:10+i%5,precipitation:1,windSpeed:4,windGust:8,windBearing:90,condition:'sunny'}));
card.graphData=()=>data.slice(0,card.config.hours);
card.atmosphereClass=()=>'';
card._renderExpandedInfo=()=>'';
card._formatLocalClock=()=>'';
const keys=['show_temperature','show_precipitation','show_wind','show_wind_gust','show_wind_direction','show_weather_icons'];
const selectors=['temperature-line','rain-bar','wind-line','gust-line','wind-direction','weather-icon'];
const dots=['temp','rain','wind','gust'];
let cases=0;
for(const hours of [24,48]) for(let mask=0;mask<64;mask++) {
 card.setConfig({entity:'weather.test',hours,...Object.fromEntries(keys.map((k,i)=>[k,!!(mask&(1<<i))]))});
 card.status='ok'; card.forecast=data; card.expanded=true;
 for(const expanded of [false,true]) {
  const graph=card.renderGraph(expanded);
  selectors.forEach((cls,i)=>assert.equal(graph.includes('class="'+cls+'"'),!!(mask&(1<<i)),cls));
  assert(!graph.includes('NaN'));
  cases++;
 }
 const rendered=card.render();
 dots.forEach((cls,i)=>assert.equal(rendered.split('class="legend-dot '+cls+'"').length-1,mask&(1<<i)?2:0));
}
card.setConfig({entity:'weather.test'});
selectors.forEach(cls=>assert(card.renderGraph().includes('class="'+cls+'"')));
const Editor=classes['aurora-weather-card-editor-v1-3-1'];
const editor=new Editor(); editor.setConfig({hours:24,entity:'weather.test'});
let event; context.CustomEvent=class {constructor(type,options){this.type=type;Object.assign(this,options)}};
editor.dispatchEvent=e=>{event=e};
for(const key of keys) {editor._setValue(key,false);assert.equal(event.detail.config[key],false);assert.equal(event.detail.config.hours,24);editor._setValue(key,true);assert.equal(event.detail.config[key],true);}
assert.equal(editor._renderGraphTab().split('role="switch"').length-1,6);

console.log(`PASS: ${cases} graph cases, both legends, defaults, editor config events, source regression.`);

assert.equal(context.window.customCards[0].type,"aurora-weather-card");
assert(!classes["aurora-weather-card-dev"]);
card.setConfig({type:"custom:aurora-weather-card",entity:"weather.home",location_name:"Home",hours:24,theme:"aurora_static"});
assert.equal(card.config.hours,24);
assert.equal(card.config.location_name,"Home");
assert.equal(card.config.theme,"aurora_static");
selectors.forEach(cls=>assert(card.renderGraph().includes('class="'+cls+'"')));
console.log("PASS: stable registration and existing v1.2 configuration.");
