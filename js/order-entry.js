/* =====================================================================
   FloMatrix Terminal — ORDER ENTRY ENGINE
   ---------------------------------------------------------------------
   This module controls the floating ORDER ENTRY panel:
     • Reads symbol, provider, type, qty, price
     • Applies user settings (confirmations, brackets)
     • Builds order payload
     • Sends to backend (stub endpoint) for real routing
     • Provides local feedback & basic validation

   Public API (used by terminal.js):
     • initPanel({ panelEl, qtyEl, priceEl, typeEl })
     • applySettings({ confirmOrders, bracketOrders })
     • setSymbolProvider(symbol, provider)
     • submit("buy" | "sell")
   ===================================================================== */

window.orderEntry = (function () {

    // -----------------------------------------------------------------
    // Internal state
    // -----------------------------------------------------------------
    let panelEl     = null;
    let qtyEl       = null;
    let priceEl     = null;
    let typeEl      = null;

    let currentSymbol   = "BTCUSD";
    let currentProvider = "kraken";

    let settings = {
        confirmOrders: true,
        bracketOrders: false
    };

    // Simple in-memory order log for later PnL sim
    let localOrders = [];

    // -----------------------------------------------------------------
    // INIT
    // -----------------------------------------------------------------
    function initPanel(opts) {
        panelEl = opts.panelEl;
        qtyEl   = opts.qtyEl;
        priceEl = opts.priceEl;
        typeEl  = opts.typeEl;

        if (panelEl) {
            // Show/hide could later be controlled via a hotkey or button
            panelEl.classList.remove("hidden");
        }

        console.log("orderEntry: panel initialized");
    }

    // -----------------------------------------------------------------
    // APPLY SETTINGS (from fmSettings)
    // -----------------------------------------------------------------
    function applySettings(s) {
        settings = {
            ...settings,
            ...s
        };
        console.log("orderEntry: settings updated", settings);
    }

    // -----------------------------------------------------------------
    // SET SYMBOL + PROVIDER
    // -----------------------------------------------------------------
    function setSymbolProvider(symbol, provider) {
        currentSymbol = symbol || currentSymbol;
        currentProvider = provider || currentProvider;
        console.log(`orderEntry: set symbol=${currentSymbol}, provider=${currentProvider}`);
    }

    // -----------------------------------------------------------------
    // SUBMIT ORDER
    // -----------------------------------------------------------------
    async function submit(side) {
        if (!qtyEl || !typeEl) {
            console.error("orderEntry: panel not initialized");
            return;
        }

        const qty  = parseFloat(qtyEl.value || "0");
        const type = typeEl.value || "market";
        const rawPrice = priceEl ? priceEl.value : "";

        // Basic validation
        if (!currentSymbol || !currentSymbol.trim()) {
            warn("No symbol selected");
            return;
        }
        if (!qty || qty <= 0) {
            warn("Quantity must be > 0");
            return;
        }

        let price = null;
        if (type !== "market") {
            price = parseFloat(rawPrice || "0");
            if (!price || price <= 0) {
                warn("Price must be > 0 for non-market orders");
                return;
            }
        }

        // Confirmation
        if (settings.confirmOrders) {
            const msg = [
                `Confirm ${side.toUpperCase()} order:`,
                `Symbol: ${currentSymbol}`,
                `Provider: ${currentProvider}`,
                `Type: ${type.toUpperCase()}`,
                `Qty: ${qty}`,
                price ? `Price: ${price}` : "Price: MARKET"
            ].join("\n");

            const ok = window.confirm(msg);
            if (!ok) {
                info("Order cancelled");
                return;
            }
        }

        const now = new Date().toISOString();

        const baseOrder = {
            side,
            symbol: currentSymbol,
            provider: currentProvider,
            type,
            qty,
            price: price || null,
            time: now,
            status: "PENDING",
            clientId: generateClientId()
        };

        let orderPayload = baseOrder;

        // Optional: bracket orders (TP/SL)
        if (settings.bracketOrders && price) {
            const tp = +(price * (side === "buy" ? 1.01 : 0.99)).toFixed(2);
            const sl = +(price * (side === "buy" ? 0.99 : 1.01)).toFixed(2);

            orderPayload = {
                ...baseOrder,
                bracket: {
                    takeProfit: tp,
                    stopLoss: sl
                }
            };
        }

        // Append to local log
        localOrders.push(orderPayload);

        // Try sending to backend (stub endpoint)
        try {
            await sendToBackend(orderPayload);
            success(`Order sent: ${side.toUpperCase()} ${qty} ${currentSymbol}`);
        } catch (e) {
            console.error("orderEntry: backend error", e);
            error("Order send failed (backend stub). Check console.");
        }
    }

    // -----------------------------------------------------------------
    // BACKEND INTEGRATION (STUB) — replace with real FastAPI routes
    // -----------------------------------------------------------------
    async function sendToBackend(order) {
        // NOTE:
        // Replace `/api/orders` with your real FastAPI endpoint, for example:
        //   POST https://flomatrix.trade/api/v1/orders
        //
        // The backend would:
        //   - Validate subscription / permissions
        //   - Map symbol/provider to real routing (dxFeed, Rithmic, etc.)
        //   - Place order via broker / FCM
        //   - Return status / orderId
        //
        // For now, this is a safe stub — it won’t break if no API exists.

        const token = localStorage.getItem("fm_auth_token");
        const url = `https://${location.host}/api/orders`;

        // Soft fail if API does not exist; we just simulate success.
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify(order)
            });

            if (!res.ok) {
                // Non-fatal: log error, but platform still runs
                console.warn("orderEntry: backend responded with", res.status);
            }

            return;
        } catch (e) {
            // If fetch fails (no backend yet), treat it as simulated environment
            console.warn("orderEntry: backend fetch failed (likely stub)", e);
            return;
        }
    }

    // -----------------------------------------------------------------
    // UTIL — client id
    // -----------------------------------------------------------------
    function generateClientId() {
        return "FM-" + Math.random().toString(36).substring(2, 8).toUpperCase() +
               "-" + Date.now().toString(36).toUpperCase();
    }

    // -----------------------------------------------------------------
    // UI FEEDBACK HELPERS (simple for now, can become toast system)
    // -----------------------------------------------------------------
    function info(msg) {
        console.log("[INFO]", msg);
    }
    function warn(msg) {
        console.warn("[WARN]", msg);
        if (window.alert) alert(msg);
    }
    function error(msg) {
        console.error("[ERROR]", msg);
        if (window.alert) alert(msg);
    }
    function success(msg) {
        console.log("[OK]", msg);
        // Later: toast pop-up instead of alert
    }

    // -----------------------------------------------------------------
    // EXPORT
    // -----------------------------------------------------------------
    return {
        initPanel,
        applySettings,
        setSymbolProvider,
        submit
    };

})();
