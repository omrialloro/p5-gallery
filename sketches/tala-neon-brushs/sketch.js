// ============================================================================
//  NEON LAB — p5.js
//  Two ideas in one sketch, switched with a single button (top-right) or Tab:
//    1. LIFE   — Conway's Game of Life (unchanged from before)
//    2. BRUSH  — the deck's chaos / random-walk idea turned into a brush whose
//                size, width, speed, opacity, noise and colour are all live sliders
//  Everything is plain JS on top of p5.js: no HTML, no CSS files.
// ============================================================================

// ---------------------------------------------------------------------------
//  SHARED STATE
// ---------------------------------------------------------------------------
const TOOLBAR_H = 56;         // bottom bar reserved for the controls
const STATUS_H  = 30;         // thin status line above the toolbar
const BG = "#0a0b14";         // page / canvas ground

let mode = "life";            // "life" | "brush"
let modeBtn;                  // the one button that switches ideas

// Neon palette shared by both ideas (hex for the DOM, HSB for the canvas)
const NEON_HEX = { cyan: "#19e6ff", magenta: "#ff2bd6", lime: "#b8ff2b", yellow: "#ffe12b", orange: "#ff6a2b" };
const NEON = [
  [185, 100, 100],  // cyan
  [300, 100, 100],  // magenta
  [95, 100, 100],   // lime
  [50, 100, 100],   // yellow
  [15, 100, 100],   // orange
];

// ---------------------------------------------------------------------------
//  p5 LIFECYCLE
// ---------------------------------------------------------------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.background = BG;
  document.body.style.overflow = "hidden";

  lifeInit();
  brushInit();
  buildModeButton();
  setMode("life");
  frameRate(60);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  lifeResize();
  brushResize();
  layoutAll();
}

function draw() {
  if (mode === "life") lifeDraw();
  else brushDraw();
}

// ---------------------------------------------------------------------------
//  INPUT ROUTING  (ignore presses that land on DOM controls, not the canvas)
// ---------------------------------------------------------------------------
function onCanvas(e) {
  return !e || !e.target || e.target.tagName === "CANVAS";
}
function mousePressed(e)  { if (!onCanvas(e)) return; mode === "life" ? lifeMousePressed() : brushMousePressed(); }
function mouseDragged(e)  { if (!onCanvas(e)) return; mode === "life" ? lifeMouseDragged() : brushMouseDragged(); }
function mouseReleased(e) { mode === "life" ? lifeMouseReleased() : brushMouseReleased(); }
function keyPressed(e) {
  if (key === "Tab") { if (e) e.preventDefault(); setMode(mode === "life" ? "brush" : "life"); return; }
  if (key === " " && e) e.preventDefault();          // keep the page from scrolling
  if (mode === "life") lifeKeyPressed(); else brushKeyPressed();
}

// ---------------------------------------------------------------------------
//  MODE SWITCH
// ---------------------------------------------------------------------------
function buildModeButton() {
  modeBtn = createButton("");
  modeBtn.style("position", "absolute");
  modeBtn.style("font-family", "monospace");
  modeBtn.style("font-size", "12px");
  modeBtn.style("letter-spacing", "0.08em");
  modeBtn.style("text-transform", "uppercase");
  modeBtn.style("padding", "8px 16px");
  modeBtn.style("border-radius", "999px");
  modeBtn.style("cursor", "pointer");
  modeBtn.style("background", "#141629");
  modeBtn.style("color", "#ffffff");
  modeBtn.style("border", "1px solid #ffffff55");
  modeBtn.style("box-shadow", "0 0 10px #ffffff22");
  modeBtn.style("white-space", "nowrap");
  modeBtn.mousePressed(() => setMode(mode === "life" ? "brush" : "life"));
}

