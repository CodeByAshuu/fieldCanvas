// game.js
// SlIng Shot

const WORLD = { W: 140, H: 78 }; // world units (aspect ~16:9). larger so stage feels roomy
const GRAVITY = 90;             // world units / s^2 (tweak for arc)
const GROUND_H = 6;             // ground thickness in world units
const DEVICE_PIXEL_RATIO = Math.max(1, window.devicePixelRatio || 1);