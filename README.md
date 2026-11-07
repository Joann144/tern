# Tern

A privacy-first map and navigation app that runs as a single HTML file. No tracking, no account, no build step, no API key for the core features.

Built on OpenStreetMap data through open services, with optional live traffic from TomTom.

## What works

| Feature | Source | Key needed |
|---|---|---|
| Street maps, light and dark | OpenFreeMap vector tiles | no |
| Address and place search | Photon | no |
| Reverse geocoding (click the map) | Photon | no |
| Driving routes with turn-by-turn | OSRM | no |
| Walking and cycling routes | Valhalla | no |
| Backup router if the primary fails | Valhalla | no |
| GPS position and follow mode | browser Geolocation | no |
| Navigation HUD, ETA, distance, speed | computed locally | no |
| Live traffic flow | TomTom raster flow tiles | yes |
| Incidents and road closures | TomTom Incident Details v5 | yes |

## Running it

Open `docs/index.html` in Chrome, Edge or Firefox.

**Serve it instead of opening the file directly if you want GPS to work properly.** Browsers treat a `file://` page as having no origin, so Chrome will not remember location permission and re-prompts every load.

```bash
cd docs
python -m http.server 8000
# then open http://localhost:8000
```

## Live traffic setup

1. Create a free account at https://my.tomtom.com
2. Products, then create a new free SDK key
3. Under the key's permissions, enable **Traffic API**, or tick All
4. In the app, click the gear icon, paste the key, press Save

The free tier is 2,500 requests a day. The app counts its own usage, shows it in the footer, warns at 80%, and stops calling at the limit. It also pauses polling while the tab is in the background.

The key is stored in that browser's localStorage only. It is never sent anywhere except TomTom.

## Building

`docs/index.html` is generated. Edit the files in `src/`, then:

```bash
python build.py
```

This inlines MapLibre, the stylesheet and the app into one self-contained file with no external dependencies except the map and traffic data.

## Testing

```bash
node test/harness.mjs
```

Runs the real application code against a stubbed DOM, canvas and map, with mocked API responses. Covers:

- unit formatting, polyline6 decoding round-trip
- OSRM parsing and turn instruction text
- Valhalla parsing, shape decoding, maneuver positions
- TomTom incident parsing, category and colour mapping, null handling
- the service self-test
- navigation HUD, manual stepping, GPS auto-advance, and refusal to advance on a non-live fix
- automatic fallback to the backup router
- network timeouts, retries with backoff, HTTP error text, offline detection
- free-tier quota accounting and background-tab suppression

## Layout

```
src/shell.html   markup and element ids
src/style.css    all styling, light and dark themes
src/app.js       all application logic
vendor/          MapLibre GL JS 5.24.0, BSD-3-Clause
build.py         inlines everything into docs/index.html
test/harness.mjs headless test suite
docs/index.html  the built, shippable file
```

## Keyboard

| Key | Action |
|---|---|
| `/` | focus search |
| `t` | toggle light and dark |
| `g` | GPS and follow mode |
| `→` or space | next step while navigating |
| `←` | previous step |
| `Esc` | close panels, exit navigation |

## Known limits

- No voice guidance
- No business listings, opening hours or reviews. Search covers addresses and places only
- No offline maps
- No saved places or multi-stop routes
- Traffic requires a TomTom key and is subject to their free tier

## Attribution

Map data © OpenStreetMap contributors (ODbL). Tiles by OpenFreeMap. Geocoding by Photon. Routing by OSRM and Valhalla. Traffic by TomTom. Rendering by MapLibre GL JS (BSD-3-Clause).
