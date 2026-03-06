---
layout: post
title: "Embedded Linux Diploma — Lab 01: Setting Up the Build Environment"
date: 2024-01-15
category: embedded
tags: [yocto, buildroot, linux, lab]
excerpt: "First lab in the Embedded Linux Diploma series. Setting up cross-compilation toolchain, Yocto Project, and Buildroot from scratch on Ubuntu."
---

## Overview

This is the first lab in the **Embedded Linux Diploma** series. We'll set up a complete embedded Linux development environment including a cross-compilation toolchain, Yocto Project, and Buildroot.

**Prerequisites:** Ubuntu 22.04 LTS, 50GB free disk space, 8GB RAM minimum.

---

## 1. Installing Dependencies

```bash
sudo apt-get update
sudo apt-get install -y \
    gawk wget git diffstat unzip texinfo \
    gcc build-essential chrpath socat cpio \
    python3 python3-pip python3-pexpect \
    xz-utils debianutils iputils-ping python3-git \
    python3-jinja2 libegl1-mesa libsdl1.2-dev \
    pylint xterm python3-subunit mesa-common-dev \
    zstd liblz4-tool
```

## 2. Cross-Compilation Toolchain

A cross-compiler generates code for a **target architecture** different from the **host machine**.

```bash
# Download ARM cross-compiler
wget https://developer.arm.com/-/media/Files/downloads/gnu/12.3.rel1/binrel/\
arm-gnu-toolchain-12.3.rel1-x86_64-arm-none-linux-gnueabihf.tar.xz

# Extract
tar -xf arm-gnu-toolchain-12.3.rel1-x86_64-arm-none-linux-gnueabihf.tar.xz

# Add to PATH
export PATH=$PATH:$HOME/toolchain/bin

# Verify
arm-none-linux-gnueabihf-gcc --version
```

## 3. Buildroot Setup

Buildroot is a simple, efficient build system for generating embedded Linux systems.

```bash
# Clone Buildroot
git clone https://github.com/buildroot/buildroot.git
cd buildroot

# Configure for Raspberry Pi 4
make raspberrypi4_64_defconfig

# Launch menuconfig for customization
make menuconfig
```

### Key Buildroot Concepts

| Component | Description |
|-----------|-------------|
| `toolchain/` | Cross-compiler configuration |
| `package/` | Software packages |
| `board/` | Board-specific files |
| `configs/` | Default configurations |
| `output/` | Build artifacts |

## 4. Yocto Project Setup

Yocto is a more powerful (and complex) build framework used in production embedded Linux.

```bash
# Clone Yocto Poky
git clone -b kirkstone https://git.yoctoproject.org/poky
cd poky

# Initialize build environment
source oe-init-build-env build

# Edit local.conf
nano conf/local.conf
```

Add to `local.conf`:
```
MACHINE = "qemux86-64"
DISTRO = "poky"
PACKAGE_CLASSES = "package_rpm"
BB_NUMBER_THREADS = "4"
PARALLEL_MAKE = "-j4"
```

### Build your first image

```bash
# Build minimal image
bitbake core-image-minimal

# Run in QEMU
runqemu qemux86-64 nographic
```

## 5. Hello World on Target

```c
/* hello.c */
#include <stdio.h>

int main(void) {
    printf("Hello from Embedded Linux!\n");
    return 0;
}
```

Cross-compile:
```bash
arm-none-linux-gnueabihf-gcc -o hello hello.c
file hello  # Should show: ELF 32-bit LSB executable, ARM
```

## Lab Exercises

1. Build a Buildroot image for `qemu_arm_vexpress` and boot it with QEMU
2. Add `busybox-extras` package to your Buildroot config
3. In Yocto, create a custom layer with a "hello world" recipe
4. Compare the output image sizes between minimal Buildroot and Yocto builds

---

> 💡 **Tip:** Always use `screen` or `tmux` for long Yocto builds. A full `core-image-minimal` build can take 1-4 hours on first run.

## Next Lab

In **Lab 02**, we'll dive into the **Linux boot process** — from power-on to userspace — covering bootloader (U-Boot), kernel initialization, and init systems.
