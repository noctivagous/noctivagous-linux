# apps/nct-weather — GOES viewer (first nct-weather-bridge consumer)

A Godot app that displays GOES satellite frames (GeoColor and
ABI band-13 clean IR, East/West) as a scrubbable, auto-playing
loop. It contains no meteorology and no upstream credentials:
all decoding/rendering happens in **nct-weather-bridge**
(`src/services/nct-weather-bridge/`, owned by nct-geo-services;
spec `src/modules/nct-geo-services/WEATHER-BRIDGE.md`), which it
reaches over plain HTTP:

- `GET /v1/datasets/{id}/times` — frame times for the loop
- `GET /v1/datasets/{id}/frame.json` — provider / staleness readout
- `GET /v1/datasets/{id}/frame` — the PNG shown

Bridge URL: env `NCT_WEATHER_BRIDGE_URL`, default
`http://127.0.0.1:8765`. Start the bridge first.

Self-test (headless): `NCT_WEATHER_SELFTEST=1` loads the newest
dataset's frames, prints `NCT_WEATHER_FRAME_OK <w>x<h>
provider=... stale=... frames=N`, optionally saves a viewport
PNG to `NCT_WEATHER_SHOT`, and quits.

The picker lists the bridge's frame and grid datasets (24).
`obs.surface-hourly` is deliberately absent: it serves JSON
observation records, not frames — see the bridge README's /obs
endpoint.
