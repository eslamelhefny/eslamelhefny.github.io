---
layout: guide
title: "Users & Permissions"
description: "Manage Linux users and groups, master file permission bits, set up sudo, work with ACLs, and understand Linux capabilities and PAM for production-level access control."
stage: "Stage 02"
permalink: /linux-user/users-permissions/
prev_topic:
  title: "Filesystem Navigation"
  url: /linux-user/filesystem-navigation/
next_topic:
  title: "Process Management"
  url: /linux-user/process-management/
---

## User and Group Fundamentals
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Linux is a **multi-user** OS. Every process runs as a user, every file is owned by a user+group pair, and the kernel enforces access through these identities.

### Key Files

```bash
/etc/passwd     # User accounts (username:x:UID:GID:GECOS:home:shell)
/etc/shadow     # Hashed passwords (root-readable only)
/etc/group      # Group definitions (groupname:x:GID:members)
/etc/gshadow    # Group passwords (rare)
```

**Viewing the password file:**
```bash
$ cat /etc/passwd | head -4
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
eslam:x:1000:1000:Eslam Mohamed,,,:/home/eslam:/bin/bash
sshd:x:110:65534::/run/sshd:/usr/sbin/nologin
# name:x:UID:GID:comment:home:shell
```

### User Management Commands

```bash
# Add a user (high-level, interactive)
sudo adduser eslam

# Add a user (low-level, scriptable)
sudo useradd -m -s /bin/bash -G sudo,developers eslam

# Set / change password
sudo passwd eslam

# Modify user
sudo usermod -aG docker eslam      # add to docker group (append!)
sudo usermod -s /bin/zsh eslam     # change shell
sudo usermod -l newname eslam      # rename login
sudo usermod -L eslam              # lock account
sudo usermod -U eslam              # unlock account

# Delete user
sudo userdel eslam                 # keep home directory
sudo userdel -r eslam              # delete home + mail spool

# Get info about current user
id
whoami
groups
```

**`id` output:**
```bash
$ id
uid=1000(eslam) gid=1000(eslam) groups=1000(eslam),4(adm),24(cdrom),27(sudo),1001(docker)
```

### Group Management

```bash
sudo groupadd developers        # create group
sudo groupdel developers        # delete group
sudo gpasswd -a eslam devs      # add user to group
sudo gpasswd -d eslam devs      # remove user from group
getent group docker             # show group members
```

---

## File Permissions
{:.gc-basic}

### Reading Permission Bits

Every file has 9 permission bits (3 for owner, 3 for group, 3 for others):

```
-  rwx  r-x  r--
│   │    │    └── other:  r=4, -=0, -=0  → 4
│   │    └─────── group:  r=4, -=0, x=1  → 5
│   └──────────── owner:  r=4, w=2, x=1  → 7
└──────────────── type: - file, d dir, l link, c char, b block
```

### `chmod` — Change Permissions

**Symbolic mode:**
```bash
chmod u+x script.sh          # add execute for owner
chmod g-w file.txt           # remove write from group
chmod o=r file.txt           # set other to read-only
chmod a+x script.sh          # add execute for all (u+g+o)
chmod u=rwx,g=rx,o= file     # set all at once
```

**Octal mode:**
```bash
chmod 755 script.sh    # rwxr-xr-x — typical for executables
chmod 644 file.txt     # rw-r--r-- — typical for data files
chmod 600 id_rsa       # rw------- — SSH private keys
chmod 700 ~/.ssh       # rwx------ — SSH directory
chmod 777 /tmp/shared  # rwxrwxrwx — world-writable (avoid in prod!)
```

### `chown` — Change Owner

```bash
sudo chown eslam file.txt               # change owner
sudo chown eslam:developers file.txt    # change owner and group
sudo chown :developers file.txt         # change group only
sudo chown -R eslam:eslam /home/eslam   # recursive
```

### `sudo` and `/etc/sudoers`

```bash
# Run command as root
sudo apt update

# Run as specific user
sudo -u www-data nginx -t

# Edit sudoers safely (validates syntax before saving)
sudo visudo
```

**`/etc/sudoers` syntax:**
```
# user   host=(run_as)  commands
eslam    ALL=(ALL:ALL)  ALL               # full sudo
eslam    ALL=(ALL)      NOPASSWD: /bin/systemctl restart nginx
%sudo    ALL=(ALL:ALL)  ALL               # group sudo (% = group)
```

