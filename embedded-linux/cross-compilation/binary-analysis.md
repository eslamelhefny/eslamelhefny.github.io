---
layout: guide
title: "Binary Analysis: readelf, objdump, nm"
description: "Analyzing ELF binaries with GNU binutils: reading ELF headers, inspecting sections, disassembling code, understanding symbols, and debugging stripped binaries."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 05"
phase: embedded-linux-cross
permalink: /embedded-linux/cross-compilation/binary-analysis/
prev_topic:
  title: "QEMU Emulation"
  url: /embedded-linux/cross-compilation/qemu-emulation/
next_topic:
  title: "Cross-Compiling with CMake"
  url: /embedded-linux/cross-compilation/cross-compile-cmake/
---

## ELF Format and Basic Inspection Tools
{:.gc-basic}
<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

### The ELF File Format

**ELF** (Executable and Linkable Format) is the standard binary format on Linux for executables, shared libraries, object files, and core dumps. Every cross-compiled binary is an ELF file.

An ELF file has two parallel views:

| View | Description | Used By |
|---|---|---|
| **Sections** | Named regions used during compilation and linking | Linker, debugger |
| **Segments** | Groups of sections mapped into memory | OS loader at runtime |

The key ELF structures:

```
ELF File Layout:
┌─────────────────────┐
│   ELF Header        │  ← Magic number, arch, type, entry point, offsets
├─────────────────────┤
│   Program Headers   │  ← Segments (LOAD, DYNAMIC, INTERP, NOTE...)
├─────────────────────┤
│   .text             │  ← Executable code
├─────────────────────┤
│   .rodata           │  ← Read-only data (string literals, const globals)
├─────────────────────┤
│   .data             │  ← Initialized read-write data (global vars)
├─────────────────────┤
│   .bss              │  ← Uninitialized data (zero at runtime, no space in file)
├─────────────────────┤
│   .dynamic          │  ← Dynamic linking info (NEEDED, RPATH, SONAME...)
├─────────────────────┤
│   .symtab / .strtab │  ← Symbol table + string table (debug, stripped later)
├─────────────────────┤
│   .debug_*          │  ← DWARF debug info (source line, variable, type info)
├─────────────────────┤
│   Section Headers   │  ← Table of all section descriptors
└─────────────────────┘
```

### readelf -h: ELF Header

```bash
$ arm-linux-gnueabihf-readelf -h myapp
```
```
ELF Header:
  Magic:   7f 45 4c 46 01 01 01 00 00 00 00 00 00 00 00 00
  Class:                             ELF32
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              DYN (Position-Independent Executable file)
  Machine:                           ARM
  Version:                           0x1
  Entry point address:               0x10575
  Start of program headers:          52 (bytes into file)
  Start of section headers:          21560 (bytes into file)
  Flags:                             0x5000400, Version5 EABI, hard-float ABI
  Size of this header:               52 (bytes)
  Size of program headers:           32 (bytes)
  Number of program headers:         9
  Size of section headers:           40 (bytes)
  Number of section headers:         29
  Section header string table index: 28
```

Key fields to notice:
- `Machine: ARM` — confirms the target architecture
- `Flags: 0x5000400, Version5 EABI, hard-float ABI` — confirms hard-float ABI
- `Type: DYN` — Position-Independent Executable (PIE); `EXEC` for non-PIE
- `Entry point address: 0x10575` — where the kernel passes control

### readelf -S: Section Headers

