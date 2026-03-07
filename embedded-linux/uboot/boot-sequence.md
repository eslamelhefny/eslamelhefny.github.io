---
layout: guide
title: "ARM SoC Boot Sequence"
description: "Understand the complete boot chain from Power-On Reset through BootROM, SPL, and U-Boot proper to the Linux kernel on ARM SoCs."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 06"
phase: embedded-linux-uboot
permalink: /embedded-linux/uboot/boot-sequence/
prev_topic:
  title: "Cross-Compiling with CMake"
  url: /embedded-linux/cross-compilation/cross-compile-cmake/
next_topic:
  title: "U-Boot Config & Build"
  url: /embedded-linux/uboot/uboot-config-build/
---

## Why the Boot Sequence Matters
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Every time you press the power button on an embedded board, a carefully orchestrated sequence of software stages executes before the Linux kernel ever runs a single line of your application code. Understanding this sequence is not optional for embedded Linux developers — it is the foundation. When your board does not boot, it stops somewhere in this chain, and you must know where to look.

ARM SoCs use a multi-stage boot process because no single program can do everything required to bring a system from cold metal to a running kernel. DRAM is not accessible at power-on. Clocks are not configured. The processor does not know where your software lives. Each stage handles a narrow responsibility, configures a bit more hardware, and then hands off to the next stage.

---

### The Five Stages at a Glance

```
Power-On Reset (POR)
        |
        v
  ┌─────────────┐
  │   BootROM   │  (burned into SoC silicon, read-only)
  │  (Stage 0)  │  reads boot media → loads SPL into internal SRAM
  └─────────────┘
        |
        v
  ┌─────────────┐
  │     SPL     │  (Secondary Program Loader)
  │  (Stage 1)  │  initializes DRAM, loads U-Boot proper
  └─────────────┘
        |
        v
  ┌─────────────┐
  │  U-Boot     │  (Das U-Boot, "Universal Boot Loader")
  │  (Stage 2)  │  full-featured bootloader, user interactive shell
  └─────────────┘
        |
        v
  ┌─────────────┐
  │ Linux Kernel│  (decompresses itself, mounts rootfs)
  │  (Stage 3)  │
  └─────────────┘
        |
        v
  ┌─────────────┐
  │  init / PID1│  (systemd, BusyBox init, etc.)
  └─────────────┘
```

---

### Stage 0: Power-On Reset

When power is applied to an ARM SoC, the processor starts executing code from a fixed address in internal ROM. This is the **Power-On Reset vector**. The processor is in a deterministic initial state: caches off, MMU off, running at a slow clock, executing from internal SRAM or ROM.

The hardware designer programs the boot media selection pins (called **boot mode pins** or **SYSBOOT pins** on TI SoCs) before the chip is manufactured into a board. These pins tell the BootROM where to look for the first stage bootloader.

---

### Stage 1: BootROM

The **BootROM** is code burned permanently into the silicon of the SoC. You cannot change it. It is the hardware vendor's code and it runs with full trust.

BootROM responsibilities:
- Initialize the minimum required clocks (enough to read from boot media)
- Read the boot mode pins to determine boot source (MMC0, MMC1, SPI flash, NAND, USB, UART)
- Load the first stage bootloader (SPL) from that boot media into internal SRAM
- Validate the SPL header (on secure SoCs, verify the signature)
- Jump to the SPL entry point

BootROM does **not** initialize DRAM. It cannot — there is no DRAM initialization code in ROM, and DRAM requires calibration that is board-specific.

**Memory available to BootROM:** Only the SoC's internal SRAM (typically 64 KB to 256 KB). This is why what BootROM can load is small.

On the **TI AM335x** (BeagleBone Black), BootROM reads an `AM335x_BOOT_HEADER` structure at the start of the MLO file. This header tells BootROM the load address and size. BootROM loads MLO (the SPL) into internal SRAM at address `0x402F0400`.

On the **NXP i.MX6**, BootROM reads an **IVT (Image Vector Table)** at a specific offset in the boot media. The IVT points to the SPL image and (on HAB-enabled devices) to the CSF (Command Sequence File) for signature verification.

