---
layout: guide
title: "QEMU Emulation"
description: "Using QEMU for embedded Linux development: system emulation, user-mode emulation, networking, rootfs creation, and GDB remote debugging without physical hardware."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 05"
phase: embedded-linux-cross
permalink: /embedded-linux/cross-compilation/qemu-emulation/
prev_topic:
  title: "Static vs Dynamic Linking"
  url: /embedded-linux/cross-compilation/static-dynamic-linking/
next_topic:
  title: "readelf / objdump / nm"
  url: /embedded-linux/cross-compilation/binary-analysis/
---

## QEMU Basics: System vs User-Mode Emulation
{:.gc-basic}
<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

**QEMU** (Quick EMUlator) is an open-source machine emulator and virtualizer. For embedded Linux development it provides two distinct operating modes:

| Mode | What It Emulates | Use Case |
|---|---|---|
| **System Emulation** (`qemu-system-arm`) | Full machine: CPU, RAM, peripherals, boot ROM | Boot an entire ARM Linux kernel + rootfs without hardware |
| **User-Mode Emulation** (`qemu-arm`) | CPU instruction set only; uses host kernel syscalls | Run a single ARM binary on an x86 host for quick testing |

### Installing QEMU

```bash
# Ubuntu/Debian: install both system and user-mode QEMU for ARM
$ sudo apt update
$ sudo apt install \
    qemu-system-arm \
    qemu-user \
    qemu-user-static \
    binfmt-support

$ qemu-system-arm --version
```
```
QEMU emulator version 8.2.0 (Debian 1:8.2.0+ds-1)
Copyright (c) 2003-2023 Fabrice Bellard and the QEMU Project developers
```

```bash
$ qemu-arm --version
```
```
qemu-arm version 8.2.0 (Debian 1:8.2.0+ds-1)
Copyright (c) 2003-2023 Fabrice Bellard and the QEMU Project developers
```

### QEMU User-Mode: Running a Single ARM Binary

User-mode QEMU translates ARM instructions to the host CPU but forwards all system calls to the host Linux kernel. This means you can run a cross-compiled ARM binary directly on your x86 host:

```bash
# Cross-compile a static ARM binary
$ arm-linux-gnueabihf-gcc -static -o hello_arm hello.c

# Run it directly on x86 with QEMU user-mode
$ qemu-arm ./hello_arm
```
```
Hello from ARM!
```

For dynamically-linked binaries, tell QEMU where the ARM C library is:

```bash
$ arm-linux-gnueabihf-gcc -o hello_dyn hello.c

$ qemu-arm -L /usr/arm-linux-gnueabihf ./hello_dyn
```
```
Hello from ARM!
```

The `-L` flag sets the sysroot that QEMU uses to find the ARM dynamic linker and libraries.

### QEMU System Emulation: Full ARM Machine

System emulation boots a real ARM Linux kernel and runs a complete operating system:

```bash
# List available ARM machine types
$ qemu-system-arm -M help | head -20
```
```
Supported machines are:
akita                Sharp SL-C1000 (Akita) PDA (PXA270)
ast2500-evb          Aspeed AST2500 EVB (ARM1176)
ast2600-evb          Aspeed AST2600 EVB (Cortex-A7)
borzoi               Sharp SL-C3100 (Borzoi) PDA (PXA270)
canon-a1100          Canon PowerShot A1100 IS
cubieboard           cubietech cubieboard (Cortex-A8)
lm3s6965evb          Stellaris LM3S6965EVB (Cortex-M3)
netduino2            Netduino Plus 2 (Cortex-M4)
none                 empty machine
orangepi-pc          Orange Pi PC (Cortex-A7)
raspi2b              Raspberry Pi 2B (revision 1.1)
realview-eb          ARM RealView Emulation Baseboard (ARM926EJ-S)
vexpress-a9          ARM Versatile Express for Cortex-A9
virt                 QEMU 8.2 ARM Virtual Machine (alias of virt-8.2)
```

