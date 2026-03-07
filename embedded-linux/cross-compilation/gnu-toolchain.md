---
layout: guide
title: "GNU Cross-Toolchain"
description: "Understanding cross-compilation toolchains: components, naming conventions, ABI options, and building custom toolchains with Crosstool-NG."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 05"
phase: embedded-linux-cross
permalink: /embedded-linux/cross-compilation/gnu-toolchain/
prev_topic:
next_topic:
  title: "Sysroot & Libraries"
  url: /embedded-linux/cross-compilation/sysroot-libraries/
---

## What Is a Cross-Toolchain?
{:.gc-basic}
<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

A **cross-toolchain** is a set of compiler tools that run on one machine (the *build host*) but produce executables for a different machine (the *target*). In embedded Linux development the build host is typically an x86-64 workstation running Ubuntu or Debian, while the target is an ARM, MIPS, RISC-V, or PowerPC board.

### Why Not Compile Natively on the Target?

Embedded targets are often constrained:

| Constraint | Detail |
|---|---|
| Slow CPU | A 1 GHz Cortex-A7 compiles a medium project in minutes vs seconds on a host |
| Limited RAM | 256 MB RAM cannot hold the GCC intermediate files for large projects |
| No storage | A 16 MB NOR flash cannot hold a full toolchain |
| No OS | Bare-metal targets have no operating system to run a compiler |

Cross-compilation solves all of these by doing the heavy lifting on the host and only deploying the compiled artifacts to the target.

### Toolchain Components

A GNU cross-toolchain is composed of three main packages:

**1. Binutils** — binary utilities that manipulate object files and executables:

| Tool | Purpose |
|---|---|
| `as` | Assembler — converts `.s` files to `.o` object files |
| `ld` | Linker — combines `.o` files into an ELF executable |
| `objcopy` | Copy/translate object files, convert ELF → binary/srec/ihex |
| `objdump` | Disassemble and display information about object files |
| `readelf` | Display detailed ELF structure (sections, symbols, headers) |
| `nm` | List symbols defined or referenced by object files |
| `strip` | Remove symbol table and debug info to shrink binaries |
| `ar` | Create, modify, and extract static library archives (`.a` files) |
| `size` | Display section sizes and total size of object/executable files |

**2. GCC / G++** — the GNU Compiler Collection. Compiles C, C++, Fortran, etc. to target machine code.

**3. C Library** — the standard C runtime library that every userspace program links against:

| C Library | Description | Typical Use |
|---|---|---|
| **glibc** (GNU libc) | Full POSIX compliance, widest compatibility, large footprint (~2 MB) | Desktop Linux, embedded boards with >64 MB RAM |
| **musl libc** | Small, clean, standards-conforming, ~600 KB | Minimal embedded systems, static builds |
| **uClibc-ng** | Fork of uClibc, small footprint, configurable | Very resource-constrained targets |
| **newlib** | C library for bare-metal / RTOS targets (no Linux kernel) | Cortex-M microcontrollers |

### Toolchain Naming Convention

The cross-compiler follows a predictable four-field naming convention:

```
arch-vendor-kernel-abi-gcc
│    │      │       │
│    │      │       └── ABI: gnueabihf, gnueabi, musleabi, uclibc...
│    │      └────────── kernel: linux (for Linux targets), elf (bare-metal)
│    └───────────────── vendor: optional label (linux, buildroot, none, poky...)
└────────────────────── architecture: arm, aarch64, mipsel, riscv64, powerpc...
```

Common examples:

| Triplet | Target |
|---|---|
| `arm-linux-gnueabihf-gcc` | 32-bit ARM, Linux, glibc, hard-float ABI |
| `arm-linux-gnueabi-gcc` | 32-bit ARM, Linux, glibc, soft-float ABI |
| `aarch64-linux-gnu-gcc` | 64-bit ARM (Cortex-A53/A72), Linux, glibc |
| `mipsel-linux-gnu-gcc` | MIPS little-endian, Linux, glibc |
| `riscv64-linux-gnu-gcc` | RISC-V 64-bit, Linux, glibc |
| `arm-none-eabi-gcc` | 32-bit ARM, bare-metal (no OS), no C library |

### Installing a Cross-Compiler on Ubuntu/Debian

