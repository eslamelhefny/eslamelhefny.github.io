// =============================================
// ESLAM PORTFOLIO — main.js
// =============================================

// ── Theme switcher ──
(function () {
  const html = document.documentElement;
  const btn = document.getElementById('themeBtn');
  const panel = document.getElementById('themePanel');
  const opts = document.querySelectorAll('.theme-opt');

  const saved = localStorage.getItem('portfolio-theme') || 'light';

  function applyTheme(theme) {
    if (theme === 'navy') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', theme);
    }
    opts.forEach(o => o.classList.toggle('active', o.dataset.theme === theme));
    localStorage.setItem('portfolio-theme', theme);
  }

  applyTheme(saved);

  if (btn && panel) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('open');
    });
    document.addEventListener('click', function () {
      panel.classList.remove('open');
    });
    panel.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    opts.forEach(function (opt) {
      opt.addEventListener('click', function () {
        applyTheme(opt.dataset.theme);
        panel.classList.remove('open');
      });
    });
  }
})();

// ── Hero terminal animation ──
(function () {
  const terminal = document.getElementById('heroTerminal');
  if (!terminal) return;

  const sequence = [
    {
      cmd: 'whoami',
      out: [{ text: 'Eslam El Hefny', cls: 't-out-blue' }]
    },
    {
      cmd: 'cat about.txt',
      out: [
        { text: 'Role     : Software Engineer · Researcher · Instructor', cls: 't-out' },
        { text: 'Location : Cairo, Egypt',                               cls: 't-out' },
      ]
    },
    {
      cmd: 'ls skills/',
      out: [
        { text: 'embedded-linux/   rtos-arm/   machine-learning/', cls: 't-out-blue' },
        { text: 'iot-systems/      systems-c/  teaching/',         cls: 't-out-blue' }
      ]
    },
    {
      cmd: 'cat skills/top.txt',
      out: [
        { text: 'Yocto · Buildroot · Linux Kernel · Device Drivers', cls: 't-out' },
        { text: 'ARM Cortex-M · FreeRTOS · PyTorch · OpenCV',        cls: 't-out' },
        { text: 'MQTT · ESP32 · Federated Learning · C/C++ · Qt',    cls: 't-out' }
      ]
    },
    {

    },
    {
      cmd: 'echo $CONTACT',
      out: [
        { text: 'github   → github.com/eslamelhefny', cls: 't-out' },
        { text: 'linkedin → linkedin.com/in/eslamelhefny', cls: 't-out' }
      ]
    }
  ];

  function makePromptHTML() {
    return '<span class="t-prompt-user">eslam</span>' +
           '<span class="t-prompt-sep">@eslam</span>' +
           '<span class="t-prompt-sep">:</span>' +
           '<span class="t-prompt-path">~</span>' +
           '<span class="t-prompt-sign">$ </span>';
  }

  let cursor;

  function removeCursor() {
    if (cursor && cursor.parentNode) cursor.parentNode.removeChild(cursor);
    cursor = null;
  }

  function addCursor(parent) {
    cursor = document.createElement('span');
    cursor.className = 't-cursor';
    parent.appendChild(cursor);
  }

  function typeCommand(text, done) {
    const row = document.createElement('div');
    row.className = 't-line';
    row.innerHTML = makePromptHTML();
    const cmdSpan = document.createElement('span');
    cmdSpan.className = 't-cmd';
    row.appendChild(cmdSpan);
    addCursor(row);
    terminal.appendChild(row);

    let i = 0;
    function tick() {
      if (i < text.length) {
        cmdSpan.textContent += text[i++];
        terminal.scrollTop = terminal.scrollHeight;
        setTimeout(tick, 42 + Math.random() * 22);
      } else {
        setTimeout(done, 280);
      }
    }
    tick();
  }

  function showOutput(lines, done) {
    removeCursor();
    lines.forEach(function (l) {
      const el = document.createElement('div');
      el.className = l.cls;
      el.textContent = l.text;
      terminal.appendChild(el);
    });
    terminal.scrollTop = terminal.scrollHeight;
    setTimeout(done, 380);
  }

  function run(idx) {
    if (idx >= sequence.length) {
      // idle prompt, then loop
      const row = document.createElement('div');
      row.className = 't-line';
      row.innerHTML = makePromptHTML();
      addCursor(row);
      terminal.appendChild(row);
      terminal.scrollTop = terminal.scrollHeight;
      setTimeout(function () {
        terminal.innerHTML = '';
        run(0);
      }, 3500);
      return;
    }
    const item = sequence[idx];
    typeCommand(item.cmd, function () {
      showOutput(item.out, function () { run(idx + 1); });
    });
  }

  setTimeout(function () { run(0); }, 600);
})();

