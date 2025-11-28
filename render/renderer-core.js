// ======================================================================
// FloMatrix Renderer Core — renderer-core.js
// Shared WebGL utilities (shaders, buffers, matrices, colors)
// ======================================================================

if (!window.FloRender) {
    console.error("FloRender not found. floengine-webgl.js must load before renderer-core.js");
}

window.FloCore = {
    // quick access to layer gl
    gl(layerId) {
        if (!window.FloRender) return null;
        return FloRender.gl[layerId] || null;
    },

    // ============================
    // SHADERS & PROGRAMS
    // ============================
    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader compile error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    },

    createProgram(gl, vertexSrc, fragmentSrc) {
        const vs = this.createShader(gl, gl.VERTEX_SHADER, vertexSrc);
        const fs = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        if (!vs || !fs) return null;

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Program link error:", gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }

        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return program;
    },

    // ============================
    // BUFFERS & ATTRIBUTES
    // ============================
    createBuffer(gl, data, usage) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
        return buffer;
    },

    updateBuffer(gl, buffer, data, usage) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.DYNAMIC_DRAW);
    },

    enableAttribute(gl, program, name, size, type, stride, offset) {
        const loc = gl.getAttribLocation(program, name);
        if (loc === -1) {
            console.warn("Attribute not found:", name);
            return;
        }
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(
            loc,
            size,
            type || gl.FLOAT,
            false,
            stride || 0,
            offset || 0
        );
    },

    // ============================
    // MATRICES (ORTHO PROJECTION)
    // ============================
    createOrtho(left, right, bottom, top, near, far) {
        const rl = right - left;
        const tb = top - bottom;
        const fn = far - near;

        const out = new Float32Array(16);
        out[0] =  2 / rl;
        out[5] =  2 / tb;
        out[10] = -2 / fn;

        out[12] = -(right + left) / rl;
        out[13] = -(top + bottom) / tb;
        out[14] = -(far + near) / fn;
        out[15] = 1;

        return out;
    },

    // Build a 2D orthographic matrix based on current camera + viewport
    getCameraOrtho() {
        const r = window.FloRender;
        if (!r) return new Float32Array(16);

        const zoom = r.camera.zoom;
        const aspect = r.width / Math.max(1, r.height);

        const viewWidth = (r.width / zoom);
        const viewHeight = (r.height / zoom);

        const left   = r.camera.x - viewWidth  * 0.5;
        const right  = r.camera.x + viewWidth  * 0.5;
        const bottom = r.camera.y - viewHeight * 0.5;
        const top    = r.camera.y + viewHeight * 0.5;

        return this.createOrtho(left, right, bottom, top, -1, 1);
    },

    // ============================
    // COLORS
    // ============================
    // Convert #RRGGBB or #RGB → [r,g,b,a]
    colorFromHex(hex, alpha = 1.0) {
        if (!hex) return [1, 1, 1, alpha];

        let h = hex.replace("#", "").trim();

        if (h.length === 3) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }

        const r = parseInt(h.substring(0, 2), 16) / 255;
        const g = parseInt(h.substring(2, 4), 16) / 255;
        const b = parseInt(h.substring(4, 6), 16) / 255;

        return [r, g, b, alpha];
    },

    // Linear blend between two colors
    mixColors(c1, c2, t) {
        const out = [];
        for (let i = 0; i < 4; i++) {
            out[i] = c1[i] + (c2[i] - c1[i]) * t;
        }
        return out;
    },

    // ============================
    // SIMPLE QUAD GEOMETRY
    // ============================
    // Fullscreen quad (for heatmaps, overlays, etc.)
    createFullScreenQuad(gl) {
        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]);
        return this.createBuffer(gl, vertices, gl.STATIC_DRAW);
    }
};

// ======================================================================
// HOOK INTO RESIZE EVENT (OPTIONAL PER-RENDERER HANDLING)
// (Renderers can choose to use FloCore.getCameraOrtho() when drawing.)
// ======================================================================

console.log("FloMatrix Renderer Core loaded.");
