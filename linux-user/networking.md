---
layout: guide
title: "Networking Basics"
description: "Configure Linux network interfaces with the ip command, diagnose connectivity, master DNS resolution, capture packets with tcpdump, and write iptables firewall rules."
stage: "Stage 05"
permalink: /linux-user/networking/
prev_topic:
  title: "Package Management"
  url: /linux-user/package-management/
next_topic:
  title: "SSH & Remote Access"
  url: /linux-user/ssh/
---

## Network Fundamentals
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Every networked Linux host needs:
- A **network interface** (physical NIC or virtual `lo`, `veth`, etc.)
- An **IP address** and **subnet mask**
- A **default gateway** (router) for traffic that isn't local
- A **DNS resolver** to translate names to IP addresses

---

## The `ip` Command (iproute2)

`ip` is the modern replacement for the deprecated `ifconfig`, `route`, and `arp` commands.

### Viewing Network Configuration

```bash
# Show all interfaces with addresses
ip addr show
ip a               # shorthand

# Show a specific interface
ip addr show eth0

# Show link-layer (MAC address, MTU, state)
ip link show
ip link show eth0

# Show routing table
ip route show
ip r               # shorthand
```

**`ip addr show` output:**
```
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP
    link/ether 00:1a:2b:3c:4d:5e brd ff:ff:ff:ff:ff:ff
    inet 192.168.1.100/24 brd 192.168.1.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::21a:2bff:fe3c:4d5e/64 scope link
```

### Configuring Interfaces

```bash
# Assign a static IP address
sudo ip addr add 192.168.1.200/24 dev eth0

# Bring an interface up / down
sudo ip link set eth0 up
sudo ip link set eth0 down

# Add a default gateway
sudo ip route add default via 192.168.1.1

# Add a specific route
sudo ip route add 10.0.0.0/8 via 192.168.1.1 dev eth0

# Delete a route
sudo ip route del default via 192.168.1.1

# Flush all addresses on an interface
sudo ip addr flush dev eth0
```

> **Note:** `ip` changes are temporary and lost after reboot. For persistence, use `netplan` (Ubuntu 18+), `/etc/network/interfaces` (Debian), or `NetworkManager`.

---

## Connectivity Diagnostics
{:.gc-basic}

### `ping`

```bash
ping 8.8.8.8               # ping Google DNS
ping -c 4 google.com       # send exactly 4 packets
ping -i 0.2 192.168.1.1    # send every 200 ms
ping -s 1472 192.168.1.1   # test MTU (1472 bytes payload + 28 header = 1500)
```

**Output:**
```
PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
64 bytes from 8.8.8.8: icmp_seq=1 ttl=117 time=14.2 ms
64 bytes from 8.8.8.8: icmp_seq=2 ttl=117 time=13.9 ms
--- 8.8.8.8 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss
rtt min/avg/max/mdev = 13.9/14.0/14.2/0.1 ms
```

### `traceroute` / `tracepath`

```bash
traceroute 8.8.8.8       # trace packet path (uses UDP by default)
traceroute -T 8.8.8.8   # use TCP SYN (bypasses some firewalls)
tracepath 8.8.8.8        # similar, no root required, detects MTU
```

### Key Config Files

```bash
# Static hostname → IP mappings (checked before DNS)
cat /etc/hosts
# 127.0.0.1   localhost
# 192.168.1.10  db-server

# DNS resolver configuration
cat /etc/resolv.conf
# nameserver 8.8.8.8
# nameserver 1.1.1.1
# search home.local
```

---

## Socket and Port Analysis
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### `ss` (Socket Statistics)

`ss` replaces `netstat` and is much faster.

```bash
ss -tlnp         # TCP, listening, numeric, with process
ss -tlnp | grep :80
ss -ulnp         # UDP listening
ss -s            # summary statistics
ss -tnp          # all established TCP connections with process
```

