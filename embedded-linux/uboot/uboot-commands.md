---
layout: guide
title: "U-Boot Commands & Scripting"
description: "Master the U-Boot shell: environment variables, memory commands, boot commands, TFTP and MMC loading, and scripting complex boot logic for automated and production use."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 06"
phase: embedded-linux-uboot
permalink: /embedded-linux/uboot/uboot-commands/
prev_topic:
  title: "U-Boot Config & Build"
  url: /embedded-linux/uboot/uboot-config-build/
next_topic:
  title: "Device Tree (DTS)"
  url: /embedded-linux/uboot/device-tree/
---

## The U-Boot Shell: First Commands and Environment Variables
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

When U-Boot starts, it counts down an autoboot timer. If you press any key during the countdown, you drop into the interactive shell. This is your primary tool for diagnosing boot problems, manually loading images, and adjusting boot configuration.

### The Autoboot Countdown and Shell Prompt

```
U-Boot 2023.10 (Oct 15 2023 - 12:34:56 +0000)

CPU  : AM335X-GP rev 2.1
Model: TI AM335x BeagleBone Black
DRAM : 512 MiB
MMC:   OMAP SD/MMC: 0, OMAP SD/MMC: 1
Loading Environment from MMC... OK
Net:   eth0: ethernet@4a100000
Hit any key to stop autoboot:  3  2  1  0

(press Enter to interrupt)

=>
```

The `=>` is the U-Boot prompt. On some boards it may differ (e.g., `BeagleBone#` if `CONFIG_SYS_PROMPT` was customized).

The countdown duration is set by `CONFIG_BOOTDELAY` (default 2 seconds) and the `bootdelay` environment variable:
```bash
=> printenv bootdelay
bootdelay=2

# Change to 5 seconds
=> setenv bootdelay 5
=> saveenv
Saving Environment to MMC... Writing to MMC(0)... OK
```

---

### The help Command

```bash
# List all available commands
=> help
?         - alias for 'help'
base      - print or set address offset
bdinfo    - print Board Info structure
boot      - boot default, i.e., run 'bootcmd'
bootd     - boot default, i.e., run 'bootcmd'
bootm     - boot application image from memory
bootp     - boot image via network using BOOTP/TFTP protocol
bootz     - boot Linux zImage image from memory
booti     - boot Linux kernel Image from memory
clocks    - display clocks
cmp       - memory compare
cp        - memory copy
crc32     - checksum calculation
dhcp      - boot image via network using DHCP/TFTP protocol
echo      - echo args to console
env       - environment handling commands
exit      - exit script
ext4load  - load binary file from a Ext4 filesystem
ext4ls    - list files in a directory (default /)
fatinfo   - print information about filesystem
fatload   - load binary file from a dos filesystem
fatls     - list files in a directory (default /)
fdt       - flattened device tree utility commands
go        - start application at address 'addr'
help      - print command description/usage
i2c       - I2C sub-system
loadb     - load binary file over serial line (kermit mode)
loads     - load S-Record file over serial line
loadx     - load binary file over serial line (xmodem mode)
loady     - load binary file over serial line (ymodem mode)
md        - memory display
mm        - memory modify (auto-incrementing address)
mmc       - MMC sub-system
mmcinfo   - display MMC info
mw        - memory write (fill)
net       - NET sub-system
nfs       - boot image via network using NFS protocol
nm        - memory modify (constant address)
ping      - send ICMP ECHO_REQUEST to network host
printenv  - print environment variables
reset     - Perform RESET of the CPU
run       - run commands in an environment variable
saveenv   - save environment variables to persistent storage
setenv    - set environment variables
sf        - SPI flash sub-system
size      - determine a file's size
sleep     - delay execution for some time
source    - run script from memory
tftp      - load file using TFTP protocol
usb       - USB sub-system
version   - print monitor, compiler and linker version

# Get help on a specific command
=> help fatload
fatload - load binary file from a dos filesystem

Usage:
fatload <interface> [<dev[:part]> [<addr> [<filename> [bytes [pos]]]]]
    - Load binary file 'filename' from 'dev' on 'interface'
      to address 'addr' from dos filesystem.
      'pos' gives the file position to start loading from.
      If 'pos' is omitted, 0 is assumed. size is returned in variable filesize.
```

