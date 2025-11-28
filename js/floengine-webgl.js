/* ============================================================
   FloMatrix Institutional Overlay Engine — WebGL Rendering
   File: floengine-webgl.js

   Responsibilities:
   - WebGL Context & Shader Bootstrapping
   - Overlay Layer System (Delta, Volume, Heatmap, Liquidity)
   - WebGL Buffers & Draw Calls
   - Frame Lifecycle (begin → draw layers → end)
   - Plugin-Ready Architecture for future institutional tools
   ============================================================ */

export class FloWebGLEngine {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error("FloWebGLEngine: container not found:", containerId);
            return;
        }

        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        // Create canvas
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.container.appendChild(this.canvas);

        // Setup WebGL context
        this.gl = this.canvas.getContext("webgl", { antialias: true, alpha: true });

        if (!this.gl) {
            console.error("FloWebGLEngine: WebGL not supported.");
            return;
        }

        // Overlay layers storage
        this.layers = {
            delta: [],
            volume: [],
            imbalance: [],
            liquidity: [],
            heatmap: []
        };

        // FPS limiting
        this.lastFrame = 0;
        this.targetFPS = 60;

        this._initGL();
        requestAnimationFrame((t) => this._loop(t));
    }

    /* ============================================================
       INITIALIZE WEBGL (Shaders, Buffers, Programs)
       ============================================================ */
    _initGL() {
        const gl = this.gl;

        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Basic shader for drawing circles & heatmap cells
        const vertexShaderSrc = `
            attribute vec2 a_position;
            attribute float a_size;
            attribute vec4 a_color;

            varying vec4 v_color;

            void main() {
                v_color = a_color;
                gl_Position = vec4(a_position, 0.0, 1.0);
                gl_PointSize = a_size;
            }
        `;

        const fragmentShaderSrc = `
            precision mediump float;
            varying vec4 v_color;

            void main() {
                float dist = distance(gl_PointCoord, vec2(0.5, 0.5));
                if (dist > 0.5) discard;
                gl_FragColor = v_color;
            }
        `;

        this.program = this._createProgram(vertexShaderSrc, fragmentShaderSrc);
        gl.useProgram(this.program);

        // Attributes
        this.a_position = gl.getAttribLocation(this.program, "a_position");
        this.a_size = gl.getAttribLocation(this.program, "a_size");
        this.a_color = gl.getAttribLocation(this.program, "a_color");

        // Buffers
        this.positionBuffer = gl.createBuffer();
        this.sizeBuffer = gl.createBuffer();
        this.colorBuffer = gl.createBuffer();

        console.log("FloWebGLEngine: WebGL initialized.");
    }

    _createProgram(vsSource, fsSource) {
        const gl = this.gl;

        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error("Vertex shader error:", gl.getShaderInfoLog(vs));
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error("Fragment shader error:", gl.getShaderInfoLog(fs));
        }

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Program link error:", gl.getProgramInfoLog(program));
        }

        return program;
    }

    /* ============================================================
       FRAME LOOP
       ============================================================ */
    _loop(timestamp) {
        const delta = timestamp - this.lastFrame;
        if (delta < 1000 / this.targetFPS) {
            requestAnimationFrame((t) => this._loop(t));
            return;
        }
        this.lastFrame = timestamp;

        this._render();
        requestAnimationFrame((t) => this._loop(t));
    }

    /* ============================================================
       MAIN RENDER
       ============================================================ */
    _render() {
        const gl = this.gl;

        gl.viewport(0, 0, this.width, this.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Render all overlay layers
        this._renderLayer(this.layers.delta);
        this._renderLayer(this.layers.volume);
        this._renderLayer(this.layers.imbalance);
        this._renderLayer(this.layers.liquidity);
        this._renderLayer(this.layers.heatmap);
    }

    /* ============================================================
       RENDER A LAYER
       ============================================================ */
    _renderLayer(layer) {
        if (!layer.length) return;

        const gl = this.gl;

        const positions = [];
        const sizes = [];
        const colors = [];

        for (const obj of layer) {
            positions.push(obj.x, obj.y);
            sizes.push(obj.size);
            colors.push(obj.r, obj.g, obj.b, obj.a);
        }

        /* ---- Upload Position Buffer ---- */
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(this.a_position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_position);

        /* ---- Upload Size Buffer ---- */
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(this.a_size, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_size);

        /* ---- Upload Color Buffer ---- */
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(this.a_color, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_color);

        /* ---- Draw ---- */
        gl.drawArrays(gl.POINTS, 0, layer.length);
    }

    /* ============================================================
       API: ADD OBJECTS TO OVERLAYS
       ============================================================ */
    addDelta(x, y, volume, isBuy) {
        this.layers.delta.push({
            x, y,
            size: Math.sqrt(volume) * 2.0,
            r: isBuy ? 0.0 : 1.0,
            g: isBuy ? 1.0 : 0.2,
            b: 0.2,
            a: 0.95
        });
    }

    addVolumeBubble(x, y, volume) {
        this.layers.volume.push({
            x, y,
            size: Math.sqrt(volume) * 2.5,
            r: 0.1,
            g: 0.6,
            b: 1.0,
            a: 0.5
        });
    }

    addImbalance(x, y, strength) {
        this.layers.imbalance.push({
            x, y,
            size: 10 + strength * 5,
            r: 1.0,
            g: 0.4,
            b: 0.1,
            a: 0.9
        });
    }

    addHeatCell(x, y, intensity) {
        this.layers.heatmap.push({
            x, y,
            size: 12,
            r: intensity,
            g: 0.2,
            b: 0.0,
            a: 0.8
        });
    }

    addLiquidityLevel(x, y, size) {
        this.layers.liquidity.push({
            x, y,
            size,
            r: 0.0,
            g: 0.8,
            b: 1.0,
            a: 0.75
        });
    }

    /* ============================================================
       API: CLEAR LAYERS
       ============================================================ */
    clearLayers() {
        this.layers.delta = [];
        this.layers.volume = [];
        this.layers.imbalance = [];
        this.layers.liquidity = [];
        this.layers.heatmap = [];
    }
}
