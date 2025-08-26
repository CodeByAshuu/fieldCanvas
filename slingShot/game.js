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