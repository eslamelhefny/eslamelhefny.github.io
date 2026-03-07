---
layout: guide
title: "Device Tree (DTS)"
description: "Learn to read, write, and debug Device Tree Source files — the hardware description language that decouples board-specific configuration from the Linux kernel and U-Boot."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 06"
phase: embedded-linux-uboot
permalink: /embedded-linux/uboot/device-tree/
prev_topic:
  title: "U-Boot Commands & Scripting"
  url: /embedded-linux/uboot/uboot-commands/
next_topic:
  title: "Board Porting"
  url: /embedded-linux/uboot/board-porting/
---

## Device Tree Fundamentals: Structure, Syntax, and Compilation
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

### Why Device Tree?

Before Device Tree, the Linux kernel source contained thousands of lines of board-specific C code scattered across `arch/arm/mach-*/` directories. Adding a new board meant adding new C files to the kernel. Updating board configuration required recompiling the kernel. When ARM was at risk of being removed from the Linux mainline kernel, Linus Torvalds demanded a better approach.

Device Tree solves this by moving hardware description out of C code and into a separate data structure — the Device Tree. The kernel reads this data at runtime and configures itself accordingly. Now you can:
- Boot different boards with the same kernel binary, just different `.dtb` files
- Update board configuration without recompiling the kernel
- Share hardware description between the kernel and U-Boot

---

### The DTS File Format

A **Device Tree Source (.dts)** file is a human-readable text format. The compiler `dtc` converts it to a **Device Tree Blob (.dtb)** — a compact binary format that the kernel and U-Boot understand.

```
          .dts  ──(dtc)──►  .dtb
     (text, readable)    (binary, runtime)
```

Basic structure of a DTS file:

```dts
/dts-v1/;

/ {
    /* Root node — represents the entire system */
    #address-cells = <1>;
    #size-cells = <1>;
    compatible = "ti,am335x-bone-black", "ti,am335x-bone", "ti,am33xx";
    model = "TI AM335x BeagleBone Black";

    /* Memory node — tells the kernel about RAM */
    memory@80000000 {
        device_type = "memory";
        reg = <0x80000000 0x20000000>;  /* Start: 0x80000000, Size: 512MB */
    };

    /* Chosen node — boot parameters */
    chosen {
        bootargs = "console=ttyO0,115200n8";
        stdout-path = &uart0;
    };

    /* CPU nodes */
    cpus {
        #address-cells = <1>;
        #size-cells = <0>;

        cpu@0 {
            compatible = "arm,cortex-a8";
            device_type = "cpu";
            reg = <0>;
        };
    };

    /* A simple GPIO LED */
    leds {
        compatible = "gpio-leds";
        pinctrl-names = "default";
        pinctrl-0 = <&led_pins>;

        led0: user-led-0 {
            label = "beaglebone:green:usr0";
            gpios = <&gpio1 21 GPIO_ACTIVE_HIGH>;
            linux,default-trigger = "heartbeat";
        };
    };
};
```

---

### Data Types in Device Tree

Property values use specific encoding:

```dts
/ {
    /* String (null-terminated) */
    compatible = "myvendor,myboard";

    /* String list */
    compatible = "myvendor,myboard-v2", "myvendor,myboard";

    /* 32-bit unsigned integer (angle brackets) */
    reg = <0x44E09000>;

    /* Array of 32-bit integers */
    reg = <0x44E09000 0x1000>;   /* two cells: address and size */

    /* Multi-element array */
    clocks = <0 11 0x00480000 1>;

    /* Byte array (square brackets) */
    local-mac-address = [00 0a 35 00 01 02];

    /* Boolean (presence means true, no value needed) */
    dma-coherent;

    /* Empty property */
    status = "okay";   /* string "okay" enables the device */
    status = "disabled";
};
```

---

### phandle and & References

A **phandle** is a unique numeric identifier for a node. You reference nodes using the `&label` syntax, which the compiler resolves to the phandle number.

