---
layout: guide
title: "U-Boot Board Porting"
description: "Learn how to add U-Boot support for a new ARM board — from creating the defconfig and board files to initializing DDR, bringing up serial output, and submitting the port upstream."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 06"
phase: embedded-linux-uboot
permalink: /embedded-linux/uboot/board-porting/
prev_topic:
  title: "Device Tree (DTS)"
  url: /embedded-linux/uboot/device-tree/
next_topic:
  title: "TFTP & Network Boot"
  url: /embedded-linux/uboot/tftp-boot/
---

## U-Boot Board Support Structure and Mandatory Files
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Porting U-Boot to a new board means creating the configuration and code that U-Boot needs to know about your specific hardware. The process follows a well-defined file structure. The fastest approach is to find an existing board port that uses the same SoC as your target board and use it as a template.

### The U-Boot Board Support Directory Structure

Every supported board in U-Boot has files in three locations:

```
u-boot/
├── configs/
│   └── myboard_defconfig         ← Minimal Kconfig configuration
├── include/configs/
│   └── myboard.h                 ← C header for board-specific #defines
└── board/
    └── myvendor/
        └── myboard/
            ├── Makefile          ← Lists which .c files to compile
            ├── board.c           ← Board initialization functions
            ├── Kconfig           ← Kconfig entry for this board
            └── MAINTAINERS       ← Who maintains this port
```

Let us examine each file in detail using the **BeagleBone Black** (TI AM335x) as a reference.

---

### Examining a Reference Board Port: BeagleBone Black

```bash
$ ls board/ti/am335x/
board.c  board.h  Kconfig  MAINTAINERS  Makefile  mux.c  mux.h  pmic.c  u-boot.lds

$ cat board/ti/am335x/Makefile
# SPDX-License-Identifier: GPL-2.0+
obj-y := board.o mux.o
obj-$(CONFIG_PMIC_TPS65910) += pmic.o
```

The `board.c` file contains the board-specific initialization functions.

---

### The defconfig File

The defconfig is the minimal Kconfig configuration. Create it at `configs/myboard_defconfig`:

```bash
$ cat configs/am335x_boneblack_defconfig
CONFIG_ARM=y
CONFIG_ARCH_OMAP2PLUS=y
CONFIG_TI_COMMON_CMD_OPTIONS=y
CONFIG_SOC_AM33XX=y
CONFIG_TARGET_AM335X_EVM=y
CONFIG_DEFAULT_DEVICE_TREE="am335x-boneblack"
CONFIG_SPL=y
CONFIG_SYS_MALLOC_F_LEN=0x8000
CONFIG_SPL_AM33XX_ENABLE_RTC32K_OSC=y
CONFIG_SPL_SERIAL=y
CONFIG_SPL_STACK_R=y
CONFIG_SPL_STACK_R_ADDR=0x82000000
CONFIG_SPL_OS_BOOT=y
CONFIG_AUTOBOOT_KEYED=y
CONFIG_USE_BOOTCOMMAND=y
CONFIG_BOOTCOMMAND="run findfdt; run distro_bootcmd"
CONFIG_SYS_CONSOLE_INFO_QUIET=y
CONFIG_DISPLAY_BOARDINFO_LATE=y
CONFIG_SPL_SYS_MALLOC_SIMPLE=y
CONFIG_SPL_BOARD_INIT=y
CONFIG_SPL_CPU=y
CONFIG_SPL_ENV_SUPPORT=y
CONFIG_SPL_FS_FAT=y
CONFIG_SPL_LIBCOMMON_SUPPORT=y
CONFIG_SPL_LIBDISK_SUPPORT=y
CONFIG_SPL_LIBGENERIC_SUPPORT=y
CONFIG_SPL_MMC=y
CONFIG_SPL_POWER=y
CONFIG_SPL_SERIAL=y
CONFIG_DISTRO_DEFAULTS=y
CONFIG_ENV_IS_IN_FAT=y
CONFIG_ENV_FAT_INTERFACE="mmc"
CONFIG_ENV_FAT_DEVICE_AND_PART="0:1"
CONFIG_BOOTP_PREFER_SERVERIP=y
```

