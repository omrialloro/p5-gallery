// רשת נוירונים שנבנית באקראיות ומתחברת בסינפסות כימיות וחשמליות
// לכל נוירון יש גוף תא, דנדריטים מסתעפים ואקסון שגדל לעבר נוירון אחר
// לחיצה ליד נוירון גורמת לו לירות, וגרירה של העכבר מציירת נוירונים חדשים

let neurons = [];
let axons = [];
let pulses = [];
let particles = [];
let ui = {};

// מראה של מיקרוסקופ פלואורסצנטי
const COLORS = {
  bg: [4, 6, 10],
  cell: [110, 235, 160],
  chem: [255, 100, 200],
  elec: [100, 190, 255],
  label: [200, 220, 210],
};

const MAX_AXONS_PER_NEURON = 2;

function setup() {
  createCanvas(windowWidth, windowHeight);
  makePanel();
  resetNetwork();
}

function draw() {
  background(COLORS.bg);

  manageNeuronCount();
  startAxons();
  growAxons();
  updateNeurons();
  updatePulses();
  updateParticles();

  for (const n of neurons) drawDendrites(n);
  for (const a of axons) drawAxon(a);
  for (const n of neurons) drawSoma(n);

  blendMode(ADD);
  drawPulses();
  drawParticles();
  blendMode(BLEND);

  if (ui.labels.checked()) drawLabels();
  updatePanelText();
}

// ---------- בניית הרשת ----------

function resetNetwork() {
  neurons = [];
  axons = [];
  pulses = [];
  particles = [];
  noiseSeed(floor(random(100000)));
}

function manageNeuronCount() {
  // הסליידר שולט רק בנוירונים האקראיים, לא באלה שצוירו במברשת
  const auto = neurons.filter((n) => !n.painted);
  const target = ui.count.value();
  if (auto.length < target && frameCount % 20 === 0) spawnNeuron();
  if (auto.length > target) removeNeuron(auto[auto.length - 1]);
}

function spawnNeuron(px, py) {
  const painted = px !== undefined;
  const margin = 90;
  let x = px;
  let y = py;
  let tries = 0;
  while (!painted) {
    x = random(margin, width - margin);
    y = random(margin, height - margin);
    tries++;
    if (tries >= 80 || !neurons.some((n) => dist(x, y, n.x, n.y) < 150)) break;
  }

  const n = {
    x,
    y,
    r: random(9, 13),
    born: frameCount,
    v: random(0.5),            // מתח הממברנה, יורה כשמגיע ל-1
    refractory: 0,
    glow: 0,
    freq: random(0.01, 0.04),  // תדר האוסילטור הפנימי
    phase: random(TWO_PI),
    shape: [],
    dendrites: [],
    axonCount: 0,
    painted,
  };

  // צורת גוף התא: עיגול לא מושלם
  for (let i = 0; i < 12; i++) n.shape.push(random(0.85, 1.15));

  const chaos = ui.chaos.value();
  const count = floor(random(4, 7));
  for (let i = 0; i < count; i++) {
    const a = (TWO_PI * i) / count + random(-0.3, 0.3);
    const sx = n.x + cos(a) * n.r * 0.9;
    const sy = n.y + sin(a) * n.r * 0.9;
    growDendrite(n.dendrites, sx, sy, a, random(35, 60), 3, 0, chaos);
  }
  neurons.push(n);
}

// דנדריט: ענף שמתפצל לשניים, כל פעם קצר ודק יותר
function growDendrite(out, x, y, angle, len, w, depth, chaos) {
  const pts = [{ x, y, w }];
  const steps = floor(len / 3);
  let a = angle;
  for (let i = 1; i <= steps; i++) {
    a += random(-0.35, 0.35) * chaos;
    x += cos(a) * 3;
    y += sin(a) * 3;
    pts.push({ x, y, w: lerp(w, w * 0.45, i / steps) });
  }
  out.push({ pts, depth });

  if (depth < 2 && random() < 0.4 + ui.branch.value() * 0.6) {
    const spread = random(0.35, 0.7);
    growDendrite(out, x, y, a - spread, len * 0.65, w * 0.5, depth + 1, chaos);
    growDendrite(out, x, y, a + spread, len * 0.65, w * 0.5, depth + 1, chaos);
  }
}

function removeNeuron(n) {
  neurons = neurons.filter((m) => m !== n);
  axons = axons.filter((a) => a.from !== n && a.to !== n);
  pulses = pulses.filter((p) => axons.includes(p.axon));
  particles = particles.filter((p) => p.target !== n);
}

// ---------- אקסונים: גדלים לעבר נוירון אחר ----------

