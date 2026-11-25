# distro/ — the distribution plumbing

Base: Debian 12 (bookworm). Foundation state: the package list the VM
provision installs (debian/package-list.txt) — the same list the image
build will use, so the VM and the image cannot drift apart. The
live-build configuration lands here when the first image is built;
until then the VM *is* the distro test.
