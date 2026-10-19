import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/aurora-weather-card.js', import.meta.url), 'utf8');
function setup() {
  const classes = {}, timers = new Map(); let timerId = 0;
  const context = { LitElement: class { connectedCallback() {} disconnectedCallback() {} },
    html:()=>'', svg:()=>'', css:()=>'', nothing:'', console,
    window:{addEventListener(){},removeEventListener(){},setTimeout(fn){timers.set(++timerId,fn);return timerId;}},
    clearTimeout(id){timers.delete(id);}, customElements:{get:n=>classes[n],define:(n,c)=>classes[n]=c} };
  vm.runInNewContext(source.replace(/^import .*;$/m,''),context);
  const card = new classes['aurora-weather-card'](); card.isConnected = true;
  card.setConfig({entity:'weather.a'});
  const requests=[];
  function connection() { return {subscribeMessage(callback,message) {
    let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
    const request={callback,message,resolve,reject,unsubscribed:0};
    request.accept=()=>resolve(()=>{request.unsubscribed++;});requests.push(request);return promise;
  }}; }
  card.hass={connection:connection()};
  return {card,requests,timers,connection};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('initial data, repeated events, empty/null forecasts and no duplicate subscriptions',async()=>{
 const {card,requests}=setup();const pending=card.loadForecastIfNeeded();card.updated();card.updated();
 assert.equal(requests.length,1);assert.equal(requests[0].message.type,'weather/subscribe_forecast');
 assert.equal(requests[0].message.forecast_type,'hourly');assert.equal(requests[0].message.entity_id,'weather.a');
 requests[0].callback({forecast:[{temperature:12}]});requests[0].accept();await pending;
 assert.equal(card.forecast[0].temperature,12);requests[0].callback({forecast:[{temperature:22}]});
 assert.equal(card.forecast[0].temperature,22);assert.equal(card.status,'ok');
 requests[0].callback({forecast:null});assert.equal(card.forecast.length,0);
 requests[0].callback({forecast:[]});assert.equal(card.forecast.length,0);
 card.setConfig({entity:'weather.a',hours:24});card.updated();assert.equal(requests.length,1);
});
test('entity swap rejects stale events and cleans pending subscription',async()=>{
 const {card,requests}=setup();const first=card.loadForecastIfNeeded();
 card.setConfig({entity:'weather.b'});const second=card.loadForecastIfNeeded();
 requests[0].callback({forecast:[{temperature:99}]});assert.equal(card.forecast.length,0);
 requests[0].accept();requests[1].accept();await Promise.all([first,second]);
 assert.equal(requests[0].unsubscribed,1);assert.equal(requests[1].message.entity_id,'weather.b');
 requests[1].callback({forecast:[{temperature:5}]});assert.equal(card.forecast[0].temperature,5);
});
test('disconnect while pending, reattach, established cleanup and new connection',async()=>{
 const {card,requests,connection}=setup();const pending=card.loadForecastIfNeeded();
 card.isConnected=false;card.disconnectedCallback();requests[0].accept();await pending;
 assert.equal(requests[0].unsubscribed,1);card.isConnected=true;card.connectedCallback();
 requests[1].accept();await tick();card.hass={connection:connection()};card.updated();
 assert.equal(requests[1].unsubscribed,1);assert.equal(requests.length,3);
 requests[2].accept();await tick();card.isConnected=false;card.disconnectedCallback();
 assert.equal(requests[2].unsubscribed,1);assert.equal(card._forecastRetryTimer,undefined);
});
test('error retries after delay, does not loop, and disconnect cancels retry',async()=>{
 const {card,requests,timers}=setup();const pending=card.loadForecastIfNeeded();
 requests[0].reject({message:'Not available'});await pending;
 assert.equal(card.status,'error');assert.equal(card.errorMessage,'Not available');
 card.updated();assert.equal(requests.length,1);const retry=timers.get(card._forecastRetryTimer);retry();
 assert.equal(requests.length,2);requests[1].reject(new Error('offline'));await tick();
 const timer=card._forecastRetryTimer;card.isConnected=false;card.disconnectedCallback();
 assert.equal(timers.has(timer),false);retry();assert.equal(requests.length,2);
});
test('late rejection from old entity cannot corrupt new subscription',async()=>{
 const {card,requests}=setup();const first=card.loadForecastIfNeeded();
 card.setConfig({entity:'weather.b'});const second=card.loadForecastIfNeeded();
 requests[1].callback({forecast:[{temperature:4}]});requests[1].accept();await second;
 requests[0].reject(new Error('old failure'));await first;assert.equal(card.status,'ok');
 assert.equal(card.forecast[0].temperature,4);
});
