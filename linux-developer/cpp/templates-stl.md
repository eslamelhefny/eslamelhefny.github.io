---
layout: guide
title: "Templates & STL"
description: "Master C++ templates and the Standard Template Library — function and class templates, specialisation, variadic templates, iterators, containers, algorithms, and ranges."
stage: "Stage 03"
phase: "linux-developer-cpp"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C++ Programming"
phase_index: "/linux-developer/cpp/"
permalink: /linux-developer/cpp/templates-stl/
prev_topic:
  title: "OOP & RAII"
  url: /linux-developer/cpp/oop-raii/
next_topic:
  title: "Smart Pointers"
  url: /linux-developer/cpp/smart-pointers/
---

## Function & Class Templates
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Templates let you write **type-independent** code. The compiler generates concrete versions at compile time.

```cpp
// Function template
template <typename T>
T clamp(T val, T lo, T hi) {
    return (val < lo) ? lo : (val > hi) ? hi : val;
}

float f = clamp(3.5f, 0.0f, 1.0f);  // T = float
int   i = clamp(150,  0,   100);    // T = int

// Class template
template <typename T, std::size_t N>
class RingBuffer {
    T    buf_[N];
    int  head_ = 0, tail_ = 0, count_ = 0;
public:
    bool push(const T& v) {
        if (count_ == static_cast<int>(N)) return false;
        buf_[tail_] = v;
        tail_ = (tail_ + 1) % N;
        ++count_;
        return true;
    }
    bool pop(T& out) {
        if (count_ == 0) return false;
        out = buf_[head_];
        head_ = (head_ + 1) % N;
        --count_;
        return true;
    }
    int size()  const { return count_; }
    bool empty() const { return count_ == 0; }
};

RingBuffer<float, 32> sensor_buf;
sensor_buf.push(23.5f);
```

### Template Type Deduction

```cpp
template <typename T>
void print(T val) { std::cout << val << '\n'; }

print(42);        // T = int
print(3.14);      // T = double
print("hello");   // T = const char*

// Explicit instantiation
print<float>(42); // T = float
```

---

## STL Containers
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

### Sequence Containers

```cpp
#include <vector>
#include <deque>
#include <list>
#include <array>

// std::vector — dynamic array, O(1) amortised push_back
std::vector<int> v = {1, 2, 3};
v.push_back(4);
v.emplace_back(5);        // construct in-place
v.reserve(100);           // pre-allocate
v.resize(10, 0);          // resize with fill value
v.erase(v.begin() + 2);   // erase index 2

// std::array — fixed-size stack array (C++11)
std::array<float, 4> arr = {1.0f, 2.0f, 3.0f, 4.0f};
arr.size();   // 4, known at compile time

// std::deque — double-ended queue, O(1) push front/back
std::deque<int> dq;
dq.push_front(0);
dq.push_back(1);

// std::list — doubly-linked list, O(1) insert/erase anywhere
std::list<int> lst = {1, 2, 3};
auto it = std::next(lst.begin(), 1);
lst.insert(it, 42);  // insert before position
```

### Associative Containers

```cpp
#include <map>
#include <unordered_map>
#include <set>

// std::map — sorted key-value, O(log n)
std::map<std::string, int> reg_map = {
    {"CTRL", 0x40}, {"STATUS", 0x41}
};
reg_map["DATA"] = 0x42;
auto it = reg_map.find("CTRL");
if (it != reg_map.end())
    std::cout << it->second << '\n';

// std::unordered_map — hash map, O(1) average
std::unordered_map<int, std::string> id_name;
id_name[1] = "sensor_a";
id_name.count(1);          // 1 if present

// std::set — sorted unique values, O(log n)
std::set<int> seen;
seen.insert(42);
bool found = seen.count(42);  // true
```

### Container Selection Guide

| Need | Container |
|------|-----------|
| Fast random access, push_back | `vector` |
| Fast push_front and push_back | `deque` |
| Fast insert/erase anywhere | `list` |
| Sorted key→value | `map` |
| Fast key→value lookup | `unordered_map` |
| Unique sorted elements | `set` |
| Fixed-size stack array | `array` |
| LIFO stack | `stack<T>` (adapts deque) |
| FIFO queue | `queue<T>` (adapts deque) |
| Priority queue / heap | `priority_queue<T>` |

---

## Iterators & Algorithms
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Iterator Categories

```cpp
std::vector<int> v = {5, 3, 1, 4, 2};

// Range-based for (uses begin()/end())
for (int x : v) std::cout << x << ' ';

// Iterator loop
for (auto it = v.begin(); it != v.end(); ++it)
    *it *= 2;

// Reverse iteration
for (auto it = v.rbegin(); it != v.rend(); ++it)
    std::cout << *it << ' ';

// With index (C++20 enumerate alternative)
for (std::size_t i = 0; i < v.size(); ++i)
    std::cout << i << ": " << v[i] << '\n';
```

### Standard Algorithms (`<algorithm>`)

