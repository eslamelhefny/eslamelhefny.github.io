---
layout: guide
title: "printk & Dynamic Debug"
description: "Master kernel logging with printk, dev_dbg, and dynamic debug — control log levels, read crash messages, decode oops stack traces, and use netconsole for remote logging."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 07"
phase: embedded-linux-kernel
permalink: /embedded-linux/kernel/printk-debug/
prev_topic:
  title: "Kernel Subsystems"
  url: /embedded-linux/kernel/kernel-subsystems/
next_topic:
  title: "ftrace & kprobes"
  url: /embedded-linux/kernel/ftrace-kprobes/
---

## printk and Log Levels
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

`printk()` is the kernel's equivalent of `printf()`. It writes messages to the kernel ring buffer, which is a circular buffer in kernel memory. Unlike `printf()`, `printk()` works in any context — from process context, interrupt handlers, and even early boot before most of the kernel is initialized.

Every `printk()` message has a log level that indicates its severity:

```c
/* Log levels — defined in include/linux/kern_levels.h */
#define KERN_EMERG    KERN_SOH "0"  /* system is unusable */
#define KERN_ALERT    KERN_SOH "1"  /* action must be taken immediately */
#define KERN_CRIT     KERN_SOH "2"  /* critical conditions */
#define KERN_ERR      KERN_SOH "3"  /* error conditions */
#define KERN_WARNING  KERN_SOH "4"  /* warning conditions */
#define KERN_NOTICE   KERN_SOH "5"  /* normal but significant condition */
#define KERN_INFO     KERN_SOH "6"  /* informational */
#define KERN_DEBUG    KERN_DEBUG_LOC "7"  /* debug-level messages */

/* Usage in kernel code */
printk(KERN_INFO "mydriver: device initialized, base=0x%08x\n", base_addr);
printk(KERN_ERR  "mydriver: failed to allocate DMA buffer\n");
printk(KERN_DEBUG "mydriver: register dump: ctrl=0x%x status=0x%x\n",
       ctrl_reg, status_reg);
```

The log level string (`KERN_SOH "0"`) is prepended to the message as a prefix byte sequence that the kernel strips when displaying. The number 0-7 corresponds to the priority (lower number = higher priority).

---

### pr_ Helper Macros

The modern way to call `printk()` is through the `pr_*` helper macros, which are shorter and automatically include the log level:

```c
/* All of these are equivalent to printk(KERN_XXX ...) */
pr_emerg("system is completely broken: %d\n", err);    /* KERN_EMERG */
pr_alert("critical alert: power failure detected\n");  /* KERN_ALERT */
pr_crit("critical error in subsystem %s\n", name);     /* KERN_CRIT */
pr_err("failed to initialize device: %d\n", ret);      /* KERN_ERR */
pr_warn("hardware reported overtemperature\n");         /* KERN_WARNING */
pr_notice("mydriver version %s loaded\n", VERSION);    /* KERN_NOTICE */
pr_info("device %s probed at address 0x%x\n",
        dev_name(dev), reg_base);                       /* KERN_INFO */
pr_debug("entering %s, state=%d\n", __func__, state);  /* KERN_DEBUG */

/* pr_debug is special: it compiles to nothing unless CONFIG_DYNAMIC_DEBUG=y
 * or DEBUG is defined for that file */
```

---

### Reading Kernel Messages with dmesg

