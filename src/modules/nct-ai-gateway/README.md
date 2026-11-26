# nct-ai-gateway

The environment's AI resources, brokered for system services and
applications alike. One front door: a consumer asks for a capability,
never for a key, a model file or a harness binary.

Owns:
- Connections and API keys — named connections (provider presets,
  custom endpoints, local runtimes). Keys live in the credential
  store and are NEVER handed to consumers: the service makes the
  call; consumers see last-4 fingerprints only. Probing a connection
  returns typed results (invalid_key / no_credit / unreachable /
  no_models), in plain language. (Pattern: ai-live-web-editor's
  connections design.)
- Models — the registry of what each connection actually offers,
  grouped by modality (text / image / video / audio / embedding /
  transcription), and the per-modality defaults. A default is valid
  only against a verified model on a probed connection.
- MCP — the registry of MCP servers (local stdio and remote): their
  tool lists, their state, and which consumers may use which tools.
- Connectors — authenticated integrations with outside services,
  exposed as tools. A connector may ride MCP underneath, but it is
  registered, granted and revoked as its own thing.
- Skills — the system skill library: SKILL.md folders (name /
  description / triggers frontmatter, body loaded on trigger only,
  a body token budget — the ai-live-web-editor contract), installed
  as packages via nct-package-coordinator, consumable by services,
  apps and harnesses.
- CLI Harnesses — registered agent harnesses (the Muse SDK
  path, Muse, further harnesses as they arrive): their binding,
  working directory and sandbox profile. Every harness run is a
  security-profiled activity the Monitor can attach to.

Access rules:
- Per-consumer grants are capabilities under nct-security-manager.
  Using a key and calling an external model are ASK-class; a PLUG
  can redirect a granted external call to a local model instead,
  with notice. Nothing leaves the machine by default: a local
  model satisfies a request with no egress, and an external call
  is shown as the egress it is.
- Declared system uses: a system service that wants AI help
  declares the convention up front — what signals it sends, what
  for. Named conventions so far: nct-system-watch troubleshooting
  an Issue (explain a failure, draft a fix), and monitoring
  summaries over system resources and activity. The service
  proposes; the owning module disposes. AI output is marked as AI
  output and never silently merged into evidence — an Issue's
  facts and its AI commentary stay separate.
- Usage accounting per consumer (calls, tokens, cost where the
  connection prices it), visible in Settings → AI.

Settings surface: Settings → AI is this service's page, registered
into nct-settings-service, with the sections MCP · Connectors ·
Skills · CLI Harnesses · API Keys · Models.

Hosting / language: a service process outside the shell (the §9
bridge pattern), so out-of-shell consumers such as nct-system-watch
can reach it even when the shell is down; shell-side client library
for GDScript / C# consumers.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Host: a host's services may hold standing grants, and monitoring
  conventions are the typical use; egress rules do not relax.
- Kiosk: AI surfaces are off unless the kiosk's one app declares
  them.

Status: STUB — laid out 2026-11-26 at the owner's direction, not
built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1. Design sources:
ai-live-web-editor (connections / BYOK, skills contract, harness
choice as a first-class setting).
