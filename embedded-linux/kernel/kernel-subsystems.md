---
layout: guide
title: "Kernel Subsystems"
description: "Explore the major Linux kernel subsystems — VFS, memory management, scheduler, network stack, and the device model — understanding how they work and how to inspect them at runtime."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 07"
phase: embedded-linux-kernel
permalink: /embedded-linux/kernel/kernel-subsystems/
prev_topic:
  title: "Boot Parameters"
  url: /embedded-linux/kernel/boot-parameters/
next_topic:
  title: "printk & Dynamic Debug"
  url: /embedded-linux/kernel/printk-debug/
---

## The Linux Kernel Architecture
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

The Linux kernel is a **monolithic kernel** — all kernel subsystems run in the same address space (kernel space) with direct access to each other's functions and data. This is in contrast to a **microkernel** (like Mach or L4) where each kernel service runs in its own isolated process, communicating via message passing.

```
User Space
┌─────────────┬──────────────┬─────────────┬──────────────┐
│   Shell /   │  Web Server  │   Database  │  Media Player│
│   Init      │  (nginx)     │  (sqlite)   │  (gstreamer) │
└──────┬──────┴──────┬───────┴──────┬──────┴──────┬───────┘
       │ System Calls (open, read, write, fork, ioctl...)
═══════╪═════════════╪══════════════╪═════════════╪═══════════
Kernel Space
┌──────┴──────────────┴──────────────┴─────────────┴───────┐
│                   System Call Interface                    │
├─────────┬──────────┬──────────────┬──────────────────────┤
│   VFS   │    MM    │   Process    │    Network Stack      │
│(Virtual │(Memory   │  Scheduler   │ (TCP/IP, Netfilter,   │
│File Sys)│ Mgmt)    │    (CFS)     │  sockets, drivers)   │
├─────────┴──────────┴──────────────┴──────────────────────┤
│              Device Driver Framework                       │
│  (platform bus, PCI, I2C, SPI, USB, block, char, net)    │
├──────────────────────────────────────────────────────────┤
│              Architecture-Specific Code (arch/)            │
│    (CPU init, interrupt handling, memory mapping, DMA)    │
└──────────────────────────────────────────────────────────┘
Hardware: CPUs, RAM, NAND, UART, Ethernet, I2C sensors, USB...
```

---

### Key Subsystems Overview

| Subsystem | Source Dir | Purpose |
|-----------|-----------|---------|
| Virtual Filesystem (VFS) | `fs/` | Unified file operation API for all filesystems |
| Memory Management (MM) | `mm/` | Physical pages, virtual memory, allocators |
| Process Scheduler | `kernel/sched/` | CPU time allocation between tasks |
| Network Stack | `net/` | TCP/IP, sockets, Netfilter, wireless |
| Device Drivers | `drivers/` | Hardware abstraction for all peripherals |
| Interrupt Subsystem | `kernel/irq/` | IRQ routing, interrupt controllers |
| Timers | `kernel/time/` | High-resolution timers, timekeeping |
| Block Layer | `block/` | Storage I/O scheduling and queuing |

---

### /proc and /sys as Windows Into the Kernel

The two most important virtual filesystems for inspecting kernel state:

```bash
# /proc — process information and kernel state
$ ls /proc/
1/    buddyinfo   cpuinfo    filesystems  iomem    kpagecgroup  meminfo
2/    bus/        crypto     fs/          ioports  kpagecount   misc
...

# Useful /proc files:
$ cat /proc/cpuinfo | head -20
processor	: 0
model name	: ARMv7 Processor rev 0 (v7l)
BogoMIPS	: 463.07
Features	: half thumb fastmult vfp edsp neon vfpv3 tls vfpv4
CPU implementer	: 0x41
CPU architecture: 7
CPU variant	: 0x0
CPU part	: 0xc09
CPU revision	: 0

$ cat /proc/meminfo | head -10
MemTotal:         500480 kB
MemFree:          412304 kB
MemAvailable:     394084 kB
Buffers:            2312 kB
Cached:            43780 kB
SwapCached:            0 kB

$ cat /proc/interrupts
           CPU0       CPU1
  17:     10234       8921  GIC-0  29 Level     arch_timer
  44:       512          0  GIC-0  44 Level     eth0
  57:      1024          0  GIC-0  57 Level     mmc0

# /sys — device model and kernel object hierarchy
$ ls /sys/
block/  bus/  class/  dev/  devices/  firmware/  fs/  kernel/  module/  power/

# Navigate the device hierarchy
$ ls /sys/bus/i2c/devices/
0-0050  0-0068  1-0018  2-0040

# View a device's properties
$ cat /sys/bus/i2c/devices/0-0050/name
24c256
```

