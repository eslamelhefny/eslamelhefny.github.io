---
layout: guide
title: "OOP & RAII"
description: "Master C++ object-oriented programming — classes, inheritance, virtual dispatch, the Rule of Five, RAII resource management, and exception safety guarantees."
stage: "Stage 03"
phase: "linux-developer-cpp"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C++ Programming"
phase_index: "/linux-developer/cpp/"
permalink: /linux-developer/cpp/oop-raii/
next_topic:
  title: "Templates & STL"
  url: /linux-developer/cpp/templates-stl/
---

## Classes and Objects
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

```cpp
class Sensor {
private:
    int    id_;
    float  value_;
    bool   active_;

public:
    // Constructor
    Sensor(int id, float initial = 0.0f)
        : id_(id), value_(initial), active_(false) {}

    // Member functions
    void activate()       { active_ = true; }
    float read() const    { return value_; }   // const = doesn't modify object
    int   id()   const    { return id_; }

    // Operator overload
    bool operator<(const Sensor& other) const {
        return value_ < other.value_;
    }
};

Sensor s(42, 23.5f);
s.activate();
std::cout << s.read() << '\n';   // 23.5
```

### Access Specifiers

| Specifier | Who can access |
|-----------|---------------|
| `private` | Only the class itself |
| `protected` | Class and derived classes |
| `public` | Anyone |

---

## Inheritance and Virtual Dispatch
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

```cpp
// Abstract base class (interface)
class IDevice {
public:
    virtual ~IDevice() = default;        // virtual destructor — ALWAYS!
    virtual bool  open(const char* path) = 0;   // pure virtual
    virtual int   read(uint8_t* buf, int len)  = 0;
    virtual void  close() = 0;
    virtual std::string name() const = 0;
};

// Concrete implementation
class UartDevice : public IDevice {
    int fd_ = -1;
public:
    bool  open(const char* path) override;
    int   read(uint8_t* buf, int len) override;
    void  close() override;
    std::string name() const override { return "UART"; }
};

class SpiDevice : public IDevice { /* ... */ };

// Polymorphic usage
void read_sensor(IDevice& dev) {
    uint8_t buf[64];
    int n = dev.read(buf, sizeof(buf));   // calls the right override at runtime
}

UartDevice uart;
read_sensor(uart);
```

**Virtual dispatch mechanism (vtable):** Each class with virtual functions has a hidden vtable pointer (`vptr`) — a pointer to a table of function pointers. Calling a virtual function looks up the correct override at runtime through the vtable.

---

## Rule of Five
{:.gc-mid}

If a class manages a resource (memory, file, socket), you must define (or `=delete`) all five special member functions:

```cpp
class Buffer {
    uint8_t* data_;
    size_t   size_;

public:
    // 1. Constructor
    explicit Buffer(size_t size)
        : data_(new uint8_t[size]), size_(size) {
        std::memset(data_, 0, size_);
    }

    // 2. Destructor
    ~Buffer() { delete[] data_; }

    // 3. Copy constructor
    Buffer(const Buffer& other)
        : data_(new uint8_t[other.size_]), size_(other.size_) {
        std::memcpy(data_, other.data_, size_);
    }

    // 4. Copy assignment operator
    Buffer& operator=(const Buffer& other) {
        if (this != &other) {
            delete[] data_;
            data_ = new uint8_t[other.size_];
            size_ = other.size_;
            std::memcpy(data_, other.data_, size_);
        }
        return *this;
    }

    // 5. Move constructor
    Buffer(Buffer&& other) noexcept
        : data_(other.data_), size_(other.size_) {
        other.data_ = nullptr;
        other.size_ = 0;
    }

    // 5b. Move assignment
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data_;
            data_ = other.data_;
            size_ = other.size_;
            other.data_ = nullptr;
            other.size_ = 0;
        }
        return *this;
    }
};
```

---

## RAII — Resource Acquisition Is Initialization
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

**RAII** ties resource lifetime to object lifetime. The constructor acquires the resource; the destructor releases it — even when exceptions are thrown or early returns occur.

```cpp
class FileHandle {
    FILE* fp_;
public:
    explicit FileHandle(const char* path, const char* mode)
        : fp_(std::fopen(path, mode)) {
        if (!fp_) throw std::runtime_error(
            std::string("Cannot open ") + path);
    }
    ~FileHandle() { if (fp_) std::fclose(fp_); }

    // Delete copy — no two FileHandle objects should own the same FILE*
    FileHandle(const FileHandle&)            = delete;
    FileHandle& operator=(const FileHandle&) = delete;

    FILE* get() const { return fp_; }
    operator FILE*() const { return fp_; }
};

void process_config(const char* path) {
    FileHandle f(path, "r");   // opens here
    // ... read file ...
    // f goes out of scope: destructor closes FILE* automatically
    // even if an exception is thrown inside the function!
}
```

**Why RAII beats `try/finally` (Java/Python):** In C++ there are no garbage-collected objects, so every resource must be explicitly released. RAII makes release automatic and exception-safe — the destructor always runs.

### Exception Safety Levels

| Guarantee | Meaning |
|-----------|---------|
| **No-throw** | Operation never throws (mark with `noexcept`) |
| **Strong** | Either succeeds completely or rolls back (no side effects) |
| **Basic** | No resource leaks, invariants maintained, but state may have changed |
| **None** | May leak resources or leave broken state |

```cpp
void swap_strong(Buffer& a, Buffer& b) noexcept {
    // swap pointers — cannot throw, O(1)
    std::swap(a.data_, b.data_);
    std::swap(a.size_, b.size_);
}
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `struct` and `class` in C++?**

> The only difference is the default access specifier: `struct` members are `public` by default, `class` members are `private` by default. Everything else — inheritance, virtual functions, constructors — is identical. Convention: use `struct` for plain data aggregates (POD types), `class` for types with invariants and encapsulation.

**Q2 — Intermediate: Why must the base class destructor be `virtual`?**

> Without a `virtual` destructor, deleting a derived object through a base pointer calls only the base destructor — the derived destructor is never called. This leaks resources held by the derived class. With `virtual ~Base()`, the correct chain of destructors (derived then base) is called via the vtable. Rule: any class with virtual functions must have a `virtual` destructor.

**Q3 — Intermediate: What is the Rule of Zero and when should you follow it instead of the Rule of Five?**

> If a class owns no raw resources — it uses standard library containers, smart pointers, or other RAII wrappers — you should define **none** of the five special members and let the compiler generate them. The compiler-generated versions do the right thing (deep copy via smart pointers' copy constructors, etc.). Only write the Rule of Five when you are implementing a **resource-managing class itself** (like `std::vector` or `std::unique_ptr`).

**Q4 — Advanced: Explain how RAII handles exception safety in the presence of constructors that can throw.**

> If a constructor throws, the object is never considered fully constructed, so its destructor is **not** called. However, all **subobjects** (member objects and base classes) that were fully constructed **will** have their destructors called. This means: if you use RAII members (smart pointers, `FileHandle`), they are automatically cleaned up even if the constructor throws halfway through. Never use raw `new` for multiple resources in a constructor — use a separate RAII wrapper for each resource.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| C++ Core Guidelines | [isocpp.github.io/CppCoreGuidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) |
| cppreference.com — Classes | [en.cppreference.com/w/cpp/language/classes](https://en.cppreference.com/w/cpp/language/classes) |
| Herb Sutter — Exception Safety | [gotw.ca/gotw/](http://www.gotw.ca/gotw/) |
