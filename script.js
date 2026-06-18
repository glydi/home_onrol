/* Device-capability tiers are set by an inline script at the top of <body>
   (so the class is applied before paint). Fall back here just in case. */
if (typeof window.__useHall === 'undefined') {
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const lowEnd = mq('(prefers-reduced-motion: reduce)') || (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  window.__useHall = true;                       // hall runs on all devices (responsive)
  window.__lowFx = lowEnd || mq('(pointer: coarse)');
  if (window.__lowFx) document.body.classList.add('low-fx');
}

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
  // tablets / touch / low-end use the vertical fallback — skip the heavy 3D hall
  if (!window.__useHall) return;

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
  const SP = window.__lowFx ? 24 : 70;   // depth glints — fewer = lighter on every device
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

  // progress arc
  const arcFill = document.getElementById('progressFill');
  const arcNum = document.getElementById('progressNum');
  const CIRC = 2 * Math.PI * 46;
  if (arcFill) { arcFill.style.strokeDasharray = CIRC; arcFill.style.strokeDashoffset = CIRC; }

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
    if (arcFill) {
      const prog = Math.max(0, Math.min(1, (angle / SEG) / (C - 1)));
      arcFill.style.strokeDashoffset = CIRC * (1 - prog);
    }
    if (arcNum) arcNum.textContent = String(facing + 1);
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
  function goSlide(i) {
    const m = metrics();
    window.scrollTo({ top: m.top + (Math.max(0, Math.min(C - 1, i)) / C) * m.range, behavior: 'smooth' });
  }
  navLinks.forEach((l) => l.addEventListener('click', (e) => { e.preventDefault(); goSlide(+l.dataset.wall); }));

  // ----- drag-to-spin with inertia (maps horizontal drag to the scroll-turn) -----
  let dn = false, lx = 0, sx = 0, dv = 0, inertia = 0;
  const dragK = () => (metrics().range / C) / 320;       // px dragged -> scroll
  hall.addEventListener('pointerdown', (e) => { dn = true; lx = sx = e.clientX; dv = 0; window.__hallDragged = false; cancelAnimationFrame(inertia); });
  hall.addEventListener('pointermove', (e) => {
    if (!dn) return;
    const dx = e.clientX - lx; lx = e.clientX; dv = dx;
    if (Math.abs(e.clientX - sx) > 6) window.__hallDragged = true;
    window.scrollBy(0, -dx * dragK());
  });
  function release() {
    if (!dn) return; dn = false;
    let v = dv;
    (function glide() {
      if (Math.abs(v) < 0.4) return;
      window.scrollBy(0, -v * dragK());
      v *= 0.92;
      inertia = requestAnimationFrame(glide);
    })();
  }
  hall.addEventListener('pointerup', release);
  hall.addEventListener('pointercancel', release);

  // ----- keyboard: 1–6 jump · Enter opens detail · / focuses Vector -----
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key >= '1' && e.key <= '6') goSlide(+e.key - 1);
    else if (e.key === 'Enter') document.dispatchEvent(new CustomEvent('onrol:open', { detail: lastFacing }));
    else if (e.key === '/') { e.preventDefault(); document.dispatchEvent(new CustomEvent('onrol:askvector')); }
  });

  // ----- deep-link (#agents etc.) opens that slide -----
  function fromHash() {
    const map = { home: 0, automations: 1, agents: 2, websites: 3, personas: 4, join: 5 };
    const h = (location.hash || '').replace('#', '').toLowerCase();
    if (h in map) setTimeout(() => goSlide(map[h]), 60);
  }
  window.addEventListener('hashchange', fromHash);

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

  // ----- user scroll sensitivity (taller pin = finer/slower turns) -----
  // base height comes from CSS (.pin-wrap height); higher mult = shorter pin = faster turns
  const BASE_VH = 1180;
  const SENS_MIN = 0.5, SENS_MAX = 2;
  const sensRange = document.getElementById('sensRange');
  const sensVal = document.getElementById('sensVal');
  function applySens(mult, keepPos) {
    mult = Math.max(SENS_MIN, Math.min(SENS_MAX, mult));
    const m0 = keepPos ? metrics() : null;                 // preserve position within the hall
    const p = m0 ? (window.scrollY - m0.top) / m0.range : 0;
    pin.style.height = Math.round(BASE_VH / mult) + 'vh';
    geometry();
    if (m0) { const m = metrics(); window.scrollTo(0, m.top + Math.max(0, Math.min(1, p)) * m.range); }
    if (sensVal) sensVal.textContent = mult.toFixed(1) + '×';
    if (sensRange) {
      sensRange.value = String(mult);
      const pct = ((mult - SENS_MIN) / (SENS_MAX - SENS_MIN)) * 100;   // fill the bar
      sensRange.style.setProperty('--sens-fill', pct.toFixed(1) + '%');
    }
  }
  let savedSens = 1;
  try { savedSens = parseFloat(localStorage.getItem('onrol-sens')) || 1; } catch (e) {}
  if (sensRange) {
    sensRange.addEventListener('input', () => {
      const v = parseFloat(sensRange.value);
      applySens(v, true);
      try { localStorage.setItem('onrol-sens', String(v)); } catch (e) {}
    });
  }
  applySens(savedSens, false);

  // always begin on the first slide (no restored scroll position)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  angle = 0;

  geometry();
  window.addEventListener('resize', geometry);
  window.addEventListener('load', () => { geometry(); fromHash(); });
  frame();
})();

