---
layout: guide
title: "U-Boot Configuration & Build"
description: "Configure and build U-Boot from source for ARM targets, understand defconfigs, Kconfig options, and all output artifacts including MLO, u-boot.bin, and FIT images."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 06"
phase: embedded-linux-uboot
permalink: /embedded-linux/uboot/uboot-config-build/
prev_topic:
  title: "ARM SoC Boot Sequence"
  url: /embedded-linux/uboot/boot-sequence/
next_topic:
  title: "U-Boot Commands & Scripting"
  url: /embedded-linux/uboot/uboot-commands/
---

## Getting U-Boot Source and Building Your First Image
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

U-Boot is an open-source bootloader maintained by Denx Software Engineering. The source is hosted on a public GitLab instance. You download it, select the configuration for your board, and cross-compile it for your target architecture.

### Downloading U-Boot

```bash
# Clone the mainline U-Boot repository
$ git clone https://source.denx.de/u-boot/u-boot.git
Cloning into 'u-boot'...
remote: Enumerating objects: 890234, done.
remote: Counting objects: 100% (890234/890234), done.
Receiving objects: 100% (890234/890234), 324.21 MiB | 8.92 MiB/s, done.

$ cd u-boot
$ git log --oneline -5
a28b4a5c5b (HEAD -> master) Merge branch 'next' of ...
3f1e9d2a4c arm: am33xx: Fix DDR training timeout
7b8c34f1e2 net: dwc_eth_qos: Add i.MX8MP support
2c4a8f9e3d mmc: omap_hsmmc: Increase timeout for eMMC
1d3e7c8b2a doc: Update release notes for 2023.10

# Check out a stable release rather than HEAD
$ git tag | grep "^v2023" | tail -5
v2023.01
v2023.04
v2023.07
v2023.07.01
v2023.10

$ git checkout v2023.10
HEAD is now at 8b3f9a2 Merge tag 'v2023.10'
```

---

### Finding the Right defconfig

A **defconfig** is a minimal configuration file listing only the settings that differ from their default values. U-Boot ships hundreds of defconfigs for supported boards:

```bash
# List all available defconfigs
$ ls configs/ | wc -l
1247

# Search for BeagleBone-related configs
$ ls configs/ | grep -i beagle
am335x_boneblack_defconfig
am335x_boneblack_vboot_defconfig
am335x_evm_defconfig
am335x_evm_spiboot_defconfig
beaglebone_defconfig

# Search for Raspberry Pi configs
$ ls configs/ | grep -i rpi
rpi_0_w_defconfig
rpi_2_defconfig
rpi_3_32b_defconfig
rpi_3_defconfig
rpi_3_b_plus_defconfig
rpi_4_32b_defconfig
rpi_4_defconfig
rpi_arm64_defconfig

# Search for QEMU ARM configs
$ ls configs/ | grep -i qemu
qemu-ppce500_defconfig
qemu_arm64_defconfig
qemu_arm_defconfig
qemu_mips_defconfig
qemu_riscv32_defconfig
qemu_riscv64_defconfig
qemu_x86_64_defconfig
```

---

### Applying a defconfig

The `make` command with a defconfig target reads the defconfig file and writes the full `.config`:

```bash
# Set environment variables for convenience
$ export ARCH=arm
$ export CROSS_COMPILE=arm-linux-gnueabihf-

# Apply the BeagleBone Black defconfig
$ make am335x_boneblack_defconfig
  HOSTCC  scripts/basic/fixdep
  HOSTCC  scripts/kconfig/conf.o
  HOSTCC  scripts/kconfig/zconf.tab.o
  HOSTCC  scripts/kconfig/lxdialog/checklist.o
  HOSTCC  scripts/kconfig/lxdialog/inputbox.o
  HOSTCC  scripts/kconfig/lxdialog/menubox.o
  HOSTCC  scripts/kconfig/lxdialog/textbox.o
  HOSTCC  scripts/kconfig/lxdialog/util.o
  HOSTCC  scripts/kconfig/lxdialog/yesno.o
  HOSTCC  scripts/kconfig/mconf.o
#
# configuration written to .config
#

# Verify .config was created
$ head -20 .config
#
# Automatically generated file; DO NOT EDIT.
# U-Boot 2023.10 Configuration
#
CONFIG_CREATE_ARCH_SYMLINK=y
CONFIG_LINKER_LIST_ALIGN=8
CONFIG_ARM=y
CONFIG_ARCH_CPU_INIT=y
CONFIG_ARCH_OMAP2PLUS=y
CONFIG_TI_COMMON_CMD_OPTIONS=y
CONFIG_SOC_AM33XX=y
CONFIG_TARGET_AM335X_EVM=y
CONFIG_SYS_BOARD="am335x"
CONFIG_SYS_VENDOR="ti"
CONFIG_SYS_SOC="am33xx"
CONFIG_SYS_CONFIG_NAME="am335x_evm"
```

---

### Customizing with menuconfig

`menuconfig` provides a terminal UI for browsing and changing configuration options:

```bash
$ make menuconfig
```

This opens a full-screen menu. Key navigation:
- Arrow keys: navigate
- Enter: enter submenu
- Space: toggle option
- `/`: search for a config symbol
- `?`: help for current option
- `Esc Esc`: go back / exit

Important menu locations:
- **Architecture select** → `ARM architecture`
- **Boot images** → kernel loading address settings
- **Command line interface** → which commands to include
- **Environment** → where to store environment variables
- **Device Drivers** → enable specific hardware drivers
- **File systems** → FAT, ext4, ubifs support

---

### Compiling U-Boot

```bash
# Build with 4 parallel jobs
$ make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- -j4

  CC      init/board_init.o
  CC      init/main.o
  CC      board/ti/am335x/board.o
  CC      board/ti/am335x/mux.o
  CC      arch/arm/cpu/armv7/start.o
  ...
  LD      u-boot
  OBJCOPY u-boot.bin
  OBJCOPY u-boot-nodtb.bin
  COPY    u-boot.dtb
  CAT     u-boot-dtb.bin
  MKIMAGE u-boot.img

SPL binary size is 98304 bytes (max 114688 bytes)

Build finished successfully in 45 seconds.
```

A clean build on a modern laptop takes approximately 30-90 seconds.

---

### Understanding Output Artifacts

After a successful build, several output files are produced:

```bash
$ ls -lh *.bin *.img MLO spl/*.bin 2>/dev/null
-rw-r--r-- 1 user user  98K Oct 15 spl/u-boot-spl.bin
-rw-r--r-- 1 user user  98K MLO
-rw-r--r-- 1 user user 512K u-boot.bin
-rw-r--r-- 1 user user 516K u-boot-dtb.bin
-rw-r--r-- 1 user user 516K u-boot-dtb.img
-rw-r--r-- 1 user user 516K u-boot.img
```

| File | Description | Used When |
|------|-------------|-----------|
| `MLO` | SPL with AM335x GP header | First file BootROM loads from FAT on AM335x |
| `spl/u-boot-spl.bin` | Raw SPL binary | Various — MLO is this with header |
| `u-boot.bin` | U-Boot proper, raw binary, no DTB embedded | When DTB is separate |
| `u-boot-dtb.bin` | U-Boot proper with DTB appended | Preferred for most boards |
| `u-boot.img` | u-boot.bin wrapped in legacy uImage header | Older SPL versions |
| `u-boot-dtb.img` | u-boot-dtb.bin wrapped in legacy uImage header | When SPL uses uImage format |
| `u-boot.elf` | ELF file with full symbols | JTAG debugging |

**Which file to flash depends on your board:**
- BeagleBone Black: Copy `MLO` and `u-boot.img` to the FAT partition
- Raspberry Pi: Copy `u-boot.bin` alongside the Pi firmware files
- i.MX6: Use `dd` to write the u-boot image at a specific offset

---

### Flashing to SD Card (BeagleBone Black)

