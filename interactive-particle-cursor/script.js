// Physics Simulation Demo
class PhysicsSimulation {
    constructor() {
        this.canvas = document.getElementById('physicsCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.gravity = 0.5;
        this.isPaused = false;
        this.particleCount = 0;
        this.totalCreated = 0;
        this.lastTime = 0;
        this.fps = 60;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.animate();
    }
    
    setupCanvas() {
        // Set canvas size
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Handle resize
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            const containerWidth = container.clientWidth;
            const scale = Math.min(containerWidth / 800, 1);
            
            this.canvas.style.width = (800 * scale) + 'px';
            this.canvas.style.height = (600 * scale) + 'px';
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    setupEventListeners() {
        // Canvas click events
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Control events
        document.getElementById('gravitySlider').addEventListener('input', (e) => {
            this.gravity = parseFloat(e.target.value);
            document.getElementById('gravityValue').textContent = this.gravity.toFixed(1);
        });
        
        document.getElementById('particleSlider').addEventListener('input', (e) => {
            this.particleCount = parseInt(e.target.value);
            document.getElementById('particleValue').textContent = this.particleCount;
        });
        
        document.getElementById('clearBtn').addEventListener('click', () => this.clearParticles());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        
        // Color theme buttons
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('ring-2', 'ring-offset-2'));
                e.target.classList.add('ring-2', 'ring-offset-2');
                this.currentColor = e.target.dataset.color;
            });
        });
        
        // Set default color
        document.querySelector('[data-color="blue"]').classList.add('ring-2', 'ring-offset-2');
        this.currentColor = 'blue';
        
        // Mouse drag state
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
    }
    
    handleClick(e) {
        if (this.isPaused) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        
        this.createParticles(x, y, 0, 0);
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.dragStart.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this.dragStart.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        this.isDragging = true;
    }
    
    handleMouseMove(e) {
        if (!this.isDragging || this.isPaused) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        
        // Create particles with velocity based on drag
        const vx = (x - this.dragStart.x) * 0.1;
        const vy = (y - this.dragStart.y) * 0.1;
        
        this.createParticles(this.dragStart.x, this.dragStart.y, vx, vy);
        this.dragStart = { x, y };
    }
    
    handleMouseUp() {
        this.isDragging = false;
    }
    
    createParticles(x, y, vx, vy) {
        const count = this.particleCount || 3;
        
        for (let i = 0; i < count; i++) {
            const particle = {
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: vx + (Math.random() - 0.5) * 4,
                vy: vy + (Math.random() - 0.5) * 4,
                radius: Math.random() * 4 + 2,
                color: this.getParticleColor(),
                life: 1.0,
                decay: Math.random() * 0.02 + 0.005
            };
            
            this.particles.push(particle);
            this.totalCreated++;
        }
        
        this.updateStats();
    }
    
    getParticleColor() {
        const colors = {
            blue: ['#3b82f6', '#1d4ed8', '#1e40af'],
            green: ['#10b981', '#059669', '#047857'],
            purple: ['#8b5cf6', '#7c3aed', '#6d28d9']
        };
        
        const colorSet = colors[this.currentColor] || colors.blue;
        return colorSet[Math.floor(Math.random() * colorSet.length)];
    }
    
    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Apply gravity
            particle.vy += this.gravity;
            
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Bounce off walls
            if (particle.x - particle.radius < 0 || particle.x + particle.radius > this.canvas.width) {
                particle.vx *= -0.8;
                particle.x = Math.max(particle.radius, Math.min(this.canvas.width - particle.radius, particle.x));
            }
            
            if (particle.y + particle.radius > this.canvas.height) {
                particle.vy *= -0.8;
                particle.y = this.canvas.height - particle.radius;
            }
            
            // Apply friction
            particle.vx *= 0.99;
            particle.vy *= 0.99;
            
            // Update life
            particle.life -= particle.decay;
            
            // Remove dead particles
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw particles
        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.life;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }
    
    animate(currentTime) {
        if (!this.lastTime) this.lastTime = currentTime;
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Update FPS counter
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
            this.updateStats();
        }
        
        if (!this.isPaused) {
            this.updateParticles(deltaTime);
        }
        
        this.render();
        requestAnimationFrame((time) => this.animate(time));
    }
    
    clearParticles() {
        this.particles = [];
        this.updateStats();
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('pauseBtn');
        btn.textContent = this.isPaused ? 'Resume' : 'Pause';
        btn.className = this.isPaused 
            ? 'w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors'
            : 'w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-lg font-medium transition-colors';
    }
    
    updateStats() {
        document.getElementById('particleCount').textContent = this.particles.length;
        document.getElementById('fps').textContent = this.fps;
        document.getElementById('totalCreated').textContent = this.totalCreated;
    }
}

// Initialize simulation when page loads
document.addEventListener('DOMContentLoaded', () => {
    new PhysicsSimulation();
});