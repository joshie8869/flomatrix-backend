// src/engine/indicators.ts
import type { Candle, IndicatorSeries } from '../types';

// ---- EMA ----
export function calculateEMA(candles: Candle[], period: number): number[] {
    const out: number[] = [];
    if (candles.length === 0) return out;
    const k = 2 / (period + 1);
    let ema = candles[0].close;
    for (let i = 0; i < candles.length; i++) {
        const c = candles[i].close;
        ema = i === 0 ? c : (c - ema) * k + ema;
        out.push(ema);
    }
    return out;
}

// ---- VWAP (session-based approximate) ----
export function calculateVWAP(candles: Candle[]): number[] {
    const out: number[] = [];
    let cumPV = 0;
    let cumVol = 0;
    for (const c of candles) {
        const typical = (c.high + c.low + c.close) / 3;
        cumPV += typical * c.volume;
        cumVol += c.volume || 1e-8;
        out.push(cumPV / cumVol);
    }
    return out;
}

// Entry point: compute all indicator series you want rendered.
export function buildIndicatorSeries(candles: Candle[]): IndicatorSeries[] {
    if (candles.length === 0) return [];

    const ema34 = calculateEMA(candles, 34);
    const vwap = calculateVWAP(candles);

    const series: IndicatorSeries[] = [
        {
            id: 'ema34',
            label: 'EMA 34',
            values: ema34,
            color: '#38bdf8',
            lineWidth: 1.6,
        },
        {
            id: 'vwap',
            label: 'VWAP',
            values: vwap,
            color: '#a78bfa',
            lineWidth: 1.2,
        },
        // We can append more indicator series here as we wire them up.
    ];

    return series;
}