```bash
# Identify the SD card device
$ lsblk
NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT
sda      8:0    0 500.1G  0 disk
└─sda1   8:1    0 500.1G  0 part /
sdb      8:16   1  15.0G  0 disk     <-- SD card
├─sdb1   8:17   1    64M  0 part
└─sdb2   8:18   1  14.9G  0 part

# Mount FAT partition and copy bootloader files
$ sudo mount /dev/sdb1 /mnt/sdcard
$ sudo cp MLO /mnt/sdcard/
$ sudo cp u-boot.img /mnt/sdcard/
$ sync
$ sudo umount /mnt/sdcard
```

---

## Key CONFIG Options, Versioning, and Multiple Board Builds
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Most Important CONFIG Symbols

Understanding key configuration symbols helps you customize U-Boot's behavior:

**Command availability (`CONFIG_CMD_*`):**

| Symbol | Effect |
|--------|--------|
| `CONFIG_CMD_MMC=y` | Enable mmc commands |
| `CONFIG_CMD_USB=y` | Enable usb commands |
| `CONFIG_CMD_DHCP=y` | Enable dhcp command |
| `CONFIG_CMD_TFTP=y` | Enable tftp command |
| `CONFIG_CMD_NFS=y` | Enable nfs command |
| `CONFIG_CMD_PING=y` | Enable ping command |
| `CONFIG_CMD_EXT4=y` | Enable ext4 filesystem commands |
| `CONFIG_CMD_FAT=y` | Enable FAT filesystem commands |
| `CONFIG_CMD_I2C=y` | Enable i2c commands |
| `CONFIG_CMD_FPGA=y` | Enable fpga load commands |

**Environment storage (`CONFIG_ENV_IS_*`):**

| Symbol | Storage Location |
|--------|-----------------|
| `CONFIG_ENV_IS_IN_MMC=y` | MMC/eMMC at ENV_OFFSET |
| `CONFIG_ENV_IS_IN_NAND=y` | NAND flash at ENV_OFFSET |
| `CONFIG_ENV_IS_IN_SPI_FLASH=y` | SPI NOR flash |
| `CONFIG_ENV_IS_IN_FAT=y` | File on FAT partition |
| `CONFIG_ENV_IS_NOWHERE=y` | No persistence (always defaults) |
| `CONFIG_ENV_IS_IN_UBI=y` | UBI volume on NAND |

**Memory layout (`CONFIG_SYS_*`):**

```
CONFIG_SYS_TEXT_BASE=0x80800000  # Where U-Boot loads itself in DRAM
CONFIG_SYS_SDRAM_BASE=0x80000000 # Start of DRAM
CONFIG_SYS_MALLOC_LEN=0x400000   # 4MB malloc pool
CONFIG_SYS_LOAD_ADDR=0x82000000  # Default kernel load address
```

---

### CONFIG_SYS_TEXT_BASE Explained

`CONFIG_SYS_TEXT_BASE` is the virtual address where U-Boot expects to be loaded in memory. The linker uses this to compute all absolute addresses in the binary.

If this value does not match where SPL actually loads U-Boot, the CPU will jump to the wrong address and crash:

```
U-Boot 2023.10
...
data abort
pc : 0x8034a2b0  <-- wrong address, U-Boot is actually at 0x80300000
lr : 0x80349f14
sp : 0x8ef6bff8
```

To find where U-Boot is linked to run:
```bash
$ arm-linux-gnueabihf-objdump -f u-boot | grep "start address"
start address 0x80800000
```

This must match what SPL puts into the `load_addr` field of the image header.

---

### U-Boot Kconfig vs Old-Style Config Headers

Before 2016, U-Boot configuration was done entirely in C header files under `include/configs/BOARD.h`. These headers used `#define` macros:

```c
/* OLD STYLE — include/configs/am335x_evm.h */
#define CONFIG_SYS_TEXT_BASE    0x80800000
#define CONFIG_BOOTDELAY        1
#define CONFIG_BOOTCOMMAND      "run findfdt; run distro_bootcmd"
```

Modern U-Boot uses **Kconfig** (the same system as the Linux kernel), with `.config` files and `menuconfig`. However, a mix still exists:

