/* =====================================================================
   FloMatrix — ChartCore v5 (robust)
   FULL FILE — NO PARTIALS
   - Uses a container div (e.g. "chart-root")
   - Finds or creates an internal <canvas>
   - Integrates with fmCandles (chart-candles.js)
   ===================================================================== */

window.chartCore = (function () {
    let container, canvas, ctx;
    let devicePixelRatio = window.devicePixelRatio || 1;

    let candles = [];
    let options = {
        theme: "neon",
        autoResize: true,
        background: "#05060a",
        gridColor: "rgba(255,255,255,0.05)",
        animations: true,
    };

    /* -------------------------------------------------------------
       INIT
       ------------------------------------------------------------- */
    function init(rootId, userOptions = {}) {
        console.log("%c[FM ChartCore] INIT", "color:#0ff", "rootId =", rootId);

        Object.assign(options, userOptions);

        container = document.getElementById(rootId);
        if (!container) {
            console.error("[FM ChartCore] ERROR: Container not found:", rootId);
            return;
        }

        // Try to find an existing <canvas> inside the container
        let existingCanvas = container.querySelector("canvas");

        // If there is no canvas, CREATE ONE
        if (!existingCanvas) {
            console.warn(
                "[FM ChartCore] No <canvas> found inside container. Creating one automatically."
            );
            existingCanvas = document.createElement("canvas");
            existingCanvas.id = "chart-canvas";
            existingCanvas.style.width = "100%";
            existingCanvas.style.height = "100%";
            existingCanvas.style.display = "block";
            container.appendChild(existingCanvas);
        }

        canvas = existingCanvas;

        if (!(canvas instanceof HTMLCanvasElement)) {
            console.error(
                "[FM ChartCore] ERROR: Resolved element is not a <canvas>. Cannot initialize chart."
            );
            return;
        }

        ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error("[FM ChartCore] ERROR: 2D context not available on canvas.");
            return;
        }

        resizeCanvas();

        if (options.autoResize) {
            window.addEventListener("resize", resizeCanvas);
        }

        // Attach PRO candle engine if present
        if (window.fmCandles) {
            console.log("[FM ChartCore] Attaching fmCandles to canvas.");
            fmCandles.init(canvas, {
                bullColor: "#00ff88",
                bearColor: "#ff3366",
                glow: true,
                neon: true,
                shadows: true,
                bodyWidth: 9,
                wickWidth: 2,
            });
        } else {
            console.warn("[FM ChartCore] fmCandles not found — custom candles disabled.");
        }

        drawBackground();
        console.log("%c[FM ChartCore] READY", "color:#0f0");
    }

    /* -------------------------------------------------------------
       RESIZE
       ------------------------------------------------------------- */
    function resizeCanvas() {
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * devicePixelRatio;
        canvas.height = rect.height * devicePixelRatio;

        // Reset transform then scale for HiDPI
        if (typeof ctx.setTransform === "function") {
            ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        } else {
            ctx.scale(devicePixelRatio, devicePixelRatio);
        }

        drawBackground();
        redrawCandles();
    }

    /* -------------------------------------------------------------
       BACKGROUND + GRID
       ------------------------------------------------------------- */
    function drawBackground() {
        if (!ctx || !canvas) return;

        const w = canvas.width / devicePixelRatio;
        const h = canvas.height / devicePixelRatio;

        ctx.fillStyle = options.background;
        ctx.fillRect(0, 0, w, h);

        drawGrid(w, h);
    }

    function drawGrid(w, h) {
        const gridColor = options.gridColor;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;

        const step = 80; // px

        for (let x = 0; x < w; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        for (let y = 0; y < h; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }

    /* -------------------------------------------------------------
       SET + UPDATE DATA (CALLED BY TERMINAL / DATAFEED)
       ------------------------------------------------------------- */
    function setSeriesData(data) {
        candles = data || [];
        console.log("[FM ChartCore] setSeriesData:", candles.length, "candles");

        if (window.fmCandles) {
            fmCandles.setData(candles);
        }

        redrawCandles();
    }

    function updateCandle(c) {
        candles.push(c);

        if (window.fmCandles) {
            fmCandles.update(c);
        }

        redrawCandles();
    }

    /* -------------------------------------------------------------
       REDRAW
       ------------------------------------------------------------- */
    function redrawCandles() {
        drawBackground();

        if (window.fmCandles) {
            fmCandles.setData(candles);
        }
    }

    /* -------------------------------------------------------------
       PUBLIC API
       ------------------------------------------------------------- */
    return {
        init,
        setSeriesData,
        updateCandle,
    };
})();
