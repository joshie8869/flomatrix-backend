/* =====================================================================
   FloMatrix Terminal — Footprints & Cluster Engine
   ---------------------------------------------------------------------
   Responsibilities:
     • Aggregate ticks into per-candle + per-price-level cells
     • Track bidVol / askVol / delta per level
     • Render numerical footprints (bid x ask) on footprint canvas
     • Render cluster-style heat blocks on cluster canvas
     • Support modes: "footprint", "cluster", (others hookable later)
   ===================================================================== */

window.footprints = (function () {

    // =================================================================
    // Internal state
    // =================================================================
    let fpCanvas = null;
    let fpCtx = null;
    let clCanvas = null;
    let clCtx = null;

    let mode = "footprint"; // or "cluster"

    // Each bar: {
    //   time: <sec>,
    //   priceMin, priceMax,
    //   levels: Map(priceLevelStr -> { bidVol, askVol, delta, total })
    // }
    let bars = [];

    // Current bar index by time bucket
    let currentBar = null;

    // Price range for all bars (for scaling)
    let globalPriceMin = null;
    let globalPriceMax = null;

    // Basic style config
    const cfg = {
        fontFamily: "Inter, system-ui, sans-serif",
        baseFontSize: 10,
        minCellHeightForText: 10,
        minCellWidthForText: 26,
        paddingTop: 8,
        paddingBottom: 6,
        paddingLeft: 6,
        paddingRight: 6,
        bucketTickSize: 0.5 // price step (approx) for grouping – will autoscale
    };

    // =================================================================
    // INIT
    // =================================================================
    function init(footprintCanvasId, clusterCanvasId) {
        fpCanvas = document.getElementById(footprintCanvasId);
        clCanvas = document.getElementById(clusterCanvasId);

        if (fpCanvas) {
            fpCtx = fpCanvas.getContext("2d");
        }
        if (clCanvas) {
            clCtx = clCanvas.getContext("2d");
        }

        handleResize();
        window.addEventListener("resize", handleResize);

        console.log("footprints: initialized");
    }

    function handleResize() {
        if (fpCanvas) {
            fpCanvas.width = fpCanvas.clientWidth || fpCanvas.offsetWidth || 400;
            fpCanvas.height = fpCanvas.clientHeight || fpCanvas.offsetHeight || 300;
        }
        if (clCanvas) {
            clCanvas.width = clCanvas.clientWidth || clCanvas.offsetWidth || 400;
            clCanvas.height = clCanvas.clientHeight || clCanvas.offsetHeight || 300;
        }
        redraw();
    }

    // =================================================================
    // PUBLIC API
    // =================================================================
    function setMode(newMode) {
        mode = newMode;
        redraw();
    }

    function reset() {
        bars = [];
        currentBar = null;
        globalPriceMin = null;
        globalPriceMax = null;
        clearCanvas(fpCtx, fpCanvas);
        clearCanvas(clCtx, clCanvas);
    }

    function onTick(tick) {
        if (!tick || typeof tick.price !== "number" || typeof tick.ts !== "number") {
            return;
        }

        const tsSec = Math.floor(tick.ts / 1000);
        const price = tick.price;
        const side = tick.side || "buy";
        const size = tick.size || 0;

        // Find or create bar for this time bucket
        const bar = getOrCreateBar(tsSec, price);

        // Determine price level bucket
        const levelKey = getPriceBucket(price, cfg.bucketTickSize);
        let level = bar.levels.get(levelKey);
        if (!level) {
            level = {
                price: parseFloat(levelKey),
                bidVol: 0,
                askVol: 0,
                delta: 0,
                total: 0
            };
            bar.levels.set(levelKey, level);
        }

        if (side === "sell") {
            level.bidVol += size;
            level.delta -= size;
        } else {
            level.askVol += size;
            level.delta += size;
        }
        level.total += size;

        // Update bar price extremes
        if (bar.priceMin === null || price < bar.priceMin) bar.priceMin = price;
        if (bar.priceMax === null || price > bar.priceMax) bar.priceMax = price;

        // Expand global price range
        if (globalPriceMin === null || price < globalPriceMin) globalPriceMin = price;
        if (globalPriceMax === null || price > globalPriceMax) globalPriceMax = price;

        // Redraw on tick (lightweight)
        redraw();
    }

    // Optional: candle input from provider (helps define bar anchors)
    function onCandle(candle) {
        if (!candle || typeof candle.c !== "number") return;

        const tSec = candle.time || Math.floor(candle.t / 1000) || Math.floor(Date.now()/1000);

        // ensure there's at least a bar stub for this candle
        const price = candle.c;
        getOrCreateBar(tSec, price);

        // widen global range
        if (globalPriceMin === null || candle.low < globalPriceMin) {
            globalPriceMin = candle.low;
        }
        if (globalPriceMax === null || candle.high > globalPriceMax) {
        globalPriceMax = candle.high;
        }

        redraw();
    }

    // =================================================================
    // INTERNAL — BAR MANAGEMENT
    // =================================================================
    function getOrCreateBar(tsSec, price) {
        const ivSec = getIntervalSeconds();
        const bucketStart = Math.floor(tsSec / ivSec) * ivSec;

        if (!currentBar || currentBar.time !== bucketStart) {
            // see if an existing bar with that time
            let found = bars.find(b => b.time === bucketStart);
            if (!found) {
                found = {
                    time: bucketStart,
                    priceMin: price,
                    priceMax: price,
                    levels: new Map()
                };
                bars.push(found);
                // Keep bars sorted by time
                bars.sort((a, b) => a.time - b.time);
            }
            currentBar = found;
        }

        return currentBar;
    }

    function getIntervalSeconds() {
        const iv = (window.currentInterval || "15m").toLowerCase();
        if (iv.endsWith("m")) {
            const m = parseInt(iv, 10);
            return m * 60;
        }
        if (iv.endsWith("h")) {
            const h = parseInt(iv, 10);
            return h * 3600;
        }
        return 60;
    }

    function getPriceBucket(price, step) {
        if (!step || step <= 0) step = 0.5;
        const bucket = Math.round(price / step) * step;
        return bucket.toFixed(decimalsForStep(step));
    }

    function decimalsForStep(step) {
        const s = step.toString();
        if (s.indexOf(".") === -1) return 0;
        return s.length - s.indexOf(".") - 1;
    }

    // =================================================================
    // RENDERING
    // =================================================================
    function redraw() {
        if (!bars.length) {
            clearCanvas(fpCtx, fpCanvas, true);
            clearCanvas(clCtx, clCanvas, true);
            return;
        }

        if (!fpCtx || !clCtx || !fpCanvas || !clCanvas) return;

        // Determine global price range
        let pMin = globalPriceMin;
        let pMax = globalPriceMax;
        if (pMin === null || pMax === null || pMax <= pMin) {
            pMin = pMin || 0;
            pMax = pMax || pMin + 1;
        }

        drawFootprint(bars, fpCtx, fpCanvas, pMin, pMax);
        drawClusters(bars, clCtx, clCanvas, pMin, pMax);
    }

    function clearCanvas(ctx, canvas, drawText) {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (drawText) {
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            ctx.font = "10px " + cfg.fontFamily;
            ctx.fillText("Waiting for ticks…", 8, 16);
        }
    }

    // === FOOTPRINT RENDERING ==========================================
    function drawFootprint(barsArr, ctx, canvas, pMin, pMax) {
        clearCanvas(ctx, canvas);

        const W = canvas.width;
        const H = canvas.height;

        const colCount = barsArr.length;
        const colWidth = Math.max(32, (W - cfg.paddingLeft - cfg.paddingRight) / colCount);

        const usableHeight = H - cfg.paddingTop - cfg.paddingBottom;

        // find max total volume for color scaling
        let maxTotal = 0;
        for (let b of barsArr) {
            for (let level of b.levels.values()) {
                if (level.total > maxTotal) maxTotal = level.total;
            }
        }
        if (maxTotal <= 0) maxTotal = 1;

        // fonts
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = cfg.baseFontSize + "px " + cfg.fontFamily;

        // Loop bars as columns
        barsArr.forEach((bar, barIndex) => {
            const colX = cfg.paddingLeft + barIndex * colWidth;
            const colCenter = colX + colWidth / 2;

            // price sorted descending (top = high)
            const levels = Array.from(bar.levels.values()).sort((a, b) => b.price - a.price);

            const priceSpan = pMax - pMin || 1;
            const pixelsPerPrice = usableHeight / priceSpan;

            // each cell's vertical mapping from price
            for (let lvl of levels) {
                const price = lvl.price;
                const yTop = cfg.paddingTop + (pMax - price) * pixelsPerPrice;
                const yBottom = yTop + cfg.bucketTickSize * pixelsPerPrice;
                const cellHeight = yBottom - yTop;

                if (cellHeight <= 1) continue; // too thin to draw

                // color scale based on delta
                const intensity = Math.min(1, Math.abs(lvl.delta) / maxTotal);
                const alpha = 0.15 + 0.6 * intensity;

                // background
                if (lvl.delta > 0) {
                    ctx.fillStyle = `rgba(65,255,122,${alpha})`;
                } else if (lvl.delta < 0) {
                    ctx.fillStyle = `rgba(255,77,106,${alpha})`;
                } else {
                    ctx.fillStyle = `rgba(155,155,155,0.10)`;
                }

                const pad = 1;
                ctx.fillRect(
                    colX + pad,
                    yTop + pad,
                    colWidth - 2 * pad,
                    cellHeight - 2 * pad
                );

                // draw border only when enough area
                if (colWidth > 30 && cellHeight > 9) {
                    ctx.strokeStyle = "rgba(0,0,0,0.45)";
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(
                        colX + pad,
                        yTop + pad,
                        colWidth - 2 * pad,
                        cellHeight - 2 * pad
                    );
                }

                // text rendering (bid x ask)
                if (colWidth >= cfg.minCellWidthForText && cellHeight >= cfg.minCellHeightForText) {
                    const textY = (yTop + yBottom) / 2;

                    const bidStr = lvl.bidVol > 0 ? lvl.bidVol.toFixed(0) : "";
                    const askStr = lvl.askVol > 0 ? lvl.askVol.toFixed(0) : "";

                    ctx.fillStyle = "rgba(0,0,0,0.75)";
                    ctx.fillText(
                        `${bidStr}×${askStr}`,
                        colCenter,
                        textY
                    );
                }
            }
        });

        // optional overlay text
        ctx.fillStyle = "rgba(255,255,255,0.20)";
        ctx.font = "9px " + cfg.fontFamily;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText("Footprint (Bid × Ask, Delta Heat)", W - 6, H - 4);
    }

    // === CLUSTER RENDERING =============================================
    function drawClusters(barsArr, ctx, canvas, pMin, pMax) {
        clearCanvas(ctx, canvas);

        const W = canvas.width;
        const H = canvas.height;

        const colCount = barsArr.length;
        const colWidth = Math.max(22, (W - cfg.paddingLeft - cfg.paddingRight) / colCount);

        const usableHeight = H - cfg.paddingTop - cfg.paddingBottom;

        // cluster uses TOTAL volume as color intensity
        let maxTotal = 0;
        for (let b of barsArr) {
            for (let lvl of b.levels.values()) {
                if (lvl.total > maxTotal) maxTotal = lvl.total;
            }
        }
        if (maxTotal <= 0) maxTotal = 1;

        const priceSpan = pMax - pMin || 1;
        const pixelsPerPrice = usableHeight / priceSpan;

        // Bars as vertical bands with chunked rectangles
        barsArr.forEach((bar, barIndex) => {
            const colX = cfg.paddingLeft + barIndex * colWidth;

            const levels = Array.from(bar.levels.values()).sort((a, b) => b.price - a.price);

            for (let lvl of levels) {
                const price = lvl.price;
                const yTop = cfg.paddingTop + (pMax - price) * pixelsPerPrice;
                const yBottom = yTop + cfg.bucketTickSize * pixelsPerPrice;
                const cellHeight = yBottom - yTop;
                if (cellHeight <= 1) continue;

                const intensity = Math.min(1, lvl.total / maxTotal);
                const alpha = 0.08 + 0.85 * intensity;

                // Bi-color mix for net direction
                if (lvl.delta >= 0) {
                    ctx.fillStyle = `rgba(65,255,122,${alpha})`;
                } else {
                    ctx.fillStyle = `rgba(255,77,106,${alpha})`;
                }

                const pad = 0.5;
                ctx.fillRect(
                    colX + pad,
                    yTop + pad,
                    colWidth - 2 * pad,
                    cellHeight - 2 * pad
                );
            }
        });

        // label
        ctx.fillStyle = "rgba(255,255,255,0.20)";
        ctx.font = "9px " + cfg.fontFamily;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText("Cluster View (Volume Heat by Price Level)", W - 6, H - 4);
    }

    // =================================================================
    // EXPORT
    // =================================================================
    return {
        init,
        setMode,
        reset,
        onTick,
        onCandle
    };

})();

