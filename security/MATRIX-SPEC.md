# Security matrix — draft spec

Status: **DRAFT** — a drafting surface, not a settled design.
Companion: `SECURITY-MODEL.md` in this directory (the discussion this draft
is drawn from). All profile names, grades, weights and thresholds below are
placeholders for discussion, marked `?` where the owner has not decided.

The spec is four axes and the rules for combining them:

```
        profile  ×  capability  →  disposition
        disposition + plug catalogue  →  what the app actually gets
        disposition + access events   →  indicator state
        access events + ML score      →  heat  →  tier override
```

---

## Axis 1 — Capabilities

The things an app can ask for. First set (draft):

| # | Capability | Notes |
|---|---|---|
| C1 | Microphone | Audio input stream |
| C2 | Camera | Video input stream |
| C3 | Network | Outbound / inbound connections; per-domain detail feeds heat, not the disposition |
| C4 | Location | Position, at a precision the plug can degrade |
| C5 | Files outside app dir | Read/write beyond the app's own folder |
| C6 | Contacts / calendar store | The user's address book and events |
| C7 | Photos / media library | The user's image/media store |
| C8 | Screen capture | Screenshots / recording of other windows |
| C9 | Clipboard | Read (write is lower-risk; split if needed `?`) |
| C10 | Spawn / execute | Launching other programs, shells, interpreters |
| C11 | Persistence | Autostart, background services, scheduled jobs |
| C12 | Device sensors `?` | Accelerometer etc. — include in v1 or defer `?` |

**Hard-floor candidates** (never granted by profile alone, always an
explicit prompt, never heat-gated — from SECURITY-MODEL §2.3): overwriting
system files, ptrace / inspecting another process, raw disk access,
reading the credential store. Final list: **open question 5** in
SECURITY-MODEL.md.

---

## Axis 2 — Dispositions (what a cell can say)

Every (profile × capability) cell takes one of these values:

| Code | Disposition | Runtime behaviour |
|---|---|---|
| `ALLOW` | Allow + indicate | Request succeeds against the real source; indicator shows active, then latched |
| `ASK` | Ask | Prompt on first use per app (per session `?` / once ever `?`); answer is remembered for that app under this profile |
| `PLUG` | Redirect to plug | Request succeeds against the plug named in Axis 4; indicator shows plugged state; user notified on engagement |
| `DENY` | Deny | Request fails as "unavailable"; indicator shows attempted/denied (latched) |
| `SANDBOX` | Allow inside sandbox only | Request succeeds only while the app/capability runs contained (portal / bubblewrap) |

---

## Axis 3 — Profiles × capabilities (the matrix)

Profiles are grades chosen by the user, system-wide by default in
Settings, overridable per app. Draft set of four:

### P1 — Open / Transparent
*The owner's example profile: apps do things without asking; the UI shows
everything. Only location asks.*

| Capability | Disposition |
|---|---|
| C1 Microphone | `ALLOW` |
| C2 Camera | `ALLOW` |
| C3 Network | `ALLOW` |
| C4 Location | `ASK` |
| C5 Files outside app dir | `ALLOW` |
| C6 Contacts / calendar | `ALLOW` `?` |
| C7 Photos / media | `ALLOW` |
| C8 Screen capture | `ASK` `?` |
| C9 Clipboard read | `ALLOW` |
| C10 Spawn / execute | `ALLOW` |
| C11 Persistence | `ASK` `?` |

### P2 — Balanced
*Ask once for the intimate capabilities; indicate everything.*

| Capability | Disposition |
|---|---|
| C1 Microphone | `ASK` |
| C2 Camera | `ASK` |
| C3 Network | `ALLOW` |
| C4 Location | `ASK` |
| C5 Files outside app dir | `ASK` |
| C6 Contacts / calendar | `ASK` |
| C7 Photos / media | `ASK` |
| C8 Screen capture | `ASK` |
| C9 Clipboard read | `ALLOW` |
| C10 Spawn / execute | `ALLOW` |
| C11 Persistence | `ASK` |

### P3 — Redirect
*Nothing intimate is real unless the user has said so per app; plugs
satisfy requests so apps keep working.*

