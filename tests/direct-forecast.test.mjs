import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {sourceForVm} from './source-harness.cjs';
function setup(fetch) {
 const classes={}, timers=[];
 const context={console,Date,Intl,URLSearchParams,AbortController,fetch,setTimeout,clearTimeout,
 LitElement:class{},html:()=>'',svg:()=>'',css:()=>'',nothing:'',window:{setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;}},
 customElements:{get:k=>classes[k],define:(k,c)=>classes[k]=c}};
 vm.runInNewContext(sourceForVm(),context);
 const card=new classes['aurora-weather-card']();card.isConnected=true;
 card.setConfig({weather_source:'open_meteo',latitude:52.52,longitude:13.41});
 return {card,context,timers,Card:classes['aurora-weather-card']};
}
const payload=()=>({timezone:'Europe/Berlin',hourly:{time:[Math.floor(Date.now()/1000)+3600,Math.floor(Date.now()/1000)+7200],temperature_2m:[10,11],wind_speed_10m:[2,3],wind_gusts_10m:[null,0],weather_code:[0,95],is_day:[0,1],relative_humidity_2m:[70,80],pressure_msl:[1001,1002]}});
test('direct provider maps UTC, missing gusts and conditions; caches concurrent cards',async()=>{
 let calls=0;const {card,Card,timers}=setup(async url=>{calls++;assert.match(url,/wind_speed_unit=ms/);return {ok:true,json:async()=>payload()};});
 const second=new Card();second.isConnected=true;second.setConfig({...card.config});
 await Promise.all([card.loadForecastIfNeeded(),second.loadForecastIfNeeded()]);
 assert.equal(calls,1);assert.equal(card.status,'ok');assert.equal(card.forecast[0].condition,'clear-night');
 assert.equal(card.forecast[1].condition,'lightning-rainy');assert.equal(card.forecast[0].wind_gust_speed,null);
 assert.equal(card.graphData()[0].windSpeed,2);assert(Number.isNaN(card.graphData()[0].windGust));
 assert.equal(card._weatherState().attributes.humidity,70);
 assert.equal(card.forecastReceivedAt,second.forecastReceivedAt);assert(timers[0].delay>1700000);
 await card.loadForecastIfNeeded();assert.equal(calls,1);
});
test('coordinate validation rejects missing/invalid values and accepts zero',async()=>{
 let calls=0;const {card,context}=setup(async()=>{calls++;return {ok:true,json:async()=>payload()};});
 for(const latitude of [null,'',91,'bad']){card.setConfig({weather_source:'open_meteo',latitude,longitude:13});await card.loadForecastIfNeeded();assert.equal(card.status,'error');}
 assert.equal(calls,0);assert.equal(context.directCoordinates({latitude:0,longitude:0}).latitude,0);
});
test('source swap ignores late direct results and starts normal HA subscription',async()=>{
 let resolve;const {card}=setup(()=>new Promise(r=>resolve=r));const pending=card.loadForecastIfNeeded();
 card.setConfig({entity:'weather.home'});let subscribed=0;
 card.hass={connection:{subscribeMessage:async cb=>{subscribed++;cb({forecast:[{temperature:7}]});return ()=>{};}}};
 await card.loadForecastIfNeeded();resolve({ok:true,json:async()=>payload()});await pending;
 assert.equal(subscribed,1);assert.equal(card.forecast[0].temperature,7);
});
test('failed requests back off and cached errors prevent request storms',async()=>{
 let calls=0;const {card,Card,timers}=setup(async()=>{calls++;throw Error('offline');});
 await card.loadForecastIfNeeded();assert.equal(card.status,'error');assert.equal(timers[0].delay,300000);
 const second=new Card();second.isConnected=true;second.setConfig({...card.config});await second.loadForecastIfNeeded();assert.equal(calls,1);
});
test('coordinate changes and disconnect reject stale responses',async()=>{
 const pending=[];const {card}=setup(()=>new Promise(resolve=>pending.push(resolve)));
 const first=card.loadForecastIfNeeded();card.setConfig({...card.config,latitude:40});
 const next=card.loadForecastIfNeeded();pending[0]({ok:true,json:async()=>payload()});await first;assert.equal(card.forecast.length,0);
 card.isConnected=false;card._stopForecastSubscription();pending[1]({ok:true,json:async()=>payload()});await next;assert.equal(card.forecast.length,0);
});
