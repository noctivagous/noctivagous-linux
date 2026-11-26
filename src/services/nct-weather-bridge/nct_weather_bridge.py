#!/usr/bin/env python3
"""nct-weather-bridge — a general Python adapter for weather data.

Owned by nct-geo-services (spec: src/modules/nct-geo-services/
WEATHER-BRIDGE.md). Serves upstream meteorological systems
(CIRA/RAMMB Slider, NOAA Open Data S3; ADDE and EDEX specced as
later providers) behind one documented local HTTP API returning
PNG frames + JSON. Any client can consume it; the Godot GOES
viewer in src/godot/apps/nct-weather/ is the first.

Stdlib HTTP server. Runtime deps: Pillow, numpy. The nodd-s3
provider additionally needs netCDF4; without it that provider
reports itself unavailable instead of failing the service.

Run:  python3 nct_weather_bridge.py [--port 8765]
Env:  NCT_WEATHER_BRIDGE_PORT, NCT_WB_CACHE (cache directory)
"""
import argparse, io, json, os, re, sys, threading, time
import urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

VERSION = "0.1.0"
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
    """GOES GeoColor from RAMMB/CIRA Slider: JSON times + PNG tiles."""
    name = "cira-slider"
    licence = "NOAA/NESDIS data via CIRA/RAMMB Slider; public, attribution to CIRA/NOAA"
    GRID = {1: (2, 2), 2: (4, 4)}   # zoom -> (tiles_x, tiles_y), tile=625px
    def __init__(self, sat):
        self.sat = sat              # e.g. goes-19
    def times(self, limit=12):
        url = f"https://slider.cira.colostate.edu/data/json/{self.sat}/conus/geocolor/latest_times.json"
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
                     f"{self.sat}---conus/geocolor/{ts}/{zoom:02d}/{y:03d}_{x:03d}.png")
                log_egress(self.name, u)
                tile = Image.open(io.BytesIO(http_get(u, 60))).convert("RGB")
                mosaic.paste(tile, (x * 625, y * 625))
        buf = io.BytesIO(); mosaic.save(buf, "PNG")
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
        "providers": [NoddS3Provider("noaa-goes19", "G19")],
    },
    "sat.goes-west.ir-clean": {
        "title": "GOES-West (GOES-18) ABI band 13 clean IR, CONUS",
        "coverage": [-125.0, 24.0, -66.0, 50.0], "cadence": "5 min",
        "providers": [NoddS3Provider("noaa-goes18", "G18")],
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