---

### Environment Variables: printenv, setenv, saveenv

The U-Boot environment is a persistent key=value store. Environment variables control boot behavior.

```bash
# Print all environment variables
=> printenv
arch=arm
baudrate=115200
board=am335x
board_name=A335BNLT
bootcmd=run findfdt; run distro_bootcmd
bootdelay=2
bootfile=zImage
cpu=armv7
ethaddr=c8:a0:30:b1:c2:d3
fdt_addr_r=0x88000000
fdtcontroladdr=8ef7ef10
fdtfile=am335x-boneblack.dtb
ipaddr=192.168.1.100
kernel_addr_r=0x82000000
ramdisk_addr_r=0x88080000
serverip=192.168.1.1
soc=am33xx
vendor=ti
Environment size: 812/131068 bytes

# Print a single variable
=> printenv bootcmd
bootcmd=run findfdt; run distro_bootcmd

# Set a variable
=> setenv myvar hello_world
=> printenv myvar
myvar=hello_world

# Set a variable with spaces (use quotes)
=> setenv bootargs "console=ttyO0,115200n8 root=/dev/mmcblk0p2 rw"
=> printenv bootargs
bootargs=console=ttyO0,115200n8 root=/dev/mmcblk0p2 rw

# Delete a variable
=> setenv myvar
=> printenv myvar
## Error: "myvar" not defined

# Save environment to flash
=> saveenv
Saving Environment to MMC... Writing to MMC(0)... OK
```

---

### Memory Commands: md, mw, cp

These commands let you read and write physical memory directly — essential for debugging hardware registers.

```bash
# Memory display (md) — display memory in hex+ASCII
# md[.b|.w|.l|.q] address [count]
# .b = byte, .w = word (16-bit), .l = long (32-bit), .q = quadword (64-bit)

=> md.l 0x44e09000 8
44e09000: 00004000 00000000 00000000 00000000    .@..............
44e09010: 00000000 00000000 00000000 00000000    ................

# UART0 base on AM335x is 0x44E09000
# Read UART LSR (Line Status Register) at offset 0x14
=> md.l 0x44e09014 1
44e09014: 00000060    `...
# Bit 5 = 1: TX holding register empty
# Bit 6 = 1: TX shift register empty

# Memory write (mw) — write a value to memory
# mw[.b|.w|.l] address value [count]
=> mw.l 0x82000000 0xdeadbeef
=> md.l 0x82000000 1
82000000: deadbeef    ....

# Fill 16 bytes with 0
=> mw.b 0x82000000 0x00 16
=> md.b 0x82000000 16
82000000: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00    ................

# Memory copy (cp)
# cp[.b|.w|.l] source destination count
=> cp.l 0x82000000 0x83000000 0x100000
```

---

### Loading Files: fatload and ext4load

```bash
# fatload: load a file from a FAT partition
# fatload <interface> <dev:part> <load_addr> <filename>

# Load kernel from MMC device 0, partition 1, FAT filesystem
=> fatload mmc 0:1 0x82000000 zImage
reading zImage
6016704 bytes read in 428 ms (13.4 MiB/s)

# Load DTB
=> fatload mmc 0:1 0x88000000 am335x-boneblack.dtb
reading am335x-boneblack.dtb
43056 bytes read in 9 ms (4.6 MiB/s)

# List files on FAT partition
=> fatls mmc 0:1
 6016704   zImage
   43056   am335x-boneblack.dtb
   20480   extlinux/extlinux.conf

