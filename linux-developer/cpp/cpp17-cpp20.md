---
layout: guide
title: "C++17 & C++20"
description: "Master modern C++ features — structured bindings, std::optional, std::variant, constexpr if, concepts, coroutines, modules, ranges, and std::format."
stage: "Stage 03"
phase: "linux-developer-cpp"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C++ Programming"
phase_index: "/linux-developer/cpp/"
permalink: /linux-developer/cpp/cpp17-cpp20/
render_with_liquid: false
prev_topic:
  title: "Qt Framework"
  url: /linux-developer/cpp/qt/
---
## C++ 17 Language 


<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

### Structured Bindings

```cpp
// Unpack tuples, pairs, structs
auto [x, y] = std::make_pair(3, 4.5f);

struct Point { int x, y, z; };
Point p{1, 2, 3};
auto [px, py, pz] = p;

// In range-based for over maps
std::map<std::string, int> registers = {
    {"CTRL",   0x40},
    {"STATUS", 0x41}
};
for (auto& [name, addr] : registers)
    std::cout << name << " = 0x" << std::hex << addr << '\n';
```

### `if` and `switch` with Initialiser

```cpp
// C++17: initialiser inside if statement
if (auto it = map.find("key"); it != map.end()) {
    // it is scoped to this block
    use(it->second);
}

// switch with init
switch (auto status = get_device_status(); status) {
    case DeviceStatus::Ready:  handle_ready(); break;
    case DeviceStatus::Error:  handle_error(); break;
    default: break;
}
```

### `constexpr if`

```cpp
template <typename T>
auto process(T val) {
    if constexpr (std::is_integral_v<T>) {
        return val * 2;             // compiled for integer types
    } else if constexpr (std::is_floating_point_v<T>) {
        return val * 2.0f;          // compiled for float types
    } else {
        static_assert(always_false<T>, "Unsupported type");
    }
}
```

### Class Template Argument Deduction (CTAD)

```cpp
// C++17: no need to specify template arguments
std::pair p(3, 4.5f);           // pair<int, float>
std::vector v = {1, 2, 3, 4};  // vector<int>
std::array arr{1.0, 2.0, 3.0}; // array<double, 3>
```

---

## C++17 Standard Library
{:.gc-basic}

### `std::optional`

```cpp
#include <optional>

// Return a value OR nothing — no null pointers!
std::optional<float> read_sensor(int id) {
    if (id < 0 || id >= MAX_SENSORS) return std::nullopt;
    return sensor_values[id];
}

auto val = read_sensor(5);
if (val.has_value())
    std::cout << *val << '\n';          // dereference

// With value_or
float v = read_sensor(id).value_or(0.0f);  // default if empty
```

### `std::variant`

```cpp
#include <variant>

// Type-safe union — holds exactly ONE of the listed types
using Result = std::variant<float, std::string>;  // value or error message

Result read_temperature() {
    float temp = hw_read();
    if (temp < -273.0f) return std::string("sensor fault");
    return temp;
}

auto r = read_temperature();

// std::visit — pattern matching
std::visit([](auto&& v) {
    using T = std::decay_t<decltype(v)>;
    if constexpr (std::is_same_v<T, float>)
        std::cout << "temp: " << v << '\n';
    else
        std::cerr << "error: " << v << '\n';
}, r);

// Or check type directly
if (std::holds_alternative<float>(r))
    std::cout << std::get<float>(r) << '\n';
```

### `std::string_view`

```cpp
#include <string_view>

// Non-owning view of a string — no allocation, no copy
void print_name(std::string_view name) {    // accepts string, const char*, string_view
    std::cout << name.substr(0, 4) << '\n'; // O(1) substr
}

print_name("hello world");         // no allocation
std::string s = "hello world";
print_name(s);                     // no copy

// WARNING: string_view does NOT own the data — don't store it past the original's lifetime
```

### `std::filesystem`

```cpp
#include <filesystem>
namespace fs = std::filesystem;

// List directory
for (const auto& entry : fs::directory_iterator("/etc")) {
    if (entry.is_regular_file())
        std::cout << entry.path().filename() << " "
                  << entry.file_size() << " bytes\n";
}

// Path operations
fs::path p = "/usr/local/bin/myapp";
std::cout << p.filename()   << '\n';  // "myapp"
std::cout << p.parent_path()<< '\n';  // "/usr/local/bin"
std::cout << p.extension()  << '\n';  // ""

// File operations
fs::create_directories("/tmp/myapp/logs");
fs::copy_file("src.txt", "dst.txt");
fs::remove("/tmp/old.txt");
bool exists = fs::exists("/etc/hostname");
```

---

## C++20 Core Language Features
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Concepts

```cpp
#include <concepts>

// Define a concept
template <typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

// Constrained function template
template <Numeric T>
T clamp(T val, T lo, T hi) {
    return (val < lo) ? lo : (val > hi) ? hi : val;
}

// Shorter syntax (abbreviated function template)
auto clamp2(Numeric auto val, Numeric auto lo, Numeric auto hi) {
    return (val < lo) ? lo : (val > hi) ? hi : val;
}

// Standard library concepts (in <concepts>)
// std::integral, std::floating_point, std::same_as<T,U>,
// std::derived_from<T,Base>, std::convertible_to<T,U>,
// std::regular, std::invocable<F, Args...>
```

### Ranges (C++20)

