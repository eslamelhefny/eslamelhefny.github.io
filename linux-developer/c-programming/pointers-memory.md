---
layout: guide
title: "Pointers & Memory"
description: "Master C pointer arithmetic, pointer-to-pointer, function pointers, const-correctness, the C memory layout, and common pitfalls that crash production systems."
stage: "Stage 02"
phase: "linux-developer-c"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C Programming"
phase_index: "/linux-developer/c-programming/"
permalink: /linux-developer/c-programming/pointers-memory/
next_topic:
  title: "Structs & Unions"
  url: /linux-developer/c-programming/structs-unions/
---

## What is a Pointer?
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

A pointer is a variable that stores a **memory address**. Every piece of data in a running program lives at a specific address in RAM; pointers let you manipulate data through those addresses directly.

```c
int x = 42;
int *p = &x;        // p holds the address of x

printf("%d\n", x);  // value:   42
printf("%p\n", p);  // address: 0x7ffd1a2b3c40  (varies)
printf("%d\n", *p); // dereference: 42

*p = 100;           // modify x through the pointer
printf("%d\n", x);  // 100
```

### Pointer Declarations

```c
int   *p;       // pointer to int
char  *s;       // pointer to char (C string)
float *f;       // pointer to float
void  *v;       // generic pointer — can point to any type
int  **pp;      // pointer to pointer to int
int  (*arr)[5]; // pointer to array of 5 ints
```

### The `&` and `*` Operators

| Operator | Name | Meaning |
|----------|------|---------|
| `&x` | Address-of | Gives the address where `x` lives |
| `*p` | Dereference | Gives the value at the address in `p` |

---

## Pointer Arithmetic
{:.gc-basic}

When you add or subtract an integer from a pointer, the pointer moves by **`n × sizeof(type)`** bytes — not by `n` bytes.

```c
int arr[] = {10, 20, 30, 40, 50};
int *p = arr;          // p points to arr[0]

printf("%d\n", *p);    // 10
p++;                   // moves 4 bytes forward (sizeof int = 4)
printf("%d\n", *p);    // 20
printf("%d\n", *(p+2));// 40

// Pointer difference (same array only)
int *a = &arr[1];
int *b = &arr[4];
ptrdiff_t diff = b - a;  // 3  (not 12 bytes)
```

### Array Decay

Arrays automatically "decay" to a pointer to their first element when passed to functions:

```c
void print_array(int *arr, int len) {
    for (int i = 0; i < len; i++)
        printf("%d ", arr[i]);   // arr[i] == *(arr + i)
}

int nums[] = {1, 2, 3};
print_array(nums, 3);   // 'nums' decays to &nums[0]
```

---

## Pointer to Pointer
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

```c
int x   = 5;
int *p  = &x;
int **pp = &p;

printf("%d\n",   x);    // 5  — value
printf("%p\n",   p);    // address of x
printf("%p\n",  pp);    // address of p
printf("%d\n", **pp);   // 5  — double dereference

**pp = 99;
printf("%d\n", x);      // 99
```

**Real use case — modifying a pointer inside a function:**
```c
void allocate(int **out, int size) {
    *out = malloc(size * sizeof(int));  // must use ** to change the caller's pointer
}

int *buf = NULL;
allocate(&buf, 10);
buf[0] = 42;
free(buf);
```

---

## Function Pointers
{:.gc-mid}

A function pointer stores the address of a function and allows calling it indirectly — the basis for callbacks, dispatch tables, and plugin architectures.

```c
// Declaration: pointer to function taking two ints, returning int
int (*operation)(int, int);

int add(int a, int b) { return a + b; }
int mul(int a, int b) { return a * b; }

operation = add;
printf("%d\n", operation(3, 4));  // 7

operation = mul;
printf("%d\n", operation(3, 4));  // 12
```

**Callback pattern (like qsort):**
```c
int compare_asc(const void *a, const void *b) {
    return (*(int*)a - *(int*)b);
}

int arr[] = {5, 1, 4, 2, 3};
qsort(arr, 5, sizeof(int), compare_asc);
// arr is now: 1 2 3 4 5
```

**Dispatch table (used in device drivers):**
```c
typedef struct {
    int  (*open)(const char *path);
    int  (*read)(char *buf, int len);
    void (*close)(void);
} FileOps;

FileOps uart_ops = { uart_open, uart_read, uart_close };
uart_ops.open("/dev/ttyS0");
```

---

## `const` with Pointers
{:.gc-mid}

