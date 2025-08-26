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

function drawBand(a, b, px, color) {
  ctx.save();
  ctx.lineWidth = Math.max(1, (w2sx(px) - w2sx(0)));
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(w2sx(a.x), w2sy(a.y));
  ctx.lineTo(w2sx(b.x), w2sy(b.y));
  ctx.stroke();
  ctx.restore();
}
function drawPost(p, w, h) {
  const x = w2sx(p.x - w / 2);
  const yTop = w2sy(p.y);
  const width = w2sx(w) - w2sx(0);
  const height = w2sy(0) - w2sy(h);
  ctx.save();
  const g = ctx.createLinearGradient(0, yTop, 0, yTop + height);
  g.addColorStop(0, "#a78bfa");
  g.addColorStop(1, "#7c3aed");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(15,23,42,.12)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, x, yTop, width, height, Math.min(12, width * 0.4));
  ctx.fill();
  ctx.restore();
}
function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

// Physics and game logic
function updatePhysics(dt) {
  // spawn if none
  if (!projectile || projectile.state === 'despawn') spawnProjectile();

  // while ready and dragging, follow drag point (clamped by maxPull)
  if (projectile.state === 'ready') {
    // clamp drag to sling maxPull
    const pull = vec({ x: SLING.x, y: SLING.y }, dragPoint);
    const dist = len(pull);
    if (dist > SLING.maxPull) {
      const n = normalize(pull);
      projectile.x = SLING.x + n.x * SLING.maxPull;
      projectile.y = SLING.y + n.y * SLING.maxPull;
    } else {
      projectile.x = dragPoint.x;
      projectile.y = dragPoint.y;
    }
  }

  // flying physics
  if (projectile.state === 'flying') {
    projectile.vy -= GRAVITY * dt;
    projectile.vx *= projConfig.friction;
    projectile.vy *= projConfig.friction;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;

    // ground
    if (projectile.y - projectile.r <= GROUND_H) {
      projectile.y = GROUND_H + projectile.r;
      projectile.vy = -projectile.vy * 0.42; // bounce
      projectile.vx *= 0.72;
      if (Math.hypot(projectile.vx, projectile.vy) < projConfig.restSpeed) projectile.state = 'rest';
    }

    // walls
    if (projectile.x - projectile.r < 0) { projectile.x = projectile.r; projectile.vx = -projectile.vx * 0.45; }
    if (projectile.x + projectile.r > WORLD.W) { projectile.x = WORLD.W - projectile.r; projectile.vx = -projectile.vx * 0.45; }

    // collision with blocks
    for (const b of targets) {
      if (!b.alive) continue;
      if (circleRectCollide(projectile, b)) {
        // kick the block into falling
        b.falling = true;
        b.vx += projectile.vx * 0.22;
        b.vy += Math.max(6, projectile.vy * 0.14 + 7);
        b.spin += (Math.random() * 2 - 1) * 2;
        projectile.vx *= 0.7;
        projectile.vy *= 0.7;
      }
    }

    // despawn if very low
    if (projectile.y < -18) projectile.state = 'despawn';
  } else if (projectile.state === 'rest') {
    projectile.restTimer += dt;
    if (projectile.restTimer > 1.0) projectile.state = 'despawn';
  }

  // update blocks
  for (const b of targets) {
    if (!b.alive) continue;
    if (b.falling) {
      b.vy -= GRAVITY * dt;
      b.vx *= 0.996;
      b.vy *= 0.996;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;

      // ground
      if (b.y <= GROUND_H) {
        b.y = GROUND_H;
        b.vy = -b.vy * 0.25;
        b.vx *= 0.8;
        b.spin *= 0.7;
        if (Math.hypot(b.vx, b.vy) < 1.6) b.alive = false;
      }
    }
  }
}

// simple circle-rect collision
function circleRectCollide(c, r) {
  const cx = c.x, cy = c.y;
  const rx1 = r.x, ry1 = r.y;
  const rx2 = r.x + r.w, ry2 = r.y + r.h;
  const nearestX = clamp(cx, rx1, rx2);
  const nearestY = clamp(cy, ry1, ry2);
  const dx = cx - nearestX, dy = cy - nearestY;
  return (dx * dx + dy * dy) <= (c.r * c.r);
}

// input handlers
function setupInput() {
  canvas.addEventListener('pointerdown', (e) => {
    const p = s2w(e.clientX, e.clientY);
    // start dragging if near sling or projectile ready
    const d = Math.hypot(p.x - SLING.x, p.y - SLING.y);
    if (!projectile) return;
    if (d < SLING.maxPull + 6 && projectile.state === 'ready') {
      dragging = true;
      dragPoint = p;
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragPoint = s2w(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    // on release, launch projectile opposite to pull
    if (projectile && projectile.state === 'ready') {
      const pull = vec({ x: SLING.x, y: SLING.y }, { x: projectile.x, y: projectile.y }); // pull vector
      const nx = pull.x, ny = pull.y;
      projectile.vx = nx * SLING.power;
      projectile.vy = ny * SLING.power;
      // flip because pull is from sling to bird; we want bird away from sling
      projectile.vx = projectile.vx;
      projectile.vy = projectile.vy;
      // mark flying
      projectile.state = 'flying';
      projectile.restTimer = 0;
    }
  });

  // prevent context menu on long touch
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

//render + main loop
function render() {
  clearScreen();
  drawGround();
  for (const b of targets) if (b.alive) drawBlock(b);
  drawSling(projectile || { x: SLING.x, y: SLING.y });
  if (projectile) drawBall(projectile);
}

// main loop
function loop(now) {
  const dt = Math.min(0.034, (now - lastTime) / 1000);
  lastTime = now;
  updatePhysics(dt);
  render();
  requestAnimationFrame(loop);
}

function resizeCanvas() {
  const wrap = document.querySelector('.canvas-wrap');
  const rect = wrap.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * DEVICE_PIXEL_RATIO));
  canvas.height = Math.max(1, Math.floor(rect.height * DEVICE_PIXEL_RATIO));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(DEVICE_PIXEL_RATIO, DEVICE_PIXEL_RATIO);
  scale = rect.width / WORLD.W;
}

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', resizeCanvas, { passive: true });
  new ResizeObserver(resizeCanvas).observe(canvas);

  // initial world
  targets = makeTargets();
  spawnProjectile();
  setupInput();
  resizeCanvas();
  requestAnimationFrame(loop);
}

init();