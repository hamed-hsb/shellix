// A binary split-pane tree for one tab. Leaves hold TerminalViews; internal
// nodes split their area into two children separated by a draggable divider.
//
// "vertical" splits stack children left|right (a vertical divider line);
// "horizontal" splits stack them top/bottom.

import { TerminalView } from '../terminal/TerminalView';

export type SplitOrientation = 'horizontal' | 'vertical';

/** Factory that produces a fresh terminal for a new leaf. */
export type LeafFactory = () => TerminalView;

interface Leaf {
    kind: 'leaf';
    parent: Split | null;
    el: HTMLElement;
    view: TerminalView;
}

interface Split {
    kind: 'split';
    parent: Split | null;
    el: HTMLElement;
    orientation: SplitOrientation;
    first: Node;
    second: Node;
    /** Flex ratio of the first child (0..1). */
    ratio: number;
}

type Node = Leaf | Split;

export class SplitTree {
    readonly element: HTMLElement;
    private root: Node;
    private active: Leaf;

    /** Invoked when the last leaf is closed so the owner can drop the tab. */
    onEmpty: (() => void) | null = null;
    /** Invoked when focus moves to a different leaf. */
    onActiveChange: (() => void) | null = null;

    constructor(private readonly makeLeaf: LeafFactory) {
        this.element = document.createElement('div');
        this.element.className = 'split-root';

        const leaf = this.createLeaf();
        this.root = leaf;
        this.active = leaf;
        this.element.appendChild(leaf.el);
    }

    /** Start the terminal in the initial leaf. */
    async start(): Promise<void> {
        await this.active.view.start();
        this.setActive(this.active);
    }

    /** The terminal in the currently focused leaf. */
    activeView(): TerminalView {
        return this.active.view;
    }

    focusActive(): void {
        this.active.view.focus();
    }

    /** Refit every terminal in the tree (e.g. after the tab becomes visible). */
    fitAll(): void {
        this.forEachLeaf(this.root, (leaf) => leaf.view.fitToContainer());
    }

    /** Split the focused leaf, opening a new terminal beside/below it. */
    split(orientation: SplitOrientation): void {
        const target = this.active;
        const newLeaf = this.createLeaf();

        const split: Split = {
            kind: 'split',
            parent: target.parent,
            el: document.createElement('div'),
            orientation,
            first: target,
            second: newLeaf,
            ratio: 0.5,
        };
        split.el.className = `split split-${orientation}`;

        // Re-parent the target under the new split, in its old DOM position.
        this.replaceInParent(target, split);
        target.parent = split;
        newLeaf.parent = split;

        this.renderSplit(split);

        void newLeaf.view.start().then(() => this.setActive(newLeaf));
        this.fitAll();
    }

    /** Close the focused leaf; collapses its parent split. */
    closeActive(): void {
        this.closeLeaf(this.active);
    }

    private closeLeaf(leaf: Leaf): void {
        leaf.view.dispose();

        const parent = leaf.parent;
        if (!parent) {
            // Closing the only leaf: the whole tab is now empty.
            this.onEmpty?.();
            return;
        }

        // Promote the sibling into the parent's slot.
        const sibling = parent.first === leaf ? parent.second : parent.first;
        sibling.parent = parent.parent;

        if (!parent.parent) {
            this.root = sibling;
            this.element.replaceChildren(sibling.el);
        } else {
            this.replaceInParent(parent, sibling);
        }

        this.setActive(this.firstLeaf(sibling));
        this.fitAll();
    }

    private createLeaf(): Leaf {
        const view = this.makeLeaf();
        const el = document.createElement('div');
        el.className = 'pane-leaf';
        el.appendChild(view.element);

        const leaf: Leaf = { kind: 'leaf', parent: null, el, view };

        // Focus tracking: clicking anywhere in the leaf makes it active.
        el.addEventListener('focusin', () => this.setActive(leaf));
        el.addEventListener('mousedown', () => this.setActive(leaf), true);

        view.onExit(() => this.closeLeaf(leaf));
        return leaf;
    }

    private setActive(leaf: Leaf): void {
        if (this.active === leaf && leaf.el.classList.contains('active')) return;
        this.active.el.classList.remove('active');
        this.active = leaf;
        leaf.el.classList.add('active');
        this.onActiveChange?.();
    }

    /** Swap `oldNode`'s element for `newNode`'s inside oldNode's parent split. */
    private replaceInParent(oldNode: Node, newNode: Node): void {
        const parent = oldNode.parent;
        if (!parent) {
            this.root = newNode;
            this.element.replaceChildren(newNode.el);
            return;
        }
        if (parent.first === oldNode) {
            parent.first = newNode;
        } else {
            parent.second = newNode;
        }
        this.renderSplit(parent);
    }

    /** (Re)build a split's DOM: firstEl, draggable divider, secondEl. */
    private renderSplit(split: Split): void {
        const divider = document.createElement('div');
        divider.className = `split-divider split-divider-${split.orientation}`;
        this.attachDividerDrag(split, divider);

        split.first.el.style.flex = `${split.ratio} 1 0`;
        split.second.el.style.flex = `${1 - split.ratio} 1 0`;

        split.el.replaceChildren(split.first.el, divider, split.second.el);
    }

    private attachDividerDrag(split: Split, divider: HTMLElement): void {
        divider.addEventListener('mousedown', (down: MouseEvent) => {
            down.preventDefault();
            const rect = split.el.getBoundingClientRect();
            const horizontal = split.orientation === 'vertical'; // side-by-side

            const onMove = (move: MouseEvent) => {
                const ratio = horizontal
                    ? (move.clientX - rect.left) / rect.width
                    : (move.clientY - rect.top) / rect.height;
                split.ratio = Math.min(0.9, Math.max(0.1, ratio));
                split.first.el.style.flex = `${split.ratio} 1 0`;
                split.second.el.style.flex = `${1 - split.ratio} 1 0`;
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.classList.remove('resizing');
                this.fitAll();
            };
            document.body.classList.add('resizing');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    private firstLeaf(node: Node): Leaf {
        let cur = node;
        while (cur.kind === 'split') cur = cur.first;
        return cur;
    }

    private forEachLeaf(node: Node, fn: (leaf: Leaf) => void): void {
        if (node.kind === 'leaf') {
            fn(node);
        } else {
            this.forEachLeaf(node.first, fn);
            this.forEachLeaf(node.second, fn);
        }
    }

    /** Apply a function to every terminal in the tree (e.g. live re-theming). */
    eachView(fn: (view: TerminalView) => void): void {
        this.forEachLeaf(this.root, (leaf) => fn(leaf.view));
    }

    /** Dispose every terminal in the tree (tab close). */
    dispose(): void {
        this.forEachLeaf(this.root, (leaf) => leaf.view.dispose());
    }
}