```dts
/ {
    /* Define a node with a label */
    uart0: serial@44E09000 {
        compatible = "ti,am3352-uart", "ti,omap2-uart";
        reg = <0x44E09000 0x1000>;
        interrupts = <72>;
        status = "okay";
    };

    gpio1: gpio@4804C000 {
        compatible = "ti,omap4-gpio";
        reg = <0x4804C000 0x1000>;
        gpio-controller;
        #gpio-cells = <2>;
    };

    /* Reference uart0 by its label */
    chosen {
        stdout-path = &uart0;   /* &uart0 becomes phandle integer at compile time */
    };

    /* Reference gpio1 — the <&gpio1 21 0> expands to <phandle_of_gpio1 21 0> */
    leds {
        led0 {
            gpios = <&gpio1 21 GPIO_ACTIVE_HIGH>;
        };
    };
};
```

---

### The dtc Compiler

`dtc` (Device Tree Compiler) converts between DTS text and DTB binary formats:

```bash
# Install dtc
$ sudo apt install device-tree-compiler
$ dtc --version
Version: DTC 1.6.1

# Compile .dts to .dtb
$ dtc -I dts -O dtb -o myboard.dtb myboard.dts
myboard.dts: Warning (unique_unit_address): /leds/led0: duplicate unit-address

# Compile with all warnings as errors
$ dtc -I dts -O dtb -W all -o myboard.dtb myboard.dts

# Decompile .dtb back to readable .dts (useful for inspecting binary DTBs)
$ dtc -I dtb -O dts -o myboard_decoded.dts myboard.dtb

# Decompile a live running kernel's device tree
$ dtc -I dtb -O dts -o running.dts /sys/firmware/fdt
```

---

### Reading a Simple DTS: UART and GPIO Example

Here is an annotated UART node showing the most common properties:

```dts
uart0: serial@44E09000 {
    /* compatible: driver matching string */
    compatible = "ti,am3352-uart", "ti,omap2-uart";

    /* reg: <base_address size> — physical register location */
    reg = <0x44E09000 0x1000>;

    /* interrupts: <irq_number> — GIC or INTC line number */
    interrupts = <72>;

    /* clocks: clock phandle and ID */
    clocks = <&uart0_fck>;
    clock-names = "fck";

    /* status: "okay" enables this node, "disabled" skips it */
    status = "okay";
};
```

And a GPIO LED node:

```dts
gpio1: gpio@4804C000 {
    compatible = "ti,omap4-gpio";
    reg = <0x4804C000 0x1000>;
    ti,hwmods = "gpio2";

    /* gpio-controller: marks this node as a GPIO provider */
    gpio-controller;

    /* #gpio-cells: how many cells a GPIO specifier takes */
    /* <&gpio1 21 GPIO_ACTIVE_HIGH> = 2 cells (pin_number flags) */
    #gpio-cells = <2>;

    interrupts = <98>;
    interrupt-controller;
    #interrupt-cells = <2>;
};
```

---

## Compatible Property, Address Cells, Interrupts, Pinctrl, and Overlays
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### The compatible Property: How Drivers Are Matched

The `compatible` property is a list of strings from most-specific to most-generic. The kernel walks this list and binds the first matching driver.

```dts
/* Specific first, generic fallback last */
compatible = "ti,am3352-uart", "ti,omap2-uart";
```

In the kernel driver:

```c
/* drivers/tty/serial/omap-serial.c */
static const struct of_device_id omap_serial_of_match[] = {
    { .compatible = "ti,omap2-uart" },
    { .compatible = "ti,omap3-uart" },
    { .compatible = "ti,omap4-uart" },
    { .compatible = "ti,am3352-uart" },
    { .compatible = "ti,am4372-uart" },
    {},
};
MODULE_DEVICE_TABLE(of, omap_serial_of_match);
```

The kernel's `of_match_device()` function iterates the driver's `of_match` table and the DTS `compatible` list, binding the driver when a match is found.

---

### Address Cells and Size Cells

`#address-cells` and `#size-cells` define how many 32-bit cells are used to encode addresses and sizes in child nodes' `reg` properties.

