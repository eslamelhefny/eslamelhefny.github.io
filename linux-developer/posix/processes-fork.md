---
layout: guide
title: "Processes & fork()"
description: "Master Linux process creation — fork/exec/wait, copy-on-write semantics, process groups, sessions, daemon creation, and zombie process reaping."
stage: "Stage 04"
phase: "linux-developer-posix"
phase_label: "Phase 02 — Linux Developer"
phase_name: "POSIX APIs & Concurrency"
phase_index: "/linux-developer/posix/"
permalink: /linux-developer/posix/processes-fork/
prev_topic:
  title: "POSIX File I/O"
  url: /linux-developer/posix/file-io/
next_topic:
  title: "Signals"
  url: /linux-developer/posix/signals/
---

## `fork()` — Creating Processes
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

`fork()` creates an **exact copy** of the calling process. Both parent and child continue execution from the point of the `fork()` call. The return value distinguishes them.

```c
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    printf("Before fork: PID=%d\n", getpid());

    pid_t pid = fork();

    if (pid == -1) {
        perror("fork");
        exit(EXIT_FAILURE);

    } else if (pid == 0) {
        // --- CHILD process ---
        printf("Child:  PID=%d, PPID=%d\n", getpid(), getppid());
        // do child work...
        exit(0);   // always exit, don't return from main!

    } else {
        // --- PARENT process ---
        printf("Parent: PID=%d, child PID=%d\n", getpid(), pid);

        // Wait for child to prevent zombie
        int status;
        waitpid(pid, &status, 0);

        if (WIFEXITED(status))
            printf("Child exited with status %d\n", WEXITSTATUS(status));
    }

    return 0;
}
```

```
Before fork: PID=1234
Parent: PID=1234, child PID=1235
Child:  PID=1235, PPID=1234
Child exited with status 0
```

### What is Inherited vs. What Differs After `fork()`

