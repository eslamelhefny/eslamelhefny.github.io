---
layout: guide
title: "Kconfig & menuconfig"
description: "Master the Linux kernel configuration system — from navigating menuconfig to writing Kconfig entries and generating minimal embedded configs."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 07"
phase: embedded-linux-kernel
permalink: /embedded-linux/kernel/kconfig-menuconfig/
prev_topic:
  title: "TFTP & Network Boot"
  url: /embedded-linux/uboot/tftp-boot/
next_topic:
  title: "Kernel Compilation"
  url: /embedded-linux/kernel/kernel-compilation/
---

## What Is Kconfig?
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

The Linux kernel is an enormous codebase with thousands of configurable options. Kconfig is the configuration language and tooling that manages this complexity. Every subsystem, driver, and feature in the kernel has a corresponding `Kconfig` file that declares what options exist, what types they are, what their dependencies are, and what help text to display.

When you run `make menuconfig`, you are interacting with the Kconfig system through a text-based UI. The result of your choices is written to a file named `.config` in the kernel source root. The build system reads `.config` to decide exactly what code to compile.

```bash
# The .config file is just a text file of KEY=VALUE pairs
$ head -30 .config
#
# Automatically generated file; DO NOT EDIT.
# Linux/arm 6.1.55 Kernel Configuration
#
CONFIG_CC_VERSION_TEXT="arm-linux-gnueabihf-gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0"
CONFIG_CC_IS_GCC=y
CONFIG_GCC_VERSION=110400
CONFIG_CLANG_VERSION=0
CONFIG_AS_IS_GNU=y
CONFIG_LD_IS_BFD=y
CONFIG_LD_VERSION=23900
CONFIG_LLD_VERSION=0
CONFIG_CC_CAN_LINK=y
CONFIG_CC_CAN_LINK_STATIC=y
CONFIG_CC_HAS_ASM_GOTO_OUTPUT=y
CONFIG_CC_HAS_ASM_GOTO_TIED_OUTPUT=y
CONFIG_CC_HAS_COUNTED_BY=y
CONFIG_IRQ_WORK=y
CONFIG_BUILDTIME_TABLE_SORT=y
CONFIG_THREAD_INFO_IN_TASK=y
#
# General setup
#
CONFIG_INIT_ENV_ARG_LIMIT=32
# CONFIG_COMPILE_TEST is not set
CONFIG_WERROR=y
# CONFIG_LOCALVERSION_AUTO is not set
CONFIG_LOCALVERSION=""
CONFIG_HAVE_KERNEL_GZIP=y
CONFIG_HAVE_KERNEL_BZIP2=y
```

The `.config` file controls the kernel compilation entirely. Every `CONFIG_FOO=y` line tells the build system to compile that feature into the kernel. Every `# CONFIG_FOO is not set` line means it was explicitly disabled.

---

### Kconfig Option Types

Kconfig supports several option types:

| Type | Values | Description |
|------|--------|-------------|
| `bool` | `y` or `n` | Feature is either compiled in or not |
| `tristate` | `y`, `m`, or `n` | Built-in, loadable module, or disabled |
| `string` | `"text"` | A string value, e.g., local version tag |
| `int` | integer | A numeric value, e.g., buffer size |
| `hex` | `0x...` | A hexadecimal value, e.g., a base address |

The `tristate` type is unique to the kernel. It allows a feature to be compiled directly into the kernel image (`y`), compiled as a separate loadable kernel module (`m`), or completely excluded (`n`). Modules can be loaded at runtime with `modprobe` and unloaded with `rmmod`, which is extremely useful for driver development.

---

### Navigating menuconfig

`make menuconfig` opens an ncurses-based text UI that is the most commonly used Kconfig front-end.

```bash
# Start menuconfig for a native x86 build
$ make menuconfig

# For cross-compilation targeting ARM 32-bit
$ make ARCH=arm menuconfig

# For cross-compilation targeting AArch64
$ make ARCH=arm64 menuconfig
```

Key bindings in menuconfig:

| Key | Action |
|-----|--------|
| Arrow keys | Navigate menus |
| Enter | Enter submenu or toggle |
| Space | Toggle option (y/m/n cycle) |
| `/` | Search for a config symbol by name |
| `?` | Show help for selected option |
| `Y` | Set to built-in (y) |
| `M` | Set to module (m) |
| `N` | Set to disabled (n) |
| `Esc Esc` | Go back / exit |