```bash
$ arm-linux-gnueabihf-readelf -S myapp
```
```
There are 29 section headers, starting at offset 0x5438:

Section Headers:
  [Nr] Name              Type            Addr     Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            00000000 000000 000000 00      0   0  0
  [ 1] .interp           PROGBITS        00010154 000154 000013 00   A  0   0  1
  [ 2] .note.ABI-tag     NOTE            00010168 000168 000020 00   A  0   0  4
  [ 3] .gnu.hash         GNU_HASH        00010188 000188 000028 04   A  5   0  4
  [ 4] .dynsym           DYNSYM          000101b0 0001b0 000060 10   A  5   1  4
  [ 5] .dynstr           STRTAB          00010210 000210 00004a 00   A  0   0  1
  [ 6] .gnu.version      VERSYM          0001025a 00025a 00000c 02   A  4   0  2
  [ 7] .gnu.version_r    VERNEED         00010268 000268 000020 00   A  5   1  4
  [ 8] .rel.dyn          REL             00010288 000288 000020 08   A  4   0  4
  [ 9] .rel.plt          REL             000102a8 0002a8 000028 08  AI  4  21  4
  [10] .init             PROGBITS        000102d0 0002d0 00000c 00  AX  0   0  4
  [11] .plt              PROGBITS        000102dc 0002dc 000050 04  AX  0   0  4
  [12] .text             PROGBITS        0001032c 00032c 00024c 00  AX  0   0  4
  [13] .fini             PROGBITS        00010578 000578 000008 00  AX  0   0  4
  [14] .rodata           PROGBITS        00010580 000580 000010 00   A  0   0  4
  [15] .ARM.exidx        ARM_EXIDX       00010590 000590 000010 00  AL 12   0  4
  [16] .eh_frame         PROGBITS        000105a0 0005a0 000034 00   A  0   0  4
  [17] .init_array       INIT_ARRAY      00020ef4 000ef4 000004 04  WA  0   0  4
  [18] .fini_array       FINI_ARRAY      00020ef8 000ef8 000004 04  WA  0   0  4
  [19] .dynamic          DYNAMIC         00020efc 000efc 0000e8 08  WA  5   0  4
  [20] .got              PROGBITS        00020fe4 000fe4 00001c 04  WA  0   0  4
  [21] .got.plt          PROGBITS        00021000 001000 00001c 04  WA  0   0  4
  [22] .data             PROGBITS        0002101c 00101c 000008 00  WA  0   0  4
  [23] .bss              NOBITS          00021024 001024 000008 00  WA  0   0  4
  [24] .comment          PROGBITS        00000000 001024 000025 01  MS  0   0  1
  [25] .ARM.attributes   ARM_ATTRIBUTES  00000000 001049 00003e 00      0   0  1
  [26] .symtab           SYMTAB          00000000 001088 0004e0 10     27  48  4
  [27] .strtab           STRTAB          00000000 001568 000267 00      0   0  1
  [28] .shstrtab         STRTAB          00000000 0017cf 00010e 00      0   0  1
```

The `Flg` column: `A` = allocatable (loaded into memory), `X` = executable, `W` = writable.

### nm: Listing Symbols

```bash
$ arm-linux-gnueabihf-nm myapp
```
```
00021024 B __bss_start
00021024 b completed.0
         U __libc_start_main@@GLIBC_2.4
00010585 r __GNU_EH_FRAME_HDR
00021028 B __TMC_END__
0002101c D __data_start
0002101c W data_start
00010578 T _fini
000102d0 T _init
00010575 T main
         U printf@@GLIBC_2.4
00010329 t register_tm_clones
```

Symbol type letters:

| Letter | Meaning |
|---|---|
| `T` | Text section (code) — defined in this file |
| `D` | Data section — initialized global/static variable |
| `B` | BSS section — uninitialized global/static variable |
| `R` | Read-only data section |
| `U` | Undefined — referenced but not defined here (external) |
| `W` | Weak symbol |
| `t`, `d`, `b` | Local (lowercase = not exported) |

### file Command