```bash
$ sudo apt update
$ sudo apt search "arm-linux-gnueabihf"
```
```
Sorting...
Full Text Search...
binutils-arm-linux-gnueabihf/jammy 2.38-4ubuntu2 amd64
  GNU binary utilities, for arm-linux-gnueabihf target

gcc-arm-linux-gnueabihf/jammy 4:11.2.0-1ubuntu1 amd64
  GNU C compiler for armhf architecture

g++-arm-linux-gnueabihf/jammy 4:11.2.0-1ubuntu1 amd64
  GNU C++ compiler for armhf architecture

cpp-arm-linux-gnueabihf/jammy 4:11.2.0-1ubuntu1 amd64
  GNU C preprocessor for armhf architecture
```

```bash
$ sudo apt install gcc-arm-linux-gnueabihf g++-arm-linux-gnueabihf binutils-arm-linux-gnueabihf

$ arm-linux-gnueabihf-gcc --version
```
```
arm-linux-gnueabihf-gcc (Ubuntu 11.3.0-1ubuntu1~22.04) 11.3.0
Copyright (C) 2021 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
```

### Your First Cross-Compiled Binary

Create a simple C program:

```c
/* hello.c */
#include <stdio.h>
int main(void) {
    printf("Hello from ARM!\n");
    return 0;
}
```

Compile it for ARM:

```bash
$ arm-linux-gnueabihf-gcc -o hello hello.c

$ file hello
```
```
hello: ELF 32-bit LSB pie executable, ARM, EABI5 version 1 (SYSV),
dynamically linked, interpreter /lib/ld-linux-armhf.so.3,
BuildID[sha1]=3a1c9e5d4b7f2a8e6d0c1b5f9e3a7d2c4b8f1e6a,
for GNU/Linux 3.2.0, not stripped
```

Compare with a native x86 binary:

```bash
$ gcc -o hello_native hello.c

$ file hello_native
```
```
hello_native: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV),
dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2,
BuildID[sha1]=7f3d2a1c9e5b4f8e0d6c2b4a7f3d1c9e5b7f2a4c,
for GNU/Linux 3.2.0, not stripped
```

The `ARM, EABI5` confirms the binary targets ARM. You cannot run this on the host:

```bash
$ ./hello
```
```
bash: ./hello: cannot execute binary file: Exec format error
```

To run it you need to copy it to an ARM board, or use QEMU user-mode emulation (covered in the QEMU guide).

---

## ABI, Instruction Sets, and Compiler Flags
{:.gc-mid}
<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Hard-Float vs Soft-Float ABI

The *Application Binary Interface* (ABI) defines how function arguments and return values are passed between functions — specifically which registers and calling conventions are used.

| ABI | Flag | Float Register Usage | Performance |
|---|---|---|---|
| **soft-float** (`gnueabi`) | `-mfloat-abi=soft` | FP ops done in integer registers, no FPU | Slow, compatible with all ARM chips |
| **soft-fp** (`gnueabi` + vfp) | `-mfloat-abi=softfp` | Uses VFP/NEON unit but passes args in integer regs | Mixed — intermediate |
| **hard-float** (`gnueabihf`) | `-mfloat-abi=hard` | Uses VFP/NEON unit AND passes args in float registers | Fastest, requires hardware FPU |

**Critical rule:** You cannot link soft-float object files with hard-float object files. All `.o` files and libraries in a project must use the same float ABI.

```bash
# Compiling with explicit hard-float + NEON for Cortex-A9
$ arm-linux-gnueabihf-gcc \
    -march=armv7-a \
    -mtune=cortex-a9 \
    -mfpu=neon \
    -mfloat-abi=hard \
    -O2 \
    -o signal_proc signal_proc.c

$ file signal_proc
```
```
signal_proc: ELF 32-bit LSB pie executable, ARM, EABI5 version 1 (SYSV),
dynamically linked, interpreter /lib/ld-linux-armhf.so.3,
for GNU/Linux 3.2.0, not stripped
```

Check that NEON instructions were generated:

```bash
$ arm-linux-gnueabihf-objdump -d signal_proc | grep -E "vmul|vadd|vld"
```
```
    8524:   f2200d50    vmul.f32  d16, d16, d16
    852c:   f2200d51    vmul.f32  d17, d16, d17
    8534:   f3000d50    vadd.f32  d16, d16, d0
    853c:   f4200a8f    vld1.32   {d16-d17}, [r0]
```

