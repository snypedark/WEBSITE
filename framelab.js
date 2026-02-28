/**
 * FRAMELAB — Production JS
 * Modular, GPU-friendly, accessibility-aware.
 * Depends on: GSAP 3 + ScrollTrigger (loaded before this script).
 */

/* ============================================================
   UTILITIES
   ============================================================ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const lerp = (a, b, t) => a + (b - a) * t;

const isMobile = () => window.innerWidth <= 900;
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   MODULE: CUSTOM CURSOR
   Only activated on pointer devices (non-touch / desktop).
   Uses translate3d for GPU compositing.
   ============================================================ */
function initCursor() {
  // Don't render cursor on touch-primary devices
  if (window.matchMedia('(hover: none)').matches) return;

  const dot  = $('#curDot');
  const ring = $('#curRing');
  if (!dot || !ring) return;

  // Make them visible
  dot.style.display  = 'block';
  ring.style.display = 'block';

  let mx = -100, my = -100;
  let rx = -100, ry = -100;
  let rafId = null;

  // Dot follows instantly via direct style (no transition)
  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.transform = `translate3d(calc(${mx}px - 50%), calc(${my}px - 50%), 0)`;
  }, { passive: true });

  // Ring follows with spring lerp
  function animateRing() {
    rx = lerp(rx, mx, 0.12);
    ry = lerp(ry, my, 0.12);
    ring.style.transform = `translate3d(calc(${rx}px - 50%), calc(${ry}px - 50%), 0)`;
    rafId = requestAnimationFrame(animateRing);
  }
  rafId = requestAnimationFrame(animateRing);

  // Hover states
  const BIG_TARGETS = 'a, button, .r-thumb, .proj-card, .svc-card, .proc-item, .play-orb';
  const SM_TARGETS  = 'input, textarea';

  document.addEventListener('mouseover', e => {
    const t = e.target;
    if (t.closest(BIG_TARGETS)) {
      ring.classList.add('big');
      ring.classList.remove('sm');
    } else if (t.closest(SM_TARGETS)) {
      ring.classList.add('sm');
      ring.classList.remove('big');
    } else {
      ring.classList.remove('big', 'sm');
    }
  }, { passive: true });

  // Pause rAF when tab is hidden to save CPU
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      rafId = requestAnimationFrame(animateRing);
    }
  });
}

/* ============================================================
   MODULE: NAV SCROLL BEHAVIOUR
   Uses ScrollTrigger so it shares the existing RAF budget.
   ============================================================ */
function initNav() {
  const nav    = $('#mainNav');
  const toggle = $('#navToggle');
  const links  = $('#navLinks');
  if (!nav) return;

  // Sticky state via ScrollTrigger (one observer, zero scroll listeners)
  ScrollTrigger.create({
    start: 'top -60',
    onToggle: ({ isActive }) => nav.classList.toggle('stuck', isActive),
  });

  // Mobile hamburger
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      links.classList.toggle('open', !expanded);
    });

    // Close on link click
    $$('a', links).forEach(a =>
      a.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        links.classList.remove('open');
      })
    );
  }
}

/* ============================================================
   MODULE: HERO ENTRANCE
   GSAP timeline — runs once on load.
   ============================================================ */
function initHeroEntrance() {
  if (prefersReducedMotion()) {
    // Skip animation; ensure elements are visible
    $$('#heroEyebrow, #heroBottom').forEach(el => { el.style.opacity = 1; });
    $$('#hl1 span, #hl2 span, #hl3 span').forEach(el => {
      el.style.opacity = 1;
      el.style.transform = 'none';
    });
    return;
  }

  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

  tl.to('#heroEyebrow', { opacity: 1, y: 0, duration: 1, delay: 0.2 })
    .to(['#hl1 span', '#hl2 span', '#hl3 span'], {
      y: '0%', opacity: 1, duration: 1.1, stagger: 0.13,
    }, '-=0.7')
    .to('#heroBottom', { opacity: 1, y: 0, duration: 0.9 }, '-=0.5');
}

/* ============================================================
   MODULE: STAT COUNT-UP
   Triggered by ScrollTrigger when the stat row enters view.
   ============================================================ */
