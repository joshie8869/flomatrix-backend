// floengine.js
// ------------------------------------------------------------------
// Minimal FloMatrix prototype engine so the chart page loads cleanly
// without console errors. This is a stub we can upgrade later with
// real orderflow, feeds, DOM, etc.
// ------------------------------------------------------------------

(function () {
  console.log("[FloEngine] Prototype engine loaded.");

  // Try to find a canvas on the page (any <canvas>).
  // We keep this defensive so it never throws errors if the
  // markup changes or the canvas isn't there yet.
  const canvas = document.querySelector("canvas");
  if (!canvas) {
    console.warn("[FloEngine] No <canvas> element found. Engine idle.");
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.warn("[FloEngine] Unable to get 2D context. Engine idle.");
    return;
  }

  // Basic background so we know the engine touched the canvas.
  function resizeCanvasToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const displayWidth = Math.round(rect.width * dpr);
    const displayHeight = Math.round(rect.height * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    return { width: displayWidth, height: displayHeight };
  }

  function drawBackground() {
    const { width, height } = resizeCanvasToDisplaySize();

    // Deep dark background
    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, width, height);

    // Very subtle vertical grid lines
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#1b2335";
    ctx.lineWidth = 1;

    const stepX = Math.max(40, Math.floor(width / 24));
    for (let x = 0; x < width; x += stepX) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }

    // Subtle horizontal grid lines
    const stepY = Math.max(30, Math.floor(height / 16));
    for (let y = 0; y < height; y += stepY) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Placeholder text so we know it's alive
    ctx.font = "14px Inter, system-ui, -apple-system, BlinkMacSystemFont";
    ctx.fillStyle = "#6ce0a5";
    ctx.fillText("FloMatrix prototype engine — canvas ready", 24, 32);
  }

  // Initial draw + redraw on resize
  drawBackground();
  window.addEventListener("resize", drawBackground);
})();