/* ===== Static bloom + cheap cursor parallax =====
   The orange bloom is blurred in CSS. We keep it STATIC on every device so the
   full-screen blur layer rasterizes ONCE and just composites — moving a blurred
   glow re-blurs the whole screen every frame, which was the jank. The only
   per-frame work left is a light GPU transform on the facing slide, and that
   runs on mouse devices only. */
(function () {
  const root = document.documentElement;
  root.style.setProperty('--gx', '0%');
  root.style.setProperty('--gy', '0%');

  if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  window.addEventListener('mousemove', (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(loop);   // only animate while the mouse moves
  });
  window.addEventListener('mouseleave', () => { tx = 0; ty = 0; });
  function loop() {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    root.style.setProperty('--px', cx.toFixed(3));
    root.style.setProperty('--py', cy.toFixed(3));
    if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(loop);
    else raf = 0;
  }
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
  // expression: smile | open | grin | happy | wink | think | wow | cool | sad
  let mouth = 'smile';
  let blink = false, busy = false;

  function set(a, r, c) { if (r >= 0 && r < 10 && c >= 0 && c < 10) a[r * 10 + c] = true; }

  // ---- eye styles ----
  function eyesBlock(a) { for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { set(a, 2 + eoy + r, 2 + eox + c); set(a, 2 + eoy + r, 6 + eox + c); } }
  function eyesBlink(a) { for (let c = 0; c < 2; c++) { set(a, 3 + eoy, 2 + eox + c); set(a, 3 + eoy, 6 + eox + c); } }
  function eyesHappy(a) { set(a, 3, 1); set(a, 2, 2); set(a, 3, 3); set(a, 3, 6); set(a, 2, 7); set(a, 3, 8); }   // ^ ^
  function eyesWink(a) { for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) set(a, 2 + r, 2 + c); set(a, 3, 6); set(a, 3, 7); }
  function eyesWide(a) { for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { set(a, 2 + r, 2 + c); set(a, 2 + r, 6 + c); } }
  function eyesCool(a) { for (let c = 1; c <= 8; c++) set(a, 3, c); for (let c = 1; c <= 3; c++) set(a, 2, c); for (let c = 6; c <= 8; c++) set(a, 2, c); }   // shades

  // ---- mouth styles ----
  function mSmile(a) { set(a, 6, 0); set(a, 6, 9); set(a, 7, 1); set(a, 7, 8); for (let c = 2; c <= 7; c++) set(a, 8, c); }
  function mOpen(a) { for (let c = 3; c <= 6; c++) { set(a, 5, c); set(a, 8, c); } set(a, 6, 2); set(a, 7, 2); set(a, 6, 7); set(a, 7, 7); }
  function mGrin(a) { set(a, 6, 2); set(a, 6, 7); for (let c = 2; c <= 7; c++) set(a, 7, c); for (let c = 3; c <= 6; c++) set(a, 8, c); }
  function mThink(a) { set(a, 8, 4); set(a, 8, 5); set(a, 8, 6); set(a, 7, 6); }
  function mSad(a) { set(a, 6, 3); set(a, 6, 4); set(a, 6, 5); set(a, 6, 6); set(a, 7, 2); set(a, 7, 7); }   // frown

  function draw() {
    const a = new Array(100).fill(false);
    const m = mouth;
    // eyes
    if (m === 'happy') eyesHappy(a);
    else if (m === 'wink') eyesWink(a);
    else if (m === 'cool') eyesCool(a);
    else if (m === 'wow') eyesWide(a);
    else if (blink) eyesBlink(a);
    else eyesBlock(a);
    // mouth
    if (m === 'open' || m === 'wow') mOpen(a);
    else if (m === 'grin') mGrin(a);
    else if (m === 'think') mThink(a);
    else if (m === 'sad') mSad(a);
    else mSmile(a);
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
  face.addEventListener('mouseenter', () => { if (!busy) { mouth = 'grin'; draw(); } });
  face.addEventListener('mouseleave', () => { if (!busy) { mouth = 'smile'; draw(); } });

  // occasional blink
  setInterval(() => { if (busy) return; blink = true; draw(); setTimeout(() => { blink = false; draw(); }, 130); }, 3200);

  const bot = document.getElementById('bot');

  // idle playfulness: now and then flash a fun expression, then settle back
  const idleExpr = ['happy', 'wink', 'grin', 'cool'];
  setInterval(() => {
    if (busy || bot.classList.contains('asking')) return;
    mouth = idleExpr[Math.floor(Math.random() * idleExpr.length)];
    draw();
    setTimeout(() => { if (!busy && !bot.classList.contains('asking')) { mouth = 'smile'; draw(); } }, 1100);
  }, 6500);
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
    typeOut(ans);
    input.value = '';
  });

  // open Vector via the "/" shortcut
  document.addEventListener('onrol:askvector', () => {
    if (!bot.classList.contains('asking')) { bot.classList.add('asking'); say('ask me anything ✦', 999999); }
    if (input) input.focus();
  });

  // typing indicator + types the answer out
  let typeT;
  function typeOut(text) {
    busy = true; mouth = 'think'; blink = false; draw();   // ponder while the "…" shows
    bubble.classList.remove('is-hidden');
    bubble.textContent = '…';
    clearTimeout(t); clearTimeout(typeT);
    let i = 0;
    setTimeout(function step() {
      if (i === 0) { bubble.textContent = ''; mouth = 'grin'; draw(); }   // then answer with a grin
      bubble.textContent = text.slice(0, ++i);
      if (i < text.length) typeT = setTimeout(step, 22);
      else t = setTimeout(() => { busy = false; draw(); if (!bot.classList.contains('asking')) bubble.classList.add('is-hidden'); }, 7000);
    }, 420);   // brief "…" think time
  }

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
    busy = true; mouth = 'wow'; blink = false; draw();   // wide-eyed reaction
    bubble.textContent = slideMsgs[i] || '';
    bubble.classList.remove('is-hidden');
    clearTimeout(rt1); clearTimeout(rt2);
    rt1 = setTimeout(() => { mouth = 'smile'; draw(); }, 750);
    rt2 = setTimeout(() => { busy = false; bubble.classList.add('is-hidden'); }, 3600);
  });

  draw();
})();

