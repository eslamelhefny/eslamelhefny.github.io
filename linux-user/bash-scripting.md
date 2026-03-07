---
layout: guide
title: "Bash Scripting"
description: "Write production-quality shell scripts with variables, arrays, conditionals, loops, functions, error handling, and powerful text processing with sed, awk, and pipelines."
stage: "Stage 08"
permalink: /linux-user/bash-scripting/
prev_topic:
  title: "Cron & Scheduling"
  url: /linux-user/cron/
next_topic:
  title: "Git Basics"
  url: /linux-user/git/
---

## Shell Script Basics
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

A Bash script is a plain text file containing shell commands executed in sequence.

### The Shebang and First Script

```bash
#!/usr/bin/env bash
# ^^^ shebang: tells the OS which interpreter to use
# Use /usr/bin/env bash (portable) rather than /bin/bash (hardcoded)

echo "Hello, World!"
```

```bash
# Make executable and run
chmod +x hello.sh
./hello.sh
```

**Best practices to add at the top of every script:**
```bash
#!/usr/bin/env bash
set -euo pipefail
# -e = exit immediately on error
# -u = treat unset variables as errors
# -o pipefail = if any command in a pipeline fails, the pipeline fails
IFS=$'\n\t'    # safer word splitting
```

---

## Variables
{:.gc-basic}

```bash
# Assignment (no spaces around =)
name="Eslam"
count=42
pi=3.14

# Access with $
echo "Hello, $name"
echo "Count: ${count}"    # braces: needed for disambiguation

# Command substitution
today=$(date +%Y-%m-%d)
files=$(ls /tmp)
kernel=$(uname -r)

echo "Today is $today, kernel is $kernel"

# Arithmetic
a=5
b=3
result=$((a + b))
result=$((a * b))
result=$((a % b))      # modulo
echo $((2 ** 10))      # 1024

# Readonly (constant)
readonly MAX_RETRIES=5
```

### Special Variables

| Variable | Meaning |
|----------|---------|
| `$0` | Script name |
| `$1`, `$2`, … | Positional arguments |
| `$#` | Number of arguments |
| `$@` | All arguments (as separate words) |
| `$*` | All arguments (as one word) |
| `$$` | Current script PID |
| `$?` | Exit status of last command (0 = success) |
| `$!` | PID of last background process |
| `$LINENO` | Current line number |
| `$BASH_SOURCE` | Path to current script |

```bash
#!/usr/bin/env bash
echo "Script: $0"
echo "First arg: $1"
echo "All args: $@"
echo "Arg count: $#"
```

---

## Strings and Substitution
{:.gc-basic}

```bash
str="Hello, World!"

echo ${#str}               # length: 13
echo ${str:0:5}            # substring: Hello
echo ${str^^}              # uppercase: HELLO, WORLD!
echo ${str,,}              # lowercase: hello, world!
echo ${str/World/Bash}     # replace first: Hello, Bash!
echo ${str//l/L}           # replace all:   HeLLo, WorLd!

# Default values
echo ${name:-"anonymous"}  # use "anonymous" if name is unset or empty
echo ${port:=8080}         # assign default if unset
echo ${file:?"file is required"}  # exit with error if unset

# Strip prefix / suffix
file="archive.tar.gz"
echo ${file%.gz}           # archive.tar     (strip shortest suffix)
echo ${file%%.*}           # archive         (strip longest suffix)
echo ${file#*.}            # tar.gz          (strip shortest prefix)
echo ${file##*.}           # gz              (strip longest prefix)
```

---

## Arrays
{:.gc-basic}

```bash
# Indexed array
fruits=("apple" "banana" "cherry")
fruits[3]="date"

echo ${fruits[0]}          # apple
echo ${fruits[@]}          # all elements
echo ${#fruits[@]}         # count: 4
echo ${!fruits[@]}         # indices: 0 1 2 3

# Append
fruits+=("elderberry")

# Iterate
for fruit in "${fruits[@]}"; do
  echo "$fruit"
done

# Associative array (Bash 4+)
declare -A config
config["host"]="localhost"
config["port"]="5432"
config["name"]="mydb"

echo ${config["host"]}
for key in "${!config[@]}"; do
  echo "$key = ${config[$key]}"
done
```