```bash
$ file myapp hello_static libfoo.so.1.2.3 main.o
```
```
myapp:           ELF 32-bit LSB pie executable, ARM, EABI5 version 1 (SYSV),
                 dynamically linked, interpreter /lib/ld-linux-armhf.so.3,
                 BuildID[sha1]=3a1c9e5d4b7f2a8e6d0c1b5f9e3a7d2c4b8f1e6a,
                 for GNU/Linux 3.2.0, not stripped

hello_static:    ELF 32-bit LSB executable, ARM, EABI5 version 1 (SYSV),
                 statically linked, BuildID[sha1]=7f3d2a1c9e5b4f8e0d6c2b4a7f,
                 for GNU/Linux 3.2.0, not stripped

libfoo.so.1.2.3: ELF 32-bit LSB shared object, ARM, EABI5 version 1 (SYSV),
                 dynamically linked, BuildID[sha1]=...

main.o:          ELF 32-bit LSB relocatable, ARM, EABI5 version 1 (SYSV), not stripped
```

### objdump -f: File Headers

```bash
$ arm-linux-gnueabihf-objdump -f myapp
```
```
myapp:     file format elf32-littlearm

architecture: armv4t, flags 0x00000112:
EXEC_P, HAS_SYMS, D_PAGED
start address 0x00010575
```

### size: Section Sizes

```bash
$ arm-linux-gnueabihf-size myapp hello_static
```
```
   text    data     bss     dec     hex filename
   1972       8       8    1988     7c4 myapp
 522832    6852    6400  536084   82e14 hello_static
```

The `dec` column is the total (text + data + bss) which approximates runtime memory usage.

---

## Disassembly, Stripping, and Dynamic Analysis
{:.gc-mid}
<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### objdump -d: Disassembly

```bash
# Disassemble the .text section
$ arm-linux-gnueabihf-objdump -d myapp
```
```
myapp:     file format elf32-littlearm

Disassembly of section .plt:

000102dc <puts@plt-0x14>:
   102dc:   e52de004    push    {lr}            ; (str lr, [sp, #-4]!)
   102e0:   e59fe004    ldr     lr, [pc, #4]    ; 102ec
   102e4:   e08fe00e    add     lr, pc, lr
   102e8:   e5bef008    ldr     pc, [lr, #8]!
   102ec:   0000ff14    .word   0x0000ff14

000102f0 <puts@plt>:
   102f0:   e28fc600    add     ip, pc, #0, 12
   102f4:   e28cca10    add     ip, ip, #16, 20 ; 0x10000
   102f8:   e5bcf018    ldr     pc, [ip, #24]!  ; 0xff018

Disassembly of section .text:

0001032c <_start>:
   1032c:   e3a0b000    mov     fp, #0
   10330:   e3a0e000    mov     lr, #0
   10334:   e49d1004    pop     {r1}
   10338:   e1a0200d    mov     r2, sp
   1033c:   e52d2004    push    {r2}
   10340:   e52d0004    push    {r0}
   10344:   e59f0024    ldr     r0, [pc, #36]   ; 10370
   10348:   e08f0000    add     r0, pc, r0
   1034c:   e52d0004    push    {r0}
   10350:   ebffffe0    bl      102e0 <__libc_start_main@plt-0x14>

00010575 <main>:
   10575:   b510        push    {r4, lr}
   10577:   4803        ldr     r0, [pc, #12]
   10579:   4478        add     r0, pc
   1057b:   f7ff fef8   bl      10370 <puts@plt>
   1057f:   2000        movs    r0, #0
   10581:   bd10        pop     {r4, pc}
```

### objdump -S: Interleaved Source and Disassembly

Requires compilation with `-g` (debug symbols):

```bash
$ arm-linux-gnueabihf-gcc -g -O0 -o myapp_debug myapp.c

$ arm-linux-gnueabihf-objdump -S myapp_debug
```
```
Disassembly of section .text:

00010575 <main>:
#include <stdio.h>

int compute(int a, int b) {
   return a * b + a;
}

int main(void) {
   10575:   b590        push    {r4, r7, lr}
   10577:   b082        sub     sp, #8
   10579:   af00        add     r7, sp, #0
    int result = compute(6, 7);
   1057b:   2107        movs    r1, #7
   1057d:   2006        movs    r0, #6
   1057f:   f7ff ffe5   bl      1054d <compute>
   10583:   6078        str     r0, [r7, #4]
    printf("Result: %d\n", result);
   10585:   6879        ldr     r1, [r7, #4]
   10587:   4803        ldr     r0, [pc, #12]
   10589:   4478        add     r0, pc
   1058b:   f7ff ff1d   bl      103c9 <printf@plt>
```

