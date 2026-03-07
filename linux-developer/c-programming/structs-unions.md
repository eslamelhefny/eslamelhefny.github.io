---
layout: guide
title: "Structs & Unions"
description: "Understand struct memory layout, padding and alignment, bit-fields, unions, and the typedef patterns used to model hardware registers and network protocols in C."
stage: "Stage 02"
phase: "linux-developer-c"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C Programming"
phase_index: "/linux-developer/c-programming/"
permalink: /linux-developer/c-programming/structs-unions/
prev_topic:
  title: "Pointers & Memory"
  url: /linux-developer/c-programming/pointers-memory/
next_topic:
  title: "File I/O"
  url: /linux-developer/c-programming/file-io/
---

## Structs
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

A `struct` groups variables of different types into a single named unit. Members are stored at **consecutive memory addresses** (with possible padding between them).

```c
struct Point {
    int x;
    int y;
};

struct Point p1 = {3, 7};
struct Point p2 = {.x = 10, .y = 20};  // C99 designated initializer

printf("(%d, %d)\n", p1.x, p1.y);   // (3, 7)

// Pointer to struct — use -> operator
struct Point *pp = &p1;
printf("%d\n", pp->x);   // equivalent to (*pp).x
```

### `typedef` for Cleaner Syntax

```c
// Without typedef
struct Sensor { int id; float temp; };
struct Sensor s;

// With typedef
typedef struct {
    int   id;
    float temp;
} Sensor;

Sensor s = {1, 23.5f};  // no 'struct' keyword needed
```

### Nested Structs

```c
typedef struct {
    float x, y;
} Vec2;

typedef struct {
    Vec2  position;
    Vec2  velocity;
    float mass;
} Particle;

Particle p = { .position = {0.0f, 1.0f}, .velocity = {1.0f, 0.0f}, .mass = 1.5f };
printf("pos: (%.1f, %.1f)\n", p.position.x, p.position.y);
```

---

## Struct Padding and Alignment
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

The compiler inserts **padding bytes** between struct members to satisfy CPU alignment requirements. Each type must be stored at an address that is a multiple of its size.

```c
struct Bad {
    char  a;    // 1 byte  → 3 bytes padding added
    int   b;    // 4 bytes (must be 4-byte aligned)
    char  c;    // 1 byte  → 3 bytes padding added
};              // total: 12 bytes (not 6!)

struct Good {
    int   b;    // 4 bytes
    char  a;    // 1 byte
    char  c;    // 1 byte  → 2 bytes padding at end
};              // total: 8 bytes
```

```c
printf("%zu\n", sizeof(struct Bad));   // 12
printf("%zu\n", sizeof(struct Good));  // 8

// Print member offsets with offsetof()
#include <stddef.h>
printf("%zu\n", offsetof(struct Bad, b));   // 4
printf("%zu\n", offsetof(struct Good, b));  // 0
```

### Packed Structs

Force zero padding (critical for hardware register maps and network packets):

```c
// GCC attribute
typedef struct __attribute__((packed)) {
    uint8_t  start_byte;   // offset 0
    uint16_t length;       // offset 1  (unaligned — may be slow on some CPUs)
    uint32_t checksum;     // offset 3
} __attribute__((packed)) PacketHeader;

printf("%zu\n", sizeof(PacketHeader));  // 7 (not 8)
```

> **Warning:** Packed structs may generate slower code or bus errors on architectures that require alignment (ARM Cortex-M, MIPS). Use only when talking to hardware or fixed binary protocols.

---

## Bit-Fields
{:.gc-mid}

Bit-fields let you pack multiple flags or small values into a single word — used extensively for hardware register modeling.

```c
typedef struct {
    uint8_t ready   : 1;   // 1 bit
    uint8_t error   : 1;   // 1 bit
    uint8_t mode    : 2;   // 2 bits (values 0–3)
    uint8_t channel : 4;   // 4 bits (values 0–15)
} StatusReg;               // total: 8 bits = 1 byte

StatusReg reg = {0};
reg.ready   = 1;
reg.mode    = 2;
reg.channel = 7;

printf("ready=%d mode=%d channel=%d\n", reg.ready, reg.mode, reg.channel);
```

> Bit ordering within a byte is implementation-defined. For strict hardware compatibility, use bitmasks and shifts instead.

---

## Unions
{:.gc-mid}

A `union` stores all its members **at the same memory address**. Only one member holds a valid value at any time. The size equals the largest member.