function setMode(next) {
  mode = next;
  if (mode === "life") {
    brushUI.forEach(el => el.hide());
    lifeUI.forEach(el => el.show());
    modeBtn.html("⇄ Brush");
    cursor(ARROW);
  } else {
    lifeRunning = false; playBtn.html("Play");       // pause Life while you paint
    lifeUI.forEach(el => el.hide());
    brushUI.forEach(el => el.show());
    modeBtn.html("⇄ Life");
    cursor(CROSS);
  }
  layoutAll();
}

function layoutAll() {
  modeBtn.position(0, 0);                                   // measure, then place
  modeBtn.position(width - modeBtn.elt.offsetWidth - 12, 12);
  const bar = max(TOOLBAR_H, placeRow(mode === "life" ? lifeUI : brushUI));
  if (mode === "brush") barH = bar;
  else if (bar !== lifeBarH) { lifeBarH = bar; lifeInitGrid(true); }
}

// status line under the paper: the key hints on the right are optional and
// disappear first when there is no room for both texts
function statusLine(left, right, y) {
  noStroke(); textFont("monospace"); textSize(13);
  textAlign(LEFT, CENTER);
  text(left, 12, y);
  if (textWidth(left) + textWidth(right) + 48 < width) {
    textAlign(RIGHT, CENTER); fill(232, 15, 55);
    text(right, width - 12, y);
  }
}

// lay a group of visible controls out along the bottom bar, wrapping to a
// second row when the window is narrow; returns the bar height used
function placeRow(elements) {
  const rowH = 44, gap = 8;
  const slots = [];
  let x = 12, row = 0;
  // measure only once every control is absolutely positioned; a freshly shown
  // element still in the page flow can report the whole window width
  for (const el of elements) { el.position(0, 0); }
  for (const el of elements) {
    const w = el.elt.offsetWidth;
    if (x > 12 && x + w > width - 12) { row++; x = 12; }
    slots.push([x, row]);
    x += w + gap;
  }
  const bar = (row + 1) * rowH + 12;
  const y0 = height - bar + 10;
  elements.forEach((el, i) => el.position(slots[i][0], y0 + slots[i][1] * rowH));
  return bar;
}

// a shared look for buttons / selects, tinted with a neon hex
function styleControl(el, hex, filled = false) {
  el.style("font-family", "monospace");
  el.style("font-size", "13px");
  el.style("padding", "8px 14px");
  el.style("border-radius", "4px");
  el.style("cursor", "pointer");
  el.style("background", filled ? hex : "#141629");
  el.style("color", filled ? BG : hex);
  el.style("border", `1px solid ${hex}`);
  el.style("box-shadow", filled ? `0 0 12px ${hex}88` : `0 0 6px ${hex}33`);
  el.style("font-weight", filled ? "700" : "400");
  el.style("white-space", "nowrap");
}

function styleLabel(el, hex) {
  el.style("font-family", "monospace");
  el.style("font-size", "12px");
  el.style("color", hex);
  el.style("line-height", "34px");
}

// ===========================================================================
//  IDEA 1 — GAME OF LIFE
// ===========================================================================
const CELL = 10;
let cols, rows, grid, nextGrid, age;
let lifeRunning = false, gen = 0, fps = 12, wrapEdges = true;
let lifeBarH = TOOLBAR_H;        // Life bar height (grows to 2 rows when narrow)
let paintValue = 1, lastCell = -1, accumulator = 0;
let lifeUI = [];
let playBtn, stepBtn, clearBtn, randomBtn, speedSlider, speedLabel, patternSel, wrapBtn;

const PATTERNS = {
  glider: ["010", "001", "111"],
  lwss: ["01111", "10001", "00001", "10010"],
  rpent: ["011", "110", "010"],
  diehard: ["00000010", "11000000", "01000111"],
  acorn: ["0100000", "0001000", "1100111"],
  pulsar: [
    "0011100011100", "0000000000000", "1000010100001", "1000010100001",
    "1000010100001", "0011100011100", "0000000000000", "0011100011100",
    "1000010100001", "1000010100001", "1000010100001", "0000000000000",
    "0011100011100",
  ],
  penta: ["0010000100", "1101111011", "0010000100"],
  gun: [
    "000000000000000000000000100000000000",
    "000000000000000000000010100000000000",
    "000000000000110000001100000000000011",
    "000000000001000100001100000000000011",
    "110000000010000010001100000000000000",
    "110000000010001011000010100000000000",
    "000000000010000010000000100000000000",
    "000000000001000100000000000000000000",
    "000000000000110000000000000000000000",
  ],
};

