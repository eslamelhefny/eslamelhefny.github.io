# Eslam Mohamed — Portfolio & Blog

Personal portfolio and blog built with **Jekyll**, deployed on GitHub Pages.

## 🚀 Quick Deploy to GitHub Pages

### 1. Create the repository

Go to GitHub and create a new repository named **exactly**: `YOUR_USERNAME.github.io`

> For example: `t-eslammohamed.github.io`

### 2. Push this site

```bash
cd portfolio/
git init
git add .
git commit -m "Initial portfolio setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_USERNAME.github.io.git
git push -u origin main
```

### 3. Enable GitHub Pages

- Go to your repo → **Settings** → **Pages**
- Source: `Deploy from a branch`
- Branch: `main` → `/ (root)`
- Click **Save**

Your site will be live at `https://YOUR_USERNAME.github.io` in ~2 minutes!

---

## 📝 Adding Blog Posts (Your README Files)

Drop any Markdown file into `_posts/` with this naming convention:

```
_posts/YYYY-MM-DD-post-title.md
```

Add this **front matter** at the top of each file:

```yaml
---
layout: post
title: "Your Post Title"
date: 2024-03-01
category: embedded        # embedded | linux | iot | ml | general
tags: [tag1, tag2]
excerpt: "Short description shown on the blog listing page."
---

# Your README content here...
```

### Categories
| Category | Color |
|----------|-------|
| `embedded` | Amber/Orange |
| `linux` | Green |
| `ml` | Blue |
| `iot` | Purple |
| `general` | Gray |

---

## 🛠 Local Development

```bash
# Install Ruby & Jekyll
gem install bundler jekyll

# Install dependencies
bundle install

# Run locally
bundle exec jekyll serve

# Visit: http://localhost:4000
```

---

## 📁 Project Structure

```
portfolio/
├── _config.yml          # Site configuration
├── _layouts/
│   ├── default.html     # Main layout (navbar + footer)
│   └── post.html        # Blog post layout
├── _posts/              # ← Add your README/blog posts here
│   ├── 2024-01-15-lab01-build-environment.md
│   ├── 2024-02-01-lab02-uboot-boot-process.md
│   └── 2024-02-20-lab03-kernel-modules.md
├── assets/
│   ├── css/main.css     # All styles
│   └── js/main.js       # Interactions
├── blog/
│   └── index.html       # Blog listing page
├── index.html           # Homepage
├── about.html           # About page
├── research.html        # Research page
├── contact.html         # Contact page
└── Gemfile              # Ruby dependencies
```

---

## ✏️ Customization

Edit `_config.yml` to update:
- `title`, `description`, `author`
- `url` — set to your GitHub Pages URL
- `github_username`

Edit `index.html` to update stats, skills, and research preview.

Edit `about.html` and `contact.html` with your real contact details.

---

## 🎨 Design

- **Theme**: Industrial terminal — dark amber/green
- **Fonts**: Syne (display) + JetBrains Mono + DM Sans
- **Colors**: `#f5a623` amber accent, `#39d353` green, `#0a0a0a` background
