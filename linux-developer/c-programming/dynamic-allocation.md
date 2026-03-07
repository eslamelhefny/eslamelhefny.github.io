---
layout: guide
title: "Dynamic Allocation"
description: "Master malloc, calloc, realloc, and free. Understand the heap, detect memory leaks with Valgrind and ASan, avoid common allocation bugs, and implement pool allocators."
stage: "Stage 02"
phase: "linux-developer-c"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C Programming"
phase_index: "/linux-developer/c-programming/"
permalink: /linux-developer/c-programming/dynamic-allocation/
prev_topic:
  title: "File I/O"
  url: /linux-developer/c-programming/file-io/
next_topic:
  title: "Makefiles"
  url: /linux-developer/c-programming/makefiles/
---

## The Four Allocation Functions
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

```c
#include <stdlib.h>

// malloc: allocate n bytes — contents are UNINITIALIZED (garbage)
void *malloc(size_t size);

// calloc: allocate n elements of given size — contents ZEROED
void *calloc(size_t nmemb, size_t size);

// realloc: resize an existing allocation
void *realloc(void *ptr, size_t new_size);

// free: release allocation back to the heap
void free(void *ptr);
```

### Basic Allocation Pattern

```c
// Allocate memory for 10 ints
int *arr = malloc(10 * sizeof(int));
if (arr == NULL) {
    fprintf(stderr, "malloc failed\n");
    exit(EXIT_FAILURE);
}

// Use it
for (int i = 0; i < 10; i++)
    arr[i] = i * i;

// Always free when done
free(arr);
arr = NULL;   // good practice: prevents use-after-free bugs
```

### `calloc` — Zeroed Allocation

```c
// Safer for arrays of structs — everything starts at zero
SensorRecord *records = calloc(100, sizeof(SensorRecord));
if (!records) { perror("calloc"); exit(1); }
// records[0].temperature == 0.0f, etc.
free(records);
```

### `realloc` — Dynamic Resizing

```c
int *buf = malloc(10 * sizeof(int));
int  cap = 10, len = 0;

// Dynamically grow the buffer
for (int i = 0; i < 25; i++) {
    if (len == cap) {
        cap *= 2;
        int *tmp = realloc(buf, cap * sizeof(int));
        if (!tmp) { free(buf); exit(1); }  // realloc failure doesn't free old buf!
        buf = tmp;
    }
    buf[len++] = i;
}
free(buf);
```

> **Never do:** `buf = realloc(buf, new_size)` — if realloc returns NULL, you lose the original pointer and leak the memory.

---

## Intermediate: Common Allocation Bugs
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Memory Leak

```c
void process_file(const char *path) {
    char *buf = malloc(1024);
    FILE *fp  = fopen(path, "r");
    if (!fp) return;           // BUG: buf is leaked — should free(buf) first

    fread(buf, 1, 1024, fp);
    fclose(fp);
    free(buf);
}
```

### Use After Free

```c
int *p = malloc(sizeof(int));
*p = 42;
free(p);
printf("%d\n", *p);   // UNDEFINED BEHAVIOUR — p is now a dangling pointer
p = NULL;             // always null the pointer after freeing
```

### Double Free

```c
int *p = malloc(sizeof(int));
free(p);
free(p);    // heap corruption — may crash immediately or silently corrupt
```

### Buffer Overflow

```c
int *arr = malloc(5 * sizeof(int));
for (int i = 0; i <= 5; i++)   // BUG: writes to arr[5] — out of bounds
    arr[i] = i;
free(arr);
```

### Wrong Size

```c
int **matrix = malloc(N * sizeof(int));    // BUG: should be sizeof(int *)
// On 64-bit systems, sizeof(int)=4 but sizeof(int *)=8 — only half the memory allocated
```

---

## Detecting Problems with Tools
{:.gc-mid}

### Valgrind

```bash
gcc -g -o program program.c
valgrind --leak-check=full --show-leak-kinds=all --track-origins=yes ./program
```

**Sample output:**
```
==12345== 40 bytes in 1 blocks are definitely lost in loss record 1 of 1
==12345==    at 0x4C2FB0F: malloc (in /usr/lib/valgrind/vgpreload_memcheck.so)
==12345==    at 0x10869F: process_file (program.c:5)
==12345==    at 0x1086B5: main (program.c:15)
==12345== Invalid read of size 4
==12345==    at 0x108650: main (program.c:9)
```

### AddressSanitizer (ASan)

Faster than Valgrind (2x overhead vs 20x), catches: heap/stack/global buffer overflow, use-after-free, double-free.

