// src/pages/chart.ts
//
// FloMatrix chart page bootstrap.
// - Grabs DOM elements (timeframe buttons, indicator toggles)
// - Creates / attaches the canvas
// - Starts the live feed engine (Binance BTCUSDT 1m for now)

type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h";

interface ChartEngineOptions {
  symbol: string;
  timeframe: Timeframe;
  canvas: HTMLCanvasElement;
  onStatusChange?: (text: string) => void;
}

// ---- Minimal engine stub for now -----------------------------------------

class FloMatrixEngineV01 {
  private symbol: string;
  private timeframe: Timeframe;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private ws: WebSocket | null = null;
  private onStatusChange?: (text: string) => void;

  constructor(opts: ChartEngineOptions) {
    this.symbol = opts.symbol;
    this.timeframe = opts.timeframe;
    this.canvas = opts.canvas;
    this.onStatusChange = opts.onStatusChange;
  }

  private setStatus(text: string) {
    if (this.onStatusChange) this.onStatusChange(text);
  }

  init() {
    // For now: WebGL1 context; later we can upgrade to WebGL2/WebGPU.
    const gl =
      this.canvas.getContext("webgl") ||
      this.canvas.getContext("experimental-webgl");

    if (!gl) {
      this.setStatus("WebGL not available");
      return;
    }

    this.gl = gl as WebGLRenderingContext;
    this.resize();

    window.addEventListener("resize", () => this.resize());

    // In a later batch we’ll load shaders & buffers here.
    this.setStatus("Initializing engine…");

    // Start data stream
    this.startFeed();
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private buildKlineStreamUrl(): string {
    // Binance USDT perpetual as default; later we’ll generalize.
    const interval = this.timeframe;
    const lower = this.symbol.toLowerCase();
    return `wss://stream.binance.com:9443/ws/${lower}@kline_${interval}`;
  }

  private startFeed() {
    const url = this.buildKlineStreamUrl();
    this.setStatus(`Connecting to live feed: ${url}`);

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error(err);
      this.setStatus("WebSocket error (cannot open connection)");
      return;
    }

    this.ws.onopen = () => {
      this.setStatus("Live · Binance US BTCUSDT");
    };

    this.ws.onclose = () => {
      this.setStatus("Feed closed – reconnecting soon…");
      // Simple retry for now
      setTimeout(() => this.startFeed(), 5000);
    };

    this.ws.onerror = (ev) => {
      console.error("WebSocket error", ev);
      this.setStatus("WebSocket error – live feed interrupted.");
    };

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (!data.k) return;
        // For now we’ll just log; next batch: draw candles, EMA, etc.
        // console.log("kline", data.k);
        this.renderHeartbeat();
      } catch (e) {
        console.error("Bad kline message", e);
      }
    };
  }

  private renderHeartbeat() {
    if (!this.gl) return;
    const gl = this.gl;

    // TEMP: simple dark background pulse so you can see it’s alive.
    const t = (performance.now() / 1000) % 1;
    const base = 0.04;
    const pulse = base + t * 0.04;
    gl.clearColor(0.01 + pulse, 0.04, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}

// ---- Page bootstrap ------------------------------------------------------

export function bootChartPage() {
  const chartRoot = document.querySelector<HTMLElement>(".chart-shell, .chart-wrapper");
  const feedStatusBadge = document.getElementById("feedStatus");
  const lastTickEl = document.getElementById("lastTick");

  if (!chartRoot) {
    console.warn("[FloMatrix] chart root not found; aborting chart bootstrap.");
    return;
  }

  // Create / locate canvas
  let canvas = document.getElementById("chartCanvas") as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "chartCanvas";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    chartRoot.appendChild(canvas);
  }

  const setFeedStatus = (text: string) => {
    if (feedStatusBadge) {
      feedStatusBadge.textContent = text;
    }
    if (lastTickEl) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      lastTickEl.textContent = `${hh}:${mm}:${ss}`;
    }
  };

  // Default timeframe
  let currentTf: Timeframe = "1m";

  const engine = new FloMatrixEngineV01({
    symbol: "BTCUSDT",
    timeframe: currentTf,
    canvas,
    onStatusChange: setFeedStatus,
  });

  engine.init();

  // Wire timeframe buttons
  const tfButtons = document.querySelectorAll<HTMLButtonElement>(".tf-btn[data-interval]");
  tfButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tf = btn.getAttribute("data-interval") as Timeframe | null;
      if (!tf || tf === currentTf) return;

      // Update active UI state
      tfButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      currentTf = tf;
      // For v0.1 we simply reload the page with the new tf for simplicity.
      const url = new URL(window.location.href);
      url.searchParams.set("tf", currentTf);
      window.location.href = url.toString();
    });
  });

  // Indicator toggles – for now just log; in later batches we’ll hook real layers.
  const indicatorCheckboxes = document.querySelectorAll<HTMLElement>(".checkbox[data-toggle]");
  indicatorCheckboxes.forEach((box) => {
    box.addEventListener("click", () => {
      const checked = box.getAttribute("data-checked") === "true";
      const next = !checked;
      box.setAttribute("data-checked", next ? "true" : "false");
      box.textContent = next ? "✓" : "";
      const key = box.getAttribute("data-toggle");
      console.log("[FloMatrix] toggle indicator", key, "=>", next);
    });
  });

  console.log("[FloMatrix] chart page booted.");
}