**`ss -tlnp` output:**
```
State   Recv-Q Send-Q Local Address:Port Peer Address:Port Process
LISTEN  0      128    0.0.0.0:22        0.0.0.0:*         users:(("sshd",pid=854,fd=3))
LISTEN  0      511    0.0.0.0:80        0.0.0.0:*         users:(("nginx",pid=1023,fd=6))
```

### DNS Diagnostics

```bash
# Query DNS (detailed output)
dig google.com
dig google.com A        # A record only
dig google.com MX       # mail exchange records
dig @8.8.8.8 google.com # use specific nameserver
dig -x 8.8.8.8          # reverse lookup (PTR record)

# Quick lookup
nslookup google.com
host google.com

# Full DNS resolution path
dig +trace google.com
```

**`dig` output excerpt:**
```
;; ANSWER SECTION:
google.com.   109 IN  A  142.250.80.46

;; Query time: 12 msec
;; SERVER: 8.8.8.8#53(8.8.8.8)
```

### `curl` and `wget`

```bash
# HTTP request (shows response body)
curl https://api.ipify.org

# With headers
curl -I https://example.com          # HEAD request only
curl -v https://example.com          # verbose (headers + body)
curl -o output.html https://example.com  # save to file
curl -L https://short.url/abc        # follow redirects
curl -u user:pass https://api.example.com  # basic auth
curl -X POST -H "Content-Type: application/json" \
     -d '{"key":"value"}' https://api.example.com/endpoint

# Download file
wget https://example.com/file.tar.gz
wget -c https://example.com/big.iso  # resume interrupted download
```

---

## Packet Capture with tcpdump
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

`tcpdump` captures packets on an interface for real-time analysis or saving to `.pcap` for Wireshark.

```bash
# Capture on default interface
sudo tcpdump

# Capture on specific interface
sudo tcpdump -i eth0

# Show numeric (don't resolve hostnames/ports)
sudo tcpdump -n -i eth0

# Capture to file (for Wireshark)
sudo tcpdump -i eth0 -w capture.pcap

# Read a capture file
tcpdump -r capture.pcap

# Capture only 100 packets
sudo tcpdump -c 100 -i eth0
```

### BPF Filters

```bash
# Capture only HTTP traffic (port 80)
sudo tcpdump -i eth0 -n port 80

# Capture traffic to/from a host
sudo tcpdump -i eth0 host 192.168.1.50

# Capture ICMP only
sudo tcpdump -i eth0 icmp

# TCP SYN packets (connection attempts)
sudo tcpdump -i eth0 'tcp[tcpflags] & tcp-syn != 0'

# Capture traffic between two hosts on port 443
sudo tcpdump -i eth0 host 192.168.1.50 and port 443

# Verbose + ASCII payload dump
sudo tcpdump -i eth0 -A -v port 80
```

---

## iptables — Firewall Rules
{:.gc-adv}

`iptables` filters packets using rules in chains (`INPUT`, `OUTPUT`, `FORWARD`) within tables (`filter`, `nat`, `mangle`).

### Viewing Rules

```bash
sudo iptables -L -n -v --line-numbers    # list filter table
sudo iptables -t nat -L -n -v            # list NAT table
sudo iptables-save                       # dump all rules
```

### Essential Commands

```bash
# Allow established connections (always add this first!)
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow SSH from anywhere
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP and HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow loopback interface
sudo iptables -A INPUT -i lo -j ACCEPT

# Drop everything else (default deny)
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP

# Allow outgoing traffic
sudo iptables -P OUTPUT ACCEPT
```

### NAT — Network Address Translation

```bash
# Enable IP forwarding
echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward
# Make permanent: add net.ipv4.ip_forward = 1 to /etc/sysctl.conf

# Masquerade (for NAT router / sharing internet)
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# Port forwarding (forward external port 8080 to internal 80)
sudo iptables -t nat -A PREROUTING -p tcp --dport 8080 -j REDIRECT --to-port 80
```

### Persisting iptables Rules

```bash
sudo apt install iptables-persistent
sudo netfilter-persistent save
sudo netfilter-persistent reload
```

---

## Network Namespaces
{:.gc-adv}