```dts
soc {
    /* 1 cell for address, 1 cell for size */
    #address-cells = <1>;
    #size-cells = <1>;

    /* reg = <address size> — 1 cell each */
    uart0: serial@44E09000 {
        reg = <0x44E09000 0x1000>;
    };
};

/* 64-bit address systems need 2 cells for address */
bus@0 {
    #address-cells = <2>;
    #size-cells = <2>;

    /* reg = <addr_high addr_low size_high size_low> */
    memory@80000000 {
        reg = <0x00000000 0x80000000 0x00000000 0x80000000>;
    };
};

/* CPU nodes often have address but no size */
cpus {
    #address-cells = <1>;
    #size-cells = <0>;     /* No size cell — just a CPU number */

    cpu@0 {
        reg = <0>;          /* Just the CPU index */
    };
    cpu@1 {
        reg = <1>;
    };
};
```

---

### Interrupt Nodes

Interrupt configuration requires an interrupt controller node and consumer nodes:

```dts
/* Interrupt controller */
intc: interrupt-controller@48200000 {
    compatible = "ti,omap2-intc";
    reg = <0x48200000 0x1000>;
    interrupt-controller;       /* This node IS an interrupt controller */
    #interrupt-cells = <1>;     /* One cell needed per interrupt reference */
};

/* Consumer using the interrupt controller */
uart0: serial@44E09000 {
    compatible = "ti,am3352-uart";
    reg = <0x44E09000 0x1000>;
    interrupts = <72>;           /* IRQ number 72 on the intc */
    interrupt-parent = <&intc>; /* Which controller handles this */
    status = "okay";
};

/* GIC (Generic Interrupt Controller) — used on Cortex-A9 and newer */
gic: interrupt-controller@1e001000 {
    compatible = "arm,cortex-a9-gic";
    reg = <0x1e001000 0x1000>,
          <0x1e000100 0x100>;
    interrupt-controller;
    #interrupt-cells = <3>;  /* <type number flags> */
};

/* GIC consumer — 3 cells: <GIC_SPI irq_num IRQ_TYPE_LEVEL_HIGH> */
uart1: serial@e0001000 {
    compatible = "cdns,uart-r1p8";
    reg = <0xe0001000 0x1000>;
    interrupts = <GIC_SPI 27 IRQ_TYPE_LEVEL_HIGH>;
    interrupt-parent = <&gic>;
};
```

---

### Pinctrl: Multiplexing GPIO and Peripherals

SoC pins can be configured as GPIO, UART, SPI, I2C, etc. The `pinctrl` subsystem handles this:

```dts
/* Pin controller node (AM335x) */
am33xx_pinmux: pinmux@44E10800 {
    compatible = "pinctrl-single";
    reg = <0x44E10800 0x0238>;
    #address-cells = <1>;
    #size-cells = <0>;
    pinctrl-single,register-width = <32>;
    pinctrl-single,function-mask = <0x7f>;

    /* Define a pin group for UART0 */
    uart0_pins: pinmux_uart0_pins {
        pinctrl-single,pins = <
            AM33XX_PADCONF(AM335X_PIN_UART0_RXD, PIN_INPUT_PULLUP, MUX_MODE0)
            AM33XX_PADCONF(AM335X_PIN_UART0_TXD, PIN_OUTPUT_PULLDOWN, MUX_MODE0)
        >;
    };

    /* LED GPIO pins */
    led_pins: pinmux_led_pins {
        pinctrl-single,pins = <
            AM33XX_PADCONF(AM335X_PIN_GPMC_A5, PIN_OUTPUT, MUX_MODE7)  /* GPIO1_21 */
            AM33XX_PADCONF(AM335X_PIN_GPMC_A6, PIN_OUTPUT, MUX_MODE7)  /* GPIO1_22 */
        >;
    };
};

/* UART0 node references its pin group */
uart0: serial@44E09000 {
    compatible = "ti,am3352-uart";
    reg = <0x44E09000 0x1000>;
    interrupts = <72>;
    pinctrl-names = "default";
    pinctrl-0 = <&uart0_pins>;  /* Apply uart0_pins when in "default" state */
    status = "okay";
};
```

`pinctrl-names` defines state names; `pinctrl-0` through `pinctrl-N` give the pin groups for each state.

---

### Device Tree Overlays (DTO)

Overlays allow you to modify a base DTB without recompiling it. This is how Raspberry Pi cape/expansion board configuration works.

```dts
/* Base DTB: am335x-boneblack.dts */
/ {
    /* ... */
    &spi0 {
        status = "disabled";   /* SPI0 disabled by default */
    };
};
```

