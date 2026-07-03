// TerminalView binds one xterm.js terminal to one backend session. It is the
// reusable leaf used by both the Phase 1 single-terminal view and the Phase 2
// tab/split layouts.

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { Backend, type SessionSpec } from '../backend/api';
import {
    DEFAULT_APPEARANCE,
    DEFAULT_SCHEME,
    type Appearance,
    type ColorScheme,
} from '../config/theme';

export interface TerminalViewOptions {
    scheme?: ColorScheme;
    appearance?: Appearance;
    /** Connection to open; defaults to the OS local shell. */
    spec?: SessionSpec;
}

type ExitListener = (message: string) => void;

export class TerminalView {
    readonly element: HTMLElement;
    private readonly term: Terminal;
    private readonly fit: FitAddon;
    private backend: Backend | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private exitListeners: ExitListener[] = [];
    private disposed = false;
    private connected = false;

    /** True once the backend session was established (so its exit means the
     *  remote/shell ended, not that the connection failed to open). */
    get isConnected(): boolean {
        return this.connected;
    }

    constructor(private readonly opts: TerminalViewOptions = {}) {
        const appearance = opts.appearance ?? DEFAULT_APPEARANCE;
        const scheme = opts.scheme ?? DEFAULT_SCHEME;

        this.element = document.createElement('div');
        this.element.className = 'terminal-view';

        this.term = new Terminal({
            fontFamily: appearance.fontFamily,
            fontSize: appearance.fontSize,
            lineHeight: appearance.lineHeight,
            letterSpacing: appearance.letterSpacing,
            cursorBlink: appearance.cursorBlink,
            cursorStyle: appearance.cursorStyle,
            theme: scheme,
            allowProposedApi: true,
            scrollback: 10000,
            macOptionIsMeta: true,
        });

        this.fit = new FitAddon();
        this.term.loadAddon(this.fit);
        this.term.loadAddon(new WebLinksAddon());
        const unicode = new Unicode11Addon();
        this.term.loadAddon(unicode);
        this.term.unicode.activeVersion = '11';
    }

    /** Mount the terminal into the DOM, open the backend session and wire I/O. */
    async start(): Promise<void> {
        this.term.open(this.element);
        this.loadWebglIfAvailable();
        this.fit.fit();

        const { cols, rows } = this.term;
        const spec: SessionSpec = this.opts.spec ?? { kind: 'local' };
        try {
            this.backend = await Backend.open(spec, { cols, rows });
        } catch (err) {
            // Connection failures (e.g. SSH auth/host errors) are shown inline
            // rather than crashing the pane. The pane stays open so the user
            // can read the message.
            const msg = err instanceof Error ? err.message : String(err);
            this.term.write(`\r\n\x1b[31mConnection failed: ${msg}\x1b[0m\r\n`);
            for (const l of this.exitListeners) l(msg);
            return;
        }
        this.connected = true;

        // Backend output -> terminal.
        this.backend.onData((bytes) => this.term.write(bytes));
        this.backend.onExit((message) => {
            if (message) {
                this.term.write(`\r\n\x1b[31m[process exited: ${message}]\x1b[0m\r\n`);
            } else {
                this.term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n');
            }
            for (const l of this.exitListeners) l(message);
        });

        // Terminal input -> backend.
        this.term.onData((data) => this.backend?.write(data));
        // Terminal resize -> backend.
        this.term.onResize(({ cols, rows }) => this.backend?.resize(cols, rows));

        this.observeResize();
        this.focus();
    }

    /** WebGL rendering is a large speed-up but unavailable in some webviews. */
    private async loadWebglIfAvailable(): Promise<void> {
        try {
            const { WebglAddon } = await import('@xterm/addon-webgl');
            const addon = new WebglAddon();
            addon.onContextLoss(() => addon.dispose());
            this.term.loadAddon(addon);
        } catch {
            // Fall back to the DOM renderer silently.
        }
    }

    /** Refit the terminal to its container and propagate the new size. */
    fitToContainer(): void {
        if (this.disposed) return;
        try {
            this.fit.fit();
        } catch {
            // Element not visible yet; ignore.
        }
    }

    private observeResize(): void {
        this.resizeObserver = new ResizeObserver(() => this.fitToContainer());
        this.resizeObserver.observe(this.element);
    }

    onExit(listener: ExitListener): void {
        this.exitListeners.push(listener);
    }

    focus(): void {
        this.term.focus();
    }

    /** Apply a new colour scheme live. */
    applyScheme(scheme: ColorScheme): void {
        this.term.options.theme = scheme;
    }

    /** Apply new font/appearance settings live and refit. */
    applyAppearance(appearance: Appearance): void {
        this.term.options.fontFamily = appearance.fontFamily;
        this.term.options.fontSize = appearance.fontSize;
        this.term.options.lineHeight = appearance.lineHeight;
        this.term.options.letterSpacing = appearance.letterSpacing;
        this.term.options.cursorBlink = appearance.cursorBlink;
        this.term.options.cursorStyle = appearance.cursorStyle;
        this.fitToContainer();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.resizeObserver?.disconnect();
        this.backend?.dispose();
        this.term.dispose();
        this.element.remove();
    }
}