```bash
# Run a prebuilt ARM Linux on the 'virt' machine
$ qemu-system-arm \
    -M virt \
    -cpu cortex-a15 \
    -m 512M \
    -kernel zImage \
    -dtb vexpress-v2p-ca9.dtb \
    -initrd rootfs.cpio.gz \
    -append "console=ttyAMA0 root=/dev/ram0" \
    -nographic
```
```
[    0.000000] Booting Linux on physical CPU 0x0
[    0.000000] Linux version 6.1.38 (gcc version 11.4.0)
[    0.000000] CPU: ARMv7 Processor [412fc090] revision 0 (ARMv7), cr=10c5387d
[    0.000000] Machine: QEMU ARM Virtual Machine
[    0.000000] Memory: 512MB
...
[    1.234567] EXT4-fs (mmcblk0p2): mounted filesystem with ordered data mode
[    1.456789] VFS: Mounted root (ext4 filesystem) on device 179:2.
[    2.123456] systemd[1]: System is operational.
Welcome to ARM Linux!
#
```

### Essential QEMU Command-Line Flags

| Flag | Description |
|---|---|
| `-M virt` | Machine type |
| `-cpu cortex-a15` | CPU model to emulate |
| `-m 512M` | Amount of RAM |
| `-kernel zImage` | Linux kernel image file |
| `-dtb foo.dtb` | Device tree blob |
| `-initrd rootfs.cpio.gz` | Initial RAM disk |
| `-append "..."` | Kernel command line arguments |
| `-nographic` | Disable graphical output, use serial console |
| `-serial stdio` | Connect serial port 0 to stdin/stdout |
| `-drive file=disk.img,format=raw` | Attach a disk image |
| `-snapshot` | Write to temporary overlay; don't modify disk image |

---

## Networking, Filesystem Sharing, and Custom Rootfs
{:.gc-mid}
<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Networking in QEMU

QEMU offers several networking backends:

**User-mode networking (simplest)** — no host configuration needed, provides NAT:

```bash
$ qemu-system-arm \
    -M virt -cpu cortex-a15 -m 256M \
    -kernel zImage -append "console=ttyAMA0" \
    -nographic \
    -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::8080-:80 \
    -device virtio-net-device,netdev=net0
```

The `hostfwd` option forwards host port 2222 → guest port 22 (SSH) and host 8080 → guest 80 (HTTP). From the host:

```bash
# SSH into the QEMU guest
$ ssh -p 2222 root@localhost
```
```
root@arm-virt:~#
```

**TAP/TUN networking** — gives the guest a real network interface visible on the host network (requires root/sudo to set up):

```bash
# Host setup (run once)
$ sudo ip tuntap add tap0 mode tap
$ sudo ip addr add 192.168.100.1/24 dev tap0
$ sudo ip link set tap0 up

# QEMU with TAP networking
$ qemu-system-arm \
    -M virt -cpu cortex-a15 -m 256M \
    -kernel zImage -nographic \
    -netdev tap,id=net0,ifname=tap0,script=no,downscript=no \
    -device virtio-net-device,netdev=net0 \
    -append "console=ttyAMA0 ip=192.168.100.2::192.168.100.1:255.255.255.0"
```

```bash
# Host can now ping the guest
$ ping 192.168.100.2
```
```
PING 192.168.100.2 (192.168.100.2) 56(84) bytes of data.
64 bytes from 192.168.100.2: icmp_seq=1 ttl=64 time=0.487 ms
```

### Mounting a Host Directory in the Guest (9P/VirtFS)

Share a host directory with the guest using the 9P filesystem protocol:

```bash
$ qemu-system-arm \
    -M virt -cpu cortex-a15 -m 256M \
    -kernel zImage -nographic \
    -append "console=ttyAMA0 root=/dev/vda rootfstype=ext4" \
    -drive file=rootfs.ext4,format=raw,id=hd0 \
    -device virtio-blk-device,drive=hd0 \
    -virtfs local,path=/home/user/shared,mount_tag=hostshare,security_model=mapped \
    -netdev user,id=net0 -device virtio-net-device,netdev=net0
```

Inside the guest:

```bash
# Mount the host-shared directory
$ mkdir -p /mnt/host
$ mount -t 9p -o trans=virtio,version=9p2000.L hostshare /mnt/host

$ ls /mnt/host
```
```
myapp    config.json    test-data/
```

This is very useful for rapidly iterating: compile on the host, find the new binary immediately in the guest without SCP or rebuilding the rootfs image.

### Running Your Cross-Compiled Kernel in QEMU

A complete workflow to run your own kernel:

```bash
# Step 1: Configure kernel for QEMU virt machine
$ export ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf-
$ make virt_defconfig
$ make -j$(nproc)

# Output: arch/arm/boot/zImage

# Step 2: Build a minimal rootfs with BusyBox
$ make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- defconfig
$ make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- CONFIG_STATIC=y -j$(nproc)
$ make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- \
    CONFIG_PREFIX=/opt/rootfs install

# Step 3: Create initramfs
$ cd /opt/rootfs
$ find . | cpio -H newc -o | gzip > /tmp/initramfs.cpio.gz

# Step 4: Boot
$ qemu-system-arm \
    -M virt \
    -cpu cortex-a15 \
    -m 256M \
    -kernel arch/arm/boot/zImage \
    -initrd /tmp/initramfs.cpio.gz \
    -append "console=ttyAMA0 rdinit=/sbin/init" \
    -nographic
```
```
[    0.000000] Booting Linux on physical CPU 0x0
[    0.000000] Linux version 6.6.21
[    0.000000] Machine: QEMU ARM Virtual Machine
...
[    1.025000] Freeing unused kernel image memory: 1024K
Please press Enter to activate this console.

/ # uname -a
Linux qemu-arm 6.6.21 #1 SMP Thu Mar 7 10:00:00 UTC 2024 armv7l GNU/Linux
/ #
```

### Disk Images and Snapshots

```bash
# Create a blank disk image
$ qemu-img create -f raw rootfs.img 512M

# Format it as ext4 (requires loop device)
$ sudo losetup /dev/loop0 rootfs.img
$ sudo mkfs.ext4 /dev/loop0
$ sudo losetup -d /dev/loop0

# Use snapshot mode (changes are discarded on exit)
$ qemu-system-arm \
    -M virt -cpu cortex-a15 -m 256M \
    -kernel zImage -nographic \
    -drive file=rootfs.img,format=raw,snapshot=on \
    -append "console=ttyAMA0 root=/dev/vda"

# Create a qcow2 overlay (non-destructive testing)
$ qemu-img create -f qcow2 -b rootfs.img -F raw overlay.qcow2
$ qemu-system-arm ... -drive file=overlay.qcow2,format=qcow2
```

---

## Advanced QEMU: Board Emulation, GDB Debugging, and KVM
{:.gc-adv}
<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Emulating Specific Boards

**Vexpress-A9 (Cortex-A9)** — widely used in embedded training:

```bash
$ qemu-system-arm \
    -M vexpress-a9 \
    -cpu cortex-a9 \
    -m 512M \
    -kernel zImage \
    -dtb vexpress-v2p-ca9.dtb \
    -drive file=rootfs.ext4,format=raw,id=mmcblk0 \
    -device virtio-blk-device,drive=mmcblk0 \
    -append "console=ttyAMA0,115200 root=/dev/mmcblk0 rootfstype=ext4 rw" \
    -nographic \
    -net nic -net user,hostfwd=tcp::2222-:22
```

**Raspberry Pi 2** (limited peripheral support):

```bash
$ qemu-system-arm \
    -M raspi2b \
    -cpu cortex-a7 \
    -m 1G \
    -kernel kernel7.img \
    -dtb bcm2709-rpi-2-b.dtb \
    -sd raspios.img \
    -append "console=ttyAMA0,115200 root=/dev/mmcblk0p2 rootfstype=ext4 rw" \
    -nographic
```

### Creating a Minimal Ext2 Rootfs Image for QEMU

```bash
# Create a 64 MB ext2 image
$ dd if=/dev/zero of=rootfs.ext2 bs=1M count=64
$ mkfs.ext2 rootfs.ext2
$ mkdir /tmp/mnt
$ sudo mount rootfs.ext2 /tmp/mnt

# Populate with BusyBox
$ sudo cp -a /opt/busybox-rootfs/* /tmp/mnt/

# Create essential device nodes
$ sudo mknod /tmp/mnt/dev/null    c 1 3
$ sudo mknod /tmp/mnt/dev/console c 5 1
$ sudo mknod /tmp/mnt/dev/ttyAMA0 c 204 64

# Create /etc/inittab for BusyBox init
$ sudo tee /tmp/mnt/etc/inittab << 'EOF'
::sysinit:/etc/init.d/rcS
::askfirst:/bin/sh
::ctrlaltdel:/sbin/reboot
::shutdown:/sbin/swapoff -a
::shutdown:/bin/umount -a -r
::restart:/sbin/init
ttyAMA0::respawn:/sbin/getty 115200 ttyAMA0
EOF

$ sudo umount /tmp/mnt

# Boot the image
$ qemu-system-arm \
    -M virt -cpu cortex-a15 -m 256M \
    -kernel zImage -nographic \
    -drive file=rootfs.ext2,format=raw,id=hda \
    -device virtio-blk-device,drive=hda \
    -append "console=ttyAMA0 root=/dev/vda rootfstype=ext2 rw"
```