function lifeInit() {
  lifeInitGrid();
  lifeBuildUI();
  placePattern(PATTERNS.gun);
}

function lifeResize() { lifeInitGrid(true); }

function lifeInitGrid(keep = false) {
  const newCols = max(10, floor(width / CELL));
  const newRows = max(10, floor((height - lifeBarH - STATUS_H) / CELL));
  const g = new Uint8Array(newCols * newRows);
  const a = new Uint16Array(newCols * newRows);
  if (keep && grid) {
    for (let y = 0; y < min(rows, newRows); y++) {
      for (let x = 0; x < min(cols, newCols); x++) {
        g[y * newCols + x] = grid[y * cols + x];
        a[y * newCols + x] = age[y * cols + x];
      }
    }
  }
  cols = newCols; rows = newRows; grid = g; age = a;
  nextGrid = new Uint8Array(cols * rows);
}

function countNeighbours(x, y) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let xx = x + dx, yy = y + dy;
      if (xx < 0 || xx >= cols || yy < 0 || yy >= rows) {
        if (!wrapEdges) continue;
        xx = (xx + cols) % cols; yy = (yy + rows) % rows;
      }
      n += grid[yy * cols + xx];
    }
  }
  return n;
}

function stepGeneration() {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const n = countNeighbours(x, y);
      const alive = grid[i] === 1;
      const next = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0); // B3/S23
      nextGrid[i] = next;
      age[i] = next ? (alive ? min(age[i] + 1, 60000) : 0) : 0;
    }
  }
  [grid, nextGrid] = [nextGrid, grid];
  gen++;
}

function cellColor(a) {
  if (a === 0) return color(185, 20, 100);               // newborn: white-hot
  const idx = min(floor((a - 1) / 4), NEON.length - 1);  // shift hue every 4 generations
  const [h, s, b] = NEON[idx];
  return color(h, s, b);
}

function lifeDraw() {
  if (lifeRunning) {
    accumulator += deltaTime;
    const interval = 1000 / fps;
    while (accumulator >= interval) { stepGeneration(); accumulator -= interval; }
  }

  background(232, 35, 6);

  stroke(232, 30, 16); strokeWeight(1);
  for (let x = 0; x <= cols; x++) { line(x * CELL + 0.5, 0, x * CELL + 0.5, rows * CELL); }
  for (let y = 0; y <= rows; y++) { line(0, y * CELL + 0.5, cols * CELL, y * CELL + 0.5); }

  noStroke();
  let population = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!grid[i]) continue;
      population++;
      const c = cellColor(age[i]);
      fill(hue(c), saturation(c), brightness(c), 22);
      rect(x * CELL - 3, y * CELL - 3, CELL + 6, CELL + 6, 4);
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!grid[i]) continue;
      fill(cellColor(age[i]));
      rect(x * CELL + 1, y * CELL + 1, CELL - 1, CELL - 1, 2);
    }
  }

  fill(185, 60, 100);
  statusLine(`${lifeRunning ? "RUNNING" : "PAUSED"}   gen ${gen}   alive ${population}   ${fps} gen/s   wrap ${wrapEdges ? "on" : "off"}`,
             "space play/pause · n step · c clear · r random · +/- speed · w wrap · tab switch", rows * CELL + 15);
}

