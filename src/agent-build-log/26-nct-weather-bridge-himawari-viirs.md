# 26 — nct-weather-bridge: Himawari + JPSS/VIIRS datasets

Date: 2026-11-26. Asked by: the owner (picking both candidates
from the CIRA-pipeline survey recorded in log 25's spec note:
"Himawari (first non-CONUS coverage) and JPSS/VIIRS (first polar
source)"). Worktree: ~/workspace/noctivagous-linux-geo, branch
feat/nct-weather-bridge on main eb12d0f. NOT pushed.

## Route correction, established by probing

The survey's working assumption was "anonymous NODD buckets, same
as nodd-s3". Probing corrected it:

- noaa-himawari9 / noaa-himawari8 list anonymously, but hold raw
  AHI Level-1b HSD segment files (.DAT.bz2, 10 segments per band
  per scan) — rendering means an HSD decoder, a project of its
  own.
- noaa-jpss's public tree is ocean-colour HDF products (NOAA20/
  VIIRS/…_OC_…) plus SDR/EDR granule families — rendering VIIRS
  imagery from it means geolocation pairing and bowtie handling.
- Both satellites already have rendered services, and using them
  is the bridge's whole pattern (integration over re-implementing
  decoders): CIRA Slider carries Himawari (it is CIRA's own
  processing of the JMA feed its ground station receives), and
  NASA GIBS renders VIIRS for Worldview.

## What was built (bridge 0.3.0)

- CiraSliderProvider generalised: (sat, sector, product) instead
  of hardcoded conus/geocolor. GOES datasets unchanged.
- Himawari datasets via cira-slider (sat id "himawari", sector
  "full_disk"; zoom-1 tile grid is the same 2×2):
  sat.himawari.geocolor (10 min) and sat.himawari.ir-clean
  (AHI band 13). Coverage [84, -60, -163, 60] — full disk centred
  140.7°E, east edge wraps the antimeridian.
- New provider GibsWmsProvider (nasa-gibs): one WMS 1.3.0 GetMap
  per frame from gibs.earthdata.nasa.gov. Dataset
  sat.viirs-noaa20.truecolor — VIIRS_NOAA20_CorrectedReflectance_
  TrueColor over the bridge's standard CONUS box, daily. Frame
  ids are dates; nominal time 19:00Z (CONUS afternoon overpass);
  the current day fills in as passes complete.
- Godot picker: 9 datasets. README register gains the nasa-gibs
  row and the generalised cira-slider row; spec updated (the
  candidate note now records the correction).

## Verification (live, this sandbox, 2026-11-26)

- Offline tests: 11/11 (2 new GIBS tests: WMS URL shape incl.
  1.3.0 lat,lon BBOX order; daily descending times).
- Himawari: times at 10-min cadence; GeoColor frame 200,
  1250×1250, provider cira-slider — inspected: full disk at
  12:50Z, night over East Asia/Australia with GeoColor city
  lights, Japan/China coast, a tropical system near the
  Philippines. ir-clean frame.json serves (band 13, same times).
- VIIRS: frame.json for 2026-11-25 serves via nasa-gibs; the same
  WMS request was also fetched directly and inspected — true
  colour CONUS with polar swath edges, snow cover, and the East
  Coast storm from log 25. (Today's frame is the filling-in
  composite by design; yesterday's is complete.)
- Godot self-test with the 9-dataset picker against the 0.3.0
  bridge: NCT_WEATHER_FRAME_OK 1250x1250 provider=cira-slider
  frames=8 (default dataset path unchanged).
- Scoped claim: bridge + upstreams + app in this sandbox under
  Xvfb software rendering. Nothing about the rig or Vulkan.
- Not built: the raw bucket routes (AHI HSD decoding, VIIRS
  SDR rendering) — recorded in the spec as the pre-product path
  if a consumer ever needs it; Meteosat (needs an EUMETSAT
  account); EDEX (now spec v4); VIIRS day/night band (the GIBS
  layer id probed returned 400 — needs the correct layer name).