function initStats() {
  const container = $('#heroBottom');
  if (!container) return;

  function countUp(el) {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    if (!target) return;

    const dur   = 2200;
    let startTs = null;

    function step(ts) {
      if (!startTs) startTs = ts;
      const p    = Math.min((ts - startTs) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(ease * target) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  ScrollTrigger.create({
    trigger: container,
    start:   'top 80%',
    once:    true,
    onEnter: () => $$('.stat-num', container).forEach(countUp),
  });
}

/* ============================================================
   MODULE: SCROLL REVEAL
   Single ScrollTrigger per element — removes redundant
   IntersectionObserver logic entirely.
   ============================================================ */
function initScrollReveal() {
  if (prefersReducedMotion()) return;

  $$('.reveal').forEach(el => {
    ScrollTrigger.create({
      trigger:  el,
      start:    'top 88%',
      once:     true,
      onEnter:  () => {
        el.classList.add('on');
        // Release will-change after transition completes
        setTimeout(() => { el.style.willChange = 'auto'; }, 1000);
      },
    });
  });
}

/* ============================================================
   MODULE: 3D SHOWREEL
   - Only runs when visible (ScrollTrigger pause/resume)
   - Disabled entirely on mobile / reduced-motion
   - Uses a single shared rAF loop (started/stopped cleanly)
   ============================================================ */
function initReel() {
  const stage   = $('#reelStage');
  const card    = $('#reelCard');
  const glareEl = $('#reelGlare');
  const shadow  = $('#reelShadow');
  const dd1     = $('#dd1');
  const dd2     = $('#dd2');
  const dd3     = $('#dd3');

  if (!stage || !card) return;

  // Completely skip on mobile or reduced-motion
  if (isMobile() || prefersReducedMotion()) return;

  /* Config ────────────────────────────────────────────────── */
  const CFG = {
    maxTilt:     16,
    glareSize:   48,
    depthScale:  22,
    restTiltX:   8,    // subtle resting perspective
    springHover: 0.09,
    springRest:  0.05,
  };

  /* State ─────────────────────────────────────────────────── */
  let tX = CFG.restTiltX, tY = 0;
  let targX = CFG.restTiltX, targY = 0;
  let gX = 32, gY = 22;
  let targGX = 32, targGY = 22;
  let hovering  = false;
  let visible   = false;
  let rafId     = null;

  /* Input ─────────────────────────────────────────────────── */
  stage.addEventListener('mouseenter', () => { hovering = true; }, { passive: true });

  stage.addEventListener('mouseleave', () => {
    hovering = false;
    targX = CFG.restTiltX;
    targY = 0;
    targGX = 32;
    targGY = 22;
  }, { passive: true });

  stage.addEventListener('mousemove', e => {
    const r  = stage.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width)  * 2 - 1; // -1..1
    const ny = ((e.clientY - r.top)  / r.height) * 2 - 1;
    targX  = -ny * CFG.maxTilt + 2;
    targY  =  nx * CFG.maxTilt;
    targGX = ((e.clientX - r.left) / r.width)  * 100;
    targGY = ((e.clientY - r.top)  / r.height) * 100;
  }, { passive: true });

  /* Keyboard tilt accessibility ──────────────────────────── */
  card.addEventListener('keydown', e => {
    const step = 4;
    if (e.key === 'ArrowLeft')  { targY -= step; }
    if (e.key === 'ArrowRight') { targY += step; }
    if (e.key === 'ArrowUp')    { targX += step; }
    if (e.key === 'ArrowDown')  { targX -= step; }
    // Clamp
    targY = Math.max(-CFG.maxTilt, Math.min(CFG.maxTilt, targY));
    targX = Math.max(-CFG.maxTilt, Math.min(CFG.maxTilt, targX));
  });

  /* Render loop ───────────────────────────────────────────── */
  function tick() {
    if (!visible) { rafId = null; return; }

    const sp = hovering ? CFG.springHover : CFG.springRest;

    // Are we close enough to rest? Skip further lerp to save cycles.
    const settled =
      !hovering &&
      Math.abs(tX - targX) < 0.01 &&
      Math.abs(tY - targY) < 0.01;

    if (!settled) {
      tX = lerp(tX, targX, sp);
      tY = lerp(tY, targY, sp);
      gX = lerp(gX, targGX, 0.07);
      gY = lerp(gY, targGY, 0.07);

      // Card tilt (single transform — compositor only)
      card.style.transform = `rotateX(${tX}deg) rotateY(${tY}deg)`;

      // Specular glare
      const gOp = hovering ? 0.10 : 0.035;
      glareEl.style.background = [
        `radial-gradient(`,
        `ellipse ${CFG.glareSize}% ${CFG.glareSize * 0.65}%`,
        `at ${gX}% ${gY}%,`,
        `rgba(255,255,255,${(gOp * 1.6).toFixed(3)}) 0%,`,
        `rgba(212,180,131,${(gOp * 0.5).toFixed(3)}) 30%,`,
        `transparent 68%)`,
      ].join('');

      // Shadow offset
      if (shadow) {
        shadow.style.transform =
          `translateX(${(-tY * 2.2).toFixed(2)}px) translateY(${(tX * 2.5 + 32).toFixed(2)}px) scaleX(0.83)`;
        shadow.style.opacity = hovering ? '0.65' : '0.32';
      }

      // Depth decorator parallax
      const px = tY * CFG.depthScale * 0.052;
      const py = -tX * CFG.depthScale * 0.052;
      if (dd1) dd1.style.transform = `translate(${(-px * 1.7).toFixed(2)}px,${(-py * 1.7).toFixed(2)}px)`;
      if (dd2) dd2.style.transform = `translate(${( px * 2.1).toFixed(2)}px,${( py * 2.1).toFixed(2)}px)`;
      if (dd3) dd3.style.transform = `translate(${(-px * 1.3).toFixed(2)}px,${(-py * 1.3).toFixed(2)}px)`;
    }

    rafId = requestAnimationFrame(tick);
  }

  function startLoop() { if (!rafId) { rafId = requestAnimationFrame(tick); } }
  function stopLoop()  { if (rafId)  { cancelAnimationFrame(rafId); rafId = null; } }

  /* Pause when out of viewport ────────────────────────────── */
  ScrollTrigger.create({
    trigger:  stage,
    start:    'top bottom',
    end:      'bottom top',
    onEnter:  () => { visible = true;  startLoop(); },
    onLeave:  () => { visible = false; stopLoop();  },
    onEnterBack:  () => { visible = true;  startLoop(); },
    onLeaveBack:  () => { visible = false; stopLoop();  },
  });

  /* Play button opens link / triggers action ─────────────── */
  const playBtn = $('#playOrb');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      // In production: open a modal / navigate to reel URL
      console.log('Play reel clicked');
    });
  }

  /* Thumbnail buttons */
  $$('.r-thumb').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      console.log(`Reel clip ${i + 1} selected`);
    });
  });
}

