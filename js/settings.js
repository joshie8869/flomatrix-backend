/* =====================================================================
   FloMatrix — CHART SETTINGS
   ---------------------------------------------------------------------
   Very simple theme / options manager on top of chartCore.
   Safe: will NOT crash if chart is not ready.
   ===================================================================== */

window.fmSettings = (function () {

    let current = {
        background: "#05060a",
        textColor: "#d3e2ff",
        showGrid: true,
        wicks: true,
    };

    // ------------------------------------------------------------
    // INIT — apply default visual style
    // ------------------------------------------------------------
    function init() {
        console.log("fmSettings: init");

        apply(current);
    }

    // ------------------------------------------------------------
    // APPLY SETTINGS TO CHART
    // ------------------------------------------------------------
    function apply(settings) {
        current = { ...current, ...(settings || {}) };

        if (!window.chartCore || typeof chartCore.applyChartSettings !== "function") {
            console.warn("fmSettings.apply: chartCore not ready");
            return;
        }

        chartCore.applyChartSettings(current);
    }

    // ------------------------------------------------------------
    // PUBLIC API
    // ------------------------------------------------------------
    return {
        init,
        apply,
        getCurrent: () => ({ ...current }),
    };

})();
