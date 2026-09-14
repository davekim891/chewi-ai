// hero-image.js: the hero is the approved bicycle render with its ten action surfaces as live HTML tags.
// Interactions: the plate tilts in perspective with the pointer; hovering a surface lights its tag;
// clicking (or tapping) a surface or tag opens a detail card and highlights the manifest row; with the
// optional turntable clip present, dragging scrubs the rotation and the tags return at the reference pose.
// No WebGL. Exposes window.__chewiHero for the verification probes documented in README.
import { COLORS } from './colors.js';
import { PATCHES, ROLES, KIND_NOTES } from './bike.js';

const W = 1792, H = 1008; // native size of assets/hero-bike.jpg; positions below are in those pixels
// [kind, id, anchorX, anchorY, tagCentreX, tagCentreY]
const LABELS = [
  ['CONTACT', 'tire_r',  512, 722,  200, 650],
  ['CONTACT', 'tire_f', 1168, 858, 1450, 858],
  ['ROTATION', 'crank',  742, 612,  640, 810],
  ['CONTACT', 'pedal_l', 665, 520,  560, 400],
  ['CONTACT', 'pedal_r', 856, 702,  935, 830],
  ['SUPPORT', 'saddle',  655, 160,  380,  92],
  ['GRIP', 'grip_l',    1218, 148, 1372,  62],
  ['GRIP', 'grip_r',     948, 160,  820,  52],
  ['ROTATION', 'hub_f', 1152, 615, 1440, 560],
  ['HINGE', 'headset',  1077, 276, 1270, 236],
];
const REVEAL_START = 0.5, REVEAL_STEP = 0.45, REVEAL_DUR = 0.45;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches || !!window.__chewiForceReduced;
const COARSE = !matchMedia('(any-pointer: fine)').matches; // no mouse or pen anywhere: tap-only
const SVG_NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const root = document.querySelector('[data-hero]');
const stage = root && root.querySelector('.holo-stage');
const state = { ready: false, mode: 'image', revealed: 0, t: 0, running: false, labels: [], video: null, pose: 1, active: null, tilt: [0, 0] };

