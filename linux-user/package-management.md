---
layout: guide
title: "Package Management"
description: "Use APT and dpkg to manage software on Debian/Ubuntu systems, configure repositories and PPAs, handle dependencies, and build software from source with autotools and CMake."
stage: "Stage 04"
permalink: /linux-user/package-management/
prev_topic:
  title: "Process Management"
  url: /linux-user/process-management/
next_topic:
  title: "Networking Basics"
  url: /linux-user/networking/
---

## APT — Advanced Package Tool
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

APT is the high-level package manager for Debian and Ubuntu systems. It resolves dependencies automatically and communicates with online repositories.

### Essential APT Commands

```bash
# Update the local package index (doesn't upgrade anything)
sudo apt update

# Upgrade all installed packages to their latest versions
sudo apt upgrade

# Full upgrade — may add/remove packages to satisfy deps
sudo apt full-upgrade

# Install one or more packages
sudo apt install nginx git build-essential

# Remove a package (keep config files)
sudo apt remove nginx

# Remove a package AND its config files
sudo apt purge nginx

# Remove unused packages that were auto-installed
sudo apt autoremove

# Clean downloaded .deb package cache
sudo apt clean           # remove all cached .deb files
sudo apt autoclean       # remove only outdated cached .debs
```

### Searching and Inspecting

```bash
# Search for packages by name or description
apt search nginx
apt search "web server"

# Show detailed package information
apt show nginx

# List installed packages
apt list --installed
apt list --installed | grep python

# List packages that have upgrades available
apt list --upgradable
```

**`apt show` output:**
```
Package: nginx
Version: 1.22.1-9
Depends: nginx-common (= 1.22.1-9), libc6 (>= 2.28), libpcre3, ...
Installed-Size: 497 kB
Homepage: https://nginx.org
Description: small, powerful, scalable web/proxy server
```

---

## dpkg — Debian Package Manager
{:.gc-basic}

`dpkg` is the low-level backend that APT uses. It installs local `.deb` files and provides detailed package inspection tools.

```bash
# Install a local .deb file
sudo dpkg -i package.deb

# Fix broken dependencies after manual dpkg install
sudo apt install -f

# Remove a package
sudo dpkg -r package_name

# List all installed packages
dpkg -l
dpkg -l | grep nginx

# List files installed by a package
dpkg -L nginx

# Find which package owns a file
dpkg -S /usr/sbin/nginx

# Show package info
dpkg -s nginx

# Get detailed info from a .deb file (not installed)
dpkg --info package.deb
dpkg --contents package.deb    # list contents
```

**`dpkg -l` format:**
```
Desired=Unknown/Install/Remove/Purge/Hold
Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend
Err?=(none)/Reinst-required (Status,Err: uppercase=bad)
||/ Name            Version          Architecture Description
+++-===============-=================-=============-====================================
ii  nginx           1.22.1-9          amd64         small, powerful, scalable web server
rc  vim             2:9.0.1378-2      amd64         Vi IMproved - enhanced vi editor
```
- `ii` = installed (desired + status both "Install")
- `rc` = removed but config files remain

---

## Repositories and PPAs
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### `sources.list` and `sources.list.d`

APT knows where to find packages through repository definitions:

```bash
cat /etc/apt/sources.list
# deb https://archive.ubuntu.com/ubuntu jammy main restricted universe multiverse
# deb https://archive.ubuntu.com/ubuntu jammy-security main restricted

ls /etc/apt/sources.list.d/     # additional repo files (PPAs, third-party)
```

**Adding a PPA (Personal Package Archive):**
```bash
sudo add-apt-repository ppa:deadsnakes/python
sudo apt update
sudo apt install python3.12
```

**Adding a repository manually (e.g., Docker official repo):**
```bash
# 1. Add GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 2. Add repo definition
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list

# 3. Update and install
sudo apt update && sudo apt install docker-ce
```

### Holding Packages

Prevent a specific package from being upgraded:

```bash
sudo apt-mark hold linux-image-generic   # hold
sudo apt-mark unhold linux-image-generic # release
apt-mark showhold                        # list held packages
```

### APT Pinning

Fine-grained control over which version of a package to install, useful when mixing stable and backports repositories:

```bash
# /etc/apt/preferences.d/backports
Package: *
Pin: release a=jammy-backports
Pin-Priority: 400

Package: git
Pin: release a=jammy-backports
Pin-Priority: 900    # prefer backports version of git
```

Priorities: < 0 never install; 0–100 installed only if no other version; 100 default; > 1000 downgrade allowed.

```bash
apt-cache policy git    # show available versions and priorities
```

---

## Building Software from Source
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

Sometimes a package isn't available, is too old, or you need a custom build configuration. Building from source gives full control.

### Autotools (configure / make / make install)

Most traditional Unix software uses the GNU autotools build system.

```bash
# Install build dependencies
sudo apt install build-essential

# Typical workflow
wget https://example.com/myapp-1.0.tar.gz
tar -xzf myapp-1.0.tar.gz
cd myapp-1.0

# 1. Configure — checks dependencies, sets install prefix, generates Makefile
./configure --prefix=/usr/local --enable-ssl --without-debug

# 2. Build
make -j$(nproc)       # use all CPU cores

# 3. Test (if the project has a test suite)
make check

# 4. Install
sudo make install

# Uninstall (if supported)
sudo make uninstall
```