---

## Special Permission Bits
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### SUID (Set User ID) — bit 4000

When set on an **executable**, the process runs with the **file owner's** UID, not the caller's.

```bash
chmod u+s /usr/bin/passwd
# or
chmod 4755 /usr/bin/passwd

$ ls -l /usr/bin/passwd
-rwsr-xr-x 1 root root 59640 Nov 24 2022 /usr/bin/passwd
#    ^ 's' = SUID is set
```

**Why it exists:** `passwd` must write to `/etc/shadow` (owned by root). With SUID, any user can run `passwd` and it temporarily gets root UID to update the shadow file — but only for that specific task.

**Security implication:** SUID binaries with vulnerabilities become privilege escalation vectors. Audit them with:
```bash
find / -perm /4000 -type f 2>/dev/null
```

### SGID (Set Group ID) — bit 2000

On an **executable**: process runs with file's **group** GID.
On a **directory**: new files inherit the directory's group (very useful for shared project dirs).

```bash
chmod g+s /shared/project
# or
chmod 2755 /shared/project

$ ls -ld /shared/project
drwxrwsr-x 2 root devteam 4096 Mar 5 10:00 /shared/project
#      ^ 's' = SGID on directory
```

### Sticky Bit — bit 1000

On a **directory**: users can only delete/rename their **own** files, even if they have write permission on the directory. Essential for `/tmp`.

```bash
chmod +t /tmp
# or
chmod 1777 /tmp

$ ls -ld /tmp
drwxrwxrwt 12 root root 4096 Mar  7 08:00 /tmp
#         ^ 't' = sticky bit
```

### `umask` — Default Permission Mask

`umask` subtracts bits from the default permissions (666 for files, 777 for dirs).

```bash
$ umask
0022    # means new files = 666-022 = 644, new dirs = 777-022 = 755

umask 027    # new files = 640, new dirs = 750 (no world access)
umask 077    # files = 600, dirs = 700 (private, good for home dirs)
```

Set it persistently in `~/.bashrc` or `/etc/profile`.

---

## Access Control Lists (ACLs)
{:.gc-mid}

Standard Unix permissions only allow one owner and one group. **ACLs** let you grant fine-grained access to specific users or groups.

```bash
# Install
sudo apt install acl

# View ACL
getfacl /shared/project

# Give user bob read+write on a file
setfacl -m u:bob:rw file.txt

# Give group qa read-only
setfacl -m g:qa:r-- /shared/reports/

# Set default ACL on a directory (inherited by new files)
setfacl -d -m u:bob:rw /shared/project/

# Remove specific ACL entry
setfacl -x u:bob file.txt

# Remove all ACLs
setfacl -b file.txt
```

**`getfacl` output:**
```bash
$ getfacl /shared/project
# file: shared/project
# owner: eslam
# group: devteam
# flags: -s-
user::rwx
user:bob:rw-
group::r-x
group:qa:r--
mask::rwx
other::---
```

The `mask` entry limits the effective permissions for named users/groups.

---

## Advanced: Linux Capabilities
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

Capabilities divide root's omnipotence into **distinct units** that can be granted individually, reducing the attack surface of privileged programs.

### Common Capabilities

| Capability | What it grants |
|-----------|----------------|
| `CAP_NET_BIND_SERVICE` | Bind ports < 1024 |
| `CAP_NET_ADMIN` | Configure network interfaces |
| `CAP_SYS_ADMIN` | Mount filesystems, many admin ops |
| `CAP_SYS_PTRACE` | Attach to processes with ptrace |
| `CAP_DAC_OVERRIDE` | Bypass file read/write/execute checks |
| `CAP_SETUID` | Change process UID |
| `CAP_KILL` | Send signals to any process |

```bash
# View capabilities on a file
getcap /usr/bin/ping

# Grant capability (instead of SUID root)
sudo setcap cap_net_bind_service+ep /usr/local/bin/myserver
# +ep = effective + permitted sets

# Remove capabilities
sudo setcap -r /usr/local/bin/myserver

# View current process capabilities
cat /proc/self/status | grep Cap
capsh --decode=0000000000000000   # decode hex capability mask
```

**Real example:** Give a Node.js app the ability to bind port 80 without running as root:
```bash
sudo setcap cap_net_bind_service+ep $(which node)
```

