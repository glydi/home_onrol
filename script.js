/* =========================================================
   ONROL — 3D circular hall (inside view). Scroll turns you
   RIGHT through the walls (with an empty gap between each),
   then the page scrolls down. Smooth seamless wall, dot nav,
   cursor-interactive 3D objects.
   ========================================================= */
(function () {
  const pin = document.getElementById('pinWrap');
  const hall = document.getElementById('hall');
  const ring = document.getElementById('ring');
  if (!pin || !hall || !ring) return;
  // phones use the vertical fallback — skip the heavy 3D hall
  if (window.matchMedia && window.matchMedia('(max-width: 760px)').matches) return;

  const walls = Array.prototype.slice.call(ring.querySelectorAll('.wall'));
  const C = walls.length;          // content walls
  const SEG = 360 / C;             // walls sit 60° apart (gap of backdrop between them)
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CAM = 840;                 // matches .hall perspective
  const FRONT = 700;               // distance from camera to the facing wall
  const CLIP = CAM - 60;

  const floor = document.getElementById('floor');
  const ceiling = document.getElementById('ceiling');
  const navLinks = Array.prototype.slice.call(document.querySelectorAll('.hdr__link'));

  // no backdrop wall — content slides float in the glowing space
  const M = 0, SEGM = 0;
  const segs = [];

  // depth sparkle field — tiny glints at varied depths; they rotate with the
  // ring, so scrolling sweeps them past (parallax depth) + they twinkle
  const SP = 120;
  for (let i = 0; i < SP; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    const a = Math.random() * 360;
    const r = 220 + Math.random() * 980;            // depth from the centre
    const y = (Math.random() - 0.5) * 1100;
    const near = (1200 - r) / 1200;                 // 0 far .. 1 near
    const size = (1 + near * 2.6).toFixed(1);
    s.style.width = size + 'px'; s.style.height = size + 'px';
    s.style.transform = 'translate(-50%,-50%) rotateY(' + a.toFixed(1) + 'deg) translateZ(' + (-r).toFixed(0) + 'px) translateY(' + y.toFixed(0) + 'px)';
    s.style.animationDuration = (6 + Math.random() * 9).toFixed(1) + 's';   // slow, varied
    s.style.animationDelay = (-Math.random() * 12).toFixed(1) + 's';        // random phase
    ring.appendChild(s);
  }

  // dot navigation (one per content wall)
  const dotsWrap = document.getElementById('dots');
  const dots = [];
  for (let i = 0; i < C; i++) {
    const d = document.createElement('span');
    d.addEventListener('click', () => {
      const m = metrics();
      window.scrollTo({ top: m.top + (i / C) * m.range, behavior: 'smooth' });
    });
    dotsWrap.appendChild(d);
    dots.push(d);
  }

  let Rc = 360, Rseg = 400, wallH = 600, ringZ = 0;
  function geometry() {
    wallH = walls[0].offsetHeight || 600;
    Rc = 560;                 // larger radius so slides are spaced out and never collide
    ringZ = CAM - FRONT + Rc;

    walls.forEach((el, i) => {
      el.style.transform = 'rotateY(' + (-i * SEG) + 'deg) translateZ(' + (-(Rc - 2)) + 'px)';
    });
    if (floor) floor.style.transform = 'translateZ(' + ringZ + 'px) translateY(' + (wallH / 2) + 'px) rotateX(90deg)';
    if (ceiling) ceiling.style.transform = 'translateZ(' + ringZ + 'px) translateY(' + (-wallH / 2) + 'px) rotateX(90deg)';
  }

  let angle = 0, lastFacing = -1;
  const shortest = (d) => ((d % 360) + 540) % 360 - 180;
  const zOf = (rel, r) => ringZ - r * Math.cos(rel * Math.PI / 180);

  function setOp(el, op) {
    const s = op.toFixed(2);
    if (el._o === s) return;
    el.style.opacity = s; el._o = s;
    const v = op < 0.01 ? 'hidden' : 'visible';
    if (el._v !== v) { el.style.visibility = v; el._v = v; }
  }

  // only the facing slide is visible (covers the view); neighbours hidden until
  // they rotate in — so the change reads as a circular turn, not a side shift
  function shadeWall(el, rel) {
    const f = Math.cos(rel * Math.PI / 180);
    const z = zOf(rel, Rc);
    let x = Math.max(0, Math.min(1, (f - 0.45) / 0.55));
    let op = x * x * (3 - 2 * x);              // smoothstep reveal
    if (z > CLIP) op = 0; else if (z > CLIP - 160) op *= (CLIP - z) / 160;
    setOp(el, op);
    const gs = op.toFixed(2);
    if (el._g !== gs) { el.style.setProperty('--glow', gs); el._g = gs; }
    return f;
  }

  // backdrop segment: every visible segment is uniformly opaque (no per-segment
  // opacity steps = no seam lines). The vignette does the smooth color diminishing.
  function shadeSeg(el, rel) {
    const f = Math.cos(rel * Math.PI / 180);
    const z = zOf(rel, Rseg);
    setOp(el, (f > 0.04 && z <= CLIP) ? 1 : 0);
  }

  function metrics() {
    return { top: pin.offsetTop, range: Math.max(1, pin.offsetHeight - window.innerHeight) };
  }
  const HOLD = 0.3;    // brief hold, then a SMOOTH turn; scroll-idle snaps to a slide
  function targetAngle() {
    const m = metrics();
    const p = Math.min(1, Math.max(0, (window.scrollY - m.top) / m.range));
    const raw = p * C;                  // 0..C
    let i = Math.floor(raw); if (i > C - 1) i = C - 1;
    let t = raw - i;                    // 0..1 within this slide's block
    let f = t <= HOLD ? 0 : (t - HOLD) / (1 - HOLD);
    f = f * f * f * (f * (f * 6 - 15) + 10);   // quintic ease — extra-smooth
    return Math.min(i + f, C - 1) * SEG;
  }

  function frame() {
    const t = targetAngle();
    angle += reduce ? (t - angle) : (t - angle) * 0.09;
    if (Math.abs(t - angle) < 0.01) angle = t;

    // subtle "pull into the screen" between slides: ease back at mid-transition, forward on a slide
    const slidePos = angle / SEG;
    const dist = Math.abs(slidePos - Math.round(slidePos));      // 0 on a slide, .5 mid-transition
    const pull = (1 - Math.cos(dist * 2 * Math.PI)) / 2 * 70;    // subtle depth dolly
    ring.style.transform = 'translateZ(' + (ringZ - pull) + 'px) rotateY(' + angle + 'deg)';

    for (let j = 0; j < M; j++) shadeSeg(segs[j], shortest(angle - (+segs[j].dataset.a)));

    const facing = ((Math.round(angle / SEG) % C) + C) % C;
    for (let k = 0; k < C; k++) {
      const f = shadeWall(walls[k], shortest(angle - k * SEG));
      walls[k].style.pointerEvents = f > 0.9 ? 'auto' : 'none';
    }
    for (let i = 0; i < C; i++) dots[i].classList.toggle('is-active', i === facing);
    navLinks.forEach((l) => l.classList.toggle('is-active', +l.dataset.wall === facing));

    // tell the bot which slide we're on (it reacts when you scroll to a new one)
    if (facing !== lastFacing) {
      lastFacing = facing;
      document.dispatchEvent(new CustomEvent('onrol:slide', { detail: facing }));
    }

    requestAnimationFrame(frame);
  }

  // ----- step controls -----
  function stepBy(dir) {
    const m = metrics();
    window.scrollBy({ top: dir * (m.range / C), behavior: 'smooth' });
  }
  document.getElementById('next').addEventListener('click', () => stepBy(1));
  document.getElementById('prev').addEventListener('click', () => stepBy(-1));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') stepBy(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') stepBy(-1);
  });
  navLinks.forEach((l) => l.addEventListener('click', (e) => {
    e.preventDefault();
    const m = metrics();
    window.scrollTo({ top: m.top + (+l.dataset.wall / C) * m.range, behavior: 'smooth' });
  }));

  // snap to a slide (or out to the sections) when scrolling stops — never rest mid-turn
  const pts = [];
  for (let i = 0; i < C; i++) pts.push(i / C);
  pts.push(1);                                  // 1 = unpinned, into the sections below
  let snapT;
  window.addEventListener('scroll', () => {
    clearTimeout(snapT);
    snapT = setTimeout(() => {
      const m = metrics();
      if (window.scrollY < m.top - 4 || window.scrollY > m.top + m.range + 4) return;
      const p = (window.scrollY - m.top) / m.range;
      let best = pts[0];
      for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i] - p) < Math.abs(best - p)) best = pts[i];
      const target = m.top + best * m.range;
      if (Math.abs(target - window.scrollY) > 2) window.scrollTo({ top: target, behavior: 'smooth' });
    }, 120);
  }, { passive: true });

  // always begin on the first slide (no restored scroll position)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  angle = 0;

  geometry();
  window.addEventListener('resize', geometry);
  window.addEventListener('load', () => { geometry(); window.scrollTo(0, 0); });
  frame();
})();

