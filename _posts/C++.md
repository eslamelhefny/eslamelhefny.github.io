
# C++ Comprehensive Notebook
### Classes · Inheritance · Polymorphism · Modern C++

---

**How to use this notebook:**
- This notebook is designed for a **C++ Jupyter kernel** (e.g., [xeus-cling](https://github.com/jupyter-xeus/xeus-cling))
- If you don't have a C++ kernel, you can still read the code and explanations — each cell is self-contained
- You can also copy each code cell and compile with `g++ -std=c++17 file.cpp -o file`

**Structure:** Each topic starts with a **simple introduction** with a basic example, then dives deep into every detail with more advanced examples.

---

## 📑 Table of Contents

### 1. Classes
- 1.1 Simple Introduction — What is a Class?
- 1.2 Access Specifiers (public, private, protected)
- 1.3 Constructors & Destructors
- 1.4 Member Initializer List
- 1.5 Copy Semantics (Shallow vs Deep Copy)
- 1.6 Static Members
- 1.7 Friend Functions & Operator Overloading
- 1.8 The `this` Pointer
- 1.9 Rule of Three / Five / Zero

### 2. Inheritance
- 2.1 Simple Introduction — What is Inheritance?
- 2.2 Types of Inheritance
- 2.3 Access Control in Inheritance
- 2.4 Construction & Destruction Order
- 2.5 Function Hiding vs Overriding
- 2.6 Multiple Inheritance & The Diamond Problem

### 3. Polymorphism
- 3.1 Simple Introduction — What is Polymorphism?
- 3.2 Compile-Time Polymorphism (Overloading & Templates)
- 3.3 Runtime Polymorphism (Virtual Functions)
- 3.4 VTable & VPtr — Under the Hood
- 3.5 Abstract Classes & Pure Virtual Functions
- 3.6 Interfaces in C++
- 3.7 `override` and `final` Keywords
- 3.8 Object Slicing Problem

### 4. Modern C++ (C++11 / 14 / 17 / 20)
- 4.1 Simple Introduction — Why Modern C++?
- 4.2 `auto` and Type Inference
- 4.3 Range-based For Loops
- 4.4 Smart Pointers (`unique_ptr`, `shared_ptr`, `weak_ptr`)
- 4.5 Move Semantics & Rvalue References
- 4.6 Lambda Expressions
- 4.7 `constexpr` and `consteval`
- 4.8 Structured Bindings (C++17)
- 4.9 `std::optional`, `std::variant`, `std::any`
- 4.10 Concepts (C++20)
- 4.11 `enum class` (Scoped Enumerations)
- 4.12 `nullptr` vs `NULL`

### 5. References

---
# Chapter 1: Classes
---

## 1.1 What is a Class? — Simple Introduction

A **class** is a user-defined data type that bundles **data** (member variables) and **functions** (member functions / methods) into a single unit. Think of it as a **blueprint** — you define it once, then create as many **objects** (instances) from it as you need.

**Why use classes?**
- **Encapsulation**: Hide internal details, expose only what's necessary
- **Reusability**: Write once, create many objects
- **Organization**: Group related data and behavior together

> **Key Concept:** In C++, a `struct` is essentially a class where members are `public` by default. A `class` has members `private` by default.

Let's start with the simplest possible class:

```cpp
#include <iostream>
#include <string>
using namespace std;

// Define a class — this is the blueprint
class Student {
public:                          // accessible from outside
    string name;
    int age;

    void introduce() {
        cout << "Hi, I'm " << name << ", age " << age << endl;
    }
};

int main() {
    // Create objects (instances) from the blueprint
    Student s1;
    s1.name = "Ali";
    s1.age = 20;
    s1.introduce();

    Student s2;
    s2.name = "Sara";
    s2.age = 22;
    s2.introduce();

    return 0;
}
// Output:
// Hi, I'm Ali, age 20
// Hi, I'm Sara, age 22
```

## 1.2 Access Specifiers — Deep Dive

C++ provides three access specifiers that control who can access class members:

| Specifier | Same Class | Derived Class | Outside Code |
|-----------|:----------:|:-------------:|:------------:|
| `public` | ✅ | ✅ | ✅ |
| `protected` | ✅ | ✅ | ❌ |
| `private` | ✅ | ❌ | ❌ |

**Encapsulation** means keeping data `private` and providing controlled access through `public` getter/setter functions. This way, you can validate data before accepting it and change internal representation without breaking external code.

```cpp
#include <iostream>
#include <string>
using namespace std;

class BankAccount {
private:                              // hidden from outside
    double balance;
    string owner;

protected:                            // accessible by derived classes
    string accountType;

public:                               // the interface
    // Constructor
    BankAccount(string ownerName, double initialBalance)
        : owner(ownerName), balance(initialBalance), accountType("Savings") {}

    // Getter — read access
    double getBalance() const { return balance; }
    string getOwner()   const { return owner; }

    // Setter — with validation (this is why we use encapsulation!)
    void deposit(double amount) {
        if (amount > 0) {
            balance += amount;
            cout << "Deposited $" << amount << endl;
        } else {
            cout << "Error: Invalid deposit amount!" << endl;
        }
    }

    void withdraw(double amount) {
        if (amount > 0 && amount <= balance) {
            balance -= amount;
            cout << "Withdrew $" << amount << endl;
        } else {
            cout << "Error: Invalid withdrawal!" << endl;
        }
    }

    void display() const {
        cout << owner << "'s account: $" << balance << endl;
    }
};

int main() {
    BankAccount acc("Ahmed", 1000.0);
    acc.deposit(500.0);
    acc.withdraw(200.0);
    acc.display();

    // acc.balance = -9999;  // ❌ COMPILE ERROR — balance is private!

    acc.deposit(-100);       // validation catches this
    acc.withdraw(99999);     // validation catches this too

    return 0;
}
// Output:
// Deposited $500
// Withdrew $200
// Ahmed's account: $1300
// Error: Invalid deposit amount!
// Error: Invalid withdrawal!
```

## 1.3 Constructors & Destructors — Deep Dive

### Constructors
A **constructor** is a special function called automatically when an object is created. Its job is to initialize the object's state.

Types of constructors:
1. **Default Constructor** — no parameters (or all parameters have defaults)
2. **Parameterized Constructor** — takes arguments
3. **Copy Constructor** — creates a new object as a copy of an existing one
4. **Move Constructor** (C++11) — "steals" resources from a temporary object
5. **Delegating Constructor** (C++11) — one constructor calls another from the same class

### Destructor
The **destructor** (`~ClassName()`) is called automatically when an object is destroyed (goes out of scope or is deleted). It's crucial for releasing resources like heap memory, file handles, or network connections.

**Rules:**
- If you don't write any constructor, the compiler generates a default one
- If you write ANY constructor, the compiler does NOT generate a default one (unless you explicitly ask with `= default`)
- There is only ONE destructor per class (no parameters, no overloading)

```cpp
#include <iostream>
#include <string>
using namespace std;

class Sensor {
private:
    string name;
    int pin;
    double calibration;

public:
    // 1. Default constructor
    Sensor() : name("Unknown"), pin(0), calibration(1.0) {
        cout << "[Default ctor] " << name << endl;
    }

    // 2. Parameterized constructor
    Sensor(string n, int p, double c)
        : name(n), pin(p), calibration(c)
    {
        cout << "[Param ctor] " << name << endl;
    }

    // 3. Delegating constructor (C++11)
    //    calls the parameterized constructor with a default calibration
    Sensor(string n, int p) : Sensor(n, p, 1.0) {
        cout << "[Delegating ctor] " << name << endl;
    }

    // 4. Copy constructor
    Sensor(const Sensor& other)
        : name(other.name), pin(other.pin), calibration(other.calibration)
    {
        cout << "[Copy ctor] " << name << endl;
    }

    // 5. Destructor
    ~Sensor() {
        cout << "[Destructor] " << name << endl;
    }

    void read() const {
        cout << "  " << name << " on pin " << pin
             << " (calibration: " << calibration << ")" << endl;
    }
};

int main() {
    cout << "=== Creating objects ===" << endl;
    Sensor s1;                           // default
    Sensor s2("Temperature", 4, 0.98);   // parameterized
    Sensor s3("Humidity", 5);            // delegating
    Sensor s4 = s2;                      // copy

    cout << "\n=== Reading sensors ===" << endl;
    s1.read();
    s2.read();
    s3.read();
    s4.read();

    cout << "\n=== Exiting main (destructors called in REVERSE order) ===" << endl;
    return 0;
}
// Output:
// === Creating objects ===
// [Default ctor] Unknown
// [Param ctor] Temperature
// [Param ctor] Humidity
// [Delegating ctor] Humidity
// [Copy ctor] Temperature
//
// === Reading sensors ===
//   Unknown on pin 0 (calibration: 1)
//   Temperature on pin 4 (calibration: 0.98)
//   Humidity on pin 5 (calibration: 1)
//   Temperature on pin 4 (calibration: 0.98)
//
// === Exiting main (destructors called in REVERSE order) ===
// [Destructor] Temperature
// [Destructor] Humidity
// [Destructor] Temperature
// [Destructor] Unknown
```

## 1.4 Member Initializer List

The **member initializer list** is the preferred way to initialize members in a constructor. It appears after the constructor parameters, before the body.

```cpp
ClassName(int x, int y) : member1(x), member2(y) { }
//                       ^^^^^^^^^^^^^^^^^^^^^^^^
//                       this is the initializer list
```

**Why use it?**
1. **More efficient**: Initializes directly, avoids default-construct-then-assign
2. **Required** for: `const` members, reference members, base class constructors, and members without a default constructor
3. **Order matters**: Members are initialized in the order they are **declared in the class**, NOT in the order they appear in the initializer list

```cpp
#include <iostream>
using namespace std;

class Example {
private:
    const int id;         // const — MUST use initializer list
    int& ref;             // reference — MUST use initializer list
    string name;

public:
    // ✅ Correct: using initializer list
    Example(int i, int& r, string n)
        : id(i), ref(r), name(n)
    {
        cout << "Created: id=" << id << ", ref=" << ref
             << ", name=" << name << endl;
    }

    // ❌ This would NOT compile:
    // Example(int i, int& r, string n) {
    //     id = i;     // ERROR: can't assign to const
    //     ref = r;    // ERROR: can't reassign reference
    //     name = n;   // works but wasteful (default-construct then assign)
    // }
};

// Demonstration: initialization order follows DECLARATION order
class InitOrder {
    int a;
    int b;
public:
    // WARNING: even though b appears first in the list,
    // 'a' is initialized first because it's declared first
    InitOrder(int val) : b(val), a(b) {  // BUG! a uses b before b is initialized
        cout << "a=" << a << ", b=" << b << endl;
    }
};

int main() {
    int x = 42;
    Example e(1, x, "test");

    cout << "\n--- Initialization order pitfall ---" << endl;
    InitOrder obj(10);
    // 'a' will have garbage because 'b' wasn't initialized yet when 'a' was set!

    return 0;
}
// Output:
// Created: id=1, ref=42, name=test
//
// --- Initialization order pitfall ---
// a=<garbage>, b=10
```

## 1.5 Copy Semantics — Shallow vs Deep Copy

When you copy an object, what happens to its data?

### Shallow Copy (Default behavior)
The compiler-generated copy constructor/assignment copies each member **bit-for-bit**. For pointers, this means both objects point to the **same memory** — leading to **double-free** bugs.

### Deep Copy (You must implement)
You allocate new memory and copy the **content** rather than the pointer. Each object owns its own independent copy.

> ⚠️ **Rule of Thumb:** If your class has raw pointers to dynamically allocated memory, you almost certainly need to write your own copy constructor and copy assignment operator.

```cpp
#include <iostream>
#include <cstring>
using namespace std;

// ❌ BAD: Shallow copy leads to double-free
class ShallowBuffer {
public:
    char* data;
    size_t size;

    ShallowBuffer(const char* str) {
        size = strlen(str) + 1;
        data = new char[size];
        strcpy(data, str);
        cout << "ShallowBuffer constructed: " << data << endl;
    }

    // Compiler-generated copy constructor does:
    // ShallowBuffer(const ShallowBuffer& other)
    //     : data(other.data), size(other.size) {}
    // ^ both objects now point to the SAME memory!

    ~ShallowBuffer() {
        cout << "ShallowBuffer destroying: " << (data ? data : "(null)") << endl;
        delete[] data;  // CRASH if another object already freed this!
    }
};

// ✅ GOOD: Deep copy — each object owns its own memory
class DeepBuffer {
public:
    char* data;
    size_t size;

    DeepBuffer(const char* str) {
        size = strlen(str) + 1;
        data = new char[size];
        strcpy(data, str);
        cout << "DeepBuffer constructed: " << data << endl;
    }

    // Custom copy constructor — deep copy
    DeepBuffer(const DeepBuffer& other) {
        size = other.size;
        data = new char[size];      // allocate NEW memory
        strcpy(data, other.data);   // copy the CONTENT
        cout << "DeepBuffer deep-copied: " << data << endl;
    }

    // Custom copy assignment operator
    DeepBuffer& operator=(const DeepBuffer& other) {
        if (this != &other) {       // self-assignment check!
            delete[] data;          // free old memory
            size = other.size;
            data = new char[size];
            strcpy(data, other.data);
            cout << "DeepBuffer deep-assigned: " << data << endl;
        }
        return *this;
    }

    ~DeepBuffer() {
        cout << "DeepBuffer destroying: " << (data ? data : "(null)") << endl;
        delete[] data;
    }
};

int main() {
    cout << "=== Deep Copy (Safe) ===" << endl;
    DeepBuffer b1("Hello");
    DeepBuffer b2 = b1;          // deep copy — b2 has its own memory
    DeepBuffer b3("World");
    b3 = b1;                     // deep assignment

    cout << "b1: " << b1.data << endl;
    cout << "b2: " << b2.data << endl;
    cout << "b3: " << b3.data << endl;

    // Modify b1 — b2 and b3 are NOT affected (independent copies)
    b1.data[0] = 'J';
    cout << "\nAfter modifying b1:" << endl;
    cout << "b1: " << b1.data << endl;
    cout << "b2: " << b2.data << endl;  // still "Hello"

    cout << "\n=== Cleanup ===" << endl;
    return 0;
}
// Output:
// === Deep Copy (Safe) ===
// DeepBuffer constructed: Hello
// DeepBuffer deep-copied: Hello
// DeepBuffer constructed: World
// DeepBuffer deep-assigned: Hello
// b1: Hello
// b2: Hello
// b3: Hello
//
// After modifying b1:
// b1: Jello
// b2: Hello
//
// === Cleanup ===
// DeepBuffer destroying: Hello
// DeepBuffer destroying: Hello
// DeepBuffer destroying: Jello
```

## 1.6 Static Members

**Static members** belong to the **class itself**, not to any individual object. There is exactly one copy shared by all instances.

- **Static data members**: Must be defined outside the class (or use `inline static` in C++17)
- **Static member functions**: Can only access static members — they don't have a `this` pointer

**Common use cases:** Object counters, shared configuration, factory methods, singleton pattern

```cpp
#include <iostream>
using namespace std;

class Connection {
private:
    int id;
    static int totalConnections;       // shared by ALL objects

public:
    Connection() : id(++totalConnections) {
        cout << "Connection #" << id << " opened" << endl;
    }

    ~Connection() {
        cout << "Connection #" << id << " closed" << endl;
        --totalConnections;
    }

    // Static function — no 'this' pointer, only accesses static data
    static int getTotal() {
        // cout << id;  // ❌ ERROR: can't access non-static 'id'
        return totalConnections;
    }
};

// Definition of static member OUTSIDE the class (required before C++17)
int Connection::totalConnections = 0;

// C++17 alternative: use inline static inside the class
// inline static int totalConnections = 0;

int main() {
    Connection c1, c2, c3;
    cout << "Active: " << Connection::getTotal() << endl;

    {
        Connection c4;
        cout << "Active: " << Connection::getTotal() << endl;
    } // c4 destroyed here

    cout << "Active: " << Connection::getTotal() << endl;

    return 0;
}
// Output:
// Connection #1 opened
// Connection #2 opened
// Connection #3 opened
// Active: 3
// Connection #4 opened
// Active: 4
// Connection #4 closed
// Active: 3
// Connection #3 closed
// Connection #2 closed
// Connection #1 closed
```

## 1.7 Friend Functions & Operator Overloading

### Friend Functions
A `friend` function is **not** a member of the class, but it has access to the class's `private` and `protected` members. The class grants friendship — it cannot be taken.

### Operator Overloading
C++ lets you redefine the behavior of operators (`+`, `-`, `<<`, `==`, etc.) for your custom types. Some operators must be members (like `=`, `[]`, `()`), while others work better as friends (like `<<`).

> ⚠️ Use `friend` sparingly — it breaks encapsulation. The most common legitimate use is overloading `operator<<` for output streams.

```cpp
#include <iostream>
#include <cmath>
using namespace std;

class Vector2D {
private:
    double x, y;

public:
    Vector2D(double x = 0, double y = 0) : x(x), y(y) {}

    // --- Member operators ---

    // Vector + Vector
    Vector2D operator+(const Vector2D& rhs) const {
        return Vector2D(x + rhs.x, y + rhs.y);
    }

    // Vector - Vector
    Vector2D operator-(const Vector2D& rhs) const {
        return Vector2D(x - rhs.x, y - rhs.y);
    }

    // Vector * scalar
    Vector2D operator*(double scalar) const {
        return Vector2D(x * scalar, y * scalar);
    }

    // Equality
    bool operator==(const Vector2D& rhs) const {
        return x == rhs.x && y == rhs.y;
    }

    // Unary minus (negation)
    Vector2D operator-() const {
        return Vector2D(-x, -y);
    }

    double magnitude() const {
        return sqrt(x * x + y * y);
    }

    // --- Friend functions ---

    // scalar * Vector (left-hand side is not a Vector2D, so must be non-member)
    friend Vector2D operator*(double scalar, const Vector2D& v) {
        return v * scalar;
    }

    // Output stream operator
    friend ostream& operator<<(ostream& os, const Vector2D& v) {
        os << "(" << v.x << ", " << v.y << ")";
        return os;
    }
};

int main() {
    Vector2D a(3, 4), b(1, 2);

    cout << "a = " << a << endl;
    cout << "b = " << b << endl;
    cout << "a + b = " << (a + b) << endl;
    cout << "a - b = " << (a - b) << endl;
    cout << "a * 2 = " << (a * 2) << endl;
    cout << "3 * b = " << (3 * b) << endl;     // uses friend operator
    cout << "-a = " << (-a) << endl;
    cout << "|a| = " << a.magnitude() << endl;
    cout << "a == b? " << (a == b ? "Yes" : "No") << endl;

    return 0;
}
// Output:
// a = (3, 4)
// b = (1, 2)
// a + b = (4, 6)
// a - b = (2, 2)
// a * 2 = (6, 8)
// 3 * b = (3, 6)
// -a = (-3, -4)
// |a| = 5
// a == b? No
```

## 1.8 The `this` Pointer

Every non-static member function has a hidden parameter: `this`, which is a pointer to the object the function was called on.

**Common uses:**
1. Disambiguate when parameter names shadow member names
2. Return `*this` for method chaining (fluent interface)
3. Pass the current object to another function

```cpp
#include <iostream>
#include <string>
using namespace std;

class Builder {
private:
    string title;
    int width;
    int height;

public:
    Builder() : title(""), width(0), height(0) {}

    // 'this' disambiguates: this->title = title
    Builder& setTitle(const string& title) {
        this->title = title;       // left = member, right = parameter
        return *this;              // return reference for chaining
    }

    Builder& setWidth(int width) {
        this->width = width;
        return *this;
    }

    Builder& setHeight(int height) {
        this->height = height;
        return *this;
    }

    void build() const {
        cout << "Window: '" << title << "' "
             << width << "x" << height << endl;
    }
};

int main() {
    // Method chaining using 'return *this'
    Builder()
        .setTitle("My App")
        .setWidth(800)
        .setHeight(600)
        .build();

    return 0;
}
// Output:
// Window: 'My App' 800x600
```

## 1.9 Rule of Three / Five / Zero

These rules tell you which special member functions to define:

| Rule | When to apply | What to define |
|------|---------------|----------------|
| **Rule of Zero** | No raw resource management | Define nothing — use `string`, `vector`, smart pointers |
| **Rule of Three** (C++03) | Manual resource management | Destructor + Copy Constructor + Copy Assignment |
| **Rule of Five** (C++11) | Manual resource management | Rule of Three + Move Constructor + Move Assignment |

> 💡 **Best Practice:** Always prefer the **Rule of Zero**. Use RAII wrappers (`unique_ptr`, `shared_ptr`, `vector`, `string`) and let the compiler generate all special members.

```cpp
// Rule of Zero — the BEST approach
class ModernClass {
    string name;                    // manages its own memory
    vector<int> data;               // manages its own memory
    unique_ptr<Resource> resource;  // manages its own memory
    // No destructor, no copy/move constructors needed!
};
```

```cpp
// Rule of Five — when you must manage raw resources
class ResourceManager {
    int* data;
    size_t size;
public:
    ResourceManager(size_t s);                              // constructor
    ~ResourceManager();                                     // 1. destructor
    ResourceManager(const ResourceManager& other);          // 2. copy constructor
    ResourceManager& operator=(const ResourceManager& other); // 3. copy assignment
    ResourceManager(ResourceManager&& other) noexcept;      // 4. move constructor
    ResourceManager& operator=(ResourceManager&& other) noexcept; // 5. move assignment
};
```

---
# Chapter 2: Inheritance
---

## 2.1 What is Inheritance? — Simple Introduction

**Inheritance** allows a new class (**derived** / child) to acquire the properties and behavior of an existing class (**base** / parent). It models an **"is-a"** relationship.

> A `Dog` **is-a** `Animal`. It inherits common behavior (eat, sleep) and adds its own (bark, fetch).

**Syntax:** `class Derived : public Base { };`

```cpp
#include <iostream>
#include <string>
using namespace std;

// Base class (parent)
class Animal {
protected:                      // accessible by derived classes
    string name;
public:
    Animal(string n) : name(n) {}

    void eat() const {
        cout << name << " is eating." << endl;
    }
    void sleep() const {
        cout << name << " is sleeping." << endl;
    }
};

// Derived class (child) — inherits from Animal
class Dog : public Animal {
public:
    Dog(string n) : Animal(n) {}      // must call base constructor

    void bark() const {
        cout << name << ": Woof! Woof!" << endl;
    }
};

class Cat : public Animal {
public:
    Cat(string n) : Animal(n) {}

    void meow() const {
        cout << name << ": Meow!" << endl;
    }
};

int main() {
    Dog d("Rex");
    d.eat();       // inherited from Animal
    d.sleep();     // inherited from Animal
    d.bark();      // Dog's own method

    cout << endl;

    Cat c("Whiskers");
    c.eat();       // inherited from Animal
    c.meow();      // Cat's own method

    return 0;
}
// Output:
// Rex is eating.
// Rex is sleeping.
// Rex: Woof! Woof!
//
// Whiskers is eating.
// Whiskers: Meow!
```

## 2.2 Types of Inheritance

| Type | Structure | Example |
|------|-----------|---------|
| **Single** | A → B | `class Dog : public Animal` |
| **Multi-Level** | A → B → C | Animal → Dog → GuideDog |
| **Hierarchical** | A → B, A → C | Animal → Dog, Animal → Cat |
| **Multiple** | A, B → C | `class C : public A, public B` |
| **Hybrid** | Combination | Can lead to the diamond problem |

```cpp
#include <iostream>
using namespace std;

// === Multi-Level Inheritance ===
class Vehicle {
public:
    void start() { cout << "Vehicle started" << endl; }
};

class Car : public Vehicle {
public:
    void drive() { cout << "Car driving" << endl; }
};

class ElectricCar : public Car {
public:
    void charge() { cout << "Electric car charging" << endl; }
};

// === Multiple Inheritance ===
class Printable {
public:
    void print() { cout << "Printing..." << endl; }
};

class Scannable {
public:
    void scan() { cout << "Scanning..." << endl; }
};

class AllInOnePrinter : public Printable, public Scannable {
public:
    void fax() { cout << "Faxing..." << endl; }
};

int main() {
    cout << "=== Multi-Level ===" << endl;
    ElectricCar tesla;
    tesla.start();    // from Vehicle (grandparent)
    tesla.drive();    // from Car (parent)
    tesla.charge();   // own method

    cout << "\n=== Multiple ===" << endl;
    AllInOnePrinter printer;
    printer.print();  // from Printable
    printer.scan();   // from Scannable
    printer.fax();    // own method

    return 0;
}
// Output:
// === Multi-Level ===
// Vehicle started
// Car driving
// Electric car charging
//
// === Multiple ===
// Printing...
// Scanning...
// Faxing...
```

## 2.3 Access Control in Inheritance

The inheritance specifier (`public`, `protected`, `private`) controls how base members appear in the derived class:

| Base Member | `public` inheritance | `protected` inheritance | `private` inheritance |
|-------------|:-------------------:|:----------------------:|:--------------------:|
| `public` | remains `public` | becomes `protected` | becomes `private` |
| `protected` | remains `protected` | remains `protected` | becomes `private` |
| `private` | **not accessible** | **not accessible** | **not accessible** |

> 💡 **In practice:** Almost always use `public` inheritance. It preserves the "is-a" relationship. Use `private` inheritance for "implemented-in-terms-of" (but prefer composition instead).

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    int pub = 1;
protected:
    int prot = 2;
private:
    int priv = 3;      // NEVER accessible from derived classes
};

class PublicDerived : public Base {
public:
    void test() {
        cout << "pub: " << pub << endl;     // ✅ still public
        cout << "prot: " << prot << endl;   // ✅ still protected
        // cout << priv;                    // ❌ ERROR: private
    }
};

class PrivateDerived : private Base {
public:
    void test() {
        cout << "pub: " << pub << endl;     // ✅ but now private in this class
        cout << "prot: " << prot << endl;   // ✅ but now private in this class
    }
};

int main() {
    PublicDerived pd;
    cout << pd.pub << endl;      // ✅ public inheritance keeps pub accessible
    // cout << pd.prot;          // ❌ protected — not accessible from outside

    PrivateDerived pvd;
    // cout << pvd.pub;          // ❌ private inheritance makes pub inaccessible!
    pvd.test();                  // ✅ internally they can still be accessed

    return 0;
}
// Output:
// 1
// pub: 1
// prot: 2
```

## 2.4 Construction & Destruction Order

When creating a derived object, constructors run **top-down** (base first, then derived). Destructors run in the **exact reverse** order.

```
Construction: Base → Middle → Derived
Destruction:  Derived → Middle → Base
```

> The base part of the object must be fully constructed before the derived part can use it.

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    Base()  { cout << "1. Base constructed" << endl; }
    ~Base() { cout << "4. Base destroyed" << endl; }
};

class Middle : public Base {
public:
    Middle()  { cout << "2. Middle constructed" << endl; }
    ~Middle() { cout << "3. Middle destroyed (calls before ~Base)" << endl; }
};

class Derived : public Middle {
public:
    Derived()  { cout << "3. Derived constructed" << endl; }
    ~Derived() { cout << "1. Derived destroyed (calls first!)" << endl; }
};

int main() {
    cout << "--- Creating ---" << endl;
    Derived d;
    cout << "\n--- Destroying ---" << endl;
    return 0;
}
// Output:
// --- Creating ---
// 1. Base constructed
// 2. Middle constructed
// 3. Derived constructed
//
// --- Destroying ---
// 1. Derived destroyed (calls first!)
// 3. Middle destroyed (calls before ~Base)
// 4. Base destroyed
```

## 2.5 Function Hiding vs Overriding

When a derived class defines a function with the **same name** as a base class function:
- **Without `virtual`**: The base function is **hidden** (not overridden). The version called depends on the **pointer/reference type**, not the actual object type.
- **With `virtual`**: The function is **overridden**. The version called depends on the **actual object type** (runtime polymorphism — covered in Chapter 3).

> This distinction is one of the most common sources of bugs in C++!

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    void greet() {             // NOT virtual
        cout << "Hello from Base!" << endl;
    }
};

