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

function weatherIcon(condition) {
  const icons = {
    'clear-night': '🌙',
    'cloudy': '☁️',
    'exceptional': '⚠️',
    'fog': '☁️',
    'hail': '🌨️',
    'lightning': '⚡️',
    'lightning-rainy': '⛈️',
    'partlycloudy': '⛅️',
    'pouring': '🌧️',
    'rainy': '🌧️',
    'snowy': '❄️',
    'snowy-rainy': '🌨️',
    'sunny': '☀️',
    'windy': '💨',
    'windy-variant': '💨',
  };
  return icons[condition] || '☁️';
}


class AuroraWeatherCard extends LitElement {
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
        hours: 'Antall timer',
        theme: 'Bakgrunn',
      }[schema.name]),
      computeHelper: (schema) => schema.name === 'location_name'
        ? 'Valgfritt. Hvis feltet er tomt brukes navnet fra værentiteten.'
        : undefined,
    };
  }

  static getStubConfig() {
    return {
      entity: '',
      location_name: '',
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
    return this.forecast
      .slice(0, hours)
      .map((item) => ({
        time: new Date(item.datetime),
        temperature: Number(item.temperature),
        precipitation: Number(item.precipitation ?? 0),
        windSpeed: Number(item.wind_speed),
        windGust: Number(item.wind_gust_speed),
        condition: item.condition || 'cloudy',
      }))
      .filter((item) => Number.isFinite(item.time.getTime()) && Number.isFinite(item.temperature));
  }


  atmosphereClass() {
    if (this.config?.theme === 'aurora_static') return 'atmosphere-static';
    const entityState = this.hass?.states?.[this.config?.entity];
    const condition = String(entityState?.state || 'cloudy');
    const month = new Date().getMonth() + 1;
    const season = [12, 1, 2].includes(month) ? 'winter'
      : [3, 4, 5].includes(month) ? 'spring'
      : [6, 7, 8].includes(month) ? 'summer' : 'autumn';
    const sunState = this.hass?.states?.['sun.sun']?.state;
    const hour = new Date().getHours();
    const isNight = sunState ? sunState === 'below_horizon' : (hour < 6 || hour >= 21 || condition === 'clear-night');
    const weather = condition.includes('rain') || condition === 'pouring' ? 'rain'
      : condition.includes('snow') || condition === 'hail' ? 'snow'
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

  renderGraph(expanded = false) {
    const data = this.graphData();
    if (data.length < 2) return html`<div class="message">For få temperaturpunkter til å tegne graf.</div>`;

    const measuredWidth = expanded
      ? Math.max(640, Math.min(1320, Math.round(window.innerWidth * 0.88)))
      : (Number(this.containerWidth) || 760);
    const profile = measuredWidth < 600 ? 'mobile' : measuredWidth < 1000 ? 'tablet' : 'desktop';
    const width = Math.max(320, Math.min(1600, measuredWidth - 20));
    const height = expanded
      ? (profile === 'mobile' ? 330 : profile === 'tablet' ? 430 : 500)
      : (profile === 'mobile' ? 174 : profile === 'tablet' ? 206 : 238);
    const left = profile === 'mobile' ? 38 : profile === 'tablet' ? 48 : 58;
    const right = profile === 'mobile' ? 12 : profile === 'tablet' ? 20 : 28;
    const top = expanded
      ? (profile === 'mobile' ? 78 : profile === 'tablet' ? 88 : 96)
      : (profile === 'mobile' ? 52 : profile === 'tablet' ? 58 : 62);
    const bottom = expanded
      ? (profile === 'mobile' ? 40 : profile === 'tablet' ? 46 : 52)
      : (profile === 'mobile' ? 29 : profile === 'tablet' ? 33 : 37);
    const gap = expanded ? (profile === 'mobile' ? 10 : 12) : (profile === 'mobile' ? 18 : 20);
    const available = height - top - bottom - gap;
    const weatherHeight = expanded ? available * 0.66 : available * 0.68;
    const windHeight = expanded ? available * 0.34 : available * 0.32;
    const weatherBottom = top + weatherHeight;
    const windTop = weatherBottom + gap;
    const windBottom = windTop + windHeight;
    const plotWidth = width - left - right;

    const rawMin = Math.min(...data.map((d) => d.temperature));
    const rawMax = Math.max(...data.map((d) => d.temperature));
    let minTemp = Math.floor(rawMin - 1);
    let maxTemp = Math.ceil(rawMax + 1);
    if (maxTemp - minTemp < 4) {
      const mid = (maxTemp + minTemp) / 2;
      minTemp = Math.floor(mid - 2);
      maxTemp = Math.ceil(mid + 2);
    }

    const x = (index) => left + (index / (data.length - 1)) * plotWidth;
    const yTemp = (temperature) => top + ((maxTemp - temperature) / (maxTemp - minTemp)) * weatherHeight;
    const tempPoints = data.map((d, index) => ({ x: x(index), y: yTemp(d.temperature) }));
    const tempPath = smoothPath(tempPoints);

    const maxRainRaw = Math.max(...data.map((d) => Number.isFinite(d.precipitation) ? d.precipitation : 0), 0);
    const maxRain = Math.max(1, Math.ceil(maxRainRaw * 2) / 2);
    const rainY = (value) => top + ((maxRain - value) / maxRain) * weatherHeight;
    // Full precipitation scale on the right side in both compact and expanded views.
    // Use five evenly spaced labels, rounded to one decimal where necessary.
    const rainTicks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((ratio) =>
      Math.round((maxRain * ratio) * 10) / 10
    ))].sort((a, b) => a - b);
    const barStep = plotWidth / Math.max(1, data.length - 1);
    const barWidth = Math.max(2.2, Math.min(11, barStep * 0.60));

    const validWind = data.filter((d) => Number.isFinite(d.windSpeed));
    const validGust = data.filter((d) => Number.isFinite(d.windGust));
    const maxWindRaw = Math.max(
      ...validWind.map((d) => d.windSpeed),
      ...validGust.map((d) => d.windGust),
      0,
    );
    const maxWind = expanded
      ? Math.max(2, Math.ceil(maxWindRaw / 2) * 2)
      : Math.max(10, Math.ceil(maxWindRaw / 10) * 10);
    const yWind = (value) => windBottom - (Math.max(0, value) / maxWind) * windHeight;
    // Compact view intentionally uses fewer wind labels to keep the two graph
    // areas visually separated. Expanded view keeps the detailed scale.
    const windTicks = expanded
      ? [...new Set([0, .2, .4, .6, .8, 1].map((ratio) => Math.round(maxWind * ratio)))].sort((a, b) => a - b)
      : [...new Set([0, Math.round((maxWind / 2) / 5) * 5, maxWind])].sort((a, b) => a - b);
    const windPoints = data
      .map((d, index) => ({ x: x(index), y: Number.isFinite(d.windSpeed) ? yWind(d.windSpeed) : null }))
      .filter((p) => p.y !== null);
    const windPath = windPoints.length > 1 ? smoothPath(windPoints) : '';
    const gustPoints = data
      .map((d, index) => ({ x: x(index), y: Number.isFinite(d.windGust) ? yWind(d.windGust) : null }))
      .filter((p) => p.y !== null);
    const gustPath = gustPoints.length > 1 ? smoothPath(gustPoints) : '';

    const step = maxTemp - minTemp <= 8 ? 1 : 2;
    const yTicks = [];
    for (let value = minTemp; value <= maxTemp; value += step) yTicks.push(value);

    const pointSpacing = plotWidth / Math.max(1, data.length - 1);
    const targetLabelSpacing = profile === 'mobile' ? 46 : profile === 'tablet' ? 58 : 68;
    const labelEvery = Math.max(1, Math.ceil(targetLabelSpacing / Math.max(1, pointSpacing)));
    const timeLabels = data
      .map((d, index) => ({ d, index }))
      .filter(({ index }) => index % labelEvery === 0 || index === data.length - 1);

    const dayStarts = data
      .map((d, index) => ({ d, index }))
      .filter(({ d, index }) => index === 0 || d.time.getDate() !== data[index - 1].time.getDate());
    const daySegments = dayStarts.map((start, i) => ({
      ...start,
      endIndex: i < dayStarts.length - 1 ? dayStarts[i + 1].index - 1 : data.length - 1,
    }));

    const iconEvery = profile === 'mobile' ? Math.max(2, labelEvery) : Math.max(2, Math.ceil(labelEvery / 1.7));
    const iconPoints = data
      .map((d, index) => ({ d, index }))
      .filter(({ index }) => index % iconEvery === 0 || index === data.length - 1);

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
            <text class="day-label" x="${(x(index) + x(endIndex)) / 2}" y="${Math.max(18, top - 34)}" text-anchor="middle">${new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }).format(d.time)}</text>
          `)}

          ${iconPoints.map(({ d, index }) => svg`
            <text class="weather-icon" x="${x(index)}" y="${top - 10}" text-anchor="middle">${weatherIcon(d.condition)}</text>
          `)}

          ${timeLabels.map(({ index }) => svg`
            <line class="time-grid weather-time-grid" x1="${x(index)}" y1="${top}" x2="${x(index)}" y2="${weatherBottom}"></line>
            <line class="time-grid wind-time-grid" x1="${x(index)}" y1="${windTop}" x2="${x(index)}" y2="${windBottom}"></line>
          `)}

          <text class="rain-unit-label" x="${width - 4}" y="${top - 8}" text-anchor="end">mm</text>
          ${rainTicks.map((value) => svg`
            <text class="rain-axis-label rain-axis-blue" x="${width - 4}" y="${rainY(value) + 4}" text-anchor="end">${Number.isInteger(value) ? value : value.toFixed(1)}</text>
          `)}

          ${data.map((d, index) => {
            const value = Number.isFinite(d.precipitation) ? d.precipitation : 0;
            const yy = rainY(value);
            return svg`<rect class="rain-bar" x="${x(index) - barWidth / 2}" y="${yy}" width="${barWidth}" height="${Math.max(0, weatherBottom - yy)}" rx="1.4"></rect>`;
          })}

          <path class="temperature-area" d="${tempPath} L ${tempPoints.at(-1).x} ${weatherBottom} L ${tempPoints[0].x} ${weatherBottom} Z"></path>
          <path class="temperature-line" d="${tempPath}" filter="url(#softGlow)"></path>

          <line class="wind-separator" x1="${left}" y1="${windTop - gap / 2}" x2="${width - right}" y2="${windTop - gap / 2}"></line>
          ${windTicks.map((value) => svg`
            <line class="wind-grid" x1="${left}" y1="${yWind(value)}" x2="${width - right}" y2="${yWind(value)}"></line>
            <text class="wind-axis-label" x="${left - 10}" y="${yWind(value) + 4}" text-anchor="end">${value}</text>
          `)}
          ${expanded ? svg`<text class="wind-unit-label" x="${left - 10}" y="${windTop - 10}" text-anchor="end">m/s</text>` : nothing}
          ${windPath ? svg`<path class="wind-line" d="${windPath}" filter="url(#softGlow)"></path>` : nothing}
          ${gustPath ? svg`<path class="gust-line" d="${gustPath}" filter="url(#softGlow)"></path>` : nothing}

          ${timeLabels.map(({ d, index }) => svg`
            <text class="time-label" x="${x(index)}" y="${height - 11}" text-anchor="middle">${String(d.time.getHours()).padStart(2, '0')}</text>
          `)}
        </svg>
      </div>
    `;
  }

  render() {
    if (!this.config) return nothing;
    const entityState = this.config.entity ? this.hass?.states[this.config.entity] : undefined;
    const name = this.config.location_name || entityState?.attributes?.friendly_name || this.config.entity || 'Velg værkilde';
    const current = this.graphData()[0];
    const atmosphere = this.atmosphereClass();

    if (!this.config.entity) {
      return html`<ha-card class="compact-card ${atmosphere}"><header><div><div class="brand"><span class="aurora-mark" aria-hidden="true"></span><span>Aurora</span></div><div class="title">Velg værkilde</div></div></header><main><div class="message">Velg en <b>weather.*</b>-entitet i korteditoren.</div></main></ha-card>`;
    }

    return html`
      <ha-card class="compact-card ${atmosphere}" @click=${() => this.openExpanded()} title="Trykk for stor visning">
        <header>
          <div>
            <div class="brand"><span class="aurora-mark" aria-hidden="true"></span><span>Aurora</span></div>
            <div class="title">${name}</div>
          </div>
          ${current ? html`<div class="current">${current.temperature.toFixed(1)}°</div>` : nothing}
        </header>

        <main>
          ${this.status === 'loading' ? html`<div class="message">Henter timeprognose …</div>` : nothing}
          ${this.status === 'error' ? html`<div class="message error"><b>Feil:</b> ${this.errorMessage}</div>` : nothing}
          ${this.status === 'ok' ? this.renderGraph(false) : nothing}
        </main>

        <footer>
          <span class="legend-item"><span class="legend-dot temp"></span><span>Temperatur</span></span>
          <span class="legend-item"><span class="legend-dot rain"></span><span>Nedbør</span></span>
          <span class="legend-item"><span class="legend-dot wind"></span><span>Vind</span></span>
          <span class="legend-item"><span class="legend-dot gust"></span><span>Vindkast</span></span>
          <span class="version">v1.0</span>
        </footer>
      </ha-card>

      ${this.expanded ? html`
        <div class="expand-backdrop" @click=${() => this.closeExpanded()}>
          <section class="expand-panel ${atmosphere}" role="dialog" aria-modal="true" aria-label="Utvidet værvarsel" @click=${(event) => event.stopPropagation()}>
            <button class="close-button" aria-label="Lukk stor visning" @click=${() => this.closeExpanded()}>×</button>
            <header class="expanded-header">
              <div>
                <div class="brand expanded-brand"><span class="aurora-mark" aria-hidden="true"></span><span>Aurora</span></div>
                <div class="expanded-title">${name}</div>
              </div>
              ${current ? html`<div class="expanded-current">${current.temperature.toFixed(1)}°</div>` : nothing}
            </header>
            <div class="expanded-body">${this.renderGraph(true)}</div>
            <footer class="expanded-footer">
              <span class="legend-item"><span class="legend-dot temp"></span><span>Temperatur</span></span>
              <span class="legend-item"><span class="legend-dot rain"></span><span>Nedbør</span></span>
              <span class="legend-item"><span class="legend-dot wind"></span><span>Vind</span></span>
              <span class="legend-item"><span class="legend-dot gust"></span><span>Vindkast</span></span>
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
    ha-card::before, .expand-panel::after { content:''; position:absolute; inset:0; pointer-events:none; opacity:0; transition:opacity .5s ease; }
    ha-card.atmosphere-dynamic::before, .expand-panel.atmosphere-dynamic::after { opacity:1; }
    .season-spring::before, .expand-panel.season-spring::after { background: radial-gradient(75% 55% at 15% 0%, rgba(72,190,156,.055), transparent 70%); }
    .season-summer::before, .expand-panel.season-summer::after { background: radial-gradient(75% 55% at 82% 0%, rgba(255,204,92,.060), transparent 72%); }
    .season-autumn::before, .expand-panel.season-autumn::after { background: radial-gradient(75% 55% at 80% 0%, rgba(210,138,62,.050), transparent 70%); }
    .season-winter::before, .expand-panel.season-winter::after { background: radial-gradient(80% 60% at 20% 0%, rgba(83,166,235,.065), transparent 72%); }
    .weather-rain::before, .expand-panel.weather-rain::after { background: linear-gradient(155deg, rgba(35,92,132,.075), transparent 58%), radial-gradient(70% 70% at 75% 0%, rgba(74,138,180,.045), transparent 72%); }
    .weather-sunny::before, .expand-panel.weather-sunny::after { background: radial-gradient(60% 65% at 90% 0%, rgba(255,196,90,.085), transparent 72%); }
    .weather-snow::before, .expand-panel.weather-snow::after { background: radial-gradient(70% 60% at 75% 0%, rgba(205,235,255,.070), transparent 72%); }
    .night.weather-clear::before, .night.weather-partlycloudy::before,
    .expand-panel.night.weather-clear::after, .expand-panel.night.weather-partlycloudy::after {
      background:
        radial-gradient(48% 32% at 22% 8%, rgba(62,226,170,.085), transparent 70%),
        radial-gradient(45% 30% at 62% 2%, rgba(103,86,255,.070), transparent 72%),
        linear-gradient(180deg, rgba(7,14,28,.08), transparent 65%);
    }
    ha-card > *, .expand-panel > * { position:relative; z-index:1; }
    .compact-card { cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
    .compact-card:hover { border-color: rgba(72,190,255,.34); box-shadow: inset 0 1px 0 rgba(255,255,255,.045), 0 8px 22px rgba(0,0,0,.18); }
    .compact-card:active { transform: scale(.995); }
    header { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 15px 18px 5px; }
    header::after { content: ''; position: absolute; left: 18px; right: 18px; bottom: -1px; height: 1px; background: linear-gradient(90deg, transparent, rgba(77,181,255,.13), transparent); }
    .brand { display:flex; align-items:center; gap:7px; color: var(--secondary-text-color); font-size: 12px; font-weight: 600; letter-spacing: .02em; }
    .aurora-mark { width: 16px; height: 8px; border-radius: 80% 20% 75% 25% / 60% 40% 60% 40%; background: linear-gradient(90deg, #30c8ff, #65e2b1); transform: skewX(-20deg) rotate(-7deg); box-shadow: 0 0 10px rgba(48,200,255,.18); }
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
    .rain-axis-blue { fill: #2aa8ff; font-weight: 650; }
    .weather-icon { font-family: "Segoe UI Emoji", "Apple Color Emoji", sans-serif; font-size: 16px; dominant-baseline: middle; filter: drop-shadow(0 2px 2px rgba(0,0,0,.42)); }
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

    .expand-backdrop { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 22px; box-sizing: border-box; background: rgba(3,7,12,.72); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); animation: auroraFade .20s ease-out both; }
    .expand-panel { --primary-text-color:#f4f8fc; --secondary-text-color:#aeb9c6; --secondary-background-color:rgba(255,255,255,.06); color:#f4f8fc; position: relative; width: min(1240px, 94vw); max-height: 92vh; overflow: auto; box-sizing: border-box; border-radius: 24px; background: radial-gradient(110% 80% at 75% 0%, rgba(25,124,178,.16), transparent 48%), linear-gradient(145deg, rgba(20,29,39,.995), rgba(8,14,21,.995)); border: 1px solid rgba(83,191,255,.34); box-shadow: 0 28px 80px rgba(0,0,0,.58), inset 0 1px 0 rgba(255,255,255,.07); animation: auroraGrow .24s cubic-bezier(.2,.8,.2,1) both; }
    .expand-panel::before { content:''; position:absolute; inset:0 8% auto; height:1px; background:linear-gradient(90deg,transparent,rgba(108,224,255,.9),transparent); box-shadow:0 0 14px rgba(65,196,255,.45); pointer-events:none; }
    .close-button { position:absolute; z-index:2; top:14px; right:16px; width:38px; height:38px; border:0; border-radius:999px; color:#eef7ff; background:rgba(255,255,255,.07); font:300 30px/34px system-ui,sans-serif; cursor:pointer; }
    .close-button:hover { background:rgba(255,255,255,.13); }
    .expanded-header { padding:24px 30px 10px; }
    .expanded-brand { font-size:14px; }
    .expanded-title { margin-top:6px; font-size:28px; font-weight:720; letter-spacing:-.02em; }
    .expanded-current { padding-right:46px; font-size:34px; font-weight:700; font-variant-numeric:tabular-nums; letter-spacing:-.03em; }
    .expanded-body { padding:0 16px 4px; }
    .expanded-chart .weather-icon { font-size:24px; }
    .expanded-footer { display:flex; align-items:center; flex-wrap:nowrap; padding:12px 30px 22px; font-size:13px; gap:16px; white-space:nowrap; overflow:hidden; }
    .expanded-footer .legend-dot { width:18px; flex-basis:18px; }
    .expanded-note { margin-left:auto; opacity:.58; }
    @keyframes auroraFade { from { opacity:0; } to { opacity:1; } }
    @keyframes auroraGrow { from { opacity:0; transform:scale(.86) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }

    @media (min-width: 600px) { .weather-icon { font-size: 17px; } .expanded-chart .weather-icon { font-size:24px; } }
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
  `;
}


if (!customElements.get('aurora-weather-card')) {
  customElements.define('aurora-weather-card', AuroraWeatherCard);
}

// Register Aurora Weather Card in the Home Assistant card picker.
window.customCards = window.customCards || [];
const auroraPickerEntry = {
  type: 'aurora-weather-card',
  name: 'Aurora Weather Card',
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

console.info('%c AURORA WEATHER CARD %c v1.0 ', 'color:#fff;background:#1577d3;font-weight:700', 'color:#1577d3;background:#fff');
