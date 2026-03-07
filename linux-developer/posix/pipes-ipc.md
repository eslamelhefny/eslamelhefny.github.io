---
layout: guide
title: "Pipes & Shared Memory"
description: "Master Linux IPC mechanisms — anonymous and named pipes, POSIX shared memory (shm_open), message queues (mq_open), and memory-mapped IPC with mmap."
stage: "Stage 04"
phase: "linux-developer-posix"
phase_label: "Phase 02 — Linux Developer"
phase_name: "POSIX APIs & Concurrency"
phase_index: "/linux-developer/posix/"
permalink: /linux-developer/posix/pipes-ipc/
prev_topic:
  title: "Mutexes & Semaphores"
  url: /linux-developer/posix/mutexes-semaphores/
---

## IPC Overview
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

**Inter-Process Communication (IPC)** allows separate processes to exchange data or synchronise. Linux provides multiple IPC mechanisms, each with different performance and usage characteristics.

| Mechanism | Direction | Persistence | Kernel buffered | Best for |
|-----------|-----------|-------------|-----------------|---------|
| Pipe (anonymous) | Unidirectional | Process lifetime | Yes | Parent↔child |
| Named pipe (FIFO) | Unidirectional | Filesystem | Yes | Unrelated processes |
| POSIX shared memory | Bidirectional | Until unlinked | No (direct) | High-speed data sharing |
| POSIX message queue | Bidirectional | Until unlinked | Yes | Structured messages |
| UNIX domain socket | Bidirectional | Process lifetime | Yes | General IPC, fd passing |

---

## Anonymous Pipes
{:.gc-basic}

```c
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>

int main(void) {
    int pipefd[2];   // pipefd[0] = read end, pipefd[1] = write end

    if (pipe(pipefd) == -1) { perror("pipe"); exit(1); }

    pid_t pid = fork();

    if (pid == 0) {
        // --- CHILD: write to pipe ---
        close(pipefd[0]);   // close unused read end

        const char* msg = "Hello from child";
        write(pipefd[1], msg, strlen(msg));
        close(pipefd[1]);
        exit(0);

    } else {
        // --- PARENT: read from pipe ---
        close(pipefd[1]);   // close unused write end

        char buf[128] = {0};
        ssize_t n = read(pipefd[0], buf, sizeof(buf) - 1);
        printf("Parent received: %s\n", buf);
        close(pipefd[0]);

        waitpid(pid, NULL, 0);
    }
    return 0;
}
```

### Pipe as stdin/stdout for a Child Process

```c
// Redirect child's stdout to our pipe (like shell pipe)
int pipefd[2];
pipe(pipefd);

pid_t pid = fork();
if (pid == 0) {
    close(pipefd[0]);                  // child doesn't read
    dup2(pipefd[1], STDOUT_FILENO);    // stdout → write end of pipe
    close(pipefd[1]);
    execlp("ls", "ls", "-la", NULL);   // output goes to pipe
    exit(1);
} else {
    close(pipefd[1]);                  // parent doesn't write
    char buf[4096];
    ssize_t n = read(pipefd[0], buf, sizeof(buf));
    // process ls output
    close(pipefd[0]);
    waitpid(pid, NULL, 0);
}
```

### Pipe Properties

- **Capacity**: typically 64KB (Linux default); write blocks when full
- **Atomic writes**: writes up to `PIPE_BUF` (4096+ bytes) are atomic
- **EOF**: read returns 0 when all write ends are closed
- **SIGPIPE**: writing to a pipe with no readers sends `SIGPIPE`

---

## Named Pipes (FIFOs)
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

A named pipe (FIFO) appears as a filesystem entry — unrelated processes can use it.

```bash
# Create from shell
mkfifo /tmp/myfifo
ls -la /tmp/myfifo
# prw-r--r-- 1 user user 0 Mar  7 12:00 /tmp/myfifo
```

```c
#include <sys/stat.h>
#include <fcntl.h>

// Create programmatically
mkfifo("/tmp/sensor_fifo", 0644);

// Writer process
int fd = open("/tmp/sensor_fifo", O_WRONLY);  // blocks until reader opens
write(fd, &sensor_value, sizeof(float));
close(fd);

// Reader process
int fd = open("/tmp/sensor_fifo", O_RDONLY);  // blocks until writer opens
float val;
read(fd, &val, sizeof(float));
close(fd);
```

---

## POSIX Shared Memory
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

Shared memory is the **fastest IPC** — processes read/write directly to the same physical memory pages. Requires explicit synchronisation (mutex/semaphore) to prevent races.