```c
union Data {
    int   i;
    float f;
    char  bytes[4];
};

union Data d;
d.f = 3.14f;
printf("float: %f\n", d.f);

// Inspecting raw bytes of a float
for (int i = 0; i < 4; i++)
    printf("byte[%d] = 0x%02X\n", i, (unsigned char)d.bytes[i]);
```

**Type punning (reading a value as a different type):**
```c
union FloatBits {
    float    f;
    uint32_t bits;
};

union FloatBits fb;
fb.f = -0.0f;
printf("IEEE 754 bits of -0.0: 0x%08X\n", fb.bits);  // 0x80000000
```

---

## Advanced: Struct Patterns in Embedded C
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Hardware Register Modeling

Map a peripheral's control register block directly onto a struct:

```c
// STM32-style UART register map
typedef struct {
    volatile uint32_t SR;    // Status register
    volatile uint32_t DR;    // Data register
    volatile uint32_t BRR;   // Baud rate register
    volatile uint32_t CR1;   // Control register 1
    volatile uint32_t CR2;   // Control register 2
} UART_TypeDef;

// Map to actual hardware address
#define USART1  ((UART_TypeDef *) 0x40013800U)

// Send a byte
while (!(USART1->SR & (1 << 7)));  // wait for TXE
USART1->DR = 'A';
```

### Intrusive Linked List (Linux Kernel Style)

The kernel embeds `list_head` structs inside data structures and uses `container_of` to recover the containing object:

```c
struct list_head {
    struct list_head *next, *prev;
};

struct Task {
    int              pid;
    char             name[16];
    struct list_head list;   // embedded — not a pointer!
};

// container_of: given a pointer to the 'list' member, get the Task
#define container_of(ptr, type, member) \
    ((type *)((char *)(ptr) - offsetof(type, member)))

struct list_head *node = get_next_node();
struct Task *task = container_of(node, struct Task, list);
printf("Task: %s (PID %d)\n", task->name, task->pid);
```

### Flexible Array Member (C99)

A struct with a zero-length array at the end for variable-size data:

```c
typedef struct {
    uint32_t length;
    uint8_t  data[];    // flexible array member — must be last
} Packet;

// Allocate packet with 64 bytes of data
Packet *pkt = malloc(sizeof(Packet) + 64);
pkt->length = 64;
memset(pkt->data, 0, 64);
free(pkt);
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between a struct and a union?**

> In a `struct`, every member has its own memory location — they all exist simultaneously. Total size = sum of member sizes + padding. In a `union`, all members share the same memory location — only one is valid at a time. Total size = size of the largest member. Structs hold multiple values; unions hold one value interpreted in multiple ways.

**Q2 — Intermediate: Why might `sizeof(struct)` be larger than the sum of its member sizes?**

> Because the compiler inserts **padding bytes** between members to align them on their natural alignment boundaries. For example, a 4-byte `int` must start at an address divisible by 4. After a 1-byte `char`, the compiler adds 3 bytes of padding before the `int`. The struct itself is also padded at the end to ensure arrays of the struct are correctly aligned. Use `__attribute__((packed))` to suppress padding (with potential performance cost), or reorder members from largest to smallest to minimise it.

**Q3 — Intermediate: What is the `volatile` keyword and when must you use it with embedded structs?**

> `volatile` tells the compiler that the value may change outside the program's control (e.g., by hardware, an ISR, or another thread). Without it, the compiler may cache the value in a register and never re-read from memory. Hardware register structs **must** use `volatile` — otherwise the compiler may optimise away polling loops like `while (!(REG->SR & FLAG))`.

**Q4 — Advanced: Explain `container_of` and why the Linux kernel uses it.**

> `container_of(ptr, type, member)` recovers a pointer to the enclosing `type` struct given a pointer to one of its `member` fields. It works by subtracting the compile-time `offsetof(type, member)` from `ptr`. The kernel uses intrusive data structures (embedding `list_head` inside objects) instead of allocating separate list-node objects, saving memory and improving cache locality. `container_of` is the mechanism for navigating back to the real object from a generic list node.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 3 offsetof` | offsetof macro |
| C17 §6.7.2.1 | Structure and union specifiers |
| Linux Kernel — list.h | `include/linux/list.h` in kernel source |
| GCC __attribute__ docs | [gcc.gnu.org/onlinedocs/gcc/Type-Attributes.html](https://gcc.gnu.org/onlinedocs/gcc/Type-Attributes.html) |