---

## Conditionals
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### `if` / `elif` / `else`

```bash
# Numeric comparison: -eq -ne -lt -le -gt -ge
if [[ $count -gt 10 ]]; then
  echo "greater than 10"
elif [[ $count -eq 10 ]]; then
  echo "exactly 10"
else
  echo "less than 10"
fi

# String comparison: = != < > -z (empty) -n (non-empty)
if [[ "$name" == "Eslam" ]]; then
  echo "Hi Eslam"
fi

if [[ -z "$input" ]]; then
  echo "Error: no input provided" >&2
  exit 1
fi

# File tests
if [[ -f /etc/nginx/nginx.conf ]]; then
  echo "nginx is configured"
fi

if [[ -d /tmp/workdir ]]; then
  echo "workdir exists"
fi

if [[ -x /usr/bin/python3 ]]; then
  echo "python3 is executable"
fi

# Combined conditions
if [[ -f "$config" && -r "$config" ]]; then
  source "$config"
fi

if [[ $OS == "linux" || $OS == "darwin" ]]; then
  echo "Unix-like OS"
fi
```

### File Test Operators

| Test | Meaning |
|------|---------|
| `-e file` | File exists |
| `-f file` | Regular file |
| `-d file` | Directory |
| `-r file` | Readable |
| `-w file` | Writable |
| `-x file` | Executable |
| `-s file` | Non-empty (size > 0) |
| `-L file` | Symbolic link |
| `f1 -nt f2` | f1 is newer than f2 |
| `f1 -ot f2` | f1 is older than f2 |

### `case` Statement

```bash
case "$1" in
  start)
    echo "Starting service..."
    systemctl start myapp
    ;;
  stop)
    echo "Stopping service..."
    systemctl stop myapp
    ;;
  restart|reload)
    systemctl restart myapp
    ;;
  status)
    systemctl status myapp
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|reload|status}"
    exit 1
    ;;
esac
```

---

## Loops
{:.gc-mid}

```bash
# for loop over list
for item in one two three; do
  echo "$item"
done

# for loop over array
for file in "${files[@]}"; do
  process "$file"
done

# C-style for loop
for ((i=0; i<10; i++)); do
  echo "i = $i"
done

# while loop
count=0
while [[ $count -lt 5 ]]; do
  echo "count = $count"
  ((count++))
done

# Read lines from a file
while IFS= read -r line; do
  echo "$line"
done < /etc/hosts

# Read command output
while IFS= read -r line; do
  echo "Processing: $line"
done < <(find /var/log -name "*.log" -mtime -1)

# until loop (runs while condition is FALSE)
until ping -c1 8.8.8.8 &>/dev/null; do
  echo "Waiting for network..."
  sleep 2
done
echo "Network is up!"

# Loop control
for i in {1..10}; do
  [[ $i -eq 5 ]] && continue    # skip 5
  [[ $i -eq 8 ]] && break       # stop at 8
  echo $i
done
```

---

## Functions
{:.gc-mid}

```bash
# Define a function
greet() {
  local name="$1"        # 'local' limits scope to the function
  local greeting="${2:-Hello}"
  echo "${greeting}, ${name}!"
}

# Call it
greet "Eslam"
greet "Eslam" "Hi"

# Return values: use exit status (0–255)
is_root() {
  [[ $(id -u) -eq 0 ]]
}

if is_root; then
  echo "Running as root"
fi

# Return a string value via stdout
get_timestamp() {
  date +%Y%m%d_%H%M%S
}

ts=$(get_timestamp)
echo "Backup timestamp: $ts"

# Function with validation
require_arg() {
  local var_name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "Error: $var_name is required" >&2
    exit 1
  fi
}

require_arg "hostname" "$HOST"
```

---

