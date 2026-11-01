import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auroraLocale, weatherLabel, cardinalDirection } from '../src/localize.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('effective HA language takes precedence, regional tags and invalid input', () => {
  assert.equal(auroraLocale({language:'de',locale:{language:'nb'}}),'de');
  assert.equal(auroraLocale({locale:{language:'pt_BR'}}),'pt-BR');
  assert.equal(auroraLocale({language:'zh-Hant'}),'zh-Hant');
  assert.equal(auroraLocale({language:'not_a_valid_locale!'}),'en');
  assert.equal(auroraLocale(), 'en');
});
test('uses HA translations for any language, without a fixed language allowlist', () => {
  for (const language of ['de','fr','ar','he','zh-Hant','ja','sw','uk','nn']) {
    const hass={language,localize:key=>language+':'+key};
    assert.equal(weatherLabel(hass,'temperature'),language+':ui.card.weather.attributes.temperature');
    assert.equal(cardinalDirection(hass,90),language+':ui.card.weather.cardinal_direction.e');
  }
});
test('fallback for absent HA fragments; Norwegian aliases and English fallback', () => {
  for (const localize of [undefined,()=>'',key=>key]) {
    assert.equal(weatherLabel({language:'de',localize},'precipitation'),'Precipitation');
    assert.equal(weatherLabel({language:'nb-NO',localize},'precipitation'),'Nedbør');
    assert.equal(weatherLabel({language:'no',localize},'wind'),'Vind');
  }
  assert.equal(cardinalDirection({language:'nb'},90),'Ø');
  assert.equal(cardinalDirection({},90),'E');
  assert.equal(cardinalDirection({},-90),'W');
  assert.equal(cardinalDirection({},360),'N');
  assert.equal(cardinalDirection({},NaN),'–');
});
test('rendered card and editor update when HA language changes; dates follow locale', () => {
  const classes={};
  const flatten=v=>Array.isArray(v)?v.map(flatten).join(''):v==null||typeof v==='function'?'':String(v);
  const tag=(parts,...values)=>parts.reduce((s,p,i)=>s+p+flatten(values[i]),'');
  const context={LitElement:class {},html:tag,svg:tag,css:tag,nothing:'',window:{},
    customElements:{get:n=>classes[n],define:(n,c)=>classes[n]=c},console,Intl,Date};
  const module=readFileSync(new URL('../src/localize.js',import.meta.url),'utf8').replace(/^export /gm,'');
  const source=readFileSync(new URL('../src/aurora-weather-card.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
  vm.runInNewContext(module+'\n'+source,context);
  const card=new classes['aurora-weather-card']();
  const editor=new classes['aurora-weather-card-editor-v1-3-1']();
  card.setConfig({entity:'weather.test',time_zone:'Europe/Oslo'});
  const date=new Date('2026-11-01T12:00:00Z');
  for(const [language,label] of [['de','Temperatur DE'],['fr','Température FR'],['ar','درجة الحرارة']]) {
    const hass={language,states:{},localize:key=>key.endsWith('.temperature')?label:''};
    card.hass=hass; editor.hass=hass;
    assert.ok(card.render().includes(label));
    assert.ok(editor._renderGraphTab().includes(label));
    assert.equal(card._formatLocalDay(date),new Intl.DateTimeFormat(language,{
      weekday:'short',day:'numeric',month:'short',timeZone:'Europe/Oslo'}).format(date));
  }
});
