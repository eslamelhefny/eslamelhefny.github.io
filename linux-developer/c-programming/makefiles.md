---
layout: guide
title: "Makefiles"
description: "Write Makefiles from scratch — rules, variables, automatic variables, pattern rules, phony targets, dependency tracking, and multi-directory project structures."
stage: "Stage 02"
phase: "linux-developer-c"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C Programming"
phase_index: "/linux-developer/c-programming/"
permalink: /linux-developer/c-programming/makefiles/
prev_topic:
  title: "Dynamic Allocation"
  url: /linux-developer/c-programming/dynamic-allocation/
next_topic:
  title: "GCC Flags & Optimization"
  url: /linux-developer/c-programming/gcc-optimization/
---

## Make Basics
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

`make` reads a `Makefile` and rebuilds only the files that are out of date, saving time on large projects.

### Anatomy of a Rule

```makefile
target: dependencies
	recipe          # MUST be indented with a TAB (not spaces!)
```

### A Minimal Makefile

```makefile
# Build the 'app' binary from main.c and utils.c
app: main.o utils.o
	gcc -o app main.o utils.o

main.o: main.c utils.h
	gcc -c main.c

utils.o: utils.c utils.h
	gcc -c utils.c

clean:
	rm -f app *.o
```

```bash
make          # builds 'app' (first target)
make clean    # removes build artifacts
make utils.o  # build a specific target
```

---

## Variables
{:.gc-basic}

```makefile
CC      = gcc
CFLAGS  = -Wall -Wextra -O2 -g
LDFLAGS = -lm
TARGET  = app
SRCS    = main.c utils.c sensor.c
OBJS    = $(SRCS:.c=.o)        # text substitution: replace .c with .o

$(TARGET): $(OBJS)
	$(CC) $(LDFLAGS) -o $@ $^

%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $<

clean:
	rm -f $(TARGET) $(OBJS)
```

### Automatic Variables

| Variable | Meaning |
|----------|---------|
| `$@` | The **target** name |
| `$<` | The **first** dependency |
| `$^` | **All** dependencies (deduplicated) |
| `$?` | All dependencies **newer** than target |
| `$*` | The stem matched by `%` in pattern rules |

```makefile
%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $<
#                          ^^  target (e.g. main.o)
#                             ^^ first dep (main.c)
```

---

## Pattern Rules and Phony Targets
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

### Pattern Rules

Instead of a rule per `.c` file, one pattern rule handles all of them:

```makefile
# Compile any .c file into a .o file
%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $<
```

### Phony Targets

Targets that don't produce a file — always run when requested:

```makefile
.PHONY: all clean install test

all: $(TARGET)

clean:
	rm -f $(TARGET) $(OBJS) $(DEPS)

install: $(TARGET)
	install -m 755 $(TARGET) /usr/local/bin/

test: $(TARGET)
	./run_tests.sh
```

Without `.PHONY`, if a file named `clean` exists, `make clean` would do nothing.

---

## Automatic Dependency Tracking
{:.gc-mid}

When a header changes, only the `.c` files that include it should recompile. Generate `.d` dependency files automatically with GCC:

```makefile
CC      = gcc
CFLAGS  = -Wall -O2 -g
DEPFLAGS = -MMD -MP            # generate .d files alongside .o files

TARGET = app
SRCS   = $(wildcard src/*.c)
OBJS   = $(SRCS:src/%.c=build/%.o)
DEPS   = $(OBJS:.o=.d)

$(TARGET): $(OBJS)
	$(CC) -o $@ $^

build/%.o: src/%.c | build
	$(CC) $(CFLAGS) $(DEPFLAGS) -c -o $@ $<

build:
	mkdir -p build

-include $(DEPS)               # include .d files; '-' suppresses error if missing

.PHONY: clean
clean:
	rm -rf build $(TARGET)
```

