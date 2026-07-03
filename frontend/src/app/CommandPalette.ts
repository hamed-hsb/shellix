// A VS Code-style command palette: fuzzy-filter a list of commands and run one
// with the keyboard. Opened via the configured shortcut (default Mod+Shift+P).

export interface Command {
    id: string;
    title: string;
    /** Right-aligned hint, e.g. a keybinding or category. */
    hint?: string;
    run: () => void;
}

export class CommandPalette {
    readonly element: HTMLElement;
    private readonly input: HTMLInputElement;
    private readonly list: HTMLElement;
    private commands: Command[] = [];
    private filtered: Command[] = [];
    private selected = 0;
    private open = false;

    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'palette-overlay';
        this.element.style.display = 'none';

        const panel = document.createElement('div');
        panel.className = 'palette-panel';

        this.input = document.createElement('input');
        this.input.className = 'palette-input';
        this.input.type = 'text';
        this.input.placeholder = 'Type a command…';
        this.input.spellcheck = false;

        this.list = document.createElement('div');
        this.list.className = 'palette-list';

        panel.append(this.input, this.list);
        this.element.appendChild(panel);

        // Clicking the backdrop dismisses.
        this.element.addEventListener('mousedown', (e) => {
            if (e.target === this.element) this.close();
        });
        this.input.addEventListener('input', () => this.refilter());
        this.input.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    /** Show the palette with a fresh set of commands. */
    show(commands: Command[]): void {
        this.commands = commands;
        this.open = true;
        this.element.style.display = 'flex';
        this.input.value = '';
        this.selected = 0;
        this.refilter();
        this.input.focus();
    }

    close(): void {
        if (!this.open) return;
        this.open = false;
        this.element.style.display = 'none';
    }

    isOpen(): boolean {
        return this.open;
    }

    private refilter(): void {
        const q = this.input.value.trim().toLowerCase();
        this.filtered = q
            ? this.commands
                  .map((c) => ({ c, score: fuzzyScore(c.title.toLowerCase(), q) }))
                  .filter((r) => r.score >= 0)
                  .sort((a, b) => a.score - b.score)
                  .map((r) => r.c)
            : this.commands.slice();
        this.selected = 0;
        this.renderList();
    }

    private renderList(): void {
        this.list.replaceChildren(
            ...this.filtered.map((cmd, i) => {
                const row = document.createElement('div');
                row.className = 'palette-item' + (i === this.selected ? ' palette-selected' : '');

                const title = document.createElement('span');
                title.className = 'palette-item-title';
                title.textContent = cmd.title;
                row.appendChild(title);

                if (cmd.hint) {
                    const hint = document.createElement('span');
                    hint.className = 'palette-item-hint';
                    hint.textContent = cmd.hint;
                    row.appendChild(hint);
                }

                row.addEventListener('mouseenter', () => {
                    this.selected = i;
                    this.updateSelection();
                });
                row.addEventListener('click', () => this.runSelected());
                return row;
            }),
        );
    }

    private updateSelection(): void {
        const rows = Array.from(this.list.children);
        rows.forEach((row, i) => {
            row.classList.toggle('palette-selected', i === this.selected);
        });
        rows[this.selected]?.scrollIntoView({ block: 'nearest' });
    }

    private onKeyDown(e: KeyboardEvent): void {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.move(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.move(-1);
                break;
            case 'Enter':
                e.preventDefault();
                this.runSelected();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    private move(delta: number): void {
        if (this.filtered.length === 0) return;
        this.selected = (this.selected + delta + this.filtered.length) % this.filtered.length;
        this.updateSelection();
    }

    private runSelected(): void {
        const cmd = this.filtered[this.selected];
        if (!cmd) return;
        this.close();
        cmd.run();
    }
}

/** Subsequence fuzzy match: returns a lower-is-better score, or -1 if q is not
 *  a subsequence of text. Contiguous and early matches score better. */
function fuzzyScore(text: string, q: string): number {
    let ti = 0;
    let score = 0;
    let lastMatch = -1;
    for (let qi = 0; qi < q.length; qi++) {
        const ch = q[qi];
        const found = text.indexOf(ch, ti);
        if (found === -1) return -1;
        // Penalise gaps between matched characters and later start positions.
        score += found - (lastMatch + 1);
        lastMatch = found;
        ti = found + 1;
    }
    return score;
}
