# Security model — discussion record

Status: discussion, not a settled design. Originated 2026-11-24 / 2026-11-25.
Companion drafts: `MATRIX-SPEC.md` in this directory (profiles × capabilities ×
plug types × indicator states) and `MONITOR-APP.md` (the user-attached
monitor app: per-app watches on files, network destinations and volumes,
with asked-for notifications; also the instrumentation surface).

Attribution: sections marked **Owner** are the owner's proposals, in the owner's
terms. Sections marked **Survey** are Kavi's account of prior art and theory
brought into the discussion. The two are kept separate deliberately.

---

## 1. Where this started

**Owner (2026-11-24):** sandboxing in Noctivagous-Linux could initially be
limited to the system's own apps that the agent is writing — sandboxing of apps
is not done on every Linux distro. Going further: an *exclusion-based* sandbox
for agent-made apps — the apps would be barred from certain things, but access
to the microphone, network, etc. would not matter and could be allowed.

**Owner (2026-11-25):** instead of exclusion vs. inclusion for our security, is
there such a thing as a heatmap / Q-table where it increases before activating
sandbox activity?

**Owner (2026-11-25):** there are also machine learning models for this purpose
already that people use, that watch activity.

**Owner (2026-11-25):** the visible-UI / profiles / plugs proposal — recorded in
full in §5 below.

---

## 2. Survey — binary models vs. accumulative models

The two familiar sandbox models are both binary:

| Model | Rule |
|---|---|
| Inclusion / allowlist | Nothing runs (or reaches a capability) unless listed |
| Exclusion / blocklist | Everything runs unless listed |

A third family exists and is well established: **accumulative / risk-adaptive**
models, where no single signal decides anything. Weak signals add to a score;
containment escalates only when the total crosses tiers.

Precedents:

- **SpamAssassin** — the canonical case. 100+ weak tests each add points;
  a total at or over threshold is treated as spam. Additive scoring replaced
  allow/blocklists for exactly this problem shape.
- **fail2ban / CrowdSec** — failed logins add heat to an IP; heat decays;
  tiers produce a temporary ban, a longer ban, a firewall drop.
- **Cloudflare Bot Score (1–99), reCAPTCHA v3, Stripe Radar** — a continuous
  score per actor/request, not a verdict. The site decides which score gets
  challenged, sandboxed, or blocked.
- **Zero Trust / NIST SP 800-207 — RAdAC (Risk-Adaptive Access Control)** —
  access re-evaluated continuously from device, behaviour and resource
  sensitivity. Policy is a function, not a list.
- **UEBA + SOAR graduated response** — watch → step-up authentication →
  isolate process → isolate host, as anomaly score climbs.

### 2.1 The heatmap, literally

A 2-D table — app × capability/resource — where each cell carries a heat
value. This is both a data structure and a displayable Settings surface:

```
heat(t+1) = heat(t) × decay  +  Σ weights(event)
            e.g. ×0.9 / hr       read contacts +3
                                 spawn shell +8
                                 write outside app dir +6
                                 network to unseen domain +2
                                 mic while backgrounded +10
```

Response is tiered, not a switch, and sandboxing can be per-capability
(triggered by the hot cell) rather than per-app:

| Heat | Response |
|---|---|
| 0–19 | Run native, log provenance only |
| 20–49 | Log + show in the Security panel, no friction |
| 50–79 | Sandbox that capability only (e.g. filesystem via bubblewrap/portal); the rest stays native |
| 80–99 | Full sandbox on next launch + user prompt stating why |
| 100+ | Quarantine / kill; approval required to run again |

### 2.2 The Q-table form

Reframed, the heat table is a hand-authored Q-table:

- **State `s`** = (app, capability, resource sensitivity, recent context)
- **Action `a`** = allow / log / portal / sandbox / deny
- **`Q(s,a)`** = expected cost of that action in that state

The research literature does use actual reinforcement learning here — RL for
adaptive access control, and for dynamic malware-sandbox configuration
(choosing how long / how instrumented a detonation run to use).

In production, almost nobody ships a *learned* Q-table:

1. **Adversarial gaming** — an app that probes slowly learns to stay just
   under threshold indefinitely (low-and-slow).
2. **Poisoning** — if benign behaviour cools heat, an attacker performs
   benign behaviour first to buy credit.
3. **Explainability** — "the table learned it" is not an answer a user
   accepts when their app is sandboxed. A weighted sum is.

Production keeps the Q-table *shape*, hand-weights it, and tunes weights
offline only.

### 2.3 The necessary hybrid

Pure heat fails for catastrophic actions: overwriting system files or
ptracing another process should not be allowed twice because heat had not
built up yet. The working model in practice:

- **Hard floor (exclusion, tiny list):** a few never-without-approval
  actions; no heat involved.
- **Heat zone (everything grey):** mic, network, external files, spawning,
  persistence — capabilities that do not matter by themselves, only in
  combination and rate.
