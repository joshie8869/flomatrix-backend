/* =====================================================================
   FloMatrix — DATAFEED ENGINE v2
   ---------------------------------------------------------------------
   - Handles live feeds from multiple providers
   - Currently: Kraken OHLC via public WS (no key needed)
   - Binance / dxFeed / Rithmic are stubbed but safe (no crashes)
   - Integrates with terminal.js via:
       datafeed.init({ onCandle, onStatus, onError, onDepth })
       datafeed.connect({ provider, symbol, interval })
       datafeed.disconnect()
   ===================================================================== */

window.datafeed = (function () {
    // Callbacks from terminal.js
    let onCandle = null;
    let onStatus = null;
    let onError = null;
    let onDepth = null;

    // WebSocket state
    let ws = null;
    let currentProvider = null;
    let currentSymbol = null;
    let currentInterval = null;

    // ------------------------------------------------------------------
    // INIT
    // ------------------------------------------------------------------
    function init(opts) {
        onCandle = opts?.onCandle || null;
        onStatus = opts?.onStatus || null;
        onError = opts?.onError || null;
        onDepth = opts?.onDepth || null;

        log("initialized", opts);
        setStatus("DISCONNECTED");
    }

    // ------------------------------------------------------------------
    // CONNECT
    // ------------------------------------------------------------------
    function connect({ provider, symbol, interval }) {
        // Cleanup any existing connection
        disconnect();

        currentProvider = provider || "kraken";
        currentSymbol = symbol || "XBT/USD";
        currentInterval = interval || "1m";

        log("connect requested", { currentProvider, currentSymbol, currentInterval });
        setStatus("CONNECTING");

        if (currentProvider === "kraken") {
            connectKraken();
        } else if (currentProvider === "binance") {
            // We can’t reliably use Binance WS everywhere (451 issues), so just fail gracefully
            safeError("Binance live WS is not available in this region yet. Use Kraken for now.");
            setStatus("DISCONNECTED");
        } else if (currentProvider === "dxfeed" || currentProvider === "rithmic") {
            safeError(
                currentProvider +
                    " is SaaS-backend only. Your FloMatrix backend will proxy these feeds later."
            );
            setStatus("DISCONNECTED");
        } else {
            safeError("Unknown provider: " + currentProvider);
            setStatus("DISCONNECTED");
        }
    }

    // ------------------------------------------------------------------
    // DISCONNECT
    // ------------------------------------------------------------------
    function disconnect() {
        if (ws) {
            try {
                ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
                ws.close();
            } catch (e) {
                console.warn("[FM] datafeed disconnect error:", e);
            }
        }
        ws = null;
        setStatus("DISCONNECTED");
    }

    // ------------------------------------------------------------------
    // KRAKEN IMPLEMENTATION
    // ------------------------------------------------------------------
    function connectKraken() {
        // Kraken WS docs: wss://ws.kraken.com
        // We’ll subscribe to OHLC stream
        const pair = normalizeKrakenPair(currentSymbol);
        const intervalNum = normalizeIntervalToMinutes(currentInterval);

        const url = "wss://ws.kraken.com";
        log("connecting Kraken WS", { url, pair, intervalNum });

        try {
            ws = new WebSocket(url);
        } catch (e) {
            ws = null;
            safeError("Failed to open Kraken WebSocket: " + e.message);
            setStatus("DISCONNECTED");
            return;
        }

        ws.onopen = () => {
            log("Kraken WS open");

            if (!ws || ws.readyState !== WebSocket.OPEN) {
                console.warn("[FM] Kraken onopen fired but ws is not OPEN.");
                return;
            }

            const subMsg = {
                event: "subscribe",
                pair: [pair],
                subscription: {
                    name: "ohlc",
                    interval: intervalNum,
                },
            };

            try {
                ws.send(JSON.stringify(subMsg));
                log("Kraken subscribe sent", subMsg);
            } catch (e) {
                safeError("Failed to send Kraken subscription: " + e.message);
                setStatus("DISCONNECTED");
            }
        };

        ws.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);

                if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
                    // This is an OHLC message
                    const ohlc = data[1];
                    handleKrakenOhlc(ohlc, pair);
                } else if (data.event === "subscriptionStatus") {
                    if (data.status === "subscribed") {
                        log("Kraken subscribed OK", data);
                        setStatus("LIVE");
                    } else if (data.status === "error") {
                        safeError("Kraken subscription error: " + data.errorMessage);
                        setStatus("DISCONNECTED");
                    }
                } else if (data.event === "heartbeat") {
                    // ignore
                } else {
                    // log("Kraken other msg", data);
                }
            } catch (e) {
                console.warn("[FM] Kraken message parse error:", e);
            }
        };

        ws.onerror = (evt) => {
            console.error("[FM] Kraken WS error:", evt);
            safeError("Kraken WebSocket error");
            setStatus("DISCONNECTED");
        };

        ws.onclose = () => {
            log("Kraken WS closed");
            setStatus("DISCONNECTED");
            ws = null;
        };
    }

    function handleKrakenOhlc(ohlc, pair) {
        // Kraken OHLC array layout:
        // [ time, open, high, low, close, vwap, volume, count ]
        const [
            timeStr,
            openStr,
            highStr,
            lowStr,
            closeStr,
            vwapStr,
            volumeStr,
            countStr,
        ] = ohlc;

        const t = Number(timeStr);
        const candle = {
            time: t, // Lightweight Charts accepts Unix (seconds) if not multiplied
            open: Number(openStr),
            high: Number(highStr),
            low: Number(lowStr),
            close: Number(closeStr),
            volume: Number(volumeStr),
            pair: pair,
        };

        if (typeof onCandle === "function") {
            onCandle(candle);
        }
    }

    // ------------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------------
    function normalizeKrakenPair(sym) {
        // Basic mapping; you can extend this later
        const s = (sym || "").toUpperCase();

        if (s === "XBT/USD" || s === "BTC/USD" || s === "BTCUSD") return "XBT/USD";
        if (s === "XBT/USDT" || s === "BTC/USDT" || s === "BTCUSDT") return "XBT/USDT";
        if (s === "ETH/USD" || s === "ETHUSD") return "ETH/USD";

        // Fallback
        return s || "XBT/USD";
    }

    function normalizeIntervalToMinutes(interval) {
        // '1m', '5m', '15m', '1h', '4h' etc -> number of minutes
        if (!interval) return 1;
        const s = interval.toString().toLowerCase();

        if (s.endsWith("m")) {
            return Number(s.replace("m", "")) || 1;
        }
        if (s.endsWith("h")) {
            const hours = Number(s.replace("h", "")) || 1;
            return hours * 60;
        }
        return 1;
    }

    function setStatus(status) {
        if (typeof onStatus === "function") {
            try {
                onStatus(status);
            } catch (e) {
                console.warn("[FM] onStatus handler error:", e);
            }
        }
    }

    function safeError(msg) {
        console.error("[FM] datafeed error:", msg);
        if (typeof onError === "function") {
            try {
                onError(msg);
            } catch (e) {
                console.warn("[FM] onError handler error:", e);
            }
        }
    }

    function log(msg, obj) {
        if (obj !== undefined) {
            console.log("[FM datafeed]", msg, obj);
        } else {
            console.log("[FM datafeed]", msg);
        }
    }

    // ------------------------------------------------------------------
    // PUBLIC API
    // ------------------------------------------------------------------
    return {
        init,
        connect,
        disconnect,
    };
})();