| Inherited by child | Different in child |
|-------------------|-------------------|
| Open file descriptors | New PID |
| Signal handlers | PPID (= parent's PID) |
| Memory mappings (CoW) | Memory writes become private copies |
| Environment variables | `fork()` returns 0 (not parent's PID) |
| User/group IDs | Pending signals cleared |
| Working directory | File lock ownership |

### Copy-on-Write (CoW)

`fork()` does **not** physically copy all memory. The child's pages are mapped to the same physical memory as the parent, marked read-only. Only when either process **writes** to a page does the kernel make a private copy — lazy duplication. This makes `fork()` fast even for large processes.

---

## `exec()` — Replacing the Process Image
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

The `exec` family of functions **replaces the current process image** with a new program. The PID stays the same; memory is replaced.

```c
#include <unistd.h>

// execv — array of arguments
char* const args[] = { "/bin/ls", "-la", "/tmp", NULL };
execv("/bin/ls", args);
// If execv returns, it failed:
perror("execv");
exit(EXIT_FAILURE);

// execvp — searches PATH
execvp("ls", args);   // finds ls in PATH automatically

// execle — explicit environment
extern char** environ;
execle("/bin/ls", "ls", "-la", NULL, environ);
```

### `fork()` + `exec()` — The Standard Pattern

```c
pid_t pid = fork();

if (pid == 0) {
    // Child: replace with new program
    char* const args[] = { "gcc", "-O2", "main.c", "-o", "main", NULL };
    execvp("gcc", args);
    perror("execvp");   // only reached on failure
    exit(127);
}

// Parent: wait for compiler to finish
int status;
waitpid(pid, &status, 0);
printf("gcc exited: %d\n", WEXITSTATUS(status));
```

---

## `wait()` and `waitpid()` — Reaping Children
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

When a child exits, it becomes a **zombie** — its PID and exit status are kept in the kernel until the parent calls `wait()`. Long-lived zombies waste PID table entries.

```c
#include <sys/wait.h>

// Wait for any child
pid_t pid = wait(&status);

// Wait for a specific child
pid_t pid = waitpid(child_pid, &status, 0);       // blocking
pid_t pid = waitpid(-1, &status, WNOHANG);        // non-blocking

// Status macros
if (WIFEXITED(status))
    printf("Normal exit: %d\n",  WEXITSTATUS(status));

if (WIFSIGNALED(status))
    printf("Killed by signal: %d\n", WTERMSIG(status));

if (WIFSTOPPED(status))
    printf("Stopped by signal: %d\n", WSTOPSIG(status));
```

### Reaping Multiple Children with SIGCHLD

```c
#include <signal.h>

// Install SIGCHLD handler to reap children asynchronously
void sigchld_handler(int sig) {
    int saved_errno = errno;
    // Loop to catch all terminated children (may have multiple)
    while (waitpid(-1, NULL, WNOHANG) > 0)
        ;
    errno = saved_errno;
}

struct sigaction sa = {
    .sa_handler = sigchld_handler,
    .sa_flags   = SA_RESTART | SA_NOCLDSTOP,
};
sigemptyset(&sa.sa_mask);
sigaction(SIGCHLD, &sa, NULL);
```

---

## Process Groups, Sessions, and Daemons
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Process Groups and Sessions

```
Session (SID)
 └── Process Group (PGID)
      └── Process (PID)
      └── Process (PID)
 └── Process Group (PGID)
      └── Process (PID)  ← foreground process group
```

```c
// Get/set process group
pid_t pgid = getpgrp();
setpgid(0, 0);          // make this process a new process group leader

// Get session ID
pid_t sid = getsid(0);

// Create a new session (used in daemon creation)
pid_t new_sid = setsid();  // process becomes session leader and process group leader
```

### Creating a Daemon Process

```c
#include <sys/stat.h>
#include <fcntl.h>

void daemonise(void) {
    // Step 1: Fork and let parent exit (detaches from shell)
    pid_t pid = fork();
    if (pid < 0) exit(EXIT_FAILURE);
    if (pid > 0) exit(EXIT_SUCCESS);  // parent exits

    // Step 2: Create new session (detach from controlling terminal)
    if (setsid() < 0) exit(EXIT_FAILURE);

    // Step 3: Fork again (prevents re-acquiring controlling terminal)
    pid = fork();
    if (pid < 0) exit(EXIT_FAILURE);
    if (pid > 0) exit(EXIT_SUCCESS);

    // Step 4: Set file mode mask
    umask(027);

    // Step 5: Change working directory to /
    chdir("/");

    // Step 6: Close all open file descriptors
    for (int fd = sysconf(_SC_OPEN_MAX); fd >= 0; fd--)
        close(fd);

    // Step 7: Redirect stdin/stdout/stderr to /dev/null
    int devnull = open("/dev/null", O_RDWR);
    dup2(devnull, STDIN_FILENO);
    dup2(devnull, STDOUT_FILENO);
    dup2(devnull, STDERR_FILENO);
    if (devnull > 2) close(devnull);

    // Daemon is now running detached from terminal
}
```

**Modern alternative:** Let systemd manage the process. Set `Type=forking` or use `sd_notify` with `Type=notify`.

---

## `posix_spawn()` — Lighter Alternative

```c
#include <spawn.h>

// posix_spawn: fork+exec in one step (more efficient on some platforms)
pid_t pid;
char* const argv[] = { "ls", "-la", NULL };
char* const envp[] = { NULL };

int ret = posix_spawn(&pid, "/bin/ls", NULL, NULL, argv, envp);
if (ret != 0) { errno = ret; perror("posix_spawn"); }

waitpid(pid, NULL, 0);
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `fork()` and `exec()`?**

> `fork()` creates a **copy** of the current process — both parent and child continue running the same code. `exec()` **replaces** the current process image with a new program — the calling process ceases to run its old code. They are almost always used together: `fork()` creates a child, then the child calls `exec()` to run a different program, while the parent `wait()`s for it. PID does not change across `exec()`.

**Q2 — Basic: What is a zombie process and how do you prevent it?**

> When a process exits, it becomes a zombie until its parent calls `wait()` or `waitpid()` to collect its exit status. The kernel retains the process table entry (PID, exit code) until the parent reaps it. Zombies are prevented by: (1) calling `waitpid()` explicitly after spawning children, (2) installing a `SIGCHLD` handler that calls `waitpid(-1, NULL, WNOHANG)` in a loop, or (3) setting `SA_NOCLDWAIT` or `SIG_IGN` for `SIGCHLD` to tell the kernel to auto-reap children.

**Q3 — Intermediate: Explain copy-on-write in `fork()`.**

> After `fork()`, parent and child share the same physical memory pages, all marked read-only. When either process writes to a page, the MMU triggers a page fault. The kernel then allocates a new physical page, copies the content, and maps it into the writing process's address space — only that page is duplicated. This makes `fork()` O(1) in cost regardless of process size, as long as no pages are written. It's especially efficient for `fork()` + `exec()` patterns where the child immediately replaces its memory with a new program.

**Q4 — Advanced: What are the steps to create a proper POSIX daemon?**

> (1) `fork()` and exit the parent — detaches from the shell's process group. (2) `setsid()` to create a new session and detach from the controlling terminal. (3) `fork()` again to prevent the daemon from re-acquiring a controlling terminal. (4) `umask(0)` or `umask(027)` to set safe file creation permissions. (5) `chdir("/")` to avoid blocking unmounts. (6) Close all inherited file descriptors. (7) Redirect `stdin`/`stdout`/`stderr` to `/dev/null`. Modern practice is to use systemd with `Type=notify` and `sd_notify()` instead, which simplifies this considerably.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 2 fork` | fork() manual |
| `man 2 execve` | exec family manual |
| `man 2 waitpid` | waitpid manual |
| `man 7 daemon` | Daemon creation guidelines |
| TLPI — The Linux Programming Interface | Chapters 24–27 (process creation) |