---

### The Linux Driver Model: Buses, Devices, and Drivers

The Linux driver model is built on three concepts:

```
Bus (e.g., I2C bus)
├── Device (e.g., i2c-0-0050: AT24 EEPROM at address 0x50)
│   └── Matched to Driver (e.g., at24 driver)
├── Device (e.g., i2c-0-0068: RTC at address 0x68)
│   └── Matched to Driver (e.g., ds1307 driver)
└── ...
```

**Matching** happens automatically: when a device is registered on a bus, the kernel searches all registered drivers for that bus to find one whose `id_table` or `of_match_table` matches the device's identifier. When a match is found, the driver's `probe()` function is called.

```bash
# See what drivers are bound to which devices
$ ls /sys/bus/i2c/drivers/
at24/  ds1307/  bmp280/  lis3lv02d/

# Which devices are bound to the at24 driver
$ ls /sys/bus/i2c/drivers/at24/
0-0050 -> ../../../../devices/platform/soc/i2c@12080000/i2c-0/0-0050/
bind  uevent  unbind

# Manually unbind a driver from a device
$ echo "0-0050" > /sys/bus/i2c/drivers/at24/unbind

# Manually bind a driver to a device
$ echo "0-0050" > /sys/bus/i2c/drivers/at24/bind
```

---

## VFS, MM, and Scheduler Internals
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Virtual Filesystem (VFS)

VFS is an abstraction layer that provides a uniform interface to all filesystems. When a userspace program calls `open("/etc/passwd", O_RDONLY)`, it goes through VFS which routes the call to the appropriate filesystem (ext4, NFS, tmpfs, etc.).

Key VFS data structures:

```c
/* superblock: represents a mounted filesystem */
struct super_block {
    struct list_head    s_list;         /* list of all superblocks */
    dev_t               s_dev;          /* device identifier */
    unsigned long       s_blocksize;    /* block size in bytes */
    const struct super_operations *s_op; /* filesystem operations */
    struct dentry       *s_root;        /* root dentry */
    /* ... */
};

/* inode: represents a file or directory (unique per filesystem object) */
struct inode {
    umode_t             i_mode;         /* file type and permissions */
    unsigned short      i_opflags;
    kuid_t              i_uid;          /* owner UID */
    kgid_t              i_gid;          /* owner GID */
    loff_t              i_size;         /* file size in bytes */
    struct timespec64   i_atime;        /* access time */
    struct timespec64   i_mtime;        /* modification time */
    const struct inode_operations *i_op; /* inode operations */
    const struct file_operations  *i_fop; /* file operations */
    /* ... */
};

/* dentry: represents a directory entry (maps name to inode) */
struct dentry {
    struct inode        *d_inode;       /* associated inode */
    struct dentry       *d_parent;      /* parent directory */
    struct qstr         d_name;         /* name of this entry */
    const struct dentry_operations *d_op;
    /* ... */
};

/* file: represents an open file (one per open() call) */
struct file {
    struct dentry       *f_path.dentry;
    struct inode        *f_inode;
    const struct file_operations *f_op;
    loff_t              f_pos;          /* current file position */
    unsigned int        f_flags;        /* O_RDONLY, O_WRONLY, etc. */
    /* ... */
};
```

The call chain for `read()`:
```
User: read(fd, buf, count)
  → sys_read() [fs/read_write.c]
    → vfs_read()
      → file->f_op->read_iter()   [dispatch to filesystem]
        → ext4_file_read_iter()   [ext4 implementation]
          → generic_file_read_iter()
            → ext4_readpage()     [actual disk I/O]
```

---

### Memory Management

The MM subsystem manages all of the system's physical and virtual memory:

```bash
# Physical memory view
$ cat /proc/meminfo
MemTotal:         500480 kB     # Total physical RAM
MemFree:          412304 kB     # Unused RAM
MemAvailable:     394084 kB     # Actually available (includes reclaimable)
Buffers:            2312 kB     # Block device buffers
Cached:            43780 kB     # Page cache (file data)
Slab:              12840 kB     # Kernel slab allocator (kmalloc objects)
PageTables:         1024 kB     # Page table memory
AnonPages:         28416 kB     # Anonymous (heap/stack) pages
Mapped:            18432 kB     # Memory-mapped files (mmap)

# Per-process memory map
$ cat /proc/1234/maps
00400000-00452000 r-xp 00000000 08:01 123456  /usr/bin/myapp  [text segment]
00651000-00652000 r--p 00051000 08:01 123456  /usr/bin/myapp  [read-only data]
00652000-00654000 rw-p 00052000 08:01 123456  /usr/bin/myapp  [data segment]
b6e00000-b6e21000 r-xp 00000000 08:01 789012  /lib/libc.so.6
b7200000-b7204000 rw-p 00000000 00:00 0       [heap]
bff00000-bff21000 rwxp 00000000 00:00 0       [stack]
```

Key MM concepts:

| Concept | Description |
|---------|-------------|
| Physical page | The basic unit of physical memory (typically 4KB) |
| VMA (vm_area_struct) | Describes a contiguous virtual memory region |
| mm_struct | Per-process memory descriptor (page tables, VMAs) |
| Page tables | Hardware structures mapping virtual to physical addresses |
| kmalloc | Kernel heap allocator — physically contiguous, max ~4MB |
| vmalloc | Kernel virtual allocator — virtually contiguous, can be larger |

```c
/* kmalloc: physically contiguous — required for DMA */
void *buf = kmalloc(4096, GFP_KERNEL);
kfree(buf);

/* vmalloc: virtually contiguous — for large kernel buffers */
void *large_buf = vmalloc(1 * 1024 * 1024);  /* 1MB */
vfree(large_buf);

/* The key difference:
 * kmalloc: physical addresses are contiguous — DMA hardware can use it
 * vmalloc: only virtual addresses are contiguous — DO NOT use for DMA
 */
```

---

### Completely Fair Scheduler (CFS)

The Linux scheduler is based on the CFS algorithm. Key concepts:

```bash
# View scheduler statistics
$ cat /proc/schedstat
# Per-CPU scheduling statistics

# See process scheduling info
$ cat /proc/1234/sched
myapp (1234, #threads: 1)
---
se.exec_start                      :       1234567.890123
se.sum_exec_runtime                :         12345.678901
se.nr_migrations                   :                    0
nr_switches                        :                  567
nr_voluntary_switches              :                  234
nr_involuntary_switches            :                  333
se.load.weight                     :                 1024
se.runnable_weight                 :                 1024
policy                             :                    0    # SCHED_NORMAL
prio                               :                  120   # default nice=0
clock-delta                        :                   45

# Real-time priority
$ chrt -p 1234   # Show scheduling policy
pid 1234's current scheduling policy: SCHED_OTHER
pid 1234's current scheduling priority: 0
```

CFS maintains a red-black tree of runnable tasks sorted by `vruntime` (virtual runtime). The task with the smallest `vruntime` (has run the least) is always scheduled next. Nice values adjust how fast `vruntime` accumulates — a nice=-20 (highest priority) process's vruntime grows more slowly, so it gets to run more often.

---

### fork() and exec() Internally

```c
/* How fork() works (simplified) */
/* 1. Allocate new task_struct for child */
/* 2. Copy parent's memory descriptors (mm_struct) */
/*    With COW (Copy-on-Write): both parent and child share pages */
/*    marked read-only; page fault triggers actual copy */
/* 3. Copy parent's file descriptor table */
/* 4. Copy parent's signal handlers */
/* 5. Add child to scheduler run queue */

/* How exec() works (simplified) */
/* 1. Load executable format (ELF parser in fs/binfmt_elf.c) */
/* 2. Parse ELF headers: LOAD segments, entry point, interpreter */
/* 3. Map ELF segments into new mm_struct */
/* 4. Set up stack with argv, envp */
/* 5. If dynamically linked, map ld.so and hand control to it */
/* 6. Jump to entry point (or ld.so) */

/* COW in action */
$ strace -e clone fork_test 2>&1 | grep clone
clone(child_stack=NULL, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD,
      child_tidptr=0xb6f45a90) = 1235
```

---

### kobjects and the Device Model Hierarchy

`kobject` is the fundamental kernel object that provides reference counting and integration with sysfs:

```c
/* Every device in the kernel is represented as a kobject */
struct kobject {
    const char          *name;
    struct list_head    entry;
    struct kobject      *parent;    /* parent in /sys hierarchy */
    struct kset         *kset;
    const struct kobj_type *ktype;
    struct kernfs_node  *sd;        /* sysfs directory */
    struct kref         kref;       /* reference count */
};

/* struct device wraps kobject */
struct device {
    struct kobject kobj;
    struct device *parent;
    const char *init_name;
    const struct device_type *type;
    struct bus_type *bus;
    struct device_driver *driver;
    void *driver_data;
    /* ... */
};
```

```bash
# The /sys tree mirrors the kobject hierarchy
$ tree /sys/devices/platform/ | head -20
/sys/devices/platform/
├── Fixed MDIO bus.0
│   ├── mdio_bus
│   │   └── Fixed MDIO Bus
│   │       └── fixed-0:00
│   ├── modalias
│   └── uevent
├── i2c@12080000
│   ├── driver -> ../../../bus/platform/drivers/i2c-s3c2410
│   ├── i2c-0
│   │   └── 0-0050
│   │       ├── driver -> ../../../../bus/i2c/drivers/at24
│   │       └── modalias
```

---

## Advanced Subsystem Internals
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Kernel Locking: Spinlocks, Mutexes, and RCU

Linux has multiple synchronization primitives, each suited to different contexts:

```c
#include <linux/spinlock.h>
#include <linux/mutex.h>
#include <linux/rcupdate.h>

/* Spinlock: busy-waits, can be used in interrupt context */
static DEFINE_SPINLOCK(my_lock);

void my_irq_handler(int irq, void *data)
{
    unsigned long flags;
    spin_lock_irqsave(&my_lock, flags);  /* disable local IRQs + lock */
    /* critical section */
    spin_unlock_irqrestore(&my_lock, flags);
}

/* Mutex: sleeps when contended, CANNOT be used in interrupt context */
static DEFINE_MUTEX(my_mutex);

int my_open(struct inode *inode, struct file *filp)
{
    mutex_lock(&my_mutex);      /* may sleep */
    /* critical section */
    mutex_unlock(&my_mutex);
    return 0;
}

/* RCU (Read-Copy-Update): lockless reads, copy-modify-replace writes */
struct my_data {
    struct rcu_head rcu;
    int value;
};
static struct my_data __rcu *global_data;

/* Reader: no lock needed, just RCU read-side critical section */
void reader(void)
{
    struct my_data *data;
    rcu_read_lock();
    data = rcu_dereference(global_data);
    if (data)
        pr_info("value: %d\n", data->value);
    rcu_read_unlock();
}

/* Writer: allocate new copy, update, wait for readers, free old */
void writer(int new_value)
{
    struct my_data *new, *old;
    new = kmalloc(sizeof(*new), GFP_KERNEL);
    new->value = new_value;
    old = rcu_dereference_protected(global_data, lockdep_is_held(&my_mutex));
    rcu_assign_pointer(global_data, new);
    if (old)
        kfree_rcu(old, rcu);  /* free after all readers are done */
}
```

RCU is the kernel's most scalable synchronization mechanism. It allows an unlimited number of concurrent readers with zero overhead (just memory barriers) while writers create a new copy of the data, atomically switch the pointer, and then free the old copy after a "grace period" in which all pre-existing readers have finished.

---

### Memory Allocators: SLAB/SLUB/SLOB

```bash
# View slab allocator statistics
$ cat /proc/slabinfo | head -20
slabinfo - version: 2.1
# name            <active_objs> <num_objs> <objsize> <objperslab> <pagesperslab>
kmalloc-8192          68        68       8192        4    8
kmalloc-4096         124       124       4096        8    8
kmalloc-2048         298       340       2048       16    8
kmalloc-1024         688       720       1024       32    8
kmalloc-512          896      1008        512       32    4
kmalloc-256         1424      1792        256       32    2
kmalloc-192         1890      2016        192       21    1
kmalloc-128         2124      2368        128       32    1
kmalloc-96           756       756         96       42    1
kmalloc-64          4328      4992         64       64    1
kmalloc-32          2560      3072         32      128    1
task_struct          512       512       3840        8    8
mm_struct            234       234       1216       26    8
files_cache          156       156        832       49    1

# Total slab memory
$ awk '/^Total/{print $2}' /proc/slabinfo 2>/dev/null || \
  grep Slab /proc/meminfo
Slab:              12840 kB
```