```bash
# Show all kernel messages in the ring buffer
$ dmesg | head -30
[    0.000000] Booting Linux on physical CPU 0x0
[    0.000000] Linux version 6.1.55 (user@build) (arm-linux-gnueabihf-gcc 11.4.0)
[    0.000000] CPU: ARMv7 Processor [410fc090] revision 0
[    0.000000] Machine model: ARM Versatile Express
[    0.000000] Memory policy: Data cache writealloc
[    0.000000] Zone ranges:
[    0.000000]   Normal   [mem 0x0000000060000000-0x000000007fffffff]
[    0.000000] Movable zone start for each node
[    0.000000] Early memory node ranges
[    0.000000]   node   0: [mem 0x0000000060000000-0x000000007fffffff]
[    0.000000] Initmem setup node 0 [mem 0x0000000060000000-0x000000007fffffff]
[    0.217568] clocksource: timer: mask: 0xffffffff max_cycles: 0xffffffff
[    0.521274] NET: Registered PF_INET protocol family
[    0.543289] mydriver: device initialized at 0x1c130000
[    0.543298] mydriver: firmware version 2.3.1

# dmesg with useful options:
$ dmesg --level=err,warn    # Show only errors and warnings
$ dmesg --follow            # Like "tail -f" for kernel messages (Ctrl+C to stop)
$ dmesg -w                  # Same as --follow (short form)
$ dmesg --clear             # Clear the ring buffer (requires root)
$ dmesg -C                  # Same as --clear

# Show messages with human-readable timestamps (absolute time):
$ dmesg -T | tail -10
[Sat Mar  7 10:23:45 2026] mydriver: device probed successfully
[Sat Mar  7 10:23:45 2026] mydriver: registered as /dev/mydev0

# Show messages since last boot with severity colors (modern util-linux):
$ dmesg --color=always --reltime | less

# Filter by keyword
$ dmesg | grep -i "error\|fail\|warn" | head -20
[    0.543105] mydriver: WARNING: DMA not available, falling back to PIO
[    1.234567] eth0: Link is Down
```

---

### Controlling Log Levels via /proc

The file `/proc/sys/kernel/printk` contains four numbers that control which messages appear on the console:

```bash
# Read current printk settings
$ cat /proc/sys/kernel/printk
4       4       1       7
# ↑       ↑       ↑       ↑
# current default minimum boot-time
# console  log     log    log
# loglevel level   level  level

# Format: current_loglevel default minimum boot-time
# current_loglevel: messages with level < this value are printed to console
# So value 4 means: EMERG(0), ALERT(1), CRIT(2), ERR(3) are shown
# WARNING(4) and above are NOT shown on console

# Enable all messages on console (including DEBUG)
$ echo "8 4 1 7" > /proc/sys/kernel/printk
# Now current_loglevel=8 means everything (0-7) appears on console

# Silence everything except emergencies
$ echo "1 4 1 7" > /proc/sys/kernel/printk

# Restore to default (show warnings and above)
$ echo "4 4 1 7" > /proc/sys/kernel/printk

# Also controllable via sysctl
$ sysctl kernel.printk
kernel.printk = 4	4	1	7
$ sysctl -w kernel.printk="7 4 1 7"    # show all messages
```

---

### Using dmesg After Module Load

```bash
# Load a module and immediately check its output
$ modprobe mydevice && dmesg | tail -20
[  123.456789] mydevice: probe called for device 0-0050
[  123.456832] mydevice: reading configuration registers
[  123.456901] mydevice: firmware version 1.4.2
[  123.456945] mydevice: device ready, irq=76

# Check for errors during driver load
$ modprobe my_broken_driver
modprobe: ERROR: could not insert 'my_broken_driver': No such device

$ dmesg | tail -5
[  234.567890] my_broken_driver: failed to request IRQ 83: -16
[  234.567894] my_broken_driver: probe failed with error -16

# -16 = -EBUSY (resource busy)
# Decode error numbers
$ python3 -c "import errno; print([k for k,v in errno.errorcode.items() if v=='EBUSY'])"
[16]
```

---

## Device-Aware Logging and Dynamic Debug
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### dev_dbg, dev_err, dev_info — Device-Aware Logging

When writing device drivers, use `dev_*` macros instead of `pr_*`. They automatically prepend the device name and bus address to every message, making it much easier to identify which device produced a message in multi-device systems:

```c
#include <linux/device.h>

static int mydevice_probe(struct platform_device *pdev)
{
    struct device *dev = &pdev->dev;

    dev_info(dev, "probing device at %pR\n", &pdev->resource[0]);
    /* Output: [    0.543] mydevice 1c130000.mydevice: probing device at [mem 0x1c130000-0x1c130fff] */

    if (error) {
        dev_err(dev, "failed to allocate IRQ: %d\n", ret);
        /* Output: [    0.544] mydevice 1c130000.mydevice: failed to allocate IRQ: -16 */
        return ret;
    }

    dev_warn(dev, "DMA not available, performance will be reduced\n");
    dev_dbg(dev, "register base = 0x%p, irq = %d\n", base, irq);
    /* dev_dbg output only appears when dynamic debug is enabled for this driver */

    return 0;
}
```

The device name format `1c130000.mydevice` comes from the Device Tree node address and compatible string — making it instantly clear which hardware instance produced the message.

---

### pr_fmt — Per-File Message Prefix

For non-device code (subsystems, core kernel), `pr_fmt()` adds a custom prefix to all `pr_*` messages in a file:

```c
/* Define at the top of the file, BEFORE including linux/printk.h */
#define pr_fmt(fmt) KBUILD_MODNAME ": " fmt

#include <linux/printk.h>
#include <linux/module.h>

/* Now all pr_* calls automatically get the module name prefix */
static int __init mymodule_init(void)
{
    pr_info("version %s loaded\n", VERSION);
    /* Output: mymodule: version 1.2.3 loaded */

    pr_debug("debugging: init_data = %d\n", init_data);
    /* Output: mymodule: debugging: init_data = 42 */

    return 0;
}
```

---

### Dynamic Debug

Dynamic debug (`CONFIG_DYNAMIC_DEBUG`) transforms all `pr_debug()` and `dev_dbg()` calls from compile-time eliminated code into runtime-toggleable messages. This is a major improvement over the traditional approach where you had to recompile the kernel with `DEBUG` defined to get debug output.

```bash
# Dynamic debug control interface
$ ls /sys/kernel/debug/dynamic_debug/
control

# Show current state of all dynamic debug sites
$ cat /sys/kernel/debug/dynamic_debug/control | head -20
# filename:lineno [module]function flags format
drivers/gpio/gpiolib.c:1234 [gpio]gpiod_request =_ "gpiod_request: %s\n"
drivers/gpio/gpiolib.c:1298 [gpio]gpiod_free =_ "gpiod_free: %s\n"
drivers/i2c/i2c-core-base.c:956 [i2c_core]i2c_register_adapter =_ "adapter [%s] registered\n"
# The '=_' means disabled (no output)
# The '=p' would mean printing enabled

# Enable all debug messages from a specific file
$ echo "file drivers/gpio/gpiolib.c +p" > /sys/kernel/debug/dynamic_debug/control

# Enable debug from a specific module
$ echo "module gpio +p" > /sys/kernel/debug/dynamic_debug/control

# Enable debug from a specific function
$ echo "func gpiod_request +p" > /sys/kernel/debug/dynamic_debug/control

# Enable debug for a specific line
$ echo "file drivers/gpio/gpiolib.c line 1234 +p" > /sys/kernel/debug/dynamic_debug/control

# Enable with additional metadata (timestamp, caller, thread)
# +p = print, +t = include timestamp, +f = include function name, +l = line number
$ echo "file drivers/gpio/gpiolib.c +ptfl" > /sys/kernel/debug/dynamic_debug/control

# Disable
$ echo "file drivers/gpio/gpiolib.c -p" > /sys/kernel/debug/dynamic_debug/control

# Enable ALL dynamic debug messages (produces a lot of output!)
$ echo "module * +p" > /sys/kernel/debug/dynamic_debug/control
```

After enabling:

```bash
$ dmesg -w | grep gpio
[   45.123456] gpio gpiolib.c:1234 gpiod_request: spi0_cs0
[   45.123498] gpio gpiolib.c:1256 gpiochip_find: looking for gpio_chip
[   45.123502] gpio gpiolib.c:1298 gpiod_request: allocated GPIO 17
```

