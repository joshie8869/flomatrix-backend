// src/ui/controls.ts
import type { Timeframe, IndicatorId } from '../types';

interface ControlCallbacks {
    onTimeframeChange: (tf: Timeframe) => void;
    onIndicatorToggle: (id: IndicatorId, enabled: boolean) => void;
}

export function wireControls(callbacks: ControlCallbacks) {
    // Timeframe buttons
    const tfButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.tf-btn')
    );

    tfButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const interval = btn.dataset.interval as Timeframe | undefined;
            if (!interval) return;

            tfButtons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            callbacks.onTimeframeChange(interval);
        });
    });

    // Indicators checkboxes
    const checkboxes = Array.from(
        document.querySelectorAll<HTMLDivElement>('.checkbox')
    );

    checkboxes.forEach((box) => {
        box.addEventListener('click', () => {
            const id = box.dataset.toggle as IndicatorId | undefined;
            if (!id) return;

            const current = box.getAttribute('data-checked') === 'true';
            const next = !current;
            box.setAttribute('data-checked', next ? 'true' : 'false');
            box.textContent = next ? '✓' : '';
            callbacks.onIndicatorToggle(id, next);
        });
    });
}
