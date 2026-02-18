class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.historySize = 300; // Average over 300 frames for stability
        this.lastFrameTime = performance.now();
        this.fps = 0;
    }

    // Start measuring a specific label (e.g., "Physics")
    start(label) {
        if (!this.metrics[label]) {
            this.metrics[label] = { start: 0, history: [], avg: 0 };
        }
        this.metrics[label].start = performance.now();
    }

    // Stop measuring
    end(label) {
        const metric = this.metrics[label];
        if (!metric) return;
        
        const duration = performance.now() - metric.start;
        
        metric.history.push(duration);
        if (metric.history.length > this.historySize) {
            metric.history.shift();
        }
        
        // Calculate average
        metric.avg = metric.history.reduce((a, b) => a + b, 0) / metric.history.length;
    }

    // Call this once per frame to calculate FPS
    tick() {
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;
        this.fps = Math.round(1000 / delta);
    }

    // Draw the stats box
    draw(ctx) {
        const padding = 10;
        const lineHeight = 14;
        const boxWidth = 160;
        const count = Object.keys(this.metrics).length + 1; // +1 for FPS
        const boxHeight = (count * lineHeight) + (padding * 2);

        ctx.save();
        
        // Semi-transparent background
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(5, 5, boxWidth, boxHeight);
        
        // Text styling
        ctx.font = "11px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        let y = 10 + 5;

        // Draw FPS
        ctx.fillStyle = this.fps >= 27 ? "#0f0" : (this.fps >= 20 ? "#ff0" : "#f00");
        ctx.fillText(`FPS: ${this.fps}`, 15, y);
        y += lineHeight;

        // Draw Metrics
        ctx.fillStyle = "#fff";
        for (const [label, data] of Object.entries(this.metrics)) {
            // Highlight slow sections (e.g., > 3ms) in yellow/red
            if (data.avg > 8) ctx.fillStyle = "#f00";
            else if (data.avg > 3) ctx.fillStyle = "#ff0";
            else ctx.fillStyle = "#fff";

            ctx.fillText(`${label}: ${data.avg.toFixed(3)}ms`, 15, y);
            y += lineHeight;
        }

        ctx.restore();
    }
}