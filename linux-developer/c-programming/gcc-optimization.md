---
layout: guide
title: "GCC Flags & Optimization"
description: "Master GCC warning flags, optimization levels, sanitizers, link-time optimization, cross-compilation flags, and how to read assembly output to understand what the compiler produces."
stage: "Stage 02"
phase: "linux-developer-c"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C Programming"
phase_index: "/linux-developer/c-programming/"
permalink: /linux-developer/c-programming/gcc-optimization/
prev_topic:
  title: "Makefiles"
  url: /linux-developer/c-programming/makefiles/
next_topic:
  title: "GDB Debugging"
  url: /linux-developer/c-programming/gdb/
---

## Essential Warning Flags
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

GCC warnings catch real bugs at compile time — always enable them in development.

```bash
# Minimum recommended set
gcc -Wall -Wextra -Wpedantic -Werror -o program program.c
```

| Flag | What it catches |
|------|----------------|
| `-Wall` | Most common warnings (misleadingly not "all") |
| `-Wextra` | Extra warnings not in `-Wall` |
| `-Wpedantic` | ISO C conformance violations |
| `-Werror` | Treat warnings as errors (enforces zero-warning policy) |
| `-Wshadow` | Variable shadows an outer scope variable |
| `-Wformat=2` | String format vulnerabilities (`printf` etc.) |
| `-Wconversion` | Implicit type conversions that may lose data |
| `-Wno-unused-parameter` | Suppress warnings for intentionally unused params |
| `-Wundef` | Undefined macro used in `#if` |

```bash
# Production-grade warning set
CFLAGS = -Wall -Wextra -Wpedantic -Wshadow -Wformat=2 \
         -Wconversion -Wdouble-promotion -Wnull-dereference \
         -Wmisleading-indentation -Wstrict-prototypes
```

---

## Optimization Levels
{:.gc-basic}

```bash
gcc -O0 -o program program.c    # No optimization (default) — fastest compile, easiest to debug
gcc -O1 -o program program.c    # Basic optimization
gcc -O2 -o program program.c    # Recommended for production
gcc -O3 -o program program.c    # Aggressive — may change behaviour (strict-aliasing, vectorization)
gcc -Os -o program program.c    # Optimize for size (embedded systems)
gcc -Oz -o program program.c    # Minimize size even more (Clang; GCC uses -Os)
gcc -Og -o program program.c    # Optimize for debugging (GCC 4.8+)
```

| Level | Use case |
|-------|---------|
| `-O0` | Development, debugging |
| `-O2` | Production builds |
| `-O3` | Performance-critical code (benchmark first!) |
| `-Os` | Embedded systems — flash is limited |
| `-Og` | Debug builds that still have some optimization |

---

## Debugging Flags
{:.gc-basic}

```bash
gcc -g   -o program program.c    # DWARF debug info (compatible with GDB, Valgrind)
gcc -g3  -o program program.c    # Include macro definitions
gcc -ggdb -o program program.c   # GDB-specific extensions
```

> **Never strip debug info from binaries you keep for crash analysis.** Build with `-g` + `-O2` for production; store the unstripped binary separately for debugging.

---

## Sanitizers
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

Compile-time instrumentation that detects bugs at runtime with ~2x overhead:

```bash
# AddressSanitizer — heap/stack overflows, use-after-free, double-free
gcc -fsanitize=address -g -o program program.c

# UndefinedBehaviorSanitizer — signed overflow, null deref, invalid shifts
gcc -fsanitize=undefined -g -o program program.c

# Both together (recommended during development)
gcc -fsanitize=address,undefined -g -o program program.c

# ThreadSanitizer — data races (can't combine with ASan)
gcc -fsanitize=thread -g -o program program.c
```

**Example ASan output:**
```
==42==ERROR: AddressSanitizer: stack-buffer-overflow
WRITE of size 4 at 0x7ffd1234 thread T0
    #0 0x401150 in fill_array program.c:8
    #1 0x4011a0 in main program.c:14
Shadow bytes around the buggy address:
  0x7ffd1230: 00 00 00 00 f2 f2 f2 f2
```

---

## Cross-Compilation Flags
{:.gc-mid}