// ── Navbar scroll effect ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// ── Mobile nav toggle ──
const navToggle = document.getElementById('navToggle');
const navMobile = document.getElementById('navMobile');
if (navToggle && navMobile) {
  navToggle.addEventListener('click', () => {
    navMobile.classList.toggle('open');
  });
}

// ── Fade-up intersection observer ──
const fadeEls = document.querySelectorAll('.fade-up');
if (fadeEls.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  fadeEls.forEach(el => observer.observe(el));
}

// ── Blog filter buttons ──
const filterBtns = document.querySelectorAll('.filter-btn');
const postCards = document.querySelectorAll('.post-card[data-category]');

if (filterBtns.length && postCards.length) {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      postCards.forEach(card => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.style.display = show ? '' : 'none';
      });
    });
  });
}

// ── Auto-generate TOC ──
const tocList = document.getElementById('toc-list');
const markdownBody = document.querySelector('.markdown-body');

if (tocList && markdownBody) {
  const headings = markdownBody.querySelectorAll('h2, h3');
  headings.forEach((h, i) => {
    if (!h.id) h.id = 'heading-' + i;
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    if (h.tagName === 'H3') a.style.paddingLeft = '1.5rem';
    tocList.appendChild(a);
  });
}

// ── Smooth scroll for anchor links ──
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Counter animation ──
function animateCounter(el, target, duration = 1500) {
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target) + (el.dataset.suffix || '');
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

const counters = document.querySelectorAll('[data-count]');
if (counters.length) {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        animateCounter(el, parseInt(el.dataset.count));
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => counterObserver.observe(c));
}

