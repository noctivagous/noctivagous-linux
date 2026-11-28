# distro/identity — STAGING

The distro's identity artifacts, decided 2026-11-28 (boot
chat): written now so every surface keys off one identity;
shipped by the image build when it lands.

- `os-release` — becomes /usr/lib/os-release (+ /etc symlink)
  in the image. ID=noctivagous, ID_LIKE=debian (the build is
  Debian-based and says so), version 0.1 staging.
- `grub-defaults` — the /etc/default/grub values the distro
  ships, including GRUB_DISTRIBUTOR="Noctivagous".

GRUB menu titles: with the stock Debian generator
(/etc/grub.d/10_linux) + GRUB_DISTRIBUTOR, entries read
"Noctivagous GNU/Linux" — accepted by the user as the title
(2026-11-28), so no generator patch for the title is
needed; route 3 reduces to shipping these identity files
in the image build. Verified in the guest's generated
grub.cfg: menuentry 'Noctivagous GNU/Linux' (with
--class noctivagous) and 'Advanced options for
Noctivagous GNU/Linux'. The guest does NOT get a
hand-replaced os-release: it is a Debian test rig and its
os-release stays truthful until the real image replaces
the whole system.
