---
layout: guide
title: "Signals"
description: "Master POSIX signals — sigaction, signal masks, blocked/pending/caught states, real-time signals, async-signal-safe functions, and the self-pipe trick."
stage: "Stage 04"
phase: "linux-developer-posix"
phase_label: "Phase 02 — Linux Developer"
phase_name: "POSIX APIs & Concurrency"
phase_index: "/linux-developer/posix/"
permalink: /linux-developer/posix/signals/
prev_topic:
  title: "Processes & fork()"
  url: /linux-developer/posix/processes-fork/
next_topic:
  title: "UNIX Sockets"
  url: /linux-developer/posix/unix-sockets/
---

## Signal Basics
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

A signal is a **software interrupt** delivered to a process by the kernel or another process. Each signal has a default action (terminate, ignore, core dump, stop, continue).

### Common Signals

| Signal | Value | Default Action | Common Trigger |
|--------|-------|----------------|----------------|
| `SIGHUP` | 1 | Terminate | Terminal hangup, daemon reload |
| `SIGINT` | 2 | Terminate | Ctrl+C |
| `SIGQUIT` | 3 | Core dump | Ctrl+\ |
| `SIGILL` | 4 | Core dump | Illegal instruction |
| `SIGFPE` | 8 | Core dump | Floating point exception |
| `SIGKILL` | 9 | Terminate | **Cannot be caught or ignored** |
| `SIGSEGV` | 11 | Core dump | Invalid memory reference |
| `SIGPIPE` | 13 | Terminate | Write to broken pipe |
| `SIGALRM` | 14 | Terminate | Timer expired (alarm()) |
| `SIGTERM` | 15 | Terminate | Default kill signal |
| `SIGCHLD` | 17 | Ignore | Child stopped or exited |
| `SIGCONT` | 18 | Continue | Resume if stopped |
| `SIGSTOP` | 19 | Stop | **Cannot be caught or ignored** |
| `SIGTSTP` | 20 | Stop | Ctrl+Z |
| `SIGUSR1` | 10 | Terminate | User-defined |
| `SIGUSR2` | 12 | Terminate | User-defined |

### Sending Signals

```c
#include <signal.h>

kill(pid, SIGTERM);   // send SIGTERM to process
kill(0, SIGTERM);     // send to all in same process group
kill(-pgid, SIGUSR1); // send to process group

raise(SIGUSR1);       // send to yourself
```

---

## `sigaction` — Installing Signal Handlers
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Always use `sigaction()` instead of the obsolete `signal()` — it is portable and provides more control.

```c
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>

static volatile sig_atomic_t g_running = 1;
static volatile sig_atomic_t g_reload  = 0;

// Signal handler — VERY restricted: only async-signal-safe functions!
static void sigterm_handler(int sig) {
    g_running = 0;   // atomic write — safe
}

static void sighup_handler(int sig) {
    g_reload = 1;
}

int main(void) {
    struct sigaction sa_term = {
        .sa_handler = sigterm_handler,
        .sa_flags   = SA_RESTART,     // restart interrupted syscalls
    };
    sigemptyset(&sa_term.sa_mask);
    sigaction(SIGTERM, &sa_term, NULL);
    sigaction(SIGINT,  &sa_term, NULL);

    struct sigaction sa_hup = {
        .sa_handler = sighup_handler,
        .sa_flags   = SA_RESTART,
    };
    sigemptyset(&sa_hup.sa_mask);
    sigaction(SIGHUP, &sa_hup, NULL);

    // Ignore SIGPIPE (broken pipe — handle in write() return value instead)
    signal(SIGPIPE, SIG_IGN);

    while (g_running) {
        if (g_reload) {
            g_reload = 0;
            reload_config();
        }
        do_work();
    }
    cleanup();
    return 0;
}
```

### Async-Signal-Safe Functions

Signal handlers run **asynchronously** and may interrupt any non-reentrant code. Only **async-signal-safe** functions may be called inside a handler.

**Safe:** `write()`, `read()`, `_exit()`, `kill()`, `signal()`, `sigaction()`, `getpid()`, `getppid()`, `fork()`, `execve()`

**NOT safe (never call in handlers):** `printf()`, `malloc()`, `free()`, `syslog()`, `pthread_mutex_lock()`, `fopen()`, C++ standard library

---

## Signal Masks
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

Each thread has a **signal mask** — a set of signals currently **blocked** (delivery is deferred until unblocked).

```c
#include <signal.h>

sigset_t mask, old_mask;

// Block SIGINT and SIGTERM during critical section
sigemptyset(&mask);
sigaddset(&mask, SIGINT);
sigaddset(&mask, SIGTERM);

pthread_sigmask(SIG_BLOCK, &mask, &old_mask);  // thread-safe
// ... critical section ...
pthread_sigmask(SIG_SETMASK, &old_mask, NULL); // restore

// Block all signals
sigfillset(&mask);
pthread_sigmask(SIG_BLOCK, &mask, NULL);

// Check pending signals (blocked but not yet delivered)
sigset_t pending;
sigpending(&pending);
if (sigismember(&pending, SIGTERM))
    puts("SIGTERM is pending");

// sigsuspend — atomically unblock + wait
sigsuspend(&old_mask);   // wait for signal, then re-block
```

---

## The Self-Pipe Trick
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

Signal handlers cannot call `select()`/`poll()`/`epoll_wait()` safely. The self-pipe trick lets you **convert signals into readable pipe events** — bridging the async world of signals with the synchronous I/O multiplexing world.