function startAxons() {
  for (const n of neurons) {
    const age = frameCount - n.born;
    if (age < 50 || n.axonCount >= MAX_AXONS_PER_NEURON) continue;
    if (random() > 0.02) continue;

    // בוחרים באקראיות אחד משלושת הנוירונים הקרובים שעוד לא מחוברים
    const options = neurons
      .filter((m) => m !== n && !isConnected(n, m))
      .sort((a, b) => dist(n.x, n.y, a.x, a.y) - dist(n.x, n.y, b.x, b.y))
      .slice(0, 3);
    if (options.length === 0) continue;
    const to = random(options);

    const angle = atan2(to.y - n.y, to.x - n.x);
    const start = { x: n.x + cos(angle) * n.r, y: n.y + sin(angle) * n.r };
    axons.push({
      from: n,
      to,
      type: random() < ui.ratio.value() ? "chem" : "elec",
      points: [start],
      angle: angle + random(-0.8, 0.8),
      seed: random(1000),
      done: false,
      flash: 0,
    });
    n.axonCount++;
  }
}

function growAxons() {
  const chaos = ui.chaos.value();
  for (const a of axons) {
    if (a.done) continue;
    const p = a.points[a.points.length - 1];

    // היגוי לעבר היעד, עם סטייה כאוטית לפי רעש פרלין
    const desired = atan2(a.to.y - p.y, a.to.x - p.x);
    const wander = (noise(a.seed, a.points.length * 0.03) - 0.5) * 0.5 * chaos;
    a.angle += angleDiff(desired, a.angle) * 0.07 + wander;

    const np = { x: p.x + cos(a.angle) * 2.5, y: p.y + sin(a.angle) * 2.5 };
    a.points.push(np);

    // בסינפסה כימית נשאר רווח קטן (המרווח הסינפטי), בחשמלית יש מגע ישיר
    const gap = a.type === "chem" ? 9 : 3;
    if (dist(np.x, np.y, a.to.x, a.to.y) < a.to.r + gap) {
      a.done = true;
      a.flash = 1;
    }
    if (a.points.length > 600) a.done = true;
  }
}

function isConnected(a, b) {
  return axons.some((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a));
}

// ---------- פעילות חשמלית ----------

function updateNeurons() {
  const drive = ui.rate.value();
  for (const n of neurons) {
    n.glow *= 0.92;
    if (n.refractory > 0) {
      n.refractory--;
      continue;
    }
    // אוסילטור מחזורי + רעש אקראי
    const osc = (sin(frameCount * n.freq + n.phase) + 1) * 0.5;
    n.v += drive * 0.003 * osc + random(drive * 0.0015);
    if (n.v >= 1) fire(n);
  }
}

function fire(n) {
  n.v = 0;
  n.refractory = 40;
  n.glow = 1;
  for (const a of axons) {
    if (!a.done) continue;
    if (a.from === n) pulses.push({ axon: a, t: 0, dir: 1 });
    // סינפסה חשמלית מעבירה אות גם בכיוון ההפוך
    else if (a.type === "elec" && a.to === n) pulses.push({ axon: a, t: 1, dir: -1 });
  }
}

function updatePulses() {
  const speed = ui.speed.value();
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    const a = p.axon;
    const len = a.points.length;
    p.t += (p.dir * speed) / len;
    if (p.t < 1 && p.t > 0) continue;

    a.flash = 1;
    if (a.type === "elec") {
      // חשמלי: האות עובר מיד
      const target = p.dir === 1 ? a.to : a.from;
      target.v += 0.4;
    } else {
      // כימי: משתחררות מולקולות שחוצות את הרווח אל התא הבא
      const end = a.points[len - 1];
      for (let k = 0; k < 8; k++) {
        particles.push({
          x: end.x + random(-2, 2),
          y: end.y + random(-2, 2),
          target: a.to,
          speed: random(0.015, 0.03),
          t: 0,
        });
      }
    }
    pulses.splice(i, 1);
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += p.speed;
    p.x = lerp(p.x, p.target.x, p.speed * 1.5);
    p.y = lerp(p.y, p.target.y, p.speed * 1.5);
    if (p.t >= 1 || dist(p.x, p.y, p.target.x, p.target.y) < p.target.r) {
      p.target.v += 0.07;
      particles.splice(i, 1);
    }
  }
}

// ---------- ציור ----------

