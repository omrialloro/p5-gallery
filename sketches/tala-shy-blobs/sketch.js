// ============================================================================
//  SHY BLOBS — p5.js
//  A crowd of soft, colourful characters. Their eyes follow the mouse and they
//  always drift away from it, never taking their eyes off you.
//  Click the canvas to shout "boo!" and scatter them.
//
//  Controls (bottom bar): how many, how big, which palette or your own colour,
//  shuffle the faces, and a light / dark toggle (top-right).
//  Keys: + / - count · [ ] size · r shuffle · d light/dark · space boo
//  Plain JS on top of p5.js — no HTML, no CSS files.
// ============================================================================

const BAR_H = 56;             // bottom control bar
const FLEE_R = 240;           // blobs inside this radius of the mouse get scared

const THEMES = {
  light: { bg: "#f4eee5", ink: "#1e1b26", panel: "#ffffff", border: "#1e1b2630", text: "#1e1b26", muted: "#1e1b2690", eye: "#ffffff" },
  dark:  { bg: "#15131f", ink: "#0f0e16", panel: "#231f33", border: "#ffffff30", text: "#f4eee5", muted: "#f4eee590", eye: "#fff8ee" },
};

// palettes: the first one is picked straight from the reference picture
const PALETTES = {
  candy:  ["#f6b73c", "#a98be6", "#2f9ee8", "#2fa47d", "#f06a3b", "#ef7ea1", "#f6cf3c", "#29b0d9"],
  pastel: ["#ffcf9f", "#b9f0b0", "#9be8f5", "#a9c4ff", "#c9b9ff", "#ffb8e6", "#f6f08a"],
  neon:   ["#19e6ff", "#ff2bd6", "#b8ff2b", "#ffe12b", "#ff6a2b", "#8a5cff"],
  ocean:  ["#0e7490", "#06b6d4", "#38bdf8", "#60a5fa", "#2dd4bf", "#86efac"],
  custom: [],                 // filled from the colour picker
};

// a weighted bag of body shapes, eye styles and mouths — blobs are most common
const KINDS  = ["blob", "blob", "blob", "star", "heart", "drop", "cloud", "square", "arch"];
const EYES   = ["dots", "dots", "whites", "whites", "cyclops", "sleepy"];
const MOUTHS = ["smile", "smile", "line", "o", "tongue", "cat"];
const FACE_Y = { blob: -0.08, star: 0.02, heart: 0.02, drop: 0.22, cloud: 0.0, square: -0.08, arch: -0.32 };

let settings = { count: 12, size: 90, palette: "candy", custom: "#f06a3b", theme: "light" };
let blobs = [];
let barH = BAR_H;
let mouseSeen = false;        // the mouse has entered the window at least once

// DOM
let ui = [];
let countLabel, countSlider, sizeLabel, sizeSlider, paletteSel, colorPick, shuffleBtn, themeBtn;

// ---------------------------------------------------------------------------
//  p5 LIFECYCLE
// ---------------------------------------------------------------------------
function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.style("display", "block");
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.overflow = "hidden";
  PALETTES.custom = customVariants(settings.custom);
  buildUI();
  applyTheme();                      // setCount() inside buildUI already made the blobs
  frameRate(60);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layoutUI();
}

function draw() {
  const T = THEMES[settings.theme];
  background(T.bg);

  const target = currentTarget();
  for (const b of blobs) { updateBlob(b, target); }

  // draw the lower ones last so overlaps look right
  const order = blobs.slice().sort((a, c) => a.y - c.y);
  for (const b of order) { drawBlob(b, target); }

  // control bar ground + hint
  noStroke(); fill(T.panel);
  rect(0, height - barH, width, barH);
  stroke(T.border); line(0, height - barH + 0.5, width, height - barH + 0.5);
  noStroke(); fill(T.muted); textFont("sans-serif"); textSize(12); textAlign(LEFT, CENTER);
  text(`${blobs.length} blobs · move the mouse: they look, they run · click: boo!`, 12, 16);
}

// ---------------------------------------------------------------------------
//  INPUT
// ---------------------------------------------------------------------------
function onCanvas(e) { return !e || !e.target || e.target.tagName === "CANVAS"; }
function mouseMoved() { mouseSeen = true; }
function mouseDragged() { mouseSeen = true; }
function mousePressed(e) { if (onCanvas(e) && mouseY < height - barH) boo(mouseX, mouseY); }