/* ============================================================
   MODULE: PROJECT CARDS — keyboard accessible open
   ============================================================ */
function initProjectCards() {
  $$('.proj-card').forEach(card => {
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

/* ============================================================
   MODULE: SERVICE CARDS — GSAP hover enhancement
   ============================================================ */
function initServiceCards() {
  if (prefersReducedMotion()) return;

  $$('.svc-card').forEach(card => {
    const arrow = $('.svc-arrow', card);
    if (!arrow) return;

    card.addEventListener('mouseenter', () =>
      gsap.to(arrow, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' })
    );
    card.addEventListener('mouseleave', () =>
      gsap.to(arrow, { opacity: 0, y: 10, duration: 0.3, ease: 'power2.in' })
    );
  });
}

/* ============================================================
   MODULE: RESIZE HANDLER
   Re-evaluates mobile state and kills/restarts heavy modules.
   ============================================================ */
function initResize() {
  let lastMobile = isMobile();

  window.addEventListener('resize', () => {
    const nowMobile = isMobile();
    if (nowMobile !== lastMobile) {
      // Full reload is simplest to avoid partial state issues.
      // In a real SPA, you'd use a proper reactive system.
      window.location.reload();
    }
    lastMobile = nowMobile;
  }, { passive: true });
}

/* ============================================================
   MODULE: REDUCED-MOTION OVERRIDES
   CSS handles most via @media, but JS-driven animations need
   to be explicitly disabled.
   ============================================================ */
function applyReducedMotion() {
  if (!prefersReducedMotion()) return;

  // Stop CSS animations that can't be overridden from a stylesheet
  // (e.g. already started infinite animations)
  $$('.ticker-track, .testi-track, .blob').forEach(el => {
    el.style.animationPlayState = 'paused';
  });
}

/* ============================================================
   MODULE: VISIBILITY — pause all animations when tab hidden
   ============================================================ */
function initVisibilityPause() {
  document.addEventListener('visibilitychange', () => {
    const state = document.hidden ? 'paused' : 'running';
    $$('.ticker-track, .testi-track, .blob, .hero-ambient, .reel-cine-bg')
      .forEach(el => { el.style.animationPlayState = state; });
  });
}

/* ============================================================
   BOOT
   ============================================================ */
function boot() {
  gsap.registerPlugin(ScrollTrigger);

  // Configure ScrollTrigger
  ScrollTrigger.config({ limitCallbacks: true, syncInterval: 40 });

  initCursor();
  initNav();
  initHeroEntrance();
  initStats();
  initScrollReveal();
  initReel();
  initProjectCards();
  initServiceCards();
  initResize();
  applyReducedMotion();
  initVisibilityPause();

  // Refresh ScrollTrigger after all layout is ready
  ScrollTrigger.refresh();
}

// Run after DOM is ready (script is defer'd in HTML)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
