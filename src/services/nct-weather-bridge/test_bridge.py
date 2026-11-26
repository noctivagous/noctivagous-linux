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
            "sat.viirs-noaa20.truecolor"})
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

if __name__ == "__main__":
    unittest.main()
