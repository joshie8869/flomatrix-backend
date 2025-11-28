export type GPUBackend = "webgpu" | "webgl2";

export async function detectGPUBackend(): Promise<GPUBackend> {
    if (navigator.gpu) {
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) return "webgpu";
        } catch (e) {}
    }
    return "webgl2";
}