---

### Stage 2: SPL — Secondary Program Loader

The **SPL** is the first piece of code that you, as an embedded Linux developer, actually write and maintain. It lives in `arch/arm/cpu/` and `board/VENDOR/BOARD/` in the U-Boot source tree.

SPL must fit inside the SoC's internal SRAM — typically under 128 KB. Because of this tight constraint, only essential functionality is compiled into SPL.

SPL responsibilities:
- Configure PLLs and clocks (the main CPU and DDR clocks)
- Initialize the DDR/LPDDR DRAM interface
- Set up the serial console (UART) so you can see debug messages
- Load U-Boot proper from boot media into DRAM
- Jump to U-Boot proper

```
$ minicom -D /dev/ttyUSB0 -b 115200

U-Boot SPL 2023.10 (Oct 15 2023 - 12:34:56 +0000)
Trying to boot from MMC1
```

That single line `U-Boot SPL 2023.10` is your confirmation that BootROM succeeded and SPL is running.

---

### Stage 3: U-Boot Proper

Once SPL has initialized DRAM and loaded U-Boot proper into it, U-Boot runs with full DRAM available. U-Boot proper is the fully-featured bootloader.

U-Boot proper responsibilities:
- Complete hardware initialization (USB, Ethernet, LCD, storage controllers)
- Present an interactive shell (the `=>` prompt)
- Load the kernel image and Device Tree Blob (DTB) into DRAM
- Set kernel boot arguments (`bootargs` environment variable)
- Transfer control to the Linux kernel

```
U-Boot 2023.10 (Oct 15 2023 - 12:34:56 +0000)

CPU  : AM335X-GP rev 2.1
Model: TI AM335x BeagleBone Black
DRAM : 512 MiB
Core:  172 devices, 14 uclasses, devicetree: separate
MMC:   OMAP SD/MMC: 0, OMAP SD/MMC: 1
Loading Environment from MMC... OK
Net:   eth0: ethernet@4a100000
Hit any key to stop autoboot:  3
=>
```

---

### Memory Map During Boot

| Stage      | Executes From         | Loads Into        |
|------------|----------------------|-------------------|
| BootROM    | Internal ROM         | Internal SRAM     |
| SPL        | Internal SRAM        | DRAM              |
| U-Boot     | DRAM (low address)   | DRAM              |
| Linux      | DRAM                 | DRAM              |

On the AM335x, the SRAM is at `0x402F0400` (192 KB usable for SPL). On i.MX6, internal OCRAM is at `0x00907000` (256 KB).

---

## SPL Deep Dive, Boot Mode Selection, and Falcon Mode
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### SPL Size Constraints

SPL must fit within the SoC's internal SRAM. You can check the size of your compiled SPL:

```bash
$ ls -la spl/u-boot-spl.bin
-rw-r--r-- 1 user user 98304 Oct 15 2023 spl/u-boot-spl.bin

$ arm-linux-gnueabihf-nm --size-sort spl/u-boot-spl | tail -20
00000234 T board_init_f
000004a8 T ddr_init
00000514 T spl_mmc_load_image
00000c10 T lowlevel_init
```

For the AM335x, the hard limit is approximately **109 KB** (the usable portion of internal SRAM after the BootROM stack and stack area). If your SPL exceeds this, the build will fail with a linker error:

```
spl/u-boot-spl: section `.bss' will not fit in region `sram'
region `sram' overflowed by 4096 bytes
```

Reduce SPL size by disabling unnecessary `CONFIG_SPL_*` options in your defconfig.

---

### TPL: Tertiary Program Loader

Some SoCs have even less internal SRAM — as little as 20 KB. For these, U-Boot introduced a **TPL (Tertiary Program Loader)**:

```
BootROM → TPL (20KB SRAM) → SPL (SRAM after TPL enables more) → U-Boot → Kernel
```

TPL only enables enough memory to load SPL. This is uncommon but used on some Rockchip SoCs.

---

### Boot Source Selection: Boot Mode Pins

