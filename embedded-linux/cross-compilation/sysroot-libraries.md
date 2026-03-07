---
layout: guide
title: "Sysroot & Libraries"
description: "Understanding sysroots for cross-compilation: creating, populating, and using sysroots to provide target headers and libraries to the cross-compiler."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 05"
phase: embedded-linux-cross
permalink: /embedded-linux/cross-compilation/sysroot-libraries/
prev_topic:
  title: "GNU Toolchain"
  url: /embedded-linux/cross-compilation/gnu-toolchain/
next_topic:
  title: "Static vs Dynamic Linking"
  url: /embedded-linux/cross-compilation/static-dynamic-linking/
---

## What Is a Sysroot?
{:.gc-basic}
<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

When a cross-compiler builds a program, it needs two things from the target system:

1. **Headers** (`.h` files) — to know the API of libraries and the kernel (e.g., `<stdio.h>`, `<sys/socket.h>`)
2. **Libraries** (`.so`, `.a` files) — to link against at build time (e.g., `libssl.so`, `libc.so.6`)

The problem is that the host machine's headers and libraries are for x86-64, not for ARM. Using the host's `/usr/include` and `/usr/lib` would lead to building ARM code that references x86 symbol layouts — which would produce broken binaries or simply fail to compile.

A **sysroot** is a directory on the host machine that mirrors the target filesystem's root (`/`). It contains the headers and libraries that belong to the *target* architecture, allowing the cross-compiler to find the correct files when building.

```
sysroot/
├── lib/
│   ├── libc.so.6            ← ARM glibc
│   ├── ld-linux-armhf.so.3  ← ARM dynamic linker
│   └── libm.so.6
├── usr/
│   ├── include/             ← ARM kernel + glibc headers
│   │   ├── stdio.h
│   │   ├── openssl/
│   │   └── ...
│   └── lib/
│       ├── libssl.so        ← ARM libssl
│       ├── libcrypto.so
│       └── pkgconfig/       ← .pc files for pkg-config
└── etc/
    └── ld.so.conf
```

### Default Sysroot in a Debian/Ubuntu Toolchain

When you install `gcc-arm-linux-gnueabihf`, the toolchain comes with a built-in sysroot that contains just the C library and kernel headers:

```bash
$ arm-linux-gnueabihf-gcc -print-sysroot
```
```
/usr/arm-linux-gnueabihf
```

```bash
$ ls /usr/arm-linux-gnueabihf/
```
```
bin  include  lib
```

```bash
$ ls /usr/arm-linux-gnueabihf/include/ | head -15
```
```
aio.h          alloca.h       ar.h           argp.h
assert.h       bits/          byteswap.h     complex.h
cpio.h         ctype.h        dirent.h       dlfcn.h
endian.h       errno.h        execinfo.h     fcntl.h
```

```bash
$ ls /usr/arm-linux-gnueabihf/lib/
```
```
crt1.o          crti.o          crtn.o
ld-linux-armhf.so.3
libanl.so.1     libanl-2.35.so
libc.so.6       libc-2.35.so
libc_nonshared.a
libdl.so.2      libdl-2.35.so
libm.so.6       libm-2.35.so
libpthread.so.0 libpthread-2.35.so
librt.so.1      librt-2.35.so
```

This built-in sysroot is fine for programs that only use the C standard library. The moment your program needs a third-party library (libssl, libcurl, libjpeg, etc.) you need a custom sysroot containing those libraries built for ARM.

### Using --sysroot with GCC

```bash
# Tell gcc to use a custom sysroot instead of its built-in one
$ arm-linux-gnueabihf-gcc \
    --sysroot=/opt/rpi4-sysroot \
    -I/opt/rpi4-sysroot/usr/include \
    -o myapp main.c \
    -lssl -lcrypto

# Equivalent: set via environment variable (used by some build systems)
$ export SYSROOT=/opt/rpi4-sysroot
$ arm-linux-gnueabihf-gcc \
    --sysroot=$SYSROOT \
    -o myapp main.c -lssl
```