class Derived : public Base {
public:
    void greet() {             // hides Base::greet (NOT override!)
        cout << "Hello from Derived!" << endl;
    }
};

int main() {
    Derived d;
    Base* bPtr = &d;           // base pointer to derived object

    d.greet();                 // calls Derived::greet
    bPtr->greet();             // calls Base::greet — NOT Derived's!
                               // because greet() is NOT virtual

    // This is "function hiding" — the base version is called
    // based on the POINTER TYPE, not the OBJECT TYPE.
    // To fix this, make greet() virtual (see Chapter 3).

    return 0;
}
// Output:
// Hello from Derived!
// Hello from Base!
```

## 2.6 Multiple Inheritance & The Diamond Problem

The **diamond problem** occurs when a class inherits from two classes that share a common base:

```
      Base
      /  \
    A      B
      \  /
     Child
```

Without special handling, `Child` would contain **two copies** of `Base`, causing ambiguity.

**Solution:** Use `virtual` inheritance — the common base is shared (only one copy).

```cpp
#include <iostream>
using namespace std;

class Device {
public:
    int id;
    Device(int i) : id(i) {
        cout << "Device(" << id << ") constructed" << endl;
    }
};

// WITHOUT virtual: each path creates its own copy of Device
// WITH virtual: one shared copy of Device
class Sensor : virtual public Device {
public:
    Sensor(int i) : Device(i) {
        cout << "Sensor constructed" << endl;
    }
};

