/* ============================================================
   FloMatrix UI Controller
   File: floengine-ui.js

   Responsibilities:
   - Symbol selector controls
   - Timeframe selector controls
   - Light/Dark theme toggle
   - FPS monitor
   - Engine reload triggers
   - DOM wiring for all UI elements
   ============================================================ */

export class FloUIController {
    constructor(coreEngine, webglEngine, dataHub) {
        this.core = coreEngine;
        this.webgl = webglEngine;
        this.dataHub = dataHub;

        this.lastFrameTime = performance.now();
        this.fps = 0;

        // Bind all UI elements
        this._bindSymbolSelector();
        this._bindTimeframeSelector();
        this._bindThemeToggle();
        this._bindChartReload();
        this._startFPSMonitor();

        console.log("FloUIController: UI initialized.");
    }

    /* ============================================================
       SYMBOL SELECTOR
       ============================================================ */
    _bindSymbolSelector() {
        const selector = document.getElementById("symbolSelector");
        if (!selector) {
            console.warn("FloUIController: No symbol selector found.");
            return;
        }

        selector.addEventListener("change", async (e) => {
            const symbol = e.target.value.toUpperCase();
            console.log("UI: Changing symbol →", symbol);
            await this.dataHub.setSymbol(symbol);
        });
    }

    /* ============================================================
       TIMEFRAME SELECTOR
       ============================================================ */
    _bindTimeframeSelector() {
        const selector = document.getElementById("timeframeSelector");
        if (!selector) {
            console.warn("FloUIController: No timeframe selector found.");
            return;
        }

        selector.addEventListener("change", async (e) => {
            const tf = e.target.value;
            console.log("UI: Changing timeframe →", tf);
            await this.dataHub.setTimeframe(tf);
        });
    }

    /* ============================================================
       THEME TOGGLE
       ============================================================ */
    _bindThemeToggle() {
        const toggle = document.getElementById("themeToggle");
        if (!toggle) {
            console.warn("FloUIController: No theme toggle found.");
            return;
        }

        toggle.addEventListener("click", () => {
            const body = document.body;
            const dark = body.classList.toggle("dark-theme");

            console.log("UI: Theme toggle →", dark ? "Dark" : "Light");

            // Apply background to canvases
            if (dark) {
                this.core.ctx.fillStyle = "#05060A";
            } else {
                this.core.ctx.fillStyle = "#FFFFFF";
            }
        });
    }

    /* ============================================================
       MANUAL ENGINE RELOAD BUTTON
       ============================================================ */
    _bindChartReload() {
        const btn = document.getElementById("reloadChartBtn");
        if (!btn) {
            console.warn("FloUIController: No reload button found.");
            return;
        }

        btn.addEventListener("click", async () => {
            console.log("UI: Reload chart pressed.");
            await this.dataHub.setSymbol(this.dataHub.symbol);
        });
    }

    /* ============================================================
       FPS MONITOR
       ============================================================ */
    _startFPSMonitor() {
        const fpsLabel = document.getElementById("fpsCounter");
        if (!fpsLabel) {
            console.warn("FloUIController: No FPS label found.");
            return;
        }

        const updateFPS = () => {
            const now = performance.now();
            const delta = now - this.lastFrameTime;
            this.lastFrameTime = now;
            this.fps = 1000 / delta;

            fpsLabel.textContent = `FPS: ${this.fps.toFixed(0)}`;
            requestAnimationFrame(updateFPS);
        };

        updateFPS();
    }
}