// ── Hero background canvas animation ──
// Combines: neural network (DL), IoT devices, embedded nodes
(function () {
  const canvas = document.getElementById('heroBgCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, nodes = [], packets = [], raf;

  // RGB colors — darker shades for light theme visibility
  const C_DARK  = { neural: [88,166,255], iot: [57,211,83],  embedded: [224,175,104] };
  const C_LIGHT = { neural: [9, 105,218], iot: [26,127,55],  embedded: [154,103,0]  };
  let C = C_DARK;

  function isLightTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  const TYPES = ['neural', 'iot', 'embedded'];
  const MAX_DIST = 190;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Always size canvas to its displayed CSS dimensions from the hero section
  function resize() {
    const hero = document.querySelector('.hero');
    W = canvas.width  = hero ? hero.clientWidth  : window.innerWidth;
    H = canvas.height = hero ? hero.clientHeight : window.innerHeight;
  }

  function init() {
    C = isLightTheme() ? C_LIGHT : C_DARK;
    resize();
    nodes = [];
    const count = 18;  // small fixed count
    for (let i = 0; i < count; i++) {
      const type = TYPES[i % 3];  // 6 of each type
      nodes.push({
        x: rand(0, W), y: rand(0, H),
        vx: rand(-0.9, 0.9), vy: rand(-0.75, 0.75),
        type,
        r: type === 'neural' ? rand(6, 10) : rand(8, 13),
        ph: rand(0, Math.PI * 2),
        ps: rand(0.025, 0.055)
      });
    }
    // seed data-flow packets
    packets = Array.from({ length: 8 }, () => ({
      ai: Math.floor(Math.random() * nodes.length),
      bi: Math.floor(Math.random() * nodes.length),
      t:  Math.random(),
      sp: rand(0.018, 0.035)
    }));
    if (raf) cancelAnimationFrame(raf);
    loop();
  }

  // ── draw helpers ──

  function col(type, al) {
    const v = C[type];
    return `rgba(${v[0]},${v[1]},${v[2]},${al})`;
  }

  function drawNeural(x, y, r, al) {
    const v = C.neural;
    // glow halo
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    gr.addColorStop(0, `rgba(${v[0]},${v[1]},${v[2]},${al * 0.35})`);
    gr.addColorStop(1, `rgba(${v[0]},${v[1]},${v[2]},0)`);
    ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fillStyle = gr; ctx.fill();
    // solid core
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = col('neural', al); ctx.fill();
  }

  function drawIoT(x, y, r, al, ph) {
    const v = C.iot;
    const rc = `${v[0]},${v[1]},${v[2]}`;
    // pulsing ring
    const ring = r * 3.5 + Math.sin(ph) * r;
    ctx.beginPath(); ctx.arc(x, y, ring, 0, Math.PI * 2);
    const pulse = Math.max(0, al * 0.3 * (0.5 + 0.5 * Math.sin(ph)));
    ctx.strokeStyle = `rgba(${rc},${pulse})`; ctx.lineWidth = 1.8; ctx.stroke();
    // square body
    const s = r * 1.4;
    ctx.fillStyle = `rgba(${rc},${al * 0.9})`;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    // signal arcs above device
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(x, y - s * 0.6, r * (1.2 + i * 1.1), Math.PI, 0);
      ctx.strokeStyle = `rgba(${rc},${al * 0.55 / i})`; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }

  function drawEmbedded(x, y, r, al) {
    const v = C.embedded;
    const rc = `${v[0]},${v[1]},${v[2]}`;
    // hexagon
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const ex = x + r * Math.cos(a), ey = y + r * Math.sin(a);
      i === 0 ? ctx.moveTo(ex, ey) : ctx.lineTo(ex, ey);
    }
    ctx.closePath();
    ctx.fillStyle   = `rgba(${rc},${al * 0.65})`; ctx.fill();
    ctx.strokeStyle = `rgba(${rc},${al})`;         ctx.lineWidth = 1.6; ctx.stroke();
    // centre pin
    ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rc},${al})`; ctx.fill();
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);

    // move
    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy; n.ph += n.ps;
      if (n.x < -40) n.x = W + 40; else if (n.x > W + 40) n.x = -40;
      if (n.y < -40) n.y = H + 40; else if (n.y > H + 40) n.y = -40;
    });

    // edges
    const edgeAlphaMax = isLightTheme() ? 0.35 : 0.22;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < MAX_DIST) {
          const al = (1 - d / MAX_DIST) * edgeAlphaMax;
          const ca = C[a.type], cb = C[b.type];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${(ca[0]+cb[0])>>1},${(ca[1]+cb[1])>>1},${(ca[2]+cb[2])>>1},${al})`;
          ctx.lineWidth = 1.2; ctx.stroke();
        }
      }
    }

    // data-flow packets
    packets.forEach((p, i) => {
      p.t += p.sp;
      if (p.t > 1) {
        packets[i] = { ai: Math.floor(Math.random() * nodes.length), bi: Math.floor(Math.random() * nodes.length), t: 0, sp: rand(0.004, 0.009) };
        return;
      }
      const na = nodes[p.ai], nb = nodes[p.bi];
      const dx = nb.x - na.x, dy = nb.y - na.y;
      if (Math.sqrt(dx*dx+dy*dy) > MAX_DIST) return;
      const col = C[na.type];
      ctx.beginPath();
      ctx.arc(na.x + dx * p.t, na.y + dy * p.t, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.85)`; ctx.fill();
    });

    // nodes
    const nodeAlphaBase = isLightTheme() ? 0.72 : 0.5;
    nodes.forEach(n => {
      const al = nodeAlphaBase + 0.22 * Math.sin(n.ph);
      if      (n.type === 'neural')   drawNeural(ctx, n.x, n.y, n.r, al);
      else if (n.type === 'iot')      drawIoT(ctx, n.x, n.y, n.r, al, n.ph);
      else                            drawEmbedded(ctx, n.x, n.y, n.r, al);
    });

    raf = requestAnimationFrame(loop);
  }

  // Init after layout is ready
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 150);
  });

  // Re-pick color palette when theme changes
  document.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(() => { C = isLightTheme() ? C_LIGHT : C_DARK; }, 50);
    });
  });
}());