---

### Kernel Ring Buffer Size

```bash
# The kernel ring buffer stores recent messages
# Size is controlled by CONFIG_LOG_BUF_SHIFT (2^N bytes)
# Default: CONFIG_LOG_BUF_SHIFT=17 = 128KB

$ dmesg --buffer-size
131072  # 128 KB = 2^17

# Check if messages were lost (buffer overflow)
$ dmesg | grep "messages suppressed"

# Increase ring buffer size in .config for embedded systems with verbose logging
# CONFIG_LOG_BUF_SHIFT=18   # 256KB
# CONFIG_LOG_BUF_SHIFT=20   # 1MB (for systems with lots of driver output)

# Or use kernel parameter: log_buf_len=1M
```

---

### Logging from Interrupt Context

```c
/* printk() is safe from interrupt context — it uses a separate buffer
 * and defers actual output to a separate context */
static irqreturn_t mydev_irq_handler(int irq, void *dev_id)
{
    struct mydev_data *data = dev_id;

    /* Safe in interrupt context */
    dev_dbg(data->dev, "interrupt received: status=0x%x\n", read_status(data));

    /* NOT safe in interrupt context: */
    /* msleep(), mutex_lock(), kmalloc(GFP_KERNEL) */
    /* These require process context because they can sleep */

    return IRQ_HANDLED;
}
```

---

## Advanced Debugging Techniques
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### netconsole — Kernel Messages Over UDP

When your serial console is not available (the UART is dedicated to another purpose, or the board has no serial port), `netconsole` sends kernel messages over UDP to a remote machine:

```bash
# Load the netconsole module
# Parameters: @<local-IP>/<local-interface>,<target-port>@<target-IP>/<target-MAC>
$ modprobe netconsole netconsole=@192.168.1.100/eth0,6666@192.168.1.1/ff:ff:ff:ff:ff:ff

# Or add to kernel command line (for very early messages):
netconsole=@192.168.1.100/eth0,6666@192.168.1.1/aa:bb:cc:dd:ee:ff

# On the receiving machine, listen on UDP port 6666:
$ nc -ul 6666
# Or use socat:
$ socat UDP-RECV:6666 STDOUT

# Dynamic configuration via configfs
$ mkdir /sys/kernel/config/netconsole/target1
$ echo 192.168.1.100 > /sys/kernel/config/netconsole/target1/local_ip
$ echo 192.168.1.1   > /sys/kernel/config/netconsole/target1/remote_ip
$ echo eth0          > /sys/kernel/config/netconsole/target1/dev_name
$ echo 6666          > /sys/kernel/config/netconsole/target1/remote_port
$ echo 1             > /sys/kernel/config/netconsole/target1/enabled

# Verify it's working
$ dmesg -w &     # On host: watch for kernel messages arriving over network
$ echo "test netconsole" > /dev/kmsg    # Inject a test message
```

---

### pstore — Persistent Kernel Messages After a Panic

`pstore` (persistent storage) saves the last kernel messages to non-volatile storage, allowing you to read the crash log after a reboot:

```bash
# pstore requires CONFIG_PSTORE=y and a persistent storage backend
# Common backends: EEPROM (pstore_zone), EFI variables, MTD flash

# After configuring pstore, mount it:
$ mount -t pstore pstore /sys/fs/pstore

# After a panic and reboot, read the saved log:
$ ls /sys/fs/pstore/
console-ramoops-0  dmesg-ramoops-0  dmesg-ramoops-1

$ cat /sys/fs/pstore/dmesg-ramoops-0
[12345.678901] BUG: kernel NULL pointer dereference, address: 00000000
[12345.678902] PC is at mydriver_write+0x48/0x120
[12345.678903] LR is at vfs_write+0xa4/0x1c4
...

# RAM-based pstore (ramoops): reserve a region of RAM that survives warm reset
# Kernel command line or DT: ramoops.mem_address=0x9f000000 ramoops.mem_size=0x100000
```