function keyPressed(e) {
  if (key === " ") { if (e) e.preventDefault(); boo(mouseX, mouseY); }
  else if (key === "+" || key === "=") setCount(settings.count + 1);
  else if (key === "-") setCount(settings.count - 1);
  else if (key === "]") setSize(settings.size + 10);
  else if (key === "[") setSize(settings.size - 10);
  else if (key === "r") shuffleFaces();
  else if (key === "d") toggleTheme();
}

// where the blobs look: the mouse, or a slow wandering point before it arrives
function currentTarget() {
  const inside = mouseSeen && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height - barH;
  if (inside) return { x: mouseX, y: mouseY, real: true };
  const t = frameCount * 0.002;
  return { x: width * (0.2 + 0.6 * noise(t, 3)), y: (height - barH) * (0.2 + 0.6 * noise(t, 7)), real: false };
}

// a sudden fright: everything near the point jumps away
function boo(x, y) {
  for (const b of blobs) {
    const dx = b.x - x, dy = b.y - y;
    const d = max(1, sqrt(dx * dx + dy * dy));
    const k = constrain(1 - d / (FLEE_R * 2), 0, 1);
    b.vx += dx / d * k * 18;
    b.vy += dy / d * k * 18;
    b.fear = max(b.fear, k);
  }
}

// ---------------------------------------------------------------------------
//  BLOBS
// ---------------------------------------------------------------------------
function makeBlob(x, y) {
  const n = 18, pts = [];
  for (let i = 0; i < n; i++) { pts.push(random(0.78, 1.08)); }
  return {
    x: x === undefined ? random(80, width - 80) : x,
    y: y === undefined ? random(80, height - barH - 80) : y,
    vx: 0, vy: 0,
    kind: random(KINDS), eyes: random(EYES), mouth: random(MOUTHS),
    blush: random() < 0.7,
    ci: floor(random(1000)),              // colour index into the palette
    k: random(0.7, 1.3),                  // individual size factor
    pts,                                  // blob outline radii
    seed: random(1000),
    baseRot: random(-0.25, 0.25), rot: 0,
    heading: 0, stretch: 0, fear: 0, bob: 0,
    blink: random(100, 400),              // frames until the next blink
  };
}

function blobColor(b) {
  const pal = PALETTES[settings.palette];
  return pal[b.ci % pal.length];
}

function updateBlob(b, target) {
  b.r = settings.size * b.k * 0.5;
  let ax = 0, ay = 0;

  // 1. fear: push away from the mouse, harder the closer it is
  const dx = b.x - target.x, dy = b.y - target.y;
  const d = max(1, sqrt(dx * dx + dy * dy));
  const fear = target.real ? constrain(1 - d / FLEE_R, 0, 1) : 0;
  b.fear = lerp(b.fear, fear, 0.12);
  if (fear > 0) { const f = fear * fear * 2.4; ax += dx / d * f; ay += dy / d * f; }

  // 2. wander: a lazy noise drift so nobody ever stands perfectly still
  const t = frameCount * 0.004;
  ax += (noise(b.seed, t) - 0.5) * 0.14;
  ay += (noise(b.seed + 50, t) - 0.5) * 0.14;

  // 3. personal space: don't sit on top of each other
  for (const o of blobs) {
    if (o === b) continue;
    const ox = b.x - o.x, oy = b.y - o.y;
    const od = max(1, sqrt(ox * ox + oy * oy));
    const minD = (b.r + (o.r || b.r)) * 1.05;
    if (od < minD) { const p = (minD - od) / minD * 0.7; ax += ox / od * p; ay += oy / od * p; }
  }

  // 4. walls: soft springs that keep the body on screen
  const m = b.r * 0.9, ph = height - barH;
  if (b.x < m) ax += (m - b.x) * 0.06;
  if (b.x > width - m) ax -= (b.x - (width - m)) * 0.06;
  if (b.y < m) ay += (m - b.y) * 0.06;
  if (b.y > ph - m) ay -= (b.y - (ph - m)) * 0.06;

  b.vx = (b.vx + ax) * 0.88;
  b.vy = (b.vy + ay) * 0.88;
  const sp = sqrt(b.vx * b.vx + b.vy * b.vy);
  if (sp > 10) { b.vx *= 10 / sp; b.vy *= 10 / sp; }
  b.x += b.vx; b.y += b.vy;

  // body language: lean into the motion, stretch when fast, bob when idle
  if (sp > 0.4) b.heading = atan2(b.vy, b.vx);
  b.stretch = lerp(b.stretch, constrain(sp * 0.03, 0, 0.28), 0.2);
  b.rot = lerp(b.rot, b.baseRot + b.vx * 0.03, 0.1);
  b.bob = sin(frameCount * 0.05 + b.seed) * 2;

  // blinking
  b.blink--;
  if (b.blink < -8) b.blink = random(120, 420);
}

