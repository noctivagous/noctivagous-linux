# nct-communication-gateway

The environment's communication channels, brokered for system
services and applications — the same gateway pattern as
nct-ai-gateway, for reaching people instead of models. A consumer
asks to send, receive or place a call; it never touches an account
password, a modem or a platform session directly.

Owns:
- Channels — the registry of communication channels and how each
  is reached:
  - Email: accounts over IMAP / SMTP (standards, self-hostable —
    a Host-mode machine can be its own server).
  - SMS / MMS: via the machine's cellular modem (through
    nct-linux-sys-interface to ModemManager), a paired phone, or
    a carrier / aggregator connection.
  - Phone: voice calls via modem or SIP; call state, in-call
    hand-off to the app that owns the call surface.
  - Open social protocols: ActivityPub, Matrix, RSS — native
    channels, below.
- Identities — which accounts and addresses the user communicates
  AS, per channel, registered once and shown in Settings. (System
  users and groups stay nct-account-manager's; identities here are
  the user's faces on channels.)
- Compose / send / receive — the brokered API for apps: compose a
  message or place a call on a channel, read received items the
  user has granted, see channel state. Sending AS the user is an
  ASK-class capability under nct-security-manager, per app, per
  channel; received stores are private by default.
- Routing into nct-notification-centre: incoming messages and
  calls arrive as notifications from this gateway, so urgency,
  do-not-disturb and history behave the same whatever the channel.

Social media — three tiers, because platforms are not protocols:
- Tier 1, native: where the network is an open protocol
  (ActivityPub / Mastodon, Matrix, RSS), the gateway speaks it
  directly — a real channel like email.
- Tier 2, official API: where a platform offers an API on terms,
  it registers as a connector (key, rate limits, the platform's
  rules), granted and revocable like any connector — with the
  standing warning that a platform can change or withdraw it.
- Tier 3, the platform's own app: everything else stays in the
  company's own app or website, running as a foreign app. The
  gateway does NOT broker the conversation and never scrapes or
  automates a platform against its terms. What it still provides:
  the identity registered in Settings, the app's notifications
  flowing through the notification centre, and share hand-off —
  an app composes here, the gateway passes the content to the
  platform app / site as a share target or deep link, and the
  user finishes and sends it there.

Settings surface: Settings → Communication is this gateway's
page, registered into nct-settings-service: Channels · Identities ·
Social (each platform badged Native / API / Own app, so the level
of integration is never a surprise) · Permissions.

Hosting / language: a service process outside the shell (the §9
bridge pattern), beside nct-ai-gateway — channels must keep
receiving while the shell is down, and nct-system-watch's
conventions may need to reach the user on a channel.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Host: the host may BE a channel server (mail, Matrix) for the
  household; the gateway is then its own first consumer.
- Kiosk: channels off unless the kiosk's one app declares one
  (e.g. a call point).

Status: STUB — laid out 2026-11-26 at the owner's direction, not
built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
