---
layout: guide
title: "ftrace & kprobes"
description: "Use ftrace function tracing, event tracing, and kprobes to dynamically instrument the Linux kernel without recompiling."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 07"
phase: embedded-linux-kernel
permalink: /embedded-linux/kernel/ftrace-kprobes/
prev_topic:
  title: "printk & Dynamic Debug"
  url: /embedded-linux/kernel/printk-debug/
---

## What Is ftrace?
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

**ftrace** is the Linux kernel's built-in tracing framework. It lives in the kernel and writes to an in-kernel ring buffer — no external tools needed. It is accessed through a virtual filesystem called **tracefs**, mounted at `/sys/kernel/debug/tracing/`.

Unlike `printk`, ftrace is designed to be **low-overhead** and can trace thousands of functions per second without halting the system.

### Mounting tracefs

```bash
# Most distros mount it automatically; if not:
$ mount -t tracefs none /sys/kernel/debug/tracing

# Verify it's mounted
$ ls /sys/kernel/debug/tracing/
available_events       per_cpu/          tracing_on
available_filter_functions  set_event        trace
available_tracers      set_ftrace_filter  trace_clock
current_tracer         set_ftrace_pid     trace_marker
events/                snapshot           trace_options
```

### Key files explained

| File | Purpose |
|------|---------|
| `tracing_on` | 1 = tracing enabled, 0 = disabled |
| `current_tracer` | Which tracer is active |
| `available_tracers` | Tracers compiled into the kernel |
| `trace` | The ring buffer — read to get trace output |
| `set_ftrace_filter` | Limit function tracing to specific functions |
| `available_events` | All traceable events |
| `trace_marker` | Write timestamps/markers from user space |

### Basic on/off tracing

```bash
# See available tracers
$ cat /sys/kernel/debug/tracing/available_tracers
hwlat blk mmiotrace function_graph wakeup_dl wakeup_rt wakeup function nop

# Enable function tracer
$ echo function > /sys/kernel/debug/tracing/current_tracer

# Start tracing
$ echo 1 > /sys/kernel/debug/tracing/tracing_on

# Do something... then stop
$ echo 0 > /sys/kernel/debug/tracing/tracing_on

# Read the trace
$ cat /sys/kernel/debug/tracing/trace
# tracer: function
#
#                    _-----=> irqs-off
#                   / _----=> need-resched
#                  | / _---=> hardirq/softirq
#                  || / _--=> preempt-depth
#                  ||| /     delay
#           TASK-PID   CPU#  ||||    TIMESTAMP  FUNCTION
#              | |       |   ||||       |         |
           <idle>-0     [000] d... 12345.678901: do_IRQ <-ret_from_intr
           <idle>-0     [000] d... 12345.678910: handle_irq <-do_IRQ
             bash-1234  [001] .... 12345.679001: sys_read <-do_syscall_64
             bash-1234  [001] .... 12345.679010: vfs_read <-sys_read
```

### Filtering by function

```bash
# Trace only do_sys_open
$ echo do_sys_open > /sys/kernel/debug/tracing/set_ftrace_filter

# Trace all functions in a module
$ echo ':mod:mydriver' > /sys/kernel/debug/tracing/set_ftrace_filter

# Trace all functions starting with "gpio_"
$ echo 'gpio_*' > /sys/kernel/debug/tracing/set_ftrace_filter

# Clear the filter (trace all)
$ echo > /sys/kernel/debug/tracing/set_ftrace_filter
```

---

## function_graph Tracer & Event Tracing
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### function_graph — See Call Depth and Duration

The `function_graph` tracer shows the full call tree with indentation and **execution time** for each function.

```bash
$ echo function_graph > /sys/kernel/debug/tracing/current_tracer
$ echo do_sys_open > /sys/kernel/debug/tracing/set_graph_function
$ echo 1 > /sys/kernel/debug/tracing/tracing_on
$ cat /tmp/test.txt   # trigger the file open
$ echo 0 > /sys/kernel/debug/tracing/tracing_on
$ cat /sys/kernel/debug/tracing/trace
```

Output example:
```
# tracer: function_graph
#
# CPU  DURATION                  FUNCTION CALLS
# |     |   |                     |   |   |   |
 1)               |  do_sys_open() {
 1)               |    getname() {
 1)   0.512 us    |      getname_flags();
 1)   1.234 us    |    }
 1)               |    do_filp_open() {
 1)               |      path_openat() {
 1)   0.321 us    |        path_init();
 1)  28.456 us    |        link_path_walk();
 1) + 35.123 us   |      }
 1) + 38.000 us   |    }
 1) + 42.100 us   |  }
```

