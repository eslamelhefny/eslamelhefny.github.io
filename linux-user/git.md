---
layout: guide
title: "Git Basics"
description: "Track code with Git — commits, branching strategies, merging vs rebasing, working with remotes, undoing mistakes, and best practices for kernel and embedded development workflows."
stage: "Stage 09"
permalink: /linux-user/git/
prev_topic:
  title: "Bash Scripting"
  url: /linux-user/bash-scripting/
---

## What is Git?
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

**Git** is a distributed version control system. Every developer has a full copy of the repository including its complete history. There is no single point of failure.

### Initial Setup

```bash
# Set your identity (stored globally in ~/.gitconfig)
git config --global user.name  "Eslam Mohamed"
git config --global user.email "eslam@example.com"
git config --global core.editor "vim"
git config --global init.defaultBranch main

# View all config
git config --list
```

---

## The Three Areas

```
Working Directory  →  Staging Area (Index)  →  Repository (.git)
     (edit files)        (git add)               (git commit)
```

| Area | Description |
|------|-------------|
| **Working Directory** | Your actual files on disk |
| **Staging Area** | Snapshot prepared for the next commit |
| **Repository** | Permanent history stored in `.git/` |

---

## Core Workflow
{:.gc-basic}

### Initialising and Cloning

```bash
# Create a new repository
mkdir myproject && cd myproject
git init
git init --initial-branch=main     # Bash 2.28+

# Clone an existing repository
git clone https://github.com/user/repo.git
git clone git@github.com:user/repo.git      # SSH
git clone --depth=1 https://...              # shallow clone (last commit only)
git clone --branch dev https://...           # clone specific branch
```

### Status and Inspection

```bash
git status                  # show modified/staged/untracked files
git status -s               # short format
git diff                    # unstaged changes
git diff --staged           # staged changes (what will be committed)
git diff HEAD               # all uncommitted changes
git diff branch1..branch2   # diff between branches
```

### Staging and Committing

```bash
# Stage files
git add file.txt
git add src/                  # entire directory
git add *.c                   # all .c files
git add -p                    # interactive: stage hunks selectively

# Unstage
git restore --staged file.txt

# Commit
git commit -m "feat: add sensor calibration routine"
git commit                    # opens editor for multi-line message
git commit -a -m "fix: correct baud rate calculation"  # stage tracked files + commit

# Amend the last commit (only if not yet pushed!)
git commit --amend -m "fix: correct baud rate to 115200"
git commit --amend --no-edit  # add staged changes to last commit without editing message
```

### Viewing History

```bash
git log                           # full log
git log --oneline                 # one line per commit
git log --oneline --graph --all   # ASCII branch graph
git log -5                        # last 5 commits
git log --author="Eslam"          # filter by author
git log --since="2 weeks ago"
git log --grep="fix"              # commits with "fix" in message
git log -S "function_name"        # commits that changed occurrences of string
git log -- path/to/file           # history of a specific file

git show abc1234                  # details of a specific commit
git show HEAD~2                   # two commits before HEAD
```

**`git log --oneline --graph --all` output:**
```
* 3a7f1c2 (HEAD -> main) feat: add I2C driver
* 8b2e4d1 fix: handle negative temperature values
| * a4c9f3e (feature/uart) feat: UART DMA mode
|/
* 1d5e6a0 (tag: v1.0) initial commit
```

---

## Branching
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

```bash
# List branches
git branch               # local branches
git branch -r            # remote branches
git branch -a            # all branches

# Create and switch
git branch feature/uart
git switch feature/uart

# Create + switch in one command
git switch -c feature/spi

# Rename
git branch -m old-name new-name

# Delete
git branch -d feature/uart        # safe delete (only if merged)
git branch -D feature/uart        # force delete

# Switch back
git switch main
git switch -                      # switch to previous branch
```

---

## Merging vs Rebasing
{:.gc-mid}

### `git merge` — Preserves History

```bash
git switch main
git merge feature/uart            # creates a merge commit

# Fast-forward merge (no diverging history — no merge commit needed)
git merge --ff-only feature/docs

# No fast-forward (always create a merge commit — good for visibility)
git merge --no-ff feature/uart
```

