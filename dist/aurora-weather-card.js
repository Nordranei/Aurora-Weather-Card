// Aurora Weather Card v1.3.0 — baseline: v1.3-dev-step9b
import { LitElement, css, html, nothing, svg } from 'https://cdn.jsdelivr.net/npm/lit@3.2.1/+esm';

function isObject(value) {
  return typeof value === 'object' && value !== null;
}

function extractForecast(raw, entityId) {
  const candidates = [raw];
  if (isObject(raw)) {
    candidates.push(raw.service_response, raw.response, raw[entityId]);
    if (isObject(raw.service_response)) candidates.push(raw.service_response[entityId]);
    if (isObject(raw.response)) candidates.push(raw.response[entityId]);
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (isObject(candidate) && Array.isArray(candidate.forecast)) return candidate.forecast;
    if (isObject(candidate) && isObject(candidate[entityId])) {
      const block = candidate[entityId];
      if (isObject(block) && Array.isArray(block.forecast)) return block.forecast;
    }
  }
  throw new Error('Home Assistant svarte, men forecast-listen ble ikke funnet.');
}

async function fetchHourlyForecast(hass, entityId) {
  const raw = await hass.callApi(
    'POST',
    'services/weather/get_forecasts?return_response',
    { entity_id: entityId, type: 'hourly' },
  );
  return extractForecast(raw, entityId);
}

function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function weatherIconSvg(condition) {
  const c = String(condition || 'cloudy').toLowerCase();

  const cloud = (x = 7, y = 10, dark = false) => svg`
    <g transform="translate(${x} ${y})">
      <path
        d="M8 19h28c6 0 10-3.6 10-8.2C46 6.4 42.4 3 37.7 3c-1.6 0-3.2.4-4.5 1.2C30.8.9 27 .1 23.8 1.1c-4.3 1.3-7.1 5-7.2 9.1C11 9.4 6 12.7 6 16.2 6 17.3 6.8 18.4 8 19z"
        fill="${dark ? '#a8bac7' : '#dce8f1'}"
        stroke="#f8fcff"
        stroke-opacity=".65"
        stroke-width=".8">
      </path>
      <path d="M11 15.7h29" stroke="#ffffff" stroke-opacity=".34" stroke-width="1.2" stroke-linecap="round"></path>
      <ellipse cx="25" cy="7" rx="10" ry="3.5" fill="#ffffff" fill-opacity=".16"></ellipse>
    </g>
  `;

  const sun = (x = 19, y = 7) => svg`
    <g transform="translate(${x} ${y})">
      <g stroke="#ffd84a" stroke-width="2" stroke-linecap="round">
        <path d="M10 0v4M10 20v4M0 10h4M20 10h4M3 3l3 3M17 17l3 3M17 3l-3 3M3 17l3-3"></path>
      </g>
      <circle cx="10" cy="10" r="6.6" fill="#ffc928" stroke="#fff1a3" stroke-width=".8"></circle>
      <ellipse cx="8" cy="7.2" rx="2.4" ry="1.5" fill="#ffffff" fill-opacity=".55"></ellipse>
    </g>
  `;

  const moon = () => svg`
    <g transform="translate(11 5)">
      <path
        d="M18 3c-6 2-9 8-7 14 2 6 8 9 14 7-3 5-10 7-16 4C2 25-1 17 2 10 5 4 12 1 18 3z"
        fill="#c9c8ff"
        stroke="#f7f4ff"
        stroke-width=".9">
      </path>
      <ellipse cx="9" cy="8" rx="3" ry="1.5" fill="#ffffff" fill-opacity=".28"></ellipse>
      <circle cx="24" cy="5" r="1.4" fill="#ffffff"></circle>
      <circle cx="29" cy="10" r=".9" fill="#dce6ff"></circle>
    </g>
  `;

  const rain = (heavy = false) => svg`
    <g stroke="#35b8ff" stroke-width="${heavy ? 3 : 2.4}" stroke-linecap="round">
      <path d="M22 36l-3 7M33 36l-3 7M44 36l-3 7"></path>
      ${heavy ? svg`<path d="M53 35l-3 8M12 35l-3 8"></path>` : nothing}
    </g>
  `;

  const snow = () => svg`
    <g fill="#f7fcff" stroke="#84d5ff" stroke-width=".8">
      <circle cx="21" cy="40" r="2.3"></circle>
      <circle cx="33" cy="42" r="2.3"></circle>
      <circle cx="45" cy="39" r="2.3"></circle>
    </g>
  `;

  const fog = () => svg`
    ${cloud(7, 5)}
    <g stroke="#c7d8e3" stroke-width="2.4" stroke-linecap="round" opacity=".94">
      <path d="M12 34h39"></path>
      <path d="M17 40h34"></path>
      <path d="M10 46h31"></path>
    </g>
  `;

  const lightning = () => svg`
    <path
      d="M35 30h9l-6 9h6L31 48l4-11h-6z"
      fill="#ffd400"
      stroke="#fff2a3"
      stroke-width=".9"
      stroke-linejoin="round">
    </path>
  `;

  const hail = () => svg`
    <g fill="#dff6ff" stroke="#75cfff" stroke-width=".9">
      <circle cx="20" cy="40" r="2.7"></circle>
      <circle cx="33" cy="43" r="2.7"></circle>
      <circle cx="46" cy="39" r="2.7"></circle>
    </g>
  `;

  const wind = () => svg`
    <g fill="none" stroke="#c9e7f4" stroke-width="2.5" stroke-linecap="round">
      <path d="M8 17h31c7 0 7-8 1-8-4 0-5 3-5 4"></path>
      <path d="M5 27h40c8 0 8 9 1 9-4 0-6-3-6-5"></path>
      <path d="M13 37h20"></path>
    </g>
  `;

  switch (c) {
    case 'sunny': return sun();
    case 'clear-night': return moon();
    case 'partlycloudy': return svg`${sun(4, 2)}${cloud(10, 14)}`;
    case 'cloudy': return cloud();
    case 'fog': return fog();
    case 'rainy': return svg`${cloud(7, 3, true)}${rain(false)}`;
    case 'pouring': return svg`${cloud(7, 3, true)}${rain(true)}`;
    case 'lightning': return svg`${cloud(7, 3, true)}${lightning()}`;
    case 'lightning-rainy': return svg`${cloud(7, 1, true)}${rain(false)}${lightning()}`;
    case 'hail': return svg`${cloud(7, 2, true)}${hail()}`;
    case 'snowy': return svg`${cloud(7, 1)}${snow()}`;
    case 'snowy-rainy': return svg`${cloud(7, 0, true)}${rain(false)}${snow()}`;
    case 'windy':
    case 'windy-variant': return wind();
    case 'exceptional': return svg`
      ${cloud(7, 7, true)}
      <text x="50" y="16" font-size="15" font-weight="800" fill="#ffd84a">!</text>
    `;
    default:
      console.warn(`[Aurora Weather Card] Unknown weather condition: ${c}`);
      return cloud();
  }
}


function windToMs(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;
  const u = String(unit || 'm/s').trim().toLowerCase();
  if (u === 'm/s' || u === 'mps' || u === 'ms') return v;
  if (u === 'km/h' || u === 'kmh' || u === 'kph') return v / 3.6;
  if (u === 'mph') return v * 0.44704;
  if (u === 'kn' || u === 'kt' || u === 'kts' || u === 'knot' || u === 'knots') return v * 0.514444;
  if (u === 'ft/s' || u === 'fps') return v * 0.3048;
  // Beaufort is a scale, not a linear unit. Convert each integer force
  // to the midpoint of its standard m/s interval (12 = hurricane force).
  if (u === 'beaufort' || u === 'bft') {
    const b = Math.max(0, Math.min(12, Math.round(v)));
    const ranges = [
      [0,0.2],[0.3,1.5],[1.6,3.3],[3.4,5.4],[5.5,7.9],[8.0,10.7],
      [10.8,13.8],[13.9,17.1],[17.2,20.7],[20.8,24.4],[24.5,28.4],
      [28.5,32.6],[32.7,36.9],
    ];
    return (ranges[b][0] + ranges[b][1]) / 2;
  }
  console.warn(`[Aurora Weather Card] Unknown wind speed unit "${unit}"; assuming m/s.`);
  return v;
}




function solarEventUtc(date, latitude, longitude, sunrise = true) {
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  const lngHour = lon / 15;
  const t = day + (((sunrise ? 6 : 18) - lngHour) / 24);
  const M = (0.9856 * t) - 3.289;
  let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
  L = (L + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) * deg;
  RA = (RA + 360) % 360;
  RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
  const sinDec = 0.39782 * Math.sin(L * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return null;
  let H = sunrise ? 360 - Math.acos(cosH) * deg : Math.acos(cosH) * deg;
  H /= 15;
  let utcHour = H + RA - 0.06571 * t - 6.622 - lngHour;
  utcHour = (utcHour + 24) % 24;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + utcHour * 3600000);
}

function formatInTimeZone(date, timeZone) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '–';
  try {
    return new Intl.DateTimeFormat('nb-NO', { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:timeZone || undefined }).format(date);
  } catch (_) { return date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); }
}

function hourInTimeZone(date, timeZone) {
  try {
    const v = new Intl.DateTimeFormat('en-GB', { hour:'2-digit', hour12:false, timeZone:timeZone || undefined })
      .formatToParts(date).find(p => p.type === 'hour')?.value;
    const n = Number(v); return Number.isFinite(n) ? n % 24 : date.getHours();
  } catch (_) { return date.getHours(); }
}


class AuroraWeatherCardEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { state: true },
    activeTab: { state: true },
    diagnostic: { state: true },
    geocodingDiagnostic: { state: true },
  };

  constructor() {
    super();
    this.config = {};
    this.activeTab = 'config';
    this.diagnostic = null;
    this.geocodingDiagnostic = null;
    this._geocodeDebounceTimer = undefined;
  }

  setConfig(config) {
    this.config = { ...config };
  }

  _emitConfig(config) {
    this.config = config;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config },
      bubbles: true,
      composed: true,
    }));
  }

  _setValue(key, value) {
    this._emitConfig({ ...this.config, [key]: value });
  }

  _renderTabs() {
    const tabs = [
      ['config', 'CONFIG'],
      ['appearance', 'APPEARANCE'],
      ['graph', 'GRAPH'],
      ['advanced', 'ADVANCED'],
    ];
    return html`
      <div class="editor-tabs">
        ${tabs.map(([id, label]) => html`
          <button
            type="button"
            class="editor-tab ${this.activeTab === id ? 'active' : ''}"
            @click=${() => { this.activeTab = id; }}
          >${label}</button>
        `)}
      </div>
    `;
  }

  _renderConfigTab() {
    const entities = Object.values(this.hass?.states || {})
      .filter((state) => state.entity_id?.startsWith('weather.'))
      .sort((a, b) => {
        const an = a.attributes?.friendly_name || a.entity_id;
        const bn = b.attributes?.friendly_name || b.entity_id;
        return an.localeCompare(bn, 'nb');
      });

    return html`
      <section class="editor-section">
        <h3>VÆRKILDE</h3>
        <label class="field-label">Velg vær-entitet</label>
        <select
          class="editor-input"
          .value=${this.config?.entity || ''}
          @change=${(event) => this._setValue('entity', event.target.value)}
        >
          <option value="">Velg vær-entitet</option>
          ${entities.map((state) => html`
            <option
              value=${state.entity_id}
              ?selected=${state.entity_id === this.config?.entity}
            >${state.attributes?.friendly_name || state.entity_id}</option>
          `)}
        </select>
        <div class="helper">Bruk entiteten fra din værintegrasjon. MET Norway anbefales.</div>
      </section>

      <section class="editor-section">
        <h3>STED</h3>
        <label class="field-label">Stedsnavn *</label>
        <div class="location-search-row">
          <input
            class="editor-input"
            type="text"
            .value=${this.config?.location_name || ''}
            @input=${this._onLocationNameInput}
          />
          <button
            class="location-search-button"
            type="button"
            title="Søk etter sted"
            aria-label="Søk etter sted"
            @click=${this._runGeocodingDiagnostic}
          >⌕</button>
        </div>
        <div class="helper">Påkrevd. Skriv det geografiske stedsnavnet. Aurora søker automatisk mens du skriver; søkeikonet kan brukes manuelt ved behov.</div>

        ${this.geocodingDiagnostic?.loading ? html`
          <div class="location-search-status">Søker …</div>
        ` : this.geocodingDiagnostic?.error ? html`
          <div class="location-search-status error">${this.geocodingDiagnostic.error}</div>
        ` : this.geocodingDiagnostic?.count > 1 ? html`
          <div class="location-picker">
            <div class="location-picker-title">VELG RIKTIG STED</div>
            ${(this.geocodingDiagnostic.results || []).map((r) => html`
              <button type="button" @click=${() => this._selectGeocodingResult(r)}>
                <b>${[r.name, r.admin1, r.country].filter(Boolean).join(', ')}</b>
                <small>${r.latitude}, ${r.longitude} · ${r.timezone || 'ukjent tidssone'}</small>
              </button>
            `)}
          </div>
        ` : this.geocodingDiagnostic && this.geocodingDiagnostic.count === 0 ? html`
          <div class="location-search-status error">Ingen treff. Kontroller Stedsnavn og søk igjen.</div>
        ` : nothing}
        ${this.config?.geocoded_location ? html`
          <div class="resolved-location">
            <b>AUTOMATISK LOKASJON</b>
            <span>${this.config.geocoded_location}</span>
            <small>${this.config.latitude}, ${this.config.longitude} · ${this.config.time_zone || 'ukjent tidssone'}</small>
          </div>
        ` : nothing}
      </section>
    `;
  }

  _renderAppearanceTab() {
    const theme = this.config?.theme || 'aurora_dynamic';
    const themes = [
      ['aurora_dynamic', 'Aurora Dynamic', 'Levende dag/natt'],
      ['aurora_static', 'Aurora Static', 'Fast Aurora-look'],
    ];
    return html`
      <section class="editor-section">
        <h3>TEMA</h3>
        <div class="theme-grid">
          ${themes.map(([value, title, subtitle]) => html`
            <button
              type="button"
              class="theme-card ${theme === value ? 'selected' : ''}"
              @click=${() => this._setValue('theme', value)}
            >
              <span class="theme-orb"></span>
              <span class="theme-copy">
                <b>${title}</b>
                <small>${subtitle}</small>
              </span>
            </button>
          `)}
        </div>
      </section>

      <section class="editor-section">
        <h3>ATMOSFÆRE</h3>
        <div class="editor-info">
          Aurora Dynamic bruker værforhold, årstid, lokal tid og lokale soltider.
        </div>
      </section>
    `;
  }

  _renderGraphTab() {
    const hours = Number(this.config?.hours) || 48;
    return html`
      <section class="editor-section">
        <h3>TIMER</h3>
        <label class="field-label">Antall timer</label>
        <div class="segmented">
          ${[24, 48].map((value) => html`
            <button
              type="button"
              class="${hours === value ? 'active' : ''}"
              @click=${() => this._setValue('hours', value)}
            >${value}</button>
          `)}
        </div>
      </section>

      <section class="editor-section">
        <h3>VIS I GRAFEN</h3>
        ${[
          ['show_temperature', 'Temperatur'],
          ['show_precipitation', 'Nedbør'],
          ['show_wind', 'Vind'],
          ['show_wind_gust', 'Vindkast'],
          ['show_wind_direction', 'Vindretning'],
          ['show_weather_icons', 'Værikoner'],
        ].map(([key, label]) => html`
          <label class="graph-toggle">
            <span>${label}</span>
            <input type="checkbox" role="switch"
              .checked=${this.config?.[key] !== false}
              @change=${(event) => this._setValue(key, event.target.checked)} />
          </label>
        `)}
        <div class="editor-info">
          Slå grafserier, vindretning og værikoner av eller på. Legendeteksten følger grafseriene.
        </div>
      </section>
    `;
  }

  async _runLocationDiagnostic() {
    const entityId = this.config?.entity;
    const state = this.hass?.states?.[entityId];
    const attrs = state?.attributes || {};
    const result = {
      entity: entityId || '–',
      platform: 'unknown',
      configEntry: 'not exposed',
      latitude: attrs.latitude ?? attrs.lat ?? attrs.location?.latitude ?? attrs.location?.lat ?? 'not exposed',
      longitude: attrs.longitude ?? attrs.lon ?? attrs.lng ?? attrs.location?.longitude ?? attrs.location?.lon ?? attrs.location?.lng ?? 'not exposed',
      timeZone: attrs.time_zone ?? attrs.timezone ?? attrs.location?.time_zone ?? attrs.location?.timezone ?? 'not exposed',
      source: 'weather state attributes',
    };

    try {
      if (entityId && this.hass?.callWS) {
        const registry = await this.hass.callWS({ type: 'config/entity_registry/get', entity_id: entityId });
        if (registry) {
          result.platform = registry.platform || registry.integration || 'unknown';
          result.configEntry = registry.config_entry_id || 'not exposed';
          result.deviceId = registry.device_id || '–';
          result.areaId = registry.area_id || '–';
          result.source = 'entity registry + weather state attributes';

          if (registry.config_entry_id) {
            try {
              const response = await this.hass.callWS({
                type: 'config_entries/get_single',
                entry_id: registry.config_entry_id,
              });
              const entry = response?.config_entry || response || {};
              result.entryDomain = entry.domain || 'not exposed';
              result.entryTitle = entry.title || 'not exposed';
              result.entryState = entry.state || 'not exposed';
              result.entrySource = entry.source || 'not exposed';
              result.entryHasData = Object.prototype.hasOwnProperty.call(entry, 'data') ? 'YES' : 'NO';
              result.entryHasOptions = Object.prototype.hasOwnProperty.call(entry, 'options') ? 'YES' : 'NO';

              const entryData = entry.data || {};
              const entryOptions = entry.options || {};
              const pick = (...values) => values.find((v) => v !== undefined && v !== null && v !== '');

              result.entryLatitude = pick(
                entryData.latitude, entryData.lat,
                entryOptions.latitude, entryOptions.lat,
              ) ?? 'not exposed';
              result.entryLongitude = pick(
                entryData.longitude, entryData.lon, entryData.lng,
                entryOptions.longitude, entryOptions.lon, entryOptions.lng,
              ) ?? 'not exposed';
              result.entryTimeZone = pick(
                entryData.time_zone, entryData.timezone,
                entryOptions.time_zone, entryOptions.timezone,
              ) ?? 'not exposed';
            } catch (error) {
              result.configEntryError = error?.message || String(error);
            }
          }
        }
      }
    } catch (error) {
      result.registryError = error?.message || String(error);
    }

    this.diagnostic = result;
  }

  _cleanPlaceName(value) {
    let name = String(value || '').trim();
    // Strip known Home Assistant/MET Norwegian prefixes explicitly.
    // Avoid clever regex here: "Værvarsel" must remain Unicode-safe.
    const lower = name.toLocaleLowerCase('nb-NO');
    if (lower.startsWith('værvarsel ')) {
      name = name.slice('Værvarsel '.length).trim();
    } else if (lower.startsWith('værvasel ')) {
      name = name.slice('Værvasel '.length).trim();
    } else if (lower.startsWith('vær ')) {
      name = name.slice('Vær '.length).trim();
    }
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length % 2 === 0) {
      const half = words.length / 2;
      const a = words.slice(0, half).join(' ');
      const b = words.slice(half).join(' ');
      if (a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0) name = a;
    }
    return name;
  }

  _onLocationNameInput(event) {
    const value = event.target.value;
    this._setValue('location_name', value);

    if (this._geocodeDebounceTimer) clearTimeout(this._geocodeDebounceTimer);
    this.geocodingDiagnostic = null;

    const place = String(value || '').trim();
    if (place.length < 3) {
      this.requestUpdate();
      return;
    }

    this._geocodeDebounceTimer = window.setTimeout(() => {
      this._runGeocodingDiagnostic();
    }, 650);
  }

  async _runGeocodingDiagnostic() {
    const place = String(this.config?.location_name || '').trim();

    if (!place) {
      this.geocodingDiagnostic = {
        error: 'Stedsnavn må fylles ut før Aurora kan søke etter lokasjonen.'
      };
      this.requestUpdate();
      return;
    }

    this.geocodingDiagnostic = { loading: true, query: place };
    this.requestUpdate();

    try {
      const url =
        'https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(place) +
        '&count=10&language=en&format=json';

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const results = Array.isArray(payload?.results) ? payload.results : [];

      const mappedResults = results.map((r) => ({
        name: r.name,
        admin1: r.admin1 || '',
        country: r.country || '',
        countryCode: r.country_code || '',
        latitude: r.latitude,
        longitude: r.longitude,
        elevation: r.elevation,
        timezone: r.timezone || '',
        population: r.population,
      }));

      this.geocodingDiagnostic = {
        query: place,
        count: mappedResults.length,
        results: mappedResults,
      };

      if (mappedResults.length === 1) {
        this._selectGeocodingResult(mappedResults[0]);
      }
    } catch (error) {
      this.geocodingDiagnostic = {
        query: place,
        error: error?.message || String(error),
      };
    }
    this.requestUpdate();
  }

  _selectGeocodingResult(result) {
    if (!result) return;
    const locationLabel = [result.name, result.admin1, result.country].filter(Boolean).join(', ');
    const config = {
      ...this.config,
      location_name: result.name || this.config?.location_name,
      latitude: Number(result.latitude),
      longitude: Number(result.longitude),
      time_zone: result.timezone || this.config?.time_zone,
      geocoded_location: locationLabel,
    };
    this._emitConfig(config);
    this.geocodingDiagnostic = {
      ...(this.geocodingDiagnostic || {}),
      selected: {
        name: result.name,
        admin1: result.admin1,
        country: result.country,
        latitude: result.latitude,
        longitude: result.longitude,
        timezone: result.timezone,
      },
    };
  }

  _renderAdvancedTab() {
    const hasLocation =
      Number.isFinite(Number(this.config?.latitude)) &&
      Number.isFinite(Number(this.config?.longitude));

    return html`
      <section class="editor-section">
        <h3>LOKAL TID & SOL</h3>

        <div class="editor-info advanced-info">
          Aurora bruker valgt lokasjon fra CONFIG til lokal tid, soloppgang, solnedgang og dag/natt.
          Feltene under er manuell fallback hvis automatisk lokasjon må overstyres.
        </div>

        ${hasLocation ? html`
          <div class="advanced-status">
            <b>AKTIV LOKASJON</b>
            <span>${this.config?.geocoded_location || this.config?.location_name || 'Valgt sted'}</span>
            <small>
              ${this.config?.latitude}, ${this.config?.longitude}
              ${this.config?.time_zone ? ` · ${this.config.time_zone}` : ''}
            </small>
          </div>
        ` : html`
          <div class="advanced-status muted">
            <b>INGEN LOKASJON LAGRET</b>
            <span>Gå til CONFIG og søk etter Stedsnavn.</span>
          </div>
        `}

        <div class="advanced-divider"></div>

        <h3>MANUELL FALLBACK</h3>

        <label class="field-label">Breddegrad</label>
        <input
          class="editor-input"
          type="number"
          step="0.0001"
          .value=${this.config?.latitude ?? ''}
          @change=${(event) => this._setValue(
            'latitude',
            event.target.value === '' ? undefined : Number(event.target.value),
          )}
        />

        <label class="field-label field-gap">Lengdegrad</label>
        <input
          class="editor-input"
          type="number"
          step="0.0001"
          .value=${this.config?.longitude ?? ''}
          @change=${(event) => this._setValue(
            'longitude',
            event.target.value === '' ? undefined : Number(event.target.value),
          )}
        />

        <label class="field-label field-gap">Tidssone</label>
        <input
          class="editor-input"
          type="text"
          placeholder="Europe/Oslo"
          .value=${this.config?.time_zone || ''}
          @change=${(event) => this._setValue('time_zone', event.target.value)}
        />

        <div class="helper">
          Normalt trenger du ikke endre disse feltene. Bruk dem bare hvis automatisk lokasjon er feil eller utilgjengelig.
        </div>
      </section>
    `;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._geocodeDebounceTimer) clearTimeout(this._geocodeDebounceTimer);
    this._geocodeDebounceTimer = undefined;
  }

  render() {
    return html`
      <div class="editor-shell">
        <div class="editor-header">
          <span class="editor-logo">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <radialGradient id="ebg" cx="58%" cy="34%" r="72%">
                  <stop offset="0" stop-color="#0c7896"/>
                  <stop offset=".5" stop-color="#063a62"/>
                  <stop offset="1" stop-color="#07102a"/>
                </radialGradient>
                <linearGradient id="era" x1="10%" y1="90%" x2="80%" y2="10%">
                  <stop offset="0" stop-color="#5838ff"/>
                  <stop offset=".3" stop-color="#1aa8ff"/>
                  <stop offset=".58" stop-color="#39f0d0"/>
                  <stop offset="1" stop-color="#87ffd6"/>
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="44" fill="url(#ebg)" stroke="#18bfe9" stroke-width="1.4"/>
              <path d="M18 72C31 58 29 40 42 24C36 45 48 53 52 66C58 51 69 42 79 23C76 46 83 59 70 76C58 90 34 91 18 72Z" fill="url(#era)" opacity=".92"/>
            </svg>
          </span>
          <div>
            <div class="editor-title">Aurora Weather Card Configuration</div>
            <div class="editor-version">v1.3.0</div>
          </div>
        </div>

        ${this._renderTabs()}

        <div class="editor-body">
          ${this.activeTab === 'config' ? this._renderConfigTab() : nothing}
          ${this.activeTab === 'appearance' ? this._renderAppearanceTab() : nothing}
          ${this.activeTab === 'graph' ? this._renderGraphTab() : nothing}
          ${this.activeTab === 'advanced' ? this._renderAdvancedTab() : nothing}
        </div>
      </div>
    `;
  }

  static styles = css`
    .graph-toggle { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 0; cursor:pointer; }
    .graph-toggle input { width:38px; height:22px; margin:0; accent-color:var(--primary-color, #2aa8ff); cursor:pointer; }

    :host {
      display: block;
      color: #eef7ff;
    }

    .editor-shell {
      overflow: hidden;
      border-radius: 16px;
      border: 1px solid rgba(49, 175, 241, .34);
      background:
        radial-gradient(100% 70% at 100% 0%, rgba(20, 91, 142, .15), transparent 56%),
        linear-gradient(180deg, #091725, #07111d);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.04),
        0 14px 34px rgba(0,0,0,.26);
    }

    .editor-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px 11px;
    }

    .editor-logo {
      width: 32px;
      height: 32px;
      flex: 0 0 32px;
      filter: drop-shadow(0 0 8px rgba(45, 216, 255, .42));
    }

    .editor-logo svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .editor-title {
      font-size: 14px;
      font-weight: 780;
      line-height: 1.15;
    }

    .editor-version {
      margin-top: 2px;
      color: #49daf6;
      font-size: 10px;
      font-weight: 700;
    }

    .editor-tabs {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      border-top: 1px solid rgba(255,255,255,.035);
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .editor-tab {
      appearance: none;
      border: 0;
      border-bottom: 2px solid transparent;
      padding: 11px 3px 10px;
      background: transparent;
      color: #9babb9;
      font-size: 9.5px;
      font-weight: 800;
      cursor: pointer;
    }

    .editor-tab.active {
      color: #36dbff;
      border-bottom-color: #1acfff;
      background: rgba(27, 196, 255, .035);
    }

    .editor-body {
      min-height: 285px;
      padding: 14px 15px 18px;
    }

    .editor-section + .editor-section {
      margin-top: 19px;
    }

    h3 {
      margin: 0 0 10px;
      color: #2ddcff;
      font-size: 10.5px;
      font-weight: 850;
      letter-spacing: .055em;
    }

    .field-label {
      display: block;
      margin-bottom: 6px;
      color: #dbe7f0;
      font-size: 11px;
      font-weight: 650;
    }

    .field-gap {
      margin-top: 12px;
    }

    .editor-input {
      width: 100%;
      box-sizing: border-box;
      min-height: 39px;
      padding: 9px 10px;
      border: 1px solid rgba(119, 174, 211, .20);
      border-radius: 8px;
      outline: none;
      background: rgba(10, 27, 42, .92);
      color: #eff8ff;
      font: inherit;
    }

    .editor-input:focus {
      border-color: #1dcbf6;
      box-shadow: 0 0 0 2px rgba(29, 203, 246, .09);
    }

    .helper {
      margin-top: 5px;
      color: #8597a8;
      font-size: 9.5px;
      line-height: 1.4;
    }

    .editor-info {
      padding: 10px 11px;
      border: 1px solid rgba(61, 155, 207, .19);
      border-radius: 9px;
      background: rgba(17, 47, 68, .46);
      color: #a9bbc9;
      font-size: 10.5px;
      line-height: 1.45;
    }

    .theme-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 9px;
    }

    .theme-card {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
      padding: 10px;
      border: 1px solid rgba(120,170,210,.18);
      border-radius: 10px;
      background: rgba(9,25,39,.88);
      color: #eef7ff;
      text-align: left;
      cursor: pointer;
    }

    .theme-card.selected {
      border-color: #24d6ff;
      box-shadow:
        inset 0 0 0 1px rgba(36,214,255,.18),
        0 0 14px rgba(21,177,255,.12);
    }

    .theme-orb {
      width: 31px;
      height: 31px;
      flex: 0 0 31px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 62% 24%, #68ffe6 0 10%, #12a7d5 35%, #3030c4 70%, #06132a 100%);
      box-shadow: 0 0 12px rgba(30, 211, 255, .38);
    }

    .theme-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .theme-copy b {
      font-size: 11px;
    }

    .theme-copy small {
      margin-top: 2px;
      color: #8293a4;
      font-size: 8.5px;
    }

    .segmented {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      overflow: hidden;
      border: 1px solid rgba(117, 170, 210, .19);
      border-radius: 9px;
      background: rgba(8, 24, 38, .9);
    }

    .segmented button {
      appearance: none;
      border: 0;
      padding: 10px;
      background: transparent;
      color: #aab9c7;
      font-weight: 750;
      cursor: pointer;
    }

    .segmented button.active {
      color: #fff;
      background: linear-gradient(180deg, rgba(12,101,220,.72), rgba(8,64,157,.72));
      box-shadow: inset 0 0 0 1px rgba(41,162,255,.35);
    }

    .diagnostic-box {
      margin-top: 18px;
      padding: 11px;
      border: 1px solid rgba(48, 207, 255, .22);
      border-radius: 10px;
      background: rgba(4, 18, 31, .72);
    }
    .diagnostic-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .diagnostic-head b {
      display: block;
      color: #34dcff;
      font-size: 10px;
      letter-spacing: .05em;
    }
    .diagnostic-head small {
      display: block;
      margin-top: 2px;
      color: #7f92a4;
      font-size: 8.5px;
    }
    .diagnostic-head button {
      border: 1px solid rgba(35, 211, 255, .45);
      border-radius: 7px;
      padding: 7px 9px;
      background: rgba(0, 133, 194, .18);
      color: #5de5ff;
      font-size: 9px;
      font-weight: 800;
      cursor: pointer;
    }
    .diagnostic-grid {
      display: grid;
      grid-template-columns: 105px minmax(0, 1fr);
      gap: 6px 9px;
      margin-top: 11px;
      font-size: 9px;
    }
    .diagnostic-grid span { color: #8194a6; }
    .diagnostic-grid code {
      overflow-wrap: anywhere;
      color: #d9f5ff;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .diagnostic-empty {
      margin-top: 10px;
      color: #7f92a4;
      font-size: 9px;
    }

    .geo-box { margin-top: 10px; }
    .geo-results {
      display: grid;
      gap: 7px;
      margin-top: 10px;
    }
    .location-search-row {
      display:flex;
      align-items:stretch;
      gap:6px;
    }
    .location-search-row .editor-input { flex:1; min-width:0; }
    .location-search-button {
      width:42px;
      flex:0 0 42px;
      border:1px solid #1784a8;
      border-radius:8px;
      background:rgba(0,174,230,.10);
      color:#42ddff;
      cursor:pointer;
      font-size:22px;
      line-height:1;
    }
    .location-search-button:hover { background:rgba(0,174,230,.20); }
    .location-search-status {
      margin-top:8px;
      padding:8px 9px;
      border-radius:8px;
      background:rgba(7,43,60,.55);
      color:#a9c9d8;
      font-size:9px;
    }
    .location-search-status.error { color:#ffc1c1; }
    .location-picker {
      display:grid;
      gap:5px;
      margin-top:9px;
    }
    .location-picker-title {
      color:#35dcff;
      font-size:9px;
      font-weight:800;
    }
    .location-picker button {
      width:100%;
      padding:8px 9px;
      text-align:left;
      border:1px solid rgba(44,210,255,.20);
      border-radius:8px;
      background:rgba(7,43,60,.55);
      color:#e7f8ff;
      cursor:pointer;
    }
    .location-picker button:hover { border-color:#35dcff; }
    .location-picker b,.location-picker small { display:block; }
    .location-picker b { font-size:10px; }
    .location-picker small { margin-top:3px; color:#89a6b7; font-size:8.5px; }

    .resolved-location {
      margin-top: 12px;
      padding: 9px 10px;
      border: 1px solid rgba(44, 210, 255, .22);
      border-radius: 9px;
      background: rgba(7, 43, 60, .55);
    }
    .resolved-location b { display:block; color:#35dcff; font-size:9px; }
    .resolved-location span { display:block; margin-top:4px; color:#e7f8ff; font-size:11px; font-weight:700; }
    .resolved-location small { display:block; margin-top:3px; color:#89a6b7; font-size:8.5px; }

    .geo-result {
      width: 100%;
      padding: 8px 9px;
      text-align: left;
      cursor: pointer;
      border: 1px solid rgba(107, 170, 205, .14);
      border-radius: 8px;
      background: rgba(12, 31, 46, .62);
    }
    .geo-result.selected {
      border-color: #28d8ff;
      box-shadow: inset 0 0 0 1px rgba(40,216,255,.16);
      background: rgba(8, 58, 76, .72);
    }
    .geo-title {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: #dff8ff;
      font-size: 9.5px;
      font-weight: 750;
    }
    .choose {
      color: #4be4ff;
      font-size: 8px;
      font-weight: 900;
    }
    .geo-values {
      display: flex;
      flex-wrap: wrap;
      gap: 5px 10px;
      margin-top: 4px;
    }
    .geo-values code {
      color: #8edff1;
      font-size: 8.5px;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    }

    .advanced-info {
      margin-bottom: 12px;
    }
    .advanced-status {
      margin-top: 10px;
      padding: 10px 11px;
      border: 1px solid rgba(44,210,255,.22);
      border-radius: 9px;
      background: rgba(7,43,60,.55);
    }
    .advanced-status b {
      display: block;
      color: #35dcff;
      font-size: 9px;
      letter-spacing: .04em;
    }
    .advanced-status span {
      display: block;
      margin-top: 4px;
      color: #e7f8ff;
      font-size: 11px;
      font-weight: 700;
    }
    .advanced-status small {
      display: block;
      margin-top: 3px;
      color: #89a6b7;
      font-size: 8.5px;
    }
    .advanced-status.muted {
      border-color: rgba(120,170,210,.16);
      background: rgba(12,31,46,.46);
    }
    .advanced-status.muted b { color: #93a7b6; }
    .advanced-status.muted span { color: #aebdca; font-weight: 600; }
    .advanced-divider {
      height: 1px;
      margin: 17px 0;
      background: linear-gradient(90deg, transparent, rgba(68,191,238,.22), transparent);
    }

    @media (max-width: 520px) {
      .editor-tab { font-size: 8.5px; }
      .editor-body { padding-inline: 12px; }
    }
  `;
}


