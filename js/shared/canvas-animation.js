// Neo-Brutalism Y2K Canvas Animation - Geometric Shapes
class Y2KCanvasAnimation {
    constructor() {
        this.canvas = document.getElementById('backgroundCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.shapes = [];
        this.shapeCount = 25;
        this.colors = ['#00f0ff', '#ff006e', '#ffea00', '#8fff00', '#ff5c00'];
        this.mousePosition = { x: null, y: null };
        
        this.init();
        this.animate();
        this.addEventListeners();
    }

    init() {
        this.resize();
        this.createShapes();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createShapes() {
        this.shapes = [];
        const shapeTypes = ['square', 'circle', 'triangle', 'cross', 'star'];
        
        for (let i = 0; i < this.shapeCount; i++) {
            const type = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
            const size = Math.random() * 60 + 30;
            
            this.shapes.push({
                type: type,
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: size,
                rotation: Math.random() * Math.PI * 2,
                vx: (Math.random() - 0.5) * 0.8,
                vy: (Math.random() - 0.5) * 0.8,
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                opacity: Math.random() * 0.3 + 0.1
            });
        }
    }

    drawSquare(shape) {
        this.ctx.save();
        this.ctx.translate(shape.x, shape.y);
        this.ctx.rotate(shape.rotation);
        
        // Fill
        this.ctx.fillStyle = shape.color;
        this.ctx.globalAlpha = shape.opacity * 0.3;
        this.ctx.fillRect(-shape.size / 2, -shape.size / 2, shape.size, shape.size);
        
        // Stroke
        this.ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = shape.opacity;
        this.ctx.strokeRect(-shape.size / 2, -shape.size / 2, shape.size, shape.size);
        
        this.ctx.restore();
    }

    drawCircle(shape) {
        this.ctx.save();
        this.ctx.translate(shape.x, shape.y);
        
        // Fill
        this.ctx.beginPath();
        this.ctx.arc(0, 0, shape.size / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = shape.color;
        this.ctx.globalAlpha = shape.opacity * 0.3;
        this.ctx.fill();
        
        // Stroke
        this.ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = shape.opacity;
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    drawTriangle(shape) {
        this.ctx.save();
        this.ctx.translate(shape.x, shape.y);
        this.ctx.rotate(shape.rotation);
        
        const h = shape.size * Math.sqrt(3) / 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, -h / 2);
        this.ctx.lineTo(-shape.size / 2, h / 2);
        this.ctx.lineTo(shape.size / 2, h / 2);
        this.ctx.closePath();
        
        // Fill
        this.ctx.fillStyle = shape.color;
        this.ctx.globalAlpha = shape.opacity * 0.3;
        this.ctx.fill();
        
        // Stroke
        this.ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = shape.opacity;
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    drawCross(shape) {
        this.ctx.save();
        this.ctx.translate(shape.x, shape.y);
        this.ctx.rotate(shape.rotation);
        
        const thickness = shape.size / 4;
        const length = shape.size;
        
        // Vertical bar
        this.ctx.fillStyle = shape.color;
        this.ctx.globalAlpha = shape.opacity * 0.3;
        this.ctx.fillRect(-thickness / 2, -length / 2, thickness, length);
        
        // Horizontal bar
        this.ctx.fillRect(-length / 2, -thickness / 2, length, thickness);
        
        // Strokes
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = shape.opacity;
        this.ctx.strokeRect(-thickness / 2, -length / 2, thickness, length);
        this.ctx.strokeRect(-length / 2, -thickness / 2, length, thickness);
        
        this.ctx.restore();
    }

    drawStar(shape) {
        this.ctx.save();
        this.ctx.translate(shape.x, shape.y);
        this.ctx.rotate(shape.rotation);
        
        const spikes = 5;
        const outerRadius = shape.size / 2;
        const innerRadius = shape.size / 4;
        
        this.ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * i) / spikes - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        
        // Fill
        this.ctx.fillStyle = shape.color;
        this.ctx.globalAlpha = shape.opacity * 0.3;
        this.ctx.fill();
        
        // Stroke
        this.ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = shape.opacity;
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    drawShape(shape) {
        switch (shape.type) {
            case 'square':
                this.drawSquare(shape);
                break;
            case 'circle':
                this.drawCircle(shape);
                break;
            case 'triangle':
                this.drawTriangle(shape);
                break;
            case 'cross':
                this.drawCross(shape);
                break;
            case 'star':
                this.drawStar(shape);
                break;
        }
    }

    updateShape(shape) {
        // Pergerakan
        shape.x += shape.vx;
        shape.y += shape.vy;
        shape.rotation += shape.rotationSpeed;

        // Bounce dari dinding
        if (shape.x < -shape.size || shape.x > this.canvas.width + shape.size) {
            shape.vx *= -1;
        }
        if (shape.y < -shape.size || shape.y > this.canvas.height + shape.size) {
            shape.vy *= -1;
        }

        // Interaksi dengan mouse
        if (this.mousePosition.x !== null && this.mousePosition.y !== null) {
            const dx = this.mousePosition.x - shape.x;
            const dy = this.mousePosition.y - shape.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = 150;

            if (distance < minDistance) {
                const force = (minDistance - distance) / minDistance;
                const angle = Math.atan2(dy, dx);
                
                // Push away from mouse
                shape.vx -= Math.cos(angle) * force * 0.5;
                shape.vy -= Math.sin(angle) * force * 0.5;
                
                // Increase rotation speed
                shape.rotationSpeed += (Math.random() - 0.5) * 0.05;
            }
        }

        // Batasi kecepatan
        const maxSpeed = 2;
        const speed = Math.sqrt(shape.vx * shape.vx + shape.vy * shape.vy);
        if (speed > maxSpeed) {
            shape.vx = (shape.vx / speed) * maxSpeed;
            shape.vy = (shape.vy / speed) * maxSpeed;
        }

        // Gradual slowdown rotation
        shape.rotationSpeed *= 0.99;
    }

    drawGrid() {
        const gridSize = 100;
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.03;
        
        // Vertical lines
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();

        // Update and draw shapes
        this.shapes.forEach(shape => {
            this.updateShape(shape);
            this.drawShape(shape);
        });

        requestAnimationFrame(() => this.animate());
    }

    addEventListeners() {
        window.addEventListener('resize', () => {
            this.resize();
            this.createShapes();
        });

        window.addEventListener('mousemove', (e) => {
            this.mousePosition.x = e.clientX;
            this.mousePosition.y = e.clientY;
        });

        window.addEventListener('mouseleave', () => {
            this.mousePosition.x = null;
            this.mousePosition.y = null;
        });

        // Touch support
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                this.mousePosition.x = e.touches[0].clientX;
                this.mousePosition.y = e.touches[0].clientY;
            }
        });

        window.addEventListener('touchend', () => {
            this.mousePosition.x = null;
            this.mousePosition.y = null;
        });

        // Click to add shape
        window.addEventListener('click', (e) => {
            if (e.target.id === 'backgroundCanvas') return;
            
            const shapeTypes = ['square', 'circle', 'triangle', 'cross', 'star'];
            const type = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
            const size = Math.random() * 60 + 40;
            
            this.shapes.push({
                type: type,
                x: e.clientX,
                y: e.clientY,
                size: size,
                rotation: Math.random() * Math.PI * 2,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                opacity: 0.5
            });
            
            // Remove oldest shape if too many
            if (this.shapes.length > 40) {
                this.shapes.shift();
            }
        });
    }
}

// Initialize animation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Y2KCanvasAnimation();
});