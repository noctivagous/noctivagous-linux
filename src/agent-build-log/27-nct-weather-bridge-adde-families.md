# 27 — nct-weather-bridge 0.4.0: the remaining ADDE families

2026-11-26. Branch feat/nct-weather-bridge, on top of b0b93a5
(v3). NOT pushed — awaiting the user's push word.

## What was asked

After v3 landed, the user asked whether the bridge has all the
data sources behind https://www.ssec.wisc.edu/mcidas. It had the
satellite-imagery slice. The user then said to do "the
applicable" others. The McIDAS data surface is ADDE dataset
groups on the public server; the applicable families were the
rest of RTIMAGES, NEXRAD radar, RTGRIDS model grids, and
RTPTSRC point observations. RTWXTEXT (weather text) is present
on the server but its WTXG request dialect was not cracked in
this pass, so it is recorded as the one family left, not built.

## What was built

All of it rides the one AddeClient (the VisAD port), extended
with three more request types ported from the same classical
sources (AddeGridReader, AddePointDataReader, GridDirectory):

- Images (register entries on AddeProvider, which gained
  band=None for derived/composite products, ID= station
  selection, UNIT= selection, a radar colormap, and a max-lines
  override): GOES band 8 water vapour (East/West), band 13 full
  disk (East/West), band 13 mesoscale 1 (East/West), derived
  precipitable water and cloud-top pressure, and the GLOBAL-IR,
  MOLL-IR, ARCTIC-IR and ANTARCTICIR composites. 14 new frame
  datasets; every one verified live with a served frame.
- Radar: radar.nexrad.ncr-dfw (FWS) and radar.nexrad.ncr-chi
  (LOT), RTNEXRAD NCR fetched with UNIT=X (raw data levels;
  UNIT=BRIT multiplies levels by 16) and coloured with the
  operational reflectivity palette.
- Grids (new provider AddeGridProvider, dataset kind "grid"):
  model.gfs.t850 — GFS 850 hPa temperature. GDIR lists headers
  (the directory is in file order, so times are sorted by valid
  time); GGET streams open with heartbeat pairs (4, 11223344),
  POS= does not address grids ("Dataset limit is 300"), so a
  frame fetch takes the PARM/LEV-filtered set (NUM=48) and picks
  by header. Rendered from the native 65x93 grid with a
  temperature ramp.
- Point obs (new provider AddePointProvider, dataset kind
  "obs"): obs.surface-hourly — RTPTSRC/SFCHOURLY records as
  JSON at /v1/datasets/{id}/obs (station, lat, lon, t_k, td_k,
  time). The MD file holds the whole day in append order, so
  records are selected server-side by synoptic hour; the
  provider probes back from the current UTC hour. Catalog and
  OpenAPI carry the new endpoint and the per-dataset kind.

Protocol facts established by probing (all in the bridge README
register): ADDE has three date encodings — AREA directories use
CYYDDD, grid directories and MD records use YYYYDDD (the first
grid implementation produced year 3926 before this was caught);
MDKS SELECT wants colon times (TIME 13:00:00), HHMMSS ints are
rejected as "unit was invalid"; MDKS parameters also travel as
the packet's binary-data block; McIDAS longitude is
positive-west; ANTARCTICIR resolves in RTIMAGES, not in the
RTIMAGES2 group its LWPR listing suggests.

## Verification (this sandbox, proxy-tunnelled egress)

- Offline tests 14/14 (3 new: grid header parse, GGET
  heartbeat-skip + orientation, MDKS record decode incl. the
  positive-west negation).
- Every new frame dataset served a frame via the running bridge
  (frame.json 200 with provider adde): WV, full disk, mesoscale,
  PW, CTP, all four composites, both NEXRAD sites, GFS T850.
- Visually inspected: GFS T850 (cold air mass over the northern
  plains, warm south — the first render was upside down; the
  arrival order is northernmost row first and the flip was
  removed) and NEXRAD Chicago (levels discriminate correctly;
  the disk-wide echo is what the server sends for this storm
  day — raw UNIT=X levels confirmed identical in distribution
  to the BRIT rendering, so the bridge is faithful to the
  source).
- Obs sanity: KORD decodes to 41.9833, -87.9166 with T/Td in
  Kelvin; the 13:00Z response holds 8,296 stations worldwide.

## Not done / open

- RTWXTEXT (WTXG) — the last McIDAS family; needs its request
  dialect worked out.
- EDEX (AWIPS) remains the next spec slice (now v5), then push
  notifications and place-relative products (v6).
- NEXRAD beyond two sites is a register decision (any site id
  works via ID=); the same is true of NAM/UKMT grids and the
  other RTPTSRC descriptors (upper air, ship/buoy, MOS).
