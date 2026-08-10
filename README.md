\# Aurora Weather Card



A premium weather card for Home Assistant.



Aurora Weather Card combines modern weather visualization with a calm Scandinavian-inspired design.



> \*\*Information first. Atmosphere second.\*\*



\## Screenshots



\### Expanded 48-hour view



!\[Aurora Weather Card v1.2 expanded dark](screenshots/aurora-v1.2-expanded-dark.png)



\### Compact view



!\[Aurora Weather Card v1.2 compact dark](screenshots/aurora-v1.2-compact-dark.png)



\### Light mode



!\[Aurora Weather Card v1.2 compact light](screenshots/aurora-v1.2-compact-light.png)



!\[Aurora Weather Card v1.2 expanded light](screenshots/aurora-v1.2-expanded-light.png)



\## Features



\- Temperature forecast graph

\- Precipitation graph with dynamic scale

\- Wind and wind-gust graphs

\- Wind direction indicators

\- Wind values displayed in m/s

\- Hourly weather icons

\- 24 / 48 hour forecast

\- Responsive desktop, tablet and mobile layout

\- Expandable detailed 48-hour view

\- Weather information tiles in expanded view

\- Visual configuration editor

\- Aurora Static

\- Aurora Dynamic Atmosphere

\- Day atmosphere

\- Animated Northern Lights night atmosphere

\- Seasonal atmosphere support



\## Weather data



Aurora Weather Card currently uses a Home Assistant `weather.\*` entity as its data source.



MET Norway / Met.no is recommended, but another compatible Home Assistant weather entity can be used.



\## Installation



\### HACS



Install \*\*Aurora Weather Card\*\* through HACS.



The card uses:



`aurora-weather-card.js`



After installation, reload Home Assistant if necessary.



\### Manual installation



Copy:



`dist/aurora-weather-card.js`



to:



`/config/www/aurora-weather-card/aurora-weather-card.js`



Add the Lovelace resource:



`/local/aurora-weather-card/aurora-weather-card.js`



Resource type:



`JavaScript module`



Reload the browser resources or restart Home Assistant if necessary.



\## Example



```yaml

type: custom:aurora-weather-card

entity: weather.home

location\_name: Home

hours: 48

theme: aurora\_dynamic

