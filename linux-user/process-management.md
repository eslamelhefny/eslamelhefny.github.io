---
layout: guide
title: "Process Management"
description: "Monitor, control, and debug Linux processes. Understand process states, signals, scheduling priorities, cgroups v2, and systemd service units."
stage: "Stage 03"
permalink: /linux-user/process-management/
prev_topic:
  title: "Users & Permissions"
  url: /linux-user/users-permissions/
next_topic:
  title: "Package Management"
  url: /linux-user/package-management/
---

## What is a Process?
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

A **process** is a running instance of a program. The kernel gives each process:
- A unique **PID** (Process ID)
- Its own virtual memory space
- Open file descriptors
- A scheduling slot on the CPU

Processes form a **tree**: every process has a parent (except `init`/systemd, PID 1).

### Process States

| State | Symbol | Meaning |
|-------|--------|---------|
| Running / Runnable | `R` | On CPU or waiting for CPU |
| Sleeping (interruptible) | `S` | Waiting for I/O or event (can be interrupted by signal) |
| Sleeping (uninterruptible) | `D` | Waiting for hardware I/O — cannot be killed! |
| Stopped | `T` | Paused by SIGSTOP or debugger |
| Zombie | `Z` | Finished, waiting for parent to `wait()` |

---

## Viewing Processes
{:.gc-basic}

### `ps` — Process Snapshot

```bash
ps aux            # all processes, user-oriented format
ps aux | grep nginx
ps -ef            # all processes, full format (shows PPID)
ps --forest       # tree view of parent-child
ps -p 1234        # specific PID
ps -u eslam       # processes by user
```

**`ps aux` columns:**
```
USER   PID  %CPU %MEM    VSZ    RSS  TTY  STAT  START   TIME  COMMAND
root     1   0.0  0.1 168764  13256   ?   Ss   08:00   0:02  /sbin/init
eslam 1234   2.1  1.4 512000  45000 pts/0 Sl   09:15   0:18  python3 train.py
```

- `VSZ`: virtual memory size (including swapped out)
- `RSS`: resident set size (actual RAM in use)
- `STAT`: process state (see table above; `s`=session leader, `l`=multi-threaded, `+`=foreground)

### `top` / `htop` — Live Process Monitor

```bash
top           # built-in, available everywhere
htop          # enhanced (install with: sudo apt install htop)
```

**`top` keyboard shortcuts:**
- `k` — kill a process (prompts for PID and signal)
- `r` — renice (change priority)
- `P` — sort by CPU usage
- `M` — sort by memory usage
- `1` — toggle per-CPU bars
- `q` — quit

**`htop` shortcuts:**
- `F5` — tree view
- `F9` — kill menu
- `F6` — sort column

### `pgrep` / `pidof`

```bash
pgrep nginx           # list PIDs of processes named nginx
pgrep -u eslam        # all PIDs owned by eslam
pidof sshd            # PID of sshd
pgrep -la python      # list PID + full command line
```

---

## Controlling Processes
{:.gc-basic}

### Foreground, Background, and Job Control

```bash
long_command &        # start in background
Ctrl+Z                # suspend foreground process (sends SIGTSTP)
bg                    # resume suspended job in background
fg                    # bring background job to foreground
fg %2                 # bring job number 2 to foreground
jobs                  # list all jobs in current shell
jobs -l               # include PIDs
```

### `nohup` — Survive Shell Exit

```bash
nohup python3 train.py &    # run detached from terminal
nohup python3 train.py > /var/log/train.log 2>&1 &
# output goes to nohup.out by default
```

### Killing Processes

```bash
kill 1234             # send SIGTERM (graceful shutdown request)
kill -9 1234          # send SIGKILL (cannot be caught or ignored!)
kill -STOP 1234       # pause the process
kill -CONT 1234       # resume a stopped process
killall nginx         # kill all processes named nginx
pkill -f "python3 train"   # kill by matching command line
```

---

## Signals Reference
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