// ---------------------------------------------------------------------------
//  DRAWING
// ---------------------------------------------------------------------------
function drawBlob(b, target) {
  const s = b.r;
  const col = blobColor(b);
  push();
  translate(b.x + random(-1, 1) * b.fear * 2, b.y + b.bob + random(-1, 1) * b.fear * 2);
  rotate(b.rot);

  // body, squashed along the direction of travel
  push();
  rotate(b.heading); scale(1 + b.stretch, 1 - b.stretch); rotate(-b.heading);
  fill(col); stroke(col); strokeJoin(ROUND); strokeCap(ROUND);
  drawBody(b, s);
  pop();

  // the face is drawn in the un-stretched frame, but rotated so it keeps
  // looking at the target in world space
  const lx = target.x - b.x, ly = target.y - b.y;
  const look = { x: lx * cos(-b.rot) - ly * sin(-b.rot), y: lx * sin(-b.rot) + ly * cos(-b.rot) };
  drawFace(b, s, col, look);
  pop();
}

function drawBody(b, s) {
  strokeWeight(s * 0.28);                          // thick stroke = soft, rounded corners
  if (b.kind === "blob") {
    const n = b.pts.length;
    const hasSpline = typeof splineVertex === "function";   // p5 2.x renamed curveVertex
    beginShape();
    for (let i = 0; i < (hasSpline ? n : n + 3); i++) {     // 1.x needs 3 wrapped control points
      const j = i % n;
      const a = j / n * TWO_PI;
      const rr = s * b.pts[j] * (1 + 0.04 * sin(frameCount * 0.04 + j * 1.7 + b.seed));
      if (hasSpline) splineVertex(cos(a) * rr, sin(a) * rr);
      else curveVertex(cos(a) * rr, sin(a) * rr);
    }
    if (hasSpline) endShape(CLOSE); else endShape();
  } else if (b.kind === "star") {
    beginShape();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 ? s * 0.42 : s * 1.08;
      const a = -HALF_PI + k * PI / 5;
      vertex(cos(a) * rr, sin(a) * rr);
    }
    endShape(CLOSE);
  } else if (b.kind === "heart") {
    strokeWeight(s * 0.16);
    beginShape();
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TWO_PI;
      const hx = 16 * pow(sin(a), 3);
      const hy = -(13 * cos(a) - 5 * cos(2 * a) - 2 * cos(3 * a) - cos(4 * a));
      vertex(hx * s / 17, hy * s / 17 + s * 0.05);
    }
    endShape(CLOSE);
  } else if (b.kind === "drop") {
    // an egg / pear: wide and round below, narrowing to a soft tip above
    // (plain vertices: bezierVertex has a different signature in p5 1.x and 2.x)
    strokeWeight(s * 0.3);
    beginShape();
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * TWO_PI;
      const up = (1 - sin(a)) / 2;                     // 1 at the top, 0 at the bottom
      const w = s * 0.85 * (1 - 0.55 * up * up);        // narrower towards the tip
      vertex(cos(a) * w, sin(a) * s * 0.9 - s * 0.05);
    }
    endShape(CLOSE);
  } else if (b.kind === "cloud") {
    noStroke();
    ellipse(0, s * 0.25, s * 2.0, s * 1.2);
    circle(-s * 0.55, -s * 0.15, s * 1.0);
    circle(0, -s * 0.45, s * 1.15);
    circle(s * 0.55, -s * 0.1, s * 1.05);
    circle(-s * 0.9, s * 0.35, s * 0.8);
    circle(s * 0.9, s * 0.35, s * 0.8);
  } else if (b.kind === "square") {
    noStroke();
    rect(-s * 0.95, -s, s * 1.9, s * 2, s * 0.7);
  } else if (b.kind === "arch") {
    noStroke();
    rect(-s, -s * 0.95, s * 2, s * 1.2, s * 0.6);  // the dome
    rect(-s, -s * 0.5, s * 0.62, s * 1.45, s * 0.31);
    rect(-s * 0.31, -s * 0.5, s * 0.62, s * 1.45, s * 0.31);
    rect(s * 0.38, -s * 0.5, s * 0.62, s * 1.45, s * 0.31);
  }
}