### PAM — Pluggable Authentication Modules

PAM sits between applications and authentication backends, providing modular control over who can log in and how.

```bash
# PAM config lives in /etc/pam.d/
ls /etc/pam.d/
# sshd, login, sudo, common-auth, common-password, …

cat /etc/pam.d/common-auth
# auth  [success=1 default=ignore]  pam_unix.so nullok
# auth  requisite                    pam_deny.so
# auth  required                     pam_permit.so
```

**Control flags:** `required` (failure always fails), `requisite` (immediate failure), `sufficient` (success skips rest), `optional`.

**Useful PAM modules:**

| Module | Purpose |
|--------|---------|
| `pam_unix.so` | Traditional UNIX password auth |
| `pam_google_authenticator.so` | TOTP two-factor auth |
| `pam_limits.so` | Enforce resource limits (ulimit) |
| `pam_faillock.so` | Account lockout after N failed attempts |
| `pam_env.so` | Set environment variables on login |

### User Namespaces

```bash
# Run a process in its own user namespace (appears as root inside, not outside)
unshare --user --map-root-user bash

# Check — inside the namespace you're UID 0
id
# uid=0(root) gid=0(root) groups=0(root),...

# From host, you're still your regular UID
```

User namespaces are the foundation of rootless containers (Podman, rootless Docker).

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What does `chmod 644` mean?**

> Owner gets read+write (4+2=6), group gets read-only (4), others get read-only (4). Typical for config files and static web assets.

**Q2 — Basic: What is the difference between `adduser` and `useradd`?**

> `useradd` is the low-level system binary — it does exactly what flags say and nothing more. `adduser` is a higher-level Perl/Python script (Debian/Ubuntu) that provides sensible defaults: creates home directory, copies `/etc/skel`, prompts for password and GECOS info. For scripts, use `useradd`; for interactive admin, use `adduser`.

**Q3 — Intermediate: Explain SUID on a directory. Does it have any effect?**

> SUID on a directory has **no defined effect** on most Linux filesystems (it is ignored). SGID on a directory is the useful one — it makes newly created files inherit the directory's group instead of the creator's primary group.

**Q4 — Intermediate: What does the `x` permission mean on a directory vs a file?**

> On a **file**: permission to execute it as a program. On a **directory**: permission to **enter** it (traverse / `cd` into it) and access files within it if their names are known. Read (`r`) on a directory lets you list its contents; execute (`x`) lets you access contents by name. You need both `r` and `x` to do a useful `ls` and `cd`.

**Q5 — Intermediate: How would you allow `www-data` to read a file owned by `eslam` without changing ownership or using ACLs?**

> Add `www-data` to `eslam`'s group, then ensure the file has group-readable permissions (`chmod g+r`). Or use `setfacl -m u:www-data:r file.txt` for a more targeted ACL approach.

**Q6 — Advanced: What is the difference between SUID and Linux capabilities, and which is preferred for new software?**

> SUID grants the entire UID of the file owner (usually root) for the duration of the process. Linux capabilities grant only specific privileges (e.g., `CAP_NET_BIND_SERVICE` for binding low ports). Capabilities follow the **principle of least privilege** — if your daemon only needs to bind port 443, give it `cap_net_bind_service` instead of making it SUID root, drastically reducing the blast radius of a vulnerability.

**Q7 — Advanced: How do containers implement user isolation without a hypervisor?**

> Linux **user namespaces** map a range of host UIDs to a different range inside the namespace (commonly mapping host UID 100000-165535 to container UIDs 0-65535). Inside the container, the process appears to be root (UID 0), but the kernel sees it as UID 100000 on the host with no special privileges. Combined with mount, network, and PID namespaces, this provides strong isolation without a VM.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 5 passwd` | Format of `/etc/passwd` |
| `man 5 sudoers` | Sudoers file syntax reference |
| `man 1 setfacl` / `man 1 getfacl` | ACL management |
| `man 7 capabilities` | Full Linux capabilities reference |
| `man 8 pam` | PAM overview |
| Linux PAM documentation | [linux-pam.org](http://www.linux-pam.org/Linux-PAM-html/) |
| Linux Capabilities in Practice | [man7.org/linux/man-pages/man7/capabilities.7.html](https://man7.org/linux/man-pages/man7/capabilities.7.html) |