```bash
# Target ARMv7 with hardware floating point (Raspberry Pi 2/3)
arm-linux-gnueabihf-gcc \
    -march=armv7-a \
    -mfpu=neon-vfpv4 \
    -mfloat-abi=hard \
    -O2 -o sensor sensor.c

# Target ARMv8 / AArch64
aarch64-linux-gnu-gcc \
    -march=armv8-a \
    -O2 -o sensor sensor.c

# Target bare-metal Cortex-M4 (no OS, no stdlib)
arm-none-eabi-gcc \
    -mcpu=cortex-m4 \
    -mthumb \
    -mfpu=fpv4-sp-d16 \
    -mfloat-abi=hard \
    -ffreestanding -nostdlib \
    -Os -o firmware.elf firmware.c
```

### Useful Analysis Flags

```bash
# Show preprocessed output
gcc -E program.c -o program.i

# Show assembly output
gcc -S -O2 program.c -o program.s

# Show object file symbols
nm program.o
readelf -s program.o

# Show all compiler passes
gcc -v program.c -o program

# Report include paths
gcc -v -E /dev/null
```

---

## Advanced: Reading Assembly Output
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

Understanding assembly output helps you verify optimizations and diagnose performance issues.

```bash
# Generate annotated assembly with source interleaved
gcc -O2 -g -S -fverbose-asm program.c -o program.s

# Or use objdump on the compiled binary
gcc -O2 -g -o program program.c
objdump -d -S program | less
```

**Example — comparing optimization levels:**

```c
int sum_array(int *arr, int n) {
    int s = 0;
    for (int i = 0; i < n; i++)
        s += arr[i];
    return s;
}
```

```bash
# -O0: naive loop
# -O2: loop unrolling, no pipeline stalls
# -O3 with AVX2: SIMD vectorization using ymm registers (processes 8 ints at once)
gcc -O3 -march=native -S sum.c
```

### Link-Time Optimization (LTO)

LTO lets the compiler optimize **across** translation unit boundaries:

```bash
gcc -O2 -flto -o program main.c utils.c sensor.c
# GCC sees all source files simultaneously at link time
# Can inline functions across files, eliminate dead code globally
```

### Profile-Guided Optimization (PGO)

Let real workload data guide optimization:

```bash
# Step 1: Instrument build
gcc -fprofile-generate -O2 -o program_inst program.c

# Step 2: Run with representative data
./program_inst < workload.dat

# Step 3: Optimized build using collected profiles
gcc -fprofile-use -O2 -o program_pgo program.c
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `-O2` and `-O3`?**

> `-O2` enables a well-tested set of optimizations that are safe for all conforming code. `-O3` enables additional aggressive optimizations — vectorization, aggressive inlining, tree-loop transformations — that may change the order of floating-point operations or assume strict aliasing, potentially breaking code that has undefined behaviour. Use `-O2` by default; only switch to `-O3` after profiling and testing.

**Q2 — Intermediate: What is strict aliasing and why can it cause bugs?**

> The strict aliasing rule states that you may not access an object through a pointer of an incompatible type (except `char *`). GCC assumes you follow this rule at `-O2`+, allowing it to elide loads. Code that violates it (e.g., type-punning via `*(int *)&float_val`) has undefined behaviour and may produce wrong results after optimization. Safe alternatives: use `union` (C99 explicitly allows this) or `memcpy` for type punning, or pass `-fno-strict-aliasing`.

**Q3 — Intermediate: How does AddressSanitizer work and what overhead does it add?**

> ASan works by inserting instrumented "shadow memory" alongside every allocation. Each 8 bytes of real memory get 1 byte of shadow tracking validity. Before every memory access, the compiler-inserted code checks the shadow byte. Heap is surrounded by poisoned "redzones" to catch overflows. Typical overhead: ~2× memory, ~2× runtime — acceptable for CI/CD but not production.

**Q4 — Advanced: Explain LTO and when it provides the most benefit.**

> Link-Time Optimization allows GCC to inline and optimize across `.c` file boundaries. Normally the compiler only sees one translation unit at a time; functions in other `.c` files can't be inlined. With LTO, all IR (GIMPLE) is written into `.o` files and the linker passes them all to the optimizer at once. Most benefit: when you have many small helper functions in utility modules that are called frequently. Cross-file inlining can eliminate function call overhead and enable further constant propagation.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| GCC Optimize Options | [gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html) |
| GCC Warning Options | [gcc.gnu.org/onlinedocs/gcc/Warning-Options.html](https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html) |
| Compiler Explorer (Godbolt) | [godbolt.org](https://godbolt.org) — see assembly output live |
| AddressSanitizer wiki | [github.com/google/sanitizers](https://github.com/google/sanitizers) |