Searching with `/` is particularly powerful. Type a symbol name (without the `CONFIG_` prefix) and menuconfig will list all matching options along with their current value, location in the menu tree, and dependencies.

---

### Applying a defconfig

Most boards and architectures provide a pre-made `defconfig` that provides a sensible starting point. These live under `arch/<arch>/configs/`.

```bash
# List available defconfigs for ARM
$ ls arch/arm/configs/ | head -20
am200epdkit_defconfig
armadillo800eva_defconfig
aspeed_g4_defconfig
aspeed_g5_defconfig
at91_dt_defconfig
axm55xx_defconfig
badge4_defconfig
bcm2835_defconfig
bcm_defconfig
cns3420vb_defconfig
cm_x300_defconfig
corgi_defconfig
davinci_all_defconfig
dove_defconfig
ebsa110_defconfig
efm32_defconfig
ep93xx_defconfig
eseries_pxa_defconfig
exynos_defconfig
footbridge_defconfig

# Apply the ARM Versatile Express defconfig
$ make ARCH=arm vexpress_defconfig
  HOSTCC  scripts/basic/fixdep
  HOSTCC  scripts/kconfig/conf.o
  HOSTCC  scripts/kconfig/confdata.o
  HOSTCC  scripts/kconfig/expr.o
  HOSTCC  scripts/kconfig/lexer.lex.o
  HOSTCC  scripts/kconfig/menu.o
  HOSTCC  scripts/kconfig/parser.tab.o
  HOSTCC  scripts/kconfig/preprocess.o
  HOSTCC  scripts/kconfig/symbol.o
  HOSTCC  scripts/kconfig/util.o
  HOSTCC  scripts/kconfig/conf
#
# configuration written to .config
#

# For Raspberry Pi 3/4 (64-bit)
$ make ARCH=arm64 bcm2711_defconfig
```

After applying a defconfig, you can refine it further with `make menuconfig`.

---

### Saving a Minimal defconfig

The full `.config` file contains thousands of lines, most of them auto-set by dependencies. The `make savedefconfig` command creates a minimal `defconfig` containing only the options that differ from the defaults — this is what you should store in version control.

```bash
# Save a minimal defconfig
$ make ARCH=arm savedefconfig
$ cat defconfig | wc -l
87

# The full .config has thousands of lines
$ cat .config | wc -l
4821

# Save to the arch configs directory (for mainlining)
$ cp defconfig arch/arm/configs/myboard_defconfig
```

---

### Grepping .config

When you need to quickly check whether a specific option is set without opening menuconfig:

```bash
# Check if a specific option is set
$ grep CONFIG_MODULES .config
CONFIG_MODULES=y

# Check all options related to USB
$ grep -i usb .config | grep -v "^#" | head -15
CONFIG_USB_SUPPORT=y
CONFIG_USB=y
CONFIG_USB_ANNOUNCEDEVICE=y
CONFIG_USB_DEFAULT_PERSIST=y
CONFIG_USB_DYNAMIC_MINORS=y
CONFIG_USB_EHCI_HCD=y
CONFIG_USB_EHCI_ROOT_HUB_TT=y
CONFIG_USB_EHCI_TT_NEWSCHED=y
CONFIG_USB_OHCI_HCD=y
CONFIG_USB_OHCI_HCD_PLATFORM=y
CONFIG_USB_UHCI_HCD=y
CONFIG_USB_STORAGE=y
CONFIG_USB_UAS=y
CONFIG_USB_SERIAL=y
CONFIG_USB_SERIAL_GENERIC=y

# Check if a config is explicitly disabled
$ grep CONFIG_KGDB .config
# CONFIG_KGDB is not set
```

---

## Kconfig Dependency System
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

Kconfig options rarely exist in isolation. They have relationships with other options that control when they can be enabled.

### depends on, select, and imply

```kconfig
# From drivers/net/ethernet/intel/Kconfig
config E1000
    tristate "Intel(R) PRO/1000 Gigabit Ethernet support"
    depends on PCI
    select PHYLIB
    help
      This driver supports Intel(R) PRO/1000 gigabit ethernet family of
      adapters.

config E1000E
    tristate "Intel(R) PRO/1000 PCI-Express Gigabit Ethernet support"
    depends on PCI && (!SPARC32)
    select CRC32
    select PHYLIB
    depends on NET_CORE
```