```dts
/* Overlay: enable SPI0 with a MCP2515 CAN controller */
/dts-v1/;
/plugin/;   /* This marks the file as an overlay */

/ {
    compatible = "ti,am335x-bone-black";
    fragment@0 {
        target = <&spi0>;
        __overlay__ {
            status = "okay";
            pinctrl-names = "default";
            pinctrl-0 = <&spi0_pins>;
            #address-cells = <1>;
            #size-cells = <0>;

            mcp2515@0 {
                compatible = "microchip,mcp2515";
                reg = <0>;
                spi-max-frequency = <10000000>;
                interrupt-parent = <&gpio3>;
                interrupts = <19 IRQ_TYPE_EDGE_FALLING>;
                clocks = <&spi0_can_osc>;
            };
        };
    };
};
```

Compile the overlay:
```bash
$ dtc -I dts -O dtb -@ -o spi0-mcp2515.dtbo spi0-mcp2515.dts
# The -@ flag is crucial: it preserves symbols for runtime fixup
```

Apply in U-Boot:
```bash
=> fdt addr ${fdt_addr_r}
=> fdt resize 0x1000
=> fatload mmc 0:1 0x88100000 spi0-mcp2515.dtbo
=> fdt apply 0x88100000
```

---

### Clock, Reset, and Power Domain References

```dts
/* Clock provider */
clocks: clocks {
    uart0_fck: uart0_fck {
        #clock-cells = <0>;
        compatible = "fixed-clock";
        clock-frequency = <48000000>;
    };
};

/* Clock consumer */
uart0: serial@44E09000 {
    compatible = "ti,am3352-uart";
    clocks = <&uart0_fck>;        /* Reference the clock provider */
    clock-names = "fck";          /* Name matches driver expectation */
};

/* Reset controller */
rst: reset-controller@44E00F00 {
    compatible = "ti,syscon-reset";
    reg = <0x44E00F00 0x100>;
    #reset-cells = <1>;
};

/* Device with reset */
usb0: usb@47400000 {
    compatible = "ti,am33xx-usb";
    resets = <&rst 0>;
    reset-names = "usbphy0";
};
```

---

### Kernel Binding Documentation

Every Device Tree binding (compatible string + required properties) must be documented in the kernel:

```bash
# Browse bindings for a device
$ ls Documentation/devicetree/bindings/serial/
8250.yaml
fsl,lpuart.yaml
...
ti,omap2-uart.yaml

$ cat Documentation/devicetree/bindings/serial/ti,omap2-uart.yaml
# SPDX-License-Identifier: (GPL-2.0-only OR BSD-2-Clause)
%YAML 1.2
---
$id: http://devicetree.org/schemas/serial/ti,omap2-uart.yaml#
$schema: http://devicetree.org/meta-schemas/core.yaml#

title: TI OMAP2+ Universal Asynchronous Receiver/Transmitter (UART)

properties:
  compatible:
    enum:
      - ti,omap2-uart
      - ti,omap3-uart
      - ti,omap4-uart
      - ti,am3352-uart
  reg:
    maxItems: 1
  interrupts:
    maxItems: 1
  clocks:
    maxItems: 1
required:
  - compatible
  - reg
  - interrupts
```

---

## Custom Board DTS, Dynamic Overlays, Validation, and U-Boot DT Commands
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Writing a Complete DTS: SoC .dtsi + Board .dts Pattern

Large SoCs are described in a `.dtsi` (include) file that defines all SoC peripherals as `disabled`. Board `.dts` files include the SoC dtsi and enable/configure only what is present on that board.

```dts
/* arch/arm/boot/dts/am33xx.dtsi (SoC-level, everything disabled) */
/ {
    #address-cells = <1>;
    #size-cells = <1>;
    compatible = "ti,am33xx";

    aliases {
        serial0 = &uart0;
        i2c0    = &i2c0;
        spi0    = &spi0;
    };

    uart0: serial@44E09000 {
        compatible = "ti,am3352-uart", "ti,omap2-uart";
        reg = <0x44E09000 0x1000>;
        interrupts = <72>;
        clocks = <&uart0_fck>;
        clock-names = "fck";
        status = "disabled";    /* All peripherals start disabled */
    };

    i2c0: i2c@44E0B000 {
        compatible = "ti,omap4-i2c";
        reg = <0x44E0B000 0x1000>;
        interrupts = <70>;
        status = "disabled";
    };
};
```