/* ===== Cursor-interactive 3D objects + slide parallax ===== */
(function () {
  const objs = Array.prototype.slice.call(document.querySelectorAll('.obj__inner'));
  const root = document.documentElement;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let tx = 0, ty = 0, cx = 0, cy = 0, spin = 0;
  let fcnt = 0, twx = 0, twy = 0, wx = 0, wy = 0;   // evolving (wandering) glow target
  window.addEventListener('mousemove', (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });
  window.addEventListener('mouseleave', () => { tx = 0; ty = 0; });

  (function loop() {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    if (!reduce) spin += 0.35;
    root.style.setProperty('--px', cx.toFixed(3));
    root.style.setProperty('--py', cy.toFixed(3));

    // glow evolves to new random positions, and the cursor pushes it around
    if (!reduce && (++fcnt % 200 === 0)) { twx = Math.random() * 2 - 1; twy = Math.random() * 2 - 1; }
    wx += (twx - wx) * 0.012;
    wy += (twy - wy) * 0.012;
    root.style.setProperty('--gx', (wx * 24 + cx * 13).toFixed(2) + '%');
    root.style.setProperty('--gy', (wy * 17 + cy * 9).toFixed(2) + '%');

    const tf = 'rotateX(' + (12 - cy * 20).toFixed(2) + 'deg) rotateY(' + (spin + cx * 30).toFixed(2) + 'deg)';
    for (let i = 0; i < objs.length; i++) objs[i].style.transform = tf;
    requestAnimationFrame(loop);
  })();
})();