function drawFace(b, s, col, look) {
  const T = THEMES[settings.theme];
  const fy = s * FACE_Y[b.kind];
  const fear = b.fear;
  const er = s * (0.16 + fear * 0.07);          // eyes open wide when scared
  const pr = er * (0.55 - fear * 0.15);
  const blinking = b.blink < 0;

  // pupil offset: towards the target, never leaving the eye
  const ld = max(1, sqrt(look.x * look.x + look.y * look.y));
  const reach = min(1, ld / 260);
  const ox = look.x / ld * reach, oy = look.y / ld * reach;

  noStroke();
  const eyeList = b.eyes === "cyclops" ? [[0, fy, er * 1.5, pr * 1.4]] : [[-s * 0.33, fy, er, pr], [s * 0.33, fy, er, pr]];
  for (const [ex, ey, rr, pp] of eyeList) {
    if (blinking) {
      stroke(T.ink); strokeWeight(s * 0.05); noFill();
      line(ex - rr * 0.8, ey, ex + rr * 0.8, ey);
      noStroke();
      continue;
    }
    if (b.eyes === "dots") {
      fill(T.ink);
      circle(ex + ox * rr * 0.5, ey + oy * rr * 0.5, pp * 2.2);
    } else {
      fill(T.eye); circle(ex, ey, rr * 2);
      fill(T.ink); circle(ex + ox * (rr - pp), ey + oy * (rr - pp), pp * 2);
      fill(T.eye); circle(ex + ox * (rr - pp) - pp * 0.35, ey + oy * (rr - pp) - pp * 0.35, pp * 0.6);
      if (b.eyes === "sleepy" && fear < 0.5) {
        fill(col); arc(ex, ey, rr * 2 + 2, rr * 2 + 2, PI, TWO_PI);      // heavy lid
        stroke(T.ink); strokeWeight(s * 0.04); noFill();
        line(ex - rr, ey, ex + rr, ey);
        noStroke();
      }
    }
  }

  // blush
  if (b.blush) {
    fill(255, 110, 130, 110);
    ellipse(-s * 0.5, fy + er * 1.3, er * 1.3, er * 0.75);
    ellipse(s * 0.5, fy + er * 1.3, er * 1.3, er * 0.75);
  }

  // mouth
  const my = fy + s * 0.34, mw = s * 0.26;
  stroke(T.ink); strokeWeight(s * 0.05); strokeCap(ROUND); noFill();
  if (fear > 0.45) {                                              // scared: a round "oh!"
    noStroke(); fill(T.ink);
    ellipse(0, my + mw * 0.1, mw * 0.55, mw * (0.4 + fear * 0.6));
  } else if (b.mouth === "smile") {
    arc(0, my, mw, mw * 0.6, 0.15, PI - 0.15);
  } else if (b.mouth === "line") {
    line(-mw * 0.45, my, mw * 0.45, my);
  } else if (b.mouth === "o") {
    noStroke(); fill(T.ink); circle(0, my, mw * 0.4);
  } else if (b.mouth === "tongue") {
    arc(0, my, mw, mw * 0.6, 0.15, PI - 0.15);
    noStroke(); fill("#f0506a");
    arc(mw * 0.12, my + mw * 0.12, mw * 0.45, mw * 0.55, 0, PI);
  } else if (b.mouth === "cat") {
    arc(-mw * 0.25, my, mw * 0.5, mw * 0.4, 0, PI);
    arc(mw * 0.25, my, mw * 0.5, mw * 0.4, 0, PI);
  }
  noStroke();
}

// ---------------------------------------------------------------------------
//  SETTINGS
// ---------------------------------------------------------------------------
function setCount(n) {
  settings.count = constrain(n, 1, 40);
  while (blobs.length < settings.count) { blobs.push(makeBlob()); }
  while (blobs.length > settings.count) { blobs.pop(); }
  countSlider.value(settings.count);
  countLabel.html(`Blobs ${settings.count}`);
}

function setSize(v) {
  settings.size = constrain(v, 30, 180);
  sizeSlider.value(settings.size);
  sizeLabel.html(`Size ${settings.size}`);
}

function setPalette(name) {
  settings.palette = name;
  paletteSel.selected(name);
}

function shuffleFaces() {
  blobs = blobs.map(b => makeBlob(b.x, b.y));
}

