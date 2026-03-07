---
layout: guide
title: "GDB Debugging"
description: "Master GDB — set breakpoints and watchpoints, inspect the call stack, analyse core dumps, debug remote embedded targets, and automate sessions with GDB scripts."
stage: "Stage 02"
phase: "linux-developer-c"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C Programming"
phase_index: "/linux-developer/c-programming/"
permalink: /linux-developer/c-programming/gdb/
prev_topic:
  title: "GCC Flags & Optimization"
  url: /linux-developer/c-programming/gcc-optimization/
---

## Starting GDB
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Always compile with `-g` (debug info) and, if possible, `-O0` for easiest debugging:

```bash
gcc -g -O0 -o program program.c
gdb ./program
```

```bash
# Run with arguments
gdb --args ./program arg1 arg2

# Attach to a running process
gdb -p 1234

# Load a core dump
gdb ./program core

# Batch mode (non-interactive)
gdb -batch -ex "run" -ex "bt" ./program
```

---

## Essential Commands
{:.gc-basic}

### Running and Stepping

| Command | Short | Action |
|---------|-------|--------|
| `run [args]` | `r` | Start/restart the program |
| `continue` | `c` | Resume after a breakpoint |
| `next` | `n` | Step over (don't enter functions) |
| `step` | `s` | Step into function calls |
| `finish` | `fin` | Run until current function returns |
| `until 42` | `u 42` | Run until line 42 |
| `quit` | `q` | Exit GDB |

### Breakpoints

```gdb
break main              # break at function entry
break program.c:42      # break at specific line
break sensor_read if temp > 100  # conditional breakpoint
info breakpoints        # list all breakpoints
disable 2               # disable breakpoint #2
enable 2                # re-enable
delete 2                # delete breakpoint #2
clear main              # remove all breakpoints at 'main'
```

### Inspecting State

```gdb
print x                 # print variable x
print *ptr              # dereference pointer
print arr[0]@10         # print 10 elements of array
print/x value           # print in hexadecimal
print/d value           # print in decimal
print/t value           # print in binary
display x               # print x automatically after every step
undisplay 1             # stop auto-displaying item #1

info locals             # all local variables in current frame
info args               # function arguments
whatis x                # show type of x
ptype SensorRecord      # pretty-print struct type
```

---

## Stack and Memory
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Call Stack

```gdb
backtrace               # (bt) show full call stack
backtrace full          # show locals in each frame
frame 3                 # switch to frame 3
up                      # move up one frame
down                    # move down one frame
info frame              # details of current frame
```

**Sample backtrace:**
```
(gdb) bt
#0  0x00007f8b12345678 in __memcpy_sse2 ()
#1  0x00000000004011a3 in parse_packet (buf=0x603000000010 "", len=128) at parser.c:45
#2  0x00000000004012bb in process_input (fd=3) at main.c:87
#3  0x0000000000401380 in main (argc=1, argv=0x7fffffffe548) at main.c:120
```

### Watchpoints

A watchpoint stops execution when a variable's **value changes** — invaluable for "who changed this?":

```gdb
watch global_counter        # break when global_counter is written
rwatch data_ptr             # break when data_ptr is READ
awatch data_ptr             # break when read OR written
info watchpoints
```

### Memory Inspection

```gdb
x/10dw 0x7fffffffe550      # examine 10 decimal words at address
x/20xb &buf                # 20 hex bytes starting at buf
x/s string_ptr             # print as null-terminated string
x/i $pc                    # disassemble one instruction at PC
disassemble main            # disassemble entire function
```

---

## Core Dumps
{:.gc-mid}

A core dump is a snapshot of the process's memory and registers captured when it crashes (SIGSEGV, SIGABRT, etc.).

```bash
# Enable core dumps (disabled by default)
ulimit -c unlimited

# Run the crashing program
./buggy_program
# Segmentation fault (core dumped)
ls -la core*

# Analyse the core dump
gdb ./buggy_program core
(gdb) bt           # see where it crashed
(gdb) info locals
(gdb) print *ptr
```

**Make core dump path configurable:**
```bash
echo '/tmp/core_%e_%p' | sudo tee /proc/sys/kernel/core_pattern
```

---

## Advanced: Remote Debugging Embedded Targets
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

For embedded boards without a native GDB, use `gdbserver` on the target and connect from your host.

```bash
# On the TARGET board
gdbserver :3333 ./firmware
# or attach to a running process:
gdbserver :3333 --attach 1234

# On the HOST (development machine)
gdb-multiarch ./firmware
(gdb) target remote 192.168.1.100:3333
(gdb) break main
(gdb) continue
```

**Via SSH tunnel (secure):**
```bash
# Tunnel the port
ssh -N -f -L 3333:localhost:3333 root@board

# Then on host
gdb-multiarch ./firmware
(gdb) target remote localhost:3333
```

### GDB Scripting (`.gdbinit` and scripts)

Automate repetitive debugging sessions:

```gdb
# ~/.gdbinit or project .gdbinit
set pagination off
set print pretty on
set print array on
set print array-indexes on

define print_list
    set $node = $arg0
    while $node != 0
        print *$node
        set $node = $node->next
    end
end
```

```bash
# Run a GDB script from the command line
gdb -batch -x debug_script.gdb ./program
```

```gdb
# debug_script.gdb — automatically run and get a backtrace
file ./program
run
backtrace
quit
```

### TUI Mode (Text User Interface)

```bash
gdb -tui ./program      # or press Ctrl+X A inside GDB
```

Shows source code, assembly, and registers in split panes inside the terminal.

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `next` and `step` in GDB?**

> `next` (n) executes the current line and stops at the **next line in the same function** — it does not descend into called functions. `step` (s) also executes one line, but **follows function calls** into their body. Use `next` to stay at the current level; use `step` to trace into a function's implementation.

**Q2 — Intermediate: How do watchpoints work and what is their performance cost?**

> GDB implements watchpoints using either **hardware breakpoints** (x86 has 4 debug registers — DR0–DR3) or **software watchpoints** (single-stepping the entire program and checking the value after every instruction). Hardware watchpoints are fast; software watchpoints make the program run 1000× slower. For local variables, GDB usually manages to use hardware watchpoints. Global or heap variables that are far from the current instruction may fall back to software watchpoints.

**Q3 — Intermediate: How do you load and analyse a core dump?**

> `gdb ./binary corefile`. GDB restores the register state and memory map from the core. Use `bt` to see the crash point, `frame N` to navigate the call stack, `print var` to inspect values at crash time. For stripped binaries, use `set solib-search-path` to point GDB to unstripped versions.

**Q4 — Advanced: How do you debug a program that crashes only in production (stripped, no debug symbols)?**

> 1. Build with `-g` and store the unstripped binary separately (or use a separate debug package).
> 2. Enable core dumps in production (`/proc/sys/kernel/core_pattern`).
> 3. Use `gdb ./unstripped_binary corefile` — GDB uses the symbol information from the unstripped binary with the memory state from the core.
> 4. Alternatively, use `addr2line -e ./binary 0xADDRESS` to resolve crash addresses from logs to source lines.
> 5. For live production: `gdb -p PID` for a quick look, or use `strace`/`perf` for non-intrusive profiling.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| GDB manual | [sourceware.org/gdb/documentation](https://sourceware.org/gdb/documentation/) |
| `man 1 gdb` | GDB man page |
| `man 1 gdbserver` | Remote debugging server |
| Beej's GDB tutorial | [beej.us/guide/bggdb](https://beej.us/guide/bggdb/) |
| GDB cheat sheet | [darkdust.net/files/GDB%20Cheat%20Sheet.pdf](https://darkdust.net/files/GDB%20Cheat%20Sheet.pdf) |
