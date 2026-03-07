---
layout: guide
title: "Pthreads"
description: "Master POSIX threads — pthread_create/join/detach, thread attributes, stack size, CPU affinity, cancellation, thread-local storage, and thread safety patterns."
stage: "Stage 04"
phase: "linux-developer-posix"
phase_label: "Phase 02 — Linux Developer"
phase_name: "POSIX APIs & Concurrency"
phase_index: "/linux-developer/posix/"
permalink: /linux-developer/posix/pthreads/
prev_topic:
  title: "UNIX Sockets"
  url: /linux-developer/posix/unix-sockets/
next_topic:
  title: "Mutexes & Semaphores"
  url: /linux-developer/posix/mutexes-semaphores/
---

## Creating and Joining Threads
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Threads share the same process address space (code, heap, global data) but each has its own stack and registers.

```c
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>

// Link with -lpthread

typedef struct {
    int   id;
    float value;
} SensorArgs;

static void* sensor_thread(void* arg) {
    SensorArgs* a = (SensorArgs*)arg;

    printf("Thread %d: reading sensor, value=%.2f\n", a->id, a->value);

    // Return a value through heap allocation (caller must free)
    float* result = malloc(sizeof(float));
    *result = a->value * 2.0f;
    return result;   // returned as void* via pthread_join
}

int main(void) {
    pthread_t tid;
    SensorArgs args = { .id = 1, .value = 23.5f };

    // Create thread
    int err = pthread_create(&tid, NULL, sensor_thread, &args);
    if (err) {
        fprintf(stderr, "pthread_create: %s\n", strerror(err));
        return 1;
    }

    // Wait for thread to finish and get return value
    void* retval;
    pthread_join(tid, &retval);

    float* result = (float*)retval;
    printf("Thread returned: %.2f\n", *result);
    free(result);

    return 0;
}
```

### Thread State Transitions

```
pthread_create() → RUNNING → exits or pthread_cancel() → ZOMBIE
                                                             ↓
                                                     pthread_join() → resources freed
```

A **joinable** thread remains as a zombie after exit until `pthread_join()` is called. A **detached** thread's resources are freed automatically on exit.

```c
// Detach immediately (fire-and-forget)
pthread_detach(tid);

// Or create as detached from the start
pthread_attr_t attr;
pthread_attr_init(&attr);
pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
pthread_create(&tid, &attr, thread_func, NULL);
pthread_attr_destroy(&attr);
```

---

## Thread Attributes
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

```c
pthread_attr_t attr;
pthread_attr_init(&attr);

// Stack size (default is usually 8MB per thread)
pthread_attr_setstacksize(&attr, 64 * 1024);  // 64KB for small embedded threads

// Scheduling policy (needs root or CAP_SYS_NICE)
struct sched_param sp = { .sched_priority = 50 };
pthread_attr_setschedpolicy(&attr, SCHED_FIFO);    // real-time FIFO
pthread_attr_setschedparam(&attr, &sp);
pthread_attr_setinheritsched(&attr, PTHREAD_EXPLICIT_SCHED);

pthread_create(&tid, &attr, thread_func, NULL);
pthread_attr_destroy(&attr);  // always destroy after use
```

### Scheduling Policies

| Policy | Description | Priority Range |
|--------|-------------|----------------|
| `SCHED_OTHER` | Default CFS (fair share) | 0 (nice -20..+19) |
| `SCHED_FIFO` | Real-time FIFO | 1–99 |
| `SCHED_RR` | Real-time round-robin | 1–99 |
| `SCHED_DEADLINE` | EDF with deadlines | — |

---

## CPU Affinity
{:.gc-mid}

Bind a thread to specific CPU cores to reduce cache thrashing and improve determinism.

```c
#define _GNU_SOURCE
#include <sched.h>
#include <pthread.h>

// Bind the current thread to CPU 0
cpu_set_t cpuset;
CPU_ZERO(&cpuset);
CPU_SET(0, &cpuset);

int err = pthread_setaffinity_np(pthread_self(), sizeof(cpuset), &cpuset);
if (err) fprintf(stderr, "setaffinity: %s\n", strerror(err));

// Verify
CPU_ZERO(&cpuset);
pthread_getaffinity_np(pthread_self(), sizeof(cpuset), &cpuset);
for (int i = 0; i < CPU_SETSIZE; i++)
    if (CPU_ISSET(i, &cpuset))
        printf("Bound to CPU %d\n", i);

// Using sched_setaffinity for the process
pid_t tid = gettid();
sched_setaffinity(tid, sizeof(cpuset), &cpuset);
```

---

## Thread-Local Storage (TLS)
{:.gc-mid}

Each thread gets its own copy of thread-local variables — no sharing, no locking needed.

