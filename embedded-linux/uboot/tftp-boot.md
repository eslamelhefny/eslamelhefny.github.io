---
layout: guide
title: "TFTP & Network Boot"
description: "Configure a TFTP server, set up U-Boot network parameters, and boot your kernel and rootfs over the network for rapid development iteration."
phase_label: "Phase 03 — Embedded Linux"
phase_name: "Embedded Linux Developer"
phase_index: /embedded-linux/
stage: "Stage 06"
phase: embedded-linux-uboot
permalink: /embedded-linux/uboot/tftp-boot/
prev_topic:
  title: "Board Porting"
  url: /embedded-linux/uboot/board-porting/
next_topic:
  title: "Kconfig & menuconfig"
  url: /embedded-linux/kernel/kconfig-menuconfig/
---

## Why TFTP for Embedded Development?
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

**TFTP (Trivial File Transfer Protocol)** is the standard way to load the kernel and device tree from a development host into an embedded board's RAM during the boot process. Unlike flashing to storage, TFTP lets you:

- Test a new kernel **in seconds** — just build and copy to the TFTP directory
- Avoid flash wear during development
- Boot the **exact same binary** on multiple boards
- Combine with NFS root for a fully diskless development workflow

| Method | Use case | Iteration speed |
|--------|----------|----------------|
| Flash to eMMC/NAND | Production | Slow (minutes) |
| SD card swap | Occasional testing | Medium (30-60s) |
| TFTP + NFS root | Daily development | Fast (< 10s) |
| TFTP + ramdisk | CI / automated tests | Fast |

### Setting Up a TFTP Server (Ubuntu/Debian)

```bash
# Install tftpd-hpa
$ sudo apt install tftpd-hpa

# Default TFTP directory
$ cat /etc/default/tftpd-hpa
TFTP_USERNAME="tftp"
TFTP_DIRECTORY="/srv/tftp"
TFTP_ADDRESS=":69"
TFTP_OPTIONS="--secure"

# Create the directory and set permissions
$ sudo mkdir -p /srv/tftp
$ sudo chown tftp:tftp /srv/tftp
$ sudo chmod 755 /srv/tftp

# Start and enable the service
$ sudo systemctl enable tftpd-hpa
$ sudo systemctl start tftpd-hpa
$ sudo systemctl status tftpd-hpa
● tftpd-hpa.service - LSB: HPA's tftp server
     Loaded: loaded (/etc/init.d/tftpd-hpa; generated)
     Active: active (running) since Sat 2024-03-09 10:00:00 UTC; 2s ago

# Test the TFTP server from the host itself
$ echo "hello" > /srv/tftp/test.txt
$ tftp localhost
tftp> get test.txt
Received 6 bytes in 0.0 seconds
tftp> quit
$ cat test.txt
hello
```

### Copy Build Artifacts to TFTP Directory

```bash
# After cross-compiling the kernel
$ cp arch/arm/boot/zImage          /srv/tftp/
$ cp arch/arm/boot/dts/am335x-boneblack.dtb  /srv/tftp/

# For 64-bit ARM (AArch64)
$ cp arch/arm64/boot/Image         /srv/tftp/
$ cp arch/arm64/boot/dts/ti/k3-am64-evm.dtb  /srv/tftp/

# Verify the files are there
$ ls -lh /srv/tftp/
-rw-r--r-- 1 root root 7.2M Mar  9 10:05 zImage
-rw-r--r-- 1 root root  42K Mar  9 10:05 am335x-boneblack.dtb
```

### U-Boot Network Environment Variables

Connect a serial console to the board and enter the U-Boot prompt (press any key during countdown). Set up networking:

```
=> # Set the board's MAC address (if not set by factory)
=> setenv ethaddr DE:AD:BE:EF:00:01

=> # Static IP configuration
=> setenv ipaddr      192.168.1.100    # board IP
=> setenv serverip    192.168.1.1      # TFTP server (your host)
=> setenv gatewayip   192.168.1.1      # default gateway
=> setenv netmask     255.255.255.0

=> # Test connectivity
=> ping 192.168.1.1
Using ethernet@4a100000 device
host 192.168.1.1 is alive

=> # Save to persistent environment
=> saveenv
Saving Environment to MMC... Writing to MMC(0)... OK
```

---

