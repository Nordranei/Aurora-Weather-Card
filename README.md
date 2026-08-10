# Aurora Weather Card

A premium weather card for Home Assistant.

Aurora Weather Card combines modern weather visualization with a calm Scandinavian-inspired design.

> Information first. Atmosphere second.

## Features

- Temperature forecast graph
- Precipitation graph with dynamic scale
- Wind and wind-gust graphs
- Wind direction indicators
- Wind values displayed in m/s
- Hourly weather icons
- 24 / 48 hour forecast
- Responsive desktop, tablet and mobile layout
- Expandable detailed 48-hour view
- Weather information tiles in expanded view
- Visual configuration editor
- Aurora Static
- Aurora Dynamic Atmosphere
- Day atmosphere
- Animated Northern Lights night atmosphere
- Seasonal atmosphere support

## Weather data

Aurora Weather Card currently uses a Home Assistant `weather.*` entity as its data source.
MET Norway / Met.no is recommended, but another compatible Home Assistant weather entity can be used.

## Installation

### HACS

When installed through HACS, Aurora Weather Card uses:

`aurora-weather-card.js`

### Manual installation

Copy:

`dist/aurora-weather-card.js`

to:

`/config/www/aurora-weather-card/aurora-weather-card.js`

Add the Lovelace resource:

`/local/aurora-weather-card/aurora-weather-card.js`

Resource type:

`JavaScript module`

Reload the browser resources or restart Home Assistant if necessary.

## Example

```yaml
type: custom:aurora-weather-card
entity: weather.home
location_name: Home
hours: 48
theme: aurora_dynamic
```

## Configuration

| Option | Description |
| --- | --- |
| `entity` | Home Assistant `weather.*` entity |
| `location_name` | Custom location name shown in the card |
| `hours` | Forecast period, 24 or 48 hours |
| `theme` | Aurora theme/background selection |

## v1.2 highlights

Version 1.2 completes the dynamic atmosphere work planned after the first public release:

- Refined compact card layout
- Expanded 48-hour view
- Improved graph spacing and scales
- Dynamic precipitation scaling
- Wind direction row
- Expanded-view weather information tiles
- Code-based inline SVG metric icons
- Aurora Dynamic Atmosphere
- Animated Northern Lights night mode
- Day atmosphere
- Seasonal atmosphere support
- Responsive refinements for desktop, tablet and mobile

## Compatibility

- Home Assistant 2026.8+
- Sections Dashboard
- Masonry Dashboard
- Light Theme
- Dark Theme
- Desktop
- Tablet
- Mobile

## Design Philosophy

Aurora Weather Card was created around one simple idea:

> Information first. Atmosphere second.

The weather should always be easy to read. Visual effects should support the information, never compete with it.

## Credits

Created by Arne Aleksandersen.

Designed and developed in collaboration with OpenAI ChatGPT through extensive real-world testing in Home Assistant.

## License

MIT License
