# Monitor app — draft spec

Status: **DRAFT** — a drafting surface, not a settled design.
Companions: `SECURITY-MODEL.md` (the discussion) and `MATRIX-SPEC.md`
(profiles × capabilities × plugs × indicators) in this directory.

Origin: owner's proposal, 2026-11-25 — an app in the desktop environment
that lets someone monitor what an app does in different capabilities and
notifies the user if a notification was asked for. The user can attach a
monitor to what files an app accesses, what IP addresses it accesses, and
how much. There is instrumentation for apps already; this app would exist
to monitor these things, for security, or double as that instrumentation
surface.

Attribution: the proposal above is the owner's. The structure below is
Kavi's drafting from it, with prior art marked as survey.

---

## 1. What the app is

The Monitor app is the **user-facing front end of the watcher layer**
(SECURITY-MODEL §3). The eBPF/EDR event stream is infrastructure; this app
is the user holding it directly.

It does three things:

1. **Attach** — the user attaches a monitor to a chosen app's activity in
   a chosen capability stream, with a condition and a notification.
2. **Watch** — live and historical views of what apps are doing, per
   capability: files, destinations, volumes, devices, children.
3. **Notify** — when an attached monitor's condition is met, the user is
   notified the way they asked to be. Otherwise the monitor is silent.

### 1.1 Attached monitors vs. system monitoring

|  | System monitoring (heat / ML) | Attached monitor (this app) |
|---|---|---|
| Who sets it | The profile / the system | The user, per app, per stream |
| Scope | Everything, always | One app × one stream × one condition |
| Output | Heat increment → sandbox tier | A notification, when the asked-for condition is met |
| Acts on the app? | Yes, at tiers | No — it reports. Acting stays the tier table's job, unless the user explicitly attaches an action (§7, open) |

### 1.2 Attached monitors vs. session receipts

MATRIX-SPEC §Axis 5 drafts **session receipts**: a passive, always-kept
record per app × capability (what was used, when, real or plugged).
Attached monitors are the active counterpart: filtered, conditioned,
expiring. Both read the same underlying log; receipts are the default
grain, monitors are the user's deliberate watches on top of it.

---

## 2. The monitor record

A monitor is set up ahead of time, like a plug — no decision is made at
access time. Attaching a monitor never changes what the app may do.

```
monitor = {
  app:        app id, or "any app" ?, or an app class
              (e.g. all agent-made apps)
  stream:     one stream from §3
  filter:     stream-specific narrowing (§3) — may be empty (= all)
  grain:      summary | full                       (§6)
  condition:  one condition from §4 — required;
              a monitor with no condition is refused
  notify:     desktop notification | indicator-only |
              notification + indicator latch         (§5)
  expiry:     until app closes | this session |
              until a date/time | until fired N times
              — required; a monitor with no expiry is refused
  created:    timestamp + how it was attached (§8)
}
```

Refusals are deliberate: **no condition, no monitor; no expiry, no
monitor.** An unconditioned, unexpiring watch is just the receipts log
with extra overhead, and an unbounded claim on the user's attention.

Worked examples:

```
{ app: agent-made game, stream: network, filter: all destinations,
  condition: connects to an IP or country not seen before for this app,
  notify: desktop notification, expiry: until app closes }

{ app: notes app, stream: files, filter: reads outside its own folder,
  condition: more than 100 distinct files in a minute,
  notify: notification + indicator latch, expiry: this session }

{ app: browser, stream: network, filter: uploads only,
  condition: cumulative upload > 500 MB in a session,
  notify: indicator-only, expiry: until fired 1 time }
```

---

## 3. Streams and filters

Streams follow the capability list in MATRIX-SPEC Axis 1. Each stream
names what an event in it carries and what it can be filtered by.

