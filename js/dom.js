/* =====================================================================
   FloMatrix Terminal — DOM LADDER ENGINE
   ---------------------------------------------------------------------
   Responsibilities:
     • Render a real-time ladder (price column between bid/ask)
     • Show bid sizes + ask sizes
     • Depth shading based on size
     • Auto-center around last traded price
     • Highlight last trade (up/down)
     • Track ticks and flash traded price levels
   ===================================================================== */

window.dom = (function () {

    // =============================================================
    // Internal state
    // =============================================================
    let canvas = null;
    let ctx = null;

    // price → { bid, ask }
    let depthMap = new Map();

    let lastPrice = null;
    let lastTradeSide = null;

    // DOM rendering config
    const cfg = {
        font: "12px Inter, sans-serif",
        rowHeight: 18,
        priceDecimals: 2,
        maxDepthShown: 40,
        flashDuration: 200, // ms
        flashMap: new Map(), // price → timestamp of flash

        bidBg: "rgba(65,255,122,0.25)",
        askBg: "rgba(255,77,106,0.25)",
        bidColor: "#41ff7a",
        askColor: "#ff4d6a",
        textColor: "#dcdcdc",

        centerColor: "#ffffff",
        centerFont: "bold 13px Inter",
        bgColor: "rgba(0,0,0,0.10)",

        priceColWidth: 75,   // center price column
        sizeColWidth: 70,    // left/right size columns

        heatMax: 250,        // shading scale
    };

    // =============================================================
    // API
    // =============================================================
    function init(canvasId) {
        canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error("DOM: failed to find canvas:", canvasId);
            return;
        }
        ctx = canvas.getContext("2d");

        resize();
        window.addEventListener("resize", resize);

        console.log("DOM: initialized");
    }

    function resetView() {
        depthMap.clear();
        lastPrice = null;
        flashMap.clear();
        clear();
    }

    function onDepth(depth) {
        if (!depth || !Array.isArray(depth.bids) || !Array.isArray(depth.asks)) return;

        depthMap.clear();

        // Insert bids
        for (let b of depth.bids) {
            const key = roundPrice(b.price);
            depthMap.set(key, {
                price: key,
                bid: b.size,
                ask: 0
            });
        }

        // Insert asks
        for (let a of depth.asks) {
            const key = roundPrice(a.price);
            if (depthMap.has(key)) {
                depthMap.get(key).ask = a.size;
            } else {
                depthMap.set(key, {
                    price: key,
                    bid: 0,
                    ask: a.size
                });
            }
        }

        redraw();
    }

    function onTick(tick) {
        if (!tick || typeof tick.price !== "number") return;

        const p = roundPrice(tick.price);
        const side = tick.side || "buy";

        lastTradeSide = side;
        lastPrice = p;

        // mark flash
        flashMap.set(p, performance.now());

        redraw();
    }

    // =============================================================
    // Resizing
    // =============================================================
    function resize() {
        if (!canvas) return;
        canvas.width  = canvas.clientWidth || canvas.offsetWidth || 120;
        canvas.height = canvas.clientHeight || canvas.offsetHeight || 500;
        redraw();
    }

    function clear() {
        if (!ctx || !canvas) return;
        ctx.fillStyle = cfg.bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // =============================================================
    // Rendering
    // =============================================================
    function redraw() {
        if (!ctx || !canvas) return;

        clear();

        if (depthMap.size === 0) {
            drawCenteredText("Awaiting DOM…", canvas.width / 2, canvas.height / 2, "#999");
            return;
        }

        // Determine ladder price range centered around lastPrice
        let centerPrice = lastPrice !== null ? lastPrice : determineMidPrice();

        const maxRows = Math.floor(canvas.height / cfg.rowHeight);
        const half = Math.floor(maxRows / 2);

        const prices = [];
        for (let i = half; i >= -half; i--) {
            const price = centerPrice + (i * priceStep());
            prices.push(roundPrice(price));
        }

        // Determine max depth for shading scaling
        let maxBid = 1;
        let maxAsk = 1;

        for (let [p, data] of depthMap) {
            if (data.bid > maxBid) maxBid = data.bid;
            if (data.ask > maxAsk) maxAsk = data.ask;
        }

        // Render each price row
        let y = 0;
        for (let price of prices) {
            drawRow(price, y, maxBid, maxAsk);
            y += cfg.rowHeight;
        }

        drawCenterLine(); 
    }

    // =============================================================
    // Drawing Helpers
    // =============================================================
    function drawRow(price, y, maxBid, maxAsk) {
        const rowWidth = canvas.width;
        const priceX = rowWidth / 2;
        const isCenter = (price === lastPrice);

        const rowY = y;
        const mid = canvas.width / 2;

        const data = depthMap.get(price) || { bid: 0, ask: 0 };
        const bid = data.bid;
        const ask = data.ask;

        // Flash highlight on trade
        const flashTime = flashMap.get(price);
        if (flashTime && performance.now() - flashTime < cfg.flashDuration) {
            ctx.fillStyle = lastTradeSide === "buy"
                ? "rgba(65,255,122,0.35)"
                : "rgba(255,77,106,0.35)";
            ctx.fillRect(0, rowY, canvas.width, cfg.rowHeight);
        }

        // Heat shading for bids
        if (bid > 0) {
            const intensity = Math.min(1, bid / cfg.heatMax);
            ctx.fillStyle = `rgba(65,255,122,${0.12 + intensity * 0.4})`;
            ctx.fillRect(
                0,
                rowY,
                cfg.sizeColWidth,
                cfg.rowHeight
            );
        }

        // Heat shading for asks
        if (ask > 0) {
            const intensity = Math.min(1, ask / cfg.heatMax);
            ctx.fillStyle = `rgba(255,77,106,${0.12 + intensity * 0.4})`;
            ctx.fillRect(
                canvas.width - cfg.sizeColWidth,
                rowY,
                cfg.sizeColWidth,
                cfg.rowHeight
            );
        }

        // Price column background
        if (isCenter) {
            ctx.fillStyle = "rgba(255,255,255,0.10)";
            ctx.fillRect(
                cfg.sizeColWidth,
                rowY,
                cfg.priceColWidth,
                cfg.rowHeight
            );
        }

        // --- Draw Bid Size ---
        ctx.fillStyle = cfg.bidColor;
        ctx.font = cfg.font;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        if (bid > 0) {
            ctx.fillText(
                bid.toFixed(0),
                4,
                rowY + cfg.rowHeight / 2
            );
        }

        // --- Draw Ask Size ---
        ctx.fillStyle = cfg.askColor;
        ctx.textAlign = "right";
        if (ask > 0) {
            ctx.fillText(
                ask.toFixed(0),
                canvas.width - 4,
                rowY + cfg.rowHeight / 2
            );
        }

        // --- Draw Price ---
        ctx.fillStyle = isCenter ? "#fff" : cfg.textColor;
        ctx.font = isCenter ? cfg.centerFont : cfg.font;
        ctx.textAlign = "center";
        ctx.fillText(
            formatPrice(price),
            canvas.width / 2,
            rowY + cfg.rowHeight / 2
        );
    }

    function drawCenterLine() {
        if (!ctx || !canvas) return;
        const Y = canvas.height / 2;

        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath();
        ctx.moveTo(0, Y);
        ctx.lineTo(canvas.width, Y);
        ctx.stroke();
    }

    function drawCenteredText(text, x, y, color="#ddd") {
        ctx.fillStyle = color;
        ctx.font = "13px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y);
    }

    // =============================================================
    // Utility
    // =============================================================
    function determineMidPrice() {
        if (depthMap.size === 0) return 0;
        let bids = [], asks = [];

        for (let d of depthMap.values()) {
            if (d.bid > 0) bids.push(d.price);
            if (d.ask > 0) asks.push(d.price);
        }

        if (!bids.length && !asks.length) return 0;

        const bestBid = bids.length ? Math.max(...bids) : null;
        const bestAsk = asks.length ? Math.min(...asks) : null;

        if (bestBid !== null && bestAsk !== null) {
            return roundPrice((bestBid + bestAsk) / 2);
        }
        return bestBid || bestAsk || 0;
    }

    function formatPrice(p) {
        return p.toFixed(cfg.priceDecimals);
    }

    function roundPrice(p) {
        return parseFloat(p.toFixed(cfg.priceDecimals));
    }

    function priceStep() {
        // Guess from map or default to 0.5
        if (depthMap.size > 1) {
            const arr = Array.from(depthMap.values());
            if (arr.length >= 2) {
                return Math.abs(arr[1].price - arr[0].price) || 0.5;
            }
        }
        return 0.5;
    }

    // =============================================================
    // EXPORT
    // =============================================================
    return {
        init,
        resetView,
        onDepth,
        onTick
    };

})();