## Error Handling
{:.gc-mid}

```bash
#!/usr/bin/env bash
set -euo pipefail

# Custom error handler
error() {
  echo "[ERROR] $1" >&2
  exit 1
}

# Trap for cleanup on exit
cleanup() {
  rm -f /tmp/work_$$
  echo "Cleaned up temporary files"
}
trap cleanup EXIT          # runs on any exit
trap 'error "Caught SIGINT"' INT
trap 'error "Caught SIGTERM"' TERM

# Check command success
if ! cp source.txt destination.txt; then
  error "Failed to copy file"
fi

# Check exit code
rsync -av src/ dst/ || error "rsync failed"

# Ensure required commands exist
for cmd in git curl jq; do
  command -v "$cmd" >/dev/null 2>&1 || error "$cmd is required but not installed"
done
```

---

## Advanced: Text Processing
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### `grep` — Pattern Search

```bash
grep "error" /var/log/syslog
grep -i "error" /var/log/syslog          # case-insensitive
grep -r "TODO" ./src/                    # recursive
grep -n "error" file.txt                 # show line numbers
grep -v "DEBUG" app.log                  # invert (lines NOT matching)
grep -E "error|warning|critical" app.log # extended regex
grep -c "error" app.log                  # count matching lines
grep -A 3 "CRASH" app.log               # 3 lines after match
grep -B 2 "CRASH" app.log               # 2 lines before match
grep -o "ERROR:[0-9]+" app.log          # only the matching part
```

### `sed` — Stream Editor

```bash
# Substitute (find + replace)
sed 's/old/new/' file.txt            # first occurrence per line
sed 's/old/new/g' file.txt           # all occurrences
sed 's/old/new/gi' file.txt          # case-insensitive
sed -i 's/localhost/prod.server/g' config.conf   # in-place edit

# Delete lines
sed '/^#/d' file.txt                 # delete comment lines
sed '/^$/d' file.txt                 # delete blank lines
sed '5d' file.txt                    # delete line 5

# Print specific lines
sed -n '10,20p' file.txt             # lines 10–20
sed -n '/START/,/END/p' file.txt     # between patterns

# Insert / append
sed '5i\New line here' file.txt      # insert before line 5
sed '5a\New line here' file.txt      # append after line 5
```

### `awk` — Pattern Scanning and Processing

```bash
# Print specific fields (columns)
awk '{print $1, $3}' file.txt         # columns 1 and 3
awk -F: '{print $1}' /etc/passwd      # use : as delimiter (list usernames)
awk -F: '$3 >= 1000 {print $1}' /etc/passwd   # users with UID >= 1000

# Sum a column
awk '{sum += $2} END {print "Total:", sum}' data.txt

# Count lines matching a pattern
awk '/error/ {count++} END {print count}' app.log

# Filter by field value
awk '$3 > 100 {print $0}' data.txt

# Print field with custom formatting
ps aux | awk 'NR>1 {printf "%-20s %5s%%\n", $11, $3}'

# BEGIN and END blocks
awk 'BEGIN {print "=== Report ==="} /ERROR/ {print NR, $0} END {print "Done"}' app.log
```

### Pipelines and Process Substitution

```bash
# Classic pipeline: output of one becomes input of next
cat /var/log/auth.log | grep "Failed password" | awk '{print $11}' | sort | uniq -c | sort -rn | head -10
# ^ find top 10 IPs failing SSH logins

# Process substitution: use command output as a file
diff <(sort file1.txt) <(sort file2.txt)
while IFS= read -r line; do echo "$line"; done < <(command_that_produces_output)

# Here-string
grep "pattern" <<< "some string to search"

# Here-doc
cat <<EOF > config.yml
host: localhost
port: 5432
name: mydb
EOF

# xargs: build command from stdin
find /tmp -name "*.log" | xargs rm -f
find . -name "*.c" | xargs wc -l
echo "host1 host2 host3" | xargs -n1 ping -c1
```

---

## Script Templates
{:.gc-adv}