- **Two buckets, not one:** a *fast* heat (acute spike, decays in minutes)
  and a *slow* heat (pattern over days). Take `max(fast, slow)`; do not let
  a trust/reputation total cancel them, or long benign history will cancel
  a sudden spike — which is exactly the exploit.

---

## 3. Survey — ML models that watch activity

Yes: this is a whole product category, in three layers:

```
watch (telemetry)  →  model (score)  →  heat / response
eBPF / kernel sensor   anomaly 0–100     sandbox tier
```

### 3.1 EDR — watches processes, on the machine

- **SentinelOne** — on-device Behavioural AI: learns what normal process,
  file, registry, network and user activity looks like, scores deviations
  from that baseline in real time. Can kill and roll back ransomware
  autonomously, offline.
- **CrowdStrike Falcon** — same telemetry, correlation in the cloud
  (Threat Graph): a behaviour seen causing ransomware elsewhere raises
  heat for it on this machine.
- **Microsoft Defender for Endpoint, Cortex XDR, Elastic Defend** — same
  shape: sensor → behavioural models → scored incident.

Model types underneath, mostly unglamorous:

- **GBDT (XGBoost / LightGBM)** on tabular features — parent process,
  signer, path, rarity. Still the production workhorse.
- **Sequence models** — LSTM / GRU / transformers learning temporal
  patterns from event sequences.
- **Static ML** before anything runs — e.g. the EMBER model on a file's
  structure; no execution needed.

### 3.2 UEBA — watches users and entities, in the aggregate

Microsoft Sentinel UEBA, Splunk UBA, Exabeam, Darktrace. Sentinel UEBA uses
machine learning to build dynamic behavioural profiles for users, hosts, IP
addresses, applications and other entities, detects anomalies against those
baselines, and assigns risk scores from deviation in geography, device,
frequency, and difference from peer groups.

**Darktrace** is the purest version: unsupervised only, no signatures. It
learns a "pattern of life" per user/device and reports only deviation
from self.

### 3.3 Research / open models

Published, with code; the ancestors of the products above:

| Model | Input | Technique |
|---|---|---|
| stide (Forrest, 1996) | Syscall sequences | The origin — a database of normal short syscall sequences; anything unseen is anomalous. Pre-ML, still the shape. |
| DeepLog (2017) | System logs | LSTM treats logs as language, learns normal execution paths, flags deviation. |
| Kitsune / KitNET (2018) | Network packets | Ensemble of small autoencoders, online and unsupervised; ran in real time on a Raspberry Pi. |
| HOLMES, StreamSpot, Unicorn | Provenance graph (process → file → socket as one graph) | Graph sketching / embeddings. Catches a *chain* that is individually innocent: editor → shell → download → execute. |
| Joe Sandbox / ANY.RUN + classifiers | API-call sequences in a sandbox run | Markov chains / LSTM / GNN on the call graph to verdict malware families. |

On Linux, the watcher half already exists and is not ML itself: **Falco,
Tetragon, Tracee** — eBPF sensors streaming syscall, file and network
events. A model sits on top of their output.

### 3.4 How the ML watcher couples to the heat model

In practice nobody lets the model act directly. The wiring is:

1. **Watcher** (eBPF / EDR sensor) streams events — no decisions.
2. **Model** outputs only a score — "this sequence is 0.87 unlike this
   app's own baseline", or "0.92 like known-bad".
3. **That score is the heat increment** — high-confidence anomaly adds a
   lot, low-confidence adds a little.
4. **The deterministic tier table** (§2.1) decides sandbox / portal /
   quarantine.

Reasons for the separation: the model is probabilistic, drifts, and can be
fooled; the tier table is auditable, explainable to the user, and cannot be
talked out of its hard floor.

Known failure mode to design against: a per-app baseline model needs a
learning period, and a new agent-made app doing weird-but-legitimate things
(code generation spawning compilers) looks a lot like a dropper. Every EDR
solves this with a **peer baseline** as second opinion (what do apps *like
this* do?). For Noctivagous-Linux the peer group would be: all agent-made
apps.

---

## 4. The three layers, composed

```
1. Behind the scenes   heat / ML watcher → sandbox tiers     (§2, §3)
2. At the surface      indicators — what is happening,
                       shown where it is happening          (§5)
3. In the middle       plugs — what the app actually gets
                       when it asks                          (§5)
```

Layers 2 and 3 are only possible because Noctivagous-Linux controls the
shell/compositor. A normal app platform cannot do them credibly.

---

## 5. Owner — visible security, graded profiles, plugs (2026-11-25)

The owner's proposal, in the owner's terms:

- Since we control the UI, attach **hot-topic access indicators** to the
  windows of apps, or to the app icons in the menu bar, when they do
  things. Just let them do things (security profile chosen by user).
- We would have a **security profile with grades**, preferred by the user.
  One of them would let the apps do things like access the mic, camera and
  net **without asking**, but then icons would show up: "has used net while
  open" would say in place, and when active it would light up and flicker.
