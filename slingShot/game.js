// game.js
// SlIng Shot

const WORLD = { W: 140, H: 78 }; // world units (aspect ~16:9). larger so stage feels roomy
const GRAVITY = 90;             // world units / s^2 (tweak for arc)
const GROUND_H = 6;             // ground thickness in world units
const DEVICE_PIXEL_RATIO = Math.max(1, window.devicePixelRatio || 1);

// Sling tuning
let SLING = {
  x: 18,        // anchor x in world coords (left side)
  y: 20,        // anchor y in world coords
  maxPull: 20,  // max stretch distance (world units)
  power: 9.0    // launch multiplier (higher = stronger sling)
};

// Projectile settings
const projConfig = { r: 1.6, friction: 0.996, restSpeed: 1.2 };

let canvas, ctx, scale;
let lastTime = performance.now();
let projectile = null;
let targets = [];
let dragging = false;
let dragPoint = { x: SLING.x, y: SLING.y };

// Initialize
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function w2sx(x) { return x * scale; }                 // world -> screen x
function w2sy(y) { return (WORLD.H - y) * scale; }     // world -> screen y (y=0 at bottom)
function s2w(clientX, clientY) {                      // screen -> world coords
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width * WORLD.W;
  const y = WORLD.H - (clientY - rect.top) / rect.height * WORLD.H;
  return { x, y };
}

function vec(a, b) { return { x: b.x - a.x, y: b.y - a.y }; }
function len(v) { return Math.hypot(v.x, v.y); }
function normalize(v) { const L = len(v) || 1; return { x: v.x / L, y: v.y / L }; }

//creating/resetting the object
function spawnProjectile() {
  // place it near sling anchor; state: 'ready' for dragging
  projectile = {
    x: SLING.x,
    y: SLING.y,
    vx: 0,
    vy: 0,
    r: projConfig.r,
    state: 'ready',
    restTimer: 0
  };
}

function makeTargets() {
  // simple right-side stack + singles
  const baseX = 95;
  const blocks = [];
  const block = (x, y, w, h) => ({ x, y, w, h, vx: 0, vy: 0, angle: 0, spin: 0, alive: true, falling: false });

  blocks.push(block(baseX, GROUND_H + 6, 4, 8));
  blocks.push(block(baseX + 6, GROUND_H + 6, 4, 8));
  blocks.push(block(baseX + 3, GROUND_H + 14, 4, 8));
  blocks.push(block(baseX + 16, GROUND_H + 5, 4, 6));
  blocks.push(block(baseX + 24, GROUND_H + 5, 4, 6));
  blocks.push(block(baseX + 12, GROUND_H + 16, 10, 3));
  return blocks;
}

function clearScreen() {
  ctx.clearRect(0, 0, canvas.width / DEVICE_PIXEL_RATIO, canvas.height / DEVICE_PIXEL_RATIO);
}

function drawGround() {
  const y = w2sy(GROUND_H);
  ctx.save();
  const grd = ctx.createLinearGradient(0, y, 0, canvas.height / DEVICE_PIXEL_RATIO);
  grd.addColorStop(0, "#dfeee0");
  grd.addColorStop(1, "#cfe9d4");
  ctx.fillStyle = grd;
  ctx.fillRect(0, y, canvas.width / DEVICE_PIXEL_RATIO, canvas.height / DEVICE_PIXEL_RATIO - y);

  ctx.beginPath();
  ctx.moveTo(0, y + 0.5);
  ctx.lineTo(canvas.width / DEVICE_PIXEL_RATIO, y + 0.5);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(15,23,42,.06)";
  ctx.stroke();
  ctx.restore();
}

function drawBlock(b) {
  const x = w2sx(b.x), yb = w2sy(b.y);
  const wpx = w2sx(b.w) - w2sx(0);
  const hpx = w2sy(0) - w2sy(b.h);
  ctx.save();
  const cx = x + wpx / 2;
  const cy = yb - hpx / 2;
  ctx.translate(cx, cy);
  ctx.rotate(-b.angle * Math.PI / 180);
  // box
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(15,23,42,.10)";
  ctx.lineWidth = 1;
  ctx.shadowColor = "rgba(15,23,42,.10)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, -wpx / 2, -hpx / 2, wpx, hpx, 6);
  ctx.fill();
  ctx.stroke();
  // accent stripe
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(59,130,246,.14)";
  ctx.fillRect(-wpx / 2, -hpx / 2, wpx, 6);
  ctx.restore();
}

function drawBall(p) {
  const x = w2sx(p.x), y = w2sy(p.y);
  const r = (w2sx(p.r) - w2sx(0));
  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,.14)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, "#3b82f6");
  g.addColorStop(1, "#1e40af");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,.8)";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.4, y - r * 0.4, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.38)";
  ctx.fill();
  ctx.restore();
}

function drawSling(bird) {
  // two posts and two bands; bird = current projectile or drag point
  const baseX = SLING.x - 2.6;
  const postH = 10, postW = 1.4;
  const left = { x: baseX, y: SLING.y + postH };
  const right = { x: baseX + 5, y: SLING.y + postH };
  const anchorL = { x: left.x + 0.7, y: left.y - 1.8 };
  const anchorR = { x: right.x - 0.7, y: right.y - 1.8 };
  const bandTarget = (projectile && projectile.state === 'ready') ? { x: projectile.x, y: projectile.y } : { x: SLING.x, y: SLING.y + 1 };
  drawBand(anchorL, bandTarget, 5, "rgba(30,58,138,.36)");
  drawBand(anchorR, bandTarget, 5, "rgba(30,58,138,.56)");
  drawPost(left, postW, postH);
  drawPost(right, postW, postH);
}