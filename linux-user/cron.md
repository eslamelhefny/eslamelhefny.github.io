---
layout: guide
title: "Cron & Scheduling"
description: "Schedule recurring and one-off tasks with cron, at, and systemd timers. Handle environment quirks, prevent job overlap with flock, and monitor scheduled task output."
stage: "Stage 07"
permalink: /linux-user/cron/
prev_topic:
  title: "SSH & Remote Access"
  url: /linux-user/ssh/
next_topic:
  title: "Bash Scripting"
  url: /linux-user/bash-scripting/
---

## Cron Fundamentals
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

**cron** is the classic Unix daemon that runs scheduled commands at specified times. Each user has their own **crontab** (cron table), and the system also has system-wide crontabs.

### Crontab Syntax

```
* * * * *  command_to_run
│ │ │ │ │
│ │ │ │ └── Day of week  (0–7, Sunday=0 or 7)
│ │ │ └──── Month        (1–12)
│ │ └────── Day of month (1–31)
│ └──────── Hour         (0–23)
└────────── Minute       (0–59)
```

**Special characters:**

| Symbol | Meaning | Example |
|--------|---------|---------|
| `*` | Every value | `* * * * *` = every minute |
| `,` | List of values | `0,30 * * * *` = at :00 and :30 |
| `-` | Range | `0 9-17 * * *` = every hour 9am–5pm |
| `/` | Step | `*/5 * * * *` = every 5 minutes |
| `@reboot` | On boot | `@reboot /usr/bin/myservice` |
| `@daily` | Once per day | same as `0 0 * * *` |
| `@weekly` | Once per week | same as `0 0 * * 0` |
| `@monthly` | Once per month | same as `0 0 1 * *` |

### Managing Your Crontab

```bash
crontab -e     # edit your crontab (opens in $EDITOR)
crontab -l     # list current crontab
crontab -r     # REMOVE your entire crontab (careful!)
crontab -u eslam -l   # list another user's crontab (root only)
```

### Example Entries

```bash
# Run backup every day at 2:30 AM
30 2 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1

# Clear temp files every Sunday at midnight
0 0 * * 0 find /tmp -type f -mtime +7 -delete

# Sync files every 15 minutes
*/15 * * * * /usr/local/bin/sync_data.sh

# Send weekly report every Monday at 8 AM
0 8 * * 1 /usr/local/bin/weekly_report.sh | mail -s "Weekly Report" boss@company.com

# Run at system reboot
@reboot /usr/local/bin/start_sensor_daemon.sh

# Run first day of each month at 5 AM
0 5 1 * * /usr/local/bin/monthly_cleanup.sh
```

---

## System Cron Directories
{:.gc-basic}

The system crontab (`/etc/crontab`) and special directories run scripts automatically:

```
/etc/cron.d/         → Drop-in crontab files (include username field)
/etc/cron.hourly/    → Scripts run every hour
/etc/cron.daily/     → Scripts run every day (~6:25 AM)
/etc/cron.weekly/    → Scripts run every week
/etc/cron.monthly/   → Scripts run every month
```

**`/etc/cron.d/` format** (includes username):
```bash
# /etc/cron.d/myapp
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# min hour dom month dow user  command
30  2   * * *  root  /opt/myapp/bin/backup >> /var/log/myapp-backup.log 2>&1
```

**Placing scripts in directories:**
```bash
# Scripts must be executable and have no dot in the filename!
sudo cp backup.sh /etc/cron.daily/mybackup   # no extension!
sudo chmod 755 /etc/cron.daily/mybackup
```

---

## One-Off Scheduling with `at`
{:.gc-basic}

`at` runs a command once at a specific future time, without needing to edit a crontab.

