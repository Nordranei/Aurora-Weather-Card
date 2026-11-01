# Internationalization — step 1

Base: v1.3.1 (`13a587660c6b072b0af6025fa6e37a2c697406ee`).
Development branch: `dev/v1.3.1-i18n`. No stable release is changed.

Goal: translate the card and editor into every language supported by Home Assistant.
This first test build is NOT a complete translation of the interface.

## Implemented

- Effective Home Assistant user language, with regional locale support.
- Home Assistant's translated temperature, precipitation, wind, gust, humidity,
  pressure and compass labels. No language allowlist and no translation service.
- These labels are used in legends, relevant information tiles and graph controls.
- Localized displayed dates and times, preserving location time zones and 24-hour clocks.
- Locale-aware weather entity sorting.
- English fallback when a Home Assistant translation is unavailable; retained
  Norwegian Bokmål fallback for `nb`/`no`.

Reference: https://contributors.home-assistant.io/frontend/custom-ui/card/
Translation keys: https://github.com/home-assistant/frontend/blob/dev/src/translations/en.json

## Validation

- `node --test tests/*.test.mjs`: language selection, fallback, switching languages,
  rendered labels/date output, forecast subscription behavior.
- `node tests/graph-regression.cjs`: 256 graph combinations and configuration compatibility.
- `node build.mjs`: self-contained distribution with no external imports.

## Home Assistant test, one step at a time

Use a separate test Home Assistant environment with the development distribution.
The public element name remains `custom:aurora-weather-card`; do not load stable
and development resources together in one browser session.

1. Load `dist/aurora-weather-card.js` as a JavaScript module resource.
2. Add Aurora with a working weather entity. Confirm the dev version is displayed.
3. Change the Home Assistant profile language to English, German, then Norwegian.
4. Check legend labels, wind direction, date headings and the four weather labels
   in the Graph tab. Confirm forecast values and graph switches still work.

## Remaining steps

- Extract and translate Aurora-specific editor headings, help, status/error text,
  accessibility labels and remaining information tiles.
- Inventory supported HA languages and track actual translation coverage per key.
  English fallback must not be reported as a completed translation.
- Verify right-to-left presentation, long labels and narrow-screen layouts.
- Verify localized number and user time-format preferences separately.
- Full visual verification inside Home Assistant before a release.