| Signal | Number | Default Action | Description |
|--------|--------|----------------|-------------|
| `SIGHUP` | 1 | Terminate | Hangup (reload config in daemons) |
| `SIGINT` | 2 | Terminate | Interrupt from keyboard (Ctrl+C) |
| `SIGQUIT` | 3 | Core dump | Quit from keyboard (Ctrl+\\) |
| `SIGKILL` | 9 | Terminate | Cannot be caught/ignored — immediate kill |
| `SIGTERM` | 15 | Terminate | Graceful termination request (default for `kill`) |
| `SIGSTOP` | 19 | Stop | Pause process — cannot be caught/ignored |
| `SIGTSTP` | 20 | Stop | Pause from terminal (Ctrl+Z) — can be caught |
| `SIGCONT` | 18 | Continue | Resume a stopped process |
| `SIGUSR1` | 10 | Terminate | User-defined signal 1 (apps use for reload) |
| `SIGUSR2` | 12 | Terminate | User-defined signal 2 |
| `SIGCHLD` | 17 | Ignore | Child stopped or terminated |
| `SIGPIPE` | 13 | Terminate | Broken pipe (write to closed socket) |
| `SIGSEGV` | 11 | Core dump | Segmentation fault (invalid memory access) |

```bash
# List all signals
kill -l
trap "echo Caught SIGTERM" SIGTERM   # handle signal in shell script
```

---

## Process Priorities
{:.gc-mid}

### `nice` and `renice`

**Nice value** ranges from -20 (highest priority) to +19 (lowest). Default is 0.

```bash
# Start process with lower priority
nice -n 10 make -j4

# Start process with higher priority (requires root)
sudo nice -n -5 realtime_sensor

# Change priority of running process
renice +5 -p 1234          # lower priority of PID 1234
renice -5 -u eslam         # change priority for all of eslam's procs (root)
```

```bash
$ ps -o pid,ni,comm -p 1234
  PID  NI COMMAND
 1234  10 make
```

### `/proc/PID` — Exploring a Running Process

```bash
PID=1234

cat /proc/$PID/status      # state, memory, UID, threads
cat /proc/$PID/cmdline     # full command (NUL-separated; tr '\0' ' ')
cat /proc/$PID/environ     # environment variables
cat /proc/$PID/maps        # memory maps (libraries, heap, stack)
cat /proc/$PID/net/tcp     # open TCP connections
ls -l /proc/$PID/fd        # open file descriptors
cat /proc/$PID/io          # I/O statistics (bytes read/written)
cat /proc/$PID/sched        # scheduler stats
```

### Zombie Processes

A zombie holds a PID but has finished executing. It exists only so the parent can call `wait()` to retrieve the exit status.

```bash
# Find zombies
ps aux | grep Z

# Typically you kill the PARENT, not the zombie
kill -SIGCHLD <parent_pid>
```

If the parent never calls `wait()`, zombies accumulate until the parent dies (at which point init/systemd adopts and reaps them). Persistent zombies indicate a bug in the parent program.

### `strace` — System Call Tracer

```bash
strace ls                        # trace all syscalls of ls
strace -e openat ls              # trace only openat calls
strace -p 1234                   # attach to running process
strace -o trace.txt -f ./server  # save output, follow forks
strace -c ls /tmp                # count syscalls (summary)
```

**Example output:**
```bash
$ strace -e openat cat /etc/hostname
openat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3
openat(AT_FDCWD, "/lib/x86_64-linux-gnu/libc.so.6", O_RDONLY|O_CLOEXEC) = 3
openat(AT_FDCWD, "/etc/hostname", O_RDONLY) = 3
```

---

## Advanced: cgroups v2 and systemd
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### cgroups v2 (Control Groups)

cgroups limit and account for resources (CPU, memory, I/O, PIDs) for groups of processes.

```bash
# Check if cgroups v2 is active
mount | grep cgroup2
# cgroup2 on /sys/fs/cgroup type cgroup2

# Create a new cgroup
sudo mkdir /sys/fs/cgroup/mygroup

# Add a process to the group
echo $$ | sudo tee /sys/fs/cgroup/mygroup/cgroup.procs

# Set memory limit (200 MiB)
echo $((200 * 1024 * 1024)) | sudo tee /sys/fs/cgroup/mygroup/memory.max

# Set CPU limit (50% of one core)
echo "5000 10000" | sudo tee /sys/fs/cgroup/mygroup/cpu.max
#    ^quota ^period (microseconds)

# View current resource usage
cat /sys/fs/cgroup/mygroup/memory.current
cat /sys/fs/cgroup/mygroup/cpu.stat
```

