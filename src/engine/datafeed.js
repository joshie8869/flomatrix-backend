// ===============================
// FloMatrix Live Data Engine v1
// Real-Time WebSocket Data (Binance Futures)
// ===============================

console.log("FloMatrix DataFeed: Loading...");

export class FloDataFeed {
    constructor(symbol = "btcusdt", interval = "1m") {
        this.symbol = symbol.toLowerCase();
        this.interval = interval;
        this.ws = null;
        this.connected = false;
        this.listeners = [];
        this.lastCandle = null;

        this.connect();
    }

    // ============= CONNECT =============
    connect() {
        const stream = `${this.symbol}@kline_${this.interval}`;
        const url = `wss://fstream.binance.com/ws/${stream}`;
        console.log("FloMatrix DataFeed connecting →", url);

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.connected = true;
            console.log("FloMatrix DataFeed: CONNECTED");
        };

        this.ws.onclose = () => {
            this.connected = false;
            console.warn("FloMatrix DataFeed: DISCONNECTED — Reconnecting in 3s...");
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (err) => {
            console.error("FloMatrix DataFeed ERROR:", err);
        };

        this.ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (!data.k) return;

            const k = data.k; // "kline" object

            const candle = {
                t: k.t,     // open time (ms)
                o: parseFloat(k.o),
                h: parseFloat(k.h),
                l: parseFloat(k.l),
                c: parseFloat(k.c),
                v: parseFloat(k.v),
                closed: k.x // true when candle is finalized
            };

            this.lastCandle = candle;

            // Notify all listeners
            this.listeners.forEach(fn => fn(candle));
        };
    }

    // ============= SUBSCRIBE =============
    onCandle(callback) {
        this.listeners.push(callback);
    }

    // ============= STATUS =============
    isConnected() {
        return this.connected;
    }

    getLast() {
        return this.lastCandle;
    }
}
