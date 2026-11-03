const {chromium}=require('playwright');
const fs=require('node:fs');
const http=require('node:http');
(async()=>{
const code=fs.readFileSync('dist/aurora-weather-card-i18n-dev.js','utf8');
const server=http.createServer((req,res)=>{
 res.setHeader('Content-Type',req.url==='/dev.js'?'text/javascript':'text/html');
 res.end(req.url==='/dev.js'?code:'<script>class StableCard extends HTMLElement{};class StableEditor extends HTMLElement{};customElements.define("aurora-weather-card",StableCard);customElements.define("aurora-weather-card-editor-v1-4-1",StableEditor);window.customCards=[{type:"aurora-weather-card",name:"stable"}];window.stableCard=StableCard;window.stableEditor=StableEditor;</script><script type="module" src="/dev.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>customElements.get('aurora-weather-card-i18n-dev'));
 const result=await page.evaluate(async()=>{
 const C=customElements.get('aurora-weather-card-i18n-dev');
 const editor=await C.getConfigElement();
 editor.hass={language:'de',states:{}};editor.setConfig({});document.body.append(editor);await editor.updateComplete;
 return {
 stable:customElements.get('aurora-weather-card')===window.stableCard,
 stableEditor:customElements.get('aurora-weather-card-editor-v1-4-1')===window.stableEditor,
 metadata:window.customCards[0].name,
 entries:window.customCards.map(c=>c.type),
 editor:editor.localName,translated:editor.shadowRoot.textContent.includes('Einstellungen')
 };});
 if(!result.stable||!result.stableEditor||result.metadata!=='stable'||result.entries.length!==2||!result.translated||result.editor!=='aurora-weather-card-i18n-dev-editor'||errors.length)throw Error(JSON.stringify({result,errors}));
 console.log('PASS isolated dev card coexists with stable card and editor; German editor renders.');
}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