The absolutely mandatory options for a minimal ARM port:
```
CONFIG_ARM=y
CONFIG_ARCH_<PLATFORM>=y
CONFIG_TARGET_<BOARD>=y
CONFIG_SPL=y                  # Enable SPL
CONFIG_DEFAULT_DEVICE_TREE="<your-dtb-name>"
```

---

### The Board Header File

`include/configs/myboard.h` provides C preprocessor defines for settings not yet migrated to Kconfig:

```c
/* include/configs/myboard.h */
#ifndef __CONFIG_MYBOARD_H
#define __CONFIG_MYBOARD_H

/* Import common AM335x configuration */
#include <configs/ti_armv7_common.h>

/* DRAM configuration */
#define CONFIG_SYS_SDRAM_BASE       0x80000000
#define PHYS_SDRAM_1_SIZE           (256 << 20)    /* 256 MB */

/* U-Boot memory placement */
#define CONFIG_SYS_TEXT_BASE        0x80800000
#define CONFIG_SYS_MALLOC_LEN       (1 << 20)      /* 1 MB */

/* Console */
#define CONFIG_SYS_NS16550_COM1     0x44E09000     /* UART0 base */
#define CONFIG_CONS_INDEX           1

/* Flash layout — only needed if using raw MMC */
#define CONFIG_SYS_MMC_ENV_DEV      0
#define CONFIG_SYS_MMC_ENV_PART     0

#endif /* __CONFIG_MYBOARD_H */
```

For a modern board port targeting full Kconfig migration, this file may be minimal or empty.

---

### The Board Kconfig Entry

Add your board to the architecture Kconfig so `make menuconfig` knows about it:

```kconfig
# board/myvendor/myboard/Kconfig

if TARGET_MYBOARD

config SYS_BOARD
    default "myboard"

config SYS_VENDOR
    default "myvendor"

config SYS_SOC
    default "mysocseries"

config SYS_CONFIG_NAME
    default "myboard"

config BOARD_SPECIFIC_OPTIONS
    def_bool y
    select SUPPORT_SPL
    imply CMD_DHCP
    imply CMD_TFTP
    imply CMD_MMC

endif
```

Reference this from the parent Kconfig (`arch/arm/Kconfig` or `board/myvendor/Kconfig`):

```kconfig
# In arch/arm/Kconfig
config TARGET_MYBOARD
    bool "Support myvendor myboard"
    depends on SOC_MYSOCSERIES
    select BOARD_LATE_INIT
    help
      This enables support for the myvendor myboard development board
      using the mysocseries SoC.
      Datasheet: https://example.com/myboard-datasheet
```

---

### The Board Init Sequence: board_init_f and board_init_r

U-Boot has a two-phase initialization:

**`board_init_f` (init_f = "init first phase")**
- Runs very early, before DRAM is available
- Executes in place from the load address (SRAM or early DRAM)
- Sets up the UART for early output
- Copies U-Boot to its final linked address in DRAM (`reloc`)
- Does NOT use global data (heap) extensively

**`board_init_r` (init_r = "init relocated")**
- Runs after relocation — U-Boot has moved to its final DRAM address
- Full DRAM is available
- Probes all drivers
- Reads and processes environment
- Runs `bootcmd`