```bash
# Schedule a job
at 14:30                          # at 2:30 PM today
at 2:30 AM tomorrow
at 9:00 AM July 4                 # specific date
at now + 2 hours                  # relative time
at now + 30 minutes

# at opens a shell prompt; type commands, then Ctrl+D to submit
at 14:30
at> /usr/local/bin/deploy.sh >> /var/log/deploy.log 2>&1
at> <EOT>                        # press Ctrl+D

# List pending at jobs
atq

# Remove a job
atrm 5          # remove job number 5

# Alternative one-liner
echo "/usr/local/bin/deploy.sh" | at 14:30
```

---

## Intermediate: Cron Environment and Logging
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### The Cron Environment Problem

Cron runs with a **minimal environment** — no `.bashrc`, no user PATH, no display. This is the #1 cause of "works in terminal, breaks in cron" bugs.

```bash
# The default cron PATH is usually just:
PATH=/usr/bin:/bin

# Your terminal PATH might be:
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/home/eslam/.local/bin
```

**Solutions:**

```bash
# Option 1: Set PATH at the top of crontab
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Option 2: Use full paths in commands
0 2 * * * /usr/local/bin/python3 /home/eslam/scripts/backup.py

# Option 3: Source your profile inside the script
0 2 * * * bash -l -c '/home/eslam/scripts/backup.sh'
# -l = login shell (sources /etc/profile and ~/.bash_profile)
```

**Other environment pitfalls:**
```bash
# No HOME by default in some crons — set explicitly
HOME=/home/eslam

# No DISPLAY for GUI apps
DISPLAY=:0

# Redirect all output (otherwise cron emails you on every run!)
*/5 * * * * /usr/local/bin/monitor.sh >> /var/log/monitor.log 2>&1

# Suppress all output
*/5 * * * * /usr/local/bin/noisy.sh > /dev/null 2>&1
```

### Viewing Cron Logs

```bash
# On Ubuntu/Debian (syslog backend)
grep CRON /var/log/syslog
grep CRON /var/log/syslog | tail -50

# With journald (systemd systems)
journalctl -u cron
journalctl -u cron -f    # live

# View cron daemon status
sudo systemctl status cron
```

---

## Preventing Overlapping Jobs with `flock`
{:.gc-mid}

If a cron job takes longer than its interval, multiple instances can run simultaneously, causing race conditions, data corruption, or resource exhaustion.

```bash
# flock acquires a file lock; -n = non-blocking (exit immediately if locked)
*/5 * * * * flock -n /tmp/myjob.lock /usr/local/bin/data_sync.sh

# With timeout — wait up to 30 seconds to acquire lock
*/5 * * * * flock -w 30 /tmp/myjob.lock /usr/local/bin/data_sync.sh
```

**Inside a script:**
```bash
#!/bin/bash
LOCKFILE="/var/lock/myjob.lock"

exec 200>"$LOCKFILE"
flock -n 200 || { echo "Already running, exiting."; exit 1; }
# Lock acquired — do work
/usr/local/bin/long_running_task.sh
# Lock released automatically when script exits
```

---

## Advanced: systemd Timers
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

**systemd timers** are the modern alternative to cron. They offer:
- Logging via `journald` (no output capture headaches)
- Accurate tracking via `systemctl list-timers`
- Dependencies (`After=`, `Requires=`)
- Monotonic (elapsed time) or calendar-based triggers
- Easy enable/disable with `systemctl`

### Creating a systemd Timer

A timer requires **two unit files**: a `.timer` and a matching `.service`.

**`/etc/systemd/system/backup.service`:**
```ini
[Unit]
Description=Daily Backup Job
After=network.target

[Service]
Type=oneshot
User=eslam
Group=eslam
WorkingDirectory=/home/eslam
ExecStart=/usr/local/bin/backup.sh
StandardOutput=journal
StandardError=journal
```