### systemd Service Units

systemd manages services as **unit files** under `/etc/systemd/system/` or `/lib/systemd/system/`.

**Example service file** `/etc/systemd/system/myapp.service`:
```ini
[Unit]
Description=My Application Service
After=network.target
Requires=postgresql.service

[Service]
Type=simple
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/server --config /etc/myapp/config.yml
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5s

# Resource limits via cgroups
MemoryMax=512M
CPUQuota=50%

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

**Managing services:**
```bash
sudo systemctl daemon-reload           # reload unit files after edit
sudo systemctl start myapp             # start
sudo systemctl stop myapp              # stop
sudo systemctl restart myapp           # stop + start
sudo systemctl reload myapp            # send reload signal (SIGHUP)
sudo systemctl enable myapp            # start at boot
sudo systemctl disable myapp           # remove from boot
sudo systemctl status myapp            # show status + recent logs
journalctl -u myapp -f                 # live log stream for service
journalctl -u myapp --since "1 hour ago"
```

### Analyzing Boot Time

```bash
systemd-analyze                     # total boot time
systemd-analyze blame               # time each unit took
systemd-analyze critical-chain      # critical path
systemd-analyze plot > boot.svg     # visual timeline
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `kill -9` and `kill -15`?**

> `kill -15` (SIGTERM) is a polite request to terminate — the process can catch the signal, flush buffers, close files, and exit cleanly. `kill -9` (SIGKILL) is delivered directly by the kernel and cannot be caught, blocked, or ignored. Use SIGTERM first; only escalate to SIGKILL if the process doesn't respond.

**Q2 — Basic: What is a zombie process and how do you remove it?**

> A zombie is a process that has finished but whose exit status has not been collected by its parent (the parent hasn't called `wait()`). Zombies hold a PID but consume almost no resources. You cannot kill a zombie directly — you must kill or signal the **parent** process (`kill -SIGCHLD <ppid>`) to prompt it to reap its children. If the parent is unkillable, the zombie persists until the parent exits.

**Q3 — Intermediate: How would you find out what files a process has open?**

```bash
lsof -p <PID>
# or inspect directly:
ls -la /proc/<PID>/fd
```

**Q4 — Intermediate: What is an orphan process? How does Linux handle it?**

> An **orphan** is a process whose parent has exited before it. Linux automatically re-parents orphans to **PID 1** (init/systemd), which periodically calls `wait()` to reap them. This prevents orphans from becoming zombies.

**Q5 — Advanced: Explain D-state (uninterruptible sleep). Why can't you kill a process in D-state?**

> A process enters D-state (`TASK_UNINTERRUPTIBLE`) when it is waiting for a kernel operation to complete and that operation cannot be safely interrupted — typically a hardware I/O operation such as waiting for a disk or NFS response. Sending a signal to a D-state process does nothing; the signal is queued but not delivered until the process wakes up. If the hardware never responds (e.g., an NFS server is unreachable), the process is stuck in D forever. The only remedy is to fix the underlying hardware/I/O issue or reboot.

**Q6 — Advanced: How do cgroups v2 differ from cgroups v1?**

> cgroups v1 allowed a process to be in different hierarchies simultaneously (different cgroup trees for CPU, memory, etc.), which led to complexity and inconsistencies. cgroups v2 provides a **unified single hierarchy** — each process belongs to exactly one cgroup subtree. v2 also improves resource delegation to containers, adds the `memory.oom_group` feature, and is the foundation for systemd's resource management (TransientUnits, CPUQuota, MemoryMax in .service files).

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 1 ps` | Process status manual |
| `man 7 signal` | Complete signal reference |
| `man 1 strace` | System call tracer |
| `man 5 systemd.service` | Service unit file format |
| `man 7 cgroups` | Control Groups overview |
| Kernel docs — cgroups v2 | [kernel.org/doc/html/latest/admin-guide/cgroup-v2.html](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html) |
| systemd documentation | [systemd.io](https://systemd.io) |
