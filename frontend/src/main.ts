// Phase 1 entry point: open a single local-shell terminal that fills the
// window. Phase 2 replaces this with the tabbed, splittable workspace.

import '@xterm/xterm/css/xterm.css';
import './styles/app.css';

import { TerminalView } from './terminal/TerminalView';

const root = document.getElementById('app');
if (!root) {
    throw new Error('#app root element not found');
}

const view = new TerminalView();
root.appendChild(view.element);
void view.start();