class AuroraWeatherCard extends LitElement {
  _cleanPlaceName(value) {
    let name = String(value || '').trim();
    // Strip known Home Assistant/MET Norwegian prefixes explicitly.
    // Avoid clever regex here: "Værvarsel" must remain Unicode-safe.
    const lower = name.toLocaleLowerCase('nb-NO');
    if (lower.startsWith('værvarsel ')) {
      name = name.slice('Værvarsel '.length).trim();
    } else if (lower.startsWith('værvasel ')) {
      name = name.slice('Værvasel '.length).trim();
    } else if (lower.startsWith('vær ')) {
      name = name.slice('Vær '.length).trim();
    }
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length % 2 === 0) {
      const half = words.length / 2;
      const a = words.slice(0, half).join(' ');
      const b = words.slice(half).join(' ');
      if (a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0) name = a;
    }
    return name;
  }

  static async getConfigElement() {
    return document.createElement('aurora-weather-card-editor-v1-3-0');
  }

  static properties = {
    hass: { attribute: false },
    config: { state: true },
    status: { state: true },
    forecast: { state: true },
    errorMessage: { state: true },
    containerWidth: { state: true },
    expanded: { state: true },
  };


  static getConfigForm() {
    return {
      schema: [
        {
          name: 'entity',
          required: true,
          selector: { entity: { filter: { domain: 'weather' } } },
        },
        { name: 'location_name', selector: { text: {} } },
        { name: 'latitude', selector: { number: { mode: 'box', step: 0.0001 } } },
        { name: 'longitude', selector: { number: { mode: 'box', step: 0.0001 } } },
        { name: 'time_zone', selector: { text: {} } },
        {
          name: 'hours',
          selector: {
            select: {
              mode: 'dropdown',
              options: [
                { value: 24, label: '24 timer' },
                { value: 48, label: '48 timer' },
              ],
            },
          },
        },
        {
          name: 'theme',
          selector: {
            select: {
              mode: 'dropdown',
              options: [
                { value: 'aurora_dynamic', label: 'Aurora Dynamic' },
                { value: 'aurora_static', label: 'Aurora Static' },
              ],
            },
          },
        },
      ],
      computeLabel: (schema) => ({
        entity: 'Værkilde',
        location_name: 'Stedsnavn',
        latitude: 'Breddegrad',
        longitude: 'Lengdegrad',
        time_zone: 'Tidssone',
        hours: 'Antall timer',
        theme: 'Bakgrunn',
      }[schema.name]),
      computeHelper: (schema) => ({
        location_name: 'Valgfritt. Hvis feltet er tomt brukes navnet fra værentiteten.',
        latitude: 'Valgfritt. Brukes sammen med lengdegrad for riktige soltider.',
        longitude: 'Valgfritt. Brukes sammen med breddegrad for riktige soltider.',
        time_zone: 'Valgfritt, f.eks. Europe/Athens.',
      }[schema.name]),
    };
  }

  static getStubConfig() {
    return {
      entity: '',
      location_name: '',
      latitude: undefined,
      longitude: undefined,
      time_zone: '',
      hours: 48,
      theme: 'aurora_dynamic',
    };
  }

  constructor() {
    super();
    this.status = 'idle';
    this.forecast = [];
    this.errorMessage = '';
    this.containerWidth = 760;
    this._resizeObserver = undefined;
    this.expanded = false;
    this._onKeyDown = (event) => { if (event.key === 'Escape' && this.expanded) this.closeExpanded(); };
  }

  setConfig(config) {
    if (config?.entity && !config.entity.startsWith('weather.')) throw new Error('entity må være en weather.*-entitet');
    this.config = { hours: 48, theme: 'aurora_dynamic', ...config };
    if (Number(this.config.hours) > 48) this.config.hours = 48;
    this.loadedForEntity = undefined;
    this.forecast = [];
    this.status = 'idle';
  }

  getCardSize() { return 4; }

  getGridOptions() {
    return {
      columns: 12,
      rows: 5,
      min_columns: 4,
      min_rows: 4,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this._onKeyDown);
    this._scheduleNextMinuteRefresh();
  }

  _scheduleNextMinuteRefresh() {
    if (this._minuteRefreshTimer) clearTimeout(this._minuteRefreshTimer);

    const now = new Date();
    const nextMinute = new Date(now);
    nextMinute.setSeconds(0, 250);
    nextMinute.setMinutes(now.getMinutes() + 1);

    this._minuteRefreshTimer = window.setTimeout(() => {
      this.requestUpdate();
      this._scheduleNextMinuteRefresh();
    }, Math.max(1000, nextMinute.getTime() - now.getTime()));
  }

  firstUpdated() {
    const measure = () => {
      const width = Math.round(this.getBoundingClientRect().width || 0);
      if (width > 0 && Math.abs(width - this.containerWidth) > 2) this.containerWidth = width;
    };
    measure();
    if ('ResizeObserver' in window) {
      this._resizeObserver = new ResizeObserver(() => measure());
      this._resizeObserver.observe(this);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._onKeyDown);
    if (this._minuteRefreshTimer) clearTimeout(this._minuteRefreshTimer);
    this._minuteRefreshTimer = undefined;
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
  }

  updated() {
    void this.loadForecastIfNeeded();
  }

  async loadForecastIfNeeded() {
    const entity = this.config?.entity;
    if (!this.hass || !entity || this.status === 'loading' || this.loadedForEntity === entity) return;
    this.status = 'loading';
    this.errorMessage = '';
    try {
      this.forecast = await fetchHourlyForecast(this.hass, entity);
      this.loadedForEntity = entity;
      this.status = 'ok';
      console.info('[Aurora 1.0] Forecast loaded:', this.forecast.length);
    } catch (error) {
      this.status = 'error';
      this.errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Aurora 1.0] Forecast error:', error);
    }
  }

  graphData() {
    const hours = Math.max(6, Math.min(Number(this.config?.hours) || 48, 48));
    const entityState = this.hass?.states?.[this.config?.entity];
    const windUnit = entityState?.attributes?.wind_speed_unit || 'm/s';

    const now = new Date();
    now.setMinutes(0, 0, 0);

    return this.forecast
      .filter((item) => {
        const forecastTime = new Date(item.datetime);
        return Number.isFinite(forecastTime.getTime()) && forecastTime >= now;
      })
      .slice(0, hours)
      .map((item) => ({
        time: new Date(item.datetime),
        temperature: Number(item.temperature),
        precipitation: Number(item.precipitation ?? 0),
        windSpeed: windToMs(item.wind_speed, windUnit),
        windGust: windToMs(item.wind_gust_speed, windUnit),
        windBearing: Number(item.wind_bearing),
        condition: item.condition || 'cloudy',
      }))
      .filter((item) => Number.isFinite(item.time.getTime()) && Number.isFinite(item.temperature));
  }


  atmosphereClass() {
    if (this.config?.theme === 'aurora_static') return 'atmosphere-static';
    const entityState = this.hass?.states?.[this.config?.entity];
    const condition = String(entityState?.state || 'cloudy');
    const month = new Date().getMonth() + 1;
    const season = [12,1,2].includes(month) ? 'winter' : [3,4,5].includes(month) ? 'spring' : [6,7,8].includes(month) ? 'summer' : 'autumn';
    const location = this._effectiveLocation();
    const lat = location.latitude, lon = location.longitude;
    const hasLocation = Number.isFinite(lat) && Number.isFinite(lon);
    const timeZone = location.timeZone;
    const now = new Date();
    let isNight;
    if (hasLocation) {
      const rise = solarEventUtc(now, lat, lon, true), set = solarEventUtc(now, lat, lon, false);
      isNight = rise && set ? (now < rise || now >= set) : (hourInTimeZone(now, timeZone) < 6 || hourInTimeZone(now, timeZone) >= 21);
    } else {
      const sunState = this.hass?.states?.['sun.sun']?.state;
      const h = hourInTimeZone(now, timeZone);
      isNight = condition === 'clear-night' || sunState === 'below_horizon' || h < 6 || h >= 21;
    }
    const weather =
      condition.includes('lightning') || condition.includes('thunder') ? 'storm'
      : condition.includes('rain') || condition === 'pouring' ? 'rain'
      : condition.includes('snow') || condition === 'hail' ? 'snow'
      : condition === 'fog' ? 'fog'
      : condition.includes('wind') ? 'windy'
      : condition === 'sunny' ? 'sunny'
      : condition === 'clear-night' ? 'clear'
      : condition === 'partlycloudy' ? 'partlycloudy' : 'cloudy';
    return `atmosphere-dynamic season-${season} weather-${weather} ${isNight ? 'night' : 'day'}`;
  }

  openExpanded() {
    if (this.status === 'ok') this.expanded = true;
  }

  closeExpanded() {
    this.expanded = false;
  }

  _weatherLocation() {
    const state = this.hass?.states?.[this.config?.entity];
    const attrs = state?.attributes || {};

    const firstNumber = (...values) => {
      for (const value of values) {
        const number = Number(value);
        if (Number.isFinite(number)) return number;
      }
      return undefined;
    };

    const latitude = firstNumber(
      attrs.latitude,
      attrs.lat,
      attrs.location?.latitude,
      attrs.location?.lat,
      attrs.coordinates?.latitude,
      attrs.coordinates?.lat,
    );

    const longitude = firstNumber(
      attrs.longitude,
      attrs.lon,
      attrs.lng,
      attrs.location?.longitude,
      attrs.location?.lon,
      attrs.location?.lng,
      attrs.coordinates?.longitude,
      attrs.coordinates?.lon,
      attrs.coordinates?.lng,
    );

    const timeZone =
      attrs.time_zone ||
      attrs.timezone ||
      attrs.location?.time_zone ||
      attrs.location?.timezone ||
      undefined;

    return { latitude, longitude, timeZone };
  }

  _effectiveLocation() {
    const automatic = this._weatherLocation();
    const manualLat = Number(this.config?.latitude);
    const manualLon = Number(this.config?.longitude);

    return {
      latitude: Number.isFinite(automatic.latitude)
        ? automatic.latitude
        : (Number.isFinite(manualLat) ? manualLat : undefined),
      longitude: Number.isFinite(automatic.longitude)
        ? automatic.longitude
        : (Number.isFinite(manualLon) ? manualLon : undefined),
      timeZone: automatic.timeZone || this.config?.time_zone || this.hass?.config?.time_zone || undefined,
      automatic: Number.isFinite(automatic.latitude) && Number.isFinite(automatic.longitude),
    };
  }

  _cardTimeZone() {
    return this._effectiveLocation().timeZone;
  }

  _localParts(date) {
    const timeZone = this._cardTimeZone();
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone,
      }).formatToParts(date);
      const get = (type) => parts.find((p) => p.type === type)?.value;
      return {
        year: Number(get('year')),
        month: Number(get('month')),
        day: Number(get('day')),
        hour: Number(get('hour')) % 24,
        minute: Number(get('minute')),
      };
    } catch (_error) {
      return {
        year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
        hour: date.getHours(), minute: date.getMinutes(),
      };
    }
  }

  _localDayKey(date) {
    const p = this._localParts(date);
    return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
  }

  _localHour(date) {
    return this._localParts(date).hour;
  }

  _formatLocalClock(date = new Date()) {
    try {
      return new Intl.DateTimeFormat('nb-NO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: this._cardTimeZone(),
      }).format(date);
    } catch (_error) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  _formatLocalDay(date) {
    try {
      return new Intl.DateTimeFormat('nb-NO', {
        weekday: 'short', day: 'numeric', month: 'short',
        timeZone: this._cardTimeZone(),
      }).format(date);
    } catch (_error) {
      return new Intl.DateTimeFormat('nb-NO', {
        weekday: 'short', day: 'numeric', month: 'short',
      }).format(date);
    }
  }

  renderGraph(expanded = false) {
    const showTemperature = this.config?.show_temperature !== false;
    const showPrecipitation = this.config?.show_precipitation !== false;
    const showWind = this.config?.show_wind !== false;
    const showGust = this.config?.show_wind_gust !== false;
    const showWindDirection = this.config?.show_wind_direction !== false;
    const showWeatherIcons = this.config?.show_weather_icons !== false;
    const data = this.graphData();
    if (data.length < 2) return html`<div class="message">For få temperaturpunkter til å tegne graf.</div>`;

    const measuredWidth = expanded
      ? Math.max(640, Math.min(1320, Math.round(window.innerWidth * 0.88)))
      : (Number(this.containerWidth) || 760);
    const profile = measuredWidth < 600 ? 'mobile' : measuredWidth < 1000 ? 'tablet' : 'desktop';
    const width = Math.max(320, Math.min(1600, measuredWidth - 20));
    // give the wind section more vertical room in normal view.
    // The extra height is added only below the temperature/precipitation section.
    const compactWindExtra = expanded ? 0 : (profile === 'mobile' ? 12 : profile === 'tablet' ? 16 : 18);
    const height = expanded
      ? (profile === 'mobile' ? 330 : profile === 'tablet' ? 430 : 500)
      : (profile === 'mobile' ? 174 : profile === 'tablet' ? 206 : 238) + compactWindExtra;
    const left = profile === 'mobile' ? 38 : profile === 'tablet' ? 48 : 58;
    const right = profile === 'mobile' ? 12 : profile === 'tablet' ? 20 : 28;
    const top = expanded
      ? (profile === 'mobile' ? 78 : profile === 'tablet' ? 88 : 96)
      : (profile === 'mobile' ? 52 : profile === 'tablet' ? 58 : 62);
    const bottom = expanded
      ? (profile === 'mobile' ? 54 : profile === 'tablet' ? 60 : 65)
      : (profile === 'mobile' ? 40 : profile === 'tablet' ? 44 : 47);
    const gap = expanded ? (profile === 'mobile' ? 18 : profile === 'tablet' ? 26 : 30) : (profile === 'mobile' ? 18 : 20);
    const available = height - top - bottom - gap;
    // Preserve the old temperature/rain height in normal view.
    // All added vertical space goes to the wind section.
    const compactBaseAvailable = available - compactWindExtra;
    const weatherHeight = expanded ? available * 0.66 : compactBaseAvailable * 0.68;
    const windHeight = expanded ? available * 0.34 : available - weatherHeight;
    const weatherBottom = top + weatherHeight;
    const windTop = weatherBottom + gap;
    const windBottom = windTop + windHeight;
    const plotWidth = width - left - right;

    const rawMin = Math.min(...data.map((d) => d.temperature));
    const rawMax = Math.max(...data.map((d) => d.temperature));
    let minTemp = Math.floor((rawMin - 1) / 2) * 2;
    let maxTemp = Math.ceil((rawMax + 1) / 2) * 2;
    if (maxTemp - minTemp < 4) {
      const mid = (maxTemp + minTemp) / 2;
      minTemp = Math.floor((mid - 2) / 2) * 2;
      maxTemp = Math.ceil((mid + 2) / 2) * 2;
    }

    const x = (index) => left + (index / (data.length - 1)) * plotWidth;
    const yTemp = (temperature) => top + ((maxTemp - temperature) / (maxTemp - minTemp)) * weatherHeight;
    const tempPoints = data.map((d, index) => ({ x: x(index), y: yTemp(d.temperature) }));
    const tempPath = smoothPath(tempPoints);

    const maxRainRaw = Math.max(...data.map((d) => Number.isFinite(d.precipitation) ? d.precipitation : 0), 0);

    // Adaptive Yr-like precipitation scale.
    // Low precipitation now gets a tighter scale instead of always being locked to 0-2-4 mm.
    let maxRain;
    let rainStep;
    if (maxRainRaw <= 1) {
      maxRain = 1;
      rainStep = 0.5;
    } else if (maxRainRaw <= 2) {
      maxRain = 2;
      rainStep = 1;
    } else if (maxRainRaw <= 4) {
      maxRain = 4;
      rainStep = 2;
    } else {
      maxRain = Math.ceil(maxRainRaw / 2) * 2;
      rainStep = 2;
    }

    const rainY = (value) => top + ((maxRain - value) / maxRain) * weatherHeight;
    const rainTicks = [];
    for (let value = 0; value <= maxRain + 0.0001; value += rainStep) rainTicks.push(value);
    const barStep = plotWidth / Math.max(1, data.length - 1);
    const barWidth = Math.max(2.2, Math.min(11, barStep * 0.60));

    const validWind = data.filter((d) => Number.isFinite(d.windSpeed));
    const validGust = data.filter((d) => Number.isFinite(d.windGust));
    const maxWindRaw = Math.max(
      ...validWind.map((d) => d.windSpeed),
      ...validGust.map((d) => d.windGust),
      0,
    );
    const maxWind = Math.max(18, Math.ceil(maxWindRaw / 6) * 6);
    const yWind = (value) => windBottom - (Math.max(0, value) / maxWind) * windHeight;
    // Yr-like wind scale: 0, 6, 12, 18 ... in the entity's wind-speed unit.
    const windTicks = [];
    for (let value = 0; value <= maxWind; value += 6) windTicks.push(value);
    const windPoints = data
      .map((d, index) => ({ x: x(index), y: Number.isFinite(d.windSpeed) ? yWind(d.windSpeed) : null }))
      .filter((p) => p.y !== null);
    const windPath = windPoints.length > 1 ? smoothPath(windPoints) : '';
    const gustPoints = data
      .map((d, index) => ({ x: x(index), y: Number.isFinite(d.windGust) ? yWind(d.windGust) : null }))
      .filter((p) => p.y !== null);
    const gustPath = gustPoints.length > 1 ? smoothPath(gustPoints) : '';

    const yTicks = [];
    for (let value = minTemp; value <= maxTemp; value += 2) yTicks.push(value);

    // Responsive timeline: compact 4h, expanded 2h.
    const timelineStep = expanded ? 2 : 4;
    // Wind-direction arrows use exactly the same positions.
    const timeLabels = data
      .map((d, index) => ({ d, index }))
      .filter(({ d }) => this._localHour(d.time) % timelineStep === 0);

    const dayStarts = data
      .map((d, index) => ({ d, index }))
      .filter(({ d, index }) => index === 0 || this._localDayKey(d.time) !== this._localDayKey(data[index - 1].time));
    const daySegments = dayStarts.map((start, i) => ({
      ...start,
      endIndex: i < dayStarts.length - 1 ? dayStarts[i + 1].index - 1 : data.length - 1,
    }));

    // Keep weather icons aligned with the Yr-like 2-hour time scale.
    const iconPoints = data
      .map((d, index) => ({ d, index }))
      .filter(({ d }) => this._localHour(d.time) % timelineStep === 0);

    return html`
      <div class="chart-wrap">
        <svg class="chart-svg ${profile} ${expanded ? 'expanded-chart' : ''}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Værikoner, temperatur, nedbør, vind og vindkast">
          <defs>
            <linearGradient id="tempArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ff3038" stop-opacity="0.20"></stop>
              <stop offset="100%" stop-color="#ff3038" stop-opacity="0"></stop>
            </linearGradient>
            <linearGradient id="rainBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2aa8ff" stop-opacity="0.95"></stop>
              <stop offset="100%" stop-color="#087fc8" stop-opacity="0.65"></stop>
            </linearGradient>
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.85" result="blur"></feGaussianBlur>
              <feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
            </filter>
          </defs>

          ${yTicks.map((value) => svg`
            <line class="grid-line" x1="${left}" y1="${yTemp(value)}" x2="${width - right}" y2="${yTemp(value)}"></line>
            <text class="axis-label" x="${left - 10}" y="${yTemp(value) + 4}" text-anchor="end">${value}°</text>
          `)}

          ${daySegments.map(({ d, index, endIndex }, segmentIndex) => svg`
            ${segmentIndex > 0 ? svg`<line class="day-line" x1="${x(index)}" y1="${top}" x2="${x(index)}" y2="${windBottom}"></line>` : nothing}
            <text class="day-label" x="${(x(index) + x(endIndex)) / 2}" y="${Math.max(16, top - (expanded ? 46 : 40))}" text-anchor="middle">${this._formatLocalDay(d.time)}</text>
          `)}

          ${(showWeatherIcons ? iconPoints : []).map(({ d, index }) => svg`
            <g class="weather-icon" transform="translate(${x(index) - (expanded ? 20 : 16)} ${top - (expanded ? 34 : 29)}) scale(${expanded ? .74 : .5})">${weatherIconSvg(d.condition)}</g>
          `)}

          ${timeLabels.map(({ index }) => svg`
            <line class="time-grid weather-time-grid" x1="${x(index)}" y1="${top}" x2="${x(index)}" y2="${weatherBottom}"></line>
            <line class="time-grid wind-time-grid" x1="${x(index)}" y1="${windTop}" x2="${x(index)}" y2="${windBottom}"></line>
          `)}

          <text class="rain-unit-label" x="${width - 4}" y="${top - 8}" text-anchor="end">mm</text>
          ${rainTicks.map((value) => svg`
            <text class="rain-axis-label rain-axis-blue" x="${width - 4}" y="${rainY(value) + 4}" text-anchor="end">${Number.isInteger(value) ? value : value.toFixed(1)}</text>
          `)}

          ${(showPrecipitation ? data : []).map((d, index) => {
            const value = Number.isFinite(d.precipitation) ? d.precipitation : 0;
            const yy = rainY(value);
            return svg`<rect class="rain-bar" x="${x(index) - barWidth / 2}" y="${yy}" width="${barWidth}" height="${Math.max(0, weatherBottom - yy)}" rx="1.4"></rect>`;
          })}

          ${showTemperature ? svg`<path class="temperature-area" d="${tempPath} L ${tempPoints.at(-1).x} ${weatherBottom} L ${tempPoints[0].x} ${weatherBottom} Z"></path>
          <path class="temperature-line" d="${tempPath}" filter="url(#softGlow)"></path>` : nothing}

          <line class="wind-separator" x1="${left}" y1="${windTop - gap / 2}" x2="${width - right}" y2="${windTop - gap / 2}"></line>
          ${windTicks.map((value) => svg`
            <line class="wind-grid" x1="${left}" y1="${yWind(value)}" x2="${width - right}" y2="${yWind(value)}"></line>
            <text class="wind-axis-label" x="${left - 10}" y="${yWind(value) + 4}" text-anchor="end">${value}</text>
          `)}
          ${expanded ? svg`<text class="wind-unit-label" x="${left - 10}" y="${windTop - Math.max(7, gap * 0.28)}" text-anchor="end">m/s</text>` : nothing}
          ${showWind && windPath ? svg`<path class="wind-line" d="${windPath}" filter="url(#softGlow)"></path>` : nothing}
          ${showGust && gustPath ? svg`<path class="gust-line" d="${gustPath}" filter="url(#softGlow)"></path>` : nothing}

          ${(showWindDirection ? timeLabels : []).map(({ d, index }) => Number.isFinite(d.windBearing) ? svg`
            <g class="wind-direction" transform="translate(${x(index)} ${height - (expanded ? 31 : 24)}) rotate(${(d.windBearing + 180) % 360}) scale(${expanded ? 1.12 : .94})">
              <path d="M 0 -7 L 4.3 1.5 L 1.4 .6 L 1.4 6 L -1.4 6 L -1.4 .6 L -4.3 1.5 Z"></path>
            </g>
          ` : nothing)}

          ${timeLabels.map(({ d, index }) => svg`
            <text class="time-label" x="${x(index)}" y="${height - 11}" text-anchor="middle">${String(this._localHour(d.time)).padStart(2, '0')}</text>
          `)}
        </svg>
      </div>
    `;
  }

  _expandedInfoData() {
    const state=this.hass?.states?.[this.config?.entity];
    const a=state?.attributes||{};
    const data=this.graphData();
    const now=data[0]||{};
    const current=data[0]||null;
    const today=new Date().toDateString();
    const rainToday=data.filter(d=>d.time?.toDateString?.()===today)
      .reduce((s,d)=>s+(Number(d.precipitation)||0),0);
    const num=(...v)=>{ for(const x of v){ const n=Number(x); if(Number.isFinite(n)) return n; } return null; };
    const bearing=num(now.windBearing,a.wind_bearing);
    const dirs=['N','NØ','Ø','SØ','S','SV','V','NV'];
    const dir=Number.isFinite(bearing)?dirs[Math.round((((bearing%360)+360)%360)/45)%8]:'–';
    const dirArrow=Number.isFinite(bearing);
    const dirRotation=Number.isFinite(bearing)?bearing:0;
    const sun=this.hass?.states?.['sun.sun']?.attributes||{};
    const location=this._effectiveLocation();
    const lat=location.latitude, lon=location.longitude;
    const hasLocation=Number.isFinite(lat)&&Number.isFinite(lon);
    const timeZone=location.timeZone;
    const solarDate=current?.time instanceof Date?current.time:new Date();
    const localSunrise=hasLocation?solarEventUtc(solarDate,lat,lon,true):null;
    const localSunset=hasLocation?solarEventUtc(solarDate,lat,lon,false):null;
    const fmt=(v)=>{ if(!v)return '–'; const d=v instanceof Date?v:new Date(v); return formatInTimeZone(d,timeZone); };
    return {
      temp:current?.temperature ?? null, rainToday,
      wind:num(now.windSpeed,windToMs(a.wind_speed,a.wind_speed_unit||'m/s')),
      gust:num(now.windGust,windToMs(a.wind_gust_speed,a.wind_speed_unit||'m/s')),
      humidity:num(a.humidity), pressure:num(a.pressure), dir, dirArrow, dirRotation,
      sunrise:fmt(localSunrise||sun.next_rising), sunset:fmt(localSunset||sun.next_setting)
    };
  }

  _renderExpandedInfo() {
    const d=this._expandedInfoData();
    const val=(n,digits=1)=>Number.isFinite(n)?n.toFixed(digits):'–';

    const thermometer=html`<svg class="metric-svg temp-svg" viewBox="0 0 48 48" aria-hidden="true">
      <path class="temp-outline" d="M22 8a4 4 0 0 1 8 0v20.7a9.5 9.5 0 1 1-8 0V8Z"/>
      <path class="temp-liquid" d="M26 14v18"/>
      <circle class="temp-liquid-bulb" cx="26" cy="35" r="5.1"/>
      <path class="temp-tick" d="M31 16h4M31 21h3M31 26h4"/>
    </svg>`;
    const rain=html`<svg class="metric-svg rain-svg" viewBox="0 0 52 48" aria-hidden="true">
      <path d="M13 27h27a8 8 0 0 0 .2-16 12 12 0 0 0-22.7 2.8A7 7 0 0 0 13 27Z"/>
      <path class="metric-accent" d="M17 32l-3 7M27 32l-3 7M37 32l-3 7"/>
    </svg>`;
    const windIcon=(cls)=>html`<svg class="metric-svg ${cls}" viewBox="0 0 54 48" aria-hidden="true">
      <path d="M5 15h29c8 0 8-10 1-10-4 0-6 2-7 5"/>
      <path d="M5 24h38c9 0 9 12 1 12-5 0-7-3-7-6"/>
      <path d="M5 33h20"/>
    </svg>`;
    const droplet=html`<svg class="metric-svg humidity-svg" viewBox="0 0 48 48" aria-hidden="true">
      <path class="metric-fill" d="M24 4C18 14 10 23 10 32a14 14 0 0 0 28 0C38 23 30 14 24 4Z"/>
    </svg>`;
    const pressure=html`<svg class="metric-svg pressure-svg" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="17"/><path d="M24 10v14h11"/><circle class="metric-fill" cx="24" cy="24" r="2.5"/>
    </svg>`;
    const sun=html`<svg class="metric-svg sun-svg" viewBox="0 0 48 48" aria-hidden="true">
      <circle class="metric-fill" cx="24" cy="24" r="9"/>
      <path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l5 5M33 33l5 5M38 10l-5 5M15 33l-5 5"/>
    </svg>`;

    return html`<div class="expanded-info">
      <div class="info-tile">${thermometer}<div><div class="info-label">Nå</div><div class="info-value">${val(d.temp)}°</div></div></div>
      <div class="info-tile">${rain}<div><div class="info-label">Nedbør i dag</div><div class="info-value">${val(d.rainToday)} <small>mm</small></div></div></div>
      <div class="info-tile">${windIcon('wind-svg')}<div><div class="info-label">Vind</div><div class="info-value">${val(d.wind)} <small>m/s</small></div><div class="info-sub wind-direction">${d.dirArrow ? html`<span class="dir-arrow" style="transform:rotate(${d.dirRotation}deg)"></span>` : nothing}<span>${d.dir}</span></div></div></div>
      <div class="info-tile">${windIcon('gust-svg')}<div><div class="info-label">Vindkast</div><div class="info-value">${val(d.gust)} <small>m/s</small></div></div></div>
      <div class="info-tile">${droplet}<div><div class="info-label">Luftfuktighet</div><div class="info-value">${val(d.humidity,0)}<small>%</small></div></div></div>
      <div class="info-tile">${pressure}<div><div class="info-label">Lufttrykk</div><div class="info-value">${val(d.pressure,0)} <small>hPa</small></div></div></div>
      <div class="info-tile">${sun}<div><div class="info-label">Sol</div><div class="info-value sun-value">${d.sunrise} / ${d.sunset}</div></div></div>
    </div>`;
  }

  render() {
    if (!this.config) return nothing;
    const entityState = this.config.entity ? this.hass?.states[this.config.entity] : undefined;
    const name = this._cleanPlaceName(this.config.location_name || entityState?.attributes?.friendly_name || this.config.entity || 'Velg værkilde');
    const current = this.graphData()[0];
    const atmosphere = this.atmosphereClass();

    if (!this.config.entity) {
      return html`<ha-card class="compact-card ${atmosphere}"><header><div><div class="brand"><span class="aurora-logo" aria-hidden="true"><svg viewBox="0 0 100 100"><defs><radialGradient id="abg" cx="58%" cy="34%" r="72%"><stop offset="0" stop-color="#0c7896"/><stop offset=".5" stop-color="#063a62"/><stop offset="1" stop-color="#07102a"/></radialGradient><linearGradient id="ara" x1="10%" y1="90%" x2="80%" y2="10%"><stop offset="0" stop-color="#5838ff"/><stop offset=".3" stop-color="#1aa8ff"/><stop offset=".58" stop-color="#39f0d0"/><stop offset="1" stop-color="#87ffd6"/></linearGradient><filter id="agl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="50" cy="50" r="44" fill="url(#abg)" stroke="#18bfe9" stroke-width="1.4"/><path d="M18 72C31 58 29 40 42 24C36 45 48 53 52 66C58 51 69 42 79 23C76 46 83 59 70 76C58 90 34 91 18 72Z" fill="url(#ara)" opacity=".92" filter="url(#agl)"/><path d="M23 76C40 66 43 55 49 39C50 57 62 62 69 75C57 84 39 87 23 76Z" fill="#6746ff" opacity=".42"/></svg></span><span>Aurora</span></div><div class="title">Velg værkilde</div></div></header><main><div class="message">Velg en <b>weather.*</b>-entitet i korteditoren.</div></main></ha-card>`;
    }

    return html`
      <ha-card class="compact-card ${atmosphere}" @click=${() => this.openExpanded()} title="Trykk for stor visning">
        <header>
          <div class="header-identity">
            <div class="brand"><span class="aurora-logo" aria-hidden="true"><svg viewBox="0 0 100 100"><defs><radialGradient id="abg" cx="58%" cy="34%" r="72%"><stop offset="0" stop-color="#0c7896"/><stop offset=".5" stop-color="#063a62"/><stop offset="1" stop-color="#07102a"/></radialGradient><linearGradient id="ara" x1="10%" y1="90%" x2="80%" y2="10%"><stop offset="0" stop-color="#5838ff"/><stop offset=".3" stop-color="#1aa8ff"/><stop offset=".58" stop-color="#39f0d0"/><stop offset="1" stop-color="#87ffd6"/></linearGradient><filter id="agl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="50" cy="50" r="44" fill="url(#abg)" stroke="#18bfe9" stroke-width="1.4"/><path d="M18 72C31 58 29 40 42 24C36 45 48 53 52 66C58 51 69 42 79 23C76 46 83 59 70 76C58 90 34 91 18 72Z" fill="url(#ara)" opacity=".92" filter="url(#agl)"/><path d="M23 76C40 66 43 55 49 39C50 57 62 62 69 75C57 84 39 87 23 76Z" fill="#6746ff" opacity=".42"/></svg></span><span class="brand-copy"><span class="brand-name">Aurora</span><span class="brand-location">${name}<span class="brand-clock"> · ${this._formatLocalClock()}</span></span></span></div>
          </div>
          ${current ? html`<div class="current">${current.temperature.toFixed(1)}°</div>` : nothing}
        </header>

        <main>
          ${this.status === 'loading' ? html`<div class="message">Henter timeprognose …</div>` : nothing}
          ${this.status === 'error' ? html`<div class="message error"><b>Feil:</b> ${this.errorMessage}</div>` : nothing}
          ${this.status === 'ok' ? this.renderGraph(false) : nothing}
        </main>

        <footer>
          ${this.config?.show_temperature !== false ? html`<span class="legend-item"><span class="legend-dot temp"></span><span>Temperatur</span></span>` : nothing}
          ${this.config?.show_precipitation !== false ? html`<span class="legend-item"><span class="legend-dot rain"></span><span>Nedbør</span></span>` : nothing}
          ${this.config?.show_wind !== false ? html`<span class="legend-item"><span class="legend-dot wind"></span><span>Vind</span></span>` : nothing}
          ${this.config?.show_wind_gust !== false ? html`<span class="legend-item"><span class="legend-dot gust"></span><span>Vindkast</span></span>` : nothing}
          <span class="version">v1.3.0</span>
        </footer>
      </ha-card>

      ${this.expanded ? html`
        <div class="expand-backdrop" @click=${() => this.closeExpanded()}>
          <section class="expand-panel ${atmosphere}" role="dialog" aria-modal="true" aria-label="Utvidet værvarsel" @click=${(event) => event.stopPropagation()}>
            <button class="close-button" aria-label="Lukk stor visning" @click=${() => this.closeExpanded()}>×</button>
            <header class="expanded-header">
              <div class="header-identity">
                <div class="brand expanded-brand"><span class="aurora-logo" aria-hidden="true"><svg viewBox="0 0 100 100"><defs><radialGradient id="abg" cx="58%" cy="34%" r="72%"><stop offset="0" stop-color="#0c7896"/><stop offset=".5" stop-color="#063a62"/><stop offset="1" stop-color="#07102a"/></radialGradient><linearGradient id="ara" x1="10%" y1="90%" x2="80%" y2="10%"><stop offset="0" stop-color="#5838ff"/><stop offset=".3" stop-color="#1aa8ff"/><stop offset=".58" stop-color="#39f0d0"/><stop offset="1" stop-color="#87ffd6"/></linearGradient><filter id="agl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="50" cy="50" r="44" fill="url(#abg)" stroke="#18bfe9" stroke-width="1.4"/><path d="M18 72C31 58 29 40 42 24C36 45 48 53 52 66C58 51 69 42 79 23C76 46 83 59 70 76C58 90 34 91 18 72Z" fill="url(#ara)" opacity=".92" filter="url(#agl)"/><path d="M23 76C40 66 43 55 49 39C50 57 62 62 69 75C57 84 39 87 23 76Z" fill="#6746ff" opacity=".42"/></svg></span><span class="brand-copy"><span class="brand-name">Aurora</span><span class="brand-location">${name}<span class="brand-clock"> · ${this._formatLocalClock()}</span></span></span></div>
              </div>
              ${current ? html`<div class="expanded-current">${current.temperature.toFixed(1)}°</div>` : nothing}
            </header>
            <div class="expanded-body">${this.renderGraph(true)}
              ${this._renderExpandedInfo()}</div>
            <footer class="expanded-footer">
              ${this.config?.show_temperature !== false ? html`<span class="legend-item"><span class="legend-dot temp"></span><span>Temperatur</span></span>` : nothing}
              ${this.config?.show_precipitation !== false ? html`<span class="legend-item"><span class="legend-dot rain"></span><span>Nedbør</span></span>` : nothing}
              ${this.config?.show_wind !== false ? html`<span class="legend-item"><span class="legend-dot wind"></span><span>Vind</span></span>` : nothing}
              ${this.config?.show_wind_gust !== false ? html`<span class="legend-item"><span class="legend-dot gust"></span><span>Vindkast</span></span>` : nothing}
              <span class="expanded-note">${Math.min(Number(this.config?.hours) || 48, this.forecast.length)} timer tilgjengelig</span>
            </footer>
          </section>
        </div>
      ` : nothing}
    `;
  }

  static styles = css`

    :host { display: block; width: 100%; min-width: 0; }
    ha-card { --primary-text-color:#f4f8fc; --secondary-text-color:#aeb9c6; --secondary-background-color:rgba(255,255,255,.06); --error-color:#ff6b6b; color:#f4f8fc; position: relative; display: block; width: 100%; min-width: 0; box-sizing: border-box; overflow: hidden; border-radius: 18px; background: radial-gradient(120% 100% at 78% 0%, rgba(30,108,155,.10), transparent 48%), linear-gradient(145deg, rgba(23,30,38,.985), rgba(15,20,26,.995)); border: 1px solid rgba(125,170,205,.18); box-shadow: inset 0 1px 0 rgba(255,255,255,.035); }
    ha-card::before, .expand-panel::after {
      content:'';
      position:absolute;
      inset:-8%;
      pointer-events:none;
      opacity:0;
      transition:opacity .55s ease;
      background-repeat:no-repeat;
      background-size:140% 140%, 130% 130%, 100% 100%;
      transform:translate3d(0,0,0);
      will-change:transform, background-position, opacity;
    }
    .expand-panel::after {
      inset:0;
    }
    ha-card.atmosphere-dynamic::before, .expand-panel.atmosphere-dynamic::after {
      opacity:1;
      animation:auroraDrift 22s ease-in-out infinite alternate;
    }

    .season-spring::before, .expand-panel.season-spring::after {
      background-image:
        radial-gradient(70% 52% at 14% 2%, rgba(80,214,165,.145), transparent 68%),
        radial-gradient(58% 46% at 82% 8%, rgba(88,167,255,.090), transparent 70%);
    }
    .season-summer::before, .expand-panel.season-summer::after {
      background-image:
        radial-gradient(62% 58% at 88% 0%, rgba(255,211,110,.175), transparent 70%),
        radial-gradient(50% 45% at 18% 10%, rgba(89,188,255,.085), transparent 72%);
    }
    .season-autumn::before, .expand-panel.season-autumn::after {
      background-image:
        radial-gradient(68% 54% at 82% 0%, rgba(222,145,70,.140), transparent 70%),
        radial-gradient(48% 40% at 12% 12%, rgba(147,94,58,.050), transparent 74%);
    }
    .season-winter::before, .expand-panel.season-winter::after {
      background-image:
        radial-gradient(74% 58% at 18% 0%, rgba(92,178,244,.160), transparent 70%),
        radial-gradient(56% 48% at 82% 8%, rgba(160,211,255,.070), transparent 72%);
    }

    .weather-rain::before, .expand-panel.weather-rain::after {
      background-image:
        linear-gradient(155deg, rgba(25,76,114,.170), transparent 58%),
        radial-gradient(72% 66% at 78% 0%, rgba(67,131,176,.120), transparent 72%);
    }
    .weather-sunny::before, .expand-panel.weather-sunny::after {
      background-image:
        radial-gradient(58% 62% at 90% -4%, rgba(255,205,93,.215), transparent 70%),
        radial-gradient(42% 40% at 74% 12%, rgba(255,235,168,.075), transparent 74%);
    }
    .weather-snow::before, .expand-panel.weather-snow::after {
      background-image:
        radial-gradient(68% 58% at 76% 0%, rgba(218,240,255,.165), transparent 70%),
        radial-gradient(48% 42% at 20% 10%, rgba(116,182,234,.075), transparent 74%);
    }
    .weather-cloudy::before, .expand-panel.weather-cloudy::after {
      background-image:
        radial-gradient(66% 56% at 75% 0%, rgba(116,142,164,.100), transparent 72%),
        radial-gradient(52% 44% at 14% 10%, rgba(75,101,124,.050), transparent 74%);
    }

    /* Aurora Night atmosphere */
    .night::before, .expand-panel.night::after {
      background-image:
        radial-gradient(78% 42% at 4% -8%, rgba(29,255,184,.34), transparent 61%),
        radial-gradient(68% 37% at 39% -7%, rgba(31,205,219,.245), transparent 64%),
        radial-gradient(60% 38% at 76% -9%, rgba(127,74,255,.255), transparent 65%),
        radial-gradient(42% 25% at 56% 2%, rgba(41,139,255,.12), transparent 70%),
        linear-gradient(180deg, rgba(3,12,27,.12), transparent 52%);
      background-size:160% 135%, 165% 140%, 160% 135%, 145% 125%, 100% 100%;
      opacity:.96;
      animation:auroraNightMove 9s ease-in-out infinite alternate;
      filter:saturate(1.16) blur(.15px);
    }
    .night.weather-rain::before, .expand-panel.night.weather-rain::after {
      background-image:
        radial-gradient(72% 38% at 6% -7%, rgba(27,224,173,.255), transparent 63%),
        radial-gradient(62% 34% at 40% -5%, rgba(30,166,201,.18), transparent 66%),
        radial-gradient(56% 35% at 76% -8%, rgba(105,70,225,.19), transparent 68%),
        radial-gradient(38% 23% at 57% 1%, rgba(36,112,210,.09), transparent 72%),
        linear-gradient(155deg, rgba(20,62,92,.14), transparent 54%);
      opacity:.88;
    }

    /* TEST 3.0: clearer day/night atmosphere.
       These overlays use only CSS; no image assets are loaded. */
    .atmosphere-dynamic.day {
      background:
        radial-gradient(115% 90% at 82% -8%, rgba(70,155,205,.15), transparent 52%),
        linear-gradient(145deg, rgba(24,34,43,.985), rgba(14,21,28,.995));
    }
    .atmosphere-dynamic.night {
      background:
        radial-gradient(115% 90% at 78% -8%, rgba(23,67,115,.17), transparent 54%),
        linear-gradient(145deg, rgba(11,20,33,.995), rgba(5,10,19,.998));
    }

    /* HA light theme: strengthen Aurora's separation from a pale dashboard
       while keeping the card itself dark and preserving the graph untouched. */
    @media (prefers-color-scheme: light) {
      ha-card.atmosphere-dynamic {
        border-color: rgba(70,196,224,.42);
        box-shadow:
          0 12px 30px rgba(15,55,74,.18),
          0 0 22px rgba(56,202,210,.10),
          inset 0 1px 0 rgba(255,255,255,.07);
      }
      ha-card.atmosphere-dynamic::before {
        opacity:1;
        filter:saturate(1.22) brightness(1.10);
      }
      .expand-panel.atmosphere-dynamic {
        border-color: rgba(83,205,235,.48);
        box-shadow:
          0 28px 80px rgba(0,0,0,.45),
          0 0 34px rgba(54,205,214,.12),
          inset 0 1px 0 rgba(255,255,255,.08);
      }
      .expand-panel.atmosphere-dynamic::after {
        opacity:1;
        filter:saturate(1.20) brightness(1.08);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      ha-card.atmosphere-dynamic::before,
      .expand-panel.atmosphere-dynamic::after {
        animation:none;
      }
    }
    ha-card > *, .expand-panel > * { position:relative; z-index:1; }
    .compact-card { cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
    .compact-card:hover { border-color: rgba(72,190,255,.34); box-shadow: inset 0 1px 0 rgba(255,255,255,.045), 0 8px 22px rgba(0,0,0,.18); }
    .compact-card:active { transform: scale(.995); }
    header { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 15px 18px 5px; }
    header::after { content: ''; position: absolute; left: 18px; right: 18px; bottom: -1px; height: 1px; background: linear-gradient(90deg, transparent, rgba(77,181,255,.13), transparent); }
    .brand { display:flex; align-items:center; gap:7px; color: var(--secondary-text-color); font-size: 12px; font-weight: 600; letter-spacing: .02em; }
    .aurora-logo { width:40px; height:40px; flex:0 0 auto; display:inline-flex; filter:drop-shadow(0 0 6px rgba(36,202,255,.34)) drop-shadow(0 0 10px rgba(95,62,255,.18)); }
    .aurora-logo svg { width:100%; height:100%; display:block; overflow:visible; }
    .expanded-brand .aurora-logo { width:50px; height:50px; }
    .brand-copy { display:flex; flex-direction:column; justify-content:center; min-width:0; line-height:1.05; }
    .brand-name { color:#f4f8fb; font-size:18px; font-weight:740; letter-spacing:-.02em; }
    .brand-location { color:#55dff4; font-size:13px; font-weight:620; margin-top:3px; white-space:nowrap; }
    .brand-clock { color:#c7d3df; font-weight:600; opacity:.92; }
    .expanded-brand .brand-name { font-size:22px; }
    .expanded-brand .brand-location { font-size:15px; margin-top:4px; }
    .wind-direction path {
      fill:#e8f3f9;
      stroke:rgba(7,18,28,.88);
      stroke-width:.65;
      stroke-linejoin:round;
      filter:drop-shadow(0 0 2px rgba(86,204,255,.38));
    }
    .wind-direction { opacity:.96; transform-box:fill-box; transform-origin:center; }
    .title { margin-top: 4px; font-size: 15.5px; font-weight: 700; letter-spacing: -.015em; }
    .current { font-size: 18.5px; font-weight: 680; font-variant-numeric: tabular-nums; letter-spacing: -.025em; }
    main { padding: 0 10px; min-width: 0; }
    .chart-wrap { width: 100%; min-width: 0; overflow: hidden; }
    svg { display: block; width: 100%; height: auto; max-width: none; }
    .grid-line { stroke: rgba(160,190,215,.66); stroke-width: 1; opacity: .88; stroke-dasharray: 4 5; }
    .day-line { stroke: rgba(165,195,220,.62); stroke-width: 1.1; stroke-dasharray: 4 6; opacity: .92; }
    .axis-label, .time-label, .day-label, .rain-axis-label { fill: var(--secondary-text-color); font-family: inherit; font-size: 11px; }
    .rain-unit-label { fill: #2aa8ff; font-family: inherit; font-size: 10px; font-weight: 700; paint-order: stroke; stroke: rgba(17,21,27,.92); stroke-width: 3px; stroke-linejoin: round; }
    .day-label { font-weight: 650; fill: var(--primary-text-color); opacity: .90; font-size: 10.5px; }
    .expanded-chart .day-label { font-size: 13px; font-weight: 700; }
    .rain-axis-blue { fill: #2aa8ff; font-weight: 650; }
    .weather-icon { filter: drop-shadow(0 2px 2px rgba(0,0,0,.42)); pointer-events: none; } .wx-icon-svg { transform-box: fill-box; transform-origin: center; }
    .temperature-line { fill: none; stroke: #ff3038; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
    .temperature-area { fill: url(#tempArea); pointer-events: none; }
    .rain-bar { fill: url(#rainBar); opacity: .92; }
    .wind-separator { stroke: var(--divider-color); stroke-width: 1; opacity: .38; }
    .wind-grid { stroke: rgba(160,190,215,.66); stroke-width: 1; opacity: .88; stroke-dasharray: 4 5; }
    .time-grid { stroke: rgba(145,175,200,.52); stroke-width: 1; opacity: .72; stroke-dasharray: 3 6; }
    .expanded-chart .time-grid { opacity: .80; }
    .expanded-chart .grid-line, .expanded-chart .wind-grid { opacity: .92; }
    .wind-line { fill: none; stroke: #b44cff; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .gust-line { fill: none; stroke: #ffd400; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 6 4; }
    .wind-axis-label { fill: #cfa8ff; font-family: inherit; font-size: 10px; }
    .wind-unit-label { fill: #cfa8ff; font-family: inherit; font-size: 10px; font-weight: 650; }
    .expanded-chart .wind-unit-label { font-size: 11.5px; font-weight: 700; }
    .message { margin: 14px 8px; padding: 14px; border-radius: 12px; background: var(--secondary-background-color); }
    .message.error { color: var(--error-color); }
    footer { display: flex; align-items: center; flex-wrap: nowrap; gap: 12px; padding: 8px 16px 12px; color: var(--secondary-text-color); font-size: 11.5px; border-top: 1px solid rgba(255,255,255,.035); white-space: nowrap; overflow: hidden; }
    .legend-item { display: inline-flex; align-items: center; gap: 5px; min-width: 0; flex: 0 0 auto; }
    .legend-dot { width: 14px; height: 3px; flex: 0 0 14px; display: inline-block; border-radius: 999px; box-shadow: 0 0 6px color-mix(in srgb, currentColor 24%, transparent); }
    .legend-dot.temp { background: #ff3038; }
    .legend-dot.rain { background: #2aa8ff; }
    .legend-dot.wind { background: #b44cff; }
    .legend-dot.gust { background: repeating-linear-gradient(90deg, #ffd400 0 5px, transparent 5px 8px); box-shadow: none; }
    .version { margin-left: auto; padding-right: 2px; opacity: .55; font-size: 10px; white-space: nowrap; flex: 0 0 auto; }

    .day-label { paint-order: stroke; stroke: rgba(17,21,27,.92); stroke-width: 3px; stroke-linejoin: round; }
    .rain-axis-label { paint-order: stroke; stroke: rgba(17,21,27,.92); stroke-width: 3px; stroke-linejoin: round; }

    .expand-backdrop { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 8px 18px; box-sizing: border-box; background: rgba(3,7,12,.72); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); animation: auroraFade .20s ease-out both; }
    .expand-panel { --primary-text-color:#f4f8fc; --secondary-text-color:#aeb9c6; --secondary-background-color:rgba(255,255,255,.06); color:#f4f8fc; position: relative; width: min(1240px, 94vw); max-height: calc(100vh - 16px); overflow: hidden; box-sizing: border-box; border-radius: 24px; background: radial-gradient(110% 80% at 75% 0%, rgba(25,124,178,.16), transparent 48%), linear-gradient(145deg, rgba(20,29,39,.995), rgba(8,14,21,.995)); border: 1px solid rgba(83,191,255,.34); box-shadow: 0 28px 80px rgba(0,0,0,.58), inset 0 1px 0 rgba(255,255,255,.07); animation: auroraGrow .24s cubic-bezier(.2,.8,.2,1) both; }
    .expand-panel::before { content:''; position:absolute; inset:0 8% auto; height:1px; background:linear-gradient(90deg,transparent,rgba(108,224,255,.9),transparent); box-shadow:0 0 14px rgba(65,196,255,.45); pointer-events:none; }
    .close-button { position:absolute; z-index:2; top:14px; right:16px; width:38px; height:38px; border:0; border-radius:999px; color:#eef7ff; background:rgba(255,255,255,.07); font:300 30px/34px system-ui,sans-serif; cursor:pointer; }
    .close-button:hover { background:rgba(255,255,255,.13); }
    .expanded-header { padding:24px 30px 10px; }
    .expanded-brand { font-size:14px; }
    .expanded-title { margin-top:6px; font-size:28px; font-weight:720; letter-spacing:-.02em; }
    .expanded-current { padding-right:46px; font-size:34px; font-weight:700; font-variant-numeric:tabular-nums; letter-spacing:-.03em; }
    .expanded-body { padding:0 16px 4px; }
    .expanded-chart .weather-icon { transform-box: fill-box; }
    .expanded-footer { display:flex; align-items:center; flex-wrap:nowrap; padding:12px 30px 22px; font-size:13px; gap:16px; white-space:nowrap; overflow:hidden; }
    .expanded-footer .legend-dot { width:18px; flex-basis:18px; }
    .expanded-note { margin-left:auto; opacity:.58; }
    @keyframes auroraDrift {
      0%   { transform:translate3d(-1.2%, -.8%, 0) scale(1.015); background-position:0% 0%, 100% 0%, 0 0; }
      50%  { transform:translate3d(.6%, .4%, 0) scale(1.025); background-position:42% 18%, 62% 12%, 0 0; }
      100% { transform:translate3d(1.4%, -.4%, 0) scale(1.02); background-position:100% 8%, 0% 18%, 0 0; }
    }
    @keyframes auroraNightMove {
      0% {
        transform:translate3d(-7%, -2%, 0) scale(1.06);
        background-position:-20% 0%, 115% 0%, -10% 3%, 105% 2%, 0 0;
      }
      25% {
        transform:translate3d(-2%, 1%, 0) scale(1.075);
        background-position:18% 12%, 78% 18%, 30% 8%, 75% 14%, 0 0;
      }
      50% {
        transform:translate3d(3%, -1%, 0) scale(1.065);
        background-position:58% 4%, 42% 7%, 66% 18%, 38% 5%, 0 0;
      }
      75% {
        transform:translate3d(6%, .7%, 0) scale(1.08);
        background-position:92% 16%, 12% 12%, 104% 5%, 10% 18%, 0 0;
      }
      100% {
        transform:translate3d(8%, -2%, 0) scale(1.06);
        background-position:125% 5%, -25% 20%, 125% 15%, -20% 7%, 0 0;
      }
    }
    @keyframes auroraFade { from { opacity:0; } to { opacity:1; } }
    @keyframes auroraGrow { from { opacity:0; transform:scale(.86) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }

    @media (min-width: 600px) { .weather-icon { font-size: 17px; } .expanded-chart .weather-icon { transform-box: fill-box; } }
    @media (min-width: 900px) {
      header { padding: 20px 24px 8px; }
      .brand { font-size: 13px; }
      .title { font-size: 16px; }
      .current { font-size: 20px; }
      main { padding-inline: 14px; }
      footer { padding: 8px 24px 14px; font-size: 12px; }
    }
    @media (max-width: 680px) {
      footer { gap: 8px; padding: 8px 10px 11px; font-size: 10.5px; }
      footer .legend-item { gap: 4px; }
      footer .legend-dot { width: 12px; flex-basis: 12px; }
      footer .version { display: none; }
    }
    @media (max-width: 430px) {
      footer { gap: 6px; padding-inline: 8px; font-size: 9.5px; }
      footer .legend-dot { width: 10px; flex-basis: 10px; }
    }
    @media (max-height: 620px) and (min-width: 521px) {
      .expand-panel { max-height: 96vh; overflow-y:auto; overflow-x:hidden; }
    }
    @media (max-width: 520px) {
      .expand-backdrop { padding:8px; }
      .expand-panel { width:100%; max-height:96vh; border-radius:18px; }
      .expanded-header { padding:18px 18px 6px; }
      .expanded-title { font-size:21px; }
      .expanded-current { font-size:26px; padding-right:40px; }
      .expanded-body { padding:0 4px; }
      .expanded-footer { padding:10px 12px 16px; font-size:10.5px; gap:8px; flex-wrap:nowrap; }
      .expanded-footer .legend-dot { width:12px; flex-basis:12px; }
      .expanded-note { display:none; }
      header { padding-inline: 14px; }
      main { padding-inline: 2px; }
      .title { font-size: 15px; }
      .current { font-size: 18px; }
      svg { min-height: 0; }
    }
    .expanded-info{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;padding:8px 12px 12px}
    .info-tile{min-width:0;min-height:72px;box-sizing:border-box;display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:12px;border:1px solid rgba(20,154,232,.28);background:linear-gradient(180deg,rgba(10,42,65,.58),rgba(4,20,33,.72));box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 0 12px rgba(0,126,210,.06)}
    .metric-svg{flex:0 0 34px;width:34px;height:34px;overflow:visible;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px currentColor)}
    .metric-svg .metric-fill{fill:currentColor;stroke:currentColor}.metric-svg .metric-accent{fill:none;stroke:currentColor;stroke-width:3.4}
    .temp-svg{color:#ff7a1a;filter:drop-shadow(0 0 4px rgba(255,122,26,.55))}
    .temp-svg .temp-outline{fill:none;stroke:#f2f6fb;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
    .temp-svg .temp-liquid{fill:none;stroke:#ff7a1a;stroke-width:3.2;stroke-linecap:round}
    .temp-svg .temp-liquid-bulb{fill:#ff7a1a;stroke:#ffb15a;stroke-width:1.2}
    .temp-svg .temp-tick{fill:none;stroke:#f2f6fb;stroke-width:1.6;stroke-linecap:round;opacity:.95}
    .rain-svg{color:#28b9ff}.wind-svg{color:#20e879}.gust-svg{color:#d84cff}.humidity-svg{color:#2dcdf2}.pressure-svg{color:#d9e3ec}.sun-svg{color:#ffc400}
    .wind-direction{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#d7e3ec}
    .dir-arrow{position:relative;display:inline-block;width:3px;height:13px;border-radius:2px;background:#d7e3ec;transform-origin:50% 50%;filter:drop-shadow(0 0 3px rgba(210,235,255,.7))}
    .dir-arrow::before{content:"";position:absolute;left:50%;top:-2px;width:7px;height:7px;border-left:2px solid #d7e3ec;border-top:2px solid #d7e3ec;transform:translateX(-50%) rotate(45deg)}
    .info-label{color:#cbd5df;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.info-value{color:#f5f8fb;font-size:18px;line-height:1.15;white-space:nowrap}.info-value small{font-size:10px;color:#c8d2dc}.info-sub{margin-top:2px;color:#aeb9c6;font-size:9px}.sun-value{font-size:13px}
    @media(max-width:900px){.expanded-info{grid-template-columns:repeat(4,minmax(0,1fr))}}

  `;
}