## TFTP Boot Sequence
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Manual TFTP Boot Step by Step

```
=> # Step 1: Load kernel from TFTP into RAM
=> tftp ${loadaddr} zImage
Using ethernet@4a100000 device
TFTP from server 192.168.1.1; our IP address is 192.168.1.100
Filename 'zImage'.
Load address: 0x82000000
Loading: #################################################################
         ###############################
         4.3 MiB/s
done
Bytes transferred = 7340032 (700000 hex)

=> # Step 2: Load DTB
=> tftp ${fdtaddr} am335x-boneblack.dtb
...
Bytes transferred = 43008 (a800 hex)

=> # Step 3: Set kernel boot arguments
=> setenv bootargs console=ttyO0,115200n8 root=/dev/mmcblk0p2 rootwait rw

=> # Step 4: Boot (bootz for zImage, bootz addr [initrd] dtb)
=> bootz ${loadaddr} - ${fdtaddr}
   Kernel image @ 0x82000000 [ 0x000000 - 0x700000 ]
## Flattened Device Tree blob at 83000000
   Booting using the fdt blob at 0x83000000
   Loading Device Tree to 8fff6000, end 8ffff7ff ... OK

Starting kernel ...
[    0.000000] Booting Linux on physical CPU 0x0
[    0.000000] Linux version 6.1.46 (gcc version 12.3.0)
```

### Key U-Boot Address Variables

Most boards pre-define these — check with `printenv`:

| Variable | Typical value | Purpose |
|----------|--------------|---------|
| `loadaddr` | `0x82000000` | Default load address for kernel |
| `fdtaddr` | `0x83000000` | Load address for DTB |
| `ramdisk_addr_r` | `0x88000000` | Load address for initramfs |
| `serverip` | `192.168.1.1` | TFTP server IP |
| `ipaddr` | `192.168.1.100` | Board IP address |

```
=> printenv loadaddr fdtaddr
loadaddr=0x82000000
fdtaddr=0x88000000
```

### Automating TFTP Boot via bootcmd

```
=> setenv tftp_boot \
   'tftp ${loadaddr} zImage; \
    tftp ${fdtaddr} ${fdtfile}; \
    setenv bootargs console=${console} root=/dev/mmcblk0p2 rootwait rw; \
    bootz ${loadaddr} - ${fdtaddr}'

=> setenv bootcmd 'run tftp_boot'
=> setenv fdtfile 'am335x-boneblack.dtb'
=> setenv console 'ttyO0,115200n8'
=> saveenv
```

Now every boot automatically TFTPs and boots. No more manual commands.

### TFTP + NFS Root — The Developer Dream Setup

With NFS root, your **entire rootfs lives on the host machine** — no reflashing, instant file changes:

```bash
# 1. Install NFS server on host
$ sudo apt install nfs-kernel-server

# 2. Create a rootfs directory (or export Buildroot/Yocto output)
$ sudo mkdir -p /srv/nfs/rootfs
$ sudo chown -R nobody:nogroup /srv/nfs/rootfs

# 3. Configure NFS exports
$ echo '/srv/nfs/rootfs *(rw,sync,no_subtree_check,no_root_squash)' \
    | sudo tee -a /etc/exports

$ sudo exportfs -ra
$ sudo systemctl restart nfs-kernel-server

# 4. Populate the rootfs (example: from Buildroot output)
$ sudo tar -xf buildroot/output/images/rootfs.tar -C /srv/nfs/rootfs/
```

In U-Boot, set the kernel boot args to use NFS root:

```
=> setenv nfs_boot \
   'tftp ${loadaddr} zImage; \
    tftp ${fdtaddr} ${fdtfile}; \
    setenv bootargs console=${console} \
      root=/dev/nfs \
      nfsroot=${serverip}:/srv/nfs/rootfs,v3,tcp \
      ip=dhcp rw; \
    bootz ${loadaddr} - ${fdtaddr}'

=> setenv bootcmd 'run nfs_boot'
=> saveenv
```

Expected kernel boot output:
```
[    3.256] VFS: Mounted root (nfs filesystem) on device 0:16.
[    3.310] devtmpfs: mounted
[    3.381] Freeing unused kernel image (initmem) memory: 1024K
[    3.390] Run /sbin/init as init process
```

### DHCP — Let the Network Assign the IP

