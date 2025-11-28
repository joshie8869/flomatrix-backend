/* ============================================================
   FloMatrix Hybrid Engine — Core OHLC Engine
   File: floengine-core.js
   Purpose: Lightweight OHLC + base rendering,
            lifecycle management, transforms, viewport.
   ============================================================ */

export class FloCoreEngine {
    constructor(containerId, dataHub) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error("FloCoreEngine: container not found:", containerId);
            return;
        }

        this.dataHub = dataHub;
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        // Canvas setup
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext("2d");

        this.container.appendChild(this.canvas);

        // Internal state
        this.candles = [];
        this.timeframe = "1m";
        this.symbol = "BTCUSDT";

        // Interaction state
        this.offsetX = 0;
        this.scale = 1; 
        this.dragging = false;

        // Bind events
        this._bindEvents();

        // Start render loop
        requestAnimationFrame(() => this.render());
    }

    /* ============================================================
       EVENT BINDINGS
       ============================================================ */
    _bindEvents() {
        this.canvas.addEventListener("mousedown", (e) => {
            this.dragging = true;
            this.lastX = e.clientX;
        });

        window.addEventListener("mouseup", () => {
            this.dragging = false;
        });

        window.addEventListener("mousemove", (e) => {
            if (this.dragging) {
                const delta = e.clientX - this.lastX;
                this.offsetX += delta;
                this.lastX = e.clientX;
            }
        });

        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            const zoomFactor = 1.1;
            if (e.deltaY < 0) {
                this.scale *= zoomFactor;
            } else {
                this.scale /= zoomFactor;
            }
        });

        window.addEventListener("resize", () => this._resize());
    }

    _resize() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        console.log("FloCoreEngine: resized", this.width, this.height);
    }

    /* ============================================================
       DATA INGEST
       ============================================================ */
    setData(candleArray) {
        this.candles = candleArray;
    }

    updateLastCandle(candle) {
        if (this.candles.length === 0) return;
        this.candles[this.candles.length - 1] = candle;
    }

    pushCandle(candle) {
        this.candles.push(candle);
    }

    /* ============================================================
       RENDER LOOP
       ============================================================ */
    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        if (this.candles.length > 0) {
            this._drawCandles();
            this._drawCrosshair();
        }

        requestAnimationFrame(() => this.render());
    }

    /* ============================================================
       LOW-LEVEL RENDER: OHLC CANDLES
       ============================================================ */
    _drawCandles() {
        const ctx = this.ctx;

        const candleWidth = 8 * this.scale;
        const space = 2 * this.scale;
        const fullWidth = candleWidth + space;

        const viewCount = Math.floor(this.width / fullWidth) + 5;

        // Starting index (scroll offset)
        const startIndex = Math.max(
            0,
            this.candles.length - Math.floor((this.width + Math.abs(this.offsetX)) / fullWidth) - 5
        );

        const maxPrice = Math.max(...this.candles.map(c => c.high));
        const minPrice = Math.min(...this.candles.map(c => c.low));
        const priceRange = maxPrice - minPrice;

        const pxPerPrice = this.height / priceRange;

        let x = this.offsetX % fullWidth;

        for (let i = startIndex; i < this.candles.length; i++) {
            const c = this.candles[i];

            const openY = this.height - (c.open - minPrice) * pxPerPrice;
            const closeY = this.height - (c.close - minPrice) * pxPerPrice;
            const highY = this.height - (c.high - minPrice) * pxPerPrice;
            const lowY = this.height - (c.low - minPrice) * pxPerPrice;

            const isBull = c.close >= c.open;
            ctx.fillStyle = isBull ? "#12ff80" : "#ff2e4d";
            ctx.strokeStyle = isBull ? "#12ff80" : "#ff2e4d";

            // Wick
            ctx.beginPath();
            ctx.moveTo(x + candleWidth / 2, highY);
            ctx.lineTo(x + candleWidth / 2, lowY);
            ctx.stroke();

            // Body
            const bodyY = isBull ? closeY : openY;
            const bodyHeight = Math.max(1, Math.abs(closeY - openY));
            ctx.fillRect(x, bodyY, candleWidth, bodyHeight);

            x += fullWidth;
        }
    }

    /* ============================================================
       CROSSHAIR
       ============================================================ */
    _drawCrosshair() {
        if (!this.mousePos) return;
        const ctx = this.ctx;

        ctx.strokeStyle = "rgba(255,255,255,0.3)";

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(this.mousePos.x, 0);
        ctx.lineTo(this.mousePos.x, this.height);
        ctx.stroke();

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(0, this.mousePos.y);
        ctx.lineTo(this.width, this.mousePos.y);
        ctx.stroke();
    }

    setMousePosition(x, y) {
        this.mousePos = { x, y };
    }
}