class Actuator : virtual public Device {
public:
    Actuator(int i) : Device(i) {
        cout << "Actuator constructed" << endl;
    }
};

// SmartDevice inherits from both — but only ONE Device exists
class SmartDevice : public Sensor, public Actuator {
public:
    // With virtual inheritance, the MOST DERIVED class
    // must call the virtual base's constructor
    SmartDevice(int i) : Device(i), Sensor(i), Actuator(i) {
        cout << "SmartDevice constructed" << endl;
    }
};

int main() {
    SmartDevice sd(42);
    cout << "Device ID: " << sd.id << endl;  // No ambiguity!

    // Without virtual inheritance, sd.id would be ambiguous:
    // sd.Sensor::id or sd.Actuator::id ?

    return 0;
}
// Output:
// Device(42) constructed
// Sensor constructed
// Actuator constructed
// SmartDevice constructed
// Device ID: 42
```

---
# Chapter 3: Polymorphism
---

## 3.1 What is Polymorphism? — Simple Introduction

**Polymorphism** means "many forms." It allows you to write code that works with a **base type** but automatically calls the correct behavior for the **actual type** at runtime.

**Two flavors in C++:**

| Type | Mechanism | Resolved At |
|------|-----------|-------------|
| **Compile-time** (Static) | Function overloading, Templates | Compile time |
| **Runtime** (Dynamic) | Virtual functions + Inheritance | Runtime |

> **Key Idea:** You call `shape->draw()`. If the shape is actually a Circle, it draws a circle. If it's a Rectangle, it draws a rectangle. **Same interface, different behavior.**

```cpp
#include <iostream>
#include <vector>
#include <memory>
using namespace std;