# ext4load: load from ext4 partition
# ext4load <interface> <dev:part> <addr> <filename>
=> ext4load mmc 0:2 0x82000000 /boot/zImage
6016704 bytes read in 445 ms (12.9 MiB/s)

# List ext4 directory
=> ext4ls mmc 0:2 /boot
<DIR>       4096 .
<DIR>       4096 ..
            6016704 zImage
              43056 am335x-boneblack.dtb
```

---

### The bdinfo Command

`bdinfo` (board info) displays the board's memory map and boot parameters as U-Boot sees them:

```bash
=> bdinfo
boot_params = 0x80000100
DRAM bank   = 0x00000000
-> start    = 0x80000000
-> size     = 0x20000000
flashstart  = 0x00000000
flashsize   = 0x00000000
flashoffset = 0x00000000
baudrate    = 115200 bps
relocaddr   = 0x8ff08000
reloc off   = 0x0f708000
Build       = 32-bit
current eth = ethernet@4a100000
ethaddr     = c8:a0:30:b1:c2:d3
IP addr     = 192.168.1.100
fdt_blob    = 0x8ef7ef10
new_fdt     = 0x00000000
fdt_size    = 0x00000000
lmb_dump_all:
 memory.cnt = 0x1
 memory[0]  [0x80000000-0x9fffffff], 0x20000000 bytes flags: 0
 reserved.cnt = 0x1
 reserved[0] [0x8ef7e8f0-0x9fffffff], 0x11081710 bytes flags: 0
```

This shows: total DRAM is `0x20000000` = 512 MB; U-Boot relocated itself to `0x8ff08000`; available memory for loading is from `0x80000000` to `0x8ef7e8ef`.

---

### Basic Manual Boot Sequence

Here is a complete manual boot from SD card, step by step:

```bash
# Step 1: Verify MMC is available
=> mmc list
OMAP SD/MMC: 0 (SD)
OMAP SD/MMC: 1 (eMMC)

# Step 2: Load kernel image into DRAM
=> fatload mmc 0:1 0x82000000 zImage
6016704 bytes read in 428 ms (13.4 MiB/s)

# Step 3: Load the Device Tree Blob
=> fatload mmc 0:1 0x88000000 am335x-boneblack.dtb
43056 bytes read in 9 ms (4.6 MiB/s)

# Step 4: Set kernel boot arguments
=> setenv bootargs "console=ttyO0,115200n8 root=/dev/mmcblk0p2 rw rootfstype=ext4 rootwait"

# Step 5: Boot the kernel (bootz for zImage)
=> bootz 0x82000000 - 0x88000000
Kernel image @ 0x82000000 [ 0x000000 - 0x5bfe00 ]
## Flattened Device Tree blob at 88000000
   Booting using the fdt blob at 0x88000000
   Loading Device Tree to 8ffed000, end 8ffff... OK

Starting kernel ...

[    0.000000] Booting Linux on physical CPU 0x0
[    0.000000] Linux version 6.1.46 (gcc version 12.3.0)
```

The `-` in `bootz 0x82000000 - 0x88000000` means "no initrd".

---

## MMC Boot, TFTP, Scripting, and Boot Commands
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### MMC Commands in Detail

```bash
# List all MMC devices
=> mmc list
OMAP SD/MMC: 0 (SD)
OMAP SD/MMC: 1 (eMMC)

# Select MMC device 0 (SD card)
=> mmc dev 0
switch to partitions #0, OK
mmc0(part 0) is current device

# Select device 1 partition 1 (eMMC boot partition)
=> mmc dev 1 1
switch to partitions #1, OK
mmc1(part 1) is current device

# Display MMC info
=> mmc info
Device: OMAP SD/MMC
Manufacturer ID: 03
OEM: 5344
Name: SB16G
Bus Speed: 50000000
Mode: SD High Speed (50MHz)
Rd Block Len: 512
SD version 3.0
High Capacity: Yes
Capacity: 14.8 GiB
Bus Width: 4-bit
Erase Group Size: 512 Bytes

