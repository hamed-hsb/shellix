// Application configuration model. Persisted as JSON on disk by the Go backend
// (see GetConfig/SaveConfig); this module defines the shape, defaults and
// merge logic used by the frontend.

import {
    DEFAULT_APPEARANCE,
    BUILTIN_SCHEMES,
    DEFAULT_SCHEME,
    type Appearance,
    type ColorScheme,
} from './theme';

/** Named keyboard shortcuts. Values use the "Mod+Shift+Key" convention where
 *  "Mod" is Cmd on macOS and Ctrl elsewhere. */
export interface Keybindings {
    newTab: string;
    closeTab: string;
    nextTab: string;
    prevTab: string;
    splitVertical: string;
    splitHorizontal: string;
    closePane: string;
    commandPalette: string;
}

export interface AppConfig {
    /** Active colour scheme key (into schemes) or a custom inline scheme. */
    scheme: string;
    /** Extra user-defined schemes, merged over the built-ins. */
    schemes: Record<string, ColorScheme>;
    appearance: Appearance;
    /** Default shell override; empty means the OS default. */
    shell: string;
    keybindings: Keybindings;
}

export const DEFAULT_KEYBINDINGS: Keybindings = {
    newTab: 'Mod+Shift+T',
    closeTab: 'Mod+Shift+W',
    nextTab: 'Ctrl+Tab',
    prevTab: 'Ctrl+Shift+Tab',
    splitVertical: 'Mod+Shift+E',
    splitHorizontal: 'Mod+Shift+D',
    closePane: 'Mod+Shift+X',
    commandPalette: 'Mod+Shift+P',
};

export const DEFAULT_CONFIG: AppConfig = {
    scheme: 'shellix-dark',
    schemes: {},
    appearance: DEFAULT_APPEARANCE,
    shell: '',
    keybindings: DEFAULT_KEYBINDINGS,
};

/** Deep-merge a partial (possibly from disk) onto the defaults so missing or
 *  malformed keys never break the app. */
export function normalizeConfig(partial: Partial<AppConfig> | null | undefined): AppConfig {
    const cfg = partial ?? {};
    return {
        scheme: cfg.scheme ?? DEFAULT_CONFIG.scheme,
        schemes: { ...(cfg.schemes ?? {}) },
        appearance: { ...DEFAULT_APPEARANCE, ...(cfg.appearance ?? {}) },
        shell: cfg.shell ?? '',
        keybindings: { ...DEFAULT_KEYBINDINGS, ...(cfg.keybindings ?? {}) },
    };
}

/** Resolve the active ColorScheme for a config, falling back to the default. */
export function resolveScheme(cfg: AppConfig): ColorScheme {
    const all: Record<string, ColorScheme> = { ...BUILTIN_SCHEMES, ...cfg.schemes };
    return all[cfg.scheme] ?? DEFAULT_SCHEME;
}
