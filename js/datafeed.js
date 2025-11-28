/* =====================================================================
   FloMatrix — TERMINAL CONTROLLER v3
   Stable wiring for CONNECT / DISCONNECT
   Works with datafeed v2 + toolbar
   ===================================================================== */

(function () {
    console.log("%c[FM] Terminal Controller v3 loading…", "color:#0ff");

    // ------------------------------------------------------------
    // GLOBAL DOM REFS
    // ------------------------------------------------------------
    let elSymbolTop, elProviderTop, elIntervalTop;
    let elProviderSide, elIntervalSide, elSymbolSide;

    let elConnect, elDisconnect, elStatus;

    let elDomCanvas, elHeatmapCanvas, elVpCanvas, elFootprintCanvas;

    let elOrderPanel, elOrderQty, elOrderPrice, elOrderType, elOrderBuy, elOrderSell;

    const candles = [];
    let isInitialized = false;

    // ------------------------------------------------------------
    // TERMINAL INIT
    // ------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", () => {
        console.log("%c[FM] DOMContentLoaded — initTerminal()", "color:#0ff");
        initTerminal();
    });

    function initTerminal() {
        if (isInitialized) {
            console.log("[FM] initTerminal called again, skipping.");
            return;
        }
        isInitialized = true;

        console.log("%c[FM] Terminal init…", "color:#0f0");

        grabDomRefs();
        bootChart();
        bootSettings();
        bootIndicators();
        bootOrderEntry();
        bootDatafeed();
        wireUi();

        console.log("%c[FM] Terminal Ready.", "color:#0f0;font-weight:bold;");
    }

    // ------------------------------------------------------------
    // GRAB DOM REFERENCES
    // ------------------------------------------------------------
    function grabDomRefs() {
        console.log("[FM] grabDomRefs()");

        elSymbolTop = document.getElementById("symbol-input");
        elProviderTop = document.getElementById("provider-select");
        elIntervalTop = document.getElementById("interval-select");

        elProviderSide = document.getElementById("provider-select-side");
        elIntervalSide = document.getElementById("interval-select-side");
        elSymbolSide = document.getElementById("symbol-input-side");

        elConnect = document.getElementById("connect-btn");
        elDisconnect = document.getElementById("disconnect-btn");
        elStatus = document.getElementById("connection-status");

        elDomCanvas = document.getElementById("dom-canvas");
        elHeatmapCanvas = document.getElementById("heatmap-canvas");
        elVpCanvas = document.getElementById("vp-canvas");
        elFootprintCanvas = document.getElementById("footprint-canvas");

        elOrderPanel = document.getElementById("order-entry-panel");
        elOrderQty = document.getElementById("order-qty");
        elOrderPrice = document.getElementById("order-price");
        elOrderType = document.getElementById("order-type");
        elOrderBuy = document.getElementById("order-buy");
        elOrderSell = document.getElementById("order-sell");

        console.log("[FM] elConnect =", elConnect);
        console.log("[FM] elDisconnect =", elDisconnect);
    }

    // ------------------------------------------------------------
    // CHART BOOT
    // ------------------------------------------------------------
    function bootChart() {
        if (!window.chartCore || typeof chartCore.init !== "function") {
            console.warn("[FM] chartCore.init missing");
            return;
        }

        try {
            console.log("[FM] bootChart()");
            chartCore.init("chart-root", {
                autoResize: true,
                theme: (window.fmThemeEngine && fmThemeEngine.currentTheme) || "neon",
                showGrid: true,
                animations: true,
            });
        } catch (e) {
            console.error("[FM] chartCore.init failed:", e);
        }
    }

    // ------------------------------------------------------------
    // SETTINGS BOOT
    // ------------------------------------------------------------
    function bootSettings() {
        if (!window.fmSettings || typeof fmSettings.init !== "function") return;

        try {
            console.log("[FM] bootSettings()");
            fmSettings.init();
        } catch (e) {
            console.error("[FM] Settings error:", e);
        }
    }

    // ------------------------------------------------------------
    // INDICATORS BOOT
    // ------------------------------------------------------------
    function bootIndicators() {
        if (!window.indicators || typeof indicators.init !== "function") return;

        try {
            console.log("[FM] bootIndicators()");
            indicators.init({
                available: [
                    "Delta",
                    "VolumeFlow",
                    "CVD",
                    "Imbalance",
                    "VWAP",
                    "LiquidityZones",
                ],
                autoApply: ["Delta", "CVD"],
            });
        } catch (e) {
            console.error("[FM] Indicators failed:", e);
        }
    }

    // ------------------------------------------------------------
    // ORDER ENTRY
    // ------------------------------------------------------------
    function bootOrderEntry() {
        if (!window.orderEntry || typeof orderEntry.initPanel !== "function") return;

        try {
            console.log("[FM] bootOrderEntry()");
            orderEntry.initPanel({
                panelEl: elOrderPanel,
                qtyEl: elOrderQty,
                priceEl: elOrderPrice,
                typeEl: elOrderType,
            });

            if (elOrderBuy) elOrderBuy.addEventListener("click", () => orderEntry.submit("buy"));
            if (elOrderSell) elOrderSell.addEventListener("click", () => orderEntry.submit("sell"));
        } catch (e) {
            console.error("[FM] OrderEntry error:", e);
        }
    }

    // ------------------------------------------------------------
    // DATAFEED
    // ------------------------------------------------------------
    function bootDatafeed() {
        if (!window.datafeed || typeof datafeed.init !== "function") {
            console.warn("[FM] datafeed.init missing");
            return;
        }

        try {
            console.log("[FM] bootDatafeed()");
            datafeed.init({
                onCandle: handleCandle,
                onStatus: handleStatus,
                onError: handleError,
                onDepth: handleDepth,
            });
        } catch (e) {
            console.error("[FM] Datafeed error:", e);
        }
    }

    // ------------------------------------------------------------
    // UI WIRING
    // ------------------------------------------------------------
    function wireUi() {
        console.log("[FM] wireUi()");

        // CONNECT
        if (!elConnect) {
            console.error("[FM] CONNECT button not found (id='connect-btn')");
        } else {
            console.log("[FM] CONNECT button wired");
            elConnect.style.cursor = "pointer";
            elConnect.addEventListener("click", () => {
                console.log("[FM] CONNECT button CLICKED");

                const payload = {
                    provider: getProvider(),
                    symbol: getSymbol(),
                    interval: getInterval(),
                };

                console.log("[FM] Calling datafeed.connect with:", payload);

                if (window.datafeed && typeof datafeed.connect === "function") {
                    datafeed.connect(payload);
                } else {
                    console.warn("[FM] datafeed.connect missing");
                }
            });
        }

        // DISCONNECT
        if (!elDisconnect) {
            console.warn("[FM] DISCONNECT button not found (id='disconnect-btn')");
        } else {
            console.log("[FM] DISCONNECT button wired");
            elDisconnect.style.cursor = "pointer";
            elDisconnect.addEventListener("click", () => {
                console.log("[FM] DISCONNECT button CLICKED");
                if (window.datafeed && typeof datafeed.disconnect === "function") {
                    datafeed.disconnect();
                }
            });
        }

        // SYNC SELECTS (top <> side)
        linkSelects(elProviderTop, elProviderSide);
        linkSelects(elIntervalTop, elIntervalSide);
        linkSelects(elSymbolTop, elSymbolSide);
    }

    function linkSelects(a, b) {
        if (!a || !b) return;

        a.addEventListener("change", () => (b.value = a.value));
        b.addEventListener("change", () => (a.value = b.value));
    }

    // ------------------------------------------------------------
    // DATAFEED CALLBACKS
    // ------------------------------------------------------------
    function handleCandle(candle) {
        candles.push(candle);

        if (window.chartCore) {
            if (candles.length === 1 && chartCore.setSeriesData) {
                chartCore.setSeriesData(candles);
            } else if (chartCore.updateCandle) {
                chartCore.updateCandle(candle);
            }
        }

        if (window.indicators && indicators.onCandle) {
            indicators.onCandle(candle);
        }
    }

    function handleStatus(status) {
        console.log("[FM] terminal status:", status);

        if (!elStatus) return;

        elStatus.textContent = "● " + status;
        elStatus.classList.toggle("fm-live", status === "LIVE");
    }

    function handleError(msg) {
        console.error("[FM] terminal feed error:", msg);
        if (elStatus) {
            elStatus.textContent = "● ERROR";
        }
    }

    function handleDepth(depth) {
        // DOM / Heatmap / VP hooks
    }

    // ------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------
    function getSymbol() {
        return (elSymbolTop?.value || elSymbolSide?.value || "XBT/USD").trim();
    }

    function getProvider() {
        return elProviderTop?.value || elProviderSide?.value || "kraken";
    }

    function getInterval() {
        return elIntervalTop?.value || elIntervalSide?.value || "1m";
    }
})();
