let settings = {
  size: 45,            // גודל בסיסי של קוץ
  sizeJitter: 0.3,     // שונות בגודל
  grow: 0.6,           // כמה הקוצים גדלים ככל שמתרחקים מנקודת ההתחלה
  spacing: 0.45,       // מרווח בין קוצים (ביחס לגודל)
  scatter: 0.2,        // פיזור הצידה מהקו
  rotationJitter: 25,  // סטייה אקראית בזווית (מעלות)
  wobble: 0.04,        // רעד של יד
  strokeW: 0.07,       // עובי קו ביחס לגודל
  notchChance: 0.5,    // סיכוי לקוץ עם חריץ בבסיס
  inkColor: "#1a1a1a",
  fillColor: "#ffffff",
  bgColor: "#ffffff"
};

let lastX, lastY, startX, startY;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(settings.bgColor);
}

function mousePressed() {
  startX = lastX = mouseX;
  startY = lastY = mouseY;
}

function draw() {
  if (!mouseIsPressed || lastX === undefined) return;

  let s = settings;
  let d = dist(lastX, lastY, mouseX, mouseY);
  let angle = atan2(mouseY - lastY, mouseX - lastX);
  let fromStart = dist(startX, startY, mouseX, mouseY);
  let baseSize = s.size * (0.5 + s.grow * fromStart / 200);
  let step = max(2, baseSize * s.spacing);

  if (d < step) return; // מחכים שהעכבר יזוז מספיק

  for (let t = step; t <= d; t += step) {
    let x = lerp(lastX, mouseX, t / d);
    let y = lerp(lastY, mouseY, t / d);
    let side = random(-s.scatter, s.scatter) * baseSize;
    x += cos(angle + HALF_PI) * side;
    y += sin(angle + HALF_PI) * side;
    let sz = baseSize * (1 + random(-s.sizeJitter, s.sizeJitter));
    spike(x, y, angle, sz);
  }

  lastX = mouseX;
  lastY = mouseY;
}

function spike(x, y, angle, sz) {
  let s = settings;
  push();
  translate(x, y);
  rotate(angle + radians(random(-s.rotationJitter, s.rotationJitter)));
  stroke(s.inkColor);
  strokeWeight(max(1.5, sz * s.strokeW));
  strokeJoin(ROUND);
  fill(s.fillColor);

  let w = sz * random(0.7, 1.1);   // רוחב הבסיס
  let h = sz * random(0.9, 1.4);   // אורך הקוץ
  let tip = createVector(h * 0.6, random(-0.2, 0.2) * w);
  let bl = createVector(-h * 0.4, -w / 2);
  let br = createVector(-h * 0.4, w / 2);

  let pts = [tip, inward(tip, bl), bl];
  if (random() < s.notchChance) {
    pts.push(createVector(-h * 0.4 + h * random(0.15, 0.35), random(-0.15, 0.15) * w));
  }
  pts.push(br, inward(br, tip));

  beginShape();
  for (let p of pts) {
    let wob = s.wobble * sz;
    vertex(p.x + random(-wob, wob), p.y + random(-wob, wob));
  }
  endShape(CLOSE);
  pop();
}

// נקודת אמצע של צלע, מוזזת קצת פנימה – נותן צלעות קעורות כמו בציור
function inward(a, b) {
  let m = p5.Vector.lerp(a, b, 0.5);
  return p5.Vector.lerp(m, createVector(0, 0), 0.12);
}

function keyPressed() {
  if (key === 'c') background(settings.bgColor); // ניקוי
  if (key === 's') saveCanvas('spikes', 'png');  // שמירה
}