### nm --undefined-only: Finding Missing Symbols

```bash
# Find all undefined (external) symbols that must be provided at link time
$ arm-linux-gnueabihf-nm --undefined-only myapp
```
```
         U __libc_start_main@@GLIBC_2.4
         U printf@@GLIBC_2.4
         U ssl_connect
         U SSL_CTX_new
```

If `ssl_connect` shows up as undefined after linking, it means `-lssl` was not included or the library is not found.

### objcopy: Stripping and Format Conversion

```bash
# Strip debug symbols (reduce binary size for deployment)
$ arm-linux-gnueabihf-objcopy --strip-debug myapp myapp_stripped

$ ls -lh myapp myapp_stripped
```
```
-rwxr-xr-x 1 user user 32K Mar  7 11:00 myapp
-rwxr-xr-x 1 user user 12K Mar  7 11:00 myapp_stripped
```

```bash
# Strip all symbols (maximum reduction)
$ arm-linux-gnueabihf-strip myapp

# Convert ELF to raw binary (for bootloaders or bare-metal flashing)
$ arm-linux-gnueabihf-objcopy -O binary myapp myapp.bin

# Convert ELF to Intel HEX (for some flash programmers)
$ arm-linux-gnueabihf-objcopy -O ihex myapp myapp.hex

# Convert ELF to Motorola S-Record
$ arm-linux-gnueabihf-objcopy -O srec myapp myapp.srec

# Extract a specific section to a binary file
$ arm-linux-gnueabihf-objcopy -j .text -O binary myapp text_section.bin

# Add a custom section to a binary (e.g., embed a data file)
$ arm-linux-gnueabihf-objcopy \
    --add-section .firmware=firmware.bin \
    --set-section-flags .firmware=alloc,load,readonly,data \
    myapp myapp_with_firmware
```

### readelf -d: Dynamic Section and Dependencies

```bash
$ arm-linux-gnueabihf-readelf -d myapp | grep -E "NEEDED|RPATH|RUNPATH|SONAME"
```
```
 0x00000001 (NEEDED)    Shared library: [libssl.so.1.1]
 0x00000001 (NEEDED)    Shared library: [libcrypto.so.1.1]
 0x00000001 (NEEDED)    Shared library: [libc.so.6]
 0x0000000f (RPATH)     Library rpath: [$ORIGIN/../lib]
```

### readelf -s: Symbol Table

```bash
$ arm-linux-gnueabihf-readelf -s myapp | head -30
```
```
Symbol table '.dynsym' contains 7 entries:
   Num:    Value  Size Type    Bind   Vis      Ndx Name
     0: 00000000     0 NOTYPE  LOCAL  DEFAULT  UND
     1: 00000000     0 FUNC    GLOBAL DEFAULT  UND printf@GLIBC_2.4 (2)
     2: 00000000     0 FUNC    GLOBAL DEFAULT  UND __libc_start_main@GLIBC_2.4 (2)
     3: 00021024     0 NOTYPE  GLOBAL DEFAULT   23 __bss_start
     4: 00021024     0 NOTYPE  GLOBAL DEFAULT   23 _edata
     5: 00021028     0 NOTYPE  GLOBAL DEFAULT   23 _end
     6: 00010578     0 FUNC    GLOBAL DEFAULT   13 _fini

Symbol table '.symtab' contains 48 entries:
   Num:    Value  Size Type    Bind   Vis      Ndx Name
     0: 00000000     0 NOTYPE  LOCAL  DEFAULT  UND
     1: 00010154     0 SECTION LOCAL  DEFAULT    1 .interp
    ...
    44: 00010575    14 FUNC    GLOBAL DEFAULT   12 main
    45: 00010329    68 FUNC    LOCAL  DEFAULT   12 register_tm_clones
    46: 000102d0     0 FUNC    GLOBAL DEFAULT   10 _init
    47: 00021024     0 NOTYPE  GLOBAL DEFAULT   23 __bss_start
```