# Read raw sector from MMC (for debugging partition tables)
=> mmc read 0x82000000 0 1
MMC read: dev # 0, block # 0, count 1 ... 1 blocks read: OK

# Display the MBR
=> md.b 0x82000000 512
82000000: eb 58 90 4d 53 44 4f 53 35 2e 30 00 02 08 26 00    .X.MSDOS5.0...&.
...
```

---

### TFTP Boot: Loading Kernel Over Network

TFTP (Trivial File Transfer Protocol) is the standard way to load a kernel during development — faster than reflashing SD cards constantly.

```bash
# Step 1: Configure network
=> setenv ethaddr c8:a0:30:b1:c2:d3    # MAC address (if not set from EEPROM)
=> setenv ipaddr 192.168.1.100          # Board's IP address
=> setenv serverip 192.168.1.1          # Development host running TFTP server
=> setenv gatewayip 192.168.1.1
=> setenv netmask 255.255.255.0

# Step 2: Test network connectivity
=> ping 192.168.1.1
Using ethernet@4a100000 device
host 192.168.1.1 is alive

# Step 3: Load kernel via TFTP
=> tftp ${kernel_addr_r} zImage
Using ethernet@4a100000 device
TFTP from server 192.168.1.1; our IP address is 192.168.1.100
Filename 'zImage'.
Load address: 0x82000000
Loading: #################################################################
         #################################################################
         #################################################################
         #################################################################
         7.8 MiB/s
done
Bytes transferred = 6016704 (5bfe00 hex)

# Step 4: Load DTB
=> tftp ${fdt_addr_r} am335x-boneblack.dtb
Bytes transferred = 43056 (a830 hex)

# Step 5: Set bootargs and boot
=> setenv bootargs "console=ttyO0,115200n8 root=/dev/mmcblk0p2 rw rootwait"
=> bootz ${kernel_addr_r} - ${fdt_addr_r}
```

---

### DHCP vs Static IP

```bash
# DHCP: let the server assign an IP automatically
=> dhcp
Using ethernet@4a100000 device
DHCP client bound to address 192.168.1.105 (52 ms)
TFTP from server 192.168.1.1; our IP address is 192.168.1.105
Filename 'zImage'.
Load address: 0x82000000
...

# The dhcp command both gets an IP AND loads a file if bootfile is set
=> setenv bootfile zImage
=> dhcp ${kernel_addr_r}
# This gets IP via DHCP and then downloads the file via TFTP from dhcpserver

# Static IP (more deterministic, better for production debugging)
=> setenv ipaddr 192.168.1.100
=> setenv serverip 192.168.1.1
=> tftp ${kernel_addr_r} zImage
```

---

### Scripting with test, if, then, else

U-Boot has a basic scripting language. The `test` command evaluates conditions.

```bash
# Test if a variable is set
=> if test -n "${myvar}"; then echo "myvar is set"; else echo "myvar not set"; fi
myvar not set

=> setenv myvar hello
=> if test -n "${myvar}"; then echo "myvar is set"; else echo "myvar not set"; fi
myvar is set

# Test string equality
=> setenv bootslot a
=> if test "${bootslot}" = "a"; then echo "booting slot A"; fi
booting slot A

# Test numeric comparison (-eq, -ne, -lt, -gt, -le, -ge)
=> setenv retry 3
=> if test ${retry} -gt 0; then echo "retries left"; fi
retries left
```

---

### The run Command and bootcmd

`run` executes the content of an environment variable as a command. This is how `bootcmd` works:

```bash
# bootcmd is executed automatically after autoboot countdown
=> printenv bootcmd
bootcmd=run findfdt; run distro_bootcmd

# findfdt is another variable that detects the board variant
=> printenv findfdt
findfdt=if test $board_name = A335BNLT; then setenv fdtfile am335x-boneblack.dtb; fi; ...