```bash
gcc -fsanitize=address -fsanitize=undefined -g -o program program.c
./program
```

**Sample ASan output:**
```
==12345==ERROR: AddressSanitizer: heap-use-after-free on address 0x602000000010
READ of size 4 at 0x602000000010 thread T0
    #0 0x401234 in main program.c:9
```

---

## Advanced: Pool Allocator
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

General-purpose `malloc` is too slow and non-deterministic for real-time embedded systems. A **pool allocator** pre-allocates a fixed block of memory and serves allocations in O(1) with no fragmentation.

```c
#define POOL_SIZE   64
#define BLOCK_SIZE  sizeof(SensorRecord)

typedef struct Block {
    struct Block *next;
} Block;

static char   pool_mem[POOL_SIZE * BLOCK_SIZE];
static Block *pool_free = NULL;

void pool_init(void) {
    pool_free = NULL;
    for (int i = 0; i < POOL_SIZE; i++) {
        Block *b = (Block *)(pool_mem + i * BLOCK_SIZE);
        b->next   = pool_free;
        pool_free = b;
    }
}

void *pool_alloc(void) {
    if (!pool_free) return NULL;   // pool exhausted
    Block *b  = pool_free;
    pool_free = b->next;
    return b;
}

void pool_free_block(void *ptr) {
    Block *b  = (Block *)ptr;
    b->next   = pool_free;
    pool_free = b;
}
```

Usage:
```c
pool_init();
SensorRecord *r = pool_alloc();
r->temperature = 25.3f;
pool_free_block(r);
```

### Heap Internals

Understanding how `malloc` works helps you debug fragmentation:

```
Heap (managed by libc malloc):
┌────────────────────────────────────────┐
│  [used: 40B] [used: 16B] [free: 200B] │ → sbrk()/mmap() extends this
└────────────────────────────────────────┘

- Small allocs (< 128 KB): served from the heap via brk()
- Large allocs (≥ 128 KB): get their own mmap() region
- free() coalesces adjacent free blocks to fight fragmentation
```

```c
// Check heap statistics
#include <malloc.h>
struct mallinfo2 info = mallinfo2();
printf("Arena:  %zu bytes\n", info.arena);
printf("In use: %zu bytes\n", info.uordblks);
printf("Free:   %zu bytes\n", info.fordblks);
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `malloc` and `calloc`?**

> `malloc(n)` allocates `n` bytes with **uninitialized** contents (garbage from previous allocations or OS). `calloc(count, size)` allocates `count * size` bytes and **zeros** the memory. `calloc` is safer for arrays of structs (no accidental reads of garbage) and is often implemented via the OS's `mmap` which already returns zeroed pages, making it not necessarily slower than `malloc + memset`.

**Q2 — Intermediate: Why should you use a temporary pointer with `realloc`?**

> If `realloc` fails, it returns `NULL` and **leaves the original allocation untouched**. If you write `buf = realloc(buf, new_size)` and it returns `NULL`, you've overwritten your only pointer to the old buffer, causing a leak. Always use: `tmp = realloc(buf, new_size); if (tmp) buf = tmp; else { /* handle error */ }`.

**Q3 — Intermediate: What is heap fragmentation and why does it matter for embedded systems?**

> Fragmentation occurs when repeated alloc/free cycles leave many small unusable gaps between allocated blocks. Even if the total free bytes are sufficient, a large contiguous allocation may fail. In embedded systems with limited RAM, fragmentation can cause sudden `malloc` failures hours or days into operation. Solutions: pool allocators, slab allocators, or avoiding dynamic allocation entirely after initialization.

**Q4 — Advanced: How does a pool allocator differ from a general-purpose allocator, and when would you choose it?**

> A pool allocator pre-allocates a fixed array of equal-size blocks and maintains a free list. Allocation and deallocation are O(1) with no fragmentation (all blocks are the same size). Choose it when: (1) you allocate/free objects of a single known size at high frequency, (2) you need deterministic real-time performance (no `malloc` jitter), (3) you want to bound memory usage at compile time. Downside: wastes memory if pool is rarely fully used.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 3 malloc` | malloc, calloc, realloc, free |
| `man 3 mallinfo2` | Heap statistics |
| Valgrind documentation | [valgrind.org](https://valgrind.org) |
| AddressSanitizer | [github.com/google/sanitizers](https://github.com/google/sanitizers/wiki/AddressSanitizer) |
| Doug Lea's malloc (dlmalloc) | Reference implementation of malloc |