| Stream | An event carries | Filterable by |
|---|---|---|
| **Files** | Path, operation (open/read/write/delete), size, first-access flag | Path prefix, inside/outside app dir, operation, extension `?` |
| **Network** | Remote IP, domain (where known), port, protocol, bytes up/down, foreground/background | Destination, domain suffix, country `?`, port, direction, new-destination-only |
| **Devices (mic/camera)** | Device, open/close, duration, foreground/background | Device, background-only |
| **Location** | Access time, precision served (real / plugged), foreground/background | Background-only, precision |
| **Contacts / calendar / photos** | Store, access time, count of items touched (not content — §9) | Store, count threshold |
| **Clipboard** | Access time, read/write (not content — §9) | Read-only, background-only |
| **Process** | Child process, command, exit | Command name, shell/interpreter children only |
| **Persistence** | What was registered (autostart, service, job) and when | — (every event is notable) |

Volume questions ("how much") are first-class in every stream: counts,
distinct targets, bytes, and rate are computed at summary grain without
keeping every event (§6).

---

## 4. Conditions (the notification catalogue)

A condition is what turns an event stream into a notification. Draft
catalogue, by kind:

**First-time conditions**
- [ ] First access to a capability this session (first mic open, first
      file outside the app dir)
- [ ] First connection to a destination (IP / domain / country) not seen
      before *for this app*
- [ ] First child process of a kind (first shell, first interpreter)

**Threshold conditions**
- [ ] Volume: bytes up/down, files touched, items read — over a total
      or a rate (per minute / per session)
- [ ] Distinct targets: more than N distinct files / domains / IPs in
      a window
- [ ] Duration: device held open longer than T

**Context conditions**
- [ ] Any access while the app is in the **background**
- [ ] Any access while the screen is locked / the user is away `?`
- [ ] Access outside the app's usual hours `?` (needs a baseline —
      this is where an attached monitor may borrow the ML watcher's
      per-app baseline, SECURITY-MODEL §3.4)

**Mismatch conditions**
- [ ] Access to a capability the app has not declared / never used
      before (its own history is the reference)
- [ ] A plugged capability being engaged (the plug notification in
      MATRIX-SPEC is a pre-set monitor of exactly this kind)

Composition: conditions combine with AND within one monitor (`?` — or
is one condition per monitor the rule, with several monitors per app?).
Draft leans **one condition per monitor** — it keeps a firing
explainable in one sentence: "Monitor X fired because Y."

---

## 5. Notification and firing

- A firing names, in one view: **the monitor, the app, the condition,
  and the reading that met it** — what happened, when, and the numbers
  (e.g. "142 distinct files in 60 s; threshold was 100").
- **Silence discipline:** a monitor that has not fired says nothing. No
  "still monitoring" confirmations, no periodic summaries unless the
  user asked for a summary as the condition. The monitor's existence is
  shown in the app (§8), not by nagging.
- A firing can **latch the app's indicator** (MATRIX-SPEC state I2/I4
  family, plus a notified marker `?`): a missed notification remains
  visible on the app's window and launch-bar icon until the user looks.
- Firings are **kept**: the app holds a firing history per monitor,
  including monitors that have since expired, for the retention period
  the user sets (§9).
- Repeat behaviour: fire once and expire, fire and cool down
  (minimum interval between firings), or fire every time — set per
  monitor, defaulting to **fire once per condition-crossing, then cool
  down** `?`.

---

## 6. Grain and overhead

Full event capture on a busy app is a firehose; grain is chosen at
attach time.

| Grain | What is kept | Cost | Use |
|---|---|---|---|
| **Summary** (default) | Counts, distinct targets, volumes, first/last times, destinations — aggregates only | Low; sustainable always-on per monitor | Security watching: "what, where, how much" |
| **Full** | Every event, in order, with timestamps | High; a deliberate, usually short-lived mode | Instrumentation / debugging (§7) |

Summary grain is enough for every condition in §4 except exact-sequence
questions, which belong to Full grain and to a session, not a standing
monitor.

---

## 7. The second face: instrumentation

Survey note: the doubling the owner named is real in prior art —
Sysinternals Process Monitor is a security-era tool that became the
standard Windows instrumentation surface; OpenSnitch and Safing
Portmaster are per-app network monitors whose logs developers also work
from. The event stream does not care why it is being read.

Draft position: **one app, two views over the same stream.**