```c
/* board/myvendor/myboard/board.c */
#include <common.h>
#include <init.h>
#include <asm/arch/sys_proto.h>

/*
 * board_init_f: Called before DRAM relocation.
 * Only minimal initialization here.
 */
void board_init_f(ulong dummy)
{
    /* This sequence is defined in include/init.h as init_fnc_t table */
    /* For custom early init, implement board-specific init functions */

    /* Initialize the SoC's internal SRAM allocator */
    spl_early_init();

    /* Initialize UART for serial output */
    preloader_console_init();

    /* Initialize DRAM controller */
    dram_init();
}

/*
 * board_init_r: Called after relocation to DRAM.
 * Full initialization.
 */
int board_init(void)
{
    /* Called from board_init_r, after relocation */
    /* Set gd->bd->bi_boot_params to DRAM base + 0x100 */
    gd->bd->bi_boot_params = CONFIG_SYS_SDRAM_BASE + 0x100;

    /* Initialize GPIO, buttons, LEDs here */
    gpio_request(LED_GPIO, "status_led");
    gpio_direction_output(LED_GPIO, 1);

    return 0;
}

/*
 * dram_init: Tell U-Boot how much DRAM is available.
 */
int dram_init(void)
{
    gd->ram_size = get_ram_size((void *)CONFIG_SYS_SDRAM_BASE,
                                 PHYS_SDRAM_1_SIZE);
    return 0;
}
```

---

## DDR Initialization, Clock Configuration, and QEMU Testing
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### DDR Initialization: The Hardest Part of Board Porting

Initializing DDR (SDRAM, LPDDR, DDR3, DDR4) is almost always the most complex part of board porting. The DDR controller must be configured with timing parameters that are specific to:
- The DDR chip model (vendor, part number)
- The PCB trace lengths and routing
- The operating frequency

**Typical DDR timing parameters needed:**

| Parameter | Meaning | Example Value |
|-----------|---------|---------------|
| `CL` | CAS Latency | 11 |
| `tRCD` | RAS to CAS delay | 14 ns |
| `tRP` | Row precharge time | 14 ns |
| `tRAS` | Row active time | 33 ns |
| `tWR` | Write recovery time | 15 ns |
| `tRFC` | Refresh cycle time | 260 ns |
| `tREFI` | Refresh interval | 7.8 µs |

For AM335x, DDR3 initialization in SPL:

```c
/* board/ti/am335x/board.c — DDR3 init for BeagleBone Black */
#include <asm/arch/ddr_defs.h>
#include <asm/arch/clock.h>

static const struct ddr_data ddr3_data = {
    .datardsratio0  = MT41K256M16HA125E_RD_DQS,
    .datawdsratio0  = MT41K256M16HA125E_WR_DQS,
    .datafwsratio0  = MT41K256M16HA125E_PHY_FIFO_WE,
    .datawrsratio0  = MT41K256M16HA125E_PHY_WR_DATA,
};

static const struct cmd_control ddr3_cmd_ctrl_data = {
    .cmd0csratio  = MT41K256M16HA125E_RATIO,
    .cmd0iclkout  = MT41K256M16HA125E_INVERT_CLKOUT,
    .cmd1csratio  = MT41K256M16HA125E_RATIO,
    .cmd1iclkout  = MT41K256M16HA125E_INVERT_CLKOUT,
    .cmd2csratio  = MT41K256M16HA125E_RATIO,
    .cmd2iclkout  = MT41K256M16HA125E_INVERT_CLKOUT,
};

static struct emif_regs ddr3_emif_reg_data = {
    .sdram_config   = MT41K256M16HA125E_EMIF_SDCFG,
    .ref_ctrl       = MT41K256M16HA125E_EMIF_SDREF,
    .sdram_tim1     = MT41K256M16HA125E_EMIF_TIM1,
    .sdram_tim2     = MT41K256M16HA125E_EMIF_TIM2,
    .sdram_tim3     = MT41K256M16HA125E_EMIF_TIM3,
    .zq_config      = MT41K256M16HA125E_ZQ_CFG,
    .emif_ddr_phy_ctlr_1 = MT41K256M16HA125E_EMIF_READ_LATENCY,
};

void sdram_init(void)
{
    /* Configure DDR3 PLL to 400 MHz (DDR3 at 800 MT/s) */
    configure_ddr_pll(DPLL_DDR_400);

    /* Write DDR3 PHY settings */
    config_ddr(400, &ioregs, &ddr3_data, &ddr3_cmd_ctrl_data,
               &ddr3_emif_reg_data, 0);
}
```

