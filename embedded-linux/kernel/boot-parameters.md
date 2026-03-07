---
layout: guide
title: "Boot Parameters"
description: "Understand and configure the Linux kernel command line — from essential root and console parameters to NFS boot, Device Tree integration, and custom parameter registration."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 07"
phase: embedded-linux-kernel
permalink: /embedded-linux/kernel/boot-parameters/
prev_topic:
  title: "Kernel Compilation"
  url: /embedded-linux/kernel/kernel-compilation/
next_topic:
  title: "Kernel Subsystems"
  url: /embedded-linux/kernel/kernel-subsystems/
---

## What Is the Kernel Command Line?
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

The kernel command line is a string of parameters passed to the Linux kernel at boot time. It controls fundamental boot behavior: which device contains the root filesystem, which serial port to use for console output, what init process to launch, and hundreds of other options.

The command line is passed by the bootloader. In U-Boot, it is stored in the `bootargs` environment variable. The kernel reads it very early in the boot process, before most subsystems are initialized.

```bash
# View the kernel command line on a running system
$ cat /proc/cmdline
root=/dev/mmcblk0p2 rootwait rootfstype=ext4 console=ttyS0,115200 rw quiet

# The bootloader passed this string to the kernel
# Each space-separated token is one parameter
```

The kernel passes the command line through the entire boot process. Any parameter that is not recognized by the kernel core is either passed to specific subsystems or saved for later processing by init.

---

### Essential Parameters

#### root= — Specifying the Root Filesystem Device

The `root=` parameter tells the kernel where to find the root filesystem to mount after the initial boot sequence:

```
# Common root= values:

# MMC/SD card partition (eMMC)
root=/dev/mmcblk0p2      # Second partition of first MMC device
root=/dev/mmcblk1p1      # First partition of second MMC device

# SATA/USB disk
root=/dev/sda2            # Second partition of first SATA/USB disk

# NFS root (network boot)
root=/dev/nfs

# initramfs (built into kernel)
root=/dev/ram0

# NAND flash with UBI
root=ubi0:rootfs          # UBI volume named "rootfs"
```

#### rootfstype= — Filesystem Type

```
rootfstype=ext4           # ext4 (most common on SD cards and eMMC)
rootfstype=squashfs       # read-only compressed (good for embedded ROM)
rootfstype=ubifs          # UBI filesystem for raw NAND flash
rootfstype=jffs2          # older NAND filesystem
rootfstype=nfs            # for network root
```

#### console= — Serial Console

The `console=` parameter connects kernel messages and the kernel's console to a specific device:

```
console=ttyS0,115200      # Standard UART (8250), 115200 baud
console=ttyS0,115200n8    # Explicit: 115200 baud, No parity, 8 bits
console=ttyAMA0,115200    # ARM PL011 UART (Raspberry Pi, Versatile)
console=ttymxc0,115200    # i.MX6 UART
console=ttyO0,115200      # OMAP UART
console=tty0              # VGA console (if you have a display)
console=tty1              # Second VGA console
```

You can specify multiple `console=` parameters to send output to multiple destinations:

```
console=ttyS0,115200 console=tty0
```

#### init= — Init Process

```
init=/sbin/init           # Default (SysV init or systemd via symlink)
init=/bin/sh              # Boot directly to a shell (emergency/debug mode)
init=/sbin/busybox sh     # BusyBox shell (common in minimal embedded systems)
```

#### rw / ro — Root Mount Mode

```
rw    # Mount root filesystem read-write (normal operation)
ro    # Mount root filesystem read-only (safer for power-fail scenarios)
      # Useful for flash-based systems to prevent filesystem corruption
```

---

### A Complete Minimal Command Line

```bash
# Typical embedded system boot command line
root=/dev/mmcblk0p2 rootwait rootfstype=ext4 console=ttyS0,115200 rw

# What each parameter does:
# root=/dev/mmcblk0p2   - root is the 2nd partition of the eMMC
# rootwait              - wait indefinitely for the root device to appear
# rootfstype=ext4       - mount as ext4 (skip auto-detection for speed)
# console=ttyS0,115200  - serial console on UART0 at 115200 baud
# rw                    - mount root read-write
```

