---
layout: guide
title: "File I/O"
description: "Master C standard I/O — fopen/fread/fwrite, buffered vs unbuffered I/O, binary file handling, seeking, and robust error checking patterns for production code."
stage: "Stage 02"
phase: "linux-developer-c"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C Programming"
phase_index: "/linux-developer/c-programming/"
permalink: /linux-developer/c-programming/file-io/
prev_topic:
  title: "Structs & Unions"
  url: /linux-developer/c-programming/structs-unions/
next_topic:
  title: "Dynamic Allocation"
  url: /linux-developer/c-programming/dynamic-allocation/
---

## Standard I/O (stdio)
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

The C standard library provides **buffered** I/O through `FILE *` streams. The OS handles the raw file descriptor underneath.

### Opening and Closing Files

```c
#include <stdio.h>

FILE *fp = fopen("data.txt", "r");
if (fp == NULL) {
    perror("fopen");   // prints: fopen: No such file or directory
    return 1;
}

// ... use the file ...

fclose(fp);
```

**Mode strings:**

| Mode | Meaning |
|------|---------|
| `"r"` | Read only — file must exist |
| `"w"` | Write only — truncates or creates |
| `"a"` | Append — creates if absent |
| `"r+"` | Read + write — must exist |
| `"w+"` | Read + write — truncate/create |
| `"rb"`, `"wb"` | Binary mode (important on Windows) |

### Reading Text

```c
char line[256];

// Read one line at a time (preferred for text files)
while (fgets(line, sizeof(line), fp) != NULL) {
    printf("%s", line);   // fgets keeps the newline
}

// Read one character at a time
int c;
while ((c = fgetc(fp)) != EOF) {
    putchar(c);
}

// Formatted read (like scanf but from file)
int id; float value;
fscanf(fp, "%d %f", &id, &value);
```

### Writing Text

```c
fprintf(fp, "id=%d value=%.2f\n", id, value);
fputs("Hello, file!\n", fp);
fputc('A', fp);
```

---

## Binary File I/O
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

For structured data (sensor logs, firmware images, configuration blobs), binary I/O is faster and more compact than text.

```c
typedef struct {
    uint32_t timestamp;
    float    temperature;
    float    pressure;
} SensorRecord;

// Write binary
SensorRecord rec = {1704067200, 23.5f, 1013.25f};
FILE *fp = fopen("sensor.bin", "wb");
fwrite(&rec, sizeof(SensorRecord), 1, fp);
fclose(fp);

// Read binary
SensorRecord out;
fp = fopen("sensor.bin", "rb");
size_t n = fread(&out, sizeof(SensorRecord), 1, fp);
if (n != 1) { perror("fread"); }
fclose(fp);

printf("temp=%.2f pressure=%.2f\n", out.temperature, out.pressure);
```

**Writing/reading an array:**
```c
SensorRecord records[100];
// fill records...

fwrite(records, sizeof(SensorRecord), 100, fp);  // write 100 records at once
fread(records,  sizeof(SensorRecord), 100, fp);  // read them back
```

### File Seeking

```c
// fseek(fp, offset, whence)
// whence: SEEK_SET (from start), SEEK_CUR (from current), SEEK_END (from end)

fseek(fp, 0, SEEK_END);
long size = ftell(fp);    // file size in bytes
fseek(fp, 0, SEEK_SET);   // rewind to start

// Read record #5 directly (random access)
fseek(fp, 5 * sizeof(SensorRecord), SEEK_SET);
fread(&rec, sizeof(SensorRecord), 1, fp);

// Rewind shorthand
rewind(fp);
```

---

## Buffering
{:.gc-mid}

The standard library buffers I/O internally to reduce system calls. Three modes:

| Mode | Function | Behaviour |
|------|----------|-----------|
| Full buffering | `_IOFBF` | Flush when buffer is full (default for files) |
| Line buffering | `_IOLBF` | Flush on newline (default for terminals) |
| Unbuffered | `_IONBF` | Every write goes directly to kernel |

