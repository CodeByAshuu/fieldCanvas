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