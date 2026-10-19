const {chromium}=require('playwright');
const fs=require('node:fs');
const http=require('node:http');
(async()=>{
const source=fs.readFileSync(process.argv[2],'utf8');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/card.js'?'text/javascript':'text/html');res.end(req.url==='/card.js'?source:'<script type="module" src="/card.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage(); const errors=[]; const external=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}return route.continue();});
await page.goto(`http://127.0.0.1:${server.address().port}`);
await page.waitForFunction(()=>customElements.get('aurora-weather-card'));
const result=await page.evaluate(async()=>{
const forecast=Array.from({length:48},(_,i)=>({datetime:new Date(Date.now()+(i+1)*3600000).toISOString(),temperature:10+i%5,precipitation:1,wind_speed:4,wind_gust_speed:8,wind_bearing:90,condition:'sunny'}));
const card=document.createElement('aurora-weather-card');
window.testCard=card;window.updates=[];window.unsubs=0;
card.setConfig({entity:'weather.test',hours:48});
card.hass={states:{'weather.test':{state:'sunny',attributes:{temperature:12,wind_speed_unit:'m/s'}}},callApi:async()=>({'weather.test':{forecast}}),connection:{subscribeMessage:async(cb,msg)=>{window.updates.push(cb);cb({forecast});return ()=>{window.unsubs++};}}};
document.body.append(card); await card.updateComplete;await new Promise(r=>setTimeout(r,100));await card.updateComplete;
return {points:card.graphData().length,rendered:!!card.shadowRoot.querySelector('svg'),text:card.shadowRoot.textContent.length};
});
if(result.points!==48||!result.rendered||external.length||errors.length)throw Error(JSON.stringify({result,external,errors}));
console.log('PASS real browser: self-contained bundle renders 48 forecast points with external network blocked.',result);
if(process.argv.includes('--subscription')) {
const lifecycle=await page.evaluate(async()=>{const card=window.testCard; card.openExpanded(); await card.updateComplete; window.updates[0]({forecast:[{datetime:new Date(Date.now()+3600000).toISOString(),temperature:99}]});await card.updateComplete;const changed=card.forecast[0].temperature===99;card.remove();await Promise.resolve();document.body.append(card);await card.updateComplete;await new Promise(r=>setTimeout(r,30));return {changed,unsubs:window.unsubs,subscriptions:window.updates.length};});
if(!lifecycle.changed||lifecycle.unsubs!==1||lifecycle.subscriptions!==2)throw Error(JSON.stringify(lifecycle));
console.log('PASS real Lit lifecycle: new forecast rendered, disconnect unsubscribed, reattach subscribed.',lifecycle);
}
}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
