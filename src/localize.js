import en from './locales/en.json' with { type: 'json' };
import nb from './locales/nb.json' with { type: 'json' };
import de from './locales/de.json' with { type: 'json' };

export const translations = { en, nb, de };

export function translate(hass, key, values = {}) {
  const locale = auroraLocale(hass).toLowerCase();
  const base = locale.split('-')[0];
  const language = base === 'no' ? 'nb' : base;
  const dictionary = Object.hasOwn(translations, locale) ? translations[locale]
    : Object.hasOwn(translations, language) ? translations[language] : en;
  const value = Object.hasOwn(dictionary, key) ? dictionary[key]
    : Object.hasOwn(en, key) ? en[key] : key;
  // Return plain text. Lit escapes it in both text and attribute contexts.
  return value.replace(/\{([a-zA-Z_]+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match);
}

export function textDirection(hass) {
  const language = auroraLocale(hass);
  const metadata = hass?.translationMetadata?.translations;
  const entry = metadata?.[language] || metadata?.[language.split('-')[0]];
  if (typeof entry?.isRTL === 'boolean') return entry.isRTL ? 'rtl' : 'ltr';
  return /^(ar|fa|he|ur|ps|sd|yi)(-|$)/i.test(language) ? 'rtl' : 'ltr';
}

// Home Assistant supplies the effective user language and translated weather labels.
const WEATHER_LABELS = {
  temperature: ['temperature', 'Temperature', 'Temperatur'],
  precipitation: ['precipitation', 'Precipitation', 'Nedbør'],
  wind: ['wind_speed', 'Wind speed', 'Vind'],
  gust: ['wind_gust_speed', 'Wind gust speed', 'Vindkast'],
  humidity: ['humidity', 'Humidity', 'Luftfuktighet'],
  pressure: ['air_pressure', 'Air pressure', 'Lufttrykk'],
};

export function auroraLocale(hass) {
  const requested = hass?.language || hass?.locale?.language || 'en';
  try {
    return Intl.getCanonicalLocales(String(requested).replaceAll('_', '-'))[0] || 'en';
  } catch {
    return 'en';
  }
}

function haTranslation(hass, key) {
  if (typeof hass?.localize !== 'function') return undefined;
  const value = hass.localize(key);
  // Missing fragments may return an empty value or the key itself.
  return typeof value === 'string' && value.trim() && value !== key ? value : undefined;
}

export function weatherLabel(hass, key) {
  const entry = WEATHER_LABELS[key];
  if (!entry) return key;
  const [attribute, english, norwegian] = entry;
  const translated = haTranslation(hass, 'ui.card.weather.attributes.' + attribute);
  if (translated) return translated;
  return /^(nb|no)(-|$)/i.test(auroraLocale(hass)) ? norwegian : english;
}

export function cardinalDirection(hass, bearing) {
  if (!Number.isFinite(bearing)) return '–';
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  const direction = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][index];
  const translated = haTranslation(hass, 'ui.card.weather.cardinal_direction.' + direction);
  if (translated) return translated;
  return /^(nb|no)(-|$)/i.test(auroraLocale(hass))
    ? ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'][index]
    : direction.toUpperCase();
}

