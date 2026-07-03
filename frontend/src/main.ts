// Application entry point: load settings, then mount the tabbed, splittable
// workspace.

import '@xterm/xterm/css/xterm.css';
import './styles/app.css';

import { Workspace } from './app/Workspace';
import { loadConfig } from './config/config';

async function main(): Promise<void> {
    const root = document.getElementById('app');
    if (!root) {
        throw new Error('#app root element not found');
    }

    const config = await loadConfig();
    const workspace = new Workspace(config);
    root.appendChild(workspace.element);
    await workspace.init();
}

void main();