- Architecture and board selection: Kconfig
- Some board-specific settings: still in `include/configs/BOARD.h`
- The transition is ongoing; some boards are fully Kconfig, others still have config headers

The Kconfig symbols in `.config` take precedence. The header file is included by `include/autoconf.mk` which is generated from `.config`.

---

### Saving a Minimal defconfig

After customizing with menuconfig, save a minimal defconfig (only changed values):

```bash
# Save minimal defconfig
$ make savedefconfig
scripts/kconfig/conf --savedefconfig=defconfig .config

$ cat defconfig
CONFIG_ARM=y
CONFIG_ARCH_OMAP2PLUS=y
CONFIG_TARGET_AM335X_EVM=y
CONFIG_DEFAULT_DEVICE_TREE="am335x-boneblack"
CONFIG_ENV_IS_IN_MMC=y
CONFIG_CMD_DHCP=y
CONFIG_CMD_NFS=y
CONFIG_OF_CONTROL=y

# Copy back to configs/ to make it your board's defconfig
$ cp defconfig configs/my_custom_board_defconfig
```

The saved defconfig has only 8 lines instead of 1000+ lines in the full `.config`.

---

### Building for Multiple Boards

```bash
# Build for Raspberry Pi 4 (64-bit)
$ make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- rpi_4_defconfig
$ make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- -j4

# Build for QEMU ARM vexpress (useful for testing without hardware)
$ make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- qemu_arm_defconfig
$ make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- -j4

# Run in QEMU (no hardware needed)
$ qemu-system-arm \
    -machine vexpress-a9 \
    -m 256M \
    -nographic \
    -kernel u-boot \
    -serial mon:stdio

U-Boot 2023.10 (Oct 15 2023 - 12:34:56 +0000)

DRAM:  256 MiB
WARNING: Caches not enabled
Flash: 128 MiB
MMC:   MMC: 0
Loading Environment from Flash... OK
In:    serial@9000000
Out:   serial@9000000
Err:   serial@9000000
Hit any key to stop autoboot:  3
=>
```

---

### Output Artifacts Summary Table

| File | Format | Size (typical) | Flash Location |
|------|--------|----------------|----------------|
| `MLO` | SPL + AM335x header | ~96 KB | FAT offset 0, or raw sector 1 |
| `u-boot.img` | U-Boot + uImage header | ~400-600 KB | FAT as file, or raw sector 256 |
| `u-boot.bin` | Raw binary | ~400-600 KB | SPI flash offset 0x40000 |
| `u-boot-dtb.bin` | Raw binary + DTB | ~420-620 KB | Same as u-boot.bin |
| `u-boot.elf` | ELF with symbols | ~2-4 MB | Never flashed; for JTAG |
| `u-boot.map` | Linker map | text file | Never flashed; for debugging |

---

## Driver Model, FIT Images, and Advanced Build Topics
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### U-Boot Driver Model (DM)

U-Boot's driver model (CONFIG_DM) is a framework for organizing device drivers, introduced around 2014. It provides:
- A device tree-based driver binding mechanism
- A unified API for device access
- Separation of platform data from driver code

**Driver Model concepts:**

```
uclass (e.g., UCLASS_MMC)
   └── udevice (e.g., "omap_hsmmc.0")
          └── driver (e.g., struct driver omap_hsmmc_driver)
                └── ops (e.g., struct dm_mmc_ops)
```

Enable DM in defconfig:
```
CONFIG_DM=y
CONFIG_DM_MMC=y
CONFIG_DM_SERIAL=y
CONFIG_DM_GPIO=y
CONFIG_DM_I2C=y
CONFIG_DM_USB=y
```