- `depends on PCI` — this option is only available if `CONFIG_PCI=y` or `CONFIG_PCI=m`. If the dependency is not met, the option is hidden entirely.
- `select PHYLIB` — when `E1000` is enabled, `CONFIG_PHYLIB` is automatically forced on. Use `select` for options that the current feature absolutely requires and the user should not be bothered with.
- `imply FOO` — a softer version of `select`. It suggests that `FOO` should be enabled but the user can still override it.

The key difference: `depends on` hides an option when the dependency is unmet. `select` forces another option on. `imply` sets a default but allows override.

---

### Writing a Kconfig Entry

When you write a new kernel driver, you need to add a Kconfig entry and a Makefile entry:

```kconfig
# drivers/misc/mydevice/Kconfig

config MY_DEVICE_DRIVER
    tristate "My custom device driver"
    depends on I2C
    select REGMAP_I2C
    default n
    help
      This driver supports the MyDevice XYZ sensor connected
      via I2C bus.

      To compile this driver as a module, choose M here.
      The module will be called mydevice.

config MY_DEVICE_DEBUG
    bool "Enable debug output for My Device"
    depends on MY_DEVICE_DRIVER
    default n
    help
      Enable verbose debug logging from the My Device driver.
      This should not be enabled in production builds.
```

```makefile
# drivers/misc/mydevice/Makefile
obj-$(CONFIG_MY_DEVICE_DRIVER) += mydevice.o
```

---

### Config Fragments and Merging

Config fragments are partial `.config` files that override specific settings. They are invaluable for automated build systems and CI pipelines.

```bash
# A config fragment (e.g., debug.config)
$ cat debug.config
CONFIG_DEBUG_INFO=y
CONFIG_DEBUG_KERNEL=y
CONFIG_KGDB=y
CONFIG_KGDB_SERIAL_CONSOLE=y
# CONFIG_RANDOMIZE_BASE is not set

# Another fragment for networking
$ cat net-features.config
CONFIG_NETFILTER=y
CONFIG_IP_NF_IPTABLES=y
CONFIG_NF_CONNTRACK=y

# Merge fragments on top of a base defconfig
$ make ARCH=arm vexpress_defconfig
$ scripts/kconfig/merge_config.sh .config debug.config net-features.config
  Using .config as base
  Merging debug.config
  Merging net-features.config
  Value of CONFIG_DEBUG_INFO is redefined by fragment debug.config:
  Previous value: # CONFIG_DEBUG_INFO is not set
  New value: CONFIG_DEBUG_INFO=y
  #
  # merged configuration written to .config (needs make)
  #

# Now run make to finalize the config (resolve new dependencies)
$ make ARCH=arm olddefconfig
```

This workflow is common in Yocto, Buildroot, and CI systems where you have a base board config and overlay fragments for specific builds (debug, production, testing).

---

### CONFIG_ Macros in C Code

Every `CONFIG_FOO` option becomes a preprocessor macro available in kernel C source files. This is how features are conditionally compiled:

```c
/* drivers/gpio/gpio-myboard.c */

#include <linux/module.h>
#include <linux/gpio.h>

/* Code only compiled when CONFIG_MY_GPIO_IRQS=y */
#ifdef CONFIG_MY_GPIO_IRQS
static irqreturn_t myboard_gpio_irq(int irq, void *data)
{
    struct myboard_gpio *mgpio = data;
    /* handle interrupt */
    return IRQ_HANDLED;
}

static int myboard_gpio_setup_irq(struct myboard_gpio *mgpio)
{
    return devm_request_irq(mgpio->dev, mgpio->irq,
                            myboard_gpio_irq, 0, "myboard-gpio", mgpio);
}
#else
static inline int myboard_gpio_setup_irq(struct myboard_gpio *mgpio)
{
    return 0;  /* no-op when IRQ support disabled */
}
#endif

/* IS_ENABLED() works for both bool and tristate configs */
static void myboard_init_features(void)
{
    if (IS_ENABLED(CONFIG_MY_GPIO_IRQS))
        pr_info("myboard: IRQ support compiled in\n");

    if (IS_ENABLED(CONFIG_MY_GPIO_DEBUG))
        pr_info("myboard: debug mode enabled\n");
}
```

