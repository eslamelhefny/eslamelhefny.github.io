---
layout: guide
title: "Mutexes & Semaphores"
description: "Master POSIX synchronisation — pthread_mutex, condition variables, POSIX semaphores, read-write locks, avoiding deadlocks, and priority inversion."
stage: "Stage 04"
phase: "linux-developer-posix"
phase_label: "Phase 02 — Linux Developer"
phase_name: "POSIX APIs & Concurrency"
phase_index: "/linux-developer/posix/"
permalink: /linux-developer/posix/mutexes-semaphores/
prev_topic:
  title: "Pthreads"
  url: /linux-developer/posix/pthreads/
next_topic:
  title: "Pipes & Shared Memory"
  url: /linux-developer/posix/pipes-ipc/
---

## Mutex (Mutual Exclusion Lock)
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

A **mutex** is a lock that allows only one thread at a time to access a shared resource (critical section).

```c
#include <pthread.h>
#include <stdio.h>

static pthread_mutex_t g_lock = PTHREAD_MUTEX_INITIALIZER;
static int g_counter = 0;

void* increment_thread(void* arg) {
    for (int i = 0; i < 100000; i++) {
        pthread_mutex_lock(&g_lock);
        // --- critical section ---
        g_counter++;
        // ------------------------
        pthread_mutex_unlock(&g_lock);
    }
    return NULL;
}

// Dynamic initialisation (with attributes)
pthread_mutex_t mutex;
pthread_mutexattr_t attr;
pthread_mutexattr_init(&attr);
pthread_mutexattr_settype(&attr, PTHREAD_MUTEX_ERRORCHECK);  // detect recursive lock
pthread_mutex_init(&mutex, &attr);
pthread_mutexattr_destroy(&attr);
// ... use mutex ...
pthread_mutex_destroy(&mutex);
```

### Mutex Types

| Type | Behaviour |
|------|-----------|
| `PTHREAD_MUTEX_NORMAL` (default) | Deadlocks if same thread locks twice |
| `PTHREAD_MUTEX_RECURSIVE` | Same thread can lock multiple times (must unlock same count) |
| `PTHREAD_MUTEX_ERRORCHECK` | Returns `EDEADLK` if same thread tries to lock twice |
| `PTHREAD_MUTEX_DEFAULT` | Unspecified (usually same as NORMAL) |

---

## Condition Variables
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

A **condition variable** lets threads wait for a condition to become true. It must always be used **with a mutex**.

```c
#include <pthread.h>

typedef struct {
    pthread_mutex_t lock;
    pthread_cond_t  not_empty;
    pthread_cond_t  not_full;
    int  buf[16];
    int  head, tail, count;
} BoundedQueue;

static BoundedQueue q = {
    .lock      = PTHREAD_MUTEX_INITIALIZER,
    .not_empty = PTHREAD_COND_INITIALIZER,
    .not_full  = PTHREAD_COND_INITIALIZER,
};

void enqueue(int val) {
    pthread_mutex_lock(&q.lock);

    // Wait while full — always use while (not if!) to guard against spurious wakeups
    while (q.count == 16)
        pthread_cond_wait(&q.not_full, &q.lock);  // atomically unlocks mutex and waits

    q.buf[q.tail++] = val;
    q.tail %= 16;
    q.count++;

    pthread_cond_signal(&q.not_empty);  // wake one waiting consumer
    pthread_mutex_unlock(&q.lock);
}

int dequeue(void) {
    pthread_mutex_lock(&q.lock);

    while (q.count == 0)
        pthread_cond_wait(&q.not_empty, &q.lock);

    int val = q.buf[q.head++];
    q.head %= 16;
    q.count--;

    pthread_cond_signal(&q.not_full);   // wake one waiting producer
    pthread_mutex_unlock(&q.lock);
    return val;
}
```

### `pthread_cond_wait` Protocol

```
1. Lock mutex
2. Check condition — if NOT true:
   a. pthread_cond_wait() — atomically unlocks mutex and blocks
   b. When woken: re-acquires mutex and returns
   c. Re-check condition (spurious wakeups are possible!)
3. Do work
4. Unlock mutex
```

### Timed Wait

```c
struct timespec deadline;
clock_gettime(CLOCK_REALTIME, &deadline);
deadline.tv_sec += 5;   // 5-second timeout

int rc = pthread_cond_timedwait(&cond, &mutex, &deadline);
if (rc == ETIMEDOUT) puts("timed out!");
```

---

## POSIX Semaphores
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

A semaphore maintains a count. `sem_wait` decrements (blocks if 0); `sem_post` increments.

```c
#include <semaphore.h>

// Unnamed semaphore (within one process or between threads)
sem_t sem;
sem_init(&sem, 0, 1);   // pshared=0 (threads), initial=1

sem_wait(&sem);     // P() — decrement; block if 0
// ... critical section ...
sem_post(&sem);     // V() — increment; wake one waiter

sem_destroy(&sem);

// Named semaphore (between processes)
sem_t* named = sem_open("/myapp_sem", O_CREAT, 0644, 1);
sem_wait(named);
// ...
sem_post(named);
sem_close(named);
sem_unlink("/myapp_sem");   // remove from filesystem
```

### Mutex vs. Semaphore

