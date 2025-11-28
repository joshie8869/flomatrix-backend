/* =====================================================================
   FloMatrix — INDICATOR ENGINE v2
   ---------------------------------------------------------------------
   Responsibilities:
     • Maintain a clean history of raw candles
     • Compute:
         - EMA 20 (fast)
         - EMA 50 (slow)
         - VWAP
         - Volume histogram
         - Delta (for future footprint/cluster use)
     • Render overlays on the main chart from chart-core.js
     • Provide a simple public API so UI / toolbar can toggle things later.

   Public API (used by terminal / toolbar / future UI):
     indicators.init()
     indicators.bindChart(chart)          // called by chart-core.js
     indicators.onCandle(candle)          // called by terminal.js on each tick
     indicators.setEnabled(config)        // enable/disable overlays
     indicators.getLastDelta()            // for stats / UI
   ===================================================================== */

window.indicators = (function () {
    let chart = null;

    // Series handlers
    let emaFastSeries = null;
    let emaSlowSeries = null;
    let vwapSeries = null;
    let volumeSeries = null;

    // Internal candle history (raw feed)
    /** @type {{time:number|any, open:number, high:number, low:number, close:number, volume:number, buyVolume?:number, sellVolume?:number}[]} */
    const candles = [];

    // Configuration
    const EMA_FAST_LEN = 20;
    const EMA_SLOW_LEN = 50;

    // Enabled flags (can be wired to UI later)
    const enabled = {
        emaFast: true,
        emaSlow: true,
        vwap: true,
        volume: true,
    };

    // Last computed delta (buy - sell volume)
    let lastDelta = 0;

    // ------------------------------------------------------------
    // INIT (called once from terminal.js)
    // ------------------------------------------------------------
    function init() {
        console.log("Indicators: initialized (v2)");
        // nothing else required here; chart will be attached via bindChart
    }

    // ------------------------------------------------------------
    // BIND CHART (called when chart is created in chart-core.js)
    // ------------------------------------------------------------
    function bindChart(ch) {
        chart = ch;
        if (!chart) {
            console.warn("indicators.bindChart: chart is null");
            return;
        }

        // Clean existing series if re-binding
        if (emaFastSeries) chart.removeSeries(emaFastSeries);
        if (emaSlowSeries) chart.removeSeries(emaSlowSeries);
        if (vwapSeries) chart.removeSeries(vwapSeries);
        if (volumeSeries) chart.removeSeries(volumeSeries);

        // Create series based on what's enabled
        if (enabled.emaFast) {
            emaFastSeries = chart.addLineSeries({
                color: "#00ffc3",
                lineWidth: 2,
            });
        }

        if (enabled.emaSlow) {
            emaSlowSeries = chart.addLineSeries({
                color: "#4ea3ff",
                lineWidth: 2,
            });
        }

        if (enabled.vwap) {
            vwapSeries = chart.addLineSeries({
                color: "#ffd15c",
                lineWidth: 2,
            });
        }

        if (enabled.volume) {
            volumeSeries = chart.addHistogramSeries({
                priceFormat: {
                    type: "volume",
                },
                priceScaleId: "",
                upColor: "rgba(0, 255, 150, 0.6)",
                downColor: "rgba(255, 70, 120, 0.6)",
            });
        }

        // If we already have history (page reconnect), backfill
        if (candles.length > 0) {
            recalcAndRenderAll();
        }
    }

    // ------------------------------------------------------------
    // SET ENABLED CONFIG (can be tied to UI buttons later)
    // ------------------------------------------------------------
    function setEnabled(config) {
        if (!config || typeof config !== "object") return;

        if (typeof config.emaFast === "boolean") enabled.emaFast = config.emaFast;
        if (typeof config.emaSlow === "boolean") enabled.emaSlow = config.emaSlow;
        if (typeof config.vwap === "boolean") enabled.vwap = config.vwap;
        if (typeof config.volume === "boolean") enabled.volume = config.volume;

        // Re-bind to rebuild series as per new config
        if (chart) {
            bindChart(chart);
        }
    }

    // ------------------------------------------------------------
    // ON CANDLE (called from terminal.js on every new/updated candle)
    // candle: { time, open, high, low, close, volume, buyVolume?, sellVolume? }
    // ------------------------------------------------------------
    function onCandle(candle) {
        if (!candle) return;

        // Simple append-or-update logic
        const last = candles[candles.length - 1];
        if (last && last.time === candle.time) {
            candles[candles.length - 1] = candle;
        } else {
            candles.push(candle);
        }

        // Bound history to keep memory sane
        if (candles.length > 3000) {
            candles.splice(0, candles.length - 3000);
        }

        // Compute delta for this candle (if buy/sell available)
        const buyVol = candle.buyVolume ?? 0;
        const sellVol = candle.sellVolume ?? 0;
        lastDelta = buyVol - sellVol;

        // Recalculate indicators and render them
        recalcAndRenderIncremental();
    }

    // ------------------------------------------------------------
    // FULL RECALC — used on (re)binding and when we have history
    // ------------------------------------------------------------
    function recalcAndRenderAll() {
        if (!chart) return;

        const emaFast = enabled.emaFast ? calcEMA(candles, EMA_FAST_LEN) : null;
        const emaSlow = enabled.emaSlow ? calcEMA(candles, EMA_SLOW_LEN) : null;
        const vwap = enabled.vwap ? calcVWAP(candles) : null;
        const volData = enabled.volume ? buildVolumeSeries(candles) : null;

        if (emaFastSeries && emaFast) emaFastSeries.setData(emaFast);
        if (emaSlowSeries && emaSlow) emaSlowSeries.setData(emaSlow);
        if (vwapSeries && vwap) vwapSeries.setData(vwap);
        if (volumeSeries && volData) volumeSeries.setData(volData);
    }

    // ------------------------------------------------------------
    // INCREMENTAL RECALC — re-uses candle array and recomputes
    // ------------------------------------------------------------
    function recalcAndRenderIncremental() {
        // For correctness, for now recalc from scratch.
        // We can micro-optimize later if needed.
        recalcAndRenderAll();
    }

    // ------------------------------------------------------------
    // VOLUME SERIES BUILDER
    // ------------------------------------------------------------
    function buildVolumeSeries(candleArr) {
        const out = [];
        for (let i = 0; i < candleArr.length; i++) {
            const c = candleArr[i];
            const prev = candleArr[i - 1];
            const isUp = !prev ? c.close >= c.open : c.close >= prev.close;

            out.push({
                time: c.time,
                value: c.volume != null ? c.volume : 0,
                color: isUp
                    ? "rgba(0, 255, 150, 0.6)"
                    : "rgba(255, 70, 120, 0.6)",
            });
        }
        return out;
    }

    // ------------------------------------------------------------
    // EMA CALCULATION
    // ------------------------------------------------------------
    function calcEMA(candleArr, length) {
        if (!Array.isArray(candleArr) || candleArr.length === 0 || length <= 1) {
            return [];
        }

        const k = 2 / (length + 1);
        const out = [];
        let emaPrev = candleArr[0].close;

        for (let i = 0; i < candleArr.length; i++) {
            const c = candleArr[i];
            if (i === 0) {
                emaPrev = c.close;
            } else {
                emaPrev = c.close * k + emaPrev * (1 - k);
            }

            if (i >= length - 1) {
                out.push({
                    time: c.time,
                    value: emaPrev,
                });
            }
        }

        return out;
    }

    // ------------------------------------------------------------
    // VWAP CALCULATION
    // ------------------------------------------------------------
    function calcVWAP(candleArr) {
        const out = [];
        let cumPV = 0;
        let cumVol = 0;

        for (let i = 0; i < candleArr.length; i++) {
            const c = candleArr[i];
            const vol = c.volume != null ? c.volume : 0;
            const typical = (c.high + c.low + c.close) / 3;

            cumPV += typical * vol;
            cumVol += vol;

            if (cumVol > 0) {
                out.push({
                    time: c.time,
                    value: cumPV / cumVol,
                });
            }
        }

        return out;
    }

    // ------------------------------------------------------------
    // PUBLIC: LAST DELTA VALUE
    // ------------------------------------------------------------
    function getLastDelta() {
        return lastDelta;
    }

    // ------------------------------------------------------------
    // EXPORT PUBLIC API
    // ------------------------------------------------------------
    return {
        init,
        bindChart,
        onCandle,
        setEnabled,
        getLastDelta,
    };
})();
