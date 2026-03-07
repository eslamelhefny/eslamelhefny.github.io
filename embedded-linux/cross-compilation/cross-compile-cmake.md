---
layout: guide
title: "Cross-Compiling with CMake"
description: "Using CMake toolchain files for embedded cross-compilation: sysroot configuration, pkg-config integration, dependency management, and Yocto SDK integration."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 05"
phase: embedded-linux-cross
permalink: /embedded-linux/cross-compilation/cross-compile-cmake/
prev_topic:
  title: "readelf / objdump / nm"
  url: /embedded-linux/cross-compilation/binary-analysis/
next_topic:
  title: "Boot Sequence"
  url: /embedded-linux/uboot/boot-sequence/
---

## CMake Toolchain Files: The Basics
{:.gc-basic}
<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

CMake is a meta-build system that generates build files (Makefiles, Ninja files) from a high-level description. By default, CMake configures a build for the host machine — it finds the host's `gcc`, the host's `/usr/lib`, and generates code for the host architecture.

For cross-compilation, CMake needs to know:

1. Which compiler to use (the cross-compiler)
2. Which sysroot to search for headers and libraries (the target sysroot)
3. What the target system name and processor are

All of this is provided through a **toolchain file** — a CMake script you pass with `-DCMAKE_TOOLCHAIN_FILE=`.

### Minimal Toolchain File

```cmake
# toolchain-arm-linux.cmake

# Tell CMake the target OS and CPU
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)

# Specify the cross-compiler
set(CMAKE_C_COMPILER   arm-linux-gnueabihf-gcc)
set(CMAKE_CXX_COMPILER arm-linux-gnueabihf-g++)

# Specify the sysroot (where target headers and libraries live)
set(CMAKE_SYSROOT /opt/rpi4-sysroot)

# Search for libraries and headers only in the sysroot, not on the host
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
```

The four `CMAKE_FIND_ROOT_PATH_MODE_*` variables are critical — they control where CMake searches for programs, libraries, headers, and CMake packages:

| Setting | Description |
|---|---|
| `NEVER` | Never search in sysroot — always use host paths (used for build tools like code generators) |
| `ONLY` | Only search in sysroot — never use host paths (used for target libraries/headers) |
| `BOTH` | Search sysroot first, then host paths (fallback) |

### Simple Hello World Cross-Compiled with CMake

Project structure:

```
hello/
├── CMakeLists.txt
├── toolchain-arm-linux.cmake
└── src/
    └── main.c
```

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.16)
project(hello C)

add_executable(hello src/main.c)

install(TARGETS hello DESTINATION bin)
```

```bash
# Configure: out-of-source build for the ARM target
$ mkdir build-arm && cd build-arm

$ cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=../toolchain-arm-linux.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr

$ cmake --build . -- -j$(nproc)

$ file hello
```
```
hello: ELF 32-bit LSB pie executable, ARM, EABI5 version 1 (SYSV),
dynamically linked, interpreter /lib/ld-linux-armhf.so.3,
for GNU/Linux 3.2.0, not stripped
```

```bash
# Build for host (native) in a separate directory
$ mkdir build-host && cd build-host
$ cmake .. -DCMAKE_BUILD_TYPE=Release
$ cmake --build .

$ file hello
```
```
hello: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), ...
```

This shows the power of out-of-source builds: the same source tree produces both ARM and host binaries by using different build directories.

### CMAKE_FIND_ROOT_PATH Details

`CMAKE_FIND_ROOT_PATH` is a list of paths prepended to all `find_*` searches. When `CMAKE_SYSROOT` is set, CMake automatically adds it to `CMAKE_FIND_ROOT_PATH`. You can add additional paths:

```cmake
# toolchain-arm-linux.cmake
set(CMAKE_SYSROOT /opt/rpi4-sysroot)

# Additional search paths (e.g., a staging directory with extra libraries)
list(APPEND CMAKE_FIND_ROOT_PATH /opt/rpi4-staging)