class Shape {
public:
    virtual void draw() const {
        cout << "Drawing a generic shape" << endl;
    }
    virtual ~Shape() = default;   // ALWAYS virtual destructor in base!
};

class Circle : public Shape {
public:
    void draw() const override {
        cout << "Drawing a Circle ●" << endl;
    }
};

class Rectangle : public Shape {
public:
    void draw() const override {
        cout << "Drawing a Rectangle ▬" << endl;
    }
};

class Triangle : public Shape {
public:
    void draw() const override {
        cout << "Drawing a Triangle ▲" << endl;
    }
};

int main() {
    // One function works with ALL shapes — this is polymorphism!
    vector<unique_ptr<Shape>> shapes;
    shapes.push_back(make_unique<Circle>());
    shapes.push_back(make_unique<Rectangle>());
    shapes.push_back(make_unique<Triangle>());

    for (const auto& shape : shapes) {
        shape->draw();   // correct version called automatically
    }

    return 0;
}
// Output:
// Drawing a Circle ●
// Drawing a Rectangle ▬
// Drawing a Triangle ▲
```

## 3.2 Compile-Time Polymorphism — Deep Dive

### Function Overloading
Multiple functions with the **same name** but **different parameter lists**. The compiler selects the right one based on the arguments.

### Template Polymorphism
Write **generic code** that works with any type. The compiler generates a specialized version for each type used. Zero runtime overhead.

```cpp
#include <iostream>
#include <string>
using namespace std;

// === Function Overloading ===
// Same name, different parameter types
int    add(int a, int b)          { return a + b; }
double add(double a, double b)    { return a + b; }
string add(string a, string b)    { return a + b; }

// Same name, different parameter count
void log(string msg) {
    cout << "[LOG] " << msg << endl;
}
void log(string msg, int level) {
    string prefix = (level >= 2) ? "[ERROR] " : "[INFO] ";
    cout << prefix << msg << endl;
}

// === Templates ===
template<typename T>
T maximum(T a, T b) {
    return (a > b) ? a : b;
}

// Template with multiple type parameters
template<typename T, typename U>
auto multiply(T a, U b) -> decltype(a * b) {
    return a * b;
}

int main() {
    // Function overloading — compiler picks the right one
    cout << add(3, 4) << endl;           // int version → 7
    cout << add(3.14, 2.71) << endl;     // double version → 5.85
    cout << add(string("Hello "), string("World")) << endl;

    log("Server started");               // 1-param version
    log("Disk full", 2);                 // 2-param version

    cout << endl;

    // Templates — type deduced automatically
    cout << maximum(10, 20) << endl;       // T = int → 20
    cout << maximum(3.14, 2.71) << endl;   // T = double → 3.14
    cout << maximum('a', 'z') << endl;     // T = char → z

    cout << multiply(3, 2.5) << endl;      // int * double → 7.5

    return 0;
}
// Output:
// 7
// 5.85
// Hello World
// [LOG] Server started
// [ERROR] Disk full
//
// 20
// 3.14
// z
// 7.5
```

## 3.3 Runtime Polymorphism — Deep Dive

Runtime polymorphism requires:
1. **`virtual`** keyword on the base class function
2. A **pointer or reference** to the base class
3. An object of a **derived type**

**Without `virtual`:** Static binding — the function is chosen based on the pointer type (compile time).
**With `virtual`:** Dynamic binding — the function is chosen based on the actual object type (runtime).

> ⚠️ **Always declare destructors `virtual`** in any class that has virtual functions. Otherwise, deleting a derived object through a base pointer causes **undefined behavior** (only base destructor runs).

```cpp
#include <iostream>
#include <cmath>
using namespace std;

class Shape {
public:
    virtual double area() const = 0;       // pure virtual
    virtual double perimeter() const = 0;  // pure virtual
    virtual void describe() const {
        cout << "Area: " << area()
             << ", Perimeter: " << perimeter() << endl;
    }
    virtual ~Shape() = default;            // virtual destructor!
};

class Circle : public Shape {
    double radius;
public:
    Circle(double r) : radius(r) {}

    double area() const override {
        return M_PI * radius * radius;
    }
    double perimeter() const override {
        return 2 * M_PI * radius;
    }
    void describe() const override {
        cout << "Circle (r=" << radius << "): ";
        Shape::describe();    // call base version
    }
};

class Rectangle : public Shape {
    double w, h;
public:
    Rectangle(double w, double h) : w(w), h(h) {}

    double area() const override { return w * h; }
    double perimeter() const override { return 2 * (w + h); }
    void describe() const override {
        cout << "Rectangle (" << w << "x" << h << "): ";
        Shape::describe();
    }
};

// This function works with ANY shape — present and FUTURE shapes!
void printShapeInfo(const Shape& s) {
    s.describe();
}

