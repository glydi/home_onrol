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
  const HOLD = 0.45;   // slide holds, then a long SMOOTH transition brings the next
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
    const tf = 'rotateX(' + (12 - cy * 20).toFixed(2) + 'deg) rotateY(' + (spin + cx * 30).toFixed(2) + 'deg)';
    for (let i = 0; i < objs.length; i++) objs[i].style.transform = tf;
    requestAnimationFrame(loop);
  })();
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

  const answers = [
    'ONROL turns AI curiosity into shipped work.',
    'Build AI automations, agents & websites.',
    '30 days · live · online · no coding needed.',
    '2,400+ alumni. 10,000+ builders.',
    'Made for 12 personas — incl. you.',
    'Apply: info@onrol.in'
  ];
  let qi = -1, t;
  face.addEventListener('click', () => {
    busy = true; mouth = 'smile'; blink = false; draw();
    qi = (qi + 1) % answers.length;
    bubble.textContent = answers[qi];
    bubble.classList.remove('is-hidden');
    clearTimeout(t);
    t = setTimeout(() => { busy = false; mouth = 'smile'; draw(); bubble.classList.add('is-hidden'); }, 4200);
  });

  // respond when you scroll to a new slide
  const slideMsgs = [
    "Hi! I'm Vector, your ONROL guide.",
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
