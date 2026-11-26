#!/usr/bin/env python3
"""Offline tests for nct_weather_bridge: registry, time parsing,
catalogue shape, and the S3 filename time extraction. Live provider
checks are in the build log (they need the network by definition).
Run: python3 -m unittest test_bridge -v  (or pytest)
"""
import re, unittest
from datetime import datetime, timezone
import nct_weather_bridge as b

class TestRegistry(unittest.TestCase):
    def test_datasets_registered(self):
        self.assertEqual(set(b.DATASETS), {
            "sat.goes-east.geocolor", "sat.goes-west.geocolor",
            "sat.goes-east.ir-clean", "sat.goes-west.ir-clean",
            "sat.goes-east.vis", "sat.goes-west.vis",
            "sat.himawari.geocolor", "sat.himawari.ir-clean",
            "sat.viirs-noaa20.truecolor",
            "sat.goes-east.wv", "sat.goes-west.wv",
            "sat.goes-east.fulldisk-ir", "sat.goes-west.fulldisk-ir",
            "sat.goes-east.meso1-ir", "sat.goes-west.meso1-ir",
            "sat.goes-east.pw", "sat.goes-east.ctp",
            "sat.composite.global-ir", "sat.composite.mollweide-ir",
            "sat.composite.arctic-ir", "sat.composite.antarctic-ir",
            "radar.nexrad.ncr-dfw", "radar.nexrad.ncr-chi",
            "model.gfs.t850", "obs.surface-hourly"})
    def test_ids_name_things_not_providers(self):
        for ds_id in b.DATASETS:
            for p in ("cira", "s3", "adde", "edex"):
                self.assertNotIn(p, ds_id)
    def test_openapi_covers_endpoints(self):
        for path in ("/v1/catalog", "/v1/datasets/{id}/times",
                     "/v1/datasets/{id}/frame", "/v1/health", "/docs"):
            self.assertIn(path, b.OPENAPI["paths"])

class TestTimes(unittest.TestCase):
    def test_cira_compact_time(self):
        iso, dt = b.iso_from_compact("20261126124117")
        self.assertEqual(iso, "2026-11-26T12:41:17Z")
        self.assertEqual(dt.tzinfo, timezone.utc)
    def test_goes_s3_filename_time(self):
        # GOES file start time: sYYYYDDDHHMMSS + tenths digit
        k = "OR_ABI-L2-CMIPC-M6C13_G19_s20263301201173_e20263301203557_c20263301204021.nc"
        m = re.search(r"_s(\d{13})\d", k)
        dt = datetime.strptime(m.group(1), "%Y%j%H%M%S")
        self.assertEqual((dt.year, dt.hour, dt.minute, dt.second), (2026, 12, 1, 17))
        self.assertEqual(dt.timetuple().tm_yday, 330)

class TestGibs(unittest.TestCase):
    def test_wms_url_shape(self):
        p = b.GibsWmsProvider("VIIRS_NOAA20_CorrectedReflectance_TrueColor",
                              [-125.0, 24.0, -66.0, 50.0])
        u = p.build_url("2026-11-25")
        self.assertIn("LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor", u)
        self.assertIn("BBOX=24.0,-125.0,50.0,-66.0", u)   # WMS 1.3 lat,lon order
        self.assertIn("TIME=2026-11-25", u)
    def test_times_are_daily_descending(self):
        p = b.GibsWmsProvider("L", [-125.0, 24.0, -66.0, 50.0])
        ts = p.times(3)
        self.assertEqual(len(ts), 3)
        self.assertTrue(all(t["time"].endswith("T19:00:00Z") for t in ts))
        self.assertTrue(ts[0]["id"] > ts[1]["id"] > ts[2]["id"])

