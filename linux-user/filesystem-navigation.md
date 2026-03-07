---
layout: guide
title: "Filesystem Navigation"
description: "Master the Linux Filesystem Hierarchy Standard, navigate directories with confidence, manage files, and understand how inodes, mounts, and /proc work under the hood."
stage: "Stage 01"
permalink: /linux-user/filesystem-navigation/
next_topic:
  title: "Users & Permissions"
  url: /linux-user/users-permissions/
---

## The Linux Filesystem Hierarchy (FHS)
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Linux organises every file into a single tree rooted at `/`. Unlike Windows drive letters, there is **one unified namespace**. The Filesystem Hierarchy Standard (FHS) defines what belongs where.

| Directory | Purpose |
|-----------|---------|
| `/` | Root — the top of the entire tree |
| `/bin` | Essential user binaries (`ls`, `cp`, `mv`) |
| `/sbin` | System administration binaries (`fdisk`, `ifconfig`) |
| `/etc` | System-wide configuration files |
| `/home` | User home directories (`/home/eslam`) |
| `/root` | Home directory for the root user |
| `/var` | Variable data: logs, spools, runtime state |
| `/tmp` | Temporary files (cleared on reboot) |
| `/usr` | Secondary hierarchy: apps, libraries, man pages |
| `/lib` | Shared libraries needed by `/bin` and `/sbin` |
| `/dev` | Device files (block + character devices) |
| `/proc` | Virtual FS exposing kernel/process info |
| `/sys` | Virtual FS for hardware/device info (sysfs) |
| `/mnt` | Temporary mount point for admins |
| `/media` | Mount point for removable media |
| `/opt` | Optional / third-party software |
| `/boot` | Bootloader files, kernel images, initramfs |

---

## Core Navigation Commands
{:.gc-basic}

### `pwd` — Print Working Directory

```bash
$ pwd
/home/eslam/projects
```

### `ls` — List Directory Contents

```bash
$ ls
Documents  Downloads  projects

$ ls -l
total 12
drwxr-xr-x 2 eslam eslam 4096 Mar  1 09:00 Documents
drwxr-xr-x 2 eslam eslam 4096 Mar  1 09:00 Downloads
drwxr-xr-x 3 eslam eslam 4096 Mar  5 14:22 projects

$ ls -la          # include hidden files
$ ls -lh          # human-readable sizes
$ ls -lt          # sort by modification time (newest first)
$ ls -lS          # sort by file size (largest first)
$ ls -R           # recursive listing
$ ls --color=auto # coloured output
```

**Permission field breakdown:** `drwxr-xr-x`

```
d  rwx  r-x  r-x
│   │    │    └── other: read+execute
│   │    └─────── group: read+execute
│   └──────────── owner: read+write+execute
└──────────────── type: d=dir, -=file, l=symlink, c=char dev, b=block dev
```

### `cd` — Change Directory

```bash
cd /etc                  # absolute path
cd projects              # relative path
cd ..                    # one level up
cd ../..                 # two levels up
cd ~                     # go to home directory
cd -                     # go back to previous directory
cd /var/log/nginx        # multi-level absolute
```

### `mkdir` — Make Directory

```bash
mkdir mydir
mkdir -p parent/child/grandchild   # create entire tree at once
mkdir -m 755 secure_dir            # set permissions on creation
```

### `cp` — Copy Files and Directories

```bash
cp file.txt backup.txt             # copy file
cp -r src_dir/ dst_dir/            # copy directory recursively
cp -p file.txt backup.txt          # preserve timestamps + permissions
cp -u source/ dest/                # copy only if newer
cp -v file.txt /tmp/               # verbose output
```

**Example with output:**
```bash
$ cp -rv projects/ /tmp/projects_backup/
'projects/' -> '/tmp/projects_backup/'
'projects/main.c' -> '/tmp/projects_backup/main.c'
'projects/Makefile' -> '/tmp/projects_backup/Makefile'
```

### `mv` — Move / Rename

```bash
mv old_name.txt new_name.txt       # rename
mv file.txt /tmp/                  # move to directory
mv -i file.txt dest/               # prompt before overwrite
mv -v *.log /var/log/archive/      # verbose move
```

### `rm` — Remove

```bash
rm file.txt
rm -r directory/         # remove directory and contents
rm -i *.tmp              # prompt before each deletion
rm -f locked_file        # force (ignore missing files)
# NEVER run: rm -rf /    # destroys the entire system
```

### `cat`, `less`, `head`, `tail` — View File Contents

```bash
cat /etc/os-release            # dump entire file
less /var/log/syslog           # page through (q to quit, / to search)
head -n 20 /var/log/syslog     # first 20 lines
tail -n 20 /var/log/syslog     # last 20 lines
tail -f /var/log/syslog        # follow live (Ctrl+C to stop)
```