```dts
/* arch/arm/boot/dts/am335x-boneblack.dts (board-level) */
/dts-v1/;

/* Include the SoC dtsi */
#include "am33xx.dtsi"
#include "am335x-bone-common.dtsi"

/* Override model and compatible */
/ {
    model = "TI AM335x BeagleBone Black";
    compatible = "ti,am335x-bone-black", "ti,am335x-bone", "ti,am33xx";
};

/* Enable UART0 (console) */
&uart0 {
    status = "okay";
    pinctrl-names = "default";
    pinctrl-0 = <&uart0_pins>;
};

/* Enable I2C0 for PMIC */
&i2c0 {
    status = "okay";
    clock-frequency = <400000>;

    tps65217: pmic@24 {
        compatible = "ti,tps65217";
        reg = <0x24>;
        /* ... */
    };
};

/* Configure eMMC */
&mmc1 {
    status = "okay";
    bus-width = <8>;
    pinctrl-names = "default";
    pinctrl-0 = <&emmc_pins>;
    ti,non-removable;
};
```

---

### Dynamic Device Tree on Raspberry Pi

Raspberry Pi uses overlays at boot time to configure the hardware:

```bash
# /boot/config.txt on Raspberry Pi
dtoverlay=spi0-1cs          # Enable SPI0 with 1 chip select
dtoverlay=i2c-rtc,ds3231    # Add DS3231 RTC on I2C
dtoverlay=gpio-led,gpio=17,label=myled  # GPIO LED on pin 17
dtparam=i2c_arm=on          # Enable I2C1
dtparam=spi=on              # Enable SPI0
```

At boot, the Pi firmware merges these overlays into the base DTB before handing it to U-Boot (or the kernel directly). You can inspect the result:

```bash
# On a running Raspberry Pi
$ dtc -I dtb -O dts -o /tmp/live.dts /proc/device-tree/../fdt
$ grep -A10 "spi@7e204000" /tmp/live.dts
spi@7e204000 {
    compatible = "brcm,bcm2835-spi";
    reg = <0x7e204000 0x200>;
    status = "okay";    # Was "disabled" in base DTB, overlay set it "okay"
```

---

### Device Tree Validation with dt-schema

Modern kernel development requires DTS files to pass schema validation:

```bash
# Install dt-schema tools
$ pip3 install dtschema

# Validate a DTB against all applicable schemas
$ dt-validate -s Documentation/devicetree/bindings/ myboard.dtb
/uart0: 'clocks' is a required property
/i2c0/pmic@24: 'reg' 0x24 is out of range 0x0..0x0f

# Validate during kernel build
$ make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- dtbs_check
  DTC     arch/arm/boot/dts/am335x-boneblack.dtb
  CHECK   arch/arm/boot/dts/am335x-boneblack.dtb
arch/arm/boot/dts/am335x-boneblack.dtb: /ocp/i2c@44e0b000/tps65217@24:
  interrupt-parent: False schema does not allow [17]
```

---

### Multiple Compatible Strings and Fallback

A device with multiple compatible strings uses the first match; if none match, the kernel tries the next. This enables forward/backward compatibility:

```dts
/* This board has a "new" UART variant, but falls back to "omap2" driver */
uart0: serial@44E09000 {
    compatible = "ti,am3352-uart",     /* Specific — try first */
                 "ti,omap4-uart",      /* Slightly less specific */
                 "ti,omap2-uart";      /* Generic fallback */
};
```

In driver code, you can detect which compatible matched:

```c
static int mydriver_probe(struct platform_device *pdev)
{
    const struct of_device_id *match;
    match = of_match_device(mydriver_of_match, &pdev->dev);
    if (match->data == &am3352_data) {
        /* AM3352-specific initialization */
    }
}
```

---

### Passing DTB from U-Boot to Kernel: fdt Commands

U-Boot has a full set of commands for manipulating a DTB in memory before booting:

```bash
# Load DTB into memory
=> fatload mmc 0:1 ${fdt_addr_r} am335x-boneblack.dtb
43056 bytes read in 9 ms

# Set the active DTB address for fdt commands
=> fdt addr ${fdt_addr_r}

# Print the entire device tree (very verbose)
=> fdt print /

# Print a specific node
=> fdt print /ocp/serial@44e09000
serial@44e09000 {
    compatible = "ti,am3352-uart\0ti,omap2-uart";
    reg = <0x44e09000 0x1000>;
    status = "okay";
};

# Get a property value
=> fdt get value uart_status /ocp/serial@44e09000 status
=> echo ${uart_status}
okay

# Set a property (modify DTB at runtime — useful for passing info to kernel)
=> fdt set /chosen bootargs "console=ttyO0,115200n8 root=/dev/mmcblk0p2 rw"

# Resize DTB to accommodate overlays
=> fdt resize 0x2000

# Apply an overlay
=> fatload mmc 0:1 0x88100000 spi0-mcp2515.dtbo
=> fdt apply 0x88100000
applying fdt overlay ...
```

---

### Debugging Device Tree at Runtime

Once Linux is running, the live device tree is exposed through the filesystem:

```bash
# The live DTB is at /sys/firmware/fdt (binary)
# The parsed tree is at /proc/device-tree/ (filesystem)

# List root node properties
$ ls /proc/device-tree/
#address-cells  compatible  cpus  leds  memory@80000000  model  name

# Read a property
$ cat /proc/device-tree/model
TI AM335x BeagleBone Black

# Find the UART node
$ find /proc/device-tree -name "serial*"
/proc/device-tree/ocp/serial@44e09000

# Read its compatible string (null-separated)
$ cat /proc/device-tree/ocp/serial@44e09000/compatible | tr '\0' '\n'
ti,am3352-uart
ti,omap2-uart

# Check driver binding
$ ls /sys/bus/platform/drivers/omap-serial/
44e09000.serial -> ../../../../devices/platform/ocp/44e09000.serial

# Decompile the live tree for inspection
$ dtc -I dtb -O dts -o /tmp/live.dts /sys/firmware/fdt
$ wc -l /tmp/live.dts
4821 /tmp/live.dts

# Check which DTB was loaded
$ ls -lh /sys/firmware/fdt
-r--r--r-- 1 root root 53K /sys/firmware/fdt

# Check for DT probe failures
$ dmesg | grep -i "dt\|of_probe\|devicetree"
[    0.423456] OF: fdt: Machine model: TI AM335x BeagleBone Black
[    1.234567] OF: overlay: overlay target is not a fragment node: __fixups__
```

---

### SPI and I2C Child Nodes

```dts
/* SPI controller */
spi0: spi@48030000 {
    compatible = "ti,omap4-mcspi";
    reg = <0x48030000 0x400>;
    interrupts = <65>;
    dmas = <&edma 16 0>, <&edma 17 0>;
    dma-names = "tx0", "rx0";
    ti,spi-num-cs = <2>;
    status = "okay";

    /* SPI child device — MCP2515 CAN controller */
    can0: can@0 {
        compatible = "microchip,mcp2515";
        reg = <0>;              /* Chip select 0 */
        spi-max-frequency = <10000000>;
        clocks = <&can_osc_clk>;
        interrupt-parent = <&gpio3>;
        interrupts = <19 IRQ_TYPE_EDGE_FALLING>;
    };
};

/* I2C controller */
i2c1: i2c@4802A000 {
    compatible = "ti,omap4-i2c";
    reg = <0x4802A000 0x1000>;
    interrupts = <71>;
    clock-frequency = <100000>;    /* 100 kHz */
    status = "okay";

    /* I2C child: temperature sensor at address 0x48 */
    temp_sensor: lm75@48 {
        compatible = "national,lm75";
        reg = <0x48>;              /* 7-bit I2C address */
    };

    /* I2C child: EEPROM at address 0x50 */
    eeprom: eeprom@50 {
        compatible = "atmel,24c256";
        reg = <0x50>;
        pagesize = <64>;
    };
};
```

---

## Interview Questions
{:.gc-iq}

**1. What problem does Device Tree solve?**

Before Device Tree, board-specific hardware configuration was hardcoded in C files within the kernel source tree. Each new board required new kernel code, and boards could not share a single kernel binary. Device Tree moves hardware description into a separate data file (`.dtb`), allowing one kernel binary to support many boards. It decouples the kernel from board-specific details, enables runtime configuration, and eliminates the need to recompile the kernel when board hardware changes.

