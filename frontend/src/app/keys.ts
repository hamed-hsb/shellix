// Keyboard-shortcut matching. Bindings are written as "Mod+Shift+T" where the
// tokens are joined with "+". "Mod" resolves to Cmd on macOS and Ctrl on other
// platforms so the same config works everywhere.

const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

interface ParsedBinding {
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    alt: boolean;
    key: string; // lowercased
}

function parse(binding: string): ParsedBinding {
    const parts = binding.split('+').map((p) => p.trim());
    const parsed: ParsedBinding = { ctrl: false, meta: false, shift: false, alt: false, key: '' };
    for (const part of parts) {
        switch (part.toLowerCase()) {
            case 'mod':
                if (isMac) parsed.meta = true;
                else parsed.ctrl = true;
                break;
            case 'ctrl':
            case 'control':
                parsed.ctrl = true;
                break;
            case 'cmd':
            case 'meta':
            case 'super':
                parsed.meta = true;
                break;
            case 'shift':
                parsed.shift = true;
                break;
            case 'alt':
            case 'option':
                parsed.alt = true;
                break;
            default:
                parsed.key = part.toLowerCase();
        }
    }
    return parsed;
}

/** Report whether a keyboard event satisfies a binding string. */
export function matchesBinding(e: KeyboardEvent, binding: string): boolean {
    const b = parse(binding);
    return (
        e.ctrlKey === b.ctrl &&
        e.metaKey === b.meta &&
        e.shiftKey === b.shift &&
        e.altKey === b.alt &&
        e.key.toLowerCase() === b.key
    );
}