set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
```

With `LIBRARY ONLY`, `find_library(SSL ssl)` will search:
- `/opt/rpi4-sysroot/lib/`
- `/opt/rpi4-sysroot/usr/lib/`
- `/opt/rpi4-sysroot/lib/arm-linux-gnueabihf/`
- `/opt/rpi4-staging/lib/`
- etc.

...but will **not** search `/usr/lib` (the host's library directory).

---

## Sysroot, Dependencies, and pkg-config Integration
{:.gc-mid}
<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### CMAKE_SYSROOT in the Toolchain File

Setting `CMAKE_SYSROOT` in the toolchain file has the same effect as passing `--sysroot` to every compiler invocation. CMake automatically adds the `--sysroot` flag:

```cmake
# toolchain-arm-linux.cmake
set(CMAKE_SYSROOT /opt/rpi4-sysroot)
```

Verify it was applied by checking the compile commands:

```bash
$ cmake .. -DCMAKE_TOOLCHAIN_FILE=../toolchain-arm-linux.cmake \
    -DCMAKE_EXPORT_COMPILE_COMMANDS=ON

$ cat build-arm/compile_commands.json | python3 -m json.tool | grep -A5 "command"
```
```json
{
  "command": "arm-linux-gnueabihf-gcc
    --sysroot=/opt/rpi4-sysroot
    -I/opt/rpi4-sysroot/usr/include
    -march=armv7-a -mfpu=vfpv3-d16 -mfloat-abi=hard
    -o CMakeFiles/hello.dir/src/main.c.o
    -c /home/user/hello/src/main.c",
  "file": "/home/user/hello/src/main.c"
}
```

### find_package for Cross-Compiled Dependencies

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.16)
project(tls_client C)

# Find OpenSSL in the sysroot
find_package(OpenSSL REQUIRED)

add_executable(tls_client src/tls_client.c)

target_link_libraries(tls_client PRIVATE
    OpenSSL::SSL
    OpenSSL::Crypto
)
```

```bash
$ cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=../toolchain-arm-linux.cmake \
    -DOPENSSL_ROOT_DIR=/opt/rpi4-sysroot/usr
```
```
-- Found OpenSSL: /opt/rpi4-sysroot/usr/lib/arm-linux-gnueabihf/libssl.so (found version "1.1.1n")
-- Configuring done
-- Build files have been written to: /home/user/tls_client/build-arm
```

If `find_package` cannot find the library automatically, provide the root directory hint:

```bash
$ cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=../toolchain-arm-linux.cmake \
    -DCMAKE_PREFIX_PATH=/opt/rpi4-sysroot/usr
```

### pkg-config Integration in CMake

CMake's `FindPkgConfig` module wraps `pkg-config`. For cross-compilation, you must point it to the correct pkg-config binary and search paths:

```cmake
# In toolchain file or CMakeLists.txt:
set(ENV{PKG_CONFIG_SYSROOT_DIR} ${CMAKE_SYSROOT})
set(ENV{PKG_CONFIG_LIBDIR}
    "${CMAKE_SYSROOT}/usr/lib/arm-linux-gnueabihf/pkgconfig:\
${CMAKE_SYSROOT}/usr/lib/pkgconfig:\
${CMAKE_SYSROOT}/usr/share/pkgconfig")

# Use the cross pkg-config if available
find_program(PKG_CONFIG_EXECUTABLE
    NAMES arm-linux-gnueabihf-pkg-config pkg-config
    PATHS /usr/bin
    NO_DEFAULT_PATH
)
```

In `CMakeLists.txt`:

```cmake
cmake_minimum_required(VERSION 3.16)
project(myapp C)

find_package(PkgConfig REQUIRED)

# Find gpiod via pkg-config
pkg_check_modules(GPIOD REQUIRED libgpiod)

add_executable(myapp src/main.c)

target_include_directories(myapp PRIVATE ${GPIOD_INCLUDE_DIRS})
target_link_libraries(myapp PRIVATE ${GPIOD_LIBRARIES})
target_compile_options(myapp PRIVATE ${GPIOD_CFLAGS_OTHER})
```

```bash
$ cmake .. -DCMAKE_TOOLCHAIN_FILE=../toolchain-arm-linux.cmake
```
```
-- Found PkgConfig: /usr/bin/pkg-config (found version "0.29.2")
-- Checking for module 'libgpiod'
--   Found libgpiod, version 1.6.3
-- Configuring done
```

### Building and Cross-Compiling a Project With libcurl

Complete example with external library dependency:

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.16)
project(http_client C)

set(CMAKE_C_STANDARD 11)

find_package(CURL REQUIRED)

add_executable(http_client
    src/main.c
    src/request.c
)

target_link_libraries(http_client PRIVATE CURL::libcurl)

