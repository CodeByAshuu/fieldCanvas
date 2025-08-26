//game.js
// Sling Shot - simple 2D slingshot game demo

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// --- World settings ---
const WORLD = { W: 100, H: 56 };            // 16:9 aspect
const G = 70;                               // gravity (world units / s^2)
const GROUND_Y = 2;                          // ground thickness
const SLING_POS = { x: 18, y: 18 };          // base of sling (world coords)
const BAND_REST = 1.8;                       // visual slack
const PROJECTILE_RADIUS = 1.6;
const MAX_PULL = 17;                         // max pull distance
const FRICTION = 1.000;                      // air drag
const REST_THRESHOLD = 1.2;                  // speed threshold to consider "stopped"
const RESPAWN_Y_LIMIT = -10;                 // if falls below this (world y), respawn

// Targets: simple blocks on the right
let targets = [];
// Projectiles pool (only one active at a time, but pooling is helpful)
let projectile = null;

// View transform helpers (world <-> screen)
let scale = 1, dpr = Math.max(1, window.devicePixelRatio || 1);
function resize(){
    // Size the canvas to its CSS box but with device-pixel resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);

    // Compute world->screen scale; maintain aspect ratio
    scale = rect.width / WORLD.W;
}
window.addEventListener('resize', resize, {passive:true});
new ResizeObserver(resize).observe(canvas);

function w2sX(x){ return x * scale; }
function w2sY(y){ // world y=0 at bottom; canvas y=0 at top
    const rect = canvas.getBoundingClientRect();
    return (WORLD.H - y) * scale;
}
function s2w(p){ // screen (client) -> world
    const rect = canvas.getBoundingClientRect();
    const x = (p.x - rect.left) / rect.width * WORLD.W;
    const y = WORLD.H - (p.y - rect.top) / rect.height * WORLD.H;
    return {x,y};
}

// --- Input handling (pointer events = mouse + touch) ---
let dragging = false;
let dragPoint = {x: SLING_POS.x, y: SLING_POS.y};
canvas.addEventListener('pointerdown', (e)=>{
    const p = s2w({x:e.clientX, y:e.clientY});
    // start dragging only if near sling
    const dx = p.x - SLING_POS.x, dy = p.y - SLING_POS.y;
    const dist = Math.hypot(dx, dy);
    if(dist < PROJECTILE_RADIUS*3.2 || // near current ammo
    (projectile && projectile.state==='ready' && dist<MAX_PULL+2)){
    dragging = true;
    dragPoint = p;
    canvas.setPointerCapture(e.pointerId);
    }
});
canvas.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    dragPoint = s2w({x:e.clientX, y:e.clientY});
});
canvas.addEventListener('pointerup', (e)=>{
    if(!dragging) return;
    dragging = false;
    // Launch projectile based on pull vector
    if (projectile && projectile.state==='ready'){
    const pull = limitPull(vector(SLING_POS, dragPoint), MAX_PULL);
    // opposite direction to pull becomes initial velocity
    const power = 7.5; // tune launch speed
    projectile.vx = -pull.x * power;
    projectile.vy = -pull.y * power;
    projectile.state = 'flying';
    // small shake feedback (optional, purely visual)
    shake(100, 0.5);
    }
});

// --- World objects ---
function makeProjectile(){
    return {
    x: SLING_POS.x, y: SLING_POS.y,
    vx: 0, vy: 0,
    r: PROJECTILE_RADIUS,
    state: 'ready',               // 'ready' | 'flying' | 'rest'
    restTimer: 0
    };
}

function makeTargets(){
    // Simple minimalist stack + singles
    const baseX = 78;
    const groundH = GROUND_Y;
    const blocks = [];
    // block factory
    const block = (x,y,w,h)=>({x,y,w,h, vx:0, vy:0, angle:0, spin:0, alive:true, falling:false});

    // A small tower
    blocks.push(block(baseX, groundH + 6, 4, 8));
    blocks.push(block(baseX+6, groundH + 6, 4, 8));
    blocks.push(block(baseX+3, groundH + 14, 4, 8)); // top

    // Singles
    blocks.push(block(baseX+16, groundH + 5, 4, 6));
    blocks.push(block(baseX+24, groundH + 5, 4, 6));

    // A wider block
    blocks.push(block(baseX+12, groundH + 16, 10, 3));

    return blocks;
}

