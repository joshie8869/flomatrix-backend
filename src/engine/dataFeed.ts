// src/engine/dataFeed.ts
import type { Candle, Timeframe } from '../types';

const BINANCE_BASE = 'https://api.binance.com';
const WS_BASE = 'wss://stream.binance.com:9443/ws';

function tfToBinance(interval: Timeframe): string {
    return interval; // 1m, 5m, etc. already match Binance
}

export interface FeedHandlers {
    onSnapshot: (candles: Candle[]) => void;
    onUpdate: (candle: Candle) => void;
    onError?: (err: Error) => void;
}

export function subscribeBinanceKlines(
    symbol: string,
    timeframe: Timeframe,
    handlers: FeedHandlers
): () => void {
    let closed = false;
    let socket: WebSocket | null = null;

    const binanceInterval = tfToBinance(timeframe);

    async function loadHistory() {
        try {
            const url = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=500`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`REST ${res.status}`);
            const data = await res.json();

            const candles: Candle[] = data.map((k: any[]) => ({
                time: Math.floor(k[0] / 1000),
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
            }));

            if (!closed) handlers.onSnapshot(candles);
        } catch (e: any) {
            console.error('History load error', e);
            handlers.onError?.(e);
        }
    }

    function connectStream() {
        const streamName = `${symbol.toLowerCase()}@kline_${binanceInterval}`;
        socket = new WebSocket(`${WS_BASE}/${streamName}`);

        socket.onopen = () => {
            // console.log('Binance WS open');
        };

        socket.onerror = (ev) => {
            const err = new Error('WebSocket error');
            console.error('Binance WS error', ev);
            handlers.onError?.(err);
        };

        socket.onclose = () => {
            if (!closed) {
                // Simple retry
                setTimeout(connectStream, 4000);
            }
        };

        socket.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                const k = msg.k;
                if (!k) return;

                const c: Candle = {
                    time: Math.floor(k.t / 1000),
                    open: parseFloat(k.o),
                    high: parseFloat(k.h),
                    low: parseFloat(k.l),
                    close: parseFloat(k.c),
                    volume: parseFloat(k.v),
                };
                if (!closed) handlers.onUpdate(c);
            } catch (e) {
                console.error('WS parse error', e);
            }
        };
    }

    loadHistory().then(connectStream);

    // unsubscribe
    return () => {
        closed = true;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        socket = null;
    };
}