install(TARGETS http_client
    RUNTIME DESTINATION bin
)
```

```cmake
# toolchain-arm-linux.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(CMAKE_C_COMPILER   arm-linux-gnueabihf-gcc)
set(CMAKE_CXX_COMPILER arm-linux-gnueabihf-g++)
set(CMAKE_SYSROOT      /opt/rpi4-sysroot)

# Extra compiler flags for Cortex-A72 (RPi 4 uses A72, but 32-bit mode)
set(CMAKE_C_FLAGS_INIT   "-march=armv7-a -mfpu=vfpv4 -mfloat-abi=hard")
set(CMAKE_CXX_FLAGS_INIT "-march=armv7-a -mfpu=vfpv4 -mfloat-abi=hard")

set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
```

```bash
$ mkdir build-arm && cd build-arm
$ cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=../toolchain-arm-linux.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr

$ cmake --build . -j$(nproc)
```
```
[ 33%] Building C object CMakeFiles/http_client.dir/src/main.c.o
[ 66%] Building C object CMakeFiles/http_client.dir/src/request.c.o
[100%] Linking C executable http_client
```

```bash
$ cmake --install . --prefix /opt/rpi4-staging
```
```
-- Install configuration: "Release"
-- Installing: /opt/rpi4-staging/bin/http_client
```

### ExternalProject_Add for Cross-Compiling a Dependency

When a dependency is not available in the sysroot, build it from source using `ExternalProject_Add`:

```cmake
include(ExternalProject)

ExternalProject_Add(
    libfoo_external
    URL         https://example.com/libfoo-1.2.tar.gz
    URL_HASH    SHA256=abc123...
    CMAKE_ARGS
        -DCMAKE_TOOLCHAIN_FILE=${CMAKE_TOOLCHAIN_FILE}
        -DCMAKE_INSTALL_PREFIX=${CMAKE_SYSROOT}/usr
        -DCMAKE_BUILD_TYPE=Release
        -DBUILD_SHARED_LIBS=ON
    BUILD_ALWAYS OFF
)

# Make our target depend on the external project being built first
add_dependencies(myapp libfoo_external)
```

---

## Advanced CMake: Qt Cross-Compilation, Presets, and Yocto Integration
{:.gc-adv}
<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Cross-Compiling Qt5 for Embedded Linux

Qt cross-compilation requires configuring Qt with device-specific settings:

```bash
# Step 1: Prepare the sysroot with Qt dependencies
$ rsync -avz pi@192.168.1.100:/usr/include/arm-linux-gnueabihf /opt/rpi-sysroot/usr/include/
$ rsync -avz pi@192.168.1.100:/usr/lib/arm-linux-gnueabihf    /opt/rpi-sysroot/usr/lib/

# Step 2: Configure Qt for cross-compilation
$ cd qt5-src
$ ./configure \
    -release \
    -opengl es2 \
    -device linux-rasp-pi4-v3d-g++ \
    -device-option CROSS_COMPILE=arm-linux-gnueabihf- \
    -sysroot /opt/rpi-sysroot \
    -prefix /usr/local/qt5 \
    -extprefix /opt/qt5-arm \
    -hostprefix /opt/qt5-host \
    -no-use-gold-linker \
    -v

$ make -j$(nproc)
$ make install
```

In a CMake project that uses cross-compiled Qt:

```cmake
# toolchain-arm-qt.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(CMAKE_C_COMPILER   arm-linux-gnueabihf-gcc)
set(CMAKE_CXX_COMPILER arm-linux-gnueabihf-g++)
set(CMAKE_SYSROOT      /opt/rpi-sysroot)

# Point CMake to the cross-compiled Qt installation
set(CMAKE_PREFIX_PATH  /opt/qt5-arm)

# Point to host Qt tools (moc, uic, rcc run on the build machine)
set(QT_HOST_PATH       /opt/qt5-host)

set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
```

```cmake
# CMakeLists.txt for a Qt project
cmake_minimum_required(VERSION 3.16)
project(myqtapp CXX)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt5 REQUIRED COMPONENTS Core Widgets Quick)

add_executable(myqtapp
    main.cpp
    mainwindow.cpp
    mainwindow.h
    resources.qrc
)

