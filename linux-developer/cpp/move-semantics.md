---
layout: guide
title: "Move Semantics"
description: "Understand C++ move semantics — lvalues vs rvalues, move constructors, std::move, perfect forwarding, universal references, and return value optimisation."
stage: "Stage 03"
phase: "linux-developer-cpp"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C++ Programming"
phase_index: "/linux-developer/cpp/"
permalink: /linux-developer/cpp/move-semantics/
prev_topic:
  title: "Smart Pointers"
  url: /linux-developer/cpp/smart-pointers/
next_topic:
  title: "CMake"
  url: /linux-developer/cpp/cmake/
---

## lvalues and rvalues
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Every expression in C++ has a **value category**:

| Category | Meaning | Has address? | Example |
|----------|---------|--------------|---------|
| **lvalue** | Named, persistent object | Yes | `int x = 5; x` |
| **rvalue** | Temporary, expiring | No | `5`, `x + y`, `func()` |
| **xvalue** | "eXpiring" lvalue after `std::move` | Sort of | `std::move(x)` |

```cpp
int x = 5;       // x is an lvalue; 5 is an rvalue
int y = x + 3;   // x+3 is an rvalue (temporary)

void f(int& ref);       // binds to lvalues
void f(int&& ref);      // binds to rvalues (rvalue reference)

f(x);       // calls f(int&)
f(5);       // calls f(int&&)
f(x + 3);   // calls f(int&&)
```

---

## Move Constructor & Move Assignment
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Copying a large object (a vector, buffer, file handle) is expensive. **Moving** steals the internal resources from the temporary — O(1) instead of O(n).

```cpp
class Buffer {
    uint8_t* data_;
    size_t   size_;
public:
    // Constructor
    explicit Buffer(size_t size)
        : data_(new uint8_t[size]), size_(size) {}

    // Destructor
    ~Buffer() { delete[] data_; }

    // Copy — expensive: allocates + copies bytes
    Buffer(const Buffer& other)
        : data_(new uint8_t[other.size_]), size_(other.size_) {
        std::memcpy(data_, other.data_, size_);
    }

    // Move constructor — cheap: steals pointer, O(1)
    Buffer(Buffer&& other) noexcept
        : data_(other.data_), size_(other.size_) {
        other.data_ = nullptr;   // leave source in valid but empty state
        other.size_ = 0;
    }

    // Move assignment
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data_;          // free current resource
            data_ = other.data_;
            size_ = other.size_;
            other.data_ = nullptr;
            other.size_ = 0;
        }
        return *this;
    }
};
```

### Why `noexcept` Matters

```cpp
// Mark move operations noexcept!
// std::vector uses move instead of copy during reallocation
// ONLY if the move constructor is noexcept.
// Without noexcept, vector falls back to copying — losing the speedup.
Buffer(Buffer&&) noexcept;            // vector will use move: fast
Buffer(Buffer&&) /* no noexcept */;   // vector uses copy: slow
```

---

## `std::move`
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

`std::move` is just a **cast to rvalue reference** — it doesn't move anything by itself. It tells the compiler "I'm done with this object, feel free to steal its internals."

```cpp
std::vector<int> a = {1, 2, 3, 4, 5};

// Copy: a still valid, b is a deep copy
std::vector<int> b = a;
std::cout << a.size();  // 5

// Move: b steals a's buffer, a is empty
std::vector<int> c = std::move(a);
std::cout << a.size();  // 0 (valid but unspecified state)
std::cout << c.size();  // 5
```

### Common Use Cases

```cpp
// 1. Return from function — NRVO usually handles this,
//    but explicit move is sometimes needed
std::vector<int> build_data() {
    std::vector<int> result;
    // ... fill result ...
    return result;   // compiler applies RVO automatically
}

// 2. Pass unique_ptr (non-copyable — must move)
void take_device(std::unique_ptr<IDevice> dev);

auto d = std::make_unique<UartDevice>();
take_device(std::move(d));   // transfer ownership
// d == nullptr now

// 3. Store a string in a struct without copying
struct Packet {
    std::string name;
    std::vector<uint8_t> data;
};
std::string s = "temperature";
Packet p { std::move(s), {} };  // s is empty now; no copy
```

### After `std::move` — the Object is in a "Valid but Unspecified" State