/* ===== Orange-dot cursor + live coordinates (top-right) ===== */
(function () {
  if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;
  const dot = document.createElement('div'); dot.className = 'cur-dot';
  const coords = document.createElement('div'); coords.className = 'coords'; coords.textContent = 'X 0   Y 0';
  document.body.appendChild(dot);
  document.body.appendChild(coords);
  document.body.classList.add('orange-cursor');

  window.addEventListener('mousemove', (e) => {
    dot.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) translate(-50%,-50%)';
    coords.textContent = 'X ' + e.clientX + '   Y ' + e.clientY;
  });
  document.addEventListener('mousedown', () => dot.classList.add('is-down'));
  document.addEventListener('mouseup', () => dot.classList.remove('is-down'));
})();

/* ===== 10×10 pixel bot — happy, eyes follow the cursor, answers when asked ===== */
(function () {
  const face = document.getElementById('botFace');
  const matrix = document.getElementById('matrix');
  const bubble = document.getElementById('botBubble');
  if (!face || !matrix || !bubble) return;

  const cells = [];
  for (let i = 0; i < 100; i++) { const c = document.createElement('span'); c.className = 'px'; matrix.appendChild(c); cells.push(c); }

  let eox = 0, eoy = 0;        // eye offset (looks toward cursor)
  let mouth = 'smile';         // 'smile' (happy) | 'open' (excited)
  let blink = false, busy = false;

  function set(a, r, c) { if (r >= 0 && r < 10 && c >= 0 && c < 10) a[r * 10 + c] = true; }
  function draw() {
    const a = new Array(100).fill(false);
    // eyes (2×2 each), shifted toward the cursor; a thin line when blinking
    if (blink) {
      for (let c = 0; c < 2; c++) { set(a, 3 + eoy, 2 + eox + c); set(a, 3 + eoy, 6 + eox + c); }
    } else {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { set(a, 2 + eoy + r, 2 + eox + c); set(a, 2 + eoy + r, 6 + eox + c); }
    }
    // mouth
    if (mouth === 'smile') {                 // happy U-smile
      set(a, 6, 0); set(a, 6, 9); set(a, 7, 1); set(a, 7, 8);
      for (let c = 2; c <= 7; c++) set(a, 8, c);
    } else {                                  // excited open mouth (O)
      for (let c = 3; c <= 6; c++) { set(a, 5, c); set(a, 8, c); }
      set(a, 6, 2); set(a, 7, 2); set(a, 6, 7); set(a, 7, 7);
    }
    for (let i = 0; i < 100; i++) cells[i].classList.toggle('on', a[i]);
  }

  // interactive: eyes follow the cursor
  window.addEventListener('mousemove', (e) => {
    const r = face.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    eox = Math.max(-1, Math.min(1, Math.round(dx / 130)));
    eoy = Math.max(-1, Math.min(1, Math.round(dy / 130)));
    draw();
  });
  face.addEventListener('mouseenter', () => { if (!busy) { mouth = 'open'; draw(); } });
  face.addEventListener('mouseleave', () => { if (!busy) { mouth = 'smile'; draw(); } });

  // occasional blink
  setInterval(() => { if (busy) return; blink = true; draw(); setTimeout(() => { blink = false; draw(); }, 130); }, 3200);

  const bot = document.getElementById('bot');
  const askForm = document.getElementById('botAsk');
  const input = document.getElementById('botInput');
  let t;
  function say(msg, ms) {
    bubble.textContent = msg; bubble.classList.remove('is-hidden');
    busy = true; mouth = 'smile'; blink = false; draw();
    clearTimeout(t);
    t = setTimeout(() => { busy = false; draw(); if (!bot.classList.contains('asking')) bubble.classList.add('is-hidden'); }, ms || 4500);
  }

  // click Vector -> open a question box
  face.addEventListener('click', () => {
    const open = !bot.classList.contains('asking');
    bot.classList.toggle('asking', open);
    if (open) { say('ask me anything ✦', 999999); if (input) input.focus(); }
    else { bubble.classList.add('is-hidden'); }
  });

  // tiny knowledge base
  const KB = [
    [/(price|cost|fee|much|paid|free)/, 'Start free with the masterclass — email info@onrol.in for fees.'],
    [/(long|duration|days|time|weeks|month)/, "It's 30 days — live & online."],
    [/(cod|technical|program|develop)/, 'No coding needed to start.'],
    [/agent/, "You'll build tool-using AI agents that reason & call APIs."],
    [/(web|site|app)/, "You'll ship vibe-coded websites & apps."],
    [/automat/, "You'll build AI automations for real operations."],
    [/(who|persona|beginner|student|founder|for me)/, 'Built for 12 personas — students to founders.'],
    [/(apply|join|enroll|start|register|sign)/, 'Apply at info@onrol.in or the Apply button.'],
    [/(contact|email|phone|reach|whatsapp|call)/, 'info@onrol.in · 96093 12345'],
    [/(hi|hello|hey|name|who are you)/, 'I am Vector — ask me about ONROL.']
  ];
  if (askForm) askForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = (input.value || '').toLowerCase().trim();
    if (!q) return;
    let ans = 'Try: pricing, duration, agents, websites, or apply…';
    for (let i = 0; i < KB.length; i++) { if (KB[i][0].test(q)) { ans = KB[i][1]; break; } }
    say(ans, 7000);
    input.value = '';
  });

  // respond when you scroll to a new slide
  const slideMsgs = [
    'I am Vector.',
    'Automations — AI runs the busywork.',
    'Agents that reason & act for you.',
    'Vibe-code & ship real sites.',
    "There's a track for your persona.",
    'Ready? info@onrol.in'
  ];
  let rt1, rt2;
  document.addEventListener('onrol:slide', (e) => {
    const i = e.detail;
    busy = true; mouth = 'open'; blink = false; draw();   // excited reaction
    bubble.textContent = slideMsgs[i] || '';
    bubble.classList.remove('is-hidden');
    clearTimeout(rt1); clearTimeout(rt2);
    rt1 = setTimeout(() => { mouth = 'smile'; draw(); }, 750);
    rt2 = setTimeout(() => { busy = false; bubble.classList.add('is-hidden'); }, 3600);
  });

  draw();
})();