target_link_libraries(myqtapp PRIVATE
    Qt5::Core Qt5::Widgets Qt5::Quick
)
```

```bash
$ cmake .. -DCMAKE_TOOLCHAIN_FILE=../toolchain-arm-qt.cmake
$ cmake --build . -j$(nproc)
```

### Generating compile_commands.json for Cross-Compile IDE Support

`compile_commands.json` is a compilation database that enables `clangd`, VS Code IntelliSense, and other tools to understand your cross-compiled project:

```bash
$ cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=../toolchain-arm-linux.cmake \
    -DCMAKE_EXPORT_COMPILE_COMMANDS=ON

$ ls build-arm/
```
```
CMakeCache.txt  CMakeFiles/  compile_commands.json  Makefile
```

```bash
# Symlink to project root so editors/clangd find it
$ ln -s build-arm/compile_commands.json compile_commands.json
```

The `compile_commands.json` contains the exact compiler invocations including all flags, include paths, and defines — allowing clangd to provide accurate cross-platform code completion and error checking.

Configure clangd to use the cross-compiler's headers by adding `.clangd` to your project root:

```yaml
# .clangd
CompileFlags:
  Add:
    - --sysroot=/opt/rpi4-sysroot
    - --target=arm-linux-gnueabihf
```

### Multi-Stage Builds: Host Tools + Target Code

Some projects need to build code generation tools natively (to run on the host) and the actual application code for the target. CMake handles this with separate configure stages:

```cmake
# Top-level CMakeLists.txt
cmake_minimum_required(VERSION 3.16)
project(embedded_app)

# Check if we're doing a host build or cross build
if(CMAKE_CROSSCOMPILING)
    # Cross-compilation: build the target application
    add_subdirectory(src)
    add_subdirectory(target_libs)
else()
    # Native build: build host tools only
    add_subdirectory(tools)
endif()
```

Build script:

```bash
#!/bin/bash
# build.sh

# Step 1: Build native host tools
mkdir -p build-host && cd build-host
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . -- -j$(nproc)
cd ..

# Step 2: Cross-compile target application
# Host tools are now in build-host/tools/
mkdir -p build-arm && cd build-arm
cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=../toolchain-arm-linux.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DHOST_TOOLS_DIR=$(realpath ../build-host/tools)
cmake --build . -- -j$(nproc)
```

### CMake Preset Files

CMake 3.19+ supports preset files for managing multiple build configurations:

```json
{
  "version": 3,
  "configurePresets": [
    {
      "name": "host-debug",
      "displayName": "Host Debug Build",
      "generator": "Ninja",
      "binaryDir": "${sourceDir}/build-host-debug",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Debug"
      }
    },
    {
      "name": "arm-release",
      "displayName": "ARM Release Build",
      "generator": "Ninja",
      "binaryDir": "${sourceDir}/build-arm-release",
      "toolchainFile": "${sourceDir}/cmake/toolchain-arm-linux.cmake",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Release",
        "CMAKE_INSTALL_PREFIX": "/usr"
      }
    },
    {
      "name": "aarch64-release",
      "displayName": "AArch64 Release Build",
      "generator": "Ninja",
      "binaryDir": "${sourceDir}/build-aarch64-release",
      "toolchainFile": "${sourceDir}/cmake/toolchain-aarch64-linux.cmake",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Release"
      }
    }
  ],
  "buildPresets": [
    {
      "name": "arm-release",
      "configurePreset": "arm-release",
      "jobs": 8
    }
  ]
}
```

```bash
# List available presets
$ cmake --list-presets
```
```
Available configure presets:

  "host-debug"       - Host Debug Build
  "arm-release"      - ARM Release Build
  "aarch64-release"  - AArch64 Release Build
```

```bash
# Configure and build using the ARM preset
$ cmake --preset arm-release
$ cmake --build --preset arm-release
```

### Yocto SDK Integration

When using a Yocto-built SDK, the SDK ships an environment setup script that configures all cross-compilation variables. You can generate a CMake toolchain file from it:

```bash
# Install the SDK (creates /opt/poky/5.0/)
$ ./poky-glibc-x86_64-core-image-minimal-cortexa9t2hf-neon-toolchain-5.0.sh
```
```
Poky (Yocto Project Reference Distro) SDK installer version 5.0
================================================================
Enter target directory for SDK (default: /opt/poky/5.0):
Extracting SDK...............done
Setting it up...done
SDK has been successfully set up and is ready to be used.
```

```bash
# Source the environment script
$ source /opt/poky/5.0/environment-setup-cortexa9t2hf-neon-poky-linux-gnueabi

