// src/engine/renderer.ts
import type { Candle, IndicatorSeries } from '../types';

export interface Renderer {
    setData(candles: Candle[], indicators: IndicatorSeries[]): void;
    resize(): void;
    render(): void;
}

interface InternalState {
    candles: Candle[];
    indicators: IndicatorSeries[];
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('2D canvas unavailable');
    }

    const state: InternalState = {
        candles: [],
        indicators: [],
    };

    function resize() {
        const parent = canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        render();
    }

    function setData(candles: Candle[], indicators: IndicatorSeries[]) {
        state.candles = candles.slice();
        state.indicators = indicators.slice();
        render();
    }

    function render() {
        const { width, height } = canvas.getBoundingClientRect();
        if (width === 0 || height === 0) return;

        ctx.clearRect(0, 0, width, height);

        if (state.candles.length === 0) {
            // subtle placeholder grid
            drawGrid(ctx, width, height);
            return;
        }

        drawGrid(ctx, width, height);

        const candles = state.candles;
        let min = Infinity;
        let max = -Infinity;
        for (const c of candles) {
            if (c.low < min) min = c.low;
            if (c.high > max) max = c.high;
        }
        if (!isFinite(min) || !isFinite(max) || max === min) return;

        const paddingTop = 12;
        const paddingBottom = 16;
        const usableHeight = height - paddingTop - paddingBottom;

        const n = candles.length;
        const candleGap = 2;
        const candleWidth = Math.max(4, (width - 20) / Math.max(40, n));
        const totalWidth = n * candleWidth + (n - 1) * candleGap;
        const startX = Math.max(10, width - totalWidth - 10);

        const priceToY = (price: number) =>
            paddingTop + (1 - (price - min) / (max - min)) * usableHeight;

        // --- draw wicks + bodies ---
        for (let i = 0; i < n; i++) {
            const c = candles[i];
            const x = startX + i * (candleWidth + candleGap);

            const yHigh = priceToY(c.high);
            const yLow = priceToY(c.low);
            const yOpen = priceToY(c.open);
            const yClose = priceToY(c.close);

            const isUp = c.close >= c.open;
            const bodyTop = isUp ? yClose : yOpen;
            const bodyBottom = isUp ? yOpen : yClose;
            const bodyHeight = Math.max(1, bodyBottom - bodyTop);

            const wickColor = isUp ? '#4ade80' : '#f87171';
            const bodyGradient = ctx.createLinearGradient(
                x,
                bodyTop,
                x,
                bodyBottom
            );
            if (isUp) {
                bodyGradient.addColorStop(0, '#22c55e');
                bodyGradient.addColorStop(1, '#15803d');
            } else {
                bodyGradient.addColorStop(0, '#b91c1c');
                bodyGradient.addColorStop(1, '#7f1d1d');
            }

            // Wick
            ctx.strokeStyle = wickColor;
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(x + candleWidth / 2, yHigh);
            ctx.lineTo(x + candleWidth / 2, yLow);
            ctx.stroke();

            // Body (slightly rounded)
            const radius = Math.min(3, candleWidth / 2);
            roundRect(ctx, x, bodyTop, candleWidth, bodyHeight, radius, bodyGradient);
        }

        // --- indicators (EMA, VWAP etc) ---
        for (const series of state.indicators) {
            if (!series.values.length) continue;
            ctx.lineWidth = series.lineWidth ?? 1.2;
            ctx.strokeStyle = series.color;
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < n && i < series.values.length; i++) {
                const x = startX + i * (candleWidth + candleGap) + candleWidth / 2;
                const y = priceToY(series.values[i]);
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
    }

    window.addEventListener('resize', resize);

    return {
        setData,
        resize,
        render,
    };
}

// --- helpers ----

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(15,23,42,0.9)';
    ctx.lineWidth = 1;

    const vStep = 80;
    const hStep = 40;

    for (let x = 0; x < width; x += vStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    for (let y = 0; y < height; y += hStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // subtle glow frame
    ctx.strokeStyle = 'rgba(34,197,94,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string | CanvasGradient
) {
    if (h < 1) h = 1;
    ctx.fillStyle = fill;
    ctx.beginPath();
    const r2 = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r2, y);
    ctx.lineTo(x + w - r2, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r2);
    ctx.lineTo(x + w, y + h - r2);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r2, y + h);
    ctx.lineTo(x + r2, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r2);
    ctx.lineTo(x, y + r2);
    ctx.quadraticCurveTo(x, y, x + r2, y);
    ctx.closePath();
    ctx.fill();
}
