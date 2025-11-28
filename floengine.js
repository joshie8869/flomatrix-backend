// floengine.js
// FloMatrix Canvas Engine v0.1 — custom candles on HTML5 canvas

class FloEngine {
    constructor(options) {
        this.canvas = options.canvas;
        this.ctx    = this.canvas.getContext("2d");

        // live candle buffer
        this.candles = [];

        // how many candles to keep / draw
        this.maxCandles = 300;

        console.log("[FloEngine] Prototype engine loaded (FloMatrix canvas).");

        // handle resize (if CSS size changes)
        window.addEventListener("resize", () => this.handleResize());
        this.handleResize();
    }

    handleResize() {
        if (!this.canvas) return;

        // match internal resolution to CSS box for crisp lines
        const rect = this.canvas.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;

        this.canvas.width  = rect.width  * dpr;
        this.canvas.height = rect.height * dpr;

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.render();
    }

    // Called by FloFeed every time a new candle arrives
    pushCandle(c) {
        // basic sanity
        if (
            c == null ||
            typeof c.open  !== "number" ||
            typeof c.high  !== "number" ||
            typeof c.low   !== "number" ||
            typeof c.close !== "number"
        ) {
            return;
        }

        this.candles.push(c);

        if (this.candles.length > this.maxCandles) {
            this.candles.splice(0, this.candles.length - this.maxCandles);
        }

        this.render();
    }

    render() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        if (!ctx || !canvas) return;

        const w = canvas.clientWidth;
        const h = canvas.clientHeight;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // ===== Background =====
        const bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, "#05060a");
        bgGrad.addColorStop(1, "#020308");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // No data yet
        if (this.candles.length === 0) {
            ctx.fillStyle = "#4b5563";
            ctx.font = "12px Inter, system-ui, -apple-system, BlinkMacSystemFont";
            ctx.textAlign = "center";
            ctx.fillText(
                "Waiting for FloMatrix live feed…",
                w / 2,
                h / 2
            );
            return;
        }

        // ===== Plot region =====
        const padLeft   = 60;
        const padRight  = 20;
        const padTop    = 20;
        const padBottom = 40;

        const pw = w - padLeft - padRight;   // plot width
        const ph = h - padTop - padBottom;   // plot height

        // frame
        ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(padLeft, padTop, pw, ph);

        const candles = this.candles.slice(-this.maxCandles);
        const n = candles.length;

        // Get price range with a little padding
        const highs = candles.map(c => c.high);
        const lows  = candles.map(c => c.low);
        let maxH = Math.max(...highs);
        let minL = Math.min(...lows);

        if (maxH === minL) {
            maxH *= 1.001;
            minL *= 0.999;
        }

        const range = maxH - minL;
        const priceToY = (price) =>
            padTop + ph - ((price - minL) / range) * ph;

        // ===== Grid lines =====
        const gridLines = 5;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
        ctx.lineWidth = 1;

        ctx.font = "10px Inter, system-ui, -apple-system, BlinkMacSystemFont";
        ctx.fillStyle = "#6b7280";
        ctx.textAlign = "right";

        for (let i = 0; i <= gridLines; i++) {
            const t = i / gridLines;
            const y = padTop + ph - t * ph;
            const price = minL + t * range;

            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(padLeft + pw, y);
            ctx.stroke();

            ctx.fillText(price.toFixed(2), padLeft - 6, y + 3);
        }

        // ===== Candles =====
        const gap      = 2; // space between candles
        const barWidth = Math.max((pw / n) - gap, 3);

        const upColor   = "#22c55e"; // neon green
        const downColor = "#f97373"; // magenta-ish red

        for (let i = 0; i < n; i++) {
            const c = candles[i];
            const x = padLeft + i * (pw / n) + gap * 0.5;

            const yHigh  = priceToY(c.high);
            const yLow   = priceToY(c.low);
            const yOpen  = priceToY(c.open);
            const yClose = priceToY(c.close);

            const isUp = c.close >= c.open;

            ctx.strokeStyle = isUp ? upColor : downColor;
            ctx.fillStyle   = isUp ? upColor : downColor;

            // wick
            ctx.beginPath();
            ctx.moveTo(x + barWidth / 2, yHigh);
            ctx.lineTo(x + barWidth / 2, yLow);
            ctx.stroke();

            // body
            const top    = Math.min(yOpen, yClose);
            const bottom = Math.max(yOpen, yClose);
            let bodyH    = bottom - top;
            if (bodyH < 1) bodyH = 1;

            ctx.fillRect(x, top, barWidth, bodyH);
        }

        // ===== Last price line =====
        const last = candles[candles.length - 1];
        const lastY = priceToY(last.close);

        ctx.strokeStyle = "rgba(34, 197, 94, 0.6)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padLeft, lastY);
        ctx.lineTo(padLeft + pw, lastY);
        ctx.stroke();
        ctx.setLineDash([]);

        // last price label
        const labelText = last.close.toFixed(2);
        const labelWidth = ctx.measureText(labelText).width + 14;
        const labelHeight = 18;

        ctx.fillStyle = "#22c55e";
        ctx.fillRect(
            padLeft + pw - labelWidth,
            lastY - labelHeight / 2,
            labelWidth,
            labelHeight
        );

        ctx.fillStyle = "#020617";
        ctx.textAlign = "center";
        ctx.font = "10px Inter, system-ui, -apple-system, BlinkMacSystemFont";
        ctx.fillText(
            labelText,
            padLeft + pw - labelWidth / 2,
            lastY + 3
        );
    }
}

// expose globally
window.FloEngine = FloEngine;