int main() {
    Circle c(5.0);
    Rectangle r(4.0, 6.0);

    printShapeInfo(c);     // calls Circle's methods
    printShapeInfo(r);     // calls Rectangle's methods

    // Array of base-class pointers
    Shape* shapes[] = { &c, &r };
    cout << "\nTotal area: ";
    double total = 0;
    for (auto* s : shapes)
        total += s->area();
    cout << total << endl;

    return 0;
}
// Output:
// Circle (r=5): Area: 78.5398, Perimeter: 31.4159
// Rectangle (4x6): Area: 24, Perimeter: 20
//
// Total area: 102.54
```

## 3.4 VTable & VPtr — Under the Hood

When a class has at least one `virtual` function, the compiler creates:

1. **VTable (Virtual Table)**: A static array per class containing function pointers to the actual implementations.
2. **VPtr (Virtual Pointer)**: A hidden member in each object that points to its class's VTable.

**How a virtual call works:**
```
object → vptr → vtable[function_index] → actual function → call
```

**Memory impact:** Each object gains one pointer (8 bytes on 64-bit). Each class has one vtable (shared by all instances).

| | Shape VTable | Circle VTable | Rectangle VTable |
|---|---|---|---|
| `area()` | *pure virtual* | `Circle::area` | `Rectangle::area` |
| `perimeter()` | *pure virtual* | `Circle::perimeter` | `Rectangle::perimeter` |
| `describe()` | `Shape::describe` | `Circle::describe` | `Rectangle::describe` |
| `~Shape()` | `Shape::~Shape` | `Circle::~Circle` | `Rectangle::~Rectangle` |

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    virtual void func1() { cout << "Base::func1" << endl; }
    virtual void func2() { cout << "Base::func2" << endl; }
    virtual ~Base() {}
};

class Derived : public Base {
public:
    void func1() override { cout << "Derived::func1" << endl; }
    // func2 is NOT overridden — inherited from Base
};

int main() {
    Base b;
    Derived d;

    // The vptr is a hidden member at the beginning of the object
    cout << "sizeof(Base):    " << sizeof(Base) << " bytes" << endl;
    cout << "sizeof(Derived): " << sizeof(Derived) << " bytes" << endl;
    // Both include 8 bytes for the vptr (on 64-bit systems)

    Base* ptr = &d;  // base pointer to derived object

    // At runtime:
    // 1. Follow ptr to the object (d)
    // 2. Read d's vptr → points to Derived's vtable
    // 3. Look up func1 in Derived's vtable → Derived::func1
    ptr->func1();  // Derived::func1

    // 4. Look up func2 in Derived's vtable → Base::func2 (not overridden)
    ptr->func2();  // Base::func2

    return 0;
}
// Output:
// sizeof(Base):    8 bytes  (just the vptr)
// sizeof(Derived): 8 bytes
// Derived::func1
// Base::func2
```

## 3.5 Abstract Classes & Pure Virtual Functions

A class with at least one **pure virtual function** (`= 0`) is **abstract** — you cannot create objects of it. It defines an interface that derived classes must implement.

**Rules:**
- A pure virtual function has no body (by default) and MUST be overridden by any non-abstract derived class
- If a derived class doesn't override ALL pure virtual functions, it's also abstract
- Abstract classes CAN have data members, constructors, and non-virtual functions

```cpp
#include <iostream>
#include <string>
#include <vector>
#include <memory>
using namespace std;

// Abstract class — defines a contract
class Logger {
protected:
    string tag;
public:
    Logger(string t) : tag(t) {}

    // Pure virtual — derived classes MUST implement these
    virtual void logInfo(const string& msg) = 0;
    virtual void logError(const string& msg) = 0;

    // Non-virtual — shared implementation
    void logWithTimestamp(const string& msg) {
        cout << "[" << tag << "] " << msg << endl;
    }

    virtual ~Logger() = default;
};

// Logger is abstract — this would NOT compile:
// Logger l("test"); // ❌ ERROR: cannot instantiate abstract class

class ConsoleLogger : public Logger {
public:
    ConsoleLogger() : Logger("CONSOLE") {}

    void logInfo(const string& msg) override {
        cout << "[INFO] " << msg << endl;
    }
    void logError(const string& msg) override {
        cout << "[ERROR] " << msg << endl;
    }
};

class FileLogger : public Logger {
    string filename;
public:
    FileLogger(string fname) : Logger("FILE"), filename(fname) {}

    void logInfo(const string& msg) override {
        cout << "[FILE:" << filename << "] INFO: " << msg << endl;
    }
    void logError(const string& msg) override {
        cout << "[FILE:" << filename << "] ERROR: " << msg << endl;
    }
};

// Works with ANY logger — now and in the future
void runDiagnostics(Logger& logger) {
    logger.logInfo("System check started");
    logger.logError("Memory usage high");
    logger.logWithTimestamp("Diagnostics complete");
}

int main() {
    ConsoleLogger console;
    FileLogger file("app.log");

    cout << "=== Console ===" << endl;
    runDiagnostics(console);

    cout << "\n=== File ===" << endl;
    runDiagnostics(file);

    return 0;
}
// Output:
// === Console ===
// [INFO] System check started
// [ERROR] Memory usage high
// [CONSOLE] Diagnostics complete
//
// === File ===
// [FILE:app.log] INFO: System check started
// [FILE:app.log] ERROR: Memory usage high
// [FILE] Diagnostics complete
```

## 3.6 Interfaces in C++

C++ doesn't have an `interface` keyword like Java. Instead, a class with **only pure virtual functions** (and a virtual destructor) serves as an interface.

A class can implement **multiple interfaces** (through multiple inheritance), which is the safe and recommended use of multiple inheritance.

```cpp
#include <iostream>
#include <string>
using namespace std;

// Interface: only pure virtual functions
class ISerializable {
public:
    virtual string serialize() const = 0;
    virtual void deserialize(const string& data) = 0;
    virtual ~ISerializable() = default;
};

class IPrintable {
public:
    virtual void print() const = 0;
    virtual ~IPrintable() = default;
};

// Concrete class implementing BOTH interfaces
class Config : public ISerializable, public IPrintable {
    string key, value;
public:
    Config(string k, string v) : key(k), value(v) {}

    // Implement ISerializable
    string serialize() const override {
        return key + "=" + value;
    }
    void deserialize(const string& data) override {
        auto pos = data.find('=');
        key   = data.substr(0, pos);
        value = data.substr(pos + 1);
    }

    // Implement IPrintable
    void print() const override {
        cout << "[" << key << "] = " << value << endl;
    }
};

// Function accepts any ISerializable
void save(const ISerializable& obj) {
    cout << "Saving: " << obj.serialize() << endl;
}

int main() {
    Config cfg("baudrate", "115200");
    cfg.print();
    save(cfg);

    cfg.deserialize("port=8080");
    cfg.print();
    save(cfg);

    return 0;
}
// Output:
// [baudrate] = 115200
// Saving: baudrate=115200
// [port] = 8080
// Saving: port=8080
```

## 3.7 `override` and `final` Keywords (C++11)

### `override`
Tells the compiler: "I intend to override a virtual function." If the signature doesn't match, you get a **compile error** instead of a silent bug.

### `final`
- On a **function**: Prevents further overriding
- On a **class**: Prevents inheritance

> 💡 **Always use `override`!** It catches subtle bugs like wrong parameter types, missing `const`, or typos that would silently create a new function instead of overriding.

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    virtual void process(int x) const { cout << "Base: " << x << endl; }
    virtual void log() { cout << "Base log" << endl; }
    virtual ~Base() = default;
};

class Derived : public Base {
public:
    // ✅ Correct override
    void process(int x) const override { cout << "Derived: " << x << endl; }

    // ❌ These would cause COMPILE ERRORS with 'override':
    // void process(double x) const override {}   // wrong param type
    // void process(int x) override {}             // missing const
    // void processs(int x) const override {}      // typo in name

    // Mark as final — cannot be overridden in further derived classes
    void log() override final { cout << "Derived log (final)" << endl; }
};

// Class marked as final — CANNOT be inherited
class Leaf final : public Derived {
public:
    // void log() override {} // ❌ ERROR: log() is final in Derived
};

// class Illegal : public Leaf {};  // ❌ ERROR: Leaf is final

int main() {
    Derived d;
    Base* ptr = &d;
    ptr->process(42);
    ptr->log();
    return 0;
}
// Output:
// Derived: 42
// Derived log (final)
```

## 3.8 Object Slicing Problem

**Object slicing** occurs when you assign a derived object to a base object **by value**. The derived-specific data is "sliced off" and lost.

**Solution:** Always use **pointers or references** to base class for polymorphism.

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    virtual void identify() const { cout << "I am Base" << endl; }
    virtual ~Base() = default;
};

class Derived : public Base {
    int extra = 42;
public:
    void identify() const override {
        cout << "I am Derived (extra=" << extra << ")" << endl;
    }
};

void byValue(Base b) {        // ⚠️ receives a COPY of only the Base part
    b.identify();
}

void byReference(const Base& b) {   // ✅ no slicing
    b.identify();
}

void byPointer(const Base* b) {     // ✅ no slicing
    b->identify();
}

int main() {
    Derived d;

    cout << "Direct call:" << endl;
    d.identify();

    cout << "\nBy value (SLICED!):" << endl;
    byValue(d);              // Derived part is lost!

    cout << "\nBy reference (correct):" << endl;
    byReference(d);          // polymorphism works

    cout << "\nBy pointer (correct):" << endl;
    byPointer(&d);           // polymorphism works

    // Slicing with assignment
    cout << "\nAssignment slicing:" << endl;
    Base b = d;              // only Base part is copied
    b.identify();            // calls Base::identify

    return 0;
}
// Output:
// Direct call:
// I am Derived (extra=42)
//
// By value (SLICED!):
// I am Base
//
// By reference (correct):
// I am Derived (extra=42)
//
// By pointer (correct):
// I am Derived (extra=42)
//
// Assignment slicing:
// I am Base
```

---
# Chapter 4: Modern C++ (C++11 / 14 / 17 / 20)
---

## 4.1 Why Modern C++? — Simple Introduction

"Modern C++" refers to features introduced from **C++11 onwards**. It's practically a different language compared to C++03 — safer, faster, and much more expressive.

**What changed:**

