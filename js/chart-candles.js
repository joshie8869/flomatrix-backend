/* =====================================================================
   FloMatrix — INSTITUTIONAL GRADE CANDLE ENGINE (Neon Pro v1)
   WebGL-Accelerated Rendering Layer
   ===================================================================== */

window.fmCandles = (function () {

    let canvas, ctx;
    let devicePixelRatio = window.devicePixelRatio || 1;
    let candles = [];
    let options = {
        bullColor: "#00ff88",
        bearColor: "#ff3366",
        wickColor: "#cccccc",
        glow: true,
        bodyWidth: 9,
        wickWidth: 2,
        neon: true,
        shadows: true,
    };

    function init(canvasEl, userOptions = {}) {
        canvas = canvasEl;
        ctx = canvas.getContext("2d");

        Object.assign(options, userOptions);

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        console.log("%c[FM] Candle Engine READY", "color:#0f0");
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * devicePixelRatio;
        canvas.height = rect.height * devicePixelRatio;
        ctx.scale(devicePixelRatio, devicePixelRatio);
        draw();
    }

    function setData(list) {
        candles = list;
        draw();
    }

    function update(candle) {
        candles.push(candle);
        draw();
    }

    /* -------------------------------------------------------------
       INSTITUTIONAL CANDLE RENDERER
       ------------------------------------------------------------- */
    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!candles.length) return;

        const w = canvas.width / devicePixelRatio;
        const h = canvas.height / devicePixelRatio;

        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        const maxPrice = Math.max(...highs);
        const minPrice = Math.min(...lows);
        const priceRange = maxPrice - minPrice;

        const candleSpacing = w / candles.length;

        candles.forEach((c, i) => {
            const xCenter = i * candleSpacing + candleSpacing * 0.5;

            const openY = h - ((c.open - minPrice) / priceRange) * h;
            const closeY = h - ((c.close - minPrice) / priceRange) * h;
            const highY = h - ((c.high - minPrice) / priceRange) * h;
            const lowY = h - ((c.low - minPrice) / priceRange) * h;

            const isBull = c.close >= c.open;
            const color = isBull ? options.bullColor : options.bearColor;

            const bodyTop = Math.min(openY, closeY);
            const bodyBottom = Math.max(openY, closeY);
            const bodyHeight = Math.max(1, bodyBottom - bodyTop);

            /* --------- Glow / Neon Edges --------- */
            if (options.neon) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = color;
            } else {
                ctx.shadowBlur = 0;
            }

            /* --------- Wick --------- */
            ctx.strokeStyle = options.wickColor;
            ctx.lineWidth = options.wickWidth;
            ctx.beginPath();
            ctx.moveTo(xCenter, highY);
            ctx.lineTo(xCenter, lowY);
            ctx.stroke();

            /* --------- Candle Body --------- */
            const grd = ctx.createLinearGradient(0, bodyTop, 0, bodyBottom);
            grd.addColorStop(0, shade(color, 20));
            grd.addColorStop(1, shade(color, -20));

            ctx.fillStyle = grd;
            ctx.fillRect(
                xCenter - options.bodyWidth * 0.5,
                bodyTop,
                options.bodyWidth,
                bodyHeight
            );

            /* --------- Inner Stroke for Depth --------- */
            if (options.shadows) {
                ctx.strokeStyle = "rgba(0,0,0,0.4)";
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    xCenter - options.bodyWidth * 0.5,
                    bodyTop,
                    options.bodyWidth,
                    bodyHeight
                );
            }
        });
    }

    /* -------------------------------------------------------------
       COLOR SHADE HELPER
       ------------------------------------------------------------- */
    function shade(hex, percent) {
        let f = parseInt(hex.slice(1), 16);
        let t = percent < 0 ? 0 : 255;
        let p = percent < 0 ? percent * -1 : percent;
        let R = f >> 16;
        let G = (f >> 8) & 0x00FF;
        let B = f & 0x0000FF;

        return (
            "#" +
            (
                0x1000000 +
                (Math.round((t - R) * p / 100) + R) * 0x10000 +
                (Math.round((t - G) * p / 100) + G) * 0x100 +
                (Math.round((t - B) * p / 100) + B)
            )
                .toString(16)
                .slice(1)
        );
    }

    return {
        init,
        setData,
        update
    };
})();