### Production Script Template

```bash
#!/usr/bin/env bash
# ==============================================================
# Script: deploy.sh
# Purpose: Deploy application to production server
# Author: Eslam Mohamed
# Usage: ./deploy.sh [--env production|staging] [--tag v1.2.3]
# ==============================================================

set -euo pipefail
IFS=$'\n\t'

# Constants
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly LOG_FILE="/var/log/deploy.log"

# Defaults
ENV="staging"
TAG="latest"

# Colors (only if terminal supports it)
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

log()   { echo -e "${GREEN}[INFO]${NC}  $*" | tee -a "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE" >&2; }
die()   { error "$*"; exit 1; }

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS]

Options:
  --env       Environment (production|staging) [default: staging]
  --tag       Docker image tag [default: latest]
  -h, --help  Show this help

Examples:
  $SCRIPT_NAME --env production --tag v1.2.3
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)  ENV="$2";  shift 2 ;;
    --tag)  TAG="$2";  shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

# Validate
[[ "$ENV" =~ ^(production|staging)$ ]] || die "Invalid env: $ENV"

# Cleanup on exit
cleanup() {
  log "Cleanup complete."
}
trap cleanup EXIT

# Main
log "Starting deployment: ENV=$ENV TAG=$TAG"
# ... deployment logic ...
log "Deployment complete!"
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What does `set -euo pipefail` do?**

> - `set -e`: Exit the script immediately if any command returns a non-zero exit code.
> - `set -u`: Treat references to unset variables as errors (instead of silently substituting empty string).
> - `set -o pipefail`: If any command in a pipeline fails, the whole pipeline's exit code is that failure. Without it, `false | true` returns 0 (success) because only the last command's status is used.

**Q2 — Basic: What is the difference between `$@` and `$*`?**

> When quoted, `"$@"` expands each argument as a separate word, preserving arguments with spaces. `"$*"` expands all arguments as a single word joined by the first character of `IFS`. Use `"$@"` when passing arguments to another command: `run_cmd "$@"` correctly handles `run_cmd "hello world" "foo"` as two arguments.

**Q3 — Intermediate: How do you read a file line by line safely in bash?**

```bash
while IFS= read -r line; do
  echo "$line"
done < file.txt
```
> `IFS=` prevents leading/trailing whitespace from being stripped. `-r` prevents backslash interpretation. This is the idiomatic safe approach — `for line in $(cat file)` is wrong because it word-splits on spaces.

**Q4 — Intermediate: Explain process substitution `<(command)` vs a pipe.**

> A pipe (`cmd1 | cmd2`) runs `cmd2` in a subshell and only connects `cmd2`'s stdin. Process substitution `<(cmd1)` creates a named pipe (FIFO) and presents it as a filename — so any command that expects a **file argument** (not stdin) can use it. Example: `diff <(sort a.txt) <(sort b.txt)` — `diff` expects two file arguments, not stdin.

**Q5 — Advanced: How would you find the top 10 IP addresses causing failed SSH login attempts?**

```bash
grep "Failed password" /var/log/auth.log \
  | awk '{print $(NF-3)}' \
  | sort \
  | uniq -c \
  | sort -rn \
  | head -10
```
> Breakdown: `grep` filters for failed logins; `awk` extracts the IP field (3rd from end); `sort` + `uniq -c` counts occurrences; `sort -rn` orders by count descending; `head -10` limits output.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 1 bash` | Bash reference manual |
| Bash Manual (GNU) | [gnu.org/software/bash/manual](https://www.gnu.org/software/bash/manual/bash.html) |
| Google Shell Style Guide | [google.github.io/styleguide/shellguide.html](https://google.github.io/styleguide/shellguide.html) |
| ShellCheck (linter) | [shellcheck.net](https://www.shellcheck.net) |
| The Art of Command Line | [github.com/jlevy/the-art-of-command-line](https://github.com/jlevy/the-art-of-command-line) |
| `man 1 awk` / `man 1 sed` | awk and sed manuals |
