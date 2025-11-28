// FloMatrix A3 Engine - Master Controller
// WebGL2 + Workers + Shader-Layer Rendering
// FULL FILE — DO NOT REMOVE ANY LINES

import { GPUCore } from "../engine/gpu.js";
import { FeedWorker } from "../workers/feed-worker.js";
import { CalcWorker } from "../workers/calc-worker.js";
import { ClusterWorker } from "../workers/cluster-worker.js";
import { DeltaWorker } from "../workers/delta-worker.js";

import { Scene } from "../render/scene.js";
import { CandleLayer } from "../render/layers.js";
import { Camera } from "../render/camera.js";
import { Cache } from "../data/cache.js";
import { Stream } from "../data/stream.js";
import { Settings } from "./settings.js";

export class FloEngine {

    constructor(canvas) {
        this.canvas = canvas;

        // Settings
        this.settings = new Settings();

        // GPU Core
        this.gpu = new GPUCore(canvas);
        this.gl = this.gpu.gl;

        // Camera
        this.camera = new Camera(canvas);

        // Data & Cache
        this.cache = new Cache();

        // Workers
        this.feedWorker = new FeedWorker(this.cache);
        this.calcWorker = new CalcWorker(this.cache);
        this.clusterWorker = new ClusterWorker(this.cache);
        this.deltaWorker = new DeltaWorker(this.cache);

        // Scene
        this.scene = new Scene(this.gl, this.camera);

        // Layers (candles first)
        this.candles = new CandleLayer(this.gl, this.cache, this.camera, this.settings);

        this.scene.registerLayer(this.candles);

        // Start feed
        this.stream = new Stream(this.feedWorker, this.cache);
        this.stream.start();

        // Render loop
        this.startRenderLoop();
    }

    startRenderLoop() {
        const loop = () => {
            this.update();
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update() {
        this.camera.update();
        this.candles.update();
    }

    render() {
        this.scene.render();
    }

}