if (!customElements.get('aurora-weather-card-editor-v1-3-0')) {
  customElements.define('aurora-weather-card-editor-v1-3-0', AuroraWeatherCardEditor);
}

if (!customElements.get('aurora-weather-card')) {
  customElements.define('aurora-weather-card', AuroraWeatherCard);
}

// Register Aurora Weather Card v1.3.0 in the Home Assistant card picker.
window.customCards = window.customCards || [];
const auroraPickerEntry = {
  type: 'aurora-weather-card',
  name: 'Aurora Weather Card v1.3.0',
  preview: false,
  description: '24/48-timers værkort med temperatur, nedbør, vind, vindkast og Aurora-bakgrunn',
  getEntitySuggestion: (_hass, entityId) => {
    if (!entityId || !entityId.startsWith('weather.')) return null;
    return {
      config: {
        type: 'custom:aurora-weather-card',
        entity: entityId,
        hours: 48,
        theme: 'aurora_dynamic',
      },
    };
  },
};
const existingAuroraIndex = window.customCards.findIndex((card) => card.type === 'aurora-weather-card');
if (existingAuroraIndex >= 0) window.customCards.splice(existingAuroraIndex, 1, auroraPickerEntry);
else window.customCards.push(auroraPickerEntry);

console.info('%c AURORA WEATHER CARD v1.3.0 %c stable ', 'color:#fff;background:#1577d3;font-weight:700', 'color:#1577d3;background:#fff');
