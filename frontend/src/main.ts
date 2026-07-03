// Application entry point: mount the tabbed, splittable workspace.

import '@xterm/xterm/css/xterm.css';
import './styles/app.css';

import { Workspace } from './app/Workspace';
import { DEFAULT_CONFIG } from './config/config';

const root = document.getElementById('app');
if (!root) {
    throw new Error('#app root element not found');
}

const workspace = new Workspace(DEFAULT_CONFIG);
root.appendChild(workspace.element);
void workspace.init();
