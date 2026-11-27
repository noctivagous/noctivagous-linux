# Positioning — what this project is, and what it is not

Owner's statement, 2026-11-27. Read this before reaching for another
project's work, and before deciding what deserves effort here.

## The problem being solved

The UX problem with Linux is not that it lacks nice-looking,
customisable GUIs. macOS has looked much the same for a long time;
Windows is mundane and cannot be customised without third-party
extensions. One more theme would change nothing in the big picture.

The problem is that people hit problems with Linux, quality apps are
missing, and writing an app takes a long time. This project attacks
that problem. It is not an attempt to compete with KDE or GNOME on
polish by installing Godot Engine.

## The three things that make it different

1. **A rapid application environment.** Quality apps can be written
   quickly because the foundation is Godot Engine plus the NCT app
   kit: a pinned shared runtime, apps shipped as .pck packs, and a
   kit system that is the project's main focus. Customisation is not
   limited to a set of templates — with AI, a user can have almost
   any UI written for almost any part of the OS.

2. **Key-clicks at the centre.** The entire desktop experience —
   every app and the desktop environment itself — revolves around
   key-clicks, always backwards-compatible with mouse clicks. No
   other desktop environment works this way. Because the interaction
   basis changes, everything is built natively on key-clicks rather
   than adapted from mouse-first originals.

3. **AI agents building apps inside the OS.** Not just AI writing
   code that is compiled elsewhere: agents assemble apps within the
   desktop environment itself, so a suite of quality apps can be put
   together in-environment. This is the answer to the app gap, and
   it is what makes a one-person project viable at this scope.

## What does not make the difference

Slick animations, tiling layouts, and visual polish in general.
Those have been around a long time, other projects have done them,
and they are not where this project's effort goes. The focus stays
on the app kit, key-clicks, and in-OS AI app construction.

## The Noctalia rule

Noctalia (noctalia-dev) is a separate project — a native Wayland
shell family with its own compositor (Umbriel), greeter, and file
manager. The similarity of names is coincidental.

- Take from Noctalia **only** where not using what they have already
  made would waste time — invisible plumbing, such as a compositor
  binding in the compositor slot (see core/compositor/README.md,
  where labwc sits today as a stand-in).
- Never take their shell, greeter, file manager, look, animations,
  or tiling. Anything visible or identity-bearing borrowed from
  them would confuse this project with theirs and make it read as
  derived from their work. It is not.

Any compositor adopted under this rule must stay invisible: if
using it ever made the desktop look or feel like Noctalia, that
would be a reason to stop, not a benefit.
