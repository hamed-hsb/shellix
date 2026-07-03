// Workspace is the top-level UI controller: it owns the tabs, each tab's
// split-pane tree, the tab bar, command palette, connection dialog, global
// keyboard shortcuts and live config application.

import { SplitTree, type SplitOrientation } from '../layout/SplitTree';
import { TerminalView } from '../terminal/TerminalView';
import { TabBar } from './TabBar';
import { CommandPalette, type Command } from './CommandPalette';
import { ConnectionDialog } from './ConnectionDialog';
import { toast } from './toast';
import { matchesBinding } from './keys';
import { type AppConfig, resolveScheme, saveConfig } from '../config/config';
import { BUILTIN_SCHEMES } from '../config/theme';
import { type Profile, loadProfiles, persistProfiles } from '../config/profiles';
import type { SessionSpec } from '../backend/api';
import { GetConfigPath } from '../../wailsjs/go/main/App';

interface Tab {
    id: string;
    title: string;
    tree: SplitTree;
}

export class Workspace {
    readonly element: HTMLElement;
    private readonly tabBar: TabBar;
    private readonly body: HTMLElement;
    private readonly palette = new CommandPalette();
    private readonly dialog = new ConnectionDialog();

    private tabs: Tab[] = [];
    private activeId = '';
    private tabCounter = 0;
    private idCounter = 0;
    private profiles: Profile[] = [];

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

        this.element.append(this.tabBar.element, this.body, this.palette.element, this.dialog.element);
        this.registerShortcuts();
    }

    /** Load profiles, create the first tab and show it. */
    async init(): Promise<void> {
        this.profiles = await loadProfiles();
        await this.newTab();
    }

    private nextId(prefix: string): string {
        this.idCounter += 1;
        return `${prefix}-${this.idCounter}`;
    }

    /** Build a terminal for a spec, injecting the configured default shell for
     *  local sessions and the active theme/appearance. */
    private makeTerminal(spec: SessionSpec): TerminalView {
        const resolved: SessionSpec =
            spec.kind === 'local' && !spec.shell
                ? { ...spec, shell: this.config.shell || undefined }
                : spec;
        return new TerminalView({
            scheme: resolveScheme(this.config),
            appearance: this.config.appearance,
            spec: resolved,
        });
    }

    /** Open a new tab. Without a spec it is a local shell; with one it opens the
     *  connection in the first pane while later splits stay local. */
    async newTab(spec?: SessionSpec, title?: string): Promise<void> {
        this.tabCounter += 1;
        const tree = new SplitTree(
            () => this.makeTerminal({ kind: 'local' }),
            spec ? () => this.makeTerminal(spec) : undefined,
        );
        const tab: Tab = {
            id: this.nextId('tab'),
            title: title ?? `Terminal ${this.tabCounter}`,
            tree,
        };
        tree.onEmpty = () => this.closeTab(tab.id);
        tree.onActiveChange = () => this.renderTabs();

        this.tabs.push(tab);
        this.activeId = tab.id;
        this.renderTabs();
        this.showActive();
        await tree.start();
        tree.focusActive();
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

    // ---- Command palette ----

    private openPalette(): void {
        this.palette.show(this.buildCommands());
    }

    private buildCommands(): Command[] {
        const kb = this.config.keybindings;
        const commands: Command[] = [
            { id: 'new-tab', title: 'New Tab', hint: kb.newTab, run: () => void this.newTab() },
            { id: 'close-tab', title: 'Close Tab', hint: kb.closeTab, run: () => this.closeTab(this.activeId) },
            { id: 'split-v', title: 'Split Pane: Right', hint: kb.splitVertical, run: () => this.splitActive('vertical') },
            { id: 'split-h', title: 'Split Pane: Down', hint: kb.splitHorizontal, run: () => this.splitActive('horizontal') },
            { id: 'close-pane', title: 'Close Pane', hint: kb.closePane, run: () => this.closeActivePane() },
            { id: 'next-tab', title: 'Next Tab', hint: kb.nextTab, run: () => this.cycleTab(1) },
            { id: 'prev-tab', title: 'Previous Tab', hint: kb.prevTab, run: () => this.cycleTab(-1) },
            { id: 'ssh', title: 'New SSH Connection…', run: () => this.openConnectionDialog('ssh') },
            { id: 'telnet', title: 'New Telnet Connection…', run: () => this.openConnectionDialog('telnet') },
            { id: 'config-path', title: 'Show Config File Path', run: () => void this.showConfigPath() },
        ];

        // Theme switching.
        const schemes = { ...BUILTIN_SCHEMES, ...this.config.schemes };
        for (const [key, scheme] of Object.entries(schemes)) {
            commands.push({
                id: `theme-${key}`,
                title: `Theme: ${scheme.name}`,
                hint: 'appearance',
                run: () => this.setScheme(key),
            });
        }

        // Saved profiles.
        for (const profile of this.profiles) {
            commands.push({
                id: `profile-${profile.id}`,
                title: `Connect: ${profile.name}`,
                hint: profile.spec.kind,
                run: () => void this.newTab(profile.spec, profile.name),
            });
        }

        return commands;
    }

    private setScheme(key: string): void {
        this.config.scheme = key;
        this.applyConfig(this.config);
        void saveConfig(this.config);
    }

    private async showConfigPath(): Promise<void> {
        try {
            const path = await GetConfigPath();
            toast(path ? `Config: ${path}` : 'Config path unavailable');
        } catch {
            toast('Config path unavailable');
        }
    }

    private openConnectionDialog(kind: 'ssh' | 'telnet'): void {
        this.dialog.show(kind, (result) => {
            const spec = result.spec;
            const label =
                spec.kind === 'ssh'
                    ? `${spec.user}@${spec.host}`
                    : `${spec.kind}://${(spec as { host: string }).host}`;
            void this.newTab(spec, label);

            if (result.saveAs) {
                void this.addProfile(result.saveAs, spec);
            }
        });
    }

    private async addProfile(name: string, spec: SessionSpec): Promise<void> {
        const profile: Profile = { id: this.nextId('profile'), name, spec };
        this.profiles.push(profile);
        await persistProfiles(this.profiles);
        toast(`Saved profile “${name}”`);
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
                    [kb.commandPalette, () => this.openPalette()],
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