- We can take things that are usually hidden and **expose them**, and add a
  **UI level of security** instead of just behind the scenes.
- The user could in the system set it by default, for example, that apps
  only have to **ask for location**.
- We would also have the ability to **set locations ahead of time
  (plugs)**.
- In one security profile, let it access the mic or a camera but
  **redirect it to our own data stream (plug)** and **notify the user**.

### 5.1 Survey notes on the proposal

**Indicators — prior art and the difference.** What exists: iOS/macOS
orange/green recording dots, Android 12 mic/camera indicator + Privacy
Dashboard, Windows 11 taskbar mic icon, Micro Snitch / Little Snitch on
Mac. All are *global and transient* — one dot, top corner, gone when access
stops. The owner's version differs in two ways that matter:

- **Per-window and per-app-icon**, not one global dot — with three apps
  open the user can see *which one* is on the mic without opening a
  dashboard.
- **A latched "used this session" state**, not only a live state. Most
  exfiltration is a two-second burst; a purely live indicator is gone
  before the user looks up. "Has used net while open" is a receipt.

Non-negotiable implementation condition: **the shell draws the indicators,
never the app**, in a part of the frame the app cannot paint over — the
same principle as an OS secure-attention path. An indicator an app can
draw, an app can fake or hide. In Flat Space terms: shell furniture,
outside the app's own document.

Risk to design against: **indicator fatigue**. Network access flickers
constantly; an always-flickering net icon becomes wallpaper. Grading by
kind is the fix: mic/camera/location always salient; net salient only for
a new domain, large volume, or background use — which is where the heat
table (§2) feeds the UI.

**Profiles — the answer to prompt fatigue.** Prompt-per-access is what
killed Vista UAC and burdens Flatpak portals. The user chooses a posture
once, in Settings; prompts happen only where *their profile* says so.
"Only location has to ask" is one cell-setting in one profile, applied
system-wide, overridable per app. Formally this is a policy matrix
(profile × capability), drafted in `MATRIX-SPEC.md`.

**Plugs — the strongest piece.** Partial precedents: Android/iOS
approximate location, iOS limited photo library and dummy contacts,
PipeWire giving a sandboxed app a virtual audio node, a VPN as a network
plug, Qubes feeding apps different domains. Nobody ships it as a general,
user-configured concept. Generalised:

> A plug is a **pre-set substitute source/sink for a capability**,
> configured ahead of time in Settings — so at runtime there is no
> decision to make, and the app's request succeeds *against the plug*.

Properties that keep plugs honest:

1. **Notify on engagement, not on configuration** — when an app actually
   draws from a plug, its indicator shows the plugged state and the user
   gets a quiet, latched notice. Silent redirection with no trace would
   also trap the user (a call "fails" for no visible reason).
2. **The app cannot tell — mostly, and that is intended.** From the app's
   side a plug is just the device, which is what makes it better than Deny
   for compatibility: no crash, no error, no nagging. Where detection is
   possible (silent mic in a voice call), the profile is the user's stated
   preference, so it is their call.
3. **Plugs are per profile, overridable per app** — "the call app gets the
   real camera, everything else gets the avatar plug" is the configuration
   people will actually want.

### 5.2 How the layers compose — worked examples

App opens the mic under an Open/Transparent profile:

```
request → profile: allow, no ask
        → indicator lights on its window + icon (active)
        → flicker stops, latch stays: "mic used this session"
        → heat +small (profile authorised it; user saw it)
```

Same request under a Redirect profile:

```
request → profile: plug
        → app receives the substitute stream
        → indicator shows the plugged state; user notified once
        → heat +0 (nothing real was exposed)
```

Same request, backgrounded, third time tonight, from a new app:

```
        → heat spike; ML watcher flags deviation from baseline/peer group
        → profile is overridden by tier:
          next launch is sandboxed regardless of profile
```

Summary of roles:

- **Profile** = the user's standing intent
- **Indicators** = live truth, at the surface
- **Plugs** = safe satisfaction of a request
- **Heat / ML** = the override, when behaviour stops matching intent

---

## 6. Open questions

1. Capability list: is the first set mic / camera / net / location / files
   outside app dir / contacts / screen capture / clipboard / spawning —
   or a smaller first set?
2. Profile set: how many grades ship, and what are they named?
3. Plug catalogue per capability (see `MATRIX-SPEC.md` draft).
4. Indicator states and rendering rules, incl. the anti-fatigue grading
   for network (see `MATRIX-SPEC.md` draft).
5. Hard-floor list: which actions are never heat-gated and never
   profile-allowed without an explicit prompt?
6. Watcher choice for Linux: Falco / Tetragon / Tracee output + which
   model class first (GBDT on features is the Survey recommendation for a
   first version; sequence/graph models later)?
7. Peer group definition for agent-made apps, and the learning-period
   behaviour for a newly created app.
8. Where this lives in Settings: Environment > Security, alongside the
   Platform Configuration section?