---

### Setting bootargs in U-Boot

```bash
# In U-Boot interactive console:

# Set bootargs environment variable
=> setenv bootargs 'root=/dev/mmcblk0p2 rootwait console=ttyAMA0,115200 rw'

# Verify it was set
=> printenv bootargs
bootargs=root=/dev/mmcblk0p2 rootwait console=ttyAMA0,115200 rw

# Save to persistent storage (NAND/eMMC/SPI flash)
=> saveenv
Saving Environment to MMC... Writing to MMC(0)... OK

# Boot the kernel (the bootloader passes bootargs to the kernel automatically)
=> bootz ${loadaddr} - ${fdtaddr}

# Or set bootargs and boot in one command
=> setenv bootargs 'root=/dev/mmcblk0p2 rootwait console=ttyAMA0,115200 rw quiet' && bootz ${loadaddr} - ${fdtaddr}
```

---

## Console and Debug Parameters
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### console= Syntax in Detail

The full syntax for `console=` is:

```
console=<device>,<options>

# <options> format: <baud><parity><bits><flowcontrol>
# parity: n (none), e (even), o (odd)
# bits: 5, 6, 7, 8
# flowcontrol: r (RTS), omit for none

console=ttyS0,115200n8    # 115200 baud, no parity, 8 bits (most common)
console=ttyS1,9600o7      # 9600 baud, odd parity, 7 bits (rare legacy)
```

Common UART device names by platform:

| Driver | Device | Platform |
|--------|--------|---------|
| 8250/16550 | `ttyS0`, `ttyS1` | x86, many embedded |
| PL011 | `ttyAMA0`, `ttyAMA1` | ARM Versatile, RPi, STM32MP1 |
| i.MX | `ttymxc0`, `ttymxc1` | NXP i.MX6/8 |
| OMAP | `ttyO0`, `ttyO1` | TI AM335x, AM57xx |
| Exynos | `ttySAC0` | Samsung Exynos |
| DW UART | `ttyS0` (via 8250-dw) | Allwinner, Rockchip |

---

### earlycon — Console Before Full Driver Init

The regular `console=` only works after the kernel has initialized the UART driver, which happens relatively late in boot. `earlycon` gives you console output from the very beginning of the kernel boot, using hardcoded register addresses:

```
# earlycon with explicit base address (most reliable)
earlycon=pl011,0x10009000           # PL011 at a specific address
earlycon=uart8250,mmio32,0x1c090000 # 8250 MMIO at address

# earlycon from Device Tree (kernel reads UART address from DT)
earlycon

# Combined: earlycon for early messages + regular console after init
earlycon=pl011,0x10009000 console=ttyAMA0,115200

# On ARM, earlycon often uses the chosen node in Device Tree
# if the DT specifies stdout-path = "uart0:115200n8";
```

```bash
# With earlycon, you see output immediately after the kernel decompresses:
[    0.000000] Booting Linux on physical CPU 0x0
[    0.000000] Linux version 6.1.55 (user@build) (arm-linux-gnueabihf-gcc)
[    0.000000] CPU: ARMv7 Processor [410fc090] revision 0 (ARMv7), cr=10c5387d
[    0.000000] CPU: PIPT / VIPT nonaliasing data cache, VIPT aliasing instr cache
```

---

### Log Level Parameters

```
# quiet: suppress most kernel messages (only KERN_WARNING and above)
quiet

# loglevel=N: set console log level (0-7)
# Messages with level < N are printed to console
loglevel=0    # Only KERN_EMERG (critical failures only)
loglevel=4    # KERN_WARNING and more severe (common for production)
loglevel=7    # All messages including KERN_DEBUG (development)
loglevel=8    # All messages

# debug: equivalent to loglevel=8, enables all kernel debug messages
# WARNING: produces enormous output, use only when debugging
debug

# ignore_loglevel: print ALL messages regardless of log level setting
# Use for debugging early boot issues where normal loglevel suppresses output
ignore_loglevel
```

---

### rootdelay= and rootwait

