/* =====================================================================
   FloMatrix Terminal — LIQUIDITY HEATMAP ENGINE
   ---------------------------------------------------------------------
   A full rolling heatmap similar to Bookmap/ExoCharts.
   Tracks resting liquidity over time, with persistence and decay.

   Canvas: heatmap-canvas
   Inputs: onDepth(depth), onTick(tick)
   Output: waterfall heatmap showing liquidity walls.
   ===================================================================== */

window.heatmap = (function () {

    // ===========================================================
    // Internal State
    // ===========================================================
    let canvas = null;
    let ctx = null;

    // Global min/max price to scale vertically
    let pMin = null;
    let pMax = null;

    // Heat grid: each column = snapshot of depth at a moment in time
    // heat[x][priceLevelString] = accumulatedIntensity
    let heat = [];

    // Price bucket granularity — can be dynamic later
    let priceStep = 0.5;

    // How many vertical slices to show (scroll window)
    const MAX_COLUMNS = 600;

    // Liquidity heat accumulation tuning
    const cfg = {
        decay: 0.97,       // decay heat each frame
        addFactor: 0.15,   // how much to add per depth update
        fadeOut: 0.92,     // slow fade outside visible region
        heatMaxScale: 1000, // scale denominator for heat intensity
        font: "10px Inter",
        minCell: 2,
        bg: "rgba(0,0,0,0.05)"
    };

    // ===========================================================
    // API: init()
    // ===========================================================
    function init(canvasId) {
        canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error("heatmap: canvas not found:", canvasId);
            return;
        }
        ctx = canvas.getContext("2d");

        resize();
        window.addEventListener("resize", resize);

        console.log("heatmap: initialized");
    }

    // ===========================================================
    // API: reset()
    // ===========================================================
    function reset() {
        heat = [];
        pMin = null;
        pMax = null;
        clear();
    }

    // ===========================================================
    // API: onDepth(depth)
    // ===========================================================
    function onDepth(depth) {
        if (!depth || !depth.bids || !depth.asks) return;

        // Expand price boundaries
        for (let b of depth.bids) expandPriceRange(b.price);
        for (let a of depth.asks) expandPriceRange(a.price);

        if (pMin === null || pMax === null || pMax <= pMin) return;

        // Build a fresh depth snapshot for this frame
        const snapshot = new Map();

        // Insert bids
        for (let b of depth.bids) {
            const p = bucket(b.price);
            snapshot.set(p, (snapshot.get(p) || 0) + b.size);
        }

        // Insert asks
        for (let a of depth.asks) {
            const p = bucket(a.price);
            snapshot.set(p, (snapshot.get(p) || 0) + a.size);
        }

        // Add new column to heatmap (scroll left)
        if (heat.length >= MAX_COLUMNS) heat.shift();
        heat.push(snapshot);

        // Update heat accumulation
        accumulateHeat();

        redraw();
    }

    // Optional tick handler (not required)
    function onTick(t) {
        // Could add tick-based effects here (last trade marker)
    }

    // ===========================================================
    // Expand global price tracking
    // ===========================================================
    function expandPriceRange(price) {
        if (pMin === null || price < pMin) pMin = price;
        if (pMax === null || price > pMax) pMax = price;
    }

    // ===========================================================
    // Bucket price to nearest step
    // ===========================================================
    function bucket(price) {
        return parseFloat((Math.round(price / priceStep) * priceStep).toFixed(3));
    }

    // ===========================================================
    // Accumulate persistent heat (Bookmap-style)
    // ===========================================================
    function accumulateHeat() {
        if (heat.length === 0) return;

        const lastSnapshot = heat[heat.length - 1];

        // Loop all existing columns
        for (let c = 0; c < heat.length; c++) {
            const col = heat[c];

            // Decay previous values
            for (let [p, val] of col.entries()) {
                const decayed = val * cfg.decay;
                if (decayed < 0.01) col.delete(p);
                else col.set(p, decayed);
            }
        }

        // Add new depth data into last column
        for (let [p, size] of lastSnapshot.entries()) {
            const v = (lastSnapshot.get(p) || 0) + (size / cfg.heatMaxScale) * cfg.addFactor;
            lastSnapshot.set(p, v);
        }
    }

    // ===========================================================
    // Rendering
    // ===========================================================
    function redraw() {
        if (!ctx || !canvas) return;

        clear();

        if (heat.length === 0 || pMin === null || pMax === null) {
            drawText("Waiting for liquidity…", canvas.width / 2, canvas.height / 2);
            return;
        }

        const W = canvas.width;
        const H = canvas.height;

        const priceRange = pMax - pMin || 1;
        const pixelsPerPrice = (H - 4) / priceRange;

        const colWidth = Math.max(1, W / MAX_COLUMNS);

        // Loop columns left→right
        for (let c = 0; c < heat.length; c++) {
            const x = W - ((heat.length - c) * colWidth);

            const col = heat[c];
            if (!col) continue;

            for (let [price, intensity] of col.entries()) {
                const y = (pMax - price) * pixelsPerPrice;
                const h = priceStep * pixelsPerPrice;

                if (h < cfg.minCell) continue;

                // Convert intensity to heat color
                ctx.fillStyle = colorForHeat(intensity);
                ctx.fillRect(x, y, colWidth, h);
            }
        }

        drawAxis();
    }

    // ===========================================================
    // Color mapping (heat scale)
    // ===========================================================
    function colorForHeat(v) {
        // v = 0..1 approx
        let i = Math.min(1, v * 10); 

        // Bookmap-like palette:
        const r = Math.floor(255 * i);
        const g = Math.floor(150 * (1 - i));
        const b = 40;

        return `rgba(${r},${g},${b},${0.6})`;
    }

    // ===========================================================
    // UI helpers
    // ===========================================================
    function clear() {
        ctx.fillStyle = cfg.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawAxis() {
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, canvas.height);
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = cfg.font;
        ctx.fillText("Liquidity Heatmap", 6, 4);
    }

    function drawText(txt, x, y) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = cfg.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(txt, x, y);
    }

    // ===========================================================
    // Resize
    // ===========================================================
    function resize() {
        if (!canvas) return;
        canvas.width = canvas.clientWidth || canvas.offsetWidth || 300;
        canvas.height = canvas.clientHeight || canvas.offsetHeight || 300;
        redraw();
    }

    // ===========================================================
    // EXPORT
    // ===========================================================
    return {
        init,
        reset,
        onDepth,
        onTick
    };

})();