```c
int x = 10;
const int *p1 = &x;     // pointer to const int: can't change *p1
int *const p2 = &x;     // const pointer to int: can't change p2 (address)
const int *const p3 = &x; // can't change either

*p1 = 20;   // ERROR: read-only through p1
p1  = NULL; // OK: changing where p1 points
*p2 = 20;   // OK: changing the value
p2  = NULL; // ERROR: can't change p2 itself
```

**Rule of thumb:** read right-to-left through the `*`.
- `const int *p` → "p is a pointer to const int"
- `int *const p` → "p is a const pointer to int"

---

## Advanced: C Memory Layout
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

A typical Linux process has these segments:

```
High address
┌─────────────────────┐
│    Kernel space     │  (inaccessible to user process)
├─────────────────────┤
│      Stack          │  grows downward — local variables, return addresses
│         ↓           │
│   (unmapped gap)    │
│         ↑           │
│       Heap          │  grows upward — malloc/calloc
├─────────────────────┤
│  BSS segment        │  uninitialized globals (zeroed by OS)
├─────────────────────┤
│  Data segment       │  initialized globals and statics
├─────────────────────┤
│  Text segment       │  executable code (read-only)
└─────────────────────┘
Low address
```

```c
int global_init   = 5;    // Data segment
int global_uninit;         // BSS segment (zeroed)

void func(void) {
    int local = 10;         // Stack
    int *heap = malloc(4);  // Heap (pointer on stack, data on heap)
    static int s = 0;       // Data segment (persists across calls)
}
```

### Common Pointer Bugs

```c
// 1. Use after free
int *p = malloc(4);
free(p);
*p = 5;            // undefined behavior — crash or silent corruption

// 2. Dangling pointer (pointer to local that went out of scope)
int *dangling(void) {
    int x = 42;
    return &x;     // x is destroyed on return — BAD
}

// 3. Buffer overflow
char buf[8];
strcpy(buf, "This string is too long!");  // overwrites adjacent memory

// 4. NULL dereference
int *p = NULL;
*p = 5;            // SIGSEGV

// 5. Double free
free(p);
free(p);           // heap corruption
```

### Tools for Memory Safety

```bash
# Valgrind — detects leaks, invalid reads/writes
valgrind --leak-check=full ./program

# AddressSanitizer (ASan) — compile-time instrumentation, fast
gcc -fsanitize=address -g ./program.c -o program && ./program

# Undefined Behavior Sanitizer
gcc -fsanitize=undefined -g ./program.c -o program
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `*p++` and `(*p)++`?**

> `*p++` has higher precedence on `++` as postfix: it returns `*p`, then increments the **pointer** `p` (moves to the next element). `(*p)++` dereferences `p` to get the value, then increments the **value** at that location.

**Q2 — Basic: What does `void *` mean and when is it used?**

> `void *` is a generic pointer that can hold the address of any type without casting. It cannot be dereferenced directly — you must cast it to a concrete type first. Used in generic APIs like `malloc()` (returns `void *`), `qsort()`, and `memcpy()` that must work with any data type.

**Q3 — Intermediate: Explain the difference between `char *s = "hello"` and `char s[] = "hello"`.**

> `char *s = "hello"` creates a pointer to a **string literal** stored in the read-only `.rodata` section. Writing to `s[0]` is undefined behaviour (segfault on most systems). `char s[] = "hello"` allocates a **writable array** on the stack and copies the string into it. `s[0] = 'H'` is perfectly legal.

**Q4 — Intermediate: What is a memory leak and how do you detect it?**

> A memory leak occurs when `malloc`-allocated memory is never `free`d, causing the process's heap to grow without bound until OOM or program exit. Detect with Valgrind (`--leak-check=full`) or compile with `-fsanitize=address`. Prevent by following RAII patterns, matching every `malloc` with a `free`, and using tools like static analysis (`cppcheck`, `clang-tidy`).

**Q5 — Advanced: Explain the `restrict` keyword in C99.**

> `restrict` is a hint to the compiler that a pointer is the **only** way to access the memory it points to within a given scope — no other pointer aliases it. This allows the compiler to generate better-optimised code (e.g., avoid re-loading memory from RAM on every iteration). It is the programmer's responsibility to ensure the guarantee holds; violating it causes undefined behaviour.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| C17 Standard (draft) | [open-std.org/jtc1/sc22/wg14](http://www.open-std.org/jtc1/sc22/wg14/) |
| `man 3 malloc` | Heap allocation manual |
| Valgrind documentation | [valgrind.org/docs/manual](https://valgrind.org/docs/manual/manual.html) |
| AddressSanitizer docs | [clang.llvm.org/docs/AddressSanitizer.html](https://clang.llvm.org/docs/AddressSanitizer.html) |
| C Pointer Tutorial (Binky video) | Classic Stanford pointer video |
