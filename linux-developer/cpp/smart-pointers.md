---
layout: guide
title: "Smart Pointers"
description: "Replace raw pointers with C++ smart pointers — unique_ptr for exclusive ownership, shared_ptr with reference counting, weak_ptr to break cycles, and custom deleters."
stage: "Stage 03"
phase: "linux-developer-cpp"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C++ Programming"
phase_index: "/linux-developer/cpp/"
permalink: /linux-developer/cpp/smart-pointers/
prev_topic:
  title: "Templates & STL"
  url: /linux-developer/cpp/templates-stl/
next_topic:
  title: "Move Semantics"
  url: /linux-developer/cpp/move-semantics/
---

## Why Smart Pointers?
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Raw pointers require manual `delete` — easy to forget on early returns, exceptions, or complex control flow. Smart pointers are RAII wrappers that **automatically delete** the managed object when it goes out of scope.

```cpp
// Raw pointer — who deletes it? When?
void bad() {
    int* p = new int(42);
    if (some_condition) return;   // LEAK — delete never called
    delete p;
}

// Smart pointer — always cleaned up
void good() {
    auto p = std::make_unique<int>(42);
    if (some_condition) return;   // OK — destructor runs, no leak
}
```

| Smart Pointer | Ownership | When to Use |
|---------------|-----------|-------------|
| `unique_ptr<T>` | Exclusive (one owner) | Default choice for heap objects |
| `shared_ptr<T>` | Shared (ref-counted) | Multiple owners needed |
| `weak_ptr<T>` | Non-owning observer | Break `shared_ptr` cycles |

---

## `std::unique_ptr`
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

`unique_ptr` models **exclusive ownership**. It cannot be copied — only moved. Zero overhead over a raw pointer.

```cpp
#include <memory>

// Preferred: make_unique (C++14)
auto sensor = std::make_unique<Sensor>(42, 23.5f);

// Access like a raw pointer
sensor->activate();
float v = sensor->read();

// unique_ptr is non-copyable, movable
auto s2 = std::move(sensor);  // sensor is now null; s2 owns it
// sensor.get() == nullptr

// Release ownership (raw pointer — you own it now)
Sensor* raw = s2.release();
delete raw;  // now you must delete it

// Reset to a new object (old object destroyed)
s2.reset(new Sensor(99, 0.0f));
s2.reset();  // destroys and sets to null
```

### Factory Functions with `unique_ptr`

```cpp
// Return unique_ptr from factory functions
std::unique_ptr<IDevice> create_device(const std::string& type) {
    if (type == "uart")  return std::make_unique<UartDevice>();
    if (type == "spi")   return std::make_unique<SpiDevice>();
    return nullptr;
}

// Caller takes ownership
auto dev = create_device("uart");
if (dev) dev->open("/dev/ttyS0");
// dev destroyed when it goes out of scope
```

### `unique_ptr` for Arrays

```cpp
// unique_ptr manages array correctly (calls delete[])
auto buf = std::make_unique<uint8_t[]>(1024);
buf[0] = 0xFF;
// But prefer std::vector<uint8_t> for dynamic arrays!
```

### Custom Deleter

```cpp
// Custom deleter for C file handles
auto fp = std::unique_ptr<FILE, decltype(&fclose)>(
    fopen("/etc/hostname", "r"), &fclose);

if (fp) {
    char line[128];
    fgets(line, sizeof(line), fp.get());
    std::puts(line);
}  // fclose called automatically

// Useful for OS resources (file descriptors, sockets)
struct FdDeleter {
    void operator()(int* fd) const {
        if (*fd >= 0) close(*fd);
        delete fd;
    }
};
```

---

## `std::shared_ptr`
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

`shared_ptr` uses **reference counting**. The managed object is destroyed when the last `shared_ptr` to it is destroyed.

```cpp
// make_shared allocates object + control block in one allocation (efficient)
auto a = std::make_shared<Sensor>(1, 0.0f);
auto b = a;   // copy: both a and b own the sensor

std::cout << a.use_count() << '\n';  // 2

{
    auto c = a;  // use_count = 3
}   // c destroyed: use_count = 2

a.reset();   // a released: use_count = 1
// b still holds the sensor; it's alive
// b goes out of scope: use_count = 0 → Sensor destroyed
```

### Shared Ownership Example

```cpp
struct EventBus {
    std::vector<std::shared_ptr<Sensor>> subscribers;

    void subscribe(std::shared_ptr<Sensor> s) {
        subscribers.push_back(s);
    }
    void broadcast() {
        for (auto& s : subscribers)
            s->activate();
    }
};

auto s1 = std::make_shared<Sensor>(1, 0.0f);
EventBus bus;
bus.subscribe(s1);    // bus and caller both own s1

// s1 is still alive as long as bus holds a copy
```

### `shared_ptr` Performance Considerations

```cpp
// make_shared: single allocation (object + control block)
auto good = std::make_shared<Sensor>(1, 0.0f);  // ✓

// Direct constructor: two allocations
auto bad = std::shared_ptr<Sensor>(new Sensor(1, 0.0f));  // ✗

// Thread safety: ref-count operations are atomic, but the object itself is NOT
// Use mutex to protect shared object data when accessed from multiple threads
```