---

### Reading a Kernel Oops

A kernel oops is a non-fatal error that corrupts a process but does not crash the system. Understanding how to read one is an essential embedded Linux skill:

```
[  342.891234] BUG: unable to handle kernel NULL pointer dereference at 00000000
[  342.891240] pgd = d5820000
[  342.891243] [00000000] *pgd=00000000
[  342.891248] Internal error: Oops: 5 [#1] SMP ARM
[  342.891252] Modules linked in: mydriver myother_mod
[  342.891258] CPU: 0 PID: 456 Comm: myapp Not tainted 6.1.55 #1
[  342.891262] Hardware name: ARM Versatile Express
[  342.891266] task: d5820000 task.stack: d4e40000
[  342.891270] PC is at mydriver_read+0x48/0x120 [mydriver]
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                          Function + offset / function total size
[  342.891274] LR is at vfs_read+0xa4/0x1c4
[  342.891278] pc : [<bf001048>] lr : [<c04a12b4>]
[  342.891282] sp : d4e41e40  ip : 00000000  fp : d4e41e7c
[  342.891286] r10: d5820000  r9 : d4e40000  r8 : 00000000
[  342.891290] r7 : d7892a00  r6 : d4e41ea8  r5 : 00000001  r4 : 00000000
[  342.891294] r3 : 00000000  r2 : d4e41ea8  r1 : 00000001  r0 : d7892a00
[  342.891298] Flags: nZCv  IRQs on  FIQs on  Mode SVC_32  ISA ARM
[  342.891302] Process myapp (pid: 456, stack limit = 0xd4e40190)
[  342.891306] Stack:
[  342.891310] [<d4e41e40>] 0xd4e41e40
[  342.891314] Call Trace:
[  342.891318] [<bf001048>] (mydriver_read) from [<c04a12b4>] (vfs_read+0xa4/0x1c4)
[  342.891322] [<c04a12b4>] (vfs_read) from [<c04a1580>] (ksys_read+0x68/0xf0)
[  342.891326] [<c04a1580>] (ksys_read) from [<c04a15e8>] (sys_read+0x10/0x14)
[  342.891330] [<c04a15e8>] (sys_read) from [<c0107580>] (ret_fast_syscall+0x0/0x28)
```

Reading the oops:
1. "NULL pointer dereference at 00000000" — a NULL pointer was dereferenced
2. "PC is at mydriver_read+0x48/0x120" — crash is 0x48 bytes into `mydriver_read()`
3. "r4 : 00000000" — register r4 is NULL (likely the pointer being dereferenced)
4. The call trace shows: `sys_read → ksys_read → vfs_read → mydriver_read` (crash)

---

### addr2line — Decoding Oops Addresses

```bash
# Convert the crash address to a source line
# Need: vmlinux with debug info (CONFIG_DEBUG_INFO=y)
# and the module .ko file with debug info

# For a built-in function (in vmlinux):
$ addr2line -e vmlinux -f 0xc04a12b4
vfs_read
/home/user/linux/fs/read_write.c:469

# For a module function (PC is at mydriver_read+0x48):
# First, find the load address of the module symbol
$ grep mydriver_read /proc/kallsyms
bf001000 t mydriver_read [mydriver]

# Then: function_start(0xbf001000) + offset(0x48) = 0xbf001048
$ addr2line -e drivers/misc/mydriver/mydriver.ko -f 0x48
mydriver_read
/home/user/linux/drivers/misc/mydriver/mydriver.c:87

# Now you know exactly which line crashed: mydriver.c:87
# cat drivers/misc/mydriver/mydriver.c | sed -n '85,90p'
85: static ssize_t mydriver_read(struct file *filp, char __user *buf,
86:     size_t count, loff_t *ppos)
87:     return copy_to_user(buf, priv->data_ptr, count);  /* BUG: priv->data_ptr is NULL */
88: }
```