**After merge:**
```
main:  A---B---C---M
               \  /
feature:        D-E
```
Merge preserves the full branch history. Use for shared/public branches.

### `git rebase` — Linear History

```bash
git switch feature/uart
git rebase main           # replay feature commits on top of latest main

# After rebase, merge becomes fast-forward
git switch main
git merge feature/uart
```

**After rebase:**
```
main:  A---B---C---D'---E'   (D' and E' are replayed commits)
```
Rebase creates a cleaner, linear history. Use for local/private feature branches before merging. **Never rebase shared branches.**

### Resolving Merge Conflicts

```bash
# After a conflict, Git marks the files
# Edit them to resolve, then:
git add conflicted_file.c
git merge --continue      # or: git rebase --continue

# Abort
git merge --abort
git rebase --abort

# Use a merge tool
git mergetool             # opens configured tool (vimdiff, meld, etc.)
```

**Conflict markers:**
```c
<<<<<<< HEAD (current branch)
int baud_rate = 115200;
=======
int baud_rate = 9600;
>>>>>>> feature/uart (incoming branch)
```
Edit the file to keep what you want, remove the markers, then `git add`.

---

## Remote Repositories
{:.gc-mid}

```bash
# View remotes
git remote -v

# Add a remote
git remote add origin git@github.com:user/repo.git

# Fetch (download, don't merge)
git fetch origin
git fetch --all

# Pull (fetch + merge)
git pull origin main
git pull --rebase origin main    # rebase instead of merge

# Push
git push origin main
git push -u origin feature/uart  # set upstream tracking
git push --force-with-lease      # safe force push (checks for remote changes)

# Delete remote branch
git push origin --delete feature/uart
```

---

## Undoing Mistakes
{:.gc-mid}

```bash
# Discard unstaged changes in a file
git restore file.txt

# Discard all unstaged changes
git restore .

# Unstage a file
git restore --staged file.txt

# Undo the last commit (keep changes staged)
git reset --soft HEAD~1

# Undo the last commit (keep changes unstaged)
git reset HEAD~1          # or --mixed

# Undo the last commit AND discard changes (destructive!)
git reset --hard HEAD~1

# Undo a PUSHED commit safely (creates a new "undo" commit)
git revert abc1234

# Recover a deleted branch
git reflog                # find the commit SHA
git switch -c recovered-branch abc1234
```

---

## Advanced: Git for Kernel/Embedded Work
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

### `git stash` — Shelve Work in Progress

```bash
git stash                        # stash all modified tracked files
git stash push -m "WIP: UART fix"
git stash list                   # list stashes
git stash pop                    # apply + drop top stash
git stash apply stash@{2}        # apply specific stash (keep it)
git stash drop stash@{2}         # delete a stash
git stash clear                  # delete all stashes
git stash show -p                # show stash diff
```

### `git bisect` — Binary Search for Regressions

`git bisect` finds the commit that introduced a bug by binary searching through history.

```bash
git bisect start
git bisect bad                   # current HEAD is broken
git bisect good v1.0.0           # v1.0.0 was working

# Git checks out a middle commit — test it
make && ./test.sh
git bisect bad                   # or: git bisect good

# Repeat until Git reports the first bad commit
# Then:
git bisect reset                 # return to HEAD

# Automate with a test script
git bisect run ./test.sh
```

### Signing Commits (Kernel Workflow)

The Linux kernel uses **signed-off-by** lines and optionally GPG-signed commits.

```bash
# Signed-off-by (DCO — Developer Certificate of Origin)
git commit -s -m "drivers: i2c: add support for BME280"
# Adds: Signed-off-by: Eslam Mohamed <eslam@example.com>

# GPG signing
git config --global commit.gpgsign true
git commit -S -m "feat: kernel module for custom ADC"

# Verify signatures
git log --show-signature
```

### `git format-patch` and `git am` — Emailing Patches

Linux kernel patches are submitted as plain-text emails (not pull requests).