**2. What is the compatible property and how does the kernel use it?**

`compatible` is a list of strings in a DT node, ordered from most-specific to most-generic (e.g., `"ti,am3352-uart", "ti,omap2-uart"`). At boot, the kernel iterates over all DT nodes and for each node, scans registered driver tables (`of_device_id` arrays) looking for a match with any string in the node's `compatible` list. The first driver that matches any compatible string wins and is bound to that device. This enables driver inheritance: a specific driver can handle the first string, while a generic driver handles the fallback.

**3. What is the difference between a .dts, .dtsi, and .dtb file?**

`.dts` (Device Tree Source) is a human-readable text file describing a complete board. `.dtsi` (Device Tree Source Include) is also a text file but designed to be included by `.dts` files — it describes shared SoC or platform components. Multiple `.dts` files for different boards can include the same `.dtsi`. `.dtb` (Device Tree Blob) is the compiled binary output of `dtc` applied to a `.dts` file. It is the file actually loaded by U-Boot and passed to the kernel at runtime.

**4. How do you pass a DTB to the Linux kernel?**

U-Boot loads the DTB binary into DRAM at a known address (stored in `${fdt_addr_r}`), then passes that address as the third argument to the boot command: `bootz ${kernel_addr_r} - ${fdt_addr_r}` for zImage, or `booti ${kernel_addr_r} - ${fdt_addr_r}` for ARM64 Image. The kernel boot code reads the DTB address from register r2 (ARM32) or x2 (ARM64) and parses it before any device initialization.

**5. What is a Device Tree overlay and when would you use one?**

A Device Tree overlay is a partial DTS file (compiled to `.dtbo`) that modifies a base DTB without recompiling it. Overlays are used when: (1) supporting expansion boards (capes, hats) that add hardware — you apply the overlay for that expansion board at boot; (2) enabling/disabling specific features on the same base board; (3) platforms like Raspberry Pi use overlays to configure peripherals from a simple `config.txt`. An overlay uses the `/plugin/` directive and `fragment@N` nodes targeting specific nodes in the base tree.

**6. How do you debug Device Tree issues at runtime?**

Several approaches: (1) Read `/proc/device-tree/` to inspect the parsed device tree; (2) Decompile the live binary with `dtc -I dtb -O dts /sys/firmware/fdt`; (3) Check driver binding with `ls /sys/bus/platform/devices/` and `ls /sys/bus/platform/drivers/`; (4) Look for `of_` errors in `dmesg`; (5) Use `dtc -I dts -O dtb -W all` during compilation to catch syntax issues early; (6) In U-Boot, use `fdt print /path/to/node` to inspect the DTB before booting.

**7. What is #address-cells and #size-cells?**

These properties, set in a parent node, define the encoding format for `reg` properties in their immediate children. `#address-cells = <1>` means each address in `reg` uses 1 32-bit cell (4 bytes). `#size-cells = <1>` means each size uses 1 cell. For a 64-bit bus, you would use `#address-cells = <2>` to encode 64-bit addresses with two 32-bit cells. For nodes with no meaningful address range (like CPUs), `#size-cells = <0>` means the `reg` property contains only the CPU index with no size.

---

## References
{:.gc-ref}

- Linux kernel: `Documentation/devicetree/bindings/` — official binding specifications
- "Mastering Embedded Linux Programming" — Chris Simmonds, Chapter 3 (Boot) and Chapter 14 (Device Drivers)
- Device Tree specification: [https://devicetree-spec.readthedocs.io/](https://devicetree-spec.readthedocs.io/)
- Embedded Linux Wiki Device Tree usage: [https://elinux.org/Device_Tree_Usage](https://elinux.org/Device_Tree_Usage)
- Grant Likely: "Device Tree for Dummies" — ELCE talk (available on YouTube)
- dt-schema validation tools: [https://github.com/devicetree-org/dt-schema](https://github.com/devicetree-org/dt-schema)
- Raspberry Pi Device Tree overlays documentation: [https://www.raspberrypi.com/documentation/computers/configuration.html](https://www.raspberrypi.com/documentation/computers/configuration.html)