The `--sysroot=PATH` flag prepends PATH to all implicit `-I` and `-L` search paths, so the compiler automatically finds headers in `PATH/usr/include` and libraries in `PATH/usr/lib` and `PATH/lib`.

### Simple Example: Compiling Against a Sysroot Header

Suppose your target board (Raspberry Pi) has `libgpiod` installed. You want to cross-compile a GPIO program on the host. With a proper sysroot:

```bash
# Program: toggle_led.c
# #include <gpiod.h>   ← This header must be in the sysroot

$ arm-linux-gnueabihf-gcc \
    --sysroot=/opt/rpi4-sysroot \
    -o toggle_led toggle_led.c \
    -lgpiod

$ file toggle_led
```
```
toggle_led: ELF 32-bit LSB pie executable, ARM, EABI5 version 1 (SYSV),
dynamically linked, interpreter /lib/ld-linux-armhf.so.3,
for GNU/Linux 3.2.0, not stripped
```

Without the sysroot set correctly this would fail with `fatal error: gpiod.h: No such file or directory`.

---

## Creating and Populating a Sysroot
{:.gc-mid}
<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Method 1: rsync From a Running Target Board

The most reliable way to build a sysroot is to copy the relevant directories from the actual target device while it is running. This guarantees exact library versions:

```bash
# Identify the target board's IP address
TARGET_IP=192.168.1.100
SYSROOT=/opt/rpi4-sysroot

mkdir -p $SYSROOT

# Sync the directories needed for cross-compilation
# --rsync-path ensures rsync is available on target
rsync -avz --rsync-path="rsync" \
    pi@${TARGET_IP}:/lib/           $SYSROOT/lib/ \
    pi@${TARGET_IP}:/usr/lib/       $SYSROOT/usr/lib/ \
    pi@${TARGET_IP}:/usr/include/   $SYSROOT/usr/include/ \
    pi@${TARGET_IP}:/lib/arm-linux-gnueabihf/ $SYSROOT/lib/arm-linux-gnueabihf/
```
```
receiving file list ... done
lib/
lib/arm-linux-gnueabihf/
lib/arm-linux-gnueabihf/libc-2.31.so
lib/arm-linux-gnueabihf/libc.so.6 -> libc-2.31.so
lib/arm-linux-gnueabihf/libm-2.31.so
lib/arm-linux-gnueabihf/libm.so.6 -> libm-2.31.so
lib/arm-linux-gnueabihf/libssl.so.1.1
lib/arm-linux-gnueabihf/libcrypto.so.1.1
...
sent 1,247 bytes  received 42,891,563 bytes  5,614,428.31 bytes/sec
total size is 42,856,124  speedup is 1.00
```

### Method 2: Copy From a Rootfs Image

If you built your rootfs with Buildroot or Yocto, you can mount the image and copy from it:

```bash
# Mount the rootfs image
$ sudo mkdir -p /mnt/rootfs
$ sudo mount -o loop output/images/rootfs.ext2 /mnt/rootfs

# Copy required directories
$ rsync -a /mnt/rootfs/lib/   /opt/my-sysroot/lib/
$ rsync -a /mnt/rootfs/usr/lib/   /opt/my-sysroot/usr/lib/
$ rsync -a /mnt/rootfs/usr/include/ /opt/my-sysroot/usr/include/

$ sudo umount /mnt/rootfs
```

### Fixing Absolute Symlinks

A major issue with sysroots is that library symlinks are often absolute paths, which point to the host filesystem rather than the sysroot:

```bash
# Check for broken absolute symlinks
$ ls -la /opt/rpi4-sysroot/lib/arm-linux-gnueabihf/ | grep "\->"
```
```
lrwxrwxrwx  libssl.so.1.1 -> /lib/arm-linux-gnueabihf/libssl.so.1.1
lrwxrwxrwx  libcrypto.so.1.1 -> /lib/arm-linux-gnueabihf/libcrypto.so.1.1
lrwxrwxrwx  libc.so.6 -> /lib/arm-linux-gnueabihf/libc-2.31.so
```

These absolute symlinks are broken on the host because `/lib/arm-linux-gnueabihf/` refers to the *host's* `/lib`, not the sysroot. Fix them with a script that converts absolute symlinks to relative ones:

```bash
# sysroot-fix-symlinks.sh
#!/bin/bash
SYSROOT=$1
find $SYSROOT -type l | while read link; do
    target=$(readlink "$link")
    if [[ "$target" == /* ]]; then
        # Convert absolute symlink to relative
        rel_target=$(realpath --relative-to="$(dirname $link)" "${SYSROOT}${target}")
        echo "Fixing: $link -> $target  =>  $rel_target"
        ln -snf "$rel_target" "$link"
    fi
done
```

```bash
$ bash sysroot-fix-symlinks.sh /opt/rpi4-sysroot
```
```
Fixing: /opt/rpi4-sysroot/lib/arm-linux-gnueabihf/libssl.so.1.1 -> /lib/arm-linux-gnueabihf/libssl.so.1.1  =>  libssl.so.1.1
Fixing: /opt/rpi4-sysroot/usr/lib/arm-linux-gnueabihf/libssl.so -> /lib/arm-linux-gnueabihf/libssl.so.1.1  =>  ../../lib/arm-linux-gnueabihf/libssl.so.1.1
Fixing: /opt/rpi4-sysroot/lib/arm-linux-gnueabihf/libc.so.6 -> /lib/arm-linux-gnueabihf/libc-2.31.so  =>  libc-2.31.so
```

After fixing, verify:

```bash
$ ls -la /opt/rpi4-sysroot/lib/arm-linux-gnueabihf/ | grep "\->"
```
```
lrwxrwxrwx  libssl.so.1.1 -> libssl.so.1.1
lrwxrwxrwx  libcrypto.so.1.1 -> libcrypto.so.1.1
lrwxrwxrwx  libc.so.6 -> libc-2.31.so
```

### Configuring pkg-config for Cross-Compilation

`pkg-config` is a tool that provides compiler and linker flags for libraries. By default it searches the host's pkg-config database — which contains x86-64 paths and flags. You must redirect it to the sysroot's pkg-config database.

```bash
# Find pkg-config .pc files in the sysroot
$ find /opt/rpi4-sysroot -name "*.pc" | head -5
```
```
/opt/rpi4-sysroot/usr/lib/arm-linux-gnueabihf/pkgconfig/openssl.pc
/opt/rpi4-sysroot/usr/lib/arm-linux-gnueabihf/pkgconfig/libcrypto.pc
/opt/rpi4-sysroot/usr/lib/arm-linux-gnueabihf/pkgconfig/libssl.pc
/opt/rpi4-sysroot/usr/lib/pkgconfig/gpiod.pc
/opt/rpi4-sysroot/usr/share/pkgconfig/libfoo.pc
```

Set the required environment variables:

```bash
export PKG_CONFIG_SYSROOT_DIR=/opt/rpi4-sysroot
export PKG_CONFIG_LIBDIR=/opt/rpi4-sysroot/usr/lib/arm-linux-gnueabihf/pkgconfig:\
/opt/rpi4-sysroot/usr/lib/pkgconfig:\
/opt/rpi4-sysroot/usr/share/pkgconfig

# Unset the host pkg-config path to avoid mixing
unset PKG_CONFIG_PATH
```

Now verify pkg-config returns ARM flags:

```bash
$ pkg-config --cflags --libs openssl
```
```
-I/opt/rpi4-sysroot/usr/include -L/opt/rpi4-sysroot/usr/lib/arm-linux-gnueabihf -lssl -lcrypto
```