```cpp
#include <ranges>

std::vector<int> v = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

// Composable range adaptors with | pipe
auto squares_of_evens = v
    | std::views::filter([](int x) { return x % 2 == 0; })
    | std::views::transform([](int x) { return x * x; });

for (int n : squares_of_evens)
    std::cout << n << ' ';   // 4 16 36 64 100

// std::ranges algorithms — no begin/end!
std::ranges::sort(v);
std::ranges::reverse(v);
auto it = std::ranges::find(v, 5);

// iota view
for (int i : std::views::iota(1, 6))
    std::cout << i << ' ';   // 1 2 3 4 5
```

### `std::format` (C++20)

```cpp
#include <format>

std::string s = std::format("Sensor {:02d}: {:.2f} °C", 5, 23.456f);
// "Sensor 05: 23.46 °C"

std::cout << std::format("0x{:08X}\n", 0xDEAD);  // "0x0000DEAD"

// Logging with format
auto log = [](std::string_view level, std::string_view msg) {
    std::cout << std::format("[{}] {}\n", level, msg);
};
log("INFO", "device initialised");
```

### Three-Way Comparison (Spaceship `<=>`)

```cpp
#include <compare>

struct Version {
    int major, minor, patch;

    auto operator<=>(const Version&) const = default;  // generates all 6 comparisons
};

Version v1{1, 2, 3}, v2{1, 3, 0};
bool ok = v1 < v2;    // true
bool eq = v1 == v2;   // false
// Also generates >, >=, <=, !=
```

---

## C++20 Coroutines (Intro)
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

Coroutines are functions that can **suspend and resume**. They are useful for async I/O, generators, and cooperative multitasking without OS threads.

```cpp
#include <coroutine>
#include <generator>   // C++23; use a library for C++20

// Simple generator using co_yield
std::generator<int> fibonacci() {
    int a = 0, b = 1;
    while (true) {
        co_yield a;          // suspend, return value to caller
        auto next = a + b;
        a = b;
        b = next;
    }
}

// Use the generator
for (int n : fibonacci() | std::views::take(10))
    std::cout << n << ' ';   // 0 1 1 2 3 5 8 13 21 34

// co_await — suspend until async operation completes
// co_return — return from coroutine
```

---

## C++17/20 at a Glance

| Feature | Version | Purpose |
|---------|---------|---------|
| Structured bindings | C++17 | Unpack tuples/structs |
| `if constexpr` | C++17 | Compile-time branching |
| `std::optional` | C++17 | Nullable values without pointers |
| `std::variant` | C++17 | Type-safe union |
| `std::string_view` | C++17 | Non-owning string reference |
| `std::filesystem` | C++17 | Portable filesystem API |
| Concepts | C++20 | Template constraints |
| Ranges | C++20 | Composable algorithm pipelines |
| `std::format` | C++20 | Type-safe string formatting |
| Coroutines | C++20 | Async / generator functions |
| Modules | C++20 | Replace `#include` headers |
| `std::jthread` | C++20 | Auto-joining thread |

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What problem does `std::optional` solve?**

> `std::optional<T>` represents a value that may or may not be present — a type-safe alternative to returning a sentinel value (like `-1`, `nullptr`, or `NaN`) or throwing an exception for expected absence. It makes the "might not have a value" contract explicit in the type system, forcing callers to check before using the value. Compared to returning a pointer, `optional` has value semantics (no raw pointers, no allocation for scalar types) and expresses ownership clearly.

**Q2 — Intermediate: What are C++20 concepts and how do they improve error messages?**

> A concept is a named, compile-time predicate that constrains template parameters (e.g. `std::integral<T>`, `std::ranges::range<R>`). Before concepts, template constraint violations produced multi-page error messages pointing into library internals. With concepts, the compiler checks the constraint at the call site and emits a direct "does not satisfy concept X" message pointing to the user's code. Concepts also enable overload resolution based on constraints and serve as self-documenting interfaces.

**Q3 — Intermediate: What is `std::string_view` and when should you use it?**

> `string_view` is a non-owning, read-only reference to a contiguous sequence of characters — a pointer and length. It avoids copies when passing strings to functions. Use it for function parameters that read a string but don't need to store or modify it: `void parse(std::string_view s)`. It accepts `std::string`, `const char*`, and other `string_view`s without conversion. **Never** return a `string_view` pointing to a local variable — it becomes a dangling reference.

**Q4 — Advanced: What are C++20 coroutines used for?**

> Coroutines are functions that can suspend execution (with `co_yield` or `co_await`) and resume later without blocking a thread. They are used for: (1) **generators** — lazily producing a sequence of values (like `fibonacci()` above), (2) **async I/O** — suspending while waiting for an I/O operation, resuming when data is ready, avoiding thread-per-connection models, and (3) **cooperative multitasking** — multiple coroutines interleaving on a single thread. Frameworks like Asio/coroutines integrate `co_await` with async networking for high-performance I/O.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| cppreference — C++17 | [en.cppreference.com/w/cpp/17](https://en.cppreference.com/w/cpp/17) |
| cppreference — C++20 | [en.cppreference.com/w/cpp/20](https://en.cppreference.com/w/cpp/20) |
| C++ Weekly (Jason Turner) | [github.com/lefticus/cpp_weekly](https://github.com/lefticus/cppbestpractices) |
| Compiler support table | [en.cppreference.com/w/cpp/compiler_support](https://en.cppreference.com/w/cpp/compiler_support) |