---

### trace_printk — Low-Overhead Logging in Hot Paths

Regular `printk()` is expensive in high-frequency code paths (interrupt handlers, network receive paths) because it writes to the ring buffer under a lock. `trace_printk()` writes to the ftrace ring buffer instead, which is per-CPU and lock-free:

```c
#include <linux/kernel.h>

/* In a hot path like an interrupt handler */
static irqreturn_t fast_irq_handler(int irq, void *data)
{
    u32 status = readl(base + STATUS_REG);

    /* printk here would cause latency issues — avoid in production */
    /* printk(KERN_DEBUG "irq status=0x%x\n", status); */

    /* trace_printk writes to ftrace ring buffer — much lower overhead */
    trace_printk("irq status=0x%x\n", status);

    return IRQ_HANDLED;
}
```

```bash
# Read trace_printk output via tracefs
$ cat /sys/kernel/debug/tracing/trace | head -20
# tracer: nop
#
# entries-in-buffer/entries-written: 1024/1024   #P:4
#
#                              _-----=> irqs-off
#                             / _----=> need-resched
#                            | / _---=> hardirq/softirq
#                            || / _--=> preempt-depth
#                            ||| /     delay
#           TASK-PID   CPU#  ||||    TIMESTAMP  FUNCTION
#              | |       |   ||||       |         |
        myapp-456   [000] d...  1234.567890: fast_irq_handler: irq status=0x00000001
        myapp-456   [000] d...  1234.567894: fast_irq_handler: irq status=0x00000002
```

---

### Integrating with systemd Journal

On systems with systemd, kernel messages are automatically forwarded to the journal via `/dev/kmsg`:

```bash
# Read kernel messages via journalctl
$ journalctl -k            # all kernel messages since boot
$ journalctl -k -b -1      # kernel messages from the previous boot
$ journalctl -k -p err     # only kernel error messages
$ journalctl -k -f         # follow new kernel messages (like dmesg -w)
$ journalctl -k --since "10 minutes ago"

# Kernel messages appear with _TRANSPORT=kernel
$ journalctl -k -o json | python3 -m json.tool | head -30

# Persist kernel logs across reboots (journald by default uses volatile storage)
$ mkdir -p /var/log/journal  # Create this directory to enable persistence
$ systemctl restart systemd-journald
```

---

## Interview Questions
{:.gc-iq}

**Q: What are the kernel log levels and how do you control which ones appear on the console?**

Linux has 8 log levels numbered 0-7: KERN_EMERG(0), KERN_ALERT(1), KERN_CRIT(2), KERN_ERR(3), KERN_WARNING(4), KERN_NOTICE(5), KERN_INFO(6), KERN_DEBUG(7). Lower numbers are higher priority. The file `/proc/sys/kernel/printk` contains four values; the first is the "console loglevel". Messages with a priority number strictly less than this value are printed to the console. So with the default value of 4, only EMERG, ALERT, CRIT, and ERR appear on the console. Set it to 8 to see all messages including DEBUG: `echo "8 4 1 7" > /proc/sys/kernel/printk`. All messages regardless of level are always written to the ring buffer and readable with `dmesg`.

**Q: What is dynamic debug and how is it more flexible than pr_debug()?**

Without `CONFIG_DYNAMIC_DEBUG`, `pr_debug()` calls are completely compiled out of the binary (unless `DEBUG` is defined for that compilation unit), making them unavailable at runtime. With `CONFIG_DYNAMIC_DEBUG`, all `pr_debug()` and `dev_dbg()` calls are kept in the binary but disabled. They can be enabled at runtime on a per-file, per-module, per-function, or per-line granularity by writing to `/sys/kernel/debug/dynamic_debug/control`. This means you can enable debug output from a specific driver on a running production system without recompiling, rebooting, or enabling all debug messages globally. You can also add metadata like timestamps and function names: `echo "file drivers/gpio/gpiolib.c +ptfl" > /sys/kernel/debug/dynamic_debug/control`.

