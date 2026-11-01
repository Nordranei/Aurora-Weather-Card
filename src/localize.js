// Home Assistant supplies the effective user language and translated weather labels.
// Aurora-specific messages will be added in subsequent translation steps.
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

