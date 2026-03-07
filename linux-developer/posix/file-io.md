---
layout: guide
title: "POSIX File I/O"
description: "Master Linux file I/O — open/read/write/close, file descriptors, O_flags, ioctl, mmap memory-mapped I/O, and I/O multiplexing with select, poll, and epoll."
stage: "Stage 04"
phase: "linux-developer-posix"
phase_label: "Phase 02 — Linux Developer"
phase_name: "POSIX APIs & Concurrency"
phase_index: "/linux-developer/posix/"
permalink: /linux-developer/posix/file-io/
next_topic:
  title: "Processes & fork()"
  url: /linux-developer/posix/processes-fork/
---

## File Descriptors and Basic I/O
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Every open file, socket, pipe, or device in Linux is represented by an integer **file descriptor (fd)**. The kernel maintains a per-process table of open file descriptions.

```c
#include <fcntl.h>
#include <unistd.h>
#include <sys/types.h>

// Standard file descriptors
// STDIN_FILENO  = 0
// STDOUT_FILENO = 1
// STDERR_FILENO = 2

// open() — returns fd or -1 on error (check errno)
int fd = open("/dev/ttyS0", O_RDWR | O_NOCTTY | O_NDELAY);
if (fd == -1) {
    perror("open");
    exit(EXIT_FAILURE);
}

// read() — returns bytes read, 0 on EOF, -1 on error
uint8_t buf[256];
ssize_t n = read(fd, buf, sizeof(buf));

// write() — returns bytes written, -1 on error
const char* msg = "Hello\r\n";
ssize_t w = write(fd, msg, strlen(msg));

// close() — always close when done!
close(fd);
```

### Important `open()` Flags

| Flag | Meaning |
|------|---------|
| `O_RDONLY` | Read only |
| `O_WRONLY` | Write only |
| `O_RDWR` | Read + write |
| `O_CREAT` | Create file if it doesn't exist |
| `O_TRUNC` | Truncate file to zero length |
| `O_APPEND` | All writes go to end of file |
| `O_NONBLOCK` | Non-blocking mode |
| `O_SYNC` | Sync writes to disk before returning |
| `O_CLOEXEC` | Close fd on `exec()` (avoid fd leaks) |

```c
// Create or overwrite a file with mode 0644
int fd = open("output.bin", O_WRONLY | O_CREAT | O_TRUNC, 0644);
```

### Robust Read/Write Loops

```c
// read() may return fewer bytes than requested (partial read)!
// Always loop until all bytes are read.
ssize_t read_all(int fd, void* buf, size_t count) {
    size_t total = 0;
    uint8_t* p = (uint8_t*)buf;
    while (total < count) {
        ssize_t n = read(fd, p + total, count - total);
        if (n == 0) return total;        // EOF
        if (n == -1) {
            if (errno == EINTR) continue;  // interrupted by signal
            return -1;                     // real error
        }
        total += n;
    }
    return total;
}

ssize_t write_all(int fd, const void* buf, size_t count) {
    size_t total = 0;
    const uint8_t* p = (const uint8_t*)buf;
    while (total < count) {
        ssize_t n = write(fd, p + total, count - total);
        if (n == -1) {
            if (errno == EINTR) continue;
            return -1;
        }
        total += n;
    }
    return total;
}
```

---

## `lseek`, File Positions, and `ioctl`
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

```c
#include <sys/ioctl.h>

// lseek — reposition file offset
off_t pos = lseek(fd, 0, SEEK_SET);    // go to start
off_t cur = lseek(fd, 0, SEEK_CUR);    // current position
off_t end = lseek(fd, 0, SEEK_END);    // file size

lseek(fd, 100, SEEK_SET);   // go to byte 100
lseek(fd, -4,  SEEK_CUR);   // go back 4 bytes from current

// ioctl — device-specific control
#include <linux/serial.h>
struct serial_struct ss;
ioctl(fd, TIOCGSERIAL, &ss);    // get serial info
ss.flags |= ASYNC_LOW_LATENCY;
ioctl(fd, TIOCSSERIAL, &ss);    // set serial info

// Terminal I/O (tty)
#include <termios.h>
struct termios tty;
tcgetattr(fd, &tty);
cfsetispeed(&tty, B115200);
cfsetospeed(&tty, B115200);
tty.c_cflag &= ~PARENB;    // no parity
tty.c_cflag &= ~CSTOPB;    // 1 stop bit
tty.c_cflag |= CS8;        // 8 data bits
tty.c_cflag |= CREAD | CLOCAL;
tcsetattr(fd, TCSANOW, &tty);

// Get number of bytes waiting in serial receive buffer
int bytes_waiting;
ioctl(fd, FIONREAD, &bytes_waiting);
```

---

## Memory-Mapped I/O (`mmap`)
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

`mmap` maps a file (or device register space) directly into the process's virtual address space. Reads and writes go to/from the kernel's page cache — no `read()`/`write()` syscalls needed.

```c
#include <sys/mman.h>

// Map a file into memory (read-only)
int fd = open("large_data.bin", O_RDONLY);
struct stat sb;
fstat(fd, &sb);

uint8_t* data = mmap(NULL, sb.st_size,
                     PROT_READ,
                     MAP_PRIVATE, fd, 0);
if (data == MAP_FAILED) { perror("mmap"); exit(1); }

close(fd);   // fd can be closed after mmap

// Access file contents as array — zero copies!
process_data(data, sb.st_size);

munmap(data, sb.st_size);
```

### `mmap` for Hardware Registers (Embedded Linux)

