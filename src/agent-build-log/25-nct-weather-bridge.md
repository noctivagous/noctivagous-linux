# 25 — nct-weather-bridge v1 prototype + Godot GOES viewer

Date: 2026-11-26. Asked by: the owner ("Build the v1 prototype —
bridge + Godot GOES viewer"; name settled by the owner as
nct-weather-bridge). Worktree: ~/workspace/noctivagous-linux-geo,
branch feat/nct-weather-bridge off main cdb68d3. NOT pushed.

## What was built

Spec: src/modules/nct-geo-services/WEATHER-BRIDGE.md — the bridge
is a general Python adapter owned by nct-geo-services, serving
upstream weather systems behind one documented local API; the
Godot app is its first consumer, not its owner. ADDE and EDEX
providers are specced there as v2/v3 on the same API.

Bridge: src/services/nct-weather-bridge/ (stdlib HTTP server;
Pillow + numpy; netCDF4 for the S3 provider)
- Providers built: cira-slider (GOES-19/18 CONUS GeoColor, JSON
  times + PNG tile stitch) and nodd-s3 (GOES ABI band-13 CONUS
  netCDF from noaa-goes19/18, rendered to enhanced PNG locally).
- API: /v1/catalog, /v1/datasets/{id}/times, /frame (PNG +
  X- metadata headers), /frame.json, /v1/health, /openapi.json,
  /docs (serves the README). Frame cache with true staleness;
  egress log per provider call. README carries the provider
  register, endpoint reference, curl/Python/Godot examples and
  the adding-a-provider contract. Offline unit tests:
  test_bridge.py (5 tests, passing).

App: src/godot/apps/nct-weather/ — Godot 4.7.2 project following
nct-hello's shape. Dataset picker (4 datasets), frame loop over
the last 8 bridge frames with timeline slider + play/pause,
provider + staleness readout from frame.json. Self-test mode via
NCT_WEATHER_SELFTEST / NCT_WEATHER_SHOT.

## Verification (live, this sandbox, 2026-11-26)

- Bridge: /v1/health — both providers available. GeoColor frame:
  200, 1250×1250 PNG, X-Provider cira-slider, valid 12:46:17Z.
  IR frame.json: provider nodd-s3, 1250×750 PNG rendered from the
  12:51:17Z CMIPC band-13 file. Bug found + fixed during the
  build: GOES filename start times are sYYYYDDDHHMMSS + a tenths
  digit (the token after _s is 14 digits, the last being tenths) —
  parser now takes the first 13 digits as %Y%j%H%M%S.
- Godot: project imports clean on the pinned 4.7.2 mono runtime
  (dotnet on PATH). Self-test under Xvfb: NCT_WEATHER_FRAME_OK
  1250x1250 provider=cira-slider frames=8, and the saved viewport
  PNG was inspected visually — real GOES-East GeoColor over CONUS
  with the storm off the East Coast, picker/bar/slider/timestamp
  all rendered. Scoped claim: this proves the app + bridge chain
  in this sandbox under Xvfb software rendering; nothing about
  the rig, the session chain, or Vulkan.
- Not built: ADDE + EDEX providers (specced v2/v3), push
  notifications, place-relative products, Settings integration.