```c
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>
#include <semaphore.h>

#define SHM_NAME  "/sensor_shm"
#define SEM_NAME  "/sensor_sem"

// Shared data structure
typedef struct {
    float    temperature;
    float    humidity;
    uint32_t sequence;
    int      updated;
} SensorData;

// --- PRODUCER (writer) ---
int shm_fd = shm_open(SHM_NAME, O_CREAT | O_RDWR, 0644);
ftruncate(shm_fd, sizeof(SensorData));

SensorData* shm = mmap(NULL, sizeof(SensorData),
    PROT_READ | PROT_WRITE, MAP_SHARED, shm_fd, 0);

sem_t* sem = sem_open(SEM_NAME, O_CREAT, 0644, 1);

// Update shared data with semaphore protection
sem_wait(sem);
shm->temperature = 23.5f;
shm->humidity    = 65.0f;
shm->sequence++;
shm->updated     = 1;
sem_post(sem);

munmap(shm, sizeof(SensorData));
close(shm_fd);

// --- CONSUMER (reader) ---
int shm_fd = shm_open(SHM_NAME, O_RDONLY, 0);
SensorData* shm = mmap(NULL, sizeof(SensorData),
    PROT_READ, MAP_SHARED, shm_fd, 0);

sem_t* sem = sem_open(SEM_NAME, 0);

sem_wait(sem);
float t = shm->temperature;
float h = shm->humidity;
sem_post(sem);

printf("Temp=%.1f°C  Humidity=%.1f%%\n", t, h);

// Cleanup (done by one process, usually the producer/creator)
munmap(shm, sizeof(SensorData));
close(shm_fd);
shm_unlink(SHM_NAME);   // remove from /dev/shm
sem_close(sem);
sem_unlink(SEM_NAME);
```

**Link with `-lrt` and `-lpthread`.**

---

## POSIX Message Queues
{:.gc-mid}

Message queues deliver **typed, prioritised messages** between processes. Each message has a priority — higher-priority messages are received first.

```c
#include <mqueue.h>

#define MQ_NAME  "/sensor_queue"

// --- SENDER ---
struct mq_attr attr = {
    .mq_maxmsg  = 10,    // max 10 messages in queue
    .mq_msgsize = 128,   // max 128 bytes per message
};
mqd_t mq = mq_open(MQ_NAME, O_CREAT | O_WRONLY, 0644, &attr);

typedef struct { int id; float value; } SensorMsg;
SensorMsg msg = { .id = 1, .value = 23.5f };

mq_send(mq, (char*)&msg, sizeof(msg), 5);   // priority 5
mq_close(mq);

// --- RECEIVER ---
mqd_t mq = mq_open(MQ_NAME, O_RDONLY);

SensorMsg msg;
unsigned int prio;
ssize_t n = mq_receive(mq, (char*)&msg, sizeof(msg), &prio);
printf("ID=%d Val=%.1f prio=%u\n", msg.id, msg.value, prio);

mq_close(mq);
mq_unlink(MQ_NAME);

// Async notification (signal or thread when message arrives)
struct sigevent sev = {
    .sigev_notify = SIGEV_SIGNAL,
    .sigev_signo  = SIGUSR1,
};
mq_notify(mq, &sev);
```

---

## IPC Performance Comparison

```
Shared memory:  ~1GB/s  (direct memory access, no syscall overhead)
UNIX socket:    ~300MB/s (syscall, kernel copy)
POSIX mq:       ~200MB/s (syscall, kernel copy)
Pipe:           ~200MB/s (syscall, kernel copy)
TCP loopback:   ~100MB/s (full network stack)
```

For **high-frequency, large data** (video frames, radar data): shared memory + semaphore.
For **control messages, commands**: message queue or UNIX socket.

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between a pipe and a FIFO?**

> An anonymous **pipe** is created with `pipe()` and exists only in the kernel — it has no filesystem entry and can only be used between related processes (parent and children that inherited the file descriptors). A **FIFO** (named pipe) is created with `mkfifo()` and appears as a filesystem entry — any two processes on the same system can open it by name, regardless of process relationship. Both provide unidirectional, kernel-buffered byte streams with the same kernel implementation.

**Q2 — Intermediate: Why is shared memory the fastest IPC mechanism?**

> With shared memory, the kernel maps the same physical memory pages into two (or more) processes' virtual address spaces. Writes by one process are immediately visible to others reading the same memory — there is no data copy and no syscall involved in the actual data transfer. Other IPC mechanisms (pipes, sockets, message queues) require at least one kernel copy: data must be written to a kernel buffer by the sender and copied to the receiver's buffer. For multi-megabyte payloads (images, sensor buffers), this difference is significant.

**Q3 — Intermediate: How do you synchronise access to shared memory between processes?**

> Unlike mutexes (which only work within one process by default), you need inter-process synchronisation. Options: (1) **POSIX named semaphore** (`sem_open`) — easy to use; (2) **`pthread_mutex` with `PTHREAD_PROCESS_SHARED`** attribute — lower overhead; must be stored in the shared memory itself; (3) **`pthread_cond_t` with `PTHREAD_PROCESS_SHARED`** — for condition synchronisation; (4) **Atomic operations** — for simple cases (single producer, single consumer). Always initialise the lock in the shared region before mapping in the consumer.

**Q4 — Advanced: What happens when a write end of a pipe is closed while a reader is blocked?**

> When all write ends of a pipe are closed and the reader calls `read()`, it returns 0 (EOF). If the reader is blocked in `read()`, it will be unblocked and receive 0. Conversely, when all read ends are closed and a process writes to the pipe, it receives `SIGPIPE` (default action: terminate). If `SIGPIPE` is ignored or handled, `write()` returns -1 with `errno == EPIPE`. Always close the unused end of a pipe in each process, and always handle broken pipe conditions in production code.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 2 pipe` | Pipe system call |
| `man 7 fifo` | Named pipe overview |
| `man 7 shm_overview` | POSIX shared memory overview |
| `man 7 mq_overview` | POSIX message queue overview |
| TLPI Chapters 44–48 | IPC mechanisms in depth |
