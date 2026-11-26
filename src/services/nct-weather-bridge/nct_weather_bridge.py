#!/usr/bin/env python3
"""nct-weather-bridge — a general Python adapter for weather data.

Owned by nct-geo-services (spec: src/modules/nct-geo-services/
WEATHER-BRIDGE.md). Serves upstream meteorological systems
(CIRA/RAMMB Slider, NOAA Open Data S3, McIDAS ADDE; EDEX specced
as a later provider) behind one documented local HTTP API
returning PNG frames + JSON. Any client can consume it; the Godot
GOES viewer in src/godot/apps/nct-weather/ is the first.

Stdlib HTTP server. Runtime deps: Pillow, numpy. The nodd-s3
provider additionally needs netCDF4; without it that provider
reports itself unavailable instead of failing the service. The
adde provider is stdlib-only (socket + gzip): a minimal port of
VisAD's ADDE client, see AddeClient.

Run:  python3 nct_weather_bridge.py [--port 8765]
Env:  NCT_WEATHER_BRIDGE_PORT, NCT_WB_CACHE (cache directory),
      NCT_WB_ADDE_HOST (default adde.ucar.edu),
      NCT_WB_ADDE_PROXY (HTTP proxy for the ADDE TCP connection;
      defaults to the https_proxy env, "none" forces direct)
"""
import argparse, io, json, os, re, sys, threading, time
import urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

VERSION = "0.3.0"
CACHE = os.environ.get("NCT_WB_CACHE",
        os.path.expanduser("~/.cache/nct-weather-bridge"))
os.makedirs(CACHE, exist_ok=True)
EGRESS_LOG = os.path.join(CACHE, "egress.log")

def log_egress(provider, what):
    line = f"{datetime.now(timezone.utc).isoformat()} {provider} {what}\n"
    try:
        with open(EGRESS_LOG, "a") as f: f.write(line)
    except OSError:
        pass