function lifeBuildUI() {
  playBtn = createButton("Play"); styleControl(playBtn, NEON_HEX.cyan, true);
  playBtn.mousePressed(togglePlay);

  stepBtn = createButton("Step"); styleControl(stepBtn, NEON_HEX.cyan);
  stepBtn.mousePressed(() => { lifeRunning = false; playBtn.html("Play"); stepGeneration(); });

  clearBtn = createButton("Clear"); styleControl(clearBtn, NEON_HEX.cyan);
  clearBtn.mousePressed(clearGrid);

  randomBtn = createButton("Random"); styleControl(randomBtn, NEON_HEX.cyan);
  randomBtn.mousePressed(randomGrid);

  speedLabel = createSpan("Speed 12 gen/s"); styleLabel(speedLabel, NEON_HEX.magenta);

  speedSlider = createSlider(1, 60, fps, 1);
  speedSlider.style("width", "140px");
  speedSlider.style("accent-color", NEON_HEX.magenta);
  speedSlider.style("vertical-align", "middle");
  speedSlider.input(() => setSpeed(speedSlider.value()));

  patternSel = createSelect();
  patternSel.option("Pattern…", "");
  patternSel.option("Glider", "glider");
  patternSel.option("Lightweight spaceship", "lwss");
  patternSel.option("R-pentomino", "rpent");
  patternSel.option("Diehard", "diehard");
  patternSel.option("Acorn", "acorn");
  patternSel.option("Pulsar", "pulsar");
  patternSel.option("Pentadecathlon", "penta");
  patternSel.option("Gosper glider gun", "gun");
  styleControl(patternSel, NEON_HEX.lime);
  patternSel.changed(() => {
    const v = patternSel.value();
    if (v) { lifeRunning = false; playBtn.html("Play"); placePattern(PATTERNS[v]); }
    patternSel.selected("");
  });

  wrapBtn = createButton("Wrap: on"); styleControl(wrapBtn, NEON_HEX.yellow);
  wrapBtn.mousePressed(toggleWrap);

  lifeUI = [playBtn, stepBtn, clearBtn, randomBtn, speedLabel, speedSlider, patternSel, wrapBtn];
}

function togglePlay() { lifeRunning = !lifeRunning; accumulator = 0; playBtn.html(lifeRunning ? "Pause" : "Play"); }
function clearGrid()  { lifeRunning = false; playBtn.html("Play"); grid.fill(0); age.fill(0); gen = 0; }
function randomGrid() {
  lifeRunning = false; playBtn.html("Play"); gen = 0;
  for (let i = 0; i < grid.length; i++) { grid[i] = random() < 0.3 ? 1 : 0; age[i] = 0; }
}
function toggleWrap() { wrapEdges = !wrapEdges; wrapBtn.html(`Wrap: ${wrapEdges ? "on" : "off"}`); }
function setSpeed(v)  { fps = constrain(v, 1, 60); speedSlider.value(fps); speedLabel.html(`Speed ${fps} gen/s`); }

function placePattern(rowsOfBits) {
  grid.fill(0); age.fill(0); gen = 0;
  const oy = floor((rows - rowsOfBits.length) / 2);
  const ox = floor((cols - rowsOfBits[0].length) / 2);
  for (let y = 0; y < rowsOfBits.length; y++) {
    for (let x = 0; x < rowsOfBits[y].length; x++) {
      if (rowsOfBits[y][x] !== "1") continue;
      const yy = oy + y, xx = ox + x;
      if (yy >= 0 && yy < rows && xx >= 0 && xx < cols) grid[yy * cols + xx] = 1;
    }
  }
}

function cellUnderMouse() {
  const x = floor(mouseX / CELL), y = floor(mouseY / CELL);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return -1;
  return y * cols + x;
}
function lifeMousePressed() {
  const i = cellUnderMouse(); if (i < 0) return;
  paintValue = grid[i] ? 0 : 1; grid[i] = paintValue; age[i] = 0; lastCell = i;
}
function lifeMouseDragged() {
  const i = cellUnderMouse(); if (i < 0 || i === lastCell) return;
  grid[i] = paintValue; age[i] = 0; lastCell = i;
}
function lifeMouseReleased() { lastCell = -1; }
function lifeKeyPressed() {
  if (key === " ") { togglePlay(); return; }
  if (key === "n" || key === "ArrowRight") { lifeRunning = false; playBtn.html("Play"); stepGeneration(); }
  else if (key === "c") clearGrid();
  else if (key === "r") randomGrid();
  else if (key === "+" || key === "=") setSpeed(fps + 2);
  else if (key === "-") setSpeed(fps - 2);
  else if (key === "w") toggleWrap();
}