```bash
# Generate patch files for the last 3 commits
git format-patch -3 HEAD
# Creates: 0001-commit-one.patch, 0002-commit-two.patch, …

# Generate a cover letter
git format-patch -3 HEAD --cover-letter

# Apply a patch file
git am 0001-fix-i2c-timeout.patch

# Apply all patches in a directory
git am patches/*.patch

# Send via email (with git-send-email)
git send-email --to=linux-kernel@vger.kernel.org *.patch
```

### Worktrees — Multiple Working Directories

Work on multiple branches simultaneously without stashing.

```bash
# Add a worktree for a branch
git worktree add ../hotfix-branch hotfix/v1.0.1

# List worktrees
git worktree list

# Remove a worktree
git worktree remove ../hotfix-branch
```

### Submodules — Embed External Repositories

```bash
# Add a submodule
git submodule add https://github.com/example/libsensor.git lib/sensor

# Initialize and update submodules after cloning
git clone --recurse-submodules https://...
git submodule update --init --recursive

# Update all submodules to latest
git submodule update --remote
```

### `.gitconfig` Useful Aliases

```ini
[alias]
    st   = status -s
    lg   = log --oneline --graph --all --decorate
    co   = checkout
    sw   = switch
    aa   = add --all
    cm   = commit -m
    amend = commit --amend --no-edit
    undo  = reset HEAD~1
    ff    = merge --ff-only
    rb    = rebase
    wip   = !git add -A && git commit -m "WIP"
    push-safe = push --force-with-lease
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: What is the difference between `git fetch` and `git pull`?**

> `git fetch` downloads commits and branch pointers from the remote into your local remote-tracking branches (e.g., `origin/main`) but does NOT modify your working directory or current branch. `git pull` is `git fetch` followed by `git merge` (or `git rebase` with `--rebase`). Use `git fetch` when you want to inspect what changed before integrating, and `git pull` when you're ready to incorporate the changes immediately.

**Q2 — Basic: What is `HEAD` in Git?**

> `HEAD` is a pointer to the currently checked-out commit — usually the tip of the current branch. When you commit, `HEAD` (and the branch it points to) advances to the new commit. When you `git switch` to another branch, `HEAD` moves to point to that branch. A "detached HEAD" state occurs when `HEAD` points directly to a commit SHA instead of a branch name.

**Q3 — Intermediate: When should you use `merge` vs `rebase`?**

> **Merge** when: integrating a completed feature into `main`, working with shared/public branches, or when you want to preserve the exact history of when the feature was developed. Creates a merge commit.
> **Rebase** when: cleaning up local/private feature branch commits before merging, keeping a linear history, or syncing a feature branch with main while it's still in progress.
> The golden rule: **never rebase commits that have been pushed to a shared remote** — it rewrites history and breaks everyone else's clone.

**Q4 — Intermediate: What does `git reset --soft`, `--mixed`, and `--hard` do?**

> All three move the current branch pointer to the specified commit:
> - `--soft`: Moves HEAD only. Changes remain **staged**.
> - `--mixed` (default): Moves HEAD and resets the index. Changes remain in **working directory, unstaged**.
> - `--hard`: Moves HEAD, resets index AND working directory. Changes are **discarded**. Destructive!

**Q5 — Advanced: How does `git bisect` help find regressions, and how do you automate it?**

> `git bisect` performs a binary search through commit history. You mark the current HEAD as "bad" and an earlier known-good commit as "good". Git checks out the midpoint; you test and mark it good/bad; Git halves the range again. After O(log n) steps it identifies the first bad commit. Automate with `git bisect run ./test.sh` — Git runs the script on each candidate (exit 0 = good, non-zero = bad) until it finds the culprit automatically.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| Pro Git Book (free) | [git-scm.com/book](https://git-scm.com/book/en/v2) |
| `man 1 git` | Git manual |
| `man 7 gitworkflows` | Git workflow patterns |
| Linux Kernel Submitting Patches | [kernel.org/doc/html/latest/process/submitting-patches.html](https://www.kernel.org/doc/html/latest/process/submitting-patches.html) |
| Atlassian Git Tutorials | [atlassian.com/git/tutorials](https://www.atlassian.com/git/tutorials) |
| Oh Shit, Git!? (quick fixes) | [ohshitgit.com](https://ohshitgit.com) |