| Capability | Disposition |
|---|---|
| C1 Microphone | `PLUG` (silence) |
| C2 Camera | `PLUG` (avatar / virtual camera) |
| C3 Network | `ALLOW` |
| C4 Location | `PLUG` (fixed location set in advance) |
| C5 Files outside app dir | `PLUG` (app's own folder presented as the store) |
| C6 Contacts / calendar | `PLUG` (empty / decoy store) |
| C7 Photos / media | `PLUG` (curated subset) |
| C8 Screen capture | `DENY` `?` |
| C9 Clipboard read | `PLUG` (last item the user copied *for* an app `?`) |
| C10 Spawn / execute | `SANDBOX` |
| C11 Persistence | `ASK` |

### P4 — Locked
*Deny by default; the sandbox tier is the starting point, not the
escalation.*

| Capability | Disposition |
|---|---|
| C1 Microphone | `DENY` |
| C2 Camera | `DENY` |
| C3 Network | `ASK` |
| C4 Location | `DENY` |
| C5 Files outside app dir | `SANDBOX` |
| C6 Contacts / calendar | `DENY` |
| C7 Photos / media | `DENY` |
| C8 Screen capture | `DENY` |
| C9 Clipboard read | `DENY` |
| C10 Spawn / execute | `SANDBOX` |
| C11 Persistence | `DENY` |

Profile questions still open:

- [ ] Names and count: are P1–P4 the right grades, and what are they
      called in the UI?
- [ ] Is the default profile for a new install P1, P2, or chosen in the
      setup wizard (the Platform Configuration step is the natural home)?
- [ ] Per-app overrides: full row override per app, or per-cell?
- [ ] Scope of an `ASK` answer: this session / this app forever / until
      the profile changes?
- [ ] Can a profile be scheduled or switched by context (e.g. by
      network), or is it a manual setting only?

---

## Axis 4 — Plug types (per capability)

A plug is a pre-set substitute source/sink, configured ahead of time in
Settings. The app's request succeeds against the plug; the app is not
told. The user is notified on engagement (see Axis 5, state I3).

| Capability | Plug types (draft catalogue) |
|---|---|
| C1 Microphone | Silence · room tone · generated voice / voice-changer stream · recorded loop |
| C2 Camera | Black frame · blurred real feed · avatar / virtual camera · still image |
| C3 Network | Local-only · VPN-only · logged proxy · sinkhole (records, returns nothing) |
| C4 Location | Fixed address (set in advance — "set locations ahead of time") · city-level precision only · plausible moving route |
| C5 Files | App's own folder as the world · a designated shared folder · read-only view of the real store |
| C6 Contacts / calendar | Empty store · decoy store · curated subset |
| C7 Photos / media | Curated subset · empty library |
| C8 Screen capture | Capture of the app's own window only · blank frame |
| C9 Clipboard | Clipboard frozen at the moment of the request `?` · empty |
| C10 Spawn | — (no plug; disposition is `SANDBOX` instead) |
| C11 Persistence | Session-only (runs now, nothing survives logout) |

Plug rules (from SECURITY-MODEL §5.1):

1. Plugs are configured **ahead of time**; no runtime decision.
2. **Notify on engagement**, not on configuration.
3. Plugs are **per profile**, overridable **per app**
   (e.g. the call app gets the real camera; all others get the avatar).
4. A plug must present the same interface as the real source (a PipeWire
   node, a location service answer, a folder) — the redirection lives in
   the system's service layer, not in per-app shims `?` (implementation
   question).

---

## Axis 5 — Indicator states

Indicators are drawn **by the shell only**, on the app's window frame and
on its icon in the menu/launch bar, in a region the app cannot paint
over. One indicator per capability per app.

| State | Name | Rendering (draft) | Set when | Clears when |
|---|---|---|---|---|
| I0 | None | No icon | Capability unused this session | — |
| I1 | **Active** | Icon lit, flickering / pulsing | Data is flowing now (mic open, camera streaming, net transfer, location query in progress) | Flow stops → I2 |
| I2 | **Used this session** (latched) | Icon present, steady, dimmed | Capability was used at least once while the app is open ("has used net while open") | App closes |
| I3 | **Plugged** | Icon with plug badge / distinct colour, steady; pulses like I1 while flowing | The disposition in force is `PLUG` and the app has engaged the plug | App closes (the fact is also logged) |
| I4 | **Attempted / denied** | Icon struck or outlined | App requested a capability whose disposition is `DENY`, or an `ASK` was refused | App closes `?` |
| I5 | **Sandboxed** `?` | Icon with a containment frame/badge | Heat tier (§6) has sandboxed this app or capability | Sandbox lifted (tier decay / user action) |

Rendering / salience rules (draft):

