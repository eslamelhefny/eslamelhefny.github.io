---
layout: guide
title: "Static vs Dynamic Linking"
description: "Comparing static and dynamic linking strategies for embedded Linux: binary size trade-offs, deployment requirements, RPATH, soname versioning, and PIC internals."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 05"
phase: embedded-linux-cross
permalink: /embedded-linux/cross-compilation/static-dynamic-linking/
prev_topic:
  title: "Sysroot & Libraries"
  url: /embedded-linux/cross-compilation/sysroot-libraries/
next_topic:
  title: "QEMU Emulation"
  url: /embedded-linux/cross-compilation/qemu-emulation/
---

## Static vs Dynamic Linking Fundamentals
{:.gc-basic}
<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

When a C program calls `printf()`, `malloc()`, or `socket()`, those functions live in a library. The linker must connect your object file to those functions at some point. The question is *when*: at build time (static) or at runtime (dynamic).

### Static Linking

With **static linking** (`-static` flag), the linker copies the machine code of every library function your program uses directly into the final executable. The resulting binary is self-contained — it carries everything it needs inside itself.

```bash
# hello.c
# #include <stdio.h>
# int main(void) { printf("Hello\n"); return 0; }

# Compile and link STATICALLY
$ arm-linux-gnueabihf-gcc -static -o hello_static hello.c

# Compile and link DYNAMICALLY (default)
$ arm-linux-gnueabihf-gcc -o hello_dynamic hello.c
```

### Size Comparison

```bash
$ ls -lh hello_static hello_dynamic
```
```
-rwxr-xr-x 1 user user 583K Mar  7 10:22 hello_static
-rwxr-xr-x 1 user user 8.0K Mar  7 10:22 hello_dynamic
```

The static binary is ~72x larger because it includes all of glibc's code. The dynamic binary only stores a reference to the C library.

```bash
# Check shared library dependencies with ldd
$ ldd hello_dynamic
```
```
        linux-vdso.so.1 (0x00000000)
        libc.so.6 => /lib/arm-linux-gnueabihf/libc.so.6 (0xb6d2a000)
        /lib/ld-linux-armhf.so.3 (0xb6efc000)
```

```bash
$ ldd hello_static
```
```
        not a dynamic executable
```

The static binary has zero runtime dependencies and requires no additional files on the target.

### What Needs to Be Deployed With a Dynamic Binary

When copying a dynamically-linked binary to an embedded target, you must ensure all its dependencies are present on the target:

```bash
# Check what myapp needs
$ arm-linux-gnueabihf-readelf -d myapp | grep NEEDED
```
```
 0x00000001 (NEEDED)    Shared library: [libssl.so.1.1]
 0x00000001 (NEEDED)    Shared library: [libcrypto.so.1.1]
 0x00000001 (NEEDED)    Shared library: [libc.so.6]
```

Deployment checklist for a dynamic binary:

| Item | Location on Target |
|---|---|
| The binary itself | `/usr/bin/myapp` |
| `libssl.so.1.1` | `/lib/arm-linux-gnueabihf/` |
| `libcrypto.so.1.1` | `/lib/arm-linux-gnueabihf/` |
| `libc.so.6` | `/lib/arm-linux-gnueabihf/` (usually pre-installed) |
| `ld-linux-armhf.so.3` | `/lib/ld-linux-armhf.so.3` (dynamic linker, must exist) |

### Static vs Dynamic: When to Choose What

| Criterion | Static | Dynamic |
|---|---|---|
| Deployment simplicity | Simple (one file) | Complex (must ship libraries) |
| Binary size | Large | Small |
| Memory sharing | No sharing | Multiple processes share one copy of `.so` in RAM |
| Security patching | Must recompile + redeploy app | Replace `.so` file, all apps get the fix |
| Startup time | Faster (no dynamic linking step) | Slightly slower |
| Embedded minimal rootfs | Excellent choice | Requires rootfs with libraries |
| License compliance | Static linking with LGPL libs can be tricky | LGPL shared library is safe |

---

## Dynamic Linker, RPATH, and Deployment
{:.gc-mid}
<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### The Dynamic Linker / Loader

