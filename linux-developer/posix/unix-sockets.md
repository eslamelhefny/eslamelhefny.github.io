---
layout: guide
title: "UNIX Sockets"
description: "Master the POSIX socket API — TCP/UDP server and client patterns, non-blocking I/O, socket options, and UNIX domain sockets for high-performance local IPC."
stage: "Stage 04"
phase: "linux-developer-posix"
phase_label: "Phase 02 — Linux Developer"
phase_name: "POSIX APIs & Concurrency"
phase_index: "/linux-developer/posix/"
permalink: /linux-developer/posix/unix-sockets/
prev_topic:
  title: "Signals"
  url: /linux-developer/posix/signals/
next_topic:
  title: "Pthreads"
  url: /linux-developer/posix/pthreads/
---

## Socket Basics
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

A **socket** is a file descriptor for network or inter-process communication. The POSIX socket API is the same across TCP, UDP, and UNIX domain sockets — only the address family and creation parameters differ.

```
socket() → bind() → listen() → accept() → read()/write() → close()
              [server side]

socket() → connect() → read()/write() → close()
              [client side]
```

---

## TCP Server
{:.gc-basic}

```c
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    // 1. Create socket
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd == -1) { perror("socket"); exit(1); }

    // 2. Set socket options (allow address reuse)
    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    // 3. Bind to address and port
    struct sockaddr_in addr = {
        .sin_family      = AF_INET,
        .sin_addr.s_addr = INADDR_ANY,   // all interfaces
        .sin_port        = htons(8080),
    };
    if (bind(server_fd, (struct sockaddr*)&addr, sizeof(addr)) == -1) {
        perror("bind"); exit(1);
    }

    // 4. Listen for connections
    listen(server_fd, 10);   // backlog = 10
    printf("Listening on :8080\n");

    while (1) {
        // 5. Accept a client connection
        struct sockaddr_in client_addr;
        socklen_t len = sizeof(client_addr);
        int client_fd = accept(server_fd,
            (struct sockaddr*)&client_addr, &len);

        char ip[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &client_addr.sin_addr, ip, sizeof(ip));
        printf("Connection from %s:%d\n", ip, ntohs(client_addr.sin_port));

        // 6. Echo server
        char buf[1024];
        ssize_t n;
        while ((n = recv(client_fd, buf, sizeof(buf), 0)) > 0)
            send(client_fd, buf, n, 0);

        close(client_fd);
    }

    close(server_fd);
    return 0;
}
```

---

## TCP Client
{:.gc-basic}

```c
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>
#include <unistd.h>

int tcp_connect(const char* host, const char* port) {
    struct addrinfo hints = {
        .ai_family   = AF_UNSPEC,     // IPv4 or IPv6
        .ai_socktype = SOCK_STREAM,
    };
    struct addrinfo* res;

    int err = getaddrinfo(host, port, &hints, &res);
    if (err) {
        fprintf(stderr, "getaddrinfo: %s\n", gai_strerror(err));
        return -1;
    }

    int fd = -1;
    for (struct addrinfo* p = res; p; p = p->ai_next) {
        fd = socket(p->ai_family, p->ai_socktype, p->ai_protocol);
        if (fd == -1) continue;

        if (connect(fd, p->ai_addr, p->ai_addrlen) == 0) break;

        close(fd);
        fd = -1;
    }
    freeaddrinfo(res);
    return fd;   // -1 on failure
}

// Usage
int fd = tcp_connect("192.168.1.100", "8080");
send(fd, "hello\n", 6, 0);
```

---

## UDP Socket
{:.gc-basic}

```c
// UDP sender
int sock = socket(AF_INET, SOCK_DGRAM, 0);

struct sockaddr_in dest = {
    .sin_family      = AF_INET,
    .sin_port        = htons(9000),
    .sin_addr.s_addr = inet_addr("192.168.1.255"),  // broadcast
};

// Allow broadcast
int bc = 1;
setsockopt(sock, SOL_SOCKET, SO_BROADCAST, &bc, sizeof(bc));

const char* msg = "sensor:23.5";
sendto(sock, msg, strlen(msg), 0,
    (struct sockaddr*)&dest, sizeof(dest));

// UDP receiver
int server = socket(AF_INET, SOCK_DGRAM, 0);
struct sockaddr_in addr = {
    .sin_family      = AF_INET,
    .sin_addr.s_addr = INADDR_ANY,
    .sin_port        = htons(9000),
};
bind(server, (struct sockaddr*)&addr, sizeof(addr));

char buf[256];
struct sockaddr_in sender;
socklen_t slen = sizeof(sender);
recvfrom(server, buf, sizeof(buf), 0,
    (struct sockaddr*)&sender, &slen);
```

---

## Non-Blocking Sockets
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

```c
#include <fcntl.h>

// Set socket to non-blocking
int flags = fcntl(fd, F_GETFL, 0);
fcntl(fd, F_SETFL, flags | O_NONBLOCK);

// Or at creation time (Linux)
int fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);

// Non-blocking recv
ssize_t n = recv(fd, buf, sizeof(buf), 0);
if (n == -1) {
    if (errno == EAGAIN || errno == EWOULDBLOCK) {
        // No data ready — try again later
    } else {
        perror("recv");
    }
}

// Non-blocking connect
connect(fd, (struct sockaddr*)&addr, sizeof(addr));
// Returns EINPROGRESS immediately
// Use poll/epoll to wait for POLLOUT, then check SO_ERROR
int err;
socklen_t errlen = sizeof(err);
getsockopt(fd, SOL_SOCKET, SO_ERROR, &err, &errlen);
if (err == 0) puts("connected!");
```

