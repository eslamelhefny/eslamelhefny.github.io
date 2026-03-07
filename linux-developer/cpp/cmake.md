---
layout: guide
title: "CMake"
description: "Build cross-platform C++ projects with CMake — targets, properties, find_package, toolchain files for cross-compilation, CTest, CPack, and modern CMake best practices."
stage: "Stage 03"
phase: "linux-developer-cpp"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C++ Programming"
phase_index: "/linux-developer/cpp/"
permalink: /linux-developer/cpp/cmake/
prev_topic:
  title: "Move Semantics"
  url: /linux-developer/cpp/move-semantics/
next_topic:
  title: "Qt Framework"
  url: /linux-developer/cpp/qt/
---

## What is CMake?
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

CMake is a **build system generator** — it generates native build files (Makefiles, Ninja, Visual Studio projects) from a platform-independent description (`CMakeLists.txt`). It is the de facto standard build system for C++ projects.

```
Source + CMakeLists.txt  →  CMake  →  Makefile / build.ninja / .sln
                                         ↓
                                      Compiler / Linker → Binary
```

### CMake Workflow

```bash
# Configure (generate build files)
cmake -B build -S .

# Build
cmake --build build

# Install
cmake --install build

# Or use specific generator
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
```

---

## Modern CMake: Targets and Properties
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

**Modern CMake (3.x+)** thinks in **targets** — each target has properties that describe how to build it and how consumers should use it.

```cmake
cmake_minimum_required(VERSION 3.16)
project(MyApp VERSION 1.0.0 LANGUAGES CXX)

# Require C++17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)   # -std=c++17, not -std=gnu++17

# --- Library target ---
add_library(sensor_lib STATIC
    src/sensor.cpp
    src/calibration.cpp
)

# PRIVATE: only for building sensor_lib itself
# INTERFACE: only for consumers of sensor_lib
# PUBLIC: both
target_include_directories(sensor_lib
    PUBLIC  include/          # consumers get this include path
    PRIVATE src/              # only this library sees it
)

target_compile_options(sensor_lib
    PRIVATE -Wall -Wextra -Wpedantic
)

target_compile_definitions(sensor_lib
    PUBLIC  SENSOR_LIB_VERSION=1
    PRIVATE SENSOR_DEBUG=0
)

# --- Executable target ---
add_executable(myapp main.cpp)

target_link_libraries(myapp
    PRIVATE sensor_lib   # links sensor_lib; inherits its PUBLIC properties
)
```

### Directory Structure

```
project/
├── CMakeLists.txt        ← top-level
├── include/
│   └── sensor.h
├── src/
│   ├── CMakeLists.txt    ← optional sub-directory
│   ├── sensor.cpp
│   └── calibration.cpp
├── tests/
│   ├── CMakeLists.txt
│   └── test_sensor.cpp
└── build/                ← out-of-source build dir (never commit!)
```

### Multi-Directory Project

```cmake
# Top-level CMakeLists.txt
cmake_minimum_required(VERSION 3.16)
project(MyProject)

add_subdirectory(src)
add_subdirectory(tests)

# src/CMakeLists.txt
add_library(mylib sensor.cpp)
target_include_directories(mylib PUBLIC ${CMAKE_SOURCE_DIR}/include)

# tests/CMakeLists.txt
add_executable(test_sensor test_sensor.cpp)
target_link_libraries(test_sensor PRIVATE mylib)
```

---

## Finding and Using Libraries
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### `find_package`

```cmake
# Find OpenSSL (system library)
find_package(OpenSSL REQUIRED)
target_link_libraries(myapp PRIVATE OpenSSL::SSL OpenSSL::Crypto)

# Find Threads (pthreads)
find_package(Threads REQUIRED)
target_link_libraries(myapp PRIVATE Threads::Threads)

# Find Qt6
find_package(Qt6 REQUIRED COMPONENTS Core Widgets)
target_link_libraries(myapp PRIVATE Qt6::Core Qt6::Widgets)
```

### FetchContent — Embedded Dependencies

```cmake
include(FetchContent)

FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG        v1.14.0
)
FetchContent_MakeAvailable(googletest)

add_executable(tests test_main.cpp)
target_link_libraries(tests PRIVATE GTest::gtest_main)
```

### pkg-config

```cmake
find_package(PkgConfig REQUIRED)
pkg_check_modules(LIBSYSTEMD REQUIRED libsystemd)

target_include_directories(myapp PRIVATE ${LIBSYSTEMD_INCLUDE_DIRS})
target_link_libraries(myapp PRIVATE ${LIBSYSTEMD_LIBRARIES})
```

---

## Build Types and Compiler Flags
{:.gc-mid}

```cmake
# Set default build type
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE "Debug" CACHE STRING "" FORCE)
endif()

# Common build types:
# Debug        → -g -O0
# Release      → -O3 -DNDEBUG
# RelWithDebInfo → -O2 -g -DNDEBUG
# MinSizeRel   → -Os -DNDEBUG

# Custom flags per config
target_compile_options(myapp PRIVATE
    $<$<CONFIG:Debug>:-O0 -g3 -fsanitize=address,undefined>
    $<$<CONFIG:Release>:-O3 -march=native>
)
target_link_options(myapp PRIVATE
    $<$<CONFIG:Debug>:-fsanitize=address,undefined>
)
```

