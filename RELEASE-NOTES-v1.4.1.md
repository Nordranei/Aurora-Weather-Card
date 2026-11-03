# Aurora Weather Card v1.4.1

## What's new
- Automatic, Light and Dark appearance modes in compact and expanded views.
- Optional direct Open-Meteo forecasts for a selected place, without a Home Assistant weather entity. The existing entity source remains the default.
- Missing gust data no longer leaves a gust legend; axes, grid and plot allocation follow graph choices.
- Forecast receipt date/time in both views and clearer place-search guidance.
- English, Norwegian Bokmål and German card/editor translations. Other languages use English for Aurora-specific messages and Home Assistant weather translations where available.
- Original Aurora night atmosphere retained.

## Upgrade
Update through HACS and reload the dashboard on each device. Keep `type: custom:aurora-weather-card` and your existing weather entity. Select Dark to retain an always-dark card; Automatic follows Home Assistant.

Manual installation: replace the existing resource with the attached `aurora-weather-card.js`, use a fresh query such as `?v=1.4.1`, and replace/remove any old precompressed copy that could serve stale code. The isolated I18N TEST card remains separate from the stable card.

Direct weather is opt-in under Settings → Weather source type. Selected coordinates are sent from the browser to Open-Meteo. The free API is for non-commercial use, including personal home automation. It refreshes every 30 minutes while open, uses a per-page cache, and retries failures after 5 minutes. Displayed update time is receipt time, not provider issue time. Direct data uses °C, mm and m/s. See [Open-Meteo terms](https://open-meteo.com/en/terms).

## Validation
18 unit tests and 256 graph cases passed, plus missing/null/zero-gust cases. Real Edge browser tests passed for appearance, localization, forecast lifecycle and isolated-card coexistence. A live Open-Meteo request returned 48 forecast hours for Berlin. The development build was installed and visually checked in Home Assistant; the source selector and entity forecast were verified there. Full direct-source lifecycle and mobile app behavior have not been independently tested on every Home Assistant client.