```c
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>

static int signal_pipe[2];   // [0]=read end, [1]=write end

static void signal_handler(int sig) {
    // write() is async-signal-safe
    uint8_t signum = (uint8_t)sig;
    write(signal_pipe[1], &signum, 1);
}

int main(void) {
    // Create non-blocking pipe
    pipe(signal_pipe);
    fcntl(signal_pipe[0], F_SETFL, O_NONBLOCK);
    fcntl(signal_pipe[1], F_SETFL, O_NONBLOCK);

    // Install handlers
    struct sigaction sa = { .sa_handler = signal_handler, .sa_flags = SA_RESTART };
    sigemptyset(&sa.sa_mask);
    sigaction(SIGINT,  &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);
    sigaction(SIGHUP,  &sa, NULL);

    // Main event loop with poll()
    struct pollfd fds[] = {
        { .fd = signal_pipe[0], .events = POLLIN },
        { .fd = data_socket,    .events = POLLIN },
    };

    while (1) {
        poll(fds, 2, -1);

        if (fds[0].revents & POLLIN) {
            uint8_t sig;
            read(signal_pipe[0], &sig, 1);
            if (sig == SIGTERM || sig == SIGINT) break;
            if (sig == SIGHUP)  reload_config();
        }

        if (fds[1].revents & POLLIN) {
            handle_data(data_socket);
        }
    }
    return 0;
}
```

**Modern alternative:** `signalfd()` (Linux-specific) — creates an fd that delivers signals as readable events:

```c
#include <sys/signalfd.h>

sigset_t mask;
sigemptyset(&mask);
sigaddset(&mask, SIGINT);
sigaddset(&mask, SIGTERM);

// Block signals from normal delivery
pthread_sigmask(SIG_BLOCK, &mask, NULL);

// Create signalfd — readable when a signal arrives
int sfd = signalfd(-1, &mask, SFD_NONBLOCK | SFD_CLOEXEC);

// Add sfd to poll/epoll like any other fd
struct signalfd_siginfo info;
read(sfd, &info, sizeof(info));
printf("Got signal %u from PID %d\n", info.ssi_signo, info.ssi_pid);
```

---

## Real-Time Signals
{:.gc-mid}

Real-time signals (`SIGRTMIN` to `SIGRTMAX`, typically 32 values) differ from standard signals:

- **Queued** — multiple instances are queued (standard signals only record one)
- **Ordered** — delivered in signal number order
- **Carry data** — can send an `int` or pointer with `sigqueue()`

```c
#include <signal.h>

// Send real-time signal with value
union sigval val = { .sival_int = 42 };
sigqueue(target_pid, SIGRTMIN + 1, val);

// Receive with SA_SIGINFO
static void rt_handler(int sig, siginfo_t* info, void* ctx) {
    printf("RT signal %d, value=%d from PID=%d\n",
           sig, info->si_value.sival_int, info->si_pid);
}

struct sigaction sa = {
    .sa_sigaction = rt_handler,
    .sa_flags     = SA_SIGINFO,
};
sigemptyset(&sa.sa_mask);
sigaction(SIGRTMIN + 1, &sa, NULL);
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `SIGKILL`, `SIGTERM`, and `SIGINT`?**

> `SIGKILL` (9) immediately terminates the process — it cannot be caught, blocked, or ignored. `SIGTERM` (15) is the polite shutdown signal; it can be caught to perform cleanup before exiting (close files, flush buffers). `SIGINT` (2) is sent by Ctrl+C from the terminal; also catchable. Best practice: always attempt `SIGTERM` first and give the process time to clean up; use `SIGKILL` only as a last resort.

**Q2 — Basic: Why should you use `sigaction()` instead of `signal()`?**

> `signal()` has unspecified behaviour when a signal is already being handled — it may auto-reset the handler to `SIG_DFL` (so the next occurrence kills the process) or block the signal while the handler runs, depending on the platform. `sigaction()` provides portable, consistent semantics: control over `sa_flags` (`SA_RESTART` to restart interrupted syscalls, `SA_SIGINFO` for signal info), explicit signal masking during handler execution, and guaranteed not to reset the handler.

**Q3 — Intermediate: What is the async-signal-safety constraint and why does it matter?**

> Signal handlers can interrupt **any** point in the program — including inside `malloc`, `printf`, or any non-reentrant function. If a handler calls `malloc` while `malloc` is running (perhaps with the heap lock held), the behaviour is undefined (deadlock or heap corruption). Only **async-signal-safe** functions — those that are reentrant and don't use global state in a non-reentrant way — may be called in signal handlers. The POSIX standard lists these explicitly; notably `printf`, `malloc`, `syslog` are NOT on the list.

**Q4 — Advanced: Explain the self-pipe trick and why it is needed.**

> Signal handlers are asynchronous and cannot safely call most library functions. But `select()`/`poll()`/`epoll_wait()` block the event loop waiting for I/O. The self-pipe trick bridges these two worlds: create a pipe, install signal handlers that call `write()` (async-signal-safe) to put a byte in the pipe, and add the read end of the pipe to your `poll()` interest set. When a signal arrives, `poll()` wakes up, you read the signal number from the pipe, and handle it safely in the event loop context. The modern Linux alternative is `signalfd()`.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 7 signal` | Signal overview |
| `man 2 sigaction` | sigaction() manual |
| `man 2 signalfd` | signalfd() manual |
| `man 2 sigprocmask` | Signal masking |
| TLPI Chapter 20–22 | Comprehensive signal coverage |