The `IS_ENABLED()` macro is preferred in modern kernel code over raw `#ifdef` because it allows the compiler to check the syntax of both branches even when one is disabled, catching more bugs at build time.

---

### make oldconfig and make olddefconfig

When you update the kernel to a new version, the `.config` from the old version may be missing options that are new in the new kernel:

```bash
# Copy your existing .config from the old kernel tree to the new one
$ cp /path/to/old-kernel/.config .

# make oldconfig: asks you about each NEW option interactively
$ make ARCH=arm oldconfig
scripts/kconfig/conf --oldconfig Kconfig
*
* Restart config...
*
*
* Memory Management options
*
Transparent Hugepage Support (TRANSPARENT_HUGEPAGE) [Y/n/?] (NEW)
...

# make olddefconfig: silently sets all new options to their defaults
# This is the non-interactive version, preferred for automated builds
$ make ARCH=arm olddefconfig
scripts/kconfig/conf --olddefconfig Kconfig
#
# configuration written to .config
#
```

`make olddefconfig` is the standard choice in CI/automated build environments because it never blocks waiting for user input.

---

### Tracking Config Changes with git

```bash
# If you track .config in git (or use git diff against a known-good config)
$ git diff .config | head -40
diff --git a/.config b/.config
index 3f2a1b4..8d9e2c1 100644
--- a/.config
+++ b/.config
@@ -512,7 +512,7 @@
 CONFIG_NETFILTER=y
-# CONFIG_NF_CONNTRACK is not set
+CONFIG_NF_CONNTRACK=y
+CONFIG_NF_CONNTRACK_MARK=y
+CONFIG_NF_CONNTRACK_SECMARK=y
 CONFIG_NF_TABLES=y
```

---

### Important Kernel Configs to Know

```bash
# Check several important configs at once
$ grep -E "^(CONFIG_MODULES|CONFIG_DEVTMPFS|CONFIG_PROC_FS|CONFIG_SYSFS|CONFIG_OF|CONFIG_TMPFS)" .config
CONFIG_MODULES=y
CONFIG_DEVTMPFS=y
CONFIG_DEVTMPFS_MOUNT=y
CONFIG_PROC_FS=y
CONFIG_SYSFS=y
CONFIG_OF=y
CONFIG_TMPFS=y
```

Key configs explained:

| Config | Purpose |
|--------|---------|
| `CONFIG_MODULES` | Enables loadable kernel module support (without this, everything must be built-in) |
| `CONFIG_DEVTMPFS` | Creates `/dev` entries automatically for devices at boot |
| `CONFIG_DEVTMPFS_MOUNT` | Automatically mounts devtmpfs at `/dev` during boot |
| `CONFIG_PROC_FS` | Enables the `/proc` filesystem (required by many tools) |
| `CONFIG_SYSFS` | Enables the `/sys` filesystem (required by udev, systemd) |
| `CONFIG_OF` | Device Tree support (essential for most embedded platforms) |
| `CONFIG_TMPFS` | Enables tmpfs (needed for `/run`, `/tmp` in systemd systems) |

---

## Kconfig Deep Dive
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Kconfig Language: menuconfig, choice, if/endif

Beyond simple `config` entries, Kconfig supports more complex constructs:

```kconfig
# menuconfig creates a submenu that can also be toggled on/off
menuconfig I2C
    tristate "I2C support"
    select RT_MUTEXES
    help
      I2C (normally pronounced i-squared-c) implements a protocol
      originating from Philips.

if I2C
# Everything inside this block only appears if I2C is enabled
config I2C_BOARDINFO
    bool
    default y

config I2C_CHARDEV
    tristate "I2C device interface"
    help
      Say Y here to use i2c-* device files

endif # I2C

# choice creates a single-selection menu (radio buttons)
choice
    prompt "Kernel compression mode"
    default KERNEL_GZIP
    help
      The kernel gets compressed during build.

config KERNEL_GZIP
    bool "Gzip"
    depends on HAVE_KERNEL_GZIP

config KERNEL_BZIP2
    bool "Bzip2"
    depends on HAVE_KERNEL_BZIP2

config KERNEL_LZMA
    bool "LZMA"
    depends on HAVE_KERNEL_LZMA

endchoice
```

---

### Dependency Warnings and Loops

When Kconfig dependency rules are violated, you get warnings:

```
WARNING: unmet direct dependencies detected for USB_EHCI_HCD
  Depends on [n]: USB_SUPPORT [=y] && USB [=n]
  Selected by [y]:
  - USB_EHCI_PLATFORM [=y] && USB_SUPPORT [=y] && OF [=y]
```

This warning means: `USB_EHCI_HCD` was selected by `USB_EHCI_PLATFORM`, but `USB` (which `USB_EHCI_HCD` depends on) is currently disabled. The solution is to also enable `CONFIG_USB=y`.

---

### allmodconfig, allnoconfig, tinyconfig

These special targets are used for build testing:

```bash
# Enable all possible options as modules — tests that all drivers compile
$ make ARCH=arm allmodconfig
# Warning: this creates a very large kernel and takes a long time to build

# Disable everything possible — creates the smallest possible kernel
$ make ARCH=arm allnoconfig

# Absolute minimum config for a bootable kernel (even smaller than allnoconfig)
$ make ARCH=arm tinyconfig

# Check how many options each generates
$ make ARCH=arm allnoconfig && grep -c "^CONFIG" .config
83
$ make ARCH=arm tinyconfig && grep -c "^CONFIG" .config
21
```

`allmodconfig` is used by kernel developers and CI systems (like the 0-day bot) to ensure that all new code compiles correctly under all configurations.

---

### Generating a Minimal Embedded Config

The workflow for creating a minimal config for a custom embedded target:

```bash
# Start from absolute minimum
$ make ARCH=arm allnoconfig

# Open menuconfig and enable only what you need
$ make ARCH=arm menuconfig

# Essential options for a minimal embedded system:
# - Platform/board support (your specific SoC)
# - CONFIG_PROC_FS=y (needed by many tools)
# - CONFIG_SYSFS=y (needed by udev)
# - CONFIG_DEVTMPFS=y + CONFIG_DEVTMPFS_MOUNT=y
# - CONFIG_OF=y (Device Tree)
# - CONFIG_SERIAL_8250=y (or your UART driver)
# - CONFIG_SERIAL_8250_CONSOLE=y
# - CONFIG_EXT4_FS=y (or your rootfs type)
# - CONFIG_TMPFS=y
# - CONFIG_NET=y (if networking needed)

# After menuconfig, save minimal defconfig
$ make ARCH=arm savedefconfig
$ wc -l defconfig
94 defconfig
```

---

### scripts/diffconfig

```bash
# Compare two config files to see what changed
$ scripts/diffconfig .config.old .config.new
 CONFIG_NETFILTER n -> y
+CONFIG_NF_CONNTRACK n
+CONFIG_NF_TABLES n
-CONFIG_KGDB y
 CONFIG_DEBUG_INFO n -> y

# The format is:
# +FOO  (added, was not set)
# -FOO  (removed, was set)
# FOO x -> y  (changed from x to y)
```

---

### kconfig-hardened-check

The `kconfig-hardened-check` tool audits a `.config` file against a list of security-hardening recommendations:

```bash
# Install the tool
$ pip install git+https://github.com/a13xp0p0v/kconfig-hardened-check

# Check your config against security recommendations
$ kconfig-hardened-check -c .config -a ARM64 | head -40

[+] Special report mode: verbose
[+] Kernel version: 6.1
[+] Architecture: ARM64
[+] Config file: .config

========================================================================================================================
              option name               | type  |desired val | decision |      reason      | check result
========================================================================================================================
CONFIG_BUG                              |kconfig|     y      |defconfig | self_protection  | OK
CONFIG_SLUB_DEBUG                       |kconfig|     y      |defconfig | self_protection  | OK
CONFIG_GCC_PLUGINS                      |kconfig|     y      | hardened | self_protection  | FAIL: not found
CONFIG_STACKPROTECTOR_STRONG            |kconfig|     y      | hardened | self_protection  | OK
CONFIG_STRICT_KERNEL_RWX                |kconfig|     y      |defconfig | self_protection  | OK
CONFIG_STRICT_MODULE_RWX                |kconfig|     y      |defconfig | self_protection  | OK
CONFIG_IOMMU_SUPPORT                    |kconfig|     y      | hardened | self_protection  | OK
CONFIG_RANDOMIZE_BASE                   |kconfig|     y      | hardened | self_protection  | FAIL: not found
CONFIG_RANDOMIZE_MEMORY                 |kconfig|     y      | hardened | self_protection  | FAIL: not set
CONFIG_CC_HAS_RANDSTRUCT                |kconfig|     y      | hardened | self_protection  | OK
CONFIG_RANDSTRUCT_FULL                  |kconfig|     y      | hardened | self_protection  | FAIL: not found
```