| | Mutex | Semaphore |
|--|-------|-----------|
| Ownership | Only the locking thread can unlock | Any thread can post |
| Count | Binary (0 or 1) | Integer (0 to N) |
| Use case | Mutual exclusion | Signalling, counting resources |
| Priority inheritance | Supported | Not supported |

---

## Read-Write Lock (`pthread_rwlock`)
{:.gc-mid}

Allows **multiple concurrent readers** but exclusive access for writers — higher throughput when reads dominate.

```c
#include <pthread.h>

pthread_rwlock_t rwlock = PTHREAD_RWLOCK_INITIALIZER;
static float sensor_cache[100];

// Multiple readers can hold this simultaneously
void* reader_thread(void* arg) {
    pthread_rwlock_rdlock(&rwlock);
    float val = sensor_cache[42];
    pthread_rwlock_unlock(&rwlock);
    return NULL;
}

// Only one writer; all readers must be gone
void* writer_thread(void* arg) {
    pthread_rwlock_wrlock(&rwlock);
    sensor_cache[42] = 23.5f;
    pthread_rwlock_unlock(&rwlock);
    return NULL;
}
```

---

## Deadlocks and How to Avoid Them
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

**Deadlock** occurs when two or more threads each hold a lock the other needs.

```
Thread 1: lock(A), then tries to lock(B) — blocks
Thread 2: lock(B), then tries to lock(A) — blocks
→ both blocked forever
```

### Deadlock Prevention

```c
// Strategy 1: Consistent lock ordering — always lock in the same order
// Always lock mutex_a before mutex_b, everywhere in the code
pthread_mutex_lock(&mutex_a);
pthread_mutex_lock(&mutex_b);
// ... work ...
pthread_mutex_unlock(&mutex_b);
pthread_mutex_unlock(&mutex_a);

// Strategy 2: Try-lock and back off
if (pthread_mutex_trylock(&mutex_b) != 0) {
    pthread_mutex_unlock(&mutex_a);
    // retry after a backoff
}

// Strategy 3: Use a single global lock for small programs
// Strategy 4: Avoid holding multiple locks simultaneously (redesign)

// Detection: use thread sanitizer
// gcc -fsanitize=thread -g -o prog prog.c -lpthread
```

---

## Priority Inversion
{:.gc-adv}

**Priority inversion** occurs when a high-priority thread is blocked waiting for a mutex held by a low-priority thread, which is preempted by a medium-priority thread.

```
High (blocked on mutex) ← Medium (running, blocks High) ← Low (holds mutex, can't run)
```

**Fix — Priority Inheritance Protocol:**

```c
pthread_mutexattr_t attr;
pthread_mutexattr_init(&attr);
pthread_mutexattr_setprotocol(&attr, PTHREAD_PRIO_INHERIT);
pthread_mutex_init(&mutex, &attr);
// When Low holds the mutex, it temporarily inherits High's priority
// → Medium can no longer preempt Low → Low finishes → High unblocks
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is a race condition and how do mutexes prevent it?**

> A race condition occurs when two threads access shared data concurrently and at least one access is a write, producing undefined results depending on which thread "wins" the race. A mutex serialises access: only the thread holding the lock can execute the critical section. Other threads attempting to lock the mutex will block until the holder unlocks it. This guarantees that only one thread at a time modifies the shared data, making the operation atomic at the application level.

**Q2 — Basic: Why must `pthread_cond_wait` always be used with a `while` loop?**

> `pthread_cond_wait` can return spuriously — even when no other thread has called `pthread_cond_signal`. This is permitted by POSIX to allow efficient implementation on some architectures. If you use `if` instead of `while`, a spurious wakeup will cause the thread to proceed even though the condition isn't actually true, leading to incorrect behaviour. The `while` loop re-checks the condition after every wakeup, handling both spurious wakeups and the case where another consumer already consumed the resource after signalling.

**Q3 — Intermediate: What is the difference between `pthread_cond_signal` and `pthread_cond_broadcast`?**

> `pthread_cond_signal` wakes exactly **one** waiting thread (implementation may choose which). `pthread_cond_broadcast` wakes **all** waiting threads; each must re-acquire the mutex and re-check the condition, so only one proceeds at a time. Use `signal` when exactly one thread can handle the event (e.g. one item added to a queue). Use `broadcast` when all waiting threads must re-evaluate (e.g. a configuration reload that affects all threads, or when a condition changes from full to available).

**Q4 — Advanced: What is priority inversion and how does priority inheritance fix it?**

> Priority inversion: a high-priority thread H blocks waiting for a mutex held by low-priority thread L. A medium-priority thread M (which doesn't need the mutex) preempts L, preventing L from running and releasing the mutex. H is effectively running at M's lower priority — inversion. Priority inheritance: when H blocks on the mutex, L's scheduling priority is temporarily raised to H's level, so M can't preempt L. L finishes, releases the mutex, reverts to its original priority, and H proceeds. Enable with `PTHREAD_PRIO_INHERIT` on the mutex attribute.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 3 pthread_mutex_init` | Mutex API |
| `man 3 pthread_cond_init` | Condition variable API |
| `man 7 sem_overview` | POSIX semaphore overview |
| `man 3 pthread_rwlock_init` | Reader-writer lock API |
| TLPI Chapter 30 | Thread synchronisation |
