// Theme and appearance model. Phase 2 loads these from a JSON config file; the
// defaults here keep Phase 1 self-contained and give the terminal sensible
// colours out of the box.

import type { ITheme } from '@xterm/xterm';

/** A named colour scheme plus the ANSI palette, in xterm's ITheme shape. */
export interface ColorScheme extends ITheme {
    /** Human-readable name shown in the UI. */
    name: string;
}

/** Font and rendering preferences applied to every terminal. */
export interface Appearance {
    /** Font family stack. Include a Nerd/Powerline font first for glyph support. */
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    /** Extra letter spacing in pixels; helps some monospaced fonts. */
    letterSpacing: number;
    /** Window/background opacity from 0 (transparent) to 1 (opaque). */
    opacity: number;
    cursorBlink: boolean;
    cursorStyle: 'block' | 'underline' | 'bar';
}

/** The default dark scheme — a GitHub-dark inspired palette. */
export const DEFAULT_SCHEME: ColorScheme = {
    name: 'Shellix Dark',
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#58a6ff',
    cursorAccent: '#0d1117',
    selectionBackground: '#264f78',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#f0f6fc',
};

/** A light alternative, selectable via config. */
export const LIGHT_SCHEME: ColorScheme = {
    name: 'Shellix Light',
    background: '#ffffff',
    foreground: '#24292f',
    cursor: '#0969da',
    cursorAccent: '#ffffff',
    selectionBackground: '#b6d7ff',
    black: '#24292f',
    red: '#cf222e',
    green: '#116329',
    yellow: '#4d2d00',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#1a7f37',
    brightYellow: '#633c01',
    brightBlue: '#218bff',
    brightMagenta: '#a475f9',
    brightCyan: '#3192aa',
    brightWhite: '#8c959f',
};

export const DEFAULT_APPEARANCE: Appearance = {
    // These families degrade gracefully to the platform monospace font if the
    // Nerd Font variants are not installed.
    fontFamily:
        '"JetBrainsMono Nerd Font", "MesloLGS NF", "FiraCode Nerd Font", "Cascadia Code", Menlo, Consolas, "DejaVu Sans Mono", monospace',
    fontSize: 14,
    lineHeight: 1.2,
    letterSpacing: 0,
    opacity: 1,
    cursorBlink: true,
    cursorStyle: 'block',
};

export const BUILTIN_SCHEMES: Record<string, ColorScheme> = {
    'shellix-dark': DEFAULT_SCHEME,
    'shellix-light': LIGHT_SCHEME,
};
