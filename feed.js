// feed.js
// FloFeed — handles live data streaming for FloMatrix prototype

class FloFeed {
    constructor(options) {
        this.engine   = options.engine;
        this.symbol   = (options.symbol || "btcusdt").toLowerCase();
        this.interval = options.interval || "1m";

        // mode kept for future use (futures etc.), but not used in URL for now
        this.mode     = options.mode || "spot";

        this.ws       = null;
        this.isOpen   = false;

        console.log(
            `[FloEngine] FloFeed created for ${this.symbol} (${this.mode}, ${this.interval}) [Binance.US]`
        );

        this.connect();
    }

    getBinanceUrl() {
        const stream = `${this.symbol}@kline_${this.interval}`;

        // IMPORTANT: Binance.US, not binance.com
        const base = "wss://stream.binance.us:9443/ws";

        const url = `${base}/${stream}`;
        console.log("[FloEngine] FloFeed WS URL:", url);
        return url;
    }

    connect() {
        const url = this.getBinanceUrl();
        console.log("[FloEngine] Connecting FloFeed ->", url);

        try {
            this.ws = new WebSocket(url);
        } catch (err) {
            console.error("[FloEngine] WebSocket create error:", err);
            return;
        }

        this.ws.onopen = () => {
            this.isOpen = true;
            console.log("[FloEngine] FloFeed WebSocket connected.");
        };

        this.ws.onclose = (evt) => {
            this.isOpen = false;
            console.warn(
                "[FloEngine] FloFeed WebSocket closed. Code:",
                evt.code,
                "Reason:",
                evt.reason
            );

            // simple auto-reconnect
            setTimeout(() => this.connect(), 5000);
        };

        this.ws.onerror = (err) => {
            console.error("[FloEngine] FloFeed WebSocket error:", err);
        };

        this.ws.onmessage = (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                console.warn("[FloEngine] FloFeed JSON parse error:", e);
                return;
            }

            // Binance(.US) kline payload has 'k'
            if (!data.k) return;
            const k = data.k;

            const candle = {
                ts: k.t,
                open:  parseFloat(k.o),
                high:  parseFloat(k.h),
                low:   parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v)
            };

            if (this.engine && typeof this.engine.pushCandle === "function") {
                this.engine.pushCandle(candle);
            }

            const tickDiv = document.getElementById("flo-tick-debug");
            if (tickDiv) {
                tickDiv.textContent =
                    `Last tick — ${this.symbol.toUpperCase()} (${this.mode} @ ${this.interval}) ` +
                    `O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume}`;
            }
        };
    }

    changeStream({ symbol, interval }) {
        if (symbol)   this.symbol   = symbol.toLowerCase();
        if (interval) this.interval = interval;

        console.log(
            `[FloEngine] FloFeed switching to ${this.symbol} (${this.mode}, ${this.interval})`
        );

        if (this.ws) {
            try {
                this.ws.close();
            } catch (e) {
                console.warn("[FloEngine] Error closing old WebSocket:", e);
            }
        }

        this.connect();
    }
}

// expose globally
window.FloFeed = FloFeed;
