# Aurora Weather Card v1.3.1

This maintenance release addresses the two issues raised in HACS default catalog review #9888.

- Lit is bundled in `aurora-weather-card.js`. Loading the card no longer requires jsDelivr.
- Hourly forecasts update through Home Assistant's `weather/subscribe_forecast` subscription.
- Subscriptions are cleaned up when the card disconnects or the weather entity changes.
- Late responses from previous subscriptions are ignored, and failed subscription attempts are retried.
- Both compact and expanded views follow forecast updates.

Existing card configuration, graph options and appearance are preserved.

## Update

Update through HACS once this release is published, then fully reload the dashboard on each device.
Keep `type: custom:aurora-weather-card` and the existing weather entity.

For manual installation, back up and replace the existing `aurora-weather-card.js` with the supplied file.
If a matching `.js.gz` file exists, remove it from the active filename or regenerate it from the new file;
an old compressed copy can cause stale code to be served. Keep one Aurora resource registered as a
JavaScript module and use a fresh URL query such as `?v=1.3.1` to refresh browser caches.

## Validation

Build and syntax checks, five subscription lifecycle tests and 256 graph regression cases passed.
Browser tests verified rendering without external requests and forecast redraws with the expanded view open.
The underlying fixes were tested on a real Home Assistant installation. The user confirmed rendering and
forecast updates in both views on desktop browsers and a Samsung Galaxy Tab S10 Lite.
An overnight stability test has not been performed.
