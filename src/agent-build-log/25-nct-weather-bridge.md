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

## v2 addendum — adde provider (2026-11-26, same branch)

Asked by: the owner ("we'd like the ADDE provider"). Landed v1
first (above is pre-push state; v1 landed on main as ae82b3c),
then v2 built on the branch. NOT pushed.

Client: SSEC's pyadde is not published in any installable form
(checked PyPI + SSEC pages; it circulates inside McIDAS-X/XRD
bundles). Per the solved-problem rule, AddeClient in
nct_weather_bridge.py is a minimal Python port of the classical
implementation — VisAD's edu.wisc.ssec.mcidas.adde
AddeURLConnection (request packet, gzip, error trailer) and
AreaFile/AreaDirectory (64-word directory layout) — LGPL, credited
in code and in the provider register. Stdlib only (socket, gzip,
struct) + numpy/Pillow for pixels. Covers LWPR (dataset list),
ADIR (directory), AGET (image data, UNIT=BRIT, server-side
blowdown by negative MAG).

Protocol facts established by probing adde.ucar.edu live:
- The packet works through this sandbox's HTTP proxy via CONNECT
  (NCT_WB_ADDE_PROXY, defaulting to the https_proxy env); direct
  TCP is the normal case elsewhere.
- LWPR "ALA.RTIMAGES" returns the server's catalogue: GOES
  descriptors are GECNC02/08/13 (East CONUS), GWCNC* (West),
  GEFD*/GWFD* full disk, GEM1/GEM2/GWM1/GWM2 mesoscale, derived
  products (…CAPE, …LI, …PW, …CTP, SST, RRQPE), plus POES/Mollweide
  composites. The older GE-CONUS-style names do not resolve.
- ADIR records are a marker word + 64-word directory + a
  server-sized aux block (stride 406 words on this server); the
  parser scans for the directory pattern instead of trusting a
  stride. Directory date is CYYDDD, time HHMMSS as an int.
- AGET DAY=/TIME= selection did NOT match nominal times on this
  server ("No images satisfy the selection criteria" for exact
  directory times in all three day formats), so frames are
  selected by relative position from a fresh ADIR listing and the
  returned AREA directory time is verified against the request —
  a mismatch is an error, never a silently wrong frame.

Datasets: sat.goes-east.vis / sat.goes-west.vis (band 2, ADDE
only — first visible-band source in the bridge); adde joins
ir-clean east/west as fallback behind nodd-s3. Godot picker gains
the two VIS datasets (6 total). Bridge version 0.2.0.

Verification (live, this sandbox, 2026-11-26):
- Offline tests: 9/9 (4 new ADDE tests: CYYDDD + unpadded-time
  conversion, ADIR scan over synthetic records, AREA rejection).
- /v1/health: adde available (LWPR probe). VIS times: 13:06:17Z,
  13:01:17Z, … at 5-min cadence. VIS frame: 200, 948×600 PNG,
  X-Provider adde, X-Stale-Seconds honest; inspected visually —
  the dawn terminator across CONUS, night in the west, the East
  Coast storm lit — physically right for band 2 at 13:06 UTC.
  A raw AGET band-13 frame was likewise inspected (CONUS IR with
  the same storm). Time-selected frame (?time=12:51:17Z) returns
  exactly that time; west VIS frame serves too. Egress log
  records every ADIR/AGET/LWPR call.
- Godot self-test re-run with the 6-dataset picker against the
  v2 bridge: NCT_WEATHER_FRAME_OK 1250x1250 provider=cira-slider
  frames=8 (default dataset path unchanged).
- Scoped claim: proves bridge + ADDE server + app in this sandbox
  (proxy-tunnelled TCP, Xvfb software rendering). Nothing about
  direct-TCP on a normal network beyond the protocol being the
  server's own, the rig, or Vulkan.
- Not built: EDEX (v3), push, place-relative products, the other
  ADDE descriptors (full disk, mesoscale, derived products,
  point/text) — all are register-and-render additions on this
  provider when a consumer wants them.