SLUB (the default since 2.6.23) improves over SLAB by reducing per-slab overhead and simplifying the allocator. SLOB is a tiny allocator for systems with very limited RAM (< 4MB).

---

### DMA Subsystem

```c
#include <linux/dma-mapping.h>

/* Coherent DMA: CPU and device see the same data (cache coherent) */
/* Use for control structures, small buffers */
dma_addr_t dma_handle;
void *cpu_addr = dma_alloc_coherent(dev, size, &dma_handle, GFP_KERNEL);
/* cpu_addr: CPU virtual address */
/* dma_handle: physical address to give to the device */
dma_free_coherent(dev, size, cpu_addr, dma_handle);

/* Streaming DMA: for large data transfers (e.g., network packets, video frames) */
dma_addr_t dma_addr = dma_map_single(dev, cpu_buf, size, DMA_TO_DEVICE);
/* device performs DMA transfer... */
dma_unmap_single(dev, dma_addr, size, DMA_TO_DEVICE);

/* Scatter-Gather: for non-contiguous memory regions */
struct scatterlist sg[10];
sg_init_table(sg, 10);
sg_set_page(&sg[0], page0, PAGE_SIZE, 0);
sg_set_page(&sg[1], page1, PAGE_SIZE, 0);
int n = dma_map_sg(dev, sg, 10, DMA_FROM_DEVICE);
/* device fills multiple non-contiguous buffers in one DMA operation */
dma_unmap_sg(dev, sg, 10, DMA_FROM_DEVICE);
```

---

### Interrupt Subsystem: IRQ Domains and GIC

```bash
# View interrupt assignments
$ cat /proc/interrupts
           CPU0       CPU1       CPU2       CPU3
 17:     134821     134821     134821     134821  GIC-0  29 Level     arch_timer
 44:       8192          0          0          0  GIC-0  44 Level     eth0
 57:       2048          0          0          0  GIC-0  57 Level     mmc0
 83:        512          0          0          0  GIC-0  83 Level     i2c-0
IPI0:         0          0          0          0  Rescheduling interrupts
IPI1:      1024        512        256        128  Function call interrupts

# IRQ domain hierarchy for ARM GIC (Generic Interrupt Controller)
# Hardware IRQ -> GIC irq_domain -> Linux IRQ number -> handler
# Device Tree specifies: interrupts = <GIC_SPI 44 IRQ_TYPE_LEVEL_HIGH>;
# This maps hardware SPI 44 to a Linux IRQ number (e.g., 76)

# View IRQ affinities (which CPUs handle which IRQs)
$ cat /proc/irq/44/smp_affinity
f   # binary 1111 = CPUs 0,1,2,3

# Pin an IRQ to a specific CPU
$ echo 4 > /proc/irq/44/smp_affinity   # binary 0100 = CPU2 only
```

---

### Workqueue Internals

```c
/* Workqueues allow deferred work from interrupt context */
#include <linux/workqueue.h>

struct my_driver_data {
    struct work_struct  work;
    /* ... */
};

/* Work function executes in process context (can sleep) */
static void my_work_handler(struct work_struct *work)
{
    struct my_driver_data *data =
        container_of(work, struct my_driver_data, work);
    /* Safe to sleep here, allocate memory, call blocking APIs */
    msleep(10);
    pr_info("work executed in process context\n");
}

/* From interrupt context: schedule the work */
static irqreturn_t my_irq_handler(int irq, void *devid)
{
    struct my_driver_data *data = devid;
    schedule_work(&data->work);    /* deferred to kernel worker thread */
    return IRQ_HANDLED;
}
```

```bash
# View kernel worker threads (kworker)
$ ps aux | grep kworker | head -10
root         5  0.0  0.0      0     0 ?        S    09:00   0:00 [kworker/0:0H-kblockd]
root         6  0.0  0.0      0     0 ?        I    09:00   0:00 [kworker/0:0-events]
root        10  0.0  0.0      0     0 ?        I    09:00   0:00 [kworker/1:0-events]
root        14  0.0  0.0      0     0 ?        I    09:00   0:00 [kworker/2:0-events]
# kworker/N:M — N = CPU number, M = thread index
# kworker/0:0H — high-priority bound kworker on CPU 0
# unbound kworkers (kworker/u8:0) are not CPU-pinned
```