SoC manufacturers provide hardware pins that determine which boot media BootROM tries first. These are sampled at Power-On Reset.

**TI AM335x SYSBOOT pins (SYSBOOT[15:0]):**

| SYSBOOT value | Boot Order                           |
|---------------|--------------------------------------|
| 0x0001        | NAND → MMC0 → USB → UART0           |
| 0x8000        | SPI0 → MMC0 → USB → UART0          |
| 0x4000        | MMC0 → USB → UART0 → SPI0          |

On BeagleBone Black, the boot order depends on whether the S2 button is held at power-on:
- **S2 not pressed:** eMMC first (internal flash)
- **S2 pressed:** SD card first

**NXP i.MX6 BOOT_MODE pins:**

| BOOT_MODE[1:0] | Action                                |
|----------------|---------------------------------------|
| 00             | Boot from fuses (eFUSE config)        |
| 10             | Internal boot (normal operation)      |
| 01             | Serial downloader (USB recovery)      |

---

### Falcon Mode: SPL Boots Kernel Directly

In production systems, you may not want the overhead of U-Boot proper. **Falcon Mode** allows SPL to boot the Linux kernel directly, skipping U-Boot entirely:

```
BootROM → SPL → Linux Kernel  (Falcon Mode, no U-Boot proper)
```

To enable Falcon Mode:

```bash
# In U-Boot, prepare the Falcon Mode data
=> mmc dev 0
=> fatload mmc 0:1 ${kernel_addr_r} zImage
=> fatload mmc 0:1 ${fdt_addr_r} am335x-boneblack.dtb
=> spl export fdt ${kernel_addr_r} - ${fdt_addr_r}
Exporting flat device tree...
Falcon mode data written to MMC
```

Enable in defconfig:
```
CONFIG_SPL_OS_BOOT=y
CONFIG_SPL_FALCON_BOOT_MMCSD=y
```

Falcon Mode reduces boot time significantly — U-Boot proper can add 500ms to 2 seconds to boot time. The tradeoff is losing the U-Boot interactive shell for debugging.

---

### Investigating Boot Failures via Serial Console

The serial console (UART) is your primary debugging tool. Connect a USB-UART adapter to the board's debug UART and monitor output.

**Scenario 1: Nothing appears at all**
- BootROM is not finding a valid SPL. Check:
  - SD card is in the correct slot
  - SPL file is named correctly (`MLO` on FAT for AM335x)
  - Boot mode pins are set correctly
  - SPL binary is not corrupt (reflash)

**Scenario 2: SPL message appears, then hangs**
```
U-Boot SPL 2023.10
Trying to boot from MMC1

(hangs here)
```
SPL loaded but DRAM init is failing. Check DDR configuration in `board/ti/am335x/mux.c` and the DDR timing parameters.

**Scenario 3: U-Boot appears but kernel load fails**
```
U-Boot 2023.10
=> fatload mmc 0:1 0x82000000 zImage
** File not found zImage **
```
U-Boot is running fine, but the kernel image is missing from the FAT partition.

---

### Reading the U-Boot Boot Log

A complete successful boot log looks like this:

```
U-Boot SPL 2023.10 (Oct 15 2023 - 12:34:56 +0000)
Trying to boot from MMC1

U-Boot 2023.10 (Oct 15 2023 - 12:34:56 +0000)

CPU  : AM335X-GP rev 2.1
Model: TI AM335x BeagleBone Black
DRAM : 512 MiB
Core:  172 devices, 14 uclasses, devicetree: separate
MMC:   OMAP SD/MMC: 0, OMAP SD/MMC: 1
Loading Environment from MMC... OK
Net:   eth0: ethernet@4a100000
Hit any key to stop autoboot:  0
switch to partitions #0, OK
mmc0 is current device
Scanning mmc 0:1...
Found /boot/extlinux/extlinux.conf
Retrieving file: /boot/extlinux/extlinux.conf
1:      linux
Retrieving file: /boot/zImage
Retrieving file: /boot/am335x-boneblack.dtb
append: console=ttyO0,115200n8 root=/dev/mmcblk0p2 rw rootfstype=ext4
Kernel image @ 0x82000000 [ 0x000000 - 0x5d4d40 ]
## Flattened Device Tree blob at 88000000
   Booting using the fdt blob at 0x88000000
   Loading Device Tree to 8ffed000, end 8ffff... OK

Starting kernel ...
```

