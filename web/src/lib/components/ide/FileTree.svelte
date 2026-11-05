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
		FileCode2,
		FilePlus,
		Folder,
		FolderOpen,
		FolderPlus,
		Pencil,
		RefreshCw,
		Trash2
	} from '@lucide/svelte';

	/**
	 * The project's files, as VS Code's Explorer: folders collapse, a click opens
	 * a file, and new file, new folder, rename and delete happen in place.
	 * Folders the box skips (node_modules, target) are listed but empty.
	 */

	interface Props {
		title: string;
		entries: string[];
		activePath: string | null;
		/** Error and warning counts per file, to colour names as VS Code does. */
		problems: Map<string, { errors: number; warnings: number }>;
		onOpen: (path: string) => void;
		onCreate: (path: string, folder: boolean) => void;
		onRename: (from: string, to: string) => void;
		onDelete: (path: string, folder: boolean) => void;
		onRefresh: () => void;
		/** A folder was opened: the page loads one whose contents the box listing left out. */
		onExpand?: (path: string) => void;
	}

	let { title, entries, activePath, problems, onOpen, onCreate, onRename, onDelete, onRefresh, onExpand }: Props = $props();

	/** Build output and installs: listed dimmed, as VS Code dims ignored files, and loaded when opened. */
	const SKIPPED = new Set(['node_modules', 'target', '.venv', '__pycache__', 'build']);
	const inSkipped = (path: string) => path.split('/').some((part) => SKIPPED.has(part));

	const tree = $derived(buildTree(entries));
	let expanded = $state(new Set<string>(['src', 'lib']));
	/** The folder new files go in: the one last clicked, or the open file's. */
	let selectedDir = $state('');

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

	function startNew(kind: 'file' | 'folder') {
		const dir = selectedDir;
		if (dir) expanded = new Set([...expanded, dir]);
		editing = { kind, dir };
	}

	function commit(text: string) {
		const state = editing;
		editing = null;
		const name = text.trim().replace(/^\/+|\/+$/g, '');
		if (!state || !name) return;
		if (state.kind === 'rename') {
			const cut = state.path.lastIndexOf('/');
			const to = (cut < 0 ? '' : state.path.slice(0, cut + 1)) + name;
			if (to !== state.path) onRename(state.path, to);
			return;
		}
		onCreate(state.dir ? `${state.dir}/${name}` : name, state.kind === 'folder');
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
					!node.folder && node.path === activePath ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
				]}
				style="padding-left: {depth * 12 + 6}px"
			>
				<button
					type="button"
					class={['flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left', node.folder ? folderTone(node.path) : tone(node.path)]}
					title={node.path}
					onclick={() => {
						if (node.folder) {
							toggle(node.path);
						} else {
							const cut = node.path.lastIndexOf('/');
							selectedDir = cut < 0 ? '' : node.path.slice(0, cut);
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
	<!-- A click on empty space puts new files at the top level. -->
	<div class="min-h-0 flex-1 overflow-auto pb-4" role="tree" tabindex="-1" onclick={(e) => e.target === e.currentTarget && (selectedDir = '')} onkeydown={() => {}}>
		{@render nodes(tree, 0, '')}
	</div>
</div>