- **Always salient:** C1 mic, C2 camera, C4 location — I1 always flickers.
- **Graded:** C3 network — I1 flickers only for a *new domain*, *large
  volume*, or *background* use; ordinary foreground traffic shows I2
  only. (Anti-fatigue rule; thresholds from the heat table.)
- **Background use is always salient**, for every capability: an app in
  the background touching mic/camera/net raises its launch-bar icon even
  if its window is hidden.
- Indicators are **key-click reachable** `?`: in a key-click desktop the
  indicator should be an addressable object — focus it to see what, when,
  which domain/device, and to act (revoke, plug, sandbox now). Wording
  and keys: open.
- A **session receipt** survives the latch: Settings > Security shows,
  per app, what was used, when, and whether it was real or plugged
  (the latched icons are the live view of the same record).

---

## 6. Combination rules — profile, heat, and override

Order of evaluation for any access:

```
1. Hard floor?            → explicit prompt, always (no profile, no heat)
2. Heat tier override?    → if the app/capability is at tier ≥ sandbox,
                            disposition is forced to SANDBOX (or DENY at
                            the top tier) regardless of profile
3. Per-app override?      → the app's own cell, if the user set one
4. Profile cell           → ALLOW / ASK / PLUG / DENY / SANDBOX
5. Indicator + heat       → set indicator state (Axis 5);
                            add heat (§6.1)
```

### 6.1 Heat increments by disposition (draft)

The same access heats differently depending on how it was satisfied —
authorised-and-seen is not the same signal as redirected or denied:

| Outcome of an access | Heat effect |
|---|---|
| `ALLOW` under profile, foreground, known target | +small (e.g. +2) |
| `ALLOW`, background, or new domain/device | +medium (e.g. +6) |
| `PLUG` satisfied | +0 — nothing real was exposed |
| `ASK` granted by user | +small, and the grant is remembered per §Axis 3 |
| `ASK` refused / `DENY` attempted anyway, repeatedly | +medium per repeat |
| ML watcher anomaly score | + (score × scale), per SECURITY-MODEL §3.4 |
| Any hard-floor attempt without approval | straight to top tier |

Heat decay, fast/slow buckets and tier thresholds: as drafted in
SECURITY-MODEL §2.1 / §2.3 (two buckets, `max(fast, slow)`, no cancelling
by reputation).

### 6.2 Worked examples

| Scenario | Result |
|---|---|
| Notes app opens mic, P1, foreground | `ALLOW`; I1 flickers while recording, then I2 latched; heat +2 |
| New agent-made game opens mic, P3 | `PLUG` (silence); I3 shown; user notified once; heat +0 |
| Browser reaches a new domain, P1, foreground | `ALLOW`; I2 latched (no flicker — ordinary traffic) |
| Same browser, large upload in background | I1 flickers on the launch-bar icon; heat +6 |
| Script reads contacts at 03:00 for the 3rd night running | ML/peer-baseline deviation adds heat; tier forces `SANDBOX` for C6 on next launch, whatever the profile says; I5 shown |

---

## 7. Settings surface (draft)

Where this is configured — all ahead of time, none of it at access time
except `ASK` prompts:

- **Settings > Environment > Security** (beside Platform Configuration):
  - Profile selector (P1–P4) + per-app override table
  - Plug configuration, per capability (incl. setting fixed locations
    ahead of time)
  - Hard-floor list (read-only? editable? `?`)
  - Session receipts: per app × capability, real vs. plugged, times
  - Heat view: the app × capability heatmap itself, with tier lines —
    the same table the system uses, shown to the user

---

## 8. Open decisions for the owner

1. a. ○ Capability set: C1–C11 as drafted
   b. ◉ Capability set: smaller v1 — C1 mic, C2 camera, C3 net,
      C4 location, C5 files — rest follow
2. a. ◉ Four profiles (P1–P4) as drafted, names to be settled in UI work
   b. ○ Three profiles (drop P3 Redirect; plugs become per-app only)
   c. ○ Five+ profiles
3. a. ◉ Default profile: chosen in the setup wizard, P2 pre-selected
   b. ○ Default profile: P1 (the owner's example posture) for all installs
4. a. ◉ Indicators: window frame + launch-bar icon, shell-drawn, I0–I5
   b. ○ Indicators: launch-bar icon only in v1
5. a. ◉ Plugs: per profile with per-app override
   b. ○ Plugs: per app only, no profile-level plugs
