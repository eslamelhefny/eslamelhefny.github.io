---
layout: guide
title: "SSH & Remote Access"
description: "Master SSH key-based authentication, file transfers with SCP and rsync, SSH config aliases, local and remote port forwarding, sshd hardening, and ProxyJump chains for embedded board access."
stage: "Stage 06"
permalink: /linux-user/ssh/
prev_topic:
  title: "Networking Basics"
  url: /linux-user/networking/
next_topic:
  title: "Cron & Scheduling"
  url: /linux-user/cron/
---

## SSH Basics
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

**SSH (Secure Shell)** provides an encrypted channel for remote login, command execution, and file transfer. It replaces the insecure `telnet` and `rsh` tools.

### Connecting to a Remote Host

```bash
ssh user@hostname
ssh user@192.168.1.100
ssh -p 2222 user@hostname        # non-default port
ssh -i ~/.ssh/my_key user@host   # specify private key
ssh user@host "uname -a"         # run a command and exit
ssh -t user@host "htop"          # force pseudo-terminal allocation
```

### Key-Based Authentication (Passwordless Login)

Password authentication is weak (brute-force, phishing). Key-based auth uses asymmetric cryptography — you keep the private key, the server gets the public key.

```bash
# 1. Generate a key pair (run on YOUR local machine)
ssh-keygen -t ed25519 -C "eslam@workstation"
# Stores:  ~/.ssh/id_ed25519      (private key — protect this!)
#          ~/.ssh/id_ed25519.pub  (public key  — safe to share)

# Use RSA if the remote is an older system
ssh-keygen -t rsa -b 4096 -C "eslam@workstation"
```

```bash
# 2. Copy the public key to the remote server
ssh-copy-id user@hostname

# Manual alternative (if ssh-copy-id isn't available)
cat ~/.ssh/id_ed25519.pub | ssh user@host "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

```bash
# 3. Test (should NOT ask for password)
ssh user@hostname

# Fix permissions if SSH complains
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chmod 600 ~/.ssh/id_ed25519
```

---

## File Transfers
{:.gc-basic}

### `scp` — Secure Copy

```bash
# Local → Remote
scp file.txt user@host:/remote/path/

# Remote → Local
scp user@host:/remote/file.txt /local/path/

# Recursive (directory)
scp -r projects/ user@host:~/

# Non-default port
scp -P 2222 file.txt user@host:/tmp/
```

### `rsync` — Efficient Sync (Recommended over scp)

`rsync` only transfers changed bytes, making it much faster for large or repeated transfers.

```bash
# Sync local dir to remote
rsync -avz projects/ user@host:~/projects/
# -a = archive (recursive, preserve perms/timestamps/symlinks)
# -v = verbose
# -z = compress during transfer

# Sync remote to local
rsync -avz user@host:~/projects/ ./projects/

# Dry run (preview without making changes)
rsync -avzn projects/ user@host:~/projects/

# Delete files on destination that no longer exist at source
rsync -avz --delete projects/ user@host:~/projects/

# Exclude patterns
rsync -avz --exclude='*.o' --exclude='.git/' projects/ user@host:~/

# Non-default SSH port
rsync -avz -e "ssh -p 2222" projects/ user@host:~/
```

### `sftp` — Interactive FTP over SSH

```bash
sftp user@host
sftp> ls                  # list remote
sftp> lls                 # list local
sftp> get remote_file.txt
sftp> put local_file.txt
sftp> mput *.conf         # multiple upload
sftp> exit
```

---

## SSH Config File
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

`~/.ssh/config` defines aliases and per-host settings, making complex SSH commands into simple names.

```
# ~/.ssh/config

# General defaults
Host *
    ServerAliveInterval 60
    ServerAliveCountMax 3
    AddKeysToAgent yes

# Development server
Host devserver
    HostName 192.168.1.50
    User eslam
    Port 2222
    IdentityFile ~/.ssh/dev_key

# Raspberry Pi (embedded board)
Host rpi
    HostName 192.168.1.100
    User pi
    IdentityFile ~/.ssh/rpi_key

# Production via bastion
Host production
    HostName 10.0.0.20
    User deploy
    ProxyJump bastion
    IdentityFile ~/.ssh/prod_key

Host bastion
    HostName jump.company.com
    User eslam
    IdentityFile ~/.ssh/bastion_key
```

Now you can simply type:
```bash
ssh devserver
rsync -avz code/ rpi:~/
ssh production
```

---

## Port Forwarding (SSH Tunneling)
{:.gc-mid}

SSH can tunnel TCP connections through the encrypted channel — essential for accessing services behind firewalls or on isolated networks.

### Local Port Forwarding

Map a local port to a remote service — useful when the remote service is not publicly accessible.

```bash
# Forward local port 8080 to remote 192.168.1.10:80 via ssh-server
ssh -L 8080:192.168.1.10:80 user@ssh-server

# Now in your browser: http://localhost:8080 reaches the internal web server
```

**Diagram:**
```
[Your PC:8080] --encrypted--> [ssh-server] --> [192.168.1.10:80]
```

### Remote Port Forwarding (Reverse Tunnel)

Expose a local service to the remote server — useful for accessing a device behind NAT from the internet.

```bash
# Expose local port 3000 as port 9000 on the remote server
ssh -R 9000:localhost:3000 user@remote-server

# On the remote server: curl http://localhost:9000 reaches your local service
```

### Dynamic Port Forwarding (SOCKS Proxy)

Create a SOCKS5 proxy through the SSH server — routes all traffic through it.

```bash
ssh -D 1080 user@ssh-server