Key lines to understand:
- `DRAM: 512 MiB` — SPL successfully initialized DRAM
- `Loading Environment from MMC... OK` — Environment variables loaded
- `Found /boot/extlinux/extlinux.conf` — distro boot found the config file
- `Starting kernel ...` — U-Boot is done; Linux is taking over

---

## Secure Boot, ATF, and SoC-Specific Boot Internals
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Secure Boot Chain

In a secure boot configuration, each stage cryptographically validates the next before jumping to it. This prevents an attacker who gains write access to boot media from replacing the bootloader with malicious code.

```
BootROM (trusted, in silicon)
   │ validates signature of SPL using OTP-burned public key
   ▼
SPL (signed, authenticated)
   │ validates signature of U-Boot proper
   ▼
U-Boot (signed, authenticated)
   │ validates signature of kernel (FIT image with signature)
   ▼
Linux Kernel (signed, authenticated)
```

If any signature check fails, the boot chain halts. No interactive shell. No fallback (unless you implement one deliberately).

---

### NXP HAB (High Assurance Boot) on i.MX6

HAB is NXP's secure boot implementation for i.MX6/i.MX8 processors. BootROM reads a **CSF (Command Sequence File)** embedded in the image that contains:
- RSA-2048 or RSA-4096 signature of the image
- Certificate chain back to a root CA whose public key hash is burned into SoC eFUSEs

Key eFUSEs for HAB:
- `SEC_CONFIG[1]` fuse: When blown, enables HAB enforcement. **This is a one-time, irreversible operation.**
- `SRK_HASH` fuses: SHA-256 hash of the Super Root Key(s)

Checking HAB status in U-Boot:
```
=> hab_status

Secure boot disabled

HAB Configuration: 0xf0, HAB State: 0x66
No HAB Events Found!
```

When HAB is enabled and a signature check fails:
```
=> hab_status
HAB Configuration: 0xcc, HAB State: 0x99

--------- HAB Event 1 -----------------
event data:
0xdb 0x00 0x14 0x43 0x33 0x 11 0xdd 0x00
0x00 0x00 0x00 0x00 0xf0 0x0f 0x00 0x60

STS = HAB_FAILURE (0x33)
RSN = HAB_INV_SIGNATURE (0x0f)
```

---

### ARM Trusted Firmware (ATF / TF-A)

**ARM Trusted Firmware** (now called **Trusted Firmware-A**, or TF-A) is a reference implementation of secure world software for ARMv7 and ARMv8 processors. It implements the ARM Security Architecture.

TF-A inserts a new stage between SPL and U-Boot:

```
BootROM → SPL → TF-A (BL2, BL31, BL32) → U-Boot → Kernel
```

TF-A boot levels:
- **BL1:** First-stage bootloader (in trusted ROM)
- **BL2:** Trusted Boot Firmware (loaded by BL1, validates and loads BL3x)
- **BL31:** EL3 Runtime Firmware (stays resident, handles SMC calls)
- **BL32:** Secure Payload (optional, typically OP-TEE)
- **BL33:** Non-trusted firmware (U-Boot proper)

After BL31 starts, the system is split into:
- **Secure World (EL3/S-EL1):** TF-A + OP-TEE
- **Normal World (EL2/EL1):** U-Boot, then Linux

U-Boot runs at EL2 (hypervisor level) on ARMv8 when ATF is present. It then drops the kernel to EL1.

Building ATF for i.MX8:
```bash
$ git clone https://git.trustedfirmware.org/TF-A/trusted-firmware-a.git
$ cd trusted-firmware-a
$ make CROSS_COMPILE=aarch64-linux-gnu- PLAT=imx8mq bl31
  CC      bl31/bl31_main.c
  CC      common/context_mgmt.c
  LD      build/imx8mq/release/bl31/bl31.elf
  BIN     build/imx8mq/release/bl31.bin
```

