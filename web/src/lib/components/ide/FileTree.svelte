<script lang="ts" module>
	export interface TreeNode {
		name: string;
		/** Relative to /workspace; a folder's has no trailing "/". */
		path: string;
		folder: boolean;
		children: TreeNode[];
	}

	/** Paths (folders end in "/") to a tree, folders first, each level sorted by name. */
	export function buildTree(entries: string[]): TreeNode[] {
		const root: TreeNode = { name: '', path: '', folder: true, children: [] };
		const folders = new Map<string, TreeNode>([['', root]]);
		const folderOf = (path: string): TreeNode => {
			const found = folders.get(path);
			if (found) return found;
			const cut = path.lastIndexOf('/');
			const node: TreeNode = { name: path.slice(cut + 1), path, folder: true, children: [] };
			folderOf(cut < 0 ? '' : path.slice(0, cut)).children.push(node);
			folders.set(path, node);
			return node;
		};
		for (const entry of entries) {
			if (entry.endsWith('/')) {
				folderOf(entry.slice(0, -1));
				continue;
			}
			const cut = entry.lastIndexOf('/');
			folderOf(cut < 0 ? '' : entry.slice(0, cut)).children.push({
				name: entry.slice(cut + 1),
				path: entry,
				folder: false,
				children: []
			});
		}
		const sort = (nodes: TreeNode[]) => {
			nodes.sort((a, b) => (a.folder === b.folder ? a.name.localeCompare(b.name) : a.folder ? -1 : 1));
			for (const n of nodes) if (n.folder) sort(n.children);
		};
		sort(root.children);
		return root.children;
	}
</script>