```cpp
std::string s = "hello";
std::string t = std::move(s);
// s is valid — you can reassign it
s = "world";  // OK
std::cout << s;  // "world"
```

---

## Perfect Forwarding
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

Perfect forwarding lets a wrapper function pass arguments to another function while **preserving their value category** (lvalue/rvalue).

### The Problem

```cpp
template <typename T>
void wrapper(T arg) {
    inner(arg);        // arg is always an lvalue inside the function!
}

std::string s = "hello";
wrapper(s);                  // inner sees lvalue — OK
wrapper(std::string("hi"));  // inner sees lvalue, NOT rvalue — loses move!
```

### Universal References + `std::forward`

```cpp
// T&& in a deduced context is a "universal reference" (not just rvalue ref)
template <typename T>
void wrapper(T&& arg) {
    inner(std::forward<T>(arg));  // forward preserves value category
}

wrapper(s);                   // T = string&  → forwards as lvalue
wrapper(std::string("hi"));   // T = string   → forwards as rvalue
```

### `std::make_unique` Internally Uses This

```cpp
template <typename T, typename... Args>
std::unique_ptr<T> make_unique(Args&&... args) {
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}
// Arguments forwarded to T's constructor with correct value category
```

---

## Return Value Optimisation (RVO / NRVO)
{:.gc-adv}

```cpp
// Named Return Value Optimisation (NRVO)
std::vector<int> build() {
    std::vector<int> result;   // named local
    result.push_back(1);
    result.push_back(2);
    return result;             // compiler builds 'result' directly in caller
}                              // no copy, no move — zero cost

auto v = build();  // v IS the result object (constructed in place)

// When NRVO doesn't apply (multiple return paths):
std::vector<int> build2(bool flag) {
    std::vector<int> a, b;
    // fill a and b ...
    return flag ? a : b;  // NRVO can't apply — return std::move(a/b) here
}
```

**Rule:** Don't write `return std::move(local_var);` — it disables RVO/NRVO and may actually be slower. Let the compiler handle it.

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between a move constructor and a copy constructor?**

> A copy constructor creates a new object with **independent copies** of all resources — for a buffer, it allocates new memory and copies bytes: O(n). A move constructor **transfers ownership** of resources from an expiring (rvalue) object: it copies the pointer and size, then nulls out the source's pointer: O(1). The moved-from object is left in a valid but empty state. Move is faster when the source is a temporary or explicitly moved with `std::move`.

**Q2 — Basic: What does `std::move` actually do?**

> `std::move` is an unconditional cast to an rvalue reference (`T&&`). It does not move anything. It tells the compiler that the object can be treated as a temporary — enabling the move constructor or move assignment operator to be called instead of the copy versions. The actual resource transfer happens in the move constructor/assignment, not in `std::move` itself.

**Q3 — Intermediate: Why should move constructors be `noexcept`?**

> `std::vector` (and other containers) must provide the strong exception guarantee during reallocation. If the move constructor can throw, the container cannot safely use it (it might leave the container in a broken state mid-operation), so it falls back to the copy constructor. Marking your move constructor `noexcept` tells the compiler and standard library that moving is safe to use, enabling the performance optimisation. Always mark move constructors and move assignment operators `noexcept` if they can't throw.

**Q4 — Advanced: What is perfect forwarding and what problem does it solve?**

> Without perfect forwarding, a generic wrapper function that takes `T` or `const T&` always passes the argument as an lvalue to the inner function, losing rvalue information. A universal reference `T&&` combined with `std::forward<T>(arg)` preserves the value category: if `arg` was originally an rvalue, it's forwarded as rvalue (enabling move semantics in the inner function); if it was an lvalue, it's forwarded as lvalue (enabling copy or lvalue binding). This is the foundation of `std::make_unique`, `emplace_back`, and other factory functions.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| cppreference — Move constructors | [en.cppreference.com/w/cpp/language/move_constructor](https://en.cppreference.com/w/cpp/language/move_constructor) |
| cppreference — Value categories | [en.cppreference.com/w/cpp/language/value_category](https://en.cppreference.com/w/cpp/language/value_category) |
| Scott Meyers — Effective Modern C++ | Item 23 (std::move), Item 24 (universal references) |
| Thomas Becker — C++ Rvalue References Explained | [thbecker.net/articles/rvalue_references/section_01.html](http://thbecker.net/articles/rvalue_references/section_01.html) |