When you run a dynamically-linked ARM binary on the target, the kernel does not load the program directly. Instead it hands control to the **dynamic linker** (also called the *program interpreter*), which is embedded in the binary's ELF header:

```bash
$ arm-linux-gnueabihf-readelf -l hello_dynamic | grep interpreter
```
```
      [Requesting program interpreter: /lib/ld-linux-armhf.so.3]
```

`ld-linux-armhf.so.3` is itself a shared library, but the kernel can load it directly. It then:

1. Reads the binary's `NEEDED` entries to find all required libraries
2. Searches for those libraries in: RPATH/RUNPATH, `LD_LIBRARY_PATH`, `/etc/ld.so.cache`, default paths
3. Maps each library into the process address space
4. Resolves all dynamic symbols (patches the PLT/GOT)
5. Calls the program's `_start` entry point

### LD_LIBRARY_PATH

`LD_LIBRARY_PATH` is an environment variable listing directories to search for shared libraries, checked before the default paths:

```bash
# Run myapp with libraries in a non-standard path
$ LD_LIBRARY_PATH=/opt/myapp/lib ./myapp

# Add to the existing LD_LIBRARY_PATH
$ export LD_LIBRARY_PATH=/opt/myapp/lib:$LD_LIBRARY_PATH
```

`LD_LIBRARY_PATH` is useful for development and testing but problematic for production because it affects all dynamic linking for that process and its children, and it can interfere with system libraries. For production, use RPATH instead.

### ldconfig and /etc/ld.so.cache

`ldconfig` scans standard library directories, updates the library name → file path cache (`/etc/ld.so.cache`), and creates or updates symlinks:

```bash
# On the target: add a new library directory
$ echo "/opt/myapp/lib" >> /etc/ld.so.conf.d/myapp.conf
$ ldconfig

# Check the cache
$ ldconfig -p | grep libssl
```
```
        libssl.so.1.1 (libc6,hard-float) => /lib/arm-linux-gnueabihf/libssl.so.1.1
        libssl.so (libc6,hard-float) => /usr/lib/arm-linux-gnueabihf/libssl.so
```

On embedded systems with read-only rootfs, running `ldconfig` at startup from an init script or pre-generating the cache is common practice.

### Embedding RPATH with -Wl,-rpath

RPATH is a list of directories embedded inside the binary itself that the dynamic linker searches when loading that binary:

```bash
# Embed /opt/myapp/lib as a runtime library search path
$ arm-linux-gnueabihf-gcc \
    --sysroot=/opt/rpi4-sysroot \
    -Wl,-rpath,/opt/myapp/lib \
    -o myapp main.c -lssl

# Verify it was embedded
$ arm-linux-gnueabihf-readelf -d myapp | grep -E "RPATH|RUNPATH"
```
```
 0x0000000f (RPATH)    Library rpath: [/opt/myapp/lib]
```

```bash
# Use $ORIGIN for a path relative to the binary's own directory
# This makes the binary portable regardless of installation path
$ arm-linux-gnueabihf-gcc \
    --sysroot=/opt/rpi4-sysroot \
    '-Wl,-rpath,$ORIGIN/../lib' \
    -o bin/myapp main.c -lssl

$ arm-linux-gnueabihf-readelf -d bin/myapp | grep RPATH
```
```
 0x0000000f (RPATH)    Library rpath: [$ORIGIN/../lib]
```

With `$ORIGIN`, the binary finds libraries in `../lib` relative to wherever the binary itself lives — ideal for self-contained application bundles.

### Partial Static Linking

You can link some libraries statically and others dynamically in the same binary:

```bash
# Link libssl and libcrypto statically, but keep libc dynamic
$ arm-linux-gnueabihf-gcc \
    --sysroot=/opt/rpi4-sysroot \
    -o myapp main.c \
    -Wl,-Bstatic -lssl -lcrypto \
    -Wl,-Bdynamic -lc

$ ldd myapp
```
```
        linux-vdso.so.1 (0x00000000)
        libc.so.6 => /lib/arm-linux-gnueabihf/libc.so.6 (0xb6d2a000)
        /lib/ld-linux-armhf.so.3 (0xb6efc000)
```