# Configure browser/system to use SOCKS5 proxy on localhost:1080
# All traffic is tunnelled through ssh-server
```

### Background (Non-Blocking) Tunnels

```bash
# -N = don't execute a remote command (tunnel only)
# -f = go to background before exec
ssh -N -f -L 5432:db-host:5432 user@ssh-server
# Now: psql -h localhost -p 5432  connects to remote Postgres
```

---

## Advanced: SSH for Embedded Development
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Accessing an Embedded Board via ProxyJump

When your target board is on an isolated network accessed through a gateway:

```bash
# Direct: gateway → board
ssh -J eslam@gateway.company.com pi@192.168.10.50

# Or in ~/.ssh/config:
Host board
    HostName 192.168.10.50
    User root
    ProxyJump gateway

Host gateway
    HostName gateway.company.com
    User eslam
    IdentityFile ~/.ssh/gateway_key
```

### Remote GDB over SSH Tunnel

Debug a process running on an embedded board from your workstation's IDE:

```bash
# On the board: start gdbserver
gdbserver :3333 ./my_firmware

# On workstation: forward the port
ssh -N -f -L 3333:localhost:3333 root@board

# In GDB / VS Code / CLion: connect to localhost:3333
gdb-multiarch ./my_firmware
(gdb) target remote localhost:3333
```

### Hardening `sshd_config`

Edit `/etc/ssh/sshd_config` and restart `sshd`:

```ini
# Disable password authentication (use keys only)
PasswordAuthentication no
ChallengeResponseAuthentication no

# Disable root login
PermitRootLogin no

# Allow only specific users
AllowUsers eslam deploy

# Change default port (security through obscurity, helps reduce noise)
Port 2222

# Disable X11 forwarding if not needed
X11Forwarding no

# Set idle timeout (disconnect idle sessions after 10 minutes)
ClientAliveInterval 300
ClientAliveCountMax 2

# Disable empty passwords
PermitEmptyPasswords no

# Use only strong algorithms
KexAlgorithms curve25519-sha256,diffie-hellman-group14-sha256
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com
```

```bash
# Test config before restarting
sudo sshd -t

# Restart sshd
sudo systemctl restart sshd
```

### `ssh-agent` and Key Management

```bash
# Start agent and add keys
eval $(ssh-agent)
ssh-add ~/.ssh/id_ed25519
ssh-add -l              # list loaded keys

# Forward agent to remote (use with care — security risk)
ssh -A user@remote

# Or in config:
Host *
    ForwardAgent yes     # careful: only enable for trusted hosts
```

### SSH Certificate Authority (for Teams)

Instead of distributing individual public keys, use an SSH CA:

```bash
# Create a CA key pair (do once, keep private key offline)
ssh-keygen -t ed25519 -f ssh_ca

# Sign a user's public key (valid for 1 day)
ssh-keygen -s ssh_ca -I "eslam@company" -n "eslam" -V +1d id_ed25519.pub

# On servers: trust the CA (add to sshd_config)
# TrustedUserCAKeys /etc/ssh/ca.pub

# Users now present their certificate — no need to copy public keys to each server
ssh -i id_ed25519-cert.pub user@server
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: How does SSH public-key authentication work?**

> 1. The client sends the public key fingerprint to the server.
> 2. The server checks if that public key is in `~/.ssh/authorized_keys`.
> 3. If found, the server generates a random challenge and encrypts it with the public key.
> 4. Only the holder of the corresponding **private key** can decrypt the challenge.
> 5. The client decrypts and proves possession of the private key — without ever transmitting it.

**Q2 — Basic: What is the difference between `scp` and `rsync`?**

> `scp` always copies the entire file regardless of changes. `rsync` calculates a rolling checksum of file blocks and only transfers the changed blocks, making it much faster for large files or repeated syncs. `rsync` also supports `--delete` for mirror-style syncs, dry-run mode, and bandwidth limiting. Use `rsync` for almost everything except very simple one-off copies.

**Q3 — Intermediate: What is local port forwarding and give a real use case?**

> Local port forwarding (`ssh -L local_port:target_host:target_port jump_host`) creates a tunnel where connections to `localhost:local_port` are forwarded through the SSH connection to `target_host:target_port`.
>
> **Real use case:** Your company's PostgreSQL database runs on an internal server (`db.internal:5432`) not exposed to the internet. You can access it from your laptop:
> ```bash
> ssh -L 5432:db.internal:5432 eslam@bastion.company.com
> psql -h localhost -p 5432 -U app_user my_db
> ```

**Q4 — Advanced: What is a ProxyJump and how does it differ from the older ProxyCommand approach?**

> `ProxyJump` (SSH 7.3+) is a cleaner replacement for the older `ProxyCommand` with `ssh -W`. Both cause the SSH client to first connect to an intermediate host and then open a TCP connection from there to the target. `ProxyJump` handles multi-hop chains natively and uses native SSH protocol operations internally, which is safer and more efficient. The old way:
> ```
> ProxyCommand ssh -W %h:%p bastion
> ```
> The new way (equivalent but cleaner):
> ```
> ProxyJump bastion
> ```

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 1 ssh` | SSH client manual |
| `man 5 ssh_config` | Client config file format |
| `man 5 sshd_config` | Server config file format |
| `man 1 rsync` | rsync manual |
| OpenSSH documentation | [openssh.com/manual.html](https://www.openssh.com/manual.html) |
| SSH Hardening Guide (Mozilla) | [infosec.mozilla.org/guidelines/openssh](https://infosec.mozilla.org/guidelines/openssh.html) |