**Where do these magic constant values come from?**

1. **DDR chip datasheet** — timing parameters like tRCD, tRP, tRAS in nanoseconds
2. **SoC reference manual** — EMIF register layout and how to convert nanoseconds to register values
3. **TI's AM335x EVM board support package** — example register values for the reference board's DDR chips
4. **JEDEC standards** — DDR3 initialization sequence requirements

---

### UART Console Setup in SPL

Having serial output during SPL is critical for debugging. Without it, you have no way to know whether SPL is even starting.

```c
/* arch/arm/mach-omap2/am33xx/board.c */
void board_init_f(ulong dummy)
{
    /* Step 1: Initialize SRAM allocator */
    spl_early_init();

    /* Step 2: Initialize serial UART — this enables printf() */
    /* This initializes UART0 at 115200 baud */
    preloader_console_init();

    /* Now we can print */
    printf("SPL: starting DDR init...\n");

    /* Step 3: Initialize DDR */
    timer_init();
    set_uart_mux_conf();  /* Configure UART pin mux */
    setup_clocks_for_console();

    /* Step 4: Initialize DRAM controller */
    sdram_init();
    printf("SPL: DDR initialized, %u MB\n",
           (unsigned)(gd->ram_size >> 20));
}
```

If you never see the `"SPL: starting DDR init..."` line, then either:
- BootROM did not find or load your SPL
- The UART pin mux was not set before `preloader_console_init()` was called
- The UART clock is not running

---

### Clocks and PLL Configuration

SoC boot starts at a low "limp mode" clock. SPL must configure PLLs to run at full speed before DDR initialization (DDR requires stable clocks):

```c
/* arch/arm/mach-omap2/am33xx/clock.c */
void configure_module_pin_mux(struct module_pin_mux *mod_pin_mux)
{
    int i;
    for (i = 0; mod_pin_mux[i].reg_offset != -1; i++)
        MUX_CFG(VALUE_MUX_CONF_REG(mod_pin_mux[i].mux_val),
                mod_pin_mux[i].reg_offset);
}

/* Configure PLLs for AM335x */
void set_mpu_clk_pll(u32 mpupll_m)
{
    struct cm_wkuppll *cmwkuppll = (struct cm_wkuppll *)CM_WKUP;

    /* Bypass mode */
    clrsetbits_le32(&cmwkuppll->clkmode_dpll_mpu,
                    CM_CLKMODE_DPLL_DPLL_EN_MASK,
                    DPLL_BYPASS_MODE);

    /* Set M/N ratio for desired frequency */
    /* MPU at 1000 MHz: M=1000, N=23, M2=1 */
    /* Fout = (M / (N+1)) * Fref = (1000/24) * 24MHz = 1000 MHz */
    clrsetbits_le32(&cmwkuppll->clksel_dpll_mpu,
                    CM_CLKSEL_DPLL_M_MASK | CM_CLKSEL_DPLL_N_MASK,
                    ((mpupll_m << CM_CLKSEL_DPLL_M_SHIFT) |
                     ((MPUPLL_N) << CM_CLKSEL_DPLL_N_SHIFT)));

    /* Lock mode */
    clrsetbits_le32(&cmwkuppll->clkmode_dpll_mpu,
                    CM_CLKMODE_DPLL_DPLL_EN_MASK,
                    DPLL_LOCK_MODE);

    /* Wait for lock */
    while (!(readl(&cmwkuppll->idlest_dpll_mpu) & ST_DPLL_CLK_MASK))
        ;
}
```

---

### Adding the Board to Kconfig and MAINTAINERS