Network namespaces are the kernel feature behind Docker networking and virtual network topologies.

```bash
# Create a namespace
sudo ip netns add myns

# List namespaces
ip netns list

# Run a command inside the namespace
sudo ip netns exec myns bash

# Inside: check interfaces (only lo exists)
ip addr show

# Create a veth pair (virtual Ethernet cable)
sudo ip link add veth0 type veth peer name veth1

# Move one end into the namespace
sudo ip link set veth1 netns myns

# Configure both ends
sudo ip addr add 10.0.0.1/24 dev veth0
sudo ip link set veth0 up
sudo ip netns exec myns ip addr add 10.0.0.2/24 dev veth1
sudo ip netns exec myns ip link set veth1 up
sudo ip netns exec myns ip link set lo up

# Test connectivity
ping -c 3 10.0.0.2
sudo ip netns exec myns ping -c 3 10.0.0.1
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `ip addr` and `ip link`?**

> `ip link` shows Layer 2 (data-link) information: interface name, MAC address, MTU, operational state (UP/DOWN). `ip addr` shows Layer 3 (network) information: IP addresses assigned to interfaces, plus all the Layer 2 information. For IP configuration, use `ip addr`; to just bring an interface up/down, use `ip link set`.

**Q2 — Basic: What happens when you ping a hostname? Walk through the resolution steps.**

> 1. The shell calls `getaddrinfo()` to resolve the hostname.
> 2. NSS (Name Service Switch, `/etc/nsswitch.conf`) determines lookup order — typically `files dns`.
> 3. `/etc/hosts` is checked first. If found, the IP is returned.
> 4. If not in `/etc/hosts`, a DNS query is sent to the nameserver in `/etc/resolv.conf`.
> 5. The DNS server returns an A record (IPv4) or AAAA record (IPv6).
> 6. `ping` sends ICMP Echo Request packets to that IP address.

**Q3 — Intermediate: What does `ss -tlnp` show and what do the flags mean?**

> `-t` = TCP sockets only; `-l` = listening sockets only; `-n` = numeric output (don't resolve port names or hostnames); `-p` = show the process (PID + name) that owns the socket. Combined, it quickly answers "what is listening on which port?"

**Q4 — Intermediate: How would you diagnose why a service cannot be reached from outside the host?**

> Systematically eliminate layers:
> 1. Is the service actually running and listening? (`ss -tlnp | grep :PORT`)
> 2. Is it listening on `0.0.0.0` (all interfaces) or only `127.0.0.1` (loopback)?
> 3. Does a local `curl localhost:PORT` work?
> 4. Is a firewall blocking the port? (`sudo iptables -L -n -v`, `sudo ufw status`)
> 5. Is the port reachable from another host? (`telnet <IP> PORT` or `nc -zv <IP> PORT`)
> 6. Is routing correct on the network path? (`traceroute <IP>`)

**Q5 — Advanced: Explain the difference between PREROUTING, POSTROUTING, INPUT, OUTPUT, and FORWARD chains in iptables.**

> These are the five built-in chains in netfilter, traversed in a specific order:
> - **PREROUTING**: Hit first for all incoming packets, before routing decisions. Used for DNAT (port forwarding).
> - **INPUT**: For packets destined for the local machine after routing.
> - **FORWARD**: For packets being routed through the machine to another host (requires `ip_forward=1`).
> - **OUTPUT**: For packets generated locally before they leave.
> - **POSTROUTING**: Hit last for all outgoing packets after routing. Used for MASQUERADE/SNAT (NAT for routers).

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 8 ip` | iproute2 documentation |
| `man 8 iptables` | iptables manual |
| `man 8 tcpdump` | tcpdump + BPF filter syntax |
| Linux Networking Documentation | [kernel.org/doc/html/latest/networking](https://www.kernel.org/doc/html/latest/networking/) |
| Julia Evans — Networking Zines | [jvns.ca](https://jvns.ca/networking-zine.pdf) |
| Netfilter / iptables tutorial | [netfilter.org/documentation](https://www.netfilter.org/documentation/) |