// ===========================================================================
//  IDEA 2 — CHAOS BRUSH
//  The deck's Random Walk as a paint tool. While you hold the mouse, a swarm
//  of walkers lives inside the brush circle. Every frame each walker takes one
//  step: with probability NOISE it is a pure random step (the deck's
//  algorithm), otherwise it heads for a drifting point near the cursor.
//  A walker that strays past the brush radius is pulled back. Nothing is ever
//  erased, so the trail IS the stroke.
//
//  Sliders →  Size     radius of the swarm (how wide the stroke scatters)
//             Width    thickness of each walker's line
//             Speed    pixels per step
//             Opacity  alpha of the ink
//             Noise    0% = calm line that follows the cursor, 100% = pure chaos
//             Walkers  how many particles share the stroke
//  Colour  →  RGB swatches + "RGB wave" (R, G, B each follow a sine)
// ===========================================================================
let paint;                       // off-screen layer holding the drawing
let brushUI = [];
let barH = TOOLBAR_H;            // brush bar height (grows to 2 rows when narrow)
let undoBtn, clearPaintBtn, saveBtn, swatches = [];
let sliders = {};                // name → { label, input }

const PALETTE = { cyan: [25, 230, 255], magenta: [255, 43, 214], lime: [184, 255, 43], yellow: [255, 225, 43], orange: [255, 106, 43], white: [255, 255, 255] };
const SWATCH_KEYS = [...Object.keys(PALETTE), "rgbwave"];

// the six parameters, with their slider ranges
const PARAMS = {
  size:    { label: "Size",    min: 6,  max: 200, unit: "px" },
  lineW:   { label: "Width",   min: 1,  max: 20,  unit: "px" },
  speed:   { label: "Speed",   min: 1,  max: 12,  unit: ""   },
  opacity: { label: "Opacity", min: 5,  max: 100, unit: "%"  },
  noise:   { label: "Noise",   min: 0,  max: 100, unit: "%"  },
  count:   { label: "Walkers", min: 1,  max: 40,  unit: ""   },
};
let brush = { size: 48, lineW: 3, speed: 4, opacity: 70, noise: 60, count: 12, colorKey: "cyan" };

let walkers = [];                // the swarm of the current stroke
let painting = false;
let undoStack = [];              // snapshots, one per stroke (max 25)
let strokeCount = 0;

function paperHeight() { return height - barH - STATUS_H; }

function brushInit() {
  paint = createGraphics(width, height);
  paint.clear();
  brushBuildUI();
}

function brushResize() {
  const old = paint;
  paint = createGraphics(width, height);
  paint.clear();
  paint.image(old, 0, 0);
  old.remove();
}

// ---- colour ----------------------------------------------------------------
function rgbOf(key, f) {
  if (key !== "rgbwave") return PALETTE[key];
  let r = 128 + 127 * sin(f * 0.020);
  let g = 128 + 127 * sin(f * 0.013 + 2.1);
  let b = 128 + 127 * sin(f * 0.009 + 4.2);
  const m = max(r, g, b);                    // keep it bright on the dark ground
  return [r * 255 / m, g * 255 / m, b * 255 / m];
}

// ---- the stroke --------------------------------------------------------------
function beginStroke() {
  pushHistory();
  painting = true;
  walkers = [];
  for (let i = 0; i < brush.count; i++) {
    const a = random(TWO_PI), r = random(brush.size / 2);
    walkers.push({ x: mouseX + cos(a) * r, y: mouseY + sin(a) * r, seed: random(1000) });
  }
  stepWalkers();                                        // a tap still leaves a mark
}