Writing a minimal DM driver:
```c
/* drivers/serial/serial_myboard.c */
#include <dm.h>
#include <serial.h>

struct myboard_serial_priv {
    void __iomem *base;
};

static int myboard_serial_putc(struct udevice *dev, const char ch)
{
    struct myboard_serial_priv *priv = dev_get_priv(dev);
    /* Wait for TX FIFO not full */
    while (!(readl(priv->base + UART_LSR) & UART_LSR_THRE))
        ;
    writel(ch, priv->base + UART_THR);
    return 0;
}

static int myboard_serial_probe(struct udevice *dev)
{
    struct myboard_serial_priv *priv = dev_get_priv(dev);
    priv->base = dev_read_addr_ptr(dev);
    return 0;
}

static const struct dm_serial_ops myboard_serial_ops = {
    .putc = myboard_serial_putc,
    .getc = myboard_serial_getc,
    .pending = myboard_serial_pending,
};

static const struct udevice_id myboard_serial_ids[] = {
    { .compatible = "myvendor,myboard-uart" },
    { }
};

U_BOOT_DRIVER(myboard_serial) = {
    .name     = "myboard_serial",
    .id       = UCLASS_SERIAL,
    .of_match = myboard_serial_ids,
    .probe    = myboard_serial_probe,
    .ops      = &myboard_serial_ops,
    .priv_auto = sizeof(struct myboard_serial_priv),
};
```

---

### FIT Image (Flattened Image Tree)

A **FIT image** is a single file that bundles multiple components (kernel, DTB, initrd, firmware) with metadata in a device tree format. It supports:
- Multiple kernels, DTBs, and configurations in one file
- Cryptographic signing of each component
- Hash verification (SHA256)
- Compression

**FIT image ITS (Image Tree Source) file:**

```
# kernel.its
/dts-v1/;

/ {
    description = "Linux kernel and FDT blob for BeagleBone Black";
    #address-cells = <1>;

    images {
        kernel {
            description = "Linux kernel";
            data = /incbin/("zImage");
            type = "kernel";
            arch = "arm";
            os = "linux";
            compression = "none";
            load = <0x82000000>;
            entry = <0x82000000>;
            hash-1 {
                algo = "sha256";
            };
        };

        fdt-1 {
            description = "BeagleBone Black DTB";
            data = /incbin/("am335x-boneblack.dtb");
            type = "flat_dt";
            arch = "arm";
            compression = "none";
            hash-1 {
                algo = "sha256";
            };
        };
    };

    configurations {
        default = "conf-1";
        conf-1 {
            description = "BeagleBone Black";
            kernel = "kernel";
            fdt = "fdt-1";
            signature-1 {
                algo = "sha256,rsa2048";
                key-name-hint = "dev";
                sign-images = "fdt", "kernel";
            };
        };
    };
};
```

**Building the FIT image:**

```bash
# Build the FIT image using mkimage
$ mkimage -f kernel.its kernel.itb
FIT description: Linux kernel and FDT blob for BeagleBone Black
Created:         Sun Oct 15 12:34:56 2023
 Image 0 (kernel)
  Description:  Linux kernel
  Created:      Sun Oct 15 12:34:56 2023
  Type:         Kernel Image
  Compression:  uncompressed
  Data Size:    6016704 Bytes = 5876.66 KiB = 5.74 MiB
  Architecture: ARM
  OS:           Linux
  Load Address: 0x82000000
  Entry Point:  0x82000000
  Hash algo:    sha256
  Hash value:   a3f8c9e2d1b4f7a6...
 Image 1 (fdt-1)
  Description:  BeagleBone Black DTB
  Data Size:    43056 Bytes = 42.05 KiB
  Architecture: ARM
  Hash algo:    sha256
  Hash value:   b7d4e1f9c2a8b3d6...
 Default Configuration: 'conf-1'
 Configuration 0 (conf-1)
  Description:  BeagleBone Black
  Kernel:       kernel
  FDT:          fdt-1

# Verify the FIT image
$ mkimage -l kernel.itb
FIT description: Linux kernel and FDT blob for BeagleBone Black
...
```

---

### U-Boot Environment in Flash

The environment is stored in a dedicated region of flash. Configuration in defconfig:

```bash
# For MMC storage
CONFIG_ENV_IS_IN_MMC=y
CONFIG_ENV_OFFSET=0x260000    # Byte offset on MMC raw
CONFIG_ENV_SIZE=0x20000       # 128 KB for environment
CONFIG_ENV_OFFSET_REDUND=0x280000  # Redundant copy

# For SPI NOR flash
CONFIG_ENV_IS_IN_SPI_FLASH=y
CONFIG_ENV_OFFSET=0x80000
CONFIG_ENV_SIZE=0x20000
CONFIG_ENV_SECT_SIZE=0x10000  # Must align to erase block size

# For NAND flash
CONFIG_ENV_IS_IN_NAND=y
CONFIG_ENV_OFFSET=0x200000
CONFIG_ENV_SIZE=0x20000
CONFIG_ENV_RANGE=0x40000      # Range to search for good blocks
```

The environment is stored with a CRC32 checksum:

```
┌────────────┬──────────────────────────────────────────────┐
│ CRC32 (4B) │ Environment data (null-separated key=value)  │
├────────────┴──────────────────────────────────────────────┤
│ "baudrate=115200\0bootcmd=run distro_bootcmd\0..."        │
└───────────────────────────────────────────────────────────┘
```

---

### Checking SPL Size with nm

To verify your SPL will fit in the SRAM limit:

```bash
# Check total SPL binary size
$ wc -c spl/u-boot-spl.bin
98304 spl/u-boot-spl.bin

# Find the largest sections
$ arm-linux-gnueabihf-nm --size-sort --print-size spl/u-boot-spl \
  | grep " [Tt] " | tail -20
00000150 000001a0 T omap_dm_timer_set_load
000001a0 00000210 T spi_flash_read_common
00000210 00000234 T board_init_f
00000234 000004a8 T ddr3_data_macro_config
000004a8 00000514 T spl_mmc_load_image

# Check section sizes
$ arm-linux-gnueabihf-size spl/u-boot-spl
   text    data     bss     dec     hex filename
  78234   12344    7726   98304   18000 spl/u-boot-spl
```

The `bss` section (zero-initialized globals) is not in the binary but occupies SRAM at runtime. Ensure `text + data + bss < SRAM_SIZE`.

---

### Generating compile_commands.json for IDE Integration

Modern IDEs (VS Code with clangd, CLion) use `compile_commands.json` for accurate code navigation:

```bash
# Install bear
$ sudo apt install bear

# Generate compile_commands.json
$ bear -- make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- -j4
[bear] loaded config from '/etc/bear/libear.so'
...
[bear] output written to '/home/user/u-boot/compile_commands.json'

$ wc -l compile_commands.json
4891 compile_commands.json

$ head -20 compile_commands.json
[
  {
    "arguments": [
      "arm-linux-gnueabihf-gcc",
      "-Wp,-MD,.deps/init/board_init.d",
      "-nostdinc",
      "-isystem",
      "/usr/lib/gcc-cross/arm-linux-gnueabihf/12/include",
      "-I./arch/arm/include",
      "-I./include",
      "-DCONFIG_ARM",
      "-o",
      "init/board_init.o",
      "-c",
      "init/board_init.c"
    ],
    "directory": "/home/user/u-boot",
    "file": "init/board_init.c"
  },
```

---

### Running U-Boot Unit Tests

U-Boot has a test suite that can be run without hardware using `sandbox` (a Linux-hosted U-Boot):

```bash
# Build sandbox target
$ make sandbox_defconfig
$ make -j4

# Run all tests
$ make check
...
test/py/test.py --bd sandbox --build-dir build-sandbox
========================= test session starts ==========================
platform linux -- Python 3.10.12, pytest-7.4.3, pluggy-1.3.0
rootdir: /home/user/u-boot
collecting ... collected 453 items

test/py/tests/test_000_version.py .                              [  0%]
test/py/tests/test_efi_loader.py ..                              [  0%]
test/py/tests/test_env.py .......................                 [  5%]
test/py/tests/test_fat.py .............                          [  7%]
test/py/tests/test_fit.py .....                                  [  8%]
...
==================== 441 passed, 12 skipped in 187.34s ====================
```

The `sandbox` target compiles U-Boot as a Linux process, allowing tests to run on your development machine without any ARM hardware.

---

