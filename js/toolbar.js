/* =======================
   TOOLBAR STYLES
   ======================= */
#fm-toolbar {
    width: 100%;
    height: 48px;
    display: flex;
    align-items: center;
    gap: 28px;
    padding: 6px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(10, 12, 20, 0.7);
    backdrop-filter: blur(6px);
}

.tb-section {
    display: flex;
    gap: 10px;
}

.tb-btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #d8e4f0;
    cursor: pointer;
    transition: 0.15s;
}

.tb-btn:hover {
    background: rgba(255,255,255,0.12);
}

.tb-btn.active {
    background: #4afd78;
    border-color: #4afd78;
    color: #000;
}
