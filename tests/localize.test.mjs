import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auroraLocale, weatherLabel, cardinalDirection, translate, textDirection, translations } from '../src/localize.js';
import { sourceForVm } from './source-harness.cjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('Aurora messages: exact/base locale, aliases, missing language and key fallback', () => {
  assert.equal(translate({language:'de-CH'},'searching'),'Suche läuft …');
  assert.equal(translate({language:'no-NO'},'searching'),'Søker …');
  assert.equal(translate({language:'ja'},'searching'),'Searching …');
  assert.equal(translate({},'missing_key'),'missing_key');
  const saved=translations.de.searching;
  try {
    delete translations.de.searching;
    assert.equal(translate({language:'de'},'searching'),'Searching …');
  } finally { translations.de.searching=saved; }
});
test('interpolation preserves values as plain text, including dollar signs and braces', () => {
  assert.equal(translate({language:'en'},'hours_available',{count:24}),'Available forecast hours: 24');
  assert.equal(translate({},'hours_available',{count:'<img>$&{count}'}),'Available forecast hours: <img>$&{count}');
});
test('all shipped dictionaries have complete keys and matching placeholders', () => {
  const keys=Object.keys(translations.en).sort();
  const placeholders=text=>[...text.matchAll(/\{([a-zA-Z_]+)\}/g)].map(m=>m[1]).sort();
  for(const [language,dictionary] of Object.entries(translations)) {
    assert.deepEqual(Object.keys(dictionary).sort(),keys,language);
    for(const key of keys) {
      assert.equal(typeof dictionary[key],'string',language+':'+key);
      assert.ok(dictionary[key].trim(),language+':'+key);
      assert.deepEqual(placeholders(dictionary[key]),placeholders(translations.en[key]),language+':'+key);
    }
  }
  const source=readFileSync(new URL('../src/aurora-weather-card.js',import.meta.url),'utf8');
  for(const [,key] of source.matchAll(/this\._t\('([^']+)'/g))
    assert.ok(Object.hasOwn(translations.en,key),'Untranslated key: '+key);
});
test('text direction uses HA metadata, with regional RTL fallback', () => {
  assert.equal(textDirection({language:'ar-EG'}),'rtl');
  assert.equal(textDirection({language:'he'}),'rtl');
  assert.equal(textDirection({language:'de'}),'ltr');
  assert.equal(textDirection({language:'xx',translationMetadata:{translations:{xx:{isRTL:true}}}}),'rtl');
});

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
  vm.runInNewContext(sourceForVm(),context);
  const card=new classes['aurora-weather-card']();
  const editor=new classes['aurora-weather-card-editor-v1-4-1']();
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