if (stage) {
  const svg = stage.querySelector('.holo-leaders');
  const tagLayer = stage.querySelector('.holo-tags');
  const img = stage.querySelector('img');
  const video = stage.querySelector('.hero-video');
  const hint = stage.querySelector('.holo-hint');
  const detail = stage.querySelector('.hero-detail');

  // everything that tilts lives on one plate
  const plate = document.createElement('div');
  plate.className = 'hero-plate';
  for (const el of [img, video, svg, tagLayer]) if (el) plate.appendChild(el);
  stage.insertBefore(plate, stage.firstChild);

  const byId = Object.fromEntries(PATCHES.map((p) => [p.id, p]));
  const entries = LABELS.map(([kind, id, ax, ay, tx, ty], i) => {
    const tag = document.createElement('button');
    tag.type = 'button';
    tag.className = 'tag';
    tag.style.setProperty('--c', COLORS[kind]);
    tag.innerHTML = `<span class="tag-kind">${kind}</span><span class="tag-id">${id}</span>`;
    tag.dataset.id = id;
    tag.setAttribute('aria-label', `${kind}: ${id}, ${ROLES[kind]}${byId[id] ? ', attached to ' + byId[id].joint : ''}`);
    tagLayer.appendChild(tag);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('stroke', COLORS[kind]); line.setAttribute('stroke-width', '1.2');
    svg.appendChild(line);
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '3.5'); dot.setAttribute('fill', COLORS[kind]);
    svg.appendChild(dot);
    return { kind, id, ax, ay, tx, ty, tag, line, dot, order: i, ease: 0 };
  });

  let size = { w: 1, h: 1 }, hovered = null, active = null;
  function layout() {
    const r = stage.getBoundingClientRect();
    size = { w: r.width, h: r.height };
    const s = Math.min(size.w / W, size.h / H);            // object-fit: contain
    const ox = (size.w - W * s) / 2, oy = (size.h - H * s) / 2;
    svg.setAttribute('viewBox', `0 0 ${size.w} ${size.h}`);
    const labels = [];
    for (const e of entries) {
      const ax = ox + e.ax * s, ay = oy + e.ay * s;
      const tw = e.tag.offsetWidth || 80, th = e.tag.offsetHeight || 34;
      const tx = clamp(ox + e.tx * s - tw / 2, 4, size.w - tw - 4);
      const ty = clamp(oy + e.ty * s - th / 2, 4, size.h - th - 4);
      e.tag.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0)`;
      const cx = clamp(ax, tx, tx + tw), cy = clamp(ay, ty, ty + th);
      e.line.setAttribute('x1', ax.toFixed(1)); e.line.setAttribute('y1', ay.toFixed(1));
      e.line.setAttribute('x2', cx.toFixed(1)); e.line.setAttribute('y2', cy.toFixed(1));
      e.dot.setAttribute('cx', ax.toFixed(1)); e.dot.setAttribute('cy', ay.toFixed(1));
      labels.push({ name: e.id, kind: e.kind, x: ax, y: ay, tagX: tx, tagY: ty, tagW: tw, tagH: th, visible: e.ease * state.pose > 0.05, opacity: e.ease * state.pose });
    }
    state.labels = labels;
  }
  function paint() {
    let revealed = 0;
    for (const e of entries) {
      const s = clamp((state.t - REVEAL_START - e.order * REVEAL_STEP) / REVEAL_DUR, 0, 1);
      e.ease = 1 - Math.pow(1 - s, 3);
      if (s >= 1) revealed++;
      const lit = hovered === e || active === e;
      const pulse = s >= 1 && !REDUCED ? 0.08 * Math.sin(2 * state.t + e.order * 0.7) : 0;
      const op = Math.min(1, e.ease * (0.92 + pulse) + (lit ? 0.08 : 0)) * state.pose;
      e.tag.style.opacity = op.toFixed(3);
      e.tag.tabIndex = op > 0.5 ? 0 : -1;
      e.line.setAttribute('opacity', (op * 0.8).toFixed(3));
      e.dot.setAttribute('opacity', op.toFixed(3));
      e.tag.classList.toggle('is-hot', hovered === e);
      e.tag.classList.toggle('is-active', active === e);
    }
    state.revealed = revealed;
    plate.style.transform = REDUCED ? '' : `rotateY(${state.tilt[0].toFixed(2)}deg) rotateX(${state.tilt[1].toFixed(2)}deg)`;
  }

  // Turntable clip: tags belong to the reference pose at the loop's start and end.
  function poseFactor() {
    if (!state.video || !video.duration) return 1;
    const t = video.currentTime, d = video.duration;
    const tin = +video.dataset.poseIn || 1.2, tout = +video.dataset.poseOut || 1.2, fade = 0.5;
    const a = clamp((tin - t) / fade + 1, 0, 1);
    const b = clamp((t - (d - tout)) / fade + 1, 0, 1);
    return Math.max(a, b);
  }

  let last = 0, raf = 0, tiltT = [0, 0];
  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now; state.t += dt;
    state.pose = poseFactor();
    const k = 1 - Math.exp(-6 * dt);
    state.tilt[0] += (tiltT[0] - state.tilt[0]) * k; state.tilt[1] += (tiltT[1] - state.tilt[1]) * k;
    paint();
    if (state.revealed < entries.length || !REDUCED || state.video) raf = requestAnimationFrame(frame); else state.running = false;
  }
  function start() { if (state.running) return; state.running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { if (!state.running) return; cancelAnimationFrame(raf); state.running = false; }

  new ResizeObserver(() => { layout(); paint(); }).observe(stage);
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting && document.visibilityState === 'visible') start(); else stop(); }, { threshold: 0.05 });
  io.observe(root);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') stop(); else if (root.getBoundingClientRect().bottom > 0) start(); });

  // ---- pointer: tilt, hover, click, scrub -----------------------------------
  const nearest = (px, py) => {
    let best = null, bestD = 36;
    for (const e of entries) {
      const l = state.labels[e.order]; if (!l || l.opacity < 0.3) continue;
      const d = Math.hypot(px - l.x, py - l.y);
      const inTag = px >= l.tagX && px <= l.tagX + l.tagW && py >= l.tagY && py <= l.tagY + l.tagH;
      if (inTag || d < bestD) { best = e; bestD = inTag ? 0 : d; }
    }
    return best;
  };
  let scrub = null;
  stage.addEventListener('pointermove', (ev) => {
    const r = stage.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    if (scrub) {
      if (ev.pointerId !== scrub.id) return;
      const d = video.duration || 0;
      video.currentTime = ((scrub.t0 + ((ev.clientX - scrub.x0) / r.width) * d) % d + d) % d;
      return;
    }
    if (COARSE || REDUCED) return;
    tiltT = [((px / r.width) - 0.5) * 7, -((py / r.height) - 0.5) * 5];
    const h = nearest(px, py);
    if (h !== hovered) { hovered = h; stage.classList.toggle('is-hover', !!hovered); paint(); }
  });
  stage.addEventListener('pointerleave', () => { tiltT = [0, 0]; hovered = null; stage.classList.remove('is-hover'); paint(); });
  stage.addEventListener('pointerdown', (ev) => {
    if (!state.video || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    scrub = { id: ev.pointerId, x0: ev.clientX, t0: video.currentTime };
    video.pause();
    stage.classList.add('is-scrubbing');
    try { stage.setPointerCapture(ev.pointerId); } catch {}
  });
  const endScrub = (ev) => {
    if (!scrub || ev.pointerId !== scrub.id) return;
    scrub = null;
    stage.classList.remove('is-scrubbing');
    try { stage.releasePointerCapture(ev.pointerId); } catch {}
    if (!REDUCED) video.play().catch(() => {});
  };
  stage.addEventListener('pointerup', endScrub);
  stage.addEventListener('pointercancel', endScrub);
  stage.addEventListener('lostpointercapture', endScrub);

  // click or tap: select a surface
  stage.addEventListener('click', (ev) => {
    if (ev.target.closest('.hero-detail')) return;
    const tagEl = ev.target.closest('.tag');
    let e = tagEl ? entries.find((x) => x.tag === tagEl) : null;
    if (!e) { const r = stage.getBoundingClientRect(); e = nearest(ev.clientX - r.left, ev.clientY - r.top); }
    select(e);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && active) select(null); });
  detail.querySelector('.hero-detail-close').addEventListener('click', () => select(null));

  function select(e) {
    if (active === e) e = null;
    active = e;
    state.active = e ? e.id : null;
    for (const tr of document.querySelectorAll('.manifest tr[data-id]')) {
      const on = !!e && tr.dataset.id === e.id;
      tr.classList.toggle('is-active', on);
      if (on) tr.style.setProperty('--c', COLORS[e.kind]); else tr.style.removeProperty('--c');
    }
    if (e) {
      const p = byId[e.id];
      detail.style.setProperty('--c', COLORS[e.kind]);
      detail.querySelector('.tag-kind').textContent = e.kind;
      detail.querySelector('.tag-kind').style.color = COLORS[e.kind];
      detail.querySelector('.tag-id').textContent = e.id;
      detail.querySelector('.hero-detail-role').textContent = ROLES[e.kind] + (p ? `, attached to ${p.joint}` : '');
      detail.querySelector('.hero-detail-note').textContent = KIND_NOTES[e.kind];
      detail.hidden = false;
      if (hint) hint.classList.add('is-done');
    } else detail.hidden = true;
    paint();
  }

  const ready = () => {
    state.ready = true;
    root.dataset.mode = 'image';
    document.documentElement.dataset.heroState = 'image';
    if (REDUCED) state.t = 20;
    layout(); paint();
    start();
    // optional turntable clip (assets/hero-bike.mp4): plays under the tags; drag scrubs it
    if (video && !REDUCED && video.dataset.clip) {
      video.addEventListener('canplay', () => {
        state.video = { src: video.currentSrc, duration: video.duration };
        stage.classList.add('has-video');
        root.dataset.mode = 'video'; document.documentElement.dataset.heroState = 'video';
        if (hint) hint.textContent = COARSE ? 'Drag to turn, tap a surface' : 'Drag to turn, click a surface';
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener('error', () => { video.remove(); }, { once: true });
      video.src = video.dataset.clip; video.removeAttribute('data-clip');
    } else if (hint) hint.textContent = COARSE ? 'Tap a surface' : 'Click a surface';
  };
  if (img.complete) ready(); else { img.addEventListener('load', ready, { once: true }); img.addEventListener('error', ready, { once: true }); }

  window.__chewiHero = {
    status() { layout(); paint(); return { ...state, labels: state.labels.map((l) => ({ ...l })), canvas: { w: size.w, h: size.h }, hovered: hovered ? hovered.id : null, videoTime: state.video ? video.currentTime : null }; },
    setTime(s) { state.t = s; layout(); paint(); },
    renderOnce() { layout(); paint(); },
    select(id) { select(entries.find((e) => e.id === id) || null); return state.active; },
  };
  window.__chewiScenes = window.__chewiScenes || {};
  window.__chewiScenes.hero = window.__chewiHero;
}