def http_get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "nct-weather-bridge/" + VERSION})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def iso_from_compact(ts):  # 20261126124117 -> ISO
    dt = datetime.strptime(ts, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z"), dt

# ---------------------------------------------------------------- providers

class CiraSliderProvider:
    """Satellite imagery from RAMMB/CIRA Slider: JSON times + PNG
    tiles. Works for any satellite/sector/product Slider carries —
    GOES conus + full disk, and Himawari (sat id "himawari",
    sector "full_disk"), whose GeoColor and band products are
    CIRA-processed from JMA data, the same pipeline whose posts
    the CIRA Satellite Library carries."""
    name = "cira-slider"
    licence = "Data via CIRA/RAMMB Slider; public, attribution to CIRA and the satellite operator (NOAA / JMA)"
    GRID = {1: (2, 2), 2: (4, 4)}   # zoom -> (tiles_x, tiles_y), tile=625px
    def __init__(self, sat, sector="conus", product="geocolor"):
        self.sat = sat              # e.g. goes-19, himawari
        self.sector = sector        # e.g. conus, full_disk
        self.product = product      # e.g. geocolor, band_13
    def times(self, limit=12):
        url = f"https://slider.cira.colostate.edu/data/json/{self.sat}/{self.sector}/{self.product}/latest_times.json"
        log_egress(self.name, url)
        d = json.loads(http_get(url, 30))
        out = []
        for ts in d["timestamps_int"][:limit]:
            iso, _ = iso_from_compact(str(ts))
            out.append({"time": iso, "id": str(ts)})
        return out
    def frame(self, time_id, zoom=1):
        from PIL import Image
        ts = time_id
        date = f"{ts[0:4]}/{ts[4:6]}/{ts[6:8]}"
        tx, ty = self.GRID[zoom]
        mosaic = Image.new("RGB", (tx * 625, ty * 625))
        for y in range(ty):
            for x in range(tx):
                u = (f"https://slider.cira.colostate.edu/data/imagery/{date}/"
                     f"{self.sat}---{self.sector}/{self.product}/{ts}/{zoom:02d}/{y:03d}_{x:03d}.png")
                log_egress(self.name, u)
                tile = Image.open(io.BytesIO(http_get(u, 60))).convert("RGB")
                mosaic.paste(tile, (x * 625, y * 625))
        buf = io.BytesIO(); mosaic.save(buf, "PNG")
        return buf.getvalue()

class GibsWmsProvider:
    """Polar-orbiter imagery from NASA GIBS (Global Imagery Browse
    Services) — the rendered-tile service behind NASA Worldview.
    One WMS GetMap per frame for a fixed region; the product is a
    daily composite of that day's overpasses, so times are dates
    (nominal time 19:00Z, the CONUS afternoon overpass) and the
    current day fills in as passes complete. The raw route —
    VIIRS SDR/EDR granules in the noaa-jpss bucket — needs
    geolocation pairing and bowtie handling to render; GIBS is
    NASA's own rendering of the same instruments."""
    name = "nasa-gibs"
    licence = "NASA GIBS / EOSDIS; public, attribution to NASA"
    def __init__(self, layer, wsen, width=1180, height=520):
        self.layer = layer
        self.wsen = wsen            # [west, south, east, north]
        self.width = width
        self.height = height
    def build_url(self, date_str):
        w, s, e, n = self.wsen
        return ("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
                "?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap"
                f"&LAYERS={self.layer}&CRS=EPSG:4326"
                f"&BBOX={s},{w},{n},{e}&WIDTH={self.width}&HEIGHT={self.height}"
                f"&FORMAT=image/png&TIME={date_str}")
    def times(self, limit=6):
        today = datetime.now(timezone.utc).date()
        out = []
        for i in range(limit):
            d = today - timedelta(days=i)
            out.append({"time": f"{d.isoformat()}T19:00:00Z", "id": d.isoformat()})
        return out
    def frame(self, date_id, **kw):
        from PIL import Image
        url = self.build_url(date_id)
        log_egress(self.name, url)
        img = Image.open(io.BytesIO(http_get(url, 120))).convert("RGB")
        buf = io.BytesIO(); img.save(buf, "PNG")
        return buf.getvalue()

class NoddS3Provider:
    """GOES ABI band 13 (clean longwave IR) from NOAA Open Data S3.

    Downloads the CONUS CMIP netCDF for the requested hour, reads
    CMI (brightness temperature, K) and renders an enhanced PNG
    locally. Needs netCDF4; otherwise unavailable.
    """
    name = "nodd-s3"
    licence = "NOAA Open Data (NODD), public domain, no registration"
    def __init__(self, bucket, sat_short):
        self.bucket = bucket        # noaa-goes19
        self.sat_short = sat_short  # G19
    @property
    def available(self):
        try:
            import netCDF4  # noqa
            return True
        except ImportError:
            return False
    def _list_hour(self, dt):
        prefix = f"ABI-L2-CMIPC/{dt.year}/{dt.timetuple().tm_yday:03d}/{dt.hour:02d}/"
        url = f"https://{self.bucket}.s3.amazonaws.com/?list-type=2&prefix={prefix}"
        log_egress(self.name, url)
        xml = http_get(url, 30).decode()
        keys = [k for k in re.findall(r"<Key>([^<]+)</Key>", xml) if "C13_" in k or "C13" in k.split("/")[-1]]
        out = []
        for k in sorted(keys):
            m = re.search(r"_s(\d{13})\d", k)  # GOES sYYYYDDDHHMMSS + tenths digit
            if m:
                dt = datetime.strptime(m.group(1), "%Y%j%H%M%S").replace(tzinfo=timezone.utc)
                out.append({"time": dt.isoformat().replace("+00:00", "Z"), "id": k})
        return out
    def times(self, limit=12):
        now = datetime.now(timezone.utc)
        out = self._list_hour(now)
        if len(out) < 3:
            out = self._list_hour(now - timedelta(hours=1)) + out
        return out[-limit:][::-1]
    def frame(self, key, **kw):
        import numpy as np
        from netCDF4 import Dataset
        from PIL import Image
        path = os.path.join(CACHE, os.path.basename(key))
        if not os.path.exists(path):
            url = f"https://{self.bucket}.s3.amazonaws.com/{key}"
            log_egress(self.name, url)
            with open(path, "wb") as f: f.write(http_get(url, 120))
        ds = Dataset(path)
        cmi = ds.variables["CMI"][:].filled(np.nan)  # brightness temp K
        ds.close()
        # Clean-IR enhancement: 305K (warm, black) -> 175K (cold tops, white)
        t = np.clip((305.0 - cmi) / (305.0 - 175.0), 0, 1)
        t = np.power(t, 0.65)
        rgb = np.zeros((*t.shape, 3), dtype=np.uint8)
        # subtle blue->grey->white ramp so cloud tops read cold
        rgb[..., 0] = (t * 235).astype(np.uint8)
        rgb[..., 1] = (t * 240).astype(np.uint8)
        rgb[..., 2] = (np.clip(t * 1.15, 0, 1) * 255).astype(np.uint8)
        rgb[np.isnan(cmi)] = (10, 10, 14)
        img = Image.fromarray(rgb, "RGB")
        img.thumbnail((1250, 1250))
        buf = io.BytesIO(); img.save(buf, "PNG")
        return buf.getvalue()

# ---------------------------------------------------------------- ADDE

class AddeError(RuntimeError):
    pass

def _mcidas_datetime(day_word, time_word):
    """McIDAS AREA directory date/time words -> aware datetime (UTC).

    Date is CYYDDD (century digit, 2-digit year, day-of-year) or the
    older YYDDD; time is HHMMSS as an int (no zero padding)."""
    if day_word >= 100000:                       # CYYDDD
        year = 1900 + 100 * (day_word // 100000) + (day_word // 1000) % 100
        doy = day_word % 1000
    else:                                        # YYDDD
        year = 1900 + day_word // 1000
        doy = day_word % 1000
    base = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=doy - 1)
    hh, mm, ss = time_word // 10000, (time_word // 100) % 100, time_word % 100
    return base.replace(hour=hh, minute=mm, second=ss)

def _parse_area_directory(buf, off=0):
    """The 64-word big-endian AREA directory at byte offset off."""
    import struct
    w = struct.unpack_from(">64i", buf, off)
    if w[1] != 4:
        raise AddeError(f"not an AREA directory (version word {w[1]})")
    return w

def _adir_entries(body):
    """Scan an ADIR response body for AREA directories.

    Each ADIR record is a marker word, a 64-word directory, then an
    aux/comment block; record stride varies by server, so scan for
    the directory pattern (version 4, sane CYYDDD date and HHMMSS
    time, positive dimensions) instead of assuming a stride."""
    import struct
    words = struct.unpack(f">{len(body) // 4}i", body[:len(body) // 4 * 4])
    out = []
    for i in range(1, len(words) - 10):
        if words[i] != 4:
            continue
        day, tod = words[i + 2], words[i + 3]
        lines, elems = words[i + 7], words[i + 8]
        if 10000 <= day <= 299366 and 0 <= tod <= 235959 and lines > 0 and elems > 0:
            dt = _mcidas_datetime(day, tod)
            out.append({"time": dt.isoformat().replace("+00:00", "Z"),
                        "lines": lines, "elems": elems})
    # de-duplicate, keep response order (newest first)
    seen, uniq = set(), []
    for e in out:
        if e["time"] not in seen:
            seen.add(e["time"]); uniq.append(e)
    return uniq

class AddeClient:
    """Minimal ADDE client: a Python port of the request packet and
    AREA parsing in VisAD's edu.wisc.ssec.mcidas.adde.AddeURLConnection
    and edu.wisc.ssec.mcidas.AreaFile (LGPL; SSEC/Unidata/Bureau of
    Meteorology authors). SSEC's own pyadde is not published anywhere
    installable, so this ports the solved protocol instead of
    inventing one. Supports ADIR (directory), AGET (image data) and
    LWPR (dataset list) against a public ADDE server, port 112,
    gzip transfer. If NCT_WB_ADDE_PROXY (or the standard https_proxy
    env) names an HTTP proxy, the TCP connection is tunnelled with
    CONNECT — needed in sandboxes whose egress is proxy-only; set
    NCT_WB_ADDE_PROXY=none to force a direct connection."""
    def __init__(self, host, port=112):
        self.host = host
        self.port = port
    def _connect(self, timeout):
        import socket
        proxy = os.environ.get("NCT_WB_ADDE_PROXY")
        if proxy is None:
            proxy = os.environ.get("https_proxy") or os.environ.get("HTTPS_PROXY")
        if proxy and proxy != "none":
            import base64, urllib.parse
            p = urllib.parse.urlparse(proxy)
            s = socket.create_connection((p.hostname, p.port), timeout=timeout)
            auth = ""
            if p.username:
                cred = urllib.parse.unquote(p.username) + ":" + urllib.parse.unquote(p.password or "")
                auth = "Proxy-Authorization: Basic " + base64.b64encode(cred.encode()).decode() + "\r\n"
            s.sendall((f"CONNECT {self.host}:{self.port} HTTP/1.1\r\n"
                       f"Host: {self.host}:{self.port}\r\n{auth}"
                       "Proxy-Connection: Keep-Alive\r\n\r\n").encode())
            resp = b""
            while b"\r\n\r\n" not in resp:
                chunk = s.recv(4096)
                if not chunk:
                    raise AddeError("proxy closed during CONNECT")
                resp += chunk
            if b" 200 " not in resp.split(b"\r\n")[0] + b" ":
                raise AddeError("proxy CONNECT refused: " +
                                resp.split(b"\r\n")[0].decode(errors="replace"))
            return s, resp.split(b"\r\n\r\n", 1)[1]
        return socket.create_connection((self.host, self.port), timeout=timeout), b""
    def request(self, svc, request, timeout=120):
        """One ADDE round trip. Returns the response body after the
        leading byte-count int; raises AddeError on a server error
        trailer."""
        import gzip, socket, struct
        log_egress("adde", f"adde://{self.host}:{self.port}/{svc.decode()} {request}")
        s, raw = self._connect(timeout)
        try:
            server_ip = socket.inet_aton(socket.gethostbyname(self.host))
        except Exception:
            server_ip = b"\x00\x00\x00\x00"
        out = io.BytesIO()
        out.write(struct.pack(">i", 1))                    # ADDE version
        out.write(server_ip); out.write(struct.pack(">i", 112))   # gzip
        out.write(svc)
        out.write(server_ip); out.write(struct.pack(">i", 112))
        out.write(b"\x7f\x00\x00\x01")                     # client address
        out.write(b"XXXX")                                 # user id
        out.write(struct.pack(">i", 0))                    # project
        out.write(b"\x00" * 12)                            # password
        out.write(svc)                                     # service again
        ob = request.encode()
        if len(ob) <= 120:
            out.write(struct.pack(">i", 0))
            out.write(ob); out.write(b" " * (120 - len(ob)))
        else:
            out.write(struct.pack(">i", len(ob)))
            out.write(struct.pack(">i", len(ob)))
            out.write(b"\x00" * 116); out.write(ob)
        s.sendall(out.getvalue())
        try:
            while True:
                chunk = s.recv(65536)
                if not chunk:
                    break
                raw += chunk
        finally:
            s.close()
        data = gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw
        if len(data) < 4:
            raise AddeError("empty ADDE response")
        n = struct.unpack(">i", data[:4])[0]
        if n == 0:
            msg = data[12:84].decode(errors="replace").strip("\x00 ").strip()
            raise AddeError(f"ADDE server error: {msg or 'unknown'}")
        return data[4:]
    def adir(self, group, descr, count=12):
        """Newest-first list of {time, lines, elems} for a dataset."""
        req = (f"{group} {descr} {-count + 1} 0 TRACE=0 BAND=ALL X "
               "AUX=YES TRACKING=0 VERSION=1")
        return _adir_entries(self.request(b"adir", req, timeout=60))
    def aget_ir(self, group, descr, band, pos, native_lines, native_elems,
                max_lines=600):
        """One frame at position pos, blown down server-side to at
        most max_lines lines. Returns (png_bytes, valid_iso). UNIT=BRIT
        gives one brightness byte per pixel."""
        import math
        import numpy as np
        from PIL import Image
        mag = max(1, math.ceil(native_lines / max_lines))
        lines = math.ceil(native_lines / mag)
        elems = math.ceil(native_elems / mag)
        req = (f"{group} {descr} {pos} X X X -{mag} {lines} {elems} "
               f"BAND={band} TRACE=0 SPAC=X UNIT=BRIT NAV=X AUX=YES "
               "TRACKING=0 DOC=NO TIME=X X I CAL=X VERSION=1")
        body = self.request(b"aget", req)
        w = _parse_area_directory(body)
        nlines, nelems, width = w[8], w[9], w[10]
        pfx, datoff = w[14], w[33]
        if width != 1:
            raise AddeError(f"unexpected AREA data width {width}")
        stride = pfx + nelems * width
        raw = body[datoff:datoff + nlines * stride]
        a = np.frombuffer(raw, dtype=np.uint8).reshape(nlines, stride)[:, pfx:]
        valid = _mcidas_datetime(w[3], w[4]).isoformat().replace("+00:00", "Z")
        buf = io.BytesIO(); Image.fromarray(a).save(buf, "PNG")
        return buf.getvalue(), valid
    def dataset_list(self, group):
        """LWPR: the server's own catalogue lines for a group."""
        body = self.request(b"lwpr", f"ALA.{group} VERSION=1", timeout=60)
        return body.decode("ascii", errors="replace")

class AddeProvider:
    """GOES imagery from a public McIDAS ADDE server (default
    adde.ucar.edu, Unidata). Datasets are GROUP/DESCRIPTOR pairs in
    RTIMAGES; the frame id is the nominal time's ISO string, and a
    frame fetch re-lists the directory and selects by position, then
    verifies the returned AREA directory time matches — positions
    are relative and shift as new images arrive."""
    name = "adde"
    licence = "NOAA/NESDIS data via Unidata ADDE (adde.ucar.edu); public, no registration"
    def __init__(self, group, descr, band, host=None):
        self.group = group
        self.descr = descr
        self.band = band
        self.host = host or os.environ.get("NCT_WB_ADDE_HOST", "adde.ucar.edu")
        self._avail = None
        self._avail_at = 0.0
    @property
    def available(self):
        if self._avail is not None and time.time() - self._avail_at < 60:
            return self._avail
        try:
            AddeClient(self.host).request(
                b"lwpr", f"ALA.{self.group} VERSION=1", timeout=15)
            self._avail = True
        except Exception:
            self._avail = False
        self._avail_at = time.time()
        return self._avail
    def times(self, limit=12):
        entries = AddeClient(self.host).adir(self.group, self.descr, limit)
        return [{"time": e["time"], "id": e["time"]} for e in entries[:limit]]
    def frame(self, time_id, **kw):
        client = AddeClient(self.host)
        entries = client.adir(self.group, self.descr, 24)
        for i, e in enumerate(entries):
            if e["time"] == time_id:
                png, valid = client.aget_ir(self.group, self.descr, self.band,
                                            -i, e["lines"], e["elems"])
                if valid != time_id:
                    raise AddeError(
                        f"frame time mismatch: asked {time_id}, got {valid}")
                return png
        raise AddeError(f"time {time_id} no longer in ADDE directory")

# ---------------------------------------------------------------- datasets

DATASETS = {
    "sat.goes-east.geocolor": {
        "title": "GOES-East (GOES-19) CONUS GeoColor",
        "coverage": [-125.0, 24.0, -66.0, 50.0], "cadence": "5 min",
        "providers": [CiraSliderProvider("goes-19")],
    },
    "sat.goes-west.geocolor": {
        "title": "GOES-West (GOES-18) CONUS GeoColor",
        "coverage": [-125.0, 24.0, -66.0, 50.0], "cadence": "5 min",
        "providers": [CiraSliderProvider("goes-18")],
    },
    "sat.goes-east.ir-clean": {
        "title": "GOES-East (GOES-19) ABI band 13 clean IR, CONUS",
        "coverage": [-125.0, 24.0, -66.0, 50.0], "cadence": "5 min",
        "providers": [NoddS3Provider("noaa-goes19", "G19"),
                      AddeProvider("RTIMAGES", "GECNC13", 13)],
    },
    "sat.goes-west.ir-clean": {
        "title": "GOES-West (GOES-18) ABI band 13 clean IR, CONUS",
        "coverage": [-125.0, 24.0, -66.0, 50.0], "cadence": "5 min",
        "providers": [NoddS3Provider("noaa-goes18", "G18"),
                      AddeProvider("RTIMAGES", "GWCNC13", 13)],
    },
    "sat.goes-east.vis": {
        "title": "GOES-East (GOES-19) ABI band 2 visible (0.64 um), CONUS, via ADDE",
        "coverage": [-125.0, 24.0, -66.0, 50.0], "cadence": "5 min",
        "providers": [AddeProvider("RTIMAGES", "GECNC02", 2)],
    },
    "sat.goes-west.vis": {
        "title": "GOES-West (GOES-18) ABI band 2 visible (0.64 um), CONUS, via ADDE",
        "coverage": [-125.0, 24.0, -66.0, 50.0], "cadence": "5 min",
        "providers": [AddeProvider("RTIMAGES", "GWCNC02", 2)],
    },
    "sat.himawari.geocolor": {
        "title": "Himawari-9 full disk GeoColor",
        "coverage": [84.0, -60.0, -163.0, 60.0], "cadence": "10 min",
        "providers": [CiraSliderProvider("himawari", "full_disk", "geocolor")],
    },
    "sat.himawari.ir-clean": {
        "title": "Himawari-9 AHI band 13 clean IR, full disk",
        "coverage": [84.0, -60.0, -163.0, 60.0], "cadence": "10 min",
        "providers": [CiraSliderProvider("himawari", "full_disk", "band_13")],
    },
    "sat.viirs-noaa20.truecolor": {
        "title": "VIIRS (NOAA-20) corrected reflectance true color, CONUS, daily",
        "coverage": [-125.0, 24.0, -66.0, 50.0], "cadence": "daily",
        "providers": [GibsWmsProvider("VIIRS_NOAA20_CorrectedReflectance_TrueColor",
                                      [-125.0, 24.0, -66.0, 50.0])],
    },
}

_frame_lock = threading.Lock()

def get_times(ds_id, limit=12):
    ds = DATASETS[ds_id]; errors = []
    for p in ds["providers"]:
        if getattr(p, "available", True) is False:
            errors.append(f"{p.name}: unavailable (missing netCDF4)"); continue
        try:
            return p.times(limit), p.name, errors
        except Exception as e:
            errors.append(f"{p.name}: {e}")
    raise RuntimeError("; ".join(errors) or "no provider")

def get_frame(ds_id, time_iso=None):
    """Returns (png_bytes, meta dict). Cached by dataset+time."""
    ds = DATASETS[ds_id]
    times, provider_name, _ = get_times(ds_id, 24)
    if not times: raise RuntimeError("no frames available")
    chosen = times[0]
    if time_iso:
        for t in times:
            if t["time"] == time_iso: chosen = t; break
    cache_key = re.sub(r"[^A-Za-z0-9_.-]", "_", f"{ds_id}__{chosen['id']}") + ".png"
    cpath = os.path.join(CACHE, cache_key)
    provider = next(p for p in ds["providers"] if p.name == provider_name)
    if os.path.exists(cpath):
        png = open(cpath, "rb").read()
    else:
        with _frame_lock:
            png = provider.frame(chosen["id"])
            with open(cpath, "wb") as f: f.write(png)
    valid = datetime.fromisoformat(chosen["time"].replace("Z", "+00:00"))
    meta = {
        "dataset": ds_id, "title": ds["title"], "valid_time": chosen["time"],
        "provider": provider_name, "source": provider.licence,
        "coverage_wsen": ds["coverage"],
        "stale_seconds": max(0, int((datetime.now(timezone.utc) - valid).total_seconds())),
        "bytes": len(png),
    }
    return png, meta

# ---------------------------------------------------------------- HTTP API

OPENAPI = {
    "openapi": "3.0.3",
    "info": {"title": "nct-weather-bridge", "version": VERSION,
             "description": "General weather-data adapter owned by nct-geo-services. PNG frames + JSON; see /docs."},
    "paths": {
        "/v1/catalog": {"get": {"summary": "Dataset catalogue"}},
        "/v1/datasets/{id}/times": {"get": {"summary": "Available frame times, newest first",
            "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string"}},
                           {"name": "limit", "in": "query", "schema": {"type": "integer"}}]}},
        "/v1/datasets/{id}/frame": {"get": {"summary": "PNG frame (default latest); metadata in X- headers",
            "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string"}},
                           {"name": "time", "in": "query", "schema": {"type": "string"}}]}},
        "/v1/datasets/{id}/frame.json": {"get": {"summary": "Frame metadata as JSON, no image bytes"}},
        "/v1/health": {"get": {"summary": "Service + provider status"}},
        "/openapi.json": {"get": {"summary": "This schema"}},
        "/docs": {"get": {"summary": "Human documentation (README rendered as text)"}},
    },
}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, body, ctype="application/json"):
        if isinstance(body, (dict, list)): body = json.dumps(body, indent=1).encode()
        if isinstance(body, str): body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        try:
            if u.path == "/v1/health":
                provs = {}
                for ds in DATASETS.values():
                    for p in ds["providers"]:
                        provs[p.name] = getattr(p, "available", True)
                return self._send(200, {"service": "nct-weather-bridge", "version": VERSION,
                                        "providers": provs, "cache": CACHE,
                                        "cache_files": len(os.listdir(CACHE))})
            if u.path == "/openapi.json": return self._send(200, OPENAPI)
            if u.path == "/docs":
                readme = os.path.join(os.path.dirname(os.path.abspath(__file__)), "README.md")
                return self._send(200, open(readme).read() if os.path.exists(readme) else "no README",
                                  "text/plain; charset=utf-8")
            if u.path == "/v1/catalog":
                cat = []
                for ds_id, ds in DATASETS.items():
                    cat.append({"id": ds_id, "title": ds["title"], "cadence": ds["cadence"],
                                "coverage_wsen": ds["coverage"],
                                "providers": [p.name for p in ds["providers"]]})
                return self._send(200, {"datasets": cat})
            m = re.match(r"^/v1/datasets/([a-z0-9.-]+)/(times|frame|frame\.json)$", u.path)
            if m:
                ds_id, kind = m.group(1), m.group(2)
                if ds_id not in DATASETS: return self._send(404, {"error": "unknown dataset", "id": ds_id})
                if kind == "times":
                    limit = int(q.get("limit", ["12"])[0])
                    times, provider, _ = get_times(ds_id, limit)
                    return self._send(200, {"dataset": ds_id, "provider": provider, "times": times})
                time_iso = q.get("time", [None])[0]
                png, meta = get_frame(ds_id, time_iso)
                if kind == "frame.json": return self._send(200, meta)
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                for k, hk in (("dataset", "X-Dataset"), ("valid_time", "X-Valid-Time"),
                              ("provider", "X-Provider"), ("stale_seconds", "X-Stale-Seconds")):
                    self.send_header(hk, str(meta[k]))
                self.send_header("X-Coverage", ",".join(str(v) for v in meta["coverage_wsen"]))
                self.send_header("Content-Length", str(len(png)))
                self.end_headers(); self.wfile.write(png); return
            return self._send(404, {"error": "not found", "path": u.path,
                                    "hint": "see /docs and /v1/catalog"})
        except Exception as e:
            return self._send(502, {"error": "provider failure", "detail": str(e)})

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int,
                    default=int(os.environ.get("NCT_WEATHER_BRIDGE_PORT", "8765")))
    a = ap.parse_args()
    ThreadingHTTPServer(("127.0.0.1", a.port), Handler).serve_forever()

if __name__ == "__main__":
    main()