### GDB Remote Debugging with QEMU

QEMU's `-s` and `-S` flags enable GDB remote debugging:

```bash
# -s: open a GDB server on port 1234
# -S: freeze CPU at startup, wait for GDB to connect
$ qemu-system-arm \
    -M virt -cpu cortex-a15 -m 256M \
    -kernel zImage \
    -initrd initramfs.cpio.gz \
    -append "console=ttyAMA0" \
    -nographic \
    -s -S &

# In a separate terminal, connect with arm GDB
$ arm-linux-gnueabihf-gdb vmlinux
```
```
GNU gdb (Ubuntu 12.1-0ubuntu1~22.04) 12.1
Reading symbols from vmlinux...
```

```gdb
(gdb) target remote :1234
Remote debugging using :1234
0x60000000 in ?? ()

(gdb) break start_kernel
Breakpoint 1 at 0xc0a08d40: file init/main.c, line 924.

(gdb) continue
Continuing.

Breakpoint 1, start_kernel () at init/main.c:924
924         set_task_stack_end_magic(&init_task);

(gdb) next
925         smp_setup_processor_id();

(gdb) list
919     asmlinkage __visible __init __no_sanitize_address __noreturn __no_stack_protector
920     void start_kernel(void)
921     {
922             char *command_line;
923             char *after_dashes;
924             set_task_stack_end_magic(&init_task);
925             smp_setup_processor_id();
926             debug_objects_early_init();
927             init_vmlinux_build_id();
```

For debugging a userspace application:

```bash
# On QEMU guest: start gdbserver
$ gdbserver :1234 ./myapp arg1 arg2

# On host: connect with cross-GDB
$ arm-linux-gnueabihf-gdb ./myapp
```
```
(gdb) target remote 192.168.100.2:1234
Remote debugging using 192.168.100.2:1234
Reading symbols from myapp...
(gdb) break main
(gdb) continue
```

### QEMU Machine Types and Limitations

QEMU emulation has important limitations compared to real hardware:

| Feature | QEMU | Real Hardware |
|---|---|---|
| Timing accuracy | Approximate — no cycle-accurate simulation | Exact |
| Peripheral support | Limited to emulated models | Full hardware peripherals |
| Interrupt latency | Not real-time | Real-time (with PREEMPT_RT) |
| Cache behavior | Not emulated | Real L1/L2/L3 caches |
| DMA | Simplified emulation | Real DMA controllers |
| GPIO | Not available in virt/vexpress | Full GPIO banks |
| SPI/I2C/UART timing | Approximate | Exact hardware timing |
| Performance | Slower (translation overhead) | Native speed |

QEMU is excellent for: kernel development, driver development (for emulated peripherals), rootfs testing, CI pipelines, and cross-debugging. It is not suitable for: real-time testing, hardware-specific driver testing, power consumption analysis, or final validation before production.

### KVM Acceleration for x86 Targets

When your target is also x86-64 (e.g., testing a minimal x86 embedded system), KVM provides near-native performance:

```bash
# Check KVM availability
$ ls /dev/kvm
/dev/kvm

$ qemu-system-x86_64 \
    -M q35 \
    -cpu host \
    -m 512M \
    -enable-kvm \
    -kernel bzImage \
    -initrd initramfs.cpio.gz \
    -append "console=ttyS0" \
    -nographic
```

KVM cannot be used for ARM emulation on an x86 host — it only accelerates when the guest architecture matches the host.

---

## Interview Questions
{:.gc-iq}
<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&A</span>

**Q: What is the difference between QEMU system emulation and user-mode emulation?**