# Run manually
=> run findfdt
=> printenv fdtfile
fdtfile=am335x-boneblack.dtb

# Create your own boot script in an env variable
=> setenv myboot "tftp ${kernel_addr_r} zImage; tftp ${fdt_addr_r} ${fdtfile}; bootz ${kernel_addr_r} - ${fdt_addr_r}"
=> run myboot
```

---

### bootm vs bootz vs booti

These three commands boot a Linux kernel but handle different kernel image formats:

| Command | Image Type | Typical Filename | Architecture |
|---------|-----------|-----------------|--------------|
| `bootm` | Legacy uImage (mkimage-wrapped) | `uImage` | ARMv5/v6, MIPS, PowerPC |
| `bootz` | Compressed zImage (self-decompressing) | `zImage` | ARM 32-bit |
| `booti` | Uncompressed raw Image | `Image` | ARM64 (AArch64) |

```bash
# bootm syntax: bootm kernel_addr [initrd_addr] [fdt_addr]
=> bootm 0x82000000 - 0x88000000

# bootz syntax: bootz kernel_addr [initrd_addr:size] [fdt_addr]
=> bootz 0x82000000 - 0x88000000

# booti syntax: booti kernel_addr [initrd_addr:size] [fdt_addr]
=> booti 0x40200000 - 0x40000000   # AArch64 typical addresses

# With initrd (ramdisk)
=> bootz 0x82000000 0x88080000:0x1000000 0x88000000
```

For modern 32-bit ARM systems, `bootz` with `zImage` is standard. For 64-bit ARM (Cortex-A53, Cortex-A72, etc.), `booti` with `Image` is standard.

---

### NFS Root: Kernel via TFTP, Root Filesystem via NFS

The most powerful development setup: kernel loaded fresh via TFTP at every boot, root filesystem served over NFS from your development machine (no SD card reflashing ever):

```bash
# Full NFS root setup in bootargs
=> setenv bootargs "console=ttyO0,115200n8 \
    root=/dev/nfs \
    nfsroot=192.168.1.1:/export/rootfs,v3,tcp \
    rw \
    ip=192.168.1.100:192.168.1.1:192.168.1.1:255.255.255.0:bbb:eth0:off \
    rootwait"

# Or simpler with DHCP and NFS autoconfig
=> setenv bootargs "console=ttyO0,115200n8 \
    root=/dev/nfs \
    nfsroot=192.168.1.1:/export/rootfs \
    rw ip=dhcp rootwait"

# Load and boot
=> tftp ${kernel_addr_r} zImage
=> tftp ${fdt_addr_r} am335x-boneblack.dtb
=> bootz ${kernel_addr_r} - ${fdt_addr_r}
```

The `ip=` parameter format is: `client:server:gateway:netmask:hostname:device:autoconf`

---

### mmcboot and netboot Helper Scripts

U-Boot defconfigs often define helper scripts for common boot scenarios:

```bash
# Print all scripts defined in environment
=> printenv mmcboot
mmcboot=mmc dev ${mmcdev}; if mmc rescan; then \
    echo SD/MMC found on device ${mmcdev}; \
    if run loadimage; then \
        if run loadfdt; then \
            echo Booting from mmc ...; \
            run mmcargs; bootz ${loadaddr} - ${fdtaddr}; \
        fi; \
    fi; \
fi

=> printenv netboot
netboot=echo Booting from net ...; \
    setenv ipaddr 192.168.1.100; \
    tftp ${loadaddr} ${bootfile}; \
    tftp ${fdtaddr} ${fdtfile}; \
    run netargs; bootz ${loadaddr} - ${fdtaddr}

# Execute them
=> run mmcboot
=> run netboot
```

---

## FIT Boot, NAND Commands, USB, Advanced Scripting, and distro_bootcmd
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### FIT Image Boot

A FIT image is booted with `bootm` and a configuration selector:

```bash
# Load FIT image
=> tftp ${kernel_addr_r} kernel.itb
Bytes transferred = 6063104 (5c8c00 hex)