| Feature | Old C++ | Modern C++ |
|---------|---------|------------|
| Memory management | `new`/`delete` | Smart pointers |
| Type declarations | Explicit types everywhere | `auto` |
| Loops | Iterator-based | Range-based for |
| Function objects | Functors | Lambdas |
| Null pointers | `NULL` (integer 0) | `nullptr` |
| Constants | `#define`, `const` | `constexpr` |
| Enums | Unscoped (leak names) | `enum class` |
| Moving data | Copy everything | Move semantics |

> **Philosophy:** Write code that is *safer* (fewer leaks, fewer crashes), *faster* (move semantics, constexpr), and *cleaner* (auto, lambdas, range-for) with less boilerplate.

## 4.2 `auto` and Type Inference

`auto` lets the compiler **deduce the type** from the initializer. Use it to avoid redundant type names and make code more readable.

**When to use `auto`:**
- Complex iterator types
- Return types of templates
- When the type is obvious from the right-hand side

**When NOT to use `auto`:**
- When the type isn't obvious and readability suffers
- When you want a specific type that differs from the initializer

```cpp
#include <iostream>
#include <vector>
#include <map>
#include <string>
using namespace std;

int main() {
    // Basic type deduction
    auto x = 42;            // int
    auto pi = 3.14;         // double
    auto name = string("C++");  // std::string
    auto flag = true;       // bool

    cout << "x: " << x << ", pi: " << pi
         << ", name: " << name << ", flag: " << flag << endl;

    // Where auto really shines — complex types
    map<string, vector<int>> data = {
        {"group_a", {10, 20, 30}},
        {"group_b", {40, 50}},
    };

    // Without auto: map<string, vector<int>>::iterator it = data.begin();
    // With auto:
    for (auto it = data.begin(); it != data.end(); ++it) {
        cout << it->first << ": ";
        for (auto val : it->second)
            cout << val << " ";
        cout << endl;
    }

    // auto with references and const
    auto& ref = x;          // int& — reference to x
    const auto& cref = x;   // const int&

    ref = 100;
    cout << "x after ref=100: " << x << endl;

    // decltype — get the type of an expression without evaluating
    decltype(x) y = 200;    // y is int (same type as x)
    cout << "y: " << y << endl;

    return 0;
}
// Output:
// x: 42, pi: 3.14, name: C++, flag: 1
// group_a: 10 20 30
// group_b: 40 50
// x after ref=100: 100
// y: 200
```

## 4.3 Range-based For Loops (C++11)

A cleaner syntax for iterating over containers. Works with anything that has `begin()` and `end()`.

```cpp
for (auto& element : container) {
    // use element
}
```

**Guidelines:**
- Use `const auto&` for read-only access (no copies, no modification)
- Use `auto&` to modify elements in place
- Use `auto` (by value) only for cheap-to-copy types like `int`

```cpp
#include <iostream>
#include <vector>
#include <array>
#include <string>
using namespace std;

int main() {
    // Works with vectors
    vector<int> nums = {10, 20, 30, 40, 50};
    cout << "Read-only: ";
    for (const auto& n : nums)
        cout << n << " ";
    cout << endl;

    // Modify in place
    for (auto& n : nums)
        n *= 2;
    cout << "Doubled: ";
    for (const auto& n : nums)
        cout << n << " ";
    cout << endl;

    // Works with arrays
    int arr[] = {1, 2, 3, 4, 5};
    cout << "C-array: ";
    for (auto val : arr)
        cout << val << " ";
    cout << endl;

    // Works with std::array
    array<string, 3> names = {"Alice", "Bob", "Charlie"};
    cout << "Names: ";
    for (const auto& name : names)
        cout << name << " ";
    cout << endl;

    // Works with initializer list
    cout << "Init list: ";
    for (auto x : {100, 200, 300})
        cout << x << " ";
    cout << endl;

    // Works with strings (iterates over characters)
    string word = "Hello";
    cout << "Chars: ";
    for (char c : word)
        cout << c << " ";
    cout << endl;

    return 0;
}
// Output:
// Read-only: 10 20 30 40 50
// Doubled: 20 40 60 80 100
// C-array: 1 2 3 4 5
// Names: Alice Bob Charlie
// Init list: 100 200 300
// Chars: H e l l o
```

## 4.4 Smart Pointers — Deep Dive

Smart pointers automate memory management. When a smart pointer goes out of scope, it automatically deletes the managed object — no leaks, no double-free.

| Type | Ownership | Use Case |
|------|-----------|----------|
| `unique_ptr` | **Exclusive** (1 owner) | Default choice. Can't be copied, only moved. |
| `shared_ptr` | **Shared** (N owners) | Reference-counted. Deleted when count → 0. |
| `weak_ptr` | **Non-owning** observer | Breaks circular references with `shared_ptr`. |

> ⚠️ **Rule:** Never use `new`/`delete` directly. Use `make_unique` (C++14) and `make_shared` (C++11).

```cpp
#include <iostream>
#include <memory>
#include <vector>
using namespace std;

class Resource {
    string name;
public:
    Resource(string n) : name(n) {
        cout << "Resource '" << name << "' created" << endl;
    }
    ~Resource() {
        cout << "Resource '" << name << "' destroyed" << endl;
    }
    void use() const { cout << "Using " << name << endl; }
};

int main() {
    // === unique_ptr: exclusive ownership ===
    cout << "--- unique_ptr ---" << endl;
    {
        auto p1 = make_unique<Resource>("A");
        p1->use();

        // auto p2 = p1;              // ❌ COMPILE ERROR: can't copy
        auto p2 = move(p1);           // ✅ transfer ownership
        // p1 is now nullptr
        p2->use();

        if (!p1) cout << "p1 is null after move" << endl;
    } // 'A' automatically destroyed here

    // === shared_ptr: shared ownership ===
    cout << "\n--- shared_ptr ---" << endl;
    {
        auto sp1 = make_shared<Resource>("B");
        cout << "ref count: " << sp1.use_count() << endl;  // 1

        {
            auto sp2 = sp1;     // share ownership
            cout << "ref count: " << sp1.use_count() << endl;  // 2
            sp2->use();
        } // sp2 destroyed, ref count drops to 1

        cout << "ref count: " << sp1.use_count() << endl;  // 1
    } // sp1 destroyed, ref count → 0, 'B' destroyed

    // === weak_ptr: break circular references ===
    cout << "\n--- weak_ptr ---" << endl;
    {
        weak_ptr<Resource> weak;
        {
            auto shared = make_shared<Resource>("C");
            weak = shared;   // weak observes but doesn't own

            if (auto locked = weak.lock()) {  // try to get shared_ptr
                locked->use();
                cout << "Resource is alive" << endl;
            }
        } // 'C' destroyed here (weak_ptr doesn't keep it alive)

        if (weak.expired())
            cout << "Resource is gone" << endl;
    }

    // === Polymorphic container ===
    cout << "\n--- Polymorphic container ---" << endl;
    {
        vector<unique_ptr<Resource>> resources;
        resources.push_back(make_unique<Resource>("R1"));
        resources.push_back(make_unique<Resource>("R2"));
        resources.push_back(make_unique<Resource>("R3"));

        for (const auto& r : resources)
            r->use();
    } // all automatically cleaned up

    return 0;
}
// Output:
// --- unique_ptr ---
// Resource 'A' created
// Using A
// Using A
// p1 is null after move
// Resource 'A' destroyed
//
// --- shared_ptr ---
// Resource 'B' created
// ref count: 1
// ref count: 2
// Using B
// ref count: 1
// Resource 'B' destroyed
//
// --- weak_ptr ---
// Resource 'C' created
// Using C
// Resource is alive
// Resource 'C' destroyed
// Resource is gone
//
// --- Polymorphic container ---
// Resource 'R1' created
// Resource 'R2' created
// Resource 'R3' created
// Using R1
// Using R2
// Using R3
// Resource 'R3' destroyed
// Resource 'R2' destroyed
// Resource 'R1' destroyed
```

## 4.5 Move Semantics & Rvalue References (C++11)

Move semantics allow you to **transfer** resources from temporary objects instead of copying them. This is a huge performance win for objects managing heap memory, file handles, etc.

**Key Concepts:**
- **Lvalue**: Has a name and address (`int x = 5;` — `x` is an lvalue)
- **Rvalue**: A temporary with no persistent identity (`5`, `x + y`, function return values)
- **`T&&`**: Rvalue reference — binds to temporaries
- **`std::move(x)`**: Casts `x` to an rvalue reference, enabling move instead of copy

> ⚠️ After `std::move(x)`, `x` is in a **valid but unspecified** state. Don't use it except to assign a new value or destroy it.

