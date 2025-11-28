/* ============================================================
   FloMatrix Engine Initializer
   File: floengine-init.js

   Responsibilities:
   - Create Core Engine
   - Create WebGL Overlay Engine
   - Create DataHub
   - Create UI Controller
   - Bind mouse events to core engine
   - Launch live data stream
   ============================================================ */

import { FloCoreEngine } from './floengine-core.js';
import { FloWebGLEngine } from './floengine-webgl.js';
import { FloDataHub } from './floengine-datahub.js';
import { FloUIController } from './floengine-ui.js';

/* ============================================================
   INITIALIZE EVERYTHING
   ============================================================ */
window.addEventListener("DOMContentLoaded", async () => {

    console.log("FloMatrix Engine: Initializing...");

    /* ------------------------------------------
       1. Create Core Engine (OHLC + Canvas)
       ------------------------------------------ */
    const core = new FloCoreEngine("chartContainer", null);

    /* ------------------------------------------
       2. Create WebGL Overlay Engine
       ------------------------------------------ */
    const webgl = new FloWebGLEngine("chartContainer");

    /* ------------------------------------------
       3. Build DataHub + attach Core engine
       ------------------------------------------ */
    const dataHub = new FloDataHub(core);

    /* Link datahub back into core */
    core.dataHub = dataHub;

    /* ------------------------------------------
       4. Initialize UI Controller
       ------------------------------------------ */
    const ui = new FloUIController(core, webgl, dataHub);

    /* ------------------------------------------
       5. Default Settings (Boot State)
       ------------------------------------------ */
    const defaultSymbol = "BTCUSDT";
    const defaultTimeframe = "1m";

    await dataHub.setSymbol(defaultSymbol);
    await dataHub.setTimeframe(defaultTimeframe);

    console.log(`FloMatrix Engine: Booted with ${defaultSymbol} ${defaultTimeframe}`);

    /* ------------------------------------------
       6. Bind Mouse Move to Crosshair
       ------------------------------------------ */
    const container = document.getElementById("chartContainer");
    container.addEventListener("mousemove", (e) => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        core.setMousePosition(x, y);
    });

    /* ------------------------------------------
       7. Confirm Engine Ready
       ------------------------------------------ */
    console.log("FloMatrix Engine: Fully Initialized & Running.");
});