---

### Network Stack: sk_buff (skb)

The `sk_buff` (socket buffer) is the fundamental data structure that carries network packets through the kernel's network stack:

```
Packet flow through the network stack (receiving):

NIC hardware DMA → sk_buff allocated
                      │
                  netif_receive_skb()        [Device driver → net core]
                      │
                  ip_rcv()                   [L3: IP layer]
                      │
               ┌──────┴──────┐
               │             │
           tcp_v4_rcv()   udp_rcv()          [L4: TCP/UDP]
               │
           sk->sk_receive_queue              [Socket receive buffer]
               │
           userspace: recv()/read()          [Copy to user]

# Transmit path is the reverse
```

```bash
# View network stack statistics
$ cat /proc/net/dev
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs
    lo: 12345   100    0    0    0     0          0         0     12345   100    0
  eth0: 1048576  8192   0    0    0     0          0         0    524288  4096   0

# Socket buffer sizes
$ sysctl net.core.rmem_max
net.core.rmem_max = 212992
$ sysctl net.core.wmem_max
net.core.wmem_max = 212992

# View active connections with kernel buffer info
$ ss -tmn | head -10
State  Recv-Q  Send-Q  Local Address:Port  Peer Address:Port
ESTAB  0       0       192.168.1.100:22    192.168.1.1:54321
```

---

### Exploring Subsystems at Runtime

```bash
# Memory: buddyinfo shows free pages per order in each zone
$ cat /proc/buddyinfo
Node 0, zone   Normal      0      1      2      3      4      5      6      7      8      9     10
# Each column = count of free blocks of 2^N pages

# Slab info
$ cat /proc/slabinfo | grep "^kmalloc"

# Interrupt controller details
$ cat /proc/interrupts
$ cat /sys/kernel/irq/*/chip_name

# Kernel debug filesystem (requires CONFIG_DEBUG_FS)
$ mount -t debugfs none /sys/kernel/debug
$ ls /sys/kernel/debug/
bdi  block  clk  dma_buf  gpio  hid  iommu  mmc0  regmap  regulator  tracing

# GPIO state
$ cat /sys/kernel/debug/gpio
gpiochip0: GPIOs 0-31, parent: platform/gpio@12000000, gpio-myboard:
 gpio-0   (                    ) in  hi
 gpio-1   (LED                 ) out lo
 gpio-2   (BUTTON              ) in  hi IRQ
 gpio-3   (                    ) in  lo

# Clock tree
$ cat /sys/kernel/debug/clk/clk_summary | head -20
                                 enable  prepare  protect                    rate  accuracy  phase
                                  count    count    count                        (Hz)      (ppb) (degrees)
------------------------------------------------------------------------------
osc24M                                 1        1        0                24000000         0          0
   pll-cpux                            1        1        0               816000000         0          0
      cpux                             1        1        0               816000000         0          0
   pll-ddr                             1        1        0              1200000000         0          0
      ddr                              1        1        0               600000000         0          0
```

---

## Interview Questions
{:.gc-iq}

**Q: What is the Virtual Filesystem (VFS) and why does it exist?**

VFS is an abstraction layer in the kernel that provides a single, unified API for file operations (open, read, write, close, stat, etc.) regardless of the underlying filesystem implementation. It exists because Linux supports many filesystems (ext4, btrfs, NFS, tmpfs, FAT32, etc.) and applications should not need to know which one is in use. VFS defines a set of operations (through `file_operations`, `inode_operations`, and `super_operations` structures with function pointers) that each filesystem implements. When a program calls `read()`, VFS dispatches to `ext4_file_read_iter()` or `nfs_file_read()` as appropriate.

**Q: What is the difference between kmalloc and vmalloc?**

`kmalloc` allocates physically contiguous memory from the kernel's SLAB/SLUB allocator. The allocated memory has a direct linear mapping to physical memory. It is limited in size (typically up to ~4MB) but is the correct choice for DMA buffers since DMA hardware needs physically contiguous memory. `vmalloc` allocates virtually contiguous memory that may be physically fragmented — it uses the kernel's vmalloc area with its own page tables. It can allocate much larger buffers but introduces TLB pressure and cannot be used for DMA. Use `kmalloc` by default; use `vmalloc` only when you need a large buffer that does not need to be DMA-able.