```cpp
#include <iostream>
#include <vector>
#include <string>
#include <utility>
using namespace std;

class HeavyObject {
    vector<int> data;
    string name;
public:
    HeavyObject(string n, int size) : name(n), data(size, 42) {
        cout << name << " constructed (" << size << " elements)" << endl;
    }

    // Copy constructor
    HeavyObject(const HeavyObject& other)
        : data(other.data), name(other.name + "_copy")
    {
        cout << name << " COPIED (expensive!)" << endl;
    }

    // Move constructor
    HeavyObject(HeavyObject&& other) noexcept
        : data(move(other.data)), name(move(other.name))
    {
        cout << name << " MOVED (cheap!)" << endl;
    }

    size_t size() const { return data.size(); }
};

HeavyObject createObject() {
    HeavyObject obj("factory_obj", 1000000);
    return obj;  // move (or NRVO — Named Return Value Optimization)
}

int main() {
    cout << "=== Copy vs Move ===" << endl;
    HeavyObject a("original", 1000000);

    HeavyObject b = a;              // COPY — duplicates 1M elements
    HeavyObject c = move(a);        // MOVE — just swaps pointers

    cout << "\na.size() = " << a.size() << " (moved-from, empty)" << endl;
    cout << "b.size() = " << b.size() << " (full copy)" << endl;
    cout << "c.size() = " << c.size() << " (moved data)" << endl;

    cout << "\n=== Return Value ===" << endl;
    auto obj = createObject();       // move or NRVO (no copy!)
    cout << "obj.size() = " << obj.size() << endl;

    return 0;
}
// Output:
// === Copy vs Move ===
// original constructed (1000000 elements)
// original_copy COPIED (expensive!)
// original MOVED (cheap!)
//
// a.size() = 0 (moved-from, empty)
// b.size() = 1000000 (full copy)
// c.size() = 1000000 (moved data)
//
// === Return Value ===
// factory_obj constructed (1000000 elements)
// obj.size() = 1000000
```

## 4.6 Lambda Expressions — Deep Dive

A **lambda** is an anonymous function object defined inline. They are extremely useful with STL algorithms and callbacks.

**Syntax:**
```cpp
[capture](parameters) -> return_type { body }
```

**Capture Modes:**

| Capture | Meaning |
|---------|---------|
| `[]` | Capture nothing |
| `[x]` | Capture `x` by value (copy) |
| `[&x]` | Capture `x` by reference |
| `[=]` | Capture all used variables by value |
| `[&]` | Capture all used variables by reference |
| `[=, &x]` | All by value, except `x` by reference |
| `[this]` | Capture the enclosing object's `this` pointer |
| `[*this]` | Capture a copy of the enclosing object (C++17) |

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>
using namespace std;

int main() {
    // === Basic lambda ===
    auto greet = [](const string& name) {
        cout << "Hello, " << name << "!" << endl;
    };
    greet("World");

    // === Capture by value ===
    int threshold = 50;
    auto isAbove = [threshold](int val) { return val > threshold; };

    vector<int> data = {23, 67, 45, 89, 12, 56, 78};

    cout << "Above " << threshold << ": ";
    for (auto v : data)
        if (isAbove(v)) cout << v << " ";
    cout << endl;

    // === Capture by reference — modify external state ===
    int sum = 0;
    int count = 0;
    for_each(data.begin(), data.end(), [&sum, &count](int v) {
        sum += v;
        count++;
    });
    cout << "Sum: " << sum << ", Count: " << count
         << ", Avg: " << (double)sum / count << endl;

    // === Lambda with STL algorithms ===
    // Sort descending
    sort(data.begin(), data.end(), [](int a, int b) {
        return a > b;
    });
    cout << "Sorted desc: ";
    for (auto v : data) cout << v << " ";
    cout << endl;

    // Count elements matching condition
    auto cnt = count_if(data.begin(), data.end(),
        [](int v) { return v % 2 == 0; });
    cout << "Even count: " << cnt << endl;

    // === Generic lambda (C++14) ===
    auto multiply = [](auto a, auto b) { return a * b; };
    cout << "3 * 4 = " << multiply(3, 4) << endl;
    cout << "2.5 * 4.0 = " << multiply(2.5, 4.0) << endl;

    // === Mutable lambda ===
    int counter = 0;
    auto increment = [counter]() mutable {
        return ++counter;  // modifies the lambda's INTERNAL copy
    };
    cout << increment() << ", " << increment() << ", " << increment() << endl;
    cout << "Original counter: " << counter << endl;  // still 0

    // === Immediately Invoked Lambda (IIFE) ===
    const auto config = [&]() {
        // complex initialization logic...
        return data.size() > 5 ? "large" : "small";
    }(); // note the () — invoked immediately
    cout << "Dataset is: " << config << endl;

    return 0;
}
// Output:
// Hello, World!
// Above 50: 67 89 56 78
// Sum: 370, Count: 7, Avg: 52.8571
// Sorted desc: 89 78 67 56 45 23 12
// Even count: 3
// 3 * 4 = 12
// 2.5 * 4.0 = 10
// 1, 2, 3
// Original counter: 0
// Dataset is: large
```

## 4.7 `constexpr` and `consteval`

| Keyword | Standard | Meaning |
|---------|----------|---------|
| `constexpr` | C++11/14 | *Can* be evaluated at compile time |
| `consteval` | C++20 | *Must* be evaluated at compile time |
| `constinit` | C++20 | Variable must be initialized at compile time (but can be modified at runtime) |

`constexpr` functions can compute values during compilation — zero runtime cost for those values. As of C++14, `constexpr` functions can contain loops, conditions, and local variables.

```cpp
#include <iostream>
#include <array>
using namespace std;

// constexpr function — evaluated at compile time if possible
constexpr int factorial(int n) {
    int result = 1;
    for (int i = 2; i <= n; ++i)
        result *= i;
    return result;
}

constexpr double power(double base, int exp) {
    double result = 1.0;
    for (int i = 0; i < exp; ++i)
        result *= base;
    return result;
}

// constexpr class (C++14)
class Point {
    double x_, y_;
public:
    constexpr Point(double x, double y) : x_(x), y_(y) {}
    constexpr double x() const { return x_; }
    constexpr double y() const { return y_; }
    constexpr double distFromOrigin() const {
        return x_ * x_ + y_ * y_;  // avoiding sqrt for constexpr
    }
};

int main() {
    // Computed at COMPILE TIME — as if you wrote the literal
    constexpr int fact5 = factorial(5);
    constexpr double pow2_10 = power(2.0, 10);

    cout << "5! = " << fact5 << endl;
    cout << "2^10 = " << pow2_10 << endl;

    // Can be used where compile-time constants are required
    constexpr int size = factorial(4);
    array<int, size> arr;   // array size must be compile-time constant!
    cout << "Array size: " << arr.size() << endl;

    // constexpr object
    constexpr Point p(3.0, 4.0);
    constexpr double dist = p.distFromOrigin();
    cout << "Point(" << p.x() << ", " << p.y() << ")"
         << " dist^2 = " << dist << endl;

    // Can also be used at runtime with runtime values
    int n;
    cout << "Enter a number: ";
    n = 6;  // simulating input
    cout << n << "! = " << factorial(n) << endl;  // computed at runtime

    return 0;
}
// Output:
// 5! = 120
// 2^10 = 1024
// Array size: 24
// Point(3, 4) dist^2 = 25
// Enter a number: 6! = 720
```

## 4.8 Structured Bindings (C++17)

Structured bindings let you decompose structs, pairs, tuples, and arrays into named variables in a single declaration.

```cpp
auto [x, y, z] = some_struct_or_tuple;
```

This makes code much more readable, especially when working with `std::pair` (from maps) or functions returning multiple values.

```cpp
#include <iostream>
#include <map>
#include <tuple>
#include <string>
using namespace std;

struct Point {
    double x, y;
    string label;
};

// Function returning multiple values via tuple
auto divide(int a, int b) {
    return tuple{a / b, a % b};
}

int main() {
    // === Decompose a struct ===
    Point p{3.0, 4.0, "origin"};
    auto [x, y, label] = p;
    cout << label << ": (" << x << ", " << y << ")" << endl;

    // === Decompose a tuple ===
    auto [quotient, remainder] = divide(17, 5);
    cout << "17 / 5 = " << quotient << " remainder " << remainder << endl;

    // === Iterate over a map (most common use!) ===
    map<string, int> scores = {
        {"Alice", 95},
        {"Bob", 87},
        {"Charlie", 92}
    };

    // Before C++17: for (auto it = scores.begin(); ...)
    // or: for (auto& pair : scores) { pair.first, pair.second }

    // C++17: clean and readable
    for (const auto& [name, score] : scores) {
        cout << name << ": " << score << endl;
    }

    // === Decompose an array ===
    int arr[] = {10, 20, 30};
    auto [a, b, c] = arr;
    cout << "Array: " << a << ", " << b << ", " << c << endl;

    // === With pair ===
    auto [inserted, success] = scores.insert({"Dave", 88});
    cout << "Insert success: " << success << endl;

    return 0;
}
// Output:
// origin: (3, 4)
// 17 / 5 = 3 remainder 2
// Alice: 95
// Bob: 87
// Charlie: 92
// Array: 10, 20, 30
// Insert success: 1
```

## 4.9 `std::optional`, `std::variant`, `std::any` (C++17)

These types provide safe alternatives to common C patterns:

| Type | Replaces | Purpose |
|------|----------|---------|
| `std::optional<T>` | Nullable pointers, sentinel values | A value that may or may not be present |
| `std::variant<T, U, ...>` | `union` | A type-safe tagged union |
| `std::any` | `void*` | Type-safe container for any single value |

```cpp
#include <iostream>
#include <optional>
#include <variant>
#include <any>
#include <string>
#include <vector>
#include <map>
using namespace std;

// === std::optional ===
// A function that might not return a result
optional<int> findIndex(const vector<int>& v, int target) {
    for (int i = 0; i < (int)v.size(); ++i)
        if (v[i] == target) return i;    // found
    return nullopt;                      // not found
}

// === std::variant ===
// A config value can be an int, double, or string
using ConfigValue = variant<int, double, string>;

