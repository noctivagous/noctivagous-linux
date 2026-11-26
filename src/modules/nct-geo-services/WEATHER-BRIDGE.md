# nct-weather-bridge — spec

Status: v1 PROTOTYPE BUILT 2026-11-26, landed on main (ae82b3c).
v2 (adde provider) BUILT 2026-11-26 on feat/nct-weather-bridge,
not pushed. Code: src/services/nct-weather-bridge/. First consumer:
src/godot/apps/nct-weather/ (Godot GOES viewer).

## What it is

A general Python adapter, owned by nct-geo-services, that serves
weather and earth-observation data from the upstream meteorological
systems (McIDAS/ADDE, AWIPS/EDEX, THREDDS, NOAA Open Data) behind
one documented, language-agnostic local API. It is NOT a Godot
component and NOT part of any one app: the Godot viewer is its first
consumer, the dashboard and greeter weather widgets are ordinary
consumers on the same terms, and a CLI or browser page could be too.

It follows the §9 bridge pattern: a service process outside the
shell, so ingest and cache survive the shell being down.

## Why an adapter at all

The upstream endpoints are not consumable by a UI runtime:

- ADDE (McIDAS) is a binary, big-endian, gzip-compressed protocol
  on TCP port 112 returning McIDAS AREA files.
- EDEX (AWIPS II) speaks Thrift/HTTP-serialised requests via
  python-awips and returns HDF5-backed grid/geometry objects.
- The NOAA Open Data buckets return netCDF-4 / GRIB2 science files.

Decoding, reprojection and colour-mapping for all of those already
exist in Python (satpy, MetPy, cfgrib, python-awips). The
adapter is the integration layer over those libraries; it does not
re-implement decoders. Clients receive only PNG frames and JSON.
One exception, found while building v2: no installable Python ADDE
client exists (SSEC's pyadde is not published), so the adde
provider's client is a minimal port of the solved protocol —
VisAD's Java AddeURLConnection + AreaFile (LGPL) — covering only
ADIR/AGET/LWPR and AREA directory + BRIT pixel parsing. Porting the
classical implementation, not inventing a new one.

## Providers (pluggable, one module per provider)

A provider registers datasets and knows how to list times and
render/fetch one frame. Providers fall back in a named order per
dataset; every response names the provider that actually served it.

| Provider | Upstream | Protocol | v1 status |
|---|---|---|---|
| cira-slider | slider.cira.colostate.edu (RAMMB/CIRA) | HTTPS JSON + PNG tiles | BUILT — GOES-East/West CONUS GeoColor |
| nodd-s3 | noaa-goes19 / noaa-goes18 S3 (NOAA Open Data) | HTTPS S3 listing + netCDF-4 | BUILT — GOES ABI CONUS band 13 (clean IR), rendered locally |
| adde | adde.ucar.edu (McIDAS ADDE) | TCP 112 binary, built-in client (VisAD port) | BUILT (v2) — GOES CONUS band 2 visible (new datasets), band 13 as fallback for ir-clean; RTIMAGES group |
| edex | edex-cloud.unidata.ucar.edu (AWIPS II) | python-awips DataAccessLayer | specced, not built |
| thredds | Unidata / NCEI THREDDS servers | HTTPS OPeNDAP / WMS / file | specced, not built |
| weather-gov | api.weather.gov | HTTPS JSON | specced (geo-services weather section proper) |

## Local API (v1, all GET, localhost)

Base: http://127.0.0.1:8765 (port is a setting, NCT_WEATHER_BRIDGE_PORT)

- GET /v1/catalog — dataset catalogue: id, title, providers in
  fallback order, cadence, coverage, licence.
- GET /v1/datasets/{id}/times?limit=N — available frame times,
  newest first, ISO-8601 UTC.
- GET /v1/datasets/{id}/frame?time=ISO (default latest) —
  image/png frame. Response headers carry the metadata sidecar:
  X-Dataset, X-Valid-Time, X-Provider, X-Source, X-Stale-Seconds,
  X-Coverage (west,south,east,north the frame is rendered for).
- GET /v1/datasets/{id}/frame.json?time=ISO — the same metadata
  as JSON without the image bytes.
- GET /v1/health — provider reachability, cache size, version.
- GET /openapi.json — the OpenAPI schema for the above.
- GET /docs — human documentation rendered from the service's own
  README + provider register (docs cannot drift from the code that
  serves them: the endpoint list is generated, not hand-copied).

Dataset IDs name the thing, never the provider:
sat.goes-east.geocolor, sat.goes-west.geocolor,
sat.goes-east.ir-clean (ABI band 13), sat.goes-west.ir-clean,
sat.goes-east.vis (ABI band 2), sat.goes-west.vis.

## Rules

- Cache: frames cached under the module cache dir keyed by
  dataset+time; a cached frame is served with its true age in
  X-Stale-Seconds — stale is shown, never hidden (geo-services
  stub rule for weather).
- Egress honesty: every outbound provider call is logged with
  provider, dataset and time; the log is the module's egress record
  under the geo-services query-egress rule.
- No position by default: v1 datasets are fixed-coverage (CONUS).
  Place-relative products go through geo-services core first —
  the bridge receives a resolved place, never a raw fix, and exact
  position stays ASK-class under nct-security-manager.
- Rendering happens in the bridge: reprojection, composites and
  colour tables are provider-side; a client never parses netCDF,
  GRIB, HDF5 or AREA.
- Failure is data: an unreachable provider returns 502 with the
  provider chain tried, in JSON — a consumer renders that, it does
  not guess.

## Documentation (a deliverable of the spec, not an afterthought)

src/services/nct-weather-bridge/README.md carries: quickstart,
endpoint reference, the provider register (host, protocol/port,
auth, licence, cadence, quirks), the dataset catalogue, worked
examples of the same call in curl / Python / Godot GDScript, and
the "adding a provider" contract (register datasets, list times,
render one frame, declare licence + cadence).

## Build slices

- v1 (built): cira-slider + nodd-s3 providers, catalog/times/frame
  API, cache, /docs + /openapi.json, Godot GOES viewer consumer
  (frame loop, dataset switch, provider + staleness readout).
- v2 (built): adde provider (built-in VisAD-port client; RTIMAGES
  from adde.ucar.edu) — proves the McIDAS path on the same API.
  Visible-band datasets are ADDE-only; band 13 joins ir-clean as a
  fallback behind nodd-s3. Remaining ADDE headroom, same provider,
  no new plumbing: full-disk and mesoscale descriptors, the derived
  products (cloud-top pressure, precipitable water, lifted index,
  SST, rain-rate QPE), the other RTIMAGES composites (Mollweide,
  Antarctic/Arctic POES), and the point/text request types
  (RTPTSRC observations, weather text) when a consumer wants them.
- v3: edex provider (python-awips; a gridded model field rendered
  server-side) — proves the AWIPS path on the same API.
- v4: push (WebSocket new-frame notice), place-relative products
  via geo-services core, Settings → Location provider choice.