```cpp
#include <algorithm>
#include <numeric>

std::vector<int> v = {5, 3, 1, 4, 2};

// Sorting
std::sort(v.begin(), v.end());                          // ascending
std::sort(v.begin(), v.end(), std::greater<int>());     // descending
std::sort(v.begin(), v.end(),
    [](int a, int b){ return a < b; });                // lambda

// Searching
auto it = std::find(v.begin(), v.end(), 4);
if (it != v.end()) std::cout << "found at " << std::distance(v.begin(), it);

auto it2 = std::lower_bound(v.begin(), v.end(), 3);  // binary search (sorted!)
bool has3 = std::binary_search(v.begin(), v.end(), 3);

// Transforming
std::vector<int> out(v.size());
std::transform(v.begin(), v.end(), out.begin(),
    [](int x){ return x * x; });          // squares

// Accumulate / reduce
int sum = std::accumulate(v.begin(), v.end(), 0);   // sum
int product = std::accumulate(v.begin(), v.end(), 1,
    std::multiplies<int>());

// Filtering (copy_if)
std::vector<int> evens;
std::copy_if(v.begin(), v.end(), std::back_inserter(evens),
    [](int x){ return x % 2 == 0; });

// Count, min, max
int count = std::count_if(v.begin(), v.end(), [](int x){ return x > 3; });
auto [mn, mx] = std::minmax_element(v.begin(), v.end());

// Remove-erase idiom (the classic C++ pattern)
v.erase(std::remove_if(v.begin(), v.end(),
    [](int x){ return x % 2 == 0; }), v.end());
```

---

## Variadic Templates & Fold Expressions
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Variadic Templates (C++11)

```cpp
// Compile-time recursive variadic template
template <typename T>
T sum(T val) { return val; }

template <typename T, typename... Args>
T sum(T first, Args... rest) {
    return first + sum(rest...);
}

int   s1 = sum(1, 2, 3, 4);       // 10
float s2 = sum(1.0f, 2.5f, 0.5f); // 4.0f
```

### Fold Expressions (C++17)

```cpp
// Much cleaner than recursive templates
template <typename... Args>
auto sum(Args... args) {
    return (args + ...);        // unary right fold
}

template <typename... Args>
bool all_positive(Args... args) {
    return ((args > 0) && ...); // fold over &&
}

auto s = sum(1, 2, 3, 4, 5);       // 15
bool ok = all_positive(1, 2, 3);   // true
```

### Template Specialisation

```cpp
// Primary template
template <typename T>
struct Serialise {
    static std::string to_string(const T& v) {
        return std::to_string(v);
    }
};

// Full specialisation for bool
template <>
struct Serialise<bool> {
    static std::string to_string(bool v) {
        return v ? "true" : "false";
    }
};

// Partial specialisation for pointer types
template <typename T>
struct Serialise<T*> {
    static std::string to_string(T* ptr) {
        std::ostringstream oss;
        oss << "0x" << std::hex << reinterpret_cast<uintptr_t>(ptr);
        return oss.str();
    }
};
```

### SFINAE and `if constexpr` (C++17)

```cpp
// if constexpr — compile-time branching
template <typename T>
std::string to_str(T val) {
    if constexpr (std::is_same_v<T, bool>)
        return val ? "true" : "false";
    else if constexpr (std::is_integral_v<T>)
        return std::to_string(val);
    else
        return "unsupported";
}

// Concepts (C++20) — cleaner constraints
template <std::integral T>
T safe_add(T a, T b) { return a + b; }
```

---

## C++20 Ranges (Intro)
{:.gc-adv}

```cpp
#include <ranges>
#include <algorithm>

std::vector<int> v = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

// Pipe-based range adaptors
auto result = v
    | std::views::filter([](int x){ return x % 2 == 0; })
    | std::views::transform([](int x){ return x * x; })
    | std::views::take(3);

for (int x : result)
    std::cout << x << ' ';   // 4 16 36

// Range algorithms (no begin/end needed)
std::ranges::sort(v);
auto it = std::ranges::find(v, 5);

// Lazy — no copy! The range is evaluated on demand.
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is template type deduction and when does it fail?**

> The compiler deduces the template parameter `T` from the argument types. It fails when: (a) two arguments conflict (e.g. `max(1, 2.0)` — `int` vs `double`), (b) the argument is a braced-init-list `{1,2,3}`, or (c) you use a non-deducible context (e.g. `T` only appears in the return type). Fix with explicit specialisation: `max<double>(1, 2.0)`.

**Q2 — Basic: What is the difference between `std::vector` and `std::array`?**

> `std::vector` is a heap-allocated, dynamically resizable container — its size is set at runtime. `std::array` wraps a fixed-size C array on the stack — its size is a compile-time constant (`std::array<T, N>`). Prefer `std::array` when the size is known at compile time (no heap allocation, no overhead), and `std::vector` when the size varies.

**Q3 — Intermediate: Explain the remove-erase idiom.**

> `std::remove_if` doesn't actually erase elements — it moves "kept" elements to the front and returns an iterator to the new end. The original container size is unchanged, with junk values after the new end. `v.erase(remove_if(...), v.end())` then actually removes the surplus elements. This two-step pattern is necessary because algorithms operate on iterator ranges and don't know the container type.

**Q4 — Advanced: What are C++20 concepts and how do they improve templates?**

> Concepts are named compile-time predicates that constrain template parameters. Before concepts, invalid template instantiations produced notoriously unreadable error messages. With concepts (e.g. `template <std::integral T>`), the compiler checks the constraint at the call site and emits a clear diagnostic. Concepts also enable overload resolution based on constraints and document requirements directly in the function signature.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| cppreference — Templates | [en.cppreference.com/w/cpp/language/templates](https://en.cppreference.com/w/cpp/language/templates) |
| cppreference — Algorithms | [en.cppreference.com/w/cpp/algorithm](https://en.cppreference.com/w/cpp/algorithm) |
| C++ Core Guidelines — Templates | [isocpp.github.io/CppCoreGuidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#S-templates) |
| Ranges: C++20 | [en.cppreference.com/w/cpp/ranges](https://en.cppreference.com/w/cpp/ranges) |
