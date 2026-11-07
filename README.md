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
| Public transport: bus, train, tram, ferry | Transitous (MOTIS) | no |
| Real-time delays from GTFS-RT | Transitous (MOTIS) | no |
| Live departure board at your boarding stop | Transitous (MOTIS) | no |
| Alternative routes, labelled by road | OSRM and Valhalla | no |
| Traffic lights and stop signs on your route | Overpass, OpenStreetMap | no |
| Side-by-side time for all four modes | all of the above, in parallel | no |
| GPS position and follow mode | browser Geolocation | no |
| Approximate position when there is no GPS | ipwho.is, then ipapi.co | no |
| Navigation HUD, ETA, distance, speed | computed locally | no |
| Live traffic flow | TomTom raster flow tiles | yes |
| Incidents and road closures | TomTom Incident Details v5 | yes |

## Driving

Position is snapped onto the route itself, so every figure is measured along the road rather than as the crow flies: distance to the next turn, distance remaining, progress and the arrival estimate all derive from how far along the line you actually are. The step you see is the manoeuvre you are driving towards, not the one behind you. Leaving the route is detected and said plainly.

Traffic lights and stop signs on your route are fetched from OpenStreetMap through Overpass, filtered to those within 25 m of the line, and drawn in order along it, with a count in the planner.

Press Start and the map tips into a driving view, centred on you, rotated to your heading so the road ahead is always up. Directions are spoken aloud through the browser's own speech engine, with no service or key behind it: a warning at roughly half a mile, again at a few hundred feet, and the instruction itself as you reach the turn. Street abbreviations are expanded first so it says "Boulevard" and "Interstate 277" rather than reading out letters. Each band is announced once, and the voice can be muted from the navigation bar.

**Preview drive** replays the whole route as if you were driving it, moving your position along the road, rotating the map through every turn and speaking each instruction. It exists because a desktop computer has no GPS, so this is the only way to see navigation work on one.

## Locating you

Three tiers, in order, so a machine with no GPS chip still works:

1. Precise browser geolocation, tried briefly
2. Coarse browser geolocation, which uses wifi and IP positioning
3. Approximate position from your network address

Tier three resolves in well under a second, so the app fills in a usable starting point immediately rather than making you wait out a GPS timeout, and upgrades itself to an exact position if one ever arrives. It is always labelled **Approximate location** with the city named, never passed off as exact, and a start you chose yourself is never overwritten. Tier three sends a request to a third-party service which reads your network address; everything else in the app works without it.

## Live data

Where a transit agency publishes a real-time GTFS-RT feed, journeys show actual times against the timetable: a leg running late is marked **+4 min**, a punctual one **on time**. Pick a transit journey and a live departure board appears for the stop you board at, showing the next services with their real delays, refreshed from the feed rather than the schedule.

## The planner

Both ends of the trip are editable: **From** defaults to your GPS position but can be any place, and **To** is whatever you search or tap on the map. Four mode tabs sit under the fields and each one shows its own travel time, computed in parallel the moment both ends are set, so you can see at a glance that driving is 14 minutes and transit is 33 before choosing.

Transit itineraries show departure and arrival clock times, the line for each leg, walking connections, and the number of transfers. Coverage depends on the local agency publishing an open GTFS feed, which is good in much of Europe and patchy across the United States. Where there is no feed the Transit tab says so rather than failing silently.

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
- Transit coverage is only as good as the local open GTFS feed, and much of the United States has none
- No business listings, opening hours or reviews. Search covers addresses and places only
- No offline maps
- No saved places or multi-stop routes
- Traffic requires a TomTom key and is subject to their free tier

## Attribution

Map data © OpenStreetMap contributors (ODbL). Tiles by OpenFreeMap. Geocoding by Photon. Routing by OSRM and Valhalla. Public transport routing by Transitous, a community-run MOTIS instance, used here under its non-commercial open-source terms. Traffic by TomTom. Rendering by MapLibre GL JS (BSD-3-Clause).
