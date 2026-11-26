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
            "sat.goes-east.ir-clean", "sat.goes-west.ir-clean"})
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

if __name__ == "__main__":
    unittest.main()
