---
layout: post
title: "Embedded Linux Diploma — Lab 03: Writing Your First Kernel Module"
date: 2024-02-20
category: linux
tags: [kernel, modules, drivers, c]
excerpt: "Hands-on guide to writing, compiling, and loading Linux kernel modules. Covers module lifecycle, parameters, proc filesystem, and basic character drivers."
---

## What is a Kernel Module?

A **Loadable Kernel Module (LKM)** is object code that can be inserted into the running kernel without rebooting. This is how Linux device drivers work in the real world.

```bash
# Module management commands
lsmod           # List loaded modules
insmod mod.ko   # Insert module
rmmod mod       # Remove module
modinfo mod.ko  # Module information
modprobe mod    # Insert with dependencies
```

---

## 1. Minimal Kernel Module

```c
/* hello_module.c */
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Eslam Mohamed");
MODULE_DESCRIPTION("Hello World Kernel Module");
MODULE_VERSION("1.0");

static int __init hello_init(void)
{
    printk(KERN_INFO "Hello from kernel space!\n");
    return 0;  /* 0 = success, negative = error */
}

static void __exit hello_exit(void)
{
    printk(KERN_INFO "Goodbye from kernel space!\n");
}

module_init(hello_init);
module_exit(hello_exit);
```

### Makefile

```makefile
# Makefile
obj-m += hello_module.o

KDIR := /lib/modules/$(shell uname -r)/build

all:
	$(MAKE) -C $(KDIR) M=$(PWD) modules

clean:
	$(MAKE) -C $(KDIR) M=$(PWD) clean
```

```bash
make
sudo insmod hello_module.ko
dmesg | tail -5    # See: Hello from kernel space!
sudo rmmod hello_module
dmesg | tail -5    # See: Goodbye from kernel space!
```

## 2. Module Parameters

```c
#include <linux/module.h>
#include <linux/moduleparam.h>

static int num_devices = 1;
static char *device_name = "mydev";

module_param(num_devices, int, S_IRUGO);
MODULE_PARM_DESC(num_devices, "Number of devices (default: 1)");

module_param(device_name, charp, S_IRUGO);
MODULE_PARM_DESC(device_name, "Device name (default: mydev)");

static int __init param_module_init(void)
{
    pr_info("Initializing %d device(s) named '%s'\n", 
            num_devices, device_name);
    return 0;
}
```

```bash
# Pass parameters at load time
sudo insmod param_module.ko num_devices=3 device_name="sensor"

# Or via modprobe
sudo modprobe param_module num_devices=3
```

## 3. /proc Filesystem Interface

```c
#include <linux/proc_fs.h>
#include <linux/seq_file.h>

static int proc_show(struct seq_file *m, void *v)
{
    seq_printf(m, "Module: embedded_lab\n");
    seq_printf(m, "Version: 1.0\n");
    seq_printf(m, "Author: Eslam Mohamed\n");
    return 0;
}

static int proc_open(struct inode *inode, struct file *file)
{
    return single_open(file, proc_show, NULL);
}

static const struct proc_ops proc_fops = {
    .proc_open    = proc_open,
    .proc_read    = seq_read,
    .proc_lseek   = seq_lseek,
    .proc_release = single_release,
};

static struct proc_dir_entry *proc_entry;

static int __init proc_module_init(void)
{
    proc_entry = proc_create("embedded_lab", 0444, NULL, &proc_fops);
    if (!proc_entry) {
        pr_err("Failed to create /proc/embedded_lab\n");
        return -ENOMEM;
    }
    pr_info("/proc/embedded_lab created\n");
    return 0;
}

static void __exit proc_module_exit(void)
{
    proc_remove(proc_entry);
    pr_info("/proc/embedded_lab removed\n");
}
```

```bash
cat /proc/embedded_lab
# Module: embedded_lab
# Version: 1.0
# Author: Eslam Mohamed
```

## 4. Character Device Driver

A character device is the most common type — it transfers data character by character.

```c
#include <linux/cdev.h>
#include <linux/device.h>
#include <linux/fs.h>
#include <linux/uaccess.h>

#define DEVICE_NAME "chardev"
#define BUFFER_SIZE 256

static int    major_number;
static char   message[BUFFER_SIZE] = {0};
static int    message_size = 0;
static struct class  *chardev_class;
static struct device *chardev_device;
static struct cdev    chardev_cdev;

static int device_open(struct inode *inode, struct file *file)
{
    pr_info("chardev: opened\n");
    return 0;
}

static int device_release(struct inode *inode, struct file *file)
{
    pr_info("chardev: released\n");
    return 0;
}

static ssize_t device_read(struct file *file, char __user *buf, 
                            size_t len, loff_t *offset)
{
    int bytes_read = 0;
    
    if (*offset >= message_size)
        return 0;
    
    if (len > message_size - *offset)
        len = message_size - *offset;
    
    if (copy_to_user(buf, message + *offset, len))
        return -EFAULT;
    
    *offset += len;
    return len;
}

static ssize_t device_write(struct file *file, const char __user *buf, 
                              size_t len, loff_t *offset)
{
    if (len > BUFFER_SIZE - 1)
        len = BUFFER_SIZE - 1;
    
    if (copy_from_user(message, buf, len))
        return -EFAULT;
    
    message_size = len;
    message[len] = '\0';
    pr_info("chardev: received '%s'\n", message);
    return len;
}

static const struct file_operations fops = {
    .owner   = THIS_MODULE,
    .open    = device_open,
    .release = device_release,
    .read    = device_read,
    .write   = device_write,
};
```

## 5. Kernel Log Levels

```c
pr_emerg("System is unusable\n");        /* KERN_EMERG   */
pr_alert("Action must be taken!\n");     /* KERN_ALERT   */
pr_crit("Critical condition\n");         /* KERN_CRIT    */
pr_err("Error condition\n");             /* KERN_ERR     */
pr_warn("Warning condition\n");          /* KERN_WARNING */
pr_notice("Normal but significant\n");   /* KERN_NOTICE  */
pr_info("Informational\n");              /* KERN_INFO    */
pr_debug("Debug-level message\n");       /* KERN_DEBUG   */
```

## Lab Exercises

1. Write a kernel module that creates `/proc/student_info` showing your name and ID
2. Add module parameters: `author_name` and `lab_number`
3. Implement a character device that acts as a simple FIFO buffer
4. Write a module that uses `ktime_get()` to measure and log the time between `open()` and `release()` calls

---

> ⚠️ **Warning:** Kernel bugs cause system crashes. Always develop in a VM or use QEMU. Never test untested kernel modules on your main machine.

## Key Takeaways

- Every kernel module needs `module_init()` and `module_exit()` functions
- Use `pr_info()` family instead of `printk()` for cleaner code
- Always release resources in your `exit` function — kernel memory leaks are serious
- `copy_to_user()` and `copy_from_user()` are **mandatory** for kernel ↔ userspace data transfer

## Next Lab

**Lab 04** covers **Device Drivers & the Linux Device Model** — `platform_device`, `platform_driver`, and the sysfs interface.