|  | Security view | Developer view |
|---|---|---|
| Grain | Summary (§6) | Full |
| Vocabulary | Capabilities, destinations, volumes, devices | Syscalls, file opens, process tree, timing |
| Typical watch | Standing monitor, expiring | A session, started/stopped by hand |
| Reader | Any user | The person who made (or asked an agent to make) the app |

For **agent-made apps** the Developer view has a specific job: it is the
verification surface for agent work. The person who asked for the app
can watch what the result actually does — files, network, children —
against what was asked for, with provenance free: the system already
knows which apps are agent-made, when, and from which session.

Open: is the Developer view a mode of this app, or a separate
instrumentation app sharing the stream and the log store? (§10)

---

## 8. The app's surface (draft)

A paramorphic app in Flat Space terms; shell furniture it is not — it is
a normal app the user opens, plus the attach points in the shell.

- **Attach points** (in the shell, not the app):
  - On an app's window indicator or launch-bar icon: *Attach monitor…*
    — pre-fills `app` and the indicator's stream.
  - On an app icon: *Attach monitor…* before launch — the monitor is
    armed first and watches from the app's first event.
  - In Settings > Security receipts: *Monitor this* on any
    app × capability row.
- **Views in the app:**
  - **Monitors** — the standing list: app, stream, condition, expiry,
    state (armed / fired / expired), each removable.
  - **Live** — per-app activity as it happens, by stream, at summary
    grain; pause-able.
  - **Per-app page** — for one app: destinations map/list, files
    touched, volumes over time, devices, children; the receipts and the
    full-grain sessions in one place.
  - **Firings** — notification history (§5).
- **Key-clicks:** attaching, listing and reading firings must all be
  key-click operable, like every Flat Space surface; indicator attach
  points are addressable objects (see MATRIX-SPEC Axis 5, open item).

---

## 9. Protections on the monitor itself

The monitor's log is a profile of the user: every file and destination,
timestamped. It is protected accordingly:

- **Local only.** Nothing in this app leaves the machine by default.
- **Content is out of scope.** Streams record that contacts/clipboard/
  files were accessed, and counts — not the content accessed. Content
  capture is not a monitor feature. (Full-grain file *paths* are kept;
  file *contents* are not.)
- **Retention is the user's setting** — session-only, days, or until
  cleared — applied to receipts, firings and full-grain sessions alike.
- **Reading the log is itself a capability** in the MATRIX-SPEC sense:
  an app asking for monitor data asks like any other sensitive store,
  and the Monitor app's own accesses are receipted like any app's.
- The event stream's collection is the system's (the watcher layer);
  this app is a reader of it. Turning the app off does not blind the
  heat/ML layer, and vice versa — the two are separable in Settings.

---

## 10. Open decisions for the owner

1. a. ◉ One app, two views (Security + Developer) over one stream
   b. ○ Security only; instrumentation stays a separate app
2. a. ◉ Conditions: one per monitor; several monitors per app allowed
   b. ○ Conditions compose (AND/OR) inside one monitor
3. a. ◉ Default grain: Summary; Full is a hand-started session only
   b. ○ Grain is per-monitor, Full allowed as a standing monitor
4. a. ○ Notify: desktop notification by default
   b. ◉ Notify: per-monitor choice, indicator-latch offered every time
5. a. ◉ Attach points: indicator / app icon / receipts row, as §8
   b. ○ Attach only from inside the Monitor app in v1
6. a. ○ A fired monitor may also act (plug / sandbox the app) if the
      user attached an action
   b. ◉ Monitors notify only in v1; acting stays with the heat tiers

## 11. Open questions

- [ ] "Any app" and app-class monitors (all agent-made apps): in v1,
      or per-app only?
- [ ] Does an attached monitor add heat when it fires, or is it purely
      the user's channel, separate from the tier system?
- [ ] Export: can a firing history / full-grain session be exported as
      a file (for a bug report against an agent-made app, say)?
- [ ] Naming: is this app "Monitor", or does it sit inside a broader
      Security app alongside profiles, plugs and receipts?
