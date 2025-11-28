import { detectGPUBackend } from "./engine/utils/GPUCapabilities";
import { FloRenderer } from "./engine/core/FloRenderer";

(async () => {
    console.log("FloMatrix Engine → Booting…");

    const backend = await detectGPUBackend();
    console.log("GPU Backend Selected:", backend);

    const canvas = document.getElementById("chartCanvas") as HTMLCanvasElement;
    if (!canvas) {
        console.error("Canvas not found.");
        return;
    }

    const renderer = new FloRenderer(canvas, backend);
    await renderer.init();
    await renderer.startRenderLoop();
})();