function stepWalkers() {
  const g = paint;
  const radius = brush.size / 2;
  const [r, gr, b] = rgbOf(brush.colorKey, frameCount);
  const alpha = brush.opacity * 2.55;
  const t = frameCount * 0.02;
  g.strokeCap(ROUND);

  for (const w of walkers) {
    const ox = w.x, oy = w.y;

    // where this walker would like to be: a point that drifts inside the circle
    const tx = mouseX + (noise(w.seed, t) - 0.5) * brush.size;
    const ty = mouseY + (noise(w.seed + 99, t) - 0.5) * brush.size;
    const d = dist(w.x, w.y, mouseX, mouseY);

    let angle, step = brush.speed;
    if (d > radius) {
      // leash: head back towards the cursor, still wobbling by the noise amount,
      // and hurry when the cursor has run far ahead
      angle = atan2(mouseY - w.y, mouseX - w.x) + random(-1, 1) * brush.noise / 100;
      step = max(brush.speed, (d - radius) * 0.3);
    } else if (random(100) < brush.noise) {
      angle = floor(random(4)) * HALF_PI;               // the deck's random walk: 4 directions
    } else {
      angle = atan2(ty - w.y, tx - w.x);                // calm: follow the cursor
    }
    w.x += cos(angle) * step;
    w.y += sin(angle) * step;

    // ink: a soft halo, then the line itself
    g.stroke(r, gr, b, alpha * 0.18); g.strokeWeight(brush.lineW * 3); g.line(ox, oy, w.x, w.y);
    g.stroke(r, gr, b, alpha);        g.strokeWeight(brush.lineW);     g.line(ox, oy, w.x, w.y);
  }
}

function endStroke() {
  if (!painting) return;
  painting = false; walkers = []; strokeCount++;
}

// ---- input -----------------------------------------------------------------
function brushMousePressed()  { if (mouseY <= paperHeight()) beginStroke(); }
function brushMouseDragged()  { /* the swarm reads mouseX/mouseY every frame */ }
function brushMouseReleased() { endStroke(); }

// ---- history ---------------------------------------------------------------
function pushHistory() {
  undoStack.push(paint.get());
  if (undoStack.length > 25) undoStack.shift();
  undoBtn.style("opacity", "1");
}
function undo() {
  if (!undoStack.length) return;
  const snap = undoStack.pop();
  paint.clear(); paint.image(snap, 0, 0);
  strokeCount = max(0, strokeCount - 1);
  if (!undoStack.length) undoBtn.style("opacity", "0.45");
}
function clearPaint() { pushHistory(); paint.clear(); strokeCount = 0; }
function savePaint() {
  const out = createGraphics(width, paperHeight());
  out.background(BG);
  out.image(paint, 0, 0);
  saveCanvas(out, "chaos-brush", "png");
  out.remove();
}

// ---- render ------------------------------------------------------------------
function brushDraw() {
  if (painting && mouseIsPressed) stepWalkers();        // one step per frame while held
  else if (painting) endStroke();

  background(232, 35, 6);
  image(paint, 0, 0);
  const ph = paperHeight();
  const [r, gr, b] = rgbOf(brush.colorKey, frameCount);

  // brush preview: the swarm circle, a dot showing line width, opacity in the ring
  if (mouseY >= 0 && mouseY < ph) {
    push(); colorMode(RGB, 255);
    noFill(); stroke(r, gr, b, 60 + brush.opacity * 1.4); strokeWeight(1);
    circle(mouseX, mouseY, brush.size);
    noStroke(); fill(r, gr, b, 60 + brush.opacity * 1.9);
    circle(mouseX, mouseY, brush.lineW);
    // live walkers
    for (const w of walkers) { circle(w.x, w.y, 2); }
    pop();
  }

  // paper edge
  noFill(); stroke(0, 0, 100, 8); rect(0.5, 0.5, width - 1, ph - 1);

  // status line
  push(); colorMode(RGB, 255); fill(r, gr, b);
  statusLine(`CHAOS BRUSH   size ${brush.size}   width ${brush.lineW}   speed ${brush.speed}   opacity ${brush.opacity}%   noise ${brush.noise}%   walkers ${brush.count}   strokes ${strokeCount}`,
             "[ ] size · -/= width · ↑↓ speed · ←→ noise · z undo · c clear · s save · tab switch", ph + 15);
  pop();
}

