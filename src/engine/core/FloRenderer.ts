import { GPUBackend } from "../utils/GPUCapabilities";
import { WebGL2Renderer } from "../render/pipelines/WebGL2Renderer";
import { WebGPURenderer } from "../render/pipelines/WebGPURenderer";

export class FloRenderer {
    private renderer: WebGL2Renderer | WebGPURenderer;

    constructor(
        private canvas: HTMLCanvasElement,
        private backend: GPUBackend
    ) {}

    async init() {
        if (this.backend === "webgpu") {
            this.renderer = new WebGPURenderer(this.canvas);
        } else {
            this.renderer = new WebGL2Renderer(this.canvas);
        }
        await this.renderer.init();
    }

    async startRenderLoop() {
        const loop = () => {
            this.renderer.draw();
            requestAnimationFrame(loop);
        };
        loop();
    }
}
