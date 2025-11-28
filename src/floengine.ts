// src/floengine.ts
import { createRenderer } from './engine/renderer';
import { subscribeBinanceKlines } from './engine/dataFeed';
import { buildIndicatorSeries } from './engine/indicators';
import { wireControls } from './ui/controls';
import {
    getState,
    setTimeframe,
    setCandles,
    upsertCandle,
    toggleIndicator,
    getSessionStats,
} from './state/chartState';
import type { Candle, Timeframe } from './types';

let unsubscribeFeed: (() => void) | null = null;

function formatPrice(x: number): string {
    if (!isFinite(x)) return '–';
    if (x >= 1000) return x.toFixed(1);
    if (x >= 1) return x.toFixed(2);
    return x.toFixed(4);
}

function formatTime(ts: number): string {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('en-US', { hour12: false });
}

function updateDomStats(last: Candle | null) {
    const { high, low, lastClose } = getSessionStats();

    const sessionHighEl = document.getElementById('sessionHigh');
    const sessionLowEl = document.getElementById('sessionLow');
    const lastCloseEl = document.getElementById('lastClose');
    const lastTickEl = document.getElementById('lastTick');

    if (sessionHighEl) sessionHighEl.textContent = formatPrice(high);
    if (sessionLowEl) sessionLowEl.textContent = formatPrice(low);
    if (lastCloseEl) lastCloseEl.textContent = formatPrice(lastClose);
    if (last && lastTickEl) lastTickEl.textContent = formatTime(last.time);

    // Feed badge
    const feedStatusEl = document.getElementById('feedStatus');
    if (feedStatusEl) {
        feedStatusEl.textContent = 'Feed: Live (Binance BTCUSDT)';
    }
}

function setErrorBanner(msg: string | null) {
    const banner = document.getElementById('errorBanner');
    if (!banner) return;
    if (msg) {
        banner.style.display = 'block';
        banner.textContent = msg;
    } else {
        banner.style.display = 'none';
    }
}

function boot() {
    const canvas = document.getElementById('chartCanvas') as HTMLCanvasElement | null;
    if (!canvas) {
        console.error('No #chartCanvas found');
        return;
    }

    const engineStatus = document.getElementById('engineStatus');
    if (engineStatus) engineStatus.textContent = 'Online';

    const renderer = createRenderer(canvas);
    renderer.resize();

    const state = getState();

    function pushDataAndRender(candles: Candle[]) {
        setCandles(candles);
        const indicators = buildIndicatorSeries(candles);
        renderer.setData(candles, indicators);
        const last = candles[candles.length - 1] ?? null;
        updateDomStats(last);
    }

    function resubscribe(tf: Timeframe) {
        if (unsubscribeFeed) {
            unsubscribeFeed();
            unsubscribeFeed = null;
        }
        setErrorBanner(null);

        unsubscribeFeed = subscribeBinanceKlines(
            state.symbol,
            tf,
            {
                onSnapshot: (candles) => {
                    pushDataAndRender(candles);
                },
                onUpdate: (candle) => {
                    upsertCandle(candle);
                    const all = getState().candles;
                    pushDataAndRender(all);
                },
                onError: (err) => {
                    console.error('Feed error', err);
                    setErrorBanner('Live feed error – check network or Binance availability.');
                },
            }
        );
    }

    // Initial subscription
    resubscribe(state.timeframe);

    // Controls wiring (timeframe + indicators)
    wireControls({
        onTimeframeChange: (tf) => {
            setTimeframe(tf);
            resubscribe(tf);
        },
        onIndicatorToggle: (id, enabled) => {
            // Basic mapping from HTML ids -> internal ids
            // HTML currently has: data-toggle="ema", "vwap", "imbalances", etc.
            if (id === 'ema34' || id === 'ema' as any) {
                toggleIndicator('ema34');
            } else if (id === 'vwap') {
                toggleIndicator('vwap');
            }
            // Rebuild indicators for current candles
            const candles = getState().candles;
            const indicators = buildIndicatorSeries(candles);
            renderer.setData(candles, indicators);
        },
    });

    window.addEventListener('resize', () => renderer.resize());
}

window.addEventListener('DOMContentLoaded', boot);