<script lang="ts">
	import {
		ChevronDown,
		ChevronRight,
		ChevronsDownUp,
		ClipboardCopy,
		ClipboardPaste,
		Copy,
		CopyPlus,
		FileCode2,
		FilePlus,
		Folder,
		FolderOpen,
		FolderPlus,
		Pencil,
		RefreshCw,
		Scissors,
		Trash2
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	/**
	 * The project's files, as VS Code's Explorer: folders collapse, a click opens
	 * a file, new file, new folder, rename and delete happen in place, and files
	 * and folders are dragged into another folder (or to the top level) to move them.
	 * A right-click, or a long press on a touch screen, opens a menu with Cut,
	 * Copy and Paste among the rest. On a touch screen a row is dragged by holding
	 * it and then moving. Folders the box skips (node_modules, target) are listed
	 * but empty.
	 */

	interface Props {
		title: string;
		entries: string[];
		activePath: string | null;
		/** Error and warning counts per file, to colour names as VS Code does. */
		problems: Map<string, { errors: number; warnings: number }>;
		onOpen: (path: string) => void;
		onCreate: (path: string, folder: boolean) => void;
		/** Renames and moves. */
		onRename: (from: string, to: string) => void;
		onCopy: (from: string, to: string) => void;
		onDelete: (path: string, folder: boolean) => void;
		onRefresh: () => void;
		/** A folder was opened: the page loads one whose contents the box listing left out. */
		onExpand?: (path: string) => void;
	}

	let { title, entries, activePath, problems, onOpen, onCreate, onRename, onCopy, onDelete, onRefresh, onExpand }: Props = $props();

	/** Build output and installs: listed dimmed, as VS Code dims ignored files, and loaded when opened. */
	const SKIPPED = new Set(['node_modules', 'target', '.venv', '__pycache__', 'build']);
	const inSkipped = (path: string) => path.split('/').some((part) => SKIPPED.has(part));
	const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')));
	const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
	const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

	const tree = $derived(buildTree(entries));
	let expanded = $state(new Set<string>(['src', 'lib']));
	/** The folder new files go in: the one last clicked, or the open file's. */
	let selectedDir = $state('');
	let treeEl: HTMLDivElement;

	/** What is being typed in: a new entry in `dir`, or a new name for `path`. */
	let editing = $state<{ kind: 'file' | 'folder'; dir: string } | { kind: 'rename'; path: string } | null>(null);

	// The open file's folders open, so it shows in the tree.
	$effect(() => {
		if (!activePath) return;
		const parts = activePath.split('/').slice(0, -1);
		const next = new Set(expanded);
		let grew = false;
		for (let i = 1; i <= parts.length; i++) {
			const dir = parts.slice(0, i).join('/');
			if (!next.has(dir)) {
				next.add(dir);
				grew = true;
			}
		}
		if (grew) expanded = next;
	});

	function open(dir: string) {
		if (!dir || expanded.has(dir)) return;
		expanded = new Set([...expanded, dir]);
		onExpand?.(dir);
	}

	function toggle(path: string) {
		const next = new Set(expanded);
		if (next.has(path)) next.delete(path);
		else {
			next.add(path);
			onExpand?.(path);
		}
		expanded = next;
		selectedDir = path;
	}

	function startNew(kind: 'file' | 'folder', dir = selectedDir) {
		if (dir) expanded = new Set([...expanded, dir]);
		selectedDir = dir;
		editing = { kind, dir };
	}

	function commit(text: string) {
		const state = editing;
		editing = null;
		const name = text.trim().replace(/^\/+|\/+$/g, '');
		if (!state || !name) return;
		if (state.kind === 'rename') {
			const to = join(parentOf(state.path), name);
			if (to !== state.path) onRename(state.path, to);
			return;
		}
		onCreate(join(state.dir, name), state.kind === 'folder');
	}

	const focusInput = (node: HTMLInputElement) => {
		node.focus();
		// A rename selects the name without its extension, as VS Code does.
		const dot = node.value.lastIndexOf('.');
		node.setSelectionRange(0, dot > 0 ? dot : node.value.length);
	};

	function tone(path: string): string {
		const p = problems.get(path);
		if (p?.errors) return 'text-red-600 dark:text-red-400';
		if (p?.warnings) return 'text-amber-600 dark:text-amber-400';
		return '';
	}

	/** A folder holding a file with problems is coloured too. */
	function folderTone(path: string): string {
		let errors = 0;
		let warnings = 0;
		for (const [file, p] of problems) {
			if (!file.startsWith(`${path}/`)) continue;
			errors += p.errors;
			warnings += p.warnings;
		}
		return errors ? 'text-red-600 dark:text-red-400' : warnings ? 'text-amber-600 dark:text-amber-400' : '';
	}

	// Moving: drag and drop (the mouse's own, or a held finger), and Cut then Paste.

	/** The path being dragged and the folder it would land in ('' is the top level). */
	let dragging = $state<string | null>(null);
	let dropDir = $state<string | null>(null);
	let openTimer: ReturnType<typeof setTimeout> | undefined;

	/** Not where it already is, not into itself, and not into node_modules and the like. */
	function canMove(from: string, dir: string): boolean {
		if (inSkipped(dir)) return false;
		return dir !== parentOf(from) && dir !== from && !dir.startsWith(`${from}/`);
	}

	/** The drag is over `dir` (null: nowhere it can land). */
	function hover(dir: string | null): boolean {
		const ok = dragging !== null && dir !== null && canMove(dragging, dir);
		const next = ok ? dir : null;
		if (next !== dropDir) {
			dropDir = next;
			// A closed folder held under the pointer opens, as in VS Code.
			clearTimeout(openTimer);
			if (next) openTimer = setTimeout(() => open(next), 600);
		}
		return ok;
	}

	function endDrag() {
		clearTimeout(openTimer);
		dragging = null;
		dropDir = null;
	}

	function move(from: string, dir: string) {
		open(dir);
		onRename(from, join(dir, nameOf(from)));
	}

	function dragOver(e: DragEvent, dir: string) {
		if (dragging === null) return;
		e.preventDefault();
		e.stopPropagation();
		const ok = hover(dir);
		if (e.dataTransfer) e.dataTransfer.dropEffect = ok ? 'move' : 'none';
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		const [from, dir] = [dragging, dropDir];
		endDrag();
		if (from !== null && dir !== null) move(from, dir);
	}

	/** The rows of the folder something would land in are tinted. */
	const inDrop = (path: string) => dropDir !== null && dropDir !== '' && (path === dropDir || path.startsWith(`${dropDir}/`));

	/** What Cut or Copy picked up, until it is pasted (a cut) or replaced. */
	let clip = $state<{ path: string; folder: boolean; cut: boolean } | null>(null);

	/** `name` in `dir`, or "name copy.ext", "name copy 2.ext" if that is taken, as VS Code names copies. */
	function freeName(dir: string, name: string, folder: boolean): string {
		const taken = new Set(entries.map((e) => e.replace(/\/$/, '')));
		if (!taken.has(join(dir, name))) return join(dir, name);
		const dot = folder ? -1 : name.lastIndexOf('.');
		const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
		for (let i = 1; ; i++) {
			const next = join(dir, `${stem} copy${i > 1 ? ` ${i}` : ''}${ext}`);
			if (!taken.has(next)) return next;
		}
	}

	function paste(dir: string) {
		const c = clip;
		if (!c) return;
		if (dir === c.path || dir.startsWith(`${c.path}/`)) {
			toast.error(`${nameOf(c.path)} cannot go inside itself`);
			return;
		}
		if (c.cut) {
			clip = null;
			if (dir !== parentOf(c.path)) move(c.path, dir);
			return;
		}
		open(dir);
		onCopy(c.path, freeName(dir, nameOf(c.path), c.folder));
	}

	const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
	/** Shortcut hints in the menu: ⌘C on a Mac, Ctrl+C elsewhere. */
	const keys = (key: string) => (mac ? `⌘${key}` : `Ctrl+${key}`);

	/**
	 * Keys in the tree, as in VS Code's Explorer, on the row that has the focus:
	 * F2 renames, Delete (or Cmd+Backspace on a Mac) deletes after the same
	 * confirmation as the bin button, and Cmd/Ctrl+X, C and V cut, copy and
	 * paste. A paste lands in the focused folder (or the file's folder), and with
	 * no row focused, in the folder last clicked.
	 */
	function treeKey(e: KeyboardEvent) {
		if ((e.target as Element).closest('input')) return;
		const t = targetOf(e.target);
		const plain = !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
		if (plain && e.key === 'F2') {
			if (!t.row || inSkipped(t.path)) return;
			e.preventDefault();
			editing = { kind: 'rename', path: t.path };
			return;
		}
		if ((plain && e.key === 'Delete') || (mac && e.metaKey && !e.shiftKey && !e.altKey && e.key === 'Backspace')) {
			if (!t.row) return;
			e.preventDefault();
			onDelete(t.path, t.folder);
			return;
		}
		if (!(mac ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey) return;
		const key = e.key.toLowerCase();
		if (key !== 'x' && key !== 'c' && key !== 'v') return;
		if (key === 'v') {
			if (!clip) return;
			paste(!t.row ? selectedDir : t.folder ? t.path : parentOf(t.path));
		} else {
			if (!t.row || inSkipped(t.path)) return;
			clip = { path: t.path, folder: t.folder, cut: key === 'x' };
		}
		e.preventDefault();
	}

	async function copyText(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success('Copied');
		} catch {
			toast.error('Could not copy to the clipboard');
		}
	}

	// The menu: a right-click, or a long press on a touch screen. Path '' is the empty space below the files.

	let menu = $state<{ path: string; folder: boolean; x: number; y: number } | null>(null);
	const anchor = $derived.by(() => {
		const { x, y } = menu ?? { x: 0, y: 0 };
		return { getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) };
	});

	/** The row under an event, from its data-path, or the empty space. */
	function targetOf(el: EventTarget | null): { path: string; folder: boolean; row: boolean } {
		const row = (el as Element | null)?.closest<HTMLElement>('[data-path]');
		return row ? { path: row.dataset.path!, folder: row.dataset.folder === 'true', row: true } : { path: '', folder: true, row: false };
	}

	/** Runs after the menu has closed, so a rename input keeps the focus. */
	const later = (fn: () => void) => () => setTimeout(fn, 0);

	// Touch: hold still to arm, then lift for the menu or move to drag. A move before then is a scroll.

	const HOLD_MS = 450;
	const SLOP = 8;
	let press: { path: string; folder: boolean; row: boolean; x: number; y: number; id: number; held: boolean; timer: ReturnType<typeof setTimeout> } | null = null;
	/** The row being held, tinted so the hold shows. */
	let held = $state<string | null>(null);
	/** The name following the finger while dragging. */
	let ghost = $state<{ name: string; x: number; y: number } | null>(null);
	/** A long press or a drag is followed by a click, which must not open the file. */
	let swallowClick = false;
	let pointerType = 'mouse';
	/** The mouse's own drag and drop, kept off touch screens where the hold does it. */
	let mouseDrag = $state(true);

	onMount(() => {
		mouseDrag = !matchMedia('(pointer: coarse)').matches;
	});

	function cancelPress() {
		if (press) clearTimeout(press.timer);
		press = null;
		held = null;
		ghost = null;
	}

	function pointerDown(e: PointerEvent) {
		pointerType = e.pointerType;
		swallowClick = false;
		if (e.pointerType === 'mouse' || (e.target as Element).closest('input')) return;
		cancelPress();
		const p = { ...targetOf(e.target), x: e.clientX, y: e.clientY, id: e.pointerId, held: false, timer: undefined as unknown as ReturnType<typeof setTimeout> };
		p.timer = setTimeout(() => {
			p.held = true;
			held = p.row ? p.path : '';
			navigator.vibrate?.(10);
		}, HOLD_MS);
		press = p;
	}

	function pointerMove(e: PointerEvent) {
		const p = press;
		if (!p || e.pointerId !== p.id) return;
		const far = Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP;
		if (!p.held) {
			if (far) cancelPress();
			return;
		}
		if (dragging === null) {
			if (!far || !p.row || inSkipped(p.path)) return;
			dragging = p.path;
			held = null;
		}
		ghost = { name: nameOf(p.path), x: e.clientX, y: e.clientY };
		const under = document.elementFromPoint(e.clientX, e.clientY);
		const t = targetOf(under);
		hover(t.row ? (t.folder ? t.path : parentOf(t.path)) : treeEl.contains(under) ? '' : null);
		// Near the top or bottom edge, the tree scrolls.
		const box = treeEl.getBoundingClientRect();
		if (e.clientY < box.top + 32) treeEl.scrollTop -= 10;
		else if (e.clientY > box.bottom - 32) treeEl.scrollTop += 10;
	}

	function pointerUp(e: PointerEvent) {
		const p = press;
		if (!p || e.pointerId !== p.id) return;
		cancelPress();
		if (dragging !== null) {
			const [from, dir] = [dragging, dropDir];
			endDrag();
			swallowClick = true;
			if (dir !== null) move(from, dir);
		} else if (p.held) {
			swallowClick = true;
			menu = { path: p.path, folder: p.folder, x: e.clientX, y: e.clientY };
		}
	}

	// Once a hold has armed, the finger drags instead of scrolling the page.
	const holdScroll = (node: HTMLElement) => {
		const stop = (e: TouchEvent) => {
			if (press?.held) e.preventDefault();
		};
		node.addEventListener('touchmove', stop, { passive: false });
		return () => node.removeEventListener('touchmove', stop);
	};