**Useful configure flags:**
```bash
./configure --help               # list all options
./configure --prefix=/opt/myapp  # install to /opt instead of /usr/local
./configure CC=clang             # use clang instead of gcc
./configure CFLAGS="-O2 -march=armv7-a"  # cross-compile flags
```

### CMake

Modern C/C++ projects use CMake, which generates build files for your platform.

```bash
sudo apt install cmake

git clone https://github.com/example/project.git
cd project
mkdir build && cd build         # out-of-source build (recommended)

# Configure
cmake .. -DCMAKE_BUILD_TYPE=Release \
          -DCMAKE_INSTALL_PREFIX=/usr/local \
          -DBUILD_SHARED_LIBS=ON

# Build
cmake --build . -- -j$(nproc)

# Install
sudo cmake --install .

# List all CMake options
cmake .. -LH
```

**Cross-compiling with CMake (for embedded boards):**
```bash
# toolchain.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(CMAKE_C_COMPILER arm-linux-gnueabihf-gcc)
set(CMAKE_CXX_COMPILER arm-linux-gnueabihf-g++)
set(CMAKE_FIND_ROOT_PATH /opt/sysroot)

cmake .. -DCMAKE_TOOLCHAIN_FILE=toolchain.cmake
```

### Getting Build Dependencies Automatically

```bash
# Install build dependencies declared in the source package
sudo apt build-dep nginx

# Download source package
apt source nginx
```

---

## Creating a .deb Package
{:.gc-adv}

Packaging your own software allows proper installation, upgrade, and removal via APT.

### Minimal .deb Structure

```
myapp_1.0-1_amd64/
├── DEBIAN/
│   ├── control          # required metadata
│   ├── postinst         # post-install script (optional)
│   ├── prerm            # pre-remove script (optional)
│   └── conffiles        # list of config files (optional)
└── usr/
    ├── bin/
    │   └── myapp        # the binary
    └── share/
        └── doc/
            └── myapp/
                └── copyright
```

**`DEBIAN/control`:**
```
Package: myapp
Version: 1.0-1
Architecture: amd64
Maintainer: Eslam Mohamed <eslam@example.com>
Depends: libc6 (>= 2.17), libssl3
Description: My Application
 This is a longer description of the application.
 It can span multiple lines (start continuation lines with a space).
```

**`DEBIAN/postinst`:**
```bash
#!/bin/bash
set -e
systemctl daemon-reload
systemctl enable myapp
systemctl start myapp
```

```bash
# Set correct permissions
chmod 755 myapp_1.0-1_amd64/DEBIAN/postinst

# Build the package
dpkg-deb --build --root-owner-group myapp_1.0-1_amd64

# Install it
sudo dpkg -i myapp_1.0-1_amd64.deb

# Verify
dpkg -l myapp
dpkg -L myapp    # list installed files
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `apt remove` and `apt purge`?**

> `apt remove` removes the package binary but leaves configuration files on disk (under `/etc`). `apt purge` removes everything including configuration files. Use `purge` when you want a clean slate before reinstalling, or to free disk space completely. You can `purge` already-removed packages: `sudo apt purge nginx` will clean up configs even after the binary is gone (status shows `rc` in `dpkg -l`).

**Q2 — Basic: Why do you need to run `apt update` before `apt install`?**

> `apt update` synchronises the local package index (stored in `/var/lib/apt/lists/`) with the upstream repositories. Without it, APT may install an outdated version, fail to find a new package, or miss security updates. It does NOT upgrade anything — it just refreshes the list of available versions.

**Q3 — Intermediate: How would you install a specific version of a package?**

```bash
# List available versions
apt-cache policy nginx
# or
apt list -a nginx

# Install specific version
sudo apt install nginx=1.22.1-9
```

**Q4 — Intermediate: What happens when you run `dpkg -i package.deb` and it fails with "dependency problems"?**

> `dpkg` does not resolve dependencies automatically — it simply refuses to configure the package if dependencies are unmet. Fix it with `sudo apt install -f` (or `apt --fix-broken install`), which instructs APT to resolve and install the missing dependencies, then retry configuration.

**Q5 — Advanced: How would you cross-compile a package for an ARM board on an x86 machine?**

> 1. Install a cross-toolchain: `sudo apt install gcc-arm-linux-gnueabihf`.
> 2. Set `CC`, `CFLAGS`, and `--host` flags to target the ARM architecture:
> ```bash
> ./configure --host=arm-linux-gnueabihf --prefix=/usr CFLAGS="-march=armv7-a -mfpu=neon"
> make -j$(nproc)
> ```
> 3. Copy the resulting binary to the target board (via SCP or by mounting the SD card image).
> For complex projects, use a **sysroot** (a copy of the target's `/usr` and `/lib`) and point `--sysroot` to it to resolve library dependencies correctly.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 8 apt` | APT command reference |
| `man 1 dpkg` | dpkg command reference |
| `man 5 apt_preferences` | APT pinning documentation |
| Debian Policy Manual | [debian.org/doc/debian-policy](https://www.debian.org/doc/debian-policy/) |
| CMake documentation | [cmake.org/documentation](https://cmake.org/documentation/) |
| Autotools tutorial | [gnu.org/software/automake/manual](https://www.gnu.org/software/automake/manual/automake.html) |
