/* =====================================================================
   FloMatrix Terminal — VOLUME PROFILE / DELTA / CVD ENGINE
   ---------------------------------------------------------------------
   Features:
     • Visible Range Volume Profile (VRVP)
     • Full Session Volume Profile
     • Delta Profile (bid - ask)
     • CVD line chart
     • POC calculation
     • VAH / VAL detection (70% default)
     • Heat shading by volume
     • Optimized canvas rendering
   ===================================================================== */

window.volProfile = (function () {

    // ===========================================================
    // Internal State
    // ===========================================================
    let canvas = null;
    let ctx = null;

    // Price bucket → { vol, bid, ask, delta }
    let session = new Map();
    let visible = new Map();

    // CVD tracking
    let cvdData = [];
    let cvd = 0;

    let pMin = null;
    let pMax = null;

    // Config
    const cfg = {
        bucketStep: 0.5,
        pocColor: "rgba(255,255,255,0.85)",
        vahValColor: "rgba(255,255,255,0.35)",

        volColor: "rgba(65,255,122,0.30)",
        deltaPosColor: "rgba(65,255,122,0.55)",
        deltaNegColor: "rgba(255,77,106,0.55)",

        cvdLineColor: "#41ff7a",
        cvdWidth: 1.6,

        font: "11px Inter",
        labelColor: "rgba(255,255,255,0.20)",

        bg: "rgba(0,0,0,0.05)"
    };

    // ===========================================================
    // INIT
    // ===========================================================
    function init(canvasId) {
        canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error("volumeprofile: canvas not found:", canvasId);
            return;
        }

        ctx = canvas.getContext("2d");

        resize();
        window.addEventListener("resize", resize);

        console.log("volumeprofile: initialized");
    }

    // ===========================================================
    // RESET
    // ===========================================================
    function reset() {
        session.clear();
        visible.clear();
        cvdData = [];
        cvd = 0;
        pMin = null;
        pMax = null;
        clear();
    }

    // ===========================================================
    // ON TICK
    // ===========================================================
    function onTick(tick) {
        if (!tick || typeof tick.price !== "number") return;

        const price = bucket(tick.price);
        const size = tick.size || 0;
        const side = tick.side || "buy";

        // Expand range
        expandRange(price);

        // Update session-level
        let sp = session.get(price);
        if (!sp) {
            sp = { vol: 0, bid: 0, ask: 0, delta: 0 };
            session.set(price, sp);
        }

        sp.vol += size;
        if (side === "sell") {
            sp.bid += size;
            sp.delta -= size;
        } else {
            sp.ask += size;
            sp.delta += size;
        }

        // Update CVD
        if (side === "sell") cvd -= size;
        else cvd += size;
        cvdData.push(cvd);
        if (cvdData.length > 2000) cvdData.shift();

        redraw();
    }

    // ===========================================================
    // ON CANDLE
    // ===========================================================
    function onCandle(c) {
        if (!c || typeof c.c !== "number") return;

        const low = c.low || c.l || c.o;
        const high = c.high || c.h || c.c;

        expandRange(low);
        expandRange(high);

        // Optionally distribute candle volume into buckets later
        redraw();
    }

    // ===========================================================
    // RANGE MANAGEMENT
    // ===========================================================
    function expandRange(price) {
        if (pMin === null || price < pMin) pMin = price;
        if (pMax === null || price > pMax) pMax = price;
    }

    function bucket(price) {
        return parseFloat((Math.round(price / cfg.bucketStep) * cfg.bucketStep).toFixed(3));
    }

    // ===========================================================
    // RENDER
    // ===========================================================
    function redraw() {
        if (!ctx || !canvas) return;
        clear();

        if (pMin === null || pMax === null || session.size === 0) {
            drawText("Volume Profile Loading…", canvas.width / 2, canvas.height / 2);
            return;
        }

        const W = canvas.width;
        const H = canvas.height;

        const priceRange = pMax - pMin || 1;
        const pixelsPerPrice = H / priceRange;

        // Determine maximum volume for scaling
        let maxVol = 0;
        for (let v of session.values()) {
            if (v.vol > maxVol) maxVol = v.vol;
        }
        if (maxVol <= 0) maxVol = 1;

        // Determine POC
        let pocPrice = null;
        let pocVol = 0;
        for (let [p, v] of session.entries()) {
            if (v.vol > pocVol) {
                pocPrice = p;
                pocVol = v.vol;
            }
        }

        // Draw Volume Profile Bars
        for (let [price, data] of session.entries()) {
            const y = (pMax - price) * pixelsPerPrice;
            const h = cfg.bucketStep * pixelsPerPrice;

            if (h < 1) continue;

            const w = (data.vol / maxVol) * (W * 0.3);

            ctx.fillStyle = cfg.volColor;
            ctx.fillRect(W - w - 5, y, w, h);

            // Draw delta overlay
            if (data.delta !== 0) {
                ctx.fillStyle = data.delta > 0 ? cfg.deltaPosColor : cfg.deltaNegColor;
                ctx.fillRect(W - w - 5, y, w * (Math.abs(data.delta) / data.vol), h);
            }
        }

        // Draw POC line
        if (pocPrice !== null) {
            const yP = (pMax - pocPrice) * pixelsPerPrice;
            ctx.strokeStyle = cfg.pocColor;
            ctx.lineWidth = 1.4;

            ctx.beginPath();
            ctx.moveTo(W - 5, yP + 1);
            ctx.lineTo(W * 0.7, yP + 1);
            ctx.stroke();

            ctx.fillStyle = cfg.pocColor;
            ctx.font = cfg.font;
            ctx.fillText("POC " + pocPrice.toFixed(2), W * 0.7 - 4, yP - 2);
        }

        // Value Area (70%)
        drawValueArea(W, H, pixelsPerPrice);

        // Draw CVD line
        drawCVD(W, H);
    }

    // ===========================================================
    // VALUE AREA (VAH / VAL)
    // ===========================================================
    function drawValueArea(W, H, pixelsPerPrice) {
        // Sort session volume buckets by volume descending
        const arr = Array.from(session.entries())
            .map(([p, v]) => ({ price: p, vol: v.vol }))
            .sort((a, b) => b.vol - a.vol);

        const totalVol = arr.reduce((s, a) => s + a.vol, 0);
        const target = totalVol * 0.70;

        let cum = 0;
        let vah = null;
        let val = null;

        for (let i = 0; i < arr.length; i++) {
            cum += arr[i].vol;
            if (cum >= target && vah === null) {
                vah = arr[i].price;
                break;
            }
        }

        // Determine VAL as symmetric around POC
        cum = 0;
        for (let i = arr.length - 1; i >= 0; i--) {
            cum += arr[i].vol;
            if (cum >= target && val === null) {
                val = arr[i].price;
                break;
            }
        }

        // Draw lines
        if (vah !== null) {
            const yVAH = (pMax - vah) * pixelsPerPrice;
            ctx.strokeStyle = cfg.vahValColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(W - 5, yVAH);
            ctx.lineTo(W * 0.7, yVAH);
            ctx.stroke();
            ctx.fillText("VAH", W * 0.7 - 4, yVAH - 2);
        }

        if (val !== null) {
            const yVAL = (pMax - val) * pixelsPerPrice;
            ctx.strokeStyle = cfg.vahValColor;
            ctx.beginPath();
            ctx.moveTo(W - 5, yVAL);
            ctx.lineTo(W * 0.7, yVAL);
            ctx.stroke();
            ctx.fillText("VAL", W * 0.7 - 4, yVAL - 2);
        }
    }

    // ===========================================================
    // CVD RENDERING
    // ===========================================================
    function drawCVD(W, H) {
        if (cvdData.length < 5) return;

        ctx.strokeStyle = cfg.cvdLineColor;
        ctx.lineWidth = cfg.cvdWidth;

        const max = Math.max(...cvdData);
        const min = Math.min(...cvdData);
        const span = max - min || 1;

        ctx.beginPath();

        for (let i = 0; i < cvdData.length; i++) {
            const x = (i / (cvdData.length - 1)) * (W * 0.65);
            const y = H - ((cvdData[i] - min) / span) * (H * 0.25) - 4;

            if (i === 0) ctx.moveTo(x + 4, y);
            else ctx.lineTo(x + 4, y);
        }

        ctx.stroke();

        ctx.fillStyle = cfg.labelColor;
        ctx.font = cfg.font;
        ctx.fillText("CVD", 10, 10);
    }

    // ===========================================================
    // UTIL
    // ===========================================================
    function drawText(txt, x, y) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = cfg.font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(txt, x, y);
    }

    function clear() {
        ctx.fillStyle = cfg.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // ===========================================================
    // RESIZE
    // ===========================================================
    function resize() {
        if (!canvas) return;
        canvas.width = canvas.clientWidth || canvas.offsetWidth || 350;
        canvas.height = canvas.clientHeight || canvas.offsetHeight || 260;
        redraw();
    }

    // ===========================================================
    // EXPORT
    // ===========================================================
    return {
        init,
        reset,
        onTick,
        onCandle
    };

})();