// five friendly variations of one picked colour: hue neighbours + a pale one
function customVariants(hex) {
  push();
  colorMode(HSB, 360, 100, 100);
  const c = color(hex);
  const h = hue(c), s = saturation(c), v = brightness(c);
  const out = [];
  const defs = [[0, 0, 0], [25, 0, 0], [-25, 0, 0], [0, -35, 10], [50, 0, -10], [-50, -10, 0]];
  for (const [dh, ds, dv] of defs) {
    const cc = color((h + dh + 360) % 360, constrain(s + ds, 15, 100), constrain(v + dv, 35, 100));
    out.push(`rgb(${round(red(cc))},${round(green(cc))},${round(blue(cc))})`);
  }
  pop();
  return out;
}

function toggleTheme() {
  settings.theme = settings.theme === "light" ? "dark" : "light";
  applyTheme();
}

// ---------------------------------------------------------------------------
//  UI
// ---------------------------------------------------------------------------
function buildUI() {
  countLabel = createSpan("");
  countSlider = createSlider(1, 40, settings.count, 1);
  countSlider.input(() => setCount(Number(countSlider.value())));

  sizeLabel = createSpan("");
  sizeSlider = createSlider(30, 180, settings.size, 1);
  sizeSlider.input(() => setSize(Number(sizeSlider.value())));

  paletteSel = createSelect();
  paletteSel.option("Candy", "candy");
  paletteSel.option("Pastel", "pastel");
  paletteSel.option("Neon", "neon");
  paletteSel.option("Ocean", "ocean");
  paletteSel.option("My colour", "custom");
  paletteSel.changed(() => setPalette(paletteSel.value()));

  colorPick = createColorPicker(settings.custom);
  colorPick.attribute("title", "pick your own colour");
  colorPick.input(() => {
    settings.custom = colorPick.value();
    PALETTES.custom = customVariants(settings.custom);
    setPalette("custom");
  });

  shuffleBtn = createButton("Shuffle faces");
  shuffleBtn.mousePressed(shuffleFaces);

  themeBtn = createButton("");
  themeBtn.mousePressed(toggleTheme);

  ui = [countLabel, countSlider, sizeLabel, sizeSlider, paletteSel, colorPick, shuffleBtn];
  setCount(settings.count);
  setSize(settings.size);
  setPalette(settings.palette);
}

function applyTheme() {
  const T = THEMES[settings.theme];
  document.body.style.background = T.bg;
  for (const el of [countLabel, sizeLabel]) {
    el.style("font-family", "sans-serif"); el.style("font-size", "13px");
    el.style("color", T.text); el.style("line-height", "34px"); el.style("white-space", "nowrap");
  }
  for (const el of [countSlider, sizeSlider]) {
    el.style("width", "120px"); el.style("accent-color", "#f06a3b"); el.style("vertical-align", "middle");
  }
  for (const el of [paletteSel, shuffleBtn, themeBtn]) {
    el.style("font-family", "sans-serif"); el.style("font-size", "13px");
    el.style("padding", "7px 14px"); el.style("border-radius", "999px"); el.style("cursor", "pointer");
    el.style("background", T.panel); el.style("color", T.text);
    el.style("border", `1px solid ${T.border}`); el.style("white-space", "nowrap");
  }
  colorPick.style("width", "34px"); colorPick.style("height", "34px");
  colorPick.style("padding", "0"); colorPick.style("border", `1px solid ${T.border}`);
  colorPick.style("border-radius", "50%"); colorPick.style("cursor", "pointer");
  colorPick.style("background", T.panel); colorPick.style("vertical-align", "middle");
  themeBtn.html(settings.theme === "light" ? "☾  Dark" : "☀  Light");
  layoutUI();
}

// controls along the bottom, wrapping to a second row on narrow windows
function layoutUI() {
  themeBtn.style("position", "absolute");
  themeBtn.position(0, 0);
  themeBtn.position(width - themeBtn.elt.offsetWidth - 12, 10);

  const rowH = 44, gap = 10;
  for (const el of ui) { el.position(0, 0); }       // absolute first, then measure
  const slots = [];
  let x = 12, row = 0;
  for (const el of ui) {
    const w = el.elt.offsetWidth;
    if (x > 12 && x + w > width - 12) { row++; x = 12; }
    slots.push([x, row]);
    x += w + gap;
  }
  barH = (row + 1) * rowH + 12;
  const y0 = height - barH + 11;
  ui.forEach((el, i) => el.position(slots[i][0], y0 + slots[i][1] * rowH));
}