# List available configurations in the FIT image
=> iminfo ${kernel_addr_r}
## Checking Image at 82000000 ...
   FIT image found
   FIT description: Linux kernel and FDT blob for BeagleBone Black
   Created:         Sun Oct 15 12:34:56 2023
    Image 0 (kernel)
     Description:  Linux kernel
     Type:         Kernel Image
     Compression:  uncompressed
     Load Address: 0x82000000
     Entry Point:  0x82000000
     Hash algo:    sha256
     Hash value:   a3f8c9e2...  check OK
    Image 1 (fdt-1)
     Description:  BeagleBone Black DTB
     Hash algo:    sha256
     Hash value:   b7d4e1f9...  check OK
   Default Configuration: 'conf-1'
   Configuration 0 (conf-1)
    Description:  BeagleBone Black
    Kernel:       kernel
    FDT:          fdt-1

# Boot the default configuration
=> bootm ${kernel_addr_r}

# Boot a specific configuration
=> bootm ${kernel_addr_r}#conf-1

# Boot with a custom DTB from the FIT, overriding with a separate DTB
=> bootm ${kernel_addr_r}#conf-1 - ${fdt_addr_r}
```

---

### USB Commands

```bash
# Initialize USB subsystem
=> usb start
starting USB...
Bus ehci@47401100: USB EHCI 1.00
scanning bus ehci@47401100 for devices...
2 USB Device(s) found
       scanning usb for storage devices... 1 Storage Device(s) found

# Get detailed USB device info
=> usb info
1: Hub,  USB Revision 2.0
   - 0:0: vendor name, etc.
2: Mass Storage,  USB Revision 2.0
   - Kingston DataTraveler

# List USB storage devices
=> usb storage
  Device 0: Vendor: Kingston Rev: 1.00 Prod: DataTraveler
            Type: Removable Hard Disk
            Capacity: 15.3 GB = 15728 MB (32243712 x 512)

# Load from USB drive
=> fatls usb 0:1
 6016704   zImage
   43056   am335x-boneblack.dtb

=> fatload usb 0:1 ${kernel_addr_r} zImage
6016704 bytes read in 1245 ms (4.6 MiB/s)
```

---

### NAND Commands

```bash
# Get NAND flash info
=> nand info

Device 0: nand0, sector size 128 KiB
  Page size       2048 b
  OOB size          64 b
  Erase size    131072 b
  subpagesize    2048 b
  options     0x40004200
  bbt options 0x00000000

# Read from NAND: nand read addr offset size
# Load U-Boot environment stored at offset 0x200000
=> nand read 0x82000000 0x200000 0x400000
NAND read: device 0 offset 0x200000, size 0x400000
 4194304 bytes read: OK

# Erase a NAND region (must be erase-block aligned)
=> nand erase 0x200000 0x100000
NAND erase: device 0 offset 0x200000, size 0x100000
Erasing at 0x280000 -- 100% complete.
OK

# Write to NAND: nand write addr offset size
=> nand write 0x82000000 0x200000 0x100000
NAND write: device 0 offset 0x200000, size 0x100000
 1048576 bytes written: OK

# Write with ECC (for NAND that uses hardware ECC)
=> nand write.oob 0x82000000 0x200000 0x100000
```

---

### Advanced Boot Scripting: Counter and Retry Logic

Production systems need robust scripting. Here is an A/B boot retry mechanism:

```bash
# A/B boot with retry counter
# Store this in bootcmd via setenv then saveenv

