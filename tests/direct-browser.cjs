const {chromium}=require('playwright');
const fs=require('fs'), http=require('http'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync('dist/aurora-weather-card.js','utf8');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/card.js'?'text/javascript':'text/html');res.end(req.url==='/card.js'?source:'<style>body{font-family:Arial;background:#18212b}</style><script type="module" src="/card.js"></script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1000,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let apiCalls=0;
 await page.route('**/*',route=>{const host=new URL(route.request().url()).hostname;if(host==='api.open-meteo.com'){apiCalls++;return route.continue();}if(host==='127.0.0.1')return route.continue();return route.abort();});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>customElements.get('aurora-weather-card'));
 await page.evaluate(async()=>{
 const card=document.createElement('aurora-weather-card');window.card=card;
 card.hass={language:'nb',themes:{darkMode:true},states:{}};
 card.setConfig({weather_source:'open_meteo',latitude:52.52,longitude:13.41,location_name:'Berlin',time_zone:'Europe/Berlin',color_mode:'dark'});
 document.body.append(card);
 });
 await page.waitForFunction(()=>window.card.status==='ok'||window.card.status==='error',{timeout:25000});
 const state=await page.evaluate(()=>({status:card.status,error:card.errorMessage,points:card.graphData().length,credit:card.shadowRoot.querySelector('.provider-credit')?.textContent}));
 assert.equal(state.status,'ok',JSON.stringify(state));assert.equal(state.points,48);assert.match(state.credit,/Open-Meteo/);assert.equal(apiCalls,1);
 await page.evaluate(async()=>{card.expanded=true;await card.updateComplete;});await page.screenshot({path:'../aurora-direct-berlin.png',animations:'disabled'});
 await page.evaluate(async()=>{
 const editor=await card.constructor.getConfigElement();editor.hass=card.hass;editor.setConfig({...card.config});document.body.append(editor);await editor.updateComplete;
 if(editor.shadowRoot.querySelectorAll('select').length!==1)throw Error('Entity selector shown in direct mode');
 if(!editor.shadowRoot.textContent.includes('Koordinatene sendes'))throw Error('Missing direct disclosure');
 editor.setConfig({entity:'weather.test'});await editor.updateComplete;
 if(editor.shadowRoot.querySelectorAll('select').length!==2)throw Error('Missing entity selector');
 card.remove();
 });
 assert.deepEqual(errors,[]);console.log('PASS live Open-Meteo browser fetch: 48 Berlin hours, CORS, attribution, expanded view, source editor and no JS errors.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
