// Typed wrapper around the Wails-generated bindings and runtime events.
//
// Terminal output arrives as base64-encoded raw bytes over "session:data:<id>"
// events; this module decodes them and exposes an ergonomic per-session API so
// the rest of the frontend never touches window['go'] or the event bus
// directly. A session may be a local shell, SSH or Telnet — all share the same
// data/exit event contract once created.

import {
    CreateLocalSession,
    CreateSSHSession,
    CreateTelnetSession,
    SendInput,
    ResizeSession,
    CloseSession,
} from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

export interface LocalSpec {
    kind: 'local';
    shell?: string;
    cwd?: string;
}

export interface SSHSpec {
    kind: 'ssh';
    host: string;
    port?: number;
    user: string;
    password?: string;
    privateKeyPem?: string;
    passphrase?: string;
}

export interface TelnetSpec {
    kind: 'telnet';
    host: string;
    port?: number;
}

/** A connection description resolved into a live backend session. */
export type SessionSpec = LocalSpec | SSHSpec | TelnetSpec;

interface Dimensions {
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

async function createSession(spec: SessionSpec, dim: Dimensions): Promise<string> {
    switch (spec.kind) {
        case 'local':
            return CreateLocalSession({
                shell: spec.shell ?? '',
                cwd: spec.cwd ?? '',
                cols: dim.cols,
                rows: dim.rows,
            });
        case 'ssh':
            return CreateSSHSession({
                host: spec.host,
                port: spec.port ?? 22,
                user: spec.user,
                password: spec.password ?? '',
                privateKeyPem: spec.privateKeyPem ?? '',
                passphrase: spec.passphrase ?? '',
                cols: dim.cols,
                rows: dim.rows,
            });
        case 'telnet':
            return CreateTelnetSession({
                host: spec.host,
                port: spec.port ?? 23,
                cols: dim.cols,
                rows: dim.rows,
            });
    }
}

/**
 * Backend represents a single live terminal session in the Go process. It is
 * obtained from Backend.open() and drives one xterm.js instance.
 */
export class Backend {
    private disposed = false;

    private constructor(public readonly id: string) {}

    /** Open a session for the given spec and resolve once it has its ID. */
    static async open(spec: SessionSpec, dim: Dimensions): Promise<Backend> {
        const id = await createSession(spec, dim);
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