function drawDendrites(n) {
  // הדנדריטים גדלים בהדרגה כשהנוירון נולד
  const reveal = min(1, (frameCount - n.born) / 60);
  // צבע אטום (בלי שקיפות) כדי שהקו ייראה רציף ולא מנוקד
  const k = (120 + n.v * 60 + n.glow * 75) / 255;
  const col = COLORS.cell.map((c, i) => lerp(COLORS.bg[i], c, k));
  strokeCap(ROUND);
  stroke(col);
  for (const d of n.dendrites) {
    const startAt = d.depth / 3;
    const local = constrain((reveal - startAt) * 3, 0, 1);
    const count = floor(d.pts.length * local);
    for (let i = 1; i < count; i++) {
      const p = d.pts[i];
      const q = d.pts[i - 1];
      strokeWeight(p.w);
      line(q.x, q.y, p.x, p.y);
    }
  }
}

function drawSoma(n) {
  const grow = min(1, (frameCount - n.born) / 30);
  const r = n.r * grow;
  noStroke();

  if (n.glow > 0.02) {
    fill(...COLORS.cell, 60 * n.glow);
    circle(n.x, n.y, r * 2 + 35 * n.glow);
  }
  fill(...COLORS.cell, 160 + n.v * 60 + n.glow * 35);
  beginShape();
  for (let i = 0; i < n.shape.length; i++) {
    const a = (TWO_PI * i) / n.shape.length;
    vertex(n.x + cos(a) * r * n.shape[i], n.y + sin(a) * r * n.shape[i]);
  }
  endShape(CLOSE);

  // גרעין התא
  fill(...COLORS.bg, 170);
  circle(n.x, n.y, r * 0.8);
}

function drawAxon(a) {
  const c = a.type === "chem" ? COLORS.chem : COLORS.elec;
  a.flash *= 0.95;
  noFill();
  strokeWeight(1.3 + a.flash * 1.5);
  stroke(...c, 150 + a.flash * 100);
  beginShape();
  for (const p of a.points) vertex(p.x, p.y);
  endShape();

  const end = a.points[a.points.length - 1];
  if (!a.done) {
    // קצה הצמיחה של האקסון
    noStroke();
    fill(255, 220);
    circle(end.x, end.y, 4);
    return;
  }

  noStroke();
  fill(...c, 230);
  if (a.type === "chem") {
    // כפתור סינפטי בקצה האקסון
    circle(end.x, end.y, 8);
  } else {
    // צומת חשמלי: שני פסים צמודים
    const ang = atan2(a.to.y - end.y, a.to.x - end.x);
    push();
    translate(end.x, end.y);
    rotate(ang);
    rectMode(CENTER);
    rect(0, 0, 2, 9);
    rect(3.5, 0, 2, 9);
    pop();
  }
}

function drawPulses() {
  noStroke();
  for (const p of pulses) {
    const pts = p.axon.points;
    const pt = pts[constrain(floor(p.t * (pts.length - 1)), 0, pts.length - 1)];
    const c = p.axon.type === "chem" ? COLORS.chem : COLORS.elec;
    fill(...c, 60);
    circle(pt.x, pt.y, 14);
    fill(255, 230);
    circle(pt.x, pt.y, 4);
  }
}

function drawParticles() {
  noStroke();
  fill(...COLORS.chem, 220);
  for (const p of particles) circle(p.x, p.y, 2.2);
}

// תוויות על נוירון אחד שיש לו אקסון מחובר, רחוק מהפאנל
function drawLabels() {
  const free = width - 300;
  const a =
    axons.find((x) => x.done && x.from.x < free && x.points[x.points.length - 1].x < free) ||
    axons.find((x) => x.done);
  if (!a) return;
  const n = a.from;
  const d = n.dendrites.find((x) => x.depth === 0);
  const mid = a.points[floor(a.points.length / 2)];
  const end = a.points[a.points.length - 1];

  label(n.x, n.y, -45, -45, "גוף התא");
  if (d) {
    const tip = d.pts[d.pts.length - 1];
    label(tip.x, tip.y, -40, 30, "דנדריט");
  }
  label(mid.x, mid.y, 30, -30, "אקסון");
  label(end.x, end.y, 35, 35, a.type === "chem" ? "סינפסה כימית" : "סינפסה חשמלית");
}

function label(x, y, dx, dy, txt) {
  textSize(13);
  // אם התווית יוצאת מהמסך, הופכים את הצד שלה
  const w = textWidth(txt) + 6;
  if (dx < 0 && x + dx - w < 0) dx = -dx;
  if (dx > 0 && x + dx + w > width) dx = -dx;
  stroke(...COLORS.label, 140);
  strokeWeight(0.8);
  line(x, y, x + dx, y + dy);
  noStroke();
  fill(...COLORS.label);
  textSize(13);
  textAlign(dx < 0 ? RIGHT : LEFT, CENTER);
  text(txt, x + dx + (dx < 0 ? -4 : 4), y + dy);
}