---

## `std::weak_ptr`
{:.gc-mid}

`weak_ptr` holds a **non-owning reference** to a `shared_ptr`-managed object. It does not affect the reference count. Use it to **break reference cycles** and to observe objects without keeping them alive.

```cpp
struct Node {
    int value;
    std::shared_ptr<Node> next;
    std::weak_ptr<Node>   parent;  // ← weak to break cycle
    Node(int v) : value(v) {}
};

auto root  = std::make_shared<Node>(1);
auto child = std::make_shared<Node>(2);

root->next   = child;        // root owns child (strong)
child->parent = root;        // child observes root (weak — no cycle!)

// To use a weak_ptr, promote to shared_ptr (may return nullptr)
if (auto p = child->parent.lock()) {
    std::cout << "parent value: " << p->value << '\n';  // 1
} else {
    std::cout << "parent is gone\n";
}
```

### Cycle Without `weak_ptr` — Memory Leak

```cpp
struct BadNode {
    std::shared_ptr<BadNode> next;   // shared both ways = cycle = leak!
};
auto a = std::make_shared<BadNode>();
auto b = std::make_shared<BadNode>();
a->next = b;
b->next = a;  // a and b keep each other alive forever
```

---

## Ownership Guidelines
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

```
1. Use unique_ptr by default.
2. Use shared_ptr only when ownership is genuinely shared.
3. Use weak_ptr to break shared_ptr cycles.
4. Pass by raw pointer or reference when NOT transferring ownership.
5. Never mix raw new/delete with smart pointers for the same object.
```

```cpp
// Function signatures that express ownership clearly:

// Takes ownership (caller must pass owned pointer)
void take_device(std::unique_ptr<IDevice> dev);

// Borrows (caller keeps ownership, function doesn't store it)
void use_device(IDevice& dev);
void use_device(IDevice* dev);  // nullable borrow

// Shares ownership (function may outlive the call)
void register_device(std::shared_ptr<IDevice> dev);

// Observes without owning
void observe(std::weak_ptr<IDevice> dev);
```

### `enable_shared_from_this`

```cpp
// When an object needs to create a shared_ptr to itself:
class Server : public std::enable_shared_from_this<Server> {
public:
    void start_session() {
        auto self = shared_from_this();  // safe — returns shared_ptr<Server>
        // pass self to async callback; keeps Server alive
    }
};

// Only valid when Server is already managed by a shared_ptr:
auto srv = std::make_shared<Server>();
srv->start_session();  // OK
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: When do you use `unique_ptr` vs `shared_ptr`?**

> Use `unique_ptr` when exactly one owner holds the resource — it has zero overhead and expresses exclusive ownership clearly. Use `shared_ptr` only when multiple independent owners genuinely need to share the resource and the last owner should destroy it. Shared ownership is a design smell in many cases — prefer restructuring code to use unique ownership. A good heuristic: start with `unique_ptr`; only promote to `shared_ptr` when you cannot avoid it.

**Q2 — Basic: What does `make_unique` and `make_shared` do differently from `new`?**

> `make_unique<T>(args)` constructs T with `new`, wraps it in `unique_ptr<T>`, and (critically) is exception-safe — if the constructor throws after the allocation, the pointer is correctly destroyed. `make_shared<T>(args)` additionally allocates the T object and its reference-count control block in a **single allocation**, which is more cache-friendly and efficient than `shared_ptr<T>(new T(args))` which requires two allocations.

**Q3 — Intermediate: What is a `weak_ptr` cycle and how does `weak_ptr` fix it?**

> When two objects hold `shared_ptr` to each other, their reference counts never reach zero — a memory leak. `weak_ptr` holds a reference to the object without incrementing its reference count. The object can be destroyed while `weak_ptr` remains; calling `lock()` returns a `shared_ptr` or `nullptr` if the object is gone. By replacing one of the `shared_ptr` members with `weak_ptr` (e.g. parent→child is strong, child→parent is weak), the cycle is broken and normal destruction occurs.

**Q4 — Advanced: Is `shared_ptr` thread-safe?**

> The **reference-count operations** (copy, destroy) are thread-safe — they use atomic increments/decrements. However, the **managed object itself** is not protected by `shared_ptr`. Two threads accessing the same object through different `shared_ptr` copies must synchronise access to the object's data themselves (mutex, atomics, etc.). Also, concurrent read-and-write access to the same `shared_ptr` variable (not the managed object) is not safe — you need a mutex or `atomic<shared_ptr>` (C++20).

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| cppreference — unique_ptr | [en.cppreference.com/w/cpp/memory/unique_ptr](https://en.cppreference.com/w/cpp/memory/unique_ptr) |
| cppreference — shared_ptr | [en.cppreference.com/w/cpp/memory/shared_ptr](https://en.cppreference.com/w/cpp/memory/shared_ptr) |
| C++ Core Guidelines — Resource management | [isocpp.github.io/CppCoreGuidelines#S-resource](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#S-resource) |
| Herb Sutter — GotW #89: Smart Pointers | [herbsutter.com/2013/05/29/gotw-89-solution-smart-pointers](https://herbsutter.com/2013/05/29/gotw-89-solution-smart-pointers/) |
