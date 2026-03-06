---
layout: post
title: "Embedded Linux Diploma — Lab 02: Linux Boot Process & U-Boot"
date: 2024-02-01
category: linux
tags: [u-boot, bootloader, kernel, linux]
excerpt: "Understanding the full Linux boot sequence: from power-on reset through U-Boot, kernel decompression, and init system startup."
---

## The Linux Boot Sequence

Understanding the boot process is fundamental to embedded Linux development. When power is applied, a precisely ordered sequence of events transforms hardware into a running Linux system.

```
Power On
  └─> ROM Bootloader (built-in)
        └─> SPL (Secondary Program Loader)
              └─> U-Boot (Bootloader)
                    └─> Linux Kernel
                          └─> init / systemd
                                └─> Userspace Applications
```

---

## 1. ROM Bootloader

The very first code executed lives in **on-chip ROM**. It:
- Initializes minimal hardware (clock, DRAM controller basics)
- Looks for a valid bootloader in predefined locations (SD card, eMMC, NAND, SPI flash)
- Loads the SPL (or directly U-Boot on simpler SoCs)

```c
/* Simplified ROM bootloader logic */
void rom_bootloader(void) {
    hardware_init_minimal();
    
    for (int i = 0; i < NUM_BOOT_SOURCES; i++) {
        if (load_from_source(boot_sources[i], SPL_LOAD_ADDR)) {
            jump_to(SPL_LOAD_ADDR);  // Never returns
        }
    }
    
    hang();  // Boot failure
}
```

## 2. U-Boot

U-Boot is the most widely used bootloader in embedded Linux. It provides:

```bash
# Common U-Boot commands

# Show environment
printenv

# Set boot arguments
setenv bootargs "console=ttyS0,115200 root=/dev/mmcblk0p2 rootwait"

# Load kernel from SD card
fatload mmc 0:1 ${loadaddr} zImage
fatload mmc 0:1 ${fdtaddr} am335x-boneblack.dtb

# Boot
bootz ${loadaddr} - ${fdtaddr}
```

### Building U-Boot for BeagleBone Black

```bash
git clone https://github.com/u-boot/u-boot.git
cd u-boot

# Configure
make ARCH=arm CROSS_COMPILE=arm-none-linux-gnueabihf- \
    am335x_evm_defconfig

# Build
make ARCH=arm CROSS_COMPILE=arm-none-linux-gnueabihf- -j$(nproc)

# Output files
ls MLO u-boot.img
```

### U-Boot Environment Variables

| Variable | Purpose |
|----------|---------|
| `bootcmd` | Command run on autoboot |
| `bootargs` | Kernel command line |
| `bootdelay` | Seconds before autoboot |
| `loadaddr` | Default kernel load address |
| `fdtaddr` | Device Tree Blob load address |

## 3. Linux Kernel Boot

When U-Boot hands control to the kernel:

```bash
# Kernel command line example
bootargs="console=ttyS0,115200n8 \
          root=/dev/mmcblk0p2 \
          rootwait \
          rw \
          loglevel=4 \
          init=/sbin/init"
```

### Kernel Initialization Sequence

```
start_kernel()
  ├── setup_arch()          # Architecture-specific init
  ├── mm_init()             # Memory management
  ├── sched_init()          # Scheduler
  ├── init_IRQ()            # Interrupt controller
  ├── parse_early_param()   # Early kernel params
  ├── rest_init()
  │     └── kernel_init()   # PID 1
  │           └── execve("/sbin/init")
  └── cpu_idle()            # Idle loop
```

## 4. Device Tree

Device Trees describe hardware to the kernel without hardcoding board details.

```dts
/* am335x-boneblack.dts (simplified) */
/dts-v1/;

/ {
    model = "TI AM335x BeagleBone Black";
    compatible = "ti,am335x-bone-black", "ti,am33xx";
    
    memory@80000000 {
        device_type = "memory";
        reg = <0x80000000 0x20000000>; /* 512MB */
    };
    
    cpus {
        cpu@0 {
            compatible = "arm,cortex-a8";
            operating-points = <720000 1285000>;
        };
    };
    
    leds {
        compatible = "gpio-leds";
        
        led0: user-led0 {
            label = "beaglebone:green:usr0";
            gpios = <&gpio1 21 GPIO_ACTIVE_HIGH>;
            default-state = "off";
        };
    };
};
```

## 5. Init System (systemd)

```bash
# Check boot time
systemd-analyze

# Show service startup times
systemd-analyze blame

# Boot visualization
systemd-analyze plot > boot.svg
```

## Lab Exercises

1. Build U-Boot for QEMU `vexpress_ca9x4` and boot a kernel
2. Modify U-Boot environment to add a 3-second boot delay
3. Write a minimal Device Tree for a virtual UART device
4. Measure and compare boot times between SysV init and systemd on Buildroot

---

> 🔍 **Deep Dive:** Use `bootlin.com/elc-europe2021/talks/boot-time-reduction` for boot time optimization techniques used in production automotive systems.

## Next Lab

**Lab 03** covers **Linux Kernel Module Development** — writing, compiling, and loading your first kernel module.