The `+` sign means > 10µs, `!` means > 100µs, `#` means > 1ms.

### Event Tracing

Events are static tracepoints embedded in the kernel at compile time. They are much lighter than function tracing.

```bash
# List all subsystem events
$ ls /sys/kernel/debug/tracing/events/
block  ext4  irq  kmem  napi  net  oom  power  sched  signal  skb  sock  ...

# List events in the sched subsystem
$ ls /sys/kernel/debug/tracing/events/sched/
sched_kthread_stop  sched_migrate_task  sched_process_exec
sched_process_exit  sched_process_fork  sched_switch  sched_wakeup

# Enable sched_switch event
$ echo 1 > /sys/kernel/debug/tracing/events/sched/sched_switch/enable

# Enable ALL events in a subsystem
$ echo 1 > /sys/kernel/debug/tracing/events/irq/enable

# Enable all events
$ echo 1 > /sys/kernel/debug/tracing/events/enable
```

Example `sched_switch` output:
```
 bash-1234  [001]  ....  1234.567: sched_switch: prev_comm=bash prev_pid=1234
             prev_prio=120 prev_state=S ==> next_comm=kworker/1:1
             next_pid=47 next_prio=120
```

### Trace markers from user space

Write timestamps into the trace from your own application — useful to correlate userspace events with kernel events:

```bash
$ echo 1 > /sys/kernel/debug/tracing/tracing_on
$ echo "my_app: starting critical section" > /sys/kernel/debug/tracing/trace_marker
# ... do work ...
$ echo "my_app: end critical section" > /sys/kernel/debug/tracing/trace_marker
$ echo 0 > /sys/kernel/debug/tracing/tracing_on
```

From C code:
```c
int fd = open("/sys/kernel/debug/tracing/trace_marker", O_WRONLY);
write(fd, "start critical section", 22);
// ... critical work ...
write(fd, "end critical section", 20);
close(fd);
```

### trace-cmd — Easier ftrace frontend

`trace-cmd` wraps the raw tracefs interface into a convenient CLI:

```bash
# Install
$ sudo apt install trace-cmd

# Record sched events for 5 seconds
$ sudo trace-cmd record -e sched_switch -e sched_wakeup sleep 5

# Display the report
$ trace-cmd report trace.dat
...
     bash-1234 [001]  1234.567820: sched_switch: bash:1234 [120] S ==> kworker:47 [120]

# Record function calls in a specific module
$ sudo trace-cmd record -p function -l ':mod:mydriver' sleep 2
$ trace-cmd report

# Live stream
$ sudo trace-cmd stream -e sched_switch
```

### Latency tracers

```bash
# irqsoff: measures longest period with IRQs disabled
$ echo irqsoff > /sys/kernel/debug/tracing/current_tracer
$ echo 1 > /sys/kernel/debug/tracing/tracing_on
# ... run your workload ...
$ echo 0 > /sys/kernel/debug/tracing/tracing_on
$ cat /sys/kernel/debug/tracing/trace
# Shows the worst-case IRQ-off latency and the callchain that caused it

# wakeup: measures latency from wakeup to execution
$ echo wakeup > /sys/kernel/debug/tracing/current_tracer
```

---

## kprobes & eBPF/bpftrace
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### kprobes — Dynamic Instrumentation

A **kprobe** lets you insert a probe at any kernel address (including the start of any function) **without recompiling the kernel**. When the CPU hits that address, your probe handler runs.

**Three types:**
- `kprobe` — fires at function entry (or any instruction)
- `kretprobe` — fires at function return, captures return value
- `uprobe` — fires at user-space function entry/return

### Writing a kprobe kernel module

```c
// kprobe_example.c
#include <linux/kernel.h>
#include <linux/module.h>
#include <linux/kprobes.h>

static struct kprobe kp = {
    .symbol_name = "do_sys_open",
};

static int handler_pre(struct kprobe *p, struct pt_regs *regs)
{
    /* regs->si holds the filename argument on x86-64 */
    pr_info("kprobe: do_sys_open called, filename ptr = 0x%lx\n",
            (unsigned long)regs->si);
    return 0;
}

static void handler_post(struct kprobe *p, struct pt_regs *regs,
                         unsigned long flags)
{
    pr_info("kprobe: do_sys_open returned\n");
}

static int __init kprobe_init(void)
{
    kp.pre_handler  = handler_pre;
    kp.post_handler = handler_post;
    return register_kprobe(&kp);
}

static void __exit kprobe_exit(void)
{
    unregister_kprobe(&kp);
    pr_info("kprobe removed\n");
}

module_init(kprobe_init);
module_exit(kprobe_exit);
MODULE_LICENSE("GPL");
```