// --- Physics & collisions ---
function update(dt){
    // Spawn projectile if missing/at rest long
    if(!projectile || projectile.state==='despawn'){
    projectile = makeProjectile();
    }
    // If dragging, keep projectile at the drag point within pull radius
    if(projectile.state === 'ready'){
    const pullVec = limitPull(vector(SLING_POS, dragPoint), MAX_PULL);
    projectile.x = SLING_POS.x + pullVec.x;
    projectile.y = SLING_POS.y + pullVec.y;
    }

    // Update projectile physics
    if(projectile.state === 'flying'){
    projectile.vy -= G * dt;
    projectile.vx *= FRICTION;
    projectile.vy *= FRICTION;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;

    // Collide with ground
    if(projectile.y - projectile.r <= GROUND_Y){
        projectile.y = GROUND_Y + projectile.r;
        projectile.vy = -projectile.vy * 0.45; // bounce
        projectile.vx *= 0.7;
        if (Math.hypot(projectile.vx, projectile.vy) < REST_THRESHOLD){
        projectile.state = 'rest';
        }
    }

    // Off the right/left boundaries dampen slightly
    if(projectile.x - projectile.r < 0){
        projectile.x = projectile.r;
        projectile.vx = -projectile.vx * 0.45;
    }
    if(projectile.x + projectile.r > WORLD.W){
        projectile.x = WORLD.W - projectile.r;
        projectile.vx = -projectile.vx * 0.45;
    }

    // Collisions with targets
    for(const t of targets){
        if(!t.alive) continue;
        if(circleRectCollide(projectile, t)){
        // Nudge target into "falling" state, give it impulse
        t.falling = true;
        t.vx += projectile.vx * 0.25;
        t.vy += Math.max(6, projectile.vy * 0.15 + 8);
        t.spin += (Math.random()*2-1) * 2;
        // Lose some projectile velocity
        projectile.vx *= 0.7;
        projectile.vy *= 0.7;
        }
    }

    // Despawn if far below world
    if(projectile.y < RESPAWN_Y_LIMIT){
        projectile.state = 'despawn';
    }
    } else if(projectile.state === 'rest'){
    projectile.restTimer += dt;
    if(projectile.restTimer > 1.1){ // wait a bit, then respawn
        projectile.state = 'despawn';
    }
    }

    // Update targets
    for(const t of targets){
    if(!t.alive) continue;
    if(t.falling){
        t.vy -= G * dt;
        t.vx *= 0.995;
        t.vy *= 0.995;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.angle += t.spin * dt;

        // ground collision for targets (t treated as rectangle about bottom-left corner)
        if(t.y <= GROUND_Y){
        t.y = GROUND_Y;
        t.vy = -t.vy * 0.25;
        t.vx *= 0.8;
        t.spin *= 0.7;
        // settle -> "disappear"
        if(Math.hypot(t.vx, t.vy) < 2){
            t.alive = false; // minimalist—vanish when settled
        }
        }
    }
    }
}

function circleRectCollide(c, r){
    // Circle vs axis-aligned rect (no rotation)
    // r.x, r.y = bottom-left in world coords
    const cx = c.x, cy = c.y;
    const rx1 = r.x, ry1 = r.y;
    const rx2 = r.x + r.w, ry2 = r.y + r.h;
    const nearestX = clamp(cx, rx1, rx2);
    const nearestY = clamp(cy, ry1, ry2);
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return (dx*dx + dy*dy) <= (c.r*c.r);
}

// --- Rendering ---
let shakeT = 0, shakeMag = 0;
function shake(ms, mag){
    shakeT = ms / 1000;
    shakeMag = mag;
}

function render(){
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;

    // Camera shake (tiny)
    let camX = 0, camY = 0;
    if(shakeT > 0){
    camX = (Math.random()*2-1) * shakeMag;
    camY = (Math.random()*2-1) * shakeMag;
    }

    // Clear
    ctx.clearRect(0,0,w,h);

    // soft sky gradient already provided by CSS background; add ground plane
    drawGround();

    // Targets
    for(const t of targets){
    if(!t.alive) continue;
    drawBlock(t);
    }

    // Slingshot
    drawSling();

    // Projectile
    if(projectile){
    drawBall(projectile);
    }

    // UI subtle overlay grid (very faint)
    drawFaintGrid();

    // Decrease shake timer
    shakeT = Math.max(0, shakeT - 1/60);
}

