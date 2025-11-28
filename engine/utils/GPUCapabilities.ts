// /var/www/flomatrix.trade/frontend/engine/utils/GPUCapabilities.ts

export type GPUBackendId = "webgpu" | "webgl2" | "none";

export interface GPUCapabilityInfo {
    backend: GPUBackendId;
    webgpuSupported: boolean;
    webgl2Supported: boolean;
    reason?: string;
}

export async function detectGPUBackend(): Promise<GPUCapabilityInfo> {
    const hasDOM = typeof document !== "undefined";
    const hasNavigator = typeof navigator !== "undefined";

    const webgpuSupported = hasNavigator && "gpu" in navigator && !!(navigator as any).gpu;
    const webgl2Supported = hasDOM ? testWebGL2() : false;

    if (webgpuSupported) {
        try {
            const adapter = await (navigator as any).gpu.requestAdapter();
            if (adapter) {
                console.log("[FloMatrix] WebGPU adapter detected:", adapter.name);
                return {
                    backend: "webgpu",
                    webgpuSupported: true,
                    webgl2Supported,
                    reason: "WebGPU adapter available",
                };
            }
        } catch (err) {
            console.warn("[FloMatrix] WebGPU detection failed, falling back to WebGL2.", err);
        }
    }

    if (webgl2Supported) {
        console.log("[FloMatrix] Using WebGL2 backend.");
        return {
            backend: "webgl2",
            webgpuSupported,
            webgl2Supported: true,
            reason: "WebGL2 context available",
        };
    }

    console.warn("[FloMatrix] No WebGPU or WebGL2 support detected.");
    return {
        backend: "none",
        webgpuSupported,
        webgl2Supported,
        reason: "No GPU backend available",
    };
}

function testWebGL2(): boolean {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    return !!gl;
}