```c
#include <sys/mman.h>

#define GPIO_BASE 0x3F200000   // Raspberry Pi GPIO base
#define BLOCK_SIZE 4096

int mem_fd = open("/dev/mem", O_RDWR | O_SYNC);

volatile uint32_t* gpio = mmap(NULL, BLOCK_SIZE,
    PROT_READ | PROT_WRITE, MAP_SHARED, mem_fd, GPIO_BASE);

if (gpio == MAP_FAILED) {
    perror("mmap"); exit(1);
}

// Direct register access — no syscall overhead!
gpio[0] = (gpio[0] & ~(7 << 21)) | (1 << 21);  // GPIO 17 output
gpio[7] = (1 << 17);    // GPIO_SET: pin 17 high
gpio[10] = (1 << 17);   // GPIO_CLR: pin 17 low
```

### `mmap` Flags

| Flag | Meaning |
|------|---------|
| `MAP_PRIVATE` | Copy-on-write; changes not visible to other processes |
| `MAP_SHARED` | Changes visible to other processes sharing the mapping |
| `MAP_ANONYMOUS` | Not backed by a file (use for shared memory between fork'd processes) |
| `PROT_READ` | Pages can be read |
| `PROT_WRITE` | Pages can be written |
| `PROT_EXEC` | Pages can be executed |

---

## I/O Multiplexing: `select`, `poll`, `epoll`
{:.gc-adv}

Watch multiple file descriptors simultaneously — without blocking on any single one.

### `poll` — Simpler than `select`

```c
#include <poll.h>

int fd1 = open("/dev/ttyS0", O_RDWR | O_NONBLOCK);
int fd2 = open("/dev/ttyS1", O_RDWR | O_NONBLOCK);

struct pollfd fds[2] = {
    { .fd = fd1, .events = POLLIN },
    { .fd = fd2, .events = POLLIN },
};

while (1) {
    int ret = poll(fds, 2, 1000);  // timeout: 1000ms
    if (ret == -1) { perror("poll"); break; }
    if (ret == 0)  { puts("timeout"); continue; }

    if (fds[0].revents & POLLIN) {
        uint8_t buf[64];
        ssize_t n = read(fd1, buf, sizeof(buf));
        handle_data(buf, n);
    }
    if (fds[1].revents & POLLIN) {
        // read fd2
    }
}
```

### `epoll` — Scalable for Many File Descriptors

```c
#include <sys/epoll.h>

int epfd = epoll_create1(0);   // create epoll instance

// Add file descriptors to watch
struct epoll_event ev = { .events = EPOLLIN, .data.fd = fd1 };
epoll_ctl(epfd, EPOLL_CTL_ADD, fd1, &ev);

ev.data.fd = fd2;
epoll_ctl(epfd, EPOLL_CTL_ADD, fd2, &ev);

struct epoll_event events[10];
while (1) {
    int n = epoll_wait(epfd, events, 10, -1);  // -1 = wait forever
    for (int i = 0; i < n; i++) {
        if (events[i].events & EPOLLIN) {
            int ready_fd = events[i].data.fd;
            uint8_t buf[256];
            read(ready_fd, buf, sizeof(buf));
            // process...
        }
    }
}
close(epfd);
```

**`poll` vs `epoll`:**

| | `poll` | `epoll` |
|--|--------|---------|
| FD limit | System limit | Thousands |
| Scan per call | O(n) — scans all FDs | O(ready) — only ready FDs |
| Use case | Few FDs (< ~100) | Many FDs (servers, daemons) |
| API | Simple | More complex (create/ctl/wait) |

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is a file descriptor and what does `O_CLOEXEC` do?**

> A file descriptor is a small non-negative integer that is an index into the kernel's per-process open file table. `O_CLOEXEC` marks the fd to be automatically closed when `exec()` is called. Without it, open fds are inherited by `exec()`'d child processes — a security risk and resource leak. Best practice: always use `O_CLOEXEC` when opening fds you don't intend to pass to child processes.

**Q2 — Basic: Why must `read()` and `write()` be called in a loop?**

> POSIX allows `read()` and `write()` to transfer fewer bytes than requested — a **partial read/write**. This can happen due to signals (`EINTR`), kernel buffer limits, or available data. A `read()` of 1000 bytes on a socket may return 400. If you don't loop until all bytes are transferred, your application will silently process incomplete data. Always wrap I/O in a loop that checks the return value and accounts for both `EINTR` and partial transfers.

**Q3 — Intermediate: When would you use `mmap` instead of `read()`/`write()`?**

> `mmap` is ideal when: (a) processing large files where you want random access without seeking, (b) sharing memory between processes (`MAP_SHARED`), (c) mapping hardware register space in embedded Linux drivers (`/dev/mem`), or (d) zero-copy file-to-network transfers with `sendfile`. `read()`/`write()` is better for sequential streaming I/O, small amounts of data, and when you need explicit control over buffering. `mmap` avoids double-copying (kernel buffer → user buffer) but has overhead from page faults on first access.

**Q4 — Advanced: Explain the difference between `poll` and `epoll`, and when you'd choose `epoll`.**

> Both monitor file descriptors for events. `poll` takes the entire list of watched FDs on every call — it runs in O(n) where n is the number of FDs, regardless of how many are ready. `epoll` maintains a kernel-side interest list; you add/remove FDs with `epoll_ctl`. `epoll_wait` only returns the ready FDs — O(ready events), not O(all FDs). For a server with 10,000 connections but only 10 active at a time, `poll` scans all 10,000 while `epoll` returns the 10. Choose `epoll` for high-connection-count servers; `poll` for simple programs with a handful of FDs.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 2 open` | POSIX open manual |
| `man 2 mmap` | mmap manual |
| `man 7 epoll` | epoll API overview |
| The Linux Programming Interface (TLPI) | M. Kerrisk — definitive POSIX reference |
| `man 7 signal` | Signal handling reference |