/* ===== Intro fade — short, and dismissible by any interaction (low patience) ===== */
(function () {
  const intro = document.getElementById('intro');
  if (!intro) return;
  let gone = false;
  const hide = () => {
    if (gone) return; gone = true;
    intro.classList.add('is-gone');
    window.removeEventListener('wheel', hide);
    window.removeEventListener('touchstart', hide);
    window.removeEventListener('keydown', hide);
  };
  setTimeout(hide, 1300);                              // was 2400 — quicker
  intro.addEventListener('click', hide);
  window.addEventListener('wheel', hide, { passive: true });
  window.addEventListener('touchstart', hide, { passive: true });
  window.addEventListener('keydown', hide);
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
    w.addEventListener('click', (e) => { if (e.target.closest('a') || window.__hallDragged) return; open(i); });
  });
  document.addEventListener('onrol:open', (e) => open(e.detail));   // keyboard Enter
  // mobile cards
  document.querySelectorAll('.m-card[data-detail]').forEach((c) => {
    c.addEventListener('click', (e) => { if (e.target.closest('a')) return; open(+c.dataset.detail); });
  });

  document.getElementById('detailClose').addEventListener('click', close);
  detail.addEventListener('click', (e) => { if (e.target === detail) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();

/* ===== Settings dropdown (theme · sound · scroll speed) ===== */
(function () {
  const btn = document.getElementById('settingsBtn');
  const pop = document.getElementById('settingsPop');
  if (!btn || !pop) return;
  function close() { pop.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); btn.classList.remove('is-on'); }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = pop.hasAttribute('hidden');
    if (willOpen) { pop.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); btn.classList.add('is-on'); }
    else close();
  });
  document.addEventListener('click', (e) => { if (!pop.contains(e.target) && e.target !== btn) close(); });
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