```
# rootdelay=N: wait N seconds before trying to mount root
# Deprecated, use rootwait instead
rootdelay=5

# rootwait: wait indefinitely for the root device to appear
# Essential for USB, SD card, and network devices that take time to enumerate
# Without rootwait, the kernel may give up before the device is ready:
# [    2.847382] VFS: Cannot open root device "sda2" or unknown-block(8,2)
# [    2.847390] Please append a correct "root=" boot option
rootwait

# rootwait with a timeout (kernel 5.15+)
rootwait=10   # Wait up to 10 seconds
```

---

### NAND Flash Boot Parameters

Raw NAND flash uses MTD (Memory Technology Device) subsystem with UBI (Unsorted Block Images):

```
# NAND root with UBI + UBIFS
ubi.mtd=2 ubi.volume=rootfs root=ubi0:rootfs rootfstype=ubifs

# Breaking it down:
# ubi.mtd=2        - attach MTD device 2 as UBI
# ubi.volume=rootfs - the UBI volume name for root
# root=ubi0:rootfs  - root from UBI device 0, volume "rootfs"
# rootfstype=ubifs  - mount as UBIFS

# Check MTD devices on a running system
$ cat /proc/mtd
dev:    size   erasesize  name
mtd0: 00200000 00020000 "u-boot"
mtd1: 00100000 00020000 "u-boot-env"
mtd2: 00600000 00020000 "kernel"
mtd3: 1f100000 00020000 "rootfs"
```

---

### Kernel Panic Behavior

```
# panic=N: reboot N seconds after a kernel panic (0 = don't reboot)
panic=5         # Reboot after 5 seconds (good for production systems)
panic=0         # Don't reboot, freeze (good for debugging)
panic=-1        # Reboot immediately

# oops=panic: treat oops (non-fatal errors) as panics (strict mode)
oops=panic
```

---

### Network Boot Parameters

```
# ip= parameter: configure networking for NFS root or network-only use
ip=dhcp                              # DHCP (most common)
ip=autoconf                          # RARP/BOOTP/DHCP
ip=192.168.1.100::192.168.1.1:255.255.255.0:myboard:eth0:off
# Format: ip=<client-IP>:<server-IP>:<gateway-IP>:<netmask>:<hostname>:<device>:<autoconf>

# nfsroot: root filesystem over NFS
nfsroot=192.168.1.1:/srv/nfs/rootfs
nfsroot=192.168.1.1:/srv/nfs/rootfs,v3,tcp

# Full NFS root command line example:
root=/dev/nfs nfsroot=192.168.1.1:/srv/nfs/myboard ip=dhcp console=ttyS0,115200 rw
```

---

## Advanced Parameters
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Device Tree chosen Node and bootargs

In Device Tree-based systems, the bootloader can also set the kernel command line through the `chosen` node. The kernel merges the DT `bootargs` property with any command line passed directly:

```dts
/* Device Tree Source — board.dts */
/ {
    chosen {
        /* Kernel command line embedded in DT */
        bootargs = "console=ttyAMA0,115200 rootfstype=ext4 rw";

        /* stdout-path tells earlycon which UART to use */
        stdout-path = "uart0:115200n8";

        /* The kernel can load initramfs from DT */
        linux,initrd-start = <0x82000000>;
        linux,initrd-end   = <0x82800000>;
    };
};
```

```bash
# U-Boot can update the chosen/bootargs property at runtime
# using the fdt command:
=> fdt addr ${fdtaddr}
=> fdt set /chosen bootargs "root=/dev/mmcblk0p2 rootwait console=ttyAMA0,115200 rw"
=> bootz ${loadaddr} - ${fdtaddr}

# The kernel reads bootargs from the chosen node during early boot
# If both DT bootargs and U-Boot bootargs exist, U-Boot's value takes precedence
# (U-Boot writes its bootargs env variable into the DT before booting)
```

---

### Memory Layout Parameters

```
# mem=: limit how much memory the kernel uses
# Useful for testing with less RAM or reserving memory for hardware
mem=256M         # Pretend only 256MB RAM exists

# memmap=: reserve or map specific memory ranges
memmap=64M$512M  # Reserve 64MB starting at physical address 512MB
                 # Format: size$start

# cma=: size of Contiguous Memory Allocator pool (for DMA)
# Graphics, video codecs, and camera ISPs often need large contiguous buffers
cma=128M

# hugepages: pre-allocate huge pages for applications that need them
hugepages=32     # 32 x 2MB = 64MB of huge pages
hugepagesz=2M
```