</script>

{#snippet input(value: string, depth: number, folder: boolean)}
	<div class="flex items-center gap-1 py-0.5 pr-2" style="padding-left: {depth * 12 + 22}px">
		{#if folder}<Folder class="size-3.5 shrink-0 text-muted-foreground" />{:else}<FileCode2
				class="size-3.5 shrink-0 text-muted-foreground"
			/>{/if}
		<input
			class="min-w-0 flex-1 rounded-sm border border-primary bg-background px-1 font-mono text-xs outline-none"
			{value}
			aria-label={folder ? 'Folder name' : 'File name'}
			{@attach focusInput}
			onblur={(e) => commit(e.currentTarget.value)}
			onkeydown={(e) => {
				if (e.key === 'Enter') commit(e.currentTarget.value);
				if (e.key === 'Escape') editing = null;
			}}
		/>
	</div>
{/snippet}

{#snippet nodes(list: TreeNode[], depth: number, dir: string)}
	{#if editing && editing.kind !== 'rename' && editing.dir === dir}
		{@render input('', depth, editing.kind === 'folder')}
	{/if}
	{#each list as node (node.path)}
		{#if editing?.kind === 'rename' && editing.path === node.path}
			{@render input(node.name, depth, node.folder)}
		{:else}
			<div
				class={[
					'group flex items-center gap-1 py-0.5 pr-1 font-mono text-xs',
					inDrop(node.path)
						? 'bg-primary/10'
						: held === node.path || menu?.path === node.path
							? 'bg-accent'
							: !node.folder && node.path === activePath
								? 'bg-accent text-accent-foreground'
								: 'hover:bg-accent/50',
					(dragging === node.path || (clip?.cut && (node.path === clip.path || node.path.startsWith(`${clip.path}/`)))) && 'opacity-50'
				]}
				style="padding-left: {depth * 12 + 6}px"
				role="treeitem"
				tabindex="-1"
				aria-selected={!node.folder && node.path === activePath}
				data-path={node.path}
				data-folder={node.folder}
				draggable={mouseDrag && !inSkipped(node.path)}
				ondragstart={(e) => {
					dragging = node.path;
					if (e.dataTransfer) {
						e.dataTransfer.effectAllowed = 'move';
						e.dataTransfer.setData('text/plain', node.path);
					}
				}}
				ondragend={endDrag}
				ondragover={(e) => dragOver(e, node.folder ? node.path : parentOf(node.path))}
				ondrop={drop}
			>
				<button
					type="button"
					class={['flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left', node.folder ? folderTone(node.path) : tone(node.path)]}
					title={node.path}
					onclick={() => {
						if (node.folder) {
							toggle(node.path);
						} else {
							selectedDir = parentOf(node.path);
							onOpen(node.path);
						}
					}}
				>
					{#if node.folder}
						{#if expanded.has(node.path)}
							<ChevronDown class="size-3.5 shrink-0" />
							<FolderOpen class="size-3.5 shrink-0 text-muted-foreground" />
						{:else}
							<ChevronRight class="size-3.5 shrink-0" />
							<Folder class="size-3.5 shrink-0 text-muted-foreground" />
						{/if}
					{:else}
						<span class="size-3.5 shrink-0"></span>
						<FileCode2 class="size-3.5 shrink-0 text-muted-foreground" />
					{/if}
					<span class={['truncate', inSkipped(node.path) && 'text-muted-foreground']}>{node.name}</span>
				</button>
				{#if !inSkipped(node.path)}
					<button
						type="button"
						class="cursor-pointer p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-foreground focus:opacity-100"
						aria-label="Rename {node.name}"
						onclick={() => (editing = { kind: 'rename', path: node.path })}
					>
						<Pencil class="size-3" />
					</button>
				{/if}
				<button
					type="button"
					class="cursor-pointer p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-destructive focus:opacity-100"
					aria-label="Delete {node.name}"
					onclick={() => onDelete(node.path, node.folder)}
				>
					<Trash2 class="size-3" />
				</button>
			</div>
			{#if node.folder && expanded.has(node.path)}
				{@render nodes(node.children, depth + 1, node.path)}
			{/if}
		{/if}
	{/each}
{/snippet}

<div class="flex h-full min-h-0 flex-col">
	<div class="flex items-center gap-0.5 px-2 py-1.5">
		<span class="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wider text-muted-foreground uppercase" title={title}>
			{title}
		</span>
		<button type="button" class="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="New file" aria-label="New file" onclick={() => startNew('file')}>
			<FilePlus class="size-3.5" />
		</button>
		<button type="button" class="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="New folder" aria-label="New folder" onclick={() => startNew('folder')}>
			<FolderPlus class="size-3.5" />
		</button>
		<button type="button" class="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Refresh" aria-label="Refresh the file tree" onclick={onRefresh}>
			<RefreshCw class="size-3.5" />
		</button>
		<button
			type="button"
			class="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
			title="Collapse folders"
			aria-label="Collapse folders"
			onclick={() => {
				expanded = new Set();
				selectedDir = '';
			}}
		>
			<ChevronsDownUp class="size-3.5" />
		</button>
	</div>
	<!--
		A click on empty space puts new files at the top level, and a drop there moves to it.
		No text selection or iOS callout, so a long press is the menu's.
	-->
	<div
		bind:this={treeEl}
		class={[
			'min-h-0 flex-1 overflow-auto pb-4 select-none [-webkit-touch-callout:none]',
			(dropDir === '' || held === '') && 'bg-primary/5 outline-1 -outline-offset-1 outline-primary/40'
		]}
		role="tree"
		tabindex="-1"
		{@attach holdScroll}
		onclick={(e) => e.target === e.currentTarget && (selectedDir = '')}
		onclickcapture={(e) => {
			if (!swallowClick) return;
			swallowClick = false;
			e.preventDefault();
			e.stopPropagation();
		}}
		onkeydown={treeKey}
		oncontextmenu={(e) => {
			if ((e.target as Element).closest('input')) return;
			e.preventDefault();
			// A touch long press opens the menu itself, when the finger lifts.
			if (pointerType !== 'mouse') return;
			const t = targetOf(e.target);
			menu = { path: t.path, folder: t.folder, x: e.clientX, y: e.clientY };
		}}
		onpointerdown={pointerDown}
		onpointermove={pointerMove}
		onpointerup={pointerUp}
		onpointercancel={cancelPress}
		ondragover={(e) => dragOver(e, '')}
		ondragleave={(e) => {
			if (!e.currentTarget.contains(e.relatedTarget as Node | null)) dropDir = null;
		}}
		ondrop={drop}
	>
		{@render nodes(tree, 0, '')}
	</div>
</div>

{#if ghost}
	<div
		class="pointer-events-none fixed z-50 rounded-md border bg-popover px-2 py-1 font-mono text-xs text-popover-foreground shadow-md"
		style="left: {ghost.x + 14}px; top: {ghost.y - 34}px"
	>
		{ghost.name}
	</div>
{/if}

<DropdownMenu.Root
	open={menu !== null}
	onOpenChange={(o) => {
		if (!o) menu = null;
	}}
>
	<DropdownMenu.Content
		customAnchor={anchor}
		side="bottom"
		align="start"
		sideOffset={2}
		class="min-w-48 outline-none md:min-w-44 md:rounded-lg md:p-1 md:[&_[data-slot=dropdown-menu-item]]:rounded-md md:[&_[data-slot=dropdown-menu-item]]:py-1 md:[&_[data-slot=dropdown-menu-item]]:text-[13px]"
		onCloseAutoFocus={(e) => e.preventDefault()}
	>
		{#if menu}
			{@const { path, folder } = menu}
			{@const dir = path === '' ? '' : folder ? path : parentOf(path)}
			{@const skipped = path !== '' && inSkipped(path)}
			{#if path !== '' && !folder}
				<DropdownMenu.Item onSelect={() => onOpen(path)}><FileCode2 />Open</DropdownMenu.Item>
				<DropdownMenu.Separator />
			{/if}
			{#if (folder && !skipped) || path === ''}
				<DropdownMenu.Item onSelect={later(() => startNew('file', dir))}><FilePlus />New file</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={later(() => startNew('folder', dir))}><FolderPlus />New folder</DropdownMenu.Item>
				<DropdownMenu.Separator />
			{/if}
			{#if path !== '' && !skipped}
				<DropdownMenu.Item onSelect={() => (clip = { path, folder, cut: true })}>
					<Scissors />Cut<DropdownMenu.Shortcut class="hidden md:inline">{keys('X')}</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => (clip = { path, folder, cut: false })}>
					<Copy />Copy<DropdownMenu.Shortcut class="hidden md:inline">{keys('C')}</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
			{/if}
			{#if !skipped}
				<DropdownMenu.Item disabled={!clip} onSelect={() => paste(dir)}>
					<ClipboardPaste />
					<span class="min-w-0 flex-1 truncate">Paste{clip ? ` ${nameOf(clip.path)}` : ''}</span>
					<DropdownMenu.Shortcut class="hidden md:inline">{keys('V')}</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
			{/if}
			{#if path !== '' && !skipped}
				<DropdownMenu.Item onSelect={() => onCopy(path, freeName(parentOf(path), nameOf(path), folder))}><CopyPlus />Duplicate</DropdownMenu.Item>
			{/if}
			{#if path !== ''}
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={() => copyText(`/workspace/${path}`)}><ClipboardCopy />Copy path</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => copyText(path)}><ClipboardCopy />Copy relative path</DropdownMenu.Item>
				<DropdownMenu.Separator />
				{#if !skipped}
					<DropdownMenu.Item onSelect={later(() => (editing = { kind: 'rename', path }))}>
						<Pencil />Rename<DropdownMenu.Shortcut class="hidden md:inline">F2</DropdownMenu.Shortcut>
					</DropdownMenu.Item>
				{/if}
				<DropdownMenu.Item variant="destructive" onSelect={() => onDelete(path, folder)}>
					<Trash2 />Delete<DropdownMenu.Shortcut class="hidden md:inline">{mac ? '⌘⌫' : 'Delete'}</DropdownMenu.Shortcut>
				</DropdownMenu.Item>
			{:else}
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={onRefresh}><RefreshCw />Refresh</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => (expanded = new Set())}><ChevronsDownUp />Collapse folders</DropdownMenu.Item>
			{/if}
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