**`/etc/systemd/system/backup.timer`:**
```ini
[Unit]
Description=Run backup daily at 2:30 AM
Requires=backup.service

[Timer]
# Calendar-based (like cron)
OnCalendar=*-*-* 02:30:00

# Or: relative to last run (monotonic)
# OnBootSec=15min
# OnUnitActiveSec=1h

# Randomize start within 10 minutes (prevents thundering herd)
RandomizedDelaySec=600

# Persist: if missed (e.g., machine was off), run ASAP when next available
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
# Enable and start the timer
sudo systemctl daemon-reload
sudo systemctl enable --now backup.timer

# Check all timers
systemctl list-timers

# View logs for the service
journalctl -u backup.service
journalctl -u backup.service --since "1 day ago"

# Manually trigger the service (for testing)
sudo systemctl start backup.service
```

**`systemctl list-timers` output:**
```
NEXT                         LEFT          LAST                         PASSED   UNIT           ACTIVATES
Sat 2026-03-08 02:30:00 EET  12h left      Fri 2026-03-07 02:30:13 EET  11h ago  backup.timer   backup.service
```

### `OnCalendar` Syntax

```
OnCalendar=*-*-* 02:30:00       # daily at 2:30 AM
OnCalendar=Mon *-*-* 08:00:00   # every Monday at 8 AM
OnCalendar=*-*-1 00:00:00       # first of each month
OnCalendar=weekly               # weekly (shorthand)
OnCalendar=*:0/5                # every 5 minutes
OnCalendar=hourly               # every hour

# Validate your expression
systemd-analyze calendar "Mon *-*-* 08:00:00"
```

### `anacron` — For Non-24/7 Systems

If a cron job is missed (because the machine was off), it is simply skipped. `anacron` addresses this for daily/weekly/monthly jobs on laptops and workstations.

```bash
cat /etc/anacrontab
# delay  job-id   command
1        5 cron.daily    run-parts --report /etc/cron.daily
7        10 cron.weekly  run-parts --report /etc/cron.weekly
30       15 cron.monthly run-parts --report /etc/cron.monthly
# Column 1: period in days
# Column 2: delay in minutes after boot before running
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: Write a cron entry to run a backup script at 3 AM every day.**

```
0 3 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1
```

**Q2 — Basic: Why does a script work when run manually but fail when run by cron?**

> Almost always an **environment difference**: cron runs with a minimal `PATH` that doesn't include `/usr/local/bin`, user-specific directories, or NVM/pyenv shims. The script may also rely on environment variables set in `.bashrc` or `.bash_profile`. Fix by setting `PATH` at the top of the crontab, using full paths to all executables, or sourcing the user's profile with `bash -l -c`.

**Q3 — Intermediate: How would you make a cron job skip execution if the previous instance is still running?**

```bash
*/5 * * * * flock -n /tmp/myjob.lock /usr/local/bin/sync.sh
```
`flock -n` tries to acquire the lock non-blocking. If another instance holds the lock, it exits immediately (exits 1), and cron moves on without starting a new instance.

**Q4 — Advanced: What advantages do systemd timers have over cron?**

> 1. **Logging**: All output goes to `journald`; no need to redirect to files or worry about cron emails.
> 2. **Visibility**: `systemctl list-timers` shows all timers, their next run, last run, and elapsed time in one place.
> 3. **Persistence**: `Persistent=true` in the timer unit means missed jobs are run at next boot.
> 4. **Dependencies**: Timers can declare dependencies on network, filesystem mounts, etc.
> 5. **Resource control**: Services started by timers inherit systemd's cgroup resource limits (CPUQuota, MemoryMax).
> 6. **Randomization**: `RandomizedDelaySec` prevents multiple servers from hammering a shared resource simultaneously.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 5 crontab` | Crontab file format |
| `man 1 crontab` | Crontab command |
| `man 1 at` | at command manual |
| `man 1 flock` | flock manual |
| `man 5 systemd.timer` | systemd timer unit format |
| `man 7 systemd.time` | Time and date specification syntax |
| systemd timer tutorial | [wiki.archlinux.org/title/Systemd/Timers](https://wiki.archlinux.org/title/Systemd/Timers) |