The `-MMD -MP` flags make GCC output e.g. `build/utils.d`:
```makefile
build/utils.o: src/utils.c src/utils.h src/config.h
src/utils.h:
src/config.h:
```

---

## Advanced: Multi-Directory Projects
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### Recursive Make (Traditional)

```makefile
# Top-level Makefile
SUBDIRS = lib src tests

.PHONY: all clean $(SUBDIRS)

all: $(SUBDIRS)
src: lib        # src depends on lib being built first

$(SUBDIRS):
	$(MAKE) -C $@

clean:
	for d in $(SUBDIRS); do $(MAKE) -C $$d clean; done
```

### Non-Recursive Make (Better for Large Projects)

One Makefile at the root that includes module fragments:

```makefile
# Makefile
CC     = gcc
CFLAGS = -Wall -O2 -Iinclude

include lib/module.mk
include src/module.mk

TARGET = app
$(TARGET): $(ALL_OBJS)
	$(CC) -o $@ $^
```

```makefile
# lib/module.mk
LIB_SRCS := $(wildcard lib/*.c)
LIB_OBJS := $(LIB_SRCS:.c=.o)
ALL_OBJS  += $(LIB_OBJS)
```

### Cross-Compilation Makefile

```makefile
ARCH      ?= arm
CROSS     ?= arm-linux-gnueabihf-
CC         = $(CROSS)gcc
STRIP      = $(CROSS)strip
SYSROOT   ?= /opt/sysroot

CFLAGS  = -Wall -O2 -march=armv7-a -mfpu=neon --sysroot=$(SYSROOT)
LDFLAGS = --sysroot=$(SYSROOT)

TARGET = sensor_daemon

$(TARGET): main.o sensor.o
	$(CC) $(LDFLAGS) -o $@ $^
	$(STRIP) $@

deploy: $(TARGET)
	scp $(TARGET) root@192.168.1.100:/usr/local/bin/
```

```bash
make ARCH=arm CROSS=arm-linux-gnueabihf-
make deploy
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: Why must Makefile recipe lines be indented with a tab, not spaces?**

> This is a historical quirk from the original 1976 Make implementation. The parser uses the tab character as a signal that a line is a recipe (command) rather than a Makefile directive. Using spaces causes the cryptic error: `Makefile:5: *** missing separator. Stop.` Modern build systems (Meson, CMake, Ninja) don't have this restriction.

**Q2 — Basic: What does `.PHONY` do and why is it important?**

> `.PHONY` tells make that a target is not a real file. Without it, if a file named `clean` happens to exist, `make clean` would see the file as up-to-date and do nothing. `.PHONY` forces the recipe to run every time, regardless of any files with the same name.

**Q3 — Intermediate: Explain the `-MMD -MP` GCC flags.**

> `-MMD` generates a `.d` dependency file alongside the `.o` file containing the `make` rule for all headers the source includes. `-MP` adds an empty rule for each header to prevent errors if a header is deleted (without it, make would error because it can't find the header listed in the `.d` file). Together they enable automatic header dependency tracking without manually listing headers.

**Q4 — Advanced: What is the difference between recursive and non-recursive make, and what are the trade-offs?**

> **Recursive make** runs `make` in subdirectories. It's simple to understand but has serious problems: Make can't see the full dependency graph across directories, so it may rebuild in the wrong order or fail to detect that a library changed. Miller's paper "Recursive Make Considered Harmful" (1998) explains this. **Non-recursive make** uses a single top-level Makefile that includes fragment `.mk` files from subdirectories. It sees the full graph, enables correct parallel builds (`-j`), and is faster — but harder to organise in large projects.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| GNU Make Manual | [gnu.org/software/make/manual](https://www.gnu.org/software/make/manual/make.html) |
| `man 1 make` | make manual page |
| "Recursive Make Considered Harmful" | P. Miller, 1998 |
| Makefile tutorial | [makefiletutorial.com](https://makefiletutorial.com) |