---

## Absolute vs Relative Paths

| Concept | Example | Notes |
|---------|---------|-------|
| **Absolute** | `/home/eslam/docs/file.txt` | Always starts with `/`, unambiguous |
| **Relative** | `docs/file.txt` | Relative to current directory |
| **`.`** | `./run.sh` | Current directory |
| **`..`** | `../lib/` | Parent directory |
| **`~`** | `~/Downloads` | Your home directory |

---

## Intermediate: Finding Files
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### `find` — Search the Filesystem

```bash
# Find by name
find /home -name "*.log"

# Find by type (f=file, d=dir, l=symlink)
find /var -type f -name "*.pid"

# Find by size (> 100 MB)
find / -type f -size +100M 2>/dev/null

# Find modified in the last 7 days
find /etc -mtime -7

# Find and delete (careful!)
find /tmp -name "*.tmp" -delete

# Find and execute a command on each result
find . -name "*.c" -exec wc -l {} \;

# Find by permissions
find /usr/bin -perm /4000      # files with SUID bit
```

**Output example:**
```bash
$ find /var/log -name "*.log" -size +1M
/var/log/syslog
/var/log/kern.log
/var/log/auth.log
```

### `locate` — Fast Filename Search

```bash
sudo updatedb          # update the filename database
locate nginx.conf      # instant lookup from database
locate -i readme       # case-insensitive
```

### `which` and `type`

```bash
$ which python3
/usr/bin/python3

$ type ls
ls is aliased to `ls --color=auto'

$ type cd
cd is a shell builtin
```

---

## Hard Links vs Symbolic Links

```bash
# Hard link — second name pointing to same inode
ln original.txt hardlink.txt

# Symbolic link — a pointer to a path
ln -s /usr/bin/python3 /usr/local/bin/python