/* ===== Intro fade ===== */
(function () {
  const intro = document.getElementById('intro');
  if (!intro) return;
  const hide = () => intro.classList.add('is-gone');
  setTimeout(hide, 2400);
  intro.addEventListener('click', hide);
})();

/* ===== Scroll-reveal for the lower sections ===== */
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  items.forEach((el) => io.observe(el));
})();

/* ===== Click a slide to enter its detail view ===== */
(function () {
  const detail = document.getElementById('detail');
  if (!detail) return;
  const dEye = document.getElementById('dEye');
  const dTitle = document.getElementById('dTitle');
  const dLead = document.getElementById('dLead');
  const dList = document.getElementById('dList');

  const DATA = [
    { eye: "India's AI Execution School", title: 'Shipped work', lead: 'A 30-day, live, online execution school where you build and deploy real AI — not just watch lectures.', bullets: ['Automations, agents & websites', 'Mentor-guided live projects', 'A portfolio that proves execution'] },
    { eye: 'Track 01', title: 'AI Automations', lead: 'Automate the busywork so your day runs itself.', bullets: ['Lead routing & follow-ups', 'Research & summarization', 'Daily operations on autopilot'] },
    { eye: 'Track 02', title: 'AI Agents', lead: 'Agents that reason, call tools and finish multi-step tasks.', bullets: ['Tool & API calling', 'Multi-step task completion', 'Guardrails & evaluation'] },
    { eye: 'Track 03', title: 'Vibe-Coded Websites', lead: 'Ship polished, real products with AI-assisted coding.', bullets: ['AI-assisted coding', 'Deploy & iterate fast', 'Shippable apps and pages'] },
    { eye: 'AI for everyone', title: 'Built for 12 personas', lead: 'A customized track for who you are and where you want to go.', bullets: ['Students & engineers', 'Founders & freelancers', 'Creators, SMB owners & more'] },
    { eye: 'Rolling admissions', title: 'Join the next cohort', lead: '30 days · live · online · no coding needed.', bullets: ['Rolling admissions', '4.95/5 average rating', '2,400+ alumni · 10,000+ builders'] }
  ];

  function open(i) {
    const d = DATA[i]; if (!d) return;
    dEye.textContent = d.eye; dTitle.textContent = d.title; dLead.textContent = d.lead;
    dList.innerHTML = '';
    d.bullets.forEach((b) => { const li = document.createElement('li'); li.textContent = b; dList.appendChild(li); });
    detail.classList.add('is-open'); detail.setAttribute('aria-hidden', 'false');
  }
  function close() { detail.classList.remove('is-open'); detail.setAttribute('aria-hidden', 'true'); }

  // desktop: click the centred slide (only the facing one is clickable)
  document.querySelectorAll('.wall').forEach((w, i) => {
    w.addEventListener('click', (e) => { if (e.target.closest('a')) return; open(i); });
  });
  // mobile cards
  document.querySelectorAll('.m-card[data-detail]').forEach((c) => {
    c.addEventListener('click', (e) => { if (e.target.closest('a')) return; open(+c.dataset.detail); });
  });

  document.getElementById('detailClose').addEventListener('click', close);
  detail.addEventListener('click', (e) => { if (e.target === detail) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();

/* ===== Light / dark theme toggle ===== */
(function () {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  let light = false;
  try { light = localStorage.getItem('onrol-theme') === 'light'; } catch (e) {}
  function apply() {
    document.body.classList.toggle('light', light);
    btn.textContent = light ? '☾' : '☀';
    btn.setAttribute('aria-label', light ? 'Switch to dark' : 'Switch to light');
  }
  btn.addEventListener('click', () => {
    light = !light;
    try { localStorage.setItem('onrol-theme', light ? 'light' : 'dark'); } catch (e) {}
    apply();
  });
  apply();
})();
