# nct-weather-bridge

A general Python adapter, owned by **nct-geo-services**, serving
weather / earth-observation data from the upstream meteorological
systems behind one documented local API: PNG frames + JSON.
Spec: `src/modules/nct-geo-services/WEATHER-BRIDGE.md`.

Consumers are any program that can do an HTTP GET — the Godot GOES
viewer (`src/godot/apps/nct-weather/`) is the first; dashboard and
greeter widgets, NCTXML apps, CLIs and web pages use the same API.

## Quickstart

```
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python nct_weather_bridge.py            # 127.0.0.1:8765
curl localhost:8765/v1/catalog
curl localhost:8765/v1/datasets/sat.goes-east.geocolor/times
curl -o frame.png localhost:8765/v1/datasets/sat.goes-east.geocolor/frame
curl localhost:8765/docs                          # this file, served
curl localhost:8765/openapi.json                  # machine schema
```

## Endpoint reference

| GET | Returns |
|---|---|
| `/v1/catalog` | JSON: every dataset — id, title, cadence, coverage `[west,south,east,north]`, provider chain |
| `/v1/datasets/{id}/times?limit=N` | JSON: frame times, newest first (`time` ISO-8601 UTC, `id` provider-native) |
| `/v1/datasets/{id}/frame?time=ISO` | `image/png`; metadata in `X-Dataset`, `X-Valid-Time`, `X-Provider`, `X-Stale-Seconds`, `X-Coverage` headers |
| `/v1/datasets/{id}/frame.json?time=ISO` | JSON metadata only: dataset, title, valid_time, provider, source/licence, coverage, stale_seconds, bytes |
| `/v1/health` | JSON: version, per-provider availability, cache location/size |
| `/openapi.json` | OpenAPI 3 schema for the above |
| `/docs` | This README as plain text |

Errors are JSON: 404 unknown dataset/path, 502 with the provider
chain detail when every provider for a dataset failed. Failure is
data — render it, don't guess around it.

## Datasets

| ID | What | Providers |
|---|---|---|
| `sat.goes-east.geocolor` | GOES-19 CONUS GeoColor | cira-slider |
| `sat.goes-west.geocolor` | GOES-18 CONUS GeoColor | cira-slider |
| `sat.goes-east.ir-clean` | GOES-19 ABI band 13 clean IR, CONUS | nodd-s3, adde |
| `sat.goes-west.ir-clean` | GOES-18 ABI band 13 clean IR, CONUS | nodd-s3, adde |
| `sat.goes-east.vis` | GOES-19 ABI band 2 visible 0.64 um, CONUS | adde |
| `sat.goes-west.vis` | GOES-18 ABI band 2 visible 0.64 um, CONUS | adde |
| `sat.himawari.geocolor` | Himawari-9 full disk GeoColor | cira-slider |
| `sat.himawari.ir-clean` | Himawari-9 AHI band 13 clean IR, full disk | cira-slider |
| `sat.viirs-noaa20.truecolor` | VIIRS (NOAA-20) true color, CONUS, daily composite | nasa-gibs |

Dataset IDs name the thing, never the provider, so a dataset can
gain or swap providers without any client changing.

## Provider register