function drawGround(){
    const y = w2sY(GROUND_Y);
    ctx.save();
    // ground fill
    const grd = ctx.createLinearGradient(0, y, 0, canvas.height/dpr);
    grd.addColorStop(0, "#d9eadb");
    grd.addColorStop(1, "#cfe9d4");
    ctx.fillStyle = grd;
    ctx.fillRect(0, y, canvas.width/dpr, canvas.height/dpr - y);

    // subtle top line
    ctx.beginPath();
    ctx.moveTo(0, y + .5);
    ctx.lineTo(canvas.width/dpr, y + .5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(15,23,42,.08)";
    ctx.stroke();
    ctx.restore();
}

function drawBlock(t){
    const x = w2sX(t.x), yBottom = w2sY(t.y);
    const wpx = w2sX(t.w) - w2sX(0);
    const hpx = w2sY(0) - w2sY(t.h);
    ctx.save();
    // translate to center for rotation when falling
    const cx = x + wpx/2;
    const cy = yBottom - hpx/2;
    ctx.translate(cx, cy);
    ctx.rotate(-t.angle * Math.PI/180);
    // body
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(15,23,42,.10)";
    ctx.lineWidth = 1;
    // soft shadow
    ctx.shadowColor = "rgba(15,23,42,.10)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, -wpx/2, -hpx/2, wpx, hpx, 6);
    ctx.fill();
    ctx.stroke();
    // accent top stripe
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(59,130,246,.15)";
    ctx.fillRect(-wpx/2, -hpx/2, wpx, 6);
    ctx.restore();
}

function drawBall(b){
    const x = w2sX(b.x), y = w2sY(b.y);
    const r = (w2sX(b.r) - w2sX(0));
    ctx.save();
    // soft shadow
    ctx.shadowColor = "rgba(15,23,42,.15)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;

    // fill
    const g = ctx.createRadialGradient(x-r/3, y-r/3, r*0.2, x, y, r);
    g.addColorStop(0, "#3b82f6");
    g.addColorStop(1, "#1e40af");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();

    // outline
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.stroke();

    // tiny highlight
    ctx.beginPath();
    ctx.arc(x - r*0.4, y - r*0.4, r*0.25, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.fill();

    ctx.restore();
}

function drawSling(){
    // Posts
    const baseX = SLING_POS.x - 2.5;
    const postH = 10;
    const postW = 1.4;
    const left = { x: baseX, y: SLING_POS.y + postH };
    const right = { x: baseX + 5, y: SLING_POS.y + postH };

    // Bands (when dragging or ready)
    const anchorL = { x: left.x + 0.7, y: left.y - BAND_REST };
    const anchorR = { x: right.x - 0.7, y: right.y - BAND_REST };

    // Visual projectile position (if ready show dragged position, else sling rest)
    const bandTo = (projectile && projectile.state==='ready')
    ? { x: projectile.x, y: projectile.y }
    : { x: SLING_POS.x, y: SLING_POS.y + 1 };

    // Back band
    drawBand(anchorL, bandTo, 5, "rgba(30,58,138,.35)"); // dark navy translucent
    // Front band
    drawBand(anchorR, bandTo, 5, "rgba(30,58,138,.55)");

    // Wooden posts
    drawPost(left, postW, postH);
    drawPost(right, postW, postH);
}
function drawBand(a, b, px, color){
    ctx.save();
    ctx.lineWidth = Math.max(1, (w2sX(px)-w2sX(0)));
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w2sX(a.x), w2sY(a.y));
    ctx.lineTo(w2sX(b.x), w2sY(b.y));
    ctx.stroke();
    ctx.restore();
}
function drawPost(top, w, h){
    const x = w2sX(top.x - w/2);
    const yTop = w2sY(top.y);
    const width = w2sX(w) - w2sX(0);
    const height = w2sY(0) - w2sY(h);
    ctx.save();
    const g = ctx.createLinearGradient(0, yTop, 0, yTop+height);
    g.addColorStop(0, "#a78bfa");  // soft violet
    g.addColorStop(1, "#7c3aed");  // deeper violet
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(15,23,42,.12)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, x, yTop, width, height, Math.min(12, width*0.4));
    ctx.fill();
    ctx.restore();
}
function drawFaintGrid(){
    const spacing = 10; // world units
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(15,23,42,.03)";
    for(let x=0; x<=WORLD.W; x+=spacing){
    ctx.moveTo(w2sX(x), w2sY(0));
    ctx.lineTo(w2sX(x), w2sY(WORLD.H));
    }
    for(let y=GROUND_Y; y<=WORLD.H; y+=spacing){
    ctx.moveTo(w2sX(0), w2sY(y));
    ctx.lineTo(w2sX(WORLD.W), w2sY(y));
    }
    ctx.stroke();
    ctx.restore();
}
function roundRect(c, x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    c.beginPath();
    c.moveTo(x+rr, y);
    c.arcTo(x+w, y, x+w, y+h, rr);
    c.arcTo(x+w, y+h, x, y+h, rr);
    c.arcTo(x, y+h, x, y, rr);
    c.arcTo(x, y, x+w, y, rr);
    c.closePath();
}

// --- Utility ---
function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }
function vector(a,b){ return { x: b.x-a.x, y: b.y-a.y }; }
function limitPull(v, maxLen){
    const len = Math.hypot(v.x, v.y);
    if(len <= maxLen) return v;
    const s = maxLen / (len || 1);
    return { x: v.x*s, y: v.y*s };
}

// --- Main loop ---
let last = performance.now();
function loop(now){
    const dt = Math.min(0.033, (now - last)/1000); // cap dt for stability
    last = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
}

// --- Init ---
function init(){
    targets = makeTargets();
    projectile = makeProjectile();
    resize();
    requestAnimationFrame(loop);
}
init();