---

### CPU and SMP Parameters

```
# maxcpus=N: limit number of CPUs used at boot
# (remaining CPUs can be hot-plugged later)
maxcpus=1        # Boot with only one CPU (debugging SMP issues)
maxcpus=2

# nr_cpus=N: hard limit — CPUs above this are never used even if hotplugged
nr_cpus=4

# Disable SMP entirely (single CPU mode)
nosmp

# isolcpus: isolate CPUs from normal scheduling (for real-time tasks)
isolcpus=2,3     # CPUs 2 and 3 are reserved for RT tasks only
```

---

### Security and Hardening Parameters

```
# KASLR (Kernel Address Space Layout Randomization)
# Randomizes kernel memory layout to make exploits harder
# Enabled by default in modern kernels; disable for debugging
nokaslr          # Disable KASLR (makes kernel addresses predictable for debugging)

# SELinux
selinux=0        # Disable SELinux enforcement
selinux=1        # Enable SELinux (requires policy in rootfs)

# AppArmor
apparmor=0       # Disable AppArmor
apparmor=1       # Enable AppArmor

# Kernel audit subsystem
audit=0          # Disable kernel audit (saves overhead on embedded)
audit=1          # Enable kernel audit

# Stack protector (if compiled in with CONFIG_STACKPROTECTOR)
# Cannot be disabled at runtime — must be controlled at compile time

# Disable speculative execution mitigations (for performance testing only)
nospectre_v2
nopti            # Disable page table isolation (Meltdown mitigation)
```

---

### Complete Documentation Reference

The authoritative reference for all kernel parameters is:

```bash
# In the kernel source tree
$ wc -l Documentation/admin-guide/kernel-parameters.txt
2847 Documentation/admin-guide/kernel-parameters.txt

# Search for a specific parameter
$ grep -A5 "^	rootwait" Documentation/admin-guide/kernel-parameters.txt
	rootwait	[KNL] Wait (indefinitely) for root device to show up.
			Useful for devices that are detected asynchronously
			(e.g. USB and MMC devices). Parameter value is
			optional, and if omitted, kernel will wait
			indefinitely. If a value is given, it will be used
			as the wait timeout (in seconds).

# On a running system, see what parameters are recognized
$ cat /sys/module/*/parameters/* 2>/dev/null | head -20
```

---

### Adding Custom Kernel Parameters with __setup()

When you write a kernel subsystem or driver that needs its own boot parameter, use the `__setup()` macro:

```c
/* my_driver/mydevice.c */

#include <linux/init.h>
#include <linux/string.h>
#include <linux/printk.h>

static unsigned int mydevice_debug_level = 0;
static char mydevice_mode[32] = "normal";

/* Handler called when "mydevice.debug=" is found in cmdline */
static int __init mydevice_debug_setup(char *str)
{
    if (kstrtouint(str, 10, &mydevice_debug_level) != 0)
        return 0;  /* parse failed */
    pr_info("mydevice: debug level set to %u\n", mydevice_debug_level);
    return 1;  /* 1 = successfully consumed the parameter */
}
/* Register "mydevice.debug=N" as a kernel boot parameter */
__setup("mydevice.debug=", mydevice_debug_setup);

static int __init mydevice_mode_setup(char *str)
{
    strlcpy(mydevice_mode, str, sizeof(mydevice_mode));
    pr_info("mydevice: mode set to '%s'\n", mydevice_mode);
    return 1;
}
__setup("mydevice.mode=", mydevice_mode_setup);

/* These can now be used in the command line:
 * mydevice.debug=3 mydevice.mode=turbo
 */
```

For module parameters that also work as boot parameters (when the driver is built-in):

```c
#include <linux/moduleparam.h>

static int debug = 0;
module_param(debug, int, 0644);
MODULE_PARM_DESC(debug, "Enable debug output (0=off, 1=on)");

/* When built as module: modprobe mydevice debug=1
 * When built-in: kernel cmdline: mydevice.debug=1
 */
```

---