**Q: How does the Linux driver model work — what is the relationship between bus, device, and driver?**

The Linux driver model has three components: a `bus_type` (e.g., I2C bus, PCI bus, platform bus) that knows how to match devices to drivers; `device` structures representing hardware instances (added when hardware is discovered via Device Tree, ACPI, or enumeration); and `device_driver` structures representing drivers (registered when kernel modules are loaded). When a new device is registered on a bus, or when a new driver registers for a bus, the bus's `match()` function is called for all driver-device pairs. When a match is found, the driver's `probe()` function is called. This decoupling allows drivers to work with any matching device and devices to be hot-plugged.

**Q: What is RCU (Read-Copy-Update) and what problem does it solve?**

RCU solves the problem of efficiently protecting data that is read very frequently but written rarely. Traditional locking forces readers to acquire a lock, which creates contention on busy multi-core systems. RCU allows readers to proceed completely lock-free with only memory barriers. Writers create a new copy of the data structure, make their modifications, then atomically publish the new version by updating a pointer. After all pre-existing readers finish their read-side critical sections (the "grace period"), the old version is freed. RCU is used extensively for routing tables, security policy lists, file system mounts, and process credential lookups — all of which are read millions of times per second.

**Q: How does the scheduler work in Linux at a high level (CFS)?**

The Completely Fair Scheduler (CFS) aims to give every runnable process an equal share of the CPU. It maintains a red-black tree of runnable processes sorted by `vruntime` (virtual runtime — how much CPU time the process has consumed, weighted by priority). The scheduler always picks the process with the smallest `vruntime` (the one that has received the least CPU time). When a process runs, its `vruntime` increases. Nice values (-20 to +19) affect how fast `vruntime` grows: a high-priority (nice=-20) process's vruntime grows slowly so it gets selected more often. Real-time tasks use separate scheduling classes (SCHED_FIFO, SCHED_RR) that preempt all CFS tasks.

**Q: What is an sk_buff and what is its role in the network stack?**

`sk_buff` (socket buffer, commonly `skb`) is the kernel's data structure that carries network packets through the entire network stack. It contains pointers to the packet data along with metadata: protocol type, interface it arrived on, timestamps, checksum offload status, and pointers to various protocol headers. As a packet travels up the receiving path (driver → IP layer → TCP layer → socket), header pointers are advanced and the `skb` is passed between layers without copying the data. The same structure is used for transmitting packets. The sk_buff design avoids memory copies and allows in-place header manipulation, which is critical for network performance.

**Q: How do you explore kernel subsystem state at runtime?**

The primary interfaces are: `/proc/` for traditional kernel statistics (meminfo, interrupts, net/dev, slabinfo, buddyinfo); `/sys/` for the device model hierarchy (buses, devices, drivers) and kobject-based subsystem state; `/sys/kernel/debug/` (debugfs) for detailed debugging information (GPIO state, clock tree, DMA, regulator, ftrace); and `/proc/<pid>/` for per-process state (maps, status, sched, fdinfo). Tool examples: `cat /proc/meminfo`, `cat /proc/interrupts`, `ls /sys/bus/i2c/devices/`, `cat /sys/kernel/debug/gpio`, `cat /sys/kernel/debug/clk/clk_summary`.

---

## References
{:.gc-ref}

- **"Linux Kernel Development" by Robert Love** (3rd edition) — the most accessible book covering all major subsystems including scheduler, MM, VFS, and the device model
- **"Understanding the Linux Kernel" by Bovet and Cesati** (3rd edition) — deep technical detail on VFS, MM, and process management
- **"Linux Device Drivers" by Corbet, Rubini, and Kroah-Hartman** (3rd edition, free online) — the definitive reference for the driver model, kobjects, and hardware interfaces: [https://lwn.net/Kernel/LDD3/](https://lwn.net/Kernel/LDD3/)
- **Linux kernel online documentation:** [https://www.kernel.org/doc/html/latest/](https://www.kernel.org/doc/html/latest/) — subsystem-specific documentation
- **LWN.net kernel internals articles:** [https://lwn.net/Kernel/Index/](https://lwn.net/Kernel/Index/) — the best ongoing source for deep kernel internals coverage including RCU, memory management, and scheduler articles