QEMU system emulation (`qemu-system-arm`) emulates a complete machine: CPU, memory controller, peripheral devices (UART, network card, storage), and the entire boot sequence from power-on through bootloader to kernel. It runs a complete operating system. QEMU user-mode emulation (`qemu-arm`) only translates the CPU instruction set — it translates ARM instructions to host instructions but delegates all system calls directly to the host Linux kernel. User-mode is much simpler to use (just `qemu-arm ./mybinary`) and faster, but can only run Linux userspace binaries. It cannot boot a kernel or test driver code. System emulation is used for full system testing; user-mode is used for quick unit tests of cross-compiled userspace programs.

**Q: How do you use QEMU to test a cross-compiled kernel without physical hardware?**

Configure the kernel for a QEMU-supported machine type — for ARM, `virt` or `vexpress-a9` are common choices. Build the kernel (`make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- -j$(nproc)`). Build a minimal rootfs (BusyBox + cpio initramfs or ext2 image). Run `qemu-system-arm -M virt -cpu cortex-a15 -m 256M -kernel arch/arm/boot/zImage -initrd initramfs.cpio.gz -append "console=ttyAMA0 rdinit=/sbin/init" -nographic`. QEMU boots the kernel, mounts the initramfs, and drops to a shell. For the VirtFS approach you can share the host filesystem with the guest for rapid iteration.

**Q: How do you set up network access in a QEMU guest?**

The simplest method is user-mode networking: add `-netdev user,id=net0 -device virtio-net-device,netdev=net0` to the QEMU command line. The guest gets a NAT network with internet access through the host; the host can forward ports to the guest with `hostfwd=tcp::HOST_PORT-:GUEST_PORT`. For direct host-to-guest connectivity without NAT, create a TAP interface on the host (`ip tuntap add tap0 mode tap`), assign it an IP, and pass `-netdev tap,id=net0,ifname=tap0,script=no,downscript=no`. The guest and host can then communicate directly on the same subnet.

**Q: How do you use QEMU for cross-debugging with GDB?**

Start QEMU with `-s` (opens GDB server on port 1234) and `-S` (freezes CPU at startup waiting for GDB). On the host, run the cross-GDB: `arm-linux-gnueabihf-gdb vmlinux` (for kernel debugging) or `arm-linux-gnueabihf-gdb myapp` (for userspace). Connect with `target remote :1234` (for local QEMU) or `target remote QEMU_IP:1234` (for remote). For userspace debugging of a running application inside QEMU, use `gdbserver :PORT ./myapp` in the QEMU guest and connect the cross-GDB to the guest's IP and port. The key is always using the cross-GDB (`arm-linux-gnueabihf-gdb`), not the host's `gdb`, so that it understands ARM instruction set and ABI.

**Q: What are the limitations of QEMU compared to running on real hardware?**

QEMU does not provide cycle-accurate timing, so real-time behavior cannot be validated. QEMU's peripheral models are simplified — a real UART, SPI controller, or DMA engine will behave differently, especially regarding timing, interrupt latency, and edge cases. QEMU does not emulate hardware caches, so cache coherency bugs and performance tuning cannot be done in QEMU. GPIO, ADC, DAC, and most hardware-specific peripherals are not emulated in standard machine models. Hardware-specific bugs (memory-mapped I/O quirks, hardware erratum workarounds) cannot be reproduced. Finally, power consumption analysis, thermal testing, and electromagnetic compatibility cannot be evaluated in QEMU. QEMU is excellent for functional testing of kernel and userspace logic but cannot replace real hardware for production validation.

---

## References
{:.gc-ref}
<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

- **QEMU Official Documentation** — comprehensive reference for all QEMU options and machine types (https://www.qemu.org/docs/)
- **"Mastering Embedded Linux Programming"** — Chris Simmonds, 3rd Ed. — Chapter 4: Configuring and Building the Kernel, covers QEMU usage
- **QEMU ARM System Emulation Guide** — specific documentation for ARM machines in QEMU (https://www.qemu.org/docs/master/system/target-arm.html)
- **"Building Embedded Linux Systems"** — Karim Yaghmour — covers QEMU for embedded Linux development
- **QEMU VirtFS / 9P Documentation** — guide to host directory sharing (https://wiki.qemu.org/Documentation/9psetup)
- **GDB Remote Debugging with QEMU** — official QEMU GDB stub documentation (https://www.qemu.org/docs/master/system/gdb.html)