# Verify the environment is set
$ echo $CC
arm-poky-linux-gnueabi-gcc  -march=armv7-a -mthumb -mfpu=neon -mfloat-abi=hard --sysroot=/opt/poky/5.0/sysroots/cortexa9t2hf-neon-poky-linux-gnueabi
$ echo $SDKTARGETSYSROOT
/opt/poky/5.0/sysroots/cortexa9t2hf-neon-poky-linux-gnueabi
```

Generate a CMake toolchain file from the SDK environment:

```bash
# Generate toolchain file from Yocto environment variables
cat > yocto-sdk-toolchain.cmake << EOF
# Auto-generated from Yocto SDK environment
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)

set(SDK_SYSROOT "$ENV{SDKTARGETSYSROOT}")

set(CMAKE_C_COMPILER   "$ENV{CC}")
set(CMAKE_CXX_COMPILER "$ENV{CXX}")
set(CMAKE_LINKER       "$ENV{LD}")
set(CMAKE_AR           "$ENV{AR}")
set(CMAKE_RANLIB       "$ENV{RANLIB}")
set(CMAKE_STRIP        "$ENV{STRIP}")

set(CMAKE_SYSROOT ${SDK_SYSROOT})
set(CMAKE_FIND_ROOT_PATH ${SDK_SYSROOT})

set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)

# pkg-config for cross-compilation
set(ENV{PKG_CONFIG_SYSROOT_DIR} ${SDK_SYSROOT})
set(ENV{PKG_CONFIG_LIBDIR}
    "${SDK_SYSROOT}/usr/lib/pkgconfig:${SDK_SYSROOT}/usr/share/pkgconfig")
EOF
```

```bash
$ cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=./yocto-sdk-toolchain.cmake \
    -DCMAKE_BUILD_TYPE=Release

$ cmake --build . -j$(nproc)

$ file myapp
```
```
myapp: ELF 32-bit LSB pie executable, ARM, EABI5 version 1 (SYSV),
dynamically linked, interpreter /lib/ld-linux-gnueabi.so.3,
for GNU/Linux 3.2.0, not stripped
```

### Testing Cross-Compiled Binaries with QEMU via ctest

```cmake
# CMakeLists.txt
enable_testing()

# Find qemu-arm for test execution
find_program(QEMU_ARM qemu-arm)

add_test(
    NAME run_unit_tests
    COMMAND ${QEMU_ARM}
        -L /opt/rpi4-sysroot
        $<TARGET_FILE:myapp_tests>
        --gtest_output=xml:test_results.xml
)

set_tests_properties(run_unit_tests PROPERTIES
    TIMEOUT 30
    ENVIRONMENT "QEMU_LD_PREFIX=/opt/rpi4-sysroot"
)
```

```bash
$ ctest --test-dir build-arm -V
```
```
UpdateCTestConfiguration  from :/home/user/project/build-arm/DartConfiguration.tcl
Test project /home/user/project/build-arm
    Start 1: run_unit_tests
1/1 Test #1: run_unit_tests .....................   Passed    0.84 sec

100% tests passed, 0 tests failed out of 1