class TestAdde(unittest.TestCase):
    def test_mcidas_datetime_cyyddd(self):
        dt = b._mcidas_datetime(126330, 130117)   # 2026, day 330, 13:01:17
        self.assertEqual(dt.isoformat().replace("+00:00", "Z"),
                         "2026-11-26T13:01:17Z")
    def test_mcidas_datetime_unpadded_time(self):
        dt = b._mcidas_datetime(126330, 90500)    # 09:05:00 as an int
        self.assertEqual((dt.hour, dt.minute, dt.second), (9, 5, 0))
    def test_adir_scan_finds_directories(self):
        import struct
        def record(day, tod, lines, elems):
            d = [0] * 64                      # 64-word AREA directory
            d[1], d[2], d[3], d[4] = 4, 192, day, tod
            d[8], d[9] = lines, elems
            return struct.pack(">65i", *([300] + d)) + b"\x00" * 200
        body = record(126330, 130117, 1500, 2368) + record(126330, 125617, 1500, 2368)
        entries = b._adir_entries(body)
        self.assertEqual([e["time"] for e in entries],
                         ["2026-11-26T13:01:17Z", "2026-11-26T12:56:17Z"])
        self.assertEqual(entries[0]["lines"], 1500)
    def test_area_directory_rejects_non_area(self):
        import struct
        with self.assertRaises(b.AddeError):
            b._parse_area_directory(struct.pack(">64i", *([0] * 64)))

def _grid_header_words(rows=2, cols=3, ref_day=2026330, ref_time=0, ftime=6,
                       parm="T   ", scale=2, units="K   ", level=850):
    import struct
    w = [0] * 64
    w[1], w[2], w[3], w[4], w[5] = rows, cols, ref_day, ref_time, ftime
    w[6] = struct.unpack(">i", parm.encode())[0]
    w[7] = scale
    w[8] = struct.unpack(">i", units.encode())[0]
    w[9], w[10] = level, 0
    w[11] = struct.unpack(">i", b"MB  ")[0]
    return w

class TestAddeGrids(unittest.TestCase):
    def test_grid_header_parse(self):
        h = b._parse_grid_header(_grid_header_words())
        self.assertEqual((h["rows"], h["cols"]), (2, 3))
        self.assertEqual(h["param"], "T"); self.assertEqual(h["units"], "K")
        self.assertEqual(h["level"], 850.0)
        self.assertEqual(h["run"], "2026-11-26T00:00:00Z")
        self.assertEqual(h["valid"], "2026-11-26T06:00:00Z")
    def test_gget_parse_skips_heartbeats(self):
        import struct
        hdr = _grid_header_words()
        vals = [28000, 28100, 28200, 28300, 28400, -2139062144]
        stream = [4, 11223344, 4, 11223344]
        body = hdr + vals + [0]
        stream += [len(body) * 4, len(body) * 4, 1] + body
        data = struct.pack(f">{len(stream)}i", *stream)
        [(header, grid)] = b._parse_gget(data)
        self.assertEqual(header["valid"], "2026-11-26T06:00:00Z")
        self.assertEqual(grid.shape, (2, 3))
        # column-major arrival, first row sent is northernmost: the
        # first value of column 0 is the top-left cell
        self.assertAlmostEqual(grid[0, 0], 280.0)
        self.assertAlmostEqual(grid[1, 0], 281.0)
        self.assertTrue(grid[1, 2] != grid[1, 2])  # NaN for missing

class TestAddePoints(unittest.TestCase):
    def test_mdks_parse(self):
        import struct
        def pk(s): return struct.unpack(">i", s.ljust(4).encode())[0]
        names = ["ID", "LAT", "LON", "T", "TIME", "DAY"]
        units = ["CHAR", "DEG", "DEG", "K", "HMS", "CYD"]
        scales = [0, 4, 4, 2, 0, 0]
        rec = [pk("KORD"), 419742, 879072, 27106, 130000, 2026330]
        stream = ([len(names) * 4] + [pk(n) for n in names] +
                  [len(units) * 4] + [pk(u) for u in units] +
                  [len(scales) * 4] + scales +
                  [len(rec) * 4] + rec + [0])
        data = struct.pack(f">{len(stream)}i", *stream)
        meta, records = b._parse_mdks(data)
        self.assertEqual([m["name"] for m in meta], names)
        self.assertEqual(len(records), 1)
        r = records[0]
        self.assertEqual(r["ID"], "KORD")
        self.assertAlmostEqual(r["LAT"], 41.9742)
        self.assertAlmostEqual(r["LON"], -87.9072)   # positive-west negated
        self.assertAlmostEqual(r["T"], 271.06)

if __name__ == "__main__":
    unittest.main()