### ARM vs Thumb Instruction Sets

ARM processors support multiple instruction set modes:

| Mode | Instruction Width | Code Density | Performance |
|---|---|---|---|
| ARM | 32-bit fixed | Larger code size | Slightly faster on older cores |
| Thumb | 16-bit compressed | ~30% smaller code | Slightly slower on ARMv4/5 |
| Thumb-2 | Mixed 16/32-bit | Best density | Equal or better performance |

For Cortex-A (ARMv7-A), Thumb-2 is recommended for its code density without performance loss:

```bash
$ arm-linux-gnueabihf-gcc -mthumb -march=armv7-a -O2 -o hello_thumb hello.c

# Check instruction set used
$ arm-linux-gnueabihf-objdump -d hello_thumb | head -30
```
```
hello_thumb:     file format elf32-littlearm

Disassembly of section .text:

000103d4 <_start>:
   103d4:   f04f 0b00   mov.w   fp, #0
   103d8:   f04f 0e00   mov.w   lr, #0
   103dc:   bc0e        pop     {r1, r2, r3}
   103e0:   466d        mov     sp, r5
   103e4:   f7ff fffe   bl      100a0 <__libc_start_main@plt>
```

The `mov.w` and `bl` are Thumb-2 instructions (note the mixed 16/32-bit encoding).

### Understanding Multilib

Some toolchains are built with *multilib* support — they can produce binaries for multiple ABIs from a single installation:

```bash
$ arm-linux-gnueabihf-gcc -print-multi-lib
```
```
.;
thumb;@mthumb
armv6-m/thumb;@mthumb@march=armv6s-m
armv7-m/thumb;@mthumb@march=armv7-m
armv7e-m/thumb;@mthumb@march=armv7e-m
armv7-ar/thumb;@mthumb@march=armv7
armv8-m.base/thumb;@mthumb@march=armv8-m.base
armv8-m.main/thumb;@mthumb@march=armv8-m.main
```

Each entry is a directory path for the pre-compiled multilib variant and the flags that activate it.

### Inspecting GCC Configuration with -v

```bash
$ arm-linux-gnueabihf-gcc -v hello.c -o hello 2>&1 | head -20
```
```
Using built-in specs.
COLLECT_GCC=arm-linux-gnueabihf-gcc
COLLECT_LTO_WRAPPER=/usr/lib/gcc-cross/arm-linux-gnueabihf/11/lto-wrapper
Target: arm-linux-gnueabihf
Configured with: ../src/configure -v
  --with-pkgversion='Ubuntu 11.3.0-1ubuntu1~22.04'
  --enable-languages=c,ada,c++,go,d,fortran,objc,obj-c++,m2
  --prefix=/usr
  --with-gcc-major-version-only
  --program-suffix=-11
  --program-prefix=arm-linux-gnueabihf-
  --enable-shared --enable-linker-build-id
  --libexecdir=/usr/lib
  --without-included-gettext
  --enable-threads=posix
  --libdir=/usr/lib
  --enable-nls
  --enable-bootstrap
  --enable-clocale=gnu
  --with-float=hard
  --with-fpu=vfpv3-d16
```

The `--with-float=hard` and `--with-fpu=vfpv3-d16` confirm this is a hard-float toolchain. The configuration line shows all compile-time options that were used to build GCC itself.

### Building a Custom Toolchain with Crosstool-NG

While Debian/Ubuntu packages are convenient, you sometimes need a custom toolchain — different C library, specific kernel headers version, or non-standard target. **Crosstool-NG** automates the complex multi-step build process.