Every board in U-Boot must have a Kconfig entry and a MAINTAINERS entry:

```bash
# board/myvendor/myboard/Kconfig
config TARGET_MY_CUSTOM_BOARD
    bool "Support My Custom Board"
    depends on SOC_AM33XX
    select BOARD_LATE_INIT
    help
      My Custom Board based on TI AM335x SoC.
      Uses 256MB DDR3 (MT41K256M16HA-125), USB, Ethernet.
```

```
# Add to MAINTAINERS
MY CUSTOM BOARD
M:  Your Name <your@email.com>
S:  Maintained
F:  board/myvendor/myboard/
F:  configs/my_custom_board_defconfig
F:  include/configs/my_custom_board.h
F:  arch/arm/dts/my-custom-board.dts
```

---

### Testing with QEMU When Hardware Is Unavailable

QEMU can emulate several ARM boards. This is invaluable for testing logic before real hardware arrives:

```bash
# Build U-Boot for QEMU vexpress-a9
$ make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- qemu_arm_defconfig
$ make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- -j4

# Run in QEMU — no hardware needed
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
Net:   smc911x-0
Hit any key to stop autoboot:  3
=>

# Load a kernel in QEMU
$ qemu-system-arm \
    -machine vexpress-a9 \
    -m 512M \
    -nographic \
    -kernel u-boot \
    -drive file=rootfs.img,format=raw,id=sd0 \
    -device sd-card,drive=sd0 \
    -serial mon:stdio
```

For Raspberry Pi emulation:
```bash
$ qemu-system-arm \
    -machine raspi2b \
    -m 1G \
    -nographic \
    -kernel u-boot.bin \
    -dtb bcm2836-rpi-2-b.dtb \
    -serial stdio
```

---

## DM Driver Porting, Bring-Up Strategy, JTAG, and Upstream Submission
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Writing a DM UART Driver for a New SoC

If your SoC has no existing U-Boot driver, you must write one. Here is a minimal Driver Model UART driver skeleton:

```c
/* drivers/serial/serial_myuart.c */
#include <dm.h>
#include <serial.h>
#include <linux/io.h>

/* Register offsets */
#define MYUART_DR    0x00    /* Data Register */
#define MYUART_SR    0x04    /* Status Register */
#define MYUART_CR    0x08    /* Control Register */
#define MYUART_BR    0x0C    /* Baud Rate */

#define MYUART_SR_TXFULL  BIT(3)    /* TX FIFO full */
#define MYUART_SR_RXNE    BIT(0)    /* RX not empty */

struct myuart_priv {
    void __iomem    *base;
    unsigned long    clock;
};

static int myuart_setbrg(struct udevice *dev, int baudrate)
{
    struct myuart_priv *priv = dev_get_priv(dev);
    unsigned int divisor = priv->clock / (16 * baudrate);
    writel(divisor, priv->base + MYUART_BR);
    return 0;
}

static int myuart_putc(struct udevice *dev, const char ch)
{
    struct myuart_priv *priv = dev_get_priv(dev);
    /* Spin until TX FIFO has space */
    while (readl(priv->base + MYUART_SR) & MYUART_SR_TXFULL)
        ;
    writel(ch, priv->base + MYUART_DR);
    return 0;
}

static int myuart_getc(struct udevice *dev)
{
    struct myuart_priv *priv = dev_get_priv(dev);
    if (!(readl(priv->base + MYUART_SR) & MYUART_SR_RXNE))
        return -EAGAIN;    /* No data available */
    return readl(priv->base + MYUART_DR) & 0xFF;
}

static int myuart_pending(struct udevice *dev, bool input)
{
    struct myuart_priv *priv = dev_get_priv(dev);
    if (input)
        return (readl(priv->base + MYUART_SR) & MYUART_SR_RXNE) ? 1 : 0;
    return 0;
}

static int myuart_probe(struct udevice *dev)
{
    struct myuart_priv *priv = dev_get_priv(dev);

    priv->base = dev_read_addr_ptr(dev);
    if (!priv->base)
        return -EINVAL;

    /* Get clock frequency from device tree */
    priv->clock = dev_read_u32_default(dev, "clock-frequency", 24000000);

    /* Enable UART */
    writel(0x01, priv->base + MYUART_CR);

    return 0;
}

static const struct dm_serial_ops myuart_ops = {
    .putc    = myuart_putc,
    .getc    = myuart_getc,
    .setbrg  = myuart_setbrg,
    .pending = myuart_pending,
};

static const struct udevice_id myuart_ids[] = {
    { .compatible = "myvendor,mysoc-uart" },
    { }
};

U_BOOT_DRIVER(myuart_serial) = {
    .name      = "myuart_serial",
    .id        = UCLASS_SERIAL,
    .of_match  = myuart_ids,
    .probe     = myuart_probe,
    .ops       = &myuart_ops,
    .priv_auto = sizeof(struct myuart_priv),
};
```