`libssl` and `libcrypto` are now baked in; only `libc` is dynamically loaded.

### Inspecting Dynamic Information with readelf -d

```bash
$ arm-linux-gnueabihf-readelf -d myapp
```
```
Dynamic section at offset 0x2f14 contains 28 entries:
  Tag        Type                         Name/Value
 0x00000001 (NEEDED)                     Shared library: [libssl.so.1.1]
 0x00000001 (NEEDED)                     Shared library: [libcrypto.so.1.1]
 0x00000001 (NEEDED)                     Shared library: [libc.so.6]
 0x0000000f (RPATH)                      Library rpath: [$ORIGIN/../lib]
 0x0000000c (INIT)                       0x10574
 0x0000000d (FINI)                       0x10ae8
 0x00000019 (INIT_ARRAY)                 0x20ef4
 0x0000001b (INIT_ARRAYSZ)               4 (bytes)
 0x0000001a (FINI_ARRAY)                 0x20ef8
 0x0000001c (FINI_ARRAYSZ)               4 (bytes)
 0x00000005 (STRTAB)                     0x105a8
 0x00000006 (SYMTAB)                     0x10488
 0x0000000a (STRSZ)                      218 (bytes)
 0x0000000b (SYMENT)                     16 (bytes)
 0x00000015 (DEBUG)                      0x0
 0x00000003 (PLTGOT)                     0x21000
 0x00000002 (PLTRELSZ)                   64 (bytes)
 0x00000014 (PLTREL)                     REL
 0x00000017 (JMPREL)                     0x10694
```

---

## Shared Libraries: Versioning, PIC, GOT, and PLT
{:.gc-adv}
<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Library Soname Versioning

Shared libraries use a three-level versioning scheme to allow multiple versions to coexist and ensure ABI compatibility:

```
libfoo.so.1.2.3
         │ │ │
         │ │ └── Patch version (bug fixes, no ABI change)
         │ └──── Minor version (new APIs, backward compatible)
         └────── Major version (ABI break — incompatible change)
```

Three file names are involved:

| Name | Purpose | Who Sets It |
|---|---|---|
| `libfoo.so` | Linker name — what `-lfoo` resolves to | Symlink, created by installer |
| `libfoo.so.1` | Soname — stored in ELF, used by dynamic linker at runtime | Set with `-Wl,-soname,libfoo.so.1` |
| `libfoo.so.1.2.3` | Real name — actual file on disk | Actual built file |

```bash
# Build a shared library with proper soname
$ arm-linux-gnueabihf-gcc \
    -shared \
    -fPIC \
    -Wl,-soname,libfoo.so.1 \
    -o libfoo.so.1.2.3 \
    foo.c

# Create the symlinks (ldconfig does this automatically)
$ ln -s libfoo.so.1.2.3 libfoo.so.1
$ ln -s libfoo.so.1     libfoo.so

# Verify the soname embedded in the library
$ arm-linux-gnueabihf-readelf -d libfoo.so.1.2.3 | grep SONAME
```
```
 0x0000000e (SONAME)    Library soname: [libfoo.so.1]
```

When you upgrade to `libfoo.so.1.3.0` (backward-compatible), you only update the real file and re-point `libfoo.so.1`. All existing binaries that reference `libfoo.so.1` (the soname) automatically use the new version. When the ABI breaks, you release `libfoo.so.2.0.0` and create a new `libfoo.so.2` symlink — both versions coexist.

### Position-Independent Code (PIC)

Shared libraries must be compiled with `-fPIC` (Position-Independent Code). This allows the library to be loaded at any virtual address without requiring relocation of code.

```bash
# Compile object files as PIC
$ arm-linux-gnueabihf-gcc -fPIC -c foo.c -o foo.o

# Link into shared library
$ arm-linux-gnueabihf-gcc -shared -fPIC -o libfoo.so foo.o
```

Without PIC, a shared library would contain absolute addresses that would need to be patched every time the library is loaded at a different address — a process called *text relocation* which prevents sharing the code pages between processes.