---

## Advanced Binary Analysis: VMA/LMA, addr2line, and Security Hardening
{:.gc-adv}
<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### readelf -l: Program Headers (Segments)

```bash
$ arm-linux-gnueabihf-readelf -l myapp
```
```
Elf file type is DYN (Position-Independent Executable file)
Entry point 0x10575
There are 9 program headers, starting at offset 52

Program Headers:
  Type           Offset   VirtAddr   PhysAddr   FileSiz MemSiz  Flg Align
  PHDR           0x000034 0x00010034 0x00010034 0x00120 0x00120 R   0x4
  INTERP         0x000154 0x00010154 0x00010154 0x00013 0x00013 R   0x1
      [Requesting program interpreter: /lib/ld-linux-armhf.so.3]
  LOAD           0x000000 0x00010000 0x00010000 0x005d4 0x005d4 R E 0x10000
  LOAD           0x000ef4 0x00020ef4 0x00020ef4 0x00130 0x00138 RW  0x10000
  DYNAMIC        0x000efc 0x00020efc 0x00020efc 0x000e8 0x000e8 RW  0x4
  NOTE           0x000174 0x00010174 0x00010174 0x00044 0x00044 R   0x4
  GNU_EH_FRAME   0x0005a0 0x000105a0 0x000105a0 0x00034 0x00034 R   0x4
  GNU_STACK      0x000000 0x00000000 0x00000000 0x00000 0x00000 RW  0x10
  GNU_RELRO      0x000ef4 0x00020ef4 0x00020ef4 0x0010c 0x0010c R   0x1
```

Notice two `LOAD` segments: one `R E` (read + execute = code) and one `RW` (read-write = data). The kernel maps these into the process's virtual address space.

### VMA vs LMA

In ELF, each section has two addresses:

| Address | Name | Meaning |
|---|---|---|
| **VMA** | Virtual Memory Address | Where the code/data will reside at runtime |
| **LMA** | Load Memory Address | Where the section is actually stored/loaded from |

For standard Linux applications, VMA == LMA because the OS loads segments directly to where they will run. In embedded bare-metal, they differ:

```
ROM layout (LMA):                  RAM layout (VMA at runtime):
┌─────────────────┐ 0x08000000    ┌─────────────────┐ 0x08000000
│ .text  (code)   │               │ .text  (code)    │  VMA = LMA = flash
├─────────────────┤ 0x08010000    ├─────────────────┤ 0x20000000
│ .data  (init'd) │ (stored here) │ .data  (init'd)  │  VMA = RAM (copied at startup)
└─────────────────┘               ├─────────────────┤ 0x20001000
                                  │ .bss   (zeroed)  │  VMA = RAM (zeroed at startup)
                                  └─────────────────┘
```

Check VMA and LMA:

```bash
$ arm-none-eabi-objdump -h firmware.elf | grep -A1 "\.data"
```
```
  3 .data         00000100  20000000  08010000  00011000  2**2
                  CONTENTS, ALLOC, LOAD, DATA
```

Here `.data` VMA = `20000000` (RAM) and LMA = `08010000` (flash). The startup code copies it.

### addr2line: Address to Source Line

When a program crashes with an address (e.g., from a kernel oops or signal handler), `addr2line` maps it to a source file and line number:

```bash
# Compile with debug info
$ arm-linux-gnueabihf-gcc -g -o myapp myapp.c

# Suppose the program crashed at address 0x1057b
$ arm-linux-gnueabihf-addr2line -e myapp 0x1057b
```
```
/home/user/project/myapp.c:12
```

```bash
# With function name
$ arm-linux-gnueabihf-addr2line -e myapp -f 0x1057b
```
```
main
/home/user/project/myapp.c:12
```