Cross-compile using pkg-config output:

```bash
$ arm-linux-gnueabihf-gcc \
    --sysroot=/opt/rpi4-sysroot \
    $(pkg-config --cflags openssl) \
    -o tls_client tls_client.c \
    $(pkg-config --libs openssl)

$ file tls_client
```
```
tls_client: ELF 32-bit LSB pie executable, ARM, EABI5 version 1 (SYSV),
dynamically linked, interpreter /lib/ld-linux-armhf.so.3, for GNU/Linux 3.2.0, not stripped
```

---

## Advanced Sysroot Topics
{:.gc-adv}
<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Sysroot vs Staging Directory (Buildroot/Yocto)

In automated build systems the distinction is important:

| Concept | Description | Location in Buildroot |
|---|---|---|
| **Sysroot** | Contains host-side ARM libraries/headers used *during compilation* only | `output/staging/` |
| **Staging directory** | Synonym for sysroot in Buildroot; mirrors target tree with extra .pc files | `output/staging/` |
| **Target directory** | The actual rootfs that will be deployed to the board; stripped, no .pc files, no static libs | `output/target/` |
| **Host directory** | Tools that run on the build machine (e.g., host-pkgconf) | `output/host/` |

The staging directory has extra files (`.pc`, static `.a`, unstripped `.so`) that would waste space if deployed to the board. The target directory has only what the board needs at runtime.

### Checking Dependencies Against a Sysroot with ldd --root

The standard `ldd` on the host cannot evaluate ARM binaries. Instead use the `--root` option to point it at the sysroot:

```bash
$ /lib/ld-linux-armhf.so.3 \
    --library-path /opt/rpi4-sysroot/lib/arm-linux-gnueabihf:\
/opt/rpi4-sysroot/usr/lib/arm-linux-gnueabihf \
    /opt/rpi4-sysroot/lib/arm-linux-gnueabihf/libc.so.6 \
    --list \
    ./myapp
```
```
        linux-vdso.so.1 (0x00000000)
        libssl.so.1.1 => /opt/rpi4-sysroot/lib/arm-linux-gnueabihf/libssl.so.1.1 (0x00000000)
        libcrypto.so.1.1 => /opt/rpi4-sysroot/lib/arm-linux-gnueabihf/libcrypto.so.1.1 (0x00000000)
        libc.so.6 => /opt/rpi4-sysroot/lib/arm-linux-gnueabihf/libc.so.6 (0x00000000)
        libdl.so.2 => /opt/rpi4-sysroot/lib/arm-linux-gnueabihf/libdl.so.2 (0x00000000)
        /lib/ld-linux-armhf.so.3 (0x00000000)
```

Alternatively, after copying the binary to the target board:

```bash
# On the target board
$ ldd myapp
```
```
        libssl.so.1.1 => /lib/arm-linux-gnueabihf/libssl.so.1.1 (0xb6e11000)
        libcrypto.so.1.1 => /lib/arm-linux-gnueabihf/libcrypto.so.1.1 (0xb6c31000)
        libc.so.6 => /lib/arm-linux-gnueabihf/libc.so.6 (0xb6b14000)
        /lib/ld-linux-armhf.so.3 (0xb6f2e000)
```

### Creating a Minimal Sysroot

For production builds, create the smallest possible sysroot containing only what your application actually needs:

```bash
#!/bin/bash
# create-minimal-sysroot.sh
TARGET_APP=$1
FULL_SYSROOT=/opt/rpi4-sysroot
MIN_SYSROOT=/opt/minimal-sysroot

mkdir -p $MIN_SYSROOT/{lib,usr/lib,usr/include,lib/arm-linux-gnueabihf}

# Copy the app and find its library dependencies
cp $TARGET_APP $MIN_SYSROOT/

# Use readelf to find NEEDED libraries
NEEDED=$(arm-linux-gnueabihf-readelf -d $TARGET_APP \
    | grep NEEDED | awk '{print $NF}' | tr -d '[]')

echo "Libraries needed: $NEEDED"

for lib in $NEEDED; do
    # Find and copy each library
    src=$(find $FULL_SYSROOT -name "$lib" -type f | head -1)
    if [ -n "$src" ]; then
        cp -v "$src" $MIN_SYSROOT/lib/arm-linux-gnueabihf/
        # Copy symlinks too
        dir=$(dirname $src)
        find $dir -name "${lib%.*}*" -maxdepth 1 | \
            xargs -I{} cp -P {} $MIN_SYSROOT/lib/arm-linux-gnueabihf/
    fi
done

# Copy the dynamic linker
cp -P $FULL_SYSROOT/lib/ld-linux-armhf.so.3 $MIN_SYSROOT/lib/
```

### RPATH and RUNPATH in Sysroot Context

When your cross-compiled binary has an embedded RPATH pointing to a sysroot path, that path needs to match the actual target filesystem layout:

```bash
# Compile with RPATH pointing to /opt/myapp/lib on the TARGET
$ arm-linux-gnueabihf-gcc \
    --sysroot=/opt/rpi4-sysroot \
    -Wl,-rpath,/opt/myapp/lib \
    -Wl,-rpath-link,/opt/rpi4-sysroot/usr/lib/arm-linux-gnueabihf \
    -o myapp main.c -lssl

# -rpath: embedded in the binary, used at runtime ON THE TARGET
# -rpath-link: used by the linker ON THE HOST to resolve secondary dependencies
#              (not embedded in binary)

$ arm-linux-gnueabihf-readelf -d myapp | grep -E "RPATH|RUNPATH|NEEDED"
```
```
 0x0000000f (RPATH)                      Library rpath: [/opt/myapp/lib]
 0x00000001 (NEEDED)                     Shared library: [libssl.so.1.1]
 0x00000001 (NEEDED)                     Shared library: [libcrypto.so.1.1]
 0x00000001 (NEEDED)                     Shared library: [libc.so.6]
```

### Handling Multiarch Sysroots

Modern Debian/Ubuntu use a multiarch layout where libraries are in architecture-specific subdirectories:

```bash
# On Raspberry Pi OS (Debian-based):
# Libraries are in /lib/arm-linux-gnueabihf/ not /lib/

$ ls /opt/rpi4-sysroot/lib/arm-linux-gnueabihf/
```
```
libc-2.31.so          libc.so.6 -> libc-2.31.so
libm-2.31.so          libm.so.6 -> libm-2.31.so
libssl.so.1.1         libcrypto.so.1.1
ld-linux-armhf.so.3
```

The cross-compiler knows about multiarch paths and searches them automatically when `--sysroot` is set. However, some older build systems assume a flat `/lib` layout and need manual `-L` flags:

```bash
$ arm-linux-gnueabihf-gcc \
    --sysroot=/opt/rpi4-sysroot \
    -L/opt/rpi4-sysroot/lib/arm-linux-gnueabihf \
    -L/opt/rpi4-sysroot/usr/lib/arm-linux-gnueabihf \
    -o myapp main.c -lssl
```

---

## Interview Questions
{:.gc-iq}
<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&A</span>

**Q: What is a sysroot and why is it needed for cross-compilation?**

A sysroot is a directory on the build host that contains the target architecture's headers and libraries, mirroring the target filesystem's root directory structure. It is needed because when cross-compiling, the host's own `/usr/include` and `/usr/lib` contain x86-64 binaries and headers. Using them would cause ABI mismatches and incorrect code generation. The `--sysroot=PATH` flag to gcc causes all implicit header and library search paths to be prefixed with the sysroot path, so the compiler finds ARM headers in `PATH/usr/include` and ARM libraries in `PATH/usr/lib` and `PATH/lib`.