With PIC, all data accesses go through the **Global Offset Table (GOT)** and all function calls go through the **Procedure Linkage Table (PLT)**, both of which contain addresses that can be fixed up per-process without touching the shared code pages.

### Global Offset Table (GOT) and Procedure Linkage Table (PLT)

```
Call from myapp to printf()
─────────────────────────────────────────────────────
myapp .text:
    bl  printf@plt          ← branch to PLT stub

PLT stub (in myapp):
    ldr  pc, [pc, #0]       ← load address from GOT entry
    .word  _printf_got_entry ← points into GOT

GOT entry (writable per-process):
    Initially: points to PLT resolver
    After first call: updated to actual printf() address in libc

Dynamic linker (ld-linux-armhf.so.3):
    On first call: resolves printf → libc address → patches GOT
    On subsequent calls: GOT already points to printf directly (fast path)
```

This lazy binding (resolving symbols only on first call) is the default behavior. It can be disabled with `LD_BIND_NOW=1` (or link flag `-Wl,-z,now`) to resolve all symbols at startup — preferred for security-sensitive applications.

### musl libc for Static Builds

`musl` is a lightweight C library designed to produce clean, small static binaries:

```bash
# Install musl cross-compiler
$ sudo apt install musl-tools

# Or use a musl-based toolchain from Crosstool-NG:
# ct-ng sample: arm-unknown-linux-musleabihf

# Compile a fully static binary with musl
$ arm-linux-musleabihf-gcc \
    -static \
    -Os \
    -o myapp_musl main.c

$ ls -lh myapp_musl
```
```
-rwxr-xr-x 1 user user 24K Mar  7 10:45 myapp_musl
```

Compare with glibc static:

```bash
$ arm-linux-gnueabihf-gcc -static -Os -o myapp_glibc main.c

$ ls -lh myapp_glibc myapp_musl
```
```
-rwxr-xr-x 1 user user 543K Mar  7 10:45 myapp_glibc
-rwxr-xr-x 1 user user  24K Mar  7 10:45 myapp_musl
```

musl produces a ~22x smaller static binary because it was designed for static linking from the start, with minimal internal dependencies and no per-thread storage overhead.

### Link-Time Optimization (LTO) and Shared Libraries

LTO (`-flto`) allows the compiler to perform optimizations across translation unit boundaries. With dynamic libraries it requires care:

```bash
# Build with LTO (both compile and link steps need -flto)
$ arm-linux-gnueabihf-gcc \
    -flto \
    -O2 \
    -fPIC \
    -shared \
    -o libfoo.so.1 \
    foo.c bar.c

# For static libraries with LTO, use gcc-ar instead of ar
$ arm-linux-gnueabihf-gcc-ar rcs libfoo.a foo.o bar.o
```

LTO can cause link failures with mixed-compiler object files (e.g., objects from different GCC versions), so all objects in a link step must be from the same compiler when LTO is enabled.

---

## Interview Questions
{:.gc-iq}
<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&A</span>

**Q: When would you use static linking in an embedded system?**

Static linking makes sense in embedded systems when: (1) the rootfs is extremely minimal and there is no room for shared libraries, (2) you want a self-contained single-file deployment (copy one binary, done), (3) the system uses a read-only rootfs where installing new `.so` files is not possible, (4) startup time is critical and you want to avoid the dynamic linking overhead, (5) you are using musl libc and want the small static binary size advantage. The trade-offs are larger binaries, no shared memory between processes for library code, and the need to recompile and redeploy the entire binary to update a library (e.g., to patch an OpenSSL vulnerability).

**Q: What is RPATH and how does it differ from LD_LIBRARY_PATH?**

RPATH is a list of directories embedded inside the ELF binary itself (in the dynamic section) that the dynamic linker searches when loading that specific binary. It is set at compile time with `-Wl,-rpath,/some/path` and affects only the binary it is embedded in. `LD_LIBRARY_PATH` is an environment variable that the dynamic linker checks before RPATH, and it affects all binaries loaded by the dynamic linker in that process session. RPATH is preferred in production because it is per-binary and not affected by the runtime environment; `LD_LIBRARY_PATH` is convenient for testing but can cause unexpected library conflicts if set globally. RUNPATH is like RPATH but searched after `LD_LIBRARY_PATH` (set with `-Wl,--enable-new-dtags`).