---

## UNIX Domain Sockets
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

UNIX domain sockets use the filesystem namespace instead of IP addresses. They are **faster than TCP** for local IPC (no TCP/IP overhead) and support **passing file descriptors** between processes.

```c
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

#define SOCKET_PATH "/tmp/myapp.sock"

// UNIX socket server
int server_fd = socket(AF_UNIX, SOCK_STREAM, 0);

struct sockaddr_un addr = { .sun_family = AF_UNIX };
strncpy(addr.sun_path, SOCKET_PATH, sizeof(addr.sun_path) - 1);

unlink(SOCKET_PATH);   // remove stale socket file
bind(server_fd, (struct sockaddr*)&addr, sizeof(addr));
listen(server_fd, 5);

int client_fd = accept(server_fd, NULL, NULL);
// ... communicate ...

// UNIX socket client
int fd = socket(AF_UNIX, SOCK_STREAM, 0);
connect(fd, (struct sockaddr*)&addr, sizeof(addr));
send(fd, "hello", 5, 0);
```

### Passing File Descriptors Between Processes

```c
// Send an fd over a UNIX socket (ancillary data via SCM_RIGHTS)
void send_fd(int socket_fd, int fd_to_send) {
    struct msghdr msg = {};
    struct iovec  iov = { .iov_base = "x", .iov_len = 1 };

    char cmsg_buf[CMSG_SPACE(sizeof(int))];
    msg.msg_iov        = &iov;
    msg.msg_iovlen     = 1;
    msg.msg_control    = cmsg_buf;
    msg.msg_controllen = sizeof(cmsg_buf);

    struct cmsghdr* cmsg = CMSG_FIRSTHDR(&msg);
    cmsg->cmsg_level = SOL_SOCKET;
    cmsg->cmsg_type  = SCM_RIGHTS;
    cmsg->cmsg_len   = CMSG_LEN(sizeof(int));
    memcpy(CMSG_DATA(cmsg), &fd_to_send, sizeof(int));

    sendmsg(socket_fd, &msg, 0);
}
```

---

## Useful Socket Options

```c
// SO_REUSEADDR — allow binding to a recently used port
int opt = 1;
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

// SO_KEEPALIVE — detect dead connections
setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, &opt, sizeof(opt));

// TCP_NODELAY — disable Nagle's algorithm (reduce latency for small packets)
#include <netinet/tcp.h>
setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &opt, sizeof(opt));

// SO_RCVTIMEO / SO_SNDTIMEO — read/write timeout
struct timeval tv = { .tv_sec = 5, .tv_usec = 0 };
setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

// SO_SNDBUF / SO_RCVBUF — set socket buffer sizes
int bufsize = 1024 * 1024;   // 1MB
setsockopt(fd, SOL_SOCKET, SO_SNDBUF, &bufsize, sizeof(bufsize));
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: Explain the TCP server lifecycle: socket → bind → listen → accept.**

> `socket()` creates the endpoint (just an fd, no address yet). `bind()` assigns a local address and port — this is what clients connect to. `listen()` marks the socket as passive, creating a connection request queue with a given backlog (maximum pending connections). `accept()` dequeues the next completed connection from the kernel's accept queue, returning a **new fd** for the individual client connection. The original listening socket remains open for more `accept()` calls.

**Q2 — Basic: What is the difference between `TCP` (SOCK_STREAM) and `UDP` (SOCK_DGRAM)?**

> TCP is connection-oriented, reliable, ordered, and flow-controlled — the kernel guarantees delivery and correct ordering. Suitable for applications needing data integrity (file transfer, HTTP). UDP is connectionless, unreliable, and has no ordering guarantee — each datagram is sent independently. Suitable for latency-sensitive applications that can tolerate some loss (real-time sensor data, video streaming, DNS). UDP has lower overhead (no connection setup, no ACKs).

**Q3 — Intermediate: What is `SO_REUSEADDR` and why is it needed?**

> When a TCP server restarts, the kernel keeps the old port in `TIME_WAIT` state for up to 2×MSL (typically 2–4 minutes) to absorb delayed packets. Without `SO_REUSEADDR`, `bind()` fails with `EADDRINUSE` during this period. `SO_REUSEADDR` allows the port to be reused immediately by a new socket, even while old connections are in `TIME_WAIT`. Always set this option on server sockets before `bind()`.

**Q4 — Advanced: What are UNIX domain sockets and when do you prefer them over TCP for IPC?**

> UNIX domain sockets are identified by filesystem paths instead of IP addresses. They only work between processes on the same machine. Advantages over TCP for local IPC: (1) **Performance** — no TCP/IP protocol overhead, no network stack, data stays in kernel memory; benchmarks show 2–5× higher throughput for local communication. (2) **Security** — permissions enforced by filesystem; you can authenticate the peer with `SCM_CREDENTIALS`. (3) **File descriptor passing** — `SCM_RIGHTS` ancillary data allows passing open fds between processes, impossible over TCP. Use UNIX sockets for daemon ↔ client communication on the same host (e.g. systemd, Docker, X11).

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 7 socket` | Socket API overview |
| `man 7 ip` | IPv4 socket options |
| `man 7 unix` | UNIX domain socket manual |
| `man 7 tcp` | TCP socket options |
| Beej's Guide to Network Programming | [beej.us/guide/bgnet](https://beej.us/guide/bgnet/) |