Add to `drivers/serial/Kconfig`:
```kconfig
config MYUART_SERIAL
    bool "My SoC UART driver"
    depends on DM_SERIAL
    help
      Enable UART driver for MyVendor MySoC.
```

Add to `drivers/serial/Makefile`:
```makefile
obj-$(CONFIG_MYUART_SERIAL) += serial_myuart.o
```

---

### Board Bring-Up: A Systematic Approach

When you have a board with absolutely no output, follow this sequence:

**Step 1: Get serial output — the highest priority**

Without serial output, you are completely blind. Do whatever it takes:
- Verify the UART pins are accessible (check schematic)
- Use a 3.3V USB-UART adapter (never 5V on modern SoCs — it will damage the board)
- Verify baud rate: try 115200, then 57600, then 9600
- If still no output: check if SPL is being loaded at all (oscilloscope/logic analyzer on SD card data lines to see if data is being read)

**Step 2: Verify DRAM is working**

After seeing the SPL line, if U-Boot hangs:
```bash
# In SPL, add explicit DRAM test
void board_init_f(ulong dummy)
{
    preloader_console_init();
    printf("SPL: before DDR\n");    /* Add this */
    sdram_init();
    printf("SPL: DDR done, %u MB\n", (unsigned)(gd->ram_size >> 20));
}
```

If `"SPL: before DDR"` appears but `"SPL: DDR done"` does not, the DDR initialization is hanging.

**Step 3: Load from storage**

Once U-Boot shell appears, test MMC:
```bash
=> mmc list
=> mmc dev 0
=> mmc info
=> fatls mmc 0:1
```

**Step 4: Boot a minimal kernel**

Use a known-good prebuilt kernel (e.g., Buildroot minimal) before trying your own:
```bash
=> fatload mmc 0:1 ${kernel_addr_r} zImage
=> fatload mmc 0:1 ${fdt_addr_r} myboard.dtb
=> setenv bootargs "console=ttyS0,115200 root=/dev/mmcblk0p2 rw rootwait"
=> bootz ${kernel_addr_r} - ${fdt_addr_r}
```

---

### JTAG Debugging of Early Boot Code

For situations where serial output never appears, JTAG is the last resort:

```bash
# Install OpenOCD
$ sudo apt install openocd

# Connect JTAG adapter and start OpenOCD for AM335x
$ openocd \
    -f interface/ftdi/olimex-arm-usb-ocd-h.cfg \
    -f target/am335x.cfg \
    -c "adapter speed 1000"

Open On-Chip Debugger 0.12.0
Info : JTAG tap: am335x.jrc tap/device found: 0x2b94402f (mfg: 0x017, part: 0xb944, ver: 0x2)
Info : JTAG tap: am335x.cpu tap/device found: 0x4b6d102f
Info : am335x.cpu: hardware has 6 breakpoints, 4 watchpoints
Info : starting gdb server for am335x.cpu on 3333

# In another terminal, connect GDB
$ arm-linux-gnueabihf-gdb spl/u-boot-spl

(gdb) target remote :3333
Remote debugging using :3333
0x402f04d0 in ?? ()

(gdb) symbol-file spl/u-boot-spl
Reading symbols from spl/u-boot-spl...
Reading symbols from spl/u-boot-spl.sym...done.

(gdb) break board_init_f
Breakpoint 1 at 0x402f12a0: file board/ti/am335x/board.c, line 289.

(gdb) continue
Continuing.

Breakpoint 1, board_init_f (dummy=0)
    at board/ti/am335x/board.c:289
289         spl_early_init();

(gdb) next
290         preloader_console_init();
(gdb) next
291         sdram_init();
(gdb) info registers
r0             0x0                 0
r1             0x0                 0
sp             0x402ff400          0x402ff400
pc             0x402f1310          0x402f1310 <sdram_init>
```

This lets you step through SPL line by line to find exactly where it hangs.

---

### Writing SPL Pinmux in C

On SoCs without a device tree in SPL, pin multiplexing is done directly in C:

```c
/* board/myvendor/myboard/mux.c */
#include <asm/arch/mux.h>

/* UART0 pin mux table */
static struct module_pin_mux uart0_pin_mux[] = {
    {OFFSET(uart0_rxd), (MODE(0) | PULLUP_EN | RXACTIVE)},  /* UART0_RXD */
    {OFFSET(uart0_txd), (MODE(0) | PULLDOWN_EN)},            /* UART0_TXD */
    {-1},
};

/* DDR3 VTT pin mux (power enable) */
static struct module_pin_mux ddr3_vtt_pin_mux[] = {
    {OFFSET(gpmc_wen), (MODE(7) | PULLDOWN_EN)},   /* GPIO2_4 — VTT_EN */
    {-1},
};

/* I2C0 pin mux */
static struct module_pin_mux i2c0_pin_mux[] = {
    {OFFSET(i2c0_sda), (MODE(0) | RXACTIVE | PULLUDEN | SLEWCTRL)},
    {OFFSET(i2c0_scl), (MODE(0) | RXACTIVE | PULLUDEN | SLEWCTRL)},
    {-1},
};

void set_mux_conf_regs(void)
{
    /* Configure pin muxes early in SPL */
    configure_module_pin_mux(uart0_pin_mux);
    configure_module_pin_mux(ddr3_vtt_pin_mux);
    configure_module_pin_mux(i2c0_pin_mux);
}
```

---

### Submitting a Board Port Upstream

Upstream submission requires following specific guidelines:

**1. Patch format — one logical change per patch:**
```bash
# Create a patch series
$ git format-patch -8 --subject-prefix="PATCH" -o /tmp/patches/

# Check patch style
$ ./scripts/checkpatch.pl /tmp/patches/*.patch
total: 0 errors, 3 warnings, 412 lines checked
```

**2. Mandatory content in the commit message:**
```
arm: Add support for MyVendor MyBoard

Add initial support for the MyVendor MyBoard development board
based on the MyVendor MySoC (ARM Cortex-A9, 512MB DDR3).

Features enabled:
- DDR3 initialization at 400MHz
- UART0 console at 115200 baud
- eMMC and SD card via SDHCI
- Ethernet via GMAC
- USB OTG

Tested on hardware revision 1.1 with U-Boot 2023.10.

Signed-off-by: Your Name <your@email.com>
```

**3. Required files per submission:**
- `configs/myboard_defconfig` — defconfig
- `board/myvendor/myboard/` — board directory
- `arch/arm/dts/myboard.dts` — device tree
- `arch/arm/dts/Makefile` — add DTB to build
- `MAINTAINERS` — your entry
- `doc/board/myvendor/myboard.rst` — basic documentation

