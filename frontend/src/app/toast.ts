// Minimal transient notification used for lightweight feedback (e.g. showing
// the config-file path or a save confirmation).

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

export function toast(message: string, durationMs = 3000): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    ensureContainer().appendChild(el);

    // Fade in on the next frame, then schedule removal.
    requestAnimationFrame(() => el.classList.add('toast-visible'));
    setTimeout(() => {
        el.classList.remove('toast-visible');
        setTimeout(() => el.remove(), 250);
    }, durationMs);
}