=> setenv bootcmd '
if test ${boot_a_left} -gt 0; then
    setenv boot_a_left $(( ${boot_a_left} - 1 ));
    saveenv;
    echo "Trying slot A (retries left: ${boot_a_left})";
    setenv bootpart 1;
    if fatload mmc 0:${bootpart} ${kernel_addr_r} zImage; then
        if fatload mmc 0:${bootpart} ${fdt_addr_r} ${fdtfile}; then
            bootz ${kernel_addr_r} - ${fdt_addr_r};
        fi;
    fi;
fi;
if test ${boot_b_left} -gt 0; then
    setenv boot_b_left $(( ${boot_b_left} - 1 ));
    saveenv;
    echo "Trying slot B (retries left: ${boot_b_left})";
    setenv bootpart 3;
    if fatload mmc 0:${bootpart} ${kernel_addr_r} zImage; then
        if fatload mmc 0:${bootpart} ${fdt_addr_r} ${fdtfile}; then
            bootz ${kernel_addr_r} - ${fdt_addr_r};
        fi;
    fi;
fi;
echo "All boot slots exhausted, entering recovery";
run recovery_bootcmd'
```

---

### Creating a U-Boot Boot Menu

U-Boot supports an interactive boot menu using `CONFIG_MENU`:

```bash
# Define menu in environment
=> setenv menu_1 "Boot from SD card"
=> setenv menu_2 "Boot from eMMC"
=> setenv menu_3 "Boot via TFTP"
=> setenv menu_4 "U-Boot shell"

=> setenv bootcmd '
echo "";
echo "  *** BOOT MENU ***";
echo "  1. Boot from SD card";
echo "  2. Boot from eMMC";
echo "  3. Boot via TFTP";
echo "  4. U-Boot shell";
echo "";
if askenv choice "Enter choice [1-4]: " 5; then
    if test "${choice}" = "1"; then run sdboot; fi;
    if test "${choice}" = "2"; then run emmcboot; fi;
    if test "${choice}" = "3"; then run netboot; fi;
    if test "${choice}" = "4"; then; fi;
else
    echo "Timeout — booting default";
    run sdboot;
fi'
```

---

### distro_bootcmd: The Standard Boot Mechanism

Modern U-Boot defconfigs use `distro_bootcmd`, a standardized boot sequence that tries multiple boot sources and methods automatically:

```bash
=> printenv distro_bootcmd
distro_bootcmd=for target in ${boot_targets}; do run bootcmd_${target}; done

=> printenv boot_targets
boot_targets=mmc0 mmc1 usb0 pxe dhcp

# U-Boot tries each target in order:
# 1. mmc0: looks for extlinux.conf or EFI on MMC device 0
# 2. mmc1: same for MMC device 1 (eMMC)
# 3. usb0: same for USB drive
# 4. pxe: PXE network boot
# 5. dhcp: DHCP+TFTP boot

# extlinux.conf format (Syslinux-compatible)
# /boot/extlinux/extlinux.conf on the FAT or ext4 partition:
```

```
DEFAULT linux
PROMPT 0
TIMEOUT 10

LABEL linux
    LINUX ../zImage
    FDT ../am335x-boneblack.dtb
    APPEND console=ttyO0,115200n8 root=/dev/mmcblk0p2 rw rootwait
```

---

### U-Boot Python Test Framework

U-Boot includes a pytest-based framework for automated testing. Tests run against the U-Boot sandbox or real hardware via serial connection:

```bash
# Run tests using the sandbox (no hardware)
$ cd u-boot
$ ./test/py/test.py --bd sandbox --build-dir build-sandbox -v

# Run tests against real hardware via serial
$ ./test/py/test.py --bd am335x_evm \
    --build-dir build-am335x \
    --serial-port /dev/ttyUSB0 \
    -v -k "test_env or test_mmc"

# Example output
PASSED tests/test_env.py::test_env_set[0]
PASSED tests/test_env.py::test_env_save[0]
PASSED tests/test_mmc.py::test_mmc_list[0]
PASSED tests/test_mmc.py::test_mmc_fatls[0]
```

Writing a custom test:

```python
# test/py/tests/test_myboot.py
import pytest
import u_boot_utils