Total Test time (real) =   0.85 sec
```

This enables CI pipelines to run ARM unit tests without physical hardware by using QEMU user-mode emulation.

---

## Interview Questions
{:.gc-iq}
<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&A</span>

**Q: What is a CMake toolchain file and what must it contain?**

A CMake toolchain file is a CMake script passed to cmake with `-DCMAKE_TOOLCHAIN_FILE=path/to/toolchain.cmake`. CMake reads it before configuring the project, using it to configure the cross-compilation environment. At minimum it must contain: `CMAKE_SYSTEM_NAME` (e.g., `Linux`) to tell CMake the target OS, `CMAKE_SYSTEM_PROCESSOR` (e.g., `arm`) to set the target CPU, `CMAKE_C_COMPILER` pointing to the cross-compiler (e.g., `arm-linux-gnueabihf-gcc`), and the four `CMAKE_FIND_ROOT_PATH_MODE_*` variables to control where CMake searches for libraries, headers, and programs. `CMAKE_SYSROOT` is also strongly recommended to direct all library and header searches to the target sysroot instead of the host filesystem. Without proper `FIND_ROOT_PATH_MODE` settings, CMake may find the host's x86-64 libraries instead of the target's ARM libraries.

**Q: How do you tell CMake to search for libraries in the sysroot instead of the host?**

Set `CMAKE_SYSROOT` to the sysroot path in the toolchain file — this adds the sysroot to `CMAKE_FIND_ROOT_PATH` and passes `--sysroot` to every compiler invocation. Then set `CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY` (and similarly for `INCLUDE` and `PACKAGE`) to restrict library searches to the sysroot. With `ONLY`, `find_library(SSL ssl)` will only search paths within the sysroot like `/sysroot/usr/lib` and `/sysroot/lib`, never the host's `/usr/lib`. Additionally, set `CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER` so that build tools like code generators run from the host PATH, not the sysroot.

**Q: What does CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY mean?**

It means that all `find_library()` calls will **only** search within paths that are prefixed by `CMAKE_FIND_ROOT_PATH` (which includes the sysroot). The host system library paths (`/usr/lib`, `/lib`, etc.) are **never** searched. This is the correct setting for cross-compilation because you want to link against the target architecture's libraries (ARM), not the host's libraries (x86-64). If this were set to `BOTH`, CMake would search the sysroot first and fall back to host paths — which could accidentally find an x86-64 library if the ARM version is not in the sysroot, causing a silent ABI mismatch that produces a broken binary.

**Q: How do you cross-compile a project that uses pkg-config dependencies?**

Set three environment variables in the toolchain file or before running cmake: `PKG_CONFIG_SYSROOT_DIR` to the sysroot path (pkg-config prepends this to all paths it returns), `PKG_CONFIG_LIBDIR` to a colon-separated list of directories inside the sysroot where `.pc` files are located (e.g., `${SYSROOT}/usr/lib/arm-linux-gnueabihf/pkgconfig:${SYSROOT}/usr/share/pkgconfig`), and unset `PKG_CONFIG_PATH` to prevent host paths from bleeding in. In `CMakeLists.txt`, use `find_package(PkgConfig)` then `pkg_check_modules(LIBNAME REQUIRED libname)`. Apply the results with `target_include_directories(myapp PRIVATE ${LIBNAME_INCLUDE_DIRS})` and `target_link_libraries(myapp PRIVATE ${LIBNAME_LIBRARIES})`. The `PKG_CONFIG_SYSROOT_DIR` variable ensures that paths returned by pkg-config (e.g., `-I/usr/include`) are automatically prefixed with the sysroot.

**Q: How do you integrate a Yocto SDK with a CMake project?**

First source the SDK's environment-setup script: `source /opt/poky/VERSION/environment-setup-MACHINE-...-linux`. This sets environment variables including `CC`, `CXX`, `LD`, `SDKTARGETSYSROOT`, `PKG_CONFIG_SYSROOT_DIR`, etc. Then either: (1) use the `cmake` wrapper the SDK provides — it automatically injects the toolchain settings, or (2) write a CMake toolchain file that reads these environment variables using `$ENV{CC}`, `$ENV{SDKTARGETSYSROOT}`, etc. The generated toolchain file sets `CMAKE_C_COMPILER`, `CMAKE_SYSROOT`, `CMAKE_FIND_ROOT_PATH`, and pkg-config variables from the SDK environment. Run cmake with this toolchain file to produce ARM binaries that are compatible with the Yocto-built rootfs — same glibc version, same library versions, same kernel headers.

---

## References
{:.gc-ref}
<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

- **CMake Cross-Compilation Documentation** — official CMake reference for toolchain files and cross-compilation (https://cmake.org/cmake/help/latest/manual/cmake-toolchains.7.html)
- **"Professional CMake: A Practical Guide"** — Craig Scott — comprehensive coverage of CMake including cross-compilation patterns
- **Yocto Project: Using the SDK with CMake** — official guide for integrating Yocto SDK with CMake projects (https://docs.yoctoproject.org/sdk-manual/index.html)
- **Qt Cross-Compilation Guide for Embedded Linux** — official Qt documentation for embedded target builds (https://doc.qt.io/qt-6/configure-linux-device.html)
- **CMake Presets Documentation** — reference for CMakePresets.json format (https://cmake.org/cmake/help/latest/manual/cmake-presets.7.html)
- **"Mastering Embedded Linux Programming"** — Chris Simmonds — covers the full build system context in which CMake is used for embedded targets