```c
// C11 thread-local storage
_Thread_local int errno_copy;
_Thread_local char last_error[256];

// GCC extension (older code)
__thread int tls_var = 0;

// POSIX keys — dynamic TLS (useful in libraries)
static pthread_key_t tls_key;

static void tls_destructor(void* val) {
    free(val);
}

void init_tls(void) {
    pthread_key_create(&tls_key, tls_destructor);
}

void* get_thread_buffer(void) {
    void* buf = pthread_getspecific(tls_key);
    if (!buf) {
        buf = malloc(1024);
        pthread_setspecific(tls_key, buf);
    }
    return buf;
}
```

---

## Thread Cancellation
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

```c
// Request cancellation of a thread
pthread_cancel(tid);   // asynchronous request

// Thread should have cancellation points (blocking syscalls)
// OR set cancellation type to PTHREAD_CANCEL_ASYNCHRONOUS (dangerous)

// Control cancellation
pthread_setcancelstate(PTHREAD_CANCEL_DISABLE, NULL);  // disable in critical section
// ... critical work ...
pthread_setcancelstate(PTHREAD_CANCEL_ENABLE, NULL);   // re-enable

// Cancellation cleanup handlers
pthread_cleanup_push(cleanup_func, arg);
// ... code that might be cancelled ...
pthread_cleanup_pop(1);   // 1 = execute handler; 0 = pop without executing
```

**Cancellation points** include: `read()`, `write()`, `sleep()`, `pthread_cond_wait()`, `sem_wait()`. If a thread is cancelled while blocked in one of these, the cleanup handlers run.

---

## Thread Pool Pattern

```c
#include <pthread.h>
#include <semaphore.h>

#define POOL_SIZE 4
#define QUEUE_SIZE 64

typedef void (*task_fn)(void* arg);

typedef struct { task_fn fn; void* arg; } Task;
typedef struct {
    pthread_t   threads[POOL_SIZE];
    Task        queue[QUEUE_SIZE];
    int         head, tail, count;
    pthread_mutex_t lock;
    pthread_cond_t  not_empty;
    int         running;
} ThreadPool;

static void* worker(void* p) {
    ThreadPool* pool = p;
    while (1) {
        pthread_mutex_lock(&pool->lock);
        while (pool->count == 0 && pool->running)
            pthread_cond_wait(&pool->not_empty, &pool->lock);
        if (!pool->running && pool->count == 0) {
            pthread_mutex_unlock(&pool->lock);
            return NULL;
        }
        Task t = pool->queue[pool->head++];
        pool->head %= QUEUE_SIZE;
        pool->count--;
        pthread_mutex_unlock(&pool->lock);
        t.fn(t.arg);
    }
}

void pool_submit(ThreadPool* pool, task_fn fn, void* arg) {
    pthread_mutex_lock(&pool->lock);
    pool->queue[pool->tail++] = (Task){ fn, arg };
    pool->tail %= QUEUE_SIZE;
    pool->count++;
    pthread_cond_signal(&pool->not_empty);
    pthread_mutex_unlock(&pool->lock);
}
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What resources do threads share and what do they have independently?**

> Threads within a process **share**: virtual address space (code, heap, global variables, mmap regions), file descriptor table, signal handlers, and working directory. Each thread has its **own**: stack, stack pointer, program counter, CPU registers, signal mask, thread ID (`pthread_t`), errno, and thread-local storage. Because threads share heap and globals, concurrent access to shared data requires synchronisation.

**Q2 — Basic: What is the difference between `pthread_join()` and `pthread_detach()`?**

> `pthread_join()` blocks the calling thread until the target thread exits, then frees its resources and retrieves its return value. The target must be joinable (the default). `pthread_detach()` marks a thread as detached — its resources are freed automatically when it exits, but you cannot join it or get its return value. Use join when you need to wait for a result or ensure cleanup before proceeding. Use detach for fire-and-forget threads (background logging, periodic tasks).

**Q3 — Intermediate: What is thread-local storage and when do you need it?**

> Thread-local storage (TLS) gives each thread its own independent copy of a variable. Without TLS, a global like `errno` would be a race condition — one thread could overwrite another's error code. TLS is needed for per-thread state that shouldn't be shared: error codes, random number generator state, per-thread buffers, or connection handles in a thread-pool server. Declare with `_Thread_local` (C11/C++11) or use POSIX `pthread_key_create`.

**Q4 — Advanced: How do you set a thread's real-time scheduling priority and why might you need it?**

> Create a `pthread_attr_t`, set `PTHREAD_EXPLICIT_SCHED`, policy `SCHED_FIFO` or `SCHED_RR`, and priority (1–99) via `pthread_attr_setschedparam`. This requires `CAP_SYS_NICE` or running as root. Real-time scheduling is needed when a thread must respond to hardware events within a bounded latency — e.g. a thread handling CAN bus messages or SPI sensor interrupts in an embedded system. `SCHED_FIFO` preempts all `SCHED_OTHER` threads and won't be preempted by a lower-priority real-time thread unless it blocks.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 7 pthreads` | POSIX thread overview |
| `man 3 pthread_create` | Thread creation |
| `man 3 pthread_attr_init` | Thread attributes |
| TLPI Chapters 29–33 | Comprehensive pthreads coverage |
| `man 2 sched_setaffinity` | CPU affinity |