The resulting `bl31.bin` is packaged with U-Boot SPL using NXP's `imx-mkimage` tool.

---

### OP-TEE: Open Portable Trusted Execution Environment

OP-TEE runs as BL32 in the secure world. It provides:
- Trusted Application (TA) execution environment
- Cryptographic services to the normal world via SMC calls
- Secure storage
- Hardware key management (device key, RPMB key)

From Linux, the normal world communicates with OP-TEE through the `/dev/tee0` device node, which maps to the tee-supplicant daemon.

---

### A/B Boot Partition Scheme

Robust production devices use an **A/B (redundant) partition scheme** for over-the-air updates:

```
┌────────┬────────┬────────────────┐
│  Boot  │  Boot  │                │
│  Part A│  Part B│  Data/Rootfs   │
│(active)│(update)│                │
└────────┴────────┴────────────────┘
```

U-Boot selects which partition to boot based on environment variables:
```bash
# In U-Boot environment
bootslot=a
boot_a_left=3     # retry counter
boot_b_left=3

# bootcmd logic
if test ${bootslot} = "a"; then
    setenv bootpart 1
else
    setenv bootpart 2
fi
```

On Android (and Android-derived systems), U-Boot reads BCB (Bootloader Control Block) from a dedicated partition to determine A/B slot selection.

---

### Measuring Boot Time at Each Stage

To optimize boot time, you need to measure each stage:

**In SPL:** Add `printf` with timer reads using `timer_get_us()`:
```c
/* board/ti/am335x/board.c */
#include <timer.h>

void board_init_f(ulong dummy)
{
    u64 t0 = timer_get_us();
    ddr_init();
    printf("SPL: DDR init took %llu us\n", timer_get_us() - t0);
    ...
}
```

**In U-Boot:** Use the built-in boot timing:
```bash
# Enable in defconfig
CONFIG_BOOTSTAGE=y
CONFIG_BOOTSTAGE_REPORT=y

# View in U-Boot
=> bootstage report
Timer summary in microseconds (16 records):
         0: reset
       185: spl phase 1
     12450: spl board init done
     98234: board init done
    234567: main loop
    345678: bootm_start
    456789: bootm_handoff

Accumulated time:
              spl_ddr:  12265
           board_init:  85784
             main_lp:  136333
         bootm_total:  222222
```

---

### JTAG Debugging at BootROM Stage

When BootROM itself is failing (extremely rare, usually board bring-up), you need JTAG:

```bash
# OpenOCD with AM335x
$ openocd -f interface/ftdi/olimex-arm-usb-ocd-h.cfg \
          -f target/am335x.cfg

Open On-Chip Debugger 0.12.0
Info : JTAG tap: am335x.jrc tap/device found: 0x2b94402f
Info : JTAG tap: am335x.cpu tap/device found: 0x4b6d102f
Info : am335x.cpu: hardware has 6 breakpoints, 4 watchpoints

# Connect GDB
$ arm-linux-gnueabihf-gdb
(gdb) target remote :3333
(gdb) monitor halt
(gdb) info registers
pc             0x40030000    <-- BootROM address
sp             0x4030f7f8
```

At this point you can single-step through BootROM (though without symbols, you see only disassembly) to see why it is not loading SPL.

---

### SoC-Specific Boot Image Headers

**AM335x GP Header (non-secure):**
```
Offset  Size  Field
0x00    4     Magic (0x00000000 for GP device)
0x04    4     Image size in bytes
0x08    4     Load address (destination in SRAM)
0x0C    4     Reserved
```

The `MLO` file on BeagleBone Black FAT partition is exactly SPL with this header prepended by the U-Boot build system.

**i.MX6 IVT (Image Vector Table):**
```c
struct imx_ivt {
    u8  header;        /* 0xD1 */
    u16 length;        /* 0x0020 */
    u8  version;       /* 0x40 */
    u32 entry;         /* Entry point of the image */
    u32 reserved1;
    u32 dcd_ptr;       /* Pointer to DCD (Device Configuration Data) */
    u32 boot_data_ptr; /* Pointer to boot data structure */
    u32 self_ptr;      /* Address of this IVT */
    u32 csf_ptr;       /* Pointer to CSF (for HAB) */
    u32 reserved2;
};
```