**Q: How do you fix absolute symlinks in a manually created sysroot?**

When you rsync or copy libraries from a target device, symbolic links are often absolute paths like `libssl.so -> /lib/arm-linux-gnueabihf/libssl.so.1.1`. On the host machine, this absolute path resolves to the host's `/lib`, which either does not exist or contains host x86-64 files. The fix is to convert these absolute symlinks to relative symlinks. A script using `readlink` to detect absolute symlinks and `ln -snf` with a relative path computed via `realpath --relative-to` will fix all affected links. After fixing, `libssl.so` should point to `libssl.so.1.1` (relative, within the same directory) rather than `/lib/arm-linux-gnueabihf/libssl.so.1.1`.

**Q: How do you make pkg-config work in a cross-compilation environment?**

Set three environment variables: `PKG_CONFIG_SYSROOT_DIR` to the sysroot path (this is prepended to all paths returned by pkg-config), `PKG_CONFIG_LIBDIR` to a colon-separated list of directories inside the sysroot where `.pc` files live (e.g., `/sysroot/usr/lib/arm-linux-gnueabihf/pkgconfig:/sysroot/usr/share/pkgconfig`), and unset `PKG_CONFIG_PATH` to prevent the host's pkg-config search paths from being used. With these set, `pkg-config --cflags --libs openssl` returns paths inside the sysroot, which the cross-compiler can then use correctly.

**Q: What is the difference between a sysroot and a staging directory?**

These terms are often used interchangeably, but in the context of Buildroot they have a distinction. The sysroot is the conceptual idea of a directory that mirrors the target root and is used by the compiler. The staging directory (`output/staging/` in Buildroot) is the physical implementation — it contains all the cross-compiled libraries and headers needed by the compiler, including `.pc` files, static `.a` files, and unstripped `.so` files. The target directory (`output/target/`) is what actually gets deployed to the board: it has stripped shared libraries, no static libs, and no `.pc` files. Think of it as: staging = what the compiler needs; target = what the board needs.

**Q: How do you debug missing library issues when running a cross-compiled binary on target?**

First, on the host, use `arm-linux-gnueabihf-readelf -d mybinary | grep NEEDED` to list all shared libraries the binary requires. Then on the target board run `ldd mybinary` to see which libraries are found and which are missing (`not found`). If a library is missing: (1) check if it is installed on the target (`find /usr/lib /lib -name "libfoo*"`), (2) if not, cross-compile the library and add it to the target rootfs, (3) check if the library is in an unexpected path and set `LD_LIBRARY_PATH` as a temporary workaround, (4) for a permanent fix, add the library path to `/etc/ld.so.conf` on the target and run `ldconfig`. Also verify that the library ABI (e.g., `libssl.so.1.1` vs `libssl.so.3`) matches what the binary was compiled against.

---

## References
{:.gc-ref}
<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

- **"Mastering Embedded Linux Programming"** — Chris Simmonds, 3rd Ed. — Chapter 2: Toolchains, sysroot and staging directories
- **Buildroot Manual: Staging Directory** — explains staging vs target directory distinction (https://buildroot.org/downloads/manual/manual.html)
- **pkg-config Cross-Compilation Guide** — environment variables for cross-compiling with pkg-config (https://autotools.io/pkgconfig/cross-compiling.html)
- **GCC --sysroot Documentation** — official GCC documentation for the --sysroot flag (https://gcc.gnu.org/onlinedocs/gcc/Directory-Options.html)
- **Raspbian/Raspberry Pi Sysroot Guide** — community guide for setting up RPi sysroots (https://tttapa.github.io/Pages/Raspberry-Pi/C++-Development-RPiOS/index.html)
- **Linaro Sysroot Tools** — scripts from Linaro for creating cross-compilation sysroots (https://wiki.linaro.org/WorkingGroups/ToolChain)
