// src/types.ts

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h';

export interface Candle {
    time: number;   // UNIX seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface IndicatorSeries {
    id: string;               // e.g. 'ema34'
    label: string;
    values: number[];         // same length as candles
    color: string;            // CSS color
    lineWidth?: number;
}

export type HeatmapMode = 'off' | 'delta' | 'volume' | 'liquidity';

// Core indicator IDs we actually draw now.
// Architecture supports more than 25 later, but we start with a tight core.
export type IndicatorId =
    | 'ema34'
    | 'vwap'
    | 'sessionDelta'
    | 'sessionRange'
    | 'volProfile';

export interface IndicatorConfig {
    id: IndicatorId;
    label: string;
    enabled: boolean;
    primary: boolean;
}