/* ===== Count-up stats ===== */
(function () {
  const nums = document.querySelectorAll('.stat__num');
  if (!nums.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el);
      const raw = el.textContent.trim();
      const m = raw.match(/[\d.,]+/);
      if (!m) return;
      const target = parseFloat(m[0].replace(/,/g, ''));
      const dec = (m[0].split('.')[1] || '').length;
      const pre = raw.slice(0, m.index), suf = raw.slice(m.index + m[0].length);
      const t0 = performance.now(), dur = 1200;
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        const e2 = 1 - Math.pow(1 - p, 3);
        const v = target * e2;
        const s = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
        el.textContent = pre + s + suf;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.4 });
  nums.forEach((n) => io.observe(n));
})();

/* ===== Sound: a single soft note on each slide (mute toggle) ===== */
(function () {
  const btn = document.getElementById('soundBtn');
  if (!btn) return;
  let on = false, ctx = null;
  const NOTE = 392;   // single clean note (G4) — same every slide
  function ensure() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } }
  function tone(f, dur, gain) {
    if (!on || !ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain || 0.05, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.6));
    o.start(t); o.stop(t + (dur || 0.6) + 0.02);
  }
  btn.addEventListener('click', () => {
    on = !on; ensure(); if (ctx && ctx.state === 'suspended') ctx.resume();
    btn.style.color = on ? 'var(--bg)' : '';
    btn.style.background = on ? 'var(--gold)' : '';
    if (on) tone(NOTE, 0.4, 0.04);
  });
  document.addEventListener('onrol:slide', () => { tone(NOTE, 0.6, 0.045); });
})();

/* ===== Glow interaction: brighten + swell briefly on each slide =====
   Drives CSS vars only (--glow-o opacity, --glow-s scale) — the transition in
   CSS eases them back, so it's pure compositing, works in both themes. */
(function () {
  const root = document.documentElement;
  let t;
  document.addEventListener('onrol:slide', () => {
    root.style.setProperty('--glow-o', '1');
    root.style.setProperty('--glow-s', '1.06');
    clearTimeout(t);
    t = setTimeout(() => {
      root.style.setProperty('--glow-o', '');   // back to the CSS default (.9)
      root.style.setProperty('--glow-s', '1');
    }, 260);
  });
})();

/* ===== Scroll-progress rail — fills as you move through the whole page ===== */
(function () {
  const fill = document.getElementById('scrollRailFill');
  if (!fill) return;
  let ticking = false;
  function update() {
    ticking = false;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const p = h > 0 ? Math.max(0, Math.min(1, window.scrollY / h)) : 0;
    fill.style.height = (p * 100).toFixed(2) + '%';
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('load', update);
  update();
})();

/* ===== Build-with-AI demo (plan → act → done) ===== */
(function () {
  const form = document.getElementById('demoForm');
  const input = document.getElementById('demoInput');
  const steps = document.getElementById('demoSteps');
  if (!form || !steps) return;
  let running = false;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (running) return;
    const task = (input.value || 'email new leads').trim();
    const plan = [
      'Understanding: "' + task + '"',
      'Planning the steps',
      'Calling tools & APIs',
      'Executing the workflow',
      'Done — shipped ✓'
    ];
    steps.innerHTML = '';
    const lis = plan.map((txt) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="tick">›</span><span>' + txt + '</span>';
      steps.appendChild(li); return li;
    });
    running = true;
    let i = 0;
    (function next() {
      if (i > 0) { lis[i - 1].classList.add('done'); lis[i - 1].querySelector('.tick').textContent = '✓'; }
      if (i < lis.length) { lis[i].classList.add('show'); i++; setTimeout(next, 720); }
      else { running = false; }
    })();
  });
})();

/* ===== Persona picker ===== */
(function () {
  const chips = document.getElementById('chips');
  const out = document.getElementById('chipsOut');
  if (!chips || !out) return;
  chips.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('is-active', x === c));
    out.innerHTML = 'We\'d start you on <em>' + c.dataset.rec + '</em>.';
  });
})();

/* ===== Inline apply form ===== */
(function () {
  const form = document.getElementById('applyForm');
  const msg = document.getElementById('applyMsg');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('applyName').value.trim();
    const email = document.getElementById('applyEmail').value.trim();
    if (!name || !email) return;
    msg.textContent = 'Thanks, ' + name + '! Confirm your spot — opening your email…';
    setTimeout(() => {
      window.location.href = 'mailto:info@onrol.in?subject=' +
        encodeURIComponent('Application — ' + name) +
        '&body=' + encodeURIComponent('Name: ' + name + '\nEmail: ' + email + '\n\nI\'d like to apply to the next ONROL cohort.');
    }, 700);
  });
})();

