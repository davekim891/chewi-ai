// hero-image.js: the hero is the labelled bicycle render. The image carries the bike and its coloured
// surfaces; the ten tags are real HTML placed at the same positions as the approved composition, revealed
// in sequence, pulsing gently, highlighted on hover. No WebGL. Exposes window.__chewiHero for probes.
import { COLORS } from './colors.js';

const W = 1792, H = 1008; // native size of assets/hero-bike.jpg; all positions below are in those pixels
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
const SVG_NS = 'http://www.w3.org/2000/svg';

const root = document.querySelector('[data-hero]');
const stage = root && root.querySelector('.holo-stage');
const state = { ready: false, mode: 'image', revealed: 0, t: 0, running: false, labels: [], video: null, pose: 1 };

if (stage) {
  const svg = stage.querySelector('.holo-leaders');
  const tagLayer = stage.querySelector('.holo-tags');
  const img = stage.querySelector('img');
  const video = stage.querySelector('.hero-video');
  const entries = LABELS.map(([kind, id, ax, ay, tx, ty], i) => {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.style.setProperty('--c', COLORS[kind]);
    tag.innerHTML = `<span class="tag-kind">${kind}</span><span class="tag-id">${id}</span>`;
    tag.dataset.id = id;
    tagLayer.appendChild(tag);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('stroke', COLORS[kind]); line.setAttribute('stroke-width', '1.2');
    svg.appendChild(line);
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '3.5'); dot.setAttribute('fill', COLORS[kind]);
    svg.appendChild(dot);
    return { kind, id, ax, ay, tx, ty, tag, line, dot, order: i, ease: 0 };
  });

  let size = { w: 1, h: 1 }, hovered = null;
  function layout() {
    const r = stage.getBoundingClientRect();
    size = { w: r.width, h: r.height };
    // the image is object-fit: contain, so map native pixels through the fitted rectangle
    const s = Math.min(size.w / W, size.h / H);
    const ox = (size.w - W * s) / 2, oy = (size.h - H * s) / 2;
    svg.setAttribute('viewBox', `0 0 ${size.w} ${size.h}`);
    const labels = [];
    for (const e of entries) {
      const ax = ox + e.ax * s, ay = oy + e.ay * s;
      const tw = e.tag.offsetWidth || 80, th = e.tag.offsetHeight || 34;
      const tx = Math.max(4, Math.min(size.w - tw - 4, ox + e.tx * s - tw / 2));
      const ty = Math.max(4, Math.min(size.h - th - 4, oy + e.ty * s - th / 2));
      e.tag.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0)`;
      const cx = Math.max(tx, Math.min(ax, tx + tw)), cy = Math.max(ty, Math.min(ay, ty + th));
      e.line.setAttribute('x1', ax.toFixed(1)); e.line.setAttribute('y1', ay.toFixed(1));
      e.line.setAttribute('x2', cx.toFixed(1)); e.line.setAttribute('y2', cy.toFixed(1));
      e.dot.setAttribute('cx', ax.toFixed(1)); e.dot.setAttribute('cy', ay.toFixed(1));
      labels.push({ name: e.id, kind: e.kind, x: ax, y: ay, tagX: tx, tagY: ty, tagW: tw, tagH: th, visible: e.ease > 0.05, opacity: e.ease });
    }
    state.labels = labels;
  }
  function paint() {
    let revealed = 0;
    for (const e of entries) {
      const s = Math.max(0, Math.min(1, (state.t - REVEAL_START - e.order * REVEAL_STEP) / REVEAL_DUR));
      e.ease = 1 - Math.pow(1 - s, 3);
      if (s >= 1) revealed++;
      const hot = hovered === e ? 1 : 0;
      const pulse = s >= 1 && !REDUCED ? 0.08 * Math.sin(2 * state.t + e.order * 0.7) : 0;
      const op = Math.min(1, e.ease * (0.92 + pulse) + hot * 0.08) * state.pose;
      e.tag.style.opacity = op.toFixed(3);
      e.line.setAttribute('opacity', (op * 0.8).toFixed(3));
      e.dot.setAttribute('opacity', op.toFixed(3));
      e.tag.classList.toggle('is-hot', hovered === e);
    }
    state.revealed = revealed;
  }

  // Turntable clip: the tags belong to this pose, which the loop passes at its start and end.
  // pose = 1 inside the pose window, eased to 0 while the bike is turning.
  function poseFactor() {
    if (!state.video || !video.duration) return 1;
    const t = video.currentTime, d = video.duration;
    const tin = +video.dataset.poseIn || 1.2, tout = +video.dataset.poseOut || 1.2, fade = 0.5;
    const a = Math.max(0, Math.min(1, (tin - t) / fade + 1));     // 1 while t < tin - fade, ramps to 0 at tin
    const b = Math.max(0, Math.min(1, (t - (d - tout)) / fade + 1)); // 0 until d - tout - fade, 1 at d - tout
    return Math.max(a, b);
  }
  let last = 0, raf = 0;
  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now; state.t += dt;
    state.pose = poseFactor();
    paint();
    if (state.revealed < entries.length || !REDUCED || state.video) raf = requestAnimationFrame(frame); else state.running = false;
  }
  function start() { if (state.running) return; state.running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { if (!state.running) return; cancelAnimationFrame(raf); state.running = false; }

  new ResizeObserver(() => { layout(); paint(); }).observe(stage);
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting && document.visibilityState === 'visible') start(); else stop(); }, { threshold: 0.05 });
  io.observe(root);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') stop(); else io.takeRecords(); });

  // hover: nearest anchor within 36px, or the tag itself
  if (!matchMedia('(pointer: coarse)').matches) {
    stage.addEventListener('pointermove', (ev) => {
      const r = stage.getBoundingClientRect();
      const px = ev.clientX - r.left, py = ev.clientY - r.top;
      let best = null, bestD = 36;
      for (const e of entries) {
        const l = state.labels[e.order]; if (!l) continue;
        const d = Math.hypot(px - l.x, py - l.y);
        const inTag = px >= l.tagX && px <= l.tagX + l.tagW && py >= l.tagY && py <= l.tagY + l.tagH;
        if (inTag || d < bestD) { best = e; bestD = inTag ? 0 : d; }
      }
      if (best !== hovered) { hovered = best; stage.classList.toggle('is-hover', !!hovered); paint(); }
    });
    stage.addEventListener('pointerleave', () => { hovered = null; stage.classList.remove('is-hover'); paint(); });
  }

  const ready = () => {
    state.ready = true;
    root.dataset.mode = 'image';
    document.documentElement.dataset.heroState = 'image';
    if (REDUCED) state.t = 20;
    layout(); paint();
    start();
    // optional turntable clip (assets/hero-bike.mp4): if it exists and motion is allowed, it plays under the tags
    if (video && !REDUCED && video.dataset.clip) {
      video.addEventListener('canplay', () => {
        state.video = { src: video.currentSrc, duration: video.duration };
        stage.classList.add('has-video');
        root.dataset.mode = 'video'; document.documentElement.dataset.heroState = 'video';
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener('error', () => { video.remove(); }, { once: true });
      video.src = video.dataset.clip; video.removeAttribute('data-clip');
    }
  };
  if (img.complete) ready(); else { img.addEventListener('load', ready, { once: true }); img.addEventListener('error', ready, { once: true }); }

  window.__chewiHero = {
    status() { layout(); paint(); return { ...state, labels: state.labels.map((l) => ({ ...l })), canvas: { w: size.w, h: size.h }, hovered: hovered ? hovered.id : null, videoTime: state.video ? video.currentTime : null }; },
    setTime(s) { state.t = s; layout(); paint(); },
    renderOnce() { layout(); paint(); },
  };
  window.__chewiScenes = window.__chewiScenes || {};
  window.__chewiScenes.hero = window.__chewiHero;
}