## Interview Questions
{:.gc-iq}

**Q: What is the root= kernel parameter and what values can it take?**

`root=` specifies the block device containing the root filesystem. Common values include: `/dev/mmcblk0p2` (second partition of the first MMC/eMMC device), `/dev/sda1` (first partition of a SATA or USB disk), `/dev/nfs` (network filesystem via NFS), `ubi0:rootfs` (UBI volume on NAND flash), and `/dev/ram0` (initramfs in RAM). The value can also use the `PARTUUID=` or `UUID=` form to identify partitions by UUID rather than device name, which is more robust when device enumeration order changes.

**Q: What is the difference between rootwait and rootdelay?**

`rootdelay=N` causes the kernel to sleep for exactly N seconds before attempting to mount the root filesystem — it always waits that long even if the device appears in 1 second. `rootwait` tells the kernel to poll continuously and proceed as soon as the root device appears, with no fixed timeout (kernel 5.15+ supports `rootwait=N` for a maximum wait time). `rootwait` is the preferred modern approach because it is faster (no unnecessary delay) and more reliable for devices like USB and SD cards that have unpredictable enumeration time.

**Q: How do you enable early console output on a serial port?**

Use the `earlycon=` parameter, which activates the serial port before the full UART driver is initialized. For a PL011 UART at a known physical address: `earlycon=pl011,0x10009000`. For Device Tree-based systems that define `stdout-path` in the `chosen` node, simply `earlycon` (no arguments) is sufficient — the kernel reads the UART address from the DT. Combine it with `console=ttyAMA0,115200` to get both early boot messages and the regular console: `earlycon=pl011,0x10009000 console=ttyAMA0,115200`.

**Q: How does the Device Tree's chosen node relate to kernel parameters?**

The `chosen` node in the Device Tree (under the root `/` node) contains a `bootargs` property that the kernel reads as additional kernel command line parameters. U-Boot typically writes its `bootargs` environment variable into the DT's `chosen/bootargs` before booting, so the DT `bootargs` reflects the bootloader's choice. The `stdout-path` property in `chosen` tells the kernel (and earlycon) which UART to use for early console output, allowing the kernel to find the console without needing explicit address information in the command line.

**Q: What parameters would you use for an NFS root filesystem boot?**

```
root=/dev/nfs nfsroot=192.168.1.1:/srv/nfs/myboard,v3,tcp ip=dhcp console=ttyS0,115200 rw
```
`root=/dev/nfs` tells the VFS to use NFS as root. `nfsroot=<server-IP>:<export-path>` specifies the NFS server and exported directory. `ip=dhcp` (or a static IP) configures the network interface early enough for NFS to work before init runs. `v3,tcp` selects NFS version 3 over TCP for reliability. On the server side, the path must be exported in `/etc/exports` and `rpcbind`/`nfs-kernel-server` must be running.

**Q: How do you add a custom kernel boot parameter in your own kernel module?**

Use the `__setup()` macro for subsystems or built-in drivers. Define a setup function with signature `int __init myfunc(char *str)` that parses the string after the `=` sign and returns 1 on success. Pass the parameter name (including `=`) and the function to `__setup("mydriver.param=", myfunc)`. The function is called before `module_init()` runs. For loadable modules, use `module_param(varname, type, permissions)` which also becomes a kernel cmdline parameter when the module is compiled in (using the `modulename.paramname=value` syntax).

---

## References
{:.gc-ref}

- **Linux kernel parameter reference:** `Documentation/admin-guide/kernel-parameters.txt` in the kernel source — the definitive list of all recognized parameters
- **"Mastering Embedded Linux Programming" by Chris Simmonds** — U-Boot bootargs, NFS root, and practical embedded boot scenarios
- **Serial console documentation:** `Documentation/admin-guide/serial-console.rst` — console= syntax and multiple console support
- **earlycon documentation:** `Documentation/admin-guide/earlyprintk.rst` — early console setup before driver initialization
- **Device Tree chosen node:** `Documentation/devicetree/booting-without-of.txt` — how the bootloader communicates with the kernel via DT
- **NFS root documentation:** `Documentation/admin-guide/nfs/nfsroot.rst` — complete NFS root boot setup guide