```
=> # Get IP via DHCP and also download boot files (if DHCP server has options set)
=> dhcp
Using ethernet@4a100000 device
BOOTP broadcast 1
DHCP client bound to address 192.168.1.105 (5 ms)

=> # serverip is automatically set from DHCP reply
=> printenv ipaddr serverip
ipaddr=192.168.1.105
serverip=192.168.1.1
```

---

## Advanced: PXE Boot & Troubleshooting
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Setting Up dnsmasq as DHCP + TFTP Server

`dnsmasq` is simpler than running separate ISC DHCP + tftpd-hpa:

```bash
$ sudo apt install dnsmasq

$ cat /etc/dnsmasq.conf
# Serve DHCP on this interface only
interface=eth0
bind-interfaces

# DHCP range
dhcp-range=192.168.7.100,192.168.7.200,12h

# Set TFTP server option
dhcp-option=66,192.168.7.1

# Enable built-in TFTP server
enable-tftp
tftp-root=/srv/tftp

# Optional: always assign the same IP to your board by MAC
dhcp-host=DE:AD:BE:EF:00:01,192.168.7.100,bbb

$ sudo systemctl restart dnsmasq
```

With this setup, the board gets IP + `serverip` from DHCP — no manual U-Boot config needed.

### PXE Boot — Automatic Board Configuration

U-Boot's `distro_bootcmd` includes PXE support. With a PXE server, you can:
1. Board gets IP via DHCP
2. U-Boot downloads `/pxelinux.cfg/default` via TFTP
3. U-Boot reads the config and boots the specified kernel/DTB

```bash
# PXE config file at /srv/tftp/pxelinux.cfg/default
$ cat /srv/tftp/pxelinux.cfg/default
default Linux
timeout 30
label Linux
  kernel zImage
  fdt am335x-boneblack.dtb
  append console=ttyO0,115200n8 root=/dev/nfs nfsroot=192.168.7.1:/srv/nfs/rootfs ip=dhcp rw
```

```
=> # U-Boot automatically tries PXE if distro_bootcmd is set
=> run distro_bootcmd
BOOTP broadcast 1
DHCP client bound to address 192.168.7.100
Retrieving file: pxelinux.cfg/01-de-ad-be-ef-00-01
Retrieving file: pxelinux.cfg/default
Config file found
Retrieving file: zImage
Retrieving file: am335x-boneblack.dtb
...
```

PXE config files are tried in order of specificity:
1. MAC address: `01-de-ad-be-ef-00-01`
2. IP hex: `C0A80764` (192.168.7.100)
3. `default`

### Troubleshooting TFTP Failures

```bash
# On host: watch TFTP requests with tcpdump
$ sudo tcpdump -i eth0 -n udp port 69
15:30:01.234 IP 192.168.1.100.50234 > 192.168.1.1.69: TFTP, length 30
15:30:01.235 IP 192.168.1.1.69 > 192.168.1.100.50234: TFTP, length 516

# If no packets seen → check cable, IP config, firewall
$ sudo ufw allow from 192.168.1.0/24 to any port 69 proto udp

# Check tftpd is listening
$ ss -ulnp | grep :69
UNCONN 0 0 0.0.0.0:69 0.0.0.0:* users:(("in.tftpd",pid=1234,fd=4))

# U-Boot error messages and their meaning
```

| U-Boot error | Cause | Fix |
|-------------|-------|-----|
| `TFTP error: 'File not found'` | File not in `/srv/tftp/` | Copy file, check filename case |
| `host ... is not alive` | Network not reachable | Check IP config, cable, switch |
| `Aborting` + timeout | TFTP server not running | `systemctl start tftpd-hpa` |
| `Bad Magic Number` | Wrong load address or corrupted image | Verify `loadaddr`, rebuild kernel |
| `ERROR: Did not find a cmdline Flattened Device Tree` | Wrong `fdtaddr` or DTB corrupted | Verify `fdtaddr`, check DTB size |

### Link Speed Negotiation Issues

Gigabit switches sometimes fail to negotiate properly with embedded boards that only support 100Mbps:

```
=> # Force 100Mbps full-duplex in U-Boot (board-specific)
=> setenv ethact ethernet@4a100000
=> mii write 0 0 0x2100    # Force 100M FD on PHY register 0
```