// ---------- ממשק ----------

function makePanel() {
  ui.panel = createDiv();
  const css = {
    position: "fixed",
    top: "12px",
    right: "12px",
    direction: "rtl",
    padding: "12px 16px",
    background: "rgba(8, 12, 18, 0.75)",
    border: "1px solid rgba(110, 235, 160, 0.15)",
    "accent-color": "rgb(110, 235, 160)",
    color: "#cfe9dc",
    "font-family": "system-ui, sans-serif",
    "font-size": "13px",
    "border-radius": "10px",
    width: "200px",
  };
  for (const k in css) ui.panel.style(k, css[k]);

  const title = createDiv("רשת נוירונים").parent(ui.panel);
  title.style("font-size", "16px");
  title.style("font-weight", "700");
  title.style("margin-bottom", "6px");

  ui.sliderLabels = [];
  ui.count = addSlider("נוירונים", 2, 30, 12, 1);
  ui.chaos = addSlider("כאוס", 0, 1, 0.3, 0.01);
  ui.branch = addSlider("הסתעפות דנדריטים", 0, 1, 0.5, 0.01);
  ui.ratio = addSlider("חלק הסינפסות הכימיות", 0, 1, 0.5, 0.01);
  ui.rate = addSlider("קצב ירי", 0, 3, 1, 0.01);
  ui.speed = addSlider("מהירות אות", 0.5, 8, 3, 0.1);
  ui.brush = addSlider("מרווח מברשת", 30, 150, 70, 1);

  const hint = createDiv("גררו את העכבר כדי לצייר נוירונים, לחצו ליד נוירון כדי שירה").parent(ui.panel);
  hint.style("margin-top", "6px");
  hint.style("opacity", "0.7");
  hint.style("font-size", "12px");

  ui.labels = createCheckbox(" הצג תוויות", true).parent(ui.panel);
  ui.labels.style("margin-top", "6px");

  const btn = createButton("רשת חדשה").parent(ui.panel);
  btn.style("margin-top", "8px");
  btn.style("width", "100%");
  btn.mousePressed(resetNetwork);

  const legend = createDiv(
    '<span style="color:rgb(255,100,200)">━ כימי</span> &nbsp; ' +
      '<span style="color:rgb(100,190,255)">━ חשמלי</span>'
  ).parent(ui.panel);
  legend.style("margin-top", "8px");

  ui.stats = createDiv("").parent(ui.panel);
  ui.stats.style("margin-top", "4px");
  ui.stats.style("opacity", "0.7");
}

function addSlider(name, min, max, value, step) {
  const row = createDiv().parent(ui.panel);
  row.style("margin", "6px 0");
  const text = createDiv(name).parent(row);
  const slider = createSlider(min, max, value, step).parent(row);
  slider.style("width", "100%");
  ui.sliderLabels.push({ text, slider, name });
  return slider;
}

function updatePanelText() {
  if (frameCount % 10 !== 0) return;
  for (const l of ui.sliderLabels) {
    const v = l.slider.value();
    l.text.html(l.name + ": " + (Number.isInteger(v) ? v : nf(v, 1, 2)));
  }
  const done = axons.filter((a) => a.done);
  const chem = done.filter((a) => a.type === "chem").length;
  ui.stats.html("סינפסות: " + chem + " כימיות, " + (done.length - chem) + " חשמליות");
}

function overPanel() {
  const box = ui.panel.elt.getBoundingClientRect();
  return mouseX >= box.left && mouseX <= box.right && mouseY >= box.top && mouseY <= box.bottom;
}

// מברשת: גרירת העכבר מציירת נוירונים חדשים לאורך הקו
function mouseDragged() {
  if (overPanel()) return;
  const spacing = ui.brush.value();
  const tooClose = neurons.some((n) => dist(mouseX, mouseY, n.x, n.y) < spacing);
  if (!tooClose && neurons.length < 80) {
    // קפיצה אקראית קטנה, כדי שהקו לא יהיה ישר מדי
    spawnNeuron(mouseX + random(-15, 15), mouseY + random(-15, 15));
  }
}

function mousePressed() {
  // לא לעורר נוירון כשלוחצים על הפאנל
  if (overPanel()) return;
  let best = null;
  let bestD = 80;
  for (const n of neurons) {
    const d = dist(mouseX, mouseY, n.x, n.y);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  if (best) fire(best);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function angleDiff(a, b) {
  return ((((a - b + PI) % TWO_PI) + TWO_PI) % TWO_PI) - PI;
}
