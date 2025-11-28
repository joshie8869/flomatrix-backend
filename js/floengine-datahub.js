/* ============================================================
   FloMatrix DataHub
   File: floengine-datahub.js

   Responsibilities:
   - Connect to providers (Binance → dxFeed → Rithmic)
   - Normalize OHLC data
   - Stream live candles to FloCoreEngine
   - Auto-reconnect + error handling
   - Timeframe mapping + symbol mapping
   ============================================================ */

export class FloDataHub {
    constructor(coreEngine) {
        this.core = coreEngine;

        this.provider = "binance";
        this.ws = null;
        this.symbol = "BTCUSDT";
        this.timeframe = "1m";

        this._binanceEndpoints = {
            rest: "https://api.binance.com/api/v3/klines",
            ws: "wss://stream.binance.com:9443/ws/"
        };
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */
    async setSymbol(symbol) {
        this.symbol = symbol.toUpperCase();
        await this._loadHistorical();
        this._connectStream();
    }

    async setTimeframe(tf) {
        this.timeframe = tf;
        await this._loadHistorical();
        this._connectStream();
    }

    /* ============================================================
       LOAD HISTORICAL (REST)
       ============================================================ */
    async _loadHistorical() {
        console.log(`DataHub: Loading historical for ${this.symbol} ${this.timeframe}`);

        const url = `${this._binanceEndpoints.rest}?symbol=${this.symbol}&interval=${this.timeframe}&limit=500`;

        try {
            const res = await fetch(url);
            const raw = await res.json();

            const candles = raw.map(c => ({
                time: c[0],
                open: parseFloat(c[1]),
                high: parseFloat(c[2]),
                low: parseFloat(c[3]),
                close: parseFloat(c[4]),
                volume: parseFloat(c[5])
            }));

            this.core.setData(candles);
        } catch (err) {
            console.error("DataHub: Historical load error", err);
        }
    }

    /* ============================================================
       LIVE STREAM (WEBSOCKET)
       ============================================================ */
    _connectStream() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        const streamName = `${this.symbol.toLowerCase()}@kline_${this.timeframe}`;
        const wsURL = this._binanceEndpoints.ws + streamName;

        console.log("DataHub: Connecting WebSocket →", wsURL);

        this.ws = new WebSocket(wsURL);

        this.ws.onopen = () => {
            console.log("DataHub: Live stream connected.");
        };

        this.ws.onmessage = (msg) => {
            const json = JSON.parse(msg.data);

            if (!json.k) return;

            const k = json.k;

            const candle = {
                time: k.t,
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v)
            };

            if (k.x === false) {
                // Active candle
                this.core.updateLastCandle(candle);
            } else {
                // Closed candle
                this.core.pushCandle(candle);
            }
        };

        this.ws.onerror = (err) => {
            console.error("DataHub: WebSocket error:", err);
        };

        this.ws.onclose = () => {
            console.warn("DataHub: WebSocket closed. Reconnecting in 2s...");
            setTimeout(() => this._connectStream(), 2000);
        };
    }

    /* ============================================================
       FUTURE PROVIDERS (stubs for expansion)
       ============================================================ */
    async setProvider(providerName) {
        this.provider = providerName.toLowerCase();
        console.log(`DataHub: Provider switched to ${this.provider}`);

        if (this.provider === "binance") {
            await this.setSymbol(this.symbol);
        }

        if (this.provider === "dxfeed") {
            console.warn("dxFeed provider not yet implemented.");
        }

        if (this.provider === "rithmic") {
            console.warn("Rithmic provider not yet implemented.");
        }
    }
}