The DCD (Device Configuration Data) contains the DDR initialization register writes — this is how BootROM can initialize DRAM for i.MX6 before jumping to SPL.

---

## Interview Questions
{:.gc-iq}

**1. What is the purpose of SPL? Why not boot U-Boot directly from BootROM?**

SPL exists because of SRAM size constraints. BootROM can only load code into the SoC's internal SRAM, which is typically 64-256 KB. U-Boot proper is several hundred kilobytes to over a megabyte. SPL fits in SRAM, initializes DRAM, and then loads the full U-Boot into DRAM. Without SPL, BootROM would need DRAM to already be working, which requires board-specific initialization that cannot be in ROM.

**2. What is Falcon Mode in U-Boot?**

Falcon Mode allows SPL to boot the Linux kernel directly, bypassing U-Boot proper entirely. The boot chain becomes `BootROM → SPL → Kernel`. SPL stores the kernel load address, DTB address, and boot arguments in a data structure on the boot media. This significantly reduces boot time (saves the 500ms to 2 second U-Boot initialization) at the cost of losing the U-Boot interactive shell. Enabled with `CONFIG_SPL_OS_BOOT=y`.

**3. Explain the role of BootROM in the boot process.**

BootROM is immutable code burned into the SoC silicon by the chip manufacturer. It executes at Power-On Reset from internal ROM with no external memory. It reads boot mode pins to determine the boot source (MMC, NAND, SPI flash, USB), loads the SPL image into internal SRAM, optionally validates its signature (on secure boot devices), and jumps to the SPL entry point. It provides the hardware root of trust in a secure boot chain.

**4. What initializations must happen before DRAM can be used?**

Before DRAM can be used, the following must occur: PLLs must be configured to provide the required clock frequencies; the DDR controller must be initialized with the correct timing parameters (tRCD, tRP, tRAS, CL, etc.) specific to the DRAM chips on the board; DRAM training (ZQ calibration, read/write leveling) must complete; and the DDR controller address mapping must be set up. All of this is SPL's primary job.

**5. How does secure boot extend the boot chain?**

Secure boot adds cryptographic validation at each stage transition. BootROM validates SPL's signature using a public key hash burned into SoC eFUSEs (one-time programmable). SPL validates U-Boot's signature. U-Boot validates the kernel image's signature (via FIT image signing). If any signature check fails, boot halts. The chain of trust is rooted in the immutable BootROM and the one-time-programmable eFUSEs.

**6. What is ARM Trusted Firmware (ATF) and where does it fit in the boot sequence?**

ATF (now called TF-A, Trusted Firmware-A) is a reference implementation of the ARM Trusted Board Boot Requirements and ARM Security Architecture for ARMv7/ARMv8. It inserts between SPL and U-Boot: `SPL → TF-A BL31 → U-Boot`. BL31 runs at EL3 (the highest privilege level) and remains resident throughout the system's lifetime, handling Secure Monitor Calls (SMC) from both the secure world (OP-TEE) and normal world (Linux). It implements PSCI (Power State Coordination Interface) for CPU power management.

---

## References
{:.gc-ref}

- U-Boot documentation: `doc/README.SPL` in the U-Boot source tree
- "Mastering Embedded Linux Programming" — Chris Simmonds, Chapter 3: All About Bootloaders
- TI AM335x Sitara Processors Technical Reference Manual — Chapter 26: Initialization
- ARM Trusted Firmware documentation: [https://trustedfirmware-a.readthedocs.io/](https://trustedfirmware-a.readthedocs.io/)
- NXP i.MX 6Solo/6DualLite Applications Processor Reference Manual, Chapter 8: System Boot
- U-Boot Falcon Mode: `doc/README.falcon` in the U-Boot source tree
- OP-TEE documentation: [https://optee.readthedocs.io/](https://optee.readthedocs.io/)