# View links
ls -li          # -i shows inode number
readlink -f symlink.txt    # resolve full path
```

**Key differences:**

| Feature | Hard Link | Symbolic Link |
|---------|-----------|---------------|
| Points to | Inode | Path string |
| Crosses filesystems | ✗ No | ✓ Yes |
| Works on directories | ✗ No | ✓ Yes |
| Survives original deletion | ✓ Yes | ✗ No (dangling) |
| `ls -l` type char | `-` | `l` |

---

## Disk Usage and Space

```bash
# Disk usage of directories
du -sh /var/log          # summary, human-readable
du -sh /*                # top-level usage
du -sh * | sort -h       # sorted by size

# Disk free space
df -h                    # all filesystems, human-readable
df -h /home              # specific mount point
```

**Output example:**
```bash
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   18G   30G  38% /
tmpfs           2.0G  1.2M  2.0G   1% /dev/shm
/dev/sdb1       200G   45G  145G  24% /data
```

---

## Wildcards and Globbing

| Pattern | Matches |
|---------|---------|
| `*` | Any string (including empty) |
| `?` | Any single character |
| `[abc]` | One of a, b, c |
| `[a-z]` | Any lowercase letter |
| `[!abc]` | Any character NOT a, b, or c |
| `{a,b,c}` | Brace expansion: a, b, or c |

```bash
ls *.c                  # all .c files
ls file?.txt            # file1.txt, file2.txt, …
rm log[0-9].txt         # log0.txt through log9.txt
cp {file1,file2}.c /tmp # copy both files
mkdir dir{1..5}         # create dir1 dir2 dir3 dir4 dir5
```

---

## Advanced: Inodes and the VFS
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### What is an Inode?

Every file on a Linux filesystem has an **inode** — a data structure that stores:
- File type and permissions
- Owner (UID) and group (GID)
- File size
- Timestamps: atime, mtime, ctime
- Block pointers (where the data is on disk)
- Link count

The **directory** only stores `(name → inode_number)` mappings. The inode number IS the file; the name is just a label.

```bash
$ ls -li /etc/passwd
131073 -rw-r--r-- 1 root root 2847 Jan 15 08:00 /etc/passwd
# ^----^ inode number
```

```bash
# Check inode usage (embedded systems run out of inodes before disk space!)
df -i
```

### The `/proc` Virtual Filesystem

`/proc` is a window into the running kernel — nothing is stored on disk.

```bash
cat /proc/cpuinfo          # CPU details
cat /proc/meminfo          # memory stats
cat /proc/version          # kernel version string
cat /proc/cmdline          # kernel boot parameters
cat /proc/interrupts        # IRQ statistics
cat /proc/net/dev           # network interface stats

# Per-process info (replace 1234 with PID)
cat /proc/1234/status       # process status
cat /proc/1234/cmdline      # command that launched it
cat /proc/1234/maps         # memory maps
cat /proc/1234/fd/          # open file descriptors
ls -l /proc/1234/exe        # symlink to executable
```

### The `/sys` Virtual Filesystem (sysfs)

`/sys` exposes kernel objects, device attributes, and driver information.

```bash
ls /sys/class/net/          # network interfaces
cat /sys/class/net/eth0/operstate   # link state: up/down
cat /sys/block/sda/size     # disk size in 512-byte sectors
ls /sys/bus/i2c/devices/    # I2C devices (useful for embedded!)
echo 1 > /sys/class/leds/led0/brightness   # turn on LED
```

### Mounting and `/etc/fstab`

```bash
# Mount a filesystem manually
mount /dev/sdb1 /mnt/usb
mount -t tmpfs -o size=256m tmpfs /tmp/ramdisk
mount -o loop image.iso /mnt/iso

# Unmount
umount /mnt/usb
umount -l /mnt/usb    # lazy unmount (wait for processes to release)

# List all current mounts
mount | column -t
cat /proc/mounts
findmnt
```

**`/etc/fstab` format:**
```
# device          mountpoint  type   options          dump pass
/dev/sda1         /           ext4   errors=remount-ro  0    1
/dev/sdb1         /data       ext4   defaults           0    2
UUID=abc123       /boot/efi   vfat   umask=0077         0    1
tmpfs             /tmp        tmpfs  size=512m,mode=1777 0   0
```

### `lsof` — List Open Files

```bash
lsof /var/log/syslog       # who has this file open?
lsof -p 1234               # all files opened by PID 1234
lsof -u eslam              # all files opened by user eslam
lsof -i :80                # who is listening on port 80?
lsof +D /home/eslam        # all open files in a directory tree
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `/bin` and `/usr/bin`?**

> `/bin` contains essential binaries needed during early boot (before `/usr` is mounted), such as `sh`, `ls`, `cp`, and `mount`. `/usr/bin` contains non-essential user programs. On modern systems (Ubuntu 20.04+, Debian Bullseye+), `/bin` is a symlink to `/usr/bin` under the "UsrMerge" initiative.

**Q2 — Basic: What does the `.` and `..` entry in a directory represent?**

> `.` is a hard link to the directory itself; `..` is a hard link to its parent. That is why `ls -la` always shows a link count ≥ 2 for directories (one for the entry in the parent, one for `.` inside itself), plus one extra for each subdirectory (because each subdirectory has a `..` pointing back).

**Q3 — Basic: How do you find the 10 largest files under `/var`?**

```bash
find /var -type f -printf '%s %p\n' 2>/dev/null | sort -rn | head -10
# or
du -ah /var | sort -rh | head -10
```

**Q4 — Intermediate: What is an inode and what information does it NOT store?**

> An inode stores metadata: permissions, owner, timestamps, size, and pointers to data blocks. It does **not** store the filename — names live in directory entries. It also does not store the full path.

**Q5 — Intermediate: How can a filesystem run out of space even when `df -h` shows free space?**

> It can run out of **inodes**. Each file consumes one inode, and the number of inodes is fixed at filesystem creation time. Check with `df -i`. This is common on embedded systems with millions of tiny files (e.g., `/tmp` or mail spools).

**Q6 — Intermediate: What is the difference between `mtime`, `ctime`, and `atime`?**

> `mtime` (modification time) — when the file content was last changed.
> `ctime` (change time) — when the inode metadata was last changed (permissions, owner, link count). `chmod` updates ctime but not mtime.
> `atime` (access time) — when the file was last read. Often disabled with `noatime` mount option for performance.

**Q7 — Advanced: Explain what happens when you delete a file that is still open by a process.**

> In Linux, `unlink()` removes the directory entry (name → inode mapping) and decrements the inode's link count. The inode and its data blocks are only freed when **both** the link count reaches 0 **and** no process has the file open. Until then, the process can still read/write through its open file descriptor. This is why log rotation uses `copytruncate` and why deleted files can still consume disk space (`lsof | grep deleted`).

**Q8 — Advanced: What is a bind mount and when would you use it?**

> A bind mount makes a directory (or file) visible at a second location in the filesystem tree without copying data.
> ```bash
> mount --bind /home/eslam/code /mnt/code
> ```
> Use cases: exposing a host directory inside a chroot/container, overlaying `/tmp` with a tmpfs, isolating build environments.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| Linux FHS Specification 3.0 | [refspecs.linuxfoundation.org](https://refspecs.linuxfoundation.org/FHS_3.0/fhs/index.html) |
| `man hier` | `man 7 hier` — describes the filesystem hierarchy |
| `man find` | `man 1 find` — comprehensive find manual |
| `man proc` | `man 5 proc` — /proc filesystem reference |
| The Linux Command Line (Shotts) | Free book at [linuxcommand.org](https://linuxcommand.org/tlcl.php) |
| Linux Insides — VFS chapter | [github.com/0xAX/linux-insides](https://github.com/0xAX/linux-insides) |
