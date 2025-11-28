// src/state/chartState.ts
import type { Candle, Timeframe, IndicatorConfig, IndicatorId } from '../types';

interface ChartState {
    symbol: string;
    timeframe: Timeframe;
    candles: Candle[];
    indicators: IndicatorConfig[];
    heatmapMode: 'off' | 'delta' | 'volume' | 'liquidity';
}

const state: ChartState = {
    symbol: 'BTCUSDT',
    timeframe: '1m',
    candles: [],
    indicators: [
        { id: 'ema34',       label: 'EMA 34',        enabled: true,  primary: true  },
        { id: 'vwap',        label: 'VWAP',          enabled: false, primary: true  },
        { id: 'sessionDelta',label: 'Session Δ',     enabled: false, primary: false },
        { id: 'sessionRange',label: 'Session Range', enabled: false, primary: false },
        { id: 'volProfile',  label: 'Volume Profile',enabled: false, primary: true  },
    ],
    heatmapMode: 'off',
};

export function getState(): ChartState {
    return state;
}

export function setTimeframe(tf: Timeframe) {
    state.timeframe = tf;
}

export function setCandles(candles: Candle[]) {
    state.candles = candles;
}

export function upsertCandle(c: Candle) {
    const idx = state.candles.findIndex(x => x.time === c.time);
    if (idx >= 0) {
        state.candles[idx] = c;
    } else {
        state.candles.push(c);
        state.candles.sort((a, b) => a.time - b.time);
    }
}

export function toggleIndicator(id: IndicatorId): void {
    const found = state.indicators.find(i => i.id === id);
    if (found) {
        found.enabled = !found.enabled;
    }
}

export function setHeatmapMode(mode: ChartState['heatmapMode']) {
    state.heatmapMode = mode;
}

// Simple session stats for the left panel
export function getSessionStats() {
    if (state.candles.length === 0) {
        return { high: NaN, low: NaN, lastClose: NaN };
    }
    let high = -Infinity;
    let low = Infinity;
    for (const c of state.candles) {
        if (c.high > high) high = c.high;
        if (c.low < low) low = c.low;
    }
    const lastClose = state.candles[state.candles.length - 1].close;
    return { high, low, lastClose };
}
