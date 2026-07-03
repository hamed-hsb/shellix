// Typed wrapper around the Wails-generated bindings and runtime events.
//
// Terminal output arrives as base64-encoded raw bytes over "session:data:<id>"
// events; this module decodes them and exposes an ergonomic per-session API so
// the rest of the frontend never touches window['go'] or the event bus
// directly.

import {
    CreateLocalSession,
    SendInput,
    ResizeSession,
    CloseSession,
    type CreateSessionRequest,
} from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

export interface LocalSessionOptions {
    shell?: string;
    cwd?: string;
    cols: number;
    rows: number;
}

const dataEvent = (id: string) => `session:data:${id}`;
const exitEvent = (id: string) => `session:exit:${id}`;

/** Decode a base64 string into raw bytes for xterm.js. */
function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Backend represents a single live terminal session in the Go process. It is
 * obtained from openLocalSession() and drives one xterm.js instance.
 */
export class Backend {
    private disposed = false;

    private constructor(public readonly id: string) {}

    /** Open a local shell session and resolve once the backend has its ID. */
    static async openLocal(opts: LocalSessionOptions): Promise<Backend> {
        const req: CreateSessionRequest = {
            shell: opts.shell ?? '',
            cwd: opts.cwd ?? '',
            cols: opts.cols,
            rows: opts.rows,
        };
        const id = await CreateLocalSession(req);
        return new Backend(id);
    }

    /** Subscribe to raw output bytes from the session. */
    onData(handler: (bytes: Uint8Array) => void): void {
        EventsOn(dataEvent(this.id), (b64: string) => handler(base64ToBytes(b64)));
    }

    /**
     * Subscribe to session termination. message is empty on a clean exit or
     * carries the backend error otherwise.
     */
    onExit(handler: (message: string) => void): void {
        EventsOn(exitEvent(this.id), (message: string) => handler(message ?? ''));
    }

    /** Send user keystrokes to the shell. */
    write(data: string): void {
        void SendInput(this.id, data);
    }

    /** Inform the backend of a new terminal size in character cells. */
    resize(cols: number, rows: number): void {
        void ResizeSession(this.id, cols, rows);
    }

    /** Terminate the session and remove its event listeners. */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        EventsOff(dataEvent(this.id));
        EventsOff(exitEvent(this.id));
        void CloseSession(this.id);
    }
}