```bash
# Install prerequisites
$ sudo apt install gcc g++ gperf bison flex texinfo help2man make \
    libncurses5-dev python3-dev autoconf automake libtool \
    libtool-bin gawk wget bzip2 xz-utils unzip patch libstdc++6

# Download and install Crosstool-NG
$ wget http://crosstool-ng.org/download/crosstool-ng/crosstool-ng-1.26.0.tar.xz
$ tar xf crosstool-ng-1.26.0.tar.xz
$ cd crosstool-ng-1.26.0
$ ./configure --prefix=$HOME/crosstool-ng
$ make && make install
$ export PATH=$HOME/crosstool-ng/bin:$PATH

# List available sample configurations
$ ct-ng list-samples | grep arm
```
```
[L...]   arm-cortex_a15-linux-gnueabihf
[L...]   arm-cortex_a5-linux-uclibcgnueabihf
[L...]   arm-cortex_a8-linux-gnueabi
[L...]   arm-cortex_a9-linux-gnueabihf
[L...]   arm-unknown-linux-gnueabi
[L...]   arm-unknown-linux-musleabi
[L...]   arm-unknown-linux-musleabihf
[L...]   armv6-rpi-linux-gnueabihf
```

```bash
# Start from a sample configuration
$ ct-ng arm-cortex_a9-linux-gnueabihf

# Open menuconfig to customize
$ ct-ng menuconfig
```

Key menuconfig sections to review:

| Section | Important Settings |
|---|---|
| Target options | Architecture, ABI, FPU type |
| Toolchain options | Vendor string, tuple's vendor |
| Operating System | Linux kernel headers version |
| C-library | glibc / musl / uClibc-ng, version |
| C compiler | GCC version, C++ support, LTO |

```bash
# Build the toolchain (takes 30-90 minutes)
$ ct-ng build
```
```
[INFO ]  Retrieving needed toolchain components' tarballs
[INFO ]  Getting 'gcc-12.2.0'...
[INFO ]  Getting 'linux-5.15.61'...
[INFO ]  Getting 'glibc-2.36'...
[INFO ]  Getting 'binutils-2.39'...
[INFO ]  Extracting and patching toolchain components
[INFO ]  Building toolchain
[INFO ]  Installing final gcc compiler
[INFO ]  Finalizing the toolchain's directory
[INFO ]  Build completed
[EXTRA]  Elapsed time: 47m14s
```

```bash
# Add to PATH
$ export PATH=$HOME/x-tools/arm-cortex_a9-linux-gnueabihf/bin:$PATH

# Test
$ arm-cortex_a9-linux-gnueabihf-gcc --version
```
```
arm-cortex_a9-linux-gnueabihf-gcc (crosstool-NG 1.26.0) 12.2.0
Copyright (C) 2022 Free Software Foundation, Inc.
```

---

## Sysroot Layout, Linker Scripts, and Canadian Cross
{:.gc-adv}
<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### The Bootstrapping Problem

Building a cross-compiler from source involves a fundamental chicken-and-egg problem:

1. To compile glibc for the target, you need a cross-compiler.
2. To build a full cross-compiler, you need a working C library for the target.

This is the **bootstrapping problem**. Crosstool-NG solves it in several stages:

```
Stage 1: Build a minimal "bootstrap" cross-gcc
         (no C library, only enough to compile glibc)
         build_host_cc → cross-gcc-stage1 (C only, static, no libc)

Stage 2: Cross-compile the C library using stage-1 gcc
         cross-gcc-stage1 → target-glibc (headers + basic objects)

Stage 3: Build a full cross-gcc using the partial C library
         build_host_cc + target-glibc → cross-gcc-stage2 (full C/C++)

Stage 4: Rebuild the C library using the full cross-gcc
         cross-gcc-stage2 → target-glibc-final

Stage 5: Rebuild full cross-gcc once more against final glibc
         Final cross toolchain
```

### Toolchain Sysroot Layout

The installed toolchain contains a *sysroot* — a directory tree that mirrors the target filesystem's `/usr` directory, containing the C library and headers the cross-compiler uses during compilation and linking:

```bash
$ ls /usr/arm-linux-gnueabihf/
```
```
bin  include  lib
```

```bash
$ ls /usr/arm-linux-gnueabihf/lib/
```
```
crt1.o     crti.o         crtn.o         gcrt1.o
ld-linux-armhf.so.3  libanl.so.1     libc.so.6
libc_nonshared.a     libdl.so.2      libm.so.6
libnss_compat.so.2   libnss_dns.so.2  libpthread.so.0
libresolv.so.2       librt.so.1      libutil.so.1
```

