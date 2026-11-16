// מחבואים — Galit Rossman
// The whole photo fills up with dots, lines or letters. Only the chosen figures stay as they were.

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const $ = (id) => document.getElementById(id);

const INK = '#1d1b18';
const POP = 0.6; // seconds each mark takes to appear
const HOLD = 1.6; // seconds to rest when fully covered and when fully revealed

const S = {
  mode: 'dots', size: 9, dur: 8, loop: true, order: 'ltr', text: 'מחבואים',
  playing: false, t: 0, last: 0,
  W: 903, H: 538,
  photo: null, photoData: null, paper: '#ddd', cells: [], figures: [],
  editing: false, rects: [], drag: null,
};

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const backOut = (u) => { const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------- photo, figures, cells ----------

function setPhoto(img) {
  let W = img.naturalWidth, H = img.naturalHeight;
  if (W > 1000) { H = Math.round(H * 1000 / W); W = 1000; }
  S.W = W; S.H = H; cv.width = W; cv.height = H;
  const c = makeCanvas(W, H); const cc = c.getContext('2d');
  cc.drawImage(img, 0, 0, W, H);
  S.photo = c;
  S.photoData = cc.getImageData(0, 0, W, H).data;
  // paper tone: the light end of the photo itself
  const px = S.photoData, lums = [];
  for (let i = 0; i < px.length; i += 4 * 31) lums.push(i);
  lums.sort((a, b) => lum(px, b) - lum(px, a));
  const top = lums.slice(Math.floor(lums.length * 0.03), Math.floor(lums.length * 0.2));
  const tone = [0, 1, 2].map((ch) => Math.round(top.reduce((t, i) => t + px[i + ch], 0) / top.length));
  S.paper = `rgb(${tone})`;
}
const lum = (px, i) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];

