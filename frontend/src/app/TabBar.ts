// The tab strip. Purely presentational: it renders the tab list and reports
// user intent (select/close/rename/new) through callbacks.

export interface TabDescriptor {
    id: string;
    title: string;
}

export interface TabBarCallbacks {
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onNew: () => void;
}

export class TabBar {
    readonly element: HTMLElement;
    private readonly list: HTMLElement;

    constructor(private readonly cb: TabBarCallbacks) {
        this.element = document.createElement('div');
        this.element.className = 'tab-bar';

        this.list = document.createElement('div');
        this.list.className = 'tab-list';

        const newBtn = document.createElement('button');
        newBtn.className = 'tab-new';
        newBtn.title = 'New tab';
        newBtn.textContent = '+';
        newBtn.addEventListener('click', () => this.cb.onNew());

        this.element.append(this.list, newBtn);
    }

    render(tabs: TabDescriptor[], activeId: string): void {
        this.list.replaceChildren(
            ...tabs.map((tab) => this.renderTab(tab, tab.id === activeId)),
        );
    }

    private renderTab(tab: TabDescriptor, active: boolean): HTMLElement {
        const el = document.createElement('div');
        el.className = 'tab' + (active ? ' tab-active' : '');

        const label = document.createElement('span');
        label.className = 'tab-label';
        label.textContent = tab.title;
        label.addEventListener('click', () => this.cb.onSelect(tab.id));
        // Double-click to rename inline.
        label.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.beginRename(tab, label);
        });

        const close = document.createElement('button');
        close.className = 'tab-close';
        close.textContent = '×';
        close.title = 'Close tab';
        close.addEventListener('click', (e) => {
            e.stopPropagation();
            this.cb.onClose(tab.id);
        });

        el.append(label, close);
        return el;
    }

    private beginRename(tab: TabDescriptor, label: HTMLElement): void {
        const input = document.createElement('input');
        input.className = 'tab-rename';
        input.value = tab.title;
        label.replaceWith(input);
        input.focus();
        input.select();

        const commit = () => {
            const value = input.value.trim();
            this.cb.onRename(tab.id, value || tab.title);
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            else if (e.key === 'Escape') {
                input.value = tab.title;
                input.blur();
            }
        });
    }
}