## Interview Questions
{:.gc-iq}

**1. What is the difference between MLO and u-boot.img?**

`MLO` is the SPL (Secondary Program Loader) binary with an AM335x-specific GP header prepended. It is the first software that BootROM loads on TI AM335x SoCs. Its job is to initialize DRAM and load U-Boot proper. `u-boot.img` is U-Boot proper wrapped in a legacy uImage header (4-byte magic + metadata). SPL reads this file from the boot media and loads it into DRAM. They are two separate programs: MLO ~96 KB running in SRAM, u-boot.img ~500 KB running in DRAM.

**2. How does U-Boot Kconfig differ from Linux Kconfig?**

The Kconfig language and tools are identical. The difference is in what is configured. U-Boot Kconfig is used for a much smaller codebase with different subsystems (boot media, bootloader commands, environment storage). Unlike Linux, U-Boot still has a hybrid configuration system where some settings are in `.config` (Kconfig) and some are in C header files (`include/configs/BOARD.h`). The migration from `#define`-based config headers to pure Kconfig is still in progress for many boards.

**3. What is CONFIG_SYS_TEXT_BASE and why does it matter?**

`CONFIG_SYS_TEXT_BASE` is the DRAM address where the linker places U-Boot's `.text` section. The linker uses this as the base address when computing all absolute addresses in the binary (function pointers, vtables, global variable addresses). SPL must load U-Boot to exactly this address. If there is a mismatch, all absolute addresses in U-Boot will be wrong and it will crash immediately after SPL jumps to it. On AM335x it is typically `0x80800000`.

**4. What is a FIT image and what are its advantages over uImage?**

A FIT (Flattened Image Tree) image is a single binary file, described using device tree syntax, that contains multiple components: kernel, DTB, initrd, and firmware. Advantages over the legacy uImage format: it supports multiple configurations in one file (different kernels or DTBs for different board revisions); it supports cryptographic signing of individual components with RSA keys (enabling secure boot); it uses hash verification (SHA256) for integrity checking; it can contain compressed components; and it is extensible without modifying the mkimage tool.

**5. How do you port U-Boot to a new board?**

The minimum steps are: (1) Create `configs/myboard_defconfig` with `CONFIG_TARGET_MYBOARD=y` and essential options. (2) Create `board/myvendor/myboard/` directory with `board.c` (board_init_f, dram_init functions) and `Makefile`. (3) Create `include/configs/myboard.h` for any remaining `#define` settings. (4) Add a Kconfig entry in `board/myvendor/Kconfig` and the main `arch/arm/Kconfig`. (5) Add to `MAINTAINERS` file. For SPL, write the DRAM initialization code specific to the DDR chips and SoC DDR controller on your board.

**6. How do you persist environment variables in U-Boot?**

Run `saveenv` in the U-Boot shell. This writes the current in-memory environment to the storage location configured by `CONFIG_ENV_IS_IN_*`. The environment is stored as null-separated `key=value` pairs with a CRC32 checksum. On next boot, if the CRC is valid, the saved environment is loaded. If not (first boot or corruption), the compiled-in default environment is used. For MMC storage, `CONFIG_ENV_OFFSET` specifies the byte offset on the raw MMC device where the environment block lives.

---

## References
{:.gc-ref}

- U-Boot README: [https://source.denx.de/u-boot/u-boot/-/blob/master/README](https://source.denx.de/u-boot/u-boot/-/blob/master/README)
- U-Boot documentation directory: `doc/` in the U-Boot source tree
- "Mastering Embedded Linux Programming" — Chris Simmonds, Chapter 3
- U-Boot GitLab repository: [https://source.denx.de/u-boot/u-boot](https://source.denx.de/u-boot/u-boot)
- "Building Embedded Linux Systems" — Karim Yaghmour, Chapter 5
- Das U-Boot documentation: [https://u-boot.readthedocs.io/en/latest/](https://u-boot.readthedocs.io/en/latest/)
- U-Boot driver model documentation: `doc/driver-model/` in source tree
- FIT image documentation: `doc/uImage.FIT/` in source tree