| Provider | Host / protocol | Auth | Licence | Cadence | Quirks |
|---|---|---|---|---|---|
| cira-slider | `slider.cira.colostate.edu` HTTPS — `/data/json/{sat}/{sector}/{product}/latest_times.json`, tiles `/data/imagery/{YYYY}/{MM}/{DD}/{sat}---{sector}/{product}/{ts}/{zoom:02d}/{y}_{x}.png` (625px tiles; zoom1 = 2×2, zoom2 = 4×4) | none | Data via CIRA/RAMMB; attribute CIRA + operator (NOAA / JMA) | 5 min GOES, 10 min Himawari | No CORS headers — fetch server-side, never hot-link from a page. Timestamps are 14-digit compact UTC. Satellite ids are Slider's own: GOES are `goes-19`/`goes-18` (sector `conus`, also `full_disk`), Himawari is the single id `himawari` (sector `full_disk`; products `geocolor`, `band_13`, `band_08`, `band_03`, `natural_color`). This is the downstream end of CIRA's own ground-station pipeline — the same products the CIRA Satellite Library posts. |
| nasa-gibs | `gibs.earthdata.nasa.gov` HTTPS WMS 1.3.0 — `wms/epsg4326/best/wms.cgi?REQUEST=GetMap&LAYERS=...&BBOX={s},{w},{n},{e}&TIME={date}` (also WMTS tiles) | none | NASA GIBS/EOSDIS; attribute NASA | daily | The rendered service behind NASA Worldview. Polar-orbiter layers are daily composites of that day's overpasses — the frame id is a date, nominal time 19:00Z (CONUS afternoon pass), and the current day fills in as passes complete. WMS 1.3.0 axis order is lat,lon in BBOX. The raw alternative (VIIRS SDR/EDR granules in `noaa-jpss`) needs geolocation pairing + bowtie handling; that bucket's public tree also carries ocean-colour HDF products. Layer used: `VIIRS_NOAA20_CorrectedReflectance_TrueColor`. |
| nodd-s3 | `noaa-goes19` / `noaa-goes18` S3 HTTPS — anonymous list-type=2 on prefix `ABI-L2-CMIPC/{YYYY}/{DDD}/{HH}/`, objects `OR_ABI-L2-CMIPC-M6C13_*.nc` | none | NOAA Open Data, public domain | 5 min | netCDF-4, CMI = brightness temperature K. Needs the `netCDF4` Python package; without it the provider reports unavailable in `/v1/health`. Raw .nc cached alongside frames. |
| adde | `adde.ucar.edu` TCP 112, McIDAS ADDE binary protocol — client built in (`AddeClient`, stdlib socket+gzip; a port of VisAD's `AddeURLConnection`/`AreaFile`, LGPL — SSEC's pyadde is not published in installable form) | none for public datasets | Unidata/SSEC public ADDE datasets | 5 min (RTIMAGES) | Requests: ADIR (directory), AGET (image), LWPR (dataset list). Responses are gzip streams: a byte-count int (0 = error, message in the 92-byte trailer), then AREA data — 64-word big-endian directory, data at the directory's offset. Times are McIDAS CYYDDD + HHMMSS words. Frame ids are nominal-time ISO strings; a fetch re-lists ADIR, selects by relative position and verifies the returned directory time, because positions shift as new images arrive. `UNIT=BRIT` = one brightness byte/pixel; blowdown is server-side via negative MAG. Host override `NCT_WB_ADDE_HOST`; if egress needs an HTTP proxy, `NCT_WB_ADDE_PROXY` (defaults to the `https_proxy` env, `none` = direct) tunnels the TCP connection with CONNECT. GOES descriptors on this host: `RTIMAGES/GECNC02|08|13`, `GWCNC*`, full-disk `GEFD*`/`GWFD*`, mesoscale `GEM1/GEM2/GWM1/GWM2`, plus derived products (CTP, PW, LI, SST, RRQPE) — the full list is one LWPR call away and the server is the authority. |
| edex (specced, v3) | `edex-cloud.unidata.ucar.edu`, AWIPS II EDEX via python-awips `DataAccessLayer` | none for Unidata public EDEX | NSF Unidata AWIPS | varies | Thrift-serialised requests; grid/geometry objects backed by HDF5. Render server-side to PNG/JSON like every other provider. |

## The same call, three ways

curl:
```
curl -o ir.png "localhost:8765/v1/datasets/sat.goes-east.ir-clean/frame"
```

Python:
```python
import requests
meta = requests.get("http://127.0.0.1:8765/v1/datasets/sat.goes-east.ir-clean/frame.json").json()
png  = requests.get("http://127.0.0.1:8765/v1/datasets/sat.goes-east.ir-clean/frame").content
print(meta["valid_time"], meta["provider"], meta["stale_seconds"])
```

Godot (GDScript) — full app in `src/godot/apps/nct-weather/`:
```gdscript
var http := HTTPRequest.new()
add_child(http)
http.request_completed.connect(func(_r, _c, _h, body):
    var img := Image.new()
    if img.load_png_from_buffer(body) == OK:
        texture_rect.texture = ImageTexture.create_from_image(img))
http.request("http://127.0.0.1:8765/v1/datasets/sat.goes-east.geocolor/frame")
```

## Adding a provider

1. Subclass nothing formal — a provider is an object with
   `name`, `licence`, `times(limit) -> [{time, id}]` (newest
   first) and `frame(id) -> png bytes`. Optional `available`
   property for optional dependencies (see NoddS3Provider).
2. Register it in `DATASETS` under a provider-independent dataset
   ID, in fallback order.
3. Add its row to the provider register above (host, protocol,
   auth, licence, cadence, quirks) — an undocumented provider is
   an unfinished provider.
4. Log every outbound call with `log_egress(provider, url)` —
   the cache-dir `egress.log` is the module's query-egress record.

## Cache & staleness

Frames (and raw netCDF) cache in `~/.cache/nct-weather-bridge/`
(override `NCT_WB_CACHE`), keyed by dataset+provider-time. Cached
frames are served with their true age in `stale_seconds` /
`X-Stale-Seconds` — stale is shown, never hidden.