```bash
$ make
$ sudo insmod kprobe_example.ko
$ cat /tmp/test.txt   # trigger do_sys_open
$ dmesg | tail -5
[12345.678] kprobe: do_sys_open called, filename ptr = 0xffff9a3c00001234
[12345.679] kprobe: do_sys_open returned
$ sudo rmmod kprobe_example
```

### kretprobe — Capturing return values

```c
static struct kretprobe rp = {
    .handler     = ret_handler,
    .entry_handler = entry_handler,
    .maxactive   = 20,
    .kp.symbol_name = "do_sys_open",
};

static int ret_handler(struct kretprobe_instance *ri, struct pt_regs *regs)
{
    long fd = regs_return_value(regs);
    pr_info("do_sys_open returned fd = %ld\n", fd);
    return 0;
}
```

### kprobes via tracefs (no module needed)

```bash
# Add a kprobe event via tracefs
$ echo 'p:myprobe do_sys_open filename=+0(%si):string' \
    > /sys/kernel/debug/tracing/kprobe_events

# Enable it
$ echo 1 > /sys/kernel/debug/tracing/events/kprobes/myprobe/enable
$ echo 1 > /sys/kernel/debug/tracing/tracing_on

# Trigger some file opens, then read trace
$ cat /sys/kernel/debug/tracing/trace
            bash-1234 [001] .... 1234.567: myprobe: (do_sys_open+0x0/0x250)
                             filename="/etc/passwd"

# Kretprobe via tracefs
$ echo 'r:myretprobe do_sys_open fd=$retval' \
    > /sys/kernel/debug/tracing/kprobe_events
```

### perf probe — same thing via perf

```bash
# Add a probe at do_sys_open, capture the filename
$ sudo perf probe --add 'do_sys_open filename:string'

# Record
$ sudo perf record -e probe:do_sys_open -aR sleep 5

# Report
$ sudo perf script
bash  1234 [001] 1234.567: probe:do_sys_open: (ffffffff81234560) filename="/etc/passwd"

# List active probes
$ sudo perf probe --list

# Remove
$ sudo perf probe --del probe:do_sys_open
```

### bpftrace — Production-Grade Kernel Tracing

`bpftrace` uses eBPF (Extended Berkeley Packet Filter) under the hood. It provides a high-level language for one-liner and scripted kernel/user tracing.

```bash
$ sudo apt install bpftrace

# Trace every file opened
$ sudo bpftrace -e 'kprobe:do_sys_open { printf("open: %s\n", str(arg1)); }'
open: /etc/passwd
open: /proc/version
open: /dev/null

# Count syscalls by process name
$ sudo bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[comm] = count(); }'

# Histogram of read() sizes
$ sudo bpftrace -e 'tracepoint:syscalls:sys_enter_read { @bytes = hist(args->count); }'

# Trace kernel function latency
$ sudo bpftrace -e '
kprobe:vfs_read  { @start[tid] = nsecs; }
kretprobe:vfs_read /@start[tid]/ {
  @usecs = hist((nsecs - @start[tid]) / 1000);
  delete(@start[tid]);
}'

# Show top 10 functions by call count over 10s
$ sudo trace-cmd record -p function -l 'vfs_*' sleep 10
$ trace-cmd report | awk '{print $NF}' | sort | uniq -c | sort -rn | head -10
```

### Tracepoints vs kprobes — when to use each

| Feature | Tracepoints | kprobes |
|---------|------------|---------|
| Defined in source | Yes (TRACE_EVENT macro) | No — dynamic |
| Stable ABI | Yes | No — breaks with kernel changes |
| Overhead | Lower (static) | Slightly higher |
| Can probe any address | No | Yes |
| Best for | Performance monitoring | Deep debugging |
| Available without debug info | Yes | Needs kallsyms |

### Uprobes — probing user-space functions from kernel