For kernel oops addresses, use the kernel `vmlinux` (with debug info) and the address from the oops:

```bash
$ arm-linux-gnueabihf-addr2line -e vmlinux c0a08d40
```
```
/build/linux/init/main.c:924
```

### Separate Debug Info Files

Production binaries are stripped to save space, but debug info is kept in a separate `.debug` file for later use:

```bash
# Build with full debug info
$ arm-linux-gnueabihf-gcc -g -o myapp myapp.c

# Extract debug info to a separate file
$ arm-linux-gnueabihf-objcopy --only-keep-debug myapp myapp.debug

# Strip the main binary
$ arm-linux-gnueabihf-strip --strip-debug myapp

# Add a debuglink pointing to the separate debug file
$ arm-linux-gnueabihf-objcopy \
    --add-gnu-debuglink=myapp.debug \
    myapp

# GDB finds myapp.debug automatically via the debuglink
$ arm-linux-gnueabihf-gdb myapp
```
```
Reading symbols from myapp...
Reading symbols from /path/to/myapp.debug...
```

### Checking for Duplicate Symbols with nm

```bash
# Find duplicate global symbol definitions across multiple object files
$ arm-linux-gnueabihf-nm *.o | grep " T " | sort | uniq -d
```
```
00000000 T init_module
```

If `init_module` appears in multiple `.o` files, the linker will either use the first (if weak) or error (if strong). Track down which files define it:

```bash
$ arm-linux-gnueabihf-nm *.o | grep " T init_module"
```
```
module_a.o:00000000 T init_module
module_b.o:00000000 T init_module
```

### Analyzing Security Hardening with checksec

The `checksec` tool analyzes a binary for security mitigations:

```bash
$ checksec --file=myapp
```
```
RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH      Symbols         FORTIFY Fortified  Fortifiable  FILE
Full RELRO      Canary found      NX enabled    PIE enabled     No RPATH   No RUNPATH   64 Symbols      Yes     2          4            myapp
```

| Mitigation | Description | GCC Flag |
|---|---|---|
| **RELRO** | Marks GOT read-only after startup; prevents GOT overwrites | `-Wl,-z,relro,-z,now` |
| **Stack Canary** | Detects stack buffer overflows | `-fstack-protector-strong` |
| **NX** | Non-executable stack; prevents shellcode injection | On by default (requires CPU support) |
| **PIE** | Position-Independent Executable; enables ASLR | `-fPIE -pie` |

Manually check with readelf:

```bash
# Check for PIE
$ arm-linux-gnueabihf-readelf -h myapp | grep "Type:"
```
```
  Type:                              DYN (Position-Independent Executable file)
```

```bash
# Check for stack canary (look for __stack_chk_fail)
$ arm-linux-gnueabihf-nm myapp | grep stack_chk
```
```
         U __stack_chk_fail@@GLIBC_2.4
```

```bash
# Check for Full RELRO (GNU_RELRO segment + BIND_NOW)
$ arm-linux-gnueabihf-readelf -l myapp | grep -E "RELRO|GNU_RELRO"
$ arm-linux-gnueabihf-readelf -d myapp | grep BIND_NOW
```

---

## Interview Questions
{:.gc-iq}
<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&A</span>

**Q: What is an ELF file and what does it contain?**

ELF (Executable and Linkable Format) is the standard binary format for Linux executables, shared libraries, object files, and core dumps. An ELF file consists of: an ELF header (magic number, architecture, type, entry point, offsets to section and program header tables); program headers describing *segments* — memory regions loaded by the OS (LOAD, DYNAMIC, INTERP segments); section headers describing named *sections* used by the linker and debugger (.text for code, .data for initialized globals, .bss for zero-initialized globals, .rodata for constants, .symtab for symbols, .debug_* for DWARF debug info, .dynamic for shared library metadata); and the actual content of each section. The separation between sections (linker's view) and segments (loader's view) allows the same file to serve both the compile-time toolchain and the runtime OS loader.

**Q: How do you find which shared libraries a binary depends on?**