Or set in Device Tree:
```dts
&mac {
    phy-mode = "mii";
    /* Force link speed if autoneg fails */
    max-speed = <100>;
};
```

### Build System Integration — Auto-Copy on Build

Add to your build script or Makefile to automatically push new kernels to the TFTP server:

```makefile
TFTP_DIR  := /srv/tftp
KERNEL    := arch/arm/boot/zImage
DTB       := arch/arm/boot/dts/am335x-boneblack.dtb

tftp-deploy: $(KERNEL) $(DTB)
	sudo cp $(KERNEL) $(TFTP_DIR)/zImage
	sudo cp $(DTB)    $(TFTP_DIR)/am335x-boneblack.dtb
	@echo "Kernel deployed to TFTP server. Boot the board."

.PHONY: tftp-deploy
```

```bash
# One-liner workflow
$ make ARCH=arm CROSS_COMPILE=arm-linux-gnueabihf- -j$(nproc) && make tftp-deploy
```

Then just reset the board — it picks up the new kernel immediately.

---

## Interview Questions
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&A</span>

**Q: Why is TFTP preferred over HTTP or SCP for embedded boot loading?**

TFTP is extremely simple — it runs over UDP and has almost no overhead or handshaking. U-Boot's bootloader has tight code size constraints and a minimal network stack, making TFTP easy to implement. It also doesn't require authentication, TLS, or complex connection management. The simplicity is a feature: less code, fewer failure modes at boot time. HTTP and SCP add complexity that is unnecessary for loading a single file during the boot process.

**Q: How do you set up a development environment using TFTP and NFS root?**

You need: (1) a TFTP server (`tftpd-hpa`) with the kernel and DTB, (2) an NFS server exporting the rootfs directory, (3) U-Boot configured with the board's IP and host's IP, (4) `bootargs` set to `root=/dev/nfs nfsroot=<host-ip>:<path>,v3,tcp ip=dhcp`. With this setup, you rebuild the kernel → copy to `/srv/tftp/`, reset the board, and it boots the new kernel in under 10 seconds. Rootfs changes (edit files in `/srv/nfs/rootfs/`) are visible immediately.

**Q: What are the U-Boot environment variables needed for TFTP boot?**

The essential variables are: `ipaddr` (board IP), `serverip` (TFTP server IP), `loadaddr` (RAM address for kernel), `fdtaddr` (RAM address for DTB), `bootargs` (kernel command line), and `bootcmd` (the automated boot command). Optionally `ethaddr` (MAC address) if not set by factory, and `gatewayip`/`netmask` for routed networks.

**Q: What is the difference between DHCP-assigned and static IP configuration in U-Boot?**

With static IP (`setenv ipaddr 192.168.1.100; setenv serverip 192.168.1.1`), the board always uses the same addresses regardless of network infrastructure — simple but inflexible. With DHCP (`run dhcp` or `dhcp` command), the board requests an IP from a DHCP server, which also provides the `serverip` via DHCP option 66. DHCP is better for labs with multiple boards, or when you want all network configuration centralized in one dnsmasq config.

**Q: How do you troubleshoot a TFTP connection that isn't working?**

Systematic debugging: (1) `ping <serverip>` from U-Boot — if it fails, the problem is layer 2/3 (cable, IP config, firewall). (2) On the host, run `tcpdump -i eth0 udp port 69` — if TFTP request packets arrive but nothing responds, `tftpd-hpa` isn't running or is listening on the wrong interface. (3) If requests arrive and responses are sent but U-Boot reports "File not found", verify the exact filename and path in `/srv/tftp/`. (4) Check that the firewall allows UDP port 69 inbound.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

- **tftpd-hpa man page** — `man tftpd-hpa` — server configuration options
- **"Mastering Embedded Linux Programming" by Chris Simmonds** (3rd ed.) — Chapter on U-Boot network booting
- **U-Boot networking documentation** — doc/README.tftp in U-Boot source
- **Embedded Linux Wiki: TFTP** — https://elinux.org/TFTP_Boot
- **dnsmasq documentation** — http://www.thekelleys.org.uk/dnsmasq/doc.html — combined DHCP+TFTP setup
- **U-Boot distro_bootcmd / PXE** — doc/README.pxe in U-Boot source
- **"Building Embedded Linux Systems" by Karim Yaghmour** — network-based development workflow
