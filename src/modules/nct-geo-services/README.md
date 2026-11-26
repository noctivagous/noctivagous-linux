# nct-geo-services

The consolidated location for geographic matters. Geography in
both directions: the front for map and place data going out, and
the one door for requests for this machine's position coming in.
Geolocation is one service inside it, not the whole of it — the
module also holds the geographic information itself (maps, place
data, weather at a place), available to apps.

Owns — outbound (the machine asks about the world):
- Maps and place data behind one front: tile and vector map
  providers (OpenStreetMap first), geocoding and reverse
  geocoding, routing. The provider is chosen per function in
  Settings, never hard-coded in an app.
- Weather — conditions at a place: current conditions, forecast,
  alerts, and radar / satellite imagery sources, from providers
  chosen per region (api.weather.gov in the US, Open-Meteo-class
  services elsewhere). Weather has no meaning without a place —
  every query starts from a position or a named place held here —
  so it lives in this module rather than as a service of its own.
  Forecasts are cached with their fetch time and shown stale when
  they are stale; the dashboard and greeter weather widgets are
  ordinary consumers of this section.
- Offline and placeholder geographic information: bundled coarse
  data (country / region / city level, major place names,
  timezone-from-coordinates) and downloadable offline packs via
  nct-package-coordinator, so maps, place pickers and timezone
  suggestions still work with no network and no provider account.
  Placeholder data is badged as placeholder wherever it is shown —
  coarse, possibly stale, never presented as live.
- Query egress honesty: a geocoding or routing query sent to a
  provider tells that provider what was asked. Local and offline
  data is preferred; an outbound query is shown as the egress it
  is, under the same rules as the gateways' external calls.

Owns — inbound (the world asks where this machine is):
- Position sources: satellite (GNSS hardware), WiFi positioning,
  coarse IP-based position, and a manually set location — in that
  order of accuracy, each source named when it supplies a fix.
- The geolocation answer service (the GeoClue seat): apps and
  system services ask here for position, at an accuracy (city /
  neighbourhood / exact) and for a duration. Exact position is a
  sensitive capability under nct-security-manager — ASK-class,
  per consumer, revocable; the portal's location asks
  (nct-portal-manager) are answered through here, so there is one
  place that knows who was told what, at what accuracy, when.
- Location history: off by default, module-private when on, and
  never a condition of getting a fix.

Consumers: the maps and place surfaces of any app; weather and
nct-locale-manager (timezone and region suggestions are proposals
from a fix, never silent changes); nct-communication-gateway
(sharing your location is a send, ASK-class like any other);
nct-ai-gateway conventions that declare a location need.

Settings surface: Settings → Location is this module's page,
registered into nct-settings-service: Position (sources, who may
ask, accuracy) · Maps & Providers · Weather · Offline &
Placeholder data · History.

Hosting / language: a service process outside the shell (the §9
bridge pattern) — position sources live at system level (GNSS and
modem through nct-linux-sys-interface), and consumers include
out-of-shell services.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Host: a host's position is normally static and manually set;
  inbound services are off unless declared.
- Kiosk: position fixed at setup; no per-app asks.

Status: STUB — laid out 2026-11-26 at the owner's direction, not
built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
Exception: the weather section has a v1 prototype — the
nct-weather-bridge adapter (spec: WEATHER-BRIDGE.md in this
directory; code: src/services/nct-weather-bridge/; first consumer:
src/godot/apps/nct-weather/), built 2026-11-26, build log 25.