**4. CI requirements:**
U-Boot uses GitLab CI. Your board must build successfully:
```bash
# Test build locally before submitting
$ ./tools/buildman/buildman myboard_defconfig
```

---

## Interview Questions
{:.gc-iq}

**1. What are the minimum files you must create to add a new board to U-Boot?**

The minimum set is: (1) `configs/myboard_defconfig` — Kconfig configuration selecting the SoC and board; (2) `board/myvendor/myboard/board.c` — board_init, dram_init functions; (3) `board/myvendor/myboard/Makefile` — lists board.c; (4) `board/myvendor/myboard/Kconfig` — Kconfig entry; (5) `include/configs/myboard.h` — C defines not yet in Kconfig; (6) a DTS file at `arch/arm/dts/myboard.dts`. For a working SPL you additionally need DDR initialization code and pin mux configuration.

**2. What is the init sequence in U-Boot and what happens in board_init_f vs board_init_r?**

`board_init_f` is the "first phase" initialization. It runs before DRAM relocation, in the original load location (SRAM for SPL, or early DRAM for U-Boot proper). Its job is to set up the minimum necessary for relocation: configure GD (global data), set up early malloc, initialize the console, and prepare for the jump to relocated code. `board_init_r` is "second phase" after relocation. U-Boot has copied itself to its final linked address in high DRAM. Full initialization happens here: probing all DM devices, loading the environment, initializing Ethernet/USB/storage, and running `bootcmd`.

**3. How do you bring up a completely new board when you have no serial output?**

Start by verifying the hardware: check schematic for the debug UART pins, verify 3.3V level with a multimeter, and confirm the USB-UART adapter is working with a loopback test. Then verify BootROM is loading SPL by watching the SD card data lines with a logic analyzer — you should see reads shortly after power-on. If SPL is loading but producing no output, add the UART GPIO pin mux configuration before `preloader_console_init()`. If no SD reads occur, verify the MLO file is present, named correctly on a FAT partition, and boot mode pins select SD boot. As a last resort, use JTAG to halt the CPU and inspect the PC register — this tells you exactly where execution stopped.

**4. What is the role of the board header file (include/configs/BOARD.h)?**

The board header file is a C preprocessor include that defines board-specific compile-time constants not yet handled by Kconfig. It typically includes a common SoC or family header (e.g., `#include <configs/ti_armv7_common.h>`) and then overrides specific values: DRAM base address and size, serial console base address, clock frequencies, and environment offset/size values. As U-Boot's Kconfig migration progresses, more settings move from these headers to `.config`, and new board ports should minimize what they put in the header.

**5. How does U-Boot's driver model differ from how it worked before DM?**

Before DM (pre-2014), drivers were written as flat C functions with board-specific `#ifdef` guards and platform data passed through global variables or board header defines. There was no unified device abstraction. With DM, every device is a `udevice` instance bound to a `driver` through `compatible` string matching from the device tree (or platform data). Drivers use a standardized `probe/remove` lifecycle and implement typed `ops` structures (e.g., `dm_serial_ops`). This eliminates platform #ifdefs, enables device tree binding, allows multiple instances of the same peripheral, and makes the code more similar to the Linux kernel driver model.

---

## References
{:.gc-ref}

- U-Boot porting guide: `doc/README.porting` in the U-Boot source tree
- "Mastering Embedded Linux Programming" — Chris Simmonds, Chapter 3
- BeagleBone Black U-Boot port reference: `board/ti/am335x/` in U-Boot source
- U-Boot custodians and MAINTAINERS guidelines: `doc/develop/maintainer.rst`
- OpenOCD documentation for JTAG debugging: [https://openocd.org/doc/html/](https://openocd.org/doc/html/)
- U-Boot driver model documentation: `doc/driver-model/design.rst`
- U-Boot Gitlab CI documentation: `doc/develop/ci_testing.rst`