```bash
$ ls /usr/arm-linux-gnueabihf/include/ | head -20
```
```
aio.h         alloca.h       ar.h           argp.h
assert.h      bits/          byteswap.h     complex.h
cpio.h        ctype.h        dirent.h       dlfcn.h
endian.h      errno.h        execinfo.h     fcntl.h
features.h    fenv.h         fnmatch.h      fts.h
```

### Using --sysroot Flag

The `--sysroot` flag redirects all library and header searches to a custom directory instead of the toolchain's built-in sysroot. This is essential when you want to link against libraries installed on the actual target board:

```bash
# Without --sysroot: uses toolchain's built-in sysroot
$ arm-linux-gnueabihf-gcc -o myapp main.c -lssl

# With --sysroot: uses a custom staging area
$ arm-linux-gnueabihf-gcc \
    --sysroot=/opt/rpi-sysroot \
    -o myapp main.c \
    -lssl

# The compiler now searches:
#   /opt/rpi-sysroot/usr/include     for headers
#   /opt/rpi-sysroot/usr/lib         for libraries
#   /opt/rpi-sysroot/lib             for libraries
```

To avoid typing `--sysroot` every time, you can create a wrapper script or configure it in the toolchain specs:

```bash
# Create a gcc wrapper script
cat > /usr/local/bin/rpi-gcc << 'EOF'
#!/bin/bash
exec arm-linux-gnueabihf-gcc --sysroot=/opt/rpi-sysroot "$@"
EOF
chmod +x /usr/local/bin/rpi-gcc
```

### Linker Scripts

The toolchain's linker uses **linker scripts** to define how output sections are placed in memory. For applications these are provided automatically, but for bare-metal or bootloader work you write them manually:

```bash
# See which linker script is being used
$ arm-linux-gnueabihf-gcc -v -o hello hello.c 2>&1 | grep "linker script"
```
```
COLLECT_GCC_OPTIONS='-v' '-o' 'hello' '-march=armv7' '-mfloat-abi=hard'
 /usr/lib/gcc-cross/arm-linux-gnueabihf/11/collect2 \
   -dynamic-linker /lib/ld-linux-armhf.so.3 \
   /usr/arm-linux-gnueabihf/lib/crt1.o \
   --script /usr/arm-linux-gnueabihf/lib/ldscripts/armelf_linux_eabi.xdyn
```

```bash
# Print the default linker script
$ arm-linux-gnueabihf-ld --verbose | head -40
```

### Canadian Cross-Compilation

A **Canadian cross** is a build scenario where three different machines are involved:

| Machine | Role | Example |
|---|---|---|
| **Build** | The machine running the compiler build process | x86-64 Ubuntu server |
| **Host** | The machine that will run the cross-compiler | Windows x86-64 (MinGW) |
| **Target** | The machine the cross-compiler generates code for | ARM Cortex-A9 |

This is used to create cross-compilers that run on Windows or macOS for embedded targets. Crosstool-NG supports this via the CT_CANADIAN option in menuconfig.

```
Normal cross:     build == host,  host != target
                  x86 → builds compiler → compiler runs on x86 → generates ARM code

Canadian cross:   build != host,  host != target
                  x86 → builds compiler → compiler runs on Windows → generates ARM code
```

### Building glibc From Scratch

For full control, here is how glibc is built manually for an ARM target (as Crosstool-NG does internally):

```bash
# Step 1: Install kernel headers into a staging sysroot
$ make ARCH=arm INSTALL_HDR_PATH=/opt/arm-sysroot/usr headers_install

# Step 2: Configure glibc with the cross-compiler
$ mkdir glibc-build && cd glibc-build
$ ../glibc-2.36/configure \
    --prefix=/usr \
    --build=x86_64-linux-gnu \
    --host=arm-linux-gnueabihf \
    --with-headers=/opt/arm-sysroot/usr/include \
    --disable-multilib \
    --disable-nls \
    --enable-kernel=4.14

# Step 3: Build and install
$ make -j$(nproc)
$ make install DESTDIR=/opt/arm-sysroot
```

---

## Interview Questions
{:.gc-iq}
<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&A</span>

**Q: What is the difference between a native compiler and a cross-compiler?**

