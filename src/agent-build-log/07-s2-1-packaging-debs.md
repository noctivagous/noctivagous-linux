# 07 — S2.1: the two debs (2026-11-25)

**Done:** tools/build-deb.sh builds both packages from src/:
- **nct-foundation 0.1.0** (19 KB) — /usr/lib/nct/{core,godot,services,
  tools,tests} (build residue stripped: .godot caches, test results)
  plus the system/ overlay at its real paths (etc/greetd,
  usr/share/wayland-sessions, usr/lib/systemd/user). Depends line
  names the package-list set.
- **nct-godot-runtime 0.1.0** (40 MB) — the pinned engine at
  /usr/lib/nct/godot/godot + PIN.md; the zip is sha256-verified
  against PIN.md at build time, cached under ~/.cache/nct-build.

Output in src/distro/debs/ (gitignored; src/distro/.gitignore added).

**Gate, passed:** both debs extracted to a staging root; every path
the configs name is present, session scripts are executable, and the
packaged godot binary runs (4.3.stable.official.77dcf97d8). Full
dpkg-level install is exercised by S2.2's rootfs, which installs
these exact files with apt.

**Small thing worth remembering:** dpkg-deb refuses a control
directory with mktemp's 0700 permissions; the script chmods the
package roots to 755 before building.