```c
// Set buffer size to 64 KB for bulk file copy
setvbuf(fp, NULL, _IOFBF, 65536);

// Force immediate write (flush buffer to kernel)
fflush(fp);

// Unbuffered (e.g., for logging crashes)
setvbuf(stderr, NULL, _IONBF, 0);
```

---

## Advanced: Robust Error Handling
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

Production code must check every I/O call:

```c
#include <stdio.h>
#include <errno.h>
#include <string.h>

int write_config(const char *path, const Config *cfg) {
    FILE *fp = fopen(path, "wb");
    if (!fp) {
        fprintf(stderr, "Cannot open %s: %s\n", path, strerror(errno));
        return -1;
    }

    // Write header magic
    const uint32_t MAGIC = 0xDEADBEEF;
    if (fwrite(&MAGIC, sizeof(MAGIC), 1, fp) != 1) goto write_err;
    if (fwrite(cfg, sizeof(Config), 1, fp)    != 1) goto write_err;

    // Flush to kernel buffer
    if (fflush(fp) != 0) goto write_err;

    fclose(fp);
    return 0;

write_err:
    fprintf(stderr, "Write error on %s: %s\n", path, strerror(errno));
    fclose(fp);
    return -1;
}
```

### Checking `fread` Return Value

```c
size_t n = fread(buf, sizeof(Record), COUNT, fp);
if (n != COUNT) {
    if (feof(fp))
        fprintf(stderr, "Unexpected end of file (got %zu of %d)\n", n, COUNT);
    else if (ferror(fp))
        fprintf(stderr, "Read error: %s\n", strerror(errno));
}
```

### Temporary Files

```c
// mkstemp: create a unique temp file securely
char template[] = "/tmp/myapp_XXXXXX";
int fd = mkstemp(template);
if (fd == -1) { perror("mkstemp"); exit(1); }

FILE *fp = fdopen(fd, "w+b");   // wrap fd in FILE*
fprintf(fp, "temporary data");
fclose(fp);
unlink(template);   // delete the file
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What does `fgets` do differently from `gets`?**

> `fgets(buf, size, fp)` reads at most `size-1` characters and always null-terminates, preventing buffer overflows. The unsafe `gets()` has no length limit — it was removed from C11 entirely because it can overwrite adjacent memory. Always use `fgets`.

**Q2 — Intermediate: What is the difference between `fflush` and `fsync`?**

> `fflush(fp)` moves data from the C library's userspace buffer to the **kernel's buffer** (page cache). The kernel can still lose it if power is cut. `fsync(fd)` additionally flushes from the kernel buffer to the **physical storage device** (writes to disk). For crash-safe files (logs, databases), you need `fsync` after flushing.

**Q3 — Intermediate: Why must you open binary files with `"rb"` / `"wb"` mode?**

> On Unix/Linux, `"r"` and `"rb"` are identical — no translation happens. On Windows, text mode performs CR-LF ↔ LF translation on reads/writes. If you open a binary file (firmware image, struct data) in text mode on Windows, the translation will corrupt the data. Using `"rb"` / `"wb"` is portable and makes intent explicit.

**Q4 — Advanced: How would you implement a simple binary log file that survives a crash without corruption?**

> Use a **write-ahead log** pattern:
> 1. Write each record with a CRC checksum appended.
> 2. Call `fflush()` then `fsync()` after each record.
> 3. On recovery, scan the file and discard any trailing record whose checksum doesn't match (it was partially written during the crash).
> Alternatively, write to a new temp file, call `fsync`, then `rename` over the old file — `rename` is atomic on Linux, so readers always see either the old or the new file, never a partial update.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| `man 3 fopen` | fopen, fclose, fread, fwrite |
| `man 3 fseek` | File positioning |
| `man 3 setvbuf` | I/O buffering control |
| `man 2 fsync` | Kernel → disk sync |
| GNU C Library manual | [gnu.org/software/libc/manual](https://www.gnu.org/software/libc/manual/html_node/I_002fO-on-Streams.html) |