**Q: What is the difference between pr_debug() and dev_dbg()?**

`pr_debug()` is a generic file-scoped debug macro. It does not include any device context — the output just shows the raw message with the file prefix (if `pr_fmt()` is defined). `dev_dbg(dev, ...)` takes a `struct device *` as the first argument and automatically prepends the device name and address to every message (e.g., `mydevice 1c130000.mydevice: message`). In a system with multiple instances of the same driver, `dev_dbg()` makes it immediately clear which hardware instance generated each message. The rule is: use `dev_dbg()` in device drivers (which always have a `struct device *`), and `pr_debug()` in core kernel code that is not tied to a specific device.

**Q: How do you keep kernel messages visible after a kernel panic?**

Several approaches: (1) Enable `CONFIG_PSTORE` with a persistent storage backend (ramoops for RAM-based, or EFI variables) — messages are saved automatically on panic and readable after reboot from `/sys/fs/pstore/`. (2) Use `netconsole` to send kernel messages over UDP to a remote machine in real time — since the network stack is typically still running when the panic occurs, the crash log arrives at the remote machine before the system reboots. (3) Use a JTAG debugger with hardware breakpoint on the panic handler — the debugger stops execution and you can read memory directly. (4) For UART console, add `panic=0` to prevent reboot and keep the panic message on screen.

**Q: How do you decode a kernel oops/stack trace to find the crashing line of code?**

First, identify the crashing function and offset from the oops: "PC is at mydriver_read+0x48/0x120 [mydriver]". Then use `addr2line`: for built-in functions, run `addr2line -e vmlinux -f <absolute_address>`; for module functions, find the module symbol base address in `/proc/kallsyms` (e.g., `bf001000 t mydriver_read [mydriver]`) and run `addr2line -e mydriver.ko -f 0x48` (using the relative offset). This requires that the kernel/module was built with `CONFIG_DEBUG_INFO=y`. The output is the exact source file and line number where the crash occurred. On modern kernels, the oops output itself often includes the source file and line directly.

**Q: What is netconsole and when would you use it?**

Netconsole is a kernel feature that sends kernel log messages over UDP to a remote machine in real time, bypassing the need for a physical serial console. It is used when: (1) The board has no serial port or the UART is used for another purpose. (2) You need to capture kernel panic messages before the system reboots (since the network stack is running when the panic occurs). (3) You need to debug a device in the field remotely without physical access. (4) The serial connection is too slow or introduces latency that affects the behavior being debugged. Configure it at boot via kernel command line or with `modprobe netconsole netconsole=@<local-IP>/<iface>,<port>@<remote-IP>/<remote-MAC>`.

---

## References
{:.gc-ref}

- **Dynamic debug documentation:** `Documentation/admin-guide/dynamic-debug-howto.rst` — complete guide to dynamic debug syntax and capabilities
- **"Linux Device Drivers" by Corbet, Rubini, and Kroah-Hartman** (Chapter 4: Debugging Techniques) — printk, oops analysis, and debug techniques: [https://lwn.net/Kernel/LDD3/](https://lwn.net/Kernel/LDD3/)
- **"Linux Kernel Development" by Robert Love** — kernel debugging and printk usage
- **Kernel parameter loglevel:** `Documentation/admin-guide/kernel-parameters.txt` — loglevel, ignore_loglevel, debug parameters
- **netconsole documentation:** `Documentation/networking/netconsole.rst` — complete netconsole setup guide
- **pstore documentation:** `Documentation/admin-guide/pstore-blk.rst` — persistent storage for crash messages
- **LWN.net Dynamic Debug article:** [https://lwn.net/Articles/434833/](https://lwn.net/Articles/434833/) — original dynamic debug introduction