**Q: Explain soname versioning and why it matters.**

Soname versioning (`libfoo.so.1`, `libfoo.so.1.2.3`) allows multiple ABI-incompatible versions of a library to coexist on a system and ensures that binaries always find the correct version at runtime. The soname is embedded in the library ELF (`SONAME` entry) and is what the binary records when it links against `-lfoo`. The dynamic linker at runtime searches for a file matching the soname, not the full version number. This means upgrading from `libfoo.so.1.2.3` to `libfoo.so.1.3.0` just involves updating the `libfoo.so.1` symlink — existing binaries pick up the new version automatically. When the ABI breaks, the major version is bumped to 2, both `libfoo.so.1` and `libfoo.so.2` exist, old and new binaries each use their respective version.

**Q: What is position-independent code and why is it required for shared libraries?**

Position-independent code (PIC) is machine code that works correctly regardless of the address at which it is loaded into memory. It achieves this by accessing global data through the Global Offset Table (GOT) — a per-process table of absolute addresses — rather than using hardcoded addresses. PIC is required for shared libraries because multiple processes may load the same shared library at different virtual addresses (depending on what other libraries are loaded first and ASLR). If the library code contained hardcoded absolute addresses, each process would need its own private copy with patched addresses (text relocation), defeating the purpose of sharing. With PIC, the read-only code pages are shared across all processes; only the writable GOT is per-process.

**Q: How do you deploy a dynamically-linked application to a minimal embedded rootfs?**

Use `readelf -d mybinary | grep NEEDED` to list all required shared libraries. Copy each `.so` to the appropriate directory on the target (`/lib/arm-linux-gnueabihf/` on Debian-based systems). Follow the dependency chain recursively — each library may itself depend on other libraries. Copy the dynamic linker (`ld-linux-armhf.so.3`) if it is not already present. Ensure all symlinks (e.g., `libssl.so.1.1 -> libssl.so.1.1.1f`) are correct. Run `ldconfig` on the target (or pre-generate `/etc/ld.so.cache`). If storage is a concern, strip debug symbols from the `.so` files with `arm-linux-gnueabihf-strip --strip-unneeded libfoo.so`. Test by running `ldd mybinary` on the target to confirm all libraries are found.

**Q: What is the role of ld-linux.so?**

`ld-linux.so` (e.g., `ld-linux-armhf.so.3` on ARM) is the dynamic linker/loader. Unlike all other shared libraries, it is not loaded by another loader — the kernel loads it directly when executing a dynamically-linked binary. The ELF binary header stores its path in the `PT_INTERP` program header. The dynamic linker's responsibilities are: (1) reading the binary's `NEEDED` entries to find required shared libraries, (2) searching for those libraries in RPATH, `LD_LIBRARY_PATH`, and the `ld.so.cache`, (3) mapping all required `.so` files into the process address space, (4) resolving all symbol references — patching GOT/PLT entries so that function calls and data accesses point to the correct addresses, (5) calling any initialization functions (`.init` sections, `__attribute__((constructor))`), and (6) transferring control to the program's `main()`.

---

## References
{:.gc-ref}
<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

- **"Linkers and Loaders"** — John R. Levine — the definitive reference for ELF linking, dynamic loading, GOT/PLT mechanics
- **Linux man pages: ld.so(8), ldd(1), ldconfig(8)** — detailed documentation for the dynamic linker ecosystem (https://man7.org/linux/man-pages/)
- **"Mastering Embedded Linux Programming"** — Chris Simmonds — Chapter 5: Building a Root Filesystem, covers dynamic library deployment
- **Ulrich Drepper: "How to Write Shared Libraries"** — comprehensive guide to shared library design and versioning (https://www.akkadia.org/drepper/dsohowto.pdf)
- **musl libc** — lightweight C library excellent for static embedded builds (https://musl.libc.org/)
- **"Understanding ELF"** — free tutorial on ELF structure, sections, and dynamic linking internals (https://linux-audit.com/elf-binaries-on-linux-understanding-and-analysis/)
