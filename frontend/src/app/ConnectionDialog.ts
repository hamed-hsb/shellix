// A modal form for ad-hoc SSH/Telnet connections. It produces a SessionSpec and
// optionally a name under which to save the connection as a profile.

import type { SessionSpec } from '../backend/api';

export interface ConnectionResult {
    spec: SessionSpec;
    /** Non-empty when the user asked to save this as a profile. */
    saveAs: string;
}

type Kind = 'ssh' | 'telnet';

export class ConnectionDialog {
    readonly element: HTMLElement;
    private onSubmit: ((r: ConnectionResult) => void) | null = null;
    private kind: Kind = 'ssh';

    private fields!: {
        host: HTMLInputElement;
        port: HTMLInputElement;
        user: HTMLInputElement;
        password: HTMLInputElement;
        key: HTMLTextAreaElement;
        saveAs: HTMLInputElement;
    };
    private sshOnlyRows: HTMLElement[] = [];

    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'dialog-overlay';
        this.element.style.display = 'none';
        this.element.addEventListener('mousedown', (e) => {
            if (e.target === this.element) this.close();
        });
        this.build();
    }

    /** Open the dialog for a new connection of the given kind. */
    show(kind: Kind, onSubmit: (r: ConnectionResult) => void): void {
        this.kind = kind;
        this.onSubmit = onSubmit;
        this.applyKind();
        this.element.style.display = 'flex';
        this.fields.host.focus();
    }

    close(): void {
        this.element.style.display = 'none';
        this.onSubmit = null;
    }

    private build(): void {
        const panel = document.createElement('div');
        panel.className = 'dialog-panel';

        const title = document.createElement('div');
        title.className = 'dialog-title';
        title.textContent = 'New Connection';

        const host = inputRow('Host', 'example.com');
        const port = inputRow('Port', '22');
        const user = inputRow('User', 'root');
        const password = inputRow('Password', '');
        password.input.type = 'password';
        const keyRow = textareaRow('Private key (PEM, optional)');
        const saveAs = inputRow('Save as profile (optional)', 'My Server');

        this.fields = {
            host: host.input,
            port: port.input,
            user: user.input,
            password: password.input,
            key: keyRow.textarea,
            saveAs: saveAs.input,
        };
        this.sshOnlyRows = [user.row, password.row, keyRow.row];

        const buttons = document.createElement('div');
        buttons.className = 'dialog-buttons';
        const cancel = button('Cancel', 'dialog-btn', () => this.close());
        const connect = button('Connect', 'dialog-btn dialog-btn-primary', () => this.submit());
        buttons.append(cancel, connect);

        panel.append(
            title,
            host.row,
            port.row,
            user.row,
            password.row,
            keyRow.row,
            saveAs.row,
            buttons,
        );
        this.element.appendChild(panel);

        // Enter submits from any single-line field.
        for (const el of [host.input, port.input, user.input, password.input, saveAs.input]) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.submit();
                else if (e.key === 'Escape') this.close();
            });
        }
    }

    private applyKind(): void {
        const isSSH = this.kind === 'ssh';
        for (const row of this.sshOnlyRows) row.style.display = isSSH ? '' : 'none';
        this.fields.port.value = isSSH ? '22' : '23';
    }

    private submit(): void {
        const host = this.fields.host.value.trim();
        if (!host) {
            this.fields.host.focus();
            return;
        }
        const port = parseInt(this.fields.port.value, 10) || (this.kind === 'ssh' ? 22 : 23);

        let spec: SessionSpec;
        if (this.kind === 'ssh') {
            spec = {
                kind: 'ssh',
                host,
                port,
                user: this.fields.user.value.trim() || 'root',
                password: this.fields.password.value,
                privateKeyPem: this.fields.key.value.trim(),
            };
        } else {
            spec = { kind: 'telnet', host, port };
        }

        const result: ConnectionResult = { spec, saveAs: this.fields.saveAs.value.trim() };
        const cb = this.onSubmit;
        this.close();
        cb?.(result);
    }
}

function inputRow(label: string, placeholder: string): { row: HTMLElement; input: HTMLInputElement } {
    const row = document.createElement('label');
    row.className = 'dialog-row';
    const span = document.createElement('span');
    span.className = 'dialog-label';
    span.textContent = label;
    const input = document.createElement('input');
    input.className = 'dialog-input';
    input.placeholder = placeholder;
    input.spellcheck = false;
    row.append(span, input);
    return { row, input };
}

function textareaRow(label: string): { row: HTMLElement; textarea: HTMLTextAreaElement } {
    const row = document.createElement('label');
    row.className = 'dialog-row';
    const span = document.createElement('span');
    span.className = 'dialog-label';
    span.textContent = label;
    const textarea = document.createElement('textarea');
    textarea.className = 'dialog-input dialog-textarea';
    textarea.rows = 3;
    textarea.spellcheck = false;
    row.append(span, textarea);
    return { row, textarea };
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
}