void printConfig(const string& key, const ConfigValue& val) {
    cout << key << " = ";
    // visit applies a function based on the actual type
    visit([](auto&& arg) { cout << arg; }, val);
    cout << endl;
}

int main() {
    // --- optional ---
    cout << "=== std::optional ===" << endl;
    vector<int> data = {10, 20, 30, 40, 50};

    auto result1 = findIndex(data, 30);
    if (result1.has_value())
        cout << "Found 30 at index " << result1.value() << endl;

    // Shorter syntax with value_or
    auto result2 = findIndex(data, 99);
    cout << "Index of 99: " << result2.value_or(-1) << endl;

    // --- variant ---
    cout << "\n=== std::variant ===" << endl;
    map<string, ConfigValue> config;
    config["port"] = 8080;            // int
    config["pi"]   = 3.14159;         // double
    config["host"] = string("localhost");  // string

    for (const auto& [key, val] : config)
        printConfig(key, val);

    // Check which type is active
    if (holds_alternative<int>(config["port"]))
        cout << "port is int: " << get<int>(config["port"]) << endl;

    // --- any ---
    cout << "\n=== std::any ===" << endl;
    any value;

    value = 42;
    cout << "int: " << any_cast<int>(value) << endl;

    value = string("Hello");
    cout << "string: " << any_cast<string>(value) << endl;

    value = 3.14;
    cout << "double: " << any_cast<double>(value) << endl;

    // Safe check before casting
    if (value.type() == typeid(double))
        cout << "It's a double!" << endl;

    return 0;
}
// Output:
// === std::optional ===
// Found 30 at index 2
// Index of 99: -1
//
// === std::variant ===
// host = localhost
// pi = 3.14159
// port = 8080
// port is int: 8080
//
// === std::any ===
// int: 42
// string: Hello
// double: 3.14
// It's a double!
```

## 4.10 Concepts (C++20)

**Concepts** let you constrain template parameters with readable, named requirements. Before C++20, template errors were notoriously unreadable. Concepts make them clear.

```cpp
template<typename T>
concept Numeric = is_arithmetic_v<T>;

template<Numeric T>   // T must be a number
T add(T a, T b) { return a + b; }
```

```cpp
#include <iostream>
#include <concepts>
#include <string>
#include <vector>
using namespace std;

// === Define concepts ===
template<typename T>
concept Numeric = is_arithmetic_v<T>;

template<typename T>
concept Printable = requires(T t) {
    { cout << t } -> same_as<ostream&>;   // must support <<
};

template<typename T>
concept Container = requires(T t) {
    t.begin();
    t.end();
    t.size();
};

// === Use concepts to constrain templates ===

// Only accepts numeric types
template<Numeric T>
T add(T a, T b) {
    return a + b;
}

// Only accepts types that can be printed
template<Printable T>
void display(const T& value) {
    cout << "Value: " << value << endl;
}

// Only accepts containers
template<Container C>
void printSize(const C& c) {
    cout << "Container size: " << c.size() << endl;
}

// Alternative syntax using 'requires' clause
template<typename T>
    requires Numeric<T>
T multiply(T a, T b) {
    return a * b;
}

// Shortest syntax
auto square(Numeric auto x) {
    return x * x;
}

int main() {
    cout << add(3, 4) << endl;        // ✅ int is Numeric
    cout << add(3.14, 2.71) << endl;  // ✅ double is Numeric
    // add("a", "b");                 // ❌ string is NOT Numeric

    display(42);                       // ✅
    display("Hello");                  // ✅
    display(3.14);                     // ✅

    vector<int> v = {1, 2, 3};
    string s = "abc";
    printSize(v);                      // ✅ vector is a Container
    printSize(s);                      // ✅ string is a Container
    // printSize(42);                  // ❌ int is NOT a Container

    cout << "5^2 = " << square(5) << endl;
    cout << "2.5^2 = " << square(2.5) << endl;

    return 0;
}
// Output:
// 7
// 5.85
// Value: 42
// Value: Hello
// Value: 3.14
// Container size: 3
// Container size: 3
// 5^2 = 25
// 2.5^2 = 6.25
```

## 4.11 `enum class` — Scoped Enumerations (C++11)

Traditional C `enum` values leak into the enclosing scope and implicitly convert to `int`. `enum class` fixes both issues.

| Feature | `enum` (old) | `enum class` (C++11) |
|---------|-------------|---------------------|
| Scope | Values leak into enclosing scope | Values scoped to the enum |
| Implicit int conversion | Yes | No (explicit cast needed) |
| Name collisions | Possible | Impossible |
| Underlying type | Implementation-defined | Can be specified |

```cpp
#include <iostream>
using namespace std;

// ❌ Old-style enum — values leak into scope
enum OldColor { RED, GREEN, BLUE };
// enum TrafficLight { RED, YELLOW, GREEN };  // ❌ ERROR: RED and GREEN already defined!

// ✅ Modern enum class — scoped and type-safe
enum class Color { Red, Green, Blue };
enum class TrafficLight { Red, Yellow, Green };  // ✅ No conflict!

// You can specify the underlying type
enum class StatusCode : uint8_t {
    OK          = 0,
    NotFound    = 1,
    ServerError = 2,
    Timeout     = 3
};

// Use with switch
string colorToString(Color c) {
    switch (c) {
        case Color::Red:   return "Red";
        case Color::Green: return "Green";
        case Color::Blue:  return "Blue";
    }
    return "Unknown";
}

int main() {
    Color c = Color::Green;
    TrafficLight tl = TrafficLight::Red;

    // int x = c;           // ❌ ERROR: no implicit conversion
    int x = static_cast<int>(c);  // ✅ explicit cast: 1
    cout << "Color value: " << x << endl;

    cout << "Color: " << colorToString(c) << endl;

    StatusCode status = StatusCode::OK;
    cout << "Status: " << static_cast<int>(status) << endl;

    // Compare enum values
    if (c == Color::Green)
        cout << "It's green!" << endl;

    // if (c == tl)  // ❌ ERROR: can't compare different enum types

    return 0;
}
// Output:
// Color value: 1
// Color: Green
// Status: 0
// It's green!
```

## 4.12 `nullptr` vs `NULL` (C++11)

| | `NULL` (old) | `nullptr` (C++11) |
|---|---|---|
| Type | `int` (typically 0) | `std::nullptr_t` |
| Ambiguity | Can cause overload confusion | Unambiguous |
| Safety | Can accidentally match int overloads | Only matches pointer types |

> **Rule:** Always use `nullptr` in modern C++. Never use `NULL` or `0` for pointers.

```cpp
#include <iostream>
using namespace std;

void process(int value) {
    cout << "process(int): " << value << endl;
}

void process(int* ptr) {
    if (ptr)
        cout << "process(int*): " << *ptr << endl;
    else
        cout << "process(int*): nullptr" << endl;
}

int main() {
    // process(NULL);     // ⚠️ AMBIGUOUS in some compilers!
                          // NULL is typically 0 (an int), so which overload?

    process(nullptr);     // ✅ CLEAR: calls process(int*)

    int x = 42;
    process(x);           // calls process(int)
    process(&x);          // calls process(int*)

    // nullptr with smart pointers
    unique_ptr<int> p = nullptr;  // no object managed
    if (!p)
        cout << "Smart pointer is empty" << endl;

    // nullptr in conditions
    int* raw = nullptr;
    if (raw == nullptr)           // explicit check
        cout << "raw is null" << endl;
    if (!raw)                     // also works
        cout << "raw is null (bool check)" << endl;

    return 0;
}
// Output:
// process(int*): nullptr
// process(int): 42
// process(int*): 42
// Smart pointer is empty
// raw is null
// raw is null (bool check)
```

---
# 5. References
---

## Books
1. **Bjarne Stroustrup**, *The C++ Programming Language* (4th Edition), Addison-Wesley, 2013
2. **Scott Meyers**, *Effective Modern C++: 42 Specific Ways to Improve Your Use of C++11 and C++14*, O'Reilly, 2014
3. **Nicolai Josuttis**, *C++17 – The Complete Guide*, NicoJosuttis.com, 2019
4. **Nicolai Josuttis**, *C++20 – The Complete Guide*, NicoJosuttis.com, 2022

## Online References
5. **cppreference.com** — [https://en.cppreference.com](https://en.cppreference.com) — The definitive C++ reference
6. **ISO C++ FAQ** — [https://isocpp.org/faq](https://isocpp.org/faq) — Official C++ FAQ
7. **C++ Core Guidelines** (Stroustrup & Sutter) — [https://isocpp.github.io/CppCoreGuidelines/](https://isocpp.github.io/CppCoreGuidelines/) — Best practices endorsed by the C++ community
8. **Compiler Explorer (Godbolt)** — [https://godbolt.org](https://godbolt.org) — See generated assembly for any C++ code
9. **C++ Insights** — [https://cppinsights.io](https://cppinsights.io) — See what the compiler does with your code (auto deduction, template instantiation, etc.)
10. **LearnCpp.com** — [https://www.learncpp.com](https://www.learncpp.com) — Comprehensive free tutorial

## Standards References
11. **C++11**: ISO/IEC 14882:2011
12. **C++14**: ISO/IEC 14882:2014
13. **C++17**: ISO/IEC 14882:2017
14. **C++20**: ISO/IEC 14882:2020

---
*Notebook prepared as a teaching resource covering: Classes, Inheritance, Polymorphism, and Modern C++ features from C++11 through C++20.*