Use `readelf -d mybinary | grep NEEDED` to list all required shared library sonames embedded in the ELF dynamic section — this works on the host without running the binary. Use `ldd mybinary` on the actual target where the libraries are installed — this shows each soname and the actual file path it resolves to, or "not found" if a library is missing. On the host for an ARM binary, `ldd` will not work directly; instead use `arm-linux-gnueabihf-readelf -d mybinary | grep NEEDED` and then manually verify those files exist in the target sysroot with `find /sysroot -name "libssl.so*"`.

**Q: What is the difference between VMA and LMA in an ELF section?**

VMA (Virtual Memory Address) is where the section's data will reside at runtime — the address the CPU uses to access it. LMA (Load Memory Address) is where the section's data is physically stored in the binary/flash image — where the loader reads it from. For Linux applications, VMA always equals LMA because the OS maps the file contents directly to the virtual address at which they will run. In bare-metal embedded systems, the distinction matters: the `.data` section has an LMA in flash (where the data is stored in the .elf image) and a VMA in RAM (where it must be at runtime). The C runtime startup code (`crt0.s`) copies `.data` from LMA to VMA and zeros `.bss` before calling `main()`.

**Q: How do you convert an ELF to a raw binary for flashing to flash memory?**

Use `objcopy -O binary input.elf output.bin`. This strips all ELF headers, section headers, and debug info and writes only the content of the LOAD segments, laid out according to their LMA addresses. Gaps between sections are padded with zeros. For bootloaders and bare-metal firmware, this raw binary is what flash programmers (OpenOCD, J-Link, esptool) or the `dd` command write directly to flash. If you only want a specific section (e.g., `.text`), use `objcopy -j .text -O binary input.elf output.bin`. For other formats: `-O ihex` produces Intel HEX (text, used by some programmers), `-O srec` produces Motorola S-Record format.

**Q: What does nm -u show and when is it useful?**

`nm -u mybinary` (or `nm --undefined-only`) lists all symbols that are referenced in the binary but not defined in it — they must be provided by a shared library or another object file at link time. This is useful for: (1) diagnosing link errors ("undefined reference to foo") by finding exactly which object file references a missing symbol, (2) verifying that all expected external symbols are present with their correct names before linking, (3) identifying which shared libraries you actually need by seeing what undefined symbols are GLIBC exports, (4) auditing a library to see what it depends on from the outside. In cross-compilation, if you see an unexpected symbol from the host's libraries, it indicates the sysroot is not set up correctly.

**Q: How do you find what source line corresponds to a crash address?**

Use `addr2line -e mybinary CRASH_ADDRESS` where the binary was compiled with `-g` (debug symbols). If the binary is stripped, you need the corresponding unstripped binary or the separate `.debug` file created with `objcopy --only-keep-debug`. For a kernel crash (oops), use `arm-linux-gnueabihf-addr2line -e vmlinux KERNEL_CRASH_ADDRESS` — the `vmlinux` file is the uncompressed kernel ELF with debug info (not the compressed `zImage`). If ASLR is in use, you need to account for the load offset: subtract the base address from the crash address before passing to `addr2line`. The `-f` flag adds function name output alongside the file and line number.

---

## References
{:.gc-ref}
<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

- **"ELF-64 Object File Format" Specification** — the official ELF specification document (https://uclibc.org/docs/elf-64-gen.pdf)
- **GNU Binutils Documentation** — readelf, nm, objdump, objcopy, addr2line reference (https://sourceware.org/binutils/docs/)
- **"Linkers and Loaders"** — John R. Levine — comprehensive coverage of ELF linking and loading internals
- **Linux Foundation: System V ABI** — ARM supplement to the ELF ABI specification (https://github.com/ARM-software/abi-aa)
- **checksec** — security hardening analysis tool for ELF binaries (https://github.com/slimm609/checksec.sh)
- **DWARF Debugging Standard** — specification for ELF debug information format (https://dwarfstd.org/)