// ---- UI ----------------------------------------------------------------------
function addSlider(name) {
  const p = PARAMS[name];
  const label = createSpan(""); styleLabel(label, NEON_HEX.magenta);
  label.style("white-space", "nowrap");
  const input = createSlider(p.min, p.max, brush[name], 1);
  input.style("width", "80px");
  input.style("accent-color", NEON_HEX.magenta);
  input.style("vertical-align", "middle");
  input.input(() => setParam(name, input.value()));
  sliders[name] = { label, input };
  setParam(name, brush[name]);
  return [label, input];
}

function setParam(name, v) {
  const p = PARAMS[name];
  brush[name] = constrain(v, p.min, p.max);
  sliders[name].input.value(brush[name]);
  sliders[name].label.html(`${p.label} ${brush[name]}${p.unit}`);
}

function brushBuildUI() {
  undoBtn = createButton("Undo"); styleControl(undoBtn, NEON_HEX.cyan); undoBtn.style("opacity", "0.45");
  undoBtn.mousePressed(undo);
  clearPaintBtn = createButton("Clear"); styleControl(clearPaintBtn, NEON_HEX.cyan);
  clearPaintBtn.mousePressed(clearPaint);
  saveBtn = createButton("Save PNG"); styleControl(saveBtn, NEON_HEX.orange, true);
  saveBtn.mousePressed(savePaint);

  for (const swKey of SWATCH_KEYS) {
    const sw = createButton("");
    sw.attribute("title", swKey === "rgbwave" ? "RGB wave: R, G and B each follow a sine" : swKey);
    sw.style("width", "26px"); sw.style("height", "26px");
    sw.style("margin-top", "4px");
    sw.style("border-radius", "50%");
    sw.style("cursor", "pointer");
    sw.style("padding", "0");
    if (swKey === "rgbwave") sw.style("background", "linear-gradient(135deg,#ff3b3b 0%,#3bff3b 50%,#3b6bff 100%)");
    else sw.style("background", `rgb(${PALETTE[swKey].join(",")})`);
    sw.mousePressed(() => setColor(swKey));
    sw.swatchKey = swKey;
    swatches.push(sw);
  }

  const sliderEls = [];
  for (const name of Object.keys(PARAMS)) { sliderEls.push(...addSlider(name)); }

  brushUI = [undoBtn, clearPaintBtn, saveBtn, ...swatches, ...sliderEls];
  refreshSwatches();
}

function setColor(k) { brush.colorKey = k; refreshSwatches(); }
function refreshSwatches() {
  for (const sw of swatches) {
    const on = sw.swatchKey === brush.colorKey;
    sw.style("border", on ? "2px solid #ffffff" : "2px solid #141629");
    sw.style("box-shadow", on ? "0 0 10px #ffffffaa" : "none");
    sw.style("transform", on ? "scale(1.15)" : "scale(1)");
  }
}

function brushKeyPressed() {
  if (key === "[") setParam("size", brush.size - 4);
  else if (key === "]") setParam("size", brush.size + 4);
  else if (key === "-") setParam("lineW", brush.lineW - 1);
  else if (key === "=" || key === "+") setParam("lineW", brush.lineW + 1);
  else if (key === "ArrowUp") setParam("speed", brush.speed + 1);
  else if (key === "ArrowDown") setParam("speed", brush.speed - 1);
  else if (key === "ArrowRight") setParam("noise", brush.noise + 5);
  else if (key === "ArrowLeft") setParam("noise", brush.noise - 5);
  else if (key === "z") undo();
  else if (key === "c") clearPaint();
  else if (key === "s") savePaint();
}
