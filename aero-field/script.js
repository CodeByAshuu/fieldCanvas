/* Canvas Physics Playground — Vanilla JS
   Modes: 1 Balls, 2 Particles, 3 Pendulum, 4 Projectile
   Interactions: Click spawn, Drag balls, Arrows = wind/force, C = clear
*/

(() => {
  // ===== Canvas setup =====
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const modeLabel = document.getElementById('modeLabel');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const { innerWidth: w, innerHeight: h } = window;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();
  document.body.classList.add('loaded');

  // ===== Utilities =====
  const rand = (min, max) => Math.random() * (max - min) + min;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };

  // Global simulation params
  const gravity = { x: 0, y: 900 }; // px/s^2
  let wind = 0; // global horizontal acceleration added to some modes

  // ===== Input state =====
  const pointer = { x: 0, y: 0, down: false, draggingId: null, dragOffset: { x: 0, y: 0 } };
  canvas.addEventListener('pointerdown', (e) => {
    pointer.down = true;
    const rect = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - rect.left);
    pointer.y = (e.clientY - rect.top);

    if (mode === MODES.BALLS) {
      // Try pick a ball to drag
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        if (Math.hypot(pointer.x - b.x, pointer.y - b.y) <= b.r) {
          pointer.draggingId = b.id;
          pointer.dragOffset.x = pointer.x - b.x;
          pointer.dragOffset.y = pointer.y - b.y;
          b.vx = b.vy = 0;
          break;
        }
      }
      if (pointer.draggingId == null) spawnBall(pointer.x, pointer.y);
    } else if (mode === MODES.PARTICLES) {
      burst(pointer.x, pointer.y);
    } else if (mode === MODES.PENDULUM) {
      // Nudge angle a bit on click
      pendulum.omega += rand(-0.8, 0.8);
    } else if (mode === MODES.PROJECTILE) {
      // Aim start
      aiming.active = true;
      aiming.startX = pointer.x;
      aiming.startY = pointer.y;
      aiming.endX = pointer.x;
      aiming.endY = pointer.y;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - rect.left);
    pointer.y = (e.clientY - rect.top);
    if (pointer.down && pointer.draggingId != null) {
      const b = balls.find(b => b.id === pointer.draggingId);
      if (b) {
        b.x = pointer.x - pointer.dragOffset.x;
        b.y = pointer.y - pointer.dragOffset.y;
      }
    }
    if (aiming.active) {
      aiming.endX = pointer.x;
      aiming.endY = pointer.y;
    }
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
    pointer.draggingId = null;

    if (aiming.active) {
      // Fire projectile based on drag vector
      const vx = (aiming.startX - aiming.endX) * 2.4;
      const vy = (aiming.startY - aiming.endY) * 2.4;
      fireProjectile(aiming.startX, aiming.startY, vx, vy);
      aiming.active = false;
    }
  });

  // Keyboard: switch modes, wind/force, clear
  const MODES = { BALLS: 1, PARTICLES: 2, PENDULUM: 3, PROJECTILE: 4 };
  let mode = MODES.BALLS;
  function setMode(m) {
    mode = m;
    modeLabel.textContent =
      m === MODES.BALLS ? 'Bouncing Balls' :
      m === MODES.PARTICLES ? 'Particles' :
      m === MODES.PENDULUM ? 'Pendulum' :
      'Projectile';
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === '1') setMode(MODES.BALLS);
    else if (e.key === '2') setMode(MODES.PARTICLES);
    else if (e.key === '3') setMode(MODES.PENDULUM);
    else if (e.key === '4') setMode(MODES.PROJECTILE);
    else if (e.key.toLowerCase() === 'c') { balls = []; particles = []; projectiles = []; }
    else if (e.key === 'ArrowLeft') wind -= 50;
    else if (e.key === 'ArrowRight') wind += 50;
    else if (e.key === 'ArrowUp') { // little kick upward in some modes
      if (mode === MODES.BALLS) balls.forEach(b => b.vy -= 120);
      if (mode === MODES.PENDULUM) pendulum.omega -= 0.1;
    } else if (e.key === 'ArrowDown') {
      if (mode === MODES.BALLS) balls.forEach(b => b.vy += 120);
      if (mode === MODES.PENDULUM) pendulum.omega += 0.1;
    }
  });

  // ===== Bouncing Balls =====
  let nextId = 1;
  let balls = [];
  function spawnBall(x, y) {
    const r = rand(10, 26);
    balls.push({
      id: nextId++,
      x, y,
      vx: rand(-120, 120),
      vy: rand(-60, -10),
      r,
      color: `hsla(${Math.floor(rand(180, 240))}, 70%, 70%, 0.95)`,
      elasticity: 0.88,
      drag: 0.0008
    });
  }
  // Seed a few
  for (let i = 0; i < 10; i++) spawnBall(rand(40, innerWidth-40), rand(10, innerHeight*0.3));

  function updateBalls(dt) {
    const W = canvas.clientWidth, H = canvas.clientHeight;

    for (let b of balls) {
      // Integrate acceleration
      b.vx += (wind - b.drag * b.vx) * dt;
      b.vy += (gravity.y - b.drag * b.vy) * dt;

      // Integrate velocity
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Wall collisions
      if (b.x - b.r < 0) { b.x = b.r; b.vx = -b.vx * b.elasticity; }
      if (b.x + b.r > W) { b.x = W - b.r; b.vx = -b.vx * b.elasticity; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = -b.vy * b.elasticity; }
      if (b.y + b.r > H) { b.y = H - b.r; b.vy = -b.vy * b.elasticity; }

      // Simple ball-ball collision (naive O(n^2), light demo)
      // Small performance: only check with later balls
    }
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx*dx + dy*dy, rsum = a.r + b.r;
        if (d2 > 1e-6 && d2 < rsum * rsum) {
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;
          // Separate
          const overlap = rsum - d;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          // Elastic impulse (1D along normal)
          const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          const relVelNorm = rvx * nx + rvy * ny;
          if (relVelNorm < 0) {
            const e = Math.min(a.elasticity, b.elasticity);
            const jimp = -(1 + e) * relVelNorm / 2; // equal mass
            const jx = jimp * nx, jy = jimp * ny;
            a.vx -= jx; a.vy -= jy;
            b.vx += jx; b.vy += jy;
          }
        }
      }
    }
  }

  function drawBalls() {
    ctx.save();
    for (let b of balls) {
      ctx.beginPath();
      ctx.fillStyle = b.color;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ===== Particles =====
  let particles = [];
  function burst(x, y) {
    const n = 120;
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(60, 360);
      particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(0.8, 1.6),
        age: 0,
        size: rand(1, 3),
        hue: rand(180, 230)
      });
    }
  }
  function updateParticles(dt) {
    const g = gravity.y * 0.25;
    particles = particles.filter(p => p.age < p.life);
    for (let p of particles) {
      p.age += dt;
      p.vx += wind * dt;
      p.vy += g * dt;
      // Air damping
      p.vx *= (1 - 0.8 * dt);
      p.vy *= (1 - 0.2 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let p of particles) {
      const alpha = 1 - (p.age / p.life);
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${alpha})`;
      ctx.arc(p.x, p.y, p.size + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ===== Pendulum =====
  const pendulum = {
    originX: () => canvas.clientWidth * 0.5,
    originY: () => 60,
    L: 220, // length
    theta: Math.PI * 0.5, // from vertical
    omega: 0,
    bobR: 16
  };
  function updatePendulum(dt) {
    const g = gravity.y;
    const alpha = -(g / pendulum.L) * Math.sin(pendulum.theta); // angular accel
    pendulum.omega += alpha * dt;
    pendulum.omega *= (1 - 0.003); // gentle damping
    pendulum.theta += pendulum.omega * dt;
  }
  function drawPendulum() {
    const ox = pendulum.originX();
    const oy = pendulum.originY();
    const x = ox + pendulum.L * Math.sin(pendulum.theta);
    const y = oy + pendulum.L * Math.cos(pendulum.theta);

    // String
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(200,210,255,0.6)';
    ctx.moveTo(ox, oy);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Bob
    ctx.beginPath();
    ctx.fillStyle = 'rgba(160,190,255,0.95)';
    ctx.arc(x, y, pendulum.bobR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== Projectile =====
  let projectiles = [];
  const aiming = { active: false, startX: 0, startY: 0, endX: 0, endY: 0 };

  function fireProjectile(x, y, vx, vy) {
    projectiles.push({ x, y, vx, vy, r: 5, life: 8, age: 0 });
  }
  function updateProjectiles(dt) {
    projectiles = projectiles.filter(p => p.age < p.life);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    for (let p of projectiles) {
      p.age += dt;
      p.vx += wind * dt;
      p.vy += gravity.y * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Bounce on edges
      if (p.x - p.r < 0) { p.x = p.r; p.vx = -p.vx * 0.85; }
      if (p.x + p.r > W) { p.x = W - p.r; p.vx = -p.vx * 0.85; }
      if (p.y - p.r < 0) { p.y = p.r; p.vy = -p.vy * 0.85; }
      if (p.y + p.r > H) { p.y = H - p.r; p.vy = -p.vy * 0.85; }
    }
  }
  function drawProjectiles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let p of projectiles) {
      ctx.beginPath();
      const a = 1 - p.age / p.life;
      ctx.fillStyle = `rgba(170,210,255,${a})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Aim line
    if (aiming.active) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.moveTo(aiming.startX, aiming.startY);
      ctx.lineTo(aiming.endX, aiming.endY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // ===== Background grid (subtle, modern) =====
  function drawBackground() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    // Soft vignette
    const g = ctx.createRadialGradient(W*0.5, H*0.35, 0, W*0.5, H*0.5, Math.max(W, H)*0.8);
    g.addColorStop(0, 'rgba(255,255,255,0.02)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Ghost grid
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(200,220,255,0.05)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x <= W; x += step) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
    }
    for (let y = 0; y <= H; y += step) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();
  }

  // ===== Main loop =====
  let last = performance.now();
  function frame(t) {
    const dt = Math.min((t - last) / 1000, 0.033); // clamp dt
    last = t;

    drawBackground();

    switch (mode) {
      case MODES.BALLS:
        updateBalls(dt);
        drawBalls();
        break;
      case MODES.PARTICLES:
        updateParticles(dt);
        drawParticles();
        break;
      case MODES.PENDULUM:
        updatePendulum(dt);
        drawPendulum();
        break;
      case MODES.PROJECTILE:
        updateProjectiles(dt);
        drawProjectiles();
        break;
    }

    // Ease wind back toward 0 for a nicer feel
    wind *= 0.995;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