function makeFigure(maskCanvas, keep, hit, name) {
  const sprite = makeCanvas(S.W, S.H); const sc = sprite.getContext('2d');
  sc.drawImage(S.photo, 0, 0);
  sc.globalCompositeOperation = 'destination-in';
  sc.filter = 'blur(1px)';
  sc.drawImage(maskCanvas, 0, 0);
  const a = maskCanvas.getContext('2d').getImageData(0, 0, S.W, S.H).data;
  let x0 = S.W, y0 = S.H, x1 = 0;
  for (let i = 3; i < a.length; i += 4) if (a[i] > 128) { const p = (i - 3) / 4, x = p % S.W, y = (p / S.W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
  return { sprite, keep, hit, name, tag: [(x0 + x1) / 2, y0] };
}

function computeCells() {
  const { W, H, size } = S, px = S.photoData;
  const cells = [];
  for (let y = 0; y < H; y += size) {
    for (let x = 0; x < W; x += size) {
      let t = 0, n = 0;
      for (let yy = y; yy < Math.min(y + size, H); yy += 2) for (let xx = x; xx < Math.min(x + size, W); xx += 2) { t += lum(px, (yy * W + xx) * 4); n++; }
      cells.push({ x, y, cx: x + size / 2, cy: y + size / 2, l: t / n / 255, k: Math.random(), i: cells.length });
    }
  }
  // stretch contrast so the darkest parts get full marks and the brightest get none
  const ls = cells.map((c) => c.l).sort((a, b) => a - b);
  const lo = ls[Math.floor(ls.length * 0.01)], hi = ls[Math.floor(ls.length * 0.98)];
  for (const c of cells) c.d = Math.pow(clamp((hi - c.l) / Math.max(0.05, hi - lo)), 1.35);
  S.cells = cells;
  setTiming();
}

function setTiming() {
  const { W, H } = S, cx = W / 2, cy = H / 2, maxd = Math.hypot(cx, cy);
  for (const c of S.cells) {
    let a;
    if (S.order === 'ltr') a = (c.cx / W) * 0.88 + c.k * 0.12;
    else if (S.order === 'rtl') a = (1 - c.cx / W) * 0.88 + c.k * 0.12;
    else if (S.order === 'center') a = (Math.hypot(c.cx - cx, c.cy - cy) / maxd) * 0.88 + c.k * 0.12;
    else a = c.k;
    c.a = a;
  }
}

async function loadKids() {
  const [photo, labels] = await Promise.all([loadImage('kids.jpg'), loadImage('children.png')]);
  setPhoto(photo);
  const { W, H } = S;
  const lc = makeCanvas(W, H).getContext('2d');
  lc.drawImage(labels, 0, 0);
  const ld = lc.getImageData(0, 0, W, H).data;
  const labelAt = (x, y) => Math.round(ld[(Math.floor(y) * W + Math.floor(x)) * 4] / 25);
  S.figures = [];
  for (let k = 1; k <= 9; k++) {
    const m = makeCanvas(W, H); const mc = m.getContext('2d');
    const img = mc.createImageData(W, H);
    for (let i = 0; i < W * H; i++) if (Math.round(ld[i * 4] / 25) === k) img.data[i * 4 + 3] = 255;
    mc.putImageData(img, 0, 0);
    // 3 = third child from the left, 8 = first from the right, 9 = the adult
    S.figures.push(makeFigure(m, k === 3 || k === 8 || k === 9, (x, y) => labelAt(x, y) === k));
  }
  $('back').hidden = true; $('hint').hidden = false;
  computeCells(); restart();
}

function finishMarking() {
  S.figures = S.rects.filter((r) => r.x1 - r.x0 > 6 && r.y1 - r.y0 > 6).map((r) => {
    const m = makeCanvas(S.W, S.H); const mc = m.getContext('2d');
    mc.filter = 'blur(3px)'; mc.fillStyle = '#000';
    mc.beginPath(); mc.roundRect(r.x0 + 3, r.y0 + 3, r.x1 - r.x0 - 6, r.y1 - r.y0 - 6, 10); mc.fill();
    return makeFigure(m, true, (x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
  });
  S.editing = false; cv.classList.remove('editing');
  $('editbar').hidden = true; $('hint').hidden = false;
  computeCells(); restart();
}

// ---------- drawing ----------

function drawMarks(t, reveal) {
  const s = S.size, T = S.dur, text = S.text || '•';
  // paper first, so neighbouring cells join into one sheet
  ctx.fillStyle = S.paper;
  const live = [];
  for (const c of S.cells) {
    const v = clamp((t - c.a * T) / POP);
    const u = reveal ? 1 - v : v;
    if (u <= 0) continue;
    live.push([c, u]);
    ctx.globalAlpha = Math.min(1, u * 2.5);
    ctx.fillRect(c.x, c.y, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK;
  if (S.mode === 'dots') {
    ctx.beginPath();
    for (const [c, u] of live) {
      const r = (s / 2) * 1.18 * Math.sqrt(c.d) * backOut(u);
      if (r < 0.35) continue;
      ctx.moveTo(c.cx + r, c.cy); ctx.arc(c.cx, c.cy, r, 0, Math.PI * 2);
    }
    ctx.fill();
  } else if (S.mode === 'lines') {
    for (const [c, u] of live) {
      const h = s * 0.92 * c.d * backOut(u);
      if (h < 0.35) continue;
      const w = (s + 0.5) * Math.min(1, u * 1.6);
      ctx.fillRect(c.x, c.cy - h / 2, w, h);
    }
  } else {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let lastFont = '';
    for (const [c, u] of live) {
      if (c.d < 0.04) continue;
      const fs = Math.round(s * (0.7 + 0.75 * c.d) * backOut(u));
      if (fs < 2) continue;
      const font = `700 ${fs}px Rubik, Heebo, sans-serif`;
      if (font !== lastFont) { ctx.font = font; lastFont = font; }
      ctx.globalAlpha = 0.25 + 0.75 * c.d;
      ctx.fillText(text[c.i % text.length], c.cx, c.cy + 1);
    }
    ctx.globalAlpha = 1;
  }
}

function drawTag(f) {
  const [cx, top] = f.tag, y = Math.max(16, top - 14);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2648c4';
  ctx.font = '600 13px Heebo, sans-serif';
  const label = 'נשאר/ת', w = ctx.measureText(label).width + 16;
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.roundRect(cx - w / 2, y - 11, w, 22, 11); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, y + 1);
}

function totalTime() { return S.dur + POP; }
function cycleTime() { return 2 * totalTime() + 2 * HOLD; }

// Where we are in the cover / hold / reveal / hold cycle.
function phase() {
  const C = totalTime();
  if (!S.loop) return { t: Math.min(S.t, C), reveal: false, cover: clamp(S.t / C) };
  const ph = S.t % cycleTime();
  if (ph < C) return { t: ph, reveal: false, cover: ph / C };
  if (ph < C + HOLD) return { t: C, reveal: false, cover: 1 };
  if (ph < 2 * C + HOLD) { const t = ph - C - HOLD; return { t, reveal: true, cover: 1 - t / C }; }
  return { t: 0, reveal: false, cover: 0 };
}

function render() {
  const { W, H } = S;
  if (!S.photo) return;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(S.photo, 0, 0);
  if (S.editing) {
    for (const r of S.rects) {
      ctx.lineWidth = 3; ctx.strokeStyle = '#4f7cff';
      ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    }
    return;
  }
  const ph = phase();
  if (ph.t > 0) drawMarks(ph.t, ph.reveal);
  for (const f of S.figures) if (f.keep) ctx.drawImage(f.sprite, 0, 0);
  if (S.t === 0 && !S.playing) for (const f of S.figures) if (f.keep) drawTag(f);
  $('progress').style.width = `${ph.cover * 100}%`;
  $('count').textContent = `${Math.round(ph.cover * 100)}% מכוסה`;
}

function setStatus(msg) { $('status').textContent = msg; }

function loop(now) {
  if (S.playing) {
    S.t += Math.min(0.1, (now - S.last) / 1000);
    if (!S.loop && S.t >= totalTime()) { S.t = totalTime(); S.playing = false; setStatus('כולם התחבאו.'); updateButtons(); }
  }
  S.last = now;
  render();
  requestAnimationFrame(loop);
}

function updateButtons() {
  $('play').textContent = S.playing ? 'השהיה' : (S.t > 0 && (S.loop || S.t < totalTime()) ? 'המשך' : 'הפעלה');
  $('play').disabled = S.editing;
  $('reset').disabled = S.editing;
}

function restart(play = S.loop) {
  S.t = 0; S.playing = play;
  setStatus(play ? 'מתכסה ומתגלה…' : 'מוכן. לחצו על הפעלה.');
  updateButtons();
}

// ---------- controls ----------

document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => {
  S.mode = r.value;
  $('text-group').hidden = S.mode !== 'letters';
}));
$('size').addEventListener('input', (e) => { S.size = +e.target.value; $('size-out').textContent = S.size; computeCells(); });
$('speed').addEventListener('input', (e) => {
  const p = S.t / (S.loop ? cycleTime() : totalTime());
  S.dur = +e.target.value; $('speed-out').textContent = S.dur;
  S.t = p * (S.loop ? cycleTime() : totalTime());
});
$('loop').addEventListener('change', (e) => { S.loop = e.target.checked; restart(); });
$('order').addEventListener('change', (e) => { S.order = e.target.value; setTiming(); restart(); });
$('letters').addEventListener('input', (e) => { S.text = [...e.target.value.replace(/\s/g, '')].join(''); });

$('play').addEventListener('click', () => {
  if (S.playing) { S.playing = false; setStatus('בהשהיה.'); }
  else { if (!S.loop && S.t >= totalTime()) S.t = 0; S.playing = true; setStatus(S.loop ? 'מתכסה ומתגלה…' : 'מתכסה…'); }
  updateButtons();
});
$('reset').addEventListener('click', () => restart());

$('upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const img = await loadImage(URL.createObjectURL(file));
    setPhoto(img);
    S.figures = []; S.rects = []; S.t = 0; S.playing = false; S.editing = true;
    S.cells = [];
    cv.classList.add('editing');
    $('editbar').hidden = false; $('hint').hidden = true; $('back').hidden = false;
    setStatus('סמנו את מה שנשאר.');
    updateButtons();
  } catch {
    setStatus('לא הצלחתי לפתוח את הקובץ. נסו תמונה בפורמט JPG או PNG.');
  }
  e.target.value = '';
});
$('back').addEventListener('click', () => { S.editing = false; cv.classList.remove('editing'); $('editbar').hidden = true; loadKids(); });
$('done').addEventListener('click', finishMarking);
$('undo').addEventListener('click', () => { S.rects.pop(); });

function toCanvas(e) {
  const r = cv.getBoundingClientRect();
  return [(e.clientX - r.left) * (S.W / r.width), (e.clientY - r.top) * (S.H / r.height)];
}
cv.addEventListener('pointerdown', (e) => {
  const [x, y] = toCanvas(e);
  if (S.editing) {
    cv.setPointerCapture(e.pointerId);
    S.drag = { sx: x, sy: y, rect: null };
    return;
  }
  const f = S.figures.find((f) => f.hit(x, y));
  if (f) f.keep = !f.keep;
});
cv.addEventListener('pointermove', (e) => {
  const d = S.drag; if (!d) return;
  const [x, y] = toCanvas(e);
  if (!d.rect && Math.hypot(x - d.sx, y - d.sy) > 6) { d.rect = {}; S.rects.push(d.rect); }
  if (d.rect) Object.assign(d.rect, { x0: Math.min(d.sx, x), y0: Math.min(d.sy, y), x1: Math.max(d.sx, x), y1: Math.max(d.sy, y) });
});
cv.addEventListener('pointerup', () => { S.drag = null; });

loadKids().catch(() => setStatus('לא הצלחתי לטעון את תמונת הגן.'));
requestAnimationFrame(loop);