```bash
# Probe the malloc() function in libc
$ sudo bpftrace -e '
uprobe:/lib/x86_64-linux-gnu/libc.so.6:malloc { printf("malloc(%d)\n", arg0); }
'

# Trace a specific user binary
$ sudo bpftrace -e '
uprobe:/usr/bin/myapp:process_data { printf("process_data called\n"); }
'
```

---

## Interview Questions
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&A</span>

**Q: What is ftrace and how is it different from printk debugging?**

ftrace is a kernel tracing framework that instruments function calls and kernel events with very low overhead, writing to an in-kernel ring buffer. Unlike `printk`, which requires recompiling and adds significant latency on the serial console, ftrace can trace thousands of events per second and be enabled/disabled at runtime via the tracefs filesystem. ftrace gives you a timeline of what the kernel was actually doing, while printk gives you only what you explicitly told it to print.

**Q: How do you trace only specific kernel functions with ftrace?**

Write the function name (or a glob pattern) into `/sys/kernel/debug/tracing/set_ftrace_filter`. For example: `echo 'gpio_*' > set_ftrace_filter` traces all GPIO functions. For tracing functions in a specific module: `echo ':mod:mydriver' > set_ftrace_filter`. You can also use `set_graph_function` with the `function_graph` tracer to trace a function and everything it calls.

**Q: What is the function_graph tracer and what does it show?**

`function_graph` shows the full call graph with function entry and exit, indentation representing call depth, and execution time for each function. The `+` suffix means >10µs, `!` means >100µs, and `#` means >1ms. This is extremely useful for understanding what a function actually does under the hood and where the time is being spent.

**Q: What is a kprobe and how is it implemented?**

A kprobe dynamically inserts a breakpoint (INT3 on x86, BRK on ARM64) at any kernel address at runtime, without recompiling the kernel. When the CPU hits the breakpoint, it calls your registered `pre_handler`. After your handler returns, the original instruction executes. `kretprobes` work by replacing the return address on the stack so your `ret_handler` is called when the function returns. The mechanism requires `CONFIG_KPROBES=y` in the kernel config.

**Q: What is the difference between a kprobe and a tracepoint?**

A tracepoint is a static hook placed by the kernel developer at compile time using the `TRACE_EVENT` macro. It has a stable, documented interface and very low overhead (a single `nop` instruction when disabled). A kprobe is dynamic — you can attach it to any kernel address at runtime, even in functions that have no tracepoints. Tracepoints are better for production monitoring (stable API, lower overhead); kprobes are better for deep one-off debugging.

**Q: What is bpftrace and what advantages does it have over ftrace?**

bpftrace is a high-level tracing language that compiles to eBPF programs loaded into the kernel. Compared to raw ftrace, it provides: a C-like scripting language with variables, maps, histograms; the ability to combine kprobes, tracepoints, and uprobes in one script; aggregation and filtering in-kernel (reducing data sent to user space); and no need to write kernel modules. It is safe (eBPF verifier prevents crashes) and production-ready.

**Q: How would you use tracing to debug a latency problem in a real-time system?**

First, use the `irqsoff` tracer to measure the longest period with interrupts disabled — this is often the main cause of RT latency. Then use `preemptoff` to find preemption-disabled sections. Use `wakeup_rt` to measure the time from when an RT task is woken to when it actually runs. `trace-cmd record -e irq:* -e sched:*` captures a timeline of interrupts and context switches. For user-space latency, combine `trace_marker` with application timestamps to see kernel activity during your critical section.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

- **Linux kernel — ftrace documentation** — Documentation/trace/ftrace.rst — comprehensive guide to all ftrace features
- **Linux kernel — kprobes documentation** — Documentation/trace/kprobes.rst — kprobe/kretprobe/uprobe API reference
- **trace-cmd** — https://trace-cmd.org/ — user-space frontend for ftrace
- **bpftrace Reference Guide** — https://github.com/bpftrace/bpftrace/blob/master/docs/reference_guide.md — full bpftrace language reference
- **"Systems Performance" by Brendan Gregg** (2nd edition) — the definitive book on Linux performance and tracing tools including ftrace, perf, and eBPF
- **LWN.net: "Debugging the kernel using ftrace"** — Steven Rostedt's series on ftrace internals
- **"Linux Observability with BPF" by David Calavera & Lorenzo Fontana** — practical eBPF/bpftrace guide
- **perf-probe man page** — man perf-probe — probing arbitrary kernel/user functions via perf