@pytest.mark.boardspec('am335x_evm')
def test_my_tftp_boot(u_boot_console):
    """Test TFTP boot sequence"""
    u_boot_console.run_command('setenv ipaddr 192.168.1.100')
    u_boot_console.run_command('setenv serverip 192.168.1.1')
    output = u_boot_console.run_command('ping 192.168.1.1')
    assert 'is alive' in output
    output = u_boot_console.run_command('tftp ${kernel_addr_r} zImage')
    assert 'bytes read' in output or 'bytes transferred' in output
```

---

## Interview Questions
{:.gc-iq}

**1. What is the bootcmd environment variable?**

`bootcmd` is the U-Boot environment variable that contains the boot command string executed automatically after the autoboot countdown expires. It is executed by `run bootcmd`. Typically it is a script that determines the boot source and loads and boots the kernel. Example: `bootcmd=run findfdt; run distro_bootcmd`. You can override it with `setenv bootcmd "your_commands"` followed by `saveenv` to change the default boot behavior persistently.

**2. What is the difference between bootm, bootz, and booti?**

All three boot a Linux kernel but handle different image formats. `bootm` handles the legacy uImage format created by `mkimage -A arm -T kernel -C none`, as well as FIT images — it is the oldest and most general. `bootz` handles ARM 32-bit `zImage` (a self-decompressing kernel), the standard format for 32-bit ARM systems. `booti` handles the uncompressed flat `Image` format used on ARM64 (AArch64) systems. The choice is determined by how the kernel was compiled.

**3. How do you change the default boot arguments (bootargs) permanently?**

Set the `bootargs` environment variable and save it: `setenv bootargs "console=ttyO0,115200n8 root=/dev/mmcblk0p2 rw rootwait"` then `saveenv`. On next boot, U-Boot reads the environment from flash and uses your `bootargs`. Alternatively, on systems using `distro_bootcmd`, the boot arguments may come from the `extlinux.conf` file's `APPEND` line, in which case you edit that file rather than the U-Boot environment.

**4. How do you create an automated boot script in U-Boot?**

Create a script file, convert it to a U-Boot script image with `mkimage`, store it on the boot media, and load+execute it from `bootcmd`. Example: write `boot.scr.uimg` using `mkimage -T script -C none -n boot -d boot.cmd boot.scr.uimg`. In `bootcmd`, add: `fatload mmc 0:1 0x80200000 boot.scr.uimg; source 0x80200000`. The `source` command executes a U-Boot script image from memory. Alternatively, store scripts directly as environment variables and use `run script_name`.

**5. How do you boot a kernel from NAND flash in U-Boot?**

Use `nand read` to copy the kernel from NAND into DRAM, then boot it. Example sequence: `nand read ${kernel_addr_r} 0x00280000 0x00600000` reads 6 MB from NAND offset 0x280000 into DRAM. Then `bootm ${kernel_addr_r}` if it is a uImage, or `bootz ${kernel_addr_r} - ${fdt_addr_r}` if it is a zImage with a separately loaded DTB. The NAND offsets and sizes must match your flash partition layout, typically defined in your kernel's MTD partition table or U-Boot's `CONFIG_MTDPARTS_DEFAULT`.

---

## References
{:.gc-ref}

- U-Boot command reference: [https://u-boot.readthedocs.io/en/latest/usage/](https://u-boot.readthedocs.io/en/latest/usage/)
- "Mastering Embedded Linux Programming" — Chris Simmonds, Chapter 3
- BeagleBone Black U-Boot boot sequence guide: [https://elinux.org/Beagleboard:U-boot](https://elinux.org/Beagleboard:U-boot)
- Das U-Boot Environment Variables documentation: `doc/usage/environment.rst`
- U-Boot distro boot specification: `doc/README.distro`
- U-Boot pytest documentation: `test/py/README.md`
