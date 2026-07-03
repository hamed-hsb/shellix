// Workspace is the top-level UI controller: it owns the tabs, each tab's
// split-pane tree, the tab bar, global keyboard shortcuts and live config
// application.

import { SplitTree, type SplitOrientation } from '../layout/SplitTree';
import { TerminalView } from '../terminal/TerminalView';
import { TabBar } from './TabBar';
import { matchesBinding } from './keys';
import { type AppConfig, resolveScheme } from '../config/config';

interface Tab {
    id: string;
    title: string;
    tree: SplitTree;
}

export class Workspace {
    readonly element: HTMLElement;
    private readonly tabBar: TabBar;
    private readonly body: HTMLElement;

    private tabs: Tab[] = [];
    private activeId = '';
    private tabCounter = 0;
    private idCounter = 0;

    /** Wired by main.ts to open the command palette (Phase 4). */
    commandPaletteHandler: (() => void) | null = null;

    constructor(private config: AppConfig) {
        this.element = document.createElement('div');
        this.element.className = 'workspace';

        this.tabBar = new TabBar({
            onSelect: (id) => this.activate(id),
            onClose: (id) => this.closeTab(id),
            onRename: (id, title) => this.renameTab(id, title),
            onNew: () => void this.newTab(),
        });

        this.body = document.createElement('div');
        this.body.className = 'workspace-body';

        this.element.append(this.tabBar.element, this.body);
        this.registerShortcuts();
    }

    /** Create the first tab and show it. */
    async init(): Promise<void> {
        await this.newTab();
    }

    private nextId(prefix: string): string {
        this.idCounter += 1;
        return `${prefix}-${this.idCounter}`;
    }

    /** Build a terminal configured from the current app config. */
    private makeTerminal(): TerminalView {
        return new TerminalView({
            scheme: resolveScheme(this.config),
            appearance: this.config.appearance,
            session: { shell: this.config.shell || undefined },
        });
    }

    async newTab(): Promise<void> {
        this.tabCounter += 1;
        const tab: Tab = {
            id: this.nextId('tab'),
            title: `Terminal ${this.tabCounter}`,
            tree: new SplitTree(() => this.makeTerminal()),
        };
        tab.tree.onEmpty = () => this.closeTab(tab.id);
        tab.tree.onActiveChange = () => this.renderTabs();

        this.tabs.push(tab);
        this.activeId = tab.id;
        this.renderTabs();
        this.showActive();
        await tab.tree.start();
        tab.tree.focusActive();
    }

    closeTab(id: string): void {
        const idx = this.tabs.findIndex((t) => t.id === id);
        if (idx === -1) return;

        const [tab] = this.tabs.splice(idx, 1);
        tab.tree.dispose();

        if (this.tabs.length === 0) {
            // Never leave the user with an empty window.
            void this.newTab();
            return;
        }
        if (this.activeId === id) {
            const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
            this.activeId = next.id;
        }
        this.renderTabs();
        this.showActive();
    }

    activate(id: string): void {
        if (this.activeId === id) return;
        this.activeId = id;
        this.renderTabs();
        this.showActive();
    }

    renameTab(id: string, title: string): void {
        const tab = this.tabs.find((t) => t.id === id);
        if (!tab) return;
        tab.title = title;
        this.renderTabs();
    }

    private activeTab(): Tab | undefined {
        return this.tabs.find((t) => t.id === this.activeId);
    }

    splitActive(orientation: SplitOrientation): void {
        this.activeTab()?.tree.split(orientation);
    }

    closeActivePane(): void {
        this.activeTab()?.tree.closeActive();
    }

    private cycleTab(delta: number): void {
        const idx = this.tabs.findIndex((t) => t.id === this.activeId);
        if (idx === -1) return;
        const next = (idx + delta + this.tabs.length) % this.tabs.length;
        this.activate(this.tabs[next].id);
    }

    /** Swap the visible tree in the body and refit its terminals. */
    private showActive(): void {
        const tab = this.activeTab();
        if (!tab) return;
        this.body.replaceChildren(tab.tree.element);
        // Defer until the element has its final size in the layout.
        requestAnimationFrame(() => {
            tab.tree.fitAll();
            tab.tree.focusActive();
        });
    }

    private renderTabs(): void {
        this.tabBar.render(
            this.tabs.map((t) => ({ id: t.id, title: t.title })),
            this.activeId,
        );
    }

    /** Re-apply config (theme, fonts) to every open terminal without a restart. */
    applyConfig(config: AppConfig): void {
        this.config = config;
        const scheme = resolveScheme(config);
        for (const tab of this.tabs) {
            tab.tree.eachView((view) => {
                view.applyScheme(scheme);
                view.applyAppearance(config.appearance);
            });
        }
    }

    private registerShortcuts(): void {
        window.addEventListener(
            'keydown',
            (e) => {
                const kb = this.config.keybindings;
                const actions: Array<[string, () => void]> = [
                    [kb.newTab, () => void this.newTab()],
                    [kb.closeTab, () => this.closeTab(this.activeId)],
                    [kb.nextTab, () => this.cycleTab(1)],
                    [kb.prevTab, () => this.cycleTab(-1)],
                    [kb.splitVertical, () => this.splitActive('vertical')],
                    [kb.splitHorizontal, () => this.splitActive('horizontal')],
                    [kb.closePane, () => this.closeActivePane()],
                    [kb.commandPalette, () => this.commandPaletteHandler?.()],
                ];
                for (const [binding, run] of actions) {
                    if (matchesBinding(e, binding)) {
                        e.preventDefault();
                        e.stopPropagation();
                        run();
                        return;
                    }
                }
            },
            true, // capture: intercept before xterm's own handlers
        );
    }
}