This is essential for production embedded systems where security matters — IoT devices, automotive, medical equipment.

---

## Interview Questions
{:.gc-iq}

**Q: What is the difference between tristate y, m, and n in Kconfig?**

A tristate option with `y` (yes) compiles the feature directly into the kernel image — it is always present and cannot be removed at runtime. With `m` (module), the feature is compiled as a separate `.ko` file that can be loaded with `modprobe` and unloaded with `rmmod`. With `n` (no), the feature is completely excluded from the build. `bool` options only support `y` and `n` since they cannot be modularized.

**Q: How do you find a specific Kconfig option in menuconfig?**

Press the `/` key while in menuconfig to open the search dialog. Type the symbol name (without the `CONFIG_` prefix) — for example, type `KGDB` to find `CONFIG_KGDB`. The results show the option's current value, its location in the menu tree, and any unmet dependencies. You can navigate directly to the option from the search results.

**Q: What does make olddefconfig do and when would you use it?**

`make olddefconfig` reads an existing `.config` file (typically copied from a previous kernel version) and silently sets any new options that are not present in the old config to their default values. It is used when upgrading to a newer kernel version while preserving your existing configuration choices. It is preferred over `make oldconfig` in automated/CI environments because it does not prompt for input.

**Q: What is the purpose of the select keyword vs depends on?**

`depends on FOO` makes a Kconfig option invisible and unconfigurable unless `FOO` is already enabled — it is a prerequisite check. `select FOO` forces `CONFIG_FOO` to be enabled whenever the current option is enabled, without requiring the user to manually enable it. `select` is used for library-like dependencies that are implementation details. The rule of thumb: use `depends on` for options the user chooses, and `select` for mandatory internal dependencies.

**Q: How do you create a minimal kernel config for a custom embedded target?**

Start with `make ARCH=<arch> allnoconfig` to disable everything, then use `make ARCH=<arch> menuconfig` to enable only what is needed: the SoC platform, UART driver and console, Device Tree support, root filesystem type, devtmpfs, proc, sysfs, and any specific drivers for your hardware. After finalizing, run `make ARCH=<arch> savedefconfig` to generate a minimal `defconfig` file for version control.

**Q: How do CONFIG_ macros work in kernel C source code?**

Every `CONFIG_FOO=y` in `.config` causes `CONFIG_FOO` to be defined as `1` for the C preprocessor during compilation. Every `# CONFIG_FOO is not set` means `CONFIG_FOO` is undefined. Code can use `#ifdef CONFIG_FOO ... #endif` for conditional compilation. The preferred modern approach is `IS_ENABLED(CONFIG_FOO)`, which evaluates to a compile-time constant (1 or 0) allowing the compiler to dead-code-eliminate the disabled branch while still syntax-checking it. `IS_BUILTIN(CONFIG_FOO)` is true only for `y`, and `IS_MODULE(CONFIG_FOO)` is true only for `m`.

---

## References
{:.gc-ref}

- **Linux kernel Kconfig documentation:** `Documentation/kbuild/kconfig-language.rst` in the kernel source tree
- **"Linux Kernel Development" by Robert Love** (3rd edition) — comprehensive coverage of the build system and configuration
- **"Mastering Embedded Linux Programming" by Chris Simmonds** — practical defconfig and fragment workflows for embedded targets
- **kconfig-hardened-check tool:** [https://github.com/a13xp0p0v/kconfig-hardened-check](https://github.com/a13xp0p0v/kconfig-hardened-check) — security configuration auditing
- **Kernel Kconfig online documentation:** [https://www.kernel.org/doc/html/latest/kbuild/kconfig.html](https://www.kernel.org/doc/html/latest/kbuild/kconfig.html)
- **LWN.net Kconfig articles:** [https://lwn.net/Kernel/Index/#Configuration](https://lwn.net/Kernel/Index/#Configuration)