A native compiler runs on the same machine architecture it generates code for — for example, `gcc` on an x86-64 Ubuntu workstation produces x86-64 binaries. A cross-compiler runs on one architecture (the build host, typically x86-64) but generates binaries for a different architecture (the target, such as ARM or MIPS). Cross-compilers are essential in embedded development because the target hardware is often too resource-constrained to run a compiler directly, or does not yet have an OS installed.

**Q: Explain the meaning of arm-linux-gnueabihf — each component.**

`arm` is the target CPU architecture (32-bit ARM). `linux` is the kernel/OS the binaries will run on. `gnu` is the vendor/C-library identifier indicating GNU C Library (glibc). `eabi` stands for Embedded Application Binary Interface — the ARM ABI specification for function calling conventions, register usage, and object file format. `hf` stands for hard-float, meaning the compiler will use the hardware floating-point unit (VFP/NEON) and pass floating-point arguments in FPU registers rather than general-purpose integer registers.

**Q: What is the difference between hard-float and soft-float ABI?**

With soft-float ABI (`-mfloat-abi=soft`), the compiler emulates all floating-point operations using integer registers and software routines, which works on any ARM chip but is significantly slower. With hard-float ABI (`-mfloat-abi=hard`), the compiler uses the hardware FPU (VFP, NEON) for computations and also passes floating-point function arguments and return values in the FPU registers (`s0-s15` / `d0-d7`). This is faster but requires a CPU with an FPU. There is also `softfp`, which uses the FPU for computation but passes values in integer registers — this allows linking between soft and softfp code but not between soft and hard-float. Linking hard-float objects with soft-float objects causes an ABI mismatch linker error.

**Q: How do you verify a binary was compiled for the correct architecture?**

Use the `file` command: `file mybinary` will report the ELF architecture, bit-width, endianness, and ABI. For ARM it shows `ELF 32-bit LSB, ARM, EABI5`. Use `readelf -h mybinary` for more detail including `e_machine` (ARM = 40), `e_flags` showing hard-float ABI flag (`EF_ARM_ABI_VER5 | EF_ARM_ABI_FLOAT_HARD`). Use `arm-linux-gnueabihf-objdump -f mybinary` to see the architecture flags. Attempting to run a mis-targeted binary on the host gives `Exec format error`.

**Q: What is Crosstool-NG and when would you use it over a pre-built toolchain?**

Crosstool-NG is a build system that automates the complex multi-stage process of building a complete GNU cross-toolchain from source. You use it when you need: (1) a specific GCC version not available in your distro's packages, (2) a specific glibc/musl version matched to your target's kernel, (3) a non-standard target triplet, (4) a toolchain built with custom patches, (5) exact reproducibility for a product that will be in production for years. Pre-built toolchains (from Ubuntu apt, Arm's developer site, or Linaro) are faster to install and sufficient for most development work.

**Q: What is the bootstrapping problem in toolchain building?**

The bootstrapping problem is the circular dependency in building a cross-toolchain: you need a cross-compiler to build the C library for the target, but you need a C library to build a full cross-compiler. The solution is a multi-stage build: first build a minimal "stage 1" cross-GCC that is incomplete (C only, statically linked, no C library support) — just enough to compile the C library. Then cross-compile the C library using this stage-1 compiler. Then build a full "stage 2" cross-GCC that links against the newly built C library. This is the process Crosstool-NG and GNU's own bootstrap sequence implement.

---

## References
{:.gc-ref}
<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

- **Crosstool-NG Documentation** — official guide for building custom toolchains (https://crosstool-ng.github.io/docs/)
- **"Mastering Embedded Linux Programming"** — Frank Vasquez & Chris Simmonds, 3rd Ed. — Chapter 2 covers toolchains in depth
- **GNU Binutils Manual** — reference for as, ld, objcopy, strip, readelf, nm (https://sourceware.org/binutils/docs/)
- **GCC Cross-Compilation Documentation** — official GCC docs on cross-compilation options and multilib (https://gcc.gnu.org/onlinedocs/gcc/Submodel-Options.html)
- **ARM ABI Documentation** — Procedure Call Standard for the Arm Architecture (AAPCS) (https://github.com/ARM-software/abi-aa)
- **Linaro Toolchain Releases** — pre-built ARM toolchains maintained by Linaro (https://releases.linaro.org/components/toolchain/binaries/)