---

## Cross-Compilation Toolchain Files
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

```cmake
# toolchain-arm-linux.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)

set(CROSS_PREFIX arm-linux-gnueabihf-)
set(CMAKE_C_COMPILER   ${CROSS_PREFIX}gcc)
set(CMAKE_CXX_COMPILER ${CROSS_PREFIX}g++)
set(CMAKE_STRIP        ${CROSS_PREFIX}strip)

# Sysroot — where to find cross-compiled libraries
set(CMAKE_SYSROOT /opt/arm-sysroot)
set(CMAKE_FIND_ROOT_PATH ${CMAKE_SYSROOT})

# Only search in sysroot for headers and libs
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
```

```bash
# Configure with toolchain
cmake -B build-arm \
      -DCMAKE_TOOLCHAIN_FILE=toolchain-arm-linux.cmake \
      -DCMAKE_BUILD_TYPE=Release

cmake --build build-arm
```

---

## CTest — Testing
{:.gc-mid}

```cmake
# Enable testing
enable_testing()

add_executable(test_sensor tests/test_sensor.cpp)
target_link_libraries(test_sensor PRIVATE mylib GTest::gtest_main)

# Register with CTest
add_test(NAME SensorTests COMMAND test_sensor)

# Test with labels, timeout
add_test(NAME HardwareTests COMMAND test_hw)
set_tests_properties(HardwareTests PROPERTIES TIMEOUT 30 LABELS "hardware")
```

```bash
# Run tests
ctest --test-dir build
ctest --test-dir build -R "Sensor"   # filter by regex
ctest --test-dir build -V             # verbose output
ctest --test-dir build --parallel 4   # parallel execution
```

---

## Useful CMake Variables

| Variable | Description |
|----------|-------------|
| `CMAKE_SOURCE_DIR` | Top-level source directory |
| `CMAKE_BINARY_DIR` | Top-level build directory |
| `CMAKE_CURRENT_SOURCE_DIR` | Current CMakeLists.txt source dir |
| `CMAKE_CURRENT_BINARY_DIR` | Current CMakeLists.txt build dir |
| `CMAKE_BUILD_TYPE` | Debug / Release / RelWithDebInfo |
| `CMAKE_CXX_STANDARD` | 11, 14, 17, 20, 23 |
| `CMAKE_INSTALL_PREFIX` | Installation prefix (default `/usr/local`) |
| `BUILD_SHARED_LIBS` | Default library type (ON = shared) |
| `CMAKE_EXPORT_COMPILE_COMMANDS` | Generate `compile_commands.json` for IDEs |

```cmake
# Always generate compile_commands.json (for clangd, VS Code)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between CMake and Make?**

> CMake is a **build system generator** — it reads `CMakeLists.txt` and outputs native build files for Makefiles, Ninja, or IDE project files. Make is a **build system** that reads the generated Makefile and actually invokes the compiler. CMake adds platform independence (the same `CMakeLists.txt` works on Linux, macOS, Windows), dependency tracking between targets, and a higher-level API. You typically run `cmake` first, then `make` (or `ninja`) in the generated build directory.

**Q2 — Intermediate: What is the difference between `PRIVATE`, `PUBLIC`, and `INTERFACE` in `target_link_libraries` and `target_include_directories`?**

> These keywords control **transitive propagation** of properties. `PRIVATE` — used only when building the target itself (not propagated to consumers). `INTERFACE` — not used when building the target, but propagated to targets that link to it. `PUBLIC` — used both when building the target AND propagated to consumers. Example: a library's public header directory should be `PUBLIC` (consumers need it to include headers); implementation-only source directories should be `PRIVATE` (consumers don't need them).

**Q3 — Intermediate: How do you cross-compile with CMake?**

> Create a toolchain file (`.cmake`) that sets `CMAKE_SYSTEM_NAME` and `CMAKE_SYSTEM_PROCESSOR` to the target platform, sets `CMAKE_C_COMPILER`/`CMAKE_CXX_COMPILER` to the cross toolchain binaries, and sets `CMAKE_SYSROOT` to a directory with target libraries and headers. Pass it to CMake with `-DCMAKE_TOOLCHAIN_FILE=toolchain.cmake`. CMake will use the cross compiler and look for libraries in the sysroot, not the host system.

**Q4 — Advanced: What is `compile_commands.json` and why is it important?**

> `compile_commands.json` is a compilation database — a JSON file listing the exact compiler command used to build each source file (flags, include paths, defines). It is generated by CMake when `CMAKE_EXPORT_COMPILE_COMMANDS=ON`. Tools like `clangd` (LSP), `clang-tidy`, `cppcheck`, and IDE extensions use this file for accurate code analysis, auto-completion, and linting. Without it, these tools have to guess include paths and flags, leading to false positives and missing diagnostics.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| CMake Official Docs | [cmake.org/cmake/help/latest](https://cmake.org/cmake/help/latest/) |
| Modern CMake (free book) | [cliutils.gitlab.io/modern-cmake](https://cliutils.gitlab.io/modern-cmake/) |
| CMake Tutorial | [cmake.org/cmake/help/latest/guide/tutorial](https://cmake.org/cmake/help/latest/guide/tutorial/index.html) |
| C++ Core Guidelines Build | [isocpp.github.io/CppCoreGuidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) |